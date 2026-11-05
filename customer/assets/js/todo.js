/* 待補充分頁：資料缺漏一覽（欄位完整度、每位客戶缺什麼、保單缺什麼、解析提醒）。沒有缺漏的區塊不顯示。 */
const Todo = {
  reg: [],
  FIELDS: [
    ['birth', '生日', c => c.birth, true],
    ['phone', '電話（手機或市話）', c => c.mobiles.length || c.homes.length, true],
    ['addr', '地址', c => c.addr, true],
    ['circle', '生活圈（登錄）', c => c.addr && c.circleConf === '登錄', true],
    ['marital', '婚姻', c => c.marital, true],
    ['email', 'Email', c => c.email, false],
    ['source', '來源', c => c.source, false],
    ['geo', '座標', c => c.geo, false],
  ],
  off() { const o = Store.ov.settings.todoOff; return Array.isArray(o) ? o : this.FIELDS.filter(f => !f[3]).map(f => f[0]); },
  fields() { const off = this.off(); return this.FIELDS.filter(f => !off.includes(f[0])); },
  policyGaps() {
    const out = [];
    Store.policies.forEach(p => {
      const miss = [];
      if (!p.insured) miss.push('被保險人未填');
      if (!p.status) miss.push('狀態未填');
      if (!p.items.length) miss.push('沒有明細');
      if (!p.start) miss.push('缺保險始期（無法推算繳費日）');
      if (!p.bene.length) miss.push('受益人未登錄');
      if (miss.length) out.push([p, miss]);
    });
    return out;
  },
  gaps() {
    const F = this.fields();
    return Store.list.map(c => [c, F.filter(f => !f[2](c)).map(f => f[1])]).filter(x => x[1].length);
  },
  insuredGaps() { return Store.insureds.filter(g => !g.birth || !g.occupation); },
  count() { return this.gaps().length + this.policyGaps().length + this.insuredGaps().length + Coverage.unconfirmed().length + Store.list.reduce((a, c) => a + c.warnings.length, 0); },
  updateBadge() {
    const b = document.querySelector('[data-tab=todo]'); if (!b) return;
    const n = Store.list.length ? this.count() : 0;
    b.innerHTML = '待補充' + (n ? ` <span class="cnt warn">${n}</span>` : '');
  },

  render() {
    this.reg = [];
    const el = document.getElementById('tab-todo'), L = Store.list, N = L.length, E = U.esc;
    if (!N) { el.innerHTML = '<div class="card empty">沒有客戶資料</div>'; return; }
    const off = this.off(), F = this.fields(), gaps = this.gaps(), pgaps = this.policyGaps();
    const warns = L.filter(c => c.warnings.length);
    const fieldRows = F.map(f => [f, L.filter(c => !f[2](c))]).filter(x => x[1].length);
    const reg = (title, hit, labelsAlt) => { this.reg.push({ title, hit, alt: labelsAlt }); return `data-t="${this.reg.length - 1}" tabindex="0" role="button"`; };
    const chips = this.FIELDS.map(f => `<label class="chk"><input type="checkbox" data-fld="${f[0]}"${off.includes(f[0]) ? '' : ' checked'}> ${E(f[1])}</label>`).join('');
    const sections = [];
    if (fieldRows.length) {
      const max = Math.max(...fieldRows.map(x => x[1].length));
      sections.push(`<div class="card"><h2>欄位缺漏（點擊看是哪些客戶）</h2><div class="bars">${fieldRows.map(([f, miss]) => `<div class="r click" ${reg('缺「' + f[1] + '」的客戶', miss, { label: '看已填的 ' + (N - miss.length) + ' 位', hit: L.filter(c => f[2](c)), title: '已填「' + f[1] + '」的客戶' })}><span class="lab">${E(f[1])}</span><span class="trk"><div class="fill" style="width:${(miss.length / max * 100).toFixed(1)}%"></div></span><span class="num">缺 ${miss.length} / ${N}</span></div>`).join('')}</div></div>`);
    }
    if (gaps.length) {
      sections.push(`<div class="card"><h2>各客戶缺什麼</h2><div class="tablewrap"><table><tbody>${gaps.map(([c, m]) => `<tr class="row" data-cust="${E(c.id)}"><td><b>${E(c.name)}</b></td><td>${m.map(x => `<span class="tag warn">${E(x)}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div></div>`);
    }
    if (pgaps.length) {
      sections.push(`<div class="card"><h2>保單待補充</h2><div class="tablewrap"><table><tbody>${pgaps.map(([p, m]) => `<tr class="row" data-pol="${E(p.key)}"><td>${E(p.no)}</td><td>${E(p.owner.name)}</td><td>${m.map(x => `<span class="tag warn">${E(x)}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div></div>`);
    }
    const ig = this.insuredGaps();
    if (ig.length) {
      sections.push(`<div class="card"><h2>被保險人待補（${ig.length} 人）</h2><div class="tablewrap"><table><tbody>${ig.map(g => `<tr class="row" data-ins="${E(g.name)}"><td><b>${E(g.name)}</b></td><td>${[!g.birth ? '缺生日（無法算保險年齡與加歲日）' : '', !g.occupation ? '缺職業' : ''].filter(Boolean).map(x => `<span class="tag warn">${x}</span>`).join(' ')}</td><td class="muted">${g.owners.map(c => E(c.name)).join('、')} 的保單</td></tr>`).join('')}</tbody></table></div><p class="muted small">請在要保人 adoc 的「== 被保險人」區補上 <code>姓名::</code> 與 <code>* 生日：</code>、<code>* 職業：</code>（職業也可以在「被保險人」頁籤的明細直接填，存在本機）。</p></div>`);
    }
    const unc = Coverage.unconfirmed();
    if (unc.length) {
      sections.push(`<div class="card"><h2>商品保障未確認（${unc.length} 項，點擊到「保障 → 商品對照」）</h2><div class="tablewrap"><table><tbody>${unc.map(x => `<tr class="row" data-goprod><td>${E(x.name)}</td><td>${Coverage.srcTag(Coverage.lookup(x.name).source)}</td><td class="muted">${x.n} 筆</td></tr>`).join('')}</tbody></table></div><p class="muted small">只看名稱推論或官網特色，尚未依條款確認。確認後寫入 data/產品/structured/coverage_manual.json。</p></div>`);
    }
    if (warns.length) {
      sections.push(`<div class="card"><h2>資料提醒（解析 adoc 時發現）</h2><div class="tablewrap"><table><tbody>${warns.map(c => c.warnings.map(w => `<tr class="row" data-cust="${E(c.id)}"><td><b>${E(c.name)}</b></td><td class="wrap">${E(w)}</td></tr>`).join('')).join('')}</tbody></table></div></div>`);
    }
    el.innerHTML = `<div class="card"><h3>要檢查哪些欄位（可自行勾選，記在本機）</h3><div class="chips">${chips}</div></div>
      <div class="grid g2" style="margin-top:12px">${sections.join('') || '<div class="card empty">目前沒有待補充項目。</div>'}</div>`;
    el.querySelectorAll('[data-fld]').forEach(n => n.onchange = () => {
      const cur = new Set(this.off()); n.checked ? cur.delete(n.dataset.fld) : cur.add(n.dataset.fld);
      Store.setting('todoOff', [...cur]); this.render(); this.updateBadge();
    });
    const openT = (i, alt) => {
      const r = this.reg[i]; if (!r) return;
      const mk = a => a ? Drill.open(r.alt.title, r.alt.hit, N, { label: '看缺的 ' + (N - r.alt.hit.length) + ' 位', run: () => openT(i, false) }) : Drill.open(r.title, r.hit, N, { label: r.alt.label, run: () => openT(i, true) });
      mk(alt);
    };
    el.querySelectorAll('[data-t]').forEach(n => { n.onclick = () => openT(+n.dataset.t, false); n.onkeydown = e => { if (e.key === 'Enter') openT(+n.dataset.t, false); }; });
    el.querySelectorAll('tr[data-goprod]').forEach(tr => tr.onclick = () => { Cover.st.sub = 'prod'; Cover.st.pscope = 'held'; Cover.st.psrc = ''; Cover.st.pcode = ''; Cover.st.pq = ''; App.show('cover'); });
    el.querySelectorAll('tr[data-ins]').forEach(tr => tr.onclick = () => Insured.openIns(tr.dataset.ins));
    el.querySelectorAll('tr[data-cust]').forEach(tr => tr.onclick = () => List.open(tr.dataset.cust));
    el.querySelectorAll('tr[data-pol]').forEach(tr => tr.onclick = () => Policy.openPol(tr.dataset.pol));
  },
};
