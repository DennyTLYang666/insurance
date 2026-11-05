/* 保障分頁：以被保險人為單位的總保障（身故／住院／其他給付），以及商品 → 保障對照（可反查） */
const Cover = {
  st: { sub: 'sum', q: '', rel: '', has: '', pq: '', pscope: 'held', pcode: '', psrc: '', cl: { ins: '', ev: 'death', cause: 'disease', days: '5', key: '', amount: '' } },

  render() {
    const el = document.getElementById('tab-cover'), E = U.esc;
    if (!Coverage.ok()) { el.innerHTML = '<div class="card empty">找不到商品保障資料。請用 scripts\\serve.bat 開啟，或先執行 scripts\\build.bat（會一併產生 data/coverage.js）。</div>'; return; }
    if (!Store.policies.length) { el.innerHTML = '<div class="card empty">還沒有登錄任何保單。</div>'; return; }
    const un = Coverage.unconfirmed().length;
    el.innerHTML = `<div class="subtabs" role="tablist">
        <button role="tab" data-sub="sum" class="${this.st.sub === 'sum' ? 'on' : ''}">被保險人總保障</button>
        <button role="tab" data-sub="claim" class="${this.st.sub === 'claim' ? 'on' : ''}">理賠試算</button>
        <button role="tab" data-sub="prod" class="${this.st.sub === 'prod' ? 'on' : ''}">商品對照 / 反查${un ? ` <span class="cnt warn" title="尚未依條款確認的商品">${un}</span>` : ''}</button></div>
      <div id="covBody">${{ sum: () => this.bodySum(), claim: () => this.bodyClaim(), prod: () => this.bodyProd() }[this.st.sub]()}</div>`;
    el.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { this.st.sub = b.dataset.sub; this.render(); });
    ({ sum: this.bindSum, claim: this.bindClaim, prod: this.bindProd }[this.st.sub]).call(this, el);
  },

  /* ---------- 被保險人總保障 ---------- */
  rows() {
    const s = this.st, q = s.q.trim().toLowerCase();
    return Store.insureds.map(g => ({ g, r: Coverage.ofInsured(g) })).filter(({ g, r }) => {
      if (s.rel === 'cust' && !g.customer) return false;
      if (s.rel === 'non' && g.customer) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      if (s.has) { const [m, code] = s.has.split(':'); const has = !!r.cells[code]; if ((m === 'has') !== has) return false; }
      return true;
    }).sort((a, b) => a.g.name.localeCompare(b.g.name, 'zh-Hant'));
  },
  bodySum() {
    const E = U.esc, s = this.st, all = Store.insureds.map(g => Coverage.ofInsured(g));
    const used = new Set(); all.forEach(r => Object.keys(r.cells).forEach(c => used.add(c)));
    const cols = Coverage.codes().filter(c => used.has(c[0]));           // 沒有任何資料的保障欄位不顯示
    const groups = ['身故', '住院', '給付'].map(gn => [gn, cols.filter(c => c[2] === gn)]).filter(x => x[1].length);
    const rows = this.rows(), un = Coverage.unconfirmed().length;
    const opts = cols.map(c => `<option value="has:${c[0]}"${s.has === 'has:' + c[0] ? ' selected' : ''}>有「${E(c[1])}」</option><option value="no:${c[0]}"${s.has === 'no:' + c[0] ? ' selected' : ''}>沒有「${E(c[1])}」</option>`).join('');
    const head1 = `<tr><th rowspan="2">被保險人</th><th rowspan="2">身分</th><th rowspan="2" title="足歲／保險年齡">年齡</th><th rowspan="2">有效保單</th>${groups.map(([gn, cs]) => `<th colspan="${cs.length}" class="grp">${gn === '給付' ? '其他給付' : gn}</th>`).join('')}</tr>`;
    const head2 = `<tr>${groups.map(([, cs]) => cs.map(c => `<th class="cv">${E(c[1])}</th>`).join('')).join('')}</tr>`;
    const body = rows.map(({ g, r }) => `<tr class="row" data-ins="${E(g.name)}"><td><b>${E(g.name)}</b></td>
      <td>${g.customer ? '<span class="tag own">要保人</span>' : '<span class="tag">僅被保險人</span>'}</td>
      <td>${g.age != null ? g.age + '<span class="muted small">／' + g.insAge + '</span>' : '<span class="muted">—</span>'}</td>
      <td>${r.active.length}${r.excluded.length ? `<span class="muted small" title="失效／終止的保單不計入"> (+${r.excluded.length}不計)</span>` : ''}</td>
      ${groups.map(([, cs]) => cs.map(c => { const x = r.cells[c[0]]; return `<td class="cv${x ? ' has click' : ''}" ${x ? `data-cell="${E(c[0])}" title="點擊看明細"` : ''}>${x ? E(Coverage.cellText(x)) + (x.inferred ? '<span class="warnc" title="含只看商品名稱的推論，未經條款確認"> ?</span>' : '') : ''}</td>`; }).join('')).join('')}</tr>`).join('');
    return `<div class="filters">
        <input type="search" id="cq" placeholder="搜尋被保險人" value="${E(s.q)}">
        <select id="crel"><option value="">身分不限</option><option value="cust"${s.rel === 'cust' ? ' selected' : ''}>要保人</option><option value="non"${s.rel === 'non' ? ' selected' : ''}>僅被保險人</option></select>
        <select id="chas"><option value="">保障不限</option>${opts}</select>
        <button id="cclear" class="ghost">清除</button><span class="count">${rows.length} / ${Store.insureds.length} 位</span></div>
      ${un ? `<div class="notice2 small">有 ${un} 個商品尚未依條款確認保障內容（標「?」的數字含名稱推論），請到「商品對照 / 反查」查看並補充。</div>` : ''}
      <div class="tablewrap"><table class="cvt"><thead>${head1}${head2}</thead>
        <tbody>${body || `<tr><td colspan="${4 + cols.length}" class="empty">沒有符合的被保險人</td></tr>`}</tbody></table></div>
      <p class="muted small">加總只含單位為「萬」「元」的金額：身故類以保額計，住院類日額以「元/日」計；實支實付、一次給付、計劃數等無法加總者以「✔」或「＋N項」表示。
        壽險身故、一般醫療險住院都不分原因，會同時計入疾病、意外、癌症三欄（防癌險只計癌症、傷害險只計意外）。失效、終止的保單不計入；「減額繳清」仍計入但保額可能已調降。點數字可看是哪些保單的哪個商品。</p>`;
  },
  bindSum(el) {
    const s = this.st, bind = (id, k, ev) => { const n = el.querySelector(id); n.addEventListener(ev || 'change', () => { s[k] = n.value; this.render(); if (k === 'q') { const q = el.querySelector('#cq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }); };
    bind('#cq', 'q', 'input'); bind('#crel', 'rel'); bind('#chas', 'has');
    el.querySelector('#cclear').onclick = () => { Object.assign(s, { q: '', rel: '', has: '' }); this.render(); };
    el.querySelectorAll('tr[data-ins]').forEach(tr => tr.onclick = e => {
      const td = e.target.closest('td[data-cell]');
      if (td) this.openCell(tr.dataset.ins, td.dataset.cell); else this.openIns(tr.dataset.ins);
    });
  },

  /* ---------- 明細面板 ---------- */
  contribRows(list) {
    const E = U.esc;
    return list.map(c => `<tr><td>${E(Coverage.label(c.code))}${c.all ? '<span class="muted small" title="不分原因，疾病／意外／癌症皆計入"> (不分原因)</span>' : ''}</td>
      <td>${E(c.it.name)}${c.p.items.length > 1 && c.it.rider ? ' <span class="tag">附約</span>' : ''}<div class="small muted">${E(c.p.no)}${c.p.status ? '｜' + E(c.p.status) : ''}</div></td>
      <td>${E(Coverage.basisTxt(c))}</td><td>${Coverage.srcTag(c.src)}</td></tr>`).join('');
  },
  openIns(name, back) {
    const g = Store.insureds.find(x => x.name === name); if (!g) return;
    const r = Coverage.ofInsured(g), E = U.esc, d = document.getElementById('drawer');
    d.hidden = false;
    const cols = Coverage.codes().filter(c => r.cells[c[0]]);
    d.innerHTML = `<div class="hd">${back ? '<button class="ghost" id="dBack">← 返回</button>' : ''}<h2>${E(name)} 的總保障</h2><button class="ghost" id="dClose">✕ 關閉</button></div>
      <div class="small muted">有效保單 ${r.active.length} 張${r.excluded.length ? `；不計入 ${r.excluded.length} 張（${E(r.excluded.map(p => p.no + ' ' + (p.status || '')).join('、'))}）` : ''}</div>
      ${cols.map(c => { const x = r.cells[c[0]]; return `<div class="sec">${E(c[1])}　<span class="muted">${E(Coverage.cellText(x))}${x.inferred ? ' ?' : ''}</span></div>
        <table class="mini"><tbody>${x.list.map(k => `<tr><td>${E(k.it.name)}<div class="small muted">${E(k.p.no)}${k.p.status ? '｜' + E(k.p.status) : ''}</div></td><td>${E(Coverage.basisTxt(k))}</td><td>${Coverage.srcTag(k.src)}</td></tr>`).join('')}</tbody></table>`; }).join('') || '<div class="empty">沒有可判斷的保障（商品尚未建檔）</div>'}
      ${r.unknown.length ? `<div class="sec">尚無保障資料的商品</div><ul>${r.unknown.map(u => `<li>${E(u.it.name)} <span class="muted small">${E(u.p.no)}</span></li>`).join('')}</ul>` : ''}
      <p class="muted small">「?」＝含只看商品名稱的推論；到「商品對照 / 反查」依條款確認後才會變成「已確認」。</p>`;
    d.querySelector('#dClose').onclick = () => { d.hidden = true; };
    if (back) d.querySelector('#dBack').onclick = back;
  },
  openCell(name, code) {
    const g = Store.insureds.find(x => x.name === name); if (!g) return;
    const x = Coverage.ofInsured(g).cells[code]; if (!x) return;
    const E = U.esc, d = document.getElementById('drawer');
    d.hidden = false;
    d.innerHTML = `<div class="hd"><button class="ghost" id="dBack">← ${E(name)} 總保障</button><h2>${E(name)}・${E(Coverage.label(code))}</h2><button class="ghost" id="dClose">✕ 關閉</button></div>
      <div class="small muted">合計：${E(Coverage.cellText(x))}</div>
      <table class="mini"><tbody>${x.list.map(k => `<tr><td>${E(k.it.name)}<div class="small muted">${E(k.p.no)}${k.p.status ? '｜' + E(k.p.status) : ''}</div></td><td>${E(Coverage.basisTxt(k))}${k.all ? '<div class="small muted">' + E(Coverage.ALL_TXT[k.all]) + '：疾病／意外／癌症皆計入</div>' : ''}</td><td>${Coverage.srcTag(k.src)}</td></tr>`).join('')}</tbody></table>`;
    d.querySelector('#dClose').onclick = () => { d.hidden = true; };
    d.querySelector('#dBack').onclick = () => this.openIns(name);
  },

  /* 給保單明細用：這張保單各商品的保障 */
  policyHtml(p) {
    if (!Coverage.ok()) return '';
    const E = U.esc, cs = Coverage.contributions(p);
    const miss = p.items.filter(i => Coverage.lookup(i.name).source === 'none');
    if (!cs.length && !miss.length) return '';
    const by = new Map(); cs.forEach(c => { const k = c.it.name; (by.get(k) || by.set(k, []).get(k)).push(c); });
    return `<div class="sec">保障內容</div>` + [...by].map(([n, list]) => {
      const merged = []; list.forEach(c => { const lab = c.all ? Coverage.ALL_TXT[c.all] : Coverage.label(c.code); if (!(c.all && merged.some(m => m.all === c.all))) merged.push({ lab, c, all: c.all }); });
      return `<div class="small"><b>${E(n)}</b> ${Coverage.srcTag(list[0].src)}<br>${merged.map(m => `${E(m.lab)}<span class="muted">（${E(Coverage.basisTxt(m.c))}）</span>`).join('、')}</div>`;
    }).join('') + (miss.length ? `<div class="small warnc">尚無保障資料：${E(miss.map(i => i.name).join('、'))}</div>` : '');
  },


  /* ---------- 理賠試算 ---------- */
  bodyClaim() {
    const E = U.esc, cl = this.st.cl;
    const people = Store.insureds.filter(g => Coverage.ofInsured(g).active.length).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    if (!people.length) return '<div class="card empty">沒有有效保單的被保險人。</div>';
    if (!people.some(g => g.name === cl.ins)) cl.ins = people[0].name;
    const g = people.find(x => x.name === cl.ins), e = Claim.ev(cl.ev);
    const keys = e.need.includes('key') ? Claim.keys(g, e, cl.cause) : [];
    if (keys.length && !keys.includes(cl.key)) cl.key = keys[0];
    const ev = { id: e.id, cause: cl.cause, days: Math.max(0, +cl.days || 0), key: keys.length ? cl.key : '', amount: cl.amount === '' ? null : Math.max(0, +cl.amount || 0) };
    const sim = Claim.simulate(g, ev);
    const causeSel = `<select id="clcause">${(e.byCause ? Claim.CAUSES : [['', '原因不限'], ...Claim.CAUSES]).map(([k, t]) => `<option value="${k}"${cl.cause === k ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
    const rows = sim.rows.map(x => {
      const c = x.c, amt = x.skip ? '—' : x.amount == null ? '<span class="warnc">？</span>' : '<b>' + E(Claim.fmt(x.amount)) + '</b>';
      return `<tr class="${x.skip ? 'skipr' : ''}"><td>${E(c.it.name)}<div class="small muted">${E(c.p.no)}${c.p.status ? '｜' + E(c.p.status) : ''}</div></td>
        <td>${E(Coverage.label(c.code))}${c.all ? '<span class="muted small"> (不分原因)</span>' : ''}</td><td class="num">${amt}</td>
        <td class="small">${E(x.skip || x.how)}${x.notes.length ? `<div class="muted">${x.notes.map(E).join('<br>')}</div>` : ''}</td>
        <td>${Coverage.srcTag(c.src)} ${x.conf === 'cfg' ? '<span class="tag own" title="依 coverage.yaml 的 pay 設定計算">依設定檔</span>' : '<span class="tag warn" title="設定檔沒有寫這個保障的 pay，用預設算法">預設算法</span>'}</td></tr>`;
    }).join('');
    const r = sim.r, live = sim.rows.filter(x => !x.skip && x.amount != null), nCfg = live.filter(x => x.conf === 'cfg').length, nDef = live.length - nCfg;
    return `<div class="filters">
        <label>被保險人 <select id="clins">${people.map(x => `<option${x.name === cl.ins ? ' selected' : ''}>${E(x.name)}</option>`).join('')}</select></label>
        <label>事故 <select id="clev">${Claim.EVENTS.map(x => `<option value="${x.id}"${x.id === cl.ev ? ' selected' : ''}>${x.label}</option>`).join('')}</select></label>
        ${['death', 'hosp'].includes(e.id) || e.anyCause ? `<label>原因 ${causeSel}</label>` : ''}
        ${e.need.includes('days') ? `<label>住院天數 <input type="number" id="cldays" min="0" max="3650" value="${E(cl.days)}" style="width:5em"></label>` : ''}
        ${e.need.includes('key') ? (keys.length ? `<label>${e.id === 'surgery' ? '手術項目' : '失能等級／項目'} <select id="clkey">${keys.map(k => `<option${k === cl.key ? ' selected' : ''}>${E(k)}</option>`).join('')}</select></label>` : (sim.rows.length ? '<span class="muted small">設定檔沒有給付表（pay.table），此事故的金額只能套預設算法</span>' : '')) : ''}
        ${e.need.includes('amount') || sim.rows.some(x => x.needAmt) ? `<label>實際花費（元） <input type="number" id="clamt" min="0" value="${E(cl.amount)}" style="width:7em" placeholder="實支實付用"></label>` : ''}
      </div>
      <div class="card" style="margin:10px 0">
        <div class="kpi"><div class="l">${E(g.name)}・${E(e.label)}${e.byCause || cl.cause ? '（' + Claim.causeTxt(cl.cause) + '）' : ''} 試算合計</div>
          <div class="v">${sim.rows.some(x => x.amount != null && !x.skip) ? E(Claim.fmt(sim.total)) : '—'}</div>
          <div class="s">${nCfg && nDef ? `依設定檔 ${E(Claim.fmt(sim.totalCfg))}＋預設算法 ${E(Claim.fmt(sim.totalDef))}` : nDef ? '全部是「預設算法」（設定檔尚未寫這些商品的 pay）' : nCfg ? '全部依設定檔' : ''}${sim.unknown ? `｜另有 ${sim.unknown} 筆金額無法計算（？）` : ''}${sim.skipped ? `｜${sim.skipped} 筆不適用` : ''}</div></div>
      </div>
      <div class="tablewrap"><table class="cvt"><thead><tr><th>商品／保單</th><th>保障</th><th>試算金額</th><th>算式與條件</th><th>依據</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="empty">這位被保險人沒有「${E(Coverage.label(Claim.codeOf(e, cl.cause)))}」保障（有效保單 ${r.active.length} 張）</td></tr>`}</tbody></table></div>
      ${r.unknown.length ? `<div class="notice2 small">這位的 ${r.unknown.length} 個商品完全沒有保障資料（${E([...new Set(r.unknown.map(u => u.it.name))].join('、'))}），不在試算內。</div>` : ''}
      <p class="muted small">⚠ 這是依 <code>coverage.yaml</code> 的設定估算，<b>不是理賠審核結果</b>；實際是否給付、給付多少依條款與保險公司審核為準（例如免責期、等待期、除外責任、已領過的累計上限、比例分攤，這裡都不會自動判斷）。
        標「預設算法」的列沒有依據條款，只是保額×100%／日額×天數；要精確請把該商品寫進設定檔（到「商品對照」按「複製範本」）。失效、終止的保單不計入。</p>`;
  },
  bindClaim(el) {
    const cl = this.st.cl, on = (id, k, ev) => { const n = el.querySelector(id); if (n) n.addEventListener(ev || 'change', () => { cl[k] = n.value; if (k === 'ev') { cl.key = ''; cl.cause = Claim.ev(n.value).byCause ? (cl.cause || 'disease') : ''; if (Claim.ev(n.value).byCause && !cl.cause) cl.cause = 'disease'; } this.render(); }); };
    on('#clins', 'ins'); on('#clev', 'ev'); on('#clcause', 'cause'); on('#clkey', 'key');
    const keep = (id, k) => { const n = el.querySelector(id); if (n) n.addEventListener('input', () => { cl[k] = n.value; this.render(); const m = document.querySelector(id); if (m) m.focus(); }); };
    keep('#cldays', 'days'); keep('#clamt', 'amount');
  },

  /* ---------- 商品對照 / 反查 ---------- */
  prodRows() {
    const s = this.st, q = s.pq.trim().toLowerCase(), held = new Map(Coverage.heldProducts().map(x => [Coverage.norm(x.name), x]));
    let list;
    if (s.pscope === 'held') list = [...held.values()].map(x => ({ name: x.name, n: x.n, lk: Coverage.lookup(x.name) }));
    else {
      const seen = new Set();
      list = Object.entries(Coverage.data.products).map(([k, p]) => { seen.add(k); const h = held.get(k); return { name: p.name, n: h ? h.n : 0, lk: Coverage.lookup(p.name) }; });
      held.forEach((x, k) => { if (!seen.has(k)) list.push({ name: x.name, n: x.n, lk: Coverage.lookup(x.name) }); });
    }
    return list.filter(x => (!q || x.name.toLowerCase().includes(q)) && (!s.pcode || x.lk.benefits.some(b => Coverage.expand(b.code).includes(s.pcode))) && (!s.psrc || x.lk.source === s.psrc))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'zh-Hant'));
  },
  bodyProd() {
    const E = U.esc, s = this.st, rows = this.prodRows();
    const used = new Set(); rows.forEach(x => x.lk.benefits.forEach(b => Coverage.expand(b.code).forEach(c => used.add(c))));
    const cols = Coverage.codes().filter(c => used.has(c[0]) || c[0] === s.pcode);
    const cnt = Coverage.data.counts || {};
    const warns = Coverage.data.warnings || [];
    return `${warns.length ? `<div class="notice2 small"><b>coverage.yaml 有 ${warns.length} 個問題（寫錯的欄位不會生效）：</b><ul style="margin:4px 0 0 18px;padding:0">${warns.slice(0, 12).map(w => `<li>${E(w)}</li>`).join('')}${warns.length > 12 ? `<li>…另有 ${warns.length - 12} 項</li>` : ''}</ul></div>` : ''}<div class="filters">
        <input type="search" id="pq" placeholder="搜尋商品名稱" value="${E(s.pq)}">
        <select id="pscope"><option value="held"${s.pscope === 'held' ? ' selected' : ''}>客戶持有的商品</option><option value="all"${s.pscope === 'all' ? ' selected' : ''}>全部商品（官網 ${cnt.catalog || 0}＋已確認 ${cnt.manual || 0}）</option></select>
        <select id="pcode"><option value="">保障不限（反查：有此保障的商品）</option>${Coverage.codes().map(c => `<option value="${c[0]}"${s.pcode === c[0] ? ' selected' : ''}>${E(c[1])}</option>`).join('')}</select>
        <select id="psrc"><option value="">來源不限</option>${['manual', 'catalog', 'rules', 'none'].map(k => `<option value="${k}"${s.psrc === k ? ' selected' : ''}>${Coverage.SRC_TXT[k]}</option>`).join('')}</select>
        <button id="pclear" class="ghost">清除</button><span class="count">${rows.length} 項</span></div>
      <div class="tablewrap"><table class="cvt"><thead><tr><th>商品</th><th>來源</th><th>持有保單</th>${cols.map(c => `<th class="cv">${E(c[1])}</th>`).join('')}<th></th></tr></thead>
        <tbody>${rows.map((x, i) => `<tr><td>${E(x.name)}${x.lk.note ? `<div class="small muted">${E(x.lk.note)}</div>` : ''}</td><td>${Coverage.srcTag(x.lk.source)}</td><td>${x.n || '<span class="muted">—</span>'}</td>
          ${cols.map(c => { const bs = x.lk.benefits.filter(b => Coverage.expand(b.code).includes(c[0])); return `<td class="cv${bs.length ? ' has' : ''}">${bs.length ? E(bs.map(b => Coverage.allKind(b.code) ? Coverage.ALL_TXT[Coverage.allKind(b.code)] : (Coverage.BASIS_TXT[b.basis] || b.basis)).join('/')) : ''}</td>`; }).join('')}
          <td>${x.lk.source !== 'manual' && x.lk.benefits.length ? `<button class="ghost" data-tpl="${i}" title="複製成 coverage.yaml 的草稿，依條款確認後貼進去">複製範本</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="${4 + cols.length}" class="empty">沒有符合的商品</td></tr>`}</tbody></table></div>
      <p class="muted small">來源：<b>已確認</b>＝你寫在 <code>data/產品/structured/coverage.yaml</code>（或舊的 coverage_manual.json）的商品；<b>官網特色</b>＝官網商品清單的特色欄依規則對應（疾病／意外歸類依商品名稱，不是條款）；<b>名稱推論</b>＝只看名稱關鍵字；<b>未建檔</b>＝沒有資料。
        官網清單只有在售商品，舊商品通常找不到，需依條款補到 coverage.yaml（按「複製範本」取得 YAML 草稿，貼入並依條款修正、存檔後重新整理；也可執行 <code>python scripts/build_coverage.py --scaffold</code> 一次產生全部尚未確認商品的草稿）。怎麼賠的細節（免責日、上限、給付表）寫在 <code>pay:</code>，用法見 coverage.yaml 開頭的說明，結果可到「理賠試算」查看。</p>`;
  },
  bindProd(el) {
    const s = this.st, bind = (id, k, ev) => { const n = el.querySelector(id); n.addEventListener(ev || 'change', () => { s[k] = n.value; this.render(); if (k === 'pq') { const q = el.querySelector('#pq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }); };
    bind('#pq', 'pq', 'input'); bind('#pscope', 'pscope'); bind('#pcode', 'pcode'); bind('#psrc', 'psrc');
    el.querySelector('#pclear').onclick = () => { Object.assign(s, { pq: '', pcode: '', psrc: '' }); this.render(); };
    const rows = this.prodRows();
    el.querySelectorAll('[data-tpl]').forEach(b => b.onclick = async () => {
      const x = rows[+b.dataset.tpl];
      const skel = k => { const basis = k.basis === 'auto' ? (String(k.code).startsWith('hosp') ? 'daily' : 'sum') : (k.basis || 'text');
        const pay = { sum: '{ rate: 1.0 }', lump: '{ rate: 1.0 }', daily: '{ per_day: 1, waiting_days: 0, max_days: 365 }', reimb: '{ rate: 1.0 }   # 請加 max_amount（單次上限，元）' }[basis];
        return `      - code: ${k.code}\n        basis: ${basis}` + (pay ? `\n        pay: ${pay}` : '\n        # basis 請改成 sum／daily／reimb／lump，並補 pay'); };
      const tpl = `  ${x.name}:\n    source: （請填：條款第 X 條／版本日期）\n    benefits:\n${x.lk.benefits.map(skel).join('\n')}`;
      try { await navigator.clipboard.writeText(tpl); U.toast('已複製，貼到 coverage.yaml 的 products 底下（縮排要對齊）'); }
      catch (e) { window.prompt('複製下列內容，貼到 coverage.yaml 的 products 底下', tpl); }
    });
  },
};
