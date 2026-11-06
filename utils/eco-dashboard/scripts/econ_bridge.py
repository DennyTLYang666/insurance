# -*- coding: utf-8 -*-
"""與 econ（經濟趨勢看板）整合（只用標準函式庫）。

做兩件事：
1. 抓取：沿用 econ_update.py 的 FRED 數列定義與抓取函式（金鑰讀 econ 的 econ_config.local.ini 或環境變數
   FRED_API_KEY，不複製、不輸出），結果存到 data/raw/econ_series.csv；同時把 econ 的 XAUUSD／GBPUSD 日收盤併入 daily.csv。
   沒有金鑰或連線失敗時，改用 econ/data 裡既有的資料（會註明資料日期）。
2. 計算「環境燈號」：與 econ_dashboard.html 相同的規則——五個宏觀因子的 20 日趨勢，依「近 250 日實測相關方向」
   換算成對某個產品偏多／偏空，相關絕對值低於 0.15 的因子不計分。規則式、非預測。
"""
import csv
import importlib.util
import math
import os
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import fetch_sources as fs

HERE = Path(__file__).resolve().parent
LIGHT_IDS = ["DTWEXBGS", "DFII10", "DGS2", "T10YIE", "VIXCLS"]
MIN_ABS_CORR = 0.15
LABEL_BULL, LABEL_BEAR = 0.34, -0.34
# 因子：(中文名, 看什麼, 變化方式)
FACTORS = {
    "DTWEXBGS": ("美元指數（廣義）", "美元強弱", "pct"),
    "DFII10": ("10 年實質殖利率", "持有無息資產的機會成本", "diff"),
    "DGS2": ("2 年美債殖利率", "近端利率預期", "diff"),
    "T10YIE": ("10 年預期通膨", "市場定價的通膨預期", "diff"),
    "VIXCLS": ("VIX", "避險情緒", "pct"),
}
# 概觀「總經數據」要的額外數列（econ 沒有的，用最新版本抓；未季調的 CPI／PPI 年增才會與 BLS 公布值一致）
EXTRA_FRED = [("CPIAUCNS", "美國 CPI（未季調）"), ("CPILFENS", "美國核心 CPI（未季調）"), ("PPIFID", "美國 PPI 最終需求（未季調）"),
              ("PAYEMS_L", "美國非農就業（最新修正版）")]
EXTRA_FRED_ID = {"PAYEMS_L": "PAYEMS"}  # 本地代號 → FRED 代號
# 最新公布（不進燈號，供概覽與分析用）：(id, 名稱, 計算方式, 單位)
RELEASES = [("CPIAUCSL", "美國 CPI", "yoy", "% 年增"), ("CPILFESL", "美國核心 CPI", "yoy", "% 年增"),
            ("PCEPI", "美國 PCE 物價", "yoy", "% 年增"), ("PAYEMS", "美國非農就業", "chg", "千人（單月變動）"),
            ("UNRATE", "美國失業率", "level", "%")]


# ---------- 位置與金鑰 ----------
def econ_dir():
    env = os.environ.get("WM_ECON_DIR")
    if env:
        return Path(env)
    for up in HERE.parents:  # 往上層找同層的 econ 資料夾（網站根目錄放哪一層都找得到）
        if (up / "econ" / "econ_update.py").exists():
            return up / "econ"
        if (up.parent / "econ" / "econ_update.py").exists():
            return up.parent / "econ"
    return HERE.parents[1] / "econ"


def load_econ_module(d):
    f = d / "econ_update.py"
    if not f.exists():
        raise fs.SourceError("找不到 econ（%s）；可用環境變數 WM_ECON_DIR 指定位置" % d)
    spec = importlib.util.spec_from_file_location("econ_update", str(f))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def api_key(d):
    k = os.environ.get("FRED_API_KEY", "").strip()
    if k:
        return k
    import configparser
    cfg = configparser.ConfigParser()
    cfg.read([str(d / "econ_config.ini"), str(d / "econ_config.local.ini")], encoding="utf-8")
    return cfg.get("fred", "api_key", fallback="").strip()


