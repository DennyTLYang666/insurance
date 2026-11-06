#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
經濟趨勢看板 資料更新程式（只用 Python 標準函式庫，Python 3.8+）

做什麼：
  1. 從 FRED 抓宏觀數列（美元指數、實質利率、殖利率、CPI、非農…），
     月頻數列用「初次公布版」並取得公布日（avail_date），避免回測看到未來資料。
  2. 由公布日推出公告事件（CPI／核心 CPI／PCE／非農／失業率／聯準會升降息／英國 CPI）。
  3. 讀你現有的 StateExporter M1 旁表（*_M1.csv）算：日收盤、事件後 5／15／60 分鐘反應（以 M5 ATR 為單位）。
  4. 輸出（HTML 與 MT5 共用）：series.csv、events.csv、meta.csv、prices_daily.csv、reactions.csv，
     另有只給 HTML 用的 econ_data.js，以及 update_report.txt（每個數列抓取結果、時區自我檢查）。

用法：雙擊 update.bat（全部更新）或 update_prices.bat（只重讀 state_export 的 M1，不連 FRED）；
      或  python econ_update.py [--config 檔案] [--only prices] [--selftest]
金鑰：econ_config.local.ini 的 [fred] api_key，或環境變數 FRED_API_KEY（不要寫進 HTML／文件／程式庫）。
"""
import argparse, array, bisect, configparser, csv, datetime as dt, glob, json, math, os, random, shutil, statistics, sys, tempfile, time
import urllib.parse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
FRED_URL = "https://api.stlouisfed.org/fred/series/observations"

# id, 英文名稱(ASCII，MT5 也讀得了), 單位, 頻率, 變化方式(pct=百分比變化, diff=差值), 群組, 是否可缺
SERIES = [
    ("DTWEXBGS", "Broad USD Index", "index", "D", "pct", "usd", False),
    ("DFII10", "US 10Y Real Yield (TIPS)", "pct", "D", "diff", "rates", False),
    ("DGS10", "US 10Y Treasury Yield", "pct", "D", "diff", "rates", False),
    ("DGS2", "US 2Y Treasury Yield", "pct", "D", "diff", "rates", False),
    ("T10YIE", "US 10Y Breakeven Inflation", "pct", "D", "diff", "infl", False),
    ("DFF", "Fed Funds Effective Rate", "pct", "D", "diff", "rates", False),
    ("DFEDTARU", "Fed Funds Target Upper", "pct", "D", "diff", "rates", True),
    ("VIXCLS", "VIX", "index", "D", "pct", "risk", False),
    ("DEXUSUK", "USD per GBP (FRED noon rate)", "usd", "D", "pct", "fx", True),
    ("CPIAUCSL", "US CPI All Items (index)", "index", "M", "pct", "infl", False),
    ("CPILFESL", "US Core CPI (index)", "index", "M", "pct", "infl", False),
    ("PCEPI", "US PCE Price Index", "index", "M", "pct", "infl", True),
    ("PAYEMS", "US Nonfarm Payrolls (thousand)", "thousand", "M", "diff", "labor", False),
    ("UNRATE", "US Unemployment Rate", "pct", "M", "diff", "labor", False),
    ("IRLTLT01GBM156N", "UK 10Y Gov Bond Yield (monthly)", "pct", "M", "diff", "uk", True),
    ("GBRCPIALLMINMEI", "UK CPI All Items (index)", "index", "M", "pct", "uk", True),
]
# 事件：series, 事件名, 國家, 重要性, 計算方式(pct=MoM%, diff=差值, level=水準), 時區, 公布時間
EVENT_DEFS = [
    ("CPIAUCSL", "US CPI MoM", "US", "H", "pct", "ET", (8, 30)),
    ("CPILFESL", "US Core CPI MoM", "US", "H", "pct", "ET", (8, 30)),
    ("PCEPI", "US PCE Price MoM", "US", "M", "pct", "ET", (8, 30)),
    ("PAYEMS", "US Nonfarm Payrolls", "US", "H", "diff", "ET", (8, 30)),
    ("UNRATE", "US Unemployment Rate", "US", "M", "level", "ET", (8, 30)),
    ("GBRCPIALLMINMEI", "UK CPI MoM", "GB", "M", "pct", "LON", (7, 0)),
]
HORIZONS = (5, 15, 60)

# ───────────────────────── 時區 ─────────────────────────
def nth_weekday(y, m, wd, n):
    if n > 0:
        d = dt.date(y, m, 1)
        d += dt.timedelta(days=(wd - d.weekday()) % 7 + 7 * (n - 1))
        return d
    d = dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)
    return d - dt.timedelta(days=(d.weekday() - wd) % 7)

def us_dst(d):
    return nth_weekday(d.year, 3, 6, 2) <= d < nth_weekday(d.year, 11, 6, 1)

def uk_dst(d):
    return nth_weekday(d.year, 3, 6, -1) <= d < nth_weekday(d.year, 10, 6, -1)

def local_to_utc(d, hhmm, tz):
    t = dt.datetime(d.year, d.month, d.day, hhmm[0], hhmm[1])
    if tz == "ET":
        return t + dt.timedelta(hours=4 if us_dst(d) else 5)
    return t - dt.timedelta(hours=1 if uk_dst(d) else 0)

def server_to_utc(t, win, summ):
    return t - dt.timedelta(hours=summ if us_dst(t.date()) else win)

def fmt_d(d): return d.strftime("%Y.%m.%d")
def fmt_t(t): return t.strftime("%Y.%m.%d %H:%M")
def parse_d(s): return dt.datetime.strptime(s, "%Y-%m-%d").date()

# ───────────────────────── FRED ─────────────────────────
def fred_fetch(series_id, key, start, initial_release):
    q = {"series_id": series_id, "api_key": key, "file_type": "json", "observation_start": start}
    if initial_release:
        q.update({"output_type": "4", "realtime_start": "1776-07-04", "realtime_end": "9999-12-31"})
    url = FRED_URL + "?" + urllib.parse.urlencode(q)
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:      # 超過頻率限制：等一下再試
                time.sleep(20 * (attempt + 1)); continue
            body = ""
            try: body = e.read().decode("utf-8", "replace")[:200]
            except Exception: pass
            raise RuntimeError("HTTP %s %s" % (e.code, body))
        except Exception as e:
            last = e; time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("連線失敗：%s" % last)

def get_series(sid, freq, key, start, fetch):
    """回傳 [(date, value, avail_date)]；月頻用初次公布版＋公布日，失敗退回最新版＋近似公布日。"""
    notes = []
    obs = None
    if freq == "M":
        try:
            obs = fetch(sid, key, start, True)
            mode = "initial"
        except Exception as e:
            notes.append("初次公布版失敗(%s)，改用最新版、公布日以月底+15天近似" % e)
    if obs is None:
        obs = fetch(sid, key, start, False)
        mode = "latest"
    rows = []
    for o in obs.get("observations", []):
        v = o.get("value", ".")
        if v in (".", "", None): continue
        try:
            d = parse_d(o["date"]); val = float(v)
        except Exception:
            continue
        if freq == "M":
            if mode == "initial" and o.get("realtime_start"):
                try: av = parse_d(o["realtime_start"])
                except Exception: av = d + dt.timedelta(days=45)
            else:
                av = (dt.date(d.year + (d.month == 12), d.month % 12 + 1, 1) + dt.timedelta(days=14))
        else:
            av = d + dt.timedelta(days=1)
        rows.append((d, val, av))
    rows.sort()
    # 初次公布版同一 date 可能有多列 → 取最早公布的一列
    dedup = {}
    for d, v, av in rows:
        if d not in dedup or av < dedup[d][1]: dedup[d] = (v, av)
    out = [(d, dedup[d][0], dedup[d][1]) for d in sorted(dedup)]
    return out, mode, notes

# ───────────────────────── 事件 ─────────────────────────
def build_events(data):
    ev = []
    for sid, name, ctry, imp, kind, tz, hhmm in EVENT_DEFS:
        rows = data.get(sid)
        if not rows or len(rows) < 3: continue
        vals = [(d, v, av) for d, v, av in rows]
        meas = []   # (avail, actual, previous)
        series_m = []
        for i in range(1, len(vals)):
            if kind == "pct": m = (vals[i][1] / vals[i-1][1] - 1) * 100 if vals[i-1][1] else None
            elif kind == "diff": m = vals[i][1] - vals[i-1][1]
            else: m = vals[i][1]
            series_m.append((vals[i][2], m))
        for i in range(1, len(series_m)):
            av, a = series_m[i]; p = series_m[i-1][1]
            if a is None: continue
            ev.append(dict(avail=av, name=name, country=ctry, importance=imp, actual=a, previous=p, forecast=None,
                           utc=local_to_utc(av, hhmm, tz), source="FRED-initial"))
    # 聯準會升降息（目標利率上限變動；只含有變動的會議，生效日前一天 14:00 ET 公布的近似）
    rows = data.get("DFEDTARU")
    if rows:
        prev = None
        for d, v, _ in rows:
            if prev is not None and abs(v - prev) > 1e-9:
                ad = d - dt.timedelta(days=1)
                while ad.weekday() >= 5: ad -= dt.timedelta(days=1)
                ev.append(dict(avail=ad, name="US FOMC Rate Change", country="US", importance="H", actual=v, previous=prev,
                               forecast=None, utc=local_to_utc(ad, (14, 0), "ET"), source="FRED-DFEDTARU(change days only)"))
            prev = v
    ev.sort(key=lambda e: e["utc"])
    # 驚喜：有 forecast 用 actual-forecast，否則 actual-previous（代理）；z 以同事件歷史標準差標準化
    by = {}
    for e in ev:
        e["surprise"] = e["actual"] - (e["forecast"] if e["forecast"] is not None else e["previous"])
        by.setdefault(e["name"], []).append(e["surprise"])
    def robust_scale(v):      # 用中位數絕對偏差（MAD×1.4826）：疫情那種極端值不會把尺度撐大，一般月份的 z 才有意義
        if len(v) < 3: return 0.0
        m = statistics.median(v); mad = statistics.median([abs(x - m) for x in v]) * 1.4826
        return mad if mad > 0 else statistics.pstdev(v)
    sd = {k: robust_scale(v) for k, v in by.items()}
    for e in ev:
        s = sd[e["name"]]
        e["surprise_z"] = (e["surprise"] / s) if s > 0 else 0.0
        e["surprise_basis"] = "forecast" if e["forecast"] is not None else "previous"
    return ev

# ───────────────────────── 價格（M1 旁表） ─────────────────────────
class M1:
    def __init__(self):
        self.t = array.array("q"); self.o = array.array("d"); self.h = array.array("d"); self.l = array.array("d"); self.c = array.array("d")
        self.last = None

def resolve(p, base):
    p = os.path.expanduser(p.strip())
    return p if os.path.isabs(p) else os.path.normpath(os.path.join(base, p))

def expand_m1(spec, base):
    """spec 以 | 分隔多個路徑，每個可含萬用字元（*）。相對路徑以 base_dir 為準。"""
    out = []
    for part in spec.split("|"):
        if not part.strip(): continue
        pat = resolve(part, base)
        hits = sorted(glob.glob(pat))
        if not hits: raise RuntimeError("找不到 M1 檔：" + pat)
        out.extend(hits)
    return out

def read_m1(paths):
    m = M1(); seen = set()
    rows = []
    for p in paths:
        with open(p, "r", encoding="utf-8", errors="replace", newline="") as f:
            rd = csv.reader(f); next(rd, None)
            for r in rd:
                if len(r) < 5: continue
                try:
                    tt = dt.datetime.strptime(r[0], "%Y.%m.%d %H:%M")
                    key = int((tt - dt.datetime(1970, 1, 1)).total_seconds() // 60)
                    rows.append((key, float(r[1]), float(r[2]), float(r[3]), float(r[4])))
                except Exception:
                    continue
    rows.sort(key=lambda x: x[0])
    last = None
    for k, o, h, l, c in rows:
        if k == last: continue   # 兩份檔重疊時只留一次
        last = k
        m.t.append(k); m.o.append(o); m.h.append(h); m.l.append(l); m.c.append(c)
    return m

def to_min(t): return int((t - dt.datetime(1970, 1, 1)).total_seconds() // 60)

def daily_closes(m, win, summ):
    out = {}
    for i in range(len(m.t)):
        t = dt.datetime(1970, 1, 1) + dt.timedelta(minutes=m.t[i])
        out[t.date()] = m.c[i]
    return sorted(out.items())

def reaction(m, utc_event, win, summ):
    """回傳 (atr, {h: 位移}) 或 None。M1 時間為伺服器時間，先換成伺服器分鐘再查。"""
    # 伺服器時間 = utc + offset；offset 取事件當天的 US DST 規則
    off = summ if us_dst(utc_event.date()) else win
    ks = to_min(utc_event) + off * 60
    i = bisect.bisect_left(m.t, ks)
    if i >= len(m.t) or i < 80: return None
    if m.t[i] - ks > 2 or m.t[i - 1] != ks - 1:      # 事件那分鐘前後要有連續 M1
        return None
    base = m.c[i - 1]
    # M5 ATR(14)：事件前 70 分鐘聚成 14 根 M5
    trs = []; prev_close = None
    lo_i = bisect.bisect_left(m.t, ks - 70)
    j = lo_i
    while j < i:
        grp = ks - 70 + ((m.t[j] - (ks - 70)) // 5) * 5
        hi = -1e18; lo = 1e18; o_ = m.o[j]; c_ = m.c[j]
        while j < i and m.t[j] < grp + 5:
            hi = max(hi, m.h[j]); lo = min(lo, m.l[j]); c_ = m.c[j]; j += 1
        tr = hi - lo if prev_close is None else max(hi - lo, abs(hi - prev_close), abs(lo - prev_close))
        trs.append(tr); prev_close = c_
    if len(trs) < 8: return None
    atr = sum(trs) / len(trs)
    if atr <= 0: return None
    res = {}
    for h in HORIZONS:
        k2 = bisect.bisect_left(m.t, ks + h - 1)
        if k2 >= len(m.t) or m.t[k2] != ks + h - 1: res[h] = None
        else: res[h] = (m.c[k2] - base) / atr
    return atr, res

def offset_check(m, events, win, summ):
    """時區自我檢查：高重要性事件那一分鐘的波動，是否比前 60 分鐘中位數明顯放大。比較幾種伺服器時區假設。"""
    hi = [e for e in events if e["importance"] == "H" and e["country"] == "US"]
    out = []
    for w in range(0, 5):
        sm = w + 1
        ratios = []
        for e in hi:
            off = sm if us_dst(e["utc"].date()) else w
            ks = to_min(e["utc"]) + off * 60
            i = bisect.bisect_left(m.t, ks)
            if i >= len(m.t) or i < 70 or m.t[i] != ks: continue
            rngs = sorted(m.h[x] - m.l[x] for x in range(i - 60, i))
            med = rngs[len(rngs) // 2]
            if med <= 0: continue
            ratios.append((m.h[i] - m.l[i]) / med)
        if ratios: out.append((w, sm, statistics.median(ratios), len(ratios)))
    return out

# ───────────────────────── 輸出 ─────────────────────────
def write_csv(path, header, rows):
    with open(path, "w", encoding="ascii", newline="\n") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        for r in rows: w.writerow(r)

def num(x, nd=6):
    if x is None: return ""
    s = ("%." + str(nd) + "f") % x
    return s.rstrip("0").rstrip(".") if "." in s else s

def load_cached(outdir):
    """只更新價格時：從上次輸出的 series.csv／meta.csv 還原 FRED 數列（不連網）。"""
    sp, mp = os.path.join(outdir, "series.csv"), os.path.join(outdir, "meta.csv")
    if not (os.path.exists(sp) and os.path.exists(mp)):
        raise SystemExit("沒有上次的 series.csv／meta.csv（%s）。請先完整更新一次（update.bat）。" % outdir)
    def pd(x): return dt.datetime.strptime(x, "%Y.%m.%d").date()
    data = {}
    with open(sp, encoding="ascii", newline="") as f:
        for r in csv.DictReader(f):
            data.setdefault(r["series_id"], []).append((pd(r["date"]), float(r["value"]), pd(r["avail_date"])))
    meta = []
    with open(mp, encoding="ascii", newline="") as f:
        for r in csv.DictReader(f):
            meta.append((r["series_id"], r["name"], r["unit"], r["freq"], r["chg"], r["group"], r["source"], r["last_checked"], r["last_obs"]))
    return data, meta

def run(cfg, fetch=fred_fetch, log=print, only="all"):
    key = os.environ.get("FRED_API_KEY") or cfg.get("fred", "api_key", fallback="").strip()
    start = cfg.get("fred", "start", fallback="2015-01-01").strip()
    ini_dir = cfg.get("paths", "_ini_dir", fallback=HERE)
    bd = cfg.get("paths", "base_dir", fallback="").strip()
    base = resolve(bd, ini_dir) if bd else ini_dir          # base_dir 只管 [prices] 的 M1 檔路徑
    outdir = resolve(cfg.get("output", "dir", fallback="data"), ini_dir)   # 輸出資料夾（與 mt5_mirror）一律相對於 ini 所在資料夾
    os.makedirs(outdir, exist_ok=True)
    win = cfg.getfloat("prices", "server_utc_offset_winter", fallback=2.0)
    summ = cfg.getfloat("prices", "server_utc_offset_summer", fallback=3.0)
    report = []
    def rp(s):
        report.append(s); log(s)
    if not key and fetch is fred_fetch and only == "all":
        raise SystemExit("沒有 FRED 金鑰：請在 econ_config.local.ini 的 [fred] 填 api_key，或設環境變數 FRED_API_KEY")
    rp("更新時間 %s（本機）｜M1 base_dir=%s｜輸出=%s" % (dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), base, outdir))
    data = {}; meta = []; ok = 0
    if only == "prices":
        data, meta = load_cached(outdir); ok = len([1 for s in SERIES if s[0] in data])
        rp("模式：只更新價格／事件反應（沿用上次的 FRED 資料，不連網；FRED 最後檢查日 %s）" % (max([m[7] for m in meta]) if meta else "?"))
    for sid, name, unit, freq, chg, grp, optional in (SERIES if only == "all" else []):
        try:
            rows, mode, notes = get_series(sid, freq, key, start, fetch)
            if not rows: raise RuntimeError("沒有資料")
            data[sid] = rows; ok += 1
            rp("OK   %-16s %5d 列  最新 %s  (%s)%s" % (sid, len(rows), fmt_d(rows[-1][0]), mode, ("  ※" + "；".join(notes)) if notes else ""))
            time.sleep(0.3 if fetch is fred_fetch else 0)
            meta.append((sid, name, unit, freq, chg, grp, "FRED", dt.date.today().strftime("%Y.%m.%d"), fmt_d(rows[-1][0])))
        except Exception as e:
            rp("FAIL %-16s %s%s" % (sid, e, "（選配，略過）" if optional else "（必要數列！）"))
    # 衍生：美英 10 年利差（月均）
    if only == "all" and "DGS10" in data and "IRLTLT01GBM156N" in data:
        us = {}
        for d, v, _ in data["DGS10"]:
            us.setdefault((d.year, d.month), []).append(v)
        sp = []
        for d, v, av in data["IRLTLT01GBM156N"]:
            k = (d.year, d.month)
            if k in us:
                sp.append((d, sum(us[k]) / len(us[k]) - v, av))
        if sp:
            data["US_UK_10Y_SPREAD"] = sp
            meta.append(("US_UK_10Y_SPREAD", "US-UK 10Y Yield Spread (monthly avg)", "pct", "M", "diff", "uk", "derived", dt.date.today().strftime("%Y.%m.%d"), fmt_d(sp[-1][0])))
            rp("OK   %-16s %5d 列  (衍生)" % ("US_UK_10Y_SPREAD", len(sp)))
    # 停更檢查：日頻超過 10 天、月頻超過 100 天沒有新值
    stale = []
    today = dt.date.today()
    for sid, name, unit, freq, chg, grp, optional in SERIES:
        if sid in data:
            age = (today - data[sid][-1][0]).days
            if age > (10 if freq == "D" else 100):
                stale.append(sid)
                rp("WARN %-16s 最新資料是 %s（%d 天前），可能已停更，相關事件／走勢會偏舊" % (sid, fmt_d(data[sid][-1][0]), age))
    # 事件
    events = build_events(data)
    rp("事件 %d 筆（%s）" % (len(events), ", ".join(sorted({e['name'] for e in events})) or "無"))
    # 價格
    prices = {}  # symbol -> [(date, close)]
    reacts = []
    m1s = {}
    if cfg.has_section("prices"):
        for sym, val in cfg.items("prices"):
            if sym.startswith("server_utc_offset") or not val.strip(): continue
            symu = sym.upper()
            try:
                m = read_m1(expand_m1(val, base))
            except Exception as e:
                rp("FAIL 價格 %s：%s" % (symu, e)); continue
            if not len(m.t):
                rp("FAIL 價格 %s：M1 檔沒有資料" % symu); continue
            m1s[symu] = m
            prices[symu] = daily_closes(m, win, summ)
            t0 = dt.datetime(1970, 1, 1) + dt.timedelta(minutes=m.t[0]); t1 = dt.datetime(1970, 1, 1) + dt.timedelta(minutes=m.t[-1])
            rp("OK   價格 %-8s M1 %d 根  %s ～ %s（伺服器時間）" % (symu, len(m.t), fmt_t(t0), fmt_t(t1)))
    if "GBPUSD" not in prices and "DEXUSUK" in data:
        prices["GBPUSD"] = [(d, v) for d, v, _ in data["DEXUSUK"]]
        rp("注意 GBPUSD 沒有 M1 檔：日收盤改用 FRED DEXUSUK（紐約中午匯率），事件反應統計不產生")
    # 時區自我檢查＋反應
    for sym, m in m1s.items():
        chk = offset_check(m, events, win, summ)
        if chk:
            rp("時區自我檢查 %s（高重要性美國事件那一分鐘的波幅 ÷ 前 60 分鐘中位數；越大越吻合）：" % sym)
            best = max(chk, key=lambda x: x[2])
            for w, sm, med, n in chk:
                rp("   冬令 UTC+%d／夏令 UTC+%d：%.2f 倍（%d 筆）%s" % (w, sm, med, n, "  ← 最吻合" if (w, sm) == (best[0], best[1]) else ""))
            if (best[0], best[1]) != (int(win), int(summ)):
                rp("   ⚠ 目前設定為冬令 UTC+%g／夏令 UTC+%g，但資料最吻合的是 UTC+%d／UTC+%d；請改 econ_config.ini 的 server_utc_offset_*" % (win, summ, best[0], best[1]))
            elif best[2] < 1.5:
                rp("   ⚠ 放大倍數偏低，時區可能不對或事件資料不足，反應數字請先不要採信")
        else:
            rp("時區自我檢查 %s：事件與 M1 範圍沒有重疊，無法檢查" % sym)
        n = 0
        for e in events:
            r = reaction(m, e["utc"], win, summ)
            if not r: continue
            atr, res = r
            reacts.append((fmt_t(e["utc"]), e["name"], sym, num(e["actual"]), num(e["previous"]), num(e["forecast"]), num(e["surprise"]), num(e["surprise_z"], 3),
                           num(atr, 4), num(res[5], 4), num(res[15], 4), num(res[60], 4)))
            n += 1
        rp("反應 %s：%d 筆事件有對應 M1" % (sym, n))
    # 寫檔
    ser_rows = []
    for sid, rows in data.items():
        for d, v, av in rows:
            ser_rows.append((sid, fmt_d(d), num(v, 6), fmt_d(av)))
    write_csv(os.path.join(outdir, "series.csv"), ["series_id", "date", "value", "avail_date"], ser_rows)
    write_csv(os.path.join(outdir, "events.csv"), ["time_utc", "country", "event", "importance", "previous", "actual", "forecast", "surprise", "surprise_z", "source"],
              [(fmt_t(e["utc"]), e["country"], e["name"], e["importance"], num(e["previous"]), num(e["actual"]), num(e["forecast"]), num(e["surprise"]), num(e["surprise_z"], 3), e["source"]) for e in events])
    write_csv(os.path.join(outdir, "meta.csv"), ["series_id", "name", "unit", "freq", "chg", "group", "source", "last_checked", "last_obs"], meta)
    write_csv(os.path.join(outdir, "prices_daily.csv"), ["symbol", "date", "close"], [(s, fmt_d(d), num(c, 5)) for s, rows in prices.items() for d, c in rows])
    write_csv(os.path.join(outdir, "reactions.csv"), ["time_utc", "event", "symbol", "actual", "previous", "forecast", "surprise", "surprise_z", "atr_m5", "r5", "r15", "r60"], reacts)
    js = {"updated": dt.datetime.now().strftime("%Y.%m.%d %H:%M"), "fred_updated": (max([m[7] for m in meta]) if meta else ""), "mode": only, "stale": stale,
          "meta": [dict(zip(["id", "name", "unit", "freq", "chg", "group", "source", "checked", "last_obs"], r)) for r in meta],
          "series": {sid: {"d": [fmt_d(d) for d, _, _ in rows], "v": [round(v, 6) for _, v, _ in rows], "a": [fmt_d(a) for _, _, a in rows]} for sid, rows in data.items()},
          "prices": {s: {"d": [fmt_d(d) for d, _ in rows], "c": [round(c, 5) for _, c in rows]} for s, rows in prices.items()},
          "events": [dict(t=fmt_t(e["utc"]), c=e["country"], n=e["name"], i=e["importance"], p=e["previous"], a=e["actual"], f=e["forecast"], s=round(e["surprise"], 6), z=round(e["surprise_z"], 3)) for e in events],
          "reactions": [dict(t=r[0], n=r[1], y=r[2], z=float(r[7]) if r[7] != "" else 0, a=float(r[8]) if r[8] != "" else None,
                             r5=float(r[9]) if r[9] != "" else None, r15=float(r[10]) if r[10] != "" else None, r60=float(r[11]) if r[11] != "" else None) for r in reacts]}
    with open(os.path.join(outdir, "econ_data.js"), "w", encoding="utf-8") as f:
        f.write("window.ECON=" + json.dumps(js, separators=(",", ":"), ensure_ascii=False) + ";\n")
    mirror = cfg.get("output", "mt5_mirror", fallback="").strip()
    if mirror: mirror = resolve(mirror, ini_dir)
    if mirror:
        try:
            os.makedirs(mirror, exist_ok=True)
            for fn in ("series.csv", "events.csv", "meta.csv", "prices_daily.csv", "reactions.csv"):
                shutil.copy2(os.path.join(outdir, fn), os.path.join(mirror, fn))
            rp("已複製 CSV 到 MT5 資料夾：" + mirror)
        except Exception as e:
            rp("FAIL 複製到 MT5 資料夾：%s" % e)
    missing = [s[0] for s in SERIES if not s[6] and s[0] not in data]
    rp("完成：%d/%d 個數列%s%s" % (ok, len(SERIES), "成功" if only == "all" else "沿用快取", ("；必要數列缺：" + ",".join(missing)) if missing else ""))
    with open(os.path.join(outdir, "update_report.txt" if only == "all" else "update_report_prices.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(report) + "\n")
    return data, events, reacts, outdir

# ───────────────────────── 自我測試（離線合成資料） ─────────────────────────
def selftest():
    rnd = random.Random(7)
    tmp = tempfile.mkdtemp(prefix="econ_selftest_")
    start = dt.date(2022, 1, 3)
    days = [start + dt.timedelta(days=i) for i in range(0, 1000) if (start + dt.timedelta(days=i)).weekday() < 5]
    def fake_fetch(sid, key, st, initial):
        meta = {s[0]: s for s in SERIES}[sid]
        rnd = random.Random("selftest-" + sid)      # 每個數列固定亂數，兩次呼叫結果相同
        freq = meta[3]; obs = []
        if sid == "FAILME": raise RuntimeError("HTTP 400 bad series")
        if freq == "D":
            v = 100.0 if meta[4] == "pct" else 3.0
            for d in days:
                v = v * (1 + rnd.gauss(0, 0.004)) if meta[4] == "pct" else v + rnd.gauss(0, 0.04)
                if sid == "DFEDTARU": v = 0.25 if d < dt.date(2022, 3, 16) else (1.0 if d < dt.date(2022, 6, 16) else 1.75)
                obs.append({"date": d.isoformat(), "value": "%.4f" % v})
            if sid == "DGS2": obs[5]["value"] = "."
        else:
            v = {"PAYEMS": 150000.0, "UNRATE": 4.0}.get(sid, 280.0)
            y, mo = 2022, 1
            for i in range(30):
                v = v + 220 + rnd.gauss(0, 80) if sid == "PAYEMS" else (v + rnd.gauss(0, 0.1) if sid == "UNRATE" else v * (1 + 0.003 + rnd.gauss(0, 0.002)))
                d = dt.date(y, mo, 1)
                # 公布日：次月第一個週五（非農）或 12 日左右
                nm = dt.date(y + (mo == 12), mo % 12 + 1, 1)
                rel = nm + dt.timedelta(days=(4 - nm.weekday()) % 7) if sid in ("PAYEMS", "UNRATE") else nm + dt.timedelta(days=11)
                while rel.weekday() >= 5: rel += dt.timedelta(days=1)
                o = {"date": d.isoformat(), "value": "%.4f" % v}
                if initial: o["realtime_start"] = rel.isoformat(); o["realtime_end"] = "9999-12-31"
                obs.append(o)
                mo += 1
                if mo == 13: mo = 1; y += 1
        return {"observations": obs}
    # 合成 M1：伺服器 UTC+2（冬）／+3（夏），事件時刻放一根大 K
    events_probe = []
    cfg = configparser.ConfigParser()
    cfg.add_section("fred"); cfg.set("fred", "api_key", "TEST"); cfg.set("fred", "start", "2022-01-01")
    cfg.add_section("output"); cfg.set("output", "dir", tmp)
    cfg.add_section("prices"); cfg.set("prices", "server_utc_offset_winter", "2"); cfg.set("prices", "server_utc_offset_summer", "3")
    # 先跑一次取得事件時間，再依事件時間合成 M1
    d0, ev0, _, _ = run(cfg, fetch=fake_fetch, log=lambda s: None)
    m1p = os.path.join(tmp, "fake_M1.csv")
    hi = [e for e in ev0 if e["importance"] == "H"]
    with open(m1p, "w", encoding="ascii", newline="\n") as f:
        f.write("Time,Open,High,Low,Close,TickVol,Spread\n")
        price = 1800.0
        seen = set()
        rows = []
        for e in ev0:
            if e["utc"].year > 2023 and e["utc"].month > 9 and e["utc"].year >= 2024: continue
            off = 3 if us_dst(e["utc"].date()) else 2
            srv = e["utc"] + dt.timedelta(hours=off)
            for k in range(-100, 100):
                t = srv + dt.timedelta(minutes=k)
                if t in seen: continue
                seen.add(t)
                rows.append(t)
        rows.sort()
        evsrv = {e["utc"] + dt.timedelta(hours=(3 if us_dst(e["utc"].date()) else 2)): e for e in ev0}
        trend_after = {}
        for t in rows:
            o = price
            big = t in evsrv
            if big: move = (1 if evsrv[t]["surprise"] >= 0 else -1) * 6.0
            else: move = rnd.gauss(0, 0.4)
            # 事件後 15 分鐘延續同方向
            for k in range(1, 16):
                tt = t - dt.timedelta(minutes=k)
                if tt in evsrv: move += (1 if evsrv[tt]["surprise"] >= 0 else -1) * 0.5
            c = o + move
            h_ = max(o, c) + abs(rnd.gauss(0, 0.2)); l_ = min(o, c) - abs(rnd.gauss(0, 0.2))
            f.write("%s,%.2f,%.2f,%.2f,%.2f,100,30\n" % (t.strftime("%Y.%m.%d %H:%M"), o, h_, l_, c))
            price = c
    cfg.set("prices", "XAUUSD", m1p)
    d1, ev1, rc, outdir = run(cfg, fetch=fake_fetch, log=lambda s: None)
    rep = open(os.path.join(outdir, "update_report.txt"), encoding="utf-8").read()
    fails = []
    # 只更新價格（不連網）＋ base_dir ＋萬用字元：結果要與完整更新一致
    ser_before = open(os.path.join(outdir, "series.csv"), "rb").read()
    sub = os.path.join(tmp, "m1dir"); os.makedirs(sub); shutil.copy2(m1p, os.path.join(sub, "fake_M1.csv"))
    cfg.add_section("paths"); cfg.set("paths", "base_dir", "m1dir"); cfg.set("paths", "_ini_dir", tmp)
    cfg.set("output", "dir", "."); cfg.set("prices", "XAUUSD", "fake_*.csv")
    def no_net(*a, **k): raise AssertionError("prices 模式不該連網")
    d2, ev2, rc2, outdir2 = run(cfg, fetch=no_net, log=lambda s: None, only="prices")
    if os.path.normpath(outdir2) != os.path.normpath(outdir): fails.append("輸出資料夾不該受 base_dir 影響：%s vs %s" % (outdir2, outdir))
    if os.path.exists(os.path.join(sub, "series.csv")): fails.append("輸出被寫進 base_dir（M1 資料夾）")
    if len(rc2) != len(rc) or len(ev2) != len(ev1): fails.append("prices 模式結果不同：反應 %d/%d 事件 %d/%d" % (len(rc2), len(rc), len(ev2), len(ev1)))
    if open(os.path.join(outdir, "series.csv"), "rb").read() != ser_before: fails.append("prices 模式改動了 series.csv")
    if '"mode":"prices"' not in open(os.path.join(outdir, "econ_data.js"), encoding="utf-8").read(): fails.append("econ_data.js 沒標 mode")
    def need(cond, msg):
        if not cond: fails.append(msg)
    need(len(d1) >= 14, "數列數量 %d" % len(d1))
    need("US_UK_10Y_SPREAD" in d1, "衍生利差")
    need(len(ev1) > 30, "事件數 %d" % len(ev1))
    need(any(e["name"] == "US FOMC Rate Change" for e in ev1), "FOMC 事件")
    need(len(rc) > 20, "反應筆數 %d" % len(rc))
    best = [l for l in rep.splitlines() if "最吻合" in l]
    need(best and "UTC+2／夏令 UTC+3" in best[0], "時區檢查應選 2/3：%s" % best)
    # 方向：驚喜為正 → r15 應為正（合成資料如此設計）
    cnt = {}
    for r in rc: cnt[r[0]] = cnt.get(r[0], 0) + 1
    # 合成 M1 一個時間點只編碼一個事件方向，所以只拿「該時間點只有一筆事件」的來驗方向
    pos = [float(r[10]) for r in rc if cnt[r[0]] == 1 and r[7] and float(r[7]) > 0 and r[10] != ""]
    neg = [float(r[10]) for r in rc if cnt[r[0]] == 1 and r[7] and float(r[7]) < 0 and r[10] != ""]
    need(pos and neg and statistics.median(pos) > 0 > statistics.median(neg), "反應方向 pos=%s neg=%s" % (statistics.median(pos) if pos else None, statistics.median(neg) if neg else None))
    for fn in ("series.csv", "events.csv", "meta.csv", "prices_daily.csv", "reactions.csv", "econ_data.js", "update_report.txt"):
        need(os.path.exists(os.path.join(outdir, fn)), "缺檔 " + fn)
    # CSV 全 ASCII、無 BOM
    for fn in ("series.csv", "events.csv", "meta.csv", "prices_daily.csv", "reactions.csv"):
        b = open(os.path.join(outdir, fn), "rb").read()
        need(all(x < 128 for x in b), fn + " 含非 ASCII")
    print("selftest 輸出資料夾：", outdir)
    print(rep)
    if fails:
        print("SELFTEST FAIL:\n  " + "\n  ".join(fails)); sys.exit(1)
    print("SELFTEST OK：數列 %d、事件 %d、反應 %d" % (len(d1), len(ev1), len(rc)))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(HERE, "econ_config.ini"))
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--only", choices=["all", "prices"], default="all", help="prices＝只重讀 M1（state_export）重算價格與事件反應，不連 FRED")
    a = ap.parse_args()
    if a.selftest:
        selftest(); return
    cfg = configparser.ConfigParser()
    cfg.read([a.config, os.path.join(os.path.dirname(a.config), "econ_config.local.ini")], encoding="utf-8")
    if not cfg.has_section("paths"): cfg.add_section("paths")
    cfg.set("paths", "_ini_dir", os.path.dirname(os.path.abspath(a.config)))
    run(cfg, only=a.only)

if __name__ == "__main__":
    main()
