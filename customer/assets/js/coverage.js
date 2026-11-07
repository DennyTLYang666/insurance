/* 商品 → 保障項目對照，以及依被保險人加總（供「保障」分頁、保單明細使用）
 * 資料來源見 scripts/py/build/build_coverage.py：manual（已確認）＞ catalog（官網特色）＞ rules（只看名稱的推論）。 */
const Coverage = {
  data: null,
  init(raw) { this.data = raw && raw.codes ? raw : null; this._rules = null; this._cache = new Map(); },
  ok() { return !!this.data; },
  codes() { return this.data ? this.data.codes : []; },
  label(code) { const c = this.codes().find(x => x[0] === code); return c ? c[1] : code; },
  group(code) { const c = this.codes().find(x => x[0] === code); return c ? c[2] : '給付'; },
  BASIS_TXT: { sum: '保額', daily: '日額', reimb: '實支實付', lump: '一次給付', text: '有此保障', auto: '依金額' },
  SRC_TXT: { manual: '已確認', catalog: '官網特色', rules: '名稱推論', none: '未建檔' },

  /* 與 build_coverage.py 的 norm_name 相同 */
  norm(name) {
    let s = String(name || '').replace(/【[^】]*】/g, '').replace(/[（(]\d{2,3}[)）]/g, '').replace(/\s+/g, '');
    return s.startsWith('台灣人壽') ? s.slice(4) : s;
  },
  /* 商品名稱 → {source, benefits[], note, label} ；只做完全比對，不做模糊比對（避免把不同商品當成同一個） */
  lookup(name) {
    if (!this.data) return { source: 'none', benefits: [] };
    const k = this.norm(name);
    if (this._cache.has(k)) return this._cache.get(k);
    let r = null;
    const p = this.data.products[k];
    if (p && p.benefits && p.benefits.length) r = { source: p.source, benefits: p.benefits, note: p.note || p.basis_note || '', label: p.name };
    else {
      if (!this._rules) this._rules = (this.data.rules || []).map(x => ({ ...x, re: new RegExp(x.pattern) }));
      const hit = this._rules.find(x => x.re.test(name));
      r = hit ? { source: 'rules', benefits: hit.benefits, note: hit.note || '', label: hit.label } : { source: 'none', benefits: [] };
    }
    this._cache.set(k, r); return r;
  },

  /* 金額字串：72萬 / 700元 / 2計劃 / 2單位 */
  parseAmt(s) {
    const m = String(s || '').replace(/,/g, '').match(/^\s*([\d.]+)\s*(萬|元|[^\d\s.]+)?/);
    if (!m) return { n: null, unit: '', raw: String(s || '') };
    return { n: parseFloat(m[1]), unit: m[2] || '', raw: String(s) };
  },
  fmtMoney(n) { return n >= 10000 ? (+(n / 10000).toFixed(2)) + '萬' : n + '元'; },

  /* 保單是否仍有效（只排除明確寫了失效／終止的狀態；減額繳清算有效，但金額可能已調降） */
  inForce(status) { return !/(失效|停效|終止|解約|退保|撤銷|滿期)/.test(status || ''); },

  // death_all／hosp_all：不分原因，疾病、意外、癌症三欄都計入
  expand(code) { return code === 'death_all' ? ['death_disease', 'death_accident', 'death_cancer'] : code === 'hosp_all' ? ['hosp_disease', 'hosp_accident', 'hosp_cancer'] : [code]; },
  allKind(code) { return code === 'death_all' ? 'death' : code === 'hosp_all' ? 'hosp' : ''; },
  ALL_TXT: { death: '身故（不分原因）', hosp: '住院（不分原因）' },

  /* 一張保單 → 保障貢獻清單
   * 金額換算：單位「萬／元」直接換算；單位是「計劃／單位」等，只有設定檔寫了 per_unit（每單位幾元）才換算。
   * 保額型 value ＝ 金額 × pay.rate（沒寫 rate 視為 1）；pay.fixed ＝ 固定給付金額。 */
  contributions(p) {
    const out = [];
    p.items.forEach(it => {
      const lk = this.lookup(it.name), amt = this.parseAmt(it.amount);
      lk.benefits.forEach(b => {
        const pay = b.pay || null, rate = pay && typeof pay.rate === 'number' ? pay.rate : 1;
        this.expand(b.code).forEach(code => {
          let basis = b.basis || 'text';
          if (basis === 'auto') basis = amt.unit === '萬' ? 'sum' : (amt.unit === '元' && code.startsWith('hosp') ? 'daily' : 'text');
          // base：換算成「元」的金額（保額型＝保額；日額型＝每日金額）
          let base = null, byUnit = false;
          if (amt.n != null) {
            if (amt.unit === '萬' && basis !== 'daily') base = amt.n * 10000;
            else if (amt.unit === '元') base = amt.n;
            else if (b.per_unit && amt.unit && amt.unit !== '萬') { base = amt.n * b.per_unit; byUnit = true; }
          }
          let value = null, daily = null;
          if ((basis === 'sum' || basis === 'lump') && pay && typeof pay.fixed === 'number') value = pay.fixed;
          else if ((basis === 'sum') && base != null) value = base * rate;
          else if (basis === 'daily' && base != null) daily = base;
          else if (basis === 'sum' || basis === 'daily') basis = 'text';   // 單位不符且沒設 per_unit → 不加總，只標有此保障
          out.push({ code, basis, value, daily, base, rate, byUnit, b, p, it, lk, src: lk.source, raw: it.amount || '', all: this.allKind(b.code), note: b.note || '', table: !!(pay && pay.table), fixed: !!(pay && typeof pay.fixed === 'number') });
        });
      });
    });
    return out;
  },

  /* 一位被保險人（Store.insureds 的一筆）→ 各保障項目加總 */
  ofInsured(g) {
    const cells = {}, active = [], excluded = [], unknown = [];
    g.policies.forEach(p => {
      if (!this.inForce(p.status)) { excluded.push(p); return; }
      active.push(p);
      p.items.forEach(it => { if (this.lookup(it.name).source === 'none') unknown.push({ p, it }); });
      this.contributions(p).forEach(c => {
        const x = cells[c.code] || (cells[c.code] = { sum: 0, daily: 0, nText: 0, hasSum: false, hasDaily: false, list: [], inferred: false });
        x.list.push(c);
        if (c.table) x.nText++;   // 依給付表（手術、失能等級…）：金額視項目而定，不加總
        else if (c.value != null) { x.sum += c.value; x.hasSum = true; } else if (c.daily != null) { x.daily += c.daily; x.hasDaily = true; } else x.nText++;
        if (c.src === 'rules') x.inferred = true;
      });
    });
    return { cells, active, excluded, unknown };
  },
  cellText(x) {
    if (!x) return '';
    const parts = [];
    if (x.hasSum) parts.push(this.fmtMoney(x.sum));
    if (x.hasDaily) parts.push(x.daily + '元/日');
    if (x.nText) parts.push(x.hasSum || x.hasDaily ? '＋' + x.nText + '項' : '✔');
    return parts.join('　');
  },
  basisTxt(c) {
    if (c.table) return (c.raw ? c.raw + '｜' : '') + '依給付表（試算頁選項目）';
    const u = c.byUnit ? `（${c.raw}×每單位${c.b.per_unit}元）` : '';
    if (c.value != null) return this.fmtMoney(c.value) + (c.fixed ? '（固定給付）' : c.rate !== 1 ? `（保額×${c.rate}）` : '（保額）') + u;
    if (c.daily != null) return c.daily + '元/日' + u;
    return (c.raw ? c.raw + '｜' : '') + (this.BASIS_TXT[c.basis] || c.basis);
  },
  srcTag(s) {
    const cls = s === 'manual' ? 'own' : s === 'rules' || s === 'none' ? 'warn' : '';
    return `<span class="tag ${cls}" title="${s === 'manual' ? '你依條款確認過' : s === 'catalog' ? '官網商品特色欄，依規則對應（疾病／意外歸類依商品名稱）' : s === 'rules' ? '只看商品名稱推論，未經條款確認' : '沒有這個商品的保障資料'}">${this.SRC_TXT[s] || s}</span>`;
  },
  /* 客戶持有的不同商品（名稱） */
  heldProducts() {
    const m = new Map();
    Store.policies.forEach(p => p.items.forEach(i => { const e = m.get(i.name) || { name: i.name, n: 0 }; e.n++; m.set(i.name, e); }));
    return [...m.values()].sort((a, b) => U.coll.compare(a.name, b.name));
  },
  unconfirmed() { return this.ok() ? this.heldProducts().filter(x => this.lookup(x.name).source !== 'manual') : []; },
};
