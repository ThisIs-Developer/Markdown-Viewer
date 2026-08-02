# Markdown Viewer Configuration and Data Boundaries

This page documents the runtime, storage, dependency, Docker, Cloudflare, and desktop configuration used by Markdown Viewer, including the boundaries between client-side Markdown editing and optional network features.

## Browser and Desktop Storage

| Key | Location | Purpose |
| :--- | :--- | :--- |
| Normal Workspace documents | Per-document `documents` metadata and `contents` records in browser IndexedDB; individual `.md` files plus `.markdown-viewer/index.json` on desktop | Normal Workspace content and document metadata, including local review threads. Content is loaded on demand. Secret and temporary share/live tabs are excluded. |
| `markdownViewerTabs` | Legacy `localStorage`/Neutralino value | Read once to migrate an older monolithic Workspace into per-document storage, then removed. |
| `markdownViewerDocumentOrganization` | IndexedDB metadata on the web; `.markdown-viewer/organization.json` in the desktop vault; also retained as a small compatibility preference | Workspace expansion state, nested non-secret folders, sidebar filter, sidebar width/collapse state, and last non-secret creation location. |
| `markdownViewerSecretWorkspace` | Small manifest in IndexedDB or `.markdown-viewer/secret-manifest.json`; encrypted records are stored separately | Secret Workspace files and folder names are encrypted per record with AES-GCM using a PBKDF2-SHA-256 password-derived key. The salt and non-sensitive counts are in the manifest; the key is session-only. |
| `markdownViewerActiveTab` | `localStorage`, mirrored in desktop | Active tab id. |
| `markdownViewerUntitledCounter` | `localStorage`, mirrored in desktop | Next Untitled document number. |
| `markdownViewerGlobalState` | `localStorage`, mirrored in desktop | Theme, direction, view mode, scroll sync, and other global UI preferences. |
| `app-lang` | `localStorage` | Selected UI language. |
| `find-replace-docked` | `localStorage` | Find and Replace panel dock preference. |
| `markdownViewerPrivateMode` | `localStorage` | Whether new document-state persistence is paused. Existing saved documents are preserved. |

The desktop application keeps small interface preferences in system-scoped Neutralino storage. Durable workspace content is independent of the executable and lives at the fixed `Documents/Markdown Viewer Vault` path. Replacement binaries check this location automatically, and the application does not create a separate vault-locator file in Documents.

Temporary shared content is intentionally not persisted:

- Share Snapshot tabs have `kind: "share-snapshot"`.
- Live Share participant tabs use `kind: "live-share"` plus `temporary: true`; host documents are restored when leaving the session.

Private mode in Workspace settings pauses new document-state writes until the mode is turned off; it does not clear existing normal or Secret Workspace documents. **Storage and Backup** reports workspace usage, normal and secret document counts, the read-only browser persistence state or fixed desktop vault path, and exports/imports folder-preserving ZIP backups. Import replaces the current workspace after confirmation. Backups contain normal documents, organization, review data, selected preferences, and optional encrypted Secret Workspace records; trash, desktop history, and recovery journals remain outside the ZIP. Browser storage uses the browser's best-effort policy by default. **Reset workspace** permanently deletes documents, folders, settings, Secret Workspace ciphertext, history, and trash after confirmation.

## Client Libraries

The web build loads core libraries from CDN with Subresource Integrity where checked into `index.html`. Larger feature libraries are lazy-loaded from `script.js` only when needed.

