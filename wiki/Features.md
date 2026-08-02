# Markdown Viewer Features: Live Markdown Preview, Diagrams, Export, and Sharing

This page is the source-of-truth feature reference for Markdown Viewer. It describes what the app does, how each feature behaves for users, the implementation limits that matter in practice, and what happens to document data.

## Product Summary

Markdown Viewer is a browser-based Markdown editor and viewer for opening `.md` and `.markdown` files, writing plain Markdown, and reading a live GitHub-style Preview. It runs as a static web application, a Progressive Web App, a Docker-hosted static site, and a Neutralino desktop application. The Editor is built around a plain textarea, a rendered Preview pane in Split view with sync scrolling, Document tabs, import/export tools, sharing tools, rich Markdown renderers, and optional Cloudflare endpoints for Share Snapshot and Live Share.

Most work happens in the browser or desktop webview. Markdown parsing, syntax highlighting, math rendering, diagram post-processing, PDF/PNG capture, tab storage, undo/redo, search, and formatting tools are client-side. The exceptions are explicit network features: GitHub import, emoji lookup, CDN library loading in the web build, remote diagram fallback services, large Share Snapshot storage, and Live Share relay rooms.

## Main Workspace

The app opens with a header, Files sidebar, document tab bar, formatting toolbar, editor pane, resize divider, preview pane, and bottom status bar.

- The left **Files** sidebar organizes Markdown files into fixed **Workspace** and **Secret Workspace** roots with nested folders, All files, Recent, Favorites, and search views.
- The sidebar is resizable and collapsible on desktop, narrower on tablet, and becomes a full-height drawer on mobile.
- Editor mode shows only the textarea.
- Split view shows the Editor and Preview side by side.
- Preview mode shows only the rendered document.
- A file menu can open a second document beside the active document. A shared control switches both sides between Edit and Preview, and synchronized scrolling is optional.
- On small screens, the mobile menu exposes the same core actions and the layout avoids a cramped split view.
- A draggable divider resizes the Editor and Preview in Split view and keeps both panes above 20% width.
- The divider also supports keyboard adjustment with left and right arrow keys while split view is active.
- The GitHub link in the header opens the source repository.
- The bottom status bar centers reading time, word count, and character count, while its right edge reports Saving or All changes saved.
- Application chrome uses a shared semantic size scale: equivalent toolbar, menu, modal, Explorer, mobile, and GitHub importer text and icons match, while headings, brand marks, badges, and illustrations keep their intentional hierarchy.

The editor includes line numbers, wrapped-line height handling, a highlight layer for find results, live cursor overlays during Live Share, and skeleton placeholders during initial or heavy rendering. Line-number calculations are cached so large documents do not force a full layout measurement on every keystroke.

## Files Sidebar, Tabs, and Local Workspace Storage

Users can work with multiple documents at once.

- Every existing saved document is migrated into **Workspace**. The two workspace roots are fixed, but users can create nested folders inside either root.
- Secret Workspace encrypts its files and folder names locally with a password-derived AES-GCM key. It remains locked after reload, the key stays in memory only while unlocked, and a forgotten password cannot be recovered. Resetting Secret Workspace permanently deletes its encrypted payload.
- The sidebar has explicit **New file** and **New folder** actions for the selected location. Files can be dragged onto another folder or workspace; the Move dialog remains available for keyboard and touch workflows.
- Deleting a folder tree moves every file inside it to the workspace root before removing the folders, so document content is not lost.
- New files can be created from the sidebar, tab bar, mobile menu, imports, shared snapshots, and Live Share joins. Multi-file imports show a compact bottom progress indicator.
- The sidebar supports file open, rename, duplicate, favorite, move, Markdown download, and delete actions. Recent and Favorites are filtered references to the original files, not copies.
- Multi-selected files can be opened or moved together. Any mixed selection of files and folders can be deleted together after a confirmation that explains which files will be deleted and which files inside removed folders will return to the workspace root.
- Tabs can be reordered by drag and drop. Their menus support rename, duplicate, favorite, two-document split, Markdown download, and close; the tab context menu also provides Close others, Close to the right, Close to the left, and Close all.
- Right-clicking the no-document workspace opens the same five Quick Start commands shown in the empty state. Right-clicking an editor or preview surface opens New file, selection-aware clipboard commands, and the current document's management actions; unavailable editing commands remain visible but disabled in preview and read-only contexts.
- Hovering a tab shows its containing folder path and filename. Files stored directly at the Workspace root show only their filename.
- The app does not impose a document-count limit. Available browser quota or filesystem capacity is the practical limit.
- Each normal tab stores a title, content, workspace/folder location, favorite state, recent activity metadata, scroll position, view mode, local review threads, and creation time.
- The active tab id and untitled-document counter are stored separately.
- Temporary Share Snapshot and Live Share tabs are deliberately excluded from persistent tab storage.
- **Reset workspace** permanently deletes normal files, review data, folders, settings, Secret Workspace ciphertext, history, and trash after confirmation.

