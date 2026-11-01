/* util.js — 通用小工具（無相依）。以 IC.util 對外提供。 */
(function (root) {
  'use strict';
  var IC = root.IC = root.IC || {};
  var U = IC.util = {};

  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  U.esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.num = function (x) { var n = parseFloat(x); return isFinite(n) ? n : 0; };
  /* 顯示一律「無條件捨去」（朝 0 捨去到指定小數位）。先把浮點雜訊（如 31.999999999）抹掉再捨去。
   * 只用於呈現；計算本身不受影響。 */
  U.tr = function (x, d) {
    var f = Math.pow(10, d || 0), v = Math.round(x * f * 1e6) / 1e6, t = Math.trunc(v) / f;
    return t === 0 ? 0 : t;
  };
  U.trs = function (x, d) { return U.tr(x, d).toFixed(d); };          // 捨去後固定小數位，例 3.00
  U.trn = function (x, d) { return String(U.tr(x, d)); };             // 捨去後去掉多餘的 0，例 3
  U.fmt = function (x) {
    if (x == null || !isFinite(x)) return '—';
    var r = U.tr(x, 0);
    return (r < 0 ? '−' : '') + Math.abs(r).toLocaleString('en-US');
  };
  U.pct = function (x, d) {
    if (x == null || !isFinite(x)) return '—';
    d = d == null ? 1 : d;
    var v = U.tr(x * 100, d);
    return (v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + '%';
  };
  U.mulf = function (x) { return x == null || !isFinite(x) ? '—' : U.tr(x, 2).toFixed(2) + '×'; };
  U.cls = function (x) { return x == null ? '' : (x < -1e-9 ? 'neg' : (x > 1e-9 ? 'pos' : '')); };
  U.getPath = function (o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
  U.setPath = function (o, p, v) {
    var a = p.split('.');
    for (var i = 0; i < a.length - 1; i++) o = o[a[i]];
    o[a[a.length - 1]] = v;
  };
  U.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  U.fname = function (s, d) { return (s || d || '試算').replace(/[\\/:*?"<>|]/g, '_'); };
  U.shortName = function (n) { return String(n || '').split(/[：（(]/)[0]; };
  U.download = function (name, text, mime) {
    var b = new Blob([text], { type: mime }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IC;
})(typeof window !== 'undefined' ? window : globalThis);
