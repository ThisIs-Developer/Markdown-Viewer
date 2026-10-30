# Desktop native runtime demo (draft)

This opt-in Windows experiment builds on the merged Linked Workspace and shared
safety work from PRs #262 and #279. The normal release configuration remains on
its official runtime. A separate Actions workflow now builds a trial executable
from pinned single-instance source and the isolated Windows drop patch. See the
[build and trial instructions](../desktop-app/experimental/README.md) for exact
revisions, checksums and the separate demo Vault.

## Required interfaces

- Neutralino #1852: `singleInstance` and `secondInstance` with `{args, cwd, requestId}`.
  Register before `Neutralino.init()`, queue launches until the editor and initial
  files are ready, and resolve relative paths against the sender's cwd.
- Neutralino #1845: `filesDropped` with real paths over WebView2. Offer Linked / Vault
  copy without another picker. Folder drops use #262's linked-folder workflow.
- The reviewed Windows patch adds `filesDragged` enter/over/leave events and final
  drop coordinates. CSS viewport mapping preserves targets under DPI scaling/zoom;
  the Windows shell helper restores native drag imagery. The app reuses its compact
  drag notice, Lucide file/folder icons, target highlights and expansion timers.
- Explorer targets are authoritative. Vault drops use the selected folder (or a
  file row's parent); Linked drops reuse sidebar-only parent grouping, retaining
  the original disk path. An untargeted drop offers Vault first, then Linked.
- The separate trial package brands the Windows executable as Markdown Viewer and
  includes an optional per-user Open With registration helper. Registration never
  writes Windows UserChoice or changes an existing default application.
- Mixed drops ask before linking folders, copying Markdown or importing media.
  Cancelling the chooser adds nothing. Media uses bounded reads and the existing
  validation/consent flow. Queued drops are invalidated by workspace maintenance;
  failed reads or saves cannot be reported as successful imports.
- The current Windows drop patch replaces WebView2's HTML drop target. An explicitly
  gated pointer fallback preserves internal moves/conversion; this is not a fix for
  a stock application's drag bug. Reassess/remove it when native and HTML drops coexist.

App-side validation is Windows-only. Neither macOS/Linux integration nor Finder
file associations are claimed tested. Drive-relative paths such as `C:notes.md` are
unsupported; fully qualified and ordinary relative paths are supported.

## Local experiment

1. Use Node 22–26 and set up the normal desktop dependencies first.
2. Build Neutralino PR #1852 (tested commit
   `3c307cba7c6de5eb10db614ae8daad99bf44e51d`) with the isolated #1845 WebView fix,
   following Neutralino's CMake/MSVC instructions. This is 6.10.0 development source,
   not a stable release. The local patch also includes the Windows-only drag
   lifecycle bridge. Do not import unrelated changes from #1845's broader diff.
3. For an unpackaged developer run only, place the binary in
   `desktop-app/bin/neutralino-win_x64.exe`. Stock setup may replace it. Prefer
   `build-native-demo.js` for a self-contained trial with an isolated Vault.
4. Run `node desktop-app/prepare.js --experimental-neutralino-runtime`. This creates
   ignored external feature flags under the existing CSP and an ignored
   `desktop-app/neutralino.experimental.config.json` enabling `singleInstance`
   and `modes.window.emitDropEvents`. The stock config and runtime/client pins stay unchanged.
5. From `desktop-app`, run:

   ```powershell
   .\bin\neutralino-win_x64.exe --path="$PWD" --load-dir-res --config-file=/neutralino.experimental.config.json
   ```

6. Run ordinary `node desktop-app/prepare.js` to remove the flags/config and restore
   normal resources. Restore the stock executable separately if needed.

The browser entry point never loads these flags. Event handlers require Windows
and their specific opt-in; pointer handling also requires desktop filesystem access.
Normal preparation keeps existing HTML dragging and default desktop behavior.

Both runtime APIs must ship in an official stable release before normal distribution
can rely on them. Their interfaces may change during review. The maintainer can leave
this PR as an opt-in demo until stable Neutralino support is available.

## Evidence and manual tests

### Browser file and folder drops

The web app also uses the compact drag notice and exact Explorer target highlights.
Dropping a Markdown file imports an independent Vault copy; dropping a folder imports
its Markdown files and nested/empty folders into the hovered Vault destination.
Dropping onto a document selects its parent folder. Original files are never written.
Linked Workspace retains its desktop filesystem requirements.

Browser folder scans drain all directory batches, skip `.git` and `node_modules`,
and stage reads before creating Vault items. Limits are 10,000 Markdown files,
2,000 folders, 40,000 entries, 32 nested levels, 10 MiB per Markdown file and 200 MiB
total, with a 60-second scan deadline. Unreadable or oversized folder contents fail
before import. Nested media is skipped; top-level media keeps the existing consent
and insertion flow. Workspace changes invalidate pending reads.

Browsers protect drag data during hover: they may withhold names and file/folder
types until drop. The notice uses a neutral items icon while details are unavailable,
then uses file/folder icons when exposed by the browser. It cannot reliably identify
a folder before drop on browsers that enforce this restriction. The Windows native
bridge supplies this information throughout the drag.

### Desktop acceptance

Automated app coverage includes launch forwarding, malformed arguments, readiness
queues, native drops, bounded media reads, cancellation, failed saves, workspace
restore races, pointer dragging, translations, and stock/web isolation. Browser
fixtures do not prove Windows OLE drag delivery or native window activation. Test
the actual generated executable before treating this experiment as release-ready.

Close old builds first. Test Explorer double-click/open-with, same-path deduplication,
rapid startup launches, minimized-window activation, Greek names/spaces, relative
paths from another cwd, drops over editor/preview/sidebar, Linked vs Vault copy,
cancellation, internal moves/conversion, Ctrl+S and original-file preservation.
Corporate execution policy still needs testing on the actual machine.

### Explorer rename, folder download and branding

Rename now runs inline in Explorer (Enter commits, Escape/blur cancels, F2 opens
the field). Linked-file renames change the original filename while retaining local
drafts and updating subsequent Save targets. The experimental Windows runtime
rejects replacement during file moves, including destination races. File Explorer,
Finder and File Manager actions open the actual source parent directory.

Web folders can be downloaded as ZIP archives including nested/empty folders,
current Markdown drafts and safely disambiguated names. Locked Secret workspaces
cannot finish an in-flight archive export.

Windows packaging sets ProductName, FileDescription, OriginalFilename
and version metadata. Both window titles use Markdown Viewer. A separate supplied
Markdown document icon is embedded without replacing the application icon. The
existing optional registration helper selects that resource for document
associations; it never changes the user's default. Windows controls its tooltip
layout. Open-with discovery work is deferred at the maintainer's request.