Storage used by the current implementation includes:

| Key | What It Stores |
| :--- | :--- |
| IndexedDB `documents` | Lightweight metadata for each normal Workspace document. |
| IndexedDB `contents` | One content record per normal document, loaded only when opened. |
| IndexedDB `secretRecords` | One encrypted object per Secret Workspace document plus an encrypted folder record. |
| IndexedDB `trash` | Local records retained when normal documents are deleted. |
| `markdownViewerDocumentOrganization` | Fixed workspace state, non-secret folders, active sidebar filter, sidebar width/collapse state, and the last non-secret creation location. |
| IndexedDB `metadata` | Vault id, encrypted Secret Workspace manifest, and migration markers. |
| `markdownViewerActiveTab` | The active tab id. |
| `markdownViewerUntitledCounter` | Counter used for new Untitled tab names. |
| `markdownViewerGlobalState` | Theme, direction, view preferences, scroll sync, and similar global UI state. |
| `app-lang` | Selected interface language. |
| `find-replace-docked` | Whether the Find and Replace panel is docked. |

On the web, document data lives in IndexedDB while small preferences remain in `localStorage`. Existing monolithic `markdownViewerTabs` data is migrated once. On desktop, normal content is stored as individual Markdown files in `Documents/Markdown Viewer Vault/Workspace` by default; metadata, history, trash, journals, settings, and encrypted Secret Workspace objects live under the same durable vault.

Workspace settings includes **Private mode**, which pauses document-state writes for the current private session without clearing existing documents or Secret Workspace. The private-mode preference remains so the behavior survives a reload. **Storage and Backup** reports usage, separate normal and secret document counts, a logical browser storage location or fixed desktop vault path, exports/imports ZIP backups, and can include unchanged encrypted Secret Workspace records. Import permanently replaces the current workspace after confirmation. Backups exclude trash, desktop history, and recovery journals. Browser storage is best-effort by default and is shown as read-only status. **Reset workspace** permanently clears all local workspace data after confirmation; **Reset Secret Workspace** remains available for deleting only the encrypted area.

## Comments and Suggestion Mode

Review mode adds structured feedback to the rendered document without inserting or changing Markdown.

User flow:

- Open **Review** from the desktop document toolbar or mobile menu.
- Select the plus beside a rendered YAML table, heading, paragraph, code block, or diagram.
- Add a comment or suggestion. Reviewed blocks show one control for reading existing feedback and a separate plus for adding another item.
- Edit, resolve, reopen, or delete individual threads. The panel can also copy a Markdown summary, resolve all open items, or delete all feedback after confirmation.
- Close Review to restore the previous Editor, Split, or Preview layout. Opening a new tab closes Review automatically.

Storage and sharing:

- Review threads stay with normal local tabs and survive reloads. Private mode pauses new persistence; workspace backups retain review data, while Reset workspace deletes it.
- Feedback is excluded from Markdown, HTML, PDF, PNG, print, duplicated tabs, and Share Snapshot links.
- If the related source block changes, the thread remains visible as unanchored feedback instead of moving to the wrong block.
- Live Share synchronizes Review threads through a separate Yjs document. View-only participants can review without receiving Markdown edit permission.
- The panel is a side panel on desktop, a drawer on tablet, and a touch-friendly bottom sheet on mobile, using the app's existing colors, controls, themes, and accessibility patterns.

## Editing and Formatting Tools

The formatting toolbar inserts or transforms Markdown at the current selection. It provides WYSIWYG-style helpers for plain Markdown with live preview, not full in-place rich-text editing.

- Undo and redo use the app's custom per-tab history.
- Clear document opens a confirmation modal.
- Bold, italic, strikethrough, quote, inline code, code block, terminal block, horizontal rule, and headings H1-H6 insert standard Markdown.
- Bulleted and numbered lists work on selected lines or the current line.
- Pressing Enter inside a list continues the list; pressing Enter on an empty list item exits the list.
- Tab inserts two spaces; Shift+Tab outdents selected lines.
- Title case, uppercase, and lowercase transform selected text or the current line.
- Alignment buttons insert left, center, or right aligned HTML blocks.
- The direction toggle switches between left-to-right and right-to-left content direction.
- Link, image, reference, table, emoji, symbol, alert, and diagram buttons open focused modals.
- Date/time inserts a local timestamp.
- Fullscreen uses the browser Fullscreen API when available.
- Find and Replace and Fullscreen are direct formatting-toolbar actions. About Markdown Viewer opens from the header or mobile menu.

View-only Share Snapshot tabs and view-only Live Share participant tabs block mutating tools and announce that the editor is read-only. Non-mutating actions such as fullscreen, find, help, and info remain available.

## Custom Undo and Redo

The app keeps its own edit history for each tab so toolbar actions, typed edits, and programmatic changes can be undone consistently.

- `Ctrl+Z` or `Cmd+Z` undoes the previous edit in the active editor.
- `Ctrl+Shift+Z`, `Cmd+Shift+Z`, `Ctrl+Y`, or `Cmd+Y` redoes.
- Undo and redo buttons are disabled when the current tab cannot be edited.
- Cursor position is tracked so undo and redo feel close to native textarea behavior.

