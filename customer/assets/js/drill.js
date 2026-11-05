/* 共用右側面板：列出一組客戶（可撥電話、導航、點進明細並返回），可切換看「其餘客戶」 */
const Drill = {
  // title：標題；hit：客戶 vm 陣列；total：全部客戶數（用於「其餘」按鈕）；toggle：{label, run} 選填
  open(title, hit, total, toggle) {
    const m = Store.ov.settings.mask !== false, E = U.esc, d = document.getElementById('drawer');
    d.hidden = false;
    d.innerHTML = `
      <div class="hd"><h2>${E(title)}（${hit.length} 位）</h2><button class="ghost" id="dClose">✕ 關閉</button></div>
      ${toggle ? `<div class="actions"><button id="dToggle">${E(toggle.label)}</button></div>` : ''}
      ${hit.length ? hit.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')).map(c => `
        <div class="dl click" data-open="${E(c.id)}" tabindex="0" role="button">
          <div><b>${E(c.name)}</b> <span class="tag ${Store.statusClass(c.status)}">${E(c.status)}</span> ${List.visitTag(c)}</div>
          <div class="small muted">${c.age == null ? '缺生日' : c.age + ' 歲'}｜${E(c.city + c.district)}｜${E(c.circle || '—')}${c.occupation ? '｜' + E(c.occupation) : ''}｜保單 ${c.policies.length}</div>
          <div class="small">${Store.callBtns(c, m)} ${Store.navBtn(c, m ? '導航' : (c.addr ? c.addr.raw : '導航'))}</div>
        </div>`).join('') : '<div class="empty">沒有符合的客戶</div>'}`;
    d.querySelector('#dClose').onclick = () => { d.hidden = true; };
    if (toggle) d.querySelector('#dToggle').onclick = toggle.run;
    const again = () => this.open(title, hit, total, toggle);
    d.querySelectorAll('[data-open]').forEach(n => {
      const go = () => List.open(n.dataset.open, again);
      n.onclick = go; n.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
  },
};
