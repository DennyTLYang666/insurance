/* 統計用的「單位」「維度」「指標」定義：統計分頁的長條圖與 TreeMap 共用。
 * 單位：客戶（要保人）／被保險人／保單／商品項目。每個單位可對應到「要保人（客戶）」，供點擊下鑽。
 * 維度：把一個單位分成幾類的方式（性別、年齡帶、保單狀態、始期年份…），回傳字串；沒資料回傳「未填…」。 */
const Dims = {
  _ins: null, _cov: null,
  prep() { this._ins = new Map(Store.insureds.map(g => [g.name, g])); this._cov = new Map(); this._now = U.today(); },
  insOf(p) { return this._ins.get(p.insuredName) || null; },
  covOf(g) { let r = this._cov.get(g); if (!r) this._cov.set(g, r = Coverage.ofInsured(g)); return r; },

  TENURE: ['未滿 1 年', '1–3 年', '3–5 年', '5–10 年', '10–20 年', '20 年以上', '未填始期'],
  tenure(p) {
    const s = U.parseIso(p.start); if (!s) return '未填始期';
    const y = (this._now - s) / (365.25 * 864e5);
    return y < 1 ? '未滿 1 年' : y < 3 ? '1–3 年' : y < 5 ? '3–5 年' : y < 10 ? '5–10 年' : y < 20 ? '10–20 年' : '20 年以上';
  },
  cnt(n, u) { return (n >= 3 ? '3' : String(n)) + u + (n >= 3 ? '以上' : ''); },
  month(d) { return d ? (d.getMonth() + 1) + ' 月' : ''; },
  MONTHS: Array.from({ length: 12 }, (_, i) => (i + 1) + ' 月'),
  gender: g => g || '性別未知',
  mainName(p) { const m = p.items.find(i => !i.rider) || p.items[0]; return m ? Coverage.norm(m.name) || m.name : '未填商品'; },
  hasCode(g, code) { return !!this.covOf(g).cells[code]; },

  units: {
    customer: { label: '客戶（要保人）', unit: '位', all: () => Store.list, own: u => [u] },
    insured: { label: '被保險人', unit: '人', all: () => Store.insureds, own: g => g.owners },
    policy: { label: '保單', unit: '張', all: () => Store.policies, own: p => [p.owner] },
    item: { label: '商品項目', unit: '項', all: () => Store.policies.flatMap(p => p.items.map(it => ({ p, it }))), own: x => [x.p.owner] },
  },

  /* 每個維度：{id, label, fn(單位)→字串, order?: 固定排序}；order 沒列到的排在後面 */
  dims() {
    const D = this, bandOrd = U.bandOrder;
    const insG = p => { const g = D.insOf(p); return g ? D.gender(g.gender) : '性別未知'; };
    const insB = p => { const g = D.insOf(p); return g ? U.ageBand(g.age) : '未填生日'; };
    const KEY = [['death_disease', '疾病身故'], ['death_accident', '意外身故'], ['hosp_disease', '疾病住院'], ['hosp_cancer', '癌症住院']];
    return {
      customer: [
        { id: 'status', label: '狀態', fn: c => c.status, order: Store.statuses() },
        { id: 'gender', label: '性別', fn: c => D.gender(c.gender) },
        { id: 'band', label: '年齡帶', fn: c => c.band, order: bandOrd },
        { id: 'district', label: '縣市區', fn: c => (c.city + c.district) || '未填地址' },
        { id: 'circle', label: '生活圈', fn: c => c.circle || '未填生活圈' },
        { id: 'visit', label: '拜訪', fn: c => c.visited ? '已拜訪' : '未拜訪', order: ['已拜訪', '未拜訪'] },
        { id: 'pcnt', label: '保單張數', fn: c => c.policies.length ? D.cnt(c.policies.length, '張') : '沒有保單', order: ['沒有保單', '1張', '2張', '3張以上'] },
      ],
      insured: [
        { id: 'role', label: '身分', fn: g => g.customer ? '要保人（客戶）' : '僅被保險人' },
        { id: 'gender', label: '性別', fn: g => D.gender(g.gender) },
        { id: 'band', label: '年齡帶（足歲）', fn: g => U.ageBand(g.age), order: bandOrd },
        { id: 'insband', label: '年齡帶（保險年齡）', fn: g => U.ageBand(g.insAge), order: bandOrd },
        { id: 'occupation', label: '職業', fn: g => g.occupation || '未填職業' },
        { id: 'occ', label: '職業等級', fn: g => g.detail && g.detail.occGrade ? '第 ' + g.detail.occGrade + ' 類' : '未填職業等級' },
        { id: 'bump', label: '下次加歲月份', fn: g => g.bump ? D.month(g.bump.date) : '缺生日', order: D.MONTHS },
        { id: 'active', label: '有效保單數', fn: g => D.cnt(D.covOf(g).active.length, '張'), order: ['0張', '1張', '2張', '3張以上'] },
        ...KEY.map(([code, lab]) => ({ id: 'has_' + code, label: '有無' + lab, fn: g => D.hasCode(g, code) ? '有' + lab : '沒有' + lab })),
        { id: 'kcount', label: '四項基本保障齊全度', fn: g => KEY.filter(([c]) => D.hasCode(g, c)).length + ' / 4 項', order: ['0 / 4 項', '1 / 4 項', '2 / 4 項', '3 / 4 項', '4 / 4 項'] },
      ],
      policy: [
        { id: 'status', label: '保單狀態', fn: p => p.status || '未填狀態' },
        { id: 'mode', label: '繳別', fn: p => p.payMode + (p.payModeDef ? '（預設）' : '') },
        { id: 'year', label: '始期年份', fn: p => p.start ? p.start.slice(0, 4) + ' 年' : '未填始期' },
        { id: 'tenure', label: '保單年資', fn: p => D.tenure(p), order: D.TENURE },
        { id: 'bene', label: '受益人登錄', fn: p => p.bene.length ? '已登錄受益人' : '未登錄受益人' },
        { id: 'benen', label: '受益人人數', fn: p => p.bene.length ? D.cnt(p.bene.length, '人') : '未登錄', order: ['1人', '2人', '3人以上', '未登錄'] },
        { id: 'self', label: '要保人＝被保險人', fn: p => p.self ? '本人' : '他人' },
        { id: 'owband', label: '要保人年齡帶', fn: p => p.owner.band, order: bandOrd },
        { id: 'owgender', label: '要保人性別', fn: p => D.gender(p.owner.gender) },
        { id: 'insgender', label: '被保險人性別', fn: insG },
        { id: 'insband', label: '被保險人年齡帶', fn: insB, order: bandOrd },
        { id: 'due', label: '下次繳費月份', fn: p => p.due.date ? D.month(p.due.date) : ({ nostart: '缺始期', stopped: '已停止', paidup: '繳費期滿', single: '躉繳' })[p.due.kind] || '—', order: D.MONTHS },
        { id: 'rider', label: '含附約', fn: p => p.items.some(i => i.rider) ? '含附約' : '無附約' },
        { id: 'nitems', label: '商品數', fn: p => D.cnt(p.items.length, '項'), order: ['1項', '2項', '3項以上'] },
        { id: 'main', label: '主商品', fn: p => D.mainName(p) },
      ],
      item: [
        { id: 'name', label: '商品', fn: x => Coverage.norm(x.it.name) || x.it.name },
        { id: 'rider', label: '主約／附約', fn: x => x.it.rider ? '附約' : '主約', order: ['主約', '附約'] },
        { id: 'type', label: '險種（名稱推論）', fn: x => Store.typeLabel(x.it.type) },
        { id: 'src', label: '保障資料來源', fn: x => Coverage.ok() ? Coverage.SRC_TXT[Coverage.lookup(x.it.name).source] : '未載入', order: ['已確認', '官網特色', '名稱推論', '未建檔'] },
        { id: 'status', label: '保單狀態', fn: x => x.p.status || '未填狀態' },
        { id: 'mode', label: '繳別', fn: x => x.p.payMode },
        { id: 'year', label: '始期年份', fn: x => x.p.start ? x.p.start.slice(0, 4) + ' 年' : '未填始期' },
        { id: 'tenure', label: '保單年資', fn: x => D.tenure(x.p), order: D.TENURE },
        { id: 'insgender', label: '被保險人性別', fn: x => insG(x.p) },
        { id: 'insband', label: '被保險人年齡帶', fn: x => insB(x.p), order: bandOrd },
      ],
    };
  },

  /* 指標：count＝單位個數（預設）。金額類只算「可換算」的（單位為萬／元，或設定檔有 per_unit），其餘算 0 */
  deathOf(p, it) {
    if (!Coverage.ok() || !Coverage.inForce(p.status)) return 0;
    return Coverage.contributions(p).filter(c => (!it || c.it === it) && c.code === 'death_disease' && c.value != null && !c.table).reduce((a, c) => a + c.value, 0);
  },
  metrics: {
    customer: [{ id: 'count', label: '人數', fn: () => 1 }, { id: 'pol', label: '保單張數', fn: c => c.policies.length }],
    insured: [{ id: 'count', label: '人數', fn: () => 1 },
      { id: 'death', label: '疾病身故保額', money: true, fn: g => { const x = Dims.covOf(g).cells.death_disease; return x && x.hasSum ? x.sum : 0; } },
      { id: 'hosp', label: '疾病住院日額（元/日）', daily: true, fn: g => { const x = Dims.covOf(g).cells.hosp_disease; return x && x.hasDaily ? x.daily : 0; } }],
    policy: [{ id: 'count', label: '張數', fn: () => 1 }, { id: 'items', label: '商品項目數', fn: p => p.items.length },
      { id: 'death', label: '疾病身故保額', money: true, fn: p => Dims.deathOf(p) }],
    item: [{ id: 'count', label: '項數', fn: () => 1 }, { id: 'death', label: '疾病身故保額', money: true, fn: x => Dims.deathOf(x.p, x.it) }],
  },
  fmtVal(m, v) { return m.money ? Coverage.fmtMoney(v) : m.daily ? v + '元/日' : String(v); },

  /* 依一個維度把單位分組 → [{key, units[]}]，依 order（若有）再依數量排序 */
  group(units, dim) {
    const m = new Map();
    units.forEach(u => { const k = dim.fn(u) || '未填'; (m.get(k) || m.set(k, []).get(k)).push(u); });
    const ord = dim.order || [];
    const rank = k => { const i = ord.indexOf(k); return i < 0 ? 999 : i; };
    return [...m].map(([key, us]) => ({ key, units: us })).sort((a, b) => rank(a.key) - rank(b.key) || b.units.length - a.units.length || a.key.localeCompare(b.key, 'zh-Hant'));
  },
  /* 一批單位 → 對應的要保人（客戶）清單（去重） */
  owners(uid, units) {
    const own = this.units[uid].own, seen = new Set(), out = [];
    units.forEach(u => own(u).forEach(c => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } }));
    return out;
  },
};
