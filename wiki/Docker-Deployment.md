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

## Optional HTTPS (no changes to the default port 8080)

The default `docker-compose.yml` is still plain HTTP on **http://localhost:8080**. Its port mapping `8080:80` remains unchanged. Keep HTTP for local testing; do not expose this plain HTTP port to untrusted networks. To bind it only to localhost, customize the mapping to `127.0.0.1:8080:80`.

### Local HTTPS on your own machine

```bash
docker compose -f docker-compose.https.yml up -d --build
```

Open **https://localhost:8443**. Caddy supplies HTTPS using its **private local certificate authority** and proxies to Markdown Viewer's Nginx over the internal Docker network. The Nginx HTTP port is **not published** to the host in this mode.

For browser trust without certificate warnings, export Caddy's local CA certificate:

```bash
docker compose -f docker-compose.https.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./mdv-local-ca.crt
```

Trust this root CA **only on machines you control**, using the operating system's certificate-authority trust settings. Do not share its private key or install an untrusted third-party CA. For command-line *diagnostics only*, `curl -k https://localhost:8443` will connect without CA verification; do not disable TLS validation for real users.

Stop without deleting the persisted CA:

```bash
docker compose -f docker-compose.https.yml down
```

### Public HTTPS with your own domain

Create a DNS record pointing a hostname you control (for example, `md.example.com`) to your Docker host, allow inbound TCP **80 and 443**, and set `MDV_DOMAIN` to the hostname **without** `https://`:

```bash
MDV_DOMAIN=md.example.com docker compose -f docker-compose.https-public.yml up -d --build
```

Windows PowerShell: set `$env:MDV_DOMAIN = "md.example.com"` before running the `docker compose -f docker-compose.https-public.yml up -d --build` command.

Open **https://md.example.com**. Caddy automatically requests and renews a publicly trusted certificate; its port 80 listener handles certificate validation and redirects to HTTPS. The reverse-proxied Nginx container is reachable **only inside the Docker network**. Caddy persists certificates and account state in Docker named volumes; preserve these volumes across upgrades. A public domain must resolve to your host and be reachable for certificate issuance. Existing `markdownviewer.pages.dev` points to Cloudflare Pages and is **not** automatically assigned to your Docker installation.

Public HTTPS applies to the browser-to-Caddy connection. The private Docker-network hop from Caddy to Nginx remains HTTP; configure an additional TLS layer if your threat model requires encryption on that internal hop.

To stop:

```bash
MDV_DOMAIN=md.example.com docker compose -f docker-compose.https-public.yml down
```

The HTTPS configurations do not modify the ordinary `docker-compose.yml`, do not require a Markdown Viewer account, and do not change Cloudflare Pages hosting. If you operate an existing TLS reverse proxy, keep it and route it to the container's HTTP port instead of launching another Caddy on the same public ports.

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

## Docker Runtime and Offline Asset Integrity

The image now includes the editor's root-level runtime dependencies (`browser-drop-source.js`, `native-markdown-source.js`, `preview-worker.js`, and `sample.md`) as well as the in-app linked-workspace guide. The Service Worker includes the native Markdown source in its critical asset list, so the expected local assets can precache successfully. JavaScript modules with the `.mjs` extension are served with `application/javascript`.

Mutable JS, CSS, and MJS assets use revalidation rather than an immutable one-year cache; images use a bounded seven-day cache. Security headers are inherited by static responses, and the HTTP-only Nginx listener does not send `upgrade-insecure-requests`.

The Docker CI suite validates actual HTTP and local HTTPS containers, static asset status/MIME/headers, browser editor/Preview, and Service Worker activation. These tests don't guarantee correctness in every custom reverse proxy, domain, or browser setup.

## Nginx and Headers

The Docker image uses `nginx:alpine`. Production deployments should keep these behaviors:

- Serve `index.html`, `workspace-storage.js`, `script.js`, `styles.css`, `preview-worker.js`, `sw.js`, `manifest.json`, and `assets/`.
- Serve `sample.md` because the Service Worker includes it in the critical precache.
- Serve JavaScript files with correct MIME types.
- Allow Service Worker registration from the app origin.
- Send security headers that match the app's CSP and deployment policy. The Docker image includes:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

The Dockerfile also sets a Content-Security-Policy with the external origins required by the web app. Review that policy when adding a renderer or changing lazy-loaded resources.

Cloudflare Pages deployments use the stricter root `_headers` and `_redirects` files, including CSP, HSTS, clickjacking, permissions, cross-origin, and sensitive-path protections. When self-hosting behind Docker or another reverse proxy, keep the CSP compatible with `index.html`, lazy-loaded renderers, Share Snapshot, and Live Share instead of copying a wildcard policy.

The Docker image requires revalidation for JS/CSS/MJS rather than making unversioned application code immutable. Other local caches, including Service Worker caches, still require testing during upgrades.

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
