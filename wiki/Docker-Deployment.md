# Docker Deployment

This page covers all Docker-based deployment options for **Markdown Viewer**.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Run](#docker-run)
- [Docker Compose](#docker-compose)
- [Building the Image Locally](#building-the-image-locally)
- [Nginx Configuration](#nginx-configuration)
- [Transparency & Security](#transparency--security)
- [Environment & Customization](#environment--customization)
- [Automated Image Publishing](#automated-image-publishing)
- [Reverse Proxy Setup](#reverse-proxy-setup)

---

## Quick Start

```bash
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:latest
```

Open **http://localhost:8080**.

---

## Docker Run

### Basic Usage

```bash
docker run -p 8080:80 ghcr.io/thisis-developer/markdown-viewer:latest
```

### With a Custom Port

```bash
docker run -p 3000:80 ghcr.io/thisis-developer/markdown-viewer:latest
```

### Named Container with Restart Policy

```bash
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:latest
```

### Pull a Specific Version

```bash
docker pull ghcr.io/thisis-developer/markdown-viewer:<tag>
docker run -p 8080:80 ghcr.io/thisis-developer/markdown-viewer:<tag>
```

Available tags: `latest`, `main`, and commit SHA tags (e.g., `abc1234`).

---

## Docker Compose

The repository includes a ready-to-use `docker-compose.yml`.

### Start

```bash
docker compose up -d
```

### Stop

```bash
docker compose down
```

### Rebuild

```bash
docker compose up -d --build
```

### docker-compose.yml

```yaml
services:
  markdown-viewer:
    image: ghcr.io/thisis-developer/markdown-viewer:latest
    container_name: markdown-viewer
    ports:
      - "8080:80"
    restart: unless-stopped
```

To change the host port, update the left value in `"8080:80"` to your desired port.

---

## Building the Image Locally

```bash
# From the repository root
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer

docker build -t markdown-viewer:local .
docker run -p 8080:80 markdown-viewer:local
```

### Dockerfile Summary

The `Dockerfile` is based on `nginx:alpine` and:

1. **Copies** all web app files (`index.html`, `script.js`, `styles.css`, `assets/`) into `/usr/share/nginx/html`.
2. **Configures Nginx** for SPA routing (all paths serve `index.html`).
3. **Sets cache headers** for static assets (1-year max-age).
4. **Adds security headers**:
   - `X-Frame-Options: SAMEORIGIN`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`

---

## Nginx Configuration

The embedded Nginx config (`/etc/nginx/conf.d/default.conf`) includes:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static asset caching (1 year)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

---

## Transparency & Security

The Docker image is intentionally minimal:

- **Static assets only**: HTML, CSS, JavaScript, and images served by Nginx.
- **No background services**: No analytics, telemetry, or server-side processing.
- **External dependencies**: The app references CDN-hosted libraries unless you bundle them locally.
- **Security headers**: Nginx applies `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.

---

## Environment & Customization

Because the app is purely static, there are no runtime environment variables to configure. All customization is done at build time by modifying the source files.

To serve the app at a **sub-path** (e.g., `/markdown-viewer/`), adjust the Nginx `location` directive in the `Dockerfile` and rebuild the image.

---

## Automated Image Publishing

The GitHub Actions workflow `.github/workflows/docker-publish.yml` automatically builds and publishes Docker images to GHCR on every push:

### Trigger Events

| Event | Action |
|-------|--------|
| Push to `main` | Build and push `latest` tag |
| Pull request | Build only (no push) |
| Any push | Build and push with commit SHA tag |

### Published Registry

Images are published to:

```
ghcr.io/thisis-developer/markdown-viewer
```

You can pull the image without authentication (public repository):

```bash
docker pull ghcr.io/thisis-developer/markdown-viewer:latest
```

---

## Reverse Proxy Setup

To run Markdown Viewer behind a reverse proxy (Nginx, Caddy, Traefik, Apache), proxy requests to the container's port 80.

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl;
    server_name markdown.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy Reverse Proxy

```caddyfile
markdown.example.com {
    reverse_proxy localhost:8080
}
```

### Traefik Labels (docker-compose.yml)

```yaml
services:
  markdown-viewer:
    image: ghcr.io/thisis-developer/markdown-viewer:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.markdown.rule=Host(`markdown.example.com`)"
      - "traefik.http.routers.markdown.entrypoints=websecure"
      - "traefik.http.routers.markdown.tls.certresolver=letsencrypt"
```
