/* 圖表：Chart.js 包裝。顏色一律讀 CSS 變數，淺色／深色模式皆適用。 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const F = WM.fmt;
  const registry = {};   // key -> { canvasId, build }
  const instances = {};  // key -> Chart

  function theme() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    return { ink: g("--ink"), muted: g("--muted"), line: g("--line"), up: g("--up"), down: g("--down"),
             c1: g("--c1"), c2: g("--c2"), c3: g("--c3"), font: g("--font") };
  }

  function draw(key) {
    const r = registry[key];
    if (instances[key]) { instances[key].destroy(); delete instances[key]; }
    const canvas = document.getElementById(r.canvasId);
    if (!canvas) return;
    if (!canvas.getClientRects().length) return;  // 所在區塊收合中：展開時再由 flush() 補畫
    if (!window.Chart) {  // CDN 載入失敗（離線等）：保留文字摘要
      const box = canvas.parentElement;
      box.style.height = "auto";
      box.innerHTML = '<p class="chart-fallback">圖表函式庫未能載入（可能離線），請參閱下方文字摘要與表格。</p>';
      return;
    }
    const t = theme();
    Chart.defaults.color = t.muted;
    Chart.defaults.font.family = t.font;
    Chart.defaults.borderColor = t.line;
    instances[key] = new Chart(canvas, r.build(t));
  }

  /** 註冊並繪製；build(theme) 回傳 Chart.js 設定 */
  function show(key, canvasId, build) {
    registry[key] = { canvasId, build };
    draw(key);
  }
  const redraw = () => Object.keys(registry).forEach(draw);          // 切換深淺色時重畫
  const flush = () => Object.keys(registry).forEach((k) => { if (!instances[k]) draw(k); });  // 區塊展開後補畫
  function destroyAll() {                                            // 換週次重畫整頁前清空
    Object.keys(instances).forEach((k) => instances[k].destroy());
    Object.keys(instances).forEach((k) => delete instances[k]);
    Object.keys(registry).forEach((k) => delete registry[k]);
  }

  // 在長條末端標示數值（讓數字不只靠顏色與長度傳達）
  const endLabels = {
    id: "endLabels",
    afterDatasetsDraw(chart, args, opts) {
      if (!opts || !opts.format) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = "12px " + opts.font;
      ctx.fillStyle = opts.color;
      ctx.textBaseline = "middle";
      chart.getDatasetMeta(0).data.forEach((bar, i) => {
        const v = chart.data.datasets[0].data[i];
        ctx.textAlign = v >= 0 ? "left" : "right";
        ctx.fillText(opts.format(v), bar.x + (v >= 0 ? 6 : -6), bar.y);
      });
      ctx.restore();
    },
  };

  const baseOptions = { responsive: true, maintainAspectRatio: false, animation: false };
  const axisTitle = (t, text) => ({ display: true, text, color: t.muted });

  /** 上週漲跌排行：水平長條，依 1 週報酬由高到低，座標軸以 0 為基準 */
  function rank(dims) {
    return (t) => {
      const s = [...dims].sort((a, b) => b.returns.w1 - a.returns.w1);
      return {
        type: "bar",
        data: { labels: s.map((d) => d.name), datasets: [{
          label: "1 週報酬", data: s.map((d) => d.returns.w1), borderWidth: 0, barPercentage: 0.7,
          backgroundColor: s.map((d) => (d.returns.w1 >= 0 ? t.up : t.down)) }] },
        options: { ...baseOptions, indexAxis: "y",
          plugins: { legend: { display: false },
            tooltip: { callbacks: { label: (c) => "1 週報酬 " + F.pct(c.parsed.x) } },
            endLabels: { format: (v) => F.pct(v), color: t.ink, font: t.font } },
          scales: {
            x: { beginAtZero: true, grace: "18%", ticks: { callback: (v) => F.pct(v, 1) },
                 title: axisTitle(t, "1 週報酬（座標軸從 0 起算）") },
            y: { grid: { display: false }, ticks: { color: t.ink } } } },
        plugins: [endLabels],
      };
    };
  }

  /** 趨勢比較：最多 3 條週線（起點標準化為 100），Y 軸非零起點並標示 */
  function trend(selected) {
    return (t) => {
      const colors = [t.c1, t.c2, t.c3], dashes = [[], [7, 4], [2, 3]];
      const labels = selected[0].weekly_close.map((p) => p.date);
      const all = selected.flatMap((d) => d.weekly_close.map((p) => p.value));
      const lo = Math.floor(Math.min(...all) / 5) * 5 - 5, hi = Math.ceil(Math.max(...all) / 5) * 5 + 5;
      return {
        type: "line",
        data: { labels, datasets: selected.map((d, i) => {
          const byDate = Object.fromEntries(d.weekly_close.map((p) => [p.date, p.value]));
          return { label: d.name, data: labels.map((l) => byDate[l] ?? null), borderColor: colors[i], backgroundColor: colors[i],
                   borderDash: dashes[i], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15, spanGaps: true };
        }) },
        options: { ...baseOptions, interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: true, labels: { color: t.ink, usePointStyle: false } },
            tooltip: { callbacks: { label: (c) => c.dataset.label + "：" + F.num(c.parsed.y) } } },
          scales: {
            x: { ticks: { maxTicksLimit: 7, maxRotation: 0 }, grid: { display: false } },
            y: { min: lo, max: hi, ticks: { callback: (v) => F.num(v, 0) },
                 title: axisTitle(t, "指數（起點 = 100；非零起點座標軸）") } } },
      };
    };
  }

  /** 單一報價 26 週走勢（折線，Y 軸非零起點並標示） */
  function quote(q) {
    return (t) => {
      const s = q.series, v = s.map((p) => p.value), lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo || Math.abs(hi) * 0.02 || 1) * 0.15;
      return {
        type: "line",
        data: { labels: s.map((p) => p.date), datasets: [{ label: q.name, data: v, borderColor: t.c1, backgroundColor: t.c1,
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15 }] },
        options: { ...baseOptions, interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false },
            tooltip: { callbacks: { label: (c) => q.name + "：" + F.num(c.parsed.y, q.decimals) + (q.kind === "rate" ? "%" : "") } } },
          scales: { x: { ticks: { maxTicksLimit: 7, maxRotation: 0 }, grid: { display: false } },
            y: { min: lo - pad, max: hi + pad, ticks: { callback: (x) => F.num(x, q.decimals > 2 ? 2 : q.decimals) },
                 title: axisTitle(t, "價格（非零起點座標軸）") } } },
      };
    };
  }

  /** 國家總經：政策利率與 CPI 年增的分組長條，座標軸從 0 起算 */
  function countries(list) {
    return (t) => ({
      type: "bar",
      data: { labels: list.map((c) => c.name), datasets: [
        { label: "政策利率", data: list.map((c) => c.policy_rate), backgroundColor: t.c1 },
        { label: "CPI 年增", data: list.map((c) => c.cpi_yoy), backgroundColor: t.c2 }] },
      options: { ...baseOptions,
        plugins: { legend: { display: true, labels: { color: t.ink } },
          tooltip: { callbacks: { label: (c) => c.dataset.label + "：" + F.num(c.parsed.y) + "%" } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: t.ink } },
          y: { beginAtZero: true, ticks: { callback: (v) => F.num(v, 1) + "%" },
               title: axisTitle(t, "百分比（座標軸從 0 起算）") } } },
    });
  }

  WM.charts = { show, redraw, flush, destroyAll, builders: { rank, trend, countries, quote } };
})();
