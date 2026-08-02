<div align="center">

  <img src="assets/icon.jpg" alt="Markdown Viewer logo" width="100" />

  <h1>Markdown Viewer</h1>

  **A local-first Markdown editor and viewer with live preview.**

  Open, write, organize, review, render, export, and optionally share Markdown in a browser, as a Progressive Web App (PWA), in Docker, or in the Neutralino desktop application.

  [![License](https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=red)](LICENSE)
  [![Latest release](https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer?style=flat-square&color=FF6B00)](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

  <p>
    <a href="https://codewiki.google/github.com/thisis-developer/markdown-viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://img.shields.io/badge/CodeWiki-Explore-4285F4?logo=wikipedia&logoColor=white&style=flat" alt="Explore Markdown Viewer on CodeWiki" />
    </a>
    <a href="https://deepwiki.com/ThisIs-Developer/Markdown-Viewer" target="_blank" rel="noopener noreferrer">
      <img src="https://deepwiki.com/badge.svg" alt="Explore Markdown Viewer on DeepWiki" />
    </a>
  </p>

  **English** · [日本語](locales/README_ja.md) · [한국어](locales/README_ko.md) · [简体中文](locales/README_zh.md) · [繁體中文](locales/README_tw.md)

  [Open the web app](https://markdownviewer.pages.dev/) · [Start with the documentation](wiki/Home.md) · [Report an issue](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) · [View releases](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)

</div>

<details>
<summary><strong>Table of contents</strong> (click to expand)</summary>

- [What Markdown Viewer Does](#what-markdown-viewer-does)
- [Highlights](#highlights)
- [Quick Start](#quick-start)
- [Local and Network Behavior](#local-and-network-behavior)
- [Visual Renderer Summary](#visual-renderer-summary)
- [Documentation](#documentation)
- [Important Limits](#important-limits)
- [Showcase Projects](#showcase-projects)
- [Development Journey](#development-journey)
- [Contributors](#contributors)
- [Contributing and Support](#contributing-and-support)
- [License](#license)

</details>

## What Markdown Viewer Does

Markdown Viewer is an open source, local-first workspace for developers, writers, students, researchers, and anyone working with `.md` or `.markdown` files. Go beyond plain text. Organize multiple documents, review with comments and suggestions without changing the Markdown, and render diagrams, maps, charts, math, 3D models, and music—all in one focused workspace.

Turn a document into a Share Snapshot link for quick handoffs, or start access-controlled Live Share for real-time co-editing, live cursors, comments, and suggestions. Everyday editing stays on your device. No account is required, and the application includes no ads, analytics, telemetry, or subscriptions.

<p align="center">
  <img src="https://github.com/user-attachments/assets/5a0d6fda-96f0-4baf-bf7a-0ffbe5119eab" alt="Application UI" width="90%" />
</p>

## Highlights

- **Workspace and documents:** organize documents in nested folders with per-document IndexedDB storage on the web; use Recent, Favorites, search, tabs, bulk actions, and an encrypted Secret Workspace.
- **Backup and restore:** export or import a folder-preserving workspace ZIP; encrypted Secret Workspace files are optional, while trash and desktop history stay outside the backup.
- **Editing and review:** switch among Editor, Split view, and Preview; use formatting tools, custom undo/redo, Find and Replace, LTR/RTL direction, comments, and suggestions.
- **Markdown rendering:** use CommonMark-style Markdown, GitHub-Flavored Markdown (GFM), tables, task lists, alerts, footnotes, definition lists, syntax highlighting, sanitized HTML, and MathJax.
- **Visual content:** render Mermaid, PlantUML, Graphviz/DOT, D2, Vega-Lite, WaveDrom, Markmap, GeoJSON, TopoJSON, STL, and ABC notation.

<p align="center">
  <img src="https://github.com/user-attachments/assets/57a015a4-621c-4da3-9825-604724f5966b" alt="Insert diagram module" width="90%" />
  <img src="https://github.com/user-attachments/assets/e4560bc1-d6a7-409a-8a93-c054d0a853b3" alt="Diagrams" width="90%" />
  <img src="https://github.com/user-attachments/assets/d50d980d-1b40-43c7-b924-901c9413987d" alt="3D STL" width="90%" />
  <img src="https://github.com/user-attachments/assets/bbacabcf-eb19-4430-af19-1ab791afe01c" alt="3D STL Full screen" width="90%" />
</p>

- **Import and export:** open local files or GitHub content from branches, tags, commit SHAs, and optionally private repositories; export Markdown, standalone HTML, PNG, Browser Print/Save as PDF, or a legacy raster PDF.

- **Optional sharing:** create a Share Snapshot with View only or Can edit access, or start a temporary Live Share room with host, Can edit, and View only capabilities.

<p align="center">
  <img src="https://github.com/user-attachments/assets/0b2080e8-6ba8-4dac-a58a-d043fadeeb61" alt="Live share" width="90%" />
</p>

- **Multiple delivery options:** use the hosted web app, install the PWA, self-host static files, run Docker, deploy on Cloudflare, or build the Neutralino desktop application.

For verified behavior, limits, and implementation notes, read the [feature reference](wiki/Features.md).

## Quick Start

Use the hosted application at [markdownviewer.pages.dev](https://markdownviewer.pages.dev/), or run the repository through a local HTTP server:

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python -m http.server 8080
```

Open `http://localhost:8080`. Do not rely on `file://`; browser security rules can block Web Workers and Service Workers.

Other options:

| Target | Start here |
| :--- | :--- |
| PWA or static web hosting | [Installation](wiki/Installation.md) |
| Docker | [Docker Deployment](wiki/Docker-Deployment.md) |
| Cloudflare Pages, KV, and Durable Objects | [Configuration](wiki/Configuration.md) |
| Neutralino desktop application | [Desktop Application](wiki/Desktop-App.md) |

## Local and Network Behavior

Markdown Viewer is local-first, not network-free. The following table shows the main boundary:

| Workflow | Default data path |
| :--- | :--- |
| Editing, local imports, Preview, Workspace autosave, and most exports | On the device |
| Web libraries and uncached renderer dependencies | CDN requests in the web/PWA build |
| GitHub import and emoji lookup | Public content uses GitHub APIs and raw-content hosts; private content uses an optional PAT only with `api.github.com` |
| PlantUML, D2, Graphviz, Vega-Lite, WaveDrom, and some diagram previews | Diagram source can be sent to PlantUML, Kroki, or mermaid.ink |
| Consented image, GIF, and video insertion | Public, content-addressed Cloudflare media storage for 90 days |
| Large Share Snapshot | Cloudflare KV for 90 days |
| Live Share | WebSocket relay through a Cloudflare Durable Object; document content is not persisted server-side |
| External images, media, links, and map tiles | The referenced external host |

Share Snapshot and Live Share URLs are bearer links. Anyone who obtains a valid link and capability can use the access it grants. Live Share is not end-to-end encrypted. See [Privacy and Security](wiki/Privacy-and-Security.md) before using network features with sensitive content.

## Visual Renderer Summary

| Fence | Rendering path |
| :--- | :--- |
| `mermaid` | Client-side; insertion previews can use mermaid.ink or Kroki |
| `plantuml` | PlantUML server; Kroki fallback |
| `d2`, `graphviz`, `dot`, `vega-lite`, `vegalite`, `wavedrom` | Kroki |
| `markmap` | Client-side Markmap and D3 |
| `geojson`, `topojson` | Client-side Leaflet; map tiles can use the network |
| `stl` | Client-side Three.js/WebGL |
| `abc` | Client-side ABCJS; playback needs browser audio support |
| `math` and LaTeX delimiters | Client-side MathJax |

Remote renderer services receive the source of the diagram they render. Do not send sensitive diagram source unless you trust the configured service. See the [Markdown Reference](wiki/Markdown-Reference.md) for syntax and the [feature reference](wiki/Features.md#insert-diagrams-charts-maps-models-and-music) for limitations.

## Documentation

| Need | Page |
| :--- | :--- |
| Choose a starting point | [Documentation Home](wiki/Home.md) |
| Review all product capabilities and limits | [Features](wiki/Features.md) |
| Learn day-to-day workflows and shortcuts | [Usage Guide](wiki/Usage-Guide.md) |
| Write supported Markdown and rich fences | [Markdown Reference](wiki/Markdown-Reference.md) |
| Understand Share Snapshot | [Share Snapshot](wiki/Share-Snapshot.md) |
| Understand Live Share | [Live Share](wiki/Live-Share-Cloudflare.md) |
| Review data handling and security boundaries | [Privacy and Security](wiki/Privacy-and-Security.md) |
| Install or deploy the product | [Installation](wiki/Installation.md) |
| Configure storage, renderers, and Cloudflare | [Configuration](wiki/Configuration.md) |
| Resolve common problems | [Troubleshooting](wiki/Troubleshooting.md) and [FAQ](wiki/FAQ.md) |
| Contribute code, documentation, or translations | [Contributing](wiki/Contributing.md) |
| Maintain translations and approved multilingual terms | [Localization and Terminology](wiki/Localization.md) |

## Important Limits

- Workspace backup import does not merge workspaces; it permanently replaces the current workspace after confirmation.
- Workspace backups do not include trash, desktop history, or crash-recovery journals.
- A local Markdown file larger than 10 MB is rejected.
- The GitHub credential vault stores up to 50 named PAT entries; each token name is limited to 60 characters.
- Managed source media is limited to 25 MiB before processing; stored payload limits are 300 KiB for still images, 5 MiB for GIFs, and 10 MiB for videos.
- Stored Share Snapshot content is limited to 8,000,000 characters and expires after 90 days.
- Live Share allows up to 64 WebSocket participants and 8 MB per live message.
- STL source is limited to 2 MiB and rendered geometry to 300,000 vertices.
- The desktop vault retains up to 20 recent history copies per document.
- Raster PDF and PNG exports remain subject to browser memory, canvas, and cross-origin resource limits.

See [Features: Known Technical Limits](wiki/Features.md#known-technical-limits) for context.

## Showcase Projects

The following community project builds on Markdown Viewer and is maintained independently:

- [**Markdown Desk**](https://github.com/jhrepo/markdown-desk): A native macOS wrapper built with Tauri that adds native file dialogs and handlers, menu-bar integration, automatic reloads, and in-app updates.

## Development Journey

Markdown Viewer started as a small personal project on a PC: a simple Markdown viewer built with curiosity, mistakes, fixes, and a lot of care. The <a href="https://a1b91221.markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">original version</a> is still online and remains at the heart of the project.

Read the [Development Journey](wiki/Development-Journey.md) for the longer project history.

## Contributors

Markdown Viewer grows through contributions from its community.

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors" target="_blank" rel="noopener noreferrer">
  <img src="https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer" alt="Markdown Viewer contributors" />
</a>

## Contributing and Support

Read [Contributing](wiki/Contributing.md) before opening a pull request. Use the [issue tracker](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) for reproducible bugs and focused feature requests.

Do not publish vulnerability details in a normal issue. Use the repository's private security-reporting channel when available, as described in [Contributing: Security Reports](wiki/Contributing.md#security-reports).

## License

Markdown Viewer is licensed under the [Apache License 2.0](LICENSE).
