/* 樹狀選取：縣市 → 區 → 生活圈 → 路名 → 客戶。每一層都有勾選框（全選／部分選取／未選），可展開收合，
 * 客戶之間按住 Shift 可連續勾選。用在排程的候選客戶；之後客戶管理清單也能共用。 */
const Tree = {
  LEVELS: [c => c.city || '（無地址）', c => c.district || '（未分區）', c => (c.circle || '（未細分）').replace((c.district || '\u0000') + '（', '（'), c => c.roadKey || '（無路名）'],
  SEP: '\u0001',

  build(list) {
    const root = { kids: new Map(), ids: [], key: '' };
    for (const c of list) {
      let n = root; n.ids.push(c.id);
      this.LEVELS.forEach((f, i) => {
        const lb = f(c), key = n.key + this.SEP + lb;
        if (!n.kids.has(lb)) n.kids.set(lb, { label: lb, key, lv: i, kids: new Map(), ids: [], cs: [] });
        n = n.kids.get(lb); n.ids.push(c.id);
      });
      n.cs.push(c);
    }
    return root;
  },

  /* host：放樹的容器；opt：{ list, picked(Set), st({open:Set, inited, last, q}), leaf(c)→html, key(c)→排序鍵, onChange() } */
  make(host, opt) {
    const E = U.esc, st = opt.st, T = this;
    const nodes = new Map();
    let all = [];
    const filtered = () => {
      const q = (st.q || '').trim().toLowerCase();
      return q ? opt.list.filter(c => (c.name + ' ' + (c.addr ? c.addr.raw : '') + ' ' + c.circle).toLowerCase().includes(q)) : opt.list;
    };
    const stat = n => { let k = 0; for (const id of n.ids) if (opt.picked.has(id)) k++; return k === 0 ? 0 : k === n.ids.length ? 2 : 1; };
    const walk = (n, f) => n.kids.forEach(k => { f(k); walk(k, f); });
    const html = n => [...n.kids.values()].sort((a, b) => U.coll.compare(a.label, b.label)).map(k => {
      nodes.set(k.key, k);
      const open = st.open.has(k.key), leafLv = k.lv === T.LEVELS.length - 1;
      const body = !open ? '' : leafLv
        ? k.cs.slice().sort((a, b) => U.coll.compare(opt.key ? opt.key(a) : a.name, opt.key ? opt.key(b) : b.name)).map(c =>
          `<label class="tleaf" style="--lv:${k.lv + 1}"><input type="checkbox" data-pick="${E(c.id)}"${opt.picked.has(c.id) ? ' checked' : ''}><span>${opt.leaf(c)}</span></label>`).join('')
        : html(k);
      return `<div class="tn"><div class="tr" style="--lv:${k.lv}"><button class="tg" data-k="${E(k.key)}" aria-label="${open ? '收合' : '展開'}">${open ? '▼' : '▶'}</button><input type="checkbox" data-nk="${E(k.key)}" aria-label="全選 ${E(k.label)}"><span class="tl" data-k="${E(k.key)}">${E(k.label)}</span> <span class="muted small">（${k.ids.length}）</span></div>${body}</div>`;
    }).join('');

    const refresh = () => {
      const top = host.querySelector('.tscroll') ? host.querySelector('.tscroll').scrollTop : 0;
      const list = filtered(); all = list; nodes.clear();
      const root = T.build(list);
      if (!st.inited && list.length) {   // 第一次：少量客戶全部展開，大量只展開到「區」
        st.inited = true;
        walk(root, k => { if (list.length <= 60 || k.lv < 1) st.open.add(k.key); });
      }
      if ((st.q || '').trim() && list.length <= 200) walk(root, k => st.open.add(k.key));
      const total = opt.list.length, shown = list.length, picked = list.filter(c => opt.picked.has(c.id)).length;
      host.innerHTML = `<div class="tbar"><input type="search" class="tq" placeholder="搜尋姓名／地址／生活圈" value="${E(st.q || '')}" aria-label="搜尋候選客戶">
        <button class="ghost small" data-act="open">展開全部</button><button class="ghost small" data-act="close">收合</button><button class="ghost small" data-act="all">全選</button><button class="ghost small" data-act="none">清除</button>
        <span class="muted small">${picked ? `已勾 ${picked}／` : ''}${shown}${shown !== total ? `（共 ${total}）` : ''} 位　Shift 可連續勾選</span></div>
        <div class="tscroll">${html(root) || '<div class="empty">沒有候選客戶</div>'}</div>`;
      const sc = host.querySelector('.tscroll'); if (sc) sc.scrollTop = top;
      host.querySelectorAll('[data-nk]').forEach(cb => { const n = nodes.get(cb.dataset.nk), s = n ? stat(n) : 0; cb.checked = s === 2; cb.indeterminate = s === 1; });
      const q = host.querySelector('.tq'); q.oninput = () => { st.q = q.value; clearTimeout(st._t); st._t = setTimeout(() => { refresh(); const q2 = host.querySelector('.tq'); q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); }, 250); };
    };

    host.onclick = e => {
      const t = e.target;
      const act = t.closest('[data-act]');
      if (act) {
        const root = T.build(all);
        if (act.dataset.act === 'open') walk(root, k => st.open.add(k.key));
        else if (act.dataset.act === 'close') st.open.clear();
        else if (act.dataset.act === 'all') { all.forEach(c => opt.picked.add(c.id)); st.last = null; refresh(); opt.onChange(); return; }
        else { all.forEach(c => opt.picked.delete(c.id)); st.last = null; refresh(); opt.onChange(); return; }
        refresh(); return;
      }
      if (t.matches('[data-nk]')) {
        const n = nodes.get(t.dataset.nk); if (!n) return;
        const full = n.ids.every(id => opt.picked.has(id));
        n.ids.forEach(id => full ? opt.picked.delete(id) : opt.picked.add(id));
        st.last = null; refresh(); opt.onChange(); return;
      }
      if (t.matches('[data-pick]')) {
        const id = t.dataset.pick, on = t.checked;
        const ids = [...host.querySelectorAll('[data-pick]')].map(x => x.dataset.pick);
        const a = st.last ? ids.indexOf(st.last) : -1, b = ids.indexOf(id);
        if (e.shiftKey && a >= 0 && b >= 0) ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => on ? opt.picked.add(x) : opt.picked.delete(x));
        else on ? opt.picked.add(id) : opt.picked.delete(id);
        st.last = id; refresh(); opt.onChange(); return;
      }
      const tg = t.closest('[data-k]');
      if (tg) { const k = tg.dataset.k; st.open.has(k) ? st.open.delete(k) : st.open.add(k); refresh(); }
    };
    refresh();
    return { refresh };
  },
};