## Find and Replace

Find and Replace is a floating or docked panel with editor and preview highlighting.

- Open it with the toolbar, `Ctrl+F`, or `Cmd+F`.
- `Ctrl+H` or `Cmd+H` opens the panel focused on replacement.
- It supports case-sensitive matching, whole-word matching, regular expressions, selection-only search, and replace-all.
- Regex replacements can use numbered capture groups like `$1` and named groups like `$<name>`.
- Preserve-case replacement adjusts replacement casing to match the matched text.
- Search scope can be limited using a Marked lexer map, including headings, code blocks, Mermaid blocks, LaTeX blocks, or the entire document.
- Diff preview shows the effect before bulk replacement.
- The panel can be dragged, docked, undocked, and reset to a visible position. Its floating position is constrained to the viewport.
- Find history and replace history are kept in memory for the current session, up to 10 entries each.

Limitations:

- AST scoping depends on Marked token boundaries. Very unusual Markdown can be classified as plain text.
- Scope validation protects LaTeX delimiters and Mermaid block starts, but it cannot prove every replacement is semantically correct.
- Preview highlighting works on visible text nodes and may skip text produced inside complex third-party SVG renderers.

## Live Markdown Preview and GitHub-Flavored Markdown

Markdown is parsed with Marked and highlighted with Highlight.js. Rendered HTML is sanitized with DOMPurify before it is inserted into the preview.

Supported Markdown behavior includes:

- CommonMark-style headings, paragraphs, line breaks, emphasis, blockquotes, lists, code blocks, horizontal rules, links, images, and inline HTML.
- GitHub-Flavored Markdown (GFM) features such as tables, task lists, strikethrough, and autolinks.
- Heading ids generated from heading text for in-document anchor navigation.
- Reference definitions and reference links.
- Multi-paragraph footnotes with back references.
- Definition lists using a term followed by `: definition`.
- Superscript with `^text^`.
- Subscript with `~text~`.
- Highlight with `==text==`.
- GitHub-style alert blocks for NOTE, TIP, IMPORTANT, WARNING, and CAUTION.
- Emoji shortcodes processed through JoyPixels when the emoji library is available.
- Raw HTML is allowed only after sanitization. Scripts and unsafe event handlers are removed.

The worker and main renderer both preserve block math, custom diagram shells, footnote state, definition lists, superscript, subscript, and highlight syntax so advanced blocks do not collapse during live updates. The two-document split uses the same post-processing pipeline for math, Mermaid, remote diagrams, maps, STL, and ABC notation.

## Web Worker and Preview Performance

Rendering is designed to keep typing responsive.

- Small documents render on the main thread after a short debounce.
- Very large documents can render in `preview-worker.js`.
- The current worker threshold is 50,000 characters.
- Render debounce is size-aware: 100 ms for typical documents, 160 ms for large documents, and 240 ms for huge documents.
- Worker rendering has a 12 second timeout and falls back if worker rendering fails repeatedly.
- When safe, the worker splits Markdown into blocks, hashes each block, and returns segmented HTML.
- The main thread caches sanitized segments and patches only changed preview sections.
- Segmented rendering is avoided when document constructs need global context, such as footnotes or reference-style definitions.
- Preview sections use `content-visibility: auto` so off-screen content costs less to lay out.

Limitations:

- Huge documents still depend on browser memory and DOM limits.
- Advanced renderers such as Mermaid, MathJax, maps, STL, ABC, and remote diagrams run after the base Markdown pass, so they can appear slightly later than text.
- The app retries advanced post-processing when shared or live content loads before renderer libraries are ready.

## Math Rendering

MathJax renders LaTeX-style math.

- Inline math uses `$...$`.
- Display math uses `$$...$$`, `\(...\)`, or `\[...\]`.
- Fenced `math` code blocks are converted into display math.
- Additional MathJax packages are configured for richer notation.
- MathJax loads only when math-like text is detected.
- After typesetting, the app removes or hides MathJax assistive markup from export captures so duplicate text does not appear in PDFs or PNGs.

Limitations:

- The first math render in the web build may require downloading MathJax unless it is already cached.
- Invalid LaTeX is shown according to MathJax behavior and may produce warnings or unrendered source.
- A literal dollar sign should be escaped as `\$` when it is not intended to start math.

## Insert Diagrams, Charts, Maps, Models, and Music

Markdown Viewer supports many fenced-code renderers for diagrams, charts, mind maps, digital timing diagrams, music notation, geographic maps, and 3D STL models.

