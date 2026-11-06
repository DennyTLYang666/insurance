/* 折線圖引擎：區間切換、起點設為 100、圖例點擊顯示／隱藏、全選／全消、新聞按鈕。趨勢頁與基金頁共用。 */
window.ECO = window.ECO || {};
(function () {
  const F = ECO.fmt, esc = F.esc;
  const S = { days: 66, list: [] };
  try { const d = +localStorage.getItem("eco.days"); if ([22, 66, 252].includes(d)) S.days = d; } catch (e) {}

  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const palette = () => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => css("--c" + i));
  const DASH = [[], [], [5, 3], [1, 3]];
  const tileOf = (id) => (ECO.tiles || {})[id];

  function series(c, days) {
    if (c.type === "curve") return c.lines.map((l, i) => ({ s: { id: "c" + i, short: l.label, name: l.label }, raw: l.values, vals: l.values }));
    const n = c.dates.length, st = Math.max(0, n - days);
    return c.series.map((s) => {
      const raw = s.values.slice(st);
      const base = raw.find((v) => v != null);
      const vals = c.mode === "index" ? raw.map((v) => v == null || !base ? null : v / base * 100) : raw;
      return { s: s, raw: raw, vals: vals };
    });
  }

  function legend(o, ser, cols) {
    const c = o.c;
    return ser.map((x, i) => {
      const vals = x.raw.filter((v) => v != null);
      const last = vals[vals.length - 1], first = vals[0];
      const t = tileOf(x.s.id), isRate = (t && t.kind === "rate") || c.unit === "pp";
      let tail = "";
      if (c.type !== "curve" && vals.length > 1) {
        const d = last - first;
        const delta = isRate || c.mode === "level" && !t && x.s.id.indexOf("sp_") === 0 ? F.sign(d, 2, " pp") : c.mode === "level" && !t ? F.sign(d, 2, "") : F.sign((last / first - 1) * 100, 1, "%");
        const cur = c.mode === "level" ? " " + F.num(last, t ? t.dec : 2) : "";
        tail = cur + ' <b class="' + F.dir(d) + '">' + delta + "</b>";
      }
      const nk = x.s.nk || (t && t.q ? x.s.id : null);
      const news = nk ? '<button type="button" class="lg-news" data-news="' + esc(nk) + '" data-title="' + esc(x.s.name) + '" data-yq="' + esc(x.s.yq || (t && t.yq) || "") + '" aria-label="' + esc(x.s.name) + ' 新聞" title="看 ' + esc(x.s.name) + ' 的新聞">新聞</button>' : "";
      const off = o.off.has(i);
      return '<span class="lgw"><button type="button" class="lg' + (off ? " off" : "") + '" data-i="' + i + '" aria-pressed="' + (!off) + '" title="點一下' + (off ? "顯示" : "隱藏") + '"><i style="background:' + cols[i % cols.length] + '"></i>' + esc(x.s.short) + tail + "</button>" + news + "</span>";
    }).join("");
  }

  function options(o) {
    const c = o.c, grid = css("--line"), ink = css("--muted"), curve = c.type === "curve";
    return {
      responsive: true, maintainAspectRatio: false, animation: false, spanGaps: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          itemSort: (a, b) => (b.parsed.y || 0) - (a.parsed.y || 0),
          callbacks: {
            title: (items) => { const l = items[0].label; return curve ? l : l + "（" + F.wd(l) + "）"; },
            label: (item) => {
              const t = tileOf((c.series && c.series[item.datasetIndex] || {}).id), y = item.parsed.y;
              return " " + item.dataset.label + "：" + (c.mode === "index" ? F.num(y, 1) : F.num(y, t ? t.dec : 2));
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: ink, maxTicksLimit: 6, autoSkip: true, maxRotation: 0, callback: function (v) { const l = this.getLabelForValue(v); return curve ? l : F.md(l); } } },
        y: { grid: { color: grid }, ticks: { color: ink, maxTicksLimit: 6, callback: (v) => c.mode === "index" ? F.num(v, 0) : F.num(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 2) }, grace: "5%" }
      }
    };
  }

  function datasets(o, ser, cols) {
    return ser.map((x, i) => ({
      label: x.s.short, data: x.vals, borderColor: cols[i % cols.length], backgroundColor: cols[i % cols.length], borderWidth: 1.8,
      borderDash: DASH[Math.floor(i / cols.length) % DASH.length], pointRadius: o.c.type === "curve" ? 3 : 0, pointHoverRadius: 4, tension: o.c.type === "curve" ? 0 : 0.15
    }));
  }

  function sync(o) {
    const cols = palette(), ser = series(o.c, S.days);
    const st = o.c.type === "curve" ? 0 : Math.max(0, o.c.dates.length - S.days);
    o.ch.data.labels = o.c.type === "curve" ? o.c.labels : o.c.dates.slice(st);
    o.ch.data.datasets = datasets(o, ser, cols);
    o.ch.options = options(o);
    o.ch.data.datasets.forEach((_, i) => o.ch.setDatasetVisibility(i, !o.off.has(i)));
    o.ch.update();
    o.card.querySelector(".lgs").innerHTML = legend(o, ser, cols);
    const act = o.card.querySelector(".chart-act");
    if (act) act.querySelector('[data-act="none"]').disabled = o.off.size >= ser.length;
    if (act) act.querySelector('[data-act="all"]').disabled = o.off.size === 0;
  }

  function add(box, c, opts) {
    opts = opts || {};
    const card = document.createElement("article");
    card.className = "chart";
    if (c.id) card.id = "chart-" + c.id;
    const multi = (c.type === "curve" ? c.lines.length : c.series.length) > 1;
    card.innerHTML = '<header><div><h3>' + esc(c.title) + "</h3><p>" + esc(c.note || "") + "</p></div>" +
      (multi ? '<div class="chart-act"><button type="button" data-act="all">全選</button><button type="button" data-act="none">全消</button></div>' : "") +
      '</header><div class="lgs"></div><div class="cv"><canvas role="img" aria-label="' + esc(c.title) + '"></canvas></div>' + (c.foot ? '<p class="note">' + c.foot + "</p>" : "");
    box.appendChild(card);
    const o = { c: c, card: card, off: new Set(opts.hidden || []), ch: null };
    o.ch = new Chart(card.querySelector("canvas").getContext("2d"), { type: "line", data: { labels: [], datasets: [] }, options: options(o) });
    card.addEventListener("click", (e) => {
      const lg = e.target.closest(".lg"), act = e.target.closest("[data-act]");
      const n = (c.type === "curve" ? c.lines.length : c.series.length);
      if (lg) { const i = +lg.dataset.i; o.off.has(i) ? o.off.delete(i) : o.off.add(i); sync(o); }
      else if (act) { o.off = act.dataset.act === "all" ? new Set() : new Set(Array.from({ length: n }, (_, i) => i)); sync(o); }
    });
    S.list.push(o);
    sync(o);
    return o;
  }

  function clear(box) {
    S.list = S.list.filter((o) => { if (box.contains(o.card)) { o.ch.destroy(); return false; } return true; });
    box.innerHTML = "";
  }

  ECO.charts = {
    add: add, clear: clear,
    refresh: () => S.list.forEach(sync),
    resize: () => S.list.forEach((o) => o.ch.resize()),
    days: () => S.days,
    setRange: function (days) {
      S.days = days;
      try { localStorage.setItem("eco.days", days); } catch (e) {}
      document.querySelectorAll("[data-days]").forEach((b) => b.classList.toggle("on", +b.dataset.days === days));
      S.list.forEach(sync);
    },
    count: () => S.list.length
  };
})();
