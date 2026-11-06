/* 載入 JSON：先用 fetch；雙擊 index.html（file://）時 fetch 會被擋，改載入同名 .js 備援檔。 */
window.ECO = window.ECO || {};
(function () {
  const waiting = {};
  window.ECO_JSONP = function (key, obj) {
    if (waiting[key]) { waiting[key](obj); delete waiting[key]; }
  };
  ECO.load = async function (path) {
    try {
      const r = await fetch(path + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      return new Promise(function (resolve, reject) {
        waiting[path] = resolve;
        const s = document.createElement("script");
        s.src = path.replace(/\.json$/, ".js") + "?t=" + Date.now();
        s.onerror = function () { delete waiting[path]; reject(new Error("載入失敗：" + path)); };
        document.head.appendChild(s);
      });
    }
  };
})();
