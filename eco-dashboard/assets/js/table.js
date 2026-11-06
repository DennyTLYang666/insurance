/* 概覽「表格」：把概覽的所有項目放進一張表，可排序、篩選、下載 CSV。
   控制列只建一次（重新整理資料時只重畫表身，所以輸入中的文字不會被洗掉）。 */
(function () {
  const F = ECO.fmt, esc = F.esc;
  const COLS = [["grp", "分類", false], ["name", "名稱", false], ["value", "最新", true], ["chg", "日", true], ["w1", "週", true], ["m1", "月", true], ["from_high", "距近一年高點", true], ["date", "資料日", true]];
  const S = { rows: [], groups: [], sel: new Set(), q: "", dir: "all", move: null, dd: null, sort: { key: null, asc: false }, built: false, box: null };

  const brief = (n) => String(n).replace(/（[^）]*）/g, "");  // 分類名稱去掉括號說明，按鈕與欄位才不會太長
  function flatten(ov) {
    const rows = [];
    ov.groups.forEach((g, gi) => g.tiles.forEach((t, ti) => rows.push({ t: t, gid: g.id, gname: g.name, gi: gi, ti: ti })));
    return rows;
  }

  function build() {
    S.box.innerHTML =
      '<div class="ffilters tfilters">' +
        '<input type="search" data-t="q" placeholder="搜尋名稱或代號" aria-label="搜尋">' +
        '<div class="seg" role="group" aria-label="漲跌" data-t="dir"><button type="button" data-v="all" class="on">全部</button><button type="button" data-v="up">上漲</button><button type="button" data-v="down">下跌</button></div>' +
        '<label class="tnumlb">日漲跌 ≥ <input type="number" class="tnum" data-t="move" min="0" step="any" inputmode="decimal" placeholder="0"> <span class="mut">%</span></label>' +
        '<label class="tnumlb">距高點跌 ≥ <input type="number" class="tnum" data-t="dd" min="0" step="any" inputmode="decimal" placeholder="0"> <span class="mut">%</span></label>' +
        '<button type="button" data-t="clear">清除條件</button><button type="button" data-t="csv">下載 CSV</button>' +
      '</div>' +
      '<div class="tchips" data-t="chips" role="group" aria-label="分類"></div>' +
      '<p class="hint" data-t="count"></p>' +
      '<div class="tablewrap"><table class="mtable otable" data-t="table"></table></div>' +
      '<p class="note">點欄位標題排序（再點一次反向）；「日」欄利率類以 pp 計、其他以 %。「日漲跌」用絕對值，漲跌都算。點名稱看新聞，點分類看趨勢圖。</p>';
    const q = (k) => S.box.querySelector('[data-t="' + k + '"]');
    q("q").addEventListener("input", (e) => { S.q = e.target.value.trim().toLowerCase(); body(); });
    q("move").addEventListener("input", (e) => { const v = parseFloat(e.target.value); S.move = isNaN(v) ? null : Math.abs(v); body(); });
    q("dd").addEventListener("input", (e) => { const v = parseFloat(e.target.value); S.dd = isNaN(v) ? null : Math.abs(v); body(); });
    q("dir").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      S.dir = b.dataset.v;
      q("dir").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      body();
    });
    q("chips").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-g]");
      if (!b) return;
      if (b.dataset.g === "*") S.sel.clear();
      else if (S.sel.has(b.dataset.g)) S.sel.delete(b.dataset.g); else S.sel.add(b.dataset.g);
      chips(); body();
    });
    q("clear").addEventListener("click", () => {
      S.q = ""; S.dir = "all"; S.move = null; S.dd = null; S.sel.clear(); S.sort = { key: null, asc: false };
      q("q").value = ""; q("move").value = ""; q("dd").value = "";
      q("dir").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.v === "all"));
      chips(); body();
    });
    q("csv").addEventListener("click", csv);
    q("table").addEventListener("click", (e) => {
      const b = e.target.closest("th button[data-k]");
      if (!b) return;
      const k = b.dataset.k;
      S.sort = { key: k, asc: S.sort.key === k ? !S.sort.asc : (k === "name" || k === "grp") };
      body();
    });
    S.built = true;
  }

  function chips() {
    const el = S.box.querySelector('[data-t="chips"]');
    el.innerHTML = '<button type="button" data-g="*"' + (S.sel.size === 0 ? ' class="on"' : "") + ">全部分類</button>" +
      S.groups.map((g) => '<button type="button" data-g="' + esc(g.id) + '"' + (S.sel.has(g.id) ? ' class="on"' : "") + ' title="' + esc(g.name) + '">' + esc(brief(g.name)) + "</button>").join("");
  }

  function visible() {
    let rows = S.rows.filter((r) => {
      const t = r.t;
      if (S.sel.size && !S.sel.has(r.gid)) return false;
      if (S.q && (t.name + " " + t.id + " " + (t.short || "")).toLowerCase().indexOf(S.q) < 0) return false;
      if (S.dir === "up" && !(t.chg > 0)) return false;
      if (S.dir === "down" && !(t.chg < 0)) return false;
      if (S.move != null && !(t.chg != null && Math.abs(t.chg) >= S.move)) return false;
      if (S.dd != null && !(t.from_high != null && t.from_high <= -S.dd)) return false;
      return true;
    });
    const k = S.sort.key;
    if (k) {
      const sg = S.sort.asc ? 1 : -1;
      const val = (r) => k === "grp" ? r.gi : k === "name" ? r.t.name : k === "date" ? (r.t.date || "") : r.t[k];
      rows = rows.slice().sort((a, b) => {
        const x = val(a), y = val(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;            // 沒有值的永遠排最後
        if (y == null) return -1;
        const c = typeof x === "string" ? x.localeCompare(y, "zh-Hant") : x - y;
        return c ? sg * c : (a.gi - b.gi) || (a.ti - b.ti);
      });
    }
    return rows;
  }

  const cell = (t, v) => v == null ? '<td class="r">—</td>' : '<td class="r ' + F.dir(v) + '">' + F.chg(t, v) + "</td>";

  function body() {
    const rows = visible();
    const th = COLS.map((c) => '<th class="' + (c[2] ? "r " : "") + (S.sort.key === c[0] ? "sorted" : "") + '"><button type="button" data-k="' + c[0] + '">' + c[1] +
      (S.sort.key === c[0] ? (S.sort.asc ? " ▲" : " ▼") : "") + "</button></th>").join("") + '<th class="r hide-s">走勢</th>';
    const trs = rows.map((r) => {
      const t = r.t, link = (ECO.TREND || {})[r.gid] || (r.gid.indexOf("f_") === 0 ? "#funds/common" : "");
      return "<tr" + (t.stale ? ' class="stale"' : "") + '><td class="mut">' + (link ? '<a class="ext" href="' + esc(link) + '" title="' + esc(r.gname) + '">' + esc(brief(r.gname)) + "</a>" : esc(brief(r.gname))) + '</td>' +
        '<td class="nm"><button type="button" class="linkish" data-news="' + esc(t.id) + '" data-title="' + esc(t.name) + '" data-yq="' + esc(t.yq || "") + '" title="看新聞">' + esc(t.name) + "</button>" + (t.stale ? ' <span class="badge warn">舊資料</span>' : "") + "</td>" +
        '<td class="r">' + F.num(t.value, t.dec) + (t.kind === "rate" ? "%" : "") + "</td>" + cell(t, t.chg) + cell(t, t.w1) + cell(t, t.m1) +
        (t.from_high == null ? '<td class="r">—</td>' : '<td class="r ' + F.dir(t.from_high) + '">' + F.sign(t.from_high, 1, "%") + "</td>") +
        '<td class="r mut">' + (t.date ? F.md(t.date) : "—") + '</td><td class="r hide-s">' + F.spark(t.spark, 64, 22) + "</td></tr>";
    }).join("");
    S.box.querySelector('[data-t="table"]').innerHTML = "<thead><tr>" + th + "</tr></thead><tbody>" + (trs || '<tr><td colspan="' + (COLS.length + 1) + '" class="mut">沒有符合條件的項目。</td></tr>') + "</tbody>";
    S.box.querySelector('[data-t="count"]').textContent = "顯示 " + rows.length + " / 共 " + S.rows.length + " 項";
  }

  function csv() {
    const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const n = (v, d) => v == null ? "" : (+v).toFixed(d);
    const lines = [["分類", "名稱", "代號", "最新", "日", "週", "月", "距近一年高點", "資料日"].map(q).join(",")];
    visible().forEach((r) => { const t = r.t; lines.push([r.gname, t.name, t.id, n(t.value, t.dec == null ? 2 : t.dec), n(t.chg, 2), n(t.w1, 2), n(t.m1, 2), n(t.from_high, 1), t.date || ""].map(q).join(",")); });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "eco-overview.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  ECO.table = {
    render: function (ov) {
      S.box = document.getElementById("ov-table");
      if (!S.box || !ov) return;
      S.rows = flatten(ov);
      const ids = ov.groups.map((g) => g.id).join();
      const changed = ids !== S.groups.map((g) => g.id).join();
      S.groups = ov.groups.map((g) => ({ id: g.id, name: g.name }));
      S.sel.forEach((id) => { if (!S.groups.some((g) => g.id === id)) S.sel.delete(id); });
      if (!S.built) build();
      if (changed || !S.box.querySelector('[data-t="chips"]').children.length) chips();
      body();
    }
  };
})();
