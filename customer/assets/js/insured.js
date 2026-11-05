/* 被保險人分頁：以「人」為單位，看每個被保險人有哪些保單與保障 */
const Insured = {
  st: { q: '', rel: '', type: '', sort: 'name', dir: 1 },
  mark(g, t) { return g.types.has(t) ? '<span class="ok">✔</span>' : '<span class="muted">—</span>'; },
  val(g, k) {
    if (k && k.startsWith('t:')) return g.types.has(k.slice(2)) ? 0 : 1;
    switch (k) {
      case 'rel': return g.customer ? 0 : 1;
      case 'age': return g.age != null ? g.age : -1;
      case 'insAge': return g.insAge != null ? g.insAge : -1;
      case 'bump': return g.bump ? g.bump.days : 99999;
      case 'owners': return g.owners.map(c => c.name).join('');
      case 'n': return g.policies.length;
      case undefined: return '';
      default: return g[k] || '';
    }
  },
  /* 下次加歲日：顯示日期、剩幾天、加歲後的保險年齡；接近時標警告 */
  bumpCell(g) {
    const b = g.bump; if (!b) return '<span class="muted">—</span>';
    const warn = b.days <= Store.warnDays('ageWarnDays');
    return `<span class="${warn ? 'warnc' : ''}" title="${U.esc(this.bumpTip(g))}">${warn ? '⚠ ' : ''}${U.fmtDate(b.date)}（${b.days} 天後）<span class="muted small">${b.from}→${b.to}歲</span></span>`;
  },
  bumpTip(g) {
    const b = g.bump;
    return `從 ${U.fmtDate(b.date)} 起，保險年齡由 ${b.from} 歲變 ${b.to} 歲（依「足歲、超過 6 個月加 1 歲」推算）。保費通常隨保險年齡調整，加歲前投保或變更保費較低；實際算法以各商品條款為準，投保前請核對。`;
  },
  filtered() {
    const s = this.st, q = s.q.trim().toLowerCase();
    return Store.insureds.filter(g => {
      if (s.rel === 'cust' && !g.customer) return false;
      if (s.rel === 'non' && g.customer) return false;
      if (s.type) { const [m, t] = s.type.split(':'); if ((m === 'has') !== g.types.has(t)) return false; }
      if (q && ![g.name, g.owners.map(c => c.name).join(' '), g.policies.map(p => p.no + ' ' + p.items.map(i => i.raw).join(' ')).join(' ')].join(' ').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      const x = this.val(a, s.sort), y = this.val(b, s.sort);
      return ((typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'zh-Hant')) * s.dir || a.name.localeCompare(b.name, 'zh-Hant');
    });
  },
  render() {
    const el = document.getElementById('tab-insured'), s = this.st, E = U.esc;
    if (!Store.insureds.length) { el.innerHTML = '<div class="card empty">還沒有登錄保單，所以沒有被保險人資料。</div>'; return; }
    const rows = this.filtered(), tys = Store.TYPES.filter(t => Store.insureds.some(g => g.types.has(t)));
    const COLS = [['name', '被保險人'], ['rel', '身分'], ['age', '年齡'], ['insAge', '保險年齡'], ['bump', '下次加歲日 ⚠'], ['owners', '要保人'], ['n', '保單(張)'], ...tys.map(t => ['t:' + t, Store.typeLabel(t).replace('（含還本）', '')])];
    el.innerHTML = `<div class="filters">
        <input type="search" id="iq" placeholder="搜尋 被保險人/要保人/保單/商品" value="${E(s.q)}">
        <select id="irel"><option value="">身分不限</option><option value="cust"${s.rel === 'cust' ? ' selected' : ''}>要保人（姓名在客戶檔案中）</option><option value="non"${s.rel === 'non' ? ' selected' : ''}>僅被保險人（要保人中找不到）</option></select>
        <select id="itype"><option value="">保障不限</option>${tys.map(t => `<option value="has:${t}"${s.type === 'has:' + t ? ' selected' : ''}>有${E(Store.typeLabel(t))}</option><option value="no:${t}"${s.type === 'no:' + t ? ' selected' : ''}>沒有${E(Store.typeLabel(t))}</option>`).join('')}</select>
        <select id="iwarn" title="加歲日提醒範圍">${[30, 60, 90, 180].map(n => `<option value="${n}"${Store.warnDays('ageWarnDays') === n ? ' selected' : ''}>加歲日 ${n} 天內標警告</option>`).join('')}</select>
        <button id="iclear" class="ghost">清除</button><span class="count">${rows.length} / ${Store.insureds.length} 人</span></div>
      ${(() => { const n = Store.insureds.filter(g => g.bump && g.bump.days <= Store.warnDays('ageWarnDays')).length; return n ? `<div class="notice2 small">⚠ ${n} 位被保險人的保險年齡將在 ${Store.warnDays('ageWarnDays')} 天內加 1 歲（保費可能調整；算法以各商品條款為準，請核對）。</div>` : ''; })()}
      <div class="tablewrap"><table><thead><tr>${COLS.map(([k, t]) => `<th data-k="${k}">${E(t)}${s.sort === k ? (s.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(g => `<tr class="row" data-ins="${E(g.name)}"><td><b>${E(g.name)}</b></td><td>${g.customer ? '<span class="tag own" title="此姓名在要保人（客戶檔案）中找得到">要保人</span>' : '<span class="tag" title="要保人（客戶檔案）中找不到這個姓名，只出現在別人保單的被保險人欄">僅被保險人</span>'}</td><td>${g.age != null ? g.age : '<span class="muted" title="缺生日，請在 adoc 的「== 被保險人」補生日">—</span>'}</td><td>${g.insAge != null ? g.insAge : '<span class="muted">—</span>'}</td><td>${this.bumpCell(g)}</td><td>${g.owners.map(c => E(c.name)).join('、')}</td><td>${g.policies.length}</td>${tys.map(t => `<td>${this.mark(g, t)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${COLS.length}" class="empty">沒有符合的被保險人</td></tr>`}
      </tbody></table></div>
      <p class="muted small">被保險人＝保單上的被保險人欄。身分「要保人」＝這個姓名在客戶檔案中找得到；「僅被保險人」＝要保人名單裡找不到這個姓名，只出現在別人保單的被保險人欄（沒有自己的客戶檔案；年齡、保險年齡取自 adoc「== 被保險人」區的生日，沒登錄就是「—」）。「下次加歲日」＝生日後滿 6 個月的隔天，保險年齡 +1。✔ 表示至少有一張保單含該類保障（依商品名稱關鍵字推斷）。</p>`;
    const q = id => el.querySelector(id);
    q('#iq').oninput = e => { s.q = e.target.value; this.render(); const n = q('#iq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
    q('#iwarn').onchange = e => { Store.setting('ageWarnDays', +e.target.value); this.render(); };
    q('#irel').onchange = e => { s.rel = e.target.value; this.render(); };
    q('#itype').onchange = e => { s.type = e.target.value; this.render(); };
    q('#iclear').onclick = () => { Object.assign(s, { q: '', rel: '', type: '' }); this.render(); };
    el.querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { const k = th.dataset.k; if (s.sort === k) s.dir *= -1; else { s.sort = k; s.dir = 1; } this.render(); });
    el.querySelectorAll('tr[data-ins]').forEach(tr => tr.onclick = () => this.openIns(tr.dataset.ins));
  },

  openIns(name, back) {
    const g = Store.insureds.find(x => x.name === name); if (!g) return;
    const E = U.esc, d = document.getElementById('drawer'), again = () => this.openIns(name, back);
    d.hidden = false;
    d.innerHTML = `<div class="hd">${back ? '<button class="ghost" id="dBack">← 返回</button>' : ''}<h2>${E(g.name)} <span class="tag ${g.customer ? 'own' : ''}">${g.customer ? '要保人' : '僅被保險人'}</span></h2><button class="ghost" id="dClose">✕ 關閉</button></div>
      <div class="form">
        ${g.customer ? `<label>客戶檔案</label><div><a href="#" id="iCust">開啟 ${E(g.customer.name)} 的客戶明細</a>${g.customer.age != null ? '（' + g.customer.age + ' 歲）' : ''}</div>` : '<label>說明</label><div class="muted">只出現在別人保單的被保險人欄，沒有自己的客戶檔案。</div>'}
        <label>要保人</label><div>${g.owners.map(c => `<a href="#" data-cust="${E(c.id)}">${E(c.name)}</a>`).join('、')}</div>
        <label>身分證</label><div>${g.detail.id ? E(Store.ov.settings.mask !== false ? U.maskId(g.detail.id) : g.detail.id) + (g.detail.idValid === false ? ' <span class="tag warn">檢查碼不符</span>' : '') : '<span class="muted">未登錄</span>'}</div>
        <label>性別</label><div>${E(g.gender || '未登錄')}${g.detail.genderSrc === '身分證推算' ? '<span class="muted small"> ※身分證推算</span>' : ''}</div>
        <label>生日</label><div>${g.birth ? E(g.birth) : '<span class="warnc">未登錄（無法算保險年齡，請在 adoc「== 被保險人」補上）</span>'}</div>
        <label>年齡</label><div>${g.age != null ? `${g.age} 歲，保險年齡 ${g.insAge} 歲` : '—'}</div>
        ${g.bump ? `<label>加歲日</label><div class="${g.bump.days <= Store.warnDays('ageWarnDays') ? 'warnc' : ''}">${g.bump.days <= Store.warnDays('ageWarnDays') ? '⚠ ' : ''}${E(U.fmtDate(g.bump.date))}（${g.bump.days} 天後）保險年齡 ${g.bump.from}→${g.bump.to} 歲<div class="small muted">${E(this.bumpTip(g))}</div></div>` : ''}
        ${g.detail.occGrade ? `<label>職業等級</label><div>${E(g.detail.occGrade)}</div>` : ''}
        <label>職業</label><div><input type="text" id="iOcc" list="occList" value="${E((Store.ov.ins[g.name] || {}).occupation || g.occupation || '')}" placeholder="例：工程師、醫師、教師"><datalist id="occList">${[...new Set(Store.insureds.map(x => x.occupation).filter(Boolean))].map(o => `<option value="${E(o)}">`).join('')}</datalist> <button id="iOccSave">儲存</button>${g.occSrc ? `<div class="muted small">目前來源：${E(g.occSrc)}${g.occSrc === '補填' && g.detail.occupation ? '（覆蓋 adoc 的「' + E(g.detail.occupation) + '」）' : ''}。存在本機，不改 adoc；清空再儲存即還原。</div>` : '<div class="muted small">存在本機，不改 adoc。</div>'}</div>
      </div>
      <div class="sec">保障（依商品名稱關鍵字推斷）</div>
      <div>${Store.TYPES.map(t => g.types.has(t) ? '✔ ' + E(Store.typeLabel(t)) : '<span class="muted">✘ ' + E(Store.typeLabel(t)) + '</span>').join('　')}</div>
      <div class="sec">保單（${g.policies.length} 張）</div>
      ${g.policies.map(p => `<div class="pol"><div><a href="#" data-pol="${E(p.key)}"><b>${E(p.no)}</b></a> <span class="tag">${E(p.status || '狀態未填')}</span>${p.payMode ? ' <span class="tag">' + E(p.payMode) + '</span>' : ''}</div>
        <div class="small muted">要保人：${E(p.owner.name)}${p.start ? '｜保險始期 ' + E(p.start) : ''}</div>
        <div class="small muted">受益人：${Policy.beneText(p)}</div>
        <ul>${p.items.map(i => `<li>${E(i.name)}${i.amount ? ' <span class="muted">' + E(i.amount) + '</span>' : ''}${i.rider ? ' <span class="tag">附約</span>' : ''}</li>`).join('')}</ul></div>`).join('')}`;
    d.querySelector('#dClose').onclick = () => { d.hidden = true; };
    if (back) d.querySelector('#dBack').onclick = back;
    d.querySelector('#iOccSave').onclick = () => { const v = d.querySelector('#iOcc').value.trim(); Store.setInsExtra(g.name, { occupation: v === (g.detail.occupation || '') ? '' : v }); U.toast('已儲存'); App.refresh(); this.openIns(name, back); };
    const ic = d.querySelector('#iCust'); if (ic) ic.onclick = e => { e.preventDefault(); List.open(g.customer.id, again); };
    d.querySelectorAll('[data-cust]').forEach(a => a.onclick = e => { e.preventDefault(); List.open(a.dataset.cust, again); });
    d.querySelectorAll('[data-pol]').forEach(a => a.onclick = e => { e.preventDefault(); Policy.openPol(a.dataset.pol, again); });
  },
};
