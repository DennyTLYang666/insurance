/* 經濟日曆：月曆（點日期看當天事件）＋清單；窄螢幕預設清單。事件來源：自動抓取＋manual.json 的 calendar_extra。 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const F = WM.fmt, U = WM.ui;
  const $ = (id) => document.getElementById(id);
  const ORDER = { H: 0, M: 1, L: 2, N: 3 };
  let st = null;  // { events, byDate, ref, months, mi, sel, view }

  const ym = (s) => s.slice(0, 7);
  const sortEv = (a, b) => (ORDER[a.importance] - ORDER[b.importance]) || (a.time || "99").localeCompare(b.time || "99");
  const byTime = (a, b) => (a.date + (a.time || "00:00")).localeCompare(b.date + (b.time || "00:00"));

  function monthList(events, ref) {
    const set = new Set([ym(ref)]);
    events.forEach((e) => set.add(ym(e.date)));
    const all = [...set].sort();
    // 補齊中間沒有事件的月份，最多保留 4 個月
    const out = [], [y0, m0] = all[0].split("-").map(Number), [y1, m1] = all[all.length - 1].split("-").map(Number);
    for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (y++, (m = 1)) : m++) out.push(`${y}-${String(m).padStart(2, "0")}`);
    return out.slice(0, 4);
  }

  /** 新聞摘要轉成日曆事件（發布日、台北時間） */
  function newsEvents(list) {
    return (list || []).map((n) => {
      const t = F.dateTime(n.published_at);
      return { date: t.slice(0, 10), time: t.slice(11), event: n.summary, country: n.source, importance: "N", kind: "news",
               url: n.url, impact: n.impact, dimension: n.dimension, source_type: n.source_type };
    });
  }

  function evDetail(e) {
    const [lbl, cls] = U.imp(e.importance);
    if (e.kind === "news") {
      return `<li class="cd ${cls}"><div class="cd-top"><span class="cd-time">${F.esc(e.time)}</span>
        <span class="tag">${F.esc(e.country)}</span><span class="imp ${cls}">新聞</span><span class="tag">${F.esc(e.dimension)}</span>
        <span class="impact" data-impact="${F.esc(e.impact)}">影響：${F.esc(e.impact)}</span></div>
        <div class="cd-ev cd-news">${F.esc(e.event)}</div>
        <a href="${F.esc(e.url)}" target="_blank" rel="noopener noreferrer">原文連結</a></li>`;
    }
    const nums = [["前值", e.previous], ["預期", e.forecast], ["實際", e.actual]].filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k} <b>${F.esc(v)}</b>`).join("　");
    return `<li class="cd ${cls}"><div class="cd-top"><span class="cd-time">${e.time ? F.esc(e.time) : "全天／未定"}</span>
      <span class="tag">${F.esc(e.country)}</span><span class="imp ${cls}">${lbl}</span></div>
      <div class="cd-ev">${F.esc(e.event)}</div>${nums ? `<div class="cd-num">${nums}</div>` : ""}
      ${e.note ? `<div class="cd-note">${F.esc(e.note)}</div>` : ""}
      ${e.url ? `<a href="${F.esc(e.url)}" target="_blank" rel="noopener noreferrer">相關連結</a>` : ""}</li>`;
  }

  function dayPanel() {
    const evs = (st.byDate[st.sel] || []).slice().sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    $("cal-day").innerHTML = `<h3 class="sub">${F.md(st.sel)}（週${F.weekday(st.sel)}）${st.sel === st.ref ? " ‧ 今天" : st.sel > st.ref ? " ‧ " + U.countdown(st.sel, st.ref) : ""}</h3>` +
      (evs.length ? `<ul class="cd-list">${evs.map(evDetail).join("")}</ul>` : '<p class="note">這天沒有登錄事件。</p>');
  }

  function grid() {
    const month = st.months[st.mi], [y, m] = month.split("-").map(Number);
    const first = `${month}-01`, lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate(), soonEnd = F.addDays(st.ref, 7);
    let h = '<div class="cal-wd" aria-hidden="true">' + ["日", "一", "二", "三", "四", "五", "六"].map((d) => `<span>${d}</span>`).join("") + "</div><div class=\"cal-grid\">";
    for (let i = 0; i < lead; i++) h += '<span class="day blank"></span>';
    for (let d = 1; d <= days; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`, evs = (st.byDate[date] || []).slice().sort(sortEv);
      const cls = ["day", date === st.ref ? "today" : "", date > st.ref && date <= soonEnd ? "soon" : "", date < st.ref ? "past" : "", date === st.sel ? "sel" : "",
        evs.some((e) => e.importance === "H") ? "has-h" : ""].filter(Boolean).join(" ");
      const chips = evs.slice(0, 3).map((e) => `<span class="ev ${U.imp(e.importance)[1]}"><span class="dot" aria-hidden="true"></span><span class="ev-t">${F.esc(e.event)}</span></span>`).join("") +
        (evs.length > 3 ? `<span class="ev more">+${evs.length - 3}</span>` : "");
      const dots = evs.slice(0, 4).map((e) => `<span class="ev-dot ${U.imp(e.importance)[1]}"></span>`).join("");
      h += `<button type="button" class="${cls}" data-date="${date}" aria-label="${F.md(date)}，${evs.length ? evs.length + " 個事件" : "無事件"}"${date === st.sel ? ' aria-pressed="true"' : ""}>
        <span class="dn">${d}</span><span class="ev-list">${chips}</span><span class="ev-dots">${dots}</span></button>`;
    }
    $("cal-body").innerHTML = h + "</div>";
    $("cal-title").textContent = `${y} 年 ${m} 月`;
    $("cal-prev").disabled = st.mi === 0;
    $("cal-next").disabled = st.mi === st.months.length - 1;
    $("cal-body").querySelectorAll("button.day").forEach((b) => (b.onclick = () => select(b.dataset.date)));
    void first;
  }

  function list() {
    const from = F.addDays(st.ref, -3), evs = st.events.filter((e) => e.date >= from).sort(byTime);
    const groups = {};
    evs.forEach((e) => (groups[e.date] = groups[e.date] || []).push(e));
    $("cal-body").innerHTML = Object.keys(groups).sort().map((d) => `<div class="al ${d < st.ref ? "past" : ""}">
      <h3 class="al-h">${F.md(d)} 週${F.weekday(d)}<small>${d === st.ref ? "今天" : d > st.ref ? U.countdown(d, st.ref) : "已過"}</small></h3>
      <ul class="cd-list">${groups[d].sort((a, b) => (a.time || "99").localeCompare(b.time || "99")).map(evDetail).join("")}</ul></div>`).join("") ||
      '<p class="note">沒有登錄事件。</p>';
  }

  function paint() {
    const isGrid = st.view === "grid";
    $("cal-nav").hidden = !isGrid;
    $("cal-day").hidden = !isGrid;
    $("cal-view-grid").setAttribute("aria-pressed", String(isGrid));
    $("cal-view-list").setAttribute("aria-pressed", String(!isGrid));
    if (isGrid) { grid(); dayPanel(); } else list();
  }

  function select(date) {
    st.sel = date;
    const i = st.months.indexOf(ym(date));
    if (i >= 0) st.mi = i;
    paint();
  }

  /** 從別處（議程、鍵盤）跳到某天 */
  function focusDay(date) { if (st) { st.view = "grid"; select(date); } }

  function render(data) {
    const base = data.calendar || [], news = newsEvents(data.news), ref = WM.overview.refDate(data), sec = $("s-cal");
    const showNews = $("cal-news").checked;
    const events = showNews ? base.concat(news) : base;
    $("cal-empty").hidden = events.length > 0;
    $("cal-tools").hidden = !base.length && !news.length;
    if (!events.length) { $("cal-body").innerHTML = ""; $("cal-day").innerHTML = ""; $("cal-nav").hidden = true; $("cal-day").hidden = true; return; }
    const byDate = {};
    events.forEach((e) => (byDate[e.date] = byDate[e.date] || []).push(e));
    const months = monthList(events, ref);
    const upcoming = Object.keys(byDate).filter((d) => d >= ref).sort();
    const sel = upcoming[0] || Object.keys(byDate).sort().pop();
    const keep = st && st.keepFor === data ? st : null;  // 只切換「顯示新聞」時保留目前的檢視與選取日
    st = { events, byDate, ref, months, mi: Math.max(0, months.indexOf(ym(sel))), sel, view: "grid", keepFor: data };
    if (keep) { st.view = keep.view; if (byDate[keep.sel] || ym(keep.sel) in Object.fromEntries(months.map((m) => [m, 1]))) { st.sel = keep.sel; st.mi = Math.max(0, months.indexOf(ym(keep.sel))); } }
    $("cal-prev").onclick = () => { st.mi = Math.max(0, st.mi - 1); st.sel = `${st.months[st.mi]}-01` in st.byDate ? `${st.months[st.mi]}-01` : (Object.keys(st.byDate).filter((d) => ym(d) === st.months[st.mi]).sort()[0] || `${st.months[st.mi]}-01`); paint(); };
    $("cal-next").onclick = () => { st.mi = Math.min(st.months.length - 1, st.mi + 1); st.sel = Object.keys(st.byDate).filter((d) => ym(d) === st.months[st.mi]).sort()[0] || `${st.months[st.mi]}-01`; paint(); };
    $("cal-news").onchange = () => render(data);
    $("cal-view-grid").onclick = () => { st.view = "grid"; paint(); };
    $("cal-view-list").onclick = () => { st.view = "list"; paint(); };
    $("cal-ref").textContent = `${F.md(ref)}（資料更新日）`;
    paint();
    void sec;
  }

  WM.calendar = { render, focusDay };
})();
