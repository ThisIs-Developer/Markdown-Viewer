# Desktop App

This page covers the **Neutralinojs desktop application** port of Markdown Viewer — a lightweight, cross-platform native app built from the same source code as the web version.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Running in Development Mode](#running-in-development-mode)
- [Building the Desktop App](#building-the-desktop-app)
- [Build Output](#build-output)
- [Building with Docker](#building-with-docker)
- [Automated Releases](#automated-releases)
- [Platform Notes](#platform-notes)

---

## Overview

The desktop application wraps the same HTML/CSS/JavaScript that powers the web app inside a native [Neutralinojs](https://neutralino.js.org/) window. It:

- Runs **without a browser**; by default it loads CDN libraries, so an internet connection is required on first run unless you bundle assets locally.
- Produces a **single self-contained binary** that can be distributed without installers.
- Shares **100% of the core code** (`script.js`, `styles.css`, `assets/`) with the web app — no duplication.

---

## Network Dependencies & Offline Mode

By default, the desktop app uses the same CDN-hosted libraries referenced in `index.html` (cdnjs, jsDelivr). To run fully offline:

1. Download the CDN assets locally and update the `<script>`/`<link>` tags in `index.html`.
2. Run `node prepare.js` to copy the updated file into `desktop-app/resources/`.
3. Rebuild the app with `npm run build` or `npm run build:portable`.

Once the assets are local, the desktop app runs without network access.

---

## Architecture

```
desktop-app/
├── package.json              # NPM scripts (dev, build, setup)
├── neutralino.config.json    # Neutralinojs window and API config
├── setup-binaries.js         # Downloads Neutralinojs platform binaries
├── prepare.js                # Copies shared files from root into resources/
└── resources/
    ├── index.html            # Generated from root index.html
    ├── styles.css            # Copied from root
    ├── js/
    │   ├── main.js           # Neutralinojs lifecycle & tray menu
    │   ├── script.js         # Copied from root
    │   └── neutralino.js     # Neutralinojs client library
    └── assets/               # Copied from root assets/
```

The `prepare.js` script handles copying files from the project root into `desktop-app/resources/` before each build so there is a single source of truth.

---

## Prerequisites

- **Node.js** 16 or later (with `npm`)
- **Internet access** (required once to download Neutralinojs binaries)

---

## Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer/desktop-app

# 2. Install npm dependencies
npm install

# 3. Download Neutralinojs platform binaries (one-time setup)
node setup-binaries.js

# 4. Prepare resource files (copies shared files from the root)
node prepare.js
```

---

## Running in Development Mode

```bash
cd Markdown-Viewer/desktop-app
npm run dev
```

This starts the app with **hot-reload**: editing source files in the `resources/` directory reloads the running window automatically.

---

## Building the Desktop App

Three build modes are available:

### Embedded (single-file executable)

All resources are embedded inside the binary. No additional files are needed at runtime.

```bash
npm run build
```

### Portable (separate resources folder)

Resources remain in a separate folder alongside the binary, making it easier to update them without rebuilding.

```bash
npm run build:portable
```

### Both

```bash
npm run build:all
```

---

## Build Output

After building, output files are placed in `desktop-app/dist/`:

```
dist/
├── markdown-viewer-win_x64.exe       # Windows embedded binary
├── markdown-viewer-linux_x64         # Linux x64 embedded binary
├── markdown-viewer-linux_arm64       # Linux ARM64 embedded binary
├── markdown-viewer-mac_universal     # macOS universal binary
└── portable/                         # Portable builds (if built)
    ├── markdown-viewer-win_x64/
    ├── markdown-viewer-linux_x64/
    └── …
```

---

## Building with Docker

If you don't want to install Node.js locally, use the provided Docker setup to build the binaries inside a container:

```bash
cd Markdown-Viewer/desktop-app
docker compose up --build
```

The output binaries are written to `dist/` on the host machine via a volume mount.

---

## Automated Releases

The CI/CD pipeline (`.github/workflows/desktop-build.yml`) automatically builds and publishes binaries when a tag matching `desktop-v*` is pushed:

```bash
git tag desktop-v1.2.0
git push origin desktop-v1.2.0
```

This triggers a GitHub Actions workflow that:

1. Sets up Node.js
2. Runs `npm install` and `node setup-binaries.js`
3. Runs `node prepare.js`
4. Builds embedded binaries for all platforms
5. Computes SHA-256 checksums
6. Creates a GitHub Release with the binaries and checksums as assets

### Release Assets

| File | Platform |
|------|----------|
| `markdown-viewer-win_x64.exe` | Windows x64 |
| `markdown-viewer-linux_x64` | Linux x64 |
| `markdown-viewer-linux_arm64` | Linux ARM64 |
| `markdown-viewer-mac_universal` | macOS (Apple Silicon + Intel) |
| `checksums.sha256` | SHA-256 verification file |

---

## Platform Notes

### Windows

- Run the `.exe` directly — no installation required.
- Windows Defender SmartScreen may warn about an unsigned executable. Click "More info → Run anyway".

### Linux

- Mark the binary as executable after downloading:

```bash
chmod +x markdown-viewer-linux_x64
./markdown-viewer-linux_x64
```

### macOS

- macOS may block the binary because it is unsigned:

```bash
xattr -d com.apple.quarantine markdown-viewer-mac_universal
chmod +x markdown-viewer-mac_universal
./markdown-viewer-mac_universal
```

Or right-click the binary in Finder, select **Open**, and confirm the security prompt.
