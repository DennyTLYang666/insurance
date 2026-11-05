/* 清單分頁＋客戶明細抽屜 */
const List = {
  anchor: null,     // 上一次點選的客戶 id（Shift 連選的起點）
  sel: new Set(),   // 勾選的客戶 id（切換篩選仍保留）
  st: { q: '', status: '', district: '', circle: '', band: '', policy: '', visit: '', sort: 'status', dir: 1, group: '' },
  COLS: [
    ['status', '狀態'], ['visit', '拜訪'], ['name', '姓名'], ['id', '身分證'], ['gender', '性別'], ['age', '年齡/保險年齡'],
    ['birth', '生日'], ['mobile', '手機'], ['home', '市話'], ['district', '縣市區'], ['circle', '生活圈'],
    ['addr', '地址（點🧭導航）'], ['occupation', '職業'], ['policy', '保單(張)'], ['nextVisit', '下次拜訪'], ['warn', '提醒'],
  ],
  val(c, k) {
    switch (k) {
      case 'status': return Store.statuses().indexOf(c.status);
      case 'visit': return c.lastVisit || (c.planned ? 'a' + c.planned : '0');
      case 'age': return c.age == null ? -1 : c.age;
      case 'mobile': return c.mobiles[0] || '';
      case 'home': return c.homes[0] || '';
      case 'district': return c.city + c.district;
      case 'addr': return c.roadKey + String(c.addr && c.addr.number || 0).padStart(5, '0');
      case 'policy': return c.policies.length;
      case 'warn': return c.warnings.length;
      default: return c[k] == null ? '' : c[k];
    }
  },
  filtered() {
    const s = this.st, q = s.q.trim().toLowerCase();
    return Store.list.filter(c => {
      if (s.status && c.status !== s.status) return false;
      if (s.district && (c.city + c.district) !== s.district) return false;
      if (s.circle && c.circle !== s.circle) return false;
      if (s.band && c.band !== s.band) return false;
      if (s.policy === 'has' && !c.policies.length) return false;
      if (s.policy === 'none' && c.policies.length) return false;
      if (s.visit === 'no' && c.visited) return false;
      if (s.visit === 'yes' && !c.visited) return false;
      if (q) {
        const hay = [c.name, c.id, c.mobiles.join(' '), c.homes.join(' '), c.addresses.map(a => a.raw).join(' '), c.occupation, c.note, c.circle,
          c.policies.map(p => p.no + ' ' + p.insured + ' ' + p.items.map(i => i.raw).join(' ')).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const x = this.val(a, s.sort), y = this.val(b, s.sort);
      const r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'zh-Hant');
      return (r || a.name.localeCompare(b.name, 'zh-Hant')) * s.dir;
    });
  },
  opts(vals, cur) {
    return '<option value="">全部</option>' + [...new Set(vals)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-Hant'))
      .map(v => `<option${v === cur ? ' selected' : ''}>${U.esc(v)}</option>`).join('');
  },
  confTag(c) {
    return c === '待確認' || c === '同路推定' ? ` <span class="tag warn" title="${c === '同路推定' ? '同一條路已有客戶登錄此生活圈，自動沿用' : '分類規則待確認'}">${U.esc(c)}</span>` : '';
  },
  visitTag(c) {
    if (c.visited) return `<span class="tag own" title="最近拜訪 ${U.esc(c.lastVisit)}">已拜訪 ${U.esc(c.lastVisit.slice(5))}</span>`;
    return `<span class="tag todo">未拜訪</span>` + (c.planned ? ` <span class="tag" title="已排程">排 ${U.esc(c.planned.slice(5))}</span>` : '');
  },
  cell(c, k, m) {
    const E = U.esc;
    switch (k) {
      case 'status': return `<span class="tag ${Store.statusClass(c.status)}">${E(c.status)}</span>`;
      case 'visit': return this.visitTag(c);
      case 'name': return E(c.name);
      case 'id': return E(m ? U.maskId(c.id) : c.id) + (c.idValid ? '' : ' <span class="tag warn" title="檢查碼不符">?</span>');
      case 'gender': return E(c.gender || '—') + (c.genderSrc === '身分證推算' ? '<span class="muted small" title="由身分證第 2 碼推算"> ※</span>' : '');
      case 'age': return c.age == null ? '<span class="muted">—</span>' : `${c.age} / ${c.insAge}`;
      case 'birth': return E(c.birth || '—');
      case 'mobile': return c.mobiles.map(p => `<a class="call" href="#" role="button" data-tel="${E(p)}" title="撥打電話">📱 ${E(m ? U.maskPhone(p) : U.fmtPhone(p))}</a>`).join('<br>') || '—';
      case 'home': return c.homes.map(p => `<a class="call" href="#" role="button" data-tel="${E(p)}" title="撥打電話">☎ ${E(m ? U.maskPhone(p) : U.fmtPhone(p))}</a>`).join('<br>') || '—';
      case 'district': return E((c.city + c.district) || '—');
      case 'circle': return E(c.circle || '—') + this.confTag(c.circleConf);
      case 'addr': return c.addr ? Store.navBtn(c, '', c.addr) + ' ' + E(Store.addrText(c, m)) : '—';
      case 'occupation': return c.occupation ? E(c.occupation) : '<span class="muted">未填</span>';
      case 'policy': return c.policies.length ? `${c.policies.length}` + (c.otherInsured.length ? `<span class="muted small" title="含他人為被保險人：${E(c.otherInsured.join('、'))}"> +他人</span>` : '') : '<span class="muted">0</span>';
      case 'nextVisit': return E(c.nextVisit || '') || '<span class="muted">—</span>';
      case 'warn': return c.warnings.length ? `<span class="tag warn" title="${E(c.warnings.join('\n'))}">${c.warnings.length}</span>` : '';
    }
    return '';
  },
  render() {
    const el = document.getElementById('tab-list'), s = this.st, m = Store.ov.settings.mask !== false;
    if (!Store.list.length) { el.innerHTML = '<div class="card empty">沒有客戶資料。請確認 <code>客戶/</code> 資料夾內有 .adoc，並用 scripts\\serve.bat 開啟，或先執行 scripts\\build.bat。</div>'; return; }
    const rows = this.filtered();
    let body = '', lastG = null;
    const gk = c => s.group === 'district' ? (c.city + c.district) : s.group === 'circle' ? c.circle : s.group === 'status' ? c.status : null;
    rows.forEach(c => {
      if (s.group) {
        const g = gk(c);
        if (g !== lastG) { lastG = g; const n = rows.filter(x => gk(x) === g).length; body += `<tr class="grp"><td colspan="${this.COLS.length + 1}">${U.esc(g || '未填')}（${n}）</td></tr>`; }
      }
      body += `<tr class="row" data-id="${U.esc(c.id)}"><td class="selc"><input type="checkbox" class="rowsel" data-id="${U.esc(c.id)}" aria-label="勾選 ${U.esc(c.name)}"${this.sel.has(c.id) ? ' checked' : ''}></td>${this.COLS.map(([k]) => `<td>${this.cell(c, k, m)}</td>`).join('')}</tr>`;
    });
    const L = Store.list;
    el.innerHTML = `
      <div class="filters">
        <input type="search" id="fq" placeholder="搜尋 姓名/電話/地址/備註/保單" value="${U.esc(s.q)}">
        <select id="fstatus" title="狀態">${this.opts(Store.statuses(), s.status).replace('全部', '全部狀態')}</select>
        <select id="fvisit" title="拜訪"><option value="">拜訪不限</option><option value="no"${s.visit === 'no' ? ' selected' : ''}>未拜訪</option><option value="yes"${s.visit === 'yes' ? ' selected' : ''}>已拜訪</option></select>
        <select id="fdistrict" title="縣市區">${this.opts(L.map(c => c.city + c.district), s.district).replace('全部', '全部縣市區')}</select>
        <select id="fcircle" title="生活圈">${this.opts(L.map(c => c.circle), s.circle).replace('全部', '全部生活圈')}</select>
        <select id="fband" title="年齡">${this.opts(U.bandOrder.filter(b => L.some(c => c.band === b)), s.band).replace('全部', '全部年齡')}</select>
        <select id="fpolicy" title="保單"><option value="">保單不限</option><option value="has"${s.policy === 'has' ? ' selected' : ''}>有登錄保單</option><option value="none"${s.policy === 'none' ? ' selected' : ''}>未登錄保單</option></select>
        <select id="fgroup" title="分組"><option value="">不分組</option><option value="district"${s.group === 'district' ? ' selected' : ''}>依縣市區</option><option value="circle"${s.group === 'circle' ? ' selected' : ''}>依生活圈</option><option value="status"${s.group === 'status' ? ' selected' : ''}>依狀態</option></select>
        <button id="fclear" class="ghost no-print">清除</button>
        <span class="count">${rows.length} / ${L.length} 位</span>
        <span class="no-print selbar">
        <button id="fpdf"${this.sel.size ? '' : ' disabled'} title="把勾選的客戶匯出成 PDF">匯出 PDF（已選 ${this.sel.size}）</button>
        ${this.sel.size ? '<button id="fselclr" class="ghost">清除勾選</button>' : ''}</span>
      </div>
      <div class="tablewrap"><table>
        <thead><tr><th class="selc"><input type="checkbox" id="selhead" title="全選／取消全選目前篩選結果"></th>${this.COLS.map(([k, t]) => `<th data-k="${k}">${t}${s.sort === k ? (s.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
        <tbody>${body || `<tr><td colspan="${this.COLS.length + 1}" class="empty">沒有符合條件的客戶</td></tr>`}</tbody>
      </table></div>
      <p class="muted small">點 📱／☎ 撥電話、點 🧭 開 Google 地圖導航；點其他地方看明細並補填。年齡欄為「足歲 / 保險年齡」（超過 6 個月加 1 歲，以商品條款為準）。性別旁有 ※ 者由身分證第 2 碼推算。</p>`;
    const bind = (id, key, ev) => { const n = el.querySelector(id); n.addEventListener(ev || 'change', () => { s[key] = n.value; this.render(); if (key === 'q') { const q = el.querySelector('#fq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }); };
    bind('#fq', 'q', 'input'); bind('#fstatus', 'status'); bind('#fvisit', 'visit'); bind('#fdistrict', 'district'); bind('#fcircle', 'circle');
    bind('#fband', 'band'); bind('#fpolicy', 'policy'); bind('#fgroup', 'group');
    el.querySelector('#fclear').onclick = () => { Object.assign(s, { q: '', status: '', district: '', circle: '', band: '', policy: '', visit: '' }); this.render(); };
    // 勾選：同 Gmail——表頭框全選／取消（部分勾選時為半選），按住 Shift 再點可連續勾選一段
    const ids = rows.map(c => c.id), nSel = ids.filter(i => this.sel.has(i)).length;
    const head = el.querySelector('#selhead');
    head.checked = ids.length > 0 && nSel === ids.length; head.indeterminate = nSel > 0 && nSel < ids.length; head.disabled = !ids.length;
    head.onclick = ev => { ev.stopPropagation(); ids.forEach(i => head.checked ? this.sel.add(i) : this.sel.delete(i)); this.anchor = null; this.render(); };
    const pick = (cb, shift) => {
      const id = cb.dataset.id, on = cb.checked, a = this.anchor && ids.includes(this.anchor) ? ids.indexOf(this.anchor) : -1;
      if (shift && a >= 0) { const b = ids.indexOf(id); ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(i => on ? this.sel.add(i) : this.sel.delete(i)); }
      else on ? this.sel.add(id) : this.sel.delete(id);
      this.anchor = id; this.render();
    };
    el.querySelectorAll('input.rowsel').forEach(cb => { cb.onclick = ev => { ev.stopPropagation(); pick(cb, ev.shiftKey); }; });
    el.querySelectorAll('td.selc').forEach(td => {
      td.onmousedown = ev => { if (ev.shiftKey) ev.preventDefault(); };   // 避免 Shift 連點時選取到文字
      td.onclick = ev => { if (ev.target === td) { const cb = td.querySelector('input'); cb.checked = !cb.checked; pick(cb, ev.shiftKey); ev.stopPropagation(); } };
    });
    el.querySelector('#fpdf').onclick = () => PdfExport.openDialog();
    const clr = el.querySelector('#fselclr'); if (clr) clr.onclick = () => { this.sel.clear(); this.render(); };
    el.querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { const k = th.dataset.k; if (s.sort === k) s.dir *= -1; else { s.sort = k; s.dir = 1; } this.render(); });
    el.querySelectorAll('tr.row').forEach(tr => tr.onclick = () => this.open(tr.dataset.id));
  },

  /* ---------- 明細抽屜（back：從統計下鑽進來時，提供「返回」） ---------- */
  open(id, back) {
    const c = Store.get(id); if (!c) return;
    const m = Store.ov.settings.mask !== false, E = U.esc, d = document.getElementById('drawer');
    const raw = c.raw, e = Store.ov.extra[id] || {};
    d.hidden = false;
    d.innerHTML = `
      <div class="hd">${back ? '<button class="ghost" id="dBack">← 返回</button>' : ''}<h2>${E(c.name)} <span class="tag ${Store.statusClass(c.status)}">${E(c.status)}</span> ${this.visitTag(c)}</h2><button class="ghost" id="dClose">✕ 關閉</button></div>
      <div class="muted small">${E(m ? U.maskId(c.id) : c.id)}　${c.birth ? E(c.birth) + '（' + c.age + ' 歲／保險年齡 ' + c.insAge + '）' : '缺生日'}</div>
      <div class="actions">${Store.callBtns(c, m)} ${Store.navBtn(c, '導航到客戶')}</div>
      <div class="sec">補填資料（存在本機，不改動 adoc）</div>
      <div class="form">
        <label>狀態</label><select id="fStatus">${Store.statuses().map(s => `<option${s === c.status ? ' selected' : ''}>${E(s)}</option>`).join('')}</select>
        <label>性別</label><select id="fGender"><option value="">${c.genderSrc === '身分證推算' ? '依身分證（' + E(c.gender) + '）' : '未填'}</option><option${e.gender === '男' ? ' selected' : ''}>男</option><option${e.gender === '女' ? ' selected' : ''}>女</option></select>
        <label>婚姻</label><select id="fMarital"><option value=""></option>${['未婚', '已婚', '離婚', '喪偶'].map(x => `<option${c.marital === x ? ' selected' : ''}>${x}</option>`).join('')}</select>
        <label>職業</label><div>${c.occupation ? E(c.occupation) : '<span class="muted">未填</span>'} <span class="muted small">${Store.insureds.some(x => x.customer === c) ? '（職業記在被保險人，到「被保險人」頁籤編輯）' : '（職業記在被保險人；尚無保單，請在 adoc 加「== 被保險人」區填「職業：」）'}</span></div>
        <label>Email</label><input type="text" id="fEmail" value="${E(c.email)}">
        <label>來源</label><input type="text" id="fSource" value="${E(c.source)}" placeholder="例：原業務員離職、客戶轉介">
        <label>下次拜訪</label><input type="date" id="fNext" value="${E(c.nextVisit)}">
        <label>備註</label><textarea id="fNote">${E(c.note)}</textarea>
      </div>
      <div class="actions"><button class="primary" id="dSave">儲存</button><button id="dSched">加入排程…</button><input type="date" id="dDate" value="${U.iso(U.addDays(U.today(), 1))}"></div>
      <div class="sec">地址與生活圈</div>
      ${c.addresses.map(a => `<div style="margin-top:6px">📍 ${E(m ? Store.addrText(c, true, a) : a.raw)} ${Store.navBtn(c, '導航', a)}
        <div class="small muted">${E(a.city + a.district)}｜生活圈：${E(a.label)}${a.confidence ? '（' + E(a.confidence) + '）' : ''}｜路名：${E(a.roadKey || '？')}</div>
        ${a.source && a.confidence !== '登錄' ? `<div class="small muted">依據：${E(a.source)}</div>` : ''}</div>`).join('') || '<div class="muted">缺地址</div>'}
      <div class="form"><label>座標</label><input type="text" id="fGeo" value="${c.geo ? c.geo.lat + ', ' + c.geo.lng : ''}" placeholder="24.99, 121.30（在 Google 地圖點右鍵可複製）"></div>
      <div class="sec">保單（${c.policies.length} 張）</div>
      ${Store.policies.filter(p => p.owner === c).map(p => `<div class="pol">
        <div><a href="#" data-pol="${E(p.key)}"><b>${E(p.no)}</b></a> <span class="tag">${E(p.status || '狀態未填')}</span>${p.payMode ? ' <span class="tag">' + E(p.payMode) + '</span>' : ''}</div>
        <div class="small ${p.self ? 'muted' : 'warnc'}">被保險人：${E(p.insured || '未填')}${p.insured && !p.self ? '（非本人）' : ''}</div>
        <ul>${p.items.map(i => `<li>${E(i.name)}${i.amount ? ' <span class="muted">' + E(i.amount) + '</span>' : ''}${i.rider ? ' <span class="tag">附約</span>' : ''}</li>`).join('')}</ul></div>`).join('') || '<div class="muted">尚未登錄保單</div>'}
      ${c.policies.length ? `<div class="small muted">本人保障類型（依商品名稱關鍵字推斷）：${Store.TYPES.map(t => c.ownTypes.has(t) ? '✔ ' + Store.typeLabel(t) : '✘ ' + Store.typeLabel(t)).join('　')}</div>` : ''}
      ${c.warnings.length ? `<div class="sec">資料提醒</div><ul>${c.warnings.map(w => `<li>${E(w)}</li>`).join('')}</ul>` : ''}
      <div class="muted small" style="margin-top:12px">來源檔：客戶/${E(c.file)}</div>`;
    const q = s => d.querySelector(s);
    q('#dClose').onclick = () => { d.hidden = true; };
    if (back) q('#dBack').onclick = back;
    d.querySelectorAll('[data-pol]').forEach(n => n.onclick = ev => { ev.preventDefault(); Policy.openPol(n.dataset.pol, () => this.open(id, back)); });
    q('#dSave').onclick = () => {
      const geoTxt = q('#fGeo').value.trim(), geo = U.parseLatLng(geoTxt);
      if (geoTxt && !geo) { U.toast('座標格式不對，請貼「緯度, 經度」（台灣範圍）'); return; }
      Store.setExtra(id, { status: q('#fStatus').value === raw.status ? '' : q('#fStatus').value, gender: q('#fGender').value, marital: q('#fMarital').value, email: q('#fEmail').value.trim(), source: q('#fSource').value.trim(), nextVisit: q('#fNext').value, note: q('#fNote').value.trim() });
      if (geoTxt) Store.setGeo(id, { ...geo, src: 'manual' }); else if (c.geo) Store.setGeo(id, null);
      U.toast('已儲存'); App.refresh(); this.open(id, back);
    };
    q('#dSched').onclick = () => { const dt = q('#dDate').value; if (!dt) return; Schedule.add(dt, [id]); U.toast('已加入 ' + dt + ' 的行程'); };
  },
};