| Fence Language | Renderer | User Behavior | Network Notes |
| :--- | :--- | :--- | :--- |
| `mermaid` | Mermaid.js | Renders diagrams as SVG with zoom, copy, PNG, and SVG actions. | Client-side library. Diagram insertion previews may use mermaid.ink. |
| `plantuml` | PlantUML/Kroki | Renders SVG and provides zoom, copy, PNG, and SVG actions. | Uses PlantUML server first, then Kroki fallback. |
| `d2` | Kroki | Renders D2 SVG and provides zoom, copy, PNG, and SVG actions. | Uses Kroki. Some source is normalized for common SQL-table cases. |
| `graphviz` / `dot` | Kroki | Renders Graphviz SVG and provides zoom, copy, PNG, and SVG actions. | Uses Kroki. |
| `vega-lite` / `vegalite` | Kroki | Renders Vega-Lite charts. | Uses Kroki. |
| `wavedrom` | Kroki | Renders WaveDrom timing diagrams. | Uses Kroki. |
| `markmap` | Markmap, D3 | Renders a mind-map style SVG. | Client-side libraries. |
| `geojson` | Leaflet | Renders an interactive map. | Client-side library; map tiles may require network depending on tile source. |
| `topojson` | Leaflet and TopoJSON | Converts TopoJSON to GeoJSON and renders an interactive map. | Client-side library; map tiles may require network. |
| `stl` | Three.js | Renders a 3D STL model with orbit controls, solid/surface-angle/wireframe modes, zoom modal, copy, and PNG export. | Client-side libraries. |
| `abc` | ABCJS | Renders sheet music, supports playback, cursor sync, note highlighting, copy, PNG, and SVG export. | Client-side library; browser audio support required for playback. |

Every diagram shell keeps the original source in a data attribute so the app can rerender after theme changes, shared document loading, and export preparation. Diagram PNG exports add a solid background when needed so transparent SVGs stay visible.

Limitations:

- Remote diagram engines send diagram source to third-party rendering endpoints. Do not use those fences for private diagram text unless you trust the endpoint or provide your own deployment.
- Remote render requests have a 15 second timeout and retry twice.
- Clipboard image writing requires a secure context and browser support for `ClipboardItem`.
- WebGL STL rendering depends on GPU/browser support. The app disposes old STL views to reduce memory leaks.
- ABC audio playback depends on browser audio APIs and may be unavailable in some environments.

## Insert Diagram & More Modal

The **Insert Diagram & More** modal offers searchable templates grouped by engine. It shows source code and a live preview before insertion.

- Categories include Mermaid, PlantUML, D2, Graphviz, Vega-Lite, ABC notation, WaveDrom, and Markmap.
- Template code is cleaned before insertion.
- Previews are cached in the browser Cache API under `diagram-previews` when possible.
- Remote preview generation can use Kroki or mermaid.ink depending on the template.

## Imports

Markdown Viewer can open `.md` and `.markdown` documents from local files, drag and drop, GitHub URLs, and desktop file arguments.

Local file import:

- Accepts `.md`, `.markdown`, and `text/markdown`.
- Extension checks are case-insensitive.
- Rejects an individual Markdown file larger than 10 MB.
- Dragging files over the app shows a compact drop notice. Explorer document drags use a Markdown file preview, folders expand on hover, and the Explorer scrolls near its top and bottom edges.
- The first 8 KB of a file are scanned for null bytes to avoid loading binary files as text.
- Imported local files are saved to Explorer without opening new tabs. Select a saved file in Explorer when you want to edit it.

Media insertion:

- Uploading from the media dialog, pasting from the clipboard, and dropping an image, animated GIF, or supported video all use the same insertion pipeline and a visible progress toast.
- Small raster files retain their safe raster format; larger still images are resized and converted to WebP with a bounded upload size. GIF bytes are retained so animation is not lost.
- Supported managed video formats are MP4, WebM, and Ogg. Videos are inserted as sanitized HTML5 `<video controls>` elements; external media URLs can use the same format.
- After first-use consent, managed media is stored in Cloudflare KV under a content-derived id and inserted as a short HTTPS URL. Identical content reuses the same id.
- Anyone with a managed media URL can retrieve the file. The URL is unguessable but is not an access-control boundary.
- Managed images, GIFs, and videos expire 90 days after their most recent upload, matching the stored Share Snapshot retention period. After expiry, the Markdown or HTML reference remains but the media no longer renders.
- Existing inline base64 raster images are detected when a normal document opens and can be converted to managed short links without changing alt text or titles.
- Individual source files are limited to 25 MiB before processing. Managed still-image payloads are limited to 300 KiB after optimization, GIFs to 5 MiB, and videos to 10 MiB.

Application feedback:

- GitHub import progress, media uploads, and general notifications use one shared bottom-corner toast position. Progress toasts include item counts, status details, and a progress bar; private-token actions use the same accessible toast surface with a GitHub icon.
- User-facing errors, warnings, and informational alerts use the same accessible toast surface instead of blocking browser alert dialogs. Unsupported files use a red alert icon, a "File not supported" title, and format or size recovery guidance.
- Toasts include text and Lucide icons rather than relying on color alone, and respect reduced-motion preferences.

GitHub import:

