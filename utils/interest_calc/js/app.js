/* app.js — 狀態持有、事件綁定、啟動。最後載入。 */
(function (root) {
  'use strict';
  var IC = root.IC, U = IC.util, D = IC.def, V = IC.view, P = IC.products, Pa = IC.paste, St = IC.store;
  var $ = U.$, $$ = U.$$, num = U.num, clone = U.clone;
  var DEFAULT_PRODUCT_FILE = 'meili33-3y-44f.json';
  IC.st = { S: null };
  var A = IC.app = {};

  A.setState = function (n) { IC.st.S = n; Pa.pm = null; Pa.render(); V.syncInputs(); V.render(); };
  A.refresh = function () { V.syncInputs(); V.render(); };

  function refreshScList() {
    var sc = St.scenarios(), names = Object.keys(sc).sort();
    $('#scList').innerHTML = names.length ? names.map(function (n) { return '<option>' + U.esc(n) + '</option>'; }).join('') : '<option value="">（無）</option>';
  }

  /* ---------- 輸入 ---------- */
  var DRIVER = { sumInsured: 'sum', premium: 'list', paidInput: 'paid' };
  function onChange(e) {
    var S = IC.st.S, el = e.target;
    if (el.id === 'prodList') {
      if (e.type === 'change' && el.value) { var p = P.get(el.value); if (p) { P.apply(p.state); V.msg('已套用商品範本：' + p.name); } }
      return;
    }
    if (el.dataset.k) {
      var v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number' || el.dataset.num) v = el.value === '' ? 0 : parseFloat(el.value);
      else v = el.value;
      if (typeof v === 'number' && !isFinite(v)) v = 0;
      U.setPath(S, el.dataset.k, v);
      if (DRIVER[el.dataset.k]) S.inputBy = DRIVER[el.dataset.k];
      if (el.dataset.k === 'paidMode' && e.type === 'change') V.renderPlanGrid();
      V.render(); return;
    }
    if (el.dataset.extra !== undefined) { S.extra[+el.dataset.extra] = el.value; V.renderBene(); V.render(); return; }
    if (el.dataset.list) {
      var item = S[el.dataset.list][+el.dataset.i], f = el.dataset.f, val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') val = el.value === '' ? (el.dataset.list === 'rows' ? '' : 0) : parseFloat(el.value);
      else val = el.value;
      if (el.dataset.t !== undefined) item.tiers[+el.dataset.t][f] = num(val);
      else if (el.dataset.xi !== undefined) item.x[+el.dataset.xi] = val;
      else item[f] = val;
      if (el.dataset.list === 'discounts' && e.type === 'change') {
        if (f === 'type' && val === 'tier' && !(item.tiers || []).length) item.tiers = [{ min: 0, max: 0, value: 0 }];
        if (f === 'on' || f === 'type') V.renderDiscounts();
      }
      V.render();
    }
  }
  document.addEventListener('input', onChange);
  document.addEventListener('change', onChange);

  document.addEventListener('click', function (e) {
    var S = IC.st.S, b = e.target.closest('button'); if (!b) return;
    if (b.id === 'btnApplyMap') { Pa.apply(); return; }
    if (b.dataset.chip) {
      var v = +b.dataset.v, key = { list: 'premium', paid: 'paidInput', sum: 'sumInsured' }[b.dataset.chip];
      S[key] = v; S.inputBy = b.dataset.chip; $('[data-k="' + key + '"]').value = v; V.render(); return;
    }
    if (b.dataset.add === 'disc') { S.discounts.push(D.PRESETS[b.dataset.preset]()); V.renderDiscounts(); V.render(); return; }
    if (b.dataset.tadd !== undefined) { S.discounts[+b.dataset.tadd].tiers.push({ min: 0, max: 0, value: 0 }); V.renderDiscounts(); V.render(); return; }
    if (b.dataset.tdel) { var ij = b.dataset.tdel.split(':'); S.discounts[+ij[0]].tiers.splice(+ij[1], 1); V.renderDiscounts(); V.render(); return; }
    if (b.dataset.delx !== undefined) { var i = +b.dataset.delx; S.extra.splice(i, 1); S.rows.forEach(function (r) { r.x.splice(i, 1); }); S.bene = 0; V.renderPlanGrid(); V.render(); return; }
    if (b.dataset.del) {
      S[b.dataset.del].splice(+b.dataset.i, 1);
      ({ discounts: V.renderDiscounts, rows: V.renderPlanGrid, targets: V.renderTargets })[b.dataset.del](); V.render();
    }
  });

  /* ---------- 逐年表 ---------- */
  $('#btnAddYear').onclick = function () {
    var S = IC.st.S, mx = S.rows.reduce(function (a, r) { return Math.max(a, +r.y || 0); }, 0), last = S.rows[S.rows.length - 1];
    S.rows.push({ y: mx + 1, cum: last ? last.cum : '', cv: '', x: S.extra.map(function () { return ''; }), pay: '' });
    V.renderPlanGrid(); V.render();
    var inp = $$('#planGrid input[data-f="cv"]'); if (inp.length) inp[inp.length - 1].focus();
  };
  $('#btnAddCol').onclick = function () { var S = IC.st.S; S.extra.push('新欄位'); S.rows.forEach(function (r) { r.x.push(''); }); V.renderPlanGrid(); V.render(); };
  $('#btnClearCv').onclick = function () { IC.st.S.rows = []; V.renderPlanGrid(); V.render(); };
  $('#btnParse').onclick = function () {
    if (Pa.parse($('#pasteBox').value)) V.msg('已解析，請確認欄位對應與保額／保費後按「套用」');
    else V.msg('貼上內容無法辨識（資料列須以年度數字開頭）', true);
  };
  $('#btnAddTgt').onclick = function () { IC.st.S.targets.push({ label: '新里程碑', kind: 'mult', value: 2 }); V.renderTargets(); V.render(); };
  $('#btnResetTgt').onclick = function () { IC.st.S.targets = D.targets(); V.renderTargets(); V.render(); };
  /* 隱藏輸入區：從「情境名稱」那一列起整段隱藏，改顯示簡易調參列（年齡／保額） */
  function toggleInputs() { var S = IC.st.S; S.hideInputs = !S.hideInputs; V.applyHide(); V.drawCharts(); St.persistLast(S); }
  $('#btnHide').onclick = toggleInputs;
  $('#btnShow').onclick = toggleInputs;
  /* 視窗大小改變 → 圖表依新的頁寬重繪 */
  var resizeTimer = null;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { V.drawCharts(); V.syncMiniHeight(); }, 150); });

  /* ---------- 情境（一次試算的全部內容） ---------- */
  $('#btnSave').onclick = function () {
    var S = IC.st.S, n = (S.name || '').trim(); if (!n) { V.msg('請先輸入「情境名稱」', true); return; }
    var sc = St.scenarios(); sc[n] = clone(S);
    if (St.saveScenarios(sc)) { refreshScList(); $('#scList').value = n; V.msg('已儲存情境「' + n + '」'); }
    else V.msg('瀏覽器不允許儲存（可能是隱私模式），請改用「匯出情境 JSON」', true);
  };
  $('#btnLoad').onclick = function () {
    var n = $('#scList').value, sc = St.scenarios();
    if (!n || !sc[n]) { V.msg('沒有可載入的情境', true); return; }
    A.setState(D.merge(sc[n])); V.msg('已載入情境「' + n + '」');
  };
  $('#btnDel').onclick = function () {
    var n = $('#scList').value, sc = St.scenarios(); if (!n || !sc[n]) return;
    if (!confirm('確定刪除情境「' + n + '」？')) return;
    delete sc[n]; St.saveScenarios(sc); refreshScList(); V.msg('已刪除情境「' + n + '」');
  };
  $('#btnExport').onclick = function () {
    var S = IC.st.S;
    U.download(U.fname(S.name) + '.scenario.json', JSON.stringify({ app: 'twlife_interest_calc', v: 4, state: S }, null, 1), 'application/json');
  };
  $('#btnImport').onclick = function () { $('#fileImport').click(); };
  $('#fileImport').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try { var o = JSON.parse(rd.result); A.setState(D.merge(o.state || o)); V.msg('已匯入「' + f.name + '」'); }
      catch (err) { V.msg('匯入失敗：不是有效的 JSON', true); }
    };
    rd.readAsText(f); e.target.value = '';
  };
  $('#btnLink').onclick = function () {
    var code = btoa(unescape(encodeURIComponent(JSON.stringify(IC.st.S)))), url = location.href.split('#')[0] + '#d=' + code;
    function done() { V.msg('分享連結已複製（' + url.length + ' 字元）。注意：連結內含你輸入的所有數據。'); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('請複製：', url); });
    else prompt('請複製：', url);
  };
  $('#btnBlank').onclick = function () { if (!confirm('清空目前內容？')) return; A.setState(D.blank()); P.renderSelect(); };

  /* ---------- 商品範本 ---------- */
  $('#btnProdSave').onclick = function () {
    var r = P.saveUser(IC.st.S);
    if (r.error) V.msg(r.error, true); else V.msg('已另存商品範本「' + r.ok + '」（實繳改由公式計算，請確認折扣規則）。要放進 products/ 資料夾請用「匯出商品資料」。');
  };
  $('#btnProdDel').onclick = function () { var r = P.deleteUser($('#prodList').value); if (r.error) V.msg(r.error, true); else if (r.ok) V.msg('已刪除範本「' + r.ok + '」'); };
  $('#btnProdExport').onclick = function () {
    var r = P.exportFile(IC.st.S);
    if (r.error) V.msg(r.error, true); else V.msg('已匯出商品資料「' + r.ok + '」。放進 products/ 資料夾後，用 serve.py 開啟重新整理即可出現；雙擊開啟請再執行 build_bundle.py。');
  };
  $('#btnProdImport').onclick = function () { $('#fileProd').click(); };
  $('#fileProd').onchange = function (e) {
    var files = e.target.files; if (!files.length) return;
    P.importFiles(files, function (cnt) {
      if (cnt) V.msg('已匯入 ' + cnt + ' 個商品範本（在下拉選單的「我的範本」）'); else V.msg('匯入失敗：沒有找到有效的商品資料 JSON', true);
    });
    e.target.value = '';
  };

  /* ---------- 匯出／列印 ---------- */
  $('#btnCsv').onclick = function () {
    var S = IC.st.S, res = V.last;
    var h = ['年度', '年齡', '當年實繳', '累計實繳'].concat(S.extra, ['保價金', '當年領回', '損益', '總報酬率%', '倍數', '單利年化%', '複利年化IRR%', '無折扣總報酬率%', '無折扣IRR%', '折扣加成pp']);
    var L = [h.join(',')];
    (res ? res.rows : []).forEach(function (r) {
      function p(x) { return x == null ? '' : (x * 100).toFixed(3); }
      L.push([r.t, r.age == null ? '' : r.age, r.cur.toFixed(2), r.cum.toFixed(2)].concat(r.ex.map(function (v) { return v == null ? '' : v.toFixed(2); }),
        [r.cv.toFixed(2), r.pay > 0 ? r.pay.toFixed(2) : '', r.gain.toFixed(2), p(r.ret), r.mult.toFixed(4), p(r.simple), p(r.irr), p(r.ret0), p(r.irr0), p(r.gap)]).join(','));
    });
    U.download(U.fname(S.name) + '.csv', '﻿' + L.join('\r\n'), 'text/csv;charset=utf-8');
  };
  $('#btnPrint').onclick = function () { window.print(); };

  /* ---------- 啟動 ---------- */
  A.init = function () {
    var S = D.blank(), loaded = false;
    if (location.hash.indexOf('#d=') === 0) {
      try { S = D.merge(JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(3)))))); loaded = true; } catch (e) { /* 忽略壞連結 */ }
    }
    if (!loaded) { var last = St.last(); if (last) { S = D.merge(last); loaded = true; } }
    IC.st.S = S; refreshScList(); V.renderChips(); V.syncInputs(); V.render();
    P.load(function () {
      P.renderSelect();
      if (!loaded && P.files.length) {
        var d = P.files.filter(function (f) { return f.file === DEFAULT_PRODUCT_FILE; })[0] || P.files[0];
        P.apply(d.state); V.msg('已載入預設範例：' + d.name);
      } else if (!P.files.length) {
        V.msg(location.protocol === 'file:' ? '找不到範例商品：請確認 products/bundle.js 存在（執行 build_bundle.py 產生），或用「匯入商品資料」選取 products/ 內的 JSON。' : '找不到範例商品：請確認 products/index.json。', true);
      }
    });
  };
  A.init();
})(window);
