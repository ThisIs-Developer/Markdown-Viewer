# Desktop Markdown Editor Application

The desktop application wraps Markdown Viewer in Neutralinojs for users who want a lightweight local Markdown Editor and viewer window. It uses the same Editor, Preview, renderer, sharing, and export code as the web application, with native file dialogs and local desktop storage.

## What Is Different from the Web Application?

- Runs in a Neutralinojs desktop window.
- Uses native open/save dialogs for Markdown and HTML.
- Can read a Markdown file path passed as a launch argument.
- Asks for confirmation before closing.
- Keeps small interface preferences in system-scoped Neutralino storage and documents in the durable Markdown Viewer Vault.
- Uses a restricted native API allowlist.
- Prepared builds load renderer libraries from local `/libs/...` files instead of CDNs.
- The default configuration does not expose `os.execCommand`; Markdown preview cannot execute local shell commands through the standard desktop build.

Network features remain network features: managed media upload, GitHub import, stored Share Snapshot, Live Share, remote diagram rendering, external images, and external links can still contact remote services.

PlantUML and D2 contain an optional local-command code path, but it requires `os.execCommand` plus explicit opt-in. Because the default native allowlist omits that API, the standard desktop build uses the remote PlantUML/Kroki paths.

## Directory Structure

```text
desktop-app/
  neutralino.config.json
  package.json
  setup-binaries.js
  prepare.js
  resources/
    index.html
    styles.css
    js/
      main.js
      script.js
      preview-worker.js
      neutralino.js
    libs/
    assets/
```

`prepare.js` recreates the resource files from the root web app. Do not hand-edit generated resource copies unless you plan to rerun preparation.

## Development

```bash
cd desktop-app
npm install
npm run dev
```

`npm run dev` runs setup first, then starts the Neutralino app through `npx -y @neutralinojs/neu@11.7.0 run`. Setup downloads the binaries and runs `prepare.js`.

## Build

```bash
npm run build
```

The build generates seven platform-specific executables under
`desktop-app/dist/markdown-viewer/`. Each executable is built separately with
`--embed-resources`, so every download is self-contained and does not require a
neighboring `resources.neu` file. Release publishing uploads the seven binaries
individually rather than creating a portable application ZIP.

## Runtime Configuration

Important `neutralino.config.json` values:

| Setting | Current Value |
| :--- | :--- |
| Application id | `com.markdownviewer.desktop` |
| Document root | `/resources/` |
| Default mode | `window` |
| Window size | 1280 x 720 |
| Minimum size | 400 x 200 |
| Native API | Enabled |
| Token security | One-time |
| Logging | Disabled |

Allowed native APIs:

- `app.exit`
- `os.showOpenDialog`
- `os.showSaveDialog`
- `os.showMessageBox`
- `os.open`
- `os.setTray`
- `filesystem.readFile`
- `filesystem.writeFile`
- `storage.setData`
- `storage.getData`

`os.execCommand` is intentionally absent from the default allowlist. A custom build that adds local command execution must treat document content as untrusted and use an explicit opt-in with fixed, narrowly scoped commands.

Browser/chrome modes block filesystem and OS APIs more tightly.

## Desktop Preparation

`prepare.js`:

- Copies the root app into `desktop-app/resources`.
- Copies assets.
- Moves runtime scripts to the desktop resource structure.
- Rewrites library URLs for Neutralino.
- Downloads required external libraries to `resources/libs`.
- Verifies SHA-384 integrity when SRI hashes are available.
- Bundles Bootstrap icon fonts.
- Strips web-only SEO/canonical/hreflang/schema metadata from the desktop HTML.

This is why the prepared desktop application can load core bundled renderer libraries without CDNs after setup.

## Platform Notes

Windows may show SmartScreen warnings because binaries are unsigned.

Linux:

```bash
chmod +x markdown-viewer-linux_x64
./markdown-viewer-linux_x64
```

macOS:

```bash
xattr -d com.apple.quarantine markdown-viewer-mac_universal
chmod +x markdown-viewer-mac_universal
./markdown-viewer-mac_universal
```

## Data Handling

- Normal documents are ordinary `.md` files under the fixed `Documents/Markdown Viewer Vault/Workspace` path.
- Vault metadata, up to 20 recent history copies per document, trash, recovery journals, settings, and opaque encrypted Secret Workspace records are kept under the same vault.
- Replacement binaries check the fixed vault path automatically. Use **Storage and Backup** to inspect, back up, import, or open it.
- Importing a ZIP backup replaces the current workspace. ZIP backups exclude vault history, trash, and recovery journals; copy the full vault separately when those records must also be retained.
- Native file access happens through explicit open/save actions or launch arguments.
- The app does not include analytics or telemetry.
- Sharing/import/remote-rendering features use the same network behavior as the web app.
- Private mode pauses new persistence without deleting saved content. **Reset workspace** permanently deletes the vault content and application preferences after confirmation.

Related pages: [Installation](Installation.md), [Configuration](Configuration.md), [Privacy and Security](Privacy-and-Security.md), and [Troubleshooting](Troubleshooting.md#the-desktop-application-does-not-start).