| Library | Source | Used For | Load Behavior |
| :--- | :--- | :--- | :--- |
| Bootstrap | CDN or prepared desktop copy | UI components | Initial page load |
| Bootstrap Icons | CDN or prepared desktop copy | Icons | Initial page load |
| github-markdown-css | CDN or prepared desktop copy | Preview styling | Initial page load |
| Marked | CDN or prepared desktop copy | Markdown parsing | Initial page load and worker |
| Highlight.js | CDN or prepared desktop copy | Code highlighting | Initial page load and worker |
| DOMPurify | CDN or prepared desktop copy | HTML sanitization | Initial page load |
| FileSaver.js | CDN or prepared desktop copy | Browser downloads | Initial page load |
| js-yaml | CDN or prepared desktop copy | Frontmatter parsing | Initial page load |
| MathJax | CDN or prepared desktop copy | LaTeX math | Lazy |
| Mermaid | CDN or prepared desktop copy | Mermaid diagrams | Lazy |
| jsPDF | CDN or prepared desktop copy | Legacy raster PDF | Lazy |
| html2canvas | CDN or prepared desktop copy | PDF/PNG capture | Lazy |
| Pako | CDN or prepared desktop copy | Share compression, diagram encoding | Lazy |
| JSZip | CDN or prepared desktop copy | Workspace ZIP backup and import | Lazy |
| JoyPixels / emoji-toolkit | CDN or prepared desktop copy | Emoji shortcodes | Lazy |
| ABCJS | CDN or prepared desktop copy | ABC notation and playback | Lazy |
| Leaflet | CDN or prepared desktop copy | GeoJSON/TopoJSON maps | Lazy |
| TopoJSON | CDN or prepared desktop copy | TopoJSON conversion | Lazy |
| Three.js | CDN or prepared desktop copy | STL 3D rendering | Lazy |
| STLLoader / OrbitControls | CDN or prepared desktop copy | STL loading and controls | Lazy |
| D3 | CDN or prepared desktop copy | Markmap | Lazy |
| Markmap | CDN or prepared desktop copy | Markmap diagrams | Lazy |
| Yjs | CDN or prepared desktop copy | Live Share document sync | Lazy |

When running inside Neutralino, dynamic library URLs are rewritten to local `/libs/...` files prepared by `desktop-app/prepare.js`.

## Rendering Thresholds and Limits

| Setting | Value |
| :--- | :--- |
| Large document threshold | 15,000 characters |
| Huge document threshold | 100,000 characters |
| Worker render threshold | 50,000 characters |
| Worker timeout | 12 seconds |
| Small render debounce | 100 ms |
| Large render debounce | 160 ms |
| Huge render debounce | 240 ms |
| Minimum split pane width | 20% |
| Line-height cache size | 5,000 entries |
| Local Markdown import | 10 MB per file |
| GitHub importer shown files | All Markdown files found |
| Saved GitHub access tokens | 50 named entries |
| GitHub access-token name | 60 characters |
| Desktop document history | 20 recent copies per document |
| Share URL warning ceiling | 32,000 characters |
| Legacy share URL ceiling | 4,096 characters |
| Server share threshold | 3,000 bytes |
| Stored Share Snapshot max content | 8,000,000 characters |
| Stored Share Snapshot TTL | 90 days |
| Managed media max source file | 25 MiB |
| Managed still-image optimized payload | 300 KiB |
| Managed GIF payload | 5 MiB |
| Managed video payload | 10 MiB |
| Managed media TTL | 90 days from the most recent upload of that content |
| Live Share max participants | 64 |
| Live Share max message | 8 MB |
| STL source limit | 2 MiB |
| STL geometry limit | 300,000 vertices |

## Sanitization

The main preview path calls DOMPurify with additional tags and attributes needed by renderers:

- Additional tags include `mjx-container`, `input`, `video`, and `source`.
- Additional attributes include `id`, `class`, `style`, `align`, `type`, `checked`, `disabled`, `data-original-code`, `role`, `aria-labelledby`, `aria-describedby`, `aria-label`, `controls`, `preload`, and `playsinline`.
- Allowed URI schemes include HTTP(S), `mailto:`, `tel:`, `blob:`, relative URLs, safe non-script values, and base64 raster image data for AVIF, BMP, GIF, JPEG, PNG, and WebP. SVG data URLs remain blocked.

Export paths use similar expanded sanitizer settings for SVG/math capture. Scripts and unsafe event handlers are still removed.

