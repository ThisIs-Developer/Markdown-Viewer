# Markdown Viewer

<div align="center">
  <img src="assets/icon.jpg" alt="Markdown Viewer Logo" width="140" />

  <p><strong>Professional GitHub-style Markdown editor and previewer</strong></p>
  <p>Live preview, diagrams, math, export tools, and multi-document workflows — all in your browser.</p>

  <p>
    <a href="https://markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">Live Demo</a> ·
    <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki" target="_blank" rel="noopener noreferrer">Documentation</a> ·
    <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/issues" target="_blank" rel="noopener noreferrer">Issues</a> ·
    <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/releases" target="_blank" rel="noopener noreferrer">Releases</a>
  </p>

  <p>
    <img alt="License" src="https://img.shields.io/github/license/ThisIs-Developer/Markdown-Viewer?color=2ea043" />
    <img alt="Latest release" src="https://img.shields.io/github/v/release/ThisIs-Developer/Markdown-Viewer" />
    <img alt="Last commit" src="https://img.shields.io/github/last-commit/ThisIs-Developer/Markdown-Viewer" />
    <img alt="Stars" src="https://img.shields.io/github/stars/ThisIs-Developer/Markdown-Viewer?style=flat" />
  </p>

  <p>
  <a href="https://codewiki.google/github.com/thisis-developer/markdown-viewer" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/CodeWiki-Explore-4285F4?logo=wikipedia&logoColor=white&style=flat" alt="CodeWiki" />
  </a>
  <a href="https://deepwiki.com/ThisIs-Developer/Markdown-Viewer" target="_blank" rel="noopener noreferrer">
    <img src="https://deepwiki.com/badge.svg" />
  </a>
</p>
<p>
  <a href="https://oosmetrics.com/repo/ThisIs-Developer/Markdown-Viewer" target="_blank" rel="noopener noreferrer">
    <img src="https://api.oosmetrics.com/api/v1/badge/achievement/b13c27be-447e-489d-a04d-55f7ccaf9175.svg" />
  </a>
</p>
</div>

---

## Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Documentation](#documentation)
- [Built With](#built-with)
- [Showcase](#showcase)
- [Contributing](#contributing)
- [Contributors](#contributors)
- [Development Journey](#development-journey)
- [License](#license)
- [Contact](#contact)

---

## About the Project

Markdown Viewer is a full-featured Markdown editor and preview application that renders GitHub-flavored Markdown in real time. It is entirely client-side, lightweight, and optimized for a professional writing workflow — from quick notes to technical documentation with diagrams and LaTeX.

---

## Features

**Editor & Preview**
- Live split-screen rendering with instant updates
- GitHub-flavored Markdown (GFM) support
- Syntax highlighting for 190+ languages
- GitHub-style alerts/admonitions (`[!NOTE]`, `[!TIP]`, `[!WARNING]`, etc.)
- Emoji shortcode rendering (JoyPixels) and native Unicode emoji support
- YAML frontmatter parsing with a rendered metadata table

**Diagrams & Math**
- LaTeX math rendering via MathJax (inline + block)
- Mermaid diagrams with an interactive toolbar (zoom, pan, copy, PNG/SVG export)

**File & Sharing Tools**
- Import from local files, drag & drop, or public GitHub URLs (multi-file selection)
- Export as Markdown, HTML (standalone), or PDF
- Share documents via URL with compressed content
- Copy rendered HTML directly to clipboard

**Productivity & Workflow**
- Multiple document tabs (new, rename, duplicate, delete)
- Reset all tabs in one action
- Drag-and-drop tab reordering
- Tab/session state saved in localStorage
- View modes: editor-only, preview-only, or split
- Resizable editor/preview panes
- Synchronized scrolling (toggleable)
- Live content statistics (words, characters, reading time)
- Keyboard shortcuts (export, copy, new/close tab, sync toggle, indentation)

**UI & Accessibility**
- Responsive layout with a dedicated mobile menu
- Light/dark themes with system preference support

**Privacy & Security**
- 100% client-side processing
- Sanitized HTML rendering with DOMPurify
- No tracking, no cookies, no server storage

---

## Screenshots

### Code Syntax Highlighting
![Code Syntax Highlighting](assets/code.png)

### Mathematical Expressions Support
![Mathematical Expressions](assets/mathexp.png)

### Mermaid Diagrams
![Mermaid Diagrams](assets/mermaid.png)

### Tables Support
![Tables Support](assets/table.png)

---

## Getting Started

### Option 1 — Docker (Recommended)
```bash
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:latest
```
Open **http://localhost:8080**.

### Option 2 — Docker Compose
```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
docker compose up -d
```

### Option 3 — Static Web Server
```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python3 -m http.server 8080
```

### Option 4 — Desktop App
Download pre-built binaries from the <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/releases" target="_blank" rel="noopener noreferrer">Releases</a> page or build from source (see the <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki/Desktop-App" target="_blank" rel="noopener noreferrer">Desktop App</a> guide).

---

## Usage

1. Write Markdown in the left editor pane.
2. Preview the rendered output on the right.
3. Import, export, share, or switch view modes using the toolbar.
4. Use the tab bar to manage multiple documents.

**Keyboard Shortcuts**
- `Ctrl/Cmd + S` → Export Markdown
- `Ctrl/Cmd + C` → Copy rendered HTML (when no text is selected)
- `Ctrl/Cmd + Shift + S` → Toggle sync scrolling (split view)
- `Ctrl/Cmd + T` → New tab
- `Ctrl/Cmd + W` → Close tab
- `Tab` → Insert indentation in editor

---

## Documentation

Explore the full documentation on the wiki:

- <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki/Features" target="_blank" rel="noopener noreferrer">Features</a>
- <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki/Usage-Guide" target="_blank" rel="noopener noreferrer">Usage Guide</a>
- <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki/Installation" target="_blank" rel="noopener noreferrer">Installation</a>
- <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki/Markdown-Reference" target="_blank" rel="noopener noreferrer">Markdown Reference</a>
- <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki/FAQ" target="_blank" rel="noopener noreferrer">FAQ</a>
- <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki/Configuration" target="_blank" rel="noopener noreferrer">Configuration</a>

---

## Built With

- HTML5, CSS3, JavaScript
- <a href="https://getbootstrap.com/" target="_blank" rel="noopener noreferrer">Bootstrap</a>
- <a href="https://marked.js.org/" target="_blank" rel="noopener noreferrer">Marked.js</a>
- <a href="https://highlightjs.org/" target="_blank" rel="noopener noreferrer">highlight.js</a>
- <a href="https://www.mathjax.org/" target="_blank" rel="noopener noreferrer">MathJax</a>
- <a href="https://mermaid.js.org/" target="_blank" rel="noopener noreferrer">Mermaid</a>
- <a href="https://github.com/cure53/DOMPurify" target="_blank" rel="noopener noreferrer">DOMPurify</a>
- <a href="https://github.com/eligrey/FileSaver.js" target="_blank" rel="noopener noreferrer">FileSaver.js</a>
- <a href="https://github.com/niklasvh/html2canvas" target="_blank" rel="noopener noreferrer">html2canvas</a> + <a href="https://www.npmjs.com/package/jspdf" target="_blank" rel="noopener noreferrer">jsPDF</a>
- <a href="https://www.joypixels.com/" target="_blank" rel="noopener noreferrer">JoyPixels</a>

---

## Showcase

**Built with Markdown Viewer**

| Project | Description |
|---------|-------------|
| <a href="https://github.com/jhrepo/markdown-desk" target="_blank" rel="noopener noreferrer">Markdown Desk</a> | Native macOS wrapper built with <a href="https://tauri.app/" target="_blank" rel="noopener noreferrer">Tauri</a>, adding live reload and native file open/save. |

---

## Contributing

Contributions are welcome! Please review the <a href="https://github.com/ThisIs-Developer/Markdown-Viewer/wiki/Contributing" target="_blank" rel="noopener noreferrer">Contributing Guide</a> and open a pull request.

---

## Contributors

Thanks to everyone who has contributed to Markdown Viewer.

<a href="https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors" target="_blank" rel="noopener noreferrer">
  <img src="https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer" alt="Contributors" />
</a>

---

## 📈 Development Journey

Markdown Viewer has grown from a lightweight Markdown parser into a full-featured, professional application with advanced rendering, workflow, and export capabilities. Compare the <a href="https://markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">current version</a> with the <a href="https://a1b91221.markdownviewer.pages.dev/" target="_blank" rel="noopener noreferrer">original version</a> to see the progress in UI design, performance optimization, and feature depth.

---

## License

This project is licensed under the Apache License. See <a href="LICENSE" target="_blank" rel="noopener noreferrer">LICENSE</a> for details.

---

## Contact

Developed and maintained by <a href="https://github.com/ThisIs-Developer" target="_blank" rel="noopener noreferrer">ThisIs-Developer</a>.
