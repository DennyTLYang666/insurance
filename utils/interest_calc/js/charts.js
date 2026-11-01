/* charts.js — 無相依的 SVG 折線圖。以 IC.charts 對外提供。 */
(function (root) {
  'use strict';
  var IC = root.IC = root.IC || {}, U = IC.util, Ch = IC.charts = {};

  /* series: [{name,color(css 變數名),dash,pts:[[x,y],…]}]；opt: {yFmt, zero, base, vlines:[{x,label}]} */
  Ch.line = function (host, series, opt) {
    /* 依容器實際寬度繪製（頁寬）；視窗縮放時由 view.js 重繪 */
    var W = Math.max(320, Math.floor(host.clientWidth || 720)), narrow = W < 560;
    var H = narrow ? 230 : 300, L = narrow ? 54 : 64, R = 14, T = 14, B = 30;
    var all = [];
    series.forEach(function (s) { s.pts.forEach(function (p) { if (p[1] != null && isFinite(p[1])) all.push(p); }); });
    if (!all.length) { host.innerHTML = '<div class="empty">尚無資料</div>'; return; }
    var xs = all.map(function (p) { return p[0]; }), ys = all.map(function (p) { return p[1]; });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs), ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    if (xmin === xmax) xmax = xmin + 1;
    if (opt.zero) { ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0); }
    if (ymin === ymax) ymax = ymin + 1;
    var raw = (ymax - ymin) / 5, pw = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / pw;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pw;
    ymin = Math.floor(ymin / step + 1e-9) * step; ymax = Math.ceil(ymax / step - 1e-9) * step;
    function X(x) { return L + (x - xmin) / (xmax - xmin) * (W - L - R); }
    function Y(y) { return T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B); }
    var g = '';
    for (var y = ymin; y <= ymax + step / 2; y += step) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(y) + '" y2="' + Y(y) + '" stroke="var(--line)"' +
        (Math.abs(y - (opt.base == null ? 0 : opt.base)) < step / 1e3 ? ' stroke-width="1.6"' : '') + '/>' +
        '<text x="' + (L - 6) + '" y="' + (Y(y) + 4) + '" text-anchor="end" font-size="11" fill="var(--muted)">' + opt.yFmt(y) + '</text>';
    }
    var xstep = Math.max(1, Math.ceil((xmax - xmin) / (narrow ? 8 : 16)));
    for (var x = xmin; x <= xmax; x += xstep)
      g += '<text x="' + X(x) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + x + '</text>';
    g += '<text x="' + (W - R) + '" y="' + H + '" text-anchor="end" font-size="10" fill="var(--muted)">保單年度</text>';
    (opt.vlines || []).forEach(function (v) {
      if (v.x >= xmin && v.x <= xmax)
        g += '<line x1="' + X(v.x) + '" x2="' + X(v.x) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--muted)" stroke-dasharray="4 3"/>' +
          '<text x="' + (X(v.x) + 4) + '" y="' + (T + 10) + '" font-size="10" fill="var(--muted)">' + v.label + '</text>';
    });
    series.forEach(function (s) {
      var d = '', pen = false, c = '';
      s.pts.forEach(function (p) {
        if (p[1] == null || !isFinite(p[1])) { pen = false; return; }
        d += (pen ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); pen = true;
        c += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="2.4" fill="var(' + s.color + ')"><title>' +
          U.esc(s.name) + ' 第' + p[0] + '年：' + opt.yFmt(p[1]) + '</title></circle>';
      });
      g += '<path d="' + d + '" fill="none" stroke="var(' + s.color + ')" stroke-width="2"' + (s.dash ? ' stroke-dasharray="5 3"' : '') + '/>' + c;
    });
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg>';
  };
  Ch.legend = function (el, items) {
    el.innerHTML = items.map(function (i) { return '<span><i style="background:var(' + i[1] + ')"></i>' + i[0] + '</span>'; }).join('');
  };
})(window);
