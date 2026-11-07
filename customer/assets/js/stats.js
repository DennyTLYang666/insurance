/* 統計分頁：分成 客戶／被保險人／保單／產品／保障／多面向（TreeMap）／欄位評估。HTML 條狀圖＋表格，所有數字都能點開，看是哪些客戶（右側面板），並可切換看「其餘客戶」。
 * 不同單位（被保險人、保單、商品項目）的統計，點開後列的是對應的「要保人（客戶）」。維度與指標定義在 dims.js。 */
const Stats = {
  st: { sub: 'cust' },
  SUBS: [['cust', '客戶'], ['ins', '被保險人'], ['pol', '保單'], ['prod', '產品'], ['cov', '保障'], ['multi', '多面向'], ['eval', '欄位評估']],
  reg: [],       // 本次渲染登記的下鑽條件
  // 登記一個下鑽條件，回傳要放在元素上的屬性字串
  d(title, pred, labels, neg, spec) {
    this.reg.push({ title, pred, labels: labels || null, neg: !!neg, spec: spec || null });
    return `data-d="${this.reg.length - 1}" tabindex="0" role="button"`;
  },
  // 依 fn 分組計數 → [[key, n, note, pred]]
  countBy(L, fn) {
    const m = new Map();
    L.forEach(c => { const k = fn(c) || '未填'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([k, n]) => [k, n, '', c => (fn(c) || '未填') === k]);
  },
  sorted(rows) { return rows.sort((a, b) => /^未填/.test(a[0]) - /^未填/.test(b[0]) || b[1] - a[1] || U.coll.compare(a[0], b[0])); },
  bars(rows, total, titlePrefix, labelsFor, unit) {
    unit = unit || '位';
    if (!rows.length) return '<div class="empty">沒有資料</div>';
    const max = Math.max(...rows.map(r => r[1]), 1);
    return '<div class="bars">' + rows.map(([k, n, note, pred, neg, spec]) => {
      const none = /^(未填|未登錄|缺始期|缺生日|性別未知)/.test(k) || /（未細分）$/.test(k);
      return `<div class="r click${none ? ' none' : ''}" ${this.d((titlePrefix || '') + k, pred, labelsFor ? labelsFor(k) : null, neg, spec)} title="${U.esc(k)}：${n} ${unit}（${(n / total * 100).toFixed(0)}%）— 點擊看是哪些客戶"><span class="lab">${U.esc(k)}${note ? ' <span class="tag warn">' + U.esc(note) + '</span>' : ''}</span><span class="trk"><div class="fill" style="width:${(n / max * 100).toFixed(1)}%"></div></span><span class="num">${n}（${(n / total * 100).toFixed(0)}%）</span></div>`;
    }).join('') + '</div>';
  },

  render() {
    this.reg = []; Dims.prep();
    const el = document.getElementById('tab-stats'), L = Store.list, N = L.length;
    if (!N) { el.innerHTML = '<div class="card empty">沒有客戶資料</div>'; return; }
    const ages = L.filter(c => c.age != null).map(c => c.age);
    const avg = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—';
    const withPol = L.filter(c => c.policies.length), polN = L.reduce((a, c) => a + c.policies.length, 0);
    const unvisited = L.filter(c => !c.visited);
    const male = L.filter(c => c.gender === '男'), female = L.filter(c => c.gender === '女'), gNone = L.filter(c => c.gender !== '男' && c.gender !== '女');
    const gFromId = L.filter(c => c.genderSrc === '身分證推算').length;

    const R = id => this.rowsFor('customer', this.dimOf('customer', id));
    const stRows = R('status');
    const visitRows = R('visit');
    const band = R('band');
    const dist = this.sorted(R('district'));
    const circ = this.sorted(R('circle').map(r => { const grp = L.filter(c => (c.circle || '未填生活圈') === r[0]); r[2] = grp.some(c => c.circleConf === '待確認') ? '含待確認' : grp.some(c => c.circleConf === '同路推定') ? '含同路推定' : ''; return r; }));
    const roads = this.sorted(R('road')).slice(0, 12);
    const seg = (arr, color, label, extra) => arr.length ? `<div class="click" style="flex:${arr.length};background:${color}" ${this.d(label, c => arr.includes(c), null, false, this.spec('customer', this.dimOf('customer', 'gender'), label))} title="${label} ${arr.length} 位 — 點擊看是哪些客戶">${arr.length}</div>` : '';
    const kpi = (lab, val, sub, attr) => `<div class="card kpi${attr ? ' click' : ''}" ${attr || ''}><div class="l">${lab}</div><div class="v">${val}</div><div class="s">${sub}</div></div>`;
    const head = `
      <div class="kpis">
        ${kpi('客戶數', N, stRows.map(([k, n]) => k + ' ' + n).join('｜'), this.d('全部客戶', () => true))}
        ${kpi('未拜訪', unvisited.length + ' 位', '尚無「已拜訪」紀錄', this.d('未拜訪客戶', c => !c.visited))}
        ${kpi('性別', male.length + ' 男 / ' + female.length + ' 女', (gNone.length ? gNone.length + ' 位未知｜' : '') + gFromId + ' 位由身分證推算')}
        ${kpi('平均年齡', avg, ages.length ? '最小 ' + Math.min(...ages) + '／最大 ' + Math.max(...ages) : '')}
        ${kpi('已登錄保單', withPol.length + ' 位', '共 ' + polN + ' 張', this.d('有登錄保單的客戶', c => c.policies.length))}
        ${polN ? kpi('保單／商品', polN + ' 張 / ' + new Set(Store.policies.flatMap(p => p.items.map(i => Coverage.norm(i.name) || i.name))).size + ' 種', '客戶持有的不同商品', 'data-sub="prod" tabindex="0" role="button"') : ''}
        ${Store.insureds.length ? kpi('被保險人', Store.insureds.length + ' 人', Store.insureds.filter(g => !g.customer).length + ' 人不是客戶（點擊看被保險人）', 'data-go="insured" tabindex="0" role="button"') : ''}
      </div>
      <p class="muted small">💡 每一條長條、數字、表格格子都能點，會在右側列出是哪些客戶（可撥電話、導航、點進明細），並可切換看「其餘客戶」。資料欄位的缺漏移到「待補充」頁籤。保單、產品、保障的統計在上方各分類頁籤。</p>
      `;
    const cust = `<div class="grid g2">
        <div class="card"><h2>性別</h2>
          <div class="stack">${seg(male, 'var(--s1)', '男')}${seg(female, 'var(--s2)', '女')}${seg(gNone, 'var(--muted)', '性別未知')}</div>
          <div class="legend"><span><i style="background:var(--s1)"></i>男 ${male.length}</span><span><i style="background:var(--s2)"></i>女 ${female.length}</span>${gNone.length ? `<span><i style="background:var(--muted)"></i>未知 ${gNone.length}</span>` : ''}</div>
          <p class="muted small">${gFromId ? '※ 有 ' + gFromId + ' 位的性別是由身分證第 2 碼（1 男／2 女）推算，不是登錄的資料。' : ''}</p></div>
        <div class="card"><h2>拜訪狀態</h2>${this.bars(visitRows, N)}<p class="muted small">在「排程」勾選「已拜訪」就會記錄。</p></div>
        <div class="card"><h2>年齡分佈</h2>${this.bars(band, N)}</div>
        <div class="card"><h2>地區：縣市區</h2>${this.bars(dist, N)}</div>
        <div class="card"><h2>地區：生活圈</h2>${this.bars(circ, N)}<p class="muted small">以你在 adoc 登錄的「生活圈：」為準；沒登錄的，同一條路有人登錄就沿用（標「同路推定」），否則依 scripts/area_rules.json，再沒有就是「（未細分）」。</p></div>
        ${roads.some(r => !/^未填/.test(r[0])) ? `<div class="card"><h2>地區：路名（前 12）</h2>${this.bars(roads, N)}</div>` : ''}
        <div class="card"><h2>狀態</h2>${this.bars(stRows, N)}<p class="muted small">資料夾名稱＝狀態（待訪談／已歸檔／原招／非原招）。</p></div>
      </div>
      <div class="card" style="margin-top:12px"><h2>明細表：區 × 年齡帶</h2>${this.cross(L)}</div>`;
    const subs = `<div class="subtabs" role="tablist">${this.SUBS.map(([k, t]) => `<button role="tab" data-ssub="${k}" class="${this.st.sub === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const bodies = { cust: () => cust, ins: () => this.bodyIns(), pol: () => this.bodyPol(), prod: () => this.bodyProd(), cov: () => this.bodyCov(), multi: () => '<div id="tmHost"></div>', eval: () => this.bodyEval() };
    el.innerHTML = head + subs + `<div id="stBody" style="margin-top:10px">${(bodies[this.st.sub] || bodies.cust)()}</div>`;
    if (this.st.sub === 'multi') Treemap.render(document.getElementById('tmHost'));
  },

  /* ---------- 以「單位」為基礎的統計 ---------- */
  // 一個維度 → 長條圖資料 [[key, n, '', pred]]；pred 的下鑽對象是「對應的要保人（客戶）」
  rowsFor(uid, dim) {
    const un = Dims.units[uid];
    return Dims.group(un.all(), dim).map(g => { const ids = new Set(Dims.owners(uid, g.units).map(c => c.id)); return [g.key, g.units.length, '', c => ids.has(c.id), false, this.spec(uid, dim, g.key)]; });
  },
  spec(uid, dim, key, name) { return { uid, conds: [{ dim, key, op: 'eq', name }] }; },
  dimOf(uid, id) { return Dims.dims()[uid].find(d => d.id === id); },
  // 一組卡片：[[uid, dimId, 標題, 說明?]]
  cards(items) {
    return '<div class="grid g2">' + items.map(([uid, id, title, note]) => {
      const un = Dims.units[uid], n = un.all().length;
      return `<div class="card"><h2>${title}</h2>${this.bars(this.rowsFor(uid, this.dimOf(uid, id)), n || 1, '', null, un.unit)}${note ? `<p class="muted small">${note}</p>` : ''}</div>`;
    }).join('') + '</div>';
  },
  // 兩個維度的交叉表；格子可點
  crossTable(uid, rowId, colId, rowLabel, maxRows) {
    const un = Dims.units[uid], rd = this.dimOf(uid, rowId), cd = this.dimOf(uid, colId), all = un.all();
    let rows = Dims.group(all, rd); const cols = Dims.group(all, cd);
    if (maxRows) rows = rows.slice(0, maxRows);
    const cell = (us, title, conds) => { if (!us.length) return '<td>·</td>'; const ids = new Set(Dims.owners(uid, us).map(c => c.id)); return `<td class="click" ${this.d(title, c => ids.has(c.id), null, false, { uid, conds: conds.map(x => ({ ...x, op: 'eq' })) })}>${us.length}</td>`; };
    return `<div class="tablewrap"><table><thead><tr><th class="nosort">${rowLabel || rd.label}</th>${cols.map(c => `<th class="nosort">${U.esc(c.key)}</th>`).join('')}<th class="nosort">合計</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td>${U.esc(r.key)}</td>${cols.map(c => cell(r.units.filter(u => cd.fn(u) === c.key || (!cd.fn(u) && c.key === '未填')), r.key + '・' + c.key, [{ dim: rd, key: r.key }, { dim: cd, key: c.key }])).join('')}${cell(r.units, r.key, [{ dim: rd, key: r.key }])}</tr>`).join('') + '</tbody></table></div>';
  },
  note(t) { return `<p class="muted small" style="margin:6px 2px">${t}</p>`; },

  bodyIns() {
    if (!Store.insureds.length) return '<div class="card empty">還沒有登錄保單，沒有被保險人資料。</div>';
    return this.note('單位＝被保險人（保單上的被保險人，含不是客戶的人）。點長條會列出持有其保單的要保人（客戶）。') + this.cards([
      ['insured', 'role', '身分', '「僅被保險人」＝只出現在別人的保單上、沒有自己的客戶檔案。'],
      ['insured', 'gender', '性別', '沒有登錄的性別，會用身分證第 2 碼推算。'],
      ['insured', 'band', '年齡帶（足歲）'],
      ['insured', 'insband', '年齡帶（保險年齡）', '保險年齡＝足歲，超過 6 個月再加 1 歲；與足歲不同的人，代表加歲日已過、保費可能已調整。'],
      ['insured', 'occupation', '職業', '職業記在被保險人（adoc 的 == 被保險人 區或被保險人頁籤）；統計的是保單上的被保險人，不是只有客戶。'],
      ['insured', 'occ', '職業等級', '「未填職業等級」代表 adoc 的 == 被保險人 區沒有寫。'],
      ['insured', 'bump', '下次加歲月份', '哪個月有人要加歲（保費可能變動），可用來排提醒；詳細日期在「待補充」與「被保險人」頁籤。'],
      ['insured', 'active', '有效保單數', '失效、終止的保單不計。'],
    ]);
  },
  bodyPol() {
    if (!Store.policies.length) return '<div class="card empty">還沒有登錄保單。</div>';
    return this.note('單位＝保單（一張一筆）。點長條會列出持有這些保單的要保人（客戶）。') + this.cards([
      ['policy', 'status', '保單狀態'],
      ['policy', 'mode', '繳別', '沒填繳別的保單以「年繳」計，標示「（預設）」。'],
      ['policy', 'year', '始期年份', '由 adoc 的「保險始期」讀取：4 位數年份視為西元，2–3 位視為民國。'],
      ['policy', 'tenure', '保單年資', '從保險始期算到今天。'],
      ['policy', 'due', '下次繳費月份', '由保險始期＋繳別推算（附約在主約繳費期滿後是否續繳屬推定）；「繳費期滿」「已停止」「躉繳」不會再有下次繳費。'],
      ['policy', 'bene', '受益人登錄', '只檢查有沒有登錄，不分析受益人是誰。'],
      ['policy', 'benen', '受益人人數'],
      ['policy', 'self', '要保人＝被保險人'],
      ['policy', 'rider', '含附約'],
      ['policy', 'nitems', '每張保單的商品數'],
    ]) + `<div class="card" style="margin-top:12px"><h2>交叉表：保單狀態 × 繳別</h2>${this.crossTable('policy', 'status', 'mode')}</div>`;
  },
  bodyProd() {
    if (!Store.policies.length) return '<div class="card empty">還沒有登錄保單。</div>';
    const items = Dims.units.item.all(), n = new Set(items.map(x => Coverage.norm(x.it.name) || x.it.name)).size;
    return this.note(`單位＝商品項目（一張保單可有主約＋多個附約）；共 ${items.length} 項、${n} 種不同商品。險種是依商品名稱關鍵字推論，不是條款分類。`) +
      this.cards([
        ['item', 'name', '商品持有排行（項數）', '點長條看持有這個商品的客戶。'],
        ['item', 'rider', '主約／附約'],
        ['item', 'type', '險種（名稱推論）'],
        ['item', 'src', '保障資料來源', '「已確認」＝你寫進 coverage.yaml 的；其餘都還沒依條款確認，保障頁的加總會標「?」。'],
        ['item', 'status', '商品所在保單的狀態'],
        ['item', 'year', '商品始期年份'],
      ]) +
      `<div class="card" style="margin-top:12px"><h2>交叉表：商品 × 被保險人年齡帶</h2>${this.crossTable('item', 'name', 'insband', '商品', 20)}</div>
       <div class="card" style="margin-top:12px"><h2>交叉表：險種 × 主約／附約</h2>${this.crossTable('item', 'type', 'rider')}</div>`;
  },
  bodyCov() {
    if (!Coverage.ok()) return '<div class="card empty">找不到商品保障資料（先執行 build.bat 或用 serve.bat 開啟）。</div>';
    const G = Store.insureds; if (!G.length) return '<div class="card empty">還沒有登錄保單。</div>';
    const rows = Coverage.codes().map(c => {
      const us = G.filter(g => Dims.hasCode(g, c[0])), ids = new Set(Dims.owners('insured', us).map(x => x.id));
      const hd = this.dimOf('insured', 'has_' + c[0]);
      return [c[1], us.length, us.some(g => Dims.covOf(g).cells[c[0]].inferred) ? '含名稱推論' : '', x => ids.has(x.id), false, hd ? this.spec('insured', hd, '有' + c[1]) : null];
    }).filter(r => r[1] > 0);
    const mk = (id, label, f, order) => ({ id, label, fn: f, order, ord: true });
    const death = mk('d', '', g => { const x = Dims.covOf(g).cells.death_disease; if (!x || !x.hasSum) return '無可加總金額'; const w = x.sum / 10000; return w < 100 ? '未滿 100 萬' : w < 300 ? '100–299 萬' : w < 500 ? '300–499 萬' : w < 1000 ? '500–999 萬' : '1000 萬以上'; }, ['未滿 100 萬', '100–299 萬', '300–499 萬', '500–999 萬', '1000 萬以上', '無可加總金額']);
    const hosp = mk('h', '', g => { const x = Dims.covOf(g).cells.hosp_disease; if (!x || !x.hasDaily) return '無可加總金額'; const d = x.daily; return d < 1000 ? '未滿 1000 元/日' : d < 2000 ? '1000–1999 元/日' : d < 3000 ? '2000–2999 元/日' : '3000 元/日以上'; }, ['未滿 1000 元/日', '1000–1999 元/日', '2000–2999 元/日', '3000 元/日以上', '無可加總金額']);
    const bar = (dim, title, note) => `<div class="card"><h2>${title}</h2>${this.bars(Dims.group(G, dim).map(g => { const ids = new Set(Dims.owners('insured', g.units).map(c => c.id)); return [g.key, g.units.length, '', c => ids.has(c.id), false, this.spec('insured', dim, g.key, title)]; }), G.length, '', null, '人')}${note ? `<p class="muted small">${note}</p>` : ''}</div>`;
    const L = Store.list, typeRows = Store.TYPES.map(t => [Store.typeLabel(t), L.filter(c => c.ownTypes.has(t)).length, '', c => c.ownTypes.has(t)]);
    return this.note('單位＝被保險人，依「保障」頁籤的加總（只計有效保單；金額只含單位為萬／元或設定檔有 per_unit 的）。含名稱推論的項目請到「保障」頁看標「?」的數字。') +
      `<div class="grid g2">
        <div class="card"><h2>各保障項目：有此保障的人數</h2>${this.bars(rows, G.length, '有：', null, '人')}<p class="muted small">點長條看持有的要保人；在右側把條件改成「不等於」，或切到「沒有任何符合」，就能找到沒有這項保障的人／客戶；沒有任何資料的保障項目不列。</p></div>
        ${bar(this.dimOf('insured', 'kcount'), '四項基本保障齊全度', '四項＝疾病身故、意外身故、疾病住院、癌症住院。是「有沒有」的缺口檢查，不代表保額夠不夠。')}
        ${bar(death, '疾病身故保額帶', '只算單位為萬／元且已知保額的保單；壽險不分原因會同時計入疾病身故。')}
        ${bar(hosp, '疾病住院日額帶', '日額型（元/日）加總；實支實付、計劃數等無法加總者不計。')}
        <div class="card"><h2>保障類型（客戶，本人為被保險人）</h2>${this.bars(typeRows, L.length, '有：', k => ({ pos: '本人有「' + k + '」', neg: '本人沒有「' + k + '」' }), '位')}<p class="muted small">依商品名稱關鍵字推論（防癌／傷害意外／醫療／壽險），點條狀圖可切換看「沒有」的客戶，當作拜訪時的保障缺口參考。</p></div>
      </div>`;
  },
  bodyEval() {
    const P = Store.policies, I = Store.insureds, E = U.esc, pc = (n, d) => d ? `${n} / ${d}（${(n / d * 100).toFixed(0)}%）` : '—';
    const items = Dims.units.item.all(), conv = Coverage.ok() ? P.reduce((a, p) => a + (Coverage.contributions(p).some(c => c.value != null || c.daily != null) ? 1 : 0), 0) : 0;
    const rows = [
      ['保險始期', pc(P.filter(p => p.start).length, P.length), '保單：始期年份、保單年資、下次繳費月份', '高', '4 位數年份視為西元、2–3 位視為民國；缺始期的保單無法推算下次繳費。'],
      ['繳別', pc(P.filter(p => !p.payModeDef).length, P.length) + '（其餘以年繳計）', '保單：繳別、下次繳費月份', '高', '沒填的以「年繳」計並標示（預設），不要把預設值當成事實。'],
      ['保單狀態', pc(P.filter(p => p.status).length, P.length), '保單：狀態；保障加總是否計入', '高', '失效／終止不計入保障；「減額繳清」仍計入但保額可能已調降。'],
      ['受益人', pc(P.filter(p => p.bene.length).length, P.length), '保單：有無登錄、人數', '中', '只適合做「缺漏檢查」。受益人是誰、與被保險人的關係沒有結構化欄位，不做關係分佈；要做的話得先把 adoc 改成固定格式（姓名／關係／比例）。'],
      ['被保險人 生日、性別', pc(I.filter(g => g.birth).length, I.length) + '（生日）', '被保險人：年齡帶、保險年齡帶、下次加歲月份', '高', '生日缺漏的人不進年齡統計；性別缺漏時用身分證第 2 碼推算（推論）。'],
      ['被保險人 職業', pc(I.filter(g => g.occupation).length, I.length), '被保險人：職業分佈', '中', '自由填寫的文字，寫法不一致會被分成不同類（例如「工程師」與「軟體工程師」）；樣本少時只適合看缺漏。'],
      ['被保險人 職業等級', pc(I.filter(g => g.detail && g.detail.occGrade).length, I.length), '被保險人：職業等級分佈', '中', '樣本少時幾乎全是同一級；職業等級是承保／費率用，不是客群分類，只適合當缺漏與核對。'],
      ['身分證字號', pc(I.filter(g => g.detail && g.detail.id).length, I.length), '不納入統計', '不建議', '個資，統計用不到；程式只用它推算性別與檢核碼，結果顯示在「待補充」。'],
      ['保額／金額', pc(conv, P.length) + '（有可換算金額的保單）', '保障：身故保額帶、住院日額帶；TreeMap 指標', '中', '金額單位混雜（萬／元／計劃／單位／外幣），只統計能換算的；單位型的商品要在 coverage.yaml 寫 per_unit 才能換算，否則算 0。'],
      ['商品名稱', pc(items.filter(x => Coverage.ok() && Coverage.lookup(x.it.name).source === 'manual').length, items.length) + '（已依條款確認）', '產品：持有排行、險種、主約／附約、資料來源', '高', '官網只有在售商品，舊商品都在「名稱推論」；險種分類是依名稱關鍵字，要精確得靠 coverage.yaml。'],
    ];
    return `<div class="card"><h2>新增欄位能不能納入統計？</h2>
      <p class="small">目前資料量：<b>${Store.list.length}</b> 位客戶、<b>${P.length}</b> 張保單、<b>${I.length}</b> 位被保險人、<b>${items.length}</b> 個商品項目。<b>樣本這麼少時，所有比例與分佈只適合「看缺口、找下一步」，不能當作客群趨勢。</b>以下的填寫率是即時計算的。</p>
      <div class="tablewrap"><table><thead><tr><th class="nosort">欄位</th><th class="nosort">目前填寫</th><th class="nosort">已加入的統計</th><th class="nosort">適合度</th><th class="nosort">限制／建議</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${E(r[0])}</b></td><td>${E(r[1])}</td><td>${E(r[2])}</td><td><span class="tag ${r[3] === '高' ? 'own' : r[3] === '不建議' ? 'warn' : ''}">${r[3]}</span></td><td class="small" style="white-space:normal;min-width:280px">${E(r[4])}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="muted small">「適合度」是我依資料型態做的判斷：高＝欄位格式固定、可直接分組；中＝可以統計但有明顯限制；不建議＝統計沒有價值或涉及個資。</p></div>`;
  },
  cross(L) {
    const bands = U.bandOrder.filter(b => L.some(c => c.band === b)), ds = [...new Set(L.map(c => c.city + c.district))];
    const dd = this.dimOf('customer', 'district'), bd = this.dimOf('customer', 'band'), cell = (n, title, pred, conds) => n ? `<td class="click" ${this.d(title, pred, null, false, { uid: 'customer', conds: conds.map(x => ({ ...x, op: 'eq' })) })}>${n}</td>` : '<td>·</td>';
    return `<div class="tablewrap"><table><thead><tr><th class="nosort">縣市區</th>${bands.map(b => `<th class="nosort">${b}</th>`).join('')}<th class="nosort">合計</th></tr></thead><tbody>` +
      ds.map(d => `<tr><td>${U.esc(d || '未填')}</td>${bands.map(b => { const n = L.filter(c => (c.city + c.district) === d && c.band === b).length; return cell(n, d + '・' + b, c => (c.city + c.district) === d && c.band === b, [{ dim: dd, key: d || '未填地址' }, { dim: bd, key: b }]); }).join('')}${cell(L.filter(c => (c.city + c.district) === d).length, d, c => (c.city + c.district) === d, [{ dim: dd, key: d || '未填地址' }])}</tr>`).join('') + '</tbody></table></div>';
  },

  /* ---------- 下鑽（共用 Drill 面板） ---------- */
  showDrill(idx, neg) {
    const r = this.reg[idx]; if (!r) return;
    if (r.spec) { Drill.query({ uid: r.spec.uid, conds: r.spec.conds.map(c => ({ ...c })), tab: (neg === undefined ? r.neg : neg) ? 'rest' : 'hit' }); return; }
    neg = neg === undefined ? r.neg : neg;
    const L = Store.list, hit = L.filter(c => neg ? !r.pred(c) : r.pred(c));
    const title = r.labels ? (neg ? r.labels.neg : r.labels.pos) : (neg ? '不屬於「' + r.title + '」' : r.title);
    Drill.open(title, hit, L.length, { label: neg ? '看符合的 ' + (L.length - hit.length) + ' 位' : '看其餘 ' + (L.length - hit.length) + ' 位', run: () => this.showDrill(idx, !neg) });
  },
  bind() {
    const el = document.getElementById('tab-stats');
    const act = e => { const ss = e.target.closest('[data-ssub]'); if (ss) { this.st.sub = ss.dataset.ssub; return this.render(); } const sb = e.target.closest('[data-sub]'); if (sb) { this.st.sub = sb.dataset.sub; return this.render(); } const g = e.target.closest('[data-go]'); if (g) return App.show(g.dataset.go); const t = e.target.closest('[data-d]'); if (t) this.showDrill(+t.dataset.d); };
    el.addEventListener('click', act);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') act(e); });
  },
};
