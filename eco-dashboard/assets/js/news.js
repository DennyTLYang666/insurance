/* 新聞與彈出視窗：點標的／圖例／基金，看最新標題（pipeline 預先抓好）並連到原文，另附 Google 新聞與 Yahoo 財經的搜尋連結。 */
window.ECO = window.ECO || {};
(function () {
  const F = ECO.fmt, esc = F.esc;
  const N = { doc: null };
  const dlg = () => document.getElementById("dlg");

  const gUrl = (q) => "https://news.google.com/search?q=" + encodeURIComponent(q) + "&hl=zh-TW&gl=TW&ceid=TW:zh-Hant";
  const yUrl = (t) => "https://finance.yahoo.com/quote/" + encodeURIComponent(t) + "/news/";
  const link = (href, text) => '<a class="ext" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(text) + " ↗</a>";

  function when(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d) ? "" : F.tpe(d, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function list(items, n) {
    return '<ul class="news">' + items.slice(0, n || 6).map((it) =>
      '<li><a href="' + esc(it.u) + '" target="_blank" rel="noopener noreferrer">' + esc(it.t) + '</a><span class="mut">' +
      esc([it.s, when(it.d)].filter(Boolean).join("・")) + "</span></li>").join("") + "</ul>";
  }

  const MK = [["mkt_tw", "台股"], ["mkt_us", "美股"]];
  function market() {
    const seen = new Set(), out = [];
    MK.forEach(([k, name]) => ECO.news.items(k).forEach((it) => { if (!seen.has(it.u)) { seen.add(it.u); out.push(Object.assign({ mk: name }, it)); } }));
    return out;
  }

  function open(o) {
    const items = (N.doc && N.doc.items && N.doc.items[o.key]) || [];
    const q = o.q || (N.doc && N.doc.q && N.doc.q[o.key]) || o.title || "";
    let body = items.length ? list(items) : '<p class="mut">目前沒有預先抓好的標題（排程更新時才會抓），可以用下面的連結直接查。</p>';
    body += '<p class="links">' + (q ? link(gUrl(q), "Google 新聞：" + q) : "") + (o.yq ? " " + link(yUrl(o.yq), "Yahoo 財經：" + o.yq) : "") + "</p>";
    if (N.doc && N.doc.updated && items.length) body += '<p class="mut">標題更新於 ' + when(N.doc.updated) + "（台灣時間），點標題會到原新聞網站。</p>";
    const tr = ECO.trendIndex && ECO.trendIndex[o.key];
    if (tr) body += '<p class="links"><a class="ext" href="' + esc(tr.href) + '" data-go="' + esc(tr.href) + '" data-chart="' + esc(tr.chart) + '">看趨勢圖 ›</a></p>';
    ECO.dialog.open((o.title || "新聞") + " 的最新新聞", body + (o.extra || ""));
  }

  ECO.dialog = {
    open: function (title, html) {
      document.getElementById("dlg-title").textContent = title;
      document.getElementById("dlg-body").innerHTML = html;
      const d = dlg();
      if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute("open", "");
    },
    close: function () { const d = dlg(); if (d.close) d.close(); else d.removeAttribute("open"); }
  };
  ECO.news = { market: market, set: (doc) => { N.doc = doc; }, items: (k) => (N.doc && N.doc.items && N.doc.items[k]) || [], list: list, open: open, gUrl: gUrl, yUrl: yUrl, link: link, when: when };

  document.addEventListener("click", (e) => {
    if (e.target === dlg() || e.target.closest("#dlg-x")) return ECO.dialog.close();
    const b = e.target.closest("[data-news],[data-gq]");
    if (!b) return;
    e.preventDefault();
    if (b.dataset.news) open({ key: b.dataset.news, title: b.dataset.title, yq: b.dataset.yq, q: b.dataset.q });
    else open({ key: "", title: b.dataset.title || b.dataset.gq, q: b.dataset.gq });
  });
})();
