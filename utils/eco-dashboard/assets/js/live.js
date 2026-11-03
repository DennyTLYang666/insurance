/* 即時更新：只有用 scripts/serve.py 在本機開啟時才會出現（偵測 /__wm/ping）。
   「立即更新」＝請伺服器重抓報價與價格並重建資料，再重畫頁面；可選自動更新（只在看最新一週時進行）。 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const $ = (id) => document.getElementById(id);
  let busy = false, timer = null;

  async function probe() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const r = await fetch("__wm/ping", { cache: "no-store" });
      return r.ok && !!(await r.json()).live;
    } catch (e) { return false; }
  }

  async function refresh(auto) {
    if (busy || (auto && (document.hidden || !WM.isLatest()))) return;
    busy = true;
    const btn = $("live-btn"), st = $("live-status");
    btn.disabled = true; btn.textContent = "更新中…";
    try {
      const r = await fetch("__wm/refresh", { method: "POST" });
      const j = await r.json();
      if (j.ok) await WM.reload();
      const t = new Date().toLocaleTimeString("zh-TW", { hour12: false, hour: "2-digit", minute: "2-digit" });
      st.textContent = (j.ok ? "已更新 " : "更新失敗 ") + t + (j.message && j.message !== "已更新" ? "：" + j.message : "");
      st.className = j.ok ? "muted" : "neg";
    } catch (e) {
      st.textContent = "更新失敗：伺服器沒有回應"; st.className = "neg";
    } finally {
      btn.disabled = false; btn.textContent = "立即更新"; busy = false;
    }
  }

  function setAuto(min) {
    if (timer) clearInterval(timer);
    timer = min > 0 ? setInterval(() => refresh(true), min * 60000) : null;
  }

  async function init() {
    if (!(await probe())) return;
    $("live-tools").hidden = false;
    $("live-btn").onclick = () => refresh(false);
    $("live-auto").onchange = (e) => setAuto(Number(e.target.value));
  }

  WM.live = { init };
})();
