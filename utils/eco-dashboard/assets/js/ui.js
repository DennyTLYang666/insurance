/* 共用小元件：走勢小圖（SVG）、燈號標籤、日期倒數文字 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const F = WM.fmt;

  /** 走勢小圖：values 為數字陣列；up 決定顏色（紅漲綠跌）。資料不足 2 筆時回傳空字串 */
  function spark(values, up, w, h, neutral) {
    w = w || 120; h = h || 28;
    const v = (values || []).filter((x) => typeof x === "number");
    if (v.length < 2) return "";
    const lo = Math.min(...v), hi = Math.max(...v), pad = 2;
    const pts = v.map((x, i) => (i / (v.length - 1) * (w - 2 * pad) + pad).toFixed(1) + "," +
      (h - pad - (hi === lo ? 0.5 : (x - lo) / (hi - lo)) * (h - 2 * pad)).toFixed(1)).join(" ");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="近 ${v.length - 1} 週走勢"><polyline fill="none" stroke="${neutral ? "var(--c1)" : up ? "var(--up)" : "var(--down)"}" stroke-width="1.6" vector-effect="non-scaling-stroke" points="${pts}"/></svg>`;
  }

  const LIGHT = { "偏多": ["bull", "▲"], "偏空": ["bear", "▼"], "中性": ["flat", "●"] };
  /** 燈號：顏色＋符號＋文字，不只靠顏色 */
  function light(label) {
    const m = LIGHT[label] || LIGHT["中性"];
    return `<span class="light light-${m[0]}"><span aria-hidden="true">${m[1]}</span> ${F.esc(label)}</span>`;
  }

  /** 距離參考日還有幾天的文字 */
  function countdown(date, ref) {
    const n = F.daysBetween(ref, date);
    return n === 0 ? "今天" : n === 1 ? "明天" : n > 1 ? `${n} 天後` : `${-n} 天前`;
  }

  const IMP = { H: ["重要", "imp-h"], M: ["一般", "imp-m"], L: ["次要", "imp-l"], N: ["新聞", "imp-n"] };
  const imp = (k) => IMP[k] || IMP.M;

  WM.ui = { spark, light, countdown, imp };
})();
