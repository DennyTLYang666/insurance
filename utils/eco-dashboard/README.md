# 每週市場總覽

純靜態網站（HTML + CSS + 原生 JS + Chart.js 4.4.1），資料來源為 `data/weekly.json`。
每週更新一次，內容為「上週收盤回顧」與「本週行事曆」。僅供內部參考，不構成投資建議。

## 更新機制一覽

| 資料 | 怎麼來 | 來源 | 可靠度 |
|---|---|---|---|
| 重要報價（匯率、黃金／原油、股市、美債殖利率、VIX）：最新價＋1/4/13 週變動＋26 週走勢 | 腳本自動抓 | Yahoo Finance 圖表 API（非官方） | 中：同上；單項失敗只影響該項 |
| 七維度週收盤 | 腳本自動抓 | Yahoo Finance 圖表 API（非官方） | 中：無官方保證，格式可能變動 |
| 美債殖利率、美元兌台幣 | 腳本自動抓 | FRED 公開 CSV | 高 |
| 美國、歐元區的利率／CPI／GDP | 腳本自動抓 | FRED（美國 CPIAUCNS／GDPC1、聯邦資金利率上限、ECB 存款利率）、ECB Data Portal（HICP、MNA 指數自行算 GDP 年增） | 中：ECB 舊 ICP 資料集已停用，已改用 HICP；代碼若再變動請看 `--check-sources` |
| 日本、台灣、中國總經 | Claude 查證後補入 | 各國央行與統計機構 | FRED 上日本 CPI 等 OECD 序列已停更，故不自動抓 |
| 經濟日曆 | 腳本自動抓 | Forex Factory 免費週 JSON（非官方） | 中：只有預期值與前值，沒有「實際」 |
| 新聞候選 | 腳本自動抓標題與連結 | Fed、ECB、BLS 官方 RSS | 高 |
| 結論、圖表標題、央行態度、新聞摘要與影響方向、風險事件 | **Claude 撰寫**（標示為 AI 推論） | — | 需人工過目 |

## 每週流程

1. 第一次使用先檢查來源：`python scripts/update_data.py --check-sources`（不寫檔，列出每個來源是否可用）。
2. 日常更新：
   - **完全自動、不含判斷文字**：雙擊 `scripts\update.bat`（等同 `--fetch`）。
   - **含 AI 判斷文字**：請 Claude 照 `scripts/WEEKLY_TASK.md` 執行（先 `--fetch-only` 抓資料，補國家總經，再撰寫 `manual.json`，最後建置）。
3. 用瀏覽器開 `index.html` 檢查，再 commit / push（GitHub Pages）。

建議在**週末或週一**執行：週五當天的收盤資料可能還不完整，腳本不納入當天。

### 指令

```
python scripts/update_data.py                  驗證 data/raw 並更新網站
python scripts/update_data.py --fetch          先自動抓所有來源，再更新
python scripts/update_data.py --fetch prices,macro   只抓指定來源（prices,rates,macro,calendar,news,quotes）
python scripts/update_data.py --fetch-only     只抓資料，不更新網站
python scripts/update_data.py --check-sources  檢查來源是否可用（不寫檔）
python scripts/update_data.py --dry-run        只驗證與計算，不寫檔
python scripts/update_data.py --force          允許用較舊的截止日覆蓋最新資料（預設會擋下）
```

結束碼：0 成功；1 驗證失敗（不產生任何檔案）；2 網站已更新但有來源抓取失敗（網站用的是舊資料）。

### 抓取的安全設計

- 價格採「全有或全無」：七個維度都抓到、最新週五一致，才會覆蓋 `prices.csv`；任一失敗則整份不動。
- 其餘來源各自獨立，失敗只顯示錯誤、保留原檔。
- 資料過舊視為失敗（利率 45 天、CPI 90 天、GDP 170 天），不會把停更的舊資料當成功寫入；年增依「去年同期」計算，遇到缺期（如 2025-10 美國 CPI 未發布）不會錯位。
- 國家總經：三項指標都抓到才更新該國；`as_of` 取三項中**最舊**一筆的期末日，避免日頻利率讓資料看起來比實際新。

## 目錄結構

