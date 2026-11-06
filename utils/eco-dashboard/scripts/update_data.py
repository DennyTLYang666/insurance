#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""每週市場總覽：資料更新腳本

流程：讀取 data/raw/ 的 CSV 與 manual.json → 全部驗證 → 計算 → 寫出 data/weekly.json，
並把同一份資料存成 data/history/weekly-<資料截止日>.json（歷史存檔，網頁可切換查看）。

只使用 Python 標準函式庫。用法：
    python scripts/update_data.py                  # 驗證 data/raw 並更新網站
    python scripts/update_data.py --fetch          # 先自動抓價格／利率／總經／日曆／新聞候選，再更新
    python scripts/update_data.py --fetch-only     # 只抓資料（之後由人或 Claude 補判斷文字再更新）
    python scripts/update_data.py --check-sources  # 檢查各資料來源是否可用
    python scripts/update_data.py --dry-run        # 只驗證與計算，不寫任何檔案
"""
import argparse
import csv
import json
import math
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import econ_bridge
import fetch_sources
from fetch_sources import atomic_write

TZ = timezone(timedelta(hours=8))  # Asia/Taipei，固定 +08:00（不依賴 tzdata）

# ---------- 允許清單 ----------
DIMENSIONS = [("tw_equity", "台股"), ("us_equity", "美股"), ("tech", "科技"), ("bond", "美債"),
              ("gold", "黃金"), ("oil", "原油"), ("usd", "美元")]
# 每個指標代表一類資產，並對應可直接交易的標的（ETF）；role＝它在投資組合裡扮演的角色
DIM_ROLE = {"tw_equity": "成長／台灣", "us_equity": "成長／風險偏好", "tech": "成長／AI 科技", "bond": "利率／避險",
            "gold": "避險／抗通膨", "oil": "通膨／地緣", "usd": "匯率／避險"}
COUNTRIES = [("US", "美國"), ("EU", "歐元區"), ("JP", "日本"), ("TW", "台灣"), ("CN", "中國")]
RATE_SERIES = {"DGS10": "美國 10 年期公債殖利率（%）", "DXY": "美元指數 DXY", "USD/TWD": "美元兌新台幣"}
STANCES = ("鷹派", "中性", "鴿派")
IMPACTS = ("偏多", "偏空", "中性")
SOURCE_TYPES = ("官方", "市場數據", "媒體")
TRENDS = ("上升", "持平", "下降")

DIM_LOOKUP = {}
for _id, _name in DIMENSIONS:
    DIM_LOOKUP[_id] = _id
    DIM_LOOKUP[_name] = _id
DIM_LOOKUP["美股大盤"] = "us_equity"  # 舊名稱相容
LEGACY_DIMS = ("新興市場",)  # 已由「台股」取代的舊維度：新聞略過、風險事件的關聯維度剔除（皆警告）
DIM_NAME = dict(DIMENSIONS)
CTY_LOOKUP = {}
for _id, _name in COUNTRIES:
    CTY_LOOKUP[_id] = _id
    CTY_LOOKUP[_name] = _id
CTY_NAME = dict(COUNTRIES)

# ---------- 計算規則 ----------
MIN_POINTS = 14        # 13 週報酬需要 14 筆收盤
TREND_WEEKS = 26       # 趨勢圖：近 26 週（約 6 個月），共 27 個點
HEAT_TOP_N = 2         # 每欄排名前 N 為「強」、後 N 為「弱」，其餘為「中」
SUMMARY_WARN_LEN = 200


class Report:
    """收集所有驗證錯誤，讓使用者一次看完。"""

    def __init__(self):
        self.errors = []
        self.warnings = []

    def err(self, file, line, msg):
        self.errors.append((file, line, msg))

    def warn(self, file, line, msg):
        self.warnings.append((file, line, msg))

    @staticmethod
    def fmt(kind, file, line, msg):
        where = file if line in (None, 0) else "%s 第 %s 行" % (file, line)
        return "[%s] %s：%s" % (kind, where, msg)


# ---------- 基本解析 ----------
def parse_date(s):
    s = (s or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def parse_dt(s):
    s = (s or "").strip().replace("Z", "+00:00")
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        return None
    return d if d.tzinfo else None


def parse_float(s):
    try:
        v = float((s or "").strip().replace(",", ""))
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def read_csv(path, fields, rep):
    """回傳 [(行號, dict)]；缺檔或缺欄位會記錄錯誤。"""
    name = path.name
    if not path.exists():
        rep.err(name, 0, "找不到檔案")
        return []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        header = [h.strip() for h in (reader.fieldnames or [])]
        missing = [x for x in fields if x not in header]
        if missing:
            rep.err(name, 1, "缺少欄位：" + "、".join(missing))
            return []
        rows = []
        for row in reader:
            clean = {(k or "").strip(): (v or "").strip() for k, v in row.items() if k is not None}
            if not any(clean.values()):
                continue  # 空白行
            rows.append((reader.line_num, clean))
    return rows


def need(rep, name, line, row, cols):
    """必填欄位檢查；回傳是否全部有值。"""
    ok = True
    for c in cols:
        if not row.get(c):
            rep.err(name, line, "欄位「%s」不可空白" % c)
            ok = False
    return ok


# ---------- 各 CSV 驗證 ----------
def load_prices(path, rep):
    name = path.name
    series = {}  # dim_id -> {date: close}
    proxy = {}
    for line, r in read_csv(path, ["date", "dimension", "proxy", "close"], rep):
        if not need(rep, name, line, r, ["date", "dimension", "proxy", "close"]):
            continue
        d, dim, close = parse_date(r["date"]), DIM_LOOKUP.get(r["dimension"]), parse_float(r["close"])
        if d is None:
            rep.err(name, line, "日期格式應為 YYYY-MM-DD：%s" % r["date"])
        if dim is None:
            rep.err(name, line, "維度代碼不在允許清單：%s（允許：%s）" % (r["dimension"], "、".join(i for i, _ in DIMENSIONS)))
        if close is None:
            rep.err(name, line, "close 無法轉為數字：%s" % r["close"])
        elif close <= 0:
            rep.err(name, line, "close 必須大於 0：%s" % r["close"])
        if d is None or dim is None or close is None or close <= 0:
            continue
        if d.weekday() != 4:
            rep.warn(name, line, "%s 不是週五（資料建議為週五收盤日）" % r["date"])
        if d in series.setdefault(dim, {}):
            rep.err(name, line, "%s 的 %s 重複" % (dim, r["date"]))
            continue
        series[dim][d] = close
        proxy[dim] = r["proxy"]  # 檔案中最後出現者為準
    return series, proxy


def load_rates(path, rep):
    name = path.name
    seen, out = set(), []
    for line, r in read_csv(path, ["date", "series", "value"], rep):
        if not need(rep, name, line, r, ["date", "series", "value"]):
            continue
        d, v = parse_date(r["date"]), parse_float(r["value"])
        if d is None:
            rep.err(name, line, "日期格式應為 YYYY-MM-DD：%s" % r["date"])
        if r["series"] not in RATE_SERIES:
            rep.err(name, line, "series 不在允許清單：%s（允許：%s）" % (r["series"], "、".join(RATE_SERIES)))
        if v is None:
            rep.err(name, line, "value 無法轉為數字：%s" % r["value"])
        if d is None or v is None or r["series"] not in RATE_SERIES:
            continue
        if (d, r["series"]) in seen:
            rep.err(name, line, "%s 的 %s 重複" % (r["series"], r["date"]))
            continue
        seen.add((d, r["series"]))
        out.append((d, r["series"], v))
    return out


def load_countries(path, rep):
    name = path.name
    latest = {}  # cid -> (as_of, record)
    cols = ["as_of", "country", "policy_rate", "cpi_yoy", "gdp_yoy", "source"]  # stance、stance_reason 為選填
    for line, r in read_csv(path, cols, rep):
        if not need(rep, name, line, r, cols):
            continue
        d, cid = parse_date(r["as_of"]), CTY_LOOKUP.get(r["country"])
        if d is None:
            rep.err(name, line, "as_of 日期格式應為 YYYY-MM-DD：%s" % r["as_of"])
        if cid is None:
            rep.err(name, line, "國家代碼不在允許清單：%s（允許：%s）" % (r["country"], "、".join(i for i, _ in COUNTRIES)))
        nums = {}
        for c in ("policy_rate", "cpi_yoy", "gdp_yoy"):
            nums[c] = parse_float(r[c])
            if nums[c] is None:
                rep.err(name, line, "%s 無法轉為數字：%s" % (c, r[c]))
        stance = r.get("stance", "")
        if stance and stance not in STANCES:
            rep.err(name, line, "stance 只能是 %s：%s" % ("／".join(STANCES), stance))
        if d is None or cid is None or None in nums.values() or (stance and stance not in STANCES):
            continue
        if cid in latest and latest[cid][0] == d:
            rep.err(name, line, "%s 在 %s 重複" % (cid, r["as_of"]))
            continue
        if cid not in latest or d > latest[cid][0]:
            rec = {"id": cid, "name": CTY_NAME[cid], "policy_rate": nums["policy_rate"], "cpi_yoy": nums["cpi_yoy"],
                   "real_rate": round(nums["policy_rate"] - nums["cpi_yoy"], 2), "gdp_yoy": nums["gdp_yoy"],
                   "stance": stance, "stance_reason": r.get("stance_reason", ""), "as_of": r["as_of"], "source": r["source"]}
            latest[cid] = (d, rec)
    missing = [i for i, _ in COUNTRIES if i not in latest]
    if missing and not any(e[0] == name for e in rep.errors):
        rep.err(name, 0, "缺少國家資料：%s（可執行 --fetch 自動抓 US、EU；其餘國家請人工或請 Claude 查證後補上一列）" % "、".join(missing))
    return [latest[i][1] for i, _ in COUNTRIES if i in latest]


NEWS_COLS = ["published_at", "source", "source_type", "dimension", "impact", "summary", "url"]


def check_news(rep, name, line, r):
    """檢查一則新聞；通過回傳 (時間, 輸出物件)，否則記錄錯誤並回傳 None。"""
    r = {k: str(r.get(k, "") or "").strip() for k in NEWS_COLS}
    if not need(rep, name, line, r, NEWS_COLS):
        return None
    dt, dim = parse_dt(r["published_at"]), DIM_LOOKUP.get(r["dimension"])
    if r["dimension"] in LEGACY_DIMS:
        rep.warn(name, line, "dimension「%s」已淘汰（改為七個投資指標），這則新聞已略過；要保留請改成台股或其他指標" % r["dimension"])
        return None
    ok = True
    if dt is None:
        rep.err(name, line, "published_at 需為含時區的 ISO 8601（例如 2026-10-28T14:00:00+08:00）：%s" % r["published_at"]); ok = False
    if r["source_type"] not in SOURCE_TYPES:
        rep.err(name, line, "source_type 只能是 %s：%s" % ("／".join(SOURCE_TYPES), r["source_type"])); ok = False
    if dim is None:
        rep.err(name, line, "dimension 不在允許清單：%s" % r["dimension"]); ok = False
    if r["impact"] not in IMPACTS:
        rep.err(name, line, "impact 只能是 %s：%s" % ("／".join(IMPACTS), r["impact"])); ok = False
    if not re.match(r"https?://", r["url"]):
        rep.err(name, line, "url 需以 http:// 或 https:// 開頭：%s" % r["url"]); ok = False
    if len(r["summary"]) > SUMMARY_WARN_LEN:
        rep.warn(name, line, "summary 超過 %d 字，新聞只應存一句話摘要" % SUMMARY_WARN_LEN)
    if not ok:
        return None
    return dt, {"published_at": r["published_at"], "source": r["source"], "source_type": r["source_type"],
                "dimension": DIM_NAME[dim], "impact": r["impact"], "summary": r["summary"], "url": r["url"]}


def load_news(path, rep, manual_items=()):
    """news.csv（人工）＋ manual.json 的 news（Claude／人工撰寫）；網址相同者以 manual.json 為準。"""
    by_url = {}
    for line, r in (read_csv(path, NEWS_COLS, rep) if path.exists() else []):  # news.csv 為選填
        got = check_news(rep, path.name, line, r)
        if got:
            by_url[got[1]["url"]] = got
    for i, r in enumerate(manual_items, 1):
        got = check_news(rep, "manual.json", 0, dict(r, _i=i)) if isinstance(r, dict) else rep.err("manual.json", 0, "news[%d] 需為物件" % i)
        if got:
            by_url[got[1]["url"]] = got
    return [g[1] for g in sorted(by_url.values(), key=lambda x: x[0], reverse=True)]  # 新到舊


def load_calendar(path, rep):
    name = path.name
    cols = ["date", "time", "event", "country", "previous", "forecast", "actual"]
    out = []
    for line, r in read_csv(path, cols, rep):
        if not need(rep, name, line, r, ["date", "time", "event", "country"]):
            continue
        d = parse_date(r["date"])
        if d is None:
            rep.err(name, line, "date 格式應為 YYYY-MM-DD：%s" % r["date"])
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", r["time"]):
            rep.err(name, line, "time 格式應為 HH:MM：%s" % r["time"])
        if d is None or not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", r["time"]):
            continue
        out.append({"date": r["date"], "time": r["time"], "event": r["event"], "previous": r["previous"] or None,
                    "forecast": r["forecast"] or None, "actual": r["actual"] or None, "country": r["country"],
                    "importance": r.get("importance") or "M"})
    out.sort(key=lambda e: (e["date"], e["time"]))  # 舊到新
    return out


def calendar_extra(manual, rep):
    """manual.json 的 calendar_extra：自動來源沒有的重要日期（選舉、央行會議、財報…），由 Claude／人工查證後填寫。"""
    out = []
    for i, e in enumerate(manual.get("calendar_extra") or [], 1):
        tag = "calendar_extra[%d]" % i
        if not isinstance(e, dict) or parse_date(str(e.get("date", ""))) is None:
            rep.err("manual.json", 0, "%s.date 需為 YYYY-MM-DD" % tag); continue
        if not str(e.get("event", "")).strip() or not str(e.get("country", "")).strip():
            rep.err("manual.json", 0, "%s 需有 event 與 country" % tag); continue
        t = str(e.get("time", "") or "")
        if t and not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", t):
            rep.err("manual.json", 0, "%s.time 格式應為 HH:MM（不知道時間就留空）" % tag); continue
        imp = e.get("importance", "M")
        if imp not in ("H", "M", "L"):
            rep.err("manual.json", 0, "%s.importance 只能是 H／M／L" % tag); continue
        out.append({"date": e["date"], "time": t, "event": e["event"].strip(), "previous": None, "forecast": None, "actual": None,
                    "country": e["country"].strip(), "importance": imp, "note": str(e.get("note", "") or ""), "url": str(e.get("url", "") or ""),
                    "source": "manual"})
    return out


def load_manual(path, rep):
    """人工撰寫的內容：本週結論、圖表結論式標題、風險事件。"""
    name = path.name
    if not path.exists():
        rep.err(name, 0, "找不到檔案")
        return {}
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            m = json.load(f)
    except ValueError as e:
        rep.err(name, 0, "JSON 格式錯誤：%s" % e)
        return {}
    if not str(m.get("summary", "")).strip():
        rep.warn(name, 0, "summary（本週一句話結論）尚未填寫")
    pts = m.get("summary_points")
    if pts is not None:
        if not isinstance(pts, list) or not pts or any(not isinstance(x, str) or not x.strip() for x in pts):
            rep.err(name, 0, "summary_points 需為字串清單（每點一句話，建議 3–6 點）")
        elif len(pts) > 8:
            rep.warn(name, 0, "summary_points 有 %d 點，建議 3–6 點，一眼看完" % len(pts))
        elif any(len(x) > 120 for x in pts):
            rep.warn(name, 0, "summary_points 有超過 120 字的項目，建議每點一句話")
    elif m.get("summary"):
        rep.warn(name, 0, "summary_points（條列重點）尚未填寫，頁面只會顯示一句話結論")
    titles = m.get("chart_titles") or {}
    for k in ("ranking", "trend", "countries"):
        if not str(titles.get(k, "")).strip():
            rep.warn(name, 0, "chart_titles.%s（圖表結論式標題）尚未填寫" % k)
    for cid, j in (m.get("countries") or {}).items():
        if cid not in CTY_NAME:
            rep.err(name, 0, "countries.%s 不在允許清單（允許：%s）" % (cid, "、".join(CTY_NAME)))
        elif not isinstance(j, dict) or j.get("stance") not in STANCES or not str(j.get("stance_reason", "")).strip():
            rep.err(name, 0, "countries.%s 需有 stance（%s）與 stance_reason" % (cid, "／".join(STANCES)))
    if (m.get("summary") or m.get("countries") or m.get("news")) and not str(m.get("analysis_by", "")).strip():
        rep.warn(name, 0, "analysis_by 未填：判斷文字的撰寫者需標示（例如「Claude（AI）」或你的名字）")
    names = set(DIM_NAME.values())
    for i, ev in enumerate(m.get("risk_events") or [], 1):
        tag = "risk_events[%d]" % i
        for k in ("name", "note"):
            if not str(ev.get(k, "")).strip():
                rep.err(name, 0, "%s.%s 不可空白" % (tag, k))
        for k in ("news_count_w1", "news_count_w4"):  # 沒有實際統計時填 null，頁面顯示「—」，不可編造
            v = ev.get(k)
            if v is not None and (not isinstance(v, int) or isinstance(v, bool) or v < 0):
                rep.err(name, 0, "%s.%s 需為 0 以上的整數或 null" % (tag, k))
        if ev.get("trend") not in TRENDS:
            rep.err(name, 0, "%s.trend 只能是 %s" % (tag, "／".join(TRENDS)))
        linked = ev.get("linked_dimensions")
        if isinstance(linked, list):  # 舊名稱（如「美股大盤」）自動換成現在的指標名稱
            ev["linked_dimensions"] = linked = [DIM_NAME.get(DIM_LOOKUP.get(x), x) if isinstance(x, str) else x for x in linked]
        if isinstance(linked, list) and any(x in LEGACY_DIMS for x in linked):
            rep.warn(name, 0, "%s.linked_dimensions 的「%s」已淘汰，已自動剔除；請改用新的指標名稱" % (tag, "、".join(x for x in linked if x in LEGACY_DIMS)))
            ev["linked_dimensions"] = linked = [x for x in linked if x not in LEGACY_DIMS]
            if not linked:
                rep.err(name, 0, "%s.linked_dimensions 剔除舊維度後是空的，請至少填一個新的指標名稱（台股、美股、科技、美債、黃金、原油、美元）" % tag)
                continue
        if not isinstance(linked, list) or not linked or any(x not in names for x in linked):
            rep.err(name, 0, "%s.linked_dimensions 需為維度名稱清單（允許：%s）" % (tag, "、".join(sorted(names))))
        if ev.get("category") and ev["category"] not in RISK_CATEGORIES:
            rep.err(name, 0, "%s.category 只能是 %s" % (tag, "／".join(RISK_CATEGORIES)))
        if "推論" not in str(ev.get("note", "")):
            rep.warn(name, 0, "%s.note 建議明確標示為「推論」，避免被讀成確定關係" % tag)
        for k in ("date", "until"):  # 選填：事件日、顯示到哪一天
            if ev.get(k) and parse_date(str(ev[k])) is None:
                rep.err(name, 0, "%s.%s 格式應為 YYYY-MM-DD" % (tag, k))
        if ev.get("keep_days") is not None and (not isinstance(ev["keep_days"], int) or ev["keep_days"] < 0):
            rep.err(name, 0, "%s.keep_days 需為 0 以上的整數" % tag)
    return m


RISK_CATEGORIES = ("政治", "科技", "娛樂", "物價能源", "房貸利率", "匯率旅遊", "薪資就業", "投資市場", "地緣政治")


def active_risks(events, today):
    """依事件日移除過期的風險事件：有 until 就用 until，否則有 date 就用「date ＋ keep_days（預設 7 天）」；都沒有＝一直顯示。"""
    keep, dropped = [], []
    for ev in events or []:
        until = parse_date(str(ev.get("until", ""))) if ev.get("until") else None
        if until is None and ev.get("date"):
            d = parse_date(str(ev["date"]))
            if d is not None:
                until = d + timedelta(days=ev.get("keep_days", 7))
        if until is not None and today > until:
            dropped.append(ev.get("name", ""))
            continue
        out = dict(ev)
        out["until"] = until.isoformat() if until else None
        keep.append(out)
    return keep, dropped


# ---------- 判斷文字（央行態度）套用 ----------
def apply_judgement(countries, manual, prev, rep):
    """央行態度優先序：manual.json 的 countries ＞ countries.csv 自帶 ＞ 沿用上週（並警告）＞ 報錯。"""
    given = manual.get("countries") or {}
    prev_by = {c.get("id"): c for c in prev}
    for c in countries:
        j = given.get(c["id"])
        if j:
            c["stance"], c["stance_reason"] = j["stance"], j["stance_reason"].strip()
        elif c["stance"] and c["stance_reason"]:
            continue
        elif prev_by.get(c["id"], {}).get("stance"):
            p = prev_by[c["id"]]
            c["stance"], c["stance_reason"] = p["stance"], "（沿用上週判斷，尚待更新）" + p["stance_reason"]
            rep.warn("manual.json", 0, "%s 尚未更新央行態度，暫時沿用上週" % c["id"])
        else:
            rep.err("manual.json", 0, "缺少 %s 的央行態度：請在 countries.%s 填寫 stance 與 stance_reason" % (c["id"], c["id"]))


# ---------- 重要報價 ----------
def load_quotes(path, rep):
    """quotes.csv（date,id,symbol,close,kind）；kind：w＝週五收盤、l＝最新收盤。檔案不存在視為沒有報價。"""
    if not path.exists():
        return {}
    name, ids, by = path.name, {q[0] for q in fetch_sources.QUOTES}, {}
    for line, r in read_csv(path, ["date", "id", "symbol", "close", "kind"], rep):
        if not need(rep, name, line, r, ["date", "id", "symbol", "close", "kind"]):
            continue
        d, v = parse_date(r["date"]), parse_float(r["close"])
        bad = False
        if d is None:
            rep.err(name, line, "日期格式應為 YYYY-MM-DD：%s" % r["date"]); bad = True
        if r["id"] not in ids:
            rep.err(name, line, "id 不在允許清單：%s" % r["id"]); bad = True
        if v is None:
            rep.err(name, line, "close 無法轉為數字：%s" % r["close"]); bad = True
        if r["kind"] not in ("w", "l"):
            rep.err(name, line, "kind 只能是 w 或 l：%s" % r["kind"]); bad = True
        if bad:
            continue
        e = by.setdefault(r["id"], {"symbol": r["symbol"], "w": {}, "l": None})
        e["symbol"] = r["symbol"]
        if r["kind"] == "l":
            e["l"] = (d, v)
        elif d in e["w"]:
            rep.err(name, line, "%s 的 %s 重複" % (r["id"], r["date"]))
        else:
            e["w"][d] = v
    return by


def live_changes(rows, last_v, last_d, kind):
    """相對最新價的變動：日（前一個交易日收盤）、週（7 天前或更早的最近收盤）、月（30 天前或更早的最近收盤）。
    價格用百分比、殖利率用百分點差；資料不足的項目為 None。"""
    out = {"d1": None, "w1": None, "m1": None}
    if not rows:
        return out
    older = [(d, v) for d, v in rows if d < last_d]

    def at_or_before(day):
        c = [(d, v) for d, v in older if d <= day]
        return c[-1][1] if c else None

    def diff(base):
        if base is None or (kind != "rate" and base == 0):
            return None
        return round(last_v - base if kind == "rate" else last_v / base - 1, 4)

    out["d1"] = diff(older[-1][1]) if older else None
    out["w1"] = diff(at_or_before(last_d - timedelta(days=7)))
    out["m1"] = diff(at_or_before(last_d - timedelta(days=30)))
    return out


def build_quotes(by, cutoff, rep, daily=None):
    out = []
    for qid, qname, grp, _syms, kind, dec in fetch_sources.QUOTES:
        e = by.get(qid)
        if not e:
            continue
        ds = sorted(e["w"])
        if len(ds) < MIN_POINTS:
            rep.warn("quotes.csv", 0, "%s 週資料只有 %d 週（需 %d 週），已略過" % (qname, len(ds), MIN_POINTS))
            continue
        vals = [e["w"][d] for d in ds]
        if cutoff and ds[-1] != cutoff:
            rep.warn("quotes.csv", 0, "%s 最新週資料是 %s，與資料截止日 %s 不同（抓取可能失敗而沿用舊資料）" % (qname, ds[-1], cutoff))

        def chg(n):  # 價格：百分比；殖利率：百分點差
            return vals[-1] - vals[-1 - n] if kind == "rate" else vals[-1] / vals[-1 - n] - 1

        window = list(zip(ds, vals))[-(TREND_WEEKS + 1):]
        last_d, last_v = e["l"] if e["l"] else (ds[-1], vals[-1])
        live = live_changes((daily or {}).get(qid), last_v, last_d, kind)
        out.append({"id": qid, "name": qname, "group": grp, "symbol": e["symbol"], "kind": kind, "decimals": dec,
                    "last": round(last_v, 4), "last_date": last_d.isoformat(), "as_of": ds[-1].isoformat(),
                    "changes": {"w1": round(chg(1), 4), "w4": round(chg(4), 4), "w13": round(chg(13), 4)}, "live": live,
                    "series": [{"date": d.isoformat(), "value": round(v, 4)} for d, v in window]})
    return out


# ---------- 計算 ----------
def build_dimensions(series, proxy, rep, price_name):
    """由價格計算 1/4/13 週報酬、相對強弱與強中弱標籤。回傳 (維度清單, 資料截止日)。"""
    missing = [i for i, _ in DIMENSIONS if i not in series]
    if missing:
        rep.err(price_name, 0, "缺少維度資料：" + "、".join(missing))
    for dim, pts in series.items():
        if len(pts) < MIN_POINTS:
            rep.err(price_name, 0, "%s 只有 %d 週資料，至少需要 %d 週才能算 13 週報酬" % (dim, len(pts), MIN_POINTS))
    if rep.errors:
        return [], None
    cutoff = max(max(p) for p in series.values())
    for dim, pts in series.items():
        if max(pts) != cutoff:
            rep.err(price_name, 0, "%s 最新日期是 %s，與其他維度的 %s 不一致" % (dim, max(pts), cutoff))
        ds = sorted(pts)
        for a, b in zip(ds, ds[1:]):
            if not 4 <= (b - a).days <= 14:  # 14 天內＝整週休市（如春節）也算正常
                rep.warn(price_name, 0, "%s 在 %s 與 %s 之間不是每週一筆（相隔 %d 天），報酬週數可能失準" % (dim, a, b, (b - a).days))
    if rep.errors:
        return [], None

    rows = {}
    for dim, _ in DIMENSIONS:
        ds = sorted(series[dim])
        vals = [series[dim][d] for d in ds]
        r = {k: vals[-1] / vals[-1 - n] - 1 for k, n in (("w1", 1), ("w4", 4), ("w13", 13))}
        window = list(zip(ds, vals))[-(TREND_WEEKS + 1):]
        base = window[0][1]
        rows[dim] = {"ret": r, "comp": sum(r.values()) / 3, "close": [{"date": d.isoformat(), "value": round(v / base * 100, 2)} for d, v in window]}

    ids = [i for i, _ in DIMENSIONS]
    k = min(HEAT_TOP_N, len(ids) // 3)

    def label(rank):
        return "強" if rank <= k else ("弱" if rank > len(ids) - k else "中")

    rank = {m: {} for m in ("w1", "w4", "w13")}
    labels = {i: {} for i in ids}
    for m in rank:
        for pos, i in enumerate(sorted(ids, key=lambda x: (-rows[x]["ret"][m], ids.index(x))), 1):
            rank[m][i] = pos
            labels[i][m] = label(pos)
    score = {i: sum(rank[m][i] for m in rank) for i in ids}  # 三個指標排名加總，越小越強
    order = sorted(ids, key=lambda x: (score[x], -rows[x]["comp"], ids.index(x)))
    heat = {i: label(pos) for pos, i in enumerate(order, 1)}
    basket = sum(rows[i]["comp"] for i in ids) / len(ids)  # 七維度等權平均

    dims = []
    for i, name in DIMENSIONS:
        dims.append({"id": i, "name": name, "proxy": proxy[i],
                     "returns": {m: round(v, 4) for m, v in rows[i]["ret"].items()},
                     "role": DIM_ROLE.get(i, ""), "relative_strength": round(rows[i]["comp"] - basket, 4),
                     "heat": heat[i], "labels": labels[i], "weekly_close": rows[i]["close"]})
    return dims, cutoff


def build_rates(items):
    out = []
    for sid, name in RATE_SERIES.items():
        pts = sorted((d, v) for d, s, v in items if s == sid)
        if not pts:
            continue
        last = pts[-1]
        prev = pts[-2] if len(pts) > 1 else None
        out.append({"id": sid, "name": name, "date": last[0].isoformat(), "value": last[1],
                    "prev_value": prev[1] if prev else None,
                    "change": round(last[1] - prev[1], 4) if prev else None})
    return out


# ---------- 寫檔與歷史存檔 ----------
def write_pair(json_path, obj, key):
    """寫 .json（網站讀取）與同名 .js（以 file:// 直接開啟時的備援載入）。"""
    atomic_write(json_path, json.dumps(obj, ensure_ascii=False, indent=2) + "\n")
    js = "window.WM_JSONP&&window.WM_JSONP(%s,%s);\n" % (json.dumps(key), json.dumps(obj, ensure_ascii=False))
    atomic_write(json_path.with_suffix(".js"), js)


