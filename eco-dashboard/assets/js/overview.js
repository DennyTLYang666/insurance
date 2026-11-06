/* 概覽頁：氣氛、今日重點、全市場方塊、接下來要注意。 */
(function () {
  const F = ECO.fmt, esc = F.esc;
  const LEVELS = ["樂觀", "平穩", "謹慎", "緊張", "恐慌"];

  function hero(ov) {
    const m = ov.mood;
    const gauge = LEVELS.map((_, i) => '<i class="seg' + (i <= m.level ? " on" : "") + '"></i>').join("");
    const why = (m.why || []).map((w) => '<span class="chip">' + esc(w) + "</span>").join("");
    return '<div class="mood lv' + m.level + '">' +
      '<div class="mood-k">今日氣氛</div>' +
      '<div class="mood-v">' + esc(m.label) + "</div>" +
      '<div class="gauge" aria-hidden="true">' + gauge + "</div>" +
      '<div class="chips">' + why + "</div>" +
      '<p class="rule">' + esc(m.rule) + "</p></div>" +
      pointsBlock(ov.highlights || []);
  }

  /* 今日重點：預設只顯示「值得第一眼看到」的（hot），至少 3 則、最多 6 則；其餘收合，可展開 */
  const MIN_SHOWN = 3, MAX_SHOWN = 6;
  let hlOpen = false;
  try { hlOpen = localStorage.getItem("eco.hl") === "1"; } catch (e) {}
  function pointsBlock(list) {
    if (!list.length) return "";
    const hasFlag = list.some((h) => "hot" in h);
    const keep = new Set(hasFlag ? list.filter((h) => h.hot).slice(0, MAX_SHOWN) : list);
    list.forEach((h) => { if (keep.size < MIN_SHOWN) keep.add(h); });
    const rest = list.length - keep.size;
    return '<div class="points' + (hlOpen ? " open" : "") + '"><h2>今日重點</h2><ul>' + highlights(list, keep) + "</ul>" +
      (rest > 0 ? '<button type="button" class="hl-more" data-hl aria-expanded="' + hlOpen + '">' + (hlOpen ? "收起次要重點" : "還有 " + rest + " 則次要重點 ▾") + "</button>" : "") + "</div>";
  }

  function highlights(list, keep) {
    return list.map((h) => '<li' + (keep && !keep.has(h) ? ' class="rest"' : "") + '><a class="tag" href="' + esc(h.link || "#") + '" title="看' + esc(h.tag) + '的趨勢圖">' + esc(h.tag) + "</a><span>" + esc(h.text) + "</span></li>").join("");
  }

  /* 每組的排序：依績效（日漲跌，預設）或依預設順序 */
  const TREND = { us: "#trends/stocks", ai: "#trends/stocks", asia: "#trends/stocks", twd: "#trends/fx", twd_c: "#trends/fx", fx: "#trends/fx", rates: "#trends/rates", risk: "#trends/risk", cmd: "#trends/cmd" };
  const gsort = {};
  try { Object.assign(gsort, JSON.parse(localStorage.getItem("eco.gsort") || "{}")); } catch (e) {}
  const gdefault = { rates: "def" };  // 各組預設排序（資料站 symbols.json 的 sort；美債殖利率預設依期限短→長）
  const sortOf = (g) => (gsort[g] || gdefault[g]) === "def" ? "def" : "perf";
  const sorted = (g) => sortOf(g.id) === "def" ? g.tiles : g.tiles.slice().sort((a, b) => (b.chg == null ? -Infinity : b.chg) - (a.chg == null ? -Infinity : a.chg));

  function tile(t) {
    const d = F.dir(t.chg);
    const sub = [];
    if (t.w1 != null) sub.push('<span>週 <b class="' + F.dir(t.w1) + '">' + F.chg(t, t.w1) + "</b></span>");
    if (t.m1 != null) sub.push('<span>月 <b class="' + F.dir(t.m1) + '">' + F.chg(t, t.m1) + "</b></span>");
    const unit = t.kind === "rate" ? "%" : "";
    const badge = t.stale ? '<span class="badge warn" title="' + esc(t.error || "資料較舊") + '">舊資料</span>'
      : t.show_date ? '<span class="badge" title="這一項的最新資料日期">' + F.md(t.date) + "</span>" : "";
    return '<button type="button" class="tile' + (t.stale ? " stale" : "") + '" title="' + esc(t.name) + '：點一下看新聞" data-news="' + esc(t.id) + '" data-title="' + esc(t.name) + '" data-yq="' + esc(t.yq || "") + '">' +
      '<div class="tile-h"><span class="nm">' + esc(t.short) + "</span>" + badge + '<span class="newsb" aria-hidden="true">新聞</span></div>' +
      '<div class="tile-v"><span class="val">' + F.num(t.value, t.dec) + unit + "</span>" +
      '<span class="chg ' + d + '"><i>' + F.arrow(t.chg) + "</i> " + F.chg(t, t.chg) + "</span></div>" +
      '<div class="tile-f"><div class="sub">' + sub.join("") + "</div>" + F.spark(t.spark, 64, 24) + "</div></button>";
  }

  const SUBS = { all: null, stocks: ["us", "ai", "asia"], fx: ["twd", "twd_c", "fx"], rates: ["rates", "risk"], cmd: ["cmd"], funds: ["f_dev", "f_em", "f_theme", "f_bond", "f_mix", "f_cash"] };
  const S = { ov: null, sub: "all" };
  const FUNDNOTE = "用各類基金對應的公開 ETF 當「大勢參考」，不是基金本身的淨值；基金頁的「基金共同」有更完整的分類比較。";

  function markets(ov) {
    const want = SUBS[S.sub];
    ov.groups.forEach((g) => { if (g.sort) gdefault[g.id] = g.sort; });
    const gs = ov.groups.filter((g) => !want || want.includes(g.id));
    return gs.map((g) => {
      const link = TREND[g.id] || (g.id.indexOf("f_") === 0 ? "#funds/common" : "");
      const sb = '<div class="gsort" role="group" aria-label="排序"><span class="mut">排序</span><button type="button" data-gsort="' + g.id + '|perf"' + (sortOf(g.id) === "perf" ? ' class="on"' : "") + '>依績效</button><button type="button" data-gsort="' + g.id + '|def"' + (sortOf(g.id) === "def" ? ' class="on"' : "") + ">依名稱</button></div>";
      return '<section class="group"><div class="gh"><h2>' + esc(g.name) + "</h2>" + (link ? '<a class="ext" href="' + link + '">看趨勢圖 ›</a>' : "") + sb + '</div>' +
        '<div class="tiles">' + sorted(g).map(tile).join("") + "</div></section>";
    }).join("") || '<p class="mut">這個分類目前沒有資料。</p>';
  }

  function subPoints(ov) {
    const hs = (ov.highlights || []).filter((h) => h.sub === S.sub);
    let html = pointsBlock(hs);
    if (S.sub === "funds") html += '<p class="note">' + FUNDNOTE + "</p>";
    return html;
  }

  function paint() {
    const ov = S.ov, all = S.sub === "all";
    if (!ov) return;
    const hero_ = document.getElementById("hero");
    hero_.hidden = false;
    hero_.className = all ? "hero" : "";
    hero_.innerHTML = all ? hero(ov) : subPoints(ov);
    document.getElementById("markets").innerHTML = markets(ov);
    document.getElementById("events-block").hidden = !all;
    document.getElementById("news-block").hidden = !all || !ECO.news.market().length;
    document.getElementById("ov-extra").hidden = !all;
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-hl]")) {
      hlOpen = !hlOpen;
      try { localStorage.setItem("eco.hl", hlOpen ? "1" : "0"); } catch (x) {}
      paint();
      return;
    }
    const b = e.target.closest("[data-gsort]");
    if (!b) return;
    const [g, k] = b.dataset.gsort.split("|");
    gsort[g] = k;
    try { localStorage.setItem("eco.gsort", JSON.stringify(gsort)); } catch (x) {}
    paint();
  });

  ECO.renderOverview = function (ov) {
    S.ov = ov;
    ECO.tiles = {};
    ov.groups.forEach((g) => g.tiles.forEach((t) => (ECO.tiles[t.id] = t)));
    paint();
  };
  ECO.overviewSub = function (sub) { S.sub = SUBS[sub] !== undefined ? sub : "all"; paint(); };
})();
