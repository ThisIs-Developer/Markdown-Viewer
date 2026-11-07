### Desktop downloads

These installers contain the complete desktop application with normal editing,
exports and persistent vault storage. No developer tools or separate resource
files are needed. For a workflow artifact download, extract the ZIP first.

**Recommended workflow download: `desktop-installers`.** It contains the Windows
EXE, three Mac DMGs and three Linux DEB installers. The full `desktop-release`
download additionally contains the optional Linux portable archives.

Publisher: **ThisIs-Developer**. License: **Apache-2.0**.
[Website](https://markdownviewer.pages.dev/) ·
[Support and source code](https://github.com/ThisIs-Developer/Markdown-Viewer).

| Your computer | Download |
| --- | --- |
| Windows x64 | `markdown-viewer-win_x64.exe` |
| Intel Mac / Monterey VMware on Intel or AMD Windows | `markdown-viewer-mac_x64.dmg` |
| Apple Silicon Mac | `markdown-viewer-mac_arm64.dmg` |
| Either Mac architecture | `markdown-viewer-mac_universal.dmg` |
| Ubuntu/Debian on Intel or AMD | `markdown-viewer-linux_amd64.deb` |
| Ubuntu/Debian on ARM64 / ARMHF | The matching `linux_arm64.deb` / `linux_armhf.deb` |

**Mac:** the native builds target Intel macOS 10.15 and Apple Silicon macOS 11, with no upper-version cutoff. Use the same architecture-matching DMG on newer macOS versions. Install available Safari/WebKit updates (Catalina: Safari 15.6.1). Older systems need manual acceptance; CI tests macOS 15 and 26. Open the DMG, drag **Markdown Viewer.app** to **Applications**, eject the disk image, then open the app. Allow Documents access for the vault. See `MACOS-SIGNING.txt` for this build's signing status. Ad-hoc builds show an unidentified-developer warning; on Monterey, Control-click the installed app → Open, or use Security & Privacy → Open Anyway for a build you trust. On newer macOS, use System Settings → Privacy & Security → Open Anyway. Developer ID signed and notarized builds use Apple's normal first-open confirmation.

**Ubuntu:** open the `.deb` with Software Install and install, then launch **Markdown Viewer** from Applications. If your Ubuntu installation has no graphical package installer, run `sudo apt install ./markdown-viewer-linux_amd64.deb`. The package installs WebKitGTK and other runtime dependencies. Portable `.tar.gz` downloads preserve execute permission but require those libraries to be installed separately.

**Why several Linux downloads?** Choose one CPU architecture: `amd64` / `x64`
for Intel and AMD computers (including ordinary Ubuntu VMware guests), `arm64`
for 64-bit ARM, or `armhf` for 32-bit ARM. Each architecture has a recommended
`.deb` installer and an optional `.tar.gz` archive. These are two formats for
three architectures. You only need one file; `amd64` also works on Intel CPUs.

**Ubuntu App Center details:** opening a downloaded local DEB can still show a
generic icon, "Unknown publisher", "License unknown" or an unknown update date.
That App Center screen does not read all of the package's application metadata.
The description includes the publisher, license, website and support link;
the package installs the application icon, desktop entry and AppStream metadata
for software managers that consume it. The generic DEB file icon and third-party
package warning are controlled by the operating system. Metadata does not certify
or verify a publisher.

Documents remain in **Documents/Markdown Viewer Vault** when replacing or uninstalling the app. `SHA256SUMS.txt` covers the files above. GitHub's automatically generated **Source code** archives are for developers, not application installers.

To verify a download, run `shasum -a 256 <filename>` on macOS or
`sha256sum <filename>` on Linux and compare it with `SHA256SUMS.txt`.
When all files are extracted together, `shasum -a 256 -c SHA256SUMS.txt` (Mac)
or `sha256sum -c SHA256SUMS.txt` (Linux) verifies the complete download set.
