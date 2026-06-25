# Markdown Viewer Desktop App Port

This is a desktop app port of [Markdown Viewer](https://github.com/ThisIs-Developer/Markdown-Viewer), see [README](../README.md). It is built using [Neutralinojs](https://github.com/neutralinojs/neutralinojs).

## Architecture

The desktop app **shares** its core files (`script.js`, `styles.css`, `assets/`) with the browser version in the repo root. A build script (`prepare.js`) copies these files into `resources/` and injects Neutralinojs-specific additions into `index.html` at build time.

Neutralinojs platform binaries are managed by `setup-binaries.js`, which downloads them on first use and caches them in `bin/` (gitignored). The download is version-locked to `cli.binaryVersion` in `neutralino.config.json` and only re-triggered when that version changes.

Desktop-only files (not generated):

- `resources/js/main.js` — Neutralinojs lifecycle, tray menu, window events
- `resources/js/neutralino.js` — Neutralinojs client library
- `neutralino.config.json` — App configuration
- `setup-binaries.js` — Idempotent binary setup (downloads on first use)

## Development

### Requirements

- [Node.js](https://nodejs.org/)

### Setup

No installation is required. The app is built and run using `npx` (via npm scripts).

Neutralinojs platform binaries are downloaded automatically on first build or dev run. To manually trigger the download:

```bash
npm run setup
```

Binaries are cached in `bin/` (gitignored) and only re-downloaded when `cli.binaryVersion` in `neutralino.config.json` changes.

### Running the app

```bash
npm run dev
```

This automatically runs `setup` (downloads binaries if needed and prepares resources) before starting the app. Hot-reload is enabled by default. Enable the browser inspector by setting `"enableInspector": true` in `neutralino.config.json`.

For more information, see the [Neutralinojs documentation](https://neutralino.js.org/docs/cli/neu-cli#installation).

### Building the app

**Default** - Build the portable Neutralino bundle:

```bash
npm run build
```

Build output is placed in `dist/`.

Note: `npm run build` writes the portable app directory to
`dist/markdown-viewer/`, including platform binaries and `resources.neu`. The
GitHub release workflow archives that directory as a ZIP and also uploads the
Windows x64 executable as a standalone asset.

For more information, see the [Neutralinojs documentation](https://neutralino.js.org/docs/cli/neu-cli#neu-build).

### Building with Docker

Build binaries without installing Node.js locally:

```bash
docker compose up --build
```

Build artifacts will be output to `desktop-app/output/`.

## Releases

Prebuilt binaries are automatically built and published as GitHub Releases when a tag matching `desktop-v*` is pushed (e.g., `desktop-v1.0.0`). See [`.github/workflows/desktop-build.yml`](../.github/workflows/desktop-build.yml).

Each release includes:

| Asset | Description |
| ----- | ----------- |
| `markdown-viewer-win_x64.exe` | Windows x64 executable |
| `markdown-viewer-vX.Y.Z-portable.zip` | Portable bundle with `resources.neu` (all platforms) |
| `source.tar.gz` | Desktop app source archive |
| `SHA256SUMS.txt` | Checksums for all release assets |

## License

**MIT**.

The desktop version uses [Neutralinojs](https://github.com/neutralinojs/neutralinojs), which is also licensed under the MIT License.

- [Neutralinojs](https://github.com/neutralinojs/neutralinojs): [LICENSE (MIT)](LICENSE)
- [Markdown Viewer & Desktop Port](https://github.com/ThisIs-Developer/Markdown-Viewer): [LICENSE (MIT)](../LICENSE)

## Contributors

[![Contributors](https://contrib.rocks/image?repo=ThisIs-Developer/Markdown-Viewer)](https://github.com/ThisIs-Developer/Markdown-Viewer/graphs/contributors)