Standalone HTML export also includes a restrictive CSP and SRI metadata for its external CSS and renderer scripts where applicable.

## Service Worker and PWA

`sw.js` uses a versioned cache name so stale caches can be retired safely.

Critical assets:

- `/`
- `/index.html`
- `/styles.css`
- `/script.js`
- `/preview-worker.js`
- `/manifest.json`
- `/assets/icon.jpg`

Local shell assets use network-first behavior with cache fallback for update-sensitive paths. CDN assets from cdnjs and jsDelivr use cache-first behavior after first successful fetch. The service worker removes old `markdown-viewer-cache-*` caches on activation.

Service workers require HTTPS or localhost. They do not work from `file://`.

## Cloudflare Configuration

`wrangler.toml` configures the Pages project:

```toml
name = "markdown-viewer"
pages_build_output_dir = "."
compatibility_date = "2025-04-30"

[[kv_namespaces]]
binding = "SHARE_KV"
id = "c820d2705f5742858a27b91b88f544bd"

[[durable_objects.bindings]]
name = "LIVE_ROOMS"
class_name = "LiveRoom"
script_name = "markdown-viewer-live-room"
```

`SHARE_KV` stores large Share Snapshot records and content-addressed managed media for 90 days. Re-uploading identical content refreshes that media item's 90-day expiry. The snapshot and media record types use separate key prefixes. `LIVE_ROOMS` routes Live Share WebSocket rooms to Durable Objects.

Live Share does not persist Markdown or Review content server-side. Its Durable Object does persist the host, edit, and view bearer capability values plus `createdAt` under `live-room-auth-v1`; the current implementation defines no application TTL or deletion route for that record. Share Snapshot, managed media storage, and Live Share are separate data paths.

`wrangler.live-room.toml` deploys `workers/live-room-worker.js` with the `LiveRoom` Durable Object migration.

## Share API

`functions/api/share/[[id]].js` supports:

- `OPTIONS` for CORS preflight.
- `POST /api/share` to create a stored snapshot.
- `GET /api/share/<id>` to load a stored snapshot.
- `DELETE /api/share/<id>` to delete a stored snapshot when the creator supplies its deletion token.

Responses set `Cache-Control: no-store` and vary CORS by request origin. The allowed origins are the production app, HTTPS `*.markdownviewer.pages.dev` previews, `null`, and localhost/127.0.0.1 development origins; unsupported origins receive `403`. Requests without an `Origin` header are accepted, so origin filtering is not an access-control substitute.

Stored records contain content, mode, title, creation time, size, and a hash of the creator deletion token. The token is returned only when the snapshot is created. The current UI does not display the token or expose a Delete snapshot action; API clients must capture the response to use early deletion. Invalid ids, missing content, oversized content, invalid deletion tokens, missing KV binding, and unknown routes return JSON errors. See [Share Snapshot](Share-Snapshot.md).

## Managed Media API

`functions/api/image/[[id]].js` and its video-friendly route alias `functions/api/media/[[id]].js` support:

- `POST /api/image` for AVIF, BMP, GIF, JPEG, PNG, and WebP data URLs.
- `POST /api/media` for MP4, WebM, and Ogg video data URLs.
- `GET` and `HEAD` on `/api/image/<id>` or `/api/media/<id>` to serve content through its content-addressed public URL.
- `OPTIONS` for CORS preflight.

The API accepts still images up to 300 KiB after client-side optimization, GIFs up to 5 MiB, and videos up to 10 MiB. It validates both the declared media type and file signature, derives an unguessable 24-character id from SHA-256 content, and stores the record in `SHARE_KV` with a 90-day TTL. Duplicate content returns the existing id and refreshes its TTL. Responses are public, immutable, and cross-origin until expiry; possession of the URL is sufficient to retrieve the media. This is the same 90-day retention duration used for stored Share Snapshot links, though the two features store separate records.

