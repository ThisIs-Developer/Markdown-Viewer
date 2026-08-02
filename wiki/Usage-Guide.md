# Usage Guide: Online Markdown Editor with Live Preview

This guide explains how to use Markdown Viewer as a browser-based Markdown editor, viewer, reader, and live Preview tool. For deeper implementation notes and renderer limits, see [Features](Features.md). For data handling, see [Privacy and Security](Privacy-and-Security.md).

## Workspace Layout for Editing and Previewing Markdown

The app has seven main areas:

| Area | What It Does |
| :--- | :--- |
| Header | Shows the app name and primary New, Export, Share, Live Share, Sync, Copy, About, and Workspace settings actions. |
| Files sidebar | Organizes stored Markdown files without an application count limit in fixed Workspace and Secret Workspace roots, with nested folders, All files, Recent, Favorites, and search. |
| Tab bar | Preserves quick switching and drag-to-reorder for open documents. |
| Formatting toolbar | Inserts Markdown syntax, opens helper modals, starts Find and Replace, toggles fullscreen, and switches review/view modes. |
| Editor pane | Plain-text Markdown textarea with line numbers, custom undo/redo, list continuation, and find highlights. |
| Preview pane | Sanitized rendered Markdown with math, diagrams, maps, models, music, alerts, and syntax highlighting. |
| Status bar | Centers reading time, word count, and character count, and shows Saving or All changes saved at the right. |

Use the view buttons to switch between Editor, Split, and Preview. Split view is the main live Markdown preview workflow: type, paste, or open Markdown on one side and read the rendered result on the other. Sync scrolling can keep the source and preview aligned while you write. Drag the divider to change the pane widths. The app prevents either side from becoming too narrow. On small screens, the document sidebar opens as a full-height drawer and the mobile menu exposes the remaining main actions without forcing a cramped split layout.

To compare or edit two files, open a file menu and choose **Open in split view**, then select the second document. A shared control switches both sides between Edit and Preview. Preview mode supports Markdown, math, diagrams, maps, STL, and ABC rendering. Use the combined tab menu to exit this view.

## Files, Folders, and Autosave

- Select Workspace, Secret Workspace, or a folder, then use the clearly labeled **New file** or **New folder** button. The selected row shows where the item will be created; the plus menu beside an unlocked workspace or folder creates directly inside it.
- Workspace roots are fixed. Create nested folders inside **Workspace** or the password-protected **Secret Workspace**.
- The first time Secret Workspace is opened, create a password of at least eight characters. Files and folder names are encrypted locally. Use its menu to lock it when finished; the password cannot be recovered.
- When multiple files are selected, dragging any selected file moves the full selection and the drag preview shows the file count. Expanded folders accept drops across their visible contents, not only on the folder name.
- Drag a file row onto a folder or workspace to move it. Use **Move to…** from the file menu as the keyboard and touch-friendly alternative. Dropping local Markdown files onto a folder imports them there.
- Use **All files** for the hierarchy, **Recent** for recently opened or edited files, and **Favorites** for starred files.
- On desktop, one click selects a sidebar document and a double click opens it. On touch layouts, one tap opens it and closes the drawer.
- The active Document is the one shown in the primary Editor/Preview, used by formatting, review, import-into-current, export, Share Snapshot, and Live Share actions. Opening a second Document in the two-Document view does not make it the active Document.
- Each document menu supports Open, Rename, Duplicate, Favorites, Move, Open in split view, Download Markdown, and Delete. The tab strip supports quick switching, drag-to-reorder, and close commands for one or several tabs.
- Ctrl/Cmd-click selects separate Explorer items; Shift-click or Shift+Arrow selects a range. When only files are selected, the context menu can **Open all** or **Move to…**. Any multi-selection can be deleted after confirmation.
- Deleting a folder tree moves all files inside it to the workspace root before removing the folders.
- Dragging or selecting several local Markdown files shows a small import-progress popup at the bottom of the screen until processing finishes.
- Closing the last normal tab resets to a clean document.
- Normal tabs autosave as independent browser records or desktop vault files. Only the opened document content is loaded.
- Markdown Viewer does not impose a document-count limit; available browser quota or filesystem capacity is the practical limit.
- Temporary Share Snapshot and Live Share tabs are not saved to the recipient's workspace.
- Use **Private mode** from Workspace settings to pause normal Document-state persistence for the session. Existing normal and Secret Workspace documents remain intact.
- Use **Storage and Backup** to inspect usage and file counts, view the browser's read-only persistence status, export or import a folder-preserving ZIP, or open the fixed desktop vault.
- Use **Reset workspace** only when you intend to permanently delete all workspace files, folders, settings, Secret Workspace data, history, and trash. The confirmation links directly to Backup.
- Right-click blank Explorer space to create a file or folder. Right-click the empty Quick Start area to open its five actions. Right-click an editor or preview to use the relevant clipboard and document commands.

