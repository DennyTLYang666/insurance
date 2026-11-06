/* 基金頁：南山基金、台壽基金（風險階梯、各階層推薦、異動、全部基金表）與基金共同（各類別概況與參考指數）。 */
window.ECO = window.ECO || {};
(function () {
  const F = ECO.fmt, esc = F.esc, $ = (id) => document.getElementById(id);
  const CO = { tlife: "台灣人壽", nanshan: "南山人壽" };
  const SITE = { tlife: "https://178.taiwanlife.com/w/html/select.djhtm", nanshan: "https://ilp.nanshanlife.com.tw/w/select.djhtm" };
  const TYPES = { A: "國內基金", B: "境外基金", C: "ETF", D: "委託投資帳戶", E: "資金停泊", G: "其他", H: "其他" };
  const def = () => ({ q: "", tier: "", grp: "", theme: "", ty: "", cc: "", shMin: "", shMax: "", sdMin: "", sdMax: "", y1Min: "", y1Max: "", sort: "y1", asc: false, limit: 60 });
  const S = { doc: null, uni: {}, flt: { tlife: def(), nanshan: def() }, th: {}, gr: {}, scrollTo: null, loading: {} };
  const grpLabel = (id) => (S.gr[id] && S.gr[id].name) || id;

  const ret = (v, d) => v == null ? '<b class="flat">—</b>' : '<b class="' + F.dir(v) + '">' + F.sign(v, d == null ? 1 : d, "%") + "</b>";
  const rr = (n) => '<span class="rr rr' + (n || 0) + '" title="官網風險報酬等級（RR1 最低、RR5 最高）">' + (n ? "RR" + n : "RR—") + "</span>";
  const themeLabel = (id) => (S.th[id] && S.th[id].label) || id;
  const typeGroup = (ty) => ty === "A" || ty === "B" ? "fund" : ty === "C" ? "etf" : ty === "D" || ty === "E" ? "acct" : "other";

  /* ---------- 基金卡片 ---------- */
  function card(c, co) {
    const stats = [["近 1 年", ret(c.y1)], ["近 3 年", ret(c.y3)], ["夏普值", c.sh == null ? "—" : F.num(c.sh, 2)],
      ["年化波動", c.sd == null ? "—" : F.num(c.sd, c.sd < 1 ? 2 : 1) + "%"], ["規模", c.sz ? F.num(c.sz, 0) + " 億" : "—"]];
    const hist = c.hist && c.hist.length > 2 ? '<div class="fhist" title="每次更新累積的淨值走勢，從 ' + esc(F.md(c.hist_from)) + ' 開始">' + F.spark(c.hist, 90, 24) + '<span class="mut">追蹤中</span></div>' : "";
    return '<article class="fcard"><header>' + rr(c.rr) + '<span class="chip g' + esc(c.grp || "") + '" title="大分類：' + esc(grpLabel(c.grp)) + '">' + esc(grpLabel(c.grp).split("｜").pop()) + '</span><span class="chip">' + esc(c.themeLabel) + '</span><span class="mut">' + esc(c.cc || "") + (c.dv ? "・" + esc(c.dv) : "") + "</span></header>" +
      '<h4 class="fname">' + esc(c.n) + "</h4>" +
      '<div class="fnav">淨值 <b>' + F.num(c.nav, c.nav >= 100 ? 2 : 4) + '</b> <span class="chg ' + F.dir(c.d1) + '">' + (c.d1 == null ? "" : F.sign(c.d1, 2, "%")) + '</span> <span class="mut">' + esc(F.md((c.dt || "").replace(/\//g, "-"))) + "</span></div>" +
      '<dl class="fstats">' + stats.map((s) => "<div><dt>" + s[0] + "</dt><dd>" + s[1] + "</dd></div>").join("") + "</dl>" + hist +
      '<p class="why">' + esc(c.why || "") + "</p>" +
      '<footer><button type="button" data-gq="' + esc(c.n) + '" data-title="' + esc(c.n) + '">新聞</button>' +
      '<button type="button" data-news="t:' + esc(c.theme) + '" data-title="' + esc(c.themeLabel) + ' 類別">類別大勢</button>' +
      '<button type="button" data-fund="' + co + "|" + esc(c.k) + '">明細</button></footer></article>';
  }

  /* ---------- 公司頁 ---------- */
  function companyPanel(co) {
    const d = S.doc, comp = d.companies[co], box = $("fund-" + co);
    if (!comp) { box.innerHTML = '<section class="block"><p class="mut">' + CO[co] + "的基金資料這次沒有抓到，會在下一次排程更新時補上。</p></section>"; return; }
    const max = Math.max.apply(null, d.tiers.map((t) => comp.counts[t.id] || 0).concat([1]));
    const ladder = d.tiers.map((t) => '<button type="button" class="step t' + t.id + '" data-scroll="ft-' + co + "-" + t.id + '"><span class="tn">' + esc(t.name) + '</span><span class="ts">' + esc(t.sub) + '</span><span class="tb"><i style="width:' + Math.max(6, (comp.counts[t.id] || 0) / max * 100) + '%"></i></span><span class="tc">' + (comp.counts[t.id] || 0) + " 檔</span></button>").join("");
    let html = '<section class="block fhead"><div><h2>' + CO[co] + ' 投資標的</h2><p class="mut">官網資料日期 ' + esc(F.md(comp.asof || "")) + "・共 " + comp.count + " 檔（含不同幣別與配息級別）・" +
      ECO.news.link(SITE[co], "官網基金快搜") + '</p></div><p class="note">' + esc(d.note) + "</p></section>" +
      '<section class="block"><h2>風險階梯：由高風險到貨幣型</h2><p class="mut">把所有標的依性質分成 6 個階層，下面每層各挑 2–3 檔參考。點階層可跳到該層。</p><div class="ladder">' + ladder + "</div></section>";
    html += '<section class="block"><h2>依大分類看</h2><p class="mut">先看大分類，再點小分類直接篩選下方的全部標的。</p><div class="gblocks">' + d.groups.map((g) => {
      const n = (comp.gcounts || {})[g.id] || 0;
      if (!n) return "";
      const chips = g.themes.filter((t) => (comp.tcounts || {})[t]).map((t) => '<button type="button" class="tchip" data-gfilter="' + co + "|" + g.id + "|" + t + '">' + esc(themeLabel(t)) + " <b>" + comp.tcounts[t] + "</b></button>").join("");
      return '<div class="gblock g' + g.id + '"><div class="gh"><button type="button" class="linkish" data-gfilter="' + co + "|" + g.id + '|"><b>' + esc(g.name) + "</b></button><span class=\"mut\">" + n + " 檔</span></div><p class=\"mut\">" + esc(g.sub) + '</p><div class="tchips">' + chips + "</div></div>";
    }).join("") + "</div></section>";
    d.tiers.forEach((t) => {
      const ps = comp.picks[String(t.id)] || [];
      html += '<section class="block tier t' + t.id + '" id="ft-' + co + "-" + t.id + '"><header><h2><span class="tno">' + t.id + "</span>" + esc(t.name) + '<small>' + esc(t.sub) + "</small></h2>" +
        '<p class="mut">' + esc(t.hint) + "・此階層共 " + (comp.counts[t.id] || 0) + ' 檔 <button type="button" class="linkish" data-tierfilter="' + co + "|" + t.id + '">看全部 ›</button></p></header>' +
        (ps.length ? '<div class="fcards">' + ps.map((c) => card(c, co)).join("") + "</div>" : '<p class="mut">這個階層目前沒有符合條件的基金（需成立滿 3 年、有績效與風險數字、規模不太小）。</p>') + "</section>";
    });
    if (comp.watch && comp.watch.length) html += '<section class="block"><h2>我的追蹤清單</h2><div class="fcards">' + comp.watch.map((c) => card(c, co)).join("") + "</div></section>";
    const ch = comp.changes || [];
    html += '<section class="block"><h2>近期異動</h2>' + (ch.length ? '<ul class="chg-list">' + ch.slice(0, 20).map((x) => '<li><span class="chip ' + (x.type === "新增" ? "new" : "gone") + '">' + x.type + '</span> ' + esc(x.n) + ' <span class="mut">' + esc(F.md(x.date)) + "</span></li>").join("") + "</ul>"
      : '<p class="mut">最近沒有偵測到新增或下架的標的（每次更新都會和上一次比對）。</p>') + "</section>";
    html += '<section class="block" id="ftable-' + co + '"><h2>全部標的</h2><div id="ft-body-' + co + '"><p class="mut">載入中…</p></div></section>';
    box.innerHTML = html;
    drawTable(co);
  }

  /* ---------- 全部標的表 ---------- */
  const COLS = [["n", "名稱", 0], ["theme", "類別", 0], ["rr", "風險", 1, "hide-s"], ["cc", "幣別", 0, "hide-s"], ["nav", "淨值", 1, "hide-s"], ["d1", "日", 1, "hide-s"], ["m1", "1 月", 1, "hide-s"],
    ["m3", "3 月", 1], ["y1", "1 年", 1], ["y3", "3 年", 1, "hide-s"], ["sd", "波動", 1, "hide-s"], ["sh", "夏普", 1, "hide-s"], ["sz", "規模(億)", 1, "hide-s"]];

  function toObj(cols, r) { const o = {}; cols.forEach((c, i) => (o[c] = r[i])); return o; }

  function drawTable(co, onlyRes) {
    const body = $("ft-body-" + co);
    if (!body) return;
    const u = S.uni[co];
    if (!u) { body.innerHTML = S.loading[co] === "err" ? '<p class="mut">全部標的清單載入失敗，稍後重新整理再試。</p>' : '<p class="mut">載入中…</p>'; return; }
    const f = S.flt[co], ix = {};
    u.cols.forEach((c, i) => (ix[c] = i));
    const rng = (v, lo, hi) => (lo === "" && hi === "") || (v != null && (lo === "" || v >= +lo) && (hi === "" || v <= +hi));
    let rows = u.rows.filter((r) => {
      if (f.tier && String(r[ix.tier]) !== f.tier) return false;
      if (f.grp && r[ix.grp] !== f.grp) return false;
      if (f.theme && r[ix.theme] !== f.theme) return false;
      if (f.ty && typeGroup(r[ix.ty]) !== f.ty) return false;
      if (f.cc && r[ix.cc] !== f.cc) return false;
      if (!rng(r[ix.sh], f.shMin, f.shMax) || !rng(r[ix.sd], f.sdMin, f.sdMax) || !rng(r[ix.y1], f.y1Min, f.y1Max)) return false;
      if (f.q) { const q = f.q.toLowerCase(); if ((r[ix.n] + " " + r[ix.k] + " " + (r[ix.inv] || "")).toLowerCase().indexOf(q) < 0) return false; }
      return true;
    });
    const k = ix[f.sort], sg = f.asc ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const x = a[k], y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return typeof x === "string" ? sg * x.localeCompare(y, "zh-Hant") : sg * (x - y);
    });
    const themes = {}, ccs = {}, grps = {};
    u.rows.forEach((r) => {
      grps[r[ix.grp]] = (grps[r[ix.grp]] || 0) + 1;
      if (!f.grp || r[ix.grp] === f.grp) themes[r[ix.theme]] = (themes[r[ix.theme]] || 0) + 1;
      if (r[ix.cc]) ccs[r[ix.cc]] = (ccs[r[ix.cc]] || 0) + 1;
    });
    const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (cur === v ? " selected" : "") + ">" + esc(label) + "</option>";
    const gOpts = opt("", "全部大分類", f.grp) + S.doc.groups.filter((g) => grps[g.id]).map((g) => opt(g.id, g.name + "（" + grps[g.id] + "）", f.grp)).join("");
    const tOpts = opt("", "全部小分類", f.theme) + Object.keys(themes).sort((a, b) => ((S.th[a] || {}).tier || 9) - ((S.th[b] || {}).tier || 9) || themes[b] - themes[a]).map((t) => opt(t, themeLabel(t) + "（" + themes[t] + "）", f.theme)).join("");
    const tierOpts = opt("", "全部風險階層", f.tier) + S.doc.tiers.map((t) => opt(String(t.id), t.id + "．" + t.name, f.tier)).join("");
    const tyOpts = [["", "全部類型"], ["fund", "基金"], ["etf", "ETF"], ["acct", "委託帳戶／資金停泊"], ["other", "其他"]].map((o) => opt(o[0], o[1], f.ty)).join("");
    const ccOpts = opt("", "全部幣別", f.cc) + Object.keys(ccs).sort((a, b) => ccs[b] - ccs[a]).map((c) => opt(c, c + "（" + ccs[c] + "）", f.cc)).join("");
    const num2 = (k, ph) => '<input type="number" step="any" inputmode="decimal" data-f="' + k + '" placeholder="' + ph + '" value="' + esc(f[k]) + '" aria-label="' + ph + '">';
    const rangeRow = '<div class="ffilters rng" data-co="' + co + '"><label>夏普值 ' + num2("shMin", "最小") + "～" + num2("shMax", "最大") + "</label><label>年化波動 % " + num2("sdMin", "最小") + "～" + num2("sdMax", "最大") + "</label><label>近 1 年 % " + num2("y1Min", "最小") + "～" + num2("y1Max", "最大") + "</label></div>";
    const head = COLS.map((c) => '<th class="' + (c[2] ? "r " : "") + (c[3] || "") + '"><button type="button" data-sort="' + c[0] + '">' + c[1] + (f.sort === c[0] ? (f.asc ? " ▲" : " ▼") : "") + "</button></th>").join("");
    const shown = rows.slice(0, f.limit);
    const tr = shown.map((r) => {
      const o = toObj(u.cols, r);
      const cell = (v, d) => '<td class="r ' + F.dir(v) + '">' + (v == null ? "—" : F.sign(v, d, "%")) + "</td>";
      return "<tr><td class=\"nm\"><button type=\"button\" class=\"linkish\" data-fund=\"" + co + "|" + esc(o.k) + "\">" + esc(o.n) + "</button>" + (o.inv ? '<div class="mut">' + esc(o.inv) + "</div>" : "") + "</td><td>" + esc(themeLabel(o.theme)) + '<div class="mut">' + esc(grpLabel(o.grp).split("｜").pop()) + "</div></td><td class=\"r hide-s\">" + (o.rr ? "RR" + o.rr : "—") + '</td><td class="hide-s">' + esc(o.cc || "") +
        '</td><td class="r hide-s">' + F.num(o.nav, 2) + "</td>" + cell(o.d1, 2).replace('class="r', 'class="r hide-s') + cell(o.m1, 1).replace('class="r', 'class="r hide-s') + cell(o.m3, 1) + cell(o.y1, 1) + cell(o.y3, 1).replace('class="r', 'class="r hide-s') +
        '<td class="r hide-s">' + (o.sd == null ? "—" : F.num(o.sd, 1) + "%") + '</td><td class="r hide-s">' + (o.sh == null ? "—" : F.num(o.sh, 2)) + '</td><td class="r hide-s">' + (o.sz == null ? "—" : F.num(o.sz, 0)) + "</td></tr>";
    }).join("");
    const top = '<div class="ffilters" data-co="' + co + '"><input type="search" data-f="q" placeholder="搜尋名稱、代碼、投信" value="' + esc(f.q) + '" aria-label="搜尋基金"><select data-f="grp" aria-label="大分類">' + gOpts + '</select><select data-f="theme" aria-label="小分類">' + tOpts + '</select><select data-f="tier" aria-label="風險階層">' + tierOpts + '</select><select data-f="cc" aria-label="幣別">' + ccOpts + '</select><select data-f="ty" aria-label="類型">' + tyOpts + '</select><button type="button" data-reset="' + co + '">清除條件</button></div>' + rangeRow;
    const res = '<p class="mut">符合 ' + rows.length + " 檔・報酬為官網公布的累積報酬率，點名稱看明細與新聞</p>" +
      '<div class="tablewrap"><table class="mtable ftable"><thead><tr>' + head + "</tr></thead><tbody>" + (tr || '<tr><td colspan="13" class="mut">沒有符合的標的。</td></tr>') + "</tbody></table></div>" +
      (rows.length > shown.length ? '<button type="button" class="more-btn" data-more="' + co + '">再顯示 60 筆（還有 ' + (rows.length - shown.length) + " 筆）</button>" : "");
    /* 輸入框打字時只重畫結果，不動篩選列：整列重畫會讓游標跳回開頭（打 10 變 01） */
    const fres = onlyRes && body.querySelector(".fres");
    if (fres) { fres.innerHTML = res; return; }
    body.innerHTML = '<div class="ftop">' + top + '</div><div class="fres">' + res + "</div>";
  }

  function loadUni(co) {
    if (S.uni[co] || S.loading[co] === "run") return;
    S.loading[co] = "run";
    ECO.load("data/site/funds_" + co + ".json").then((d) => { S.uni[co] = d; S.loading[co] = "ok"; drawTable(co); scrollPending(); })
      .catch(() => { S.loading[co] = "err"; drawTable(co); });
  }

  /* ---------- 明細視窗 ---------- */
  function detail(co, key) {
    const u = S.uni[co];
    let o = null;
    if (u) { const r = u.rows.find((x) => x[0] === key); if (r) o = toObj(u.cols, r); }
    if (!o) {
      const comp = S.doc.companies[co] || {};
      const all = Object.keys(comp.picks || {}).reduce((a, k) => a.concat(comp.picks[k]), []).concat(comp.watch || []);
      const c = all.find((x) => x.k === key);
      if (c) o = Object.assign({}, c, { theme: c.theme });
    }
    if (!o) return;
    const rows = [["大分類", esc(grpLabel(o.grp || (S.th[o.theme] || {}).grp))], ["小分類", esc(themeLabel(o.theme)) + "（第 " + (o.tier || (S.th[o.theme] || {}).tier || "—") + " 階層）"], ["風險等級", o.rr ? "RR" + o.rr : "—"], ["幣別／配息", esc((o.cc || "—") + (o.dv ? "・" + o.dv : ""))],
      ["類型", esc(TYPES[o.ty] || "其他")], ["淨值", F.num(o.nav, 4) + (o.d1 == null ? "" : "　" + F.sign(o.d1, 2, "%"))], ["近 1 月", ret(o.m1)], ["近 3 月", ret(o.m3)], ["近 1 年", ret(o.y1)], ["近 3 年", ret(o.y3)],
      ["年化波動", o.sd == null ? "—" : F.num(o.sd, 2) + "%"], ["夏普值", o.sh == null ? "—" : F.num(o.sh, 2)], ["規模", o.sz == null ? "—" : F.num(o.sz, 1) + " 億"]];
    const snippet = JSON.stringify({ co: co, k: key });
    ECO.dialog.open(o.n, '<dl class="dgrid">' + rows.map((r) => "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>").join("") + "</dl>" +
      '<p class="links">' + ECO.news.link(ECO.news.gUrl(o.n), "Google 新聞：基金名稱") + " " + ECO.news.link("https://www.google.com/search?q=" + encodeURIComponent(o.n + " 基金 配息 績效"), "Google 搜尋") + " " + ECO.news.link(SITE[co], CO[co] + "官網基金快搜") + "</p>" +
      '<p class="mut">要長期追蹤這檔：把下面這段加進 <code>config/fund_watch.json</code> 的 <code>watch</code> 清單，之後每次更新都會累積淨值走勢。</p>' +
      '<div class="copy"><code>' + esc(snippet) + '</code><button type="button" data-copy="' + esc(snippet) + '">複製</button></div>' +
      '<p class="mut">資料為官網公布的數字整理，報酬不代表未來表現，不是投資建議。</p>');
  }

  /* ---------- 基金共同 ---------- */
  function gtone(g) { return '<span class="chip g' + esc(g) + '">' + esc(grpLabel(g)) + "</span>"; }

  function commonPanel() {
    const d = S.doc, box = $("fund-common");
    let html = '<section class="block"><h2>各大分類大勢：基金分類 × 參考指數</h2><p class="mut">先看六個大分類的整體走勢（各類代理 ETF 等權重合成），往下再看每個大分類裡的小分類。代理 ETF 例如新興市場 EEM、拉丁美洲 ILF、貴重金屬 GDX；數字是統計與參考，不是某檔基金的績效。</p>' +
      '<div class="toolbar"><div class="seg" role="group" aria-label="圖表區間"><button type="button" data-days="22">1 個月</button><button type="button" data-days="66">3 個月</button><button type="button" data-days="252">1 年</button></div><span class="hint">點圖例可隱藏／顯示，右上角可全選／全消。</span></div>' +
      '<div id="fcommon-chart" class="charts one"></div><div class="gsum">' + d.groups.map(groupSum).join("") + "</div></section>";
    d.groups.forEach((g) => {
      const ts = d.themes.filter((t) => t.grp === g.id);
      if (!ts.length) return;
      html += '<section class="block gsec g' + g.id + '" id="fg-' + g.id + '"><header><h2>' + esc(g.name) + "<small>" + esc(g.sub) + "</small></h2>" +
        '<p class="mut">' + g.count.total + " 檔（南山 " + (g.count.nanshan || 0) + "・台壽 " + (g.count.tlife || 0) + "）・同類 1 年中位 " + ret(g.med.y1) + "</p></header>" +
        '<div id="fgc-' + g.id + '" class="charts one short"></div><div class="tcards">' + ts.map(themeCard).join("") + "</div></section>";
    });
    box.innerHTML = html;
    drawCommonChart();
    d.groups.forEach((g) => drawGroupChart(g));
  }

  function groupSum(g) {
    const i = g.idx;
    return '<button type="button" class="gsm g' + g.id + '" data-scroll="fg-' + g.id + '"><b>' + esc(g.name) + '</b><span class="mut">' + g.count.total + " 檔</span>" +
      (i ? '<span class="chg ' + F.dir(i.m1) + '">月 ' + F.sign(i.m1, 1, "%") + '</span><span class="chg ' + F.dir(i.m3) + '">季 ' + F.sign(i.m3, 1, "%") + "</span>" : "") + "</button>";
  }

  function themeCard(t) {
    const i = t.idx, series = i && S.doc.idx.series[i.id];
    const m = t.med || {};
    const spark = series ? F.spark(series.filter((v) => v != null).slice(-60), 84, 26) : "";
    const idx = i ? '<div class="tidx"><div><span class="mut">參考指數</span> <b>' + esc(i.name) + '</b></div><div class="tidx-v"><span class="chg ' + F.dir(i.chg) + '">' + F.sign(i.chg, 2, "%") + "</span>" +
      '<span class="mut">月 ' + ret(i.m1) + " 季 " + ret(i.m3) + "</span>" + spark + "</div></div>" : '<div class="tidx mut">沒有對應的參考指數</div>';
    const top = (t.top || []).map((f) => '<li><span class="chip">' + f.co.map((c) => CO[c].slice(0, 2)).join("・") + "</span> " + esc(f.n) + " " + ret(f.y1) + "</li>").join("");
    const c = t.count || {};
    return '<article class="tcard"><header><h3>' + esc(t.label) + '</h3><span class="mut">' + c.total + " 檔（南山 " + (c.nanshan || 0) + "・台壽 " + (c.tlife || 0) + ")</span></header>" +
      '<dl class="fstats"><div><dt>同類 1 月中位</dt><dd>' + ret(m.m1) + "</dd></div><div><dt>3 月中位</dt><dd>" + ret(m.m3) + "</dd></div><div><dt>1 年中位</dt><dd>" + ret(m.y1) + "</dd></div></dl>" + idx +
      (top ? '<p class="mut tl">近 1 年報酬較高</p><ul class="tops">' + top + "</ul>" : "") +
      '<footer><button type="button" data-news="t:' + esc(t.id) + '" data-title="' + esc(t.label) + '類別" data-yq="' + esc((i && i.ticker) || "") + '">新聞</button>' +
      '<button type="button" data-goto="nanshan|' + esc(t.id) + '"' + (c.nanshan ? "" : " disabled") + ">南山 " + (c.nanshan || 0) + ' 檔</button><button type="button" data-goto="tlife|' + esc(t.id) + '"' + (c.tlife ? "" : " disabled") + ">台壽 " + (c.tlife || 0) + " 檔</button></footer></article>";
  }

  function drawCommonChart() {
    const box = $("fcommon-chart"), d = S.doc;
    const gs = d.groups.filter((g) => g.idx && d.idx.series[g.idx.id]);
    if (!box || !gs.length) { if (box) box.innerHTML = '<p class="mut">參考指數資料還沒有，等下一次排程更新。</p>'; return; }
    ECO.charts.clear(box);
    ECO.charts.add(box, { id: "fgroups", mode: "index", title: "六大分類走勢（等權重合成）", note: "起點設為 100；用代理 ETF 看資產大勢，僅供參考",
      dates: d.idx.dates, series: gs.map((g) => ({ id: g.idx.id, name: g.name, short: g.name, values: d.idx.series[g.idx.id], nk: "g:" + g.id, q: g.name + " 基金 市場" })) });
  }

  function drawGroupChart(g) {
    const box = $("fgc-" + g.id), d = S.doc;
    if (!box) return;
    const seen = {}, series = [];
    d.themes.filter((t) => t.grp === g.id && t.idx && d.idx.series[t.idx.id]).forEach((t) => {
      if (seen[t.idx.id]) return;
      seen[t.idx.id] = 1;
      series.push({ id: t.idx.id, name: t.label + "（" + t.idx.ticker + "）", short: t.label, values: d.idx.series[t.idx.id], nk: "t:" + t.id, yq: t.idx.ticker });
    });
    ECO.charts.clear(box);
    if (series.length < 1) { box.innerHTML = ""; return; }
    ECO.charts.add(box, { id: "fgrp-" + g.id, mode: "index", title: g.name + "：各小分類參考指數", note: "起點設為 100", dates: d.idx.dates, series: series });
  }

  /* ---------- 對外 ---------- */
  function scrollPending() {
    if (!S.scrollTo) return;
    const el = $(S.scrollTo);
    if (el) { S.scrollTo = null; el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  ECO.funds = {
    render: function (doc) {
      S.doc = doc;
      const empty = $("funds-empty");
      empty.hidden = !!doc;
      if (!doc) {
        empty.innerHTML = "<h2>基金資料還沒有產生</h2><p>基金清單會在每日更新時抓取。請到 GitHub 的 Actions 手動執行一次「更新市場資料並發布」（mode 選 daily），或在本機執行 <code>python -m pipeline.run --mode daily</code>。</p>";
        ["nanshan", "tlife", "common"].forEach((k) => ($("fund-" + k).innerHTML = ""));
        return;
      }
      S.th = {};
      doc.themes.forEach((t) => (S.th[t.id] = t));
      S.gr = {};
      doc.groups.forEach((g) => (S.gr[g.id] = g));
      ECO.trendIndex = ECO.trendIndex || {};
      doc.themes.forEach((t) => { if (t.idx) ECO.trendIndex[t.idx.id] = { href: "#funds/common", chart: "fgrp-" + t.grp, src: "funds" }; });
      companyPanel("nanshan");
      companyPanel("tlife");
      commonPanel();
      document.querySelectorAll("[data-days]").forEach((b) => b.classList.toggle("on", +b.dataset.days === ECO.charts.days()));
    },
    show: function (sub) {
      if (!S.doc) return;
      if (sub === "nanshan" || sub === "tlife") loadUni(sub);
      setTimeout(scrollPending, 50);
    }
  };

  document.addEventListener("click", (e) => {
    const page = $("page-funds");
    if (!page || !page.contains(e.target) && !$("dlg").contains(e.target)) return;
    const t = e.target;
    let b;
    if ((b = t.closest("[data-sort]"))) {
      const co = b.closest(".sub-panel").dataset.sub, f = S.flt[co], k = b.dataset.sort;
      S.flt[co] = Object.assign(f, { sort: k, asc: f.sort === k ? !f.asc : k === "n" || k === "theme" || k === "sd" });
      drawTable(co);
    } else if ((b = t.closest("[data-more]"))) { S.flt[b.dataset.more].limit += 60; drawTable(b.dataset.more); }
    else if ((b = t.closest("[data-reset]"))) { S.flt[b.dataset.reset] = def(); drawTable(b.dataset.reset); }
    else if ((b = t.closest("[data-scroll]"))) { const el = $(b.dataset.scroll); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if ((b = t.closest("[data-gfilter]"))) { const [co, g, th] = b.dataset.gfilter.split("|"); S.flt[co] = Object.assign(def(), { grp: g, theme: th || "" }); S.scrollTo = "ftable-" + co; drawTable(co); scrollPending(); }
    else if ((b = t.closest("[data-tierfilter]"))) { const [co, tier] = b.dataset.tierfilter.split("|"); S.flt[co] = Object.assign(def(), { tier: tier }); S.scrollTo = "ftable-" + co; drawTable(co); scrollPending(); }
    else if ((b = t.closest("[data-goto]"))) { const [co, theme] = b.dataset.goto.split("|"); S.flt[co] = Object.assign(def(), { theme: theme }); S.scrollTo = "ftable-" + co; location.hash = "#funds/" + co; if (S.uni[co]) drawTable(co); }
    else if ((b = t.closest("[data-fund]"))) { const [co, key] = b.dataset.fund.split("|"); detail(co, key); }
    else if ((b = t.closest("[data-copy]"))) {
      const txt = b.dataset.copy;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => (b.textContent = "已複製"), () => (b.textContent = "請手動選取複製"));
    }
  });
  const timers = {};
  const onFilter = (e) => {
    const el = e.target.closest("[data-f]");
    if (!el) return;
    const co = el.closest(".ffilters").dataset.co;
    const isInput = el.tagName === "INPUT";
    if (el.closest(".rng")) el.setAttribute("value", el.value);
    S.flt[co][el.dataset.f] = el.value;
    S.flt[co].limit = 60;
    if (el.dataset.f === "grp" && S.flt[co].theme && (S.th[S.flt[co].theme] || {}).grp !== el.value && el.value) S.flt[co].theme = "";
    if (!isInput) { drawTable(co); return; }
    clearTimeout(timers[co]);
    timers[co] = setTimeout(() => drawTable(co, true), 180);
  };
  document.addEventListener("input", (e) => { if (e.target.matches('input[data-f]')) onFilter(e); });
  document.addEventListener("change", (e) => { if (e.target.matches("select[data-f]")) onFilter(e); });
})();