def _iso(s):
    """econ 的日期是 2026.10.23；轉成 2026-10-23。"""
    return s.replace(".", "-")


# ---------- 讀寫 ----------
def load_series(path):
    """econ_series.csv → {series_id: [(date, value, avail_date)]}"""
    out = {}
    if not Path(path).exists():
        return out
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            try:
                out.setdefault(r["series_id"], []).append((date.fromisoformat(r["date"]), float(r["value"]), date.fromisoformat(r["avail_date"])))
            except (ValueError, KeyError):
                continue
    for k in out:
        out[k].sort()
    return out


def load_daily(path):
    """daily.csv（id,date,close）→ {id: [(date, close)]}"""
    out = {}
    if not Path(path).exists():
        return out
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            try:
                out.setdefault(r["id"], []).append((date.fromisoformat(r["date"]), float(r["close"])))
            except (ValueError, KeyError):
                continue
    for k in out:
        out[k].sort()
    return out


def _write_series(path, data):
    lines = ["series_id,date,value,avail_date"]
    for sid in sorted(data):
        for d, v, a in data[sid]:
            lines.append("%s,%s,%s,%s" % (sid, d.isoformat(), ("%.6f" % v).rstrip("0").rstrip("."), a.isoformat()))
    fs.atomic_write(path, "\n".join(lines) + "\n")


def _read_econ_cached(d, since):
    """econ/data/series.csv（沿用 econ 既有資料）。"""
    p = d / "data" / "series.csv"
    out = {}
    if not p.exists():
        return out
    with open(p, "r", encoding="ascii", errors="replace", newline="") as f:
        for r in csv.DictReader(f):
            try:
                dd = date.fromisoformat(_iso(r["date"]))
                if dd >= since:
                    out.setdefault(r["series_id"], []).append((dd, float(r["value"]), date.fromisoformat(_iso(r["avail_date"]))))
            except (ValueError, KeyError):
                continue
    return out


def _econ_prices(d):
    """econ/data/prices_daily.csv → {XAUUSD/GBPUSD: [(date, close)]}（你的 MT5 日收盤）。"""
    p = d / "data" / "prices_daily.csv"
    out = {}
    if not p.exists():
        return out
    with open(p, "r", encoding="ascii", errors="replace", newline="") as f:
        for r in csv.DictReader(f):
            try:
                out.setdefault(r["symbol"], []).append((date.fromisoformat(_iso(r["date"])), float(r["close"])))
            except (ValueError, KeyError):
                continue
    return out


# ---------- 抓取（--fetch econ） ----------
def fetch_econ(raw, today, dry, years=3):
    d = econ_dir()
    mod = load_econ_module(d)
    since = today - timedelta(days=365 * years)
    key = api_key(d)
    path = raw / "econ_series.csv"
    old = load_series(path)
    new, failed, src = {}, [], "FRED API"
    if key:
        for sid, _name, _unit, freq, _chg, _grp, _opt in mod.SERIES:
            try:
                rows, _mode, _notes = mod.get_series(sid, freq, key, since.isoformat(), mod.fred_fetch)
                if not rows:
                    raise RuntimeError("沒有資料")
                new[sid] = [r for r in rows if r[0] >= since]
                time.sleep(0.3)
            except Exception as e:  # econ 的函式會丟 RuntimeError／網路例外
                failed.append("%s：%s" % (sid, str(e)[:80]))
        for sid, _nm in EXTRA_FRED:
            try:
                obs = mod.fred_fetch(EXTRA_FRED_ID.get(sid, sid), key, since.isoformat(), False)
                rows = []
                for o in obs.get("observations", []):
                    if o.get("value") in (".", "", None):
                        continue
                    dd = date.fromisoformat(o["date"])
                    rows.append((dd, float(o["value"]), dd))
                if len(rows) < 14:
                    raise RuntimeError("資料不足")
                new[sid] = rows
                time.sleep(0.3)
            except Exception as e:
                failed.append("%s：%s" % (sid, str(e)[:80]))
    else:
        failed.append("沒有 FRED 金鑰（econ_config.local.ini 或環境變數 FRED_API_KEY）")
    if not new:  # 退而求其次：沿用 econ 既有資料
        new = _read_econ_cached(d, since)
        src = "econ 既有資料（econ/data/series.csv）"
        if not new:
            raise fs.SourceError("；".join(failed) + "；econ/data 也沒有可用資料")
    merged = dict(old)
    merged.update(new)
    # 你的 MT5 日收盤（XAUUSD、GBPUSD）併入 daily.csv
    prices = _econ_prices(d)
    if not dry:
        _write_series(path, merged)
        if prices:
            fs.merge_daily(raw, {k: [(a, b) for a, b in v if a >= since] for k, v in prices.items()})
    latest = max((rows[-1][0] for rows in new.values()), default=None)
    msg = "econ：%d 個數列（來源：%s，最新觀測 %s）" % (len(new), src, latest)
    if prices:
        msg += "；併入 MT5 日收盤 " + "、".join(sorted(prices))
    if failed and src == "FRED API":
        msg += "；失敗：" + "；".join(failed)
        return msg, len(failed)
    if failed:
        msg += "（" + failed[0] + "）"
        return msg, 1
    return msg


