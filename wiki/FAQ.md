# Markdown Viewer FAQ

## General

### What is Markdown Viewer?

Markdown Viewer is a browser-based Markdown editor, viewer, reader, and previewer for opening `.md` files, writing in plain Markdown, and using a split-screen live preview with sync scrolling. It also includes document tabs, GitHub-Flavored Markdown, math, diagrams, maps, STL models, ABC music notation, export tools, optional sharing, and a desktop app.

### Is it free?

Yes. The project is open source under the Apache License 2.0.

### Do I need an account?

No. There is no login, subscription, account system, analytics identity, or cloud workspace account. You can use the editor as a no-signup Markdown reader and previewer.

### Is it a WYSIWYG Markdown editor?

Not in the strict sense. Markdown Viewer is a plain-text Markdown editor with live preview and WYSIWYG-style toolbar helpers. You can quickly insert common formatting, but you do not directly edit the rendered preview like a full rich-text editor.

### Can it open local .md files?

Yes. You can open `.md` and `.markdown` files with the file picker or drag and drop. The desktop app can also open Markdown files through native file dialogs and command-line file arguments.

### How do I organize documents?

Use the Explorer to create nested folders inside Workspace or the password-protected Secret Workspace. Drag files between locations or use **Move to…**. Ctrl/Cmd-click selects separate items, while Shift-click or Shift+Arrow selects a range for bulk open, move, or delete actions.

## Privacy and Data

### Does my Markdown leave my device?

Normal typing, previewing, local file import, tab autosave, and most exports happen on your device. Content can leave your device when you use explicit network features:

- GitHub import contacts GitHub.
- Remote diagram renderers can receive diagram source.
- Pasting, dropping, or uploading a device image, animated GIF, or supported video sends a managed copy to public media storage after first-use consent.
- Large Share Snapshot links upload a temporary copy to Cloudflare KV.
- Live Share relays real-time updates through Cloudflare Durable Objects.
- External images, links, map tiles, and CDN libraries can be requested by the browser.

### Do you collect analytics or telemetry?

No analytics, telemetry, ads, tracking pixels, or app-specific cookies are implemented in the codebase.

### What does the app store locally?

The app stores normal tabs and their review threads, nested folder organization, active tab id, untitled-tab counter, theme/direction/view settings, language selection, scroll sync state, and Find and Replace dock preference. Web storage uses browser `localStorage`; the desktop app mirrors selected values into Neutralino storage. Private mode clears document/workspace state and prevents those document-state keys from being written until it is turned off.

### Are comments and suggestions added to my Markdown?

No. Review threads are a separate feedback layer attached to rendered blocks. They are excluded from Markdown and document exports. Share Snapshot does not include them; an active Live Share room synchronizes them through its separate Review channel.

### Are Share Snapshot links private?

They are bearer links. Anyone with the link can open the snapshot. Large stored snapshots expire after 90 days. The creator-side API response includes a separate deletion token that can be used to delete the stored record before expiry; it is not included in the share URL.

Small snapshots keep compressed content inside the URL hash. Large snapshots use `/api/share`, which stores content, mode, title, creation time, and size in Cloudflare KV for 90 days. Editable snapshots are not collaborative; they only let the recipient edit their opened copy.

### Are uploaded media links private?

No. Still images are optimized; images, animated GIFs, and supported videos are uploaded only after first-use consent, then referenced by a short content-addressed HTTPS link. The id is difficult to guess, but anyone who receives the URL can retrieve the media for up to 90 days. Cloudflare KV deletes it after that TTL, so the link stops rendering. Duplicate content reuses the same link and refreshes its 90-day expiry; legacy inline raster data can be converted to managed links after the same consent. The duration is the same 90-day limit used by stored Share Snapshot links, but their storage records are separate.

### Is Live Share saved permanently?

No. Live Share uses a temporary Cloudflare Durable Object room as a relay. It does not write the live document to KV or a database. While active, the room relays document updates, review comments and suggestions, display names, presence, cursors, sync messages, leave messages, and session-end messages.

### Is Live Share end-to-end encrypted?

No end-to-end encryption is implemented. The room id and secret are included in the invite link, and the Cloudflare Durable Object relays messages. Treat Live Share links like private bearer links.

### How do I clear local data?

Use **Reset workspace** in Workspace settings to clear saved files and review data. Private mode also clears document/workspace state and prevents it from being saved. Clearing site data from browser settings/developer tools removes cached app assets and any saved settings for that origin.

### What security protections are enabled?

Preview HTML is sanitized, exported HTML uses CSP/SRI protections, Cloudflare Pages sets security headers and hides sensitive paths, Share Snapshot CORS is restricted, Live Share validates origins and capabilities server-side, and the desktop build does not expose Neutralino's command-execution API by default. These protections reduce risk but do not make shared links private or Live Share end-to-end encrypted.