- Accepts `github.com/owner/repo`, `github.com/owner/repo/tree/ref/path`, `github.com/owner/repo/blob/ref/path`, and `raw.githubusercontent.com` file URLs.
- Resolves default branches, explicit branches (including names containing `/`), tags, and commit references to an immutable commit SHA.
- Direct Markdown file URLs import immediately.
- Repository or folder URLs query GitHub's API to find Markdown files.
- The URL step uses the original compact 520px dialog and the Markdown selection step uses its original 760px width. The Import button shows an immediate spinner, followed by a shimmer tree until Markdown discovery completes. The reduced-height repository row keeps the repository name on the left and groups a wider resolved branch/ref badge with the linked short commit on the right; a truncated ref is revealed in full on hover. The searchable GitHub-style tree keeps its selected-count and matching borderless select/deselect-all and collapse/expand-all controls directly beside the search field. Its folder icons mirror Explorer, using a neutral color while closed and the accent color while open.
- Default-branch imports create a repository-named folder. Each selected file's nested GitHub directory path is reproduced inside it.
- Every Markdown file found is shown.
- Requests are rate-limited by the app to avoid hammering GitHub.
- Public files are fetched as raw content. Private files use GitHub's authenticated Contents API. Both are saved to Explorer without opening new tabs.
- Optional private access accepts fine-grained and classic PATs automatically in a compact add-then-select flow. Up to 50 named tokens persist across refreshes and app restarts in a local AES-GCM vault and can be removed individually at any time without a passphrase or unlock step. GitHub validates each token when added, while token actions use GitHub-branded accessible toasts.

Limitations and privacy:

- Local file content is read in the browser or desktop application and is not uploaded by local import.
- GitHub import sends repository, ref, and path information to GitHub. Public requests are anonymous unless GitHub requires authenticated access.
- A private-repository PAT is attached only to `api.github.com` requests and is never sent to `raw.githubusercontent.com` or the Markdown Viewer backend. Local deletion does not revoke the token on GitHub.

## Export Markdown to PDF, HTML, PNG, and MD

Export filenames use the active tab title when possible.

Markdown export:

- Saves the raw Markdown text.
- In the web app, it downloads through the browser.
- In the desktop application, it uses a native save dialog and Neutralino filesystem writing.

HTML export:

- Creates a standalone HTML document from the current Markdown.
- Includes GitHub-style Markdown CSS, syntax highlighting styles, alert styles, footnote styles, math/diagram support hooks, and frontmatter rendering.
- YAML frontmatter is parsed and shown as a table before the document body.
- HTML export uses sanitized rendered content.
- Exported HTML includes a restrictive document CSP and Subresource Integrity metadata for its external CSS/scripts where applicable.

PDF export:

- Opens a modal with two modes.
- Browser Print is recommended. It prepares the preview with a clean light print theme, hides app chrome and open modals, rerenders Mermaid with printable light SVG colors, refreshes theme-sensitive map and STL styling, then calls `window.print()` so the browser or OS can save or print the document. When the print preview closes, the app restores the user's previous light or dark UI theme.
- Legacy Raster PDF uses `html2canvas` and `jsPDF`. It clones the preview into an off-screen A4 sandbox, renders Mermaid and ABC to SVG/image form, typesets math, waits for images/fonts, applies page-break rules, captures the document to canvas, and saves a PDF.
- The raster exporter shows progress and has a cancel button.
- Raster export uses `allowTaint: false` and `useCORS: true` to avoid unsafe cross-origin canvas capture.

PNG export:

- Captures the rendered document into a PNG using `html2canvas`.
- It uses a white/dark solid background based on theme and a high-resolution canvas.
- It renders Mermaid, ABC, and MathJax in the off-screen capture before saving.

Limitations:

- Browser Print output is controlled by the browser and print settings.
- Browser Print removes app dark-mode styling from printed output, but it does not rewrite colors that a document author explicitly placed inside SVG, HTML, image files, or diagram source. A diagram that intentionally uses a dark background can still print dark.
- Raster PDF and PNG are screenshots of rendered HTML, so very long documents can be memory-heavy.
- Cross-origin images without CORS support may fail to appear in canvas-based PDF/PNG exports.
- Advanced remote diagrams that have not rendered yet may need a moment before export.
- Some complex CSS, wide tables, and large diagrams may be moved, scaled, or split differently from the live preview.

## Share Markdown with Snapshot Links

Share Snapshot creates a link to a point-in-time copy of the current document.

Modes:

- View only opens the shared content in preview mode with the editor hidden.
- Can edit opens the shared content in Split view so the recipient can edit their own copy.

Storage behavior:

