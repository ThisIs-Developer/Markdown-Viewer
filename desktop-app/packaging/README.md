# Desktop installers for Mac, Windows and Linux

## Broad Mac compatibility

The goal is to let as many users as possible run the desktop app. There is no
application-imposed macOS 12 cutoff or upper-version limit. The build targets the
oldest native dependencies of the current runtime, separately for each CPU:

| Download | Native dependency baseline | Reason |
| --- | --- | --- |
| Intel x64 | macOS 10.15 Catalina | Neutralino's file and vault APIs use Apple's C++ `std::filesystem`, introduced in 10.15. |
| Apple Silicon ARM64 | macOS 11 Big Sur | Apple Silicon Macs and their native ABI start with macOS 11. |
| Universal | 10.15 on Intel; 11 on Apple Silicon | Both slices retain their own baseline and Finder metadata. |

`macos_support.py` is the shared source for compilation targets, per-architecture
plist metadata and binary verification. CI also compiles a filesystem probe at
these targets and confirms that the Apple SDK rejects the same dependency at
10.14. It never disables compiler availability checks or simply edits a newer
binary's version label. Removing all deployment-target flags would default to
the build machine's newer OS and reduce compatibility again.

These are native **build targets**, not proof of testing on every older OS. CI
launches the real packages on Intel and Apple Silicon macOS 15 and 26, including
`macos-latest`. Catalina, Big Sur, Monterey and other versions without hosted
runners need manual acceptance. Install the latest OS and Safari/WebKit updates
available for the user's Mac; on Catalina, use Safari 15.6.1. The app uses the
system WebKit rather than shipping a separate browser. Older unpatched WebKit
engines can lack JavaScript/DOM APIs even when the native executable loads.

For example, the shared UI uses optional chaining and `replaceChildren`, and
workspace maintenance uses `inert`. These are available in updated Catalina's
Safari 15.6, but not all are available in its original Safari 13. Core startup
scripts and their pinned Marked/DOMPurify/Bootstrap dependencies were inspected
against the Safari 15.6 syntax target; this is not a substitute for testing all
renderers, exports and dialogs in the older native WebKit.

A literal promise to run on **every historical and future macOS release** is not
technically supportable. Pre-Catalina support would require replacing/backporting
native dependencies and qualifying the older browser engine. No compatibility is
claimed for those systems, PowerPC/32-bit Macs or untested future OS releases.

## Why v3.10.5 failed on macOS

The release workflow uploaded raw Mach-O binaries as extensionless HTTP downloads. A browser download does not preserve Unix execute permissions, and the files had no Finder-recognized `.app` bundle, `Info.plist`, or installation flow. Finder could therefore treat them as documents. `chmod` alone was not a complete fix: the pinned Neutralino 6.5.0 x64 and arm64 binaries both contain `LC_BUILD_VERSION minos 14.0`, and link ScreenCaptureKit unconditionally. Monterey cannot load that runtime. ARM64 also cannot run on an Intel/AMD VMware guest; use x64 there.

The source of the runtime is pinned to Neutralino 6.5.0 commit `d1b3a4050f2073f236e14c4746ee8aa7dbb9bfe5`. `build-macos-runtime.sh` uses the architecture-specific deployment targets from `macos_support.py`. This selects upstream's existing CoreGraphics snapshot fallback; the unused ScreenCaptureKit link is removed because the framework was only introduced in 12.3. The application does not allow the native snapshot API. No new native permissions are granted.

`verify-macos.py` rejects newer minimum versions and mandatory ScreenCaptureKit links in **every** Mach-O slice, both before and after resource embedding. It also checks that each download contains the advertised CPU slices. These checks do not substitute for running on older macOS releases.

## Download and install

See [release download instructions](RELEASE-DOWNLOADS.md). Mac users download a DMG, drag the app to Applications, eject the image and launch the app. Ubuntu users install a `.deb`, which preserves permissions, installs WebKitGTK/GTK and tray dependencies, and registers a menu entry. Current supported Linux package targets are Ubuntu 22.04/24.04 and compatible Debian installations. ARM packages are built but require hardware acceptance testing. Portable Linux `.tar.gz` files preserve executable permissions; their system dependencies are the same as the `.deb` and must be installed separately.

All packages use the same application id, native API allowlist, shared application code and fixed `Documents/Markdown Viewer Vault` as Windows. Installation never creates, replaces or deletes a user's vault. The running application creates it and saves normal documents under `Workspace`. Removing/replacing the installed app leaves the vault intact.

## Build locally

Windows/Linux raw executables (Node 24, npm, Linux packaging also needs `dpkg-deb` and `tar`):

```sh
npm ci --prefix desktop-app
npm --prefix desktop-app run build -- linux_x64 linux_arm64 linux_armhf win_x64
node desktop-app/packaging/package-linux.js
```

Mac installers must be built on macOS with Xcode command-line tools and CMake:

```sh
npm ci --prefix desktop-app
npm --prefix desktop-app run setup
git clone https://github.com/neutralinojs/neutralinojs.git desktop-app/.macos-runtime
git -C desktop-app/.macos-runtime checkout d1b3a4050f2073f236e14c4746ee8aa7dbb9bfe5
bash desktop-app/packaging/build-macos-runtime.sh desktop-app/.macos-runtime
node desktop-app/build-standalone.js mac_x64 mac_arm64 mac_universal
bash desktop-app/packaging/package-macos.sh
```

