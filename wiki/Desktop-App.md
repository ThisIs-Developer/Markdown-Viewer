# Desktop Markdown Editor Application

The desktop application wraps Markdown Viewer in Neutralinojs for users who want a lightweight local Markdown Editor and viewer window. It uses the same Editor, Preview, renderer, sharing, and export code as the web application, with native file dialogs and local desktop storage.

## What Is Different from the Web Application?

- Runs in a Neutralinojs desktop window.
- Uses the Markdown Viewer artwork for the desktop window and packaged Windows executable instead of the default Neutralino icon.
- Uses native open/save dialogs for Markdown and HTML.
- Can read a Markdown file path passed as a launch argument.
- Asks for confirmation before closing.
- Keeps small interface preferences in system-scoped Neutralino storage and documents in the durable Markdown Viewer Vault.
- Uses a restricted native API allowlist.
- Prepared builds load renderer libraries from local `/libs/...` files instead of CDNs.
- The default configuration does not expose `os.execCommand`; Markdown preview cannot execute local shell commands through the standard desktop build.

Network features remain network features: managed media upload, GitHub import, stored Share Snapshot, Live Share, remote diagram rendering, external images, and external links can still contact remote services.

PlantUML and D2 contain an optional local-command code path, but it requires `os.execCommand` plus explicit opt-in. Because the default native allowlist omits that API, the standard desktop build uses the remote PlantUML/Kroki paths.

## Linked Workspace

Linked Workspace keeps references to external Markdown files separate from independent
Workspace (Vault) documents. Use the Explorer toolbar or Linked Workspace context menu
and choose **Link file** or **Link folder** to link existing files/folders. The header's
plus menu stays the same as the web app: **New document**, **From files**, and **From GitHub**.
Workspace and folder icons turn blue when expanded, independently of the active document.
Linking the same normalized
source path reuses its existing document. Folder linking includes nested Markdown files.

Right-click a linked folder or subfolder to group existing links inside it. This sidebar
organization does not move originals or change filesystem scan roots. Independently
grouped links remain available if their parent source folder is removed or converted.

- Edits autosave recovery drafts under the separate **Linked Workspace** storage root,
  mirroring linked-folder subdirectories. They do not automatically overwrite originals.
- **Save / Ctrl+S** writes the selected linked original after preserving and verifying
  its recovery draft, without an ordinary confirmation prompt. Conflict/missing-source
  decisions remain explicit.
- **Save As…** creates a separate external file/link. **Save As linked file…** on a Vault
  document keeps its Vault copy and activates the new link. Dialogs suggest the document
  title and append `.md` when no extension is supplied. Ctrl+S recognizes keyboard layouts;
  Ctrl+Shift+S keeps its existing scroll-sync action.
- **Convert to Workspace copy** preserves the current draft as an independent Vault
  document without changing its original. Files and linked-folder subtrees can also be
  dragged into the Vault using ordinary internal HTML dragging. Reverse linking by
  internal dragging is not supported.
- Folder conversion retains the source hierarchy. **Save As linked folder…** exports a
  Vault folder to a new external directory, preserves Vault documents and links the result.
- Removing linked files/folders removes application references, not originals. Automatic
  scans respect removed links; explicit Rescan or re-linking the same folder restores them.
  Removal and conversion exclusions apply to every covering linked root, including
  separately linked parent and child folders.
- External changes refresh unmodified drafts. Conflicts, missing sources and incomplete
  scans retain drafts and show distinct hover indicators rather than repeated alerts.
  Reload, overwrite and recreation decisions use application confirmations.
- A built-in editable quick-start guide opens in Split view and explains these workflows
  with a step-by-step diagram, quick-start instructions, and action tables. Both welcome guides use
  the `book-open` icon; guide identity comes from metadata, not an arbitrary document's title.
- Workspace backups include normal and linked recovery documents. Imported backups
  recover drafts but do not reconnect external paths or authorize writes to originals.
- Linked documents cannot move directly into Secret Workspace. Convert to a Vault copy
  first. Moving a Vault document into Secret saves its encrypted record before removing
  the active plaintext copy and its automatic history; a failed cleanup reports a failed move.

External HTML drops continue importing Vault copies. Native-path drop choice and
single-instance handling are separate runtime-dependent proposals, not enabled by this
workflow. Browser/Docker use hides native linking, filesystem and Save As linked controls;
recovered documents remain ordinary usable drafts without external write authority.

Folder scans are bounded (20 MiB per Markdown source, 200 MiB staged content, 40,000
entries, 10,000 Markdown files, 2,000 directories and 32 directory levels, with a 60-second
scan budget). A failed scan retains its previous
drafts. Save/conversion/export operations verify recoverable data and report partial
failures, but filesystem writes are not atomic transactions and cannot eliminate every
race with another process. Keep independent backups of important originals.

The application integration uses standard desktop filesystem APIs. Windows is the
manually tested development platform; native macOS/Linux behavior requires testing.

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

The shared web/desktop application code includes slash commands, natural Explorer sorting, middle-click tab closing, pane-scoped Select All, rich Preview copying, smooth Page Up/Down navigation, and native fullscreen or Expanded view fallback behavior.

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
- Private mode pauses new persistence for the current page session without deleting saved content and resets when the page reloads or exits. **Reset workspace** permanently deletes the vault content, folders, recovery data, and application preferences after confirmation.

Related pages: [Installation](Installation.md), [Configuration](Configuration.md), [Privacy and Security](Privacy-and-Security.md), and [Troubleshooting](Troubleshooting.md#the-desktop-application-does-not-start).
