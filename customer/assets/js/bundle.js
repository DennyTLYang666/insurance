/* 手機用單一資料檔（.cbundle）：選檔 → 輸入密碼 → 解密（AES-GCM）→ 解壓（gzip）→ 載入。
 * 格式見 scripts/export_bundle.py。資料只留在記憶體：不寫 localStorage、不寫 IndexedDB，
 * 關閉或重新整理頁面就清掉。 */
const Bundle = {
  MAGIC: [0x43, 0x42, 0x4e, 0x44],   // "CBND"
  OLD_DB: 'customer.bundle',   // 舊版曾把加密檔暫存在這裡；現在不再使用，啟動時刪除

  supported() {
    return !!(window.crypto && crypto.subtle && typeof DecompressionStream === 'function');
  },
  unsupportedReason() {
    if (!(window.crypto && crypto.subtle)) return '此瀏覽器環境無法解密（需要 https 網址或 localhost；請用 Safari 開啟 https 版網頁，不要用檔案預覽）。';
    if (typeof DecompressionStream !== 'function') return '瀏覽器太舊，無法解壓（iPhone 需要 iOS 16.4 以上）。';
    return '';
  },

  /* 讀標頭：回傳 {encrypted} 或丟出錯誤 */
  inspect(buf) {
    const b = new Uint8Array(buf);
    if (b.length < 6 || this.MAGIC.some((x, i) => b[i] !== x)) throw new Error('這不是客戶資料檔（.cbundle）');
    if (b[4] !== 1) throw new Error('資料檔版本較新，請更新網頁程式');
    return { encrypted: !!(b[5] & 1) };
  },

  async gunzip(bytes) {
    const ds = new DecompressionStream('gzip');
    const w = ds.writable.getWriter(); w.write(bytes); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  },

  /* buf: ArrayBuffer；password: 加密檔才需要。錯誤密碼丟出 Error('BAD_PASSWORD') */
  async open(buf, password) {
    const info = this.inspect(buf);
    const b = new Uint8Array(buf);
    let gz;
    if (!info.encrypted) gz = b.subarray(6);
    else {
      const iters = new DataView(buf).getUint32(6, false);
      const salt = b.subarray(10, 26), iv = b.subarray(26, 38), head = b.subarray(0, 38);
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password || ''), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      try { gz = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: head }, key, b.subarray(38))); }
      catch (e) { throw new Error('BAD_PASSWORD'); }
    }
    const data = JSON.parse(new TextDecoder().decode(await this.gunzip(gz)));
    if (!data || !data.customers) throw new Error('資料檔內容不完整');
    return data;
  },

  /* 清掉舊版留下的暫存（只刪，不讀） */
  dropOldCache() { try { indexedDB.deleteDatabase(this.OLD_DB); } catch (e) { /* ignore */ } },
  hasOldOverlay() { try { return localStorage.getItem(Store.LS_KEY) != null; } catch (e) { return false; } },

  /* ---- 畫面 ---- */
  _el(id) { return document.getElementById(id); },

  /* 載入面板：沒有資料時自動顯示；也可由「載入資料檔」按鈕開啟 */
  async showPanel() {
    const p = this._el('loadPanel'); p.hidden = false;
    const bad = this.unsupportedReason();
    this._el('lpWarn').textContent = bad; this._el('lpWarn').hidden = !bad;
    this._el('lpOld').hidden = !this.hasOldOverlay();
    this._el('lpServer').hidden = !Store.serverAvail;
  },
  hidePanel() { this._el('loadPanel').hidden = true; this._el('lpMsg').textContent = ''; },

  /* 向使用者要密碼；回傳字串，取消回傳 null */
  askPassword(msg) {
    return new Promise(res => {
      const w = this._el('pwDlg'); w.hidden = false;
      const inp = this._el('pwInput'), m = this._el('pwMsg'); inp.value = ''; m.textContent = msg || '';
      const done = v => { w.hidden = true; inp.value = ''; this._el('pwOk').onclick = this._el('pwCancel').onclick = inp.onkeydown = null; res(v); };
      this._el('pwOk').onclick = () => done(inp.value);
      this._el('pwCancel').onclick = () => done(null);
      inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); else if (e.key === 'Escape') done(null); };
      setTimeout(() => inp.focus(), 50);
    });
  },

  /* 取得資料：buf 可能是加密或未加密；成功回傳 data，取消回傳 null */
  async load(buf) {
    if (!this.supported()) throw new Error(this.unsupportedReason());
    const info = this.inspect(buf);
    let msg = '';
    for (;;) {
      let pw = '';
      if (info.encrypted) {
        pw = await this.askPassword(msg || '請輸入資料檔密碼');
        if (pw === null) return null;
      }
      this._el('lpMsg').textContent = info.encrypted ? '解密中…' : '載入中…';
      try {
        return await this.open(buf, pw);
      } catch (e) {
        if (e.message !== 'BAD_PASSWORD') throw e;
        msg = '密碼錯誤（或檔案已損毀），請再試一次';
      }
    }
  },

  bind() {
    const q = id => this._el(id);
    this.dropOldCache();
    const run = async getBuf => {
      try {
        const data = await this.load(await getBuf());
        if (!data) { q('lpMsg').textContent = ''; return; }
        Store.applyBundle(data);
        this.hidePanel();
        App.afterLoad();
      } catch (err) { q('lpMsg').textContent = '載入失敗：' + err.message; }
    };
    q('lpFile').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      run(() => f.arrayBuffer()).finally(() => { e.target.value = ''; });
    };
    q('lpClear').onclick = () => { try { localStorage.removeItem(Store.LS_KEY); } catch (e) { /* ignore */ } q('lpOld').hidden = true; U.toast('已清除'); };
    q('lpServer').onclick = async () => {
      try { q('lpMsg').textContent = '載入中…'; await Store.loadFromServer(); this.hidePanel(); App.afterLoad(); }
      catch (err) { q('lpMsg').textContent = '載入失敗：' + err.message; }
    };
    q('lpClose').onclick = () => this.hidePanel();
    q('btnLoad').onclick = () => this.showPanel();
  },
};
