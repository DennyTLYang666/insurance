/* 格式化工具：千分位、百分比、正負號（負值一律用「−」）、時間（固定顯示台北時間） */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const MINUS = "−";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fixed = (v, digits) => Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const bad = (v) => v == null || typeof v !== "number" || isNaN(v);

  /** 報酬等比率：+1.23% / −1.23% */
  function pct(v, digits = 2) {
    if (bad(v)) return "—";
    return (v < 0 ? MINUS : v > 0 ? "+" : "") + fixed(v * 100, digits) + "%";
  }
  /** 一般數字：千分位；signed=true 時正數加「+」 */
  function num(v, digits = 2, signed = false) {
    if (bad(v)) return "—";
    return (v < 0 ? MINUS : signed && v > 0 ? "+" : "") + fixed(v, digits);
  }
  const signClass = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  /** 表格儲存格：空值顯示「—」 */
  const cell = (v) => (v == null || v === "" ? "—" : esc(v));

  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  /** ISO 8601 → 2026-10-28 14:00（台北時間） */
  function dateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso || "—";
    const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  }

  /** ISO 8601 → 2026-10-28（台北日期） */
  function dateOnly(iso) { return dateTime(iso).slice(0, 10); }
  const utc = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d); };
  /** 兩個 YYYY-MM-DD 相差幾天（b − a） */
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
  const addDays = (s, n) => new Date(utc(s) + n * 86400000).toISOString().slice(0, 10);
  const WD = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = (s) => WD[new Date(utc(s)).getUTCDay()];
  const md = (s) => { const [, m, d] = String(s).split("-"); return Number(m) + "/" + Number(d); };

  WM.fmt = { MINUS, esc, pct, num, signClass, cell, dateTime, dateOnly, daysBetween, addDays, weekday, md };
})();
