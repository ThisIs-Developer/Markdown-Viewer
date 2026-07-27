# Markdown Viewer Desktop App

This folder contains the Neutralinojs desktop wrapper for Markdown Viewer. It turns the browser-based Markdown editor, viewer, and reader into a lightweight desktop build for opening local `.md` files, using split live preview, exporting documents, and working with native file dialogs. It reuses the root web app and adds window lifecycle handling, desktop storage mirroring, and prepared local renderer assets.

For the complete product behavior and privacy reference, see [../wiki/Features.md](../wiki/Features.md).

## Architecture

The desktop app shares the same core product code as the browser version:

- `../index.html`
- `../script.js`
- `../styles.css`
- `../preview-worker.js`
- `../assets/`

`prepare.js` copies those files into `desktop-app/resources`, rewrites paths for Neutralino, downloads external libraries into `resources/libs`, verifies SHA-384 integrity where available, and strips web-only SEO metadata from the desktop HTML.

Desktop-only files:

- `neutralino.config.json`: Neutralino runtime configuration and native API allowlist.
- `setup-binaries.js`: Idempotent Neutralino binary setup.
- `resources/js/main.js`: window close confirmation, tray setup, launch-file import, and external-open handling.
- `resources/js/neutralino.js`: Neutralino client library.

## Desktop Behavior

- Local editing, preview, document tabs, exports, and settings stay on the local machine.
- Comments and suggestions stay with normal local tabs and are excluded from document exports and Share Snapshot links.
- Normal app state is stored in localStorage and mirrored to Neutralino storage.
- Native Markdown/HTML save and Markdown open flows use Neutralino dialogs and filesystem APIs.
- A Markdown file passed as a launch argument is loaded into the editor.
- The app asks before closing the window.
- Prepared desktop resources load dynamic libraries from local `/libs/...` paths after setup.

Network features still use the network when invoked: managed media upload, GitHub import, stored Share Snapshot, Live Share, remote diagram rendering, external images, and external links.

## Development

Requirements:

- Node.js and npm.
- Internet access for first setup and dependency preparation.

Run:

```bash
cd desktop-app
npm install
npm run dev
```

`npm run dev` runs setup first. Setup downloads Neutralino binaries, runs `prepare.js`, and caches binaries in `bin/` until the configured Neutralino version changes.

## Build

```bash
npm run build
```

The build script runs `build-standalone.js`. It invokes Neutralino once per target with embedded resources so Node.js does not need to package every platform in one memory-heavy pass.

Seven self-contained executables are written to `desktop-app/dist/markdown-viewer/`: Linux ARM64, ARMHF, and x64; macOS ARM64, universal, and x64; and Windows x64. They do not need a neighboring `resources.neu` file.

## Configuration Highlights

| Setting | Value |
| :--- | :--- |
| Application id | `com.markdownviewer.desktop` |
| Document root | `/resources/` |
| Default window | 1280 x 720 |
| Minimum window | 400 x 200 |
| Native API | Enabled |
| Token security | One-time |
| Logging | Disabled |

Native APIs are intentionally allowlisted: app exit, open/save dialogs, message boxes, external URL open, tray setup, file read/write, and storage get/set. Command execution is not part of the default allowlist.

## Local Renderer Security

Markdown content is treated as untrusted input. The desktop app does not allow Markdown preview rendering to run local shell commands by default. Native file open/save remains available through Neutralino dialogs and filesystem APIs.

Remote-safe diagram rendering continues to work where supported. Local command renderers such as D2 or PlantUML should only be enabled in a custom build after the user has explicitly accepted that local renderer programs process document content on their machine, and only fixed commands with stdin input should be allowed.

## Docker Build

The desktop folder also includes Docker files for building these artifacts in a container:

```bash
docker compose up --build
```

The compose build copies the generated files to `desktop-app/output/`.

## Releases

Prebuilt desktop assets are published through GitHub Releases. Release workflows run setup, preparation, build, and checksum generation.

Unsigned desktop binaries may trigger Windows SmartScreen or macOS quarantine prompts. See [../wiki/Desktop-App.md](../wiki/Desktop-App.md) for platform launch notes.

## License

Markdown Viewer is licensed under the Apache License 2.0. Neutralinojs is licensed under MIT; see the bundled Neutralino license file in this folder.