> **Backup:** Browser site-data clearing remains destructive. Use **Storage and Backup** to export a portable ZIP. Importing a ZIP permanently replaces the current workspace. Secret Workspace records remain encrypted and still require the original access key after import. Trash, desktop history, and recovery journals are not included.

Normal Workspace storage is local. Managed media, GitHub import, remote renderers, stored Share Snapshot, Live Share, external assets, map tiles, and uncached web libraries use the network.

## Editing Tools

The toolbar can:

- Format text as bold, italic, strikethrough, quote, inline code, fenced code, terminal block, headings, lists, and horizontal rules.
- Insert links, images, reference links, tables, date/time stamps, emoji shortcodes, symbols/entities, GitHub alerts, and diagram templates.
- Change selected text to title case, uppercase, or lowercase.
- Insert left, center, or right aligned HTML blocks.
- Switch document direction between LTR and RTL.
- Open Find and Replace, Help, About, and fullscreen.

The editor also supports list continuation on Enter, two-space indent on Tab, outdent on Shift+Tab, and custom undo/redo. View-only shared tabs block editing actions and keep reading, find, help, and fullscreen available.

## Comments and Suggestions

Use Review when you want to leave structured feedback without editing the Markdown source.

1. Click **Review** in the desktop document toolbar or mobile menu.
2. Select the plus pin on a rendered YAML frontmatter table, heading, paragraph, code block, or diagram.
3. Choose **Comment** for general feedback or **Suggestion** for a proposed change.
4. Enter the feedback, then select **Add comment** or **Add suggestion**.
5. Use the review count to read saved feedback and the separate plus to add another item to the same block. Threads can be edited, resolved, reopened, or deleted.

The panel toolbar can copy a Markdown summary, resolve all open items, or delete all feedback after confirmation. Review uses a side panel on desktop, a drawer on tablet, and a bottom sheet on mobile. Opening a new tab closes Review automatically.

Review threads stay with normal local tabs and are excluded from document exports, duplicated tabs, and Share Snapshot links. Live Share synchronizes them while the room is active, including for view-only participants; Private mode pauses new local persistence, workspace backups retain review data, and Reset workspace deletes it.

## Find and Replace

Open Find and Replace with the toolbar, `Ctrl+F`, or `Cmd+F`. Open replacement focus with `Ctrl+H` or `Cmd+H`.

Supported options:

- Case-sensitive search.
- Whole-word search.
- Regular expressions.
- Regex capture replacements such as `$1` and `$<name>`.
- Preserve-case replacement.
- Search only within the selected text.
- Scope matching to the whole document, headings, code, Mermaid, or LaTeX.
- Replace current match or replace all.
- Diff preview before bulk replacement.
- Floating, docked, draggable, and resettable panel positions.

Scope matching uses Marked's lexer and is best-effort for unusual Markdown.

## Importing Documents

### Local Files

Use Import > From files, the mobile import button, or drag and drop to save local Markdown files in Explorer. Imported documents remain closed until you select one in Explorer, so large imports do not fill the tab bar. Dropping a file on an Explorer folder imports it there; dropping it elsewhere imports it at the default workspace root. Folders expand after a short drag hover, and the Explorer scrolls automatically near its top and bottom edges.

Paste an image or GIF from the clipboard, drop an image/GIF/video file, or use the media dialog to insert it at the current editor cursor. A progress toast shows preparation and upload status. Still images are optimized, animated GIFs retain their original animation, and MP4, WebM, or Ogg videos are inserted as playable HTML5 media. After first-use consent, the app uploads the file to managed public media storage and inserts a short HTTPS link. Anyone with that unguessable URL can retrieve the media for up to 90 days; after expiry the reference remains in Markdown but the media stops rendering. Documents containing older inline base64 raster images offer to convert them to short links without changing their alt text or title.

