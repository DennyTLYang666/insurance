/* 資料載入：優先 fetch .json；以 file:// 直接開啟被瀏覽器擋下時，改載入同名 .js（由 update_data.py 同步產生） */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const pending = {};

  // 同名 .js 檔會呼叫：WM_JSONP("data/weekly.json", {...})
  window.WM_JSONP = function (key, data) {
    const p = pending[key];
    if (p) { delete pending[key]; p.resolve(data); }
  };

  function viaScript(path) {
    return new Promise((resolve, reject) => {
      pending[path] = { resolve };
      const s = document.createElement("script");
      s.src = path.replace(/\.json$/, ".js");
      s.onload = () => { if (pending[path]) { delete pending[path]; reject(new Error("資料檔格式不符：" + s.src)); } s.remove(); };
      s.onerror = () => { delete pending[path]; s.remove(); reject(new Error("找不到資料檔：" + path)); };
      document.head.appendChild(s);
    });
  }

  /** path 以網站根目錄為基準的相對路徑，例如 "data/weekly.json" */
  function json(path) {
    return fetch(path, { cache: "no-cache" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .catch(() => viaScript(path));
  }

  WM.loader = { json };
})();
