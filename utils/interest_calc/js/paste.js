/* paste.js — 從建議書貼上整張表：解析、猜欄位、對應、套用。以 IC.paste 對外提供。 */
(function (root) {
  'use strict';
  var IC = root.IC = root.IC || {}, U = IC.util, C = IC.calc, num = U.num, $ = U.$, esc = U.esc;
  var Pa = IC.paste = { pm: null };

  function numTok(x) { var t = String(x).replace(/,/g, '').replace(/[^\d.\-]/g, ''); return (t === '' || t === '-' || t === '.') ? NaN : parseFloat(t); }
  function col(m, c) { return m.map(function (r) { return r[c]; }); }

  /* 文字 → 數字矩陣；標題列（第一欄不是數字）自動略過 */
  Pa.parseMatrix = function (text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line) {
      line = line.replace(/[第年期歲]/g, ' ').trim(); if (!line) return;
      var tok = line.split(/[\t ;；]+/).filter(Boolean);
      if (tok.length === 1 && tok[0].indexOf(',') >= 0 && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(tok[0])) tok = tok[0].split(/[,，]/).filter(Boolean);
      var nums = tok.map(numTok);
      if (!isFinite(nums[0])) return;
      out.push(nums);
    });
    return out;
  };

  /* 猜欄位：年度、保險年齡（逐年遞增1）、累積實繳（不遞減）、附加欄位（身故金）、領回金（倒數第二欄）、解約金（最後一欄） */
  Pa.guessMap = function (m) {
    var n = m.reduce(function (a, r) { return Math.max(a, r.length); }, 0), g = { y: -1, age: -1, cum: -1, cv: -1, pay: -1, x: [-1, -1] };
    if (n <= 1) { g.cv = 0; return g; }
    if (n === 2) { g.y = 0; g.cv = 1; return g; }
    g.y = 0; g.cv = n - 1; var c = 1, a = col(m, 1);
    if (a.length > 1 && a.every(function (v) { return Number.isInteger(v) && v >= 0 && v <= 120; }) && a[a.length - 1] - a[0] === a.length - 1) { g.age = 1; c = 2; }
    if (c < n - 1) { var b = col(m, c); if (b.every(function (v, i) { return isFinite(v) && (i === 0 || v >= b[i - 1]); })) { g.cum = c; c++; } }
    if (c < n - 1) g.x[0] = c;
    if (n >= 6 && n - 2 > c) g.pay = n - 2;
    return g;
  };

  Pa.parse = function (text) {
    var m = Pa.parseMatrix(text);
    if (!m.length) { Pa.pm = null; Pa.render(); return false; }
    Pa.pm = { m: m, n: m.reduce(function (a, r) { return Math.max(a, r.length); }, 0) };
    Pa.pm.g = Pa.guessMap(m); Pa.render();
    return true;
  };

  Pa.render = function () {
    var box = $('#mapBox'), S = IC.st.S;
    if (!Pa.pm) { box.innerHTML = ''; return; }
    var n = Pa.pm.n, g = Pa.pm.g, e = C.eff(S);
    function opts(sel) { var h = '<option value="-1">不使用</option>'; for (var i = 0; i < n; i++) h += '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>欄 ' + (i + 1) + '</option>'; return h; }
    function sel(id, label, v) { return '<div><label>' + label + '</label><select id="' + id + '">' + opts(v) + '</select></div>'; }
    var prev = Pa.pm.m.slice(0, 2).map(function (r) { return r.map(function (v) { return isFinite(v) ? v : '?'; }).join(' | '); }).join('\n');
    box.innerHTML = '<div class="mapbox"><div class="hint">解析到 ' + Pa.pm.m.length + ' 列、' + n + ' 欄。前兩列：</div><pre>' + esc(prev) + '</pre>' +
      '<div class="row">' + sel('mp_y', '年度（不使用＝從1起算）', g.y) + sel('mp_age', '保險年齡', g.age) + sel('mp_cum', '累積實繳保費', g.cum) +
      sel('mp_cv', '年度末解約金', g.cv) + sel('mp_pay', '年度末領回金（生存／滿期）', g.pay) + '</div>' +
      '<div class="row">' + sel('mp_x0', '附加欄位1', g.x[0]) + '<div><label>名稱</label><input type="text" id="nm_x0" value="' + esc(S.extra[0] || '身故保險金') + '"></div>' +
      sel('mp_x1', '附加欄位2', g.x[1]) + '<div><label>名稱</label><input type="text" id="nm_x1" value="' + esc(S.extra[1] || '附加欄位2') + '"></div></div>' +
      '<div class="row"><div><label>此建議書的保額（縮放基準）</label><input type="number" id="mp_sum" step="any" value="' + (e.sum > 0 ? U.tr(e.sum, 0) : '') + '"></div>' +
      '<div><label>此建議書的「表定」年繳保費（折扣前，不是折扣後）</label><input type="number" id="mp_list" step="any" value="' + (e.prem > 0 ? U.tr(e.prem, 0) : '') + '"></div>' +
      '<div><label>祝壽／滿期金（備註列的數字，選填）</label><input type="number" id="mp_mat" step="any"></div></div>' +
      '<div class="hint">建議書表頭有保額與「首期表定保險費」（折扣前）；「首期折扣後保險費」是實繳，不要填在這裡。填了才能事後改保額／保費等比例縮放。祝壽金通常寫在表格下方備註，會放到最後一年的「領回金」。</div>' +
      '<div class="btns"><button class="btn sm pri" id="btnApplyMap">套用（覆蓋目前表格）</button></div></div>';
  };

  Pa.apply = function () {
    var S = IC.st.S, V = IC.view;
    var g = { y: +$('#mp_y').value, age: +$('#mp_age').value, cum: +$('#mp_cum').value, cv: +$('#mp_cv').value, pay: +$('#mp_pay').value, x: [+$('#mp_x0').value, +$('#mp_x1').value] };
    var names = [$('#nm_x0').value || '附加欄位1', $('#nm_x1').value || '附加欄位2'];
    if (g.cv < 0 && g.cum < 0) { V.msg('至少要對應「年度末解約金」或「累積實繳保費」', true); return; }
    var xs = []; g.x.forEach(function (c, i) { if (c >= 0) xs.push({ c: c, name: names[i] }); });
    function pick(r, i) { return (i >= 0 && isFinite(r[i])) ? r[i] : ''; }
    var seq = 0, rows = [], age0 = null;
    Pa.pm.m.forEach(function (r) {
      var y = g.y >= 0 ? r[g.y] : (++seq);
      if (!isFinite(y) || y < 1) return;
      y = Math.round(y);
      if (age0 == null && g.age >= 0 && isFinite(r[g.age])) age0 = r[g.age] - (y - 1);
      rows.push({ y: y, cum: pick(r, g.cum), cv: pick(r, g.cv), x: xs.map(function (e) { return pick(r, e.c); }), pay: pick(r, g.pay) });
    });
    if (!rows.length) { V.msg('沒有可用的資料列', true); return; }
    var mat = num($('#mp_mat').value);
    if (mat > 0) { var last = rows[rows.length - 1]; last.pay = (num(last.pay) || 0) + mat; }
    var sum = num($('#mp_sum').value), list = num($('#mp_list').value);
    S.extra = xs.map(function (e) { return e.name; }); S.rows = rows; S.bene = 0;
    if (age0 != null) { S.age1 = age0; S.refAge = age0; }
    if (sum > 0 && list > 0) { S.refSum = sum; S.refList = list; S.sumInsured = sum; S.premium = list; S.inputBy = 'sum'; } else { S.refSum = 0; S.refList = 0; }
    var cnt = 0;
    if (g.cum >= 0) {
      S.paidMode = 'table';
      var prev = 0; rows.forEach(function (r) { if (r.cum !== '' && r.cum > prev + 1e-9) { cnt++; prev = r.cum; } });
      S.payYears = Math.max(1, cnt);
    }
    if (g.cv >= 0) S.cvMode = 'table';
    Pa.pm = null; Pa.render(); IC.app.refresh();
    V.msg('已套用 ' + rows.length + ' 列' + (g.cum >= 0 ? '；實繳取自表格（已含折扣），繳費年期推得 ' + S.payYears + ' 年' : '') +
      (sum > 0 && list > 0 ? '' : '；未填保額／表定保費，無法等比例縮放'));
  };
})(window);
