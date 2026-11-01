/* calc.js — 純計算（不碰 DOM，可用 node 測試）。以 IC.calc 對外提供。
 * 名詞：list＝表定年繳保費（折扣前）、paid＝實繳年繳保費（折扣後）、sum＝保額。 */
(function (root) {
  'use strict';
  var IC = root.IC = root.IC || {}, U = IC.util, D = IC.def, num = U.num, MODES = D.MODES;
  var C = IC.calc = {};

  /* ---------- 折扣 ---------- */
  function inRange(min, max, v) { return v >= num(min) && (num(max) <= 0 || v < num(max)); }

  /* 在第 k 個繳費年、表定年繳保費 list、保額 sum 時，實際適用的折扣清單 */
  C.applied = function (s, k, list, sum) {
    var out = [];
    s.discounts.forEach(function (d, i) {
      if (!d.on || (d.scope === 'first' && k !== 1)) return;
      var v = d.basis === 'sum' ? sum : list, val = 0;
      if (d.type === 'tier') {
        var t = (d.tiers || []).filter(function (x) { return inRange(x.min, x.max, v); })[0];
        if (t) val = num(t.value);
      } else if (inRange(d.minPrem, d.maxPrem, v)) val = num(d.value);
      if (val > 0) out.push({ idx: i, name: d.name, type: d.type === 'amt' ? 'amt' : 'pct', value: val });
    });
    return out;
  };

  /* 合併折扣：實繳 ＝ 表定 × 繳別係數 × f − a */
  C.discFactor = function (s, k, list, sum) {
    var items = C.applied(s, k, list, sum), cap = num(s.discCap), f = 1, a = 0, p = 0;
    items.forEach(function (d) { if (d.type === 'amt') a += d.value; else { p += d.value; f *= 1 - d.value / 100; } });
    if (s.stack === 'add') { if (cap > 0) p = Math.min(p, cap); f = 1 - p / 100; }
    else if (cap > 0) f = Math.max(f, 1 - cap / 100);
    return { f: f, a: a, items: items, pct: (1 - f) * 100 };
  };

  /* 每一期（依繳別）實際繳的金額；整數幣別時每期四捨五入，與建議書一致 */
  C.perInstallment = function (s, k, modeKey, withDisc, e) {
    var m = MODES[modeKey].m, base = e.round ? Math.round(e.prem) : e.prem, mf = num(s.mf[modeKey] || 1);
    var df = withDisc ? C.discFactor(s, k, base, e.sum) : { f: 1, a: 0 };
    var x = Math.max(0, base * mf * df.f - df.a) / m;
    return e.round ? Math.round(x) : x;
  };
  C.annualPremium = function (s, k, withDisc, e) { return C.perInstallment(s, k, s.mode, withDisc, e) * MODES[s.mode].m; };

  /* 各繳別對照（第 1 年、折扣後） */
  C.perMode = function (s, e) {
    return Object.keys(MODES).map(function (k) {
      var per = C.perInstallment(s, 1, k, true, e);
      return { key: k, label: MODES[k].label, m: MODES[k].m, per: per, total: per * MODES[k].m };
    });
  };

  C.schedule = function (s, withDisc, e) {
    var m = MODES[s.mode].m, fl = [], N = Math.max(1, Math.round(num(s.payYears)));
    for (var k = 1; k <= N; k++) {
      var per = C.perInstallment(s, k, s.mode, withDisc, e);
      for (var j = 0; j < m; j++) fl.push({ time: (k - 1) + j / m, amt: per, year: k });
    }
    return fl;
  };

  /* ---------- 以「實繳年繳保費」反推表定年繳保費 ---------- */
  C.breakpoints = function (s) {
    var rs = num(s.refSum), rl = num(s.refList), ref = rs > 0 && rl > 0, b = [0];
    s.discounts.forEach(function (d) {
      if (!d.on || (d.basis === 'sum' && !ref)) return;
      var th = d.type === 'tier'
        ? (d.tiers || []).reduce(function (a, t) { return a.concat([num(t.min), num(t.max)]); }, [])
        : [num(d.minPrem), num(d.maxPrem)];
      th.forEach(function (v) { if (v > 0) b.push(d.basis === 'sum' ? v * rl / rs : v); });
    });
    b.sort(function (x, y) { return x - y; });
    var u = [];
    b.forEach(function (v) { if (!u.length || v - u[u.length - 1] > 1e-9) u.push(v); });
    u.push(Infinity);
    return u;
  };
  C.paidAt = function (s, L, sum) {
    var base = Math.round(L), df = C.discFactor(s, 1, base, sum);
    return Math.round(Math.max(0, base * df.f - df.a));
  };
  C.solveList = function (s, target) {
    var rs = num(s.refSum), rl = num(s.refList), ref = rs > 0 && rl > 0, sum0 = num(s.sumInsured);
    function sumOf(L) { return ref ? rs * L / rl : sum0; }
    function paid(L) { return C.paidAt(s, L, sumOf(L)); }
    var bp = C.breakpoints(s), cands = [];
    for (var i = 0; i < bp.length - 1; i++) {
      var lo = bp[i], hi = bp[i + 1], lt = isFinite(hi) ? (lo + hi) / 2 : lo + 1;
      var df = C.discFactor(s, 1, Math.round(lt), sumOf(lt));
      if (df.f <= 0) continue;
      var L = Math.round((target + df.a) / df.f);
      cands.push({ L: L, ok: L >= Math.ceil(lo - 1e-9) && (!isFinite(hi) || L < hi) && Math.abs(paid(L) - target) <= 1 });
    }
    var good = cands.filter(function (c) { return c.ok; }), pick;
    if (good.length) pick = good[good.length - 1];   // 多解時取折扣最高（保費最高）的階梯
    else pick = cands.slice().sort(function (a, b) { return Math.abs(paid(a.L) - target) - Math.abs(paid(b.L) - target); })[0];
    var best = pick ? pick.L : target, bd = Math.abs(paid(best) - target);
    for (var d = -2; d <= 2; d++) {
      var v = (pick ? pick.L : target) + d;
      if (v > 0 && Math.abs(paid(v) - target) < bd) { best = v; bd = Math.abs(paid(v) - target); }
    }
    return best;
  };

  /* 折扣階梯一覽：把表定保費分成幾個區間，列出各區間的合併折扣 */
  C.discountSummary = function (s) {
    var rs = num(s.refSum), rl = num(s.refList), ref = rs > 0 && rl > 0, bp = C.breakpoints(s), segs = [];
    for (var i = 0; i < bp.length - 1; i++) {
      var lo = bp[i], hi = bp[i + 1], lt = isFinite(hi) ? (lo + hi) / 2 : lo + 1;
      var df = C.discFactor(s, 1, Math.round(lt), ref ? rs * lt / rl : num(s.sumInsured));
      var sig = df.items.map(function (x) { return x.name + x.value; }).join('|');
      if (segs.length && segs[segs.length - 1].sig === sig) segs[segs.length - 1].hi = hi;
      else segs.push({ lo: lo, hi: hi, sig: sig, items: df.items, pct: df.pct, capped: num(s.discCap) > 0 && df.pct >= num(s.discCap) - 1e-9 });
    }
    return segs;
  };

  /* ---------- 基準保額／保費 → 縮放比例 ---------- */
  C.eff = function (s) {
    var rs = num(s.refSum), rl = num(s.refList), sum = num(s.sumInsured), list = num(s.premium), paid = num(s.paidInput), by = s.inputBy;
    var ref = rs > 0 && rl > 0, sc = 1, prem = list, round = rl > 0 || by === 'paid';
    if (ref) {
      var order = { sum: ['sum', 'list', 'paid'], list: ['list', 'sum', 'paid'], paid: ['paid', 'list', 'sum'] }[by] || ['sum', 'list', 'paid'];
      for (var i = 0; i < order.length; i++) {
        var o = order[i];
        if (o === 'sum' && sum > 0) { sc = sum / rs; break; }
        if (o === 'list' && list > 0) { sc = list / rl; break; }
        if (o === 'paid' && paid > 0) { sc = C.solveList(s, paid) / rl; break; }
      }
      sum = rs * sc; prem = rl * sc;
    } else {
      if (by === 'paid' && paid > 0) prem = C.solveList(s, paid);
      if (rs > 0 && sum > 0) sc = sum / rs; else if (rl > 0 && prem > 0) sc = prem / rl;
    }
    var base = round ? Math.round(prem) : prem;
    return { scale: sc, sum: sum, prem: prem, ref: ref, round: round, paidAnnual: C.paidAt(s, base, sum) };
  };

  /* ---------- 表格資料處理 ---------- */
  function pts(rows, f, scale) {
    return rows.filter(function (r) { return r[f] !== '' && r[f] != null && isFinite(+r[f]) && r.y !== '' && Math.round(+r.y) >= 1; })
      .map(function (r) { return { y: Math.round(+r.y), v: +r[f] * scale }; }).sort(function (a, b) { return a.y - b.y; });
  }
  function interp(P, t) {
    var a = null, b = null;
    for (var i = 0; i < P.length; i++) {
      if (P[i].y === t) return { v: P[i].v, est: false };
      if (P[i].y < t) a = P[i];
      if (P[i].y > t && !b) b = P[i];
    }
    return a && b ? { v: a.v + (b.v - a.v) * (t - a.y) / (b.y - a.y), est: true } : null;
  }
  C.pts = pts; C.interp = interp;
  function cumAt(P, t) {
    if (t <= 0) return 0;
    var m = interp(P, t); if (m) return m.v;
    if (t < P[0].y) return P[0].v * t / P[0].y;
    return P[P.length - 1].v;
  }
  C.flowsFromCum = function (s, e) {
    var P = pts(s.rows, 'cum', e.scale); if (!P.length) return null;
    var m = MODES[s.mode].m, fl = [], T = P[P.length - 1].y, prev = 0;
    for (var t = 1; t <= T; t++) {
      var c = cumAt(P, t), a = Math.max(0, c - prev); prev = Math.max(prev, c);
      for (var j = 0; j < m; j++) fl.push({ time: (t - 1) + j / m, amt: a / m, year: t });
    }
    return fl;
  };
  function paidUpTo(fl, t) {
    var c = 0, cur = 0;
    fl.forEach(function (f) { if (f.time < t) { c += f.amt; if (f.year === t) cur += f.amt; } });
    return { cum: c, cur: cur };
  }

  /* IRR：保費（流出）與已領回金額（流入）折算到第 t 年末，與年度末保價金相等的年利率 */
  C.irr = function (fl, t, cv, inflows) {
    var use = fl.filter(function (f) { return f.time < t; }), inn = (inflows || []).filter(function (f) { return f.time <= t; });
    var paid = use.reduce(function (a, f) { return a + f.amt; }, 0);
    if (paid <= 0) return null;
    function g(r) {
      return use.reduce(function (a, f) { return a + f.amt * Math.pow(1 + r, t - f.time); }, 0) -
        inn.reduce(function (a, f) { return a + f.amt * Math.pow(1 + r, t - f.time); }, 0) - cv;
    }
    if (cv <= 0 && !inn.length) return -1;
    var lo = -0.99, hi = 1;
    if (g(lo) > 0) return lo;
    var n = 0; while (g(hi) < 0 && n++ < 40) hi *= 2;
    for (var i = 0; i < 70; i++) { var mid = (lo + hi) / 2; if (g(mid) > 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  };

  C.cvSeries = function (s, e) {
    var map = {}, T = 0;
    if (s.cvMode === 'rate') {
      var r = num(s.rate.r) / 100, load = num(s.rate.load) / 100, f0 = num(s.rate.fee0) / 100, fy = num(s.rate.feeYears);
      T = Math.max(1, Math.min(120, Math.round(num(s.rate.maxYear))));
      var N = Math.max(1, Math.round(num(s.payYears))), V = 0;
      for (var t = 1; t <= T; t++) {
        var pb = t <= N ? e.prem : 0;
        V = (V + pb * (1 - load)) * (1 + r);
        var fee = fy > 0 ? f0 * Math.max(0, 1 - (t - 1) / fy) : 0;
        map[t] = { v: V * (1 - fee), est: false };
      }
      return { map: map, T: T };
    }
    var P = pts(s.rows, 'cv', e.scale);
    if (!P.length) return { map: map, T: 0 };
    T = P[P.length - 1].y;
    for (var t2 = P[0].y; t2 <= T; t2++) { var m = interp(P, t2); if (m) map[t2] = m; }
    return { map: map, T: T };
  };

  /* ---------- 主計算 ---------- */
  C.compute = function (s) {
    var e = C.eff(s), cs = C.cvSeries(s, e), flT = s.paidMode === 'table' ? C.flowsFromCum(s, e) : null, calc = !flT;
    var fl = flT || C.schedule(s, true, e), fl0 = calc ? C.schedule(s, false, e) : null, rows = [];
    var a0 = num(s.age1);
    var N = Math.max.apply(null, fl.filter(function (f) { return f.amt > 1e-9; }).map(function (f) { return f.year; }).concat([1]));
    var XP = s.extra.map(function (n, i) { return pts(s.rows.map(function (r) { return { y: r.y, x: r.x[i] }; }), 'x', e.scale); });
    var payMap = {}; pts(s.rows, 'pay', e.scale).forEach(function (p) { if (p.v > 0) payMap[p.y] = p.v; });
    var inflows = [], cumPay = 0, bi = num(s.bene);
    for (var t = 1; t <= cs.T; t++) {
      var pay = payMap[t] || 0;
      if (pay > 0) { cumPay += pay; inflows.push({ time: t, amt: pay }); }
      var c = cs.map[t]; if (!c) continue;
      var p = paidUpTo(fl, t), p0 = fl0 ? paidUpTo(fl0, t) : null;
      if (p.cum <= 0) continue;
      var val = c.v + cumPay, gain = val - p.cum, ret = gain / p.cum;
      var r0 = p0 && p0.cum > 0 ? (val - p0.cum) / p0.cum : null;
      var i1 = C.irr(fl, t, c.v, inflows), i0 = fl0 ? C.irr(fl0, t, c.v, inflows) : null;
      var ex = XP.map(function (P) { var m = interp(P, t); return m ? m.v : null; });
      rows.push({
        t: t, age: a0 > 0 ? a0 + t - 1 : null, cur: p.cur, cum: p.cum, cv: c.v, est: c.est, pay: pay, cumPay: cumPay,
        value: val, gain: gain, ret: ret, mult: val / p.cum, simple: ret / t, irr: i1, ret0: r0, irr0: i0,
        gap: r0 == null ? null : ret - r0, ex: ex, bene: ex[bi] == null ? null : ex[bi], bmult: ex[bi] == null ? null : ex[bi] / p.cum
      });
    }
    var totPaid = fl.reduce(function (a, f) { return a + f.amt; }, 0);
    var totBase = fl0 ? fl0.reduce(function (a, f) { return a + f.amt; }, 0)
      : (e.prem > 0 ? C.perInstallment(s, 1, s.mode, false, e) * MODES[s.mode].m * N : totPaid);
    if (totBase < totPaid) totBase = totPaid;
    return { rows: rows, fl: fl, fl0: fl0, T: cs.T, calc: calc, e: e, N: N, totPaid: totPaid, totBase: totBase };
  };

  /* ---------- 里程碑 ---------- */
  C.metric = function (kind, r) {
    switch (kind) {
      case 'mult': return r.mult; case 'ret': return r.ret * 100; case 'simple': return r.simple * 100;
      case 'irr': return r.irr == null ? null : r.irr * 100; case 'age': return r.age; case 'year': return r.t;
    }
    return null;
  };
  C.condText = function (g) {
    var v = num(g.value);
    switch (g.kind) {
      case 'payend': return '繳費期滿（最後一期繳完的年度末）'; case 'maturity': return '滿期／祝壽金領回';
      case 'mult': return '價值 ≥ ' + v + '× 累計實繳'; case 'ret': return '總報酬率 ≥ ' + v + '%';
      case 'simple': return '單利年化 ≥ ' + v + '%'; case 'irr': return '複利年化 IRR ≥ ' + v + '%';
      case 'age': return '年齡 ≥ ' + v + ' 歲'; case 'year': return '第 ' + v + ' 年末';
    }
    return '';
  };
  C.findHit = function (rows, g, N) {
    var v = num(g.value), i, m;
    if (g.kind === 'year') { for (i = 0; i < rows.length; i++) if (rows[i].t === Math.round(v)) return rows[i]; return null; }
    if (g.kind === 'payend') { for (i = 0; i < rows.length; i++) if (rows[i].t >= N) return rows[i]; return null; }
    if (g.kind === 'maturity') { var h = null; rows.forEach(function (r) { if (r.pay > 0) h = r; }); return h; }
    for (var j = 0; j < rows.length; j++) { m = C.metric(g.kind, rows[j]); if (m != null && m >= v - 1e-12) return rows[j]; }
    return null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IC;
})(typeof window !== 'undefined' ? window : globalThis);