## Editing and Rendering

### What Markdown does it support?

It supports standard Markdown, GitHub-Flavored Markdown (GFM), tables, task lists, footnotes, definition lists, superscript, subscript, highlight syntax, raw sanitized HTML, GitHub alerts, YAML frontmatter in exports, LaTeX math, Mermaid, PlantUML, D2, Graphviz, Vega-Lite, WaveDrom, Markmap, GeoJSON, TopoJSON, STL, and ABC notation.

### Why do some diagrams need the internet?

Mermaid, Markmap, maps, STL, ABC, and MathJax use client-side libraries. PlantUML, D2, Graphviz, Vega-Lite, WaveDrom, and some insertion previews can use remote renderers such as PlantUML, Kroki, or mermaid.ink. Those remote services need network access and receive the diagram source.

### Why does the preview update in stages?

Base Markdown renders first. Advanced content such as MathJax, diagrams, maps, STL, ABC, and remote renderers runs after the base HTML has been sanitized and inserted. On large documents the app may use a Web Worker and segmented DOM patching to keep typing responsive.

### Why did a shared document open in a temporary tab?

Share Snapshot and Live Share tabs are temporary by design. They are stripped from persistent tab storage so opening someone else's link does not silently save their document into your workspace.

### Can I open two documents side by side?

Yes. Choose **Open in split view** from a file menu and select the second file. A shared control switches both documents between Edit and Preview. Preview mode renders Markdown, math, Mermaid and remote diagrams, maps, STL models, and ABC notation. This is separate from the normal Editor/Split/Preview modes for one document.

## Import and Export

### Can I import local files?

Yes. Import `.md`, `.markdown`, or `text/markdown` files through the file picker or drag and drop. Dropping onto an Explorer folder imports there; untargeted drops use the Workspace root. The app scans the first 8 KB for null bytes and rejects likely binary files.

### Can I import private GitHub repositories?

No. The GitHub importer only uses public GitHub URLs and does not ask for tokens.

### Why are only 30 GitHub files shown?

The importer limits repository/folder results to the first 30 Markdown files to keep the modal and network requests manageable. Imported files go into a repository-named folder and keep their nested GitHub directory paths.

### Which PDF export should I use?

Use Browser Print for most documents. It is faster and better for long text, and it always prepares a light print theme even if the app is currently in dark mode. Use Legacy Raster PDF when you need the app's page-break planning for images, tables, math, and diagrams, but expect higher memory use and possible browser canvas limits.

### Why are images missing from PDF or PNG export?

Canvas-based exports require images to be loaded and CORS-compatible. A remote image that blocks cross-origin canvas capture may not appear in raster PDF/PNG output.

### Why does exported PDF differ from the preview?

Browser Print depends on the browser print engine. Legacy Raster PDF captures an off-screen layout to canvas, applies page-break changes, scales some content, and may move blocks to avoid bad page cuts. That can differ from the live preview.

Browser Print removes the app's dark-mode styling before printing and restores it afterward. It does not rewrite colors that were intentionally placed in your Markdown, embedded HTML, SVG, image files, or diagram source.

## Installation and Offline Use

### Can I run it offline?

Yes, with limits.

- The web/PWA build can work offline after the app shell and CDN libraries have been loaded and cached.
- First use of CDN-based libraries still requires network access unless they are already cached.
- The prepared desktop build bundles external libraries into `resources/libs` and points dynamic library loading there.
- Features that inherently use the network, such as managed media upload, GitHub import, stored Share Snapshot, Live Share, remote diagram rendering, and external images, still need connectivity.

### Can I open `index.html` directly?

Use a local server instead. `file://` can block Web Workers and Service Workers, which breaks important rendering and offline behavior. Run `python -m http.server 8080` or `npx serve . -p 8080`.

### Why will the desktop app not launch on macOS?

The binaries are unsigned, so macOS may quarantine them. You can right-click and choose Open, or run:

```bash
xattr -d com.apple.quarantine markdown-viewer-mac_universal
chmod +x markdown-viewer-mac_universal
./markdown-viewer-mac_universal
```

## Troubleshooting

### The preview is blank. What should I check?

Check the browser console for blocked scripts or network errors, verify JavaScript is enabled, and hard refresh. If you are using `file://`, serve the app from localhost instead.

### Math does not render. Why?

MathJax loads when math markers are detected. Check your LaTeX syntax and network/cache state if this is the first time using math in the web build.

### Mermaid or another diagram shows an error. What now?

Check the fence language and diagram syntax. For remote diagram engines, also check network access to the renderer. Remote requests time out and retry, but they cannot render while the service is unreachable.

### Live Share says the room expired.

The room may have ended, the host may have left, the invite may be stale, or the participant may not have received initial sync within the join timeout. Ask the host to start a new session.
