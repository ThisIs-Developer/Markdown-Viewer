# Markdown Viewer Wiki

Welcome to the **Markdown Viewer** wiki — your comprehensive reference for installation, configuration, and usage of the Markdown Viewer application.

## What is Markdown Viewer?

Markdown Viewer is a **professional, feature-rich, GitHub-style Markdown editor and live-preview application** that runs entirely in the browser. It provides real-time rendering, syntax highlighting, LaTeX math support, Mermaid diagrams, and much more — all without requiring any server-side processing, sign-up, or data uploads.

> **Privacy First**: All content is processed locally in your browser. Nothing you type is ever sent to a server.

---

## Quick Start

| Platform | Quick Command |
|----------|--------------|
| **Docker** | `docker run -p 8080:80 ghcr.io/thisis-developer/markdown-viewer:latest` |
| **Docker Compose** | `docker compose up -d` |
| **Desktop App** | Download the binary from [Releases](https://github.com/ThisIs-Developer/Markdown-Viewer/releases) |
| **Web (self-hosted)** | Serve the root directory with any static web server |

Then open **http://localhost:8080** in your browser.

---

## Wiki Pages

| Page | Description |
|------|-------------|
| [Installation](Installation) | Set up the application on Web, Docker, or Desktop |
| [Usage Guide](Usage-Guide) | Learn how to write, preview, import, and export |
| [Features](Features) | Explore all supported features in detail |
| [Markdown Reference](Markdown-Reference) | Complete syntax reference for all supported elements |
| [Development Journey](Development-Journey) | Evolution of the project from the original prototype to today |
| [Desktop App](Desktop-App) | Build and run the native desktop application |
| [Docker Deployment](Docker-Deployment) | Deploy with Docker and Docker Compose |
| [Configuration](Configuration) | Configure the application and its build tools |
| [Contributing](Contributing) | How to contribute to the project |
| [FAQ](FAQ) | Frequently asked questions |

---

## Feature Highlights

- 🖊️ **Live Split-Screen Editor** — Write on the left, see rendered output on the right in real-time
- 🌙 **Dark / Light Mode** — Toggle themes instantly with CSS variables
- 💡 **Syntax Highlighting** — 190+ programming languages via highlight.js
- 📐 **LaTeX Math** — Inline and block mathematical expressions via MathJax
- 📊 **Mermaid Diagrams** — Flowcharts, sequence diagrams, Gantt charts, and more
- 📤 **Export Options** — Save as Markdown, HTML, or PDF
- 📥 **File Import** — Drag & drop or file-picker import of `.md` files
- 🔗 **Share via URL** — Share content by compressing it into the URL
- 📋 **Copy to Clipboard** — One-click copy of the rendered HTML
- 📊 **Content Statistics** — Word count, character count, and estimated reading time
- 😀 **Emoji Support** — Full emoji set via JoyPixels
- 📱 **Responsive Design** — Works on desktop, tablet, and mobile
- 🔒 **Privacy Focused** — 100% client-side, no server required

---

## 📈 Development Journey

Markdown Viewer has grown from a lightweight Markdown parser into a production-ready writing tool. Visit the [Development Journey](Development-Journey) page for a concise comparison between the original prototype and the current release.

---

## Transparency & Data Handling

Markdown Viewer is designed to be transparent about how your data is handled:

- **Local-only processing**: Markdown rendering happens entirely in your browser.
- **Local storage**: Content and preferences are saved in your browser's `localStorage` for autosave and session restore.
- **Share links**: The Share feature encodes content into the URL hash; nothing is uploaded to a server.
- **GitHub import**: Importing from GitHub uses public GitHub APIs (`api.github.com`) and raw content (`raw.githubusercontent.com`).
- **CDN dependencies**: Third-party libraries load from public CDNs (cdnjs, jsDelivr). Self-hosting those assets eliminates external requests.
- **No analytics**: The app does not include tracking scripts, analytics beacons, or advertising pixels.

---

## Technology Stack

| Category | Technology |
|----------|-----------|
| Markup / Rendering | [marked.js](https://marked.js.org/) 9.1.6 |
| Syntax Highlighting | [highlight.js](https://highlightjs.org/) 11.9.0 |
| Math Rendering | [MathJax](https://www.mathjax.org/) 3.2.2 |
| Diagram Rendering | [Mermaid](https://mermaid.js.org/) 11.6.0 |
| HTML Sanitization | [DOMPurify](https://github.com/cure53/DOMPurify) 3.0.9 |
| UI Framework | [Bootstrap](https://getbootstrap.com/) 5.3.2 |
| Desktop Runtime | [Neutralinojs](https://neutralino.js.org/) 6.5.0 |
| Containerization | [Docker](https://www.docker.com/) / [Nginx Alpine](https://hub.docker.com/_/nginx) |

---

## Links

- 🏠 [GitHub Repository](https://github.com/ThisIs-Developer/Markdown-Viewer)
- 🐳 [Docker Image (GHCR)](https://github.com/ThisIs-Developer/Markdown-Viewer/pkgs/container/markdown-viewer)
- 📦 [Releases](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)
- 📄 [License (Apache 2.0)](https://github.com/ThisIs-Developer/Markdown-Viewer/blob/main/LICENSE)
