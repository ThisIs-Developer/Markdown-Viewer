<div align="center">

  <img src="../assets/icon.jpg" alt="Markdown Viewer Logo" width="100" />

  <h1>Markdown Viewer - 在线 Markdown 编辑器与实时预览</h1>

  **一款基于浏览器的 Markdown 编辑器、查看器、预览器和阅读器。**

  *打开、阅读、编辑和预览 `.md` 文件，支持分屏实时 Markdown 预览、同步滚动、GitHub-Flavored Markdown、图表、地图、3D STL 预览、ABC 记谱播放、PDF/HTML/PNG 导出，以及 Web、桌面和 Docker 上的多标签文档工作区。*

  [![License](https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=red)](https://github.com/ThisIs-Developer/Markdown-Viewer/blob/main/LICENSE)
  [![Latest Release](https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=FF6B00)](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)
  [![Last Commit](https://img.shields.io/github/last-commit/ThisIs-Developer/Markdown-Viewer?style=flat-square)](https://github.com/ThisIs-Developer/Markdown-Viewer/commits/main)
  [![Stars](https://img.shields.io/github/stars/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=dfb317)](https://github.com/ThisIs-Developer/Markdown-Viewer/stargazers)

  <p>
    <a href="https://codewiki.google/github.com/thisis-developer/markdown-viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/badge/CodeWiki-Explore-4285F4?logo=wikipedia&logoColor=white&style=flat" alt="CodeWiki" />
    </a>
    <a href="https://deepwiki.com/ThisIs-Developer/Markdown-Viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://deepwiki.com/badge.svg" alt="DeepWiki" />
    </a>
  </p>

  🌐 [English](../README.md) • **简体中文** • [日本語](README_ja.md) • [한국어](README_ko.md) • <a href="../wiki/Localization.md">更多语言</a>

  [在线演示](https://markdownviewer.pages.dev/) • [Wiki](../wiki/Home.md#start-here) • [问题反馈](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) • [版本发布](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

</div>

## 目录

<details>
  <summary>📂 <b>目录</b>（点击展开）</summary>
  <br />

  - [项目简介](#项目简介)
  - [快速试用](#快速试用)
  - [核心功能](#核心功能)
  - [Markdown 编辑与实时预览](#markdown-编辑与实时预览)
  - [图表与可视化内容](#图表与可视化内容)
  - [分享、协作与导出](#分享协作与导出)
  - [系统架构](#系统架构)
    - [核心文件说明](#核心文件说明)
  - [开始使用与安装](#开始使用与安装)
  - [使用指南与快捷键](#使用指南与快捷键)
  - [项目目录结构](#项目目录结构)
  - [Built With（技术栈）](#built-with技术栈)
  - [隐私](#隐私)
  - [安全与隐私控制](#安全与隐私控制)
  - [贡献与代码质量](#贡献与代码质量)
  - [展示与社区项目](#展示与社区项目)
  - [贡献者](#贡献者)
  - [📈 开发历程](#-开发历程)
  - [许可证](#许可证)
  - [联系与支持](#联系与支持)
</details>

---

## 项目简介

**Markdown Viewer** 是一款开源、基于浏览器的 Markdown 编辑器和查看器，适用于 `.md` 和 `.markdown` 文件。它将纯文本 Markdown 编辑、GitHub 风格实时预览、多文档标签、图表即代码、数学公式、导出、分享，以及 Web/桌面部署选项组合在一起。

大多数编辑、预览、自动保存、本地文件导入、设置和导出都在你的设备上完成。需要网络的功能会明确说明。无需登录即可使用。

<p align="center">
  <img src="https://github.com/user-attachments/assets/ccfd7772-8874-4470-9282-7b0327a87bbd" alt="Markdown Viewer - 支持 GFM 渲染、多文档标签工作区和深色主题的分屏实时 Markdown 编辑器与预览器" width="90%" />
</p>

## 快速试用

1. 打开 [在线 Markdown 编辑器](https://markdownviewer.pages.dev/)。
2. 拖入 `.md` 或 `.markdown` 文件，或直接开始编写。
3. 根据需要使用实时预览、**Insert Diagram & More**、导出菜单、Share Snapshot 或 Live Share。

更多说明请查看 Wiki 中的 [功能](../wiki/Features.md#product-summary)、[隐私](../wiki/Home.md#privacy-at-a-glance)、[分享](../wiki/Features.md#share-markdown-with-snapshot-links)、[导出](../wiki/Features.md#export-markdown-to-pdf-html-png-and-md) 和 [桌面版](../wiki/Features.md#desktop-app) 部分。

## 核心功能

Markdown Viewer 覆盖常见 Markdown 基础能力，同时帮助用户在不离开编辑器的情况下创建更丰富的技术文档。

1. **GitHub-Flavored Markdown (GFM)**：编写普通 Markdown，并支持表格、任务列表、删除线、自动链接、代码块、提示块、脚注和实时预览。大多数 Markdown 编辑器都覆盖基础功能；下面的功能展示了 Markdown Viewer 为更丰富的技术文档额外提供的能力。
2. **Advanced Diagram Support & More**：一个 **Insert Diagram & More** 按钮会打开可视化模板、预览和可直接插入的示例，让用户无需记住每种语法也能添加复杂内容。

   - **Mermaid**：创建流程图、时序图、甘特图、状态图和适合文档的架构可视化。
   - **PlantUML**：为软件设计笔记添加时序图、类图、用例图和工程图。
   - **Graphviz**：渲染用于树、依赖关系图和网络关系的 DOT 图。
   - **D2**：使用现代布局输出构建清晰的图表即代码。
   - **Vega-Lite**：直接在 Markdown 中描述图表和数据可视化。
   - **Markmap**：将嵌套 Markdown 列表转换为适合规划和学习笔记的思维导图。
   - **WaveDrom**：为硬件或协议工作记录时序图和信号波形。
   - **Map**：在不离开文档的情况下预览 GeoJSON 和 TopoJSON 数据。
   - **STL 3D Model Renderer**：在技术笔记旁预览 3D 模型。
   - **ABC Music Player & Sheet Music Viewer**：乐谱渲染和浏览器播放。

3. **文档资源管理器与双文档分屏**：在嵌套文件夹中整理最多 50 个已存储文件，使用批量文件操作，并在两个并排文档中完整渲染 Markdown、数学公式、图表、地图、STL 和 ABC 记谱。
4. **Comments & Suggestions**：无需更改 Markdown 源码，即可在渲染后的文档块上添加、管理和解决反馈。
5. **Live Share Temporary Rooms**：通过服务器验证的主持人、可编辑和仅查看权限进行实时协作，适合快速编辑、审阅或结对写作。
6. **Share Snapshot Links**：在需要快速发送文档状态时，创建只读或可编辑的时间点快照链接。较大的已存储快照会在 90 天后过期。
7. **LaTeX Math Notation**：使用 MathJax 渲染行内和块级公式，适合数学笔记、论文和技术说明。
8. **Markdown to PDF, HTML & PNG Export**：导出 Markdown、HTML、PNG、浏览器打印/另存为 PDF，或 Legacy Raster PDF，适合需要分享、打印或归档的文档。
9. **隐私与安全控制**：在工作区设置中启用隐私模式，使文档和审阅数据仅保留在当前会话中；预览会经过清理，导出的 HTML 经过安全加固，桌面原生 API 也受到限制。

完整细节、限制和隐私说明请查看 [功能参考](../wiki/Features.md#product-summary)。

## Markdown 编辑与实时预览

- 编写纯文本 Markdown，同时实时预览渲染 GFM、语法高亮、数学公式、提示块、脚注、表格、任务列表和已清理的 HTML。
- 在响应式资源管理器中整理最多 50 个已存储 Markdown 文件。它包含固定的 Workspace 和 Secret Workspace 根目录、嵌套文件夹、搜索、最近使用、收藏、拖放移动、悬停展开文件夹和边缘自动滚动。Secret Workspace 内容会在设备上用密码加密。
- 从文件菜单并排打开两个文档。一个共享控件可让两侧在编辑和预览之间切换；预览模式能渲染 Markdown、数学公式、Mermaid 和远程图表、地图、STL 模型与 ABC 记谱。可以在资源管理器中多选文件并批量打开、移动或删除，也可以右键空白区域或文档区域打开相关操作。
- 在编辑器光标处粘贴、上传或拖入图片、动画 GIF，以及 MP4、WebM 或 Ogg 视频。进度提示会显示上传状态；托管媒体使用短的内容寻址 HTTPS 链接，可在刷新、Share Snapshot、Live Share 和 Markdown 导出后继续使用，直到 90 天后过期。首次同意后，也可以转换已有的内嵌栅格图片。
- 使用 WYSIWYG 风格的工具栏辅助功能，同时保留对纯文本 Markdown 源码的完全控制。
- 通过防抖渲染和后台 Worker 预览大型文档，让输入保持响应迅速。

## 图表与可视化内容

Markdown Viewer 也适合作为技术笔记、文档、硬件说明、音乐片段和数据密集型文档中的 Markdown 图表编辑器。

- **Mermaid、PlantUML、Graphviz / DOT 和 D2**：用于流程图、时序图、类图、架构草图、依赖关系图和图表即代码工作流。
- **Vega-Lite 和 Markmap**：用于 Markdown 图表、数据可视化和思维导图。
- **WaveDrom**：用于时序图和信号文档。
- **GeoJSON 和 TopoJSON 地图**：用于带位置数据的 Markdown 文档。
- **STL 3D 模型预览**：用于在笔记旁检查 3D 模型片段。
- **ABC 记谱**：用于乐谱渲染和浏览器播放。

<p align="center">
  <img src="https://github.com/user-attachments/assets/15c87e8c-43f0-4a4f-a4d7-81e98ba5c1cb" alt="图表支持与更多功能" width="90%" />
  <img src="https://github.com/user-attachments/assets/4341040b-eddd-40fa-8d1f-ba6ec9ac1010" alt="ABC 音乐记谱与音频合成" width="90%" />
  <img src="https://github.com/user-attachments/assets/606b1666-7359-4872-bb98-e3ae37b65ca9" alt="STL 3D 模型渲染器" width="90%" />
</p>

## 分享、协作与导出

- **Comments & Suggestions** 在不更改 Markdown 的情况下，为渲染后的 YAML、标题、段落、代码块和图表添加审阅层。反馈可以添加、编辑、解决、重新打开、删除或复制；它保存在普通标签中，并且只在活跃的 Live Share 房间内同步。
- **Share Snapshot** 创建用于时间点 Markdown 分享的快速链接。小文档可以保留在 URL hash 中；较大的快照会在配置该后端时使用 Cloudflare KV 临时存储最多 90 天。快照属于持有链接即可访问的链接，任何拿到链接的人都能打开。
<p align="center">
  <img src="https://github.com/user-attachments/assets/e62ca1a0-011a-4b01-90f9-e72638b9a6d5" alt="Share Snapshot" width="90%" />
</p>

- **Live Share rooms** 通过 Cloudflare Durable Objects 提供临时协作编辑，并由服务器检查主持人、可编辑和仅查看权限。它适用于审阅和结对写作，但不是端到端加密。
<p align="center">
  <img src="https://github.com/user-attachments/assets/4d7a72c7-8eec-48df-9f66-49fe9f205d4f" alt="Live Share rooms" width="90%" />
</p>

- **Markdown export** 下载原始 `.md` 文档。
- **HTML export** 创建独立渲染文档。
- **PDF export** 包括浏览器打印/另存为 PDF 和 Legacy Raster PDF。
- **PNG export** 将渲染预览捕获为图片。

---

## 系统架构

Markdown Viewer 是一个客户端单页应用。`script.js` 控制界面，`preview-worker.js` 在后台编译 Markdown，`sw.js` 处理具备离线能力的缓存。

### 核心文件说明

1. **`index.html`**：应用布局以及脚本/样式入口。
2. **`script.js`**：标签页、编辑器状态、预览更新、导入、导出、分享和 UI 行为。
3. **`styles.css`**：布局、主题、预览样式和打印样式。
4. **`preview-worker.js`**：后台 Markdown 解析和语法高亮。
5. **`sw.js`**：具备离线能力的资源缓存。

---

## 开始使用与安装

### 💻 方式 1：快速本地运行（无需安装）

请通过本地 HTTP 服务器运行，而不是用 `file://` 直接打开 `index.html`：

1. 克隆或下载仓库。
2. 在仓库目录打开终端。
3. 运行 `python -m http.server 8080` 或 `npx serve . -p 8080`。
4. 在浏览器中打开 **[http://localhost:8080](http://localhost:8080)**。

---

### 🐳 方式 2：Docker 容器部署

在容器中运行应用：

**预构建 Docker 镜像（GHCR）：**

```bash
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:latest
```

在浏览器中打开 **[http://localhost:8080](http://localhost:8080)**。

**本地 Docker Compose 构建：**
```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
docker compose up -d
```
在浏览器中打开 **[http://localhost:8080](http://localhost:8080)**。

---

### 🖥️ 方式 3：构建桌面应用

从源代码构建 Neutralinojs 桌面应用：

1. 克隆仓库并进入 `desktop-app/` 目录：
   ```bash
   cd desktop-app
   ```
2. 安装依赖并构建：
   ```powershell
   npm install
   npm run build
   ```

`npm run build` 会下载所需的 Neutralino 二进制文件、准备本地资源，并创建七个独立运行的平台可执行文件。

也可以从 [Releases](https://github.com/ThisIs-Developer/Markdown-Viewer/releases) 下载预构建二进制文件。

---

## 使用指南与快捷键

请阅读 [使用指南](../wiki/Usage-Guide.md#workspace-layout-for-editing-and-previewing-markdown)，了解工作流、编辑器控制、导出、分享和快捷键。

---

## 项目目录结构

```text
Markdown-Viewer/
+-- index.html              # Web 应用主界面
+-- script.js               # 应用逻辑和界面控制
+-- styles.css              # 应用与预览样式
+-- preview-worker.js       # Markdown 预览 Worker
+-- sw.js                   # Service Worker 缓存
+-- assets/                 # 应用图片和图标
|   +-- i18n/              # 界面语言目录和生成器
+-- functions/              # Cloudflare Pages Functions
+-- workers/                # Live Share Worker 源码
+-- desktop-app/            # Neutralinojs 桌面版
+-- locales/                # 本地化 README
+-- wiki/                   # 项目文档
+-- Dockerfile              # Docker 镜像配置
+-- docker-compose.yml      # 本地容器配置
+-- wrangler.toml           # Cloudflare 部署配置
+-- README.md               # 项目概览
+-- CHANGELOG.md            # 版本记录
+-- LICENSE                 # Apache License 2.0
```

---

## Built With（技术栈）

<p align="left">
  <a href="https://developer.mozilla.org/zh-CN/docs/Web/HTML"><img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5" /></a>
  <a href="https://developer.mozilla.org/zh-CN/docs/Web/CSS"><img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3" /></a>
  <a href="https://developer.mozilla.org/zh-CN/docs/Web/JavaScript"><img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript" /></a>
  <a href="https://getbootstrap.com"><img src="https://img.shields.io/badge/Bootstrap-7952B3?style=flat-square&logo=bootstrap&logoColor=white" alt="Bootstrap" /></a>
  <a href="https://neutralino.js.org"><img src="https://img.shields.io/badge/NeutralinoJS-FFA500?style=flat-square&logo=neutralinojs&logoColor=white" alt="NeutralinoJS" /></a>
</p>

核心技术栈：HTML、CSS、JavaScript、Bootstrap、Bootstrap Icons、Neutralinojs、Marked.js、Highlight.js、DOMPurify、MathJax、Mermaid、Leaflet、Three.js、ABCJS、Markmap、Yjs、jsPDF、html2canvas 和 Cloudflare Pages/Workers。

依赖加载行为、CDN 使用和桌面本地库副本请查看 [客户端库说明](../wiki/Configuration.md#client-libraries)。

部分高级图表引擎会在需要时使用 PlantUML、Kroki 或 mermaid.ink 等远程渲染器。渲染器行为和隐私细节请查看 [图表渲染器说明](../wiki/Features.md#insert-diagrams-charts-maps-models-and-music)。

---

## 隐私

Markdown Viewer 不是云端工作区。普通输入、预览渲染、本地文件导入、标签自动保存、主题设置和大多数导出都在你的设备上进行。无需登录，应用也没有实现分析、遥测、广告或跟踪 Cookie。

网络使用只会发生在用户触发的功能中，例如经过同意的托管媒体上传、GitHub 导入、远程图表渲染器、Share Snapshot、Live Share、CDN 库和外部文档资源。工作区设置中的隐私模式会让文档内容、工作区状态和审阅反馈仅保留在当前会话中，同时仍可使用编辑和审阅工具。完整说明请查看 [数据处理摘要](../wiki/Features.md#data-handling-summary)。

## 安全与隐私控制

- 预览 HTML 在插入前会经过清理；导出的 HTML 使用严格的 CSP，并为外部资源提供 SRI 元数据。
- Secret Workspace 使用 PBKDF2-SHA-256 从密码生成本地密钥，并用 AES-GCM 加密文件和文件夹名称。密钥只在解锁会话中保留，忘记的密码无法恢复。
- Cloudflare Pages 通过 `_headers` 提供 CSP、防点击劫持、引用来源策略、权限策略和 MIME 类型保护；敏感路径会重定向到 404。
- 托管媒体和已存储的 Share Snapshot API 上传仅允许生产站点、预览站点、`null` 和本地开发来源。托管图片、GIF 和视频可通过难以猜测的公开链接访问 90 天；快照响应使用 `no-store`，创建者会收到删除令牌。
- STL 渲染会在 WebGL 处理前拒绝过大的源、非有限几何数据和过多顶点。
- Neutralino 桌面版不开放默认的 `os.execCommand`，原生 API 仅使用明确的允许列表。详情请查看 [安全模型](../wiki/Features.md#security-model) 和 [配置参考](../wiki/Configuration.md#share-api)。

---

## 贡献与代码质量

欢迎社区贡献！创建 Pull Request 前，请先查看 [修改代码前的贡献指南](../wiki/Contributing.md#before-changing-code)。

### 核心工作流摘要：
1. **Fork** 仓库并创建功能分支（`git checkout -b feature/your-feature`）。
2. **验证代码风格：** 在 HTML、CSS 和 JS 文件中保持干净的 2 空格缩进。确保原始 HTML 结构语义化。避免在处理 Worker 中直接查询 DOM。
3. **Conventional Commits：** 使用带有 `feat:`、`fix:`、`docs:`、`style:`、`refactor:`、`perf:` 或 `chore:` 前缀的清晰提交消息。
4. **测试：** 在 Chrome、Firefox、Edge 和 Safari 视口中测试你的修改。

---

## 展示与社区项目

*   **[Markdown Desk](https://github.com/jhrepo/markdown-desk)：** 一个使用 Tauri 构建的原生 macOS 包装器，添加了原生文件系统处理、菜单栏集成和自动重新加载能力。

---

## 贡献者

感谢所有为 Markdown Viewer 做出贡献的人。

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors" target="_blank" rel="noopener noreferrer">
  <img src="https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer" alt="Contributors" />
</a>

---

## 📈 开发历程

Markdown Viewer 最初是 PC 上的一个小型个人项目：一个带着好奇、错误、修复和许多用心构建出来的简单 Markdown 查看器。<a href="https://a1b91221.markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">原始版本</a> 仍然在线，它依然是这个项目的初心。

当前的 <a href="https://markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">Markdown Viewer</a> 通过社区反馈、Issue、PR、截图、GIF、建议和真实文档工作流逐渐成长。技术进步很重要，但这段旅程也有情感的一面：许多人帮助这个应用成长为今天的样子。

---

## 许可证

本项目基于 Apache License 2.0 授权。完整条款和条件请查看 [LICENSE](../LICENSE) 文件。

---

## 联系与支持

由 **[ThisIs-Developer](https://github.com/ThisIs-Developer)** 开发和维护。

*   **错误报告与功能请求：** [提交 Issue](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)
*   **文档：** [Wiki 入门](../wiki/Home.md#start-here)
