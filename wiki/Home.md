# Markdown Viewer Wiki: Online Markdown Editor, Live Preview, Diagrams, and Export

Welcome to the documentation for Markdown Viewer. Markdown Viewer is a browser-based Markdown editor, viewer, reader, and previewer for opening `.md` and `.markdown` files, writing plain Markdown, and reading a split-screen live preview with sync scrolling. It includes a nested document Explorer, a fully rendered two-document split, GitHub-Flavored Markdown, comments and suggestions, rich visual renderers, Markdown-to-PDF/HTML/PNG exports, Share Snapshot links, Live Share rooms, a PWA-capable web build, Docker deployment, and a lightweight Neutralinojs desktop build.

Most editing and rendering happens on your own device. The important exceptions are documented clearly: GitHub import contacts GitHub, remote diagram fallbacks contact third-party renderers, consented media uploads and large Share Snapshot links use temporary Cloudflare KV storage, and Live Share relays temporary collaboration updates through Cloudflare Durable Objects. The web deployment also applies CSP and security headers, while the desktop build uses a restricted native API allowlist.

## Start Here

| Need | Page |
| :--- | :--- |
| Learn every feature, limitation, and data-handling detail | [Features](Features) |
| Use the editor day to day | [Usage Guide](Usage-Guide) |
| Add and manage comments or suggestions | [Usage Guide: Comments and Suggestions](Usage-Guide#comments-and-suggestions) |
| Write supported Markdown, math, diagrams, maps, STL, and ABC notation | [Markdown Reference](Markdown-Reference) |
| Install locally, in Docker, or as a desktop app | [Installation](Installation) |
| Tune deployment and runtime settings | [Configuration](Configuration) |
| Deploy with Docker and reverse proxies | [Docker Deployment](Docker-Deployment) |
| Build and understand the Neutralino desktop app | [Desktop App](Desktop-App) |
| Understand Live Share on Cloudflare | [Live Share Cloudflare](Live-Share-Cloudflare) |
| Add or maintain interface languages | [Localization](Localization) |
| Review project history and design decisions | [Development Journey](Development-Journey) |
| Answer common privacy and troubleshooting questions | [FAQ](FAQ) |
| Contribute changes | [Contributing](Contributing) |

## Quick Run Options

| Method | Command | URL |
| :--- | :--- | :--- |
| Python static server | `python -m http.server 8080` | `http://localhost:8080` |
| Node static server | `npx serve . -p 8080` | `http://localhost:8080` |
| Docker Compose | `docker compose up -d` | `http://localhost:8080` |
| Docker image | `docker run -d --name markdown-viewer -p 8080:80 ghcr.io/thisis-developer/markdown-viewer:latest` | `http://localhost:8080` |
| Desktop app | Download from GitHub Releases or build from `desktop-app/` | Desktop window |

Run local web builds through `localhost` or another HTTP(S) server. Opening `index.html` with `file://` can break Web Workers and Service Workers because browsers block those APIs from local files.

## Product Principles

| Principle | What It Means |
| :--- | :--- |
| On-device editing | Normal typing, preview, tabs, exports, themes, and settings stay on the user's device. No login is required. |
| Explicit network features | Any feature that sends content elsewhere is user-triggered or tied to a renderer/importer that is documented. |
| Rich Markdown support | The live preview supports GFM tables/task lists, math, footnotes, alerts, Mermaid, PlantUML, Graphviz, D2, Vega-Lite, Markmap, WaveDrom, maps, STL, ABC notation, and more. |
| Responsive performance | Large documents use debounced rendering, optional worker rendering, DOM patching, and cached measurements. |
| Deploy anywhere | The app can run as static files, a PWA, a Docker container, or a lightweight Neutralinojs desktop build. |

## Privacy At A Glance

- No accounts, cookies, analytics, ads, or telemetry are implemented.
- Normal documents and settings are stored in browser localStorage or local desktop storage.
- Comments and suggestions stay with normal local tabs, are excluded from exports and Share Snapshot, and synchronize only during an active Live Share room.
- Private mode in Workspace settings clears document state and prevents normal document-state persistence until it is turned off; Reset workspace removes files and review data without enabling Private mode.
- Small Share Snapshot links keep compressed content in the URL hash.
- Large Share Snapshot links upload the snapshot to Cloudflare KV for up to 90 days and remain bearer links for anyone who has the URL.
- Images, animated GIFs, and supported videos are uploaded only after first-use consent. Their unguessable public links expire 90 days after the latest upload of the same content.
- Live Share sends real-time updates, display names, cursors, and presence through a Cloudflare Durable Object while the room is active.
- Live Share host, edit, and view capabilities are authenticated server-side, and unsupported WebSocket origins are rejected.
- Remote diagram renderers receive diagram source when PlantUML, D2, Graphviz, Vega-Lite, WaveDrom, or some preview helpers need them.

For the complete table of data flows, see [Features](Features#data-handling-summary).
