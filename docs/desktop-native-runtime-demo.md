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
   not a stable release. Do not import unrelated changes from #1845's broader diff.
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
this draft as a future demo until stable Neutralino support is available.

## Evidence and manual tests

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