- Small documents are compressed with Pako, base64url-encoded, and placed directly in the URL hash as `#share=...`.
- Hash fragments are not sent to a web server as part of normal HTTP requests.
- If the encoded legacy URL is too long, or if the Markdown is at least 3,000 bytes, the app stores the snapshot through `/api/share`.
- Stored snapshots receive an id in `#id=...` form.
- Stored snapshots are saved in Cloudflare KV for 90 days.
- The server accepts up to 8,000,000 characters per stored snapshot.
- Snapshot ids are random 10-character values using a reduced alphabet and must match the app's id pattern.
- Stored snapshot responses use `Cache-Control: no-store`.
- The Share API allows CORS for the production app, HTTPS `*.markdownviewer.pages.dev` previews, `null`, and `localhost`/`127.0.0.1` development origins; unsupported browser origins are rejected.
- Creating a stored snapshot returns a creator-side deletion token. The token is hashed in KV and is required for `DELETE /api/share/<id>`; it is not part of the share URL.
- The current UI retains that token only in memory and does not display it or provide an early-delete action. An API client must capture the creation response if it needs to delete the stored record before expiry.
- Shared snapshot tabs are temporary and are not saved to the recipient's local workspace.

Privacy implications:

- URL-hash snapshots keep document content inside the link itself.
- Anyone with a snapshot link can read the snapshot.
- Can edit snapshot links are not collaborative; they only let the recipient edit their local opened copy.
- Stored snapshots upload document content, mode, title, creation time, and size to the configured Cloudflare KV namespace until expiry.
- The app prevents sharing a temporary snapshot again. A Live Share participant cannot create a snapshot from the live Document; the host can.

## Live Share Rooms for Markdown Collaboration

Live Share creates a temporary real-time collaboration room.

User flow:

- The host chooses a display name and an access mode.
- Access can be Can edit or View only.
- The app creates a random room id and a random secret.
- The invite URL contains the room id, secret, and title. It does not embed the full Markdown body.
- Participants open the link and join a temporary live tab.
- Participants see presence avatars and live cursor indicators.
- The host can end the session for everyone.
- Participants can leave and return to their original tab state.
- If a room has ended, expired, or has no active host, the participant sees an expired-room modal.

Implementation:

- The client uses separate Yjs documents for Markdown/session state and Review threads.
- Browser clients connect with WebSocket to `/live-room/<room-id>?secret=<secret>`.
- The Pages Function and Durable Object reject unsupported WebSocket `Origin` values. The production app, HTTPS `*.markdownviewer.pages.dev` previews, `null`, and localhost development origins are allowed.
- The host connection establishes separate host, edit, and view capabilities. The Durable Object stores these capabilities and authenticates each joining role server-side.
- Cloudflare Pages routes the WebSocket to a Durable Object named `LIVE_ROOMS`.
- The Durable Object relays only known message types and filters them by role: viewers cannot send Markdown updates or session-end messages, but they can request and send Review updates; editors can send Markdown and Review updates; only the host can publish full Review state or send every supported type.
- The Durable Object does not persist Markdown or Review document state. It does persist the host, edit, and view bearer capability values plus `createdAt` in Durable Object storage under `live-room-auth-v1`.
- Room identity is derived from room id plus secret.

Limits:

- A live message can be at most 8 MB. Managed images, GIFs, and videos synchronize as short HTTPS links rather than binary document content.
- A live room can have at most 64 WebSocket participants.
- Participant presence is considered stale after 45 seconds without updates.
- Join waits up to 8 seconds for initial room state before showing an expired/unavailable room message.
- A participant needs an active client, normally the host, to supply initial Yjs document state. The server does not retain a document copy for later recovery.

Privacy implications:

- Live Share document updates, display names, cursor positions, and presence are transmitted through the configured Cloudflare Durable Object.
- Live Markdown and Review content is temporary relay/client state, not permanent server-side document storage. Capability metadata is durable and has no application TTL or deletion route.
- Anyone with the invite URL, including the secret, can join while the room is active.
- View only and Can edit roles are checked by the Durable Object, which filters message types by capability. Invite URLs still contain bearer credentials, and Live Share is not end-to-end encrypted.

## Clipboard and Copy Behavior

- Copy Markdown copies the raw Markdown from the editor.
- `Ctrl+C` or `Cmd+C` respects selected text in inputs/textareas and selected page text.
- When no text selection is active, the app can copy the full Markdown document.
- Diagram and ABC copy actions attempt to write PNG image data to the clipboard.
- Clipboard APIs require browser permission and a secure context. The app falls back to a temporary textarea for text copying when needed.

## Themes, Direction, and Localization

Theme behavior:

- The app supports light and dark themes.
- Initial theme follows saved preference, then system preference.
- Theme choices are saved in global state.
- Diagrams, maps, STL views, and rendered blocks are updated after theme changes when possible.

Direction behavior:

- Users can switch content direction between LTR and RTL.
- Direction affects editor and preview layout and is saved in global state.

Localization:

- The UI includes English, Simplified Chinese, Japanese, Korean, Brazilian Portuguese, Spanish, French, German, Russian, Italian, Turkish, Polish, Traditional Chinese, and Ukrainian.
- Language is selected in this order: URL `?lang=`, hash query `?lang=`, saved `app-lang`, browser language, then English.
- Selecting a language updates the URL query and saves `app-lang`.
- Core labels are defined in `I18N_DICTS` in `script.js`. Broader static and dynamic interface strings are loaded from `assets/i18n/<language>.json`; the English catalog is generated only from interface source strings and every other catalog uses the same keys.
- `node assets/i18n/audit-ui-locales.mjs` checks all 14 catalogs for key parity, source pollution, empty values, placeholder integrity, protected `GitHub` and `Markdown` terms, merged values, generator or encoding artifacts, and unexpected English fallbacks.
- Some renderer output, browser messages, third-party text, filenames, and low-level errors can remain English.

