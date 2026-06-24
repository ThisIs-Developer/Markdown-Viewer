# Welcome to the Markdown Viewer Wiki

Welcome to the official technical documentation and user wiki for the **Markdown Viewer** application (v3.8.0). This repository contains detailed configuration guides, architecture documents, installation instructions, and user manuals to help you customize, deploy, and contribute to this client-side Markdown editing suite.

---

## 🚀 Quick Start Portal

To deploy or run a local instance of the application immediately, execute the corresponding command for your environment:

| Deployment Method | Command | Default Access URL |
| :--- | :--- | :--- |
| **Docker (Pre-built)** | `docker pull ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0 && docker run -d -p 8080:80 ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0` | `http://localhost:8080` / `http://127.0.0.1:8080` |
| **Docker Compose** | `git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git && cd Markdown-Viewer && docker compose up -d` | `http://localhost:8080` / `http://127.0.0.1:8080` |
| **Python Static Server** | `python3 -m http.server 8080` (Run inside repository root to serve `index.html` on localhost/`127.0.0.1`) | `http://localhost:8080` / `http://127.0.0.1:8080` |
| **Node.js Static Server** | `npx serve . -p 8080` (Run inside repository root to serve `index.html` on localhost/`127.0.0.1`) | `http://localhost:8080` / `http://127.0.0.1:8080` |
| **Desktop Application** | Download execution package from [GitHub Releases](https://github.com/ThisIs-Developer/Markdown-Viewer/releases) | Launch native binary |

---

## 🗺️ Wiki Table of Contents

Use the navigation map below to explore the technical documentation sections of this wiki:

| Document / Section | Scope & Contents |
| :--- | :--- |
| **[Features](Features)** | Under-the-hood engineering deep-dive on compilation workers, DOM patching, and proportional scroll synchronization. |
| **[Installation](Installation)** | Detailed multi-platform setup instructions for Docker, Docker Compose, static web servers, and Neutralinojs compile pipelines. |
| **[Usage Guide](Usage-Guide)** | Standard operations manual detailing tab workspaces, file importing rules, and complete keyboard shortcuts mapping. |
| **[Configuration](Configuration)** | Analysis of localStorage schemas, CDN assets links, Docker Nginx blocks, and Neutralino desktop runtime settings. |
| **[Docker Deployment](Docker-Deployment)** | Production Docker customization guide containing security headers, custom context paths, and reverse proxy files. |
| **[Desktop App](Desktop-App)** | Build workflow documentation for packaging native desktop executable wrappers on Windows, Linux, and macOS. |
| **[Development Journey](Development-Journey)** | Evolution milestones of the project, comparison matrices between early prototype and v3.8.0, and design history. |
| **[Markdown Reference](Markdown-Reference)** | Exhaustive writing template guide for GFM extensions, MathJax LaTeX equations, and Mermaid charts. |
| **[FAQ](FAQ)** | Frequently Asked Questions on local privacy, memory utilization, export troubleshooting, and desktop security warnings. |
| **[Contributing](Contributing)** | Development environment configuration guides, 2-space styling parameters, conventional commits, and PR reviews. |

---

## 🛡️ Core Architectural Principles

Markdown Viewer is designed with four fundamental principles in mind:

1.  **Zero-Server Privacy:** 100% client-side execution. The application has no tracking telemetry, cookie banners, analytical beacons, or external database integrations. Your content never leaves the browser.
2.  **Off-Thread Processing:** Offloads intensive compiling and syntax coloring jobs from the main execution thread to dedicated Web Workers to ensure a 60fps typing experience even on files exceeding 100 KB.
3.  **Visual Synchronization:** Renders layout and styles identical to GitHub's native Markdown representations, optimized dynamically for desktop, tablet, and mobile views.
4.  **Local-First Persistence:** Integrates HTML5 Service Workers to intercept asset queries, serving core library script archives from the local browser storage to enable offline functionality.

---

## 🛠️ Global Technology Stack

| Dependency Library | Version | Caching Tier | Role & Features |
| :--- | :--- | :--- | :--- |
| **Marked.js** | `9.1.6` | Precached (Main/Worker) | Markdown syntax parser and GFM compiler. |
| **Highlight.js** | `11.9.0` | Precached (Worker Thread) | Syntactical color parsing for 190+ programming languages. |
| **DOMPurify** | `3.0.9` | Precached (Main Thread) | DOM tree cleaning for XSS injection vulnerability blocks. |
| **MathJax** | `3.2.2` | Lazy Cached (Dynamic) | LaTeX typesetting rendering engine. |
| **Mermaid.js** | `11.15.0` | Lazy Cached (Dynamic) | Flowcharts, sequences, and architectural diagram blocks builder. |
| **jsPDF** | `2.5.1` | Lazy Cached (Dynamic) | Client-side paginated PDF document builder. |
| **html2canvas** | `1.4.1` | Lazy Cached (Dynamic) | Compiles CSS element layouts to canvas raster grids. |
| **Pako.js** | `2.1.0` | Lazy Cached (Dynamic) | zlib DEFLATE compressor for sharing link generation. |
| **js-yaml** | `4.1.0` | Precached (Main Thread) | Frontmatter config metadata header parser. |
| **FileSaver.js** | `2.0.5` | Precached (Main Thread) | Controls download streams from the browser sandbox. |
| **Bootstrap** | `5.3.2` | Precached (CDN CSS/JS) | Controls general layouts, modal forms, and UI toggles. |
| **Neutralinojs** | `6.5.0` | Native Bridge | Desktop operating system framework wrapper shell. |

---

## 🔗 Project Resources

*   💻 **[GitHub Source Repository](https://github.com/ThisIs-Developer/Markdown-Viewer)**
*   📦 **[GitHub Releases & Executables](https://github.com/ThisIs-Developer/Markdown-Viewer/releases)**
*   🐳 **[GitHub Package Container Registry](https://github.com/ThisIs-Developer/Markdown-Viewer/pkgs/container/markdown-viewer)**
*   📜 **[Apache 2.0 Project License](https://github.com/ThisIs-Developer/Markdown-Viewer/blob/main/LICENSE)**
