# -*- coding: utf-8 -*-
"""把序列資料算成網站要的 JSON（概覽、趨勢、總經、燈號、行事曆）。純函式，不做網路與檔案存取。"""
from collections import Counter
from datetime import date, timedelta

from . import lights

CHART_DAYS = 260  # 趨勢圖保留的交易日數（約 1 年）
SPARK_N = 30
HIGH_GROUPS = ("us", "ai", "asia")  # 這些群組算「距近一年高點」


# ---------- 文字格式 ----------
def sp(x, d=2, unit="%"):
    """帶正負號的百分比；負號用真正的減號。"""
    r = round(x, d)
    s = "%s%s" % (format(abs(r), ",.%df" % d), unit)
    return ("+" if r > 0 else "−" if r < 0 else "") + s


def nv(x, d):
    return format(x, ",.%df" % d)


def md(iso):
    return "%d/%d" % (int(iso[5:7]), int(iso[8:10]))


# ---------- 單一標的 ----------
def streak(closes):
    """連續上漲(+N)或下跌(-N)的天數。"""
    n = 0
    for i in range(len(closes) - 1, 0, -1):
        d = closes[i] - closes[i - 1]
        s = 1 if d > 0 else -1 if d < 0 else 0
        if s == 0:
            break
        if n == 0:
            n = s
        elif (n > 0) == (s > 0):
            n += s
        else:
            break
    return n


def make_tile(cfg, rows, status, today):
    if len(rows) < 2:
        return None
    last_d, last = rows[-1]
    prev = rows[-2][1]
    is_rate = cfg["kind"] == "rate"
    chg = lambda a, b: (a - b) if is_rate else ((a / b - 1) * 100 if b else 0.0)
    closes = [r[1] for r in rows]
    t = {"id": cfg["id"], "name": cfg["name"], "short": cfg["short"], "group": cfg["group"], "kind": cfg["kind"],
         "dec": cfg["dec"], "value": round(last, 5), "prev": round(prev, 5), "chg": round(chg(last, prev), 3),
         "w1": round(chg(last, rows[-6][1]), 3) if len(rows) >= 6 else None,
         "m1": round(chg(last, rows[-22][1]), 3) if len(rows) >= 22 else None,
         "date": last_d.isoformat(), "spark": [round(c, 4) for c in closes[-SPARK_N:]],
         "streak": streak(closes[-30:]), "stale": (not status.get("ok", True)) or (today - last_d).days > 6}
    if cfg["group"] in HIGH_GROUPS and len(rows) >= 30:
        win = rows[-252:]
        hd, hv = max(win, key=lambda r: r[1])
        t["from_high"] = round((last / hv - 1) * 100, 2)
        t["high"] = round(hv, 5)
        t["high_date"] = hd.isoformat()
    if cfg.get("q"):
        t["q"] = cfg["q"]
    if cfg.get("yahoo"):
        t["yq"] = cfg["yahoo"][0]
    if status.get("error"):
        t["error"] = status["error"][:160]
    if status.get("day_high") is not None and status.get("day_low") is not None:
        t["day_high"], t["day_low"] = status["day_high"], status["day_low"]
    return t


# ---------- 氣氛 ----------
MOOD_LEVELS = [(5, 4, "恐慌"), (3, 3, "緊張"), (1, 2, "謹慎"), (0, 1, "平穩")]


