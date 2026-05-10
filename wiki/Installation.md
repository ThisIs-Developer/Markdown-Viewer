# Installation

This page describes every way to install and run **Markdown Viewer**.

---

## Table of Contents

- [Option 1 — Docker (Recommended)](#option-1--docker-recommended)
- [Option 2 — Docker Compose](#option-2--docker-compose)
- [Option 3 — Self-Hosted Static Web Server](#option-3--self-hosted-static-web-server)
- [Option 4 — Desktop Application](#option-4--desktop-application)
- [System Requirements](#system-requirements)

---

## Option 1 — Docker (Recommended)

The easiest way to run Markdown Viewer is with a single Docker command. The pre-built image is available from the **GitHub Container Registry (GHCR)**.

```bash
docker run -d \
  --name markdown-viewer \
  -p 8080:80 \
  --restart unless-stopped \
  ghcr.io/thisis-developer/markdown-viewer:latest
```

Then open **http://localhost:8080** in your browser.

### Available Image Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable build from the `main` branch |
| `main` | Same as `latest` |
| `<commit-sha>` | Pinned to a specific commit |

---

## Option 2 — Docker Compose

For a more reproducible local setup, clone the repository and use Docker Compose.

### 1. Clone the repository

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
```

### 2. Start the application

```bash
docker compose up -d
```

The application starts on **http://localhost:8080**.

### 3. Stop the application

```bash
docker compose down
```

### docker-compose.yml overview

```yaml
services:
  markdown-viewer:
    image: ghcr.io/thisis-developer/markdown-viewer:latest
    container_name: markdown-viewer
    ports:
      - "8080:80"
    restart: unless-stopped
```

You can change the host port by modifying the left side of `8080:80` (e.g., `3000:80`).

---

## Option 3 — Self-Hosted Static Web Server

Because the application is 100% client-side, you can serve it from any static web server.

### Clone the repository

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
```

### Serve with Python (no dependencies)

```bash
python3 -m http.server 8080
```

### Serve with Node.js `serve`

```bash
npx serve . -p 8080
```

### Serve with VS Code Live Server

Open the project folder in VS Code and click **Go Live** in the status bar.

> **Note**: Opening `index.html` directly with `file://` may have limitations with some browser security policies. Using a local server is recommended.

---

## Option 4 — Desktop Application

Markdown Viewer is also available as a cross-platform native desktop application powered by [Neutralinojs](https://neutralino.js.org/).

> **Transparency note**: The desktop app uses the same `index.html` and CDN-hosted libraries as the web app. It can run offline after assets are cached, or if you replace CDN links with local copies and run `node prepare.js`.

### Download a Pre-Built Binary

Go to the [Releases page](https://github.com/ThisIs-Developer/Markdown-Viewer/releases) and download the appropriate binary for your platform:

| Platform | File |
|----------|------|
| Windows (x64) | `markdown-viewer-win_x64.exe` |
| Linux (x64) | `markdown-viewer-linux_x64` |
| Linux (ARM64) | `markdown-viewer-linux_arm64` |
| macOS (Universal) | `markdown-viewer-mac_universal` |

### Build from Source

See the [Desktop App](Desktop-App) wiki page for full build instructions.

---

## Transparency & Network Dependencies

Markdown Viewer is a static client-side application, so there is no server-side processing or telemetry. However, the web build loads third-party libraries from public CDNs (cdnjs and jsDelivr) and GitHub imports use public GitHub APIs. If you require a fully offline or isolated environment, self-host the CDN assets and avoid GitHub import.

The Docker image contains only static assets and an Nginx server. There are no background services, analytics scripts, or external callbacks beyond the CDN libraries referenced by the app.

---

## System Requirements

### Web / Docker

| Requirement | Minimum |
|-------------|---------|
| Browser | Chrome 90+, Firefox 90+, Edge 90+, Safari 15+ |
| Docker | 20.10+ (for Docker option) |
| RAM | 512 MB |

### Desktop App

| Requirement | Minimum |
|-------------|---------|
| OS | Windows 10+, Ubuntu 20.04+, macOS 11+ |
| Architecture | x64 or ARM64 |
| Node.js | 16+ (only required for building from source) |
| RAM | 256 MB |
