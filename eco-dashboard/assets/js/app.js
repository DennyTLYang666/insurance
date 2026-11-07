/* 主程式：載入資料、大分頁＋小分頁（#頁/小頁）、深色模式、狀態列、自動重新整理。 */
(function () {
  const F = ECO.fmt, esc = F.esc, $ = (id) => document.getElementById(id);
  const NAMES = ["meta", "overview", "trends", "macro", "lights", "calendar"];
  const PAGES = { overview: ["all", "stocks", "fx", "rates", "cmd", "funds"], news: ["all"], cal: ["all"], table: ["all"], trends: ["stocks", "fx", "rates", "risk", "cmd", "macro"], funds: ["nanshan", "tlife", "common"] };
  const RANGE_SUBS = { trends: ["stocks", "fx", "rates", "risk", "cmd"], funds: [] };
  let data = null, genKey = null, cur = { tab: "overview", sub: "all" };

  async function loadAll() {
    const parts = await Promise.all(NAMES.map((n) => ECO.load("data/site/" + n + ".json")));
    const d = {};
    NAMES.forEach((n, i) => (d[n] = parts[i]));
    /* 新聞與基金是選配：抓不到就當作沒有，不影響其他頁 */
    const opt = (n) => ECO.load("data/site/" + n + ".json").catch(() => null);
    const more = await Promise.all([opt("news"), opt("funds"), opt("newsfeed"), opt("rates")]);
    d.news = more[0];
    d.funds = more[1];
    d.newsfeed = more[2];
    d.rates = more[3];
    return d;
  }

  function rel(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return "剛剛";
    if (m < 60) return m + " 分鐘前";
    if (m < 48 * 60) return Math.round(m / 60) + " 小時前";
    return Math.round(m / 1440) + " 天前";
  }

  function status() {
    if (!data) return;
    const meta = data.meta, gen = new Date(meta.generated_at), age = Date.now() - gen.getTime();
    const el = $("status");
    const probs = meta.problems || [];
    const old = age > 36 * 3600 * 1000;
    el.className = "status " + (old ? "old" : probs.length ? "warn" : "ok");
    const when = F.tpe(gen, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const d = data.overview.dates || {};
    let html = "<b>資料更新於 " + when + "（台灣時間，" + rel(age) + "）</b>";
    if (d.us || d.tw) html += '<span class="sep">・</span>' + (d.us ? "美股 " + F.md(d.us) + " 收" : "") + (d.us && d.tw ? "、" : "") + (d.tw ? "台股 " + F.md(d.tw) + " 收" : "");
    if (old) html += '<span class="sep">・</span>資料已超過 1 天沒有更新';
    if (probs.length) html += '<details><summary>' + probs.length + " 項資料來源暫時失敗（已沿用舊資料）</summary><ul>" + probs.map((p) => "<li>" + esc(p) + "</li>").join("") + "</ul></details>";
    el.innerHTML = html;
  }

  function render(d) {
    data = d;
    genKey = d.meta.generated_at;
    ECO.news.set(d.news);
    ECO.renderOverview(d.overview);
    ECO.renderTrends(d);
    ECO.funds.render(d.funds);
    ECO.newsfeed.render(d.newsfeed);
    ECO.rates.render(d.rates);
    status();
    apply();
  }

  /* ---------- 分頁 ---------- */
  function parse(hash) {
    const p = hash.replace(/^#/, "").split("/");
    const tab = PAGES[p[0]] ? p[0] : "overview";
    const sub = PAGES[tab].includes(p[1]) ? p[1] : PAGES[tab][0];
    return { tab: tab, sub: sub };
  }

  function apply() {
    const tab = cur.tab, sub = cur.sub;
    Object.keys(PAGES).forEach((t) => {
      $("page-" + t).hidden = t !== tab;
      const bar = $("sub-" + t);
      bar.querySelectorAll("a").forEach((a) => a.classList.toggle("on", t === tab && a.dataset.sub === sub));
    });
    document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
    document.querySelectorAll("#page-" + tab + " .sub-panel").forEach((p) => (p.hidden = p.dataset.sub !== sub));
    $("range-bar").hidden = !(RANGE_SUBS[tab] || []).includes(sub);
    if (tab === "overview") ECO.overviewSub(sub);
    if (tab === "funds") ECO.funds.show(sub);
    document.querySelectorAll("[data-days]").forEach((b) => b.classList.toggle("on", +b.dataset.days === ECO.charts.days()));
    requestAnimationFrame(() => ECO.charts.resize());
  }

  function route() {
    const next = parse(location.hash);
    const moved = next.tab !== cur.tab || next.sub !== cur.sub;
    cur = next;
    apply();
    if (moved) window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ---------- 從彈窗跳到某張趨勢圖 ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-go]");
    if (!a) return;
    e.preventDefault();
    ECO.dialog.close();
    const go = () => {
      const el = document.getElementById("chart-" + a.dataset.chart);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 2000); }
    };
    if (location.hash === a.dataset.go) go(); else { location.hash = a.dataset.go; setTimeout(go, 400); }
  });

  /* ---------- 主題與區間 ---------- */
  $("theme").addEventListener("click", () => {
    const now = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = now === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("eco.theme", next); } catch (e) {}
    ECO.charts.refresh();
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-days]");
    if (b) ECO.charts.setRange(+b.dataset.days);
  });

  /* ---------- 啟動與自動更新 ---------- */
  async function boot() {
    cur = parse(location.hash);
    try {
      render(await loadAll());
      $("fatal").hidden = true;
    } catch (e) {
      const f = $("fatal");
      f.hidden = false;
      f.innerHTML = "<b>資料載入失敗。</b>" + esc(e.message) + "<br>如果是直接雙擊 index.html 開啟，請先執行一次 <code>python -m pipeline.run --offline</code> 產生資料檔。";
      $("status").textContent = "尚無資料";
    }
  }

  async function poll() {
    if (document.hidden || !data) return;
    try {
      const meta = await ECO.load("data/site/meta.json");
      if (meta.generated_at !== genKey) render(await loadAll());
      else status();
    } catch (e) { /* 網路暫時不通就維持現狀 */ }
  }
  setInterval(poll, 5 * 60 * 1000);
  setInterval(status, 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });

  boot();
})();
