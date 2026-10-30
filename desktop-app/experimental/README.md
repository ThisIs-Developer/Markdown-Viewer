# Windows native runtime demo

PR #269 tests three opt-in Windows features: pointer-based Explorer dragging,
native file/folder drops with real paths, and forwarding later launches to the
existing window. The native runtime features stay opt-in. Shared web/desktop UI
also restores precise drop feedback and adds bounded browser folder imports.

## Download and try

The **Windows Native Runtime Demo** Actions workflow produces a self-contained
Windows x64 executable, an optional Windows integration helper, `SHA256SUMS`, and `provenance.json`. Download its artifact,
extract it, and run the executable. WebView2 is required, as in the standard app.
The artifact is unsigned and experimental; it does not replace a release.

This packaged demo uses application ID `com.markdownviewer.desktop.native-demo`
and `Documents/Markdown Viewer Native Demo Vault`. It does not migrate or delete
the ordinary `Markdown Viewer Vault`. Multiple copies of this demo share its
demo Vault. Linking a real file is still intentional access to that original:
**Ctrl+S writes to a linked original**. Use disposable files for trial edits.

### Explorer destinations and feedback

The native drag lifecycle restores the compact drag notice, file/folder icon,
hover highlighting and folder expansion. Coordinates are mapped from native client
pixels to the WebView's CSS viewport, including display scaling and zoom.

- Drop on a Vault folder to import there. A file row uses its containing folder.
- Drop on Linked Workspace to link in place. A linked folder or file row groups
  the new link at that sidebar destination without copying or moving originals.
- Drop elsewhere to choose **Vault Workspace** or **Linked Workspace**. Folder
  copies include Markdown files and their hierarchy; linking retains original paths.
- Cancelling the chooser changes nothing. Locked or unsupported destinations show
  invalid feedback. Media retains its existing validation and consent flow.

### Optional Windows registration

Keep the extracted portable folder in its final location, then run
`MarkdownViewer-WindowsIntegration.exe`. Choose **Register app** to add **Markdown
Viewer** to **Open with** and **Default apps** for `.md` and `.markdown`. Choose
your preferred default through Windows; registration never changes it automatically.
The helper uses the current user's registry and does not require administrator access.
Its Default apps button requests Markdown Viewer's own settings page. Registration
refuses to replace another application's existing entry with the same display name.

**Discovery investigation is deferred at the maintainer's request.** Registry tests
and Windows shell dispatch pass, but appearance in the Windows app lists remains
unverified on the target machine. Registration stays optional and is never run on
startup. Correct executable branding does not itself register a portable app.

