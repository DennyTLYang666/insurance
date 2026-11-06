# -*- coding: utf-8 -*-
"""資料抓取模組（只用標準函式庫）。由 update_data.py 以 --fetch 呼叫，也可用 --check-sources 檢查來源。

原則：
- 每個來源獨立失敗；失敗只顯示錯誤，不動原有檔案。
- 寫入採「全有或全無」：價格七個維度必須全部抓到才會覆蓋 prices.csv，避免新舊資料混在一起。
- 來源網址可用環境變數 WM_URL_<名稱> 覆寫（測試用）。
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

TZ = timezone(timedelta(hours=8))
UA = "Mozilla/5.0 (weekly-market-update/2.0)"
ALL_SOURCES = ("econ", "prices", "rates", "macro", "calendar", "news", "quotes")

DEFAULT_URLS = {
    "YAHOO": "https://query1.finance.yahoo.com/v8/finance/chart",
    "FRED": "https://fred.stlouisfed.org/graph/fredgraph.csv",
    "ECB": "https://data-api.ecb.europa.eu/service/data",
    "CALENDAR": "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "CALENDAR_NEXT": "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
    "RSS_FED": "https://www.federalreserve.gov/feeds/press_all.xml",
    "RSS_ECB": "https://www.ecb.europa.eu/rss/press.html",
    "RSS_BLS": "https://www.bls.gov/feed/bls_latest.rss",
}
NEWS_FEEDS = [("聯準會", "RSS_FED"), ("歐洲央行", "RSS_ECB"), ("美國勞工統計局", "RSS_BLS")]

# 七個投資指標：每一個都對應可直接交易的標的（ETF），代表一類資產。順序＝頁面順序。
PRICE_SYMBOLS = [("tw_equity", "0050.TW"), ("us_equity", "SPY"), ("tech", "QQQ"), ("bond", "TLT"),
                 ("gold", "GLD"), ("oil", "USO"), ("usd", "UUP")]
MIN_POINTS = 14

# 重要報價（Yahoo 代號；有多個候選時依序嘗試）。kind：price＝以百分比看變動；rate＝殖利率，以百分點（pp）看變動。
# 欄位：(id, 名稱, 群組, [代號候選], kind, 顯示小數位)
QUOTES = [
    ("usdtwd", "美元／新台幣", "匯率", ["TWD=X"], "price", 3),
    ("eurusd", "歐元／美元", "匯率", ["EURUSD=X"], "price", 4),
    ("usdjpy", "美元／日圓", "匯率", ["JPY=X"], "price", 2),
    ("dxy", "美元指數 DXY", "匯率", ["DX-Y.NYB"], "price", 2),
    ("xauusd", "黃金 XAU/USD", "商品", ["XAUUSD=X", "GC=F"], "price", 2),
    ("wti", "WTI 原油", "商品", ["CL=F"], "price", 2),
    ("brent", "布蘭特原油", "商品", ["BZ=F"], "price", 2),
    ("twii", "台灣加權指數", "股市", ["^TWII"], "price", 2),
    ("ixic", "那斯達克綜合", "股市", ["^IXIC"], "price", 2),
    ("spx", "S&P 500", "股市", ["^GSPC"], "price", 2),
    ("sox", "費城半導體", "股市", ["^SOX"], "price", 2),
    ("n225", "日經 225", "股市", ["^N225"], "price", 2),
    ("us10y", "美國 10 年期殖利率", "利率與風險", ["^TNX"], "rate", 3),
    ("vix", "VIX 恐慌指數", "利率與風險", ["^VIX"], "price", 2),
]

# rates.csv：美債殖利率、美元兌台幣來自 FRED；DXY 無公開來源，需人工填寫
FRED_RATES = {"DGS10": "DGS10", "USD/TWD": "DEXTAUS"}

# 自動抓取的國家總經（其餘國家請人工或由 Claude 查證補上）。
# 每項指標 = (來源, [代碼…依序嘗試], 模式)。模式：level＝取最新值；yoy＝由指數依「去年同期」算年增。
# 為了避免把舊資料當成功，每項指標都有最大允許資料年齡（天）：超過就視為失敗。
MAX_AGE_DAYS = {"policy": 45, "cpi": 90, "gdp": 170}
MACRO = {
    "US": {"source": "聯準會、BLS、BEA（經 FRED）",
           "policy": ("fred", ["DFEDTARU"], "level"),       # 聯邦資金利率目標區間上限
           "cpi": ("fred", ["CPIAUCNS"], "yoy"),            # 未季調 CPI，年增與 BLS 公布值一致
           "gdp": ("fred", ["GDPC1"], "yoy")},
    "EU": {"source": "歐洲央行、Eurostat（經 FRED／ECB Data Portal）",
           "policy": ("fred", ["ECBDFR"], "level"),         # 存款機制利率
           # ECB 的 ICP 資料集已於 2026-01 停用，改用 HICP 資料集
           "cpi": ("ecb", ["HICP/M.U2.N.000000.4D0.ANR"], "level"),
           # 歐元區成員國組成 2026-01 起為 21 國（I10）；舊的 I9 作為備援。以指數自行算年增
           "gdp": ("ecb", ["MNA/Q.Y.I10.W2.S1.S1.B.B1GQ._Z._Z._Z.IX.LR.N",
                           "MNA/Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.IX.LR.N"], "yoy")},
}
COUNTRY_COLS = ["as_of", "country", "policy_rate", "cpi_yoy", "gdp_yoy", "stance", "stance_reason", "source"]

CAL_IMPACTS = {"High": "H", "Medium": "M"}
CAL_COUNTRIES = {"USD": "美國", "EUR": "歐元區", "JPY": "日本", "CNY": "中國"}
EVENT_ZH = {
    "Non-Farm Employment Change": "非農就業", "ADP Non-Farm Employment Change": "ADP 就業報告",
    "Unemployment Rate": "失業率", "Unemployment Claims": "初請失業金人數", "CPI y/y": "CPI 年增",
    "CPI m/m": "CPI 月增", "Core CPI m/m": "核心 CPI 月增", "Core PCE Price Index m/m": "核心 PCE 月增",
    "PPI m/m": "PPI 月增", "Federal Funds Rate": "聯邦資金利率決議", "FOMC Statement": "FOMC 聲明",
    "FOMC Press Conference": "FOMC 記者會", "FOMC Meeting Minutes": "FOMC 會議紀要",
    "ISM Manufacturing PMI": "ISM 製造業 PMI", "ISM Services PMI": "ISM 服務業 PMI",
    "Retail Sales m/m": "零售銷售月增", "Advance GDP q/q": "GDP 季增（初值）", "Prelim GDP q/q": "GDP 季增（修正值）",
    "Final GDP q/q": "GDP 季增（終值）", "Main Refinancing Rate": "歐洲央行主要再融通利率",
    "Monetary Policy Statement": "貨幣政策聲明", "ECB Press Conference": "歐洲央行記者會",
    "BOJ Policy Rate": "日銀政策利率", "BOJ Press Conference": "日銀記者會", "Caixin Manufacturing PMI": "財新製造業 PMI",
    "Official Manufacturing PMI": "官方製造業 PMI", "Core CPI y/y": "核心 CPI 年增", "PPI y/y": "PPI 年增",
    "Core PPI m/m": "核心 PPI 月增", "Flash Manufacturing PMI": "製造業 PMI 初值", "Flash Services PMI": "服務業 PMI 初值",
    "Philly Fed Manufacturing Index": "費城聯儲製造業指數", "Empire State Manufacturing Index": "紐約聯儲製造業指數",
    "JOLTS Job Openings": "JOLTS 職缺數", "Consumer Confidence": "消費者信心", "Prelim UoM Consumer Sentiment": "密大消費者信心初值",
    "German ifo Business Climate": "德國 ifo 企業景氣", "German Flash Manufacturing PMI": "德國製造業 PMI 初值",
    "Tankan Manufacturing Index": "日銀短觀製造業", "Core CPI y/y (Japan)": "日本核心 CPI 年增", "GDP q/q": "GDP 季增",
    "Trade Balance": "貿易收支", "Industrial Production m/m": "工業生產月增", "Average Hourly Earnings m/m": "平均時薪月增",
    "Congressional Elections": "美國期中選舉", "BOJ Gov Ueda Speaks": "日銀總裁植田發言",
}


class SourceError(Exception):
    pass


def url(name):
    return os.environ.get("WM_URL_" + name, DEFAULT_URLS[name])


def atomic_write(path, text):
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)


def http_get(u, retries=2, timeout=25):
    last = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            last = "HTTP %s" % e.code
            if e.code not in (429, 500, 502, 503, 504):
                break
        except (urllib.error.URLError, OSError) as e:
            last = str(getattr(e, "reason", e))
        if i < retries:
            time.sleep(2)
    raise SourceError("%s：%s" % (u.split("?")[0], last))


def parse_d(s):
    try:
        return date.fromisoformat((s or "").strip())
    except ValueError:
        return None


def num(s):
    try:
        v = float((s or "").strip().replace(",", ""))
        return v if v == v and abs(v) != float("inf") else None
    except ValueError:
        return None


def last_friday(today):
    """最近一個「早於今天」的週五（週五當天收盤資料可能尚未完整，故不含）。"""
    f = today - timedelta(days=(today.weekday() - 4) % 7)
    return f - timedelta(days=7) if f >= today else f


# ---------- FRED / ECB ----------
def fred_series(sid, start):
    text = http_get("%s?id=%s&cosd=%s" % (url("FRED"), urllib.parse.quote(sid), start)).decode("utf-8-sig")
    obs = []
    for i, row in enumerate(csv.reader(text.splitlines())):
        if i == 0 or len(row) < 2:
            continue
        d, v = parse_d(row[0]), num(row[1])  # FRED 以 "." 表示無資料
        if d is not None and v is not None:
            obs.append((d, v))
    if not obs:
        raise SourceError("FRED %s 沒有可用數值" % sid)
    return sorted(obs)


def period_end(s):
    s = s.strip()
    try:
        if len(s) == 10:
            return date.fromisoformat(s)
        if "-Q" in s:
            y, q = s.split("-Q")
            m = int(q) * 3
        else:
            y, m = s.split("-")[:2]
            m = int(m)
        y = int(y)
        return (date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1))
    except (ValueError, TypeError):
        return None


def month_end(d, add_months=0):
    m = d.month + add_months
    y = d.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    return date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)


def ecb_obs(key, n):
    text = http_get("%s/%s?format=csvdata&lastNObservations=%d" % (url("ECB"), key, n)).decode("utf-8-sig")
    rows = list(csv.DictReader(text.splitlines()))
    obs = []
    for r in rows:
        d, v = period_end(r.get("TIME_PERIOD", "")), num(r.get("OBS_VALUE", ""))
        if d is not None and v is not None:
            obs.append((d, v))
    if not obs:
        raise SourceError("ECB %s 沒有可用數值（回應格式不符或無資料）" % key)
    return sorted(obs)


def yoy_by_date(obs):
    """以「去年同期」那筆算年增（不是往前數固定筆數，避免遇到缺期，例如 2025-10 美國 CPI 未發布）。"""
    d1, v1 = obs[-1]
    target = d1 - timedelta(days=365)
    d0, v0 = min(obs, key=lambda o: abs((o[0] - target).days))
    if abs((d0 - target).days) > 20:
        raise SourceError("找不到去年同期資料（最新 %s，需要約 %s）" % (d1, target))
    return round((v1 / v0 - 1) * 100, 2), d1


# ---------- 價格 ----------
def yahoo_daily(sym):
    body = json.loads(http_get("%s/%s?range=2y&interval=1d" % (url("YAHOO"), urllib.parse.quote(sym))))
    chart = body.get("chart") or {}
    res = chart.get("result")
    if not res:
        raise SourceError("%s 沒有資料（%s）" % (sym, chart.get("error")))
    r = res[0]
    ind = r.get("indicators") or {}
    vals = ((ind.get("adjclose") or [{}])[0]).get("adjclose") or ((ind.get("quote") or [{}])[0]).get("close") or []
    off = (r.get("meta") or {}).get("gmtoffset", 0)
    out = []
    for t, v in zip(r.get("timestamp") or [], vals):
        if v is not None:
            out.append((datetime.fromtimestamp(t + off, timezone.utc).date(), float(v)))
    return out


DAILY_KEEP = 540  # 每個標的最多保留的日資料筆數（約 2 年）


def merge_daily(raw, new):
    """把 {id: [(date, close)]} 併入 daily.csv（id,date,close）；同 id 以新資料整批取代。"""
    path = raw / "daily.csv"
    data = {}
    if path.exists():
        with open(path, "r", encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                if r.get("id") and r.get("date") and r.get("close"):
                    data.setdefault(r["id"], []).append((r["date"], r["close"]))
    for k, rows in new.items():
        data[k] = [(d.isoformat(), "%.5f" % v) for d, v in sorted(rows)][-DAILY_KEEP:]
    lines = ["id,date,close"] + ["%s,%s,%s" % (k, d, c) for k in sorted(data) for d, c in data[k]]
    atomic_write(path, "\n".join(lines) + "\n")


def to_fridays(obs, today, weeks=60):
    obs = sorted(obs)
    lf = last_friday(today)
    out = []
    for i in range(weeks - 1, -1, -1):
        f = lf - timedelta(weeks=i)
        usable = [o for o in obs if o[0] <= f]
        if usable and (f - usable[-1][0]).days <= 4:  # 週五休市時取前一個交易日
            out.append((f, usable[-1][1]))
    return out


def fetch_prices(raw, today, dry):
    rows, errors, cutoffs, daily = [], [], {}, {}
    for dim, sym in PRICE_SYMBOLS:
        try:
            obs = yahoo_daily(sym)
            wk = to_fridays(obs, today)
            if len(wk) < MIN_POINTS:
                raise SourceError("%s 只取得 %d 週資料（至少需 %d 週）" % (sym, len(wk), MIN_POINTS))
        except (SourceError, ValueError, KeyError) as e:
            errors.append("%s（%s）：%s" % (dim, sym, e))
            continue
        cutoffs[dim] = wk[-1][0]
        daily[dim] = obs
        rows += [(d.isoformat(), dim, sym, "%.4f" % v) for d, v in wk]
    if not errors and len(set(cutoffs.values())) > 1:
        errors.append("各標的最新週五不一致：" + "、".join("%s=%s" % kv for kv in cutoffs.items()))
    if errors:
        raise SourceError("；".join(errors) + "（prices.csv 未更動）")
    if not dry:
        atomic_write(raw / "prices.csv", "\n".join(["date,dimension,proxy,close"] + [",".join(r) for r in rows]) + "\n")
        merge_daily(raw, daily)
    return "價格：%d 個維度、最新週五 %s%s" % (len(PRICE_SYMBOLS), max(cutoffs.values()), "（dry）" if dry else "")


# ---------- 重要報價 ----------
def fetch_quotes(raw, today, dry):
    """每項：週五收盤（最近 60 週）＋最新一個交易日收盤。單項失敗不影響其他項目，失敗項目保留舊資料。"""
    path = raw / "quotes.csv"
    cols = ("date", "id", "symbol", "close", "kind")
    old = {}
    if path.exists():
        with open(path, "r", encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                if r.get("id"):
                    old.setdefault(r["id"], []).append([(r.get(c) or "").strip() for c in cols])
    new, bad, daily = {}, [], {}
    for qid, name, grp, syms, kind, dec in QUOTES:
        errs = []
        for sym in syms:
            try:
                obs = yahoo_daily(sym)
                wk = to_fridays(obs, today)
                if len(wk) < MIN_POINTS:
                    raise SourceError("只有 %d 週資料" % len(wk))
                rows = [[d.isoformat(), qid, sym, "%.4f" % v, "w"] for d, v in wk]
                rows.append([obs[-1][0].isoformat(), qid, sym, "%.4f" % obs[-1][1], "l"])
                new[qid] = rows
                daily[qid] = obs
                break
            except (SourceError, ValueError, KeyError) as e:
                errs.append("%s：%s" % (sym, e))
        else:
            bad.append("%s（%s）" % (name, "；".join(errs)))
    if not new:
        raise SourceError("；".join(bad) + "（quotes.csv 未更動）")
    merged = dict(old)
    merged.update(new)
    if not dry:
        lines = [",".join(cols)] + [",".join(r) for q in QUOTES for r in merged.get(q[0], [])]
        atomic_write(path, "\n".join(lines) + "\n")
        merge_daily(raw, daily)
    msg = "報價：%d／%d 項" % (len(new), len(QUOTES))
    if bad:
        msg += "；失敗（沿用舊資料）：" + "；".join(bad)
    return msg, len(bad)


# ---------- 利率 ----------
def fetch_rates(raw, today, dry, weeks=12):
    path = raw / "rates.csv"
    existing = {}
    if path.exists():
        with open(path, "r", encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                if r.get("date") and r.get("series"):
                    existing[(r["date"].strip(), r["series"].strip())] = (r.get("value") or "").strip()
    lf = last_friday(today)
    fridays = [lf - timedelta(weeks=i) for i in range(weeks)]
    start = (fridays[-1] - timedelta(days=10)).isoformat()
    added, errors = 0, []
    for series, fid in FRED_RATES.items():
        try:
            obs = fred_series(fid, start)
        except SourceError as e:
            errors.append("%s：%s" % (series, e))
            continue
        for f in fridays:
            usable = [o for o in obs if o[0] <= f]
            if usable:
                existing[(f.isoformat(), series)] = "%g" % usable[-1][1]
                added += 1
    if not added:
        raise SourceError("；".join(errors) + "（rates.csv 未更動）")
    if not dry:
        atomic_write(path, "\n".join(["date,series,value"] + ["%s,%s,%s" % (d, s, v) for (d, s), v in sorted(existing.items())]) + "\n")
    msg = "利率：併入 %d 筆" % added
    if errors:
        msg += "（部分失敗：%s）" % "；".join(errors)
    return msg


# ---------- 國家總經 ----------
def _metric(name, spec, today):
    """回傳 (數值, 期末日)。依序嘗試備援代碼；資料過舊視為失敗並嘗試下一個。"""
    src, keys, mode = spec
    problems = []
    for key in keys:
        try:
            if src == "fred":
                obs = fred_series(key, (today - timedelta(days=900)).isoformat())
                fix = lambda d: month_end(d, 0 if name == "cpi" else 2)  # FRED 月／季資料以期初日標示，換成期末
                v, d = (obs[-1][1], obs[-1][0]) if mode == "level" else yoy_by_date(obs)
                if mode != "level":
                    d = fix(d)
            else:
                obs = ecb_obs(key, 1 if mode == "level" else 6)
                v, d = (obs[-1][1], obs[-1][0]) if mode == "level" else yoy_by_date(obs)  # ECB 日期本身已是期末
            age = (today - d).days
            if age > MAX_AGE_DAYS[name]:
                raise SourceError("資料過舊（%s，距今 %d 天，上限 %d 天）" % (d, age, MAX_AGE_DAYS[name]))
            return round(v, 2), d
        except SourceError as e:
            problems.append("%s：%s" % (key, e))
    raise SourceError("；".join(problems))


def fetch_macro(raw, today, dry):
    path = raw / "countries.csv"
    rows = []
    if path.exists():
        with open(path, "r", encoding="utf-8-sig", newline="") as f:
            rows = [{c: (r.get(c) or "").strip() for c in COUNTRY_COLS} for r in csv.DictReader(f)]
    done, failed = [], []
    for cid, cfg in MACRO.items():
        try:
            vals, dates = {}, {}
            for key in ("policy", "cpi", "gdp"):
                try:
                    vals[key], dates[key] = _metric(key, cfg[key], today)
                except SourceError as e:
                    raise SourceError("%s %s" % (key, e))
        except (SourceError, ValueError, KeyError) as e:
            failed.append("%s：%s" % (cid, e))
            continue
        as_of = min(dates.values()).isoformat()  # 三項指標中最舊的一筆，避免日頻利率讓資料看起來比實際新
        rows = [r for r in rows if not (r["country"] == cid and r["as_of"] == as_of)]
        rows.append({"as_of": as_of, "country": cid, "policy_rate": "%g" % vals["policy"], "cpi_yoy": "%g" % vals["cpi"],
                     "gdp_yoy": "%g" % vals["gdp"], "stance": "", "stance_reason": "", "source": cfg["source"]})
        done.append("%s（利率 %s、CPI %s、GDP %s）" % (cid, dates["policy"], dates["cpi"], dates["gdp"]))
    if done and not dry:
        rows.sort(key=lambda r: (r["as_of"], r["country"]))
        atomic_write(path, "\n".join([",".join(COUNTRY_COLS)] + [",".join(_q(r[c]) for c in COUNTRY_COLS) for r in rows]) + "\n")
    if not done:
        raise SourceError("；".join(failed) + "（countries.csv 未更動）")
    msg = "總經：已更新 " + "、".join(done)
    if failed:
        msg += "；抓取失敗（沿用舊資料，需人工或由 Claude 補）：" + "；".join(failed)
    msg += "。未設定自動來源的國家（JP、TW、CN）需人工補。"
    return msg


def _q(s):
    return '"%s"' % s.replace('"', '""') if any(ch in s for ch in ',"\n') else s


# ---------- 經濟日曆 ----------
def _calendar_feed(u):
    data = json.loads(http_get(u))
    if not isinstance(data, list):
        raise SourceError("日曆回應格式不符（預期為陣列）")
    return data


def fetch_calendar(raw, today, dry):
    """Forex Factory 免費週 JSON：本週＋下週；高／中重要度的美／歐／日／中事件，轉成台北時間。"""
    data = _calendar_feed(url("CALENDAR"))
    note = ""
    try:
        data += _calendar_feed(url("CALENDAR_NEXT"))
    except (SourceError, ValueError, OSError) as e:
        note = "（下週資料取得失敗：%s）" % e
    out, seen = [], set()
    for e in data:
        imp = CAL_IMPACTS.get(e.get("impact"))
        if not imp or e.get("country") not in CAL_COUNTRIES:
            continue
        try:
            dt = datetime.fromisoformat(str(e["date"]).replace("Z", "+00:00"))
        except (ValueError, KeyError):
            continue
        if dt.tzinfo is None:
            continue
        dt = dt.astimezone(TZ)
        title = e.get("title", "").strip()
        key = (dt, title, e["country"])
        if key in seen:
            continue
        seen.add(key)
        out.append((dt, [dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M"), EVENT_ZH.get(title, title), CAL_COUNTRIES[e["country"]],
                         (e.get("previous") or "").strip(), (e.get("forecast") or "").strip(), (e.get("actual") or "").strip(), imp]))
    if not out:
        raise SourceError("沒有符合條件（高／中重要度、美／歐／日／中）的事件（calendar.csv 未更動）")
    out.sort(key=lambda x: x[0])
    if not dry:
        atomic_write(raw / "calendar.csv", "\n".join(["date,time,event,country,previous,forecast,actual,importance"] + [",".join(_q(c) for c in r) for _, r in out]) + "\n")
    return "日曆：%d 個事件（%s 至 %s，台北時間）%s" % (len(out), out[0][1][0], out[-1][1][0], note)


# ---------- 新聞候選（只存標題與連結） ----------
def _feed_items(xml_bytes):
    root = ET.fromstring(xml_bytes)
    items = []
    for node in root.iter():
        tag = node.tag.split("}")[-1]
        if tag not in ("item", "entry"):
            continue
        f = {}
        for c in node:
            t = c.tag.split("}")[-1]
            if t == "link":
                f["link"] = (c.text or c.get("href") or "").strip()
            elif t in ("title", "pubDate", "date", "published", "updated"):
                f.setdefault(t, (c.text or "").strip())
        when = f.get("pubDate") or f.get("date") or f.get("published") or f.get("updated")
        if not (f.get("title") and f.get("link") and when):
            continue
        try:
            dt = parsedate_to_datetime(when)
        except (TypeError, ValueError):
            try:
                dt = datetime.fromisoformat(when.replace("Z", "+00:00"))
            except ValueError:
                continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        items.append((dt.astimezone(TZ), f["title"], f["link"]))
    return items


def fetch_news(raw, today, dry, days=10):
    since = datetime.now(TZ) - timedelta(days=days)
    out, ok, bad = [], [], []
    for name, key in NEWS_FEEDS:
        try:
            items = _feed_items(http_get(url(key)))
        except (SourceError, ET.ParseError) as e:
            bad.append("%s：%s" % (name, e))
            continue
        ok.append(name)
        out += [{"published_at": dt.isoformat(timespec="seconds"), "source": name, "source_type": "官方",
                 "title": t, "url": u} for dt, t, u in items if dt >= since]
    if not ok:
        raise SourceError("；".join(bad) + "（news_candidates.json 未更動）")
    out.sort(key=lambda x: x["published_at"], reverse=True)
    if not dry:
        atomic_write(raw / "news_candidates.json", json.dumps(
            {"fetched_at": datetime.now(TZ).isoformat(timespec="seconds"), "note": "僅標題與連結；摘要與影響方向由人工／Claude 撰寫後放入 manual.json 的 news",
             "items": out}, ensure_ascii=False, indent=2) + "\n")
    msg = "新聞候選：%d 則（來源：%s）" % (len(out), "、".join(ok))
    return msg + ("；失敗：" + "；".join(bad) if bad else "")


FETCHERS = {"econ": lambda raw, today, dry: __import__("econ_bridge").fetch_econ(raw, today, dry), "prices": fetch_prices, "rates": fetch_rates, "macro": fetch_macro, "calendar": fetch_calendar, "news": fetch_news,
            "quotes": fetch_quotes}


def run_fetch(raw, sources, dry=False):
    """依序抓取指定來源；回傳失敗的來源數。dry=True 只檢查來源、不寫檔。"""
    raw.mkdir(parents=True, exist_ok=True)
    today = datetime.now(TZ).date()
    failures = 0
    for name in ALL_SOURCES:
        if name not in sources:
            continue
        try:
            res = FETCHERS[name](raw, today, dry)
            msg, partial = res if isinstance(res, tuple) else (res, 0)
            print(("[部分失敗] " if partial else "[抓取成功] ") + msg, file=sys.stderr if partial else sys.stdout)
            failures += 1 if partial else 0
        except (SourceError, ValueError, KeyError, OSError, ET.ParseError) as e:
            failures += 1
            print("[抓取失敗] %s：%s" % (name, e), file=sys.stderr)
    return failures