def build_mood(T):
    pts, why = 0, []
    vix = T.get("vix")
    if vix:
        v = vix["value"]
        p = 3 if v >= 30 else 2 if v >= 25 else 1 if v >= 20 else 0
        pts += p
        if p:
            why.append("VIX %s" % nv(v, 1))
        if vix["chg"] >= 20:
            pts += 1
            why.append("VIX 單日 %s" % sp(vix["chg"], 0))
    movers = [T[i] for i in ("spx", "ixic", "sox", "twii") if i in T]
    if movers:
        worst, best = min(movers, key=lambda t: t["chg"]), max(movers, key=lambda t: t["chg"])
        w, b = worst["chg"], best["chg"]
        if w <= -1.5:
            p = 3 if w <= -5 else 2 if w <= -3 else 1
            pts += p
            why.append("%s %s" % (worst["short"], sp(w)))
        elif b >= 1.5:
            pts -= 2 if b >= 3 else 1
            why.append("%s %s" % (best["short"], sp(b)))
    if pts < 0:
        level, label = 0, "樂觀"
    else:
        level, label = next((lv, lb) for th, lv, lb in MOOD_LEVELS if pts >= th)
    return {"label": label, "level": level, "score": pts, "why": why,
            "rule": "規則式：VIX 水位與單日跳升，加上美股、費半、台股中跌最深（或漲最多）的一個。不是預測。"}


# ---------- 今日重點（規則式文字，數字全部來自資料） ----------
def _mv(t, d=2):
    return "%s %s" % (t["short"], sp(t["chg"], d))


def _best_worst(ts, n=2):
    ts = sorted(ts, key=lambda t: t["chg"])
    return ts[::-1][:n], ts[:n]


