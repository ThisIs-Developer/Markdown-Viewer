#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const appDir = path.resolve(__dirname, '..');
const config = require('../neutralino.config.json');
const metadata = require('./metadata.json');
const architectures = { x64: 'amd64', arm64: 'arm64', armhf: 'armhf' };
// Distinguish the corrected package from the earlier revision-less DEBs.
const packageRevision = 1;

function xml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function appStream(version) {
  const notes = fs.readFileSync(path.join(appDir, '../RELEASE_NOTES'), 'utf8');
  const released = notes.match(/_Released ([A-Za-z]+ \d{1,2}, \d{4})_/);
  if (!released || !Number.isFinite(Date.parse(released[1] + ' UTC'))) throw new Error('RELEASE_NOTES must declare the release date');
  const date = new Date(released[1] + ' UTC').toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${xml(config.applicationId)}</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>${xml(metadata.license)}</project_license>
  <name>${xml(metadata.name)}</name>
  <summary>${xml(metadata.summary)}</summary>
  <developer_name>${xml(metadata.developer)}</developer_name>
  <description>
${metadata.description.map(paragraph => `    <p>${xml(paragraph)}</p>`).join('\n')}
  </description>
  <launchable type="desktop-id">${xml(config.applicationId)}.desktop</launchable>
  <pkgname>markdown-viewer</pkgname>
  <icon type="stock">markdown-viewer</icon>
  <categories><category>Office</category><category>TextEditor</category></categories>
  <keywords><keyword>Markdown</keyword><keyword>Editor</keyword><keyword>Preview</keyword><keyword>Notes</keyword></keywords>
  <url type="homepage">${xml(metadata.homepage)}</url>
  <url type="bugtracker">${xml(metadata.repository)}/issues</url>
  <url type="help">${xml(metadata.repository)}/blob/main/wiki/Desktop-App.md</url>
  <url type="vcs-browser">${xml(metadata.repository)}</url>
  <provides><binary>markdown-viewer</binary><mediatype>text/markdown</mediatype><mediatype>text/x-markdown</mediatype></provides>
  <releases><release version="${xml(version)}" date="${date}"/></releases>
</component>
`;
}

function installedSize(directory) {
  let kibibytes = 1;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'DEBIAN') continue;
    const file = path.join(directory, entry.name);
    kibibytes += entry.isDirectory() ? installedSize(file) : Math.ceil(fs.statSync(file).size / 1024);
  }
  return kibibytes;
}

function stagePackage(root, arch, binary, icon, version = config.version) {
  if (!architectures[arch]) throw new Error(`Unsupported Linux architecture: ${arch}`);
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid package version');
  const executable = path.join(root, 'usr/lib/markdown-viewer/markdown-viewer');
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.copyFileSync(binary, executable);
  fs.chmodSync(executable, 0o755);
  const files = {
    'usr/bin/markdown-viewer': '#!/bin/sh\nexec /usr/lib/markdown-viewer/markdown-viewer "$@"\n',
    [`usr/share/applications/${config.applicationId}.desktop`]: `[Desktop Entry]\nVersion=1.0\nType=Application\nName=${metadata.name}\nGenericName=Markdown Editor\nComment=${metadata.summary}\nExec=markdown-viewer %F\nTryExec=markdown-viewer\nIcon=markdown-viewer\nTerminal=false\nCategories=Office;TextEditor;\nKeywords=Markdown;Editor;Preview;Notes;Documents;\nMimeType=text/markdown;text/x-markdown;\nStartupNotify=true\n`,
    [`usr/share/metainfo/${config.applicationId}.metainfo.xml`]: appStream(version),
    'DEBIAN/control': `Package: markdown-viewer\nVersion: ${version.replace('-', '~')}-${packageRevision}\nSection: editors\nPriority: optional\nArchitecture: ${architectures[arch]}\nMaintainer: ${metadata.maintainer}\nHomepage: ${metadata.homepage}\nDepends: libc6 (>= 2.35), libstdc++6 (>= 12), libgcc-s1, libgtk-3-0 (>= 3.24) | libgtk-3-0t64, libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37, libayatana-appindicator3-1 | libappindicator3-1, libx11-6, libxcb1, libxrandr2, libpng16-16 | libpng16-16t64\nDescription: ${metadata.name} - ${metadata.summary}\n ${metadata.description.join('\n .\n ')}\n .\n Publisher: ${metadata.developer}\n License: ${metadata.license}\n Website: ${metadata.homepage}\n Support: ${metadata.repository}/issues\n`,
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
  const pixmap = path.join(root, 'usr/share/pixmaps/markdown-viewer.png');
  fs.mkdirSync(path.dirname(pixmap), { recursive: true });
  fs.copyFileSync(icon, pixmap);
  const licenses = path.join(root, 'usr/share/doc/markdown-viewer');
  fs.mkdirSync(licenses, { recursive: true });
  fs.copyFileSync(path.join(appDir, '../LICENSE'), path.join(licenses, 'copyright'));
  fs.copyFileSync(path.join(appDir, 'LICENSE'), path.join(licenses, 'neutralino-LICENSE'));
  fs.appendFileSync(path.join(root, 'DEBIAN/control'), `Installed-Size: ${installedSize(root)}\n`);
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
