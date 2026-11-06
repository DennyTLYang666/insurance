/* 細節區塊的渲染（概觀以外的所有區塊）。每個函式只負責一塊；缺資料的舊版快照整塊隱藏。 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const F = WM.fmt, U = WM.ui;
  const $ = (id) => document.getElementById(id);
  const NEWS_VISIBLE = 5;  // 每個維度預設顯示的新聞數，其餘收合

  /** 區塊與導覽分頁一起顯示／隱藏 */
  function toggleSec(id, show) {
    $(id).hidden = !show;
    const tab = document.querySelector(`a[href="#${id}"]`);
    if (tab) tab.hidden = !show;
  }

  // 圖表區塊：結論式標題＋圖＋來源說明＋文字摘要（無障礙）
  function figure(o) {
    return `
      <figcaption class="chart-title">${F.esc(o.title || "（尚未填寫圖表結論標題）")}</figcaption>
      <div class="chart-box" style="height:${o.height}px"><canvas id="${o.id}" role="img" aria-label="${F.esc(o.title || o.label)}"></canvas></div>
      <p class="chart-source" id="${o.id}-src"></p>
      <p class="chart-summary" id="${o.id}-sum"></p>`;
  }
  function figureText(id, meta, o) {
    $(id + "-src").textContent = `資料來源：${o.source}；時間範圍：${o.range}；更新時間：${F.dateTime(meta.updated_at)}${o.axisNote ? "；" + o.axisNote : ""}`;
    $(id + "-sum").textContent = "文字摘要：" + o.summary;
  }

  function header(meta) {
    $("m-cutoff").textContent = meta.data_cutoff;
    $("m-updated").textContent = F.dateTime(meta.updated_at);
    if (meta.notice) $("m-notice").textContent = meta.notice;
  }

  // ---------- 重要報價：最新價、1/4/13 週變動、走勢小圖，點名稱看大圖 ----------
  const qNum = (q, v) => F.num(v, q.decimals) + (q.kind === "rate" ? "%" : "");
  const qChg = (q, v) => `<span class="${F.signClass(v)}">${q.kind === "rate" ? F.num(v, 2, true) + " pp" : F.pct(v)}</span>`;

  function drawQuote(data, id) {
    const q = data.quotes.find((x) => x.id === id) || data.quotes[0], s = q.series, first = s[0], last = s[s.length - 1];
    const chg = q.kind === "rate" ? F.num(last.value - first.value, 2, true) + " pp" : F.pct(last.value / first.value - 1);
    $("fig-quote").innerHTML = figure({ id: "chart-quote", label: q.name, height: 300,
      title: `${q.name}近 ${s.length - 1} 週由 ${qNum(q, first.value)} 變動至 ${qNum(q, last.value)}（${chg}）` });
    figureText("chart-quote", data.meta, { source: `Yahoo Finance（${q.symbol}）週五收盤`, range: `${first.date} 至 ${last.date}`,
      axisNote: "Y 軸為非零起點", summary: `區間高點 ${qNum(q, Math.max(...s.map((p) => p.value)))}、低點 ${qNum(q, Math.min(...s.map((p) => p.value)))}，最新週收 ${qNum(q, last.value)}。` });
    WM.charts.show("quote", "chart-quote", WM.charts.builders.quote(q));
  }

  function quotes(data) {
    const list = data.quotes || [];
    toggleSec("s-quotes", list.length > 0);
    if (!list.length) return;
    let h = "<thead><tr><th>項目</th><th class='num'>最新價</th><th>報價日</th><th class='num'>1 週</th><th class='num'>4 週</th><th class='num'>13 週</th><th>近 26 週走勢</th></tr></thead><tbody>";
    let grp = null;
    for (const q of list) {
      if (q.group !== grp) { grp = q.group; h += `<tr class="grp"><th colspan="7" scope="colgroup">${F.esc(grp)}</th></tr>`; }
      const s = q.series.map((p) => p.value);
      h += `<tr><th scope="row"><button type="button" class="linklike" data-q="${F.esc(q.id)}" title="看 26 週走勢圖">${F.esc(q.name)}</button><span class="tag">${F.esc(q.symbol)}</span></th>
        <td class="num">${qNum(q, q.last)}</td><td>${F.esc(q.last_date)}</td>
        <td class="num">${qChg(q, q.changes.w1)}</td><td class="num">${qChg(q, q.changes.w4)}</td><td class="num">${qChg(q, q.changes.w13)}</td>
        <td>${U.spark(s, s[s.length - 1] >= s[0])}</td></tr>`;
    }
    $("quotes-table").innerHTML = h + "</tbody>";
    $("quotes-note").textContent = "最新價為抓取當下最近一個交易日的收盤（可能含盤中資料），日期見「報價日」；1／4／13 週變動以資料截止日（週五）收盤計算，殖利率以百分點（pp）表示。點選項目名稱可看 26 週走勢圖。";
    $("quotes-table").querySelectorAll("button[data-q]").forEach((b) => (b.onclick = () => drawQuote(data, b.dataset.q)));
    drawQuote(data, list[0].id);
  }

  // ---------- 投資指標熱度 ----------
  function heat(data) {
    const dims = data.dimensions, keys = [["w1", "1 週"], ["w4", "4 週"], ["w13", "13 週"]];
    const fallback = {};  // 舊版資料沒有 labels 時，才由前端依各欄排名補算
    keys.forEach(([k]) => {
      [...dims].sort((a, b) => b.returns[k] - a.returns[k]).forEach((d, i) => {
        (fallback[d.id] = fallback[d.id] || {})[k] = i < 2 ? "強" : i < dims.length - 2 ? "中" : "弱";
      });
    });
    let h = "<thead><tr><th>投資指標</th><th>近 26 週</th>" + keys.map(([, t]) => `<th class="num">${t}</th>`).join("") +
      "<th class='num'>相對強弱</th><th>綜合熱度</th></tr></thead><tbody>";
    for (const d of dims) {
      const s = (d.weekly_close || []).map((p) => p.value);
      h += `<tr><th scope="row">${F.esc(d.name)}<span class="tag">${F.esc(d.proxy)}</span>${d.role ? `<small class="role">${F.esc(d.role)}</small>` : ""}</th>
        <td>${U.spark(s, s[s.length - 1] >= s[0], 96, 26)}</td>`;
      for (const [k] of keys) {
        const v = d.returns[k], lb = (d.labels || fallback[d.id])[k];
        h += `<td class="num" data-heat="${lb}"><span class="${F.signClass(v)}">${F.pct(v)}</span> ${lb}</td>`;
      }
      h += `<td class="num"><span class="${F.signClass(d.relative_strength)}">${F.pct(d.relative_strength)}</span></td>`;
      h += `<td data-heat="${F.esc(d.heat)}">${F.esc(d.heat)}</td></tr>`;
    }
    $("heat-table").innerHTML = h + "</tbody>";
    $("heat-note").textContent = `七個指標各用一檔可直接交易的 ETF 代表一類資產（${dims.map((d) => d.name + "＝" + d.proxy).join("、")}）。` +
      "格內標籤為該欄報酬在七個指標中的排名（前 2 強、中間 3 中、後 2 弱）；綜合熱度依三欄排名加總；相對強弱＝三期報酬平均減去七指標等權平均。";
  }

  // 趨勢：三個下拉（第 1 個必選，其餘可選），最多 3 條線
  function trend(data) {
    const dims = data.dimensions;
    const selects = ["trend-a", "trend-b", "trend-c"].map($);
    const opts = dims.map((d) => `<option value="${F.esc(d.id)}">${F.esc(d.name)}</option>`).join("");
    selects[0].innerHTML = opts;
    selects[1].innerHTML = '<option value="">（不比較）</option>' + opts;
    selects[2].innerHTML = '<option value="">（不比較）</option>' + opts;
    const best = [...dims].sort((a, b) => b.returns.w13 - a.returns.w13)[0];
    const bench = dims.find((d) => d.id === "us_equity" && d.id !== best.id) || dims.find((d) => d.id !== best.id);
    selects[0].value = best.id;
    selects[1].value = bench ? bench.id : "";
    selects[2].value = "";
    $("fig-trend").innerHTML = figure({ id: "chart-trend", title: data.meta.chart_titles && data.meta.chart_titles.trend, label: "趨勢比較", height: 340 });
    const draw = () => {
      const ids = [...new Set(selects.map((s) => s.value).filter(Boolean))];
      const sel = ids.map((id) => dims.find((d) => d.id === id));
      const first = sel[0].weekly_close, last = first[first.length - 1];
      const parts = sel.map((d) => {
        const w = d.weekly_close;
        return `${d.name}由 ${F.num(w[0].value)} 變動至 ${F.num(w[w.length - 1].value)}（${F.pct(w[w.length - 1].value / w[0].value - 1)}）`;
      });
      figureText("chart-trend", data.meta, { source: "價格 CSV（週線收盤，起點標準化為 100）", range: `${first[0].date} 至 ${last.date}`,
        axisNote: "Y 軸為非零起點", summary: `近 ${first.length - 1} 週：${parts.join("；")}。` });
      WM.charts.show("trend", "chart-trend", WM.charts.builders.trend(sel));
    };
    selects.forEach((s) => (s.onchange = draw));
    draw();
  }

  // ---------- 環境燈號明細：因子 × 商品 ----------
  const DIR_TXT = { 1: "上升", "-1": "下降", 0: "持平" };
  function environment(data) {
    const env = data.environment;
    toggleSec("s-env", !!env);
    if (!env) return;
    $("env-factors").innerHTML = env.factors.map((f) => {
      const unit = f.kind === "pct" ? F.pct(f.d20 / 100, 1) : F.num(f.d20, 2, true) + " pp";
      return `<div class="ft"><div class="ft-name">${F.esc(f.name)}</div><div class="ft-role">${F.esc(f.role)}</div>
        <div class="ft-val">${F.num(f.value, f.value >= 100 ? 1 : 2)}</div>
        <div class="ft-chg">20 日 ${DIR_TXT[f.dir]}（${unit}）</div><div class="ft-date">資料至 ${F.esc(f.date)}</div></div>`;
    }).join("");
    const sym = { 1: ['<span class="pos" title="目前走勢對此商品偏多">▲</span>'], "-1": ['<span class="neg" title="目前走勢對此商品偏空">▼</span>'], 0: ['<span class="muted">—</span>'] };
    let h = "<thead><tr><th>商品</th>" + env.factors.map((f) => `<th class="c" title="${F.esc(f.role)}">${F.esc(f.name)}</th>`).join("") +
      "<th class='num'>分數</th><th>燈號</th><th>資料至</th></tr></thead><tbody>";
    for (const p of env.products) {
      const byId = Object.fromEntries(p.contrib.map((c) => [c.id, c]));
      h += `<tr><th scope="row">${F.esc(p.name)}</th>` + env.factors.map((f) => {
        const c = byId[f.id];
        return c ? `<td class="c" title="近 250 日相關 ${F.num(c.corr250, 2, true)}（近 60 日 ${F.num(c.corr60, 2, true)}）">${sym[c.imp][0]}</td>` : '<td class="c">—</td>';
      }).join("") + `<td class="num">${F.num(p.score, 2, true)}</td><td>${U.light(p.label)}</td><td>${F.esc(p.last_date)}</td></tr>`;
    }
    $("env-table").innerHTML = h + "</tbody>";
    $("env-note").textContent = env.note + "　▲＝該因子目前走勢對此商品偏多、▼＝偏空、—＝趨勢不明或相關性過低（不計分）。分數 ≥ +0.34 偏多、≤ −0.34 偏空。燈號是規則式的環境判讀，不是價格預測。";
  }

  function news(data) {
    const list = data.news, order = data.dimensions.map((d) => d.name);
    const sorted = [...list].sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const groups = {};
    sorted.forEach((n) => (groups[n.dimension] = groups[n.dimension] || []).push(n));
    const names = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
    const item = (n) => `
        <div class="news-item">
          <div class="row">${F.dateTime(n.published_at)}｜${F.esc(n.source)}｜${F.esc(n.source_type)}｜影響：<span class="impact" data-impact="${F.esc(n.impact)}">${F.esc(n.impact)}</span></div>
          <p>${F.esc(n.summary)} <a href="${F.esc(n.url)}" target="_blank" rel="noopener noreferrer">原文連結</a></p>
        </div>`;
    $("news-list").innerHTML = names.map((dim) => {
      const items = groups[dim], rest = items.slice(NEWS_VISIBLE);
      return `<div class="news-group"><h3>${F.esc(dim)}</h3>${items.slice(0, NEWS_VISIBLE).map(item).join("")}` +
        (rest.length ? `<details><summary>其餘 ${rest.length} 則</summary>${rest.map(item).join("")}</details>` : "") + "</div>";
    }).join("") || '<p class="note">本週沒有新聞摘要。</p>';
  }

  function countries(data) {
    const cs = data.countries, hi = [...cs].sort((a, b) => b.real_rate - a.real_rate);
    $("fig-country").innerHTML = figure({ id: "chart-country", title: data.meta.chart_titles && data.meta.chart_titles.countries, label: "國家總經", height: 300 });
    figureText("chart-country", data.meta, {
      source: "各國央行與統計機構（見下表）", range: "各國最新一次公布值", axisNote: "座標軸從 0 起算",
      summary: `政策利率與 CPI 年增：${cs.map((c) => `${c.name} ${F.num(c.policy_rate)}% / ${F.num(c.cpi_yoy)}%`).join("、")}。實質利率最高為${hi[0].name}（${F.num(hi[0].real_rate, 2, true)}%），最低為${hi[hi.length - 1].name}（${F.num(hi[hi.length - 1].real_rate, 2, true)}%）。`,
    });
    WM.charts.show("country", "chart-country", WM.charts.builders.countries(cs));
    $("country-table").innerHTML =
      "<thead><tr><th>國家</th><th class='num'>政策利率</th><th class='num'>CPI 年增</th><th class='num'>實質利率</th><th class='num'>GDP 年增</th><th>央行態度</th><th>依據</th><th>資料日</th><th>來源</th></tr></thead><tbody>" +
      cs.map((c) => `<tr><th scope="row">${F.esc(c.name)}</th><td class="num">${F.num(c.policy_rate)}%</td><td class="num">${F.num(c.cpi_yoy)}%</td>
        <td class="num ${F.signClass(c.real_rate)}">${F.num(c.real_rate, 2, true)}%</td><td class="num">${F.num(c.gdp_yoy)}%</td>
        <td>${F.esc(c.stance)}</td><td class="wrap">${F.esc(c.stance_reason)}</td><td>${F.esc(c.as_of)}</td><td>${F.esc(c.source)}</td></tr>`).join("") + "</tbody>";
  }

  function rates(list) {
    const box = $("rates-block");
    box.hidden = !list || !list.length;
    if (box.hidden) return;
    $("rates-table").innerHTML =
      "<thead><tr><th>指標</th><th>資料日</th><th class='num'>最新值</th><th class='num'>前一筆</th><th class='num'>變動</th></tr></thead><tbody>" +
      list.map((r) => `<tr><th scope="row">${F.esc(r.name)}</th><td>${F.esc(r.date)}</td><td class="num">${F.num(r.value)}</td>
        <td class="num">${F.num(r.prev_value)}</td><td class="num ${F.signClass(r.change)}">${F.num(r.change, 2, true)}</td></tr>`).join("") + "</tbody>";
  }

  // ---------- 風險事件：貼近生活、有日期者倒數、事件過後一段時間自動移除（資料層處理） ----------
  function risk(data) {
    const list = data.risk_events || [], ref = WM.overview.refDate(data);
    toggleSec("s-risk", true);
    const sorted = [...list].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    const anyCount = list.some((r) => r.news_count_w1 != null || r.news_count_w4 != null);
    $("risk-cards").innerHTML = sorted.map((r) => `<article class="rcard">
      <header><span class="rc-cat">${F.esc(r.category || "風險")}</span>
        ${r.date ? `<span class="rc-date">${F.md(r.date)}・${U.countdown(r.date, ref)}</span>` : '<span class="rc-date">持續關注</span>'}
        <span class="tag">${F.esc(r.trend)}</span></header>
      <h3>${F.esc(r.name)}</h3>
      ${r.life_impact ? `<p class="life"><b>對生活的影響</b>　${F.esc(r.life_impact)}</p>` : ""}
      <p class="note">${F.esc(r.note)}</p>
      <p class="rc-tags">${(r.linked_dimensions || []).map((d) => `<span class="tag">${F.esc(d)}</span>`).join("")}
        ${anyCount ? `<span class="muted">新聞數 1 週 ${F.num(r.news_count_w1, 0)}／4 週 ${F.num(r.news_count_w4, 0)}</span>` : ""}
        ${r.until ? `<span class="muted">顯示至 ${F.md(r.until)}</span>` : ""}</p></article>`).join("") ||
      '<p class="note">目前沒有需要特別關注的風險事件。</p>';
  }

  function countriesSection(data) { countries(data); rates(data.rates); }

  /** 以一份 weekly.json 內容重畫整頁 */
  function renderAll(data) {
    WM.charts.destroyAll();
    header(data.meta);
    WM.overview.render(data);
    heat(data);
    trend(data);
    quotes(data);
    environment(data);
    WM.calendar.render(data);
    news(data);
    countriesSection(data);
    risk(data);
  }

  WM.sections = { renderAll, drawQuote };
})();
