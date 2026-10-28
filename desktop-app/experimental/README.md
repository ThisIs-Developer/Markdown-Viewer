# Windows native runtime demo

PR #269 tests three opt-in Windows features: pointer-based Explorer dragging,
native file/folder drops with real paths, and forwarding later launches to the
existing window. Ordinary web and desktop builds keep their current behavior.

## Download and try

The **Windows Native Runtime Demo** Actions workflow produces a self-contained
Windows x64 executable, `SHA256SUMS`, and `provenance.json`. Download its artifact,
extract it, and run the executable. WebView2 is required, as in the standard app.
The artifact is unsigned and experimental; it does not replace a release.

This packaged demo uses application ID `com.markdownviewer.desktop.native-demo`
and `Documents/Markdown Viewer Native Demo Vault`. It does not migrate or delete
the ordinary `Markdown Viewer Vault`. Multiple copies of this demo share its
demo Vault. Linking a real file is still intentional access to that original:
**Ctrl+S writes to a linked original**. Use disposable files for trial edits.

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
`native-drop-windows.patch` contains only the Windows `lib/webview/webview.h`
changes from [drop PR #1845](https://github.com/neutralinojs/neutralinojs/pull/1845)
at `bcae000f1759d37ead5aef524c08451d1db82874`. It does not include that branch's
unrelated authentication, server, macOS or Linux changes. Both upstream changes
are still unreleased dependencies of this experiment.

On Windows with Node 24, Git, CMake, Ninja and the MSVC developer environment:

```powershell
npm ci
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
and release workflow remain unchanged. The manifest records the application and
runtime commits, patch hash, runtime hash and final executable hash.

`prepare.js --experimental-neutralino-runtime` alone is a developer opt-in and
continues using the normal Vault. The separate Vault is enabled specifically by
`build-native-demo.js` for the downloadable trial executable.
