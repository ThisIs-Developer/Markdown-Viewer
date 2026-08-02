# Frequently Asked Questions

## General

### What is Markdown Viewer?

Markdown Viewer is a local-first Markdown editor and viewer with a plain-text Editor, sanitized Preview, Split view, multi-Document Workspace, rich renderers, exports, Share Snapshot, and Live Share. It runs on the web, as a PWA, in Docker, and as a Neutralino desktop application.

### Is it free?

Yes. Markdown Viewer is open source under the [Apache License 2.0](../LICENSE).

### Do I need an account?

No. The application has no account, login, or subscription system.

### Is it a WYSIWYG editor?

No. You edit plain Markdown source. The formatting toolbar inserts or transforms Markdown, and Preview shows the rendered result.

### Which platforms are supported?

You can use a modern browser, install the PWA where the browser supports it, self-host the static application, run the Docker image, or use/build the Neutralino desktop application. Exact behavior still depends on browser, webview, operating system, GPU, audio, print engine, and network support.

## Workspace and Storage

### Where are my Documents stored?

Web documents use per-document IndexedDB records. Desktop normal documents are ordinary `.md` files in `Documents/Markdown Viewer Vault` by default, with internal metadata, history, trash, and encrypted Secret Workspace objects stored alongside them. Markdown Viewer is not a synchronized cloud Workspace.

### How many Documents can I keep?

Markdown Viewer does not impose a document-count limit. Browser quota or available desktop filesystem capacity is the practical limit.

### What is the difference between closing and deleting a Document?

Closing removes the open tab but keeps the Document in the Workspace. Deleting removes the Document. Closing all tabs can leave the Workspace files available in Explorer.

### What happens when I delete a Folder?

Markdown Viewer moves Documents from that Folder tree to the containing Workspace root, then removes the Folders. A multi-item delete can delete selected Documents while returning Documents from deleted Folders to the root; read the confirmation carefully.

### What is Secret Workspace?

Secret Workspace encrypts stored file contents and Folder names on the device with a password-derived AES-GCM key. The password cannot be recovered. The protection applies to stored content, not to exports, unlocked sessions, or network features.

### What does Private mode do?

Private mode pauses new Document-state writes while enabled. Existing normal documents and encrypted Secret Workspace records remain safe. Current in-memory work can continue during that session but does not survive reload or exit.

### What does Reset workspace delete?

It permanently deletes all Documents, folders, review data, settings, Secret Workspace ciphertext, history, trash, and other local workspace data. Use the **Backup** button in the confirmation first if anything must be retained. **Reset Secret Workspace** remains available when only the encrypted area should be deleted.

### What does a workspace backup include?

A workspace ZIP contains normal Documents, folder organization, review data, selected preferences, and—when explicitly selected—encrypted Secret Workspace records. It does not include trash, desktop history, or recovery journals. Importing a backup permanently replaces the current workspace after confirmation.

## Privacy and Security

### Does Markdown leave my device?

Normal editing, local import, Preview, Workspace storage, and most exports stay on the device. Data can leave when you use managed media, GitHub import, remote diagram rendering, stored Share Snapshot, Live Share, external assets/map tiles, or uncached web libraries.

See [Privacy and Security](Privacy-and-Security.md) for the complete table.

### Does Markdown Viewer collect analytics?

The application code does not implement analytics, telemetry, advertising, tracking pixels, or app-specific cookies. External services, hosting providers, and self-hosted servers can still process normal request logs.

### Is rendered HTML sanitized?

Yes. Preview HTML is sanitized with DOMPurify before insertion. Remote SVG output receives additional filtering. Sanitization reduces risk but is not a guarantee against every browser or third-party defect.

### Are Share Snapshot links private?

No. They are bearer links. Anyone with the complete link can use its View only or Can edit capability. Stored snapshots expire after 90 days.

### Can I delete a stored Share Snapshot early?

The API supports deletion with the token returned at creation. The current UI does not display that token or provide a Delete snapshot action, so normal UI-created snapshots remain until their 90-day expiry. See [Share Snapshot](Share-Snapshot.md).

