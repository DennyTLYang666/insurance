/* 保單分頁：全部保單，以及依保險類型（防癌、意外傷害、住院醫療、壽險…）的第二層頁籤 */
const Policy = {
  st: { sub: 'all', q: '', status: '', rel: '', type: '', sort: 'owner', dir: 1, limit: 200 },

  subs() {
    const P = Store.policies, out = [['all', '全部保單', P.length]];
    Store.TYPES.forEach(t => { const n = P.filter(p => p.types.has(t)).length; if (n) out.push([t, Store.typeLabel(t), n]); });
    const other = P.filter(p => p.items.some(i => !i.type)).length;
    if (other) out.push(['_other', '其他', other]);     // 沒對到關鍵字的商品；沒有就不顯示
    return out;
  },
  itemsHtml(p) {
    return p.items.map(i => `<div>${U.esc(i.name)}${i.amount ? ' <span class="muted">' + U.esc(i.amount) + '</span>' : ''}${i.rider ? ' <span class="tag">附約</span>' : ''}</div>`).join('') || '<span class="muted">無明細</span>';
  },
  typeTags(p) { return [...p.types].sort((a, b) => Store.TYPES.indexOf(a) - Store.TYPES.indexOf(b)).map(t => `<span class="tag">${U.esc(Store.typeLabel(t))}</span>`).join(' ') || '<span class="muted">—</span>'; },
  /* 受益人：照 adoc 列出（可能是各險種各自指定，因此重複的名字不合併，只提示） */
  beneText(p) {
    if (!p.bene.length) return '<span class="warnc">未登錄</span>';
    const dup = new Set(p.bene.filter((x, i) => p.bene.indexOf(x) !== i));
    return p.bene.map(x => U.esc(x)).join('、') + (dup.size ? ' <span class="muted small" title="同一個名字出現多次，可能是不同險種各自指定，請對照要保書">（有重複）</span>' : '');
  },
  /* 即將繳費提醒（範圍可調） */
  dueBanner() {
    const list = Store.dueSoon(), n = Store.warnDays('payWarnDays');
    if (!list.length) return '';
    const m = Store.ov.settings.mask !== false, E = U.esc;
    return `<div class="card" style="margin-bottom:12px"><h2>⚠ 即將繳費（${n} 天內，${list.length} 張）</h2><div class="tablewrap"><table><tbody>
      ${list.map(p => `<tr class="row" data-pol="${E(p.key)}"><td class="warnc">${E(U.fmtDate(p.due.date))}（${p.due.days === 0 ? '今天' : p.due.days + ' 天後'}）</td><td>${E(p.no)}</td><td>${this.custLink(p.owner)}</td><td>${Store.callBtns(p.owner, m)}</td><td>${E(p.payMode)}${p.payModeDef ? '<span class="muted small">（預設）</span>' : ''}</td><td>${p.due.kind === 'rider' ? '<span class="tag" title="主約繳費期滿，附約是否續繳依條款（推定）">附約?</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div><div class="actions"><button id="pics" title="下載 .ics，匯入 Google 日曆／iPhone 行事曆，繳費前 3 天提醒">加入日曆（.ics）</button></div>
      <p class="muted small">日期由保險始期＋繳別推算，實際繳費日以公司通知為準。.ics 內含保單號碼與要保人姓名，請自行保管。</p></div>`;
  },
  dueIcs() {
    const list = Store.dueSoon(), esc = t => String(t).replace(/[\\;,]/g, m => '\\' + m), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ymd = d => U.fmtDate(d).replace(/-/g, ''), nxt = d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//customer-tool//ZH-TW', 'CALSCALE:GREGORIAN'];
    list.forEach(p => out.push('BEGIN:VEVENT', `UID:due-${p.key.replace(/#/g, '-')}-${ymd(p.due.date)}@customer-tool`, 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + ymd(p.due.date), 'DTEND;VALUE=DATE:' + ymd(nxt(p.due.date)),
      'SUMMARY:' + esc(`繳費 ${p.owner.name}／${p.no}`), 'DESCRIPTION:' + esc(`繳別：${p.payMode}；由保險始期 ${p.start} 推算，實際以公司通知為準`),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(`繳費提醒 ${p.no}`), 'TRIGGER:-P3D', 'END:VALARM', 'END:VEVENT'));
    out.push('END:VCALENDAR');
    U.download(`繳費提醒_${U.iso(U.today())}.ics`, out.join('\r\n'), 'text/calendar');
  },
  updateBadge() {
    const b = document.querySelector('[data-tab=policy]'); if (!b) return;
    const n = Store.policies.length ? Store.dueSoon().length : 0;
    b.innerHTML = '保單' + (n ? ` <span class="cnt warn" title="${Store.warnDays('payWarnDays')} 天內要繳費">${n}</span>` : '');
  },
  /* 下次繳費欄 */
  dueCell(p) {
    const d = p.due, n = Store.warnDays('payWarnDays');
    switch (d.kind) {
      case 'due': case 'rider': {
        const soon = d.days <= n;
        return `<span class="${soon ? 'warnc' : ''}" title="${U.esc(this.dueTip(p))}">${soon ? '⚠ ' : ''}${U.fmtDate(d.date)}（${d.days === 0 ? '今天' : d.days + ' 天後'}）${d.kind === 'rider' ? '<span class="tag" title="主約繳費期滿，附約是否續繳依條款（推定）">附約?</span>' : ''}</span>`;
      }
      case 'paidup': return '<span class="muted" title="主約繳費期滿，且沒有附約">繳費期滿</span>';
      case 'stopped': return '<span class="muted">已停止繳費</span>';
      case 'single': return '<span class="muted">躉繳</span>';
      default: return '<span class="warnc" title="adoc 沒有保險始期，無法推算">缺始期</span>';
    }
  },
  dueTip(p) {
    const d = p.due;
    return `由保險始期 ${p.start} 與繳別「${p.payMode}${p.payModeDef ? '（預設）' : ''}」推算，每 ${d.period} 個月一期。` + (d.kind === 'rider' ? '主約已繳費期滿，這裡是因為含附約而推算，附約是否仍需續繳請依條款與繳費通知。' : '') + '實際繳費日以保險公司通知為準（寬限期、繳費方式不同可能有差異）。';
  },
  custLink(c) { return `<a href="#" data-cust="${U.esc(c.id)}">${U.esc(c.name)}</a>`; },
  insLink(p) { return `<a href="#" data-ins="${U.esc(p.insuredName)}">${U.esc(p.insuredName)}</a>${p.self ? '' : ' <span class="tag warn">他人</span>'}${p.insured ? '' : ' <span class="tag warn">未填</span>'}`; },

  val(p, k) {
    switch (k) {
      case 'owner': return p.owner.name;
      case 'insured': return p.insuredName;
      case 'types': return [...p.types].join('');
      case 'due': return p.due.date ? U.fmtDate(p.due.date) : '9999';
      default: return p[k] || '';
    }
  },
  filtered() {
    const s = this.st, q = s.q.trim().toLowerCase();
    const kept = Store.policies.filter(p => {
      if (s.status && p.status !== s.status) return false;
      if (s.rel === 'self' && !p.self) return false;
      if (s.rel === 'other' && p.self) return false;
      if (s.type && !p.types.has(s.type)) return false;
      if (s.dueOnly && !(p.due.date && p.due.days <= Store.warnDays('payWarnDays'))) return false;
      if (q && ![p.no, p.owner.name, p.insuredName, p.status, p.items.map(i => i.raw).join(' ')].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    const kv = new Map(kept.map(p => [p, String(this.val(p, s.sort))]));   // 排序鍵只算一次
    return kept.sort((a, b) => U.coll.compare(kv.get(a), kv.get(b)) * s.dir || a.no.localeCompare(b.no));
  },

  render() {
    const el = document.getElementById('tab-policy');
    if (!Store.policies.length) { el.innerHTML = '<div class="card empty">還沒有登錄任何保單。在客戶 adoc 的「== 保單」底下登錄後，這裡就會出現。</div>'; return; }
    const subs = this.subs();
    if (!subs.some(x => x[0] === this.st.sub)) this.st.sub = 'all';
    el.innerHTML = `<div class="subtabs" role="tablist">${subs.map(([k, label, n]) => `<button role="tab" data-sub="${U.esc(k)}" class="${k === this.st.sub ? 'on' : ''}">${U.esc(label)} <span class="cnt">${n}</span></button>`).join('')}</div>
      <div id="polBody">${this.st.sub === 'all' ? this.bodyAll() : this.bodyType(this.st.sub)}</div>`;
    this.bind(el);
  },

  bodyAll() {
    const s = this.st, rows = this.filtered(), P = Store.policies, pg = U.page(s, rows);
    const COLS = [['no', '保單號碼'], ['owner', '要保人'], ['insured', '被保險人'], ['start', '保險始期'], ['status', '狀態'], ['payMode', '繳別'], ['due', '下次繳費 ⚠'], ['types', '保障類型'], ['', '明細（保額）']];
    const types = Store.TYPES.filter(t => P.some(p => p.types.has(t)));
    return `<div class="filters">
        <input type="search" id="pq" placeholder="搜尋 保單號碼/要保人/被保險人/商品" value="${U.esc(s.q)}">
        <select id="pstatus">${List.opts(P.map(p => p.status), s.status).replace('全部', '全部狀態')}</select>
        <select id="prel"><option value="">被保險人不限</option><option value="self"${s.rel === 'self' ? ' selected' : ''}>本人</option><option value="other"${s.rel === 'other' ? ' selected' : ''}>他人</option></select>
        <select id="ptype"><option value="">保障類型不限</option>${types.map(t => `<option value="${t}"${s.type === t ? ' selected' : ''}>${U.esc(Store.typeLabel(t))}</option>`).join('')}</select>
        <select id="pdue" title="繳費提醒範圍">${[7, 14, 30, 60, 90].map(n => `<option value="${n}"${Store.warnDays('payWarnDays') === n ? ' selected' : ''}>繳費 ${n} 天內標警告</option>`).join('')}</select>
        <label class="chk"><input type="checkbox" id="pdueonly"${s.dueOnly ? ' checked' : ''}> 只看即將繳費</label>
        <button id="pclear" class="ghost">清除</button><span class="count">${rows.length} / ${P.length} 張</span></div>
      ${this.dueBanner()}
      <div class="tablewrap"><table><thead><tr>${COLS.map(([k, t]) => `<th class="${k ? '' : 'nosort'}" data-k="${k}">${t}${s.sort === k ? (s.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>
        ${pg.shown.map(p => `<tr class="row" data-pol="${U.esc(p.key)}"><td>${U.esc(p.no)}</td><td>${this.custLink(p.owner)}</td><td>${this.insLink(p)}</td><td>${U.esc(p.start || '—')}</td><td><span class="tag">${U.esc(p.status || '未填')}</span></td><td>${U.esc(p.payMode || '—')}</td><td>${this.dueCell(p)}</td><td class="wrap">${this.typeTags(p)}</td><td class="wrap">${this.itemsHtml(p)}</td></tr>`).join('') || `<tr><td colspan="${COLS.length}" class="empty">沒有符合的保單</td></tr>`}
      </tbody></table></div>${pg.foot}
      <p class="muted small">「下次繳費」由保險始期＋繳別推算（繳別沒填視為年繳）：主約繳費期滿且無附約者不顯示；主約繳費期滿但含附約者仍推算並標「附約?」（附約是否續繳依條款，屬推定）。點一列看保單內容；點「要保人」「被保險人」看對應的人。要保人＝保單所在的客戶檔案；保障類型是依商品名稱關鍵字推斷。</p>`;
  },

  bodyType(t) {
    const other = t === '_other', E = U.esc;
    const hit = it => other ? !it.type : it.type === t;
    const groups = new Map();
    Store.policies.forEach(p => p.items.forEach(it => { if (hit(it)) { if (!groups.has(it.name)) groups.set(it.name, []); groups.get(it.name).push({ p, it }); } }));
    const gs = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || U.coll.compare(a[0], b[0]));
    const polsOfType = Store.policies.filter(p => p.items.some(hit));
    const owners = new Set(polsOfType.map(p => p.owner)), insureds = new Set(polsOfType.map(p => p.insuredName));
    const have = other ? [] : Store.list.filter(c => c.ownTypes.has(t)), lack = other ? [] : Store.list.filter(c => !c.ownTypes.has(t));
    const label = other ? '其他' : Store.typeLabel(t);
    return `<div class="card"><h2>${E(label)}</h2>
      <div>${polsOfType.length} 張保單｜要保人 ${owners.size} 位｜被保險人 ${insureds.size} 人</div>
      <div class="actions">
        ${other ? '' : `<button id="tHave">本人有此保障的客戶（${have.length}）</button><button id="tLack">本人沒有此保障的客戶（${lack.length}）</button>`}
        <button id="tIns">從被保險人角度看（${insureds.size}）</button></div>
      ${other ? '<p class="muted small">這些商品名稱沒有符合防癌／傷害／醫療／壽險關鍵字，請確認是否需要新增分類。</p>' : '<p class="muted small">「本人」＝該保單的被保險人是要保人自己；依商品名稱關鍵字推斷，非保單條款。</p>'}</div>
      ${gs.map(([name, arr]) => `<div class="card" style="margin-top:12px"><h3>${E(name)}（${arr.length} 張／要保人 ${new Set(arr.map(x => x.p.owner)).size} 位）</h3>
        <div class="tablewrap"><table><thead><tr><th class="nosort">保單號碼</th><th class="nosort">要保人</th><th class="nosort">被保險人</th><th class="nosort">保額</th><th class="nosort">保單狀態</th><th class="nosort">繳別</th></tr></thead><tbody>
        ${arr.map(({ p, it }) => `<tr class="row" data-pol="${E(p.key)}"><td>${E(p.no)}</td><td>${this.custLink(p.owner)}</td><td>${this.insLink(p)}</td><td>${E(it.amount || '—')}${it.rider ? ' <span class="tag">附約</span>' : ''}</td><td><span class="tag">${E(p.status || '未填')}</span></td><td>${E(p.payMode || '—')}</td></tr>`).join('')}
        </tbody></table></div></div>`).join('')}`;
  },

  bind(el) {
    const s = this.st, again = () => this.render();
    el.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { s.sub = b.dataset.sub; this.render(); });
    const q = id => el.querySelector(id);
    if (s.sub === 'all') {
      q('#pq').oninput = e => { s.q = e.target.value; s.limit = 200; this.render(); const n = q('#pq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      q('#pstatus').onchange = e => { s.status = e.target.value; s.limit = 200; this.render(); };
      q('#prel').onchange = e => { s.rel = e.target.value; s.limit = 200; this.render(); };
      q('#ptype').onchange = e => { s.type = e.target.value; s.limit = 200; this.render(); };
      U.bindPage(el, s, again);
      const pi = q('#pics'); if (pi) pi.onclick = () => this.dueIcs();
      q('#pdue').onchange = e => { Store.setting('payWarnDays', +e.target.value); this.render(); App.updateBadges(); };
      q('#pdueonly').onchange = e => { s.dueOnly = e.target.checked; this.render(); };
      q('#pclear').onclick = () => { Object.assign(s, { q: '', status: '', rel: '', type: '', dueOnly: false, limit: 200 }); this.render(); };
      el.querySelectorAll('th[data-k]').forEach(th => { if (th.dataset.k) th.onclick = () => { const k = th.dataset.k; if (s.sort === k) s.dir *= -1; else { s.sort = k; s.dir = 1; } this.render(); }; });
    } else if (s.sub !== '_other') {
      const t = s.sub, L = Store.list;
      const have = L.filter(c => c.ownTypes.has(t)), lack = L.filter(c => !c.ownTypes.has(t)), name = Store.typeLabel(t);
      const showHave = () => Drill.open(`本人有「${name}」的客戶`, have, L.length, { label: `看本人沒有的 ${lack.length} 位`, run: showLack });
      const showLack = () => Drill.open(`本人沒有「${name}」的客戶`, lack, L.length, { label: `看本人有的 ${have.length} 位`, run: showHave });
      q('#tHave').onclick = showHave; q('#tLack').onclick = showLack;
    }
    const ti = q('#tIns'); if (ti) ti.onclick = () => { Insured.st.type = (s.sub === '_other' ? '' : 'has:' + s.sub); Insured.st.q = ''; Insured.st.rel = ''; App.show('insured'); };
    el.querySelectorAll('tr[data-pol]').forEach(tr => tr.onclick = () => this.openPol(tr.dataset.pol));
    el.querySelectorAll('[data-cust]').forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); List.open(a.dataset.cust); });
    el.querySelectorAll('[data-ins]').forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); Insured.openIns(a.dataset.ins); });
  },

  /* ---------- 單張保單內容 ---------- */
  openPol(key, back) {
    const p = Store.getPolicy(key); if (!p) return;
    const E = U.esc, d = document.getElementById('drawer'), again = () => this.openPol(key, back);
    d.hidden = false;
    d.innerHTML = `<div class="hd">${back ? '<button class="ghost" id="dBack">← 返回</button>' : ''}<h2>保單 ${E(p.no)}</h2><button class="ghost" id="dClose">✕ 關閉</button></div>
      <div class="form">
        <label>要保人</label><div><a href="#" id="oCust">${E(p.owner.name)}</a> <span class="muted small">（保單所在的客戶檔案）</span></div>
        <label>被保險人</label><div><a href="#" id="oIns">${E(p.insuredName)}</a>${p.self ? ' <span class="tag">本人</span>' : ' <span class="tag warn">他人</span>'}${p.insured ? '' : ' <span class="tag warn">adoc 未填，暫視為本人</span>'}</div>
        <label>保險始期</label><div>${p.start ? E(p.start) : '<span class="warnc">未登錄</span>'}</div>
        <label>狀態</label><div>${E(p.status || '未填')}</div>
        <label>繳別</label><div>${E(p.payMode)}${p.payModeDef ? ' <span class="muted small">（adoc 未填，預設年繳）</span>' : ''}</div>
        <label>下次繳費</label><div>${this.dueCell(p)}</div>
        <label>受益人</label><div>${this.beneText(p)}</div>
        ${Object.entries(p.extra || {}).map(([k, v]) => `<label>${E(k)}</label><div>${E(v)}</div>`).join('')}
      </div>
      <div class="sec">明細（${p.items.length} 項）</div>
      <table><thead><tr><th class="nosort">商品</th><th class="nosort">保額</th><th class="nosort">類型</th></tr></thead><tbody>
      ${p.items.map(i => `<tr><td class="wrap">${E(i.name)}${i.rider ? ' <span class="tag">附約</span>' : ''}</td><td>${E(i.amount || '—')}</td><td>${E(i.type ? Store.typeLabel(i.type) : '其他')}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">沒有明細</td></tr>'}</tbody></table>
      ${Cover.policyHtml(p)}
      <p class="muted small">保障類型依商品名稱關鍵字推斷。保額單位依 adoc 原文（萬／元／計劃／單位），未換算。</p>`;
    d.querySelector('#dClose').onclick = () => { d.hidden = true; };
    if (back) d.querySelector('#dBack').onclick = back;
    d.querySelector('#oCust').onclick = e => { e.preventDefault(); List.open(p.owner.id, again); };
    d.querySelector('#oIns').onclick = e => { e.preventDefault(); Insured.openIns(p.insuredName, again); };
  },
};
