/* 待辦提醒：繳費、加歲、下次拜訪、生日。
 * - 「待辦」分頁：不用建立排程也看得到
 * - 排程匯出 .ics 時，把行程客戶的所有待辦一併寫進行事曆
 * - 拜訪紀錄（日期、客戶、紀錄、下次動作）匯出 CSV
 * 日期都由資料推算（繳費日＝保險始期＋繳別；加歲日＝生日後滿 6 個月隔天），實際以公司通知／條款為準。 */
const Reminders = {
  KINDS: { due: '繳費', bump: '加歲', visit: '下次拜訪', bday: '生日' },
  ALARM: { due: '-P3D', bump: '-P7D', visit: '-P1D', bday: '-P1D' },
  st: { kinds: new Set(['due', 'bump', 'visit', 'bday']) },
  days() { const v = +Store.ov.settings.remDays; return v > 0 ? v : 60; },

  /* 單一客戶的所有待辦（不受提醒範圍限制：排程匯出行事曆用） */
  /* 以要保人／客戶建索引，避免 5000 位客戶 × 數千張保單的 O(n²) 搜尋 */
  index() {
    if (this._ix && this._ix.p === Store.policies && this._ix.i === Store.insureds) return this._ix;
    const pol = new Map(), ins = new Map(), add = (m, k, v) => { (m.get(k) || m.set(k, []).get(k)).push(v); };
    Store.policies.forEach(p => add(pol, p.owner, p));
    Store.insureds.forEach(g => { const seen = new Set(); if (g.customer) { add(ins, g.customer, g); seen.add(g.customer); } g.owners.forEach(o => { if (!seen.has(o)) { add(ins, o, g); seen.add(o); } }); });
    return (this._ix = { p: Store.policies, i: Store.insureds, pol, ins });
  },
  forCustomer(c, now) {
    now = now || U.today(); const ix = this.index();
    const out = [], mk = (kind, date, title, detail, key) => out.push({ kind, date, days: U.daysBetween(now, date), title, detail, cust: c, key });
    (ix.pol.get(c) || []).filter(p => p.due && p.due.date).forEach(p =>
      mk('due', p.due.date, `繳費 ${c.name}／${p.no}`, `繳別：${p.payMode}${p.payModeDef ? '（預設）' : ''}；由保險始期 ${p.start} 推算，實際以公司通知為準`, `due-${p.key}-${U.iso(p.due.date)}`));
    (ix.ins.get(c) || []).filter(g => g.bump).forEach(g =>
      mk('bump', g.bump.date, `加歲 ${g.name}（${g.bump.from}→${g.bump.to} 歲）`, `保險年齡 ${g.bump.from} 歲 → ${g.bump.to} 歲；保費可能調整，實際依各商品條款`, `bump-${g.name}-${U.iso(g.bump.date)}`));
    const nv = U.parseIso(c.nextVisit);
    if (nv) mk('visit', nv, `拜訪 ${c.name}`, '客戶資料中的「下次拜訪」', `visit-${c.id}-${U.iso(nv)}`);
    const b = U.parseIso(c.birth);
    if (b) {
      let d = new Date(now.getFullYear(), b.getMonth(), b.getDate()); if (d < now) d = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
      mk('bday', d, `生日 ${c.name}`, '', `bday-${c.id}-${U.iso(d)}`);
    }
    return out;
  },
  /* 全部客戶：依提醒範圍篩選（逾期的下次拜訪一律顯示），同一加歲只算一次 */
  all(opt = {}) {
    const n = opt.days == null ? this.days() : opt.days, seen = new Set(), out = [];
    Store.list.forEach(c => this.forCustomer(c).forEach(it => {
      if (seen.has(it.key)) return;
      if (it.days > n && !(opt.noWindow)) return;
      seen.add(it.key); out.push(it);
    }));
    return out.sort((a, b) => a.days - b.days || U.coll.compare(a.title, b.title));
  },
  urgent() { return this.all({ days: 7 }).length; },
  updateBadge() {
    const b = document.querySelector('[data-tab=rem]'); if (!b) return;
    const n = Store.list.length ? this.urgent() : 0;
    b.innerHTML = '待辦' + (n ? ` <span class="cnt warn" title="7 天內與已逾期">${n}</span>` : '');
  },
  when(it) { return it.days < 0 ? `逾期 ${-it.days} 天` : it.days === 0 ? '今天' : it.days > 90 ? '超過三個月' : it.days + ' 天後'; },

  /* ---- .ics：全天事件＋提前提醒 ---- */
  vevents(items, stamp) {
    const esc = t => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const ymd = d => U.iso(d).replace(/-/g, ''), nxt = d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const out = [];
    items.forEach(it => out.push('BEGIN:VEVENT', `UID:${esc(it.key)}@customer-tool.local`, 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + ymd(it.date), 'DTEND;VALUE=DATE:' + ymd(nxt(it.date)), 'SUMMARY:' + esc(it.title), 'DESCRIPTION:' + esc(it.detail),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(it.title), 'TRIGGER:' + this.ALARM[it.kind], 'END:VALARM', 'END:VEVENT'));
    return out;
  },
  stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); },
  ics(items) {
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//customer-tool//ZH-TW', 'CALSCALE:GREGORIAN', ...this.vevents(items, this.stamp()), 'END:VCALENDAR'].join('\r\n') + '\r\n';
  },

  /* ---- 拜訪紀錄 CSV ---- */
  visitRows() {
    const rows = [];
    Object.keys(Store.ov.visits).sort().forEach(dt => {
      const v = Store.ov.visits[dt], rec = v.rec || {};
      v.ids.forEach(id => {
        const c = Store.get(id); if (!c) return;
        const r = rec[id] || {};
        rows.push({ id, date: dt, name: c.name, done: !!(v.done || {})[id], note: r.note || '', next: r.next || '', circle: c.circle || '' });
      });
    });
    return rows;
  },
  visitsFor(id) { return this.visitRows().filter(r => r.id === id).reverse(); },
  csv(rows) {
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    return '\ufeff' + [['日期', '客戶', '是否已拜訪', '拜訪紀錄', '下次動作', '生活圈'], ...rows.map(r => [r.date, r.name, r.done ? '是' : '否', r.note, r.next, r.circle])].map(l => l.map(q).join(',')).join('\r\n') + '\r\n';
  },
  exportVisits() {
    const rows = this.visitRows();
    if (!rows.length) { U.toast('還沒有拜訪排程或紀錄'); return; }
    U.download(`拜訪紀錄_${U.iso(U.today())}.csv`, this.csv(rows), 'text/csv;charset=utf-8');
  },

  /* ---- 待辦分頁 ---- */
  render() {
    const el = document.getElementById('tab-rem'), E = U.esc, m = Store.ov.settings.mask !== false;
    if (!Store.list.length) { el.innerHTML = '<div class="card empty">沒有客戶資料</div>'; return; }
    const n = this.days(), items = this.all().filter(it => this.st.kinds.has(it.kind));
    const grp = [['逾期', it => it.days < 0], ['7 天內', it => it.days >= 0 && it.days <= 7], ['之後', it => it.days > 7]];
    const row = it => `<tr class="row" data-cust="${E(it.cust.id)}"><td class="${it.days <= 7 ? 'warnc' : ''}">${E(U.fmtDate(it.date))}（${E(this.when(it))}）</td><td><span class="tag${it.kind === 'due' || it.days < 0 ? ' warn' : ''}">${E(this.KINDS[it.kind])}</span></td><td class="wrap">${E(it.title)}<div class="muted small">${E(it.detail)}</div></td><td>${Store.callBtns(it.cust, m) || '<span class="muted">無</span>'}</td></tr>`;
    el.innerHTML = `<div class="card"><h2>待辦提醒</h2>
      <div class="opts"><label>範圍<select id="rDays">${[14, 30, 60, 90, 180].map(x => `<option value="${x}"${x === n ? ' selected' : ''}>${x} 天內</option>`).join('')}</select></label>
        ${Object.entries(this.KINDS).map(([k, t]) => `<label class="chk"><input type="checkbox" data-k="${k}"${this.st.kinds.has(k) ? ' checked' : ''}> ${t}</label>`).join(' ')}
        <button id="rIcs"${items.length ? '' : ' disabled'} title="下載 .ics，匯入 iPhone 行事曆／Google 日曆，會提前提醒">全部加入行事曆（${items.length}）</button></div>
      ${grp.map(([t, f]) => { const xs = items.filter(f); return xs.length ? `<h3>${t}（${xs.length}）</h3><div class="tablewrap"><table><tbody>${xs.map(row).join('')}</tbody></table></div>` : ''; }).join('') || '<div class="empty">這段期間沒有待辦。</div>'}
      <p class="muted small">繳費日由保險始期＋繳別推算；加歲日＝生日後滿 6 個月的隔天；實際以公司通知與各商品條款為準。建立排程時，行程客戶的所有待辦會自動一起寫進行事曆。.ics 內含客戶姓名與保單號碼，請自行保管。</p></div>`;
    el.querySelector('#rDays').onchange = e => { Store.setting('remDays', +e.target.value); this.render(); };
    el.querySelectorAll('[data-k]').forEach(c => c.onchange = () => { c.checked ? this.st.kinds.add(c.dataset.k) : this.st.kinds.delete(c.dataset.k); this.render(); });
    const b = el.querySelector('#rIcs'); if (b) b.onclick = () => U.download(`待辦提醒_${U.iso(U.today())}.ics`, this.ics(items), 'text/calendar;charset=utf-8');
    el.querySelectorAll('tr[data-cust]').forEach(tr => tr.onclick = ev => { if (ev.target.closest('a,button')) return; List.open(tr.dataset.cust); });
  },
};