## Statistics

The bottom status bar and mobile interface show:

- Estimated reading time.
- Word count.
- Character count.

Reading time is based on a simple words-per-minute estimate. Counts update as the active document changes. Character count is a practical UI metric, not a byte-level file-size guarantee.

## Keyboard and Accessibility

Common shortcuts:

| Action | Shortcut |
| :--- | :--- |
| Save/export Markdown | `Ctrl+S` / `Cmd+S` |
| Find | `Ctrl+F` / `Cmd+F` |
| Replace | `Ctrl+H` / `Cmd+H` |
| Toggle scroll sync | `Ctrl+Shift+S` / `Cmd+Shift+S` in Split view |
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Redo | `Ctrl+Shift+Z`, `Cmd+Shift+Z`, `Ctrl+Y`, or `Cmd+Y` |
| New tab | Desktop: `Ctrl+T` / `Cmd+T`; web and desktop: `Alt+Shift+T` |
| Close tab | Desktop: `Ctrl+W` / `Cmd+W`; web and desktop: `Alt+Shift+W` |
| Indent | `Tab` in the editor |
| Outdent | `Shift+Tab` in the editor |
| Close modals/panels | `Escape` |

Accessibility behavior:

- Tabs use ARIA tablist semantics and roving keyboard focus.
- Tab bar supports ArrowLeft, ArrowRight, Home, End, Enter, and Space.
- Modals trap focus and close with Escape or cancel buttons.
- The resize divider is keyboard focusable.
- Screen-reader announcements are used for imports, Live Share, read-only states, and other dynamic actions.
- Touch targets were enlarged in earlier accessibility passes.

## Offline, PWA, and Caching

The web app registers `sw.js` when service workers are supported.

- The service worker cache name is versioned in `sw.js` so stale caches can be retired safely.
- Critical local assets include `/`, `index.html`, `workspace-storage.js`, `script.js`, `preview-worker.js`, `styles.css`, `assets/lucide-icons.css`, `sample.md`, `manifest.json`, and `assets/icon.jpg`.
- Local shell assets use a network-first strategy for update-sensitive paths, falling back to cache when offline.
- CDN assets from cdnjs and jsDelivr use cache-first behavior after first successful load.
- The app manifest allows standalone PWA installation.

Limitations:

- Service workers require HTTPS or localhost.
- First use of CDN-based renderers requires network access unless already cached.
- Clearing site data removes the cached app shell and local documents.
- Opening `index.html` through `file://` can break workers and service workers because of browser security rules.
- The checked-in root Dockerfile does not copy `preview-worker.js` or `sample.md`, although the Service Worker precache requires both. The stock container therefore falls back to main-thread Preview for large Documents and can fail Service Worker installation until the image is corrected.

## Desktop Application

The desktop build wraps the same app in Neutralino.

Desktop-specific behavior:

- Uses a native window with minimum size 400 x 200 and default size 1280 x 720.
- Uses one-time token security.
- Logging is disabled in the current config.
- Native APIs are allowlisted instead of fully open.
- Allowed APIs include app exit, open/save/folder dialogs, system path lookup, external URL opening, tray setup, restricted vault filesystem operations, and Neutralino storage access. `os.execCommand` is intentionally not in the default allowlist.
- Local imports and exports use native open/save dialogs.
- External Markdown file paths passed at launch can be loaded into the editor.
- Closing the desktop window asks for confirmation before exiting.
- Desktop resources are built by `desktop-app/prepare.js`.
- `prepare.js` copies root assets, rewrites paths for `/resources/`, strips web-only SEO metadata, and downloads/bundles external libraries into `/resources/libs/`.
- Downloaded desktop dependencies are checked against SHA-384 integrity values when SRI is available.
- The desktop build points dynamic libraries to local `/libs/...` paths, so prepared desktop resources do not need CDN-hosted renderer libraries after setup.

Privacy:

- Desktop documents are stored as ordinary Markdown files in the durable Markdown Viewer Vault; only small interface preferences use Neutralino storage.
- Native file reads/writes happen only through user actions or explicit file arguments.
- Share Snapshot, Live Share, GitHub import, remote diagram fallbacks, and external links still use the network when used.

## Security Model

Important protections:

