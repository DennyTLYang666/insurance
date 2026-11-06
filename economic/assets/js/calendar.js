/* 日曆／列表兩種檢視的共用元件（行事曆、概覽的「接下來要注意」、市場新聞都用它），
   以及事件狀態：已過期變暗、今天強調、已公佈、待公佈（2 小時內／更早）、30 分鐘內倒數。 */
window.ECO = window.ECO || {};
(function () {
  const F = ECO.fmt, esc = F.esc;
  const TZ = "+08:00"; // 事件時間一律是台灣時間
  const pad = (n) => (n < 10 ? "0" : "") + n;
  const iso = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
  const today = () => F.tpe(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
  const evMs = (e) => (e.time ? Date.parse(e.date + "T" + e.time + ":00" + TZ) : null);

  /* ---------- 事件狀態 ---------- */
  ECO.evStatus = function (e, now) {
    now = now || Date.now();
    const td = today(), done = !!e.actual;
    if (e.date < td) return { k: "past", dim: true, label: done ? "已公佈" : "已過期" };
    if (e.date > td) return { k: "future", label: "待公佈" };
    if (done) return { k: "done", label: "已公佈", today: true }; // 已公佈：當天不當成過期
    const t = evMs(e);
    if (t == null) return { k: "wait", label: "今日待公佈", today: true };
    const diff = t - now;
    if (diff > 0 && diff <= 30 * 60e3) return { k: "cd", label: "倒數", cd: t, today: true };
    if (Math.abs(diff) <= 120 * 60e3) return { k: "soon", label: "待公佈・2 小時內", today: true };
    if (diff > 0) return { k: "wait", label: "待公佈", today: true };
    return { k: "old", label: "待公佈・更早", dim: true, today: true };
  };

  function cdText(t) {
    const s = Math.max(0, Math.round((t - Date.now()) / 1000));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }

  ECO.eventsHtml = function (list) {
    const now = Date.now();
    return list.map((e) => {
      const st = ECO.evStatus(e, now);
      const res = e.actual ? "公布 " + esc(e.actual) + (e.forecast ? "（預期 " + esc(e.forecast) + "）" : "")
        : [e.forecast ? "預期 " + esc(e.forecast) : "", e.previous ? "前值 " + esc(e.previous) : ""].filter(Boolean).join("・");
      const badge = st.k === "cd" ? '<span class="stb cd">倒數 <b data-cd="' + st.cd + '">' + cdText(st.cd) + "</b></span>"
        : '<span class="stb ' + st.k + '">' + esc(st.label) + "</span>";
      const isToday = e.date === today();
      return '<li class="ev-row s-' + st.k + (st.dim ? " dim" : "") + (isToday ? " is-today" : "") + '"><div class="when"><b>' + (isToday ? "今天" : F.md(e.date)) + "</b><span>" +
        (isToday ? F.md(e.date) + " " : "（" + F.wd(e.date) + "）") + esc(e.time || "") + "</span></div>" +
        '<div class="what"><span class="cty">' + esc(e.country) + "</span> " + (e.importance === "H" ? '<span class="imp" title="重要事件">★</span> ' : "") + esc(e.event) + " " + badge +
        (res ? '<div class="res">' + res + "</div>" : "") + (e.note ? '<div class="res">' + esc(e.note) + "</div>" : "") + "</div></li>";
    }).join("");
  };

  /* ---------- 共用的日曆／列表元件 ---------- */
  const CALS = {};

  function Cal(o) {
    this.o = o;
    this.view = o.defView;
    try { const v = localStorage.getItem("eco.cal." + o.box); if (v === "grid" || v === "list") this.view = v; } catch (e) {}
    this.sort = o.sorts[0][0];
    try { const s = localStorage.getItem("eco.calsort." + o.box); if (o.sorts.some((x) => x[0] === s)) this.sort = s; } catch (e) {}
    this.all = false;
    this.ym = null;
    this.sel = null;
    CALS[o.box] = this;
  }

  Cal.prototype = {
    items() { return this.o.items(this); },
    map() { const m = {}; this.items().forEach((e) => (m[e.date] = m[e.date] || []).push(e)); return m; },
    grid(map) {
      const t = today(), [y, m] = this.ym, lead = new Date(Date.UTC(y, m, 1)).getUTCDay(), n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      let cells = "";
      for (let i = 0; i < lead; i++) cells += '<div class="cell blank"></div>';
      for (let d = 1; d <= n; d++) {
        const k = iso(y, m, d), ev = map[k] || [];
        const chips = ev.slice(0, 3).map((e) => this.o.chip(e)).join("") + (ev.length > 3 ? '<span class="more">+' + (ev.length - 3) + "</span>" : "");
        const dots = ev.length ? '<span class="dots' + (this.o.hot && ev.some(this.o.hot) ? " h" : "") + '">' + ev.length + "</span>" : "";
        cells += '<button type="button" class="cell' + (k === t ? " today" : k < t ? " past" : "") + (k === this.sel ? " sel" : "") + (ev.length ? " has" : "") + '" data-d="' + k + '" aria-label="' + (m + 1) + "月" + d + "日" + (ev.length ? "，" + ev.length + this.o.unit : "") + '">' +
          '<span class="dn">' + d + "</span>" + chips + dots + "</button>";
      }
      const head = ["日", "一", "二", "三", "四", "五", "六"].map((w) => "<span>" + w + "</span>").join("");
      return '<div class="calnav"><button type="button" data-nav="-1" aria-label="上個月">‹</button><b>' + y + " 年 " + (m + 1) + ' 月</b><button type="button" data-nav="1" aria-label="下個月">›</button>' +
        '<button type="button" class="today-btn" data-nav="0">今天</button></div><div class="calgrid"><div class="wd">' + head + "</div>" + cells + "</div>";
    },
    draw() {
      const box = document.getElementById(this.o.box);
      if (!box) return;
      const o = this.o, map = this.map();
      const bar = '<div class="calbar" data-cal="' + o.box + '"><div class="seg" role="group" aria-label="檢視方式"><button type="button" data-view="grid"' + (this.view === "grid" ? ' class="on"' : "") + '>日曆</button><button type="button" data-view="list"' +
        (this.view === "list" ? ' class="on"' : "") + ">列表</button></div>" +
        (this.view === "list" && o.sorts.length > 1 ? '<label class="sortsel">排序 <select data-sort aria-label="排序">' + o.sorts.map((s) => '<option value="' + s[0] + '"' + (this.sort === s[0] ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select></label>" : "") +
        (o.minor ? '<label class="chk"><input type="checkbox" data-all' + (this.all ? " checked" : "") + "> 同時顯示次要事件</label>" : "") + "</div>";
      let body;
      if (this.view === "grid") {
        if (!this.ym) { const t = today(); this.ym = [+t.slice(0, 4), +t.slice(5, 7) - 1]; }
        if (!this.sel) this.sel = this.firstDay(map);
        const ev = map[this.sel] || [];
        body = this.grid(map) + '<div class="caldetail"><h4>' + F.md(this.sel) + "（" + F.wd(this.sel) + "）" + (this.sel === today() ? " 今天" : "") + "</h4>" +
          (ev.length ? o.day(ev) : '<p class="mut">這天沒有' + o.noun + "。</p>") + "</div>";
      } else {
        const list = o.sortFn(o.listItems ? o.listItems(this.items()) : this.items(), this.sort);
        body = list.length ? o.list(list) : '<p class="mut">這段期間沒有' + o.noun + "。</p>";
      }
      box.innerHTML = bar + body;
    },
    firstDay(map) {
      const t = today(), days = Object.keys(map).sort();
      return map[t] ? t : days.find((d) => d >= t) || t;
    },
    set(list) { this.src = list || []; if (this.o.onset) this.o.onset(this); this.draw(); }
  };

  document.addEventListener("click", (e) => {
    const box = e.target.closest("[data-calbox]");
    if (!box) return;
    const c = CALS[box.dataset.calbox];
    if (!c) return;
    const v = e.target.closest("[data-view]"), nav = e.target.closest("[data-nav]"), cell = e.target.closest(".cell[data-d]");
    if (v) { c.view = v.dataset.view; try { localStorage.setItem("eco.cal." + c.o.box, c.view); } catch (x) {} c.draw(); }
    else if (nav) {
      const k = +nav.dataset.nav;
      if (k === 0) { const t = today(); c.ym = [+t.slice(0, 4), +t.slice(5, 7) - 1]; c.sel = t; }
      else { const d = new Date(Date.UTC(c.ym[0], c.ym[1] + k, 1)); c.ym = [d.getUTCFullYear(), d.getUTCMonth()]; }
      c.draw();
    } else if (cell) { c.sel = cell.dataset.d; c.draw(); }
  });
  document.addEventListener("change", (e) => {
    const box = e.target.closest("[data-calbox]");
    const c = box && CALS[box.dataset.calbox];
    if (!c) return;
    if (e.target.matches("[data-all]")) { c.all = e.target.checked; Object.keys(CALS).forEach((k) => { if (CALS[k].o.minor) { CALS[k].all = c.all; CALS[k].draw(); } }); }
    else if (e.target.matches("[data-sort]")) { c.sort = e.target.value; try { localStorage.setItem("eco.calsort." + c.o.box, c.sort); } catch (x) {} c.draw(); }
  });

  /* ---------- 三個實例 ---------- */
  const impRank = (e) => (e.importance === "H" ? 0 : e.importance === "M" ? 1 : 2);
  const evSort = (list, k) => {
    const a = list.slice(), byT = (x, y) => (x.date + (x.time || "99:99")).localeCompare(y.date + (y.time || "99:99"));
    if (k === "imp") a.sort((x, y) => impRank(x) - impRank(y) || byT(x, y));
    else if (k === "new") a.sort((x, y) => byT(y, x));
    else a.sort(byT);
    return a;
  };
  const evChip = (e) => {
    const st = ECO.evStatus(e);
    return '<span class="ev ' + (e.importance === "H" ? "h" : "m") + " s-" + st.k + (st.dim ? " dim" : "") + '" title="' + esc((e.time || "") + " " + e.country + e.event + "・" + st.label) + '">' +
      (st.k === "cd" ? "⏱ " : st.k === "done" || (st.k === "past" && e.actual) ? "✓ " : "") + esc((e.time ? e.time + " " : "") + e.event) + "</span>";
  };
  const wrap = (cal, html) => '<div data-calbox="' + cal + '">' + html + "</div>";
  const evBase = {
    unit: "個事件", noun: "事件", chip: evChip, hot: (e) => e.importance === "H",
    day: (ev) => '<ul class="events">' + ECO.eventsHtml(evSort(ev, "time")) + "</ul>",
    list: (l) => '<ul class="events">' + ECO.eventsHtml(l) + "</ul>", sortFn: evSort
  };
  const sortsEv = [["time", "依時間（近→遠）"], ["imp", "依重要性"], ["new", "依時間（遠→近）"]];

  const trendCal = new Cal(Object.assign({}, evBase, {
    box: "cal", defView: "grid", minor: true, sorts: sortsEv,
    items: (c) => (c.src || []).filter((e) => c.all || e.importance === "H")
  }));
  const ovCal = new Cal(Object.assign({}, evBase, {
    box: "ov-events", defView: "list", minor: true, sorts: sortsEv,
    items: (c) => (c.src || []).filter((e) => c.all || e.importance === "H"),
    listItems: (l) => {
      const t = today(), lim = F.tpe(new Date(Date.now() + 14 * 864e5), { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
      return l.filter((e) => e.date >= t && e.date <= lim);
    }
  }));

  /* 市場新聞：日曆看每天有幾則，列表可依時間或來源排序 */
  const nDay = (n) => (n.d || "").slice(0, 10);
  const newsHtml = (l) => '<ul class="news">' + l.map((it) => '<li><a href="' + esc(it.u) + '" target="_blank" rel="noopener noreferrer">' + esc(it.t) + '</a><span class="mut">' +
    esc([it.mk, it.s, ECO.news.when(it.d)].filter(Boolean).join("・")) + "</span></li>").join("") + "</ul>";
  const newsCal = new Cal({
    box: "ov-news", defView: "list", minor: false, unit: "則新聞", noun: "新聞", sorts: [["new", "最新優先"], ["src", "依來源"], ["mk", "依市場"]],
    items: (c) => (c.src || []).filter((n) => nDay(n)).map((n) => Object.assign({}, n, { date: nDay(n) })),
    listItems: () => newsCal.src || [],
    chip: (n) => '<span class="ev m" title="' + esc(n.t) + '">' + esc(n.t) + "</span>",
    day: newsHtml, list: newsHtml,
    sortFn: (l, k) => {
      const a = l.slice(), t = (x) => x.d || "";
      if (k === "src") a.sort((x, y) => (x.s || "").localeCompare(y.s || "", "zh-Hant") || t(y).localeCompare(t(x)));
      else if (k === "mk") a.sort((x, y) => (x.mk || "").localeCompare(y.mk || "", "zh-Hant") || t(y).localeCompare(t(x)));
      else a.sort((x, y) => t(y).localeCompare(t(x)));
      return a;
    }
  });
  // 日曆格裡也要包 data-calbox：覆寫 draw 把整個容器包起來
  [trendCal, ovCal, newsCal].forEach((c) => {
    const draw = c.draw;
    c.draw = function () { draw.call(this); const box = document.getElementById(this.o.box); if (box) box.setAttribute("data-calbox", this.o.box); };
  });

  ECO.calendar = {
    render: function (list) {
      document.getElementById("cal-block").hidden = !(list || []).length;
      trendCal.set(list);
      ovCal.set(list);
    },
    renderNews: function (items) { newsCal.set(items); }
  };

  /* ---------- 倒數與狀態自動更新 ---------- */
  let last = Date.now();
  setInterval(() => {
    const els = document.querySelectorAll("[data-cd]");
    let expired = false;
    els.forEach((el) => {
      const t = +el.dataset.cd;
      if (t - Date.now() <= 0) expired = true;
      el.textContent = cdText(t);
    });
    if (expired || Date.now() - last > 30000) { last = Date.now(); [trendCal, ovCal].forEach((c) => c.src && c.draw()); }
  }, 1000);
})();
