/* 日曆／列表兩種檢視的共用元件（「日曆」頁、概覽的「接下來要注意」都用它），
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

  /* 分類與標籤：分類用實心小標、其餘標籤用淡色；經濟以外的事件加底線樣式區隔 */
  const tagsHtml = (e) => !e.cat ? "" : '<span class="evtags"><span class="ctg' + (e.scope === "other" ? " oth" : "") + '">' + esc(e.catn || e.cat) + "</span>" +
    (e.tags || []).map((t) => '<span class="tg">' + esc(t) + "</span>").join("") + "</span>";

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
        '<div class="what">' + (e.country ? '<span class="cty">' + esc(e.country) + "</span> " : "") + (e.importance === "H" ? '<span class="imp" title="重要事件">★</span> ' : "") + esc(e.event) + " " + badge + tagsHtml(e) +
        (res ? '<div class="res">' + res + "</div>" : "") + (e.why ? '<div class="res why">' + esc(e.why) + "</div>" : "") + (e.note ? '<div class="res">' + esc(e.note) + "</div>" : "") + "</div></li>";
    }).join("");
  };

  /* ---------- 篩選（每個實例各自一份）：重要度、分類、國家。這裡只放財經事件，電競／體育等一律不顯示 ---------- */
  const econ = (e) => e.scope !== "other";
  const passImp = (e, f) => econ(e) && (f.all || e.importance === "H");
  const pass = (e, f) => passImp(e, f) && (!f.cats.length || f.cats.indexOf(e.cat) >= 0) && (!f.cty.length || f.cty.indexOf(e.country) >= 0);
  const redrawAll = () => Object.keys(CALS).forEach((k) => CALS[k].draw());

  /* ---------- 共用的日曆／列表元件 ---------- */
  const CALS = {};

  function Cal(o) {
    this.o = o;
    this.view = o.defView;
    try { const v = localStorage.getItem("eco.cal." + o.box); if (v === "grid" || v === "list") this.view = v; } catch (e) {}
    this.sort = o.sorts[0][0];
    try { const s = localStorage.getItem("eco.calsort." + o.box); if (o.sorts.some((x) => x[0] === s)) this.sort = s; } catch (e) {}
    this.f = { all: !!o.allDefault, cats: [], cty: [] };
    try { const v = localStorage.getItem("eco.cal.all." + o.box); if (v === "1" || v === "0") this.f.all = v === "1"; } catch (e) {}
    this.pastOpen = false;
    this.ym = null;
    this.sel = null;
    CALS[o.box] = this;
  }

  Cal.prototype = {
    items() { return (this.src || []).filter((e) => pass(e, this.f)); },
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
        (o.allDefault ? '<label class="chk"><input type="checkbox" data-imp' + (this.f.all ? "" : " checked") + "> 只看重要事件（★）</label>"
          : '<label class="chk"><input type="checkbox" data-all' + (this.f.all ? " checked" : "") + "> 同時顯示次要事件</label>") + "</div>" +
        (o.chips ? this.ctyChips() + this.chips() : "");
      let body;
      if (this.view === "grid") {
        if (!this.ym) { const t = today(); this.ym = [+t.slice(0, 4), +t.slice(5, 7) - 1]; }
        if (!this.sel) this.sel = this.firstDay(map);
        const ev = map[this.sel] || [];
        body = this.grid(map) + '<div class="caldetail"><h4>' + F.md(this.sel) + "（" + F.wd(this.sel) + "）" + (this.sel === today() ? " 今天" : "") + "</h4>" +
          (ev.length ? o.day(ev) : '<p class="mut">這天沒有' + o.noun + "。</p>") + "</div>";
      } else {
        const list = o.sortFn(o.listItems ? o.listItems(this.items()) : this.items(), this.sort);
        if (o.collapsePast) {  // 今天以前（昨天及更早）的事件收成一個摺疊區；依時間由早到晚排時放最上面，其餘排序放最下面
          const t = today(), past = list.filter((e) => e.date < t), rest = list.filter((e) => e.date >= t);
          const det = past.length ? '<details class="pastev" data-past' + (this.pastOpen ? " open" : "") + "><summary>已過去的事件（昨天及更早）" + past.length + " 個</summary>" + o.list(past) + "</details>" : "";
          const main = rest.length ? o.list(rest) : '<p class="mut">今天起沒有' + o.noun + "。</p>";
          body = this.sort === "time" ? det + main : main + det;
        } else body = list.length ? o.list(list) : '<p class="mut">這段期間沒有' + o.noun + "。</p>";
      }
      box.innerHTML = bar + body;
    },
    chips() {
      const m = {}, order = [], f = this.f;
      (this.src || []).filter((e) => passImp(e, f) && (!f.cty.length || f.cty.indexOf(e.country) >= 0)).forEach((e) => {
        if (!e.cat) return;
        if (!m[e.cat]) { m[e.cat] = { n: 0, name: e.catn || e.cat }; order.push(e.cat); }
        m[e.cat].n++;
      });
      if (order.length < 2) return "";
      order.sort((a, b) => m[b].n - m[a].n);
      return '<div class="catchips" role="group" aria-label="依分類篩選"><button type="button" data-cat=""' + (f.cats.length ? "" : ' class="on"') + ">全部分類</button>" +
        order.map((c) => '<button type="button" data-cat="' + esc(c) + '"' + (f.cats.indexOf(c) >= 0 ? ' class="on"' : "") + ">" + esc(m[c].name) + " <i>" + m[c].n + "</i></button>").join("") + "</div>";
    },
    ctyChips() {
      const m = {}, f = this.f;
      (this.src || []).filter((e) => passImp(e, f) && (!f.cats.length || f.cats.indexOf(e.cat) >= 0)).forEach((e) => { if (e.country) m[e.country] = (m[e.country] || 0) + 1; });
      const order = Object.keys(m).sort((a, b) => m[b] - m[a]);
      if (order.length < 2) return "";
      return '<div class="catchips ctychips" role="group" aria-label="依國家篩選"><button type="button" data-cty=""' + (f.cty.length ? "" : ' class="on"') + ">全部國家</button>" +
        order.map((c) => '<button type="button" data-cty="' + esc(c) + '"' + (f.cty.indexOf(c) >= 0 ? ' class="on"' : "") + ">" + esc(c) + " <i>" + m[c] + "</i></button>").join("") + "</div>";
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
    const v = e.target.closest("[data-view]"), nav = e.target.closest("[data-nav]"), cell = e.target.closest(".cell[data-d]"), cat = e.target.closest("[data-cat]"), cty = e.target.closest("[data-cty]");
    const toggle = (arr, k) => (!k ? [] : arr.indexOf(k) >= 0 ? arr.filter((x) => x !== k) : arr.concat(k));
    if (cat) { c.f.cats = toggle(c.f.cats, cat.dataset.cat); c.sel = null; c.draw(); }
    else if (cty) { c.f.cty = toggle(c.f.cty, cty.dataset.cty); c.sel = null; c.draw(); }
    else if (v) { c.view = v.dataset.view; try { localStorage.setItem("eco.cal." + c.o.box, c.view); } catch (x) {} c.draw(); }
    else if (nav) {
      const k = +nav.dataset.nav;
      if (k === 0) { const t = today(); c.ym = [+t.slice(0, 4), +t.slice(5, 7) - 1]; c.sel = t; }
      else { const d = new Date(Date.UTC(c.ym[0], c.ym[1] + k, 1)); c.ym = [d.getUTCFullYear(), d.getUTCMonth()]; }
      c.draw();
    } else if (cell) { c.sel = cell.dataset.d; c.draw(); }
  });
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches || !d.matches("details[data-past]")) return;
    const box = d.closest("[data-calbox]"), c = box && CALS[box.dataset.calbox];
    if (c) c.pastOpen = d.open;
  }, true);
  document.addEventListener("change", (e) => {
    const box = e.target.closest("[data-calbox]");
    const c = box && CALS[box.dataset.calbox];
    if (!c) return;
    const setAll = (v) => { c.f.all = v; c.sel = null; try { localStorage.setItem("eco.cal.all." + c.o.box, v ? "1" : "0"); } catch (x) {} c.draw(); };
    if (e.target.matches("[data-all]")) setAll(e.target.checked);
    else if (e.target.matches("[data-imp]")) setAll(!e.target.checked);
    else if (e.target.matches("[data-sort]")) { c.sort = e.target.value; try { localStorage.setItem("eco.calsort." + c.o.box, c.sort); } catch (x) {} c.draw(); }
  });

  /* ---------- 兩個實例 ---------- */
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
  const sortsEv = [["time", "依時間（早→晚）"], ["imp", "依重要性"], ["new", "依時間（晚→早）"]];

  const trendCal = new Cal(Object.assign({}, evBase, {
    box: "cal", defView: "grid", allDefault: true, collapsePast: true, sorts: sortsEv, chips: true
  }));
  const ovCal = new Cal(Object.assign({}, evBase, {
    box: "ov-events", defView: "list", sorts: sortsEv,
    listItems: (l) => {
      const t = today(), lim = F.tpe(new Date(Date.now() + 14 * 864e5), { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
      return l.filter((e) => e.date >= t && e.date <= lim);
    }
  }));

  // 日曆格裡也要包 data-calbox：覆寫 draw 把整個容器包起來
  [trendCal, ovCal].forEach((c) => {
    const draw = c.draw;
    c.draw = function () { draw.call(this); const box = document.getElementById(this.o.box); if (box) box.setAttribute("data-calbox", this.o.box); };
  });

  ECO.calendar = {
    render: function (list) {
      document.getElementById("cal-block").hidden = !(list || []).length;
      trendCal.set(list);
      ovCal.set(list);
    }
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
