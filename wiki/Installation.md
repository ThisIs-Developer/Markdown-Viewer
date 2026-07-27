# Install Markdown Viewer: Browser, Docker, Cloudflare, and Desktop

Markdown Viewer is a browser-based Markdown editor and viewer that can run as a static web app, a self-hosted Docker site, a Cloudflare deployment with optional sharing features, or a Neutralino desktop app. Choose the setup that matches how you want to open, read, edit, preview, and export Markdown files.

## Requirements

| Target | Requirements |
| :--- | :--- |
| Local web | Modern browser and a local HTTP server. |
| PWA/offline web | HTTPS or localhost for Service Worker support. |
| Docker | Docker Engine and port access to the container. |
| Cloudflare sharing/media/live | Cloudflare Pages, `SHARE_KV`, and `LIVE_ROOMS` Durable Object bindings. |
| Desktop build | Node.js/npm, Neutralino binaries, and internet access during setup/prepare. |

Do not rely on `file://` for normal use. Web Workers and Service Workers can be blocked from local files.

## Quick Local Web Run

From the repository root:

```bash
python -m http.server 8080
```

or:

```bash
npx serve . -p 8080
```

Open `http://localhost:8080`.

This runs the editor, split live preview, sync scrolling, local storage, local `.md` file imports, exports, PWA registration, and CDN-loaded renderers. The default local client sends consented managed-media uploads to the production image/media API. Other Cloudflare-only features such as stored Share Snapshot and Live Share require their matching deployed endpoints.

## Docker

Using the published image:

```bash
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:latest
```

Open `http://localhost:8080`.

Using Compose from the repository root:

```bash
docker compose up -d
```

To rebuild from local source:

```bash
docker compose up -d --build
```

The Docker image serves static files with Nginx. It does not magically provide Cloudflare KV or Durable Objects; deploy those separately if you want stored Share Snapshot or Live Share.

## Static Hosting

Serve at least these root files:

- `index.html`
- `script.js`
- `styles.css`
- `preview-worker.js`
- `sw.js`
- `manifest.json`
- `assets/`

For Cloudflare Pages with managed media, stored Share Snapshot, and Live Share, also deploy:

- `functions/api/image/[[id]].js`
- `functions/api/media/[[id]].js`
- `functions/api/share/[[id]].js`
- `functions/live-room/[[room]].js`
- `workers/live-room-worker.js`
- `wrangler.toml`
- `wrangler.live-room.toml`

If you host under a sub-path, test worker, service-worker, manifest, and dynamic library paths carefully.

## Cloudflare Setup

Managed media and Share Snapshot storage need a KV namespace bound as `SHARE_KV`. Their records use separate key prefixes.

Live Share needs a Durable Object binding named `LIVE_ROOMS` using the `LiveRoom` class from `workers/live-room-worker.js`.

Deploy the live room worker with:

```bash
wrangler deploy -c wrangler.live-room.toml
```

Then deploy the Pages project with `wrangler.toml` or your Cloudflare Pages configuration. See [Live Share Cloudflare](Live-Share-Cloudflare) and [Configuration](Configuration).

## Desktop App

From `desktop-app/`:

```bash
npm install
npm run dev
```

Build the seven self-contained platform binaries with:

```bash
npm run build
```

The results are written to `desktop-app/dist/markdown-viewer/`. Each Windows,
Linux, and macOS binary embeds the application resources, so users can download
only the file matching their operating system and architecture.

The development and build commands run setup automatically. Setup:

- Downloads Neutralino binaries.
- Runs `prepare.js`.
- Copies the root app into `desktop-app/resources`.
- Downloads and verifies external libraries where integrity values are available.
- Rewrites dynamic renderer library paths to local `/libs/...` files.
- Prepares bundled renderer and export libraries for local desktop loading after setup.

The desktop app uses native open/save dialogs for Markdown and HTML files, asks before closing, and can load a Markdown file passed as a command-line argument.

## Offline Use

Web/PWA:

- First load requires the app shell and any needed CDN libraries.
- After caching, the app shell and previously fetched CDN libraries can work offline.
- Features that require live network access still need it: managed media upload, GitHub import, stored Share Snapshot, Live Share, remote diagram rendering, external images, and map tiles.

Desktop:

- The prepared desktop bundle uses local libraries in `resources/libs`.
- Local editing, rendering, and export features are available without CDN access after preparation.
- Network features still use the network when invoked.

## Platform Notes

Windows desktop binaries may trigger SmartScreen because they are unsigned. Choose More info, then Run anyway if you trust the build.

Linux binaries may need execute permission:

```bash
chmod +x markdown-viewer-linux_x64
./markdown-viewer-linux_x64
```

macOS binaries may need quarantine removal:

```bash
xattr -d com.apple.quarantine markdown-viewer-mac_universal
chmod +x markdown-viewer-mac_universal
./markdown-viewer-mac_universal
```
