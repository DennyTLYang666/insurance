/* 資料層：客戶資料（本機伺服器讀 adoc，或載入 .cbundle 資料檔）＋補填資料 overlay，組出畫面用的 view model。啟動時是空白。 */
const Store = {
  mode: 'file',           // 'server'（scripts/serve.py）或 'file'（雙擊 index.html）
  raw: null,
  ov: { extra: {}, visits: {}, geo: {}, settings: {} },
  list: [], policies: [], insureds: [],
  STATUS_ORDER: ['待訪談', '已歸檔', '原招', '非原招'],
  PRE_VISIT: ['待訪談', '已歸檔'],   // 公司分派、尚未拜訪的客戶狀態；拜訪後會詢問是否改為非原招
  LS_KEY: 'customer.overlay.v1',

  /* 啟動：只載入「系統資料」（商品保障等，非個資）。客戶資料不會自動讀入，要使用者按「載入」才讀。 */
  async load() {
    let server = false;
    if (location.protocol.startsWith('http')) {
      try {
        const r = await fetch('api/ping', { cache: 'no-store' });
        const j = r.ok ? await r.json() : {};
        server = j.ok === true; this.pdfCap = j.pdf || null;
      } catch (e) { server = false; }
    }
    this.serverAvail = server;
    this.mode = server ? 'server' : 'file';
    if (server) {
      try { Coverage.init(await (await fetch('api/coverage', { cache: 'no-store' })).json()); } catch (e) { Coverage.init(null); }
    } else Coverage.init(window.COVERAGE_DATA || null);
    this.raw = null; this.bundle = null; this._setOv({});
    this.rebuild();
  },
  /* 本機伺服器：明確按「載入」才從 adoc 讀客戶資料與補填資料 */
  async loadFromServer() {
    this.bundle = null; this.mode = 'server'; this.dirty = false;
    this.raw = await (await fetch('api/customers', { cache: 'no-store' })).json();
    this._setOv(await (await fetch('api/overlay', { cache: 'no-store' })).json());
    this.rebuild();
  },
  /* 鎖定：把客戶資料從記憶體清掉，回到空白 */
  unload() {
    clearTimeout(this._st);
    this.raw = null; this.bundle = null; this.dirty = false; this._warned = false;
    this.mode = this.serverAvail ? 'server' : 'file';
    this._setOv({});
    this.rebuild();
  },
  /* 從單一資料檔（.cbundle）載入 */
  applyBundle(d) {
    this.bundle = { built: d.built || '' };   // 資料檔模式：全部只放記憶體，不寫入瀏覽器（localStorage／IndexedDB）
    this.mode = 'file';
    this.raw = d.customers;
    if (d.coverage) Coverage.init(d.coverage);   // 新版資料檔不含商品保障（網頁自帶 data/coverage.js）；舊檔才有
    this._setOv(d.overlay || {});
    this.dirty = false;
    this.rebuild();
  },
  _setOv(o) {
    this.ov = { extra: {}, visits: {}, geo: {}, settings: {}, ins: {}, ...(o || {}) };
    for (const k of ['extra', 'visits', 'geo', 'settings', 'ins']) if (!this.ov[k] || typeof this.ov[k] !== 'object') this.ov[k] = {};
  },
  save() {
    if (this.bundle) {   // 資料檔模式：不存任何東西；改過的資料請用「匯出備份」帶走
      this.dirty = true;
      if (!this._warned) { this._warned = true; U.toast('資料檔模式：修改只在這個頁面，關閉就消失；要保留請按「匯出備份」'); }
      return;
    }
    clearTimeout(this._st);
    this._st = setTimeout(async () => {
      if (this.mode === 'server') {
        try {
          const r = await fetch('api/overlay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.ov) });
          if (!r.ok) throw new Error(r.status);
        } catch (e) { U.toast('儲存失敗：' + e.message); }
      } else {
        try { localStorage.setItem(this.LS_KEY, JSON.stringify(this.ov)); }
        catch (e) { U.toast('瀏覽器無法儲存，請用「匯出備份」'); }
      }
    }, 150);
  },
  exportJson() { return JSON.stringify(this.ov, null, 1); },
  importJson(text) { this._setOv(JSON.parse(text)); this.save(); this.rebuild(); },

  setExtra(id, patch) {
    const e = this.ov.extra[id] = Object.assign(this.ov.extra[id] || {}, patch);
    for (const k of Object.keys(e)) if (e[k] === '' || e[k] == null) delete e[k];
    if (!Object.keys(e).length) delete this.ov.extra[id];
    this.save(); this.rebuild();
  },
  /* 被保險人補填（目前只有職業），以姓名為鍵 */
  setInsExtra(name, patch) {
    const e = this.ov.ins[name] = Object.assign(this.ov.ins[name] || {}, patch);
    for (const k of Object.keys(e)) if (e[k] === '' || e[k] == null) delete e[k];
    if (!Object.keys(e).length) delete this.ov.ins[name];
    this.save(); this.rebuild();
  },
  setGeo(id, g) { if (g) this.ov.geo[id] = g; else delete this.ov.geo[id]; this.save(); this.rebuild(); },
  setting(k, v) { if (v === undefined) return this.ov.settings[k]; this.ov.settings[k] = v; this.save(); },

  normGender(s) {
    if (!s) return '';
    if (/^(男|m|male)$/i.test(s)) return '男';
    if (/^(女|f|female)$/i.test(s)) return '女';
    return s;
  },
  rebuild() {
    const now = U.today();
    const doneBy = {};
    for (const [d, v] of Object.entries(this.ov.visits)) for (const id of Object.keys(v.done || {})) if (v.done[id]) (doneBy[id] = doneBy[id] || []).push(d);
    const plannedBy = {};
    for (const d of Object.keys(this.ov.visits).sort()) for (const id of this.ov.visits[d].ids) if (!(this.ov.visits[d].done || {})[id] && !plannedBy[id]) plannedBy[id] = d;
    this.list = ((this.raw && this.raw.customers) || []).map(r => {
      const e = this.ov.extra[r.id] || {}, f = r.fields || {};
      const gReg = this.normGender(e.gender || f.gender);
      const gId = r.genderFromId === 'male' ? '男' : r.genderFromId === 'female' ? '女' : '';
      const ai = U.ageInfo(r.birth, now);
      const a = r.addresses[0] || null;
      const geo = this.ov.geo[r.id] || null;
      const v = {
        id: r.id, name: r.name, raw: r,
        status: e.status || r.status || '未分類',
        gender: gReg || gId, genderSrc: gReg ? '登錄' : (gId ? '身分證推算' : ''),
        birth: r.birth, age: ai ? ai.age : null, insAge: ai ? ai.insAge : null,
        band: U.ageBand(ai ? ai.age : null),
        mobiles: r.mobiles, homes: r.homes, addresses: r.addresses, addr: a,
        city: a ? a.city : '', district: a ? a.district : '', circle: a ? a.label : '', circleConf: a ? a.confidence : '',
        roadKey: a ? a.roadKey : '',
        occLegacy: e.occupation || f.occupation || '',   // 舊版記在客戶身上的職業；現在以被保險人的職業為準（見 buildPolicies）
        occupation: '',
        marital: e.marital || f.marital || '',
        email: e.email || f.email || '',
        source: e.source || f.source || '',
        note: e.note || f.note || '',
        nextVisit: e.nextVisit || f.nextVisit || '',
        policies: r.policies, policiesDeclared: r.policiesDeclared,
        warnings: r.warnings.slice(), idValid: r.idValid, geo,
        file: r.file,
        lastVisit: doneBy[r.id] ? doneBy[r.id].sort().pop() : '', planned: plannedBy[r.id] || '',
      };
      v.visited = !!v.lastVisit;
      v.ownTypes = new Set(); v.allTypes = new Set();
      r.policies.forEach(p => p.items.forEach(it => { const t = this.itemType(it.name); if (!t) return; v.allTypes.add(t); if (this.ownPolicy(p, r.name)) v.ownTypes.add(t); }));
      v.polStatuses = [...new Set(r.policies.map(p => p.status).filter(Boolean))];
      v.otherInsured = [...new Set(r.policies.map(p => p.insured).filter(x => x && x !== r.name))];
      return v;
    });
    this.buildPolicies();
  },
  /* 保單視角（一張保單一筆）與被保險人視角（一個人一筆）。要保人＝保單所在的客戶檔案。 */
  buildPolicies() {
    const pols = [];
    this.list.forEach(c => c.raw.policies.forEach((p, i) => {
      const items = p.items.map(it => ({ ...it, type: this.itemType(it.name), rider: this.isRider(it.name) }));
      pols.push({
        key: c.id + '#' + i, no: p.no, owner: c, insured: p.insured, insuredName: p.insured || c.name,
        self: !p.insured || p.insured === c.name, status: p.status, payMode: p.payMode || '年繳', payModeDef: !p.payMode, items, extra: p.extra,
        start: p.start || '', startRaw: p.startRaw || '', bene: p.beneficiaries || [],
        types: new Set(items.map(x => x.type).filter(Boolean)),
      });
    }));
    pols.forEach(p => { p.due = this.dueOf(p); });
    this.policies = pols;
    const m = new Map();
    pols.forEach(p => {
      if (!m.has(p.insuredName)) m.set(p.insuredName, { name: p.insuredName, policies: [], owners: new Set(), types: new Set(), statuses: new Set() });
      const g = m.get(p.insuredName);
      g.policies.push(p); g.owners.add(p.owner); p.types.forEach(t => g.types.add(t)); if (p.status) g.statuses.add(p.status);
    });
    // 被保險人細節：各客戶檔案「== 被保險人」區；同一人跨檔時，各欄位取第一個有值的
    const det = new Map();
    this.list.forEach(c => (c.raw.insureds || []).forEach(x => {
      const e = det.get(x.name) || det.set(x.name, {}).get(x.name);
      ['id', 'idValid', 'gender', 'genderSrc', 'birth', 'birthRaw', 'occGrade', 'occupation'].forEach(k => { if (!e[k] && x[k]) e[k] = x[k]; });
      (e.srcs = e.srcs || []).push(c.name);
    }));
    this.insureds = [...m.values()].map(g => {
      const d = det.get(g.name) || {};
      const customer = (d.id && this.list.find(c => c.id === d.id)) || this.list.find(c => c.name === g.name) || null;
      const birth = d.birth || (customer && customer.birth) || '';
      const ai = U.ageInfo(birth);
      const occ = (this.ov.ins[g.name] || {}).occupation || d.occupation || (customer && customer.occLegacy) || '';
      return { ...g, owners: [...g.owners], customer, detail: d, birth, age: ai ? ai.age : null, insAge: ai ? ai.insAge : null, bump: U.nextAgeBump(birth),
        gender: d.gender || (customer && customer.gender) || '', occupation: occ,
        occSrc: (this.ov.ins[g.name] || {}).occupation ? '補填' : d.occupation ? 'adoc' : occ ? '舊客戶欄位' : '' };
    });
    // 客戶的職業＝他本人（同一人）作為被保險人的職業；還沒有保單的客戶才用舊的客戶欄位或被保險人補填
    this.list.forEach(c => { const g = this.insureds.find(x => x.customer === c); c.occupation = g ? g.occupation : ((this.ov.ins[c.name] || {}).occupation || c.occLegacy); });
  },
  /* 設定值：提前幾天提醒（可在畫面上調整，記在本機） */
  warnDays(k) { const v = +this.ov.settings[k]; return v > 0 ? v : (k === 'ageWarnDays' ? 60 : 30); },
  /* 下次繳費：由保險始期＋繳別推算。主約繳費期滿者，只有含附約的保單才推算（附約是否續繳依條款，屬推定）。 */
  dueOf(p) {
    if (!p.start) return { kind: 'nostart' };
    const st = p.status || '';
    if (/(失效|停效|終止|解約|退保|減額繳清)/.test(st)) return { kind: 'stopped' };
    const paidUp = /繳費期滿/.test(st);
    if (paidUp && !p.items.some(i => i.rider)) return { kind: 'paidup' };
    const per = U.payPeriod(p.payMode);
    if (!per) return { kind: 'single' };
    const d = U.nextDue(p.start, per);
    return d ? { kind: paidUp ? 'rider' : 'due', period: per, ...d } : { kind: 'nostart' };
  },
  dueSoon() { const n = this.warnDays('payWarnDays'); return this.policies.filter(p => p.due.date && p.due.days <= n).sort((a, b) => a.due.days - b.due.days); },
  getPolicy(key) { return this.policies.find(p => p.key === key); },
  get(id) { return this.list.find(c => c.id === id); },
  statuses() {
    const s = new Set(this.list.map(c => c.status));
    this.STATUS_ORDER.forEach(x => s.add(x));
    return [...s].sort((a, b) => (this.STATUS_ORDER.indexOf(a) + 99) % 99 - (this.STATUS_ORDER.indexOf(b) + 99) % 99 || a.localeCompare(b, 'zh-Hant'));
  },
  statusClass(s) { return s === '待訪談' ? 'todo' : s === '原招' || s === '非原招' ? 'own' : ''; },

  /* 保單：依商品名稱關鍵字推斷保障類型（推論，非官方分類）；只算被保險人為本人的保單 */
  TYPES: ['防癌', '意外傷害', '住院醫療', '壽險'],
  TYPE_LABEL: { 防癌: '防癌險', 意外傷害: '意外傷害險', 住院醫療: '住院醫療險', 壽險: '壽險（含還本）', '': '其他' },
  typeLabel(t) { return this.TYPE_LABEL[t] || t; },
  isRider(name) { return /附約|附加/.test(name); },
  itemType(name) {
    if (/防癌/.test(name)) return '防癌';
    if (/傷害|意外/.test(name)) return '意外傷害';
    if (/醫療/.test(name)) return '住院醫療';
    if (/壽險|還本|終身/.test(name)) return '壽險';
    return '';
  },
  ownPolicy(p, name) { return !p.insured || p.insured === name; },

  /* 點擊撥號／導航（用 data 屬性＋全域點擊處理，遮蔽個資時滑鼠移上去也不會露出號碼） */
  callBtns(c, masked) {
    return [...c.mobiles.map(p => [p, '📱']), ...c.homes.map(p => [p, '☎'])]
      .map(([p, ic]) => `<a class="call" href="#" role="button" data-tel="${U.esc(p)}" title="撥打電話">${ic} ${U.esc(masked ? U.maskPhone(p) : U.fmtPhone(p))}</a>`).join(' ');
  },
  navBtn(c, label, a) {
    const q = a ? a.raw : this.mapQuery(c);
    return q ? `<a class="call" href="#" role="button" data-nav="${U.esc(q)}" title="Google 地圖導航">🧭 ${U.esc(label || '導航')}</a>` : '';
  },
  navUrl(q) { return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + U.enc(q); },

  /* 地址文字（遮蔽時不含門牌） */
  addrText(c, masked, a) {
    a = a || c.addr;
    if (!a) return '';
    if (!masked) return a.raw;
    return (a.city || '') + (a.district || '') + (a.roadKey || '') + (a.raw ? '…' : '');
  },
  /* 供 Google 地圖用：有座標用座標，否則用完整地址 */
  mapQuery(c) { return c.geo ? c.geo.lat + ',' + c.geo.lng : (c.addr ? c.addr.raw : ''); },
};
