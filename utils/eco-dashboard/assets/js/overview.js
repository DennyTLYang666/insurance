/* 概觀（第一頁）：結論、漲跌排行、環境燈號、關鍵數字、未來 7 天、生活風險。每個函式只處理一塊，缺資料就整塊隱藏。 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const F = WM.fmt, U = WM.ui;
  const $ = (id) => document.getElementById(id);

  /** 參考日：資料更新當天（台北）。歷史週次以當時的更新日為準，所以「未來 7 天」看的是當時的未來 */
  const refDate = (data) => F.dateOnly(data.meta.updated_at);

  function summary(data) {
    const m = data.meta;
    $("summary-text").textContent = m.summary || (m.summary_points && m.summary_points.length ? "" : "（尚未填寫本週結論）");
    $("summary-points").innerHTML = (m.summary_points || []).map((t) => `<li>${F.esc(t)}</li>`).join("");
    const note = $("analysis-note");
    note.hidden = !m.analysis_by;
    if (m.analysis_by) {
      note.textContent = `結論、央行態度、新聞影響方向與風險說明由${m.analysis_by}撰寫${m.analysis_at ? "（" + F.dateOnly(m.analysis_at) + "）" : ""}，屬推論，非事實數據，亦非個人建議。`;
    }
    // 一眼看懂：領漲、領跌、燈號統計（皆由資料計算，非判斷）
    const dims = [...data.dimensions].sort((a, b) => b.returns.w1 - a.returns.w1);
    const top = dims[0], bot = dims[dims.length - 1];
    const chips = [`<span class="chip">七指標領漲 <b>${F.esc(top.name)}</b> <span class="${F.signClass(top.returns.w1)}">${F.pct(top.returns.w1)}</span></span>`,
                   `<span class="chip">領跌 <b>${F.esc(bot.name)}</b> <span class="${F.signClass(bot.returns.w1)}">${F.pct(bot.returns.w1)}</span></span>`];
    const env = data.environment;
    if (env) {
      const mine = env.products.filter((p) => dims.some((d) => d.name === p.name));
      const n = (l) => mine.filter((p) => p.label === l).length;
      chips.push(`<span class="chip">七指標環境燈號 ${U.light("偏多")} ${n("偏多")}・${U.light("中性")} ${n("中性")}・${U.light("偏空")} ${n("偏空")}</span>`);
    }
    $("scoreboard").innerHTML = chips.join("");
  }

  function rank(data) {
    const dims = data.dimensions.map((d) => ({ name: d.name, proxy: d.proxy, w1: d.returns.w1, w4: d.returns.w4 }));
    const tw = (data.quotes || []).find((q) => q.id === "twii");  // 加權指數（週五到週五，與 ETF 同一個期間）
    if (tw) dims.push({ name: "加權指數", proxy: "^TWII", w1: tw.changes.w1, w4: tw.changes.w4 });
    dims.sort((a, b) => b.w1 - a.w1);
    const max = Math.max(...dims.map((d) => Math.abs(d.w1)), 0.001);
    $("rank-title").textContent = (data.meta.chart_titles && data.meta.chart_titles.ranking) || "上週漲跌排行";
    $("rank-bars").innerHTML = dims.map((d) => {
      const v = d.w1, w = Math.max(Math.abs(v) / max * 100, 1.5).toFixed(1);
      return `<li class="rk">
        <span class="rk-name">${F.esc(d.name)}<small>${F.esc(d.proxy)}</small></span>
        <span class="rk-track" aria-hidden="true"><span class="rk-bar ${v >= 0 ? "up" : "down"}" style="--w:${w}%"></span></span>
        <span class="rk-val ${F.signClass(v)}">${F.pct(v)}</span>
        <span class="rk-sub">4 週 ${F.pct(d.w4, 1)}</span></li>`;
    }).join("");
    $("rank-sum").textContent = "文字摘要：1 週報酬由高到低：" + dims.map((d) => `${d.name} ${F.pct(d.w1)}`).join("、") + "。";
  }

  function lights(data) {
    const env = data.environment, box = $("ov-lights");
    box.hidden = !env;
    if (!env) return;
    const isDim = new Set(data.dimensions.map((d) => d.name));
    const chip = (p) => `<button type="button" class="lt lt-${({ "偏多": "bull", "偏空": "bear" }[p.label]) || "flat"}" data-go="s-env" title="${F.esc(p.name)}：${F.esc(p.label)}（分數 ${F.num(p.score, 2, true)}，資料至 ${F.esc(p.last_date)}）">
      <span class="lt-name">${F.esc(p.name)}</span>${U.light(p.label)}</button>`;
    const a = env.products.filter((p) => isDim.has(p.name)), b = env.products.filter((p) => !isDim.has(p.name));
    $("lights-wall").innerHTML = `<div class="lt-grid">${a.map(chip).join("")}</div>` +
      (b.length ? `<p class="lt-sub">匯率與商品</p><div class="lt-grid">${b.map(chip).join("")}</div>` : "");
    $("lights-note").textContent = `${env.note}　因子資料至 ${env.factors.map((f) => f.date).sort().slice(-1)[0]}。`;
  }

  const KPI_GROUPS = ["匯率", "商品", "股市", "利率與風險", "總經數據"];
  const pc = (q, v) => (v == null ? "—" : q.kind === "rate" ? F.num(v, 2, true) + " pp" : F.pct(v));
  const cls = (v) => (v == null ? "" : F.signClass(v));

  function quoteTile(q) {
    const L = q.live || {}, s = q.series.map((p) => p.value);
    const hasLive = q.live && (L.d1 != null || L.w1 != null || L.m1 != null);
    const day = hasLive ? L.d1 : q.changes.w1, wk = hasLive ? L.w1 : q.changes.w4, mo = hasLive ? L.m1 : q.changes.w13;
    const lb = hasLive ? ["週", "月"] : ["4 週", "13 週"];
    return `<button type="button" class="kpi" data-q="${F.esc(q.id)}" title="看 ${F.esc(q.name)} 26 週走勢（${F.esc(q.last_date)}）">
      <span class="kpi-name">${F.esc(q.name)}</span>
      <span class="kpi-row"><span class="kpi-val">${F.num(q.last, q.decimals)}${q.kind === "rate" ? "%" : ""}</span>
        <span class="kpi-day ${cls(day)}">${hasLive ? " " : "1 週 "}${pc(q, day)}</span></span>
      <span class="kpi-chg"><span>${lb[0]} <b class="${cls(wk)}">${pc(q, wk)}</b></span><span>${lb[1]} <b class="${cls(mo)}">${pc(q, mo)}</b></span></span>
      ${U.spark(s, true, 120, 24, true)}</button>`;
  }

  function macroTile(t) {
    const f = (v) => (v == null ? "—" : t.kind === "chg" ? F.num(v, 0, true) + "K" : F.num(v, t.decimals) + t.unit);
    const n = t.next ? `<span class="kpi-next">下次 ${F.md(t.next.date)}${t.next.time ? " " + F.esc(t.next.time) : ""}${t.next.forecast ? "・預期 " + F.esc(t.next.forecast) : ""}</span>` : "";
    return `<button type="button" class="kpi kpi-macro" data-go="s-country" title="${F.esc(t.name)}（${F.esc(t.period)}）">
      <span class="kpi-name">${F.esc(t.name)}</span>
      <span class="kpi-row"><span class="kpi-val">${f(t.value)}</span></span>
      <span class="kpi-chg"><span>${F.esc(t.period)}${t.prev == null ? "" : "　前期 <b>" + f(t.prev) + "</b>"}</span></span>${n}</button>`;
  }

  function kpis(data) {
    const quotes = data.quotes || [], macro = data.macro || [], box = $("ov-kpi");
    box.hidden = !quotes.length && !macro.length;
    if (box.hidden) return;
    const html = [];
    for (const g of KPI_GROUPS) {
      const tiles = g === "總經數據" ? macro.map(macroTile) : quotes.filter((q) => q.group === g).map(quoteTile);
      if (tiles.length) html.push(`<div class="kpi-group"><h3 class="kpi-gh">${F.esc(g)}</h3><div class="kpi-grid">${tiles.join("")}</div></div>`);
    }
    $("kpi-groups").innerHTML = html.join("");
  }

  function agenda(data) {
    const ref = refDate(data), end = F.addDays(ref, 7);
    const evs = data.calendar.filter((e) => e.date >= ref && e.date <= end && e.importance !== "L")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const shown = evs.filter((e) => e.importance === "H").concat(evs.filter((e) => e.importance !== "H")).slice(0, 7)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    $("agenda-range").textContent = `${F.md(ref)}–${F.md(end)}`;
    $("agenda-list").innerHTML = shown.map((e) => `<li class="ag ${U.imp(e.importance)[1]}">
      <button type="button" data-go="s-cal" data-day="${F.esc(e.date)}">
      <span class="ag-d"><b>${F.md(e.date)}</b> 週${F.weekday(e.date)}${e.time ? " " + F.esc(e.time) : ""}</span>
      <span class="ag-e"><span class="dot" aria-hidden="true"></span>${F.esc(e.event)}</span>
      <span class="ag-c">${F.esc(e.country)}</span></button></li>`).join("") ||
      '<li class="empty">未來 7 天沒有登錄的重要事件。</li>';
  }

  function risks(data) {
    const ref = refDate(data), list = data.risk_events || [], box = $("ov-risk");
    box.hidden = !list.length;
    if (!list.length) return;
    const sorted = [...list].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    $("risk-chips").innerHTML = sorted.map((r) => {
      const when = r.date ? `${F.md(r.date)}・${U.countdown(r.date, ref)}` : "持續關注";
      return `<li><button type="button" class="rc" data-go="s-risk">
        <span class="rc-cat">${F.esc(r.category || "風險")}</span><span class="rc-name">${F.esc(r.name)}</span>
        <span class="rc-when">${when}</span></button></li>`;
    }).join("");
  }

  function render(data) {
    summary(data); rank(data); lights(data); kpis(data); agenda(data); risks(data);
    $("ov-cutoff").textContent = data.meta.data_cutoff;
  }

  WM.overview = { render, refDate };
})();
