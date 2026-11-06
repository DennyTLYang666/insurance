/* 趨勢頁：分類折線圖（含殖利率曲線）、總經數據、宏觀環境。行事曆在 calendar.js；全市場表格在概覽的「表格」（table.js）。 */
(function () {
  const F = ECO.fmt, esc = F.esc;
  const S = { data: null, sort: { key: null, asc: false } };

  /* ---------- 折線圖（分到 股市／匯率／利率／商品） ---------- */
  const CATS = ["stocks", "fx", "rates", "risk", "cmd"];

  function renderCharts(trends) {
    CATS.forEach((cat) => {
      const box = document.getElementById("charts-" + cat);
      ECO.charts.clear(box);
      if (cat === "rates" && trends.curve && trends.curve.lines.length) {
        const cv = trends.curve, sp = Object.keys(cv.spreads || {}).map((k) => esc(k) + " " + F.sign(cv.spreads[k], 2, " pp") + (cv.spreads[k] < 0 ? "（倒掛）" : "")).join("；");
        ECO.charts.add(box, { id: "curve", type: "curve", mode: "level", unit: "pp", title: cv.title, note: cv.note, labels: cv.labels, lines: cv.lines, foot: sp ? "目前利差：" + sp : "" });
      }
      trends.charts.filter((c) => c.cat === cat).forEach((c) => ECO.charts.add(box, c));
      if (!box.children.length) box.innerHTML = '<p class="mut">這個分類的圖表還沒有資料，等下一次排程更新。</p>';
    });
  }

  /* ---------- 總經（三種排序：推薦順序、好到壞（預設）、剛更新到舊） ---------- */
  const MSORTS = [["good", "好到壞"], ["rec", "推薦順序"], ["new", "剛更新到舊"]];
  let msort = "good";
  try { const v = localStorage.getItem("eco.msort"); if (MSORTS.some((x) => x[0] === v)) msort = v; } catch (e) {}
  const VD = { "好": "good", "壞": "bad", "持平": "flat" };

  function macroSorted(list) {
    const a = list.slice();
    if (msort === "rec") a.sort((x, y) => x.rec - y.rec);
    else if (msort === "new") a.sort((x, y) => (y.asof || "").localeCompare(x.asof || "") || x.rec - y.rec);
    else a.sort((x, y) => y.score - x.score || x.rec - y.rec);
    return a;
  }

  const SRC = { fred: "FRED 官方序列", ndc: "國發會", cal: "行事曆公布值" };
  let mcountry = "all";
  try { const v = localStorage.getItem("eco.mcountry"); if (v) mcountry = v; } catch (e) {}

  function macroCard(m) {
    const unit = m.unit === "%" ? "%" : " " + m.unit;
    const src = '<span class="msrc" title="資料來源">' + SRC[m.src] + "</span>";
    const nxt = m.next ? '<div class="next">下次公布 ' + F.md(m.next.date) + "（" + F.wd(m.next.date) + "）" + esc(m.next.time) + "</div>" : "";
    if (m.empty) {
      return '<article class="mac empty"><div class="mh"><div class="nm">' + esc(m.name) + '</div></div><div class="val mut">—</div><div class="prev">' +
        (m.src === "cal" ? "尚未累積到公布值（每次更新會從行事曆記下）" : "來源暫時取不到，下次更新再試") + "</div>" + nxt + '<div class="msrcrow">' + src + "</div></article>";
    }
    const fmt = (v) => m.kind === "chg" ? F.sign(v, m.dec, "") + " " + m.unit : F.num(v, m.dec) + unit;
    const d = m.value - m.prev;
    const vd = m.good ? '<span class="vd ' + VD[m.verdict] + '" title="和前一期相比">' + m.verdict + "</span>" : "";
    return '<article class="mac"><div class="mh"><div class="nm">' + esc(m.name) + "</div>" + vd + '</div><div class="val">' + fmt(m.value) + '</div><div class="prev">前期 ' + fmt(m.prev) +
      ' <span class="mut">' + (d > 0 ? "▲" : d < 0 ? "▼" : "–") + "</span> ・ " + esc(m.weekly ? F.md(m.asof) + " 當週" : m.period) + "</div>" + nxt +
      (m.history && m.history.length > 2 ? '<div class="hist">' + F.spark(m.history, 120, 28) + "</div>" : "") + '<div class="msrcrow">' + src + "</div></article>";
  }

  function macro(list) {
    S.macro = list;
    document.getElementById("macro-block").hidden = !list.length;
    const countries = [];
    list.forEach((m) => { if (!countries.some((c) => c.id === m.country)) countries.push({ id: m.country, name: m.cname }); });
    if (mcountry !== "all" && !countries.some((c) => c.id === mcountry)) mcountry = "all";
    const cnt = (id) => list.filter((m) => m.country === id && !m.empty).length;
    const chips = '<div class="seg" role="group" aria-label="國家"><button type="button" data-mcountry="all"' + (mcountry === "all" ? ' class="on"' : "") + ">全部</button>" +
      countries.map((c) => '<button type="button" data-mcountry="' + c.id + '"' + (mcountry === c.id ? ' class="on"' : "") + ">" + esc(c.name) + "</button>").join("") + "</div>";
    const bar = '<div class="macbar">' + chips + '<div class="seg" role="group" aria-label="排序">' + MSORTS.map((s) => '<button type="button" data-msort="' + s[0] + '"' + (msort === s[0] ? ' class="on"' : "") + ">" + s[1] + "</button>").join("") + "</div></div>" +
      '<p class="hint">依國家分群，群內依所選排序。好壞是和前一期比：通膨、失業下降算好；就業、銷售、信心、GDP 上升算好；變動很小算持平。規則式判斷，不是預測。' +
      "歐／日／英／中部分指標由行事曆公布值逐次累積，剛開始會是空白卡。</p>";
    const groups = countries.filter((c) => mcountry === "all" || c.id === mcountry).map((c) => {
      const items = macroSorted(list.filter((m) => m.country === c.id));
      // 排序時空白卡一律放最後
      items.sort((x, y) => (x.empty ? 1 : 0) - (y.empty ? 1 : 0));
      return '<section class="macgroup" data-country="' + c.id + '"><h3>' + esc(c.name) + ' <span class="mut">' + cnt(c.id) + " / " + items.length + " 項有資料</span></h3>" +
        '<div class="macgrid">' + items.map(macroCard).join("") + "</div></section>";
    }).join("");
    document.getElementById("macro").innerHTML = bar + groups;
  }

  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-mcountry]");
    if (c) {
      mcountry = c.dataset.mcountry;
      try { localStorage.setItem("eco.mcountry", mcountry); } catch (x) {}
      macro(S.macro || []);
      return;
    }
    const b = e.target.closest("[data-msort]");
    if (!b) return;
    msort = b.dataset.msort;
    try { localStorage.setItem("eco.msort", msort); } catch (x) {}
    macro(S.macro || []);
  });

  /* ---------- 宏觀環境 ---------- */
  function lights(l) {
    const box = document.getElementById("lights-block");
    box.hidden = !l;
    if (!l) return;
    const fac = l.factors.map((f) => '<tr><td>' + esc(f.name) + '<div class="mut">' + esc(f.role) + '</div></td><td class="r">' + F.num(f.value, 2) +
      '</td><td class="r ' + (f.dir > 0 ? "up" : f.dir < 0 ? "down" : "flat") + '">' + (f.dir > 0 ? "上行 ▲" : f.dir < 0 ? "下行 ▼" : "盤整 –") +
      '</td><td class="r hide-s">' + F.sign(f.d20, 2, f.change === "pct" ? "%" : "") + "</td></tr>").join("");
    const prods = l.products.map((p) => '<span class="light ' + (p.label === "偏多" ? "up" : p.label === "偏空" ? "down" : "flat") + '"><b>' + esc(p.name) + "</b> " + p.label + "</span>").join("");
    document.getElementById("lights").innerHTML = '<div class="tablewrap"><table class="mtable"><thead><tr><th>因子</th><th class="r">最新</th><th class="r">20 日趨勢</th><th class="r hide-s">20 日變化</th></tr></thead><tbody>' + fac + "</tbody></table></div>" +
      '<div class="lights">' + prods + "</div><p class=\"note\">" + esc(l.note) + "</p>";
  }

  /* ---------- 對外 ---------- */
  ECO.renderTrends = function (d) {
    S.data = d;
    ECO.trendIndex = ECO.trendIndex || {};
    Object.keys(ECO.trendIndex).forEach((k) => { if (ECO.trendIndex[k].src === "trends") delete ECO.trendIndex[k]; });
    d.trends.charts.forEach((c) => c.series.forEach((s) => { if (!ECO.trendIndex[s.id]) ECO.trendIndex[s.id] = { href: "#trends/" + c.cat, chart: c.id, src: "trends" }; }));
    renderCharts(d.trends);
    macro(d.macro);
    lights(d.lights);
    ECO.calendar.render(d.calendar);
    document.querySelectorAll("[data-days]").forEach((b) => b.classList.toggle("on", +b.dataset.days === ECO.charts.days()));
  };
})();
