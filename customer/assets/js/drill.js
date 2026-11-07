/* 共用右側面板：列出一組客戶（可撥電話、導航、點進明細並返回）。
 * open：固定的一組客戶（可附「看其餘」按鈕）；query：條件式下鑽（條件可改成不等於／以上／以下、可拿掉單一條件、可看「沒有任何符合」的客戶）。 */
const Drill = {
  listHtml(hit) {
    const m = Store.ov.settings.mask !== false, E = U.esc;
    return hit.length ? hit.slice().sort((a, b) => U.coll.compare(a.name, b.name)).map(c => `
        <div class="dl click" data-open="${E(c.id)}" tabindex="0" role="button">
          <div><b>${E(c.name)}</b> <span class="tag ${Store.statusClass(c.status)}">${E(c.status)}</span> ${List.visitTag(c)}</div>
          <div class="small muted">${c.age == null ? '缺生日' : c.age + ' 歲'}｜${E(c.city + c.district)}｜${E(c.circle || '—')}${c.occupation ? '｜' + E(c.occupation) : ''}｜保單 ${c.policies.length}</div>
          <div class="small">${Store.callBtns(c, m)} ${Store.navBtn(c, m ? '導航' : (c.addr ? c.addr.raw : '導航'))}</div>
        </div>`).join('') : '<div class="empty">沒有符合的客戶</div>';
  },
  bindList(d, again) {
    d.querySelectorAll('[data-open]').forEach(n => {
      const go = () => List.open(n.dataset.open, again);
      n.onclick = go; n.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
  },

  // title：標題；hit：客戶 vm 陣列；total：全部客戶數（用於「其餘」按鈕）；toggle：{label, run} 選填
  open(title, hit, total, toggle) {
    const E = U.esc, d = document.getElementById('drawer');
    d.hidden = false;
    d.innerHTML = `
      <div class="hd"><h2>${E(title)}（${hit.length} 位）</h2><button class="ghost" id="dClose">✕ 關閉</button></div>
      ${toggle ? `<div class="actions"><button id="dToggle">${E(toggle.label)}</button></div>` : ''}
      ${this.listHtml(hit)}`;
    d.querySelector('#dClose').onclick = () => { d.hidden = true; };
    if (toggle) d.querySelector('#dToggle').onclick = toggle.run;
    this.bindList(d, () => this.open(title, hit, total, toggle));
  },

  /* 條件式下鑽：q = {uid, conds:[{dim, key, op, name?}], tab:'hit'|'rest'}（條件在「單位」上同時成立，見 dims.js 的 run） */
  query(q) {
    const E = U.esc, d = document.getElementById('drawer'), r = Dims.run(q.uid, q.conds), un = Dims.units[q.uid];
    const list = q.tab === 'rest' ? r.rest : r.hit, nm = c => c.name || c.dim.label || '';
    const text = q.conds.map(c => nm(c) + ' ' + Dims.OPS[c.op].split('（')[0] + ' ' + c.key).join('，且 ');
    d.hidden = false;
    d.innerHTML = `
      <div class="hd"><h2>${E(q.tab === 'rest' ? '沒有任何符合：' + text : text)}</h2><button class="ghost" id="dClose">✕ 關閉</button></div>
      <div class="qchips">${q.conds.map((c, i) => {
        const ord = Dims.ordKeys(q.uid, c.dim), canOrd = !!ord && ord.includes(c.key);
        return `<div class="qchip"><span class="muted small">${E(nm(c))}</span>
          <select data-qop="${i}" aria-label="條件">${[['eq', '等於'], ['ne', '不等於'], ...(canOrd ? [['ge', '以上（≥）'], ['le', '以下（≤）']] : [])].map(([v, t]) => `<option value="${v}"${c.op === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
          <b>${E(c.key)}</b>${q.conds.length > 1 ? `<button class="ghost small" data-qdel="${i}" title="拿掉這個條件，只看其餘條件">✕</button>` : ''}</div>`;
      }).join('')}</div>
      <div class="seg" role="group" aria-label="符合或沒有"><button data-qtab="hit" class="${q.tab === 'rest' ? '' : 'on'}">符合 ${r.hit.length} 位</button><button data-qtab="rest" class="${q.tab === 'rest' ? 'on' : ''}" title="完全沒有符合條件的單位的客戶（含沒有保單的客戶）">沒有任何符合 ${r.rest.length} 位</button></div>
      <p class="muted small" style="margin:6px 0">${q.uid === 'customer' ? '' : `條件以「${E(un.label)}」為單位同時成立；客戶＝持有符合單位的要保人。`}${q.conds.some(c => c.op === 'ne') ? '「不等於」是看符合條件的單位，和上面的「沒有任何符合」（整個客戶都沒有）不同。' : ''}</p>
      ${this.listHtml(list)}`;
    d.querySelector('#dClose').onclick = () => { d.hidden = true; };
    d.querySelectorAll('[data-qop]').forEach(n => n.onchange = () => { q.conds[+n.dataset.qop].op = n.value; this.query(q); });
    d.querySelectorAll('[data-qdel]').forEach(n => n.onclick = () => { q.conds.splice(+n.dataset.qdel, 1); this.query(q); });
    d.querySelectorAll('[data-qtab]').forEach(n => n.onclick = () => { q.tab = n.dataset.qtab; this.query(q); });
    this.bindList(d, () => this.query(q));
  },
};