Upload and preflight requests use the same production, Cloudflare preview, local-file, and localhost origin checks as Share Snapshot.

## Live Room API

`functions/live-room/[[room]].js` supports WebSocket upgrades only. It validates the WebSocket `Origin`, room and secret length, requires `LIVE_ROOMS`, and forwards to a Durable Object chosen by `roomName + ":" + secret`. The Durable Object authenticates host, edit, and view capabilities, filters message types by role, enforces the participant/message limits, and persists the capability record described above.

See [Live Share](Live-Share-Cloudflare.md) for runtime flow and limits.

## Docker and Nginx

The root Docker build serves static files with Nginx on port 80. The repository includes `docker-compose.yml` exposing `8080:80`.

Security headers configured in Docker/Nginx documentation include:

- `Strict-Transport-Security` (Cloudflare Pages)
- `Content-Security-Policy`
- `X-Frame-Options: DENY` (Cloudflare Pages; the Docker image has its own Nginx policy)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`

Cloudflare Pages reads the root `_headers` and `_redirects` files. `_redirects` hides `.env`, `_headers`, and source-map paths behind 404 responses. Self-hosters should preserve equivalent policies and make sure `workspace-storage.js`, `preview-worker.js`, `sample.md`, `sw.js`, `manifest.json`, `script.js`, `styles.css`, `assets/`, `workers/`, and `functions/` or their Cloudflare equivalents are deployed according to the features they intend to use.

The checked-in root Dockerfile does not copy `preview-worker.js` or `sample.md`; see [Docker Deployment: Known Stock Image Limitation](Docker-Deployment.md#known-stock-image-limitation).

## Neutralino Desktop Configuration

Current `desktop-app/neutralino.config.json` highlights:

| Setting | Value |
| :--- | :--- |
| `applicationId` | `com.markdownviewer.desktop` |
| `documentRoot` | `/resources/` |
| `url` | `/` |
| `enableServer` | `true` |
| `enableNativeAPI` | `true` |
| `tokenSecurity` | `one-time` |
| Default window | 1280 x 720 |
| Minimum window | 400 x 200 |
| Logging | disabled |
| Binary name | `markdown-viewer` |

Native allowlist:

- `app.exit`
- `os.showOpenDialog`
- `os.showSaveDialog`
- `os.showMessageBox`
- `os.open`
- `os.setTray`
- `filesystem.readFile`
- `filesystem.writeFile`
- `storage.setData`
- `storage.getData`

`os.execCommand` is intentionally absent from the default allowlist. The desktop renderer therefore cannot execute local shell commands through the standard configuration.

The browser/chrome modes block filesystem and/or OS APIs more aggressively.

## Desktop Build Scripts

`desktop-app/package.json` contains:

| Script | Command Purpose |
| :--- | :--- |
| `setup` | Runs `setup-binaries.js` to install Neutralino binaries. |
| `postsetup` | Runs `prepare.js`. |
| `predev` | Runs setup before development. |
| `dev` | Runs `npx -y @neutralinojs/neu@11.7.0 run`. |
| `prebuild` | Runs setup before build. |
| `build` | Runs `build-standalone.js`, which builds seven targets separately with embedded resources and gathers them in `dist/markdown-viewer/`. |

Running `npm run build` first triggers `prebuild`, which runs setup and its `postsetup` preparation step. `build-standalone.js` builds each target separately to avoid exhausting Node.js memory, and every output is a self-contained executable without a neighboring `resources.neu` file.

`prepare.js` copies root app files into `desktop-app/resources`, downloads and verifies libraries, rewrites dynamic library paths, strips web-only SEO metadata, and prepares local renderer/export resources for the desktop bundle.

Related pages: [Installation](Installation.md), [Privacy and Security](Privacy-and-Security.md), [Share Snapshot](Share-Snapshot.md), [Live Share](Live-Share-Cloudflare.md), and [Troubleshooting](Troubleshooting.md).
