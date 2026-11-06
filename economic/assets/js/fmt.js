/* 格式工具：數字、漲跌顏色（紅漲綠跌）、迷你走勢線、HTML 跳脫。 */
window.ECO = window.ECO || {};
(function () {
  const MINUS = "−";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, d) => (v == null || isNaN(v)) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sign = (v, d, unit) => {
    if (v == null || isNaN(v)) return "—";
    const r = Number(Number(v).toFixed(d));
    return (r > 0 ? "+" : r < 0 ? MINUS : "") + Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) + unit;
  };
  const dir = (v) => (v == null || isNaN(v) || Math.abs(v) < 0.005) ? "flat" : v > 0 ? "up" : "down";
  const arrow = (v) => ({ up: "▲", down: "▼", flat: "–" }[dir(v)]);
  const md = (iso) => iso ? (+iso.slice(5, 7)) + "/" + (+iso.slice(8, 10)) : "";
  const WD = ["日", "一", "二", "三", "四", "五", "六"];
  const wd = (iso) => WD[new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay()];
  const tpe = (d, o) => new Intl.DateTimeFormat("zh-TW", Object.assign({ timeZone: "Asia/Taipei", hour12: false }, o)).format(d);

  /* 價格類用 %，殖利率用 pp */
  const chg = (t, v) => t.kind === "rate" ? sign(v, 2, " pp") : sign(v, 2, "%");

  function spark(values, w, h) {
    w = w || 72; h = h || 26;
    const v = (values || []).filter((x) => x != null);
    if (v.length < 2) return "";
    const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = hi - lo || 1;
    const pts = v.map((x, i) => (i / (v.length - 1) * (w - 2) + 1).toFixed(1) + "," + (h - 2 - (x - lo) / span * (h - 4)).toFixed(1));
    const cls = v[v.length - 1] >= v[0] ? "up" : "down";
    return '<svg class="spark ' + cls + '" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><polyline points="' + pts.join(" ") + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  ECO.fmt = { esc: esc, num: num, sign: sign, dir: dir, arrow: arrow, md: md, wd: wd, tpe: tpe, chg: chg, spark: spark, MINUS: MINUS };
})();