Browser folder drops preserve Markdown hierarchy and empty folders; top-level
media keeps its existing consent flow. Private mode imports stay session-only.
Browsers may hide item types during hover, so the notice uses a neutral items icon
until file/folder metadata is available. See [browser behavior and limits](../../docs/desktop-native-runtime-demo.md#browser-file-and-folder-drops).

**Remove registration** removes only registrations owned by this portable copy.
Do this before deleting or moving it. A newer registered copy is protected from an
older helper's removal. No installer exists for this experimental package, so
registration is explicit and optional; normal release packaging is unchanged.

The helper also accepts `--register <full-executable-path>` and
`--unregister <full-executable-path>` for integration tests. Its `--self-test` uses
an isolated temporary registry subtree and checks quoting, defaults, ownership and
cleanup. It embeds the application's locale catalogs and uses the Windows UI language.

The app executable uses the Markdown Viewer name, description, contributor name,
and official icon in its Windows resources. Opening files through the registered
quoted command uses the existing Unicode-aware single-instance launch queue.

Try these flows:

1. Drop a Markdown file, choose **Link original**, edit and save; verify the original.
2. Drop another file, choose **Import to Vault**; editing the copy preserves the original.
3. Drop a folder together with a Markdown file and cancel; neither is added.
4. Drop images, GIFs or videos into an editable document. Existing media validation
   and upload consent still apply; managed media uses the network after consent.
5. Drop several batches quickly, cancel one, and accept the next.
6. Drag Explorer entries between folders/workspaces; press Escape during a drag.
7. Launch the same executable with two Markdown paths. Launch it again with a new
   path and verify that the existing window opens that file.

## Reproduce the executable

The runtime is pinned to `Kechos23/neutralinojs` commit
`3c307cba7c6de5eb10db614ae8daad99bf44e51d` (Neutralino 6.10.0 with
[single-instance PR #1852](https://github.com/neutralinojs/neutralinojs/pull/1852)).
`native-drop-windows.patch` starts with the Windows drop-target changes from
[drop PR #1845](https://github.com/neutralinojs/neutralinojs/pull/1845) at
`bcae000f1759d37ead5aef524c08451d1db82874`, and adds the Windows drag lifecycle,
shell drag-image helper and coordinate/type payload in `lib/webview/webview.h`
and the Windows-only bridge in `api/window/window.cpp`. The Windows `filesystem.move`
implementation in `api/fs/fs.cpp` also uses an atomic rename without replacement:
an occupied destination is rejected even if it appeared after the UI's check.
It does not include that branch's
unrelated authentication, server, macOS or Linux changes. Both upstream changes
are still unreleased dependencies of this experiment.

On Windows with Node 24, Git, CMake, Ninja and the MSVC developer environment:

```powershell
npm ci
npm ci --prefix desktop-app
git clone https://github.com/Kechos23/neutralinojs.git desktop-app/.native-runtime
git -C desktop-app/.native-runtime checkout 3c307cba7c6de5eb10db614ae8daad99bf44e51d
git -C desktop-app/.native-runtime apply ../experimental/native-drop-windows.patch
cmake -S desktop-app/.native-runtime -B desktop-app/.native-runtime/build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build desktop-app/.native-runtime/build --parallel 4
npm --prefix desktop-app run setup
node desktop-app/build-native-demo.js
```

Outputs are in `desktop-app/dist/native-demo/`. Packaging copies resources and the
custom runtime into an isolated staging directory, enables demo flags there, and
restores ordinary prepared resources afterward. The standard runtime/client pins
remain unchanged. Standard Windows packaging now applies the same app branding;
the release build installs the pinned packaging dependencies for that step.
The manifest records the application/runtime commits, expected patched source
tree, patch hash, runtime hash and final executable hash. Packaging compares the
entire tracked source against the pinned commit plus the reviewed patch, using an
isolated Git index, and rejects additional source changes.

Windows CI runs `node tests/native/explorer-rename.cjs <trial.exe>` after packaging
to exercise the real WebView2 application and filesystem: Unicode/case-only rename,
draft preservation, subsequent saves, collision protection and persisted links.

`prepare.js --experimental-neutralino-runtime` alone is a developer opt-in and
continues using the normal Vault. The separate Vault is enabled specifically by
`build-native-demo.js` for the downloadable trial executable.

## Explorer editing and Windows identity

File/folder Rename edits the name directly in Explorer, with the full current name
selected. Enter commits; Escape or clicking elsewhere cancels. Invalid names and
collisions remain in the field with an accessible error. F2 invokes Rename too.
The field keeps the row's font size and uses the application's themed focus border.
If another session changes the folder being renamed, retry Rename from its current
row rather than overwriting that change. No trial documents are seeded by packaging;
native acceptance fixtures are excluded from the downloadable artifact.
Renaming a linked file renames its original on disk, retains unsaved text, updates
the linked source path and makes later saves use the new filename. It never falls
back to copying/deleting an original when a rename fails. Sidebar grouping stays
independent of the original disk directory. The parent-directory action is named
for File Explorer on Windows, Finder on macOS, and File Manager on Linux.

On the web, a folder's **Download folder** action exports a ZIP containing its
Markdown documents, nested folders and empty folders. Current editor drafts are
included; duplicate export names receive numeric suffixes. A Secret Workspace
download is abandoned if the workspace locks while the archive is being prepared.

Both packaged Windows executables use **Markdown Viewer**, version 3.10.5, and
the official app icon. The trial title also reads **Markdown Viewer**; its filename,
application ID and separate Vault continue to distinguish it from a normal release.
Explorer itself controls tooltip property labels, size and creation-date fields.

The supplied `markdown-document.svg` is embedded as a separate document icon
(resource 200), with 16–256 px ICO sizes. Rebuild it with
`node scripts/build-markdown-document-icon.cjs` after installing the root Playwright
dependencies. The optional integration helper associates this document icon with
the application's Markdown ProgID, keeping the M icon for application identity.
Choosing an unregistered EXE directly can still use its application icon for files.
The separate document icon requires explicit registration; merely changing EXE
metadata cannot install a separate document association. The helper never sets
UserChoice/default applications. Open-with discovery investigation is deferred at
the maintainer's request; no automatic registration is added.

The supplied file-md-thin artwork is from Phosphor Icons (MIT). Its notice is kept
in `assets/phosphor-icons.LICENSE.txt`, which is included in embedded desktop assets.