def build_highlights(T, events, macro=()):
    """每則：tag 標籤、text 文字、sub 屬於概覽哪個小分頁、link 趨勢頁連結。"""
    out = []

    def add(tag, text, sub, link):
        out.append({"tag": tag, "text": text, "sub": sub, "link": link})

    us = [T[i] for i in ("dji", "spx", "ixic", "sox") if i in T]
    if us:
        add("美股", "%s 收：%s" % (md(us[0]["date"]), "、".join(_mv(t) for t in us)), "stocks", "#trends/stocks")
    ai = sorted([T[i] for i in ("tsm", "nvda", "amd", "mu") if i in T and abs(T[i]["chg"]) >= 4], key=lambda t: t["chg"])
    if ai:
        ai = ai if ai[0]["chg"] < 0 else ai[::-1]
        add("AI 供應鏈", "、".join(_mv(t) for t in ai[:4]) + "（單日幅度 4% 以上）", "stocks", "#trends/stocks")
    tw = T.get("twii")
    if tw:
        s = "台股加權 %s（%s）" % (nv(tw["value"], 2), sp(tw["chg"]))
        if tw.get("from_high") is not None and tw["from_high"] <= -5:
            s += "，自近一年高點 %s 回檔 %s%%" % (nv(tw["high"], 0), nv(abs(tw["from_high"]), 1))
        if tw["streak"] <= -3:
            s += "，連 %d 黑" % -tw["streak"]
        elif tw["streak"] >= 3:
            s += "，連 %d 紅" % tw["streak"]
        tsm, t2330 = T.get("tsm"), T.get("tw2330")
        # 美股收盤在台股收盤之後：ADR 的日期不早於台股台積電，代表這段漲跌台股還沒反映
        if tsm and t2330 and tsm["date"] >= t2330["date"] and abs(tsm["chg"]) >= 3:
            s += "；台積電 ADR %s（美股 %s 收），台股台積電 %s 收 %s，尚未反映" % (sp(tsm["chg"]), md(tsm["date"]), md(t2330["date"]), nv(t2330["value"], 0))
        add("台股", s, "stocks", "#trends/stocks")
    asia = [T[i] for i in ("n225", "ks11", "hsi", "sse", "sensex", "dax") if i in T]
    if len(asia) >= 3:
        hi, lo = _best_worst(asia, 1)
        add("亞歐股市", "最強 %s；最弱 %s；其餘 %s" % (_mv(hi[0]), _mv(lo[0]), "、".join(_mv(t) for t in asia if t not in (hi[0], lo[0]))), "stocks", "#trends/stocks")

    if "usdtwd" in T:
        u = T["usdtwd"]
        s = "美元兌台幣 %s（%s，%s）" % (nv(u["value"], 3), sp(u["chg"]), "台幣貶值" if u["chg"] > 0.05 else "台幣升值" if u["chg"] < -0.05 else "大致持平")
        cross = [T[i] for i in T if i.startswith("twd_")]
        if cross:
            hi, lo = _best_worst(cross, 1)
            s += "；1 單位外幣換台幣：%s 最強、%s 最弱" % (_mv(hi[0]), _mv(lo[0]))
        add("新台幣", s, "fx", "#trends/fx")
    fx = [T[i] for i in T if T[i]["group"] == "fx"]
    if fx:
        dxy = T.get("dxy")
        big = [t for t in fx if t["id"] != "dxy" and abs(t["chg"]) >= 0.6]
        s = ("美元指數 %s（%s）" % (nv(dxy["value"], 2), sp(dxy["chg"]))) if dxy else ""
        if big:
            s += ("；" if s else "") + "單日波動較大：" + "、".join(_mv(t) for t in sorted(big, key=lambda t: -abs(t["chg"]))[:4])
        elif s:
            s += "；其他主要貨幣單日波動都在 0.6% 以內"
        if s:
            add("國際匯率", s, "fx", "#trends/fx")

    if "us10y" in T:
        bits = ["美債 10 年 %s%%（%s）" % (nv(T["us10y"]["value"], 2), sp(T["us10y"]["chg"], 2, " pp"))]
        for a, b, name in (("us10y", "us2y", "10 年減 2 年"), ("us10y", "us3m", "10 年減 3 個月")):
            if a in T and b in T:
                spr = T[a]["value"] - T[b]["value"]
                bits.append("%s利差 %s（%s）" % (name, sp(spr, 2, " pp"), "倒掛" if spr < 0 else "正斜率"))
        if "us30y" in T and "us3m" in T:
            bits.append("短端（3 個月）%s%%、長端（30 年）%s%%" % (nv(T["us3m"]["value"], 2), nv(T["us30y"]["value"], 2)))
        add("美債利率", "；".join(bits), "rates", "#trends/rates")
    risk = [T[i] for i in ("vix", "vxn", "move", "ovx", "gvz", "skew", "vvix") if i in T]
    if risk:
        bits = ["%s %s（%s）" % (t["short"], nv(t["value"], 1), sp(t["chg"], 0)) for t in risk if t["id"] in ("vix", "vxn", "move") or abs(t["chg"]) >= 8]
        if "hyoas" in T:
            bits.append("高收益債利差 %s%%（%s）" % (nv(T["hyoas"]["value"], 2), sp(T["hyoas"]["chg"], 2, " pp")))
        add("市場風險", "；".join(bits), "rates", "#trends/risk")

    g, sv, b, w = T.get("xauusd"), T.get("silver"), T.get("brent"), T.get("wti")
    if any(t and abs(t["chg"]) >= th for t, th in ((g, 2), (sv, 3), (b, 3), (w, 3))):
        s = "；".join("%s %s（%s）" % (t["short"], nv(t["value"], 2), sp(t["chg"])) for t in (g, sv, b, w) if t)
        if g and sv and sv["value"]:
            s += "；金銀比 %s" % nv(g["value"] / sv["value"], 1)
        add("商品", s, "cmd", "#trends/cmd")

    fund = [t for t in T.values() if t["group"].startswith("f_")]
    if len(fund) >= 6:
        hi, lo = _best_worst(fund, 3)
        add("基金類別", "今日較強：%s；較弱：%s（用代理 ETF 看各類資產）" % ("、".join(_mv(t) for t in hi), "、".join(_mv(t) for t in lo)), "funds", "#funds/common")

    if macro:
        ranked = sorted(macro, key=lambda m: m["score"])
        bad = [m for m in ranked if m["verdict"] == "壞"][:2]
        good = [m for m in ranked[::-1] if m["verdict"] == "好"][:2]
        bits = ["%s %s（前值 %s）" % (m["name"], _mfmt(m, m["value"]), _mfmt(m, m["prev"])) for m in bad + good]
        if bits:
            add("美國總經", "較差：%s；較好：%s" % ("、".join(bits[:len(bad)]) or "無", "、".join(bits[len(bad):]) or "無"), "all", "#trends/macro")
    if events:
        e = events[0]
        when = ("%s %s" % (md(e["date"]), e.get("time") or "")).strip()
        who = "" if e["event"].startswith(e["country"]) else e["country"]
        add("接下來", "%s %s%s" % (when, who, e["event"]), "all", "#trends/cal")
    return out


