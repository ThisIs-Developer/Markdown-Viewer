# Docker Deployment Guide

This page provides comprehensive documentation for containerizing, running, and proxying **Markdown Viewer** (v3.8.0) using Docker and Docker Compose.

---

## Table of Contents

- [Quick Start Command](#quick-start-command)
- [Docker Run Command Reference](#docker-run-command-reference)
- [Docker Compose Integration](#docker-compose-integration)
- [Building the Image Locally](#building-the-image-locally)
- [Production Nginx Settings & Security Headers](#production-nginx-settings--security-headers)
- [Configuring the App at a Custom Sub-Path](#configuring-the-app-at-a-custom-sub-path)
- [Reverse Proxy Server Integrations](#reverse-proxy-server-integrations)
  - [Nginx Configuration](#nginx-configuration)
  - [Caddy Configuration](#caddy-configuration)
  - [Traefik Compose Labels](#traefik-compose-labels)
- [CI/CD Deployment Automation](#cicd-deployment-automation)

---

## Quick Start Command

To spin up a local instance immediately:

```bash
docker pull ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0
```

Open **http://localhost:8080** in your browser.

---

## Docker Run Command Reference

### Custom Port Mapping
To map the container to a different host port (such as `8081`):
```bash
docker pull ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0
docker run -d --name markdown-viewer -p 8081:80 ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0
```

### Specifying Version Tags
You can pin the container to a specific commit or release by replacing `latest` with the appropriate tag:
```bash
docker run -d --name markdown-viewer -p 8080:80 ghcr.io/thisis-developer/markdown-viewer:main
```

Available image tags:
*   `latest`: The latest stable build from the main branch.
*   `main`: The most recent commit pushed to the main branch.
*   `<commit-sha>` (e.g. `e3d7a1b`): A build pinned to a specific commit.

---

## Docker Compose Integration

The repository includes a default `docker-compose.yml` file for Compose-based deployments:

### Starting the Services
```bash
docker compose up -d
```

### Stopping the Services
```bash
docker compose down
```

### Rebuilding Containers
To rebuild the image using local source code changes:
```bash
docker compose up -d --build
```

### Default `docker-compose.yml` Configuration
```yaml
services:
  markdown-viewer:
    image: ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0
    container_name: markdown-viewer
    ports:
      - "8080:80"
    restart: unless-stopped
```

---

## Building the Image Locally

To build a custom Docker image from the source code:

1.  Clone the repository and navigate to the project directory:
    ```bash
    git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
    cd Markdown-Viewer
    ```
2.  Build the Docker image:
    ```bash
    docker build -t markdown-viewer:local .
    ```
3.  Run the local container:
    ```bash
    docker run -d --name markdown-viewer-local -p 8080:80 markdown-viewer:local
    ```

---

## Production Nginx Settings & Security Headers

The Docker image uses `nginx:alpine` and includes custom configurations to optimize caching and security:

### Core Configurations
*   **Single-Page App (SPA) Routing:** Requests are redirected to `/index.html` to support client-side routing.
*   **Static Asset Caching:** Cache-control headers are set to one year (`max-age=31536000`) for static files (JS, CSS, images, fonts).
*   **Security Headers:** To protect the app from typical web vulnerabilities, Nginx is configured to inject the following headers:

```nginx
# Prevents the app from being embedded in iframes on other domains (XSS and Clickjacking protection)
add_header X-Frame-Options "SAMEORIGIN" always;

# Blocks browsers from MIME-type sniffing
add_header X-Content-Type-Options "nosniff" always;

# Restricts referrer information sent with outbound links
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## Configuring the App at a Custom Sub-Path

To serve Markdown Viewer from a sub-path (e.g. `example.com/editor/`) instead of the root directory, update the Nginx configuration inside the `Dockerfile`:

Modify the root location block in the Nginx config to use an alias for the sub-path:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;

    location /editor/ {
        alias /usr/share/nginx/html/;
        try_files $uri $uri/ /editor/index.html;
    }
}
```

Rebuild the Docker image after applying these changes.

---

## Reverse Proxy Server Integrations

### Nginx Configuration
To set up a reverse proxy with Nginx, use this server block to forward incoming requests to the Markdown Viewer container (running on port `8080`):

```nginx
server {
    listen 443 ssl;
    server_name markdown.example.com;

    ssl_certificate     /etc/ssl/certs/markdown.pem;
    ssl_certificate_key /etc/ssl/private/markdown.key;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy Configuration
Caddy automatically handles HTTPS and reverse proxy configurations. Update your `Caddyfile` with the following rule:

```caddyfile
markdown.example.com {
    reverse_proxy localhost:8080
}
```

### Traefik Compose Labels
To use Traefik to route traffic to the Markdown Viewer container, add these labels to the service definition in your `docker-compose.yml` file:

```yaml
services:
  markdown-viewer:
    image: ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0
    container_name: markdown-viewer
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mdviewer.rule=Host(`markdown.example.com`)"
      - "traefik.http.routers.mdviewer.entrypoints=websecure"
      - "traefik.http.routers.mdviewer.tls.certresolver=letsencrypt"
      - "traefik.http.services.mdviewer.loadbalancer.server.port=80"
    restart: unless-stopped
```

---

## CI/CD Deployment Automation

The repository includes a GitHub Actions workflow (`.github/workflows/docker-publish.yml`) that automates container building and publishing:

*   **Pushes to `main`:** Builds and pushes multi-architecture images (`linux/amd64` and `linux/arm64`) to the GitHub Container Registry (`ghcr.io`).
*   **Pull Requests:** Automatically builds the image to verify compile status and check for errors, without publishing it to the registry.
