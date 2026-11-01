/* products.js — 商品範本：載入 products/*.json、我的範本、套用／另存／匯出／匯入。以 IC.products 對外提供。
 * 載入順序：
 *   1) 以 http(s) 開啟（python serve.py）：讀 products/index.json，再逐一讀 JSON（放進資料夾重新整理即可）。
 *   2) 雙擊 index.html（file://）：瀏覽器不允許讀本機 JSON，改用 products/bundle.js（由 build_bundle.py 產生）。
 *   3) 另外隨時可用「匯入商品資料」一次選多個 JSON。 */
(function (root) {
  'use strict';
  var IC = root.IC = root.IC || {}, U = IC.util, D = IC.def, num = U.num, $ = U.$;
  var P = IC.products = { files: [], source: '' };

  /* 各種格式 → [{name,state}]：單一商品檔、{products:[…]}、或直接是 state */
  P.normalize = function (obj) {
    if (!obj || typeof obj !== 'object') return [];
    if (Array.isArray(obj.products)) return obj.products.filter(function (p) { return p && p.state; })
      .map(function (p) { return { name: p.name || p.state.productName || '未命名商品', state: p.state }; });
    if (obj.state && typeof obj.state === 'object') return [{ name: obj.name || obj.state.productName || '未命名商品', state: obj.state }];
    if (obj.productName || obj.rows || obj.discounts) return [{ name: obj.productName || '未命名商品', state: obj }];
    return [];
  };

  function finish(items, source, done) {
    P.files = []; P.source = source;
    items.forEach(function (it) {
      P.normalize(it.data).forEach(function (p) { P.files.push({ id: 'f:' + it.file + '#' + p.name, name: p.name, state: p.state, file: it.file }); });
    });
    done();
  }
  P.load = function (done) {
    function fromBundle() { var b = root.IC_PRODUCT_BUNDLE; return b ? b.map(function (x) { return { file: x.file, data: x.data }; }) : null; }
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      fetch('products/index.json', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('no index'); return r.json(); })
        .then(function (list) {
          return Promise.all(list.map(function (fn) {
            return fetch('products/' + encodeURIComponent(fn), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { return { file: fn, data: d }; });
          }));
        })
        .then(function (items) { finish(items, 'http：products/index.json', done); })
        .catch(function () { var b = fromBundle(); finish(b || [], b ? 'bundle.js' : '', done); });
    } else {
      var b = fromBundle();
      finish(b || [], b ? 'bundle.js（file://）' : '', done);
    }
  };

  P.get = function (id) {
    var i;
    if (id.indexOf('f:') === 0) { for (i = 0; i < P.files.length; i++) if (P.files[i].id === id) return P.files[i]; return null; }
    if (id.indexOf('u:') === 0) { var n = id.slice(2), u = IC.store.userProducts(); return u[n] ? { name: n, state: u[n] } : null; }
    return null;
  };
  P.renderSelect = function (selId) {
    var u = IC.store.userProducts(), un = Object.keys(u).sort();
    $('#prodList').innerHTML = '<option value="">（選擇商品範本…）</option>' +
      (P.files.length ? '<optgroup label="範例商品（products/ 資料夾）">' + P.files.map(function (b) { return '<option value="' + U.esc(b.id) + '">' + U.esc(b.name) + '</option>'; }).join('') + '</optgroup>' : '') +
      (un.length ? '<optgroup label="我的範本（此瀏覽器）">' + un.map(function (n) { return '<option value="u:' + U.esc(n) + '">' + U.esc(n) + '</option>'; }).join('') + '</optgroup>' : '');
    if (selId) $('#prodList').value = selId;
  };

  /* 套用範本：保留使用者目前的金額／繳別／里程碑；範本沒有縮放基準時，帶入目前的有效保費 */
  P.apply = function (st) {
    var S = IC.st.S, e0 = IC.calc.eff(S);
    var keep = {
      sumInsured: S.sumInsured, premium: S.premium, paidInput: S.paidInput, inputBy: S.inputBy, mode: S.mode,
      targets: S.targets, showBase: S.showBase, keyOnly: S.keyOnly, tableMode: S.tableMode, hideInputs: S.hideInputs, name: S.name
    };
    var n = D.merge(st);
    Object.keys(keep).forEach(function (k) { n[k] = keep[k]; });
    var hasRef = num(n.refSum) > 0 && num(n.refList) > 0;
    if (!hasRef) { n.inputBy = 'list'; n.premium = Math.round(e0.prem) || num(n.premium); n.sumInsured = Math.round(e0.sum) || n.sumInsured; }
    else if (!(num(n.sumInsured) > 0) && !(num(n.premium) > 0) && !(num(n.paidInput) > 0)) { n.sumInsured = n.refSum; n.inputBy = 'sum'; }
    if (!n.name) n.name = n.productName;
    IC.app.setState(n);
  };

  var PKEYS = ['productName', 'dm', 'ccy', 'payYears', 'stack', 'discCap', 'discounts', 'mf', 'refSum', 'refList', 'minSum', 'maxSum', 'refAge', 'ageNote', 'extra', 'bene', 'rate'];
  /* 目前內容 → 商品資料（不含客戶的年齡／金額）。失敗回傳 {error} */
  P.toProduct = function (S) {
    if (!(S.productName || '').trim()) return { error: '請先在「① 商品資料」填商品名稱' };
    var rate = S.cvMode === 'rate';
    if (!rate && !(num(S.refSum) > 0 && num(S.refList) > 0))
      return { error: '請先填「表格數值對應的保額」與「對應的表定年繳保費（折扣前）」，範本才能等比例縮放' };
    var o = {};
    PKEYS.forEach(function (k) { o[k] = U.clone(S[k]); });
    o.age1 = num(S.refAge) > 0 ? S.refAge : S.age1; o.refAge = rate ? 0 : o.age1;
    o.paidMode = 'calc'; o.cvMode = S.cvMode;
    o.rows = S.rows.map(function (r) {
      var x = { y: r.y, cv: r.cv, x: r.x.slice() };
      if (r.pay !== '' && r.pay != null && num(r.pay) > 0) x.pay = r.pay;
      return x;
    });
    return { product: { schema: D.SCHEMA_PRODUCT, name: S.productName.trim(), state: o } };
  };
  P.saveUser = function (S) {
    var r = P.toProduct(S); if (r.error) return r;
    var u = IC.store.userProducts(); u[r.product.name] = r.product.state;
    if (!IC.store.saveUserProducts(u)) return { error: '瀏覽器不允許儲存，請改用「匯出商品資料」' };
    P.renderSelect('u:' + r.product.name);
    return { ok: r.product.name };
  };
  P.deleteUser = function (id) {
    if (id.indexOf('u:') !== 0) return { error: '請先在下拉選單選一個「我的範本」再刪除（範例商品是檔案，要刪請到 products/ 資料夾）' };
    var n = id.slice(2), u = IC.store.userProducts();
    if (!confirm('確定刪除我的範本「' + n + '」？')) return {};
    delete u[n]; IC.store.saveUserProducts(u); P.renderSelect(); return { ok: n };
  };
  P.exportFile = function (S) {
    var r = P.toProduct(S); if (r.error) return r;
    U.download(U.fname(r.product.name) + '.json', JSON.stringify(r.product, null, 1), 'application/json');
    return { ok: r.product.name };
  };
  /* 一次匯入多個 JSON 檔 → 我的範本 */
  P.importFiles = function (fileList, done) {
    var files = Array.prototype.slice.call(fileList), pending = files.length, cnt = 0, last = '', u = IC.store.userProducts();
    if (!pending) return done(0, '');
    files.forEach(function (f) {
      var rd = new FileReader();
      rd.onload = function () {
        try { P.normalize(JSON.parse(rd.result)).forEach(function (p) { u[p.name] = p.state; cnt++; last = p.name; }); } catch (e) { /* 略過無效檔案 */ }
        if (--pending === 0) { IC.store.saveUserProducts(u); P.renderSelect(last ? 'u:' + last : ''); done(cnt, last); }
      };
      rd.readAsText(f);
    });
  };
})(window);