def _mfmt(m, v):
    return "%s%s" % (nv(v, m["dec"]), m["unit"] if m["unit"] in ("%",) else " " + m["unit"])


# ---------- 趨勢圖 ----------
def derive(cfg, daily):
    """由兩個標的算出的序列（利差、金銀比、新台幣對各幣別）。兩邊都有資料的日期才有值。"""
    out, names = {}, {}
    for d in cfg.get("derived", []):
        a, b = dict(daily.get(d["a"]) or []), dict(daily.get(d["b"]) or [])
        op, sc = d.get("op", "sub"), d.get("scale", 1)
        rows = []
        for day in sorted(set(a) & set(b)):
            if op == "div":
                if b[day]:
                    rows.append((day, a[day] / b[day] * sc))
            elif op == "mul":
                rows.append((day, a[day] * b[day] * sc))
            else:
                rows.append((day, (a[day] - b[day]) * sc))
        if rows:
            out[d["id"]] = rows
            names[d["id"]] = d
    return out, names


def build_curve(cfg, daily):
    c = cfg.get("curve")
    if not c:
        return None
    pts = [(sid, label) for sid, label in c["points"] if daily.get(sid)]
    if len(pts) < 3:
        return None
    last = max(daily[sid][-1][0] for sid, _ in pts)

    def at(sid, day):
        v = [x for d, x in daily[sid] if d <= day]
        return round(v[-1], 3) if v else None

    lines = []
    for label, day in (("最新 " + md(last.isoformat()), last), ("1 個月前", last - timedelta(days=30)), ("1 年前", last - timedelta(days=365))):
        vals = [at(sid, day) for sid, _ in pts]
        if vals.count(None) <= 1:
            lines.append({"label": label, "values": vals})
    cur = lines[0]["values"] if lines else []
    ids = [sid for sid, _ in pts]
    spreads = {}
    for name, a, b in (("10 年減 2 年", "us10y", "us2y"), ("10 年減 3 個月", "us10y", "us3m")):
        if a in ids and b in ids and cur[ids.index(a)] is not None and cur[ids.index(b)] is not None:
            spreads[name] = round(cur[ids.index(a)] - cur[ids.index(b)], 2)
    return {"title": c["title"], "note": c["note"], "labels": [label for _, label in pts], "lines": lines, "spreads": spreads}


def build_trends(cfg, daily):
    names = {s["id"]: s for s in cfg["symbols"]}
    extra, extra_names = derive(cfg, daily)
    daily = dict(daily, **extra)
    names.update(extra_names)
    charts = []
    for c in cfg["charts"]:
        have = [i for i in c["series"] if daily.get(i)]
        if not have:
            continue
        alld = sorted({d for i in have for d, _ in daily[i]})[-CHART_DAYS:]
        series = []
        for i in have:
            m = dict(daily[i])
            before = [v for d, v in daily[i] if d < alld[0]]
            cur = before[-1] if before else None
            vals = []
            for d in alld:
                if d in m:
                    cur = m[d]
                vals.append(None if cur is None else round(cur, 4))
            series.append({"id": i, "name": names[i]["name"], "short": names[i]["short"], "values": vals, "q": names[i].get("q")})
        charts.append({"id": c["id"], "cat": c.get("cat", "stocks"), "title": c["title"], "note": c["note"], "mode": c["mode"],
                       "dates": [d.isoformat() for d in alld], "series": series})
    return {"charts": charts, "curve": build_curve(cfg, daily)}


