<div align="center">

  <img src="../assets/icon.jpg" alt="Markdown Viewer 標誌" width="100" />

  <h1>Markdown Viewer</h1>

  **提供即時預覽的本機優先 Markdown 編輯器與檢視器**

  在瀏覽器、漸進式 Web 應用程式（PWA）、Docker 或 Neutralino 桌面應用程式中開啟、撰寫、整理、審閱、轉譯及匯出 Markdown；需要時也能使用分享與協作功能。

  [![授權條款](https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=red)](../LICENSE)
  [![最新版本](https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=FF6B00)](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

  <p>
    <a href="https://codewiki.google/github.com/thisis-developer/markdown-viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/badge/CodeWiki-Explore-4285F4?logo=wikipedia&logoColor=white&style=flat" alt="在 CodeWiki 上探索 Markdown Viewer" />
    </a>
    <a href="https://deepwiki.com/ThisIs-Developer/Markdown-Viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://deepwiki.com/badge.svg" alt="在 DeepWiki 上探索 Markdown Viewer" />
    </a>
  </p>

  [English](../README.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [简体中文](README_zh.md) · **繁體中文**

  [開啟 Web 應用程式](https://markdownviewer.pages.dev/) · [文件（英文）](../wiki/Home.md) · [回報問題](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) · [版本發佈](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

</div>

<details>
<summary><strong>目錄</strong>（點選展開）</summary>

- [Markdown Viewer 簡介](#markdown-viewer-簡介)
- [主要功能](#主要功能)
- [快速開始](#快速開始)
- [本機處理與網路處理](#本機處理與網路處理)
- [視覺化轉譯器概覽](#視覺化轉譯器概覽)
- [文件](#文件)
- [主要限制](#主要限制)
- [展示專案](#展示專案)
- [開發歷程](#開發歷程)
- [貢獻者](#貢獻者)
- [參與貢獻與支援](#參與貢獻與支援)
- [授權條款](#授權條款)

</details>

## Markdown Viewer 簡介

Markdown Viewer 是一個開放原始碼、本機優先的工作區，適合開發人員、寫作者、學生、研究人員及所有使用 `.md` 或 `.markdown` 檔案的使用者。它不僅是純文字工具：在一個專注的工作區中整理多份文件，在不變更 Markdown 的情況下透過留言與建議進行審閱，並轉譯圖表、地圖、資料圖、數學公式、3D 模型及音樂。

將文件轉換為 Share Snapshot 連結以便快速分享，或啟動具備存取控制的 Live Share，進行即時共同編輯並使用即時游標、留言與建議。日常編輯在裝置上完成。無需帳號，應用程式也不包含廣告、分析、遙測或訂閱。

<p align="center">
  <img src="https://github.com/user-attachments/assets/5a0d6fda-96f0-4baf-bf7a-0ffbe5119eab" alt="Markdown Viewer 應用程式介面" width="90%" />
</p>

## 主要功能

- **工作區與文件：** Web 版使用個別文件的 IndexedDB 儲存空間，並可在巢狀資料夾中整理文件。還可使用最近使用、我的最愛、搜尋、分頁、批次操作及加密的 Secret Workspace（秘密工作區）。
- **備份與還原：** 匯出或匯入保留資料夾結構的工作區 ZIP。可選擇包含加密的 Secret Workspace 文件，但垃圾桶與桌面歷程記錄不包含在備份中。
- **編輯與審閱：** 在編輯器、分割檢視與預覽之間切換，並使用格式工具、自訂復原／重做、尋找與取代、LTR／RTL、留言與建議。
- **Markdown 轉譯：** 支援 CommonMark 風格基礎語法、GitHub-Flavored Markdown（GFM）、表格、工作清單、提示區塊、註腳、定義清單、程式碼語法醒目提示、已清理的 HTML 與 MathJax。
- **視覺內容：** 轉譯 Mermaid、PlantUML、Graphviz／DOT、D2、Vega-Lite、WaveDrom、Markmap、GeoJSON、TopoJSON、STL 與 ABC 記譜。

<p align="center">
  <img src="https://github.com/user-attachments/assets/57a015a4-621c-4da3-9825-604724f5966b" alt="圖表插入模組" width="90%" />
  <img src="https://github.com/user-attachments/assets/e4560bc1-d6a7-409a-8a93-c054d0a853b3" alt="圖表轉譯範例" width="90%" />
  <img src="https://github.com/user-attachments/assets/d50d980d-1b40-43c7-b924-901c9413987d" alt="3D STL 檢視" width="90%" />
  <img src="https://github.com/user-attachments/assets/bbacabcf-eb19-4430-af19-1ab791afe01c" alt="全螢幕 3D STL 檢視" width="90%" />
</p>

- **導入與匯出：** 開啟本機檔案，或開啟來自分支、標籤、提交 SHA 及選用私人儲存庫的 GitHub 內容；支援匯出 Markdown、獨立 HTML、PNG、瀏覽器列印／另存為 PDF 或舊版點陣 PDF。
- **選用分享功能：** 建立「僅供查看」或「可以編輯」模式的 Share Snapshot（分享快照），或啟動具有主持人、可以編輯與僅供查看權限的暫時 Live Share（即時共享）房間。

<p align="center">
  <img src="https://github.com/user-attachments/assets/0b2080e8-6ba8-4dac-a58a-d043fadeeb61" alt="Live Share 工作階段" width="90%" />
</p>

- **多種執行方式：** 使用託管 Web 應用程式、PWA、靜態託管、Docker、Cloudflare 或 Neutralino 桌面應用程式。

如需瞭解已實作的行為與限制，請參閱[功能參考（英文）](../wiki/Features.md)。

## 快速開始

直接使用[託管 Web 應用程式](https://markdownviewer.pages.dev/)，或透過本機 HTTP 伺服器執行儲存庫：

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python -m http.server 8080
```

開啟 `http://localhost:8080`。請勿依賴 `file://`；瀏覽器安全規則可能會封鎖 Web Worker 與 Service Worker。

| 執行目標 | 詳細文件（英文） |
| :--- | :--- |
| PWA／靜態 Web 託管 | [安裝](../wiki/Installation.md) |
| Docker | [Docker 部署](../wiki/Docker-Deployment.md) |
| Cloudflare Pages／KV／Durable Objects | [設定](../wiki/Configuration.md) |
| Neutralino 桌面應用程式 | [桌面應用程式](../wiki/Desktop-App.md) |

## 本機處理與網路處理

Markdown Viewer 以本機處理為優先，但並非所有功能都能離線執行。

| 操作 | 預設資料路徑 |
| :--- | :--- |
| 編輯、本機導入、預覽、工作區自動儲存及大多數匯出 | 裝置本機 |
| Web 程式庫與未快取的轉譯器相依項目 | Web／PWA 版本向 CDN 發出要求 |
| GitHub 導入與表情符號查詢 | 公開內容使用 GitHub API／原始內容主機；私人內容與 PAT 僅使用 `api.github.com` |
| PlantUML、D2、Graphviz、Vega-Lite、WaveDrom 與部分圖表預覽 | 圖表原始碼可能傳送至 PlantUML、Kroki 或 mermaid.ink |
| 經同意後插入的圖片、GIF 與影片 | 透過公開連結存取的 Cloudflare 暫存媒體儲存空間（90 天） |
| 大型 Share Snapshot | Cloudflare KV（90 天） |
| Live Share | Cloudflare Durable Object WebSocket 轉送；文件內容不會在伺服器端持久儲存 |
| 外部圖片、媒體、連結與地圖圖磚 | 文件指定的外部主機 |

Share Snapshot 與 Live Share URL 都是持有者連結。任何取得有效連結的人都能使用連結內含的權限。Live Share 不提供端對端加密。在對敏感文件使用網路功能前，請先閱讀[隱私權與安全性（英文）](../wiki/Privacy-and-Security.md)。

## 視覺化轉譯器概覽

| 程式碼圍欄 | 轉譯路徑 |
| :--- | :--- |
| `mermaid` | 用戶端轉譯；插入預覽可能使用 mermaid.ink 或 Kroki |
| `plantuml` | PlantUML 伺服器；Kroki 作為備援 |
| `d2`、`graphviz`、`dot`、`vega-lite`、`vegalite`、`wavedrom` | Kroki |
| `markmap` | 用戶端 Markmap 與 D3 |
| `geojson`、`topojson` | 用戶端 Leaflet；地圖圖磚可能使用網路 |
| `stl` | 用戶端 Three.js／WebGL |
| `abc` | 用戶端 ABCJS；播放需要瀏覽器音訊支援 |
| `math` 與 LaTeX 分隔符號 | 用戶端 MathJax |

遠端轉譯器服務會接收其轉譯的圖表原始碼。若不信任已設定的服務，請勿傳送敏感的圖表原始碼。語法請參閱 [Markdown Reference（英文）](../wiki/Markdown-Reference.md)，限制請參閱[功能參考（英文）](../wiki/Features.md#insert-diagrams-charts-maps-models-and-music)。

## 文件

詳細頁面以英文維護。

| 目的 | 頁面（英文） |
| :--- | :--- |
| 選擇起始頁面 | [Documentation Home](../wiki/Home.md) |
| 完整功能與限制 | [Features](../wiki/Features.md) |
| 日常操作與快速鍵 | [Usage Guide](../wiki/Usage-Guide.md) |
| Markdown／圖表語法 | [Markdown Reference](../wiki/Markdown-Reference.md) |
| Share Snapshot | [Share Snapshot](../wiki/Share-Snapshot.md) |
| Live Share | [Live Share](../wiki/Live-Share-Cloudflare.md) |
| 隱私權與安全性 | [Privacy and Security](../wiki/Privacy-and-Security.md) |
| 安裝與部署 | [Installation](../wiki/Installation.md) |
| 設定儲存空間、轉譯器與 Cloudflare | [Configuration](../wiki/Configuration.md) |
| 疑難排解 | [Troubleshooting](../wiki/Troubleshooting.md)／[FAQ](../wiki/FAQ.md) |
| 參與貢獻 | [Contributing](../wiki/Contributing.md) |
| 多語言術語與在地化 | [Localization and Terminology](../wiki/Localization.md) |

## 主要限制

- 工作區備份導入不會合併工作區；確認後會永久取代目前的工作區。
- 工作區備份不包含垃圾桶、桌面歷程記錄或當機復原日誌。
- 大於 10 MB 的本機 Markdown 檔案會被拒絕。
- GitHub 認證保管庫最多可儲存 50 個具名 PAT；每個權杖名稱上限為 60 個字元。
- 處理前的媒體來源檔案上限為 25 MiB；儲存上限為靜態圖片 300 KiB、GIF 5 MiB、影片 10 MiB。
- 儲存型 Share Snapshot 最多包含 8,000,000 個字元，並在 90 天後到期。
- Live Share 最多允許 64 位 WebSocket 參與者，單一即時訊息上限為 8 MB。
- STL 原始碼上限為 2 MiB，轉譯後幾何最多為 300,000 個頂點。
- 桌面保管庫會為每份文件保留最多 20 份最近的歷程記錄副本。
- 點陣 PDF／PNG 匯出受瀏覽器記憶體、Canvas 與 CORS 限制。

詳情請參閱 [Features: Known Technical Limits（英文）](../wiki/Features.md#known-technical-limits)。

## 展示專案

以下以 Markdown Viewer 為基礎的社群專案由其開發者獨立維護。

- [**Markdown Desk**](https://github.com/jhrepo/markdown-desk)：使用 Tauri 建置的原生 macOS 封裝應用程式，新增原生檔案對話方塊與檔案處理常式、選單列整合、自動重新載入及應用程式內更新功能。

## 開發歷程

Markdown Viewer 最初是 PC 上的一個小型個人專案：一款源自好奇心、歷經錯誤與修正，並投入許多心力的簡單 Markdown 檢視器。<a href="https://a1b91221.markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">初始版本</a>目前仍可在線上存取，也始終是這個專案的初心所在。

若要瞭解更完整的專案歷史，請閱讀 [Development Journey（英文）](../wiki/Development-Journey.md)。

## 貢獻者

Markdown Viewer 在社群貢獻者的共同參與下持續成長。

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors" target="_blank" rel="noopener noreferrer">
  <img src="https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer" alt="Markdown Viewer 貢獻者" />
</a>

## 參與貢獻與支援

建立 Pull Request 前，請先閱讀 [Contributing（英文）](../wiki/Contributing.md)。可重現的錯誤與明確的功能建議可提交至 [Issue Tracker](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)。

請勿在一般 Issue 中公開弱點細節。請使用 [Contributing: Security Reports（英文）](../wiki/Contributing.md#security-reports)中說明的儲存庫私人安全性回報管道。

## 授權條款

Markdown Viewer 採用 [Apache License 2.0](../LICENSE)。