```
index.html
assets/
  style.css            主題（CSS 變數，淺色／深色）
  app.js               進入點：載入資料、歷史週次切換
  js/format.js         格式化（千分位、百分比、「−」負號、台北時間）
  js/loader.js         資料載入（fetch；失敗時改載同名 .js，供 file:// 使用）
  js/charts.js         Chart.js 圖表設定
  js/sections.js       各區塊渲染
  js/tabs.js           分頁列捲動同步
data/
  weekly.json / .js    最新一週（網站讀取）
  history/             每週存檔 weekly-YYYY-MM-DD.json、index.json（皆有同名 .js）
  raw/                 原始資料（見下）
scripts/
  update_data.py       驗證、計算、歷史存檔
  fetch_sources.py     各資料來源的抓取（只用標準函式庫）
  update.bat           Windows 一鍵執行（預設 --fetch）
  WEEKLY_TASK.md       每週作業指示（給 Claude／人工）
```

`.js` 檔是 `.json` 的同內容備份（讓雙擊 `index.html` 也能讀資料），由腳本一併產生，不要手動編輯。

## data/raw/ 檔案

| 檔案 | 內容 | 誰寫入 |
|---|---|---|
| `prices.csv` | `date,dimension,proxy,close`（週五還原收盤；proxy 為標的代號） | `--fetch`（整份覆蓋） |
| `quotes.csv` | `date,id,symbol,close,kind`（kind：w＝週五收盤、l＝最新收盤） | `--fetch`（逐項更新，失敗的項目保留舊資料） |
| `rates.csv` | `date,series,value`（DGS10、DXY、USD/TWD） | `--fetch`（併入）；DXY 需人工 |
| `countries.csv` | `as_of,country,policy_rate,cpi_yoy,gdp_yoy,stance,stance_reason,source` | `--fetch`（US、EU）；其餘國家人工／Claude |
| `calendar.csv` | `date,time,event,country,previous,forecast,actual`（台北時間） | `--fetch`（整份覆蓋）；英文標題未收錄者保留原文 |
| `news.csv` | （選填）人工新聞，欄位同 manual.json 的 news；平常不需要 | 人工 |
| `news_candidates.json` | 官方 RSS 的標題與連結（候選，不進網站） | `--fetch` |
| `manual.json` | 結論、圖表標題、央行態度、新聞、風險事件、`analysis_by` | Claude／人工 |

重要報價清單與 Yahoo 代號在 `fetch_sources.py` 的 `QUOTES`（黃金依序嘗試 `XAUUSD=X`、`GC=F`）；要增減項目改這裡，頁面會自動跟著變。

七維度代理標的：科技 QQQ、原油 USO、黃金 GLD、美債 TLT、美元 UUP、美股大盤 SPY、新興市場 EEM。要換標的改 `fetch_sources.py` 的 `PRICE_SYMBOLS`。

央行態度優先序：`manual.json` 的 `countries` ＞ `countries.csv` 自帶 ＞ 沿用上週（加註「尚待更新」並警告）＞ 報錯。
判斷文字（含 `analysis_by`）會顯示在頁面上，讓讀者分得出事實數據與 AI／人工推論。

## 計算規則

- 報酬：1／4／13 週，以週五還原收盤（含配息）計算。
- 強／中／弱：各欄報酬排名前 2 強、後 2 弱、其餘中；綜合熱度由三欄排名加總決定。
- 相對強弱：該維度三期報酬平均，減去七維度等權平均。
- 實質利率 = 政策利率 − CPI 年增。
- 趨勢圖：近 26 週，起點標準化為 100。

## 歷史

每次更新存一份 `data/history/weekly-<資料截止日>.json`；同一週重跑會覆蓋該週。有 2 週以上歷史時，頁首出現「查看週次」選單，網址 `?week=YYYY-MM-DD` 可直接開啟特定週次。

## 預覽與部署

- 直接雙擊 `index.html` 即可（`file://` 會自動改讀 `.js` 資料檔）。圖表需連網載入 Chart.js CDN；離線時仍顯示表格與文字摘要。
- GitHub Pages：所有路徑為相對路徑，直接發布此資料夾。

## 注意

- 第一次成功執行 `update.bat` 前，`data/weekly.json` 還不存在，網頁會顯示讀取失敗，這是正常的。
- Yahoo 與 Forex Factory 皆非官方 API，可能隨時改版或限制使用；失敗時請看 `[抓取失敗]` 訊息。使用前請自行確認各來源的使用條款。
- 日期與時間一律以台北時間（+08:00）顯示。
