# System & Build Configuration

This page details the configuration variables, local storage structures, container files, and desktop configuration parameters for **Markdown Viewer** (v3.8.0).

---

## Table of Contents

- [Client-Side LocalStorage Keys](#client-side-localstorage-keys)
- [CDN Library Integrations](#cdn-library-integrations)
- [Nginx Container Configuration](#nginx-container-configuration)
- [Docker Compose Service Schema](#docker-compose-service-schema)
- [NeutralinoJS Desktop Configuration](#neutralinojs-desktop-configuration)
- [Desktop App Package Scripts](#desktop-app-package-scripts)
- [GitHub Actions Workflows](#github-actions-workflows)

---

## Client-Side LocalStorage Keys

The web application stores user preferences and document states directly in the browser's `localStorage`.

| LocalStorage Key | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `theme` | `"light"` \| `"dark"` | System preference | Renders light or dark colors. |
| `syncScroll` | `"true"` \| `"false"` | `"true"` | Controls editor-preview scroll sync. |
| `viewMode` | `"split"` \| `"editor"` \| `"preview"` | `"split"` | Sets the default editing layout. |
| `markdown_tabs` | `JSON string` | Sample tab schema | Array of document objects (ID, title, content, scroll position, view mode). |

---

## CDN Library Integrations

Markdown Viewer loads large dependencies from CDNs. To update a library or pin it to a specific version, modify the script or link tag in the head of `index.html`:

| Library Name | Version | CDN Service Provider | Core URL |
| :--- | :--- | :--- | :--- |
| **Marked.js** | `9.1.6` | jsDelivr | `https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js` |
| **Highlight.js** | `11.9.0` | cdnjs | `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js` |
| **DOMPurify** | `3.0.9` | jsDelivr | `https://cdn.jsdelivr.net/npm/dompurify@3.0.9/dist/purify.min.js` |
| **MathJax** | `3.2.2` | jsDelivr | `https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js` |
| **Mermaid** | `11.15.0` | jsDelivr | `https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.min.js` |
| **jsPDF** | `2.5.1` | cdnjs | `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` |
| **html2canvas** | `1.4.1` | cdnjs | `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` |
| **Pako** | `2.1.0` | cdnjs | `https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js` |
| **js-yaml** | `4.1.0` | cdnjs | `https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js` |
| **FileSaver.js** | `2.0.5` | cdnjs | `https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js` |
| **Bootstrap** | `5.3.2` | jsDelivr | `https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.js` |

---

## Nginx Container Configuration

The container image is built using `nginx:alpine`. Static web files are served from `/usr/share/nginx/html/`.

### Embedded Nginx Configuration (`/etc/nginx/conf.d/default.conf`)
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Assets Caching (1 year)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

---

## Docker Compose Service Schema

The `docker-compose.yml` file defines how the container runs locally:

```yaml
services:
  markdown-viewer:
    image: ghcr.io/thisis-developer/markdown-viewer:sha-15eafb0
    container_name: markdown-viewer
    ports:
      - "8080:80"
    restart: unless-stopped
```

To build and run a local image instead of pulling the pre-built container from the registry, replace the `image` key with `build: .`:
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

## NeutralinoJS Desktop Configuration

The desktop application uses the NeutralinoJS framework, which is configured in `desktop-app/neutralino.config.json`.

```json
{
  "applicationId": "js.neutralino.markdownviewer",
  "version": "1.2.0",
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
    "width": 1000,
    "minWidth": 800,
    "height": 700,
    "minHeight": 500,
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

### Key Window Settings
*   `width` / `height`: The default launch window size in pixels ($1000 \times 700$).
*   `minWidth` / `minHeight`: Restricts window scaling below $800 \times 500$ to prevent UI layout issues.
*   `nativeAllowList`: Grants the application permission to access OS and filesystem APIs (e.g. `filesystem.*` is required for loading and saving local files).

---

## Desktop App Package Scripts

The `desktop-app/package.json` file contains scripts for development, packaging, and dependency updates:

| Script Name | Command | Description |
| :--- | :--- | :--- |
| `setup` | `node setup-binaries.js` | Downloads Neutralino platform-specific runtimes. |
| `dev` | `npx @neutralinojs/neu run` | Starts the desktop app in hot-reload development mode. |
| `prepare` | `node prepare.js` | Copies core files from the project root into the desktop build directory. |
| `build` | `node build-windows.js` | Compiles a single-file executable for Windows. |
| `build:portable` | `npx @neutralinojs/neu build --release` | Packages the application into zip files for Windows, Linux, and macOS. |

---

## GitHub Actions Workflows

The repository uses two GitHub Actions workflows:

### 1. Docker Build & Publish (`docker-publish.yml`)
*   **Triggers:** Pushes to the `main` branch, or pull requests.
*   **Registry:** GitHub Container Registry (`ghcr.io`).
*   **Target Architectures:** `linux/amd64` and `linux/arm64` (multi-arch build).
*   **Tags:** `latest` for main branch releases, and commit-sha tags for development runs.

### 2. Desktop Compiler (`desktop-build.yml`)
*   **Triggers:** Pushing Git tags that match the pattern `desktop-v*` (e.g. `desktop-v1.2.0`).
*   **Action:** Runs on Node LTS, runs the `setup`, `prepare`, and `build:portable` scripts, and generates checksums.
*   **Release:** Automatically creates a draft release on GitHub and uploads the compiled binaries as assets.
