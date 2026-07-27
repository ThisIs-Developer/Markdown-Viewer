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

## What The Container Provides

The container serves the static browser app: editor, preview, local storage, imports, exports, PWA assets, and CDN-loaded renderers.

The container alone does not provide Cloudflare KV or Durable Objects. Stored Share Snapshot and Live Share require Cloudflare deployment or equivalent compatible endpoints.

## Nginx and Headers

The Docker image uses `nginx:alpine`. Production deployments should keep these behaviors:

- Serve `index.html`, `script.js`, `styles.css`, `preview-worker.js`, `sw.js`, `manifest.json`, and `assets/`.
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

Use long caching carefully. `sw.js`, `index.html`, `script.js`, and `styles.css` are update-sensitive; stale versions can keep old app behavior alive.

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

## Privacy Notes For Self-Hosting

- Normal documents stay in the user's browser storage.
- Your server will serve static assets and may log normal HTTP requests.
- URL-hash Share Snapshot content is not sent to the server as an HTTP fragment, but users can paste links into other systems.
- Stored Share Snapshot and Live Share need Cloudflare or compatible services and have their own data flows.