# ---------- 環境燈號計算 ----------
def _mean(a):
    return sum(a) / len(a)


def _corr(x, y):
    n = len(x)
    if n < 8:
        return None
    mx, my = _mean(x), _mean(y)
    sxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
    sxx = sum((a - mx) ** 2 for a in x)
    syy = sum((b - my) ** 2 for b in y)
    return sxy / math.sqrt(sxx * syy) if sxx > 0 and syy > 0 else None


def trend(rows, kind):
    """以數列自己的觀察值算 20 日趨勢：現值高於 20 日均線且均線上揚＝上行。"""
    v = [r[1] for r in rows]
    n = len(v)
    if n < 30:
        return None
    sma = lambda e, w: sum(v[e - w:e]) / w
    now, prev, last = sma(n, 20), sma(n - 5, 20), v[-1]
    direction = 1 if (last > now and now > prev) else -1 if (last < now and now < prev) else 0
    base = v[max(0, n - 21)]
    d20 = (last / base - 1) * 100 if kind == "pct" else last - base
    return {"dir": direction, "last": last, "d20": d20, "date": rows[-1][0]}


def aligned(prod, ser, kind):
    """產品與數列在共同日期上的連續變化（產品報酬 vs 數列變化）。"""
    sm = {d: v for d, v, _ in ser}
    pr, sr = [], []
    pd = pc = sc = None
    for d, pv in prod:
        if d not in sm:
            continue
        sv = sm[d]
        if pd is not None and pc > 0 and (kind != "pct" or sc > 0):
            pr.append(pv / pc - 1)
            sr.append(sv / sc - 1 if kind == "pct" else sv - sc)
        pd, pc, sc = d, pv, sv
    return pr, sr


def sign(x):
    return 1 if x > 0 else -1 if x < 0 else 0


def light(prod, series):
    """對一個產品算燈號。回傳 dict 或 None。"""
    contrib, score, cnt = [], 0, 0
    for fid in LIGHT_IDS:
        ser = series.get(fid)
        if not ser:
            continue
        kind = FACTORS[fid][2]
        t = trend(ser, kind)
        if not t:
            continue
        pr, sr = aligned(prod, ser, kind)
        c250 = _corr(pr[-250:], sr[-250:])
        c60 = _corr(pr[-60:], sr[-60:])
        imp = 0
        if c250 is not None and abs(c250) >= MIN_ABS_CORR:
            imp = t["dir"] * sign(c250)
            score += imp
            cnt += 1
        contrib.append({"id": fid, "imp": imp, "corr250": None if c250 is None else round(c250, 3),
                        "corr60": None if c60 is None else round(c60, 3)})
    if not contrib:
        return None
    avg = score / cnt if cnt else 0.0
    label = "偏多" if avg >= LABEL_BULL else "偏空" if avg <= LABEL_BEAR else "中性"
    return {"score": round(avg, 2), "label": label, "n_valid": cnt, "contrib": contrib}


