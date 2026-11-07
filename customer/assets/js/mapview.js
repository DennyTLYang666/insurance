/* 地圖檢視：客戶管理（清單／地圖切換）與排程共用的畫面邏輯。底圖元件見 map.js */
const MapView = {
  cur: {},       // 目前的地圖（key → GeoMap）
  views: {},     // 各畫面記住的視角，重畫時不跳回全覽
  box: false,    // 框選模式
  tiles() { return Store.ov.settings.mapTiles || 'nlsc'; },
  cls(st) { return st === '原招' ? 's-orig' : st === '非原招' ? 's-non' : st === '待訪談' ? 's-todo' : 's-arch'; },
  marker(c, o = {}) {
    return { id: c.id, lat: c.geo.lat, lng: c.geo.lng, label: GeoMap.STATUS_LETTER[c.status] || '？', cls: this.cls(c.status),
      title: `${c.name}｜${c.status}${c.visited ? '｜已拜訪' : ''}${c.geo.src === 'osm-street' ? '｜街道層級（約略）' : ''}${this.bad.has(c.id) ? '｜座標可能不在這個地址的區內' : ''}`, bad: this.bad.has(c.id), approx: c.geo.src === 'osm-street', ...o };
  },
  tileSelect(key) {
    return `<label>底圖 <select id="mvTiles-${key}" title="底圖只向圖磚伺服器要「目前畫面的圖磚」，不含客戶資料；選「不載入底圖」就完全不連外">${Object.entries(GeoMap.TILES).map(([k, t]) => `<option value="${k}"${k === this.tiles() ? ' selected' : ''}>${U.esc(t.name)}</option>`).join('')}</select></label>`;
  },
  legend(list) {
    const n = st => list.filter(c => c.status === st).length;
    return `<div class="maplegend">${[['原招', 'orig'], ['非原招', 'non'], ['待訪談', 'todo'], ['已歸檔', 'arch']].map(([st, k]) => `<span><i style="background:var(--st-${k})"></i>${st}（${GeoMap.STATUS_LETTER[st]}）${n(st)}</span>`).join('')}<span class="muted">同一個點有多位客戶時圍成一圈；虛線＝約略位置；紅 ! ＝座標疑似錯誤</span></div>`;
  },
  /* 建立地圖：保留上次的視角；第一次（或點 ⤢）才自動框到所有點 */
  make(key, host, fitPts, opt) {
    if (this.cur[key]) { const o = this.cur[key]; this.views[key] = { c: o.c, z: o.z, tiles: o.tileKey }; o.destroy(); }
    const pts = () => (typeof fitPts === 'function' ? fitPts() : fitPts);
    const map = new GeoMap(host, { tiles: this.tiles(), ...opt, onFit: () => map.fit(pts()) });
    const v = this.views[key];
    if (v) map.setView(v.c.lat, v.c.lng, v.z); else map.fit(pts());
    this.cur[key] = map;
    return map;
  },
  bindTiles(root, key) {
    const sel = root.querySelector('#mvTiles-' + key); if (!sel) return;
    sel.onchange = () => { Store.setting('mapTiles', sel.value); this.cur[key].setTiles(sel.value); };
  },
  closePop() { document.querySelectorAll('.mappop').forEach(n => n.remove()); },
  popup(map, c, extra, bind) {
    this.closePop();
    const E = U.esc, m = Store.ov.settings.mask !== false, gg = c.geo || this.approx(c); if (!gg) return;
    const p = map.toScreen(gg.lat, gg.lng), { w, h } = map.size();
    const SRC = { manual: '手動貼上', pin: '在地圖上標的', 'osm-exact': '地址查詢（OpenStreetMap）', 'osm-street': '街道層級查詢，約略、僅供參考' };
    const el = document.createElement('div'); el.className = 'mappop';
    el.style.left = Math.max(4, Math.min(w - 300, p.x + 18)) + 'px'; el.style.top = Math.max(4, Math.min(h - 200, p.y - 24)) + 'px';
    el.innerHTML = `<button class="ghost" data-x style="float:right" aria-label="關閉">✕</button>
      <h3>${E(c.name)} <span class="tag ${Store.statusClass(c.status)}">${E(c.status)}</span></h3>
      <div>${List.visitTag(c)}</div>
      <div class="small muted">${E(Store.addrText(c, m) || '缺地址')}</div><div class="small">${E(c.circle || '')}</div>
      <div class="small muted">${c.geo ? '座標：' + E(SRC[c.geo.src] || '來源不明') : '約略位置（尚無座標）'}</div>
      <div class="actions" style="margin:6px 0">${Store.callBtns(c, m)} ${Store.navBtn(c, '導航')}</div>${extra || ''}`;
    map.el.appendChild(el);
    el.querySelector('[data-x]').onclick = () => el.remove();
    if (bind) bind(el);
  },
  /* 在地圖上點一下，把座標記到客戶（src: pin） */
  place(map, c, done) {
    this.closePop();
    U.toast(`請在地圖上點一下「${c.name}」的位置`);
    map.pickMode(ll => {
      map.pickMode(null);
      Store.setGeo(c.id, { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6), src: 'pin' });
      U.toast(`已標好「${c.name}」的位置`); if (done) done(); else App.refresh();
    });
  },

  /* ================= 客戶管理：地圖檢視 ================= */
  list(el, rows) {
    const E = U.esc, m = Store.ov.settings.mask !== false, withGeo = rows.filter(c => c.geo), noGeo = rows.filter(c => !c.geo), sel = List.sel;
    const side = `
      <h3>已勾選 ${sel.size} 位</h3>
      <div class="actions" style="margin-bottom:6px"><button id="mvPdf"${sel.size ? '' : ' disabled'}>匯出 PDF</button>
        <input type="date" id="mvDate" value="${U.iso(U.addDays(U.today(), 1))}" style="width:130px"><button id="mvSched"${sel.size ? '' : ' disabled'}>加入排程</button>
        ${sel.size ? '<button class="ghost" id="mvClr">清除</button>' : ''}</div>
      <h3>沒有座標（${noGeo.length}）</h3>
      ${noGeo.some(c => sel.has(c.id)) ? `<div class="nogeo small">已勾選的 ${noGeo.filter(c => sel.has(c.id)).length} 位沒座標，地圖上看不到。<br><button class="small" id="mvRoad" title="只把「縣市區＋路名」送到 OpenStreetMap，不含門牌與姓名">查道路位置（約略）</button>${this.pasteHtml(noGeo.filter(c => sel.has(c.id)))}</div>` : ''}
      ${noGeo.slice(0, 100).map(c => `<div class="it"><span>${E(c.name)}<span class="muted small"> ${E(c.addr ? Store.addrText(c, m) : '缺地址')}</span></span><button class="small" data-pin="${E(c.id)}">標位置</button></div>`).join('') || '<div class="muted small">全部都有座標</div>'}${noGeo.length > 100 ? `<div class="muted small">只列前 100 位，其餘請用上方篩選縮小範圍</div>` : ''}
      <p class="muted small">也可在客戶明細貼「緯度, 經度」。</p>`;
    el.innerHTML = `${List.bar(rows)}
      <div class="maptool no-print">${this.tileSelect('list')}
        <button id="mvBox" class="${this.box ? 'primary' : ''}" title="在地圖上拖曳畫框，框到的客戶會被勾選（按住 Shift 可加選）">${this.box ? '框選中（再按取消）' : '框選'}</button>
        <button data-chk title="檢查已有的座標是否落在地址所屬的區內（只送公開的縣市區地名）">檢查座標</button>
        <label class="chk"><input type="checkbox" id="mvOnly"${this.onlyList ? ' checked' : ''}> 只顯示已勾選</label>
        <span class="muted small">有座標 ${withGeo.length} ／ 無座標 ${noGeo.length}${this.onlyList && !sel.size ? '　<b>先在清單勾選客戶，地圖才會標出位置</b>' : '　點標記看客戶、拖曳平移、滾輪或雙指縮放'}</span></div>
      <div class="nogeo small" data-badbox hidden></div>
      ${this.legend(withGeo)}
      <div class="mapwrap"><div id="mvMap"></div><div class="mapside">${side}</div></div>`;
    List.bindBar(el);
    const host = el.querySelector('#mvMap');
    const map = this.make('list', host, () => { const xs = withGeo.filter(c => sel.has(c.id)); return (xs.length ? xs : withGeo).map(c => c.geo); }, {
      onMarker: id => { const c = Store.get(id); if (!c) return;
        this.popup(map, c, `<div class="actions"><button data-open>明細</button><button data-sel>${sel.has(id) ? '取消勾選' : '勾選'}</button><button data-pin>重新標位置</button></div>`, pop => {
          pop.querySelector('[data-open]').onclick = () => List.open(id);
          pop.querySelector('[data-sel]').onclick = () => { sel.has(id) ? sel.delete(id) : sel.add(id); List.render(); };
          pop.querySelector('[data-pin]').onclick = () => this.place(map, c);
        }); },
      onMapClick: () => this.closePop(),
    });
    const ap = () => noGeo.filter(c => sel.has(c.id)).map(c => { const g = this.approx(c); return g ? { id: c.id, lat: g.lat, lng: g.lng, label: GeoMap.STATUS_LETTER[c.status] || '？', cls: this.cls(c.status), approx: true, sel: true, title: `${c.name}｜約略位置（${g.from}）` } : null; }).filter(Boolean);
    map.setMarkers([...withGeo.filter(c => !this.onlyList || sel.has(c.id)).map(c => this.marker(c, { sel: sel.has(c.id) })), ...ap()]);
    const rb = el.querySelector('#mvRoad'); if (rb) rb.onclick = () => this.locateRoad([...sel], () => List.render());
    this.bindPaste(el, () => List.render());
    if (this.box) map.boxMode(ids => { ids.forEach(i => sel.add(i)); U.toast(`已勾選 ${ids.length} 位（共 ${sel.size}）`); List.render(); });
    this.bindTiles(el, 'list'); this.bindCheck(el, () => List.render());
    el.querySelector('#mvOnly').onchange = e => { this.onlyList = e.target.checked; List.render(); };
    el.querySelector('#mvBox').onclick = () => { this.box = !this.box; List.render(); };
    el.querySelector('#mvPdf').onclick = () => PdfExport.openDialog();
    el.querySelector('#mvSched').onclick = () => { const d = el.querySelector('#mvDate').value; if (!d) return; Schedule.add(d, [...sel]); U.toast(`已加入 ${d} 的行程（${sel.size} 位）`); };
    const clr = el.querySelector('#mvClr'); if (clr) clr.onclick = () => { sel.clear(); List.render(); };
    el.querySelectorAll('.mapside [data-pin]').forEach(b => { b.onclick = () => this.place(map, Store.get(b.dataset.pin)); });
  },

  /* ================= 排程：地圖 ================= */
  /* 沒有座標的客戶：用同區（沒有就同縣市）其他已有座標客戶的平均位置當「約略位置」；只在本機運算，查不到就不顯示 */
  onlyList: true,   // 客戶管理地圖預設只標出已勾選的客戶
  bad: new Set(),   // 座標疑似錯誤的客戶（檢查座標的結果，只存在畫面上）
  checked: false, _poly: {}, _polyTried: {},
  rgKey(c) { return 'rg2:' + [c.city, c.district, c.roadKey || ''].join('|'); },
  rgGet(k) { const v = Store.ov.settings[k]; return v && v.lat ? v : null; },
  /* 向 OpenStreetMap（Nominatim）查一個地名，最多取 5 筆候選，由 o.pick 挑一筆（預設第一筆）。
   * o.bb（[南,北,西,東]）有給就只在這個範圍內找；o.poly 要求回傳行政區邊界。送出的只有查詢文字。 */
  async nom(q, o = {}) {
    const vb = o.bb ? `&viewbox=${o.bb[2]},${o.bb[1]},${o.bb[3]},${o.bb[0]}&bounded=1` : '';
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=tw&accept-language=zh-TW' + (o.poly ? '&polygon_geojson=1&polygon_threshold=0.0003' : '') + vb + '&q=' + U.enc(q));
    const j = await r.json(); await new Promise(res => setTimeout(res, 1100));
    const rs = (Array.isArray(j) ? j : []).map(x => { const bx = (x.boundingbox || []).map(Number); return { lat: +(+x.lat).toFixed(6), lng: +(+x.lon).toFixed(6), bb: bx.length === 4 && bx.every(isFinite) ? bx : null, gj: x.geojson || null }; });
    return (o.pick ? o.pick(rs) : rs[0]) || null;
  },
  /* 「縣市＋區」的中心、範圍與行政區邊界（公開地名）。中心與範圍依區快取在補填資料裡；邊界只放在記憶體（要用時每區查一次）。 */
  async district(c) {
    const dk = 'rg2:' + [c.city, c.district, ''].join('|');
    if (!(dk in Store.ov.settings) || !this._polyTried[dk]) {
      this._polyTried[dk] = true;
      const d = await this.nom(c.city + c.district, { poly: true, pick: rs => rs.find(x => x.gj && /Polygon/.test(x.gj.type)) || rs[0] });
      if (d) { if (!(dk in Store.ov.settings) || !Store.ov.settings[dk].lat) Store.ov.settings[dk] = { lat: d.lat, lng: d.lng, bb: d.bb }; if (d.gj && /Polygon/.test(d.gj.type)) this._poly[dk] = d.gj; }
      else if (!(dk in Store.ov.settings)) Store.ov.settings[dk] = { n: 1 };
    }
    const rec = this.rgGet(dk);
    return rec ? { ...rec, poly: this._poly[dk] || null } : null;
  },
  inBox(g, bb, m = 0.02) { return !bb || (g.lat >= bb[0] - m && g.lat <= bb[1] + m && g.lng >= bb[2] - m && g.lng <= bb[3] + m); },
  _inRing(pt, ring) {
    let ins = false; const x = pt.lng, y = pt.lat;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  },
  pip(pt, gj) {
    const polys = gj.type === 'Polygon' ? [gj.coordinates] : gj.coordinates;
    return polys.some(rings => this._inRing(pt, rings[0]) && !rings.slice(1).some(h => this._inRing(pt, h)));
  },
  /* 座標是否在這個區內：有行政區邊界就用邊界（容許約 150 公尺的邊界誤差），沒有就用範圍框 */
  inDistrict(g, d) {
    if (!d) return true;
    if (d.poly) { const t = 0.0015; return [[0, 0], [t, 0], [-t, 0], [0, t], [0, -t]].some(([a, b]) => this.pip({ lat: g.lat + a, lng: g.lng + b }, d.poly)); }
    return this.inBox(g, d.bb);
  },

  /* 道路層級查位置（選用）：只把「縣市區＋路名」這種公開地名送到 OpenStreetMap，不含門牌、姓名或其他資料。
   * 先查「區」取得邊界，路名的候選結果只收「落在這個區內」的（避免查到別區同名的路）；找不到路就退回區的中心。
   * 結果依「縣市|區|路」快取，同一條路只查一次。只有查到的才會顯示，不會用其他客戶的座標去猜。 */
  async locateRoad(ids, done) {
    for (const k of Object.keys(Store.ov.settings)) if (k.startsWith('rg:') || (k.startsWith('rg2:') && !k.endsWith('|') && (Store.ov.settings[k] || {}).lv === 'd')) delete Store.ov.settings[k];   // 舊版的猜測快取／區中心
    const cs = ids.map(id => Store.get(id)).filter(c => c && c.city && c.district && !c.geo);
    const need = new Map();
    cs.forEach(c => { if (!(this.rgKey(c) in Store.ov.settings)) need.set(this.rgKey(c), c); });
    if (!need.size) { U.toast(cs.length ? '這些客戶的道路位置都查過了' : '這些客戶沒有完整的縣市區地址可查'); if (done) done(); return; }
    U.toast('查詢道路位置…（每筆約 1–3 秒）');
    let ok = 0;
    try {
      for (const [k, c] of need) {
        const dist = await this.district(c);
        if (!c.roadKey) { Store.ov.settings[k] = { n: 1 }; continue; }
        const g = dist ? await this.nom(c.city + c.district + c.roadKey, { bb: dist.bb, pick: rs => rs.find(x => this.inDistrict(x, dist)) }) : null;
        Store.ov.settings[k] = g ? { lat: g.lat, lng: g.lng, lv: 'r' } : { n: 1 };   // 查不到路就不顯示，不退回區中心
        if (g) ok++;
      }
    } catch (e) { U.toast('查詢失敗：' + e.message); }
    Store.save(); if (done) done(); U.toast(`已查到 ${ok} / ${need.size} 條路${ok < need.size ? '；其餘查不到（OpenStreetMap 沒有這條路），請用 Google 地圖複製座標' : ''}`);
  },
  /* 約略位置：只用查詢結果（道路或區中心）；沒查過就不顯示 */
  approx(c) {
    const g = this.rgGet(this.rgKey(c));
    return g && g.lv === 'r' ? { lat: g.lat, lng: g.lng, from: '道路層級，可能差數百公尺以上' } : null;   // 區中心不算位置（會誤導），查不到路就不顯示
  },
  /* 沒座標的客戶：開 Google 地圖（用地址）→ 右鍵複製座標 → 貼上存起來。座標以手動來源記錄，最準也最省事。 */
  pasteHtml(xs) {
    const E = U.esc;
    return `<div class="pastebox small"><b>最準的做法：</b>點「Google 地圖」找到客戶後，在地圖上點右鍵、點第一行座標（會複製），回到這裡按「貼上並存」（瀏覽器會問是否允許讀剪貼簿；也可手動貼到欄位再按「存」，網址也行）。` + xs.slice(0, 12).map(c => `<div class="pr"><span>${E(c.name)}</span> <a target="_blank" rel="noopener" href="${E('https://www.google.com/maps/search/?api=1&query=' + U.enc(c.addr ? c.addr.raw : ''))}">Google 地圖</a> <button class="small primary" data-pgc="${E(c.id)}" title="在 Google 地圖右鍵複製座標後，回到這裡按一下，直接讀剪貼簿並存起來">貼上並存</button> <input type="text" data-pg="${E(c.id)}" placeholder="或手動貼 24.99, 121.30"> <button class="small" data-pgs="${E(c.id)}">存</button></div>`).join('') + (xs.length > 12 ? `<div class="muted">另有 ${xs.length - 12} 位，先處理這些</div>` : '') + '</div>';
  },
  bindPaste(root, done) {
    const save = (id, txt) => { const g = U.parseLatLng(txt); if (!g) { U.toast('剪貼簿裡不是座標，請先在 Google 地圖右鍵複製座標（或複製地圖網址）'); return; } Store.setGeo(id, { ...g, src: 'manual' }); U.toast('已存座標'); if (done) done(); };
    root.querySelectorAll('[data-pgc]').forEach(b => b.onclick = async () => {
      try { save(b.dataset.pgc, await navigator.clipboard.readText()); }
      catch (e) { U.toast('讀不到剪貼簿（瀏覽器未允許或不是 https／localhost），請手動貼到欄位再按「存」'); }
    });
    root.querySelectorAll('[data-pgs]').forEach(b => b.onclick = () => {
      const id = b.dataset.pgs, inp = root.querySelector(`[data-pg="${CSS.escape(id)}"]`), g = U.parseLatLng(inp.value);
      if (!g) { U.toast('座標格式不對，請貼「緯度, 經度」（台灣範圍）'); return; }
      Store.setGeo(id, { ...g, src: 'manual' }); U.toast('已存座標'); if (done) done();
    });
  },

  /* 檢查座標：已有座標的客戶，座標是否落在「地址所屬的區」的行政區邊界內。只送公開的「縣市區」地名去查邊界。 */
  async checkGeo(done) {
    const cs = Store.list.filter(c => c.geo && c.city && c.district);
    if (!cs.length) { U.toast('沒有可檢查的座標（需要有座標且有縣市區地址）'); return; }
    U.toast('檢查座標中…（每個區約 1–3 秒）');
    const bad = new Set(); let skipped = 0;
    try {
      for (const c of cs) { const d = await this.district(c); if (!d || (!d.poly && !d.bb)) { skipped++; continue; } if (!this.inDistrict(c.geo, d)) bad.add(c.id); }
    } catch (e) { U.toast('檢查失敗：' + e.message); }
    this.bad = bad; this.checked = true; this.skipped = skipped; Store.save();
    U.toast(bad.size ? `${bad.size} 位的座標落在地址所屬的區之外` : `檢查完成：沒有座標落在所屬的區之外${skipped ? `（${skipped} 位查不到區邊界）` : ''}`);
    if (done) done();
  },
  autoGeo() { return Store.list.filter(c => c.geo && /^osm/.test(c.geo.src || '')); },
  badHtml() {
    if (!this.checked) return '';
    const E = U.esc, xs = [...this.bad].map(id => Store.get(id)).filter(Boolean), auto = this.autoGeo(), badAuto = xs.filter(c => /^osm/.test((c.geo || {}).src || ''));
    return (xs.length ? `<b>${xs.length} 位的座標落在地址所屬的區之外</b>（地圖上以紅色 ! 標出，是地址轉座標查錯）：${xs.slice(0, 10).map(c => E(c.name)).join('、')}${xs.length > 10 ? '…' : ''}<br>` : '<b>檢查完成：沒有座標落在所屬的區之外。</b>（座標在區內，但街道、門牌仍可能不準；街道層級查詢的以虛線水滴標示。）<br>')
      + (xs.length ? `<button class="small" data-badclr>清除這 ${xs.length} 位的座標${xs.length > badAuto.length ? `（含 ${xs.length - badAuto.length} 位手動標的）` : ''}</button> ` : '')
      + (auto.length ? `<button class="small" data-allclr title="只清除用地址查詢得到的座標；手動標的、手動貼上的不動">清除全部自動查的座標（${auto.length} 位）</button> ` : '')
      + `<span class="muted small">清除後可用「查道路位置」或「查精確地址」重查（會限定在所屬的區內）。</span>`;
  },
  bindCheck(root, done) {
    const b = root.querySelector('[data-chk]'); if (b) b.onclick = () => this.checkGeo(done);
    const box = root.querySelector('[data-badbox]'); if (!box) return;
    box.hidden = !this.checked; box.innerHTML = this.badHtml();
    const clr = (list, msg) => { list.forEach(c => { delete Store.ov.geo[c.id]; this.bad.delete(c.id); }); Store.save(); Store.rebuild(); U.toast(msg); if (done) done(); };
    const c1 = box.querySelector('[data-badclr]');
    if (c1) c1.onclick = () => { const xs = [...this.bad].map(id => Store.get(id)).filter(c => c && c.geo), man = xs.filter(c => !/^osm/.test(c.geo.src || '')).length; if (!man || confirm(`其中 ${man} 位是手動標的座標，清除後要重標。確定清除這 ${xs.length} 位的座標？`)) clr(xs, `已清除 ${xs.length} 位`); };
    const c2 = box.querySelector('[data-allclr]');
    if (c2) c2.onclick = () => { const xs = this.autoGeo(); if (confirm(`清除 ${xs.length} 位用地址查詢得到的座標？（手動標的不動；清除後可重查）`)) clr(xs, `已清除 ${xs.length} 位`); };
  },

  sched(host, ctx) {
    const { stops, pool, picked, onTogglePick, onRemove, onOpen, onPlaced, date } = ctx, E = U.esc;
    const stopIds = new Set(stops.map(x => x.c.id));
    const cands = pool.filter(c => c.geo && !stopIds.has(c.id));
    const route = stops.filter(x => x.c.geo);
    const fitPts = () => { const sp = cands.filter(c => picked.has(c.id)).map(c => c.geo); return [...sp, ...route.map(x => x.c.geo)].length ? [...sp, ...route.map(x => x.c.geo)] : cands.map(c => c.geo); };
    const first = this.views.schedDate !== date; this.views.schedDate = date;
    if (first) { if (this.cur.sched) { this.cur.sched.destroy(); delete this.cur.sched; } delete this.views.sched; }
    const map = this.make('sched', host, fitPts, {
      onMarker: id => {
        const c = Store.get(id); if (!c) return;
        if (stopIds.has(id)) {
          this.popup(map, c, `<div class="actions"><button data-open>明細</button><button data-rm>移出這天</button><button data-pin>重新標位置</button></div>`, pop => {
            pop.querySelector('[data-open]').onclick = () => onOpen(id);
            pop.querySelector('[data-rm]').onclick = () => onRemove(id);
            pop.querySelector('[data-pin]').onclick = () => this.place(map, c, onPlaced);
          });
        } else {
          this.popup(map, c, `<div class="actions"><button class="primary" data-pick>${picked.has(id) ? '取消選取' : '選取（準備加入' + E(date.slice(5)) + '）'}</button><button data-open>明細</button></div>`, pop => {
            pop.querySelector('[data-pick]').onclick = () => { onTogglePick(id); pop.remove(); map.setSelected(picked); };
            pop.querySelector('[data-open]').onclick = () => onOpen(id);
          });
        }
      },
      onMapClick: () => this.closePop(),
    });
    const build = () => [
      ...cands.filter(c => !(ctx.onlySel && ctx.onlySel()) || picked.has(c.id)).map(c => this.marker(c, { sel: picked.has(c.id) })),
      ...route.map((x, i) => this.marker(x.c, { stop: true, label: String(stops.indexOf(x) + 1), title: `${stops.indexOf(x) + 1}. ${x.c.name}｜${x.c.status}` })),
      ...pool.filter(c => !c.geo && picked.has(c.id) && !stopIds.has(c.id)).map(c => { const g = this.approx(c); return g ? { id: c.id, lat: g.lat, lng: g.lng, label: GeoMap.STATUS_LETTER[c.status] || '？', cls: this.cls(c.status), approx: true, sel: true, title: `${c.name}｜約略位置（${g.from}）` } : null; }).filter(Boolean),
    ];
    map.setMarkers(build());
    if (ctx.boxCb) map.boxMode(ids => ctx.boxCb(ids));
    map.rebuild = () => { map.setMarkers(build()); map.setSelected(picked); };
    map.setLine(route.map(x => x.c.geo));
    map.setSelected(picked);
    return map;
  },
};