# 總經數據的「下次公布」：到行事曆找第一個符合的事件（國家＋事件名稱關鍵字）
MACRO_NEXT = {"us_cpi": ("美國", ("CPI",)), "us_core_cpi": ("美國", ("CPI",)), "us_ppi": ("美國", ("PPI", "生產者物價")),
              "us_nfp": ("美國", ("非農",)), "us_unrate": ("美國", ("失業率",)), "eu_cpi": ("歐元區", ("CPI Flash", "CPI 快報"))}


def build_macro(series, countries, calendar, ref):
    tiles = econ_bridge.macro_tiles(series)
    eu = next((c for c in countries if c["id"] == "EU"), None)
    if eu is not None and eu.get("cpi_yoy") is not None:
        tiles.append({"id": "eu_cpi", "name": "歐元區 CPI 年增", "group": "總經數據", "kind": "yoy", "unit": "%", "decimals": 1,
                      "value": eu["cpi_yoy"], "prev": None, "period": eu["as_of"][:7]})
    for t in tiles:
        ctry, keys = MACRO_NEXT.get(t["id"], (None, ()))
        nxt = None
        for e in calendar:  # calendar 已依日期排序
            if e["date"] >= ref and e["country"] == ctry and any(k in e["event"] for k in keys) and "Core" not in e["event"]:
                nxt = {"date": e["date"], "time": e["time"], "forecast": e.get("forecast"), "previous": e.get("previous")}
                break
        t["next"] = nxt
    return tiles