### Are managed-media URLs private?

No. They are content-addressed and difficult to guess, but anyone with the URL can retrieve the media until its 90-day expiry. There is no early-delete control.

### Is Live Share end-to-end encrypted?

No. Treat every invitation as a sensitive bearer link.

### Does Live Share store the Document?

It does not persist Markdown or Review content server-side. Connected clients exchange it through a Durable Object WebSocket relay. The Durable Object does persist host/edit/view capability values and `createdAt` without an application TTL or deletion route.

## Markdown, Renderers, and Editing

### Which Markdown features are supported?

Markdown Viewer supports CommonMark-style Markdown, GFM tables/task lists/strikethrough/autolinks, alerts, footnotes, definition lists, syntax highlighting, sanitized HTML, frontmatter handling, math, and the rich fences listed in [Markdown Reference](Markdown-Reference.md).

It is GFM-oriented, not guaranteed to match GitHub, Pandoc, Obsidian, Typora, or another parser byte for byte.

### Which renderers send source over the network?

PlantUML uses the PlantUML server with Kroki fallback. D2, Graphviz/DOT, Vega-Lite, and WaveDrom use Kroki. Some insertion previews use mermaid.ink or Kroki. Do not use those paths for sensitive source unless you trust the service.

### Can I compare two Documents?

Yes. Use **Open in split view** from a Document menu, then choose a second Document. A shared control switches both sides between Edit and Preview. This two-Document mode is separate from the single-Document Editor/Split view/Preview controls.

### Does Find and Replace support regular expressions?

Yes. It supports regular expressions, capture replacements, preserve-case replacement, selection-only matching, selected syntax scopes, and a diff Preview. Scope detection is best-effort for unusual Markdown.

## Import and Export

### Which local files can I import?

`.md`, `.markdown`, and `text/markdown` files up to 10 MB. The application scans the first 8 KiB for null bytes and rejects likely binary content.

### Can I import a private GitHub repository?

Yes. Expand **Private repository access**, give the token a recognizable name, enter either a fine-grained or classic PAT, and select **Add access**. The app detects both formats automatically, asks GitHub to validate the token, and confirms success or failure in a GitHub-branded toast. The form then collapses into a named-token selector so you can add, select, or remove entries individually at any time. Tokens survive refreshes and app restarts in a local vault: credential payloads are AES-GCM encrypted and the key remains in local browser/app data, so no passphrase or unlock step is needed. The app cannot revoke a PAT on GitHub; use GitHub settings to revoke or rotate it.

### Which PDF option should I use?

Use Browser Print for most long, text-heavy Documents and selectable text. Use Legacy Raster PDF when screenshot-style capture and its page-break planning are more important. Raster export consumes more memory and depends on browser canvas/CORS behavior.

### Why are images missing from PDF or PNG?

Canvas-based exports need successfully loaded, CORS-compatible resources. A remote image that blocks cross-origin canvas access can be omitted. Wait for all assets/renderers, then see [Troubleshooting](Troubleshooting.md#pdf-or-png-export-is-missing-content).

## Installation and Offline Use

### Can I open `index.html` directly?

Use an HTTP server instead. `file://` can block Web Workers and Service Workers.

### Can the PWA work offline?

The application shell and previously fetched CDN libraries can work after a successful Service Worker installation and cache fill. First-use libraries and every network-backed feature still require connectivity.

### Does Docker include Share Snapshot and Live Share backends?

No. The container is a static Nginx site. It does not provide Cloudflare KV or Durable Objects. The stock image also omits `preview-worker.js` and `sample.md`, which limits Worker and PWA/offline behavior. See [Docker Deployment](Docker-Deployment.md#known-stock-image-limitation).

## Help

For diagnostic steps, use [Troubleshooting](Troubleshooting.md). For an unresolved reproducible problem, search or open a [GitHub issue](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) without including confidential Documents, bearer links, secrets, capabilities, or tokens.
