# Configuration

This page documents all configuration files and customizable settings in **Markdown Viewer**.

---

## Table of Contents

- [Web Application](#web-application)
- [Docker / Nginx](#docker--nginx)
- [Docker Compose](#docker-compose)
- [Desktop App — neutralino.config.json](#desktop-app--neutralinoconfigjson)
- [Desktop App — package.json Scripts](#desktop-app--packagejson-scripts)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Transparency & Data Flow](#transparency--data-flow)

---

## Web Application

The web application has no server-side or build-time configuration. User preferences are stored in the browser's **`localStorage`** and persist across sessions.

### localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `theme` | `"light"` \| `"dark"` | Active color theme |
| `syncScroll` | `"true"` \| `"false"` | Synchronized scroll state |
| `viewMode` | `"split"` \| `"editor"` \| `"preview"` | Active layout mode |
| `editorContent` | `string` | Last editor content (autosaved) |

### CDN Library Versions

Library versions are defined inline in `index.html`. To pin or upgrade a library, edit the corresponding `<script>` or `<link>` tag:

```html
<!-- Example: upgrading marked.js -->
<script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"></script>
```

Current library versions are documented in the [Home](Home) page technology table.

---

## Transparency & Data Flow

Markdown Viewer is a static client-side app. Key data flows to be aware of:

- **Local storage**: Editor content and preferences are stored in `localStorage`.
- **CDN assets**: Libraries are loaded from public CDNs (cdnjs, jsDelivr).
- **GitHub import**: Public file imports use `api.github.com` and `raw.githubusercontent.com`.
- **Share links**: Shared documents are encoded into the URL hash and never uploaded.

To eliminate external network requests, replace CDN links in `index.html` with locally hosted files and rebuild the desktop resources with `node prepare.js`.

---

## Docker / Nginx

The `Dockerfile` builds a production image using `nginx:alpine`. The embedded Nginx configuration can be customized by modifying the `Dockerfile` before building.

### Default Nginx Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Listen port | `80` | HTTP port inside the container |
| Document root | `/usr/share/nginx/html` | Static file serving directory |
| SPA routing | `try_files $uri $uri/ /index.html` | Fallback for client-side routing |
| Static asset cache | `1 year` | `Cache-Control: public, immutable` |
| X-Frame-Options | `SAMEORIGIN` | Prevents embedding in iframes |
| X-Content-Type-Options | `nosniff` | Prevents MIME-type sniffing |

### Changing the Exposed Port

The container always listens on port `80` internally. Map it to a different host port via `-p`:

```bash
docker run -p 3000:80 ghcr.io/thisis-developer/markdown-viewer:latest
```

### Serving at a Sub-Path

To serve the app at `/app/` instead of `/`, update the Nginx `location` block in the `Dockerfile`:

```nginx
location /app/ {
    alias /usr/share/nginx/html/;
    try_files $uri $uri/ /app/index.html;
}
```

---

## Docker Compose

The `docker-compose.yml` in the repository root:

```yaml
services:
  markdown-viewer:
    image: ghcr.io/thisis-developer/markdown-viewer:latest
    container_name: markdown-viewer
    ports:
      - "8080:80"
    restart: unless-stopped
```

### Configurable Fields

| Field | Default | Description |
|-------|---------|-------------|
| `image` | `ghcr.io/…:latest` | Docker image to use |
| `container_name` | `markdown-viewer` | Container name |
| `ports` | `8080:80` | Host-to-container port mapping |
| `restart` | `unless-stopped` | Container restart policy |

To build and use a local image instead of the published one, replace the `image` field with a `build` section:

```yaml
services:
  markdown-viewer:
    build: .
    container_name: markdown-viewer
    ports:
      - "8080:80"
    restart: unless-stopped
```

---

## Desktop App — neutralino.config.json

Located at `desktop-app/neutralino.config.json`.

```jsonc
{
  "applicationId": "js.neutralino.sample",
  "version": "1.0.0",
  "defaultMode": "window",
  "enableServer": true,
  "enableNativeAPI": true,
  "tokenSecurity": "one-time",
  "logging": {
    "enabled": true,
    "writeToLogFile": true
  },
  "nativeAllowList": [
    "app.*",
    "os.*",
    "debug.*",
    "filesystem.*"
  ],
  "window": {
    "title": "Markdown Viewer",
    "width": 800,
    "minWidth": 600,
    "height": 500,
    "minHeight": 400,
    "resizable": true,
    "maximize": false,
    "center": true
  },
  "modes": {
    "window": {
      "index": "/index.html",
      "icon": "/resources/assets/icon.jpg"
    }
  },
  "cli": {
    "binaryName": "markdown-viewer",
    "resourcesPath": "/resources/",
    "extensionsPath": "/extensions/",
    "clientLibrary": "/resources/js/neutralino.js",
    "binaryVersion": "6.5.0",
    "clientVersion": "11.7.0"
  }
}
```

### Key Configuration Options

| Field | Description |
|-------|-------------|
| `applicationId` | Unique application identifier (reverse-domain format) |
| `version` | Application version string |
| `defaultMode` | Launch mode: `window`, `browser`, `cloud`, or `chrome` |
| `window.width` / `window.height` | Initial window dimensions in pixels |
| `window.minWidth` / `window.minHeight` | Minimum resizable dimensions |
| `window.center` | Whether to center the window on launch |
| `cli.binaryName` | Output binary name prefix |
| `cli.binaryVersion` | Neutralinojs runtime version to use |

---

## Desktop App — package.json Scripts

Located at `desktop-app/package.json`.

| Script | Command | Description |
|--------|---------|-------------|
| `setup` | `node setup-binaries.js` | Download Neutralinojs binaries |
| `dev` | `npx @neutralinojs/neu@11.7.0 run` | Start with hot-reload |
| `build` | `npx @neutralinojs/neu@11.7.0 build --embed-resources` | Build embedded single-file binaries |
| `build:portable` | `npx @neutralinojs/neu@11.7.0 build --release` | Build portable (resource-separated) binaries |
| `build:all` | `npm run build && npm run build:portable` | Build both embedded and portable |

---

## GitHub Actions Workflows

### docker-publish.yml

Located at `.github/workflows/docker-publish.yml`.

| Setting | Value |
|---------|-------|
| Trigger | Push to `main`, Pull requests |
| Registry | `ghcr.io` |
| Image name | `thisis-developer/markdown-viewer` |
| Tags generated | `latest` (on main), branch name, PR number, commit SHA |
| Platforms | `linux/amd64`, `linux/arm64` |

### desktop-build.yml

Located at `.github/workflows/desktop-build.yml`.

| Setting | Value |
|---------|-------|
| Trigger | Git tags matching `desktop-v*` |
| Node.js version | LTS |
| Build platforms | Windows x64, Linux x64, Linux ARM64, macOS Universal |
| Artifacts | Embedded binaries + `checksums.sha256` |
| GitHub Release | Created automatically with binaries as assets |
