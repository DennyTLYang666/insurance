/* 同步（第一階段）：資料檔（.cbundle）仍是主體；補填資料的每次修改變成一筆「加密操作」，
 * 登入後上傳／下載其他裝置的更新，合併進記憶體裡的資料；要帶走時匯出新的資料檔（.cbundle，即「檢查點」）。
 *
 * 安全設計：
 *  - 伺服器只存「加密後的資料塊」（AES-256-GCM），沒有金鑰；金鑰（DK）在資料檔裡，登入帳號本身解不開資料。
 *  - 操作的內容（客戶 id、欄位、值）全部在加密塊內；伺服器只看到 opId、裝置代號、大小、時間。
 *  - 離線時尚未上傳的操作，用 DK 衍生的另一把金鑰加密後暫存在這個瀏覽器的 IndexedDB（outbox）。
 *    Safari 對網站儲存有 7 天不使用即清除的規則，所以這只是短期暫存，不是備份。
 * 合併規則：每個「欄位」各自取最後修改者（LWW，時間用混合邏輯時鐘 HLC，同時間以裝置代號決勝）。
 *  - 排程的 ids（拜訪名單）若兩邊同時改，會聯集後再送出，避免靜默掉一家。
 *  - 目前只同步補填資料（狀態、備註、職業、座標、排程、拜訪紀錄、設定）；客戶主檔（adoc）不經過伺服器。 */
