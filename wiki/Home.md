# Markdown Viewer Documentation

Markdown Viewer is a local-first Markdown editor and viewer for the web, Progressive Web App (PWA), Docker, Cloudflare, and Neutralino desktop application. It provides a plain-text Editor, sanitized Preview, Split view, a multi-Document Workspace, review tools, rich renderers, exports, Share Snapshot, and Live Share.

Most editing and rendering happens on the device. Managed media, GitHub import, remote diagram services, stored Share Snapshot, Live Share, external assets, map tiles, and uncached web libraries use the network. Read [Privacy and Security](Privacy-and-Security.md) before using those features with sensitive content.

## Start Here

| I want to… | Start with |
| :--- | :--- |
| Understand the product and its limits | [Features](Features.md) |
| Learn the Workspace, Editor, Preview, and shortcuts | [Usage Guide](Usage-Guide.md) |
| Write Markdown, math, diagrams, maps, STL, or ABC notation | [Markdown Reference](Markdown-Reference.md) |
| Create a point-in-time link | [Share Snapshot](Share-Snapshot.md) |
| Collaborate in a temporary room | [Live Share](Live-Share-Cloudflare.md) |
| Review local storage, network, retention, and security boundaries | [Privacy and Security](Privacy-and-Security.md) |
| Run the web app, PWA, Docker, Cloudflare, or desktop build | [Installation](Installation.md) |
| Configure storage, libraries, limits, or Cloudflare bindings | [Configuration](Configuration.md) |
| Deploy behind Docker and a reverse proxy | [Docker Deployment](Docker-Deployment.md) |
| Build or operate the Neutralino application | [Desktop Application](Desktop-App.md) |
| Fix a problem | [Troubleshooting](Troubleshooting.md) or [FAQ](FAQ.md) |
| Contribute code, documentation, or a translation | [Contributing](Contributing.md) |
| Maintain interface translations | [Localization](Localization.md) |
| Use approved multilingual terms | [Terminology Glossary](Terminology-Glossary.md) |
| Follow documentation conventions | [Documentation Style Guide](Documentation-Style-Guide.md) |
| Review audit inventory and scores | [Documentation Audit](Documentation-Audit.md) |
| Read project history and design context | [Development Journey](Development-Journey.md) |

## Quick Run

From the repository root:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`. Use HTTP(S), not `file://`, so Web Workers and Service Workers can run.

Other supported entry points:

| Target | Command or action |
| :--- | :--- |
| Hosted web app | Open [markdownviewer.pages.dev](https://markdownviewer.pages.dev/) |
| PWA | Open the HTTPS site and use the browser's install action |
| Docker image | `docker run -d --name markdown-viewer -p 8080:80 ghcr.io/thisis-developer/markdown-viewer:latest` |
| Docker Compose | `docker compose up -d` |
| Desktop development | Run `npm install` and `npm run dev` in `desktop-app/` |
| Desktop build | Run `npm run build` in `desktop-app/` |

See [Installation](Installation.md) before deploying. The stock Docker image has a documented Worker/PWA packaging limitation.

## Product Boundaries

| Area | Implemented behavior |
| :--- | :--- |
| Workspace | Up to 50 Documents, nested Folders, Recent, Favorites, search, tabs, bulk actions, and encrypted Secret Workspace |
| Editing | Editor, Split view, Preview, formatting toolbar, custom undo/redo, Find and Replace, LTR/RTL, large-Document rendering paths |
| Markdown | CommonMark-style parsing, GFM, tables, tasks, alerts, footnotes, definitions, highlighting, sanitized HTML, and math |
| Visual content | Mermaid, PlantUML, Graphviz/DOT, D2, Vega-Lite, WaveDrom, Markmap, GeoJSON, TopoJSON, STL, and ABC |
| Import/export | Local and public GitHub import; Markdown, HTML, Browser Print, legacy raster PDF, and PNG export |
| Sharing | URL-hash or KV-backed Share Snapshot; WebSocket Live Share with host/edit/view capabilities |
| Delivery | Static web, PWA, Docker, Cloudflare, and seven Neutralino desktop targets |

## Privacy at a Glance

- Normal Workspace state is local to the browser profile or desktop storage.
- Private mode clears persisted Document state, including Secret Workspace storage, and blocks further persistence while enabled.
- **Reset workspace** deletes normal and Secret Workspace data and cannot be undone in Markdown Viewer.
- Managed media is public-by-link and expires 90 days after the most recent upload of identical content.
- Stored Share Snapshot content remains in Cloudflare KV for 90 days.
- Live Share does not persist Markdown/Review content server-side, but its Durable Object stores role capability metadata without an application TTL.
- The application does not implement end-to-end encryption for sharing.
- The codebase does not implement accounts, analytics, telemetry, advertising, tracking pixels, or app-specific cookies.

For the complete data-flow table and limitations, see [Privacy and Security](Privacy-and-Security.md).

## Languages

The interface supports 14 locales. Maintained documentation entry points are available in:

- [English](../README.md)
- [Japanese](../locales/README_ja.md)
- [Korean](../locales/README_ko.md)
- [Simplified Chinese](../locales/README_zh.md)
- [Traditional Chinese](../locales/README_tw.md)

Detailed Wiki pages are maintained in English. Localized READMEs identify English links rather than pointing to missing localized pages.
