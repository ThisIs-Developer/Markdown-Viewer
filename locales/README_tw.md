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
- [媒體儲存方式](#媒體儲存方式)
- [主要限制](#主要限制)
- [重要隱私權說明](#重要隱私權說明)
- [文件](#文件)
- [展示專案](#展示專案)
- [開發歷程](#開發歷程)
- [貢獻者](#貢獻者)
- [參與貢獻與授權條款](#參與貢獻與授權條款)

</details>

## Markdown Viewer 簡介

Markdown Viewer 是一個開放原始碼、本機優先的工作區，適合開發人員、寫作者、學生、研究人員及所有使用 `.md` 或 `.markdown` 檔案的使用者。它不僅是純文字工具：在一個專注的工作區中整理多份文件，在不變更 Markdown 的情況下透過留言與建議進行審閱，並轉譯圖表、地圖、資料圖、數學公式、3D 模型及音樂。

將文件轉換為 Share Snapshot 連結以便快速分享，或啟動具備存取控制的 Live Share，進行即時共同編輯並使用即時游標、留言與建議。日常編輯在裝置上完成。無需帳號，應用程式也不包含廣告、分析、遙測或訂閱。

<p align="center">
  <img src="https://github.com/user-attachments/assets/5a0d6fda-96f0-4baf-bf7a-0ffbe5119eab" alt="Markdown Viewer 應用程式介面" width="90%" />
</p>

## 主要功能

- **工作區與文件：** 在巢狀資料夾中整理文件，應用程式不設定文件數量上限；實際上限取決於可用儲存空間。並可使用最近使用、我的最愛、搜尋、分頁、批次操作及加密的 Secret Workspace（秘密工作區）。
- **編輯與審閱：** 在編輯器、分割檢視與預覽之間切換，並使用格式工具、自訂復原／重做、尋找與取代、LTR／RTL、留言與建議。
- **Markdown 轉譯：** 支援 CommonMark 風格基礎語法、GitHub-Flavored Markdown（GFM）、表格、工作清單、提示區塊、註腳、定義清單、程式碼語法醒目提示、已清理的 HTML 與 MathJax。
- **視覺內容：** 轉譯 Mermaid、PlantUML、Graphviz／DOT、D2、Vega-Lite、WaveDrom、Markmap、GeoJSON、TopoJSON、STL 與 ABC 記譜。

<p align="center">
  <img src="https://github.com/user-attachments/assets/57a015a4-621c-4da3-9825-604724f5966b" alt="圖表插入模組" width="90%" />
  <img src="https://github.com/user-attachments/assets/e4560bc1-d6a7-409a-8a93-c054d0a853b3" alt="圖表轉譯範例" width="90%" />
  <img src="https://github.com/user-attachments/assets/d50d980d-1b40-43c7-b924-901c9413987d" alt="3D STL 檢視" width="90%" />
  <img src="https://github.com/user-attachments/assets/bbacabcf-eb19-4430-af19-1ab791afe01c" alt="全螢幕 3D STL 檢視" width="90%" />
</p>

- **導入與匯出：** 開啟本機檔案或公開 GitHub 內容，並匯出 Markdown、獨立 HTML、PNG、瀏覽器列印／另存為 PDF 或舊版點陣 PDF。
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
| GitHub 導入與表情符號查詢 | GitHub API／原始內容主機 |
| PlantUML、D2、Graphviz、Vega-Lite、WaveDrom 與部分圖表預覽 | 圖表原始碼可能傳送至 PlantUML、Kroki 或 mermaid.ink |
| 經同意後插入的圖片、GIF 與影片 | 透過公開連結存取的 Cloudflare 暫存媒體儲存空間（90 天） |
| 大型 Share Snapshot | Cloudflare KV（90 天） |
| Live Share | Cloudflare Durable Object WebSocket 轉送 |
| 外部圖片、媒體、連結與地圖圖磚 | 文件指定的外部主機 |

Share Snapshot 與 Live Share URL 都是持有者連結。任何取得有效連結的人都能使用連結內含的權限。Live Share 不提供端對端加密。在對敏感文件使用網路功能前，請先閱讀[隱私權與安全性（英文）](../wiki/Privacy-and-Security.md)。

## 媒體儲存方式

- 可插入 AVIF、BMP、GIF（包括動畫 GIF）、JPEG、PNG、WebP、MP4、WebM 與 Ogg。
- 首次同意後，媒體會上傳至 Cloudflare 暫存空間，並以短的內容定址 HTTPS URL 插入。
- 任何取得 URL 的人都能在連結到期前擷取媒體。
- 連結會在相同內容最近一次上傳的 90 天後到期。
- Share Snapshot 與 Live Share 只會分享 Markdown 中的 URL，不會建立另一份媒體副本。

## 主要限制

- Markdown Viewer 不設定文件數量上限；實際上限取決於瀏覽器配額或桌面檔案系統容量。
- 單一本機 Markdown 檔案的大小上限為 10 MB。
- GitHub 導入器在每個儲存庫／資料夾結果中最多顯示 30 個 Markdown 檔案。
- 處理前的媒體來源檔案上限為 25 MiB；儲存上限為靜態圖片 300 KiB、GIF 5 MiB、影片 10 MiB。
- 儲存型 Share Snapshot 最多包含 8,000,000 個字元，並在 90 天後到期。
- Live Share 最多允許 64 位 WebSocket 參與者，單一即時訊息上限為 8 MB。
- STL 原始碼上限為 2 MiB，轉譯後幾何最多為 300,000 個頂點。
- 點陣 PDF／PNG 匯出受瀏覽器記憶體、Canvas 與 CORS 限制。

## 重要隱私權說明

- 一般工作區資料會儲存在瀏覽器設定檔或桌面本機儲存空間。
- 啟用隱私模式會清除已持久儲存的文件狀態（包括 Secret Workspace 的加密資料），並停止後續持久儲存。
- **重設工作區**會刪除一般文件、審閱資料與 Secret Workspace 資料；Markdown Viewer 無法復原這些內容。
- Live Share 不會在伺服器端持久儲存 Markdown／審閱內容，但會將各角色的持有者權限值與建立時間寫入 Durable Object 儲存空間；目前未實作應用程式層級的到期時間或刪除路徑。
- Share Snapshot 建立 API 會傳回刪除權杖，但目前的介面不會顯示該權杖，也不提供提前刪除操作。
- 應用程式程式碼未實作帳號、分析、遙測、廣告、追蹤像素或應用程式專用 Cookie。外部服務與託管提供者仍可能處理一般要求記錄。

> **警告：** 啟用隱私模式或選取**重設工作區**前，請先將需要保留的文件匯出為 Markdown。

## 文件

詳細頁面以英文維護。

| 目的 | 頁面（英文） |
| :--- | :--- |
| 完整功能與限制 | [Features](../wiki/Features.md) |
| 日常操作與快速鍵 | [Usage Guide](../wiki/Usage-Guide.md) |
| Markdown／圖表語法 | [Markdown Reference](../wiki/Markdown-Reference.md) |
| Share Snapshot | [Share Snapshot](../wiki/Share-Snapshot.md) |
| Live Share | [Live Share](../wiki/Live-Share-Cloudflare.md) |
| 隱私權與安全性 | [Privacy and Security](../wiki/Privacy-and-Security.md) |
| 安裝與部署 | [Installation](../wiki/Installation.md) |
| 疑難排解 | [Troubleshooting](../wiki/Troubleshooting.md)／[FAQ](../wiki/FAQ.md) |
| 參與貢獻 | [Contributing](../wiki/Contributing.md) |
| 多語言術語與在地化 | [Localization and Terminology](../wiki/Localization.md) |

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

## 參與貢獻與授權條款

建立 Pull Request 前，請先閱讀 [Contributing（英文）](../wiki/Contributing.md)。可重現的錯誤與明確的功能建議可提交至 [Issue Tracker](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)。請勿在一般 Issue 中公開弱點細節。

Markdown Viewer 採用 [Apache License 2.0](../LICENSE)。