- Managed still images are limited to 300 KiB after optimization.
- Animated GIFs are limited to 5 MiB, and managed videos to 10 MiB.
- Supported file types are `.md`, `.markdown`, and `text/markdown`.
- An individual local Markdown file is limited to 10 MB.
- Extension matching is case-insensitive.
- Dragging over the app shows a compact notice without blocking the editor or Explorer drop targets.
- The app scans the first 8 KB for null bytes and rejects likely binary files.
- Local file content stays on the device unless you later share it.
- The 90-day media expiry uses the same duration as stored Share Snapshot links, but each feature keeps separate KV records.

### GitHub

Use Import > From GitHub and paste one of these URL types:

- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/main/docs`
- `https://github.com/owner/repo/tree/release/2026/docs`
- `https://github.com/owner/repo/tree/758cbeda07ac15093520c803c11140ae9b1f4a2c`
- `https://github.com/owner/repo/blob/main/README.md`
- `https://raw.githubusercontent.com/owner/repo/main/README.md`

Direct Markdown file URLs import immediately into Explorer. Repository, tree, blob, and raw URLs can identify the default branch, an explicit branch (including names containing `/`), a tag, or a commit SHA. The importer resolves that reference to an immutable commit SHA before listing files. A standard GitHub `/commit/<sha>` page URL is not an import URL; use a repository `tree` or `blob` URL containing the commit SHA instead. After a valid URL is submitted, the Import button shows a spinner while the repository/ref resolves; the modal then expands from its original 520px URL width to the original 760px selection width and shows a shimmer tree until Markdown discovery completes. The searchable, collapsible tree contains every Markdown file found and uses the same compact type scale as other application modals. In the reduced-height repository row, the repository name stays on the left while a wider resolved branch/ref badge and linked short commit are grouped on the right; when the supplied reference is a commit SHA, only the commit is shown, and truncated refs reveal their full value on hover. The toolbar places its lightweight selected-file indicator and matching borderless select/deselect-all and collapse/expand-all controls directly beside the search field. Default-branch imports use a repository-named Explorer folder. Nested GitHub directory paths are preserved, and imported files remain closed until you select one in Explorer.

Public repositories need no credentials. For a private repository, expand **Private repository access**, enter a recognizable name of up to 60 characters and either a fine-grained or classic PAT, and select **Add access**. The app accepts both PAT formats automatically. After adding, the form closes and a dropdown lets you select among as many as 50 named tokens before choosing **Import**. Use the icon controls to add another token or remove the selected one. The importer first tries public access and sends the selected token only to `api.github.com` when authenticated access is needed. Private file content is downloaded through GitHub's Contents API rather than the raw-content host.

GitHub access tokens survive refreshes and app restarts until you remove them. The app stores each credential payload only as AES-GCM ciphertext and keeps its encryption key in local browser/app data, so no protection passphrase or unlock step is required. Clearing this site's/app's local data also removes access. GitHub validates a token when it is added. Adding, removing, or rejecting a token is reported in a GitHub-branded toast. Local removal does not revoke a PAT on GitHub, so revoke it separately in GitHub settings if it may have been exposed.

## Export Markdown to PDF, HTML, PNG, and MD

Export names use the active tab title when possible.

| Export | Behavior | Main Limitations |
| :--- | :--- | :--- |
| Markdown | Saves the raw `.md` text. | Browser downloads or desktop native save dialog only. |
| HTML | Saves standalone rendered HTML with sanitized content, styles, renderer support hooks, a restrictive CSP, and SRI metadata where applicable. | External content referenced by the document may still load remotely when opened. |
| PDF: Browser Print | Temporarily prepares a light print preview, refreshes theme-sensitive diagrams, then calls `window.print()`. Recommended for most long documents. | Browser print engines vary; author-specified dark colors inside diagrams, SVGs, HTML, or images are preserved. |
| PDF: Legacy Raster | Uses `html2canvas` and `jsPDF` with page-break planning. | Memory-heavy for very long documents; cross-origin images need CORS. |
| PNG | Captures the rendered document to a PNG. | Browser canvas limits apply; cross-origin images need CORS. |

Raster PDF and PNG exports render Mermaid, ABC, and MathJax in an off-screen capture before saving. Export progress can be cancelled.

