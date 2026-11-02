/* 進入點：載入資料、歷史週次切換、深淺色切換時重畫圖表 */
(function () {
  "use strict";
  const WM = window.WM;
  const $ = (id) => document.getElementById(id);
  const LATEST = "data/weekly.json";
  let index = null;   // data/history/index.json（沒有歷史時為 null）

  const pathFor = (cutoff) => (!index || cutoff === index.latest ? LATEST : "data/history/weekly-" + cutoff + ".json");

  function showError(msg) {
    const box = $("load-error");
    box.hidden = false;
    box.textContent = msg;
  }

  function syncUrl(cutoff) {
    try {  // 讓網址可分享特定週次；某些環境（如 file://）不允許時略過
      const u = new URL(location.href);
      if (!index || cutoff === index.latest) u.searchParams.delete("week"); else u.searchParams.set("week", cutoff);
      history.replaceState(null, "", u);
    } catch (e) { /* 忽略 */ }
  }

  function updateHistoryUi(data, cutoff) {
    const old = index && cutoff !== index.latest;
    const banner = $("history-banner");
    banner.hidden = !old;
    if (old) banner.textContent = `目前顯示的是歷史資料（資料截止日 ${data.meta.data_cutoff}，當時更新於 ${WM.fmt.dateTime(data.meta.updated_at)}），不是最新一週。`;
    if (index) { $("history-select").value = cutoff; $("history-latest").disabled = !old; }
  }

  async function show(cutoff) {
    $("load-error").hidden = true;
    try {
      const data = await WM.loader.json(pathFor(cutoff));
      WM.sections.renderAll(data);
      updateHistoryUi(data, cutoff);
      syncUrl(cutoff);
      document.title = "每週市場總覽 " + data.meta.data_cutoff;
    } catch (err) {
      showError(`無法讀取 ${pathFor(cutoff)}（${err.message}）。請確認已執行 scripts/update_data.py 產生資料。`);
    }
  }

  function initHistory() {
    const weeks = (index && index.weeks) || [];
    $("history-bar").hidden = weeks.length < 2;  // 只有一週時不顯示切換
    $("history-select").innerHTML = weeks.map((w) =>
      `<option value="${WM.fmt.esc(w.cutoff)}" title="${WM.fmt.esc(w.summary || "")}">${WM.fmt.esc(w.cutoff)}${w.cutoff === index.latest ? "（最新）" : ""}</option>`).join("");
    $("history-select").onchange = (e) => show(e.target.value);
    $("history-latest").onclick = () => show(index.latest);
  }

  async function start() {
    WM.initTabs();
    try { index = await WM.loader.json("data/history/index.json"); } catch (e) { index = null; }  // 歷史索引可有可無
    if (index && (!index.weeks || !index.weeks.length)) index = null;
    if (index) initHistory();
    const want = new URLSearchParams(location.search).get("week");
    await show(index && want && index.weeks.some((w) => w.cutoff === want) ? want : index ? index.latest : "");
  }

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(() => WM.charts.redraw());
  }
  start();
})();