Use a clean pinned runtime checkout for each rebuild. Do not run `neu update` between replacing the Mac runtime and embedding resources. Final installers are in `desktop-app/dist/installers`. `npm run build` without target arguments still builds all seven raw developer executables; these are **not** the end-user Mac installers and use the downloaded runtime unless explicitly rebuilt as above. The Docker helper only builds raw developer executables, not DMGs.

The app bundle contains the final embedded executable, icon and plist. It is signed **after** resource injection, which invalidates/removes any original Mach-O signature. The universal build embeds resources for both architectures. Installer packages do not require Node, npm, or an adjacent `resources.neu` file on users' computers.

## Apple signing and notarization

PR and manual CI builds are ad-hoc signed and **not notarized**. `MACOS-SIGNING.txt` beside the installers and `READ-ME-FIRST.txt` in unsigned DMGs explain the warning and Monterey's per-app Open Anyway flow. Ad-hoc signing makes the binary structurally valid (including Apple Silicon); it does not establish a trusted developer identity. Never tell users to disable Gatekeeper globally.

For the normal trusted public-download experience, the repository owner needs an Apple Developer ID Application certificate and notarization credentials. Configure these GitHub Actions repository secrets:

| Secret | Value |
| --- | --- |
| `MACOS_CERTIFICATE_P12_BASE64` | Base64-encoded exported Developer ID Application `.p12` including its private key |
| `MACOS_CERTIFICATE_PASSWORD` | Password protecting that export |
| `MACOS_SIGNING_IDENTITY` | Full `Developer ID Application: … (TEAMID)` identity |
| `APPLE_ID` | Apple developer account email |
| `APPLE_TEAM_ID` | Developer team id |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple app-specific password for notarization |

Only tag-push release jobs read these secrets. With no identity configured, releases are explicitly identified as ad-hoc signed; partially configured credentials or signing/notarization failures fail the build. PR code never receives these credentials. The workflow imports a temporary keychain, signs with hardened runtime and a timestamp, notarizes and staples the app and DMG, and removes the temporary keychain/certificate. For a local signed build, set `MACOS_SIGNING_IDENTITY` and `MACOS_NOTARY_PROFILE` to an existing `notarytool` keychain profile. No Apple credentials were available to validate that optional path while developing this change.

## CI and testing downloads

The **Build Desktop Installers** workflow runs for packaging PRs, manual dispatches and version tags. The `desktop-macos` artifact contains the three DMGs and signing status. GitHub wraps it in a ZIP: extract it first, then open the appropriate DMG. Artifacts are kept for 30 days; a tag release publishes durable assets only after native smoke checks pass. No tag/release is needed to test a PR.

CI checks:

- Shared build and unit suite; Debian package metadata, permissions and extraction.
- Seven compatibility regression tests covering the previous 12/14 cutoffs, mixed universal slices, legacy Intel load commands, incorrect architecture labels and per-architecture Finder metadata.
- Runtime compilation and final Mach-O, plist, signature and DMG validation.
- On ARM and Intel Mac runners for macOS 15 and the latest stable hosted macOS: mount the actual DMG, copy the app, eject the image, launch through LaunchServices, import a Unicode Markdown filename, verify its bytes in the actual Documents vault, and reopen the app. The workflow logs `sw_vers` and CPU architecture to record the actual OS tested.
- On Ubuntu 22.04 and 24.04: install the actual `.deb` with `apt`, validate its desktop entry, and run the same native GUI/vault check under Xvfb.

GitHub-hosted runners no longer provide macOS 10.15–14. Older macOS UI acceptance must be performed on physical Macs or suitable VMs. CI also does not reproduce browser quarantine or an end user's Documents-permission prompt. The native smoke script refuses to run outside disposable GitHub Actions runners or against an existing vault.

## macOS/Ubuntu manual acceptance

1. Download the architecture-matching installer in the guest OS. For VMware on an Intel/AMD Windows host, choose `markdown-viewer-mac_x64.dmg`.
2. Install and open it using the platform instructions. On Mac, allow Documents access if prompted; approve only this app through Open Anyway for an ad-hoc test build. Record the exact macOS and Safari versions and install available OS/browser updates (for Monterey, prefer 12.7.6). Repeat on the macOS versions being qualified for release.
3. Create a document, type Markdown, check Split/Preview, save, and inspect `Documents/Markdown Viewer Vault/Workspace` for the `.md` file.
4. Quit and reopen. Verify content, tabs and settings persist. Replace the installed app with another build and check the same vault is reused.
5. Open/save through native dialogs, link an external Markdown file/folder, and test explicit Save and backup export. Test offline editing and bundled renderers, plus HTML/PNG/PDF exports. Network features still need a connection.
6. On Ubuntu, launch from the application menu as an ordinary user; no `chmod` or terminal launch should be needed after `.deb` installation.

If a VMware window is blank, record whether 3D acceleration is enabled and capture the exact symptom. A VM graphics problem is distinct from an incompatible executable or Gatekeeper warning; do not assume changing permissions fixes it.
