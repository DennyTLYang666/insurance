/* 概覽的「聯準會利率預期」卡片：預測市場機率＋聯邦基金期貨估算，兩個來源並排對照。 */
(function () {
  const F = ECO.fmt, esc = F.esc;
  const KEYS = [["cut", "降息", "rt-cut"], ["hold", "不動", "rt-hold"], ["hike", "升息", "rt-hike"]];
  const pct = (v) => (v == null ? "—" : (Math.round(v) === v ? v : v.toFixed(1)) + "%");

  function twDate(us) {  /* 美東決議日 → 台灣日期（隔天早上） */
    const d = new Date(us + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  function md(d) { return (d.getUTCMonth() + 1) + "/" + d.getUTCDate(); }
  function daysTo(d) {
    const t = F.tpe(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    return Math.round((d.getTime() - new Date(t + "T00:00:00Z").getTime()) / 86400000);
  }

  function bar(r) {
    return '<div class="rt-bar" role="img" aria-label="' + KEYS.map((k) => k[1] + " " + pct(r[k[0]])).join("，") + '">' +
      KEYS.map((k) => (r[k[0]] > 0 ? '<span class="' + k[2] + '" style="flex:' + r[k[0]] + '">' + (r[k[0]] >= 12 ? Math.round(r[k[0]]) + "%" : "") + "</span>" : "")).join("") + "</div>" +
      '<div class="rt-nums">' + KEYS.map((k) => '<span><i class="' + k[2] + '"></i>' + k[1] + " <b>" + pct(r[k[0]]) + "</b></span>").join("") + "</div>";
  }

  function row(name, sub, body) {
    return '<div class="rt-row"><div class="rt-src"><b>' + name + '</b><span class="mut">' + sub + "</span></div><div class=\"rt-body\">" + body + "</div></div>";
  }

  ECO.rates = {
    render(doc) {
      const el = document.getElementById("ov-rates");
      if (!el) return;
      if (!doc || !doc.next) { el.innerHTML = ""; return; }
      const nd = twDate(doc.next.date), dd = daysTo(nd), c = doc.current || {};
      const rate = c.upper != null ? c.lower.toFixed(2) + "–" + c.upper.toFixed(2) + "%" : "";
      let html = '<div class="rt"><div class="rt-h"><b>聯準會利率預期</b><span class="mut">下次利率決議 ' + md(nd) + "（台灣時間" + (dd > 0 ? "，" + dd + " 天後" : dd === 0 ? "，今天" : "") + "）" + (rate ? "・目前利率 " + rate : "") + "</span></div>";
      const p = doc.poly || {}, nx = (p.meetings || []).find((m) => m.date === doc.next.date);
      html += row("預測市場", "交易者押注", p.ok && nx ? (nx.cut == null ? '<p class="mut">' + esc(nx.note || "資料不完整") + "</p>" : bar(nx)) : '<p class="mut">暫時抓不到（' + (p.ok ? "沒有這次會議的市場" : esc(p.error || "")) + "）</p>");
      const f = doc.futures || {};
      html += row("期貨估算", "聯邦基金期貨", f.ok ? bar(f) + '<p class="mut rt-note">期貨隱含預期變動約 ' + (f.implied_bp > 0 ? "+" : "") + f.implied_bp + " bp（簡化：只看這一次會議、25bp 一檔）</p>" : '<p class="mut">暫時抓不到（' + esc(f.error || "") + "）</p>");
      if (doc.gap_warn) html += '<p class="note rt-warn">兩個來源差距 ' + Math.round(doc.gap) + " 個百分點，其中一邊可能流動性不足或消息正在改變預期，解讀時請保守。</p>";
      const later = (p.meetings || []).filter((m) => m.date > doc.next.date && m.cut != null).slice(0, 2);
      if (later.length) html += '<p class="mut rt-later">後續會議（預測市場）：' + later.map((m) => md(twDate(m.date)) + " 降息 " + pct(m.cut) + "・不動 " + pct(m.hold) + "・升息 " + pct(m.hike)).join("　") + "</p>";
      html += '<p class="note">都是市場押注的機率，不是預測，也不是 CME FedWatch 官方數字；期貨為簡化估算。更新於 ' + F.tpe(new Date(doc.updated), { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + "。</p></div>";
      el.innerHTML = html;
    },
  };
})();
