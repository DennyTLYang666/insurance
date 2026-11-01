/* view.js — 畫面渲染（讀狀態 IC.st.S，寫 DOM）。以 IC.view 對外提供。 */
(function (root) {
  'use strict';
  var IC = root.IC = root.IC || {}, U = IC.util, D = IC.def, C = IC.calc, Ch = IC.charts;
  var num = U.num, $ = U.$, $$ = U.$$, esc = U.esc, fmt = U.fmt, pct = U.pct, mulf = U.mulf, cls = U.cls;
  var V = IC.view = { last: null };

  V.msg = function (t, bad) { var e = $('#saveMsg'); e.textContent = t; e.style.color = bad ? 'var(--neg)' : 'var(--accent)'; };

  /* ---------- 動態清單 ---------- */
  function opt(v, label, cur) { return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>'; }
  function inp(list, i, f, v, extra) { return '<input type="number" step="any" data-list="' + list + '" data-i="' + i + '" data-f="' + f + '"' + (extra || '') + ' value="' + esc(v) + '">'; }

  function discHtml(d, i) {
    var head = '<div class="top"><input type="checkbox" title="啟用" data-list="discounts" data-i="' + i + '" data-f="on"' + (d.on ? ' checked' : '') + '>' +
      '<input type="text" data-list="discounts" data-i="' + i + '" data-f="name" value="' + esc(d.name) + '">' +
      '<button class="btn sm" data-del="discounts" data-i="' + i + '">×</button></div>';
    var typeSel = '<div><label>方式</label><select data-list="discounts" data-i="' + i + '" data-f="type">' +
      opt('pct', '折扣 %', d.type) + opt('amt', '減金額/年', d.type) + opt('tier', '階梯（依保費／保額分段）', d.type) + '</select></div>';
    var basisSel = '<div><label>門檻依</label><select data-list="discounts" data-i="' + i + '" data-f="basis">' +
      opt('prem', '表定年繳保費', d.basis) + opt('sum', '保額', d.basis) + '</select></div>';
    var scopeSel = '<div><label>適用</label><select data-list="discounts" data-i="' + i + '" data-f="scope">' +
      opt('all', '每個繳費年', d.scope) + opt('first', '僅第1年', d.scope) + '</select></div>';
    if (d.type === 'tier') {
      var tiers = (d.tiers || []).map(function (t, j) {
        return '<div class="row" style="grid-template-columns:1fr 1fr 1fr 28px;margin:6px 0 0">' +
          '<div><label>達（含）</label>' + inp('discounts', i, 'min', t.min, ' data-t="' + j + '"') + '</div>' +
          '<div><label>未達（不含，0＝無上限）</label>' + inp('discounts', i, 'max', t.max, ' data-t="' + j + '"') + '</div>' +
          '<div><label>折扣 %</label>' + inp('discounts', i, 'value', t.value, ' data-t="' + j + '"') + '</div>' +
          '<button class="btn sm" data-tdel="' + i + ':' + j + '">×</button></div>';
      }).join('');
      return '<div class="item">' + head + '<div class="row">' + typeSel + basisSel + scopeSel + '</div>' + tiers +
        '<div class="btns"><button class="btn sm" data-tadd="' + i + '">＋階梯</button></div></div>';
    }
    return '<div class="item">' + head + '<div class="row">' + typeSel +
      '<div><label>數值</label>' + inp('discounts', i, 'value', d.value) + '</div>' + basisSel +
      '<div><label>達（含，0＝無）</label>' + inp('discounts', i, 'minPrem', d.minPrem) + '</div>' +
      '<div><label>未達（不含，0＝無上限）</label>' + inp('discounts', i, 'maxPrem', d.maxPrem) + '</div>' + scopeSel + '</div></div>';
  }
  V.renderDiscounts = function () {
    var S = IC.st.S;
    $('#discList').innerHTML = S.discounts.length ? S.discounts.map(discHtml).join('') : '<div class="hint">尚無折扣（實繳＝表定保費）。</div>';
  };
  V.renderBene = function () {
    var S = IC.st.S;
    $('#beneSel').innerHTML = S.extra.length
      ? S.extra.map(function (n, i) { return '<option value="' + i + '"' + (num(S.bene) === i ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('')
      : '<option value="0">（無附加欄位）</option>';
  };
  V.renderPlanGrid = function () {
    var S = IC.st.S, tbl = S.paidMode === 'table';
    var cols = '56px' + (tbl ? ' 1.1fr' : '') + S.extra.map(function () { return ' 1.1fr'; }).join('') + ' 1.1fr 1.1fr 26px';
    var h = '<div class="pg h" style="grid-template-columns:' + cols + '"><div>年度</div>' + (tbl ? '<div>累積實繳保費</div>' : '') +
      S.extra.map(function (n, i) {
        return '<div class="xh"><input type="text" title="欄位名稱" data-extra="' + i + '" value="' + esc(n) + '"><button class="btn sm" title="刪除此欄" data-delx="' + i + '">×</button></div>';
      }).join('') + '<div>年度末解約金</div><div>年度末領回金（生存／滿期／祝壽）</div><div></div></div>';
    var body = S.rows.map(function (r, i) {
      return '<div class="pg" style="grid-template-columns:' + cols + '">' + inp('rows', i, 'y', r.y) + (tbl ? inp('rows', i, 'cum', r.cum) : '') +
        S.extra.map(function (n, j) { return inp('rows', i, 'x', r.x[j], ' data-xi="' + j + '"'); }).join('') +
        inp('rows', i, 'cv', r.cv) + inp('rows', i, 'pay', r.pay) + '<button class="btn sm" data-del="rows" data-i="' + i + '">×</button></div>';
    }).join('');
    $('#planGrid').innerHTML = h + (body || '<div class="hint">尚無資料。請套用商品範本，或在下方貼上建議書表格。</div>');
    V.renderBene();
  };
  V.renderTargets = function () {
    var S = IC.st.S;
    $('#tgtList').innerHTML = S.targets.map(function (g, i) {
      var opts = Object.keys(D.KINDS).map(function (k) { return opt(k, D.KINDS[k], g.kind); }).join('');
      return '<div class="item"><div class="row" style="grid-template-columns:1fr 1.6fr .8fr 28px">' +
        '<div><label>名稱</label><input type="text" data-list="targets" data-i="' + i + '" data-f="label" value="' + esc(g.label) + '"></div>' +
        '<div><label>條件</label><select data-list="targets" data-i="' + i + '" data-f="kind">' + opts + '</select></div>' +
        '<div><label>數值</label>' + inp('targets', i, 'value', g.value) + '</div>' +
        '<button class="btn sm" data-del="targets" data-i="' + i + '">×</button></div></div>';
    }).join('');
  };
  V.renderChips = function () {
    function ch(arr, by) { return arr.map(function (v) { return '<button class="chip2" data-chip="' + by + '" data-v="' + v + '">' + v.toLocaleString('en-US') + '</button>'; }).join(''); }
    $('#chipList').innerHTML = ch(D.PREM_CHIPS, 'list');
    $('#chipPaid').innerHTML = ch(D.PREM_CHIPS, 'paid');
    $('#chipSum').innerHTML = ch(D.SUM_CHIPS, 'sum');
  };
  V.applyHide = function () {
    var S = IC.st.S;
    $('#inputs').hidden = !!S.hideInputs; $('#mini').hidden = !S.hideInputs;
    V.syncMiniHeight();
  };
  V.syncMiniHeight = function () {
    var m = $('#mini'), h = (!m.hidden && getComputedStyle(m).position === 'sticky') ? m.offsetHeight : 0;
    document.documentElement.style.setProperty('--minh', h + 'px');
  };
  V.syncInputs = function () {
    var S = IC.st.S;
    $$('[data-k]').forEach(function (el) {
      var v = U.getPath(S, el.dataset.k);
      if (el.tagName === 'SELECT' && el.dataset.num) return;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
    });
    V.renderDiscounts(); V.renderPlanGrid(); V.renderTargets(); V.applyHide();
  };

  /* ---------- 快速區：折扣開關、折前→折後明細、階梯一覽 ---------- */
  function rangeText(lo, hi) {
    if (!isFinite(hi)) return lo > 0 ? fmt(lo) + ' 以上' : '不限保費';
    if (lo <= 0) return '低於 ' + fmt(hi);
    return fmt(lo) + '～' + fmt(hi) + '（不含）';
  }
  function itemText(x) { return (x.type === 'amt' ? '−' + fmt(x.value) : x.value + '%') + '（' + esc(U.shortName(x.name)) + '）'; }

  function renderQuickDiscount(S, res) {
    var e = res.e, base = e.round ? Math.round(e.prem) : e.prem;
    var act = C.applied(S, 1, base, e.sum), by = {};
    act.forEach(function (a) { by[a.idx] = a; });
    $('#discChips').innerHTML = S.discounts.length ? '<span class="hint" style="margin:0">折扣開關：</span>' + S.discounts.map(function (d, i) {
      var a = by[i];
      return '<label class="' + (d.on && a ? '' : 'off') + '"><input type="checkbox" data-list="discounts" data-i="' + i + '" data-f="on"' + (d.on ? ' checked' : '') + '>' +
        esc(U.shortName(d.name)) + ' <span class="dst">' + (!d.on ? '已關閉' : (a ? '目前 ' + (a.type === 'amt' ? '−' + fmt(a.value) : a.value + '%') : '未達門檻')) + '</span></label>';
    }).join('') : '';

    var segs = C.discountSummary(S);
    $('#discSummary').innerHTML = S.discounts.length && segs.some(function (x) { return x.items.length; })
      ? '<b>折扣階梯（表定年繳保費）</b>：' + segs.map(function (sg) {
        return '<span class="seg' + (base >= sg.lo && base < sg.hi ? ' cur' : '') + '">' + rangeText(sg.lo, sg.hi) + '：' +
          (sg.items.length ? sg.items.map(itemText).join(' ＋ ') + (sg.items.length > 1 ? ' ＝ 共 ' + U.trn(sg.pct, 2) + '%' : '') + (sg.capped ? '（上限）' : '') : '無折扣') + '</span>';
      }).join('') : '';

    if (res.calc) {
      var df = C.discFactor(S, 1, base, e.sum), list = C.annualPremium(S, 1, false, e), paid = C.annualPremium(S, 1, true, e);
      var modes = C.perMode(S, e).map(function (m) { return m.label + ' ' + fmt(m.per) + (m.m > 1 ? '×' + m.m : ''); }).join('｜');
      $('#premPreview').innerHTML =
        '<div class="flow"><span><i>表定年繳（折扣前）</i><b>' + fmt(list) + '</b></span><em>' +
        (df.items.length ? '折扣 ' + U.trn(df.pct, 2) + '%<small>' + df.items.map(itemText).join(' ＋ ') + '</small>' : '無適用折扣') +
        '</em><span><i>實繳年繳（折扣後）</i><b class="pos">' + fmt(paid) + '</b></span></div>' +
        '每年省 <b>' + fmt(list - paid) + '</b>，繳 ' + res.N + ' 年共省 <b>' + fmt(res.totBase - res.totPaid) + '</b>；總實繳 <b>' + fmt(res.totPaid) + '</b>；保額 <b>' + fmt(e.sum) + '</b>' +
        '<div class="hint" style="margin:2px 0 0">各繳別實繳（折扣後、依繳別加成係數）：' + modes + '</div>';
    } else {
      $('#premPreview').innerHTML = '目前實繳取自逐年表的「累積實繳保費」欄（總實繳 <b>' + fmt(res.totPaid) + '</b>），折扣設定未參與計算。';
    }
  }

  /* 換算值：同一欄位可能出現在「快速試算」與「簡易調參」兩處，全部更新（正在輸入的那格不動） */
  function setDerived(key, val) {
    $$('[data-k="' + key + '"]').forEach(function (el) {
      el.classList.add('derived'); if (document.activeElement !== el) el.value = U.tr(val, 0);
    });
  }

  /* 圖表（頁寬）：視窗大小改變時單獨重繪 */
  V.drawCharts = function (res) {
    var S = IC.st.S; res = res || V.last; if (!res) return;
    var rows = res.rows, N = res.N;
    var hasBene = rows.some(function (r) { return r.bene != null; }), bname = S.extra[num(S.bene)] || '身故保障';
    Ch.legend($('#lg1'), [['累計實繳', '--c3'], ['解約金（含領回）', '--c1']].concat(hasBene ? [[esc(bname), '--c2']] : []));
    Ch.line($('#ch1'), [
      { name: '累計實繳', color: '--c3', pts: rows.map(function (r) { return [r.t, r.cum]; }) },
      { name: '解約金（含領回）', color: '--c1', pts: rows.map(function (r) { return [r.t, r.value]; }) }].concat(hasBene ? [
      { name: bname, color: '--c2', dash: true, pts: rows.map(function (r) { return [r.t, r.bene]; }) }] : []),
      { yFmt: function (v) { return fmt(v); }, vlines: [{ x: N, label: '繳費期滿' }] });
    Ch.legend($('#lg2'), [['價值倍數（解約金含領回）', '--c1']].concat(hasBene ? [['保障倍數（' + esc(bname) + '）', '--c2']] : []));
    Ch.line($('#ch2'), [
      { name: '價值倍數', color: '--c1', pts: rows.map(function (r) { return [r.t, r.mult]; }) }].concat(hasBene ? [
      { name: '保障倍數', color: '--c2', dash: true, pts: rows.map(function (r) { return [r.t, r.bmult]; }) }] : []),
      { yFmt: function (v) { return U.trs(v, 1) + '×'; }, base: 1, vlines: [{ x: N, label: '繳費期滿' }] });
  };

  /* ---------- 主渲染 ---------- */
  V.render = function () {
    var S = IC.st.S, res = C.compute(S), rows = res.rows, e = res.e, N = res.N, ccy = esc(S.ccy || '');
    V.last = res;
    $('#panelTable').hidden = !(S.cvMode === 'table' || S.paidMode === 'table'); $('#panelRate').hidden = S.cvMode !== 'rate';
    $('#resTitle').textContent = (S.name ? '｜' + S.name : '') + '｜' + (S.ccy || '');

    $$('#quick input.derived').forEach(function (x) { x.classList.remove('derived'); });
    var by = S.inputBy;
    if (e.prem > 0 || e.paidAnnual > 0) {
      if (by !== 'paid') setDerived('paidInput', e.paidAnnual);
      if (by !== 'list' && (e.ref || by === 'paid')) setDerived('premium', e.prem);
      if (by !== 'sum' && e.ref) setDerived('sumInsured', e.sum);
    }
    var warn = [];
    if (num(S.minSum) > 0 && e.sum > 0 && e.sum < num(S.minSum)) warn.push('保額 ' + fmt(e.sum) + ' 低於此商品最低投保金額 ' + fmt(S.minSum) + '，實務上無法投保。');
    if (num(S.maxSum) > 0 && e.sum > num(S.maxSum)) warn.push('保額 ' + fmt(e.sum) + ' 超過此商品最高投保金額 ' + fmt(S.maxSum) + '。');
    if (num(S.refAge) > 0 && num(S.age1) > 0 && num(S.age1) !== num(S.refAge))
      warn.push('年齡 ' + S.age1 + ' 歲與範本（' + esc(S.ageNote || S.refAge + '歲') + '）不同：只平移了年齡標示，保費、解約金、身故金、祝壽年度都沒有重算，請以該年齡的建議書另存範本。');
    if (e.ref && Math.abs(e.scale - 1) > 1e-9) warn.push('已依範本等比例縮放 ' + U.trs(e.scale * 100, 1) + '%（概算，實際以建議書為準）。');
    $('#quickWarn').innerHTML = warn.map(function (w) { return '<div class="warn">' + w + '</div>'; }).join('');
    renderQuickDiscount(S, res);
    $('#miniTitle').textContent = S.productName || S.name || '';
    $('#miniInfo').textContent = res.calc
      ? '表定 ' + fmt(C.annualPremium(S, 1, false, e)) + ' → 實繳 ' + fmt(C.annualPremium(S, 1, true, e)) + '／年；總實繳 ' + fmt(res.totPaid)
      : '總實繳 ' + fmt(res.totPaid);

    /* KPI */
    var save = res.totBase - res.totPaid, be = null, i;
    for (i = 0; i < rows.length; i++) if (rows[i].gain >= 0) { be = rows[i]; break; }
    var y10 = rows.filter(function (r) { return r.t === 10; })[0], lastR = rows[rows.length - 1], ref = y10 || lastR;
    var b1 = rows[0], bN = rows.filter(function (r) { return r.t === N; })[0];
    $('#kpis').innerHTML =
      '<div class="kpi"><b>' + fmt(res.totPaid) + ' ' + ccy + '</b><span>總實繳' + (save > 0.5 ? '・表定 ' + fmt(res.totBase) + '<br><span class="sv">折扣省 ' + fmt(save) + '（' + U.trs(save / res.totBase * 100, 2) + '%）</span>' : '') + '</span></div>' +
      '<div class="kpi"><b>' + (be ? '第 ' + be.t + ' 年' : '表內未回本') + '</b><span>回本年度（價值 ≥ 累計實繳）</span></div>' +
      (ref ? '<div class="kpi"><b class="' + cls(ref.ret) + '">' + pct(ref.ret) + '</b><span>第 ' + ref.t + ' 年總報酬｜單利 ' + pct(ref.simple) + '｜IRR ' + pct(ref.irr) + '</span></div>' : '') +
      (b1 && b1.bmult != null ? '<div class="kpi"><b>' + mulf(b1.bmult) + '</b><span>第1年末身故保障 ÷ 累計實繳' + (bN && bN !== b1 && bN.bmult != null ? '<br>繳費期滿（第' + N + '年）：' + mulf(bN.bmult) : '') + '</span></div>' : '') +
      (ref && ref.gap != null ? '<div class="kpi"><b>+' + U.trs(ref.gap * 100, 1) + ' 個百分點</b><span>折扣對第 ' + ref.t + ' 年總報酬的加成</span></div>' : '');

    /* 里程碑（依年度排序） */
    var hasAge = rows.some(function (r) { return r.age != null; });
    var items = S.targets.map(function (g, idx) { var noAge = g.kind === 'age' && !hasAge; return { g: g, idx: idx, noAge: noAge, h: noAge ? null : C.findHit(rows, g, N) }; });
    items.sort(function (a, b) { var ta = a.h ? a.h.t : 1e9, tb = b.h ? b.h.t : 1e9; return ta - tb || a.idx - b.idx; });
    var hits = {};
    $('#ms').innerHTML = items.map(function (it) {
      var g = it.g, h = it.h, head = '<div class="t">' + esc(g.label) + '｜' + esc(C.condText(g)) + '</div>';
      if (it.noAge) return '<div class="mscard">' + head + '<div class="r no">無年齡資料</div><div class="d">請在「快速試算」填年齡</div></div>';
      if (!h) return '<div class="mscard">' + head + '<div class="r no">表內未達成</div><div class="d">最後一年：' + (lastR ? '總報酬 ' + pct(lastR.ret) : '—') + '</div></div>';
      (hits[h.t] = hits[h.t] || []).push(g.label);
      return '<div class="mscard">' + head + '<div class="r">第 ' + h.t + ' 年' + (h.age != null ? '（' + h.age + (g.kind === 'maturity' ? '→' + (h.age + 1) : '') + ' 歲）' : '') + '</div>' +
        '<div class="d">價值 ' + fmt(h.value) + '・累計實繳 ' + fmt(h.cum) + (h.pay > 0 ? '<br>領回 ' + fmt(h.pay) : '') + '<br>總報酬 ' + pct(h.ret) + '・' + mulf(h.mult) + '<br>單利 ' + pct(h.simple) + '・IRR ' + pct(h.irr) + '</div></div>';
    }).join('') || '<div class="hint">未設定里程碑。</div>';

    V.drawCharts(res);

    /* 表格：profit 獲利狀況（預設）／full 完整。
     * 不另設「里程碑」欄：10/20/…/110 歲的年齡、每達 50%／100%／150%… 的總報酬以粗體標示；繳費期滿為粗底線。 */
    var profit = S.tableMode === 'profit', hasPay = rows.some(function (r) { return r.pay > 0; });
    var sb = S.showBase && res.calc && !profit;
    var exIdx = profit ? [] : S.extra.map(function (n, k) { return k; }).filter(function (k) { return rows.some(function (r) { return r.ex[k] != null; }); });
    var BOLD_AGE = { 10: 1, 20: 1, 30: 1, 40: 1, 50: 1, 60: 1, 65: 1, 70: 1, 80: 1, 90: 1, 100: 1, 110: 1 };
    var boldRet = {}, maxRet = rows.reduce(function (m, r) { return Math.max(m, r.ret); }, 0);
    for (var kk = 1; kk * 0.5 <= maxRet + 1e-12 && kk <= 80; kk++) {
      for (var ii = 0; ii < rows.length; ii++) if (rows[ii].ret >= kk * 0.5 - 1e-12) { boldRet[rows[ii].t] = true; break; }
    }
    function simpleTd(r) {   // 單利：總報酬(年化)，例 50%(4.5%)；總報酬在每個 50% 門檻的第一年粗體
      var tot = pct(r.ret, 0);
      return '<td class="' + cls(r.ret) + '">' + (boldRet[r.t] ? '<b>' + tot + '</b>' : tot) + '(' + pct(r.simple) + ')</td>';
    }
    function ageTd(r) { return hasAge ? '<td class="c' + (BOLD_AGE[r.age] ? ' b' : '') + '">' + (r.age == null ? '—' : r.age) + '</td>' : ''; }
    function irrTd(r) { return '<td class="' + cls(r.irr) + '">' + pct(r.irr) + '</td>'; }
    var th = profit
      ? '<tr><th>年度</th>' + (hasAge ? '<th>年齡</th>' : '') + '<th>累計實繳</th><th title="' + (hasPay ? '含已領回的祝壽／滿期金' : '年度末保價金') + '">保價金</th>' +
        '<th title="單利：總報酬(年化單利)">單利</th><th title="年化複利報酬率（IRR）">複利IRR</th></tr>'
      : '<tr><th>年度</th>' + (hasAge ? '<th>年齡</th>' : '') + '<th>當年實繳</th><th>累計實繳</th>' +
        exIdx.map(function (k) { return '<th>' + esc(S.extra[k]) + '</th>'; }).join('') +
        '<th>保價金</th>' + (hasPay ? '<th>當年領回</th>' : '') + '<th>損益</th><th>倍數</th><th title="單利：總報酬(年化單利)">單利</th><th title="年化複利報酬率（IRR）">複利IRR</th>' +
        (sb ? '<th>無折扣報酬</th><th>無折扣IRR</th><th>折扣加成</th>' : '') + '</tr>';
    var body = rows.filter(function (r) {
      if (!S.keyOnly) return true;
      return r.t === 1 || r.t === N || r.t % 5 === 0 || (r.age != null && r.age % 5 === 0) || hits[r.t] || r === lastR;
    }).map(function (r) {
      /* 底色只有兩種、每 5 個保單年度交替；內插估值用灰色斜體（不加符號） */
      var tr = '<tr class="d' + (Math.floor((r.t - 1) / 5) % 2) + (r.t === N ? ' pe' : '') + '"><td>' + r.t + '</td>' + ageTd(r);
      if (profit)
        return tr + '<td>' + fmt(r.cum) + '</td><td class="' + (r.est ? 'est' : '') + '">' + fmt(r.value) + '</td>' + simpleTd(r) + irrTd(r) + '</tr>';
      return tr + '<td>' + fmt(r.cur) + '</td><td>' + fmt(r.cum) + '</td>' + exIdx.map(function (k) { return '<td>' + fmt(r.ex[k]) + '</td>'; }).join('') +
        '<td class="' + (r.est ? 'est' : '') + '">' + fmt(r.cv) + '</td>' + (hasPay ? '<td>' + (r.pay > 0 ? fmt(r.pay) : '') + '</td>' : '') +
        '<td class="' + cls(r.gain) + '">' + fmt(r.gain) + '</td><td>' + mulf(r.mult) + '</td>' + simpleTd(r) + irrTd(r) +
        (sb ? '<td class="' + cls(r.ret0) + '">' + pct(r.ret0, 0) + '</td><td class="' + cls(r.irr0) + '">' + pct(r.irr0) + '</td><td>' + (r.gap == null ? '—' : '+' + U.trs(r.gap * 100, 1) + 'pp') + '</td>' : '') + '</tr>';
    }).join('');
    $('#tblwrap').className = 'tw ' + (profit ? 'fit' : 'scroll');   // 獲利狀況：整張表直接排在頁面上，不另設捲動區
    $('#tbl').innerHTML = rows.length ? '<thead>' + th + '</thead><tbody>' + body + '</tbody>'
      : '<tbody><tr><td class="empty" colspan="6" style="text-align:center">請先套用商品範本（顯示輸入區 → 快速試算），或貼上建議書逐年表。</td></tr></tbody>';
    IC.store.persistLast(S);
  };
})(window);