## Share Markdown with Snapshot Links

Use Share Snapshot when you want to send a point-in-time copy.

1. Choose View only or Can edit.
2. Click Share.
3. Copy the generated link.

View only opens the Document in Preview and hides editing. Can edit opens the copy in Split view so the recipient can edit their own local copy. It is not real-time collaboration.

Small Documents are compressed into the URL hash as `#share=...`. Documents of at least 3,000 UTF-8 bytes, or whose encoded URL exceeds 4,096 characters, are stored through `/api/share` and opened with `#id=...`. Stored snapshots use Cloudflare KV for up to 90 days and can contain up to 8,000,000 characters. They are bearer links: anyone with the URL can open the snapshot.

The creation API returns a deletion token, but the current UI does not display it or provide an early-delete action. Normal UI-created stored snapshots therefore remain until expiry. See [Share Snapshot](Share-Snapshot.md).

Shared snapshot tabs are temporary and are not saved into the recipient's workspace.

## Live Share Rooms for Markdown Collaboration

Use Live Share when you want a temporary real-time room.

1. Click Live Share.
2. Enter or accept a display name.
3. Choose Can edit or View only.
4. Start the session.
5. Copy the invite link after the room starts.

Live Share sends real-time Yjs updates through a Cloudflare Durable Object. It does not persist Markdown or Review Document content server-side. The Durable Object does persist the host, edit, and view capability values plus their creation time. The invite URL contains a room id, room secret, access role/capability, and title, not the full Document body. The server authenticates host, Can edit, and View only capabilities and filters message types by role. Markdown and Review data use separate Yjs documents, so View only participants can synchronize comments and suggestions without being allowed to edit Markdown.

Participants get a temporary live tab, presence avatars, and live cursor indicators. The host can end the session for everyone. Rooms are limited to 64 WebSocket participants and 8 MB live messages. Managed images, GIFs, and videos travel as short HTTPS links rather than binary Live Share messages and stop rendering when their 90-day storage TTL expires.

## Rendering Diagrams, Maps, Math, STL, and ABC Notation

Use fenced code blocks for advanced renderers:

- `mermaid` for Mermaid diagrams.
- `plantuml`, `d2`, `graphviz`/`dot`, `vega-lite`, `wavedrom`, and `markmap` for diagrams and charts.
- `geojson` and `topojson` for maps.
- `stl` for 3D models. STL sources over 2 MiB, non-finite geometry, and geometry over 300,000 vertices are rejected before rendering.
- `abc` for sheet music and playback.
- `math` for display math.

Mermaid, Markmap, maps, STL, ABC, and MathJax use client-side libraries. PlantUML, D2, Graphviz, Vega-Lite, WaveDrom, and some diagram previews can send source to remote rendering endpoints such as PlantUML, Kroki, or mermaid.ink.

## Keyboard Shortcuts

| Action | Shortcut |
| :--- | :--- |
| Save/export Markdown | `Ctrl+S` / `Cmd+S` |
| Copy selected text, or whole Markdown when nothing is selected | `Ctrl+C` / `Cmd+C` |
| Toggle scroll sync in Split view | `Ctrl+Shift+S` / `Cmd+Shift+S` |
| Find | `Ctrl+F` / `Cmd+F` |
| Replace | `Ctrl+H` / `Cmd+H` |
| Undo | `Ctrl+Z` / `Cmd+Z` |
| Redo | `Ctrl+Shift+Z`, `Cmd+Shift+Z`, `Ctrl+Y`, or `Cmd+Y` |
| New tab | Desktop: `Ctrl+T` / `Cmd+T`; web and desktop: `Alt+Shift+T` |
| Close tab | Desktop: `Ctrl+W` / `Cmd+W`; web and desktop: `Alt+Shift+W` |
| Indent | `Tab` |
| Outdent | `Shift+Tab` |
| Close modals, panels, tab menus, and diagram modals | `Escape` |

Browser shortcuts are intentionally not all intercepted on the web. For example, web tab creation/closing uses `Alt+Shift+T/W` so the app does not hijack browser tab shortcuts.

Related pages: [Features](Features.md), [Markdown Reference](Markdown-Reference.md), [Privacy and Security](Privacy-and-Security.md), and [Troubleshooting](Troubleshooting.md).