def econ_summary(series, environment, now_iso):
    """給 Claude 分析用的 econ 摘要（不顯示在頁面）：所有 FRED 數列的最新值、最新公布、各產品的燈號與相關係數。"""
    latest = []
    for sid in sorted(series):
        rows = series[sid]
        if not rows:
            continue
        item = {"id": sid, "name": econ_bridge.FACTORS.get(sid, (sid,))[0], "date": rows[-1][0].isoformat(), "value": rows[-1][1], "released": rows[-1][2].isoformat()}
        t = econ_bridge.trend(rows, econ_bridge.FACTORS[sid][2]) if sid in econ_bridge.FACTORS else None
        if t:
            item.update({"dir_20d": t["dir"], "chg_20d": round(t["d20"], 4)})
        latest.append(item)
    return {"generated_at": now_iso,
            "note": "供撰寫分析用，頁面不顯示。CPI／PCE 年增由季調指數估算，與 BLS／BEA 公布的未季調年增略有差異，引用官方數字時以官方為準。",
            "series_latest": latest, "releases": econ_bridge.releases(series), "environment": environment}


def write_outputs(root, data, summary=None):
    data_dir, hist = root / "data", root / "data" / "history"
    hist.mkdir(parents=True, exist_ok=True)
    cutoff = data["meta"]["data_cutoff"]
    latest_path = data_dir / "weekly.json"
    archived_old = None
    if latest_path.exists():  # 覆蓋前先確保舊的一週已存檔
        try:
            old = json.loads(latest_path.read_text(encoding="utf-8"))
            oc = old["meta"]["data_cutoff"]
            if oc != cutoff and not (hist / ("weekly-%s.json" % oc)).exists():
                write_pair(hist / ("weekly-%s.json" % oc), old, "data/history/weekly-%s.json" % oc)
                archived_old = oc
        except (ValueError, KeyError, OSError):
            print("[警告] 既有 weekly.json 無法讀取，略過舊資料存檔。", file=sys.stderr)
    write_pair(hist / ("weekly-%s.json" % cutoff), data, "data/history/weekly-%s.json" % cutoff)
    write_pair(latest_path, data, "data/weekly.json")
    if summary:
        atomic_write(data_dir / "econ_summary.json", json.dumps(summary, ensure_ascii=False, indent=2) + "\n")

    weeks = []
    for p in hist.glob("weekly-*.json"):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))["meta"]
            weeks.append({"cutoff": m["data_cutoff"], "file": "history/" + p.name, "updated_at": m.get("updated_at"),
                          "summary": m.get("summary", "")})
        except (ValueError, KeyError, OSError):
            print("[警告] 略過無法解析的歷史檔：%s" % p.name, file=sys.stderr)
    weeks.sort(key=lambda w: w["cutoff"], reverse=True)
    write_pair(hist / "index.json", {"latest": cutoff, "weeks": weeks}, "data/history/index.json")
    return archived_old, len(weeks)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser(description="讀取 data/raw/ 的 CSV，驗證後產出 data/weekly.json 並保留歷史存檔。")
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent, help="網站根目錄（預設為本腳本的上一層）")
    ap.add_argument("--fetch", nargs="?", const="all", metavar="來源",
                    help="先自動抓資料再更新。來源：all（預設）或逗號分隔的 prices,rates,macro,calendar,news")
    ap.add_argument("--fetch-fred", action="store_true", help="等同 --fetch rates（FRED 美債殖利率、美元兌台幣）")
    ap.add_argument("--fetch-only", action="store_true", help="只抓資料並寫入 data/raw/，不驗證也不更新網站（供 Claude 先看數字再撰寫判斷）")
    ap.add_argument("--check-sources", action="store_true", help="檢查所有資料來源是否可連線與格式正確（不寫檔）")
    ap.add_argument("--dry-run", action="store_true", help="只驗證與計算，不寫任何檔案")
    ap.add_argument("--force", action="store_true", help="允許用較舊的資料截止日覆蓋最新的 weekly.json")
    args = ap.parse_args()

    root = args.root.resolve()
    raw = root / "data" / "raw"
    sources = set()
    if args.fetch:
        sources = set(fetch_sources.ALL_SOURCES) if args.fetch == "all" else {x.strip() for x in args.fetch.split(",") if x.strip()}
        bad = sources - set(fetch_sources.ALL_SOURCES)
        if bad:
            print("[錯誤] 未知的來源：%s（可用：%s）" % ("、".join(sorted(bad)), "、".join(fetch_sources.ALL_SOURCES)), file=sys.stderr)
            return 1
    if args.fetch_fred:
        sources.add("rates")
    if args.fetch_only and not sources:
        sources = set(fetch_sources.ALL_SOURCES)  # --fetch-only 未指定來源時抓全部
    if args.check_sources:
        return 1 if fetch_sources.run_fetch(raw, set(fetch_sources.ALL_SOURCES), dry=True) else 0
    fetch_failures = 0
    if sources:
        if args.dry_run:
            print("[提示] --dry-run 不寫檔，略過抓取。")
        else:
            fetch_failures = fetch_sources.run_fetch(raw, sources)
    if args.fetch_only:
        return 2 if fetch_failures else 0

    rep = Report()
    series, proxy = load_prices(raw / "prices.csv", rep)
    rates = load_rates(raw / "rates.csv", rep)
    countries = load_countries(raw / "countries.csv", rep)
    calendar = load_calendar(raw / "calendar.csv", rep)
    manual = load_manual(raw / "manual.json", rep)
    news = load_news(raw / "news.csv", rep, manual.get("news") or [])
    dims, cutoff = build_dimensions(series, proxy, rep, "prices.csv")
    quotes_raw = load_quotes(raw / "quotes.csv", rep)
    daily = econ_bridge.load_daily(raw / "daily.csv")
    quotes = build_quotes(quotes_raw, cutoff, rep, daily)
    econ_series = econ_bridge.load_series(raw / "econ_series.csv")
    products = [(i, n, "指標") for i, n in DIMENSIONS] + [("usdtwd", "美元／新台幣", "匯率"), ("eurusd", "歐元／美元", "匯率"),
                ("usdjpy", "美元／日圓", "匯率"), ("XAUUSD", "XAUUSD（MT5）", "商品"), ("GBPUSD", "GBPUSD（MT5）", "匯率")]
    environment = econ_bridge.build_environment(daily, econ_series, products, cutoff.isoformat() if cutoff else "")
    extra_cal = calendar_extra(manual, rep)  # 先驗證，錯誤才會在寫檔前一起列出
    if environment is None:
        rep.warn("econ_series.csv／daily.csv", 0, "沒有足夠的 econ 因子或日資料，環境燈號略過（請執行 --fetch）")
    latest_path = root / "data" / "weekly.json"
    prev = []
    if latest_path.exists():
        try:
            prev = json.loads(latest_path.read_text(encoding="utf-8")).get("countries", [])
        except (ValueError, OSError):
            prev = []
    apply_judgement(countries, manual, prev, rep)
    if cutoff:
        for c in countries:
            d = parse_date(c["as_of"])
            if d and (cutoff - d).days > 150:
                rep.warn("countries.csv", 0, "%s 的資料日 %s 距資料截止日超過 150 天，請確認是否有新數字" % (c["id"], c["as_of"]))

    for w in rep.warnings:
        print(Report.fmt("警告", *w), file=sys.stderr)
    if rep.errors:
        print("\n驗證失敗，共 %d 個錯誤，未產生任何檔案：" % len(rep.errors), file=sys.stderr)
        for e in rep.errors:
            print("  " + Report.fmt("錯誤", *e), file=sys.stderr)
        return 1

    if latest_path.exists() and not args.force:
        try:
            cur = json.loads(latest_path.read_text(encoding="utf-8"))["meta"]["data_cutoff"]
            if cutoff.isoformat() < cur:
                print("[錯誤] 資料截止日 %s 早於目前 weekly.json 的 %s，已中止（確定要覆蓋請加 --force）。" % (cutoff, cur), file=sys.stderr)
                return 1
        except (ValueError, KeyError, OSError):
            pass

    meta = {"updated_at": datetime.now(TZ).replace(microsecond=0).isoformat(), "data_cutoff": cutoff.isoformat(),
            "timezone": "Asia/Taipei", "notice": manual.get("notice") or "本頁僅供內部參考，資料不構成投資建議。",
            "summary": manual.get("summary", ""), "summary_points": manual.get("summary_points") or [],
            "chart_titles": manual.get("chart_titles", {})}
    if manual.get("analysis_by"):
        meta["analysis_by"], meta["analysis_at"] = manual["analysis_by"], manual.get("analysis_at", "")
    today = datetime.now(TZ).date()
    risks, dropped = active_risks(manual.get("risk_events", []), today)
    if dropped:
        print("已移除過期的風險事件：%s" % "、".join(dropped))
    calendar = sorted(calendar + extra_cal, key=lambda e: (e["date"], e["time"] or "99:99"))
    macro = build_macro(econ_series, countries, calendar, today.isoformat())
    data = {"meta": meta, "dimensions": dims, "environment": environment, "quotes": quotes, "macro": macro, "countries": countries,
            "rates": build_rates(rates), "news": news, "calendar": calendar, "risk_events": risks}

    n_price = sum(len(p) for p in series.values())
    print("處理筆數：價格 %d、報價 %d 項、利率 %d、國家 %d、新聞 %d、行事曆 %d、風險事件 %d" %
          (n_price, len(quotes), len(rates), len(countries), len(news), len(calendar), len(data["risk_events"])))
    if args.dry_run:
        print("資料截止日：%s（--dry-run，未寫入任何檔案）" % meta["data_cutoff"])
        return 0
    archived_old, n_weeks = write_outputs(root, data, econ_summary(econ_series, environment, meta['updated_at']) if econ_series else None)
    print("已產出：%s" % latest_path)
    print("歷史存檔：%s（共 %d 週）" % (root / "data" / "history" / ("weekly-%s.json" % meta["data_cutoff"]), n_weeks))
    if archived_old:
        print("已把覆蓋前的舊資料（截止日 %s）補存入歷史。" % archived_old)
    print("資料截止日：%s" % meta["data_cutoff"])
    if fetch_failures:
        print("[警告] 有 %d 個資料來源抓取失敗，網站使用的是舊資料（見上方 [抓取失敗]）。" % fetch_failures, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
