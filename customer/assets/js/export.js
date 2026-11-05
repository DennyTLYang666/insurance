/* 勾選客戶 → 匯出 PDF（用瀏覽器「列印 → 另存為 PDF」，不依賴任何套件） */
const PdfExport = {
  opt: { content: 'contact', idMode: 'none', mask: false },

  /* 依目前清單排序，已勾選的客戶 */
  chosen() {
    const sel = List.sel, order = List.filtered().filter(c => sel.has(c.id));
    const seen = new Set(order.map(c => c.id));
    return order.concat(Store.list.filter(c => sel.has(c.id) && !seen.has(c.id)));
  },

  openDialog() {
    const n = List.sel.size;
    if (!n) { U.toast('請先勾選客戶'); return; }
    const o = this.opt, d = document.getElementById('pdfDlg');
    d.hidden = false;
    d.innerHTML = `<div class="dlg">
      <h3>匯出 PDF（${n} 位）</h3>
      <div class="opts" style="flex-direction:column;align-items:stretch;gap:8px">
        <label class="chk"><input type="radio" name="pc" value="contact"${o.content === 'contact' ? ' checked' : ''}> 只有連絡方式（姓名、手機、市話、地址）</label>
        <label class="chk"><input type="radio" name="pc" value="policy"${o.content === 'policy' ? ' checked' : ''}> 連絡方式＋保單資料（保單號碼、被保險人、狀態、繳別、商品與保額）</label>
        <label>身分證字號
          <select id="pdfId"><option value="none"${o.idMode === 'none' ? ' selected' : ''}>不列出</option><option value="mask"${o.idMode === 'mask' ? ' selected' : ''}>遮蔽（前3後3）</option><option value="full"${o.idMode === 'full' ? ' selected' : ''}>完整</option></select></label>
        <label class="chk"><input type="checkbox" id="pdfMask"${o.mask ? ' checked' : ''}> 遮蔽電話尾碼與門牌號碼</label>
      </div>
      <label>PDF 開啟密碼（留空＝不加密）
        <span style="display:flex;gap:6px"><input type="password" id="pdfPw" autocomplete="new-password" placeholder="至少 6 字元" style="flex:1">
        <button type="button" id="pdfPwShow" class="ghost">顯示</button></span></label>
      <p class="small muted" id="pdfPwNote">${this.pwNote()}</p>
      <p class="small warnc">PDF 含客戶個資，請只傳給有需要的人、用完刪除；不要放到公開或共用空間。</p>
      <p class="small muted">按下後會開啟列印視窗，目的地選「另存為 PDF」（iPhone：分享 → 儲存到檔案）。</p>
      <div class="actions"><button id="pdfGo">產生 PDF</button><button id="pdfCancel" class="ghost">取消</button></div>
    </div>`;
    const q = s => d.querySelector(s);
    q('#pdfCancel').onclick = () => { d.hidden = true; };
    d.onclick = e => { if (e.target === d) d.hidden = true; };
    q('#pdfPwShow').onclick = () => { const i = q('#pdfPw'); i.type = i.type === 'password' ? 'text' : 'password'; q('#pdfPwShow').textContent = i.type === 'password' ? '顯示' : '隱藏'; };
    q('#pdfGo').onclick = async () => {
      const pw = q('#pdfPw').value;
      this.opt = { content: d.querySelector('input[name=pc]:checked').value, idMode: q('#pdfId').value, mask: q('#pdfMask').checked };
      if (!pw) { d.hidden = true; this.print(); return; }
      if (pw.length < 6) { U.toast('密碼至少 6 個字元'); return; }
      const cap = Store.mode === 'server' && Store.pdfCap;
      if (!cap || !cap.available) { U.toast('無法加密：' + this.pwWhy()); return; }   // 絕不在沒加密的情況下默默產生
      const btn = q('#pdfGo'); btn.disabled = true; btn.textContent = '產生中…';
      try { await this.makeEncrypted(pw); d.hidden = true; U.toast('已下載加密 PDF（請另外告知對方密碼）'); }
      catch (e) { U.toast('加密失敗：' + e.message); btn.disabled = false; btn.textContent = '產生 PDF'; }
    };
  },

  fileName() { return `客戶${this.opt.content === 'policy' ? '連絡與保單' : '連絡'}_${U.iso(U.today())}`; },
  pwWhy() {
    if (Store.mode !== 'server') return '加密碼需用 scripts\\serve.bat 開啟（目前是檔案模式）。';
    const cap = Store.pdfCap;
    return !cap ? '伺服器版本過舊，請更新 scripts。' : (cap.reason || '');
  },
  pwNote() {
    const cap = Store.mode === 'server' && Store.pdfCap;
    return cap && cap.available ? '有密碼時直接下載 AES-256 加密的 PDF（開啟時要輸入密碼）；留空則走瀏覽器列印。'
      : '目前不能加密：' + this.pwWhy();
  },
  async makeEncrypted(pw) {
    const r = await fetch('api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: this.build(), password: pw, title: this.fileName() }) });
    if (!r.ok) { let m = r.status; try { m = (await r.json()).error || m; } catch (e) { /* 非 JSON */ } throw new Error(m); }
    const url = URL.createObjectURL(await r.blob()), a = document.createElement('a');
    // 檔名用英數字，避免部分瀏覽器丟掉中文檔名
    a.href = url; a.download = `customer-${this.opt.content}_${U.iso(U.today())}.pdf`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  contactCells(c, o) {
    const E = U.esc, f = p => E(o.mask ? U.maskPhone(p) : U.fmtPhone(p));
    return {
      mobile: c.mobiles.map(f).join('<br>') || '—',
      home: c.homes.map(f).join('<br>') || '—',
      addr: c.addresses.length ? c.addresses.map(a => E(Store.addrText(c, o.mask, a))).join('<br>') : '—',
      id: o.idMode === 'none' ? '' : E(o.idMode === 'mask' ? U.maskId(c.id) : c.id),
    };
  },

  build() {
    const o = this.opt, E = U.esc, list = this.chosen();
    const withId = o.idMode !== 'none', withPol = o.content === 'policy';
    const head = `<div class="pdf-head"><h2>${withPol ? '客戶連絡與保單資料' : '客戶連絡清單'}</h2>
      <div class="small">${list.length} 位　產生日期 ${E(U.iso(U.today()))}</div></div>`;
    const foot = `<div class="pdf-foot small">含個人資料，請妥善保管，用畢刪除。</div>`;
    if (!withPol) {
      const rows = list.map(c => {
        const x = this.contactCells(c, o);
        return `<tr><td>${E(c.name)}</td>${withId ? `<td>${x.id}</td>` : ''}<td>${x.mobile}</td><td>${x.home}</td><td>${x.addr}</td></tr>`;
      }).join('');
      return head + `<table class="pdf-t"><thead><tr><th>姓名</th>${withId ? '<th>身分證</th>' : ''}<th>手機</th><th>市話</th><th>地址</th></tr></thead><tbody>${rows}</tbody></table>` + foot;
    }
    const blocks = list.map(c => {
      const x = this.contactCells(c, o), pols = Store.policies.filter(p => p.owner === c);
      const line = (t, v) => `<span><b>${t}</b> ${v}</span>`;
      return `<div class="pdf-cust">
        <div class="pdf-name">${E(c.name)}</div>
        <div class="pdf-contact">${line('手機', x.mobile.replace(/<br>/g, '、'))}${line('市話', x.home.replace(/<br>/g, '、'))}${withId ? line('身分證', x.id) : ''}${line('地址', x.addr.replace(/<br>/g, '、'))}</div>
        ${pols.length ? `<table class="pdf-t"><thead><tr><th>保單號碼</th><th>被保險人</th><th>狀態</th><th>繳別</th><th>商品／保額</th></tr></thead><tbody>${pols.map(p =>
          `<tr><td>${E(p.no)}</td><td>${E(p.insured || '未填')}${p.insured && !p.self ? '（非本人）' : ''}</td><td>${E(p.status || '')}</td><td>${E(p.payMode || '')}</td>
          <td>${p.items.map(i => E(i.name) + (i.amount ? '　' + E(i.amount) : '') + (i.rider ? '（附約）' : '')).join('<br>')}</td></tr>`).join('')}</tbody></table>`
          : '<div class="small muted">尚未登錄保單</div>'}
      </div>`;
    }).join('');
    return head + blocks + foot;
  },

  print() {
    let root = document.getElementById('pdfRoot');
    if (!root) { root = document.createElement('div'); root.id = 'pdfRoot'; document.body.appendChild(root); }
    root.innerHTML = this.build();
    const title = document.title;
    document.title = this.fileName();
    document.body.classList.add('pdf-mode');
    const done = () => { document.body.classList.remove('pdf-mode'); document.title = title; root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  },
};
