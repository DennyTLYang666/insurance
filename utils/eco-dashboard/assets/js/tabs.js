/* 捲軸式分頁列：點擊跳轉（收合的區塊會先展開）、下捲時同步高亮目前區塊 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});

  WM.initTabs = function () {
    const bar = document.getElementById("tabbar");
    const tabs = [...bar.querySelectorAll(".tab")];
    const secs = tabs.map((t) => document.querySelector(t.getAttribute("href")));
    let current = null, ticking = false;

    function setActive(i) {
      if (i === current) return;
      current = i;
      tabs.forEach((t, k) => (k === i ? t.setAttribute("aria-current", "true") : t.removeAttribute("aria-current")));
      const t = tabs[i];
      if (t) bar.scrollTo({ left: t.offsetLeft - (bar.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });  // 只捲分頁列本身
    }
    function spy() {
      ticking = false;
      const line = bar.parentElement.offsetHeight + 24;
      let idx = 0;
      secs.forEach((s, k) => { if (s && !s.hidden && s.getBoundingClientRect().top <= line) idx = k; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        for (let k = secs.length - 1; k >= 0; k--) if (secs[k] && !secs[k].hidden) { idx = k; break; }
      }
      setActive(idx);
    }
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    window.addEventListener("resize", spy);
    tabs.forEach((t, k) => t.addEventListener("click", (e) => {
      e.preventDefault();
      setActive(k);
      WM.modes.goTo(t.getAttribute("href").slice(1));
    }));
    spy();
  };
})();
