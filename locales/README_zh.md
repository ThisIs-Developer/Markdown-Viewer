<div align="center">

  <img src="../assets/icon.jpg" alt="Markdown Viewer 徽标" width="100" />

  <h1>Markdown Viewer</h1>

  **提供实时预览的本地优先 Markdown 编辑器与查看器**

  在浏览器、渐进式 Web 应用（PWA）、Docker 或 Neutralino 桌面应用中打开、编写、整理、审阅、渲染和导出 Markdown；需要时还可使用分享与协作功能。

  [![许可证](https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=red)](../LICENSE)
  [![最新版本](https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=FF6B00)](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

  [English](../README.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · **简体中文** · [繁體中文](README_tw.md)

  [打开 Web 应用](https://markdownviewer.pages.dev/) · [文档（英文）](../wiki/Home.md) · [报告问题](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) · [版本发布](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

</div>

## Markdown Viewer 简介

Markdown Viewer 是一款面向 `.md` 和 `.markdown` 文档的开源编辑器。它将纯文本编辑器、已清理的预览、多文档工作区、审阅工具、丰富的渲染器、导入/导出、Share Snapshot 和 Live Share 集成在一个应用中。

它适合希望在无需注册账号的情况下使用 Markdown 的开发者、技术写作者、学生和研究人员。常规编辑、预览渲染、本地文件导入、文档整理和大多数导出操作都在设备上完成。需要网络的功能会在本文中明确说明。

## 核心功能

- **工作区与文档：** 在嵌套文件夹中整理最多 50 个文档，并使用最近使用、收藏夹、搜索、标签页、批量操作和加密的 Secret Workspace（秘密工作区）。
- **编辑与审阅：** 在编辑器、分屏视图和预览之间切换，使用格式工具、自定义撤销/重做、查找和替换、LTR/RTL、评论与建议。
- **Markdown 渲染：** 支持 CommonMark 风格基础语法、GitHub-Flavored Markdown（GFM）、表格、任务列表、提示块、脚注、定义列表、代码语法高亮、已清理的 HTML 和 MathJax。
- **可视化内容：** 渲染 Mermaid、PlantUML、Graphviz/DOT、D2、Vega-Lite、WaveDrom、Markmap、GeoJSON、TopoJSON、STL 和 ABC 记谱。
- **导入与导出：** 打开本地文件或公开 GitHub 内容，导出 Markdown、独立 HTML、PNG、浏览器打印/另存为 PDF 或旧版栅格 PDF。
- **可选分享：** 创建“仅供查看”或“可以编辑”模式的 Share Snapshot（分享快照），或者启动具有主持人、可以编辑和仅供查看权限的临时 Live Share（实时共享）房间。
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
| GitHub 导入与表情符号查询 | GitHub API/原始内容主机 |
| PlantUML、D2、Graphviz、Vega-Lite、WaveDrom 和部分图表预览 | 图表源码可能发送到 PlantUML、Kroki 或 mermaid.ink |
| 经同意后插入的图片、GIF 和视频 | 通过公开链接访问的 Cloudflare 临时媒体存储（90 天） |
| 大型 Share Snapshot | Cloudflare KV（90 天） |
| Live Share | Cloudflare Durable Object WebSocket 中继 |
| 外部图片、媒体、链接和地图图块 | 文档指定的外部主机 |

Share Snapshot 和 Live Share URL 都是持有者链接。任何获得有效链接的人都可以使用其中包含的权限。Live Share 不提供端到端加密。在对敏感文档使用网络功能之前，请阅读[隐私与安全（英文）](../wiki/Privacy-and-Security.md)。

## 媒体存储方式

- 可插入 AVIF、BMP、GIF（包括动画 GIF）、JPEG、PNG、WebP、MP4、WebM 和 Ogg。
- 首次同意后，媒体会上传到 Cloudflare 临时存储，并以短的内容寻址 HTTPS URL 插入。
- 任何获得 URL 的人都能在链接过期前获取媒体。
- 链接会在相同内容最近一次上传的 90 天后过期。
- Share Snapshot 与 Live Share 只会分享 Markdown 中的 URL，不会创建另一份媒体副本。

## 主要限制

- 工作区最多包含 50 个文档，其中包括已锁定 Secret Workspace 的计数和临时 Share Snapshot/Live Share 标签页。
- 单个本地 Markdown 文件最大为 10 MB。
- GitHub 导入器在每个仓库/文件夹结果中最多显示 30 个 Markdown 文件。
- 处理前的媒体源文件最大为 25 MiB；存储上限为静态图片 300 KiB、GIF 5 MiB、视频 10 MiB。
- 存储型 Share Snapshot 最多包含 8,000,000 个字符，并在 90 天后过期。
- Live Share 最多允许 64 个 WebSocket 参与者，单条实时消息最大为 8 MB。
- STL 源码最大为 2 MiB，渲染后的几何体最多为 300,000 个顶点。
- 栅格 PDF/PNG 导出受浏览器内存、Canvas 与 CORS 限制。

## 重要隐私说明

- 常规工作区数据存储在浏览器配置文件或桌面本地存储中。
- 启用隐私模式会清除已持久化的文档状态（包括 Secret Workspace 的加密数据），并停止后续持久化。
- **重置工作区**会删除常规文档、审阅数据和 Secret Workspace 数据；Markdown Viewer 无法恢复这些内容。
- Live Share 不会在服务器端持久保存 Markdown/审阅内容，但会将各角色的持有者权限值和创建时间写入 Durable Object 存储；当前未实现应用级过期时间或删除路径。
- Share Snapshot 创建 API 会返回删除令牌，但当前界面不会显示该令牌，也不提供提前删除操作。
- 应用代码未实现账号、分析、遥测、广告、跟踪像素或应用专用 Cookie。外部服务和托管提供商仍可能处理常规请求日志。

> **警告：** 启用隐私模式或选择**重置工作区**之前，请先将需要保留的文档导出为 Markdown。

## 文档

详细页面以英文维护。

| 目的 | 页面（英文） |
| :--- | :--- |
| 完整功能与限制 | [Features](../wiki/Features.md) |
| 日常使用与快捷键 | [Usage Guide](../wiki/Usage-Guide.md) |
| Markdown/图表语法 | [Markdown Reference](../wiki/Markdown-Reference.md) |
| Share Snapshot | [Share Snapshot](../wiki/Share-Snapshot.md) |
| Live Share | [Live Share](../wiki/Live-Share-Cloudflare.md) |
| 隐私与安全 | [Privacy and Security](../wiki/Privacy-and-Security.md) |
| 安装与部署 | [Installation](../wiki/Installation.md) |
| 故障排除 | [Troubleshooting](../wiki/Troubleshooting.md)/[FAQ](../wiki/FAQ.md) |
| 参与贡献 | [Contributing](../wiki/Contributing.md) |
| 多语言术语与本地化 | [Localization and Terminology](../wiki/Localization.md) |

## 参与贡献与许可证

创建 Pull Request 前，请阅读 [Contributing（英文）](../wiki/Contributing.md)。可复现的缺陷和明确的功能建议可提交至 [Issue Tracker](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)。请勿在普通 Issue 中发布漏洞详情。

Markdown Viewer 采用 [Apache License 2.0](../LICENSE)。
