# Markdown Viewer v3.10.6 desktop downloads

> [!IMPORTANT]
> **macOS and Linux installers are the main v3.10.6 milestone.** These are complete desktop applications with normal editing, Preview, exports, linked files, and persistent Vault storage. No Node.js, npm, developer tools, or adjacent resource folder is required.

## Choose the right installer

### Recommended packages

| Platform | CPU architecture | Download | Works with | Published size |
| :--- | :--- | :--- | :--- | ---: |
| **macOS** | Apple Silicon (M1 and later) | [Apple Silicon DMG](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-mac_arm64.dmg) | Native ARM64; macOS 11+ dependency baseline | See release asset |
| **macOS** | Intel x64 | [Intel DMG](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-mac_x64.dmg) | Intel Macs and Intel/AMD-hosted macOS VMs; macOS 10.15+ dependency baseline | See release asset |
| **macOS** | Universal | [Universal DMG](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-mac_universal.dmg) | One package containing Intel and Apple Silicon slices | See release asset |
| **Windows** | x64 | [Windows EXE](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-win_x64.exe) | Windows 10 and 11 | See release asset |
| **Ubuntu / Debian** | amd64 / x64 | [amd64 DEB](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-linux_amd64.deb) | Intel and AMD PCs; Ubuntu 22.04/24.04 package validation | See release asset |
| **Ubuntu / Debian** | ARM64 | [ARM64 DEB](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-linux_arm64.deb) | 64-bit ARM Linux | See release asset |
| **Ubuntu / Debian** | ARMHF | [ARMHF DEB](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-linux_armhf.deb) | 32-bit ARM Linux | See release asset |

The GitHub release displays the exact uploaded byte size beside every asset. The table is updated with exact sizes after release publication.

### Optional portable Linux archives

Portable archives preserve executable permissions but do not install WebKitGTK, GTK, tray libraries, desktop entries, or icons. Use a DEB unless your organization manages those dependencies separately.

| CPU architecture | Portable download | Best for |
| :--- | :--- | :--- |
| amd64 / x64 | [x64 tar.gz](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-linux_x64.tar.gz) | Intel/AMD systems with managed runtime libraries |
| ARM64 | [ARM64 tar.gz](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-linux_arm64.tar.gz) | 64-bit ARM systems with managed runtime libraries |
| ARMHF | [ARMHF tar.gz](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/markdown-viewer-linux_armhf.tar.gz) | 32-bit ARM systems with managed runtime libraries |

## Install

<details>
<summary><strong>macOS</strong></summary>

1. Open the architecture-matching DMG.
2. Drag **Markdown Viewer.app** to **Applications**.
3. Eject the disk image and open the installed application.
4. Allow Documents access when prompted so the app can use its Vault.

Install the newest Safari/WebKit update offered for the Mac; Catalina should use Safari 15.6.1. The version numbers above are native build baselines, not a guarantee of full UI acceptance on every older macOS release. CI launches the installed packages on Intel and Apple Silicon macOS 15 and 26.

Read [`MACOS-SIGNING.txt`](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/MACOS-SIGNING.txt) for the exact signing/notarization state. For an ad-hoc build you trust, use the per-app **Open Anyway** flow. Never disable Gatekeeper globally.

</details>

<details>
<summary><strong>Ubuntu / Debian</strong></summary>

Open the `.deb` with Software Install, or install from a terminal:

```bash
sudo apt install ./markdown-viewer-linux_amd64.deb
```

Replace `amd64` with `arm64` or `armhf` when needed. The DEB configures executable permissions, dependencies, the application launcher, icons, and AppStream metadata.

</details>

<details>
<summary><strong>Windows</strong></summary>

Run `markdown-viewer-win_x64.exe`. Windows SmartScreen can warn for an unsigned or reputation-new executable. Review the publisher, source, and SHA-256 checksum before choosing **More info → Run anyway**.

</details>

## Application identity and organization deployment

| Field | Release identity |
| :--- | :--- |
| Product | **Markdown Viewer 3.10.6** |
| Publisher / project owner | **ThisIs-Developer** |
| Application id | `com.markdownviewer.desktop` |
| License | Apache-2.0 application; bundled Neutralino runtime retains its MIT license |
| Data location | `Documents/Markdown Viewer Vault` |
| Update/uninstall behavior | Replacing or uninstalling the app does **not** delete the Vault |
| Core data boundary | Editing, bundled Preview, and local export run on the device; explicitly invoked sharing, imports, remote renderers, external assets, and update checks can use the network |
| Integrity | [`SHA256SUMS.txt`](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/SHA256SUMS.txt) covers every published application asset |
| Support and source | [GitHub repository](https://github.com/ThisIs-Developer/Markdown-Viewer) · [Security policy](https://github.com/ThisIs-Developer/Markdown-Viewer/security/policy) · [Web application](https://markdownviewer.pages.dev/) |

### Managed-device guidance

- **macOS:** stage the appropriate DMG/app through the organization's normal software-management tool. Check `MACOS-SIGNING.txt` first; an ad-hoc app is not equivalent to a Developer ID-notarized package. There is no PKG or App Store distribution in this release.
- **Ubuntu/Debian:** DEB is the recommended managed format because `apt` resolves dependencies and tracks installation. This release does not publish an APT repository, RPM, AppImage, Flatpak, or Snap.
- **Windows:** the release is a portable x64 EXE, not MSI/MSIX. SmartScreen reputation and signing are independent of embedded product metadata.
- Pilot the chosen architecture and WebKit/runtime combination before fleet-wide rollout. ARM Linux packages are built and structurally validated but still require representative hardware acceptance.

Ubuntu App Center can show a generic icon, unknown publisher/license, or unknown date when opening a downloaded local DEB because that screen does not consume every packaged AppStream field. The installed package still includes Markdown Viewer identity, icons, desktop entry, maintainer, description, license, website, support link, and AppStream metadata. These fields do not certify a publisher or remove the operating system's third-party package warning.

## Verify the download

Download [`SHA256SUMS.txt`](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/download/v3.10.6/SHA256SUMS.txt), then compare the selected file:

```bash
# macOS
shasum -a 256 markdown-viewer-mac_arm64.dmg

# Linux
sha256sum markdown-viewer-linux_amd64.deb
```

When every release file is in one directory, verify the complete set with `shasum -a 256 -c SHA256SUMS.txt` on macOS or `sha256sum -c SHA256SUMS.txt` on Linux.

> [!NOTE]
> GitHub's automatically generated **Source code** archives are for developers. Choose one of the application packages above for normal installation.
