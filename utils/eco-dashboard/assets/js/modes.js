/* 精簡／完整模式、區塊展開與跳轉、列印時全部展開。
   精簡＝只看概觀，細節區塊收合；完整＝全部展開。偏好存在 localStorage（不可用時略過），網址 ?mode=compact|full 可覆寫。 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const KEY = "wm-mode";
  const secs = () => [...document.querySelectorAll("details.sec")];
  let printOpen = null;

  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (m) => { try { localStorage.setItem(KEY, m); } catch (e) { /* 忽略 */ } };

  function apply(mode, persist) {
    document.body.dataset.mode = mode;
    document.getElementById("mode-compact").setAttribute("aria-pressed", String(mode === "compact"));
    document.getElementById("mode-full").setAttribute("aria-pressed", String(mode === "full"));
    secs().forEach((d) => (d.open = mode === "full"));
    if (persist) save(mode);
    WM.charts.flush();
  }

  /** 開啟並捲到某個區塊（概觀 id 為 s-overview） */
  function goTo(id) {
    const el = document.getElementById(id);
    if (!el || el.hidden) return;
    if (el.tagName === "DETAILS") { el.open = true; WM.charts.flush(); }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function init() {
    const want = new URLSearchParams(location.search).get("mode");
    const saved = read();
    const mode = want === "compact" || want === "full" ? want : saved === "compact" || saved === "full" ? saved :
      (window.matchMedia && window.matchMedia("(max-width: 720px)").matches ? "compact" : "full");
    apply(mode, false);
    document.getElementById("mode-compact").onclick = () => apply("compact", true);
    document.getElementById("mode-full").onclick = () => apply("full", true);
    document.addEventListener("toggle", (e) => { if (e.target.matches && e.target.matches("details.sec")) WM.charts.flush(); }, true);

    // 全站的跳轉按鈕：data-go＝區塊 id；data-q＝報價 id；data-day＝日曆日期
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-go],[data-q].kpi");
      if (!b || !WM.state || !WM.state.data) return;
      if (b.classList.contains("kpi")) { WM.sections.drawQuote(WM.state.data, b.dataset.q); goTo("s-quotes"); return; }
      if (b.dataset.day) WM.calendar.focusDay(b.dataset.day);
      goTo(b.dataset.go);
    });

    // 列印：暫時全部展開
    window.addEventListener("beforeprint", () => { printOpen = secs().map((d) => d.open); secs().forEach((d) => (d.open = true)); WM.charts.flush(); });
    window.addEventListener("afterprint", () => { if (printOpen) secs().forEach((d, i) => (d.open = printOpen[i])); printOpen = null; });
  }

  WM.modes = { init, goTo };
})();
