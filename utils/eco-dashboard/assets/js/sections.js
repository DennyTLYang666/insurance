/* 各頁面區塊的渲染。每個函式只負責一個區塊，輸入為 weekly.json 的對應資料。 */
(function () {
  "use strict";
  const WM = (window.WM = window.WM || {});
  const F = WM.fmt;
  const $ = (id) => document.getElementById(id);
  const NEWS_VISIBLE = 5;  // 每個維度預設顯示的新聞數，其餘收合

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
    $("m-notice").textContent = meta.notice;
    $("summary-text").textContent = meta.summary || "（尚未填寫本週結論）";
    const note = $("analysis-note");  // 判斷文字的撰寫者標示（事實數據與分析判斷分開）
    note.hidden = !meta.analysis_by;
    if (meta.analysis_by) {
      note.textContent = `分析判斷（結論、央行態度、新聞影響方向、風險事件說明）由${meta.analysis_by}撰寫${meta.analysis_at ? "（" + F.dateTime(meta.analysis_at) + "）" : ""}，屬推論，非事實數據，亦非個人建議。`;
    }
  }

  // ---------- 重要報價：最新價、1/4/13 週變動、走勢小圖，點名稱看大圖 ----------
  const qNum = (q, v) => F.num(v, q.decimals) + (q.kind === "rate" ? "%" : "");
  const qChg = (q, v) => `<span class="${F.signClass(v)}">${q.kind === "rate" ? F.num(v, 2, true) + " pp" : F.pct(v)}</span>`;
  function spark(series, up) {
    const v = series.map((p) => p.value), lo = Math.min(...v), hi = Math.max(...v), W = 120, H = 28, pad = 2;
    const pts = v.map((x, i) => (i / (v.length - 1) * (W - 2 * pad) + pad).toFixed(1) + "," +
      (H - pad - (hi === lo ? 0.5 : (x - lo) / (hi - lo)) * (H - 2 * pad)).toFixed(1)).join(" ");
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="近 ${v.length - 1} 週走勢"><polyline fill="none" stroke="${up ? "var(--up)" : "var(--down)"}" stroke-width="1.6" points="${pts}"/></svg>`;
  }
  function quotes(data) {
    const list = data.quotes || [], sec = $("s-quotes"), tab = document.querySelector('a[href="#s-quotes"]');
    sec.hidden = !list.length;
    tab.hidden = !list.length;
    if (!list.length) return;
    let h = "<thead><tr><th>項目</th><th class='num'>最新價</th><th>報價日</th><th class='num'>1 週</th><th class='num'>4 週</th><th class='num'>13 週</th><th>近 26 週走勢</th></tr></thead><tbody>";
    let grp = null;
    for (const q of list) {
      if (q.group !== grp) { grp = q.group; h += `<tr class="grp"><th colspan="7" scope="colgroup">${F.esc(grp)}</th></tr>`; }
      const s = q.series;
      h += `<tr><th scope="row"><button type="button" class="linklike" data-q="${F.esc(q.id)}" title="看 26 週走勢圖">${F.esc(q.name)}</button><span class="tag">${F.esc(q.symbol)}</span></th>
        <td class="num">${qNum(q, q.last)}</td><td>${F.esc(q.last_date)}</td>
        <td class="num">${qChg(q, q.changes.w1)}</td><td class="num">${qChg(q, q.changes.w4)}</td><td class="num">${qChg(q, q.changes.w13)}</td>
        <td>${spark(s, s[s.length - 1].value >= s[0].value)}</td></tr>`;
    }
    $("quotes-table").innerHTML = h + "</tbody>";
    $("quotes-note").textContent = "最新價為抓取當下最近一個交易日的收盤（可能含盤中資料），日期見「報價日」；1／4／13 週變動以資料截止日（週五）收盤計算，美債殖利率以百分點（pp）表示。點選項目名稱可看 26 週走勢圖。";
    const draw = (id) => {
      const q = list.find((x) => x.id === id), s = q.series, first = s[0], last = s[s.length - 1];
      const chg = q.kind === "rate" ? F.num(last.value - first.value, 2, true) + " pp" : F.pct(last.value / first.value - 1);
      $("fig-quote").innerHTML = figure({ id: "chart-quote", label: q.name, height: 300,
        title: `${q.name}近 ${s.length - 1} 週由 ${qNum(q, first.value)} 變動至 ${qNum(q, last.value)}（${chg}）` });
      figureText("chart-quote", data.meta, { source: `Yahoo Finance（${q.symbol}）週五收盤`, range: `${first.date} 至 ${last.date}`,
        axisNote: "Y 軸為非零起點", summary: `區間高點 ${qNum(q, Math.max(...s.map((p) => p.value)))}、低點 ${qNum(q, Math.min(...s.map((p) => p.value)))}，最新週收 ${qNum(q, last.value)}。` });
      WM.charts.show("quote", "chart-quote", WM.charts.builders.quote(q));
    };
    $("quotes-table").querySelectorAll("button[data-q]").forEach((b) => (b.onclick = () => draw(b.dataset.q)));
    draw(list[0].id);
  }

  function heat(dims) {
    const keys = [["w1", "1 週"], ["w4", "4 週"], ["w13", "13 週"]];
    const fallback = {};  // 舊版資料沒有 labels 時，才由前端依各欄排名補算
    keys.forEach(([k]) => {
      [...dims].sort((a, b) => b.returns[k] - a.returns[k]).forEach((d, i) => {
        (fallback[d.id] = fallback[d.id] || {})[k] = i < 2 ? "強" : i < dims.length - 2 ? "中" : "弱";
      });
    });
    let h = "<thead><tr><th>維度</th>" + keys.map(([, t]) => `<th class="num">${t}報酬</th>`).join("") +
      "<th class='num'>相對強弱</th><th>綜合熱度</th></tr></thead><tbody>";
    for (const d of dims) {
      h += `<tr><th scope="row">${F.esc(d.name)}<span class="tag">${F.esc(d.proxy)}</span></th>`;
      for (const [k] of keys) {
        const v = d.returns[k], lb = (d.labels || fallback[d.id])[k];
        h += `<td class="num" data-heat="${lb}"><span class="${F.signClass(v)}">${F.pct(v)}</span> ${lb}</td>`;
      }
      h += `<td class="num"><span class="${F.signClass(d.relative_strength)}">${F.pct(d.relative_strength)}</span></td>`;
      h += `<td data-heat="${F.esc(d.heat)}">${F.esc(d.heat)}</td></tr>`;
    }
    $("heat-table").innerHTML = h + "</tbody>";
  }

  function rank(data) {
    const dims = data.dimensions;
    const s = [...dims].sort((a, b) => b.returns.w1 - a.returns.w1);
    const top = s[0], bot = s[s.length - 1];
    $("fig-rank").innerHTML = figure({ id: "chart-rank", title: data.meta.chart_titles && data.meta.chart_titles.ranking,
      label: "上週漲跌排行", height: 44 * dims.length + 70 });
    figureText("chart-rank", data.meta, {
      source: "價格 CSV（各維度代理標的）", range: "上週（1 週報酬）", axisNote: "座標軸從 0 起算",
      summary: `1 週報酬由高到低：${s.map((d) => `${d.name} ${F.pct(d.returns.w1)}`).join("、")}。最高為${top.name}，最低為${bot.name}。`,
    });
    WM.charts.show("rank", "chart-rank", WM.charts.builders.rank(dims));
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
    const bench = dims.find((d) => d.id === "us_equity" && d.id !== best.id);
    selects[0].value = best.id;
    selects[1].value = bench ? bench.id : "";
    selects[2].value = "";

    $("fig-trend").innerHTML = figure({ id: "chart-trend", title: data.meta.chart_titles && data.meta.chart_titles.trend,
      label: "趨勢比較", height: 340 });
    const draw = () => {
      const ids = [...new Set(selects.map((s) => s.value).filter(Boolean))];
      const sel = ids.map((id) => dims.find((d) => d.id === id));
      const first = sel[0].weekly_close, last = first[first.length - 1];
      const parts = sel.map((d) => {
        const w = d.weekly_close;
        return `${d.name}由 ${F.num(w[0].value)} 變動至 ${F.num(w[w.length - 1].value)}（${F.pct(w[w.length - 1].value / w[0].value - 1)}）`;
      });
      figureText("chart-trend", data.meta, {
        source: "價格 CSV（週線收盤，起點標準化為 100）", range: `${first[0].date} 至 ${last.date}`,
        axisNote: "Y 軸為非零起點", summary: `近 ${first.length - 1} 週：${parts.join("；")}。`,
      });
      WM.charts.show("trend", "chart-trend", WM.charts.builders.trend(sel));
    };
    selects.forEach((s) => (s.onchange = draw));
    draw();
  }

  function news(list, order) {
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

  function calendar(list) {
    const sorted = [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    $("cal-table").innerHTML =
      "<thead><tr><th>日期</th><th>時間</th><th>國家</th><th>事件</th><th class='num'>前值</th><th class='num'>預期</th><th class='num'>實際</th></tr></thead><tbody>" +
      sorted.map((e) => `<tr><td>${F.esc(e.date)}</td><td>${F.esc(e.time)}</td><td>${F.esc(e.country)}</td><td>${F.esc(e.event)}</td>
        <td class="num">${F.cell(e.previous)}</td><td class="num">${F.cell(e.forecast)}</td><td class="num">${e.actual == null ? "尚未公布" : F.esc(e.actual)}</td></tr>`).join("") + "</tbody>";
  }

  function countries(data) {
    const cs = data.countries;
    const hi = [...cs].sort((a, b) => b.real_rate - a.real_rate);
    $("fig-country").innerHTML = figure({ id: "chart-country", title: data.meta.chart_titles && data.meta.chart_titles.countries,
      label: "國家總經", height: 320 });
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

  // 市場利率與匯率（rates.csv；舊版資料或尚未填寫時整塊隱藏）
  function rates(list) {
    const box = $("rates-block");
    box.hidden = !list || !list.length;
    if (box.hidden) return;
    $("rates-table").innerHTML =
      "<thead><tr><th>指標</th><th>資料日</th><th class='num'>最新值</th><th class='num'>前一筆</th><th class='num'>變動</th></tr></thead><tbody>" +
      list.map((r) => `<tr><th scope="row">${F.esc(r.name)}</th><td>${F.esc(r.date)}</td><td class="num">${F.num(r.value)}</td>
        <td class="num">${F.num(r.prev_value)}</td><td class="num ${F.signClass(r.change)}">${F.num(r.change, 2, true)}</td></tr>`).join("") + "</tbody>";
  }

  function risk(list) {
    $("risk-table").innerHTML =
      "<thead><tr><th>事件</th><th class='num'>近 1 週新聞數</th><th class='num'>近 4 週新聞數</th><th>趨勢</th><th>關聯維度</th><th>推論路徑（推論，非確定關係）</th></tr></thead><tbody>" +
      list.map((r) => `<tr><th scope="row">${F.esc(r.name)}</th><td class="num">${F.num(r.news_count_w1, 0)}</td><td class="num">${F.num(r.news_count_w4, 0)}</td>
        <td>${F.esc(r.trend)}</td><td>${F.esc(r.linked_dimensions.join("、"))}</td><td class="wrap">${F.esc(r.note)}</td></tr>`).join("") + "</tbody>";
  }

  /** 以一份 weekly.json 內容重畫整頁 */
  function renderAll(data) {
    WM.charts.destroyAll();
    header(data.meta);
    quotes(data);
    heat(data.dimensions);
    rank(data);
    trend(data);
    news(data.news, data.dimensions.map((d) => d.name));
    calendar(data.calendar);
    countries(data);
    rates(data.rates);
    risk(data.risk_events);
  }

  WM.sections = { renderAll };
})();
