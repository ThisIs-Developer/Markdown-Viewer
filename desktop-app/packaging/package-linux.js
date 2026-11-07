#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const appDir = path.resolve(__dirname, '..');
const config = require('../neutralino.config.json');
const architectures = { x64: 'amd64', arm64: 'arm64', armhf: 'armhf' };

function stagePackage(root, arch, binary, icon, version = config.version) {
  if (!architectures[arch]) throw new Error(`Unsupported Linux architecture: ${arch}`);
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid package version');
  const executable = path.join(root, 'usr/lib/markdown-viewer/markdown-viewer');
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.copyFileSync(binary, executable);
  fs.chmodSync(executable, 0o755);
  const files = {
    'usr/bin/markdown-viewer': '#!/bin/sh\nexec /usr/lib/markdown-viewer/markdown-viewer "$@"\n',
    'usr/share/applications/com.markdownviewer.desktop.desktop': `[Desktop Entry]\nType=Application\nName=Markdown Viewer\nComment=Edit and preview Markdown documents\nExec=markdown-viewer %F\nTryExec=markdown-viewer\nIcon=markdown-viewer\nTerminal=false\nCategories=Office;TextEditor;\nMimeType=text/markdown;text/x-markdown;\nStartupNotify=true\n`,
    'DEBIAN/control': `Package: markdown-viewer\nVersion: ${version.replace('-', '~')}\nSection: editors\nPriority: optional\nArchitecture: ${architectures[arch]}\nMaintainer: Markdown Viewer contributors <noreply@github.com>\nHomepage: https://github.com/ThisIs-Developer/Markdown-Viewer\nDepends: libc6 (>= 2.35), libstdc++6 (>= 12), libgcc-s1, libgtk-3-0 (>= 3.24) | libgtk-3-0t64, libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37, libayatana-appindicator3-1 | libappindicator3-1, libx11-6, libxcb1, libxrandr2, libpng16-16 | libpng16-16t64\nDescription: Markdown editor and viewer with a local document vault\n Includes offline preview resources and native file dialogs.\n`,
  };
  for (const [name, content] of Object.entries(files)) {
    const destination = path.join(root, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content, { mode: name.startsWith('usr/bin/') ? 0o755 : 0o644 });
  }
  const iconPath = path.join(root, 'usr/share/icons/hicolor/256x256/apps/markdown-viewer.png');
  fs.mkdirSync(path.dirname(iconPath), { recursive: true });
  fs.copyFileSync(icon, iconPath);
  fs.chmodSync(iconPath, 0o644);
  const licenses = path.join(root, 'usr/share/doc/markdown-viewer');
  fs.mkdirSync(licenses, { recursive: true });
  fs.copyFileSync(path.join(appDir, '../LICENSE'), path.join(licenses, 'copyright'));
  fs.copyFileSync(path.join(appDir, 'LICENSE'), path.join(licenses, 'neutralino-LICENSE'));
  // Build hosts may use umask 077. Installed apps must be readable by all users.
  function normalizePermissions(directory) {
    fs.chmodSync(directory, 0o755);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) normalizePermissions(file);
      else fs.chmodSync(file, file === executable || file === path.join(root, 'usr/bin/markdown-viewer') ? 0o755 : 0o644);
    }
  }
  normalizePermissions(root);
}

function main() {
  const output = path.join(appDir, 'dist/installers');
  fs.mkdirSync(output, { recursive: true });
  for (const arch of Object.keys(architectures)) {
    const root = fs.mkdtempSync(path.join(appDir, 'dist/.deb-'));
    try {
      stagePackage(root, arch, path.join(appDir, `dist/markdown-viewer/markdown-viewer-linux_${arch}`),
        path.join(appDir, 'resources/assets/icon.png'));
      execFileSync('dpkg-deb', ['--root-owner-group', '--build', root,
        path.join(output, `markdown-viewer-linux_${architectures[arch]}.deb`)], { stdio: 'inherit' });
      // Archive permissions survive browser download; raw HTTP executable modes do not.
      execFileSync('tar', ['-czf', path.join(output, `markdown-viewer-linux_${arch}.tar.gz`),
        '-C', path.join(appDir, 'dist/markdown-viewer'), `markdown-viewer-linux_${arch}`]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
}
if (require.main === module) main();
module.exports = { stagePackage };