- DOMPurify sanitizes preview HTML before insertion.
- Preview sanitization allows needed render attributes and safe URI patterns while blocking scripts and inline event handlers.
- CDN scripts and styles in `index.html` use Subresource Integrity where checked in.
- Desktop preparation verifies downloaded assets against SHA-384 integrity values when available.
- Cloudflare Pages supplies CSP, clickjacking, referrer, permissions, cross-origin, HSTS, and MIME-sniffing protections through `_headers`; sensitive deployment files are redirected to 404 through `_redirects`.
- Canvas exports use `allowTaint: false`.
- STL rendering validates source size, finite vertex coordinates, and geometry vertex count before creating a WebGL view.
- The desktop native API allowlist follows least privilege for the app's current features.
- Private mode pauses local document persistence without deleting existing data. Reset workspace permanently clears the vault content and local preferences; resetting Secret Workspace deletes only the encrypted area.
- Share and live endpoints return no-store responses for dynamic content.
- The app does not include analytics, telemetry scripts, ad pixels, accounts, cookies, or subscription code.

Security limitations:

- Sanitization reduces XSS risk but cannot make every third-party renderer or browser bug impossible.
- Remote diagram services receive diagram source for supported remote engines.
- Links and images in Markdown can request external resources when rendered or clicked.
- Live Share roles are server-checked, but invite links are bearer credentials, room content is not end-to-end encrypted, and persisted capability metadata has no application TTL or deletion path.
- Share Snapshot links are bearer links: possession of the URL grants access.
- Security headers and CSP depend on the deployment surface; self-hosters should preserve the policies in `_headers` and review the Docker/Nginx policy when customizing it.

## Data Handling Summary

| Feature | Leaves Device? | Stored Where | Notes |
| :--- | :--- | :--- | :--- |
| Typing and local preview | No | Browser memory and per-document storage | Sanitized before preview insertion. |
| Normal tab autosave | No | Per-document IndexedDB records or desktop vault `.md` files | Content is written independently rather than serializing the whole Workspace. |
| Comments and suggestions | Only during Live Share | Normal document metadata plus temporary Live Share relay state | Excluded from document exports and Share Snapshot; synchronized between active Live Share participants. |
| Private mode | No | No new document-state persistence during the session | Existing saved documents and Secret Workspace remain intact. |
| Local file import | No | Current tab/workspace | Reads selected files only. |
| Managed media upload | Yes, after first-use consent | Cloudflare KV, content-addressed, 90-day TTL | Publicly retrievable by its unguessable HTTPS URL until expiry; still images 300 KiB optimized, GIF 5 MiB, video 10 MiB. |
| Markdown/HTML/PDF/PNG export | No, except remote assets already referenced | User download location | Browser may request external images/fonts used by content. |
| GitHub import | Yes | Public: GitHub API/raw URLs. Private: `api.github.com` only | Up to 50 named fine-grained or classic PATs in a local AES-GCM vault, with individual removal at any time. |
| Emoji lookup | Yes | GitHub emoji API response in memory | Used for shortcode picker/lookup. |
| CDN library loading | Yes | Browser/service-worker cache | Web build only, first use unless cached. |
| Remote diagram engines | Yes | Third-party renderer response/cache | Source is sent to PlantUML, Kroki, or mermaid.ink depending on renderer/preview. |
| Share Snapshot hash link | Only when user sends the link | Inside URL hash | Small documents are not uploaded by generation. |
| Stored Share Snapshot | Yes | Cloudflare KV for 90 days | Content, mode, title, createdAt, and size. |
| Live Share | Yes | Client/WebSocket relay state plus Durable Object capability storage | Markdown and Review content are not persisted server-side; role capabilities and `createdAt` are stored without an application TTL. |
| Desktop native storage | No | `Documents/Markdown Viewer Vault` by default | Ordinary `.md` files plus internal metadata, encrypted records, up to 20 recent history copies per document, trash, and crash journal. |

## Known Technical Limits

- Browser storage quotas can reject very large saved workspaces.
- Markdown Viewer does not impose a document-count limit; available storage and operating-system/filesystem constraints still apply.
- An individual local Markdown import is limited to 10 MB.
- The GitHub importer shows every Markdown file found in the selected public or authorized private repository or folder.
- The local GitHub credential vault stores up to 50 named PAT entries.
- GitHub access-token names are limited to 60 characters.
- Stored Share Snapshot content is limited to 8,000,000 characters. Managed media remains separate and travels as short HTTPS links.
- The current Share Snapshot UI does not expose its API deletion token, so UI-created stored snapshots normally remain until their 90-day expiry.
- STL source is limited to 2 MiB and parsed geometry to 300,000 vertices.
- The desktop vault retains up to 20 recent history copies per document.
- Legacy raster PDF and PNG exports can fail on extremely tall documents because canvas size and memory are browser-limited.
- Remote renderer availability depends on third-party services and network conditions.
- The service worker cannot cache assets that have never been successfully fetched.
- The desktop application depends on the platform webview and Neutralino runtime behavior.

Related pages: [Usage Guide](Usage-Guide.md), [Markdown Reference](Markdown-Reference.md), [Share Snapshot](Share-Snapshot.md), [Live Share](Live-Share-Cloudflare.md), [Privacy and Security](Privacy-and-Security.md), and [Troubleshooting](Troubleshooting.md).
