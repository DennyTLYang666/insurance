/* 排程分頁：依地理位置排拜訪順序，串 Google 地圖導航與 Google 日曆 / .ics */
const Schedule = {
  st: { date: '', start: '09:00', stay: 45, gap: 15, cand: '__unvisited', picked: new Set(), busy: false },
  init() {
    const s = Store.ov.settings.sched || {};
    this.st.date = U.iso(U.addDays(U.today(), 1));
    Object.assign(this.st, { start: s.start || '09:00', stay: s.stay || 45, gap: s.gap == null ? 15 : s.gap });
  },
  persist() { Store.setting('sched', { start: this.st.start, stay: this.st.stay, gap: this.st.gap }); },
  origin() { return Store.ov.settings.origin || ''; },

  day(date) { return Store.ov.visits[date] || { ids: [], done: {} }; },
  _day(date) { return Store.ov.visits[date] || (Store.ov.visits[date] = { ids: [], done: {} }); },
  add(date, ids) {
    const d = this._day(date);
    ids.forEach(id => { if (!d.ids.includes(id)) d.ids.push(id); });
    Store.save(); Store.rebuild(); if (document.getElementById('tab-schedule').classList.contains('on')) this.render();
  },
  remove(date, id) {
    const d = this._day(date); d.ids = d.ids.filter(x => x !== id); delete d.done[id];
    if (!d.ids.length) delete Store.ov.visits[date];
    Store.save(); Store.rebuild(); this.render();
  },
  move(date, id, delta) {
    const d = this._day(date), i = d.ids.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= d.ids.length) return;
    [d.ids[i], d.ids[j]] = [d.ids[j], d.ids[i]]; Store.save(); this.render();
  },
  scheduledOn(id) { return Object.keys(Store.ov.visits).filter(dt => Store.ov.visits[dt].ids.includes(id) && !Store.ov.visits[dt].done[id]).sort(); },

  /* 沒座標時的排序鍵：縣市區 → 生活圈 → 路名 → 巷 → 門牌 */
  key(c) {
    const a = c.addr || {};
    return [c.city + c.district, c.circle, a.roadKey || '', String(a.alley || 0).padStart(4, '0'), String(a.number || 0).padStart(5, '0')].join('|');
  },
  autoSort(date) {
    const d = this._day(date), cs = d.ids.map(id => Store.get(id)).filter(Boolean);
    if (cs.length < 2) return;
    let note;
    if (cs.every(c => c.geo)) {
      const rest = cs.slice().sort((a, b) => this.key(a).localeCompare(this.key(b), 'zh-Hant')), out = [rest.shift()];
      while (rest.length) {
        const last = out[out.length - 1];
        rest.sort((a, b) => U.haversine(last.geo, a.geo) - U.haversine(last.geo, b.geo));
        out.push(rest.shift());
      }
      d.ids = out.map(c => c.id); note = '已依座標「最近鄰居」排序';
    } else {
      d.ids = cs.sort((a, b) => this.key(a).localeCompare(this.key(b), 'zh-Hant')).map(c => c.id);
      const miss = cs.filter(c => !c.geo).length;
      note = `有 ${miss} 位沒有座標，改依 區→生活圈→路名→門牌 排序`;
    }
    Store.save(); this.render(); U.toast(note);
  },

  plan(date) {
    const [h, m] = this.st.start.split(':').map(Number);
    let t = (h || 0) * 60 + (m || 0);
    return this.day(date).ids.map(id => Store.get(id)).filter(Boolean).map(c => {
      const s = t, e = t + (+this.st.stay || 0); t = e + (+this.st.gap || 0);
      return { c, s, e };
    });
  },
  hm: min => U.pad(Math.floor(min / 60) % 24) + ':' + U.pad(min % 60),
  dt(date, min) { return date.replace(/-/g, '') + 'T' + U.pad(Math.floor(min / 60) % 24) + U.pad(min % 60) + '00'; },

  /* ---- Google 地圖 ---- */
  navUrl(c) { return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + U.enc(Store.mapQuery(c)); },
  routeUrls(stops) {
    const pts = [this.origin(), ...stops.map(x => Store.mapQuery(x.c))].filter(Boolean), urls = [];
    for (let i = 0; i < pts.length - 1 || (i === 0 && pts.length === 1); i += 9) {
      const seg = pts.slice(i, i + 10);
      let u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + U.enc(seg[seg.length - 1]);
      if (seg.length > 1) u += '&origin=' + U.enc(seg[0]);
      if (seg.length > 2) u += '&waypoints=' + U.enc(seg.slice(1, -1).join('|'));
      urls.push(u);
      if (seg.length < 10) break;
    }
    return urls;
  },
  detail(c) { return [/（未細分）$/.test(c.circle) ? '' : c.circle, c.note].filter(Boolean).join('\n'); },
  /* ---- Google 日曆 / ICS（標題只放姓名，不放身分證與電話） ---- */
  gcalUrl(date, x) {
    const loc = x.c.addr ? x.c.addr.raw : '';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&ctz=Asia/Taipei&text=' + U.enc('拜訪 ' + x.c.name) +
      '&dates=' + this.dt(date, x.s) + '/' + this.dt(date, x.e) + '&location=' + U.enc(loc) + '&details=' + U.enc(this.detail(x.c));
  },
  ics(date, stops) {
    const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//customer-tool//ZH-TW', 'CALSCALE:GREGORIAN',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Taipei', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE'];
    stops.forEach((x, i) => out.push('BEGIN:VEVENT', `UID:visit-${date}-${i + 1}-${Date.now()}@customer-tool.local`, 'DTSTAMP:' + stamp,
      `DTSTART;TZID=Asia/Taipei:${this.dt(date, x.s)}`, `DTEND;TZID=Asia/Taipei:${this.dt(date, x.e)}`,
      'SUMMARY:' + esc('拜訪 ' + x.c.name), 'LOCATION:' + esc(x.c.addr ? x.c.addr.raw : ''), 'DESCRIPTION:' + esc(this.detail(x.c)), 'END:VEVENT'));
    out.push('END:VCALENDAR');
    return out.join('\r\n') + '\r\n';
  },
  text(date, stops, masked) {
    return `拜訪行程 ${date}（${U.weekday(date)}）\n` + stops.map((x, i) => `${i + 1}. ${this.hm(x.s)}-${this.hm(x.e)} ${x.c.name}｜${x.c.circle}｜${Store.addrText(x.c, masked)}`).join('\n');
  },

  /* ---- 地址轉座標（選用；會把地址送到第三方 OpenStreetMap） ---- */
  async geocode(ids) {
    const cs = ids.map(id => Store.get(id)).filter(c => c && c.addr && !c.geo);
    if (!cs.length) { U.toast('這些客戶都已有座標或沒有地址'); return; }
    if (!confirm(`將把 ${cs.length} 位客戶的地址送到 OpenStreetMap（Nominatim，第三方服務）查座標。\n客戶地址屬個人資料，只有按「確定」才會送出。\n台灣門牌常查不到，查不到會退回街道層級（僅供排序，不精準）。\n繼續嗎？`)) return;
    this.st.busy = true; this.render();
    let ok = 0;
    for (const c of cs) {
      const tries = [[c.addr.raw, 'osm-exact'], [c.city + c.district + c.roadKey, 'osm-street']];
      for (const [q, src] of tries) {
        try {
          const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tw&accept-language=zh-TW&q=' + U.enc(q));
          const j = await r.json();
          await new Promise(res => setTimeout(res, 1100));
          if (j && j[0]) { Store.ov.geo[c.id] = { lat: +(+j[0].lat).toFixed(6), lng: +(+j[0].lon).toFixed(6), src }; ok++; break; }
        } catch (e) { U.toast('查詢失敗：' + e.message); this.st.busy = false; Store.save(); Store.rebuild(); this.render(); return; }
      }
    }
    this.st.busy = false; Store.save(); Store.rebuild(); this.render(); U.toast(`已補 ${ok} / ${cs.length} 位座標`);
  },

  render() {
    const el = document.getElementById('tab-schedule'), s = this.st, m = Store.ov.settings.mask !== false, E = U.esc;
    if (!Store.list.length) { el.innerHTML = '<div class="card empty">沒有客戶資料</div>'; return; }
    const stops = this.plan(s.date), d = this.day(s.date);
    // 候選
    const pool = Store.list.filter(c => (s.cand === '__unvisited' ? !c.visited : (!s.cand || c.status === s.cand)) && !d.ids.includes(c.id));
    const groups = {};
    pool.forEach(c => { const k = (c.city + c.district) + '｜' + c.circle; (groups[k] = groups[k] || []).push(c); });
    const gk = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const cand = gk.map(k => `<div class="gh">${E(k)}（${groups[k].length}） <button class="ghost small" data-all="${E(k)}">全選</button></div>` +
      groups[k].sort((a, b) => this.key(a).localeCompare(this.key(b), 'zh-Hant')).map(c => {
        const on = this.scheduledOn(c.id);
        return `<label><input type="checkbox" data-pick="${E(c.id)}"${s.picked.has(c.id) ? ' checked' : ''}><span>${E(c.name)} <span class="muted small">${E(Store.addrText(c, m))}</span>${on.length ? ` <span class="tag">已排 ${E(on[0].slice(5))}</span>` : ''}</span></label>`;
      }).join('')).join('') || '<div class="empty">沒有候選客戶</div>';
    // 當天
    const missGeo = stops.filter(x => !x.c.geo).length;
    const urls = this.routeUrls(stops);
    const rows = stops.map((x, i) => `<tr>
      <td>${i + 1}</td><td>${this.hm(x.s)}–${this.hm(x.e)}</td>
      <td><label><input type="checkbox" data-done="${E(x.c.id)}"${d.done[x.c.id] ? ' checked' : ''}> ${E(x.c.name)}</label></td>
      <td class="wrap">${E(Store.addrText(x.c, m))}</td><td>${E(x.c.circle)}</td>
      <td>${Store.callBtns(x.c, m) || '<span class="muted">無</span>'}</td>
      <td>${x.c.geo ? `<span class="tag" title="${E(x.c.geo.src || '')}">${x.c.geo.src === 'osm-street' ? '街道級' : '有'}</span>` : '<span class="muted">無</span>'}</td>
      <td><button class="ghost" data-up="${E(x.c.id)}" title="上移">↑</button><button class="ghost" data-down="${E(x.c.id)}" title="下移">↓</button>
        <a target="_blank" rel="noopener" href="${E(this.navUrl(x.c))}">導航</a> ·
        <a target="_blank" rel="noopener" href="${E(this.gcalUrl(s.date, x))}">加日曆</a>
        <button class="ghost" data-open="${E(x.c.id)}">明細</button><button class="ghost" data-del="${E(x.c.id)}" title="移出這天">✕</button></td></tr>`).join('');
    const days = Object.keys(Store.ov.visits).sort();
    el.innerHTML = `<div class="sched">
      <div class="card"><h2>候選客戶</h2>
        <div class="opts"><label>候選範圍<select id="sCand"><option value="__unvisited"${s.cand === '__unvisited' ? ' selected' : ''}>未拜訪的客戶</option><option value=""${s.cand === '' ? ' selected' : ''}>全部客戶</option>${Store.statuses().map(x => `<option value="${E(x)}"${x === s.cand ? ' selected' : ''}>狀態：${E(x)}</option>`).join('')}</select></label>
          <button class="primary" id="sAdd">加入 ${E(s.date.slice(5))}（${[...s.picked].filter(id => !d.ids.includes(id)).length}）</button></div>
        <div class="cand">${cand}</div></div>
      <div>
        <div class="card"><h2>${E(s.date)}（${U.weekday(s.date)}）行程</h2>
          <div class="opts">
            <label>日期<input type="date" id="sDate" value="${E(s.date)}"></label>
            <label>出發時間<input type="time" id="sStart" value="${E(s.start)}"></label>
            <label>每家停留(分)<input type="number" id="sStay" min="10" step="5" value="${s.stay}" style="width:70px"></label>
            <label>交通緩衝(分)<input type="number" id="sGap" min="0" step="5" value="${s.gap}" style="width:70px"></label>
            <label>出發地（地址或店名）<input type="text" id="sOrigin" value="${E(this.origin())}" placeholder="例：中信房屋桃園中正捷運店" style="width:230px"></label>
          </div>
          <div class="actions">
            <button id="sAuto"${stops.length < 2 ? ' disabled' : ''}>自動排序（相近優先）</button>
            ${urls.map((u, i) => `<a target="_blank" rel="noopener" href="${E(u)}"><button class="primary">Google 地圖路線${urls.length > 1 ? ' ' + (i + 1) + '/' + urls.length : ''}</button></a>`).join('')}
            <button id="sIcs"${stops.length ? '' : ' disabled'}>下載 .ics（Apple/Outlook/Google）</button>
            <button id="sCopy"${stops.length ? '' : ' disabled'}>複製行程文字</button>
            <button id="sGeo"${stops.length && missGeo && !s.busy ? '' : ' disabled'} title="選用：會把地址送到 OpenStreetMap">${s.busy ? '查詢中…' : '補座標（' + missGeo + '）'}</button>
          </div>
          ${stops.length ? `<div class="tablewrap"><table><thead><tr><th class="nosort">#</th><th class="nosort">時間</th><th class="nosort">客戶（勾選＝已拜訪）</th><th class="nosort">地址</th><th class="nosort">生活圈</th><th class="nosort">電話（點擊撥打）</th><th class="nosort">座標</th><th class="nosort">操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">這天還沒有行程。從左邊勾選客戶後按「加入」。</div>'}
          ${urls.length > 1 ? '<p class="muted small">Google 地圖網址最多帶 9 個中途點，所以路線拆成多段，第二段從第一段終點出發。</p>' : ''}
          <p class="muted small">排序依據：有座標＝最近鄰居（非最佳解）；無座標＝縣市區→生活圈→路名→門牌。行事曆標題只放姓名，不含身分證與電話。</p>
        </div>
        <div class="card" style="margin-top:12px"><h2>所有排程</h2>
          ${days.length ? `<div class="tablewrap"><table><tbody>${days.map(dt => { const v = Store.ov.visits[dt]; return `<tr class="row" data-day="${E(dt)}"><td>${E(dt)}（${U.weekday(dt)}）</td><td>${v.ids.length} 家（已訪 ${Object.keys(v.done).length}）</td><td class="wrap">${E(v.ids.map(id => (Store.get(id) || {}).name || '?').join('、'))}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">尚無排程</div>'}
        </div></div></div>`;

    const q = x => el.querySelector(x);
    q('#sCand').onchange = e => { s.cand = e.target.value; s.picked.clear(); this.render(); };
    q('#sDate').onchange = e => { if (e.target.value) { s.date = e.target.value; s.picked.clear(); this.render(); } };
    q('#sStart').onchange = e => { s.start = e.target.value || '09:00'; this.persist(); this.render(); };
    q('#sStay').onchange = e => { s.stay = Math.max(10, +e.target.value || 45); this.persist(); this.render(); };
    q('#sGap').onchange = e => { s.gap = Math.max(0, +e.target.value || 0); this.persist(); this.render(); };
    q('#sOrigin').onchange = e => { Store.setting('origin', e.target.value.trim()); this.render(); };
    q('#sAdd').onclick = () => { const ids = [...s.picked]; s.picked.clear(); this.add(s.date, ids); this.render(); };
    q('#sAuto').onclick = () => this.autoSort(s.date);
    q('#sIcs').onclick = () => U.download(`拜訪_${s.date}.ics`, this.ics(s.date, stops), 'text/calendar;charset=utf-8');
    q('#sCopy').onclick = () => navigator.clipboard.writeText(this.text(s.date, stops, m)).then(() => U.toast('已複製'), () => U.toast('瀏覽器不允許複製'));
    q('#sGeo').onclick = () => this.geocode(d.ids);
    el.querySelectorAll('[data-pick]').forEach(n => n.onchange = () => { n.checked ? s.picked.add(n.dataset.pick) : s.picked.delete(n.dataset.pick); q('#sAdd').textContent = `加入 ${s.date.slice(5)}（${s.picked.size}）`; });
    el.querySelectorAll('[data-all]').forEach(b => b.onclick = () => { groups[b.dataset.all].forEach(c => s.picked.add(c.id)); this.render(); });
    el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => this.move(s.date, b.dataset.up, -1));
    el.querySelectorAll('[data-down]').forEach(b => b.onclick = () => this.move(s.date, b.dataset.down, 1));
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => this.remove(s.date, b.dataset.del));
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => List.open(b.dataset.open));
    el.querySelectorAll('[data-day]').forEach(r => r.onclick = () => { s.date = r.dataset.day; s.picked.clear(); this.render(); });
    el.querySelectorAll('[data-done]').forEach(n => n.onchange = () => {
      const id = n.dataset.done, dd = this._day(s.date), c = Store.get(id);
      if (n.checked) {
        dd.done[id] = true;
        if (c && Store.PRE_VISIT.includes(c.status) && confirm(`「${c.name}」拜訪完成。要把狀態改為「非原招」嗎？（目前：${c.status}）`)) Store.setExtra(id, { status: '非原招' });
      } else delete dd.done[id];
      Store.save(); Store.rebuild(); App.refresh();
    });
  },
};