# ---------- 總經 ----------
# (id, 名稱, 算法, FRED 序列, 單位, 小數位, 好壞方向, 有意義的變動幅度, 推薦順序)
#   好壞方向：+1＝數字越高對景氣越好、−1＝越低越好（通膨、失業）、0＝不評好壞
#   變動幅度：和前一期差多少算「明顯」；評分 = 方向 × 變動 ÷ 幅度，≥0.5 算好、≤−0.5 算壞，其餘持平
MACRO = [
    ("us_cpi", "美國 CPI 年增", "yoy", "CPIAUCNS", "%", 1, -1, 0.2, 1),
    ("us_core_cpi", "美國核心 CPI 年增", "yoy", "CPILFENS", "%", 1, -1, 0.2, 2),
    ("us_nfp", "美國非農新增就業", "chg", "PAYEMS", "千人", 0, 1, 50, 3),
    ("us_unrate", "美國失業率", "level", "UNRATE", "%", 1, -1, 0.2, 4),
    ("us_core_pce", "美國核心 PCE 年增", "yoy", "PCEPILFE", "%", 1, -1, 0.2, 5),
    ("us_pce", "美國 PCE 年增", "yoy", "PCEPI", "%", 1, -1, 0.2, 6),
    ("us_claims", "初領失業救濟金（週）", "level_k", "ICSA", "千人", 0, -1, 10, 7),
    ("us_retail", "美國零售銷售月增", "mom", "RSAFS", "%", 1, 1, 0.5, 8),
    ("us_ppi", "美國 PPI 年增", "yoy", "PPIFID", "%", 1, -1, 0.3, 9),
    ("us_ip", "美國工業生產年增", "yoy", "INDPRO", "%", 1, 1, 0.5, 10),
    ("us_gdp", "美國實質 GDP（年化季增）", "level", "A191RL1Q225SBEA", "%", 1, 1, 0.5, 11),
    ("us_sent", "密大消費者信心", "level", "UMCSENT", "點", 1, 1, 3, 12),
    ("us_house", "美國新屋開工", "level", "HOUST", "千戶", 0, 1, 50, 13),
    ("us_jolts", "美國職缺數（JOLTS）", "level", "JTSJOL", "千個", 0, 1, 300, 14),
    ("us_ff", "聯邦資金利率（上限）", "level", "DFEDTARU", "%", 2, 0, 1, 15),
]
MACRO_KEYS = {"us_cpi": ("CPI",), "us_core_cpi": ("核心 CPI", "Core CPI"), "us_ppi": ("PPI",), "us_pce": ("PCE",),
              "us_nfp": ("非農", "Non-Farm"), "us_unrate": ("失業率", "Unemployment Rate"), "us_claims": ("初領", "Unemployment Claims"),
              "us_retail": ("零售", "Retail Sales"), "us_gdp": ("GDP",), "us_sent": ("消費者信心", "Sentiment"), "us_ip": ("工業生產",)}


def _yoy(rows):
    by = {(d.year, d.month): v for d, v in rows}
    return [(d, (v / by[(d.year - 1, d.month)] - 1) * 100) for d, v in rows if by.get((d.year - 1, d.month))]


def _mom(rows):
    return [(rows[i][0], (rows[i][1] / rows[i - 1][1] - 1) * 100) for i in range(1, len(rows)) if rows[i - 1][1]]