def releases(series):
    out = []
    for sid, name, kind, unit in RELEASES:
        s = series.get(sid)
        if not s or len(s) < 14:
            continue
        n = len(s)
        if kind == "yoy":
            cur, prev = (s[-1][1] / s[-13][1] - 1) * 100, (s[-2][1] / s[-14][1] - 1) * 100
        elif kind == "chg":
            cur, prev = s[-1][1] - s[-2][1], s[-2][1] - s[-3][1]
        else:
            cur, prev = s[-1][1], s[-2][1]
        out.append({"id": sid, "name": name, "period": s[-1][0].isoformat()[:7], "released": s[-1][2].isoformat(),
                    "value": round(cur, 2), "previous": round(prev, 2), "unit": unit})
    return out


def _yoy_list(s):
    """[(date, value, ...)] → [(date, yoy%)]；年增用「去年同月」那筆，缺期的月份略過。"""
    by = {(r[0].year, r[0].month): r[1] for r in s}
    return [(r[0], (r[1] / by[(r[0].year - 1, r[0].month)] - 1) * 100) for r in s if by.get((r[0].year - 1, r[0].month))]


def macro_tiles(series):
    """概觀的美國總經數據：年增類用未季調指數（與 BLS 公布一致；PCE 為 BEA 季調指數），非農為最新修正版的單月變動。"""
    out = []

    def add(tid, name, kind, rows, unit, dec):
        if not rows or len(rows) < 2:
            return
        (d1, v1), (_d0, v0) = rows[-1], rows[-2]
        out.append({"id": tid, "name": name, "group": "總經數據", "kind": kind, "unit": unit, "decimals": dec,
                    "value": round(v1, 4), "prev": round(v0, 4), "period": d1.isoformat()[:7]})

    for tid, name, sid in (("us_cpi", "美國 CPI 年增", "CPIAUCNS"), ("us_core_cpi", "美國核心 CPI 年增", "CPILFENS"),
                           ("us_ppi", "美國 PPI 年增", "PPIFID"), ("us_pce", "美國 PCE 年增", "PCEPI")):
        add(tid, name, "yoy", _yoy_list(series.get(sid) or []), "%", 1)
    pay = series.get("PAYEMS_L") or []
    add("us_nfp", "美國非農新增就業", "chg", [(pay[i][0], pay[i][1] - pay[i - 1][1]) for i in range(1, len(pay))], "千人", 0)
    un = series.get("UNRATE") or []
    add("us_unrate", "美國失業率", "level", [(r[0], r[1]) for r in un], "%", 1)
    return out


def build_environment(daily, series, products, cutoff_str):
    """products：[(id, 名稱, 群組)]。回傳要放進 weekly.json 的 environment；沒有因子資料時回傳 None。"""
    if not any(series.get(f) for f in LIGHT_IDS):
        return None
    factors = []
    for fid in LIGHT_IDS:
        ser = series.get(fid)
        t = trend(ser, FACTORS[fid][2]) if ser else None
        if t:
            factors.append({"id": fid, "name": FACTORS[fid][0], "role": FACTORS[fid][1], "kind": FACTORS[fid][2],
                            "value": round(t["last"], 4), "date": t["date"].isoformat(), "dir": t["dir"], "d20": round(t["d20"], 4)})
    prods = []
    for pid, name, grp in products:
        rows = daily.get(pid)
        if not rows or len(rows) < 60:
            continue
        lt = light(rows, series)
        if lt:
            prods.append(dict(id=pid, name=name, group=grp, last_date=rows[-1][0].isoformat(), **lt))
    if not factors or not prods:
        return None
    return {"as_of": cutoff_str, "factors": factors, "products": prods,
            "note": "規則式（非預測）：因子 20 日趨勢 × 近 250 日實測相關方向；相關絕對值低於 0.15 的因子不計分。"}
