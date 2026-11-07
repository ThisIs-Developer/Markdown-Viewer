### Desktop downloads

| Your computer | Download |
| --- | --- |
| Windows x64 | `markdown-viewer-win_x64.exe` |
| Intel Mac / Monterey VMware on Intel or AMD Windows | `markdown-viewer-mac_x64.dmg` |
| Apple Silicon Mac | `markdown-viewer-mac_arm64.dmg` |
| Either Mac architecture | `markdown-viewer-mac_universal.dmg` |
| Ubuntu/Debian on Intel or AMD | `markdown-viewer-linux_amd64.deb` |
| Ubuntu/Debian on ARM64 / ARMHF | The matching `linux_arm64.deb` / `linux_armhf.deb` |

**Mac:** macOS 12.0 or newer, including Ventura, Sonoma, Sequoia and Tahoe. Monterey is the minimum, not the only supported version; use the same architecture-matching DMG on newer macOS versions. Open the DMG, drag **Markdown Viewer.app** to **Applications**, eject the disk image, then open the app. Allow Documents access for the vault. See `MACOS-SIGNING.txt` for this build's signing status. Ad-hoc builds show an unidentified-developer warning; on Monterey, Control-click the installed app → Open, or use Security & Privacy → Open Anyway for a build you trust. On newer macOS, use System Settings → Privacy & Security → Open Anyway. Developer ID signed and notarized builds use Apple's normal first-open confirmation.

**Ubuntu:** open the `.deb` with Software Install and install, then launch **Markdown Viewer** from Applications. If your Ubuntu installation has no graphical package installer, run `sudo apt install ./markdown-viewer-linux_amd64.deb`. The package installs WebKitGTK and other runtime dependencies. Portable `.tar.gz` downloads preserve execute permission but require those libraries to be installed separately.

Documents remain in **Documents/Markdown Viewer Vault** when replacing or uninstalling the app. `SHA256SUMS.txt` covers the files above. GitHub's automatically generated **Source code** archives are for developers, not application installers.