def build_macro(fred, calendar, today):
    out = []
    for tid, name, how, sid, unit, dec, good, scale, rec in MACRO:
        raw = fred.get(sid) or []
        if how == "yoy":
            rows = _yoy(raw)
        elif how == "mom":
            rows = _mom(raw)
        elif how == "chg":
            rows = [(raw[i][0], raw[i][1] - raw[i - 1][1]) for i in range(1, len(raw))]
        elif how == "level_k":
            rows = [(d, v / 1000) for d, v in raw]
        else:
            rows = raw
        if len(rows) < 2:
            continue
        v, pv = rows[-1][1], rows[-2][1]
        score = good * (v - pv) / scale if good else 0.0
        nxt = None
        for e in calendar:
            if e["country"] == "美國" and e["date"] >= today.isoformat() and any(k in e["event"] for k in MACRO_KEYS.get(tid, ())):
                nxt = {"date": e["date"], "time": e["time"], "event": e["event"]}
                break
        out.append({"id": tid, "name": name, "kind": how, "unit": unit, "dec": dec, "value": round(v, 3), "prev": round(pv, 3),
                    "period": rows[-1][0].isoformat()[:7], "asof": rows[-1][0].isoformat(), "next": nxt,
                    "history": [round(x, 3) for _, x in rows[-13:]], "good": good, "rec": rec,
                    "score": round(score, 2), "verdict": "好" if score >= 0.5 else "壞" if score <= -0.5 else "持平",
                    "weekly": how == "level_k"})
    return out


# ---------- 行事曆 ----------
def merge_calendar(auto, manual, today):
    out = [dict(e) for e in auto]
    seen = {(e["date"], e["event"]) for e in out}
    lo = (today - timedelta(days=1)).isoformat()
    for e in manual:
        if not e.get("date") or e["date"] < lo or (e["date"], e.get("event")) in seen:
            continue
        out.append({"date": e["date"], "time": e.get("time") or "", "event": e["event"], "country": e.get("country", ""),
                    "importance": e.get("importance", "M"), "previous": "", "forecast": "", "actual": "",
                    "note": e.get("note", ""), "source": "manual"})
    out.sort(key=lambda e: (e["date"], e["time"] or "99:99"))
    return out


# ---------- 總組裝 ----------
def build_all(cfg, daily, fred, auto_events, manual_events, status, today):
    """status：{標的 id: {"ok": bool, "error": str, "day_high"…}}。回傳 {檔名: 物件}。"""
    calendar = merge_calendar(auto_events, manual_events, today)
    extra, extra_meta = derive(cfg, daily)
    alld = dict(daily, **extra)
    symbols = list(cfg["symbols"]) + [m for m in extra_meta.values() if m.get("group")]
    T = {}
    for s in symbols:
        t = make_tile(s, alld.get(s["id"], []), status.get(s["id"], {}), today)
        if t:
            T[s["id"]] = t
    groups = []
    for g in cfg["groups"]:
        if g.get("hidden"):
            continue
        tiles = [T[s["id"]] for s in symbols if s["group"] == g["id"] and s["id"] in T]
        if not tiles:
            continue
        cnt = Counter(t["date"] for t in tiles)
        common = max(cnt, key=lambda d: (cnt[d], d))  # 次數相同時取較新的日期
        for t in tiles:
            t["show_date"] = t["date"] != common
        groups.append({"id": g["id"], "name": g["name"], "tiles": tiles})
    macro = build_macro(fred, calendar, today)
    upcoming = [e for e in calendar if today.isoformat() <= e["date"] <= (today + timedelta(days=7)).isoformat() and e["importance"] == "H"]
    overview = {"mood": build_mood(T), "highlights": build_highlights(T, upcoming, macro), "groups": groups, "events": upcoming[:30],
                "dates": {"us": T.get("spx", {}).get("date"), "tw": T.get("twii", {}).get("date")}}
    return {"overview": overview, "trends": build_trends(cfg, daily), "macro": macro,
            "lights": lights.build(cfg, daily, fred), "calendar": [e for e in calendar if e["date"] <= (today + timedelta(days=60)).isoformat()]}
