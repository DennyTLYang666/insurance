/* 載入 JSON：先用 fetch；雙擊 index.html（file://）時 fetch 會被擋，改載入同名 .js 備援檔。
   資料放在別的站（eco-data）：基底網址取自網址的 ?data=，沒有就用 assets/config.js 的 dataBase。 */
window.ECO = window.ECO || {};
(function () {
  const waiting = {};
  function dataBase() {
    let b = "";
    try { b = new URLSearchParams(location.search).get("data") || ""; } catch (e) {}
    b = b || (window.ECO_CONFIG && window.ECO_CONFIG.dataBase) || "";
    return b && !b.endsWith("/") ? b + "/" : b;
  }
  ECO.dataBase = dataBase();
  window.ECO_JSONP = function (key, obj) {
    if (waiting[key]) { waiting[key](obj); delete waiting[key]; }
  };
  ECO.load = async function (path) {
    const url = ECO.dataBase + path;  // path 仍是 data/site/xxx.json，備援 .js 以它當索引鍵
    try {
      const r = await fetch(url + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      return new Promise(function (resolve, reject) {
        waiting[path] = resolve;
        const s = document.createElement("script");
        s.src = url.replace(/\.json$/, ".js") + "?t=" + Date.now();
        s.onerror = function () { delete waiting[path]; reject(new Error("載入失敗：" + path)); };
        document.head.appendChild(s);
      });
    }
  };
})();
