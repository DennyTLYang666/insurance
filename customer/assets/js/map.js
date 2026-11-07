/* 地圖元件（純 JS，不載入任何第三方程式庫）：Web Mercator 圖磚底圖＋標記＋路線＋標位置＋框選。
 * 隱私：客戶座標只在本頁運算，不會送出；向圖磚伺服器請求的只有「目前看的圖磚編號」（約略的畫面位置），
 * 不含姓名、地址。選「不載入底圖」就完全不連外，只看點位分布。 */
class GeoMap {
  static TILES = {
    nlsc: { name: '國土測繪中心 通用版電子地圖', url: 'https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', attr: '© 內政部國土測繪中心', max: 19 },
    osm: { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap 貢獻者', max: 19, ref: 'strict-origin' },   // OSM 規定要帶 Referer（只送網站網域，不含路徑與資料）；用 file:// 開啟沒有網域，仍會 403
    none: { name: '不載入底圖（不連外）', url: '', attr: '', max: 19 },
  };
  static STATUS_LETTER = { 原招: '原', 非原招: '非', 待訪談: '待', 已歸檔: '檔' };

  constructor(el, opt = {}) {
    this.el = el; this.opt = opt; this.minZ = 7; this.maxZ = 19;
    this.c = { lat: 23.7, lng: 121 }; this.z = 8;
    this.markers = []; this.line = []; this.tileKey = opt.tiles || 'nlsc';
    this.tiles = new Map(); this.okTiles = 0; this.badTiles = 0;
    this.pickCb = null; this.boxCb = null; this.sel = new Set();
    el.classList.add('gm'); el.innerHTML = '<div class="gm-tiles"></div><svg class="gm-line"></svg><div class="gm-marks"></div>' +
      '<div class="gm-ctl"><button data-z="1" title="放大" aria-label="放大">＋</button><button data-z="-1" title="縮小" aria-label="縮小">－</button><button data-fit="1" title="符合所有點" aria-label="符合所有點">⤢</button></div>' +
      '<div class="gm-attr"></div><div class="gm-msg" hidden></div><div class="gm-box" hidden></div>';
    this.L = { tiles: el.querySelector('.gm-tiles'), svg: el.querySelector('.gm-line'), marks: el.querySelector('.gm-marks'), msg: el.querySelector('.gm-msg'), box: el.querySelector('.gm-box'), attr: el.querySelector('.gm-attr') };
    this.bind();
    this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(el);
    this.setTiles(this.tileKey);
  }
  destroy() { this.ro.disconnect(); this.el.innerHTML = ''; this.el.classList.remove('gm'); }

  /* ---- 投影 ---- */
  size() { return { w: this.el.clientWidth || 600, h: this.el.clientHeight || 400 }; }
  scale(z = this.z) { return 256 * Math.pow(2, z); }
  world(lat, lng, z = this.z) {
    const s = this.scale(z), r = lat * Math.PI / 180;
    return { x: (lng + 180) / 360 * s, y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s };
  }
  unworld(x, y, z = this.z) {
    const s = this.scale(z), n = Math.PI - 2 * Math.PI * y / s;
    return { lat: 180 / Math.PI * Math.atan(Math.sinh(n)), lng: x / s * 360 - 180 };
  }
  toScreen(lat, lng) {
    const { w, h } = this.size(), p = this.world(lat, lng), c = this.world(this.c.lat, this.c.lng);
    return { x: p.x - c.x + w / 2, y: p.y - c.y + h / 2 };
  }
  fromScreen(x, y) {
    const { w, h } = this.size(), c = this.world(this.c.lat, this.c.lng);
    return this.unworld(c.x + x - w / 2, c.y + y - h / 2);
  }

  /* ---- 設定 ---- */
  setTiles(key) {
    this.tileKey = GeoMap.TILES[key] ? key : 'nlsc';
    const t = GeoMap.TILES[this.tileKey];
    this.tiles.forEach(i => i.remove()); this.tiles.clear(); this.okTiles = this.badTiles = 0; this.L.msg.hidden = true;
    this.L.attr.textContent = t.attr; this.maxZ = t.max; this.z = Math.min(this.z, this.maxZ);
    this.draw();
  }
  setMarkers(list) { this.markers = list || []; this.drawMarks(); }
  setLine(pts) { this.line = pts || []; this.drawLine(); }
  setSelected(ids) { this.sel = new Set(ids || []); this.drawMarks(); }
  setView(lat, lng, z) { this.c = { lat, lng }; this.z = Math.max(this.minZ, Math.min(this.maxZ, z)); this.draw(); }
  fit(pts, pad = 40) {
    pts = (pts || []).filter(p => p && isFinite(p.lat) && isFinite(p.lng));
    if (!pts.length) { this.setView(23.7, 121, 8); return; }
    const la = pts.map(p => p.lat), lo = pts.map(p => p.lng), { w, h } = this.size();
    const b = { s: Math.min(...la), n: Math.max(...la), w: Math.min(...lo), e: Math.max(...lo) };
    const c = { lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 };
    let z = this.maxZ - 3;
    for (; z > this.minZ; z--) {
      const a = this.world(b.n, b.w, z), d = this.world(b.s, b.e, z);
      if (Math.abs(d.x - a.x) <= w - pad * 2 && Math.abs(d.y - a.y) <= h - pad * 2) break;
    }
    this.setView(c.lat, c.lng, z);
  }
  zoomAt(dz, sx, sy) {
    const z = Math.max(this.minZ, Math.min(this.maxZ, this.z + dz)); if (z === this.z) return;
    const { w, h } = this.size(), at = this.fromScreen(sx == null ? w / 2 : sx, sy == null ? h / 2 : sy);
    this.z = z;
    // 讓指到的那一點維持在原本的畫面位置
    const p = this.world(at.lat, at.lng), nx = (sx == null ? w / 2 : sx), ny = (sy == null ? h / 2 : sy);
    this.c = this.unworld(p.x - nx + w / 2, p.y - ny + h / 2); this.draw();
  }
  pickMode(cb) { this.pickCb = cb || null; this.el.classList.toggle('picking', !!cb); }
  boxMode(cb) { this.boxCb = cb || null; this.el.classList.toggle('boxing', !!cb); }

  /* ---- 繪製 ---- */
  draw() { cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(() => { this.drawTiles(); this.drawLine(); this.drawMarks(); }); }
  drawTiles() {
    const t = GeoMap.TILES[this.tileKey]; if (!t.url) return;
    const { w, h } = this.size(), c = this.world(this.c.lat, this.c.lng), z = Math.round(this.z), n = Math.pow(2, z);
    const x0 = Math.floor((c.x - w / 2) / 256), x1 = Math.floor((c.x + w / 2) / 256), y0 = Math.floor((c.y - h / 2) / 256), y1 = Math.floor((c.y + h / 2) / 256);
    const want = new Set();
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      const xx = ((x % n) + n) % n, k = z + '/' + xx + '/' + y + '@' + x; want.add(k);
      let im = this.tiles.get(k);
      if (!im) {
        im = new Image(); im.className = 'gm-t'; im.alt = ''; im.draggable = false; im.referrerPolicy = t.ref || 'no-referrer'; im.decoding = 'async';
        im.onload = () => { this.okTiles++; im.classList.add('ok'); };
        im.onerror = () => { if (this.tiles.get(k) !== im) return; this.badTiles++; im.remove(); if (this.badTiles >= 4 && !this.okTiles) { this.L.msg.hidden = false; this.L.msg.textContent = '底圖載入失敗（可能離線或被網路擋下），客戶點位仍可使用。可在上方改選其他底圖或「不載入底圖」。'; } };
        im.src = t.url.replace('{z}', z).replace('{x}', xx).replace('{y}', y);
        this.L.tiles.appendChild(im); this.tiles.set(k, im);
      }
      im.style.transform = `translate(${Math.round(x * 256 - c.x + w / 2)}px,${Math.round(y * 256 - c.y + h / 2)}px)`;
    }
    this.tiles.forEach((im, k) => { if (!want.has(k)) { im.remove(); this.tiles.delete(k); } });
  }
  drawLine() {
    const pts = this.line.map(p => this.toScreen(p.lat, p.lng)), { w, h } = this.size();
    this.L.svg.setAttribute('width', w); this.L.svg.setAttribute('height', h);
    this.L.svg.innerHTML = pts.length > 1 ? `<polyline points="${pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}" fill="none" stroke="var(--s1)" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>` : '';
  }
  drawMarks() {
    const { w, h } = this.size(), groups = new Map();
    this.markers.forEach(m => { const k = m.lat.toFixed(5) + ',' + m.lng.toFixed(5); (groups.get(k) || groups.set(k, []).get(k)).push(m); });
    let html = '';
    // 點太多時（全覽 5000 位客戶），把同一小格內的點合併成「數字氣泡」，點氣泡放大；已勾選與行程點永遠單獨顯示
    if (this.markers.length > 300) {
      const cells = new Map(), keep = [];
      this.markers.forEach(m => {
        const p = this.toScreen(m.lat, m.lng); if (p.x < -30 || p.y < -30 || p.x > w + 30 || p.y > h + 30) return;
        if (m.stop) { keep.push(m); return; }
        const on = !!(m.sel || this.sel.has(m.id));
        const k = Math.floor(p.x / 44) + ',' + Math.floor(p.y / 44), c = cells.get(k);
        if (c) { c.n++; c.x += p.x; c.y += p.y; c.on += on ? 1 : 0; } else cells.set(k, { n: 1, x: p.x, y: p.y, m, on: on ? 1 : 0 });
      });
      cells.forEach(c => {
        if (c.n === 1) keep.push(c.m);
        else html += `<button class="gm-m gm-c${c.on ? ' sel' : ''}" style="transform:translate(${(c.x / c.n).toFixed(1)}px,${(c.y / c.n).toFixed(1)}px)" data-cx="${(c.x / c.n).toFixed(1)}" data-cy="${(c.y / c.n).toFixed(1)}" title="${c.n} 位客戶${c.on ? '（其中 ' + c.on + ' 位已勾選）' : ''}，點一下放大" aria-label="${c.n} 位客戶，放大">${c.n}</button>`;
      });
      this.L.marks.innerHTML = html + keep.map(m => this.markHtml(m, this.toScreen(m.lat, m.lng))).join('');
      return;
    }
    groups.forEach(g => g.forEach((m, i) => {
      const p = this.toScreen(m.lat, m.lng);
      let x = p.x, y = p.y;
      if (g.length > 1) { const a = (i / g.length) * 2 * Math.PI - Math.PI / 2; x += Math.cos(a) * 13; y += Math.sin(a) * 13; }   // 同一個點的多位客戶，圍成一圈避免疊住
      if (x < -30 || y < -30 || x > w + 30 || y > h + 30) return;
      html += this.markHtml(m, { x, y });
    }));
    this.L.marks.innerHTML = html;
  }
  markHtml(m, { x, y }) {
    const E = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<button class="gm-m ${m.cls || ''}${m.stop ? ' stop' : ''}${this.sel.has(m.id) || m.sel ? ' sel' : ''}${m.dim ? ' dim' : ''}${m.approx ? ' approx' : ''}${m.bad ? ' bad' : ''}" style="transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px)" data-id="${E(m.id)}" title="${E(m.title || '')}" aria-label="${E(m.title || m.label || '')}">${E(m.label || '')}</button>`;
  }

  /* ---- 操作：拖曳、滾輪、雙指、點選、標位置、框選 ---- */
  bind() {
    const el = this.el, pts = new Map(); let drag = null, pinch = null, box = null;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.gm-ctl,.gm-m,.mappop')) return;
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = el.getBoundingClientRect();
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; box = null; return; }
      if (this.boxCb && (e.pointerType !== 'mouse' || e.button === 0)) { box = { x0: e.clientX - r.left, y0: e.clientY - r.top, moved: false }; return; }
      drag = { x: e.clientX, y: e.clientY, c: this.world(this.c.lat, this.c.lng), moved: false };
    });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = el.getBoundingClientRect();
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > pinch.d * 1.5) { this.zoomAt(1, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch.d = d; }
        else if (d < pinch.d / 1.5) { this.zoomAt(-1, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch.d = d; }
        return;
      }
      if (box) {
        const x = e.clientX - r.left, y = e.clientY - r.top;
        if (Math.abs(x - box.x0) + Math.abs(y - box.y0) > 5) box.moved = true;
        if (box.moved) { const b = this.L.box; b.hidden = false; Object.assign(b.style, { left: Math.min(x, box.x0) + 'px', top: Math.min(y, box.y0) + 'px', width: Math.abs(x - box.x0) + 'px', height: Math.abs(y - box.y0) + 'px' }); box.x1 = x; box.y1 = y; }
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) { this.c = this.unworld(drag.c.x - dx, drag.c.y - dy); this.draw(); el.classList.add('dragging'); }
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); const r = el.getBoundingClientRect();
      if (pts.size < 2) pinch = null;
      el.classList.remove('dragging');
      if (box) {
        this.L.box.hidden = true;
        if (box.moved && this.boxCb) {
          const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1), y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1);
          const ids = this.markers.filter(m => { const p = this.toScreen(m.lat, m.lng); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; }).map(m => m.id);
          this.boxCb(ids, e.shiftKey);
        } else if (this.pickCb) { const ll = this.fromScreen(e.clientX - r.left, e.clientY - r.top); this.pickCb(ll); }
        box = null; return;
      }
      if (drag && !drag.moved) {
        const ll = this.fromScreen(e.clientX - r.left, e.clientY - r.top);
        if (this.pickCb) this.pickCb(ll); else if (this.opt.onMapClick) this.opt.onMapClick(ll);
      }
      drag = null;
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    let last = 0;
    el.addEventListener('wheel', e => {
      if (e.target.closest('.mappop')) return;
      e.preventDefault(); const now = Date.now(); if (now - last < 160) return; last = now;
      const r = el.getBoundingClientRect(); this.zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    el.addEventListener('dblclick', e => { if (e.target.closest('.gm-ctl,.gm-m,.mappop')) return; const r = el.getBoundingClientRect(); this.zoomAt(1, e.clientX - r.left, e.clientY - r.top); });
    el.addEventListener('click', e => {
      const cl = e.target.closest('.gm-c'); if (cl) { e.stopPropagation(); this.zoomAt(2, +cl.dataset.cx, +cl.dataset.cy); return; }
      const b = e.target.closest('.gm-m'); if (b && this.opt.onMarker) { e.stopPropagation(); this.opt.onMarker(b.dataset.id, e); return; }
      const z = e.target.closest('[data-z]'); if (z) { this.zoomAt(+z.dataset.z); return; }
      if (e.target.closest('[data-fit]') && this.opt.onFit) this.opt.onFit();
    });
  }
}
