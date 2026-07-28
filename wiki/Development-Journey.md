# Markdown Viewer Development Journey

Markdown Viewer did not begin as a polished roadmap or a finished product. It began as a personal project on a PC: a small Markdown viewer made with curiosity, failed attempts, late fixes, and the simple hope that Markdown could feel easier to read, edit, preview, and share.

The [first public version](https://a1b91221.markdownviewer.pages.dev/) is still something to be proud of. It was much smaller than the current app, but it carried the heart of the project: type Markdown, see it render, and make documentation feel less painful. From there, every rough edge became a reason to keep improving.

The current version exists because people used it, questioned it, broke it, reported issues, shared screenshots and GIFs, suggested workflows, opened PRs, and explained what was confusing. The project grew through community help: feature requests, bug reports, conversations, and practical feedback from real writing and documentation work.

This page keeps the technical record too, but the journey is not only technical. Markdown Viewer came from care, persistence, and community trust. The changelog remains the detailed version-by-version history; this page explains how that work became the product documented in the wiki.

## High-Level Evolution

| Phase | Main Work |
| :--- | :--- |
| Early renderer | Basic textarea and live Markdown preview. |
| Performance foundation | Web Worker parsing, syntax highlighting, debounced rendering, and scroll sync fixes. |
| Rich Markdown | MathJax, Mermaid, footnotes, alerts, extended Markdown, and sanitized HTML support. |
| Workspace | Nested document Explorer, multi-document tabs, two-document split, autosave, bulk actions, drag reordering, Secret Workspace encryption, custom undo/redo, mobile parity, and reset flows. |
| Export | Markdown, standalone HTML, PDF, PNG, diagram export toolbars, and PDF page-break planning. |
| Desktop | Neutralino wrapper, native dialogs, launch-file support, storage persistence, and local resource bundling. |
| Sharing | Compressed URL snapshots, modal share UX, temporary KV-backed large snapshots, and Cloudflare Live Share rooms. |
| Advanced renderers | PlantUML, D2, Graphviz, Vega-Lite, WaveDrom, Markmap, GeoJSON, TopoJSON, STL, and ABC notation. |
| Hardening | DOMPurify, CSP/security headers, SRI, least-privilege desktop APIs, server-side Share/Live authorization, STL validation, canvas taint protection, accessibility improvements, and service-worker caching. |

## Current Product Highlights

Current sharing behavior separates two clear workflows:

- Share Snapshot creates a point-in-time copy with View only or Can edit access. Small documents stay inside the URL hash. Larger documents are stored in Cloudflare KV for 90 days, with restricted API origins and creator-side deletion tokens.
- Live Share creates a Cloudflare Durable Object room for real-time Yjs collaboration. The room relays Markdown/Review updates and presence without persisting Document content server-side; it does persist host/edit/view capability metadata.

Recent workspace work added nested folders, GitHub directory preservation, range and multi-item Explorer actions, document-surface context menus, and a two-document split whose previews run the full math, diagram, map, STL, and ABC rendering pipeline.

Managed media now turns consented image, animated GIF, MP4, WebM, and Ogg uploads into short content-addressed HTTPS links. This keeps media usable across reloads, Share Snapshot, Live Share, and Markdown export until the 90-day expiry.

The security-hardening work also added Private mode and Reset workspace controls, hardened exported HTML, validated STL source/geometry before WebGL rendering, rejected unsupported Live Share origins, and moved Live Share role enforcement into the Durable Object rather than relying only on the client.

Recent work also fixed shared rendering so advanced content such as LaTeX, Mermaid, TopoJSON, and other renderers complete after shared content loads, and it improved desktop startup resource preparation.

## Important Design Decisions

### On-Device Core

The project started with an on-device editing model. Normal editing, previewing, local file import, local autosave, and most exports run in the browser or desktop webview.

### Explicit Network Boundaries

As the product grew, some useful features required network access. The documentation now names those boundaries directly:

- GitHub import contacts GitHub.
- Remote diagram renderers can receive diagram source.
- Stored Share Snapshot uploads a temporary copy to Cloudflare KV.
- Live Share relays active collaboration data through Cloudflare Durable Objects.
- CDN libraries and external document assets can be fetched by the browser.

### Performance Before Frameworks

The app stays mostly vanilla JavaScript. Instead of adopting a frontend framework, it uses:

- Debounced rendering.
- Optional worker rendering for large documents.
- Block hashing and segmented DOM patching.
- Cached line-height calculations.
- RequestAnimationFrame scroll sync.
- Lazy loading for heavy libraries.

### Desktop Without Electron

Neutralino was chosen to keep desktop builds lighter than Electron and reuse the web app. Desktop-specific code is limited to lifecycle handling, native dialogs, storage mirroring, and resource preparation.

## Changelog Themes

The changelog records many small fixes. The recurring themes are:

- Rendering correctness for math, footnotes, diagrams, tables, and shared documents.
- Export reliability for PDFs, images, diagrams, and HTML.
- Mobile and accessibility parity.
- Safer desktop permissions and local resource packaging.
- Better privacy wording and sharing UX.
- Reduced blocking work during typing and startup.

## Current Data Policy Summary

- No analytics, telemetry, ads, accounts, or cookies are implemented.
- Normal documents are saved locally.
- Temporary shared/live tabs are excluded from saved workspaces.
- Small snapshot links keep content in the URL hash.
- Stored snapshot links use Cloudflare KV for 90 days.
- Private mode pauses Document-state persistence without deleting saved content. The later Storage and Backup update changed Reset workspace into a confirmed, destructive fresh-start action with a direct Backup route.
- Live Share uses Cloudflare Durable Objects as temporary relays.
- Remote renderer and import features send only the data needed for that feature.

This page is historical context, not the source of current product behavior. Use [Features](Features.md) and [Privacy and Security](Privacy-and-Security.md) for the current reference.
