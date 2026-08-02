<div align="center">

  <img src="../assets/icon.jpg" alt="Markdown Viewer 徽标" width="100" />

  <h1>Markdown Viewer</h1>

  **提供实时预览的本地优先 Markdown 编辑器与查看器**

  在浏览器、渐进式 Web 应用（PWA）、Docker 或 Neutralino 桌面应用中打开、编写、整理、审阅、渲染和导出 Markdown；需要时还可使用分享与协作功能。

  [![许可证](https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=red)](../LICENSE)
  [![最新版本](https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=FF6B00)](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

  <p>
    <a href="https://codewiki.google/github.com/thisis-developer/markdown-viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/badge/CodeWiki-Explore-4285F4?logo=wikipedia&logoColor=white&style=flat" alt="在 CodeWiki 上探索 Markdown Viewer" />
    </a>
    <a href="https://deepwiki.com/ThisIs-Developer/Markdown-Viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://deepwiki.com/badge.svg" alt="在 DeepWiki 上探索 Markdown Viewer" />
    </a>
  </p>

  [English](../README.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · **简体中文** · [繁體中文](README_tw.md)

  [打开 Web 应用](https://markdownviewer.pages.dev/) · [文档（英文）](../wiki/Home.md) · [报告问题](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) · [版本发布](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

</div>

<details>
<summary><strong>目录</strong>（点击展开）</summary>

- [Markdown Viewer 简介](#markdown-viewer-简介)
- [核心功能](#核心功能)
- [快速开始](#快速开始)
- [本地处理与网络处理](#本地处理与网络处理)
- [可视化渲染器概览](#可视化渲染器概览)
- [文档](#文档)
- [主要限制](#主要限制)
- [展示项目](#展示项目)
- [开发历程](#开发历程)
- [贡献者](#贡献者)
- [参与贡献与支持](#参与贡献与支持)
- [许可证](#许可证)

</details>

## Markdown Viewer 简介

Markdown Viewer 是一个开源、本地优先的工作区，适合开发者、写作者、学生、研究人员以及所有使用 `.md` 或 `.markdown` 文件的用户。它不止于纯文本：在一个专注的工作区中整理多个文档，在不改动 Markdown 的情况下通过评论和建议进行审阅，并渲染图表、地图、数据图、数学公式、3D 模型和音乐。

将文档转换为 Share Snapshot 链接以便快速分享，或启动带访问控制的 Live Share，进行实时协同编辑并使用实时光标、评论和建议。日常编辑在设备上完成。无需账号，应用也不包含广告、分析、遥测或订阅。

<p align="center">
  <img src="https://github.com/user-attachments/assets/5a0d6fda-96f0-4baf-bf7a-0ffbe5119eab" alt="Markdown Viewer 应用界面" width="90%" />
</p>

## 核心功能

- **工作区与文档：** 在 Web 端使用按文档划分的 IndexedDB 存储，并在嵌套文件夹中整理文档。还可使用最近使用、收藏夹、搜索、标签页、批量操作和加密的 Secret Workspace（秘密工作区）。
- **备份与恢复：** 导出或导入保留文件夹结构的工作区 ZIP。可以选择包含加密的 Secret Workspace 文件，但回收站和桌面历史记录不包含在备份中。
- **编辑与审阅：** 在编辑器、分屏视图和预览之间切换，使用格式工具、自定义撤销/重做、查找和替换、LTR/RTL、评论与建议。
- **Markdown 渲染：** 支持 CommonMark 风格基础语法、GitHub-Flavored Markdown（GFM）、表格、任务列表、提示块、脚注、定义列表、代码语法高亮、已清理的 HTML 和 MathJax。
- **可视化内容：** 渲染 Mermaid、PlantUML、Graphviz/DOT、D2、Vega-Lite、WaveDrom、Markmap、GeoJSON、TopoJSON、STL 和 ABC 记谱。

<p align="center">
  <img src="https://github.com/user-attachments/assets/57a015a4-621c-4da3-9825-604724f5966b" alt="图表插入模块" width="90%" />
  <img src="https://github.com/user-attachments/assets/e4560bc1-d6a7-409a-8a93-c054d0a853b3" alt="图表渲染示例" width="90%" />
  <img src="https://github.com/user-attachments/assets/d50d980d-1b40-43c7-b924-901c9413987d" alt="3D STL 视图" width="90%" />
  <img src="https://github.com/user-attachments/assets/bbacabcf-eb19-4430-af19-1ab791afe01c" alt="全屏 3D STL 视图" width="90%" />
</p>

- **导入与导出：** 打开本地文件，或打开来自分支、标签、提交 SHA 以及可选私有仓库的 GitHub 内容；支持导出 Markdown、独立 HTML、PNG、浏览器打印/另存为 PDF 或旧版栅格 PDF。
- **可选分享：** 创建“仅供查看”或“可以编辑”模式的 Share Snapshot（分享快照），或者启动具有主持人、可以编辑和仅供查看权限的临时 Live Share（实时共享）房间。

<p align="center">
  <img src="https://github.com/user-attachments/assets/0b2080e8-6ba8-4dac-a58a-d043fadeeb61" alt="Live Share 会话" width="90%" />
</p>

- **多种运行方式：** 使用托管 Web 应用、PWA、静态托管、Docker、Cloudflare 或 Neutralino 桌面应用。

有关已实现的行为和限制，请参阅[功能参考（英文）](../wiki/Features.md)。

## 快速开始

直接使用[托管 Web 应用](https://markdownviewer.pages.dev/)，或通过本地 HTTP 服务器运行仓库：

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python -m http.server 8080
```

打开 `http://localhost:8080`。不要依赖 `file://`；浏览器安全规则可能会阻止 Web Worker 和 Service Worker。

| 运行目标 | 详细文档（英文） |
| :--- | :--- |
| PWA/静态 Web 托管 | [安装](../wiki/Installation.md) |
| Docker | [Docker 部署](../wiki/Docker-Deployment.md) |
| Cloudflare Pages/KV/Durable Objects | [配置](../wiki/Configuration.md) |
| Neutralino 桌面应用 | [桌面应用](../wiki/Desktop-App.md) |

## 本地处理与网络处理

Markdown Viewer 以本地处理为优先，但并非所有功能都能离线运行。

| 操作 | 默认数据路径 |
| :--- | :--- |
| 编辑、本地导入、预览、工作区自动保存和大多数导出 | 设备本地 |
| Web 库与未缓存的渲染器依赖 | Web/PWA 版本向 CDN 发出请求 |
| GitHub 导入与表情符号查询 | 公开内容使用 GitHub API/原始内容主机；私有内容和 PAT 仅使用 `api.github.com` |
| PlantUML、D2、Graphviz、Vega-Lite、WaveDrom 和部分图表预览 | 图表源码可能发送到 PlantUML、Kroki 或 mermaid.ink |
| 经同意后插入的图片、GIF 和视频 | 通过公开链接访问的 Cloudflare 临时媒体存储（90 天） |
| 大型 Share Snapshot | Cloudflare KV（90 天） |
| Live Share | Cloudflare Durable Object WebSocket 中继；文档内容不会在服务器端持久保存 |
| 外部图片、媒体、链接和地图图块 | 文档指定的外部主机 |

Share Snapshot 和 Live Share URL 都是持有者链接。任何获得有效链接的人都可以使用其中包含的权限。Live Share 不提供端到端加密。在对敏感文档使用网络功能之前，请阅读[隐私与安全（英文）](../wiki/Privacy-and-Security.md)。

## 可视化渲染器概览

| 代码围栏 | 渲染路径 |
| :--- | :--- |
| `mermaid` | 客户端渲染；插入预览可能使用 mermaid.ink 或 Kroki |
| `plantuml` | PlantUML 服务器；Kroki 作为后备 |
| `d2`、`graphviz`、`dot`、`vega-lite`、`vegalite`、`wavedrom` | Kroki |
| `markmap` | 客户端 Markmap 和 D3 |
| `geojson`、`topojson` | 客户端 Leaflet；地图图块可能使用网络 |
| `stl` | 客户端 Three.js/WebGL |
| `abc` | 客户端 ABCJS；播放需要浏览器音频支持 |
| `math` 和 LaTeX 分隔符 | 客户端 MathJax |

远程渲染服务会接收其渲染的图表源码。如果不信任所配置的服务，请勿发送敏感图表源码。语法请参阅 [Markdown Reference（英文）](../wiki/Markdown-Reference.md)，限制请参阅[功能参考（英文）](../wiki/Features.md#insert-diagrams-charts-maps-models-and-music)。

## 文档

详细页面以英文维护。

| 目的 | 页面（英文） |
| :--- | :--- |
| 选择起始页面 | [Documentation Home](../wiki/Home.md) |
| 完整功能与限制 | [Features](../wiki/Features.md) |
| 日常使用与快捷键 | [Usage Guide](../wiki/Usage-Guide.md) |
| Markdown/图表语法 | [Markdown Reference](../wiki/Markdown-Reference.md) |
| Share Snapshot | [Share Snapshot](../wiki/Share-Snapshot.md) |
| Live Share | [Live Share](../wiki/Live-Share-Cloudflare.md) |
| 隐私与安全 | [Privacy and Security](../wiki/Privacy-and-Security.md) |
| 安装与部署 | [Installation](../wiki/Installation.md) |
| 配置存储、渲染器和 Cloudflare | [Configuration](../wiki/Configuration.md) |
| 故障排除 | [Troubleshooting](../wiki/Troubleshooting.md)/[FAQ](../wiki/FAQ.md) |
| 参与贡献 | [Contributing](../wiki/Contributing.md) |
| 多语言术语与本地化 | [Localization and Terminology](../wiki/Localization.md) |

## 主要限制

- 工作区备份导入不会合并工作区；确认后会永久替换当前工作区。
- 工作区备份不包含回收站、桌面历史记录或崩溃恢复日志。
- 大于 10 MB 的本地 Markdown 文件会被拒绝。
- GitHub 凭据保管库最多可保存 50 个命名 PAT；每个令牌名称最长为 60 个字符。
- 处理前的媒体源文件最大为 25 MiB；存储上限为静态图片 300 KiB、GIF 5 MiB、视频 10 MiB。
- 存储型 Share Snapshot 最多包含 8,000,000 个字符，并在 90 天后过期。
- Live Share 最多允许 64 个 WebSocket 参与者，单条实时消息最大为 8 MB。
- STL 源码最大为 2 MiB，渲染后的几何体最多为 300,000 个顶点。
- 桌面保管库为每个文档最多保留 20 个最近历史副本。
- 栅格 PDF/PNG 导出受浏览器内存、Canvas 与 CORS 限制。

详情请参阅 [Features: Known Technical Limits（英文）](../wiki/Features.md#known-technical-limits)。

## 展示项目

以下基于 Markdown Viewer 的社区项目由其开发者独立维护。

- [**Markdown Desk**](https://github.com/jhrepo/markdown-desk)：使用 Tauri 构建的原生 macOS 封装应用，增加了原生文件对话框与文件处理程序、菜单栏集成、自动重新加载和应用内更新功能。

## 开发历程

Markdown Viewer 最初是 PC 上的一个小型个人项目：一款源于好奇心、经历过错误与修正，并倾注了许多心力的简单 Markdown 查看器。<a href="https://a1b91221.markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">初始版本</a>目前仍可在线访问，也始终是这个项目的初心所在。

如需了解更完整的项目历史，请阅读 [Development Journey（英文）](../wiki/Development-Journey.md)。

## 贡献者

Markdown Viewer 在社区贡献者的共同参与下不断成长。

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors" target="_blank" rel="noopener noreferrer">
  <img src="https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer" alt="Markdown Viewer 贡献者" />
</a>

## 参与贡献与支持

创建 Pull Request 前，请阅读 [Contributing（英文）](../wiki/Contributing.md)。可复现的缺陷和明确的功能建议可提交至 [Issue Tracker](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)。

请勿在普通 Issue 中发布漏洞详情。请使用 [Contributing: Security Reports（英文）](../wiki/Contributing.md#security-reports)中说明的仓库私密安全报告渠道。

## 许可证

Markdown Viewer 采用 [Apache License 2.0](../LICENSE)。
