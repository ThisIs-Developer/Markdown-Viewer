# Docker Deployment for the Markdown Viewer Web App

Markdown Viewer's Docker image serves the browser-based Markdown editor and viewer as a static web app with Nginx. It is useful for local networks, self-hosting, and reverse-proxy deployments.

## Quick Start

```bash
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:latest
```

Open `http://localhost:8080`.

## Docker Compose

The repository includes:

```yaml
services:
  markdown-viewer:
    build: .
    ports:
      - "8080:80"
```

Run:

```bash
docker compose up -d
```

Rebuild after local source changes:

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

## Building Locally

```bash
docker build -t markdown-viewer:local .
docker run -d --name markdown-viewer-local -p 8080:80 markdown-viewer:local
```

The root `.dockerignore` excludes desktop build output and unrelated local files from the web container.

## What the Container Provides

The container serves the static browser shell: `index.html`, `workspace-storage.js`, `script.js`, `styles.css`, `sw.js`, `manifest.json`, `robots.txt`, `sitemap.xml`, and `assets/`. It provides the Editor, main-thread Preview, local storage, local imports, most exports, and CDN-loaded renderer libraries.

On `localhost`, managed-media and stored Share Snapshot requests use the production `https://markdownviewer.pages.dev` API. Live Share defaults to the Docker origin and fails unless a compatible `/live-room` endpoint is available or `window.MARKDOWN_VIEWER_LIVE_ROOM_URL` is configured in a custom deployment.

The container alone does not provide Cloudflare KV or Durable Objects. Self-hosted stored Share Snapshot and Live Share require separately deployed compatible endpoints.

## Known Stock Image Limitation

The checked-in root `Dockerfile` does not copy:

- `preview-worker.js`; or
- `sample.md`.

Both files are listed in `sw.js` as critical precache assets. The consequences are:

- Documents eligible for Preview Worker rendering receive a Worker load failure and fall back to main-thread rendering; and
- Service Worker installation can fail because `cache.addAll()` rejects the complete precache when either asset returns `404`.

This is an implementation packaging limitation, not a documentation configuration step. The documentation audit records it without changing Docker behavior.

If you maintain a custom image, copy both files to `/usr/share/nginx/html/`, rebuild, and verify that every `CRITICAL_ASSETS` URL in `sw.js` returns `200` with the correct MIME type.

## Nginx and Headers

The Docker image uses `nginx:alpine`. Production deployments should keep these behaviors:

- Serve `index.html`, `workspace-storage.js`, `script.js`, `styles.css`, `preview-worker.js`, `sw.js`, `manifest.json`, and `assets/`.
- Serve `sample.md` because the Service Worker includes it in the critical precache.
- Serve JavaScript files with correct MIME types.
- Allow Service Worker registration from the app origin.
- Send security headers that match the app's CSP and deployment policy. The current Docker image includes:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

The Dockerfile also sets a Content-Security-Policy with the external origins required by the web app. Review that policy when adding a renderer or changing lazy-loaded resources.

Cloudflare Pages deployments use the stricter root `_headers` and `_redirects` files, including CSP, HSTS, clickjacking, permissions, cross-origin, and sensitive-path protections. When self-hosting behind Docker or another reverse proxy, keep the CSP compatible with `index.html`, lazy-loaded renderers, Share Snapshot, and Live Share instead of copying a wildcard policy.

Use long caching carefully. `sw.js`, `index.html`, `workspace-storage.js`, `script.js`, and `styles.css` are update-sensitive; stale versions can keep old app behavior alive.

## Reverse Proxy Examples

Nginx:

```nginx
server {
    listen 443 ssl;
    server_name markdown.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Caddy:

```caddyfile
markdown.example.com {
    reverse_proxy localhost:8080
}
```

Traefik labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.mdviewer.rule=Host(`markdown.example.com`)"
  - "traefik.http.routers.mdviewer.entrypoints=websecure"
  - "traefik.http.routers.mdviewer.tls.certresolver=letsencrypt"
  - "traefik.http.services.mdviewer.loadbalancer.server.port=80"
```

## Custom Sub-Paths

Serving from a sub-path such as `/editor/` requires testing:

- Worker URL resolution for `preview-worker.js`.
- Service Worker scope.
- Manifest path.
- Asset paths in `index.html`.
- Dynamic library loading in `script.js`.
- Share and Live Share public base URL behavior.

Root hosting is the simplest and best-tested deployment mode.

## Privacy Notes for Self-Hosting

- Normal documents stay in the user's browser storage.
- Your server will serve static assets and may log normal HTTP requests.
- URL-hash Share Snapshot content is not sent to the server as an HTTP fragment, but users can paste links into other systems.
- Stored Share Snapshot and Live Share need Cloudflare or compatible services and have their own data flows.
- The stock localhost client sends consented managed-media and stored Share Snapshot requests to the production Markdown Viewer API.

For the complete boundary, see [Privacy and Security](Privacy-and-Security.md). For diagnostics, see [Troubleshooting](Troubleshooting.md#docker-preview-or-pwa-offline-support-is-incomplete).
