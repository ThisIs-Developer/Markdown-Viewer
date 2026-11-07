# Desktop installers for macOS 12 and newer, Windows and Linux

## macOS version support

The Mac packages target **macOS 12 Monterey and later**, including Ventura 13,
Sonoma 14, Sequoia 15 and Tahoe 26. Monterey is the minimum deployment target;
the app is not restricted to Monterey and has no configured upper-version limit.
Use the same architecture-matching DMG on newer macOS versions. Versions before
macOS 12 are outside this build's compatibility target.

CI launches the packaged app on Intel and Apple Silicon macOS 15 and the latest
available stable hosted image (currently macOS 26). The ARM and universal checks
also use `macos-latest` to follow GitHub's stable-image rollout; Intel currently
uses `macos-26-intel`. Keep the explicit Intel label current when GitHub retires
an image. macOS 12–14 require manual acceptance because hosted runners no longer
provide them. A minimum deployment target is not evidence that every OS version,
patch release or future release has been tested.

## Why v3.10.5 failed on macOS

The release workflow uploaded raw Mach-O binaries as extensionless HTTP downloads. A browser download does not preserve Unix execute permissions, and the files had no Finder-recognized `.app` bundle, `Info.plist`, or installation flow. Finder could therefore treat them as documents. `chmod` alone was not a complete fix: the pinned Neutralino 6.5.0 x64 and arm64 binaries both contain `LC_BUILD_VERSION minos 14.0`, and link ScreenCaptureKit unconditionally. Monterey cannot load that runtime. ARM64 also cannot run on an Intel/AMD VMware guest; use x64 there.

The source of the runtime is pinned to Neutralino 6.5.0 commit `d1b3a4050f2073f236e14c4746ee8aa7dbb9bfe5`. `build-macos-runtime.sh` compiles both CPU architectures with `CMAKE_OSX_DEPLOYMENT_TARGET=12.0`. This selects upstream's existing CoreGraphics snapshot fallback; the unused ScreenCaptureKit link is removed because the framework was only introduced in 12.3. The application does not allow the native snapshot API. No new native permissions are granted.

`verify-macos.py` rejects newer minimum versions and mandatory ScreenCaptureKit links in **every** Mach-O slice, both before and after resource embedding. This checks binary compatibility metadata; it does not substitute for running on Monterey.

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
- Regression tests rejecting the original macOS 14 load commands, including a bad universal slice.
- Runtime compilation and final Mach-O, plist, signature and DMG validation.
- On ARM and Intel Mac runners for macOS 15 and the latest stable hosted macOS: mount the actual DMG, copy the app, eject the image, launch through LaunchServices, import a Unicode Markdown filename, verify its bytes in the actual Documents vault, and reopen the app. The workflow logs `sw_vers` and CPU architecture to record the actual OS tested.
- On Ubuntu 22.04 and 24.04: install the actual `.deb` with `apt`, validate its desktop entry, and run the same native GUI/vault check under Xvfb.

GitHub-hosted runners do not provide macOS 12. Monterey UI acceptance must be performed on a physical Mac or the user's VM. CI also does not reproduce browser quarantine or an end user's Documents-permission prompt. The native smoke script refuses to run outside disposable GitHub Actions runners or against an existing vault.

## macOS/Ubuntu manual acceptance

1. Download the architecture-matching installer in the guest OS. For VMware on an Intel/AMD Windows host, choose `markdown-viewer-mac_x64.dmg`.
2. Install and open it using the platform instructions. On Mac, allow Documents access if prompted; approve only this app through Open Anyway for an ad-hoc test build. Record the exact macOS and Safari versions and install available OS/browser updates (for Monterey, prefer 12.7.6). Repeat on the macOS versions being qualified for release.
3. Create a document, type Markdown, check Split/Preview, save, and inspect `Documents/Markdown Viewer Vault/Workspace` for the `.md` file.
4. Quit and reopen. Verify content, tabs and settings persist. Replace the installed app with another build and check the same vault is reused.
5. Open/save through native dialogs, link an external Markdown file/folder, and test explicit Save and backup export. Test offline editing and bundled renderers, plus HTML/PNG/PDF exports. Network features still need a connection.
6. On Ubuntu, launch from the application menu as an ordinary user; no `chmod` or terminal launch should be needed after `.deb` installation.

If a VMware window is blank, record whether 3D acceleration is enabled and capture the exact symptom. A VM graphics problem is distinct from an incompatible executable or Gatekeeper warning; do not assume changing permissions fixes it.
