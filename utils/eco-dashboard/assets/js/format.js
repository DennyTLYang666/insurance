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

  WM.fmt = { MINUS, esc, pct, num, signClass, cell, dateTime };
})();
