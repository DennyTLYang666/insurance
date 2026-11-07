/* 「新聞」頁：保留最近 30 天、依主題標籤篩選、同事件合併（另有 N 家報導）、重點置頂；
   也負責概覽的「今日重點新聞」。資料由資料站 newsfeed.json 提供（只有標題、摘要、連結，點標題到原文）。 */
window.ECO = window.ECO || {};
(function () {
  const F = ECO.fmt, esc = F.esc;
  const RANGES = [[1, "今天"], [3, "3 天"], [7, "7 天"], [30, "30 天"]];
  const S = { doc: null, items: [], sel: new Set(), range: 3, q: "", hot: false, view: "list", cell: null, built: false, box: null };
  try {
    const v = JSON.parse(localStorage.getItem("eco.nf") || "{}");
    if (RANGES.some((r) => r[0] === v.range)) S.range = v.range;
    if (Array.isArray(v.sel)) v.sel.forEach((x) => S.sel.add(x));
    S.hot = !!v.hot;
    if (v.view === "cal") S.view = "cal";
  } catch (e) {}
  const save = () => { try { localStorage.setItem("eco.nf", JSON.stringify({ range: S.range, sel: Array.from(S.sel), hot: S.hot, view: S.view })); } catch (e) {} };

  const dayKey = (iso) => (iso || "").slice(0, 10);
  const todayKey = () => F.tpe(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
  const daysAgo = (n) => F.tpe(new Date(Date.now() - n * 864e5), { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
  const hhmm = (iso) => (iso || "").slice(11, 16);
  const dayLabel = (k) => k === todayKey() ? "今天" : k === daysAgo(1) ? "昨天" : F.md(k) + "（" + F.wd(k) + "）";
  const tname = (id) => { const t = (S.doc && S.doc.topics || []).find((x) => x.id === id); return t ? t.name : id; };

  const tagHtml = (id, on) => '<button type="button" class="ntag tg-' + esc(id) + (on ? " on" : "") + '" data-tag="' + esc(id) + '" title="只看「' + esc(tname(id)) + '」">' + esc(tname(id)) + "</button>";

  function itemHtml(it, withDay) {
    const also = (it.also || []).length ? '<details class="nalso"><summary>其他報導 ' + it.also.length + ' 則</summary><ul>' +
      it.also.map((a) => '<li><a href="' + esc(a.u) + '" target="_blank" rel="noopener noreferrer">' + esc(a.t) + '</a> <span class="mut">' + esc(a.s) + "</span></li>").join("") + "</ul></details>" : "";
    return '<li class="ni' + (it.hot ? " hot" : "") + '"><div class="nmeta">' +
      '<span class="nt">' + (withDay ? F.md(dayKey(it.d)) + " " : "") + esc(hhmm(it.d)) + "</span>" + (it.s ? '<span class="ns">' + esc(it.s) + "</span>" : "") +
      (it.tg || []).map((t) => tagHtml(t)).join("") + ((it.n || 1) > 1 ? '<span class="nn" title="同一事件有多家媒體報導">' + it.n + " 家報導</span>" : "") + "</div>" +
      '<a class="ntitle" href="' + esc(it.u) + '" target="_blank" rel="noopener noreferrer">' + (it.hot ? '<i class="star" title="重點">★</i> ' : "") + esc(it.t) + "</a>" +
      (it.sum ? '<p class="nsum">' + esc(it.sum) + "</p>" : "") + also + "</li>";
  }

  const byNew = (a, b) => (b.d || "").localeCompare(a.d || "") || (b.imp || 0) - (a.imp || 0);  // 一律新的在上
  const calDays = () => Math.min(30, Math.max(S.range, 7));  // 日曆檢視至少看 7 天
  function match(it, ignoreTopic) {
    if (dayKey(it.d) < daysAgo((S.view === "cal" ? calDays() : S.range) - 1)) return false;
    if (S.hot && !it.hot) return false;
    if (S.q && ((it.t || "") + " " + (it.sum || "") + " " + (it.s || "")).toLowerCase().indexOf(S.q) < 0) return false;
    if (!ignoreTopic && S.sel.size && !(it.tg || []).some((t) => S.sel.has(t))) return false;
    return true;
  }

  function build() {
    S.box.innerHTML =
      '<div class="nf-head"><h2>新聞</h2><span class="mut" data-n="info"></span></div>' +
      '<div class="ffilters nf-bar"><input type="search" data-n="q" placeholder="搜尋標題或摘要" aria-label="搜尋新聞">' +
      '<div class="seg" role="group" aria-label="時間範圍" data-n="range">' + RANGES.map((r) => '<button type="button" data-r="' + r[0] + '">' + r[1] + "</button>").join("") + "</div>" +
      '<label class="chk"><input type="checkbox" data-n="hot"> 只看重點</label>' +
      '<div class="seg" role="group" aria-label="檢視" data-n="view"><button type="button" data-v="list">列表</button><button type="button" data-v="cal">日曆（小時）</button></div></div>' +
      '<div class="tchips nf-chips" role="group" aria-label="主題標籤" data-n="chips"></div>' +
      '<div data-n="body"></div>' +
      '<p class="note">一則新聞若有多家媒體報導，只列一則並標示「N 家報導」；★ 重點是依「報導家數＋關鍵字（大跌、升息、新制…）」規則判斷，不是編輯精選。摘要只根據標題或來源提供的簡述；想看細節請點標題到原文。新聞只保留最近 30 天。</p>';
    const q = (k) => S.box.querySelector('[data-n="' + k + '"]');
    q("q").addEventListener("input", (e) => { S.q = e.target.value.trim().toLowerCase(); paint(); });
    q("hot").addEventListener("change", (e) => { S.hot = e.target.checked; save(); paint(); });
    q("range").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-r]");
      if (!b) return;
      S.range = +b.dataset.r; save(); paint();
    });
    q("view").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      S.view = b.dataset.v; save(); paint();
    });
    S.box.addEventListener("click", (e) => {
      const cell = e.target.closest("[data-cell]");
      if (cell) {
        const p = cell.dataset.cell.split("|");
        S.cell = { d: p[0], h: p[1] === "" ? null : +p[1] };
        paint();
        return;
      }
      const c = e.target.closest("[data-tag],[data-chip]");
      if (!c) return;
      const id = c.dataset.tag || c.dataset.chip;
      if (id === "*") S.sel.clear();
      else if (c.dataset.chip) { if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id); }
      else { S.sel.clear(); S.sel.add(id); }  // 點新聞上的標籤＝只看這個主題
      save(); paint();
      if (c.dataset.tag) window.scrollTo({ top: S.box.offsetTop, behavior: "smooth" });
    });
    S.built = true;
  }

  /* 日曆檢視：列＝日期、欄＝小時（台灣時間），格子＝該小時的新聞數，紅點＝有重點 */
  function calHtml(list) {
    const n = calDays(), days = [];
    for (let i = 0; i < n; i++) days.push(daysAgo(i));
    const g = {};
    list.forEach((it) => {
      const k = dayKey(it.d), h = +(it.d || "").slice(11, 13);
      const c = (g[k] = g[k] || { n: Array(24).fill(0), h: Array(24).fill(0), t: 0 });
      c.n[h]++; c.t++; if (it.hot) c.h[h]++;
    });
    if (!S.cell || days.indexOf(S.cell.d) < 0) { const first = days.find((k) => g[k]); S.cell = first ? { d: first, h: null } : null; }
    const lv = (x) => x === 0 ? 0 : x === 1 ? 1 : x <= 3 ? 2 : x <= 6 ? 3 : 4;
    let head = "<tr><th></th>"; for (let h = 0; h < 24; h++) head += "<th>" + h + "</th>"; head += "<th>合計</th></tr>";
    let rows = "";
    days.forEach((k) => {
      const c = g[k], on = S.cell && S.cell.d === k;
      rows += '<tr><th class="d' + (on && S.cell.h === null ? " sel" : "") + '" data-cell="' + k + '|" title="看這天全部"><button type="button">' + (k === todayKey() ? "今天" : F.md(k) + "（" + F.wd(k) + "）") + "</button></th>";
      for (let h = 0; h < 24; h++) {
        const x = c ? c.n[h] : 0, hot = c ? c.h[h] : 0;
        rows += x ? '<td class="c lv' + lv(x) + (hot ? " hot" : "") + (on && S.cell.h === h ? " sel" : "") + '" data-cell="' + k + "|" + h + '" title="' + h + ":00 — " + x + " 則" + (hot ? "（含 " + hot + " 則重點）" : "") + '"><button type="button">' + x + "</button></td>" : '<td class="c lv0"></td>';
      }
      rows += '<td class="tot">' + (c ? c.t : 0) + "</td></tr>";
    });
    let detail = "";
    if (S.cell) {
      const sel = list.filter((it) => dayKey(it.d) === S.cell.d && (S.cell.h === null || +(it.d || "").slice(11, 13) === S.cell.h)).sort(byNew);
      const title = dayLabel(S.cell.d) + (S.cell.h === null ? "" : " " + String(S.cell.h).padStart(2, "0") + ":00–" + String(S.cell.h).padStart(2, "0") + ":59");
      detail = '<section class="nf-day"><h3>' + esc(title) + ' <span class="mut">' + sel.length + ' 則</span></h3><ul class="nlist">' + sel.map((it) => itemHtml(it, false)).join("") + "</ul></section>";
    } else detail = '<p class="mut">這段期間、這些條件下沒有新聞。可以取消標籤或搜尋條件。</p>';
    return '<div class="ncal-wrap"><table class="ncal"><thead>' + head + "</thead><tbody>" + rows + '</tbody></table></div><p class="mut ncal-key">顏色越深＝該小時新聞越多；<i class="hotdot"></i> 紅點＝其中有重點。</p>' + detail;
  }

  function paint() {
    const q = (k) => S.box.querySelector('[data-n="' + k + '"]');
    q("hot").checked = S.hot;
    q("range").querySelectorAll("button").forEach((b) => b.classList.toggle("on", S.view === "list" && +b.dataset.r === S.range || S.view === "cal" && +b.dataset.r === calDays()));
    q("view").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.view));
    const topics = (S.doc && S.doc.topics) || [];
    const cnt = {};
    S.items.filter((it) => match(it, true)).forEach((it) => (it.tg || []).forEach((t) => (cnt[t] = (cnt[t] || 0) + 1)));
    q("chips").innerHTML = '<button type="button" data-chip="*"' + (S.sel.size ? "" : ' class="on"') + ">全部主題</button>" +
      topics.map((t) => '<button type="button" data-chip="' + esc(t.id) + '" class="ntag tg-' + esc(t.id) + (S.sel.has(t.id) ? " on" : "") + '">' + esc(t.name) + " <i>" + (cnt[t.id] || 0) + "</i></button>").join("");
    const list = S.items.filter((it) => match(it)).sort(byNew);
    if (S.view === "cal") { q("body").innerHTML = calHtml(list); q("info").textContent = "小時日曆（台灣時間）・最近 " + calDays() + " 天 " + list.length + " 則・點格子看該小時的新聞，點日期看整天"; return; }
    const top = S.hot ? [] : list.filter((it) => it.hot).slice(0, 6);  // 重點區也是新的在上
    const rest = list.filter((it) => top.indexOf(it) < 0);
    let html = "";
    if (top.length) html += '<section class="nf-top"><h3>重點 <span class="mut">這段期間最值得先看的 ' + top.length + " 則</span></h3><ul class=\"nlist\">" + top.map((it) => itemHtml(it, S.range > 1)).join("") + "</ul></section>";
    const days = [];
    rest.forEach((it) => { const k = dayKey(it.d); let g = days.find((x) => x.k === k); if (!g) days.push((g = { k: k, l: [] })); g.l.push(it); });
    days.forEach((g) => { html += '<section class="nf-day"><h3>' + esc(dayLabel(g.k)) + ' <span class="mut">' + g.l.length + " 則</span></h3><ul class=\"nlist\">" + g.l.map((it) => itemHtml(it, false)).join("") + "</ul></section>"; });
    if (!list.length) html = '<p class="mut">這段期間、這些條件下沒有新聞。可以放寬時間範圍或取消標籤。</p>';
    q("body").innerHTML = html;
    const upd = S.doc && S.doc.updated ? "更新於 " + F.tpe(new Date(S.doc.updated), { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + "・" : "";
    q("info").textContent = upd + "保留最近 " + ((S.doc && S.doc.retention_days) || 30) + " 天・目前顯示 " + list.length + " / " + S.items.length + " 則";
  }

  /* ---------- 概覽：今日重點新聞 ---------- */
  let digestN = 0;
  function digest() {
    const el = document.getElementById("ov-news");
    if (!el) return;
    let html = "";
    if (S.items.length) {
      const since = daysAgo(1);
      let l = S.items.filter((it) => it.hot && dayKey(it.d) >= since).sort(byNew).slice(0, 5);
      if (l.length < 3) l = S.items.filter((it) => dayKey(it.d) >= daysAgo(2)).sort((a, b) => (b.imp || 0) - (a.imp || 0) || byNew(a, b)).slice(0, 5).sort(byNew);
      digestN = l.length;
      html = '<ul class="news ndigest">' + l.map((it) => '<li><a href="' + esc(it.u) + '" target="_blank" rel="noopener noreferrer">' + (it.hot ? '<i class="star">★</i> ' : "") + esc(it.t) + '</a><span class="mut">' +
        esc([it.s, F.md(dayKey(it.d)) + " " + hhmm(it.d)].filter(Boolean).join("・")) + "</span>" + ((it.tg || []).length ? '<span class="nmeta">' + it.tg.map((t) => '<span class="ntag tg-' + esc(t) + '">' + esc(tname(t)) + "</span>").join("") + "</span>" : "") + "</li>").join("") + "</ul>";
    } else {
      const old = (ECO.news && ECO.news.market ? ECO.news.market() : []).slice(0, 5);  // 還沒有新聞彙整資料時，沿用舊的大盤新聞
      digestN = old.length;
      html = old.length ? '<ul class="news">' + old.map((it) => '<li><a href="' + esc(it.u) + '" target="_blank" rel="noopener noreferrer">' + esc(it.t) + '</a><span class="mut">' + esc([it.mk, it.s, ECO.news.when(it.d)].filter(Boolean).join("・")) + "</span></li>").join("") + "</ul>" : "";
    }
    el.innerHTML = html;
  }

  ECO.newsfeed = {
    hasDigest: () => digestN > 0,
    render: function (doc) {
      S.doc = doc || null;
      S.items = (doc && doc.items) || [];
      digest();
      S.box = document.getElementById("newspage");
      if (S.box) {
        if (!S.items.length) {
          S.built = false;
          S.box.innerHTML = '<section class="block"><h2>新聞</h2><p class="mut">新聞彙整還沒有資料。資料站更新（daily）一次之後就會出現；也可以到資料站 Actions 手動執行。</p></section>';
        } else {
          if (!S.built) build();
          paint();
        }
      }
      if (ECO.overviewRepaint) ECO.overviewRepaint();
    }
  };
})();