const Sync = {
  SV: 1,                                       // 操作格式版本；遇到更新的版本會停止套用並請使用者更新網頁
  LOCAL_ONLY: new Set(['mask', 'mapTiles']),   // 只屬於這台裝置的設定，不同步
  SEP: '\x1f',
  on: false, why: '', status: 'off',
  baseId: '', dev: '', seq: 0, epoch: 1, url: '',
  clk: {}, shadow: new Map(), outbox: [], conflicts: [],
  srvReset: false, wall: 0, cnt: 0, token: '', user: '', tr: null, lastSync: 0, blocked: '', bad: 0, persistOK: true,
  _dk: null, _k: null, _q: Promise.resolve(), _timer: 0, _poll: 0, _pq: Promise.resolve(), _applying: false,

  /* ---------- 小工具 ---------- */
  _enc: new TextEncoder(), _dec: new TextDecoder(),
  _b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
  _unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
  _cat(...a) { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let p = 0; a.forEach(y => { o.set(y, p); p += y.length; }); return o; },
  _uuid() { return crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); },
  _wallOf(t) { return parseInt(String(t).slice(0, 13), 10) || 0; },
  _tick() {
    const now = Date.now();
    if (now > this.wall) { this.wall = now; this.cnt = 0; } else this.cnt++;
    return String(this.wall).padStart(13, '0') + '-' + this.cnt.toString(36).padStart(4, '0') + '-' + this.dev;
  },
  _key(p) { return p.join(this.SEP); },
  _localIso() { const d = new Date(), o = -d.getTimezoneOffset(), z = n => String(Math.abs(n)).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}${o >= 0 ? '+' : '-'}${z(Math.trunc(o / 60))}:${z(o % 60)}`; },

  /* ---------- 加密 ---------- */
  async _derive(dk, baseId) {
    const base = await crypto.subtle.importKey('raw', dk, 'HKDF', false, ['deriveKey']);
    const mk = info => crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: this._enc.encode(info + '|' + baseId) },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { ops: await mk('cbundle-ops-v1'), box: await mk('cbundle-outbox-v1') };
  },
  async _seal(op) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this._enc.encode(this.baseId + '|' + op.id) }, this._k.ops, this._enc.encode(JSON.stringify(op))));
    return this._b64(this._cat(iv, ct));
  },
  async _open(id, blob) {
    const b = this._unb64(blob);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12), additionalData: this._enc.encode(this.baseId + '|' + id) }, this._k.ops, b.subarray(12));
    const op = JSON.parse(this._dec.decode(pt));
    if (op.id !== id) throw new Error('id mismatch');
    return op;
  },

  /* ---------- 本機暫存（IndexedDB） ---------- */
  _idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('customer.sync', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async _kv(mode, k, v) {
    const db = await this._idb();
    try {
      return await new Promise((res, rej) => {
        const st = db.transaction('kv', mode === 'get' ? 'readonly' : 'readwrite').objectStore('kv');
        const q = mode === 'get' ? st.get(k) : mode === 'del' ? st.delete(k) : st.put(v, k);
        q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
      });
    } finally { db.close(); }
  },
  _persist() {
    const id = this.baseId, k = this._k && this._k.box, snap = JSON.stringify(this.outbox);
    this._pq = this._pq.then(async () => {
      if (!k || id !== this.baseId) return;
      try {
        if (!this.outbox.length) await this._kv('del', 'box:' + id);
        else {
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this._enc.encode(id) }, k, this._enc.encode(snap)));
          await this._kv('put', 'box:' + id, this._b64(this._cat(iv, ct)));
        }
        this.persistOK = true;
      } catch (e) {
        if (this.persistOK) U.toast('這個瀏覽器無法暫存離線修改（可能是無痕模式）；請盡快同步或匯出資料檔');
        this.persistOK = false; Store.dirty = true;
      }
    });
    return this._pq;
  },
  async _loadBox() {
    try {
      const v = await this._kv('get', 'box:' + this.baseId);
      if (!v) return [];
      const b = this._unb64(v);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12), additionalData: this._enc.encode(this.baseId) }, this._k.box, b.subarray(12));
      const a = JSON.parse(this._dec.decode(pt));
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  },

  /* ---------- 補填資料 → 欄位層級的「葉」 ---------- */
  leaves(ov) {
    const m = new Map(), add = (p, v) => m.set(this._key(p), { p, v });
    const two = k => { for (const [a, o] of Object.entries(ov[k] || {})) for (const [f, v] of Object.entries(o || {})) add([k, a, f], v); };
    two('extra'); two('ins');
    for (const [id, g] of Object.entries(ov.geo || {})) add(['geo', id], g);
    for (const [k, v] of Object.entries(ov.settings || {})) if (!this.LOCAL_ONLY.has(k)) add(['settings', k], v);
    for (const [d, v] of Object.entries(ov.visits || {})) {
      if (v.ids && v.ids.length) add(['visits', d, 'ids'], v.ids);
      for (const [id, x] of Object.entries(v.done || {})) add(['visits', d, 'done', id], x);
      for (const [id, x] of Object.entries(v.rec || {})) add(['visits', d, 'rec', id], x);
    }
    const known = new Set(['extra', 'ins', 'geo', 'settings', 'visits']);
    for (const [k, v] of Object.entries(ov)) if (!known.has(k) && k[0] !== '_') add([k], v);
    return m;
  },
  _snapshot() { this.shadow = new Map(); for (const [k, { v }] of this.leaves(Store.ov)) this.shadow.set(k, JSON.stringify(v)); },

  /* ---------- 捕捉本機修改（Store.save 時呼叫）---------- */
  capture() {
    if (!this.on || this._applying) return;
    const cur = this.leaves(Store.ov), made = [];
    for (const [k, { p, v }] of cur) { const js = JSON.stringify(v); if (this.shadow.get(k) !== js) { this.shadow.set(k, js); made.push(this._emit(p, v, false)); } }
    for (const k of [...this.shadow.keys()]) if (!cur.has(k)) { this.shadow.delete(k); made.push(this._emit(k.split(this.SEP), undefined, true)); }
    if (!made.length) return;
    this._persist(); this._ui(); this.kick();
  },
  _emit(p, v, del) {
    const op = { id: this._uuid(), p, t: this._tick(), dev: this.dev, sv: this.SV };
    if (del) op.d = 1; else op.v = v;
    this.clk[this._key(p)] = op.t;
    this.outbox.push(op);
    return op;
  },

  /* ---------- 套用遠端（或重播暫存）操作 ---------- */
  _setAt(p, v) {
    let o = Store.ov;
    for (let i = 0; i < p.length - 1; i++) o = (o[p[i]] && typeof o[p[i]] === 'object') ? o[p[i]] : (o[p[i]] = {});
    o[p[p.length - 1]] = v;
  },
  _delAt(p) {
    const chain = [Store.ov];
    for (let i = 0; i < p.length - 1; i++) { const n = chain[i][p[i]]; if (!n || typeof n !== 'object') return; chain.push(n); }
    delete chain[chain.length - 1][p[p.length - 1]];
    for (let i = chain.length - 1; i >= 2; i--) if (!Object.keys(chain[i]).length) delete chain[i - 1][p[i - 1]]; else break;
  },
  _norm() {   // 排程資料的形狀：每一天一定有 ids 與 done；全空的就移除
    const vs = Store.ov.visits;
    for (const d of Object.keys(vs)) {
      const v = vs[d];
      if (!Array.isArray(v.ids)) v.ids = [];
      if (!v.done || typeof v.done !== 'object') v.done = {};
      if (!v.ids.length && !Object.keys(v.done).length && !Object.keys(v.rec || {}).length) delete vs[d];
    }
  },
  /* 回傳 true 表示改到了資料 */
  _apply(op) {
    const key = this._key(op.p), cur = this.clk[key];
    if (cur && op.t <= cur) return false;
    const w = this._wallOf(op.t); if (w > this.wall) { this.wall = w; this.cnt = 0; }
    const pend = this.outbox.find(o => o !== op && this._key(o.p) === key && o.t < op.t);
    const before = this.shadow.get(key);
    this.clk[key] = op.t;
    let v = op.d ? undefined : op.v, merged = false;
    if (!op.d && op.p[0] === 'visits' && op.p[2] === 'ids' && pend && !pend.d && Array.isArray(pend.v) && Array.isArray(v)) {
      const extra = pend.v.filter(x => !v.includes(x));
      if (extra.length) { v = v.concat(extra); merged = true; }
    }
    if (op.d) this._delAt(op.p); else this._setAt(op.p, v);
    if (op.d) this.shadow.delete(key); else this.shadow.set(key, JSON.stringify(v));
    if (pend && op.dev !== this.dev && before !== undefined) this._conflict(op, pend, merged);
    if (merged) this._emit(op.p, v, false);
    return true;
  },
  _conflict(op, mine, merged) {
    this.conflicts.unshift({ at: Date.now(), p: op.p, mine: mine.d ? undefined : mine.v, theirs: op.d ? undefined : op.v, merged });
    if (this.conflicts.length > 30) this.conflicts.length = 30;
  },
  _refreshSoon(n = 0) {
    const a = document.activeElement;
    if (n < 8 && a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('main,#drawer')) { setTimeout(() => this._refreshSoon(n + 1), 1500); return; }
    Store.rebuild(); App.refresh();
  },

  /* ---------- 啟動／停止 ---------- */
  /* s：資料檔裡的 sync 區塊；encrypted：資料檔是否加密（未加密不啟用，因為金鑰會躺在明文裡） */
  async attach(s, encrypted) {
    this.detach();
    if (!s || !s.id || !s.dk) { this.why = '這個資料檔沒有同步資訊（請用新版 export_bundle.py 重新產生）'; this._ui(); return; }
    if (!encrypted) { this.why = '資料檔未加密，不啟用同步'; this._ui(); return; }
    if (!(window.indexedDB && crypto.subtle)) { this.why = '這個瀏覽器環境不支援同步（需要 https 或 localhost）'; this._ui(); return; }
    this.why = '';
    this.baseId = s.id; this._dk = this._unb64(s.dk); this.seq = s.seq | 0; this.epoch = s.epoch || 1;
    this.clk = Object.assign({}, s.clk || {}); this.url = s.url || '';
    this._k = await this._derive(this._dk, this.baseId);
    try { this.dev = await this._kv('get', 'dev'); if (!this.dev) { this.dev = [...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2, '0')).join(''); await this._kv('put', 'dev', this.dev); } }
    catch (e) { this.dev = [...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2, '0')).join(''); this.persistOK = false; }
    this.wall = Math.max(0, ...Object.values(this.clk).map(t => this._wallOf(t)));
    this._snapshot();
    this.outbox = (await this._loadBox()).filter(o => o && o.id && Array.isArray(o.p)).sort((a, b) => (a.t < b.t ? -1 : 1));
    let changed = false;
    this.outbox.forEach(o => { if (this._apply(o)) changed = true; });   // 重播上次沒送出的修改
    this.on = true; this.status = 'local';
    if (changed) { this._norm(); Store.rebuild(); }
    this._poll = setInterval(() => { if (this.token && !document.hidden) this.kick(true); }, 15000);
    this._vis = () => { if (!document.hidden && this.token) this.kick(true); };
    document.addEventListener('visibilitychange', this._vis);
    this._ui();
  },
  detach() {
    clearInterval(this._poll); clearTimeout(this._timer);
    if (this._vis) document.removeEventListener('visibilitychange', this._vis);
    this._vis = null;
    this.on = false; this.status = 'off'; this.token = ''; this.user = ''; this.tr = null;
    this._dk = null; this._k = null; this.outbox = []; this.clk = {}; this.shadow = new Map(); this.conflicts = [];
    this.baseId = ''; this.blocked = ''; this.bad = 0; this.lastSync = 0; this._q = Promise.resolve();
    this._ui();
  },
  pending() { return this.outbox.length; },

  /* ---------- 登入／同步 ---------- */
  async login(url, user) {
    if (!this.on) throw new Error(this.why || '尚未載入資料檔');
    url = (url || '').trim().replace(/\/$/, ''); user = (user || '').trim();
    if (!/^https?:\/\//.test(url)) throw new Error('請輸入伺服器網址（http:// 或 https://）');
    if (!user) throw new Error('請輸入帳號');
    this.tr = new this.Http(url);
    const r = await this.tr.login(user, this.dev);
    this.token = r.token; this.user = user; this.url = url; this.blocked = '';
    try { localStorage.setItem('customer.sync.url', url); localStorage.setItem('customer.sync.user', user); } catch (e) { /* ignore */ }
    this.status = 'idle'; this._ui();
    await this.syncNow();
  },
  logout() { this.token = ''; this.user = ''; this.tr = null; this.status = 'local'; this._ui(); },
  kick(now) { if (!this.token) return; clearTimeout(this._timer); this._timer = setTimeout(() => this.syncNow().catch(() => {}), now ? 0 : 800); },
  syncNow() {
    if (!this.on || !this.token) return Promise.resolve();
    this._q = this._q.then(() => this._run()).catch(() => {});
    return this._q;
  },
  async _run() {
    if (!this.token) return;
    this.status = 'busy'; this._ui();
    try {
      await this._pull(); await this._push();   // 先收再送：才看得出「我的修改被別人較晚的修改取代」；合併產生的新操作也會一併送出
      this.lastSync = Date.now(); this.status = this.blocked ? 'blocked' : 'ok';
    } catch (e) {
      if (e.code === 'session_replaced') { this.token = ''; this.status = 'kicked'; U.toast('這個帳號在別的裝置登入了，這裡已停止同步（修改仍會暫存）'); }
      else if (e.code === 'unauthorized') { this.token = ''; this.status = 'local'; U.toast('登入已失效，請重新登入'); }
      else { this.status = 'offline'; this._err = e.message; }
    }
    this._ui();
  },
  async _push() {
    while (this.outbox.length) {
      const batch = this.outbox.slice(0, 50), items = [];
      for (const o of batch) items.push({ id: o.id, blob: await this._seal(o) });
      await this.tr.push(this.token, this.baseId, items);
      const done = new Set(batch.map(o => o.id));
      this.outbox = this.outbox.filter(o => !done.has(o.id));
      await this._persist(); this._ui();
    }
  },
  async _pull() {
    let changed = false;
    for (;;) {
      const r = await this.tr.pull(this.token, this.baseId, this.seq, 200);
      if (this.seq > 0 && r.head < this.seq) { this.srvReset = true; this.seq = 0; continue; }   // 伺服器的資料比我們已讀到的還少：被重置或還原過
      for (const it of r.ops) {
        let op;
        try { op = await this._open(it.id, it.blob); } catch (e) { this.bad++; this.seq = it.seq; continue; }
        if (!(op.sv <= this.SV) || !Array.isArray(op.p)) { this.blocked = '有來自較新版網頁的更新，請更新網頁後再同步'; this._ui(); if (changed) this._finish(); return; }
        this._applying = true;
        try { if (this._apply(op)) changed = true; } finally { this._applying = false; }
        this.seq = it.seq;
      }
      if (!r.more || !r.ops.length) break;
    }
    if (changed) this._finish();
  },
  /* 伺服器被重置後：把本機所有欄位（沿用原本的時間戳，不會蓋掉別人較新的修改）重新上傳 */
  reupload() {
    for (const [key, t] of Object.entries(this.clk)) {
      const p = key.split(this.SEP), has = this.shadow.has(key);
      const op = { id: this._uuid(), p, t, dev: this.dev, sv: this.SV };
      if (has) op.v = JSON.parse(this.shadow.get(key)); else op.d = 1;
      this.outbox.push(op);
    }
    this.srvReset = false; this._persist(); this.kick(true);
  },
  _finish() { this._norm(); this._persist(); this._refreshSoon(); },

  /* ---------- 匯出資料檔（檢查點） ---------- */
  async exportCheckpoint() {
    if (!this.on) throw new Error(this.why || '尚未載入資料檔');
    if (this.token) await this.syncNow();   // 先把最新的更新併進來
    const payload = {
      v: 1, built: this._localIso(), customers: Store.raw, overlay: Store.ov,
      sync: { id: this.baseId, dk: this._b64(this._dk), seq: this.seq, epoch: this.epoch, clk: this.clk, url: this.url },
    };
    const blob = await Bundle.pack(payload);
    U.download(`客戶資料_${U.iso(U.today())}.cbundle`, blob, 'application/octet-stream');
    return blob.length;
  },

  /* ---------- 畫面 ---------- */
  LABEL: { off: '同步', local: '同步：未登入', idle: '同步：登入中', busy: '同步中…', ok: '已同步', offline: '離線', kicked: '被登出', blocked: '需更新網頁' },
  _ui() {
    const b = document.getElementById('btnSync'); if (!b) return;
    if (!this.on) { b.textContent = '同步'; b.className = ''; b.title = this.why || '載入資料檔後可用'; b.disabled = !Store.raw; }
    else {
      const n = this.pending();
      const live = this.token || this.status === 'kicked' || this.status === 'blocked';
      b.disabled = false; b.textContent = live ? (this.LABEL[this.status] || '同步') + (n ? `（${n} 筆待上傳）` : '') : '同步';
      b.className = this.status === 'ok' && !n ? 'ok' : this.status === 'offline' || this.status === 'kicked' || this.status === 'blocked' ? 'warn' : '';
      b.title = '';
    }
    if (!document.getElementById('syncPanel').hidden) this.renderPanel();
  },
  fieldLabel(p) {
    const nm = id => { const c = Store.get(id); return c ? c.name : '（客戶）'; };
    const F = { status: '狀態', gender: '性別', marital: '婚姻', email: 'Email', source: '來源', nextVisit: '下次拜訪', note: '備註' };
    if (p[0] === 'extra') return `${nm(p[1])}・${F[p[2]] || p[2]}`;
    if (p[0] === 'ins') return `${p[1]}・${p[2] === 'occupation' ? '職業' : p[2]}`;
    if (p[0] === 'geo') return `${nm(p[1])}・座標`;
    if (p[0] === 'settings') return `設定・${p[1]}`;
    if (p[0] === 'visits') return `${p[1]} 排程・${p[2] === 'ids' ? '拜訪名單' : p[2] === 'done' ? `${nm(p[3])} 完成` : `${nm(p[3])} 紀錄`}`;
    return p.join('/');
  },
  _show(v) { if (v === undefined) return '（刪除）'; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return s.length > 40 ? s.slice(0, 40) + '…' : s; },
  renderPanel() {
    const q = id => document.getElementById(id), E = U.esc;
    const st = q('syStatus'), n = this.pending();
    if (!this.on) { st.innerHTML = `<b>未啟用</b>：${E(this.why || '請先載入資料檔')}`; q('syBody').hidden = true; return; }
    q('syBody').hidden = false;
    const when = this.lastSync ? new Date(this.lastSync).toLocaleTimeString('zh-TW', { hour12: false }) : '尚未';
    st.innerHTML = `<b>${E(this.LABEL[this.status] || this.status)}</b>${this.token ? `（帳號 ${E(this.user)}）` : ''}　待上傳 ${n} 筆・最後同步 ${E(when)}・已同步到第 ${this.seq} 號` +
      (this.status === 'offline' ? `<div class="muted small">連不上伺服器：${E(this._err || '')}。修改已暫存，連線後會自動補送。</div>` : '') +
      (this.blocked ? `<div class="notice2">${E(this.blocked)}</div>` : '') +
      (this.srvReset ? '<div class="notice2">伺服器上的資料比本機少（可能被重置過）。<button id="syRe">重新上傳全部資料</button></div>' : '') +
      (this.bad ? `<div class="muted small">有 ${this.bad} 筆更新無法解密，已略過。</div>` : '') +
      (!this.persistOK ? '<div class="notice2">這個瀏覽器無法暫存離線修改，請盡快同步或匯出資料檔。</div>' : '');
    q('syIn').hidden = !!this.token; q('syOut').hidden = !this.token;
    if (!q('syUrl').value) { try { q('syUrl').value = this.url || localStorage.getItem('customer.sync.url') || ''; } catch (e) { q('syUrl').value = this.url || ''; } }
    if (!q('syUser').value) { try { q('syUser').value = localStorage.getItem('customer.sync.user') || ''; } catch (e) { /* ignore */ } }
    q('syConf').innerHTML = this.conflicts.length
      ? `<div class="sec">最近的衝突（${this.conflicts.length}）</div><div class="muted small">同一欄位兩邊都改過時，以較晚修改的為準；下列是這裡被取代的修改：</div>` +
        this.conflicts.slice(0, 8).map(c => `<div class="small">${E(this.fieldLabel(c.p))}：我的「${E(this._show(c.mine))}」→ 現為「${E(this._show(c.theirs))}」${c.merged ? '（名單已聯集）' : ''}</div>`).join('')
      : '';
  },
  bind() {
    const q = id => document.getElementById(id), msg = t => { q('syMsg').textContent = t || ''; };
    q('btnSync').onclick = () => { q('syncPanel').hidden = false; this.renderPanel(); };
    q('syClose').onclick = () => { q('syncPanel').hidden = true; };
    q('syLogin').onclick = async () => {
      msg('登入中…');
      try { await this.login(q('syUrl').value, q('syUser').value); msg(''); } catch (e) { msg('登入失敗：' + e.message); }
      this.renderPanel();
    };
    q('syNow').onclick = async () => { msg('同步中…'); await this.syncNow(); msg(''); this.renderPanel(); };
    q('syStatus').onclick = e => { if (e.target.id === 'syRe') { this.reupload(); this.renderPanel(); } };
    q('syLogout').onclick = () => { this.logout(); this.renderPanel(); };
    q('syExport').onclick = async () => { msg('產生中…'); await App.exportData(); msg(''); };
    this._ui();
  },
};

/* 與伺服器溝通：Http 實作對應 scripts/py/server/mock_sync_server.py；之後的 Supabase 版實作同樣的 login/push/pull。 */
Sync.Http = class {
  constructor(url) { this.url = url; }
  async _f(path, body, token) {
    let r;
    try {
      r = await fetch(this.url + path, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch (e) { throw new Error('連不到伺服器'); }
    if (r.status === 409 || r.status === 401) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.error || 'auth'), { code: j.error || 'unauthorized' }); }
    if (!r.ok) throw new Error('伺服器回應 ' + r.status);
    return r.json();
  }
  login(user, device) { return this._f('/auth/login', { user, device }); }
  push(token, baseId, ops) { return this._f('/sync/push', { baseId, ops }, token); }
  pull(token, baseId, since, limit) { return this._f(`/sync/pull?baseId=${encodeURIComponent(baseId)}&since=${since}&limit=${limit}`, null, token); }
};
