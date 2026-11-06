/* 趨勢頁：分類折線圖（含殖利率曲線）、全球市場表、總經數據、宏觀環境。行事曆在 calendar.js。 */
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

  /* ---------- 全球市場表 ---------- */
  const COLS = [["name", "市場", false], ["value", "最新", true], ["chg", "日", true], ["w1", "週", true], ["m1", "月", true], ["from_high", "距近一年高點", true]];

  function table(ov) {
    const th = COLS.map((c) => '<th class="' + (c[2] ? "r " : "") + (S.sort.key === c[0] ? "sorted" : "") + '"><button type="button" data-k="' + c[0] + '">' + c[1] +
      (S.sort.key === c[0] ? (S.sort.asc ? " ▲" : " ▼") : "") + "</button></th>").join("") + '<th class="r hide-s">走勢</th>';
    let body = "";
    ov.groups.forEach((g) => {
      const rows = g.tiles.slice();
      if (S.sort.key) {
        const k = S.sort.key, sg = S.sort.asc ? 1 : -1;
        rows.sort((a, b) => k === "name" ? sg * a.name.localeCompare(b.name, "zh-Hant") : sg * (((a[k] == null ? -Infinity : a[k])) - ((b[k] == null ? -Infinity : b[k]))));
      }
      body += '<tr class="grp"><td colspan="' + (COLS.length + 1) + '">' + esc(g.name) + "</td></tr>";
      rows.forEach((t) => {
        const cell = (v) => v == null ? '<td class="r">—</td>' : '<td class="r ' + F.dir(v) + '">' + F.chg(t, v) + "</td>";
        body += "<tr" + (t.stale ? ' class="stale"' : "") + '><td class="nm"><button type="button" class="linkish" data-news="' + esc(t.id) + '" data-title="' + esc(t.name) + '" data-yq="' + esc(t.yq || "") + '" title="看新聞">' + esc(t.name) + "</button>" + (t.stale ? ' <span class="badge warn">舊資料</span>' : t.show_date ? ' <span class="badge">' + F.md(t.date) + "</span>" : "") +
          '</td><td class="r">' + F.num(t.value, t.dec) + (t.kind === "rate" ? "%" : "") + "</td>" + cell(t.chg) + cell(t.w1) + cell(t.m1) +
          (t.from_high == null ? '<td class="r">—</td>' : '<td class="r ' + F.dir(t.from_high) + '">' + F.sign(t.from_high, 1, "%") + "</td>") +
          '<td class="r hide-s">' + F.spark(t.spark, 64, 22) + "</td></tr>";
      });
    });
    const el = document.getElementById("mtable");
    el.innerHTML = "<thead><tr>" + th + "</tr></thead><tbody>" + body + "</tbody>";
    el.querySelectorAll("th button").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k;
      S.sort = { key: k, asc: S.sort.key === k ? !S.sort.asc : k === "name" };
      table(ov);
    }));
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

  function macro(list) {
    S.macro = list;
    document.getElementById("macro-block").hidden = !list.length;
    const bar = '<div class="macbar"><div class="seg" role="group" aria-label="排序">' + MSORTS.map((s) => '<button type="button" data-msort="' + s[0] + '"' + (msort === s[0] ? ' class="on"' : "") + ">" + s[1] + "</button>").join("") + "</div>" +
      '<p class="hint">好壞是和前一期比：通膨、失業、初領救濟金下降算好；就業、銷售、信心、GDP 上升算好；變動很小算持平。規則式判斷，不是預測。</p></div>';
    const unit = (m) => m.unit === "%" ? "%" : " " + m.unit;
    const cards = macroSorted(list).map((m) => {
      const fmt = (v) => m.kind === "chg" ? F.sign(v, m.dec, "") + " " + m.unit : F.num(v, m.dec) + unit(m);
      const d = m.value - m.prev;
      const vd = m.good ? '<span class="vd ' + VD[m.verdict] + '" title="和前一期相比">' + m.verdict + "</span>" : "";
      const nxt = m.next ? '<div class="next">下次公布 ' + F.md(m.next.date) + "（" + F.wd(m.next.date) + "）" + esc(m.next.time) + "</div>" : "";
      return '<article class="mac"><div class="mh"><div class="nm">' + esc(m.name) + "</div>" + vd + '</div><div class="val">' + fmt(m.value) + '</div><div class="prev">前期 ' + fmt(m.prev) +
        ' <span class="mut">' + (d > 0 ? "▲" : d < 0 ? "▼" : "–") + "</span> ・ " + esc(m.weekly ? F.md(m.asof) + " 當週" : m.period) + "</div>" + nxt +
        (m.history && m.history.length > 2 ? '<div class="hist">' + F.spark(m.history, 120, 28) + "</div>" : "") + "</article>";
    }).join("");
    document.getElementById("macro").innerHTML = bar + '<div class="macgrid">' + cards + "</div>";
  }

  document.addEventListener("click", (e) => {
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
    table(d.overview);
    macro(d.macro);
    lights(d.lights);
    ECO.calendar.render(d.calendar);
    document.querySelectorAll("[data-days]").forEach((b) => b.classList.toggle("on", +b.dataset.days === ECO.charts.days()));
  };
})();
