/* 理賠試算：依 coverage.yaml 的 pay 設定，估算「某位被保險人發生某事故」各保單可能給付多少。
 * 只是依你寫的設定估算，不是核保或理賠審核結果；沒寫 pay 的保障項目用「預設」算法並標示。
 * 不處理：累計上限／已領過的理賠、給付順序、同事故多張保單的比例分攤、保單條款未寫入設定檔的細節。 */
const Claim = {
  CAUSES: [['disease', '疾病'], ['accident', '意外'], ['cancer', '癌症']],
  EVENTS: [
    { id: 'death', label: '身故', byCause: 'death_', need: [] },
    { id: 'hosp', label: '住院', byCause: 'hosp_', need: ['days'] },
    { id: 'surgery', label: '手術', code: 'surgery', need: ['key'], anyCause: true },
    { id: 'disability', label: '失能', code: 'disability', need: ['key'], anyCause: true },
    { id: 'outpatient', label: '門診／醫療費用', code: 'outpatient', need: ['amount'], anyCause: true },
    { id: 'cancer_diag', label: '癌症診斷／治療', code: 'cancer_diag', need: [] },
    { id: 'critical', label: '重大傷病／特定傷病', code: 'critical', need: [] },
    { id: 'ltc', label: '長期照顧／失智', code: 'ltc', need: [] },
    { id: 'survival', label: '生存／祝壽／滿期', code: 'survival', need: [] },
  ],
  ev(id) { return this.EVENTS.find(e => e.id === id) || this.EVENTS[0]; },
  codeOf(e, cause) { return e.byCause ? e.byCause + (cause || 'disease') : e.code; },

  /* 這位被保險人、這個事故會用到的保障貢獻（只含有效保單） */
  contribs(g, e, cause) {
    const r = Coverage.ofInsured(g), cell = r.cells[this.codeOf(e, cause)];
    return { list: cell ? cell.list : [], r };
  },
  /* 給付表可選的項目（所有符合保障的 pay.table 聯集，依出現順序） */
  keys(g, e, cause) {
    const ks = [];
    this.contribs(g, e, cause).list.forEach(c => { if (c.b && c.b.pay && c.b.pay.table) Object.keys(c.b.pay.table).forEach(k => { if (!ks.includes(k)) ks.push(k); }); });
    return ks;
  },

  fmt(n) { return Coverage.fmtMoney(Math.round(n)); },
  num(v, d) { return typeof v === 'number' ? v : d; },

  /* 一筆保障貢獻 × 一個事故 → {amount|null, how, conf, notes[], skip?} */
  payout(c, ev) {
    const pay = c.b && c.b.pay, p = pay || {}, notes = [];
    (p.conditions || []).forEach(x => notes.push('條件：' + x));
    (p.exclusions || []).forEach(x => notes.push('除外：' + x));
    if (p.note) notes.push(p.note);
    if (p.once) notes.push('僅給付一次');
    if (p.max_total_days) notes.push(`累計上限 ${p.max_total_days} 日（試算不會扣除過去已領的日數）`);
    if (c.p.status && /減額繳清/.test(c.p.status)) notes.push('減額繳清：保額可能已調降，請以保單現況為準');
    const conf = pay ? 'cfg' : 'default';
    const res = (amount, how, extra) => {
      if (amount != null && p.max_amount != null && amount > p.max_amount) { how += `；單次上限 ${this.fmt(p.max_amount)}`; amount = p.max_amount; }
      return { amount, how, conf, notes, ...(extra || {}) };
    };
    // cause 限定（例如失能只限意外）
    if (c.b && c.b.cause && ev.cause && c.b.cause !== ev.cause && ev.anyCause) return { skip: `此項只在「${this.causeTxt(c.b.cause)}」事故給付`, amount: 0, how: '不適用', conf, notes };
    const base = c.base, rate = this.num(p.rate, 1);
    let mult = null, keyTxt = '';
    if (p.table) {
      if (!ev.key) return { amount: null, how: '請先選擇給付項目', conf, notes, needKey: true };
      mult = p.table[ev.key];
      if (mult === undefined) return { amount: 0, how: `給付表沒有「${ev.key}」`, conf, notes, skip: '給付表沒有這個項目' };
      keyTxt = `「${ev.key}」`;
    }
    if (typeof p.fixed === 'number' && c.basis !== 'daily' && c.basis !== 'reimb') return res(p.fixed, `固定給付 ${this.fmt(p.fixed)}${keyTxt ? '（' + keyTxt + '）' : ''}`);
    switch (c.basis) {
      case 'sum': case 'lump': {
        if (base == null) return { amount: null, how: '金額單位無法換算（可在設定檔加 per_unit）', conf, notes };
        const m = mult != null ? mult : rate;
        return res(base * m, `${this.fmt(base)} × ${m}${mult != null ? '（給付表' + keyTxt + '）' : rate !== 1 ? '（pay.rate）' : pay ? '' : '（預設 100%）'}`);
      }
      case 'daily': {
        if (base == null) return { amount: null, how: '日額無法換算（單位不是「元」，可在設定檔加 per_unit）', conf, notes };
        if (mult != null) return res(base * mult, `日額 ${base} 元 × ${mult} 倍（給付表${keyTxt}）`);
        if (ev.id !== 'hosp') return { amount: null, how: '日額型保障只在「住院」事故試算（或在設定檔加 pay.table）', conf, notes };
        const days = ev.days, wait = this.num(p.waiting_days, 0), perDay = this.num(p.per_day, 1);
        if (p.min_days != null && days < p.min_days) return res(0, `住院 ${days} 日，未達最低 ${p.min_days} 日`);
        const eff = Math.max(days - wait, 0), paid = p.max_days != null ? Math.min(eff, p.max_days) : eff;
        const bits = [`住院 ${days} 日`]; if (wait) bits.push(`免責 ${wait} 日`); if (p.max_days != null && eff > p.max_days) bits.push(`每次上限 ${p.max_days} 日`);
        return res(base * paid * perDay, `日額 ${base} 元 × ${paid} 日${perDay !== 1 ? ' × ' + perDay : ''}（${bits.join('，')}）${pay ? '' : '（預設，未含免責日與上限）'}`);
      }
      case 'reimb': {
        if (ev.amount == null) return { amount: null, how: '請輸入實際花費（實支實付）', conf, notes, needAmt: true };
        const lim = p.max_amount == null ? '；⚠ 設定檔沒寫單次上限（max_amount），此數字只是不含上限的上界' : '';
        return res(ev.amount * rate, `實支實付：花費 ${this.fmt(ev.amount)} × ${rate}${lim}`);
      }
      default:
        return { amount: null, how: '只標示「有此保障」，金額未知（請在設定檔改 basis 並補 pay）', conf, notes };
    }
  },
  causeTxt(c) { return (this.CAUSES.find(x => x[0] === c) || [0, c])[1]; },

  /* 試算：g＝Store.insureds 的一筆；ev＝{id, cause, days, key, amount} */
  simulate(g, evIn) {
    const e = this.ev(evIn.id), ev = { ...evIn, id: e.id, anyCause: !!e.anyCause };
    const { list, r } = this.contribs(g, e, ev.cause);
    const rows = list.map(c => ({ c, ...this.payout(c, ev) }));
    const used = rows.filter(x => !x.skip);
    const sum = f => used.filter(x => x.amount != null && f(x)).reduce((a, x) => a + x.amount, 0);
    return { rows, e, r, total: sum(() => true), totalCfg: sum(x => x.conf === 'cfg'), totalDef: sum(x => x.conf === 'default'),
      unknown: used.filter(x => x.amount == null).length, skipped: rows.length - used.length };
  },
};
