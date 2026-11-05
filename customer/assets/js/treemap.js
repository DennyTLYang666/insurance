/* TreeMap（多面向矩形樹狀圖）：選一個單位（客戶／被保險人／保單／商品項目），最多三個層級的維度，
 * 一個指標（個數或可換算的保額），畫成面積＝指標值的巢狀矩形。純 HTML/CSS，不用外部套件。
 * 配色：第一層的類別各用一個固定順序的色相（最多 8 個；超過就把較小的併成灰色「其他」），
 *       下層沿用同色相、以淡色填滿，所以顏色代表「第一層類別」，不代表大小。文字一律用一般文字色。
 * 互動：滑鼠移上去／鍵盤聚焦顯示提示；點擊（或 Enter）在右側列出對應的要保人；可切換成表格檢視。 */
const Treemap = {
  DEFAULTS: { customer: ['district', 'band'], insured: ['gender', 'band'], policy: ['status', 'mode', 'year'], item: ['type', 'name'] },
  st: { unit: 'policy', d: ['status', 'mode', 'year'], metric: 'count', view: 'map' },
  nodes: [], ro: null, _tree: null,

  GRAY: /^(未填|未登錄|缺|性別未知|未知|其他$|—)/,
  isGray(k) { return this.GRAY.test(k); },

  /* ---- 建樹 ---- */
  build() {
    const s = this.st, un = Dims.units[s.unit], all = un.all(), dimAll = Dims.dims()[s.unit];
    const ds = s.d.map(id => dimAll.find(d => d.id === id)).filter(Boolean);
    const m = Dims.metrics[s.unit].find(x => x.id === s.metric) || Dims.metrics[s.unit][0];
    const val = u => m.fn(u) || 0;
    const used = all.filter(u => val(u) > 0);
    const mk = (units, level, path) => {
      const n = { units, value: units.reduce((a, u) => a + val(u), 0), path, level, key: path[path.length - 1] || '' };
      if (level < ds.length) n.children = Dims.group(units, ds[level]).map(g => mk(g.units, level + 1, [...path, g.key]));
      return n;
    };
    const root = mk(used, 0, []);
    let kids = root.children || [];
    if (kids.length > 8) {   // 超過 8 類：保留數值最大的 7 類，其餘併成「其他」
      const top = kids.slice().sort((a, b) => b.value - a.value).slice(0, 7);
      const rest = kids.filter(k => !top.includes(k)), us = rest.flatMap(k => k.units);
      const other = mk(us, 1, ['其他']); other.merged = rest.length;
      kids = kids.filter(k => top.includes(k)).concat(other);
      root.children = kids;
    }
    // 色相：依第一層的「固定順序」（維度的 order，其次筆畫排序）指派，不隨數值大小改變
    const hueKeys = kids.filter(k => !this.isGray(k.key)).map(k => k.key).sort((a, b) => {
      const ord = (ds[0] && ds[0].order) || [], ia = ord.indexOf(a), ib = ord.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, 'zh-Hant');
    });
    kids.forEach(k => { k.hue = this.isGray(k.key) ? 0 : hueKeys.indexOf(k.key) + 1; });
    return { root, kids, ds, m, total: root.value, skipped: all.length - used.length, n: used.length, un };
  },

  /* ---- squarified 排版 ---- */
  layout(nodes, x, y, w, h) {
    const items = nodes.filter(n => n.value > 0).sort((a, b) => b.value - a.value), out = [];
    const total = items.reduce((a, n) => a + n.value, 0);
    if (!total || w <= 0 || h <= 0) return out;
    const k = w * h / total, area = n => n.value * k;
    let rest = items.slice(), X = x, Y = y, W = w, H = h;
    while (rest.length) {
      const side = Math.min(W, H);
      const worst = r => { const a = r.map(area), s = a.reduce((p, q) => p + q, 0); return Math.max(side * side * Math.max(...a) / (s * s), s * s / (side * side * Math.min(...a))); };
      let row = [rest[0]], i = 1;
      while (i < rest.length && worst(row.concat(rest[i])) <= worst(row)) { row.push(rest[i]); i++; }
      const s = row.reduce((p, n) => p + area(n), 0);
      if (W >= H) { const cw = s / H; let cy = Y; row.forEach(n => { const hh = area(n) / cw; out.push({ n, x: X, y: cy, w: cw, h: hh }); cy += hh; }); X += cw; W -= cw; }
      else { const rh = s / W; let cx = X; row.forEach(n => { const ww = area(n) / rh; out.push({ n, x: cx, y: Y, w: ww, h: rh }); cx += ww; }); Y += rh; H -= rh; }
      rest = rest.slice(row.length);
    }
    return out;
  },

  /* ---- 繪圖 ---- */
  place(nodes, x, y, w, h, level, hue, ctx) {
    return this.layout(nodes, x, y, w, h).map((r, idx) => {
      const n = r.n, hh = level === 1 ? n.hue : hue;
      const X = r.x + 1, Y = r.y + 1, W = r.w - 2, H = r.h - 2;   // 相鄰矩形之間留 2px 底色間隙
      if (W < 3 || H < 3) return '';
      const i = this.nodes.push(n) - 1, E = U.esc, fv = Dims.fmtVal(ctx.m, n.value);
      const head = level === 1 ? 20 : 17, canNest = n.children && n.children.length && H > head + 14 && W > 36;
      const pos = `left:${X.toFixed(1)}px;top:${Y.toFixed(1)}px;width:${W.toFixed(1)}px;height:${H.toFixed(1)}px;--h:var(--h${hh})`;
      const label = `${n.path.join(' › ')}：${fv}`;
      if (canNest) {
        return `<div class="tmc g" data-i="${i}" tabindex="0" role="button" aria-label="${E(label)}" style="${pos}"><span class="tl">${E(n.key)} <b>${E(fv)}</b></span></div>` +
          this.place(n.children, X + 2, Y + head, W - 4, H - head - 2, level + 1, hh, ctx);
      }
      const roomy = W > 58 && H > 32, tiny = W < 30 || H < 18;
      return `<div class="tmc l${idx % 2 ? ' alt' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${E(label)}" style="${pos}">${tiny ? '' : `<span class="tl">${E(n.key)}${roomy ? `<br><b>${E(fv)}</b>` : ''}</span>`}</div>`;
    }).join('');
  },
  draw() {
    const host = document.getElementById('tmArea'); if (!host || !this._tree) return;
    const t = this._tree, W = Math.floor(host.clientWidth);
    if (W < 40) return;
    const H = Math.max(340, Math.min(560, Math.round(W * 0.52)));
    host.style.height = H + 'px';
    this.nodes = [];
    host.innerHTML = this.place(t.kids, 0, 0, W, H, 1, 0, t);
  },

  /* ---- 畫面 ---- */
  opts(list, sel, none) { return (none ? `<option value=""${sel ? '' : ' selected'}>（不再細分）</option>` : '') + list.map(d => `<option value="${d.id}"${d.id === sel ? ' selected' : ''}>${U.esc(d.label)}</option>`).join(''); },
  tableHtml(t) {
    const E = U.esc, m = t.m, rows = [];
    this.nodes = [];
    const walk = n => { if (n.children && n.children.length) n.children.forEach(walk); else if (n.level) rows.push(n); };
    t.kids.forEach(walk);
    rows.sort((a, b) => b.value - a.value);
    return `<div class="tablewrap"><table><thead><tr>${t.ds.map(d => `<th class="nosort">${E(d.label)}</th>`).join('')}<th class="nosort">${E(m.label)}</th><th class="nosort">占比</th><th class="nosort">${E(t.un.label)}數</th></tr></thead><tbody>
      ${rows.map(n => { this.nodes.push(n); return `<tr class="click" data-i="${this.nodes.length - 1}" tabindex="0" role="button">${t.ds.map((d, i) => `<td>${E(n.path[i] || '—')}</td>`).join('')}<td>${E(Dims.fmtVal(m, n.value))}</td><td>${(n.value / t.total * 100).toFixed(0)}%</td><td>${n.units.length} ${t.un.unit}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  },
  render(host) {
    const s = this.st, E = U.esc, dimAll = Dims.dims();
    if (!Dims.units[s.unit]) s.unit = 'policy';
    const dl = dimAll[s.unit];
    s.d = s.d.filter((id, i) => dl.some(x => x.id === id) && s.d.indexOf(id) === i);
    if (!s.d.length) s.d = this.DEFAULTS[s.unit].slice();
    const ms = Dims.metrics[s.unit]; if (!ms.some(x => x.id === s.metric)) s.metric = ms[0].id;
    const t = this._tree = this.build();
    const lvl = i => `<label>${['① 第一層', '② 第二層', '③ 第三層'][i]} <select data-tm="d${i}">${this.opts(dl, s.d[i], i > 0)}</select></label>`;
    host.innerHTML = `
      <div class="filters tmctl">
        <label>單位 <select data-tm="unit">${Object.entries(Dims.units).map(([k, v]) => `<option value="${k}"${k === s.unit ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
        ${lvl(0)}${s.d.length >= 1 ? lvl(1) : ''}${s.d.length >= 2 ? lvl(2) : ''}
        <label>面積指標 <select data-tm="metric">${ms.map(x => `<option value="${x.id}"${x.id === s.metric ? ' selected' : ''}>${E(x.label)}</option>`).join('')}</select></label>
        <span class="seg"><button data-tm="view" data-v="map" class="${s.view === 'map' ? 'on' : ''}">圖</button><button data-tm="view" data-v="table" class="${s.view === 'table' ? 'on' : ''}">表</button></span>
      </div>
      <div class="tmwrap">
        ${t.total > 0 ? (s.view === 'map' ? `<div class="legend tmlegend">${t.kids.map(k => `<span class="click" data-lg="${E(k.key)}" tabindex="0" role="button" title="點擊看是哪些客戶"><i style="background:var(--h${k.hue})"></i>${E(k.key)} ${E(Dims.fmtVal(t.m, k.value))}</span>`).join('')}</div>
          <div class="tm" id="tmArea"></div>` : this.tableHtml(t)) : '<div class="card empty">這個組合沒有可畫的資料（指標值都是 0）。換個指標或單位試試。</div>'}
        <div class="tmtip" id="tmTip" hidden></div>
      </div>
      <p class="muted small">面積＝${E(t.m.label)}（${E(t.un.label)}，共 ${t.n} ${t.un.unit}${t.skipped ? `；另有 ${t.skipped} ${t.un.unit}指標為 0 或無法換算，沒有畫出` : ''}）。顏色代表第一層的類別；灰色＝未填／其他。${t.kids.some(k => k.merged) ? '第一層類別超過 8 個，較小的已併成「其他」。' : ''}
        點任一格看對應的要保人${s.unit === 'insured' ? '（被保險人不是客戶時，列的是持有其保單的要保人）' : ''}。<b>樣本很少時，面積只代表分佈、不代表趨勢。</b></p>`;
    if (s.view === 'map') {
      this.draw();
      if (this.ro) this.ro.disconnect();
      const a = document.getElementById('tmArea');
      if (a && window.ResizeObserver) { let w0 = a.clientWidth; this.ro = new ResizeObserver(() => { if (a.clientWidth !== w0) { w0 = a.clientWidth; this.draw(); } }); this.ro.observe(a); }
    }
    this.bind(host);
  },

  drill(n) {
    if (!n) return;
    const t = this._tree, cs = Dims.owners(this.st.unit, n.units);
    Drill.open(`${t.un.label}・${n.path.join(' › ') || '全部'}`, cs, Store.list.length, null);
  },
  bind(host) {
    const s = this.st, tip = host.querySelector('#tmTip'), wrap = host.querySelector('.tmwrap');
    host.querySelectorAll('[data-tm]').forEach(n => n.addEventListener(n.tagName === 'BUTTON' ? 'click' : 'change', () => {
      const k = n.dataset.tm;
      if (k === 'unit') { s.unit = n.value; s.d = this.DEFAULTS[n.value].slice(); s.metric = 'count'; }
      else if (k === 'metric') s.metric = n.value;
      else if (k === 'view') s.view = n.dataset.v;
      else { const i = +k.slice(1); if (!n.value) s.d = s.d.slice(0, i); else { const j = s.d.indexOf(n.value); if (j >= 0 && j !== i) s.d[j] = s.d[i]; s.d[i] = n.value; if (j >= 0 && s.d[j] === undefined) s.d.splice(j, 1); } }
      this.render(host);
    }));
    const pick = e => { const el = e.target.closest('[data-i]'); return el ? this.nodes[+el.dataset.i] : null; };
    wrap.addEventListener('click', e => {
      const lg = e.target.closest('[data-lg]');
      if (lg) return this.drill(this._tree.kids.find(k => k.key === lg.dataset.lg));
      this.drill(pick(e));
    });
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter') { const lg = e.target.closest('[data-lg]'); this.drill(lg ? this._tree.kids.find(k => k.key === lg.dataset.lg) : pick(e)); } });
    const show = (n, x, y) => {
      const t = this._tree, E = U.esc, m = t.m;
      tip.innerHTML = `<b>${E(n.path.join(' › '))}</b><br>${E(m.label)}：${E(Dims.fmtVal(m, n.value))}（占 ${(n.value / t.total * 100).toFixed(0)}%）<br>${n.units.length} ${t.un.unit}${n.merged ? `（含 ${n.merged} 類）` : ''}`;
      tip.hidden = false;
      const r = wrap.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(4, Math.min(r.width - tw - 4, x - r.left + 12)) + 'px';
      tip.style.top = Math.max(4, Math.min(r.height - th - 4, y - r.top + 12)) + 'px';
    };
    wrap.addEventListener('mousemove', e => { const n = pick(e); if (n && e.target.closest('.tm')) show(n, e.clientX, e.clientY); else tip.hidden = true; });
    wrap.addEventListener('mouseleave', () => { tip.hidden = true; });
    wrap.addEventListener('focusin', e => { const n = pick(e); if (n && e.target.closest('.tm')) { const b = e.target.getBoundingClientRect(); show(n, b.left + 8, b.top + 8); } });
    wrap.addEventListener('focusout', () => { tip.hidden = true; });
  },
};
