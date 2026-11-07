import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { stagePackage } = require('../../desktop-app/packaging/package-linux.js');
const { writeManifest } = require('../../desktop-app/packaging/release-manifest.js');

function releaseFiles(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-release-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const names = [
    'markdown-viewer-win_x64.exe', 'MACOS-SIGNING.txt', 'README.md',
    'markdown-viewer-mac_x64.dmg', 'markdown-viewer-mac_arm64.dmg', 'markdown-viewer-mac_universal.dmg',
    'markdown-viewer-linux_amd64.deb', 'markdown-viewer-linux_arm64.deb', 'markdown-viewer-linux_armhf.deb',
    'markdown-viewer-linux_x64.tar.gz', 'markdown-viewer-linux_arm64.tar.gz', 'markdown-viewer-linux_armhf.tar.gz',
  ];
  for (const name of names) fs.writeFileSync(path.join(directory, name), `Packaged bytes for ${name}\n`);
  return directory;
}

test('release assembly rejects incomplete, unexpected, empty and non-file downloads', t => {
  const directory = releaseFiles(t);
  const installer = path.join(directory, 'markdown-viewer-mac_x64.dmg');
  const contents = fs.readFileSync(installer);
  fs.unlinkSync(installer);
  assert.throws(() => writeManifest(directory), /Unexpected release assets/);
  fs.writeFileSync(installer, contents);
  const unexpected = path.join(directory, 'markdown-viewer-mac_x64');
  fs.writeFileSync(unexpected, 'unpackaged binary');
  assert.throws(() => writeManifest(directory), /Unexpected release assets/);
  fs.unlinkSync(unexpected);
  fs.writeFileSync(installer, '');
  assert.throws(() => writeManifest(directory), /non-empty regular file/);
  fs.unlinkSync(installer);
  fs.mkdirSync(installer);
  assert.throws(() => writeManifest(directory), /non-empty regular file/);
  assert.equal(fs.existsSync(path.join(directory, 'SHA256SUMS.txt')), false);
});

test('assembled checksums verify with the system tool and detect changed installer bytes', t => {
  const directory = releaseFiles(t);
  writeManifest(directory);
  const first = fs.readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8');
  assert.equal(first.trim().split('\n').length, 12);
  writeManifest(directory);
  assert.equal(fs.readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8'), first);
  if (process.platform === 'linux') {
    execFileSync('sha256sum', ['--check', '--status', 'SHA256SUMS.txt'], { cwd: directory });
    fs.appendFileSync(path.join(directory, 'markdown-viewer-linux_amd64.deb'), 'changed');
    assert.throws(() => execFileSync('sha256sum', ['--check', '--status', 'SHA256SUMS.txt'], { cwd: directory }));
  }
});

test('recommended download keeps all CPU installers and excludes optional portable archives', t => {
  const directory = releaseFiles(t);
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.tar.gz'))) {
    fs.unlinkSync(path.join(directory, name));
  }
  writeManifest(directory, { installersOnly: true });
  const manifest = fs.readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8');
  assert.equal(manifest.trim().split('\n').length, 9);
  assert.doesNotMatch(manifest, /\.tar\.gz/);
  for (const arch of ['amd64', 'arm64', 'armhf']) assert.match(manifest, new RegExp(`linux_${arch}\\.deb`));
  assert.throws(() => writeManifest(directory), /Unexpected release assets/);
});

test('Debian packages preserve launcher permissions, desktop integration and runtime dependencies', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-package-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const binary = path.join(temp, 'input');
  const icon = new URL('../../assets/icon.png', import.meta.url);
  fs.writeFileSync(binary, 'binary fixture', { mode: 0o644 });
  for (const [arch, expected] of Object.entries({ x64: 'amd64', arm64: 'arm64', armhf: 'armhf' })) {
    const root = path.join(temp, arch);
    stagePackage(root, arch, binary, icon, '3.10.5-test.1');
    const control = fs.readFileSync(path.join(root, 'DEBIAN/control'), 'utf8');
    assert.match(control, new RegExp(`Architecture: ${expected}\\n`));
    assert.match(control, /Version: 3\.10\.5~test\.1/);
    assert.match(control, /libwebkit2gtk-4\.1-0 \| libwebkit2gtk-4\.0-37/);
    assert.match(control, /libayatana-appindicator3-1 \| libappindicator3-1/);
    assert.match(control, /Maintainer: Baivab Sarkar <109382325\+ThisIs-Developer@users.noreply.github.com>/);
    assert.match(control, /Publisher: ThisIs-Developer\n License: Apache-2\.0/);
    assert.match(control, /Homepage: https:\/\/markdownviewer\.pages\.dev\//);
    assert.match(control, /Installed-Size: [1-9][0-9]*\n/);
    const desktop = fs.readFileSync(path.join(root, 'usr/share/applications/com.markdownviewer.desktop.desktop'), 'utf8');
    assert.match(desktop, /Exec=markdown-viewer %F/);
    assert.match(desktop, /Terminal=false/);
    assert.equal(fs.readFileSync(path.join(root, 'usr/lib/markdown-viewer/markdown-viewer'), 'utf8'), 'binary fixture');
    if (process.platform !== 'win32') {
      for (const file of ['usr/bin/markdown-viewer', 'usr/lib/markdown-viewer/markdown-viewer']) {
        assert.equal(fs.statSync(path.join(root, file)).mode & 0o777, 0o755);
      }
    }
    if (process.platform === 'linux') {
      const deb = path.join(temp, `${arch}.deb`);
      execFileSync('dpkg-deb', ['--root-owner-group', '--build', root, deb]);
      assert.equal(execFileSync('dpkg-deb', ['--field', deb, 'Architecture'], { encoding: 'utf8' }).trim(), expected);
      const extracted = path.join(temp, `${arch}-extracted`);
      execFileSync('dpkg-deb', ['--extract', deb, extracted]);
      assert.equal(fs.statSync(path.join(extracted, 'usr/lib/markdown-viewer/markdown-viewer')).mode & 0o777, 0o755);
      for (const location of ['usr/share/icons/hicolor/256x256/apps', 'usr/share/pixmaps']) {
        assert.deepEqual(fs.readFileSync(path.join(extracted, location, 'markdown-viewer.png')), fs.readFileSync(icon));
      }
      const metainfo = path.join(extracted, 'usr/share/metainfo/com.markdownviewer.desktop.metainfo.xml');
      // Parse the extracted XML with an independent parser; verify desktop/icon links resolve.
      execFileSync('python3', ['-c', `
import pathlib, sys, xml.etree.ElementTree as ET
root = pathlib.Path(sys.argv[1])
component = ET.parse(sys.argv[2]).getroot()
assert component.attrib['type'] == 'desktop-application'
assert component.findtext('id') == 'com.markdownviewer.desktop'
assert component.findtext('name') == 'Markdown Viewer'
assert component.findtext('developer_name') == 'ThisIs-Developer'
assert component.findtext('project_license') == 'Apache-2.0'
assert component.findtext('pkgname') == 'markdown-viewer'
desktop = root / 'usr/share/applications' / component.findtext('launchable')
assert desktop.is_file()
icon = component.findtext('icon')
assert 'Icon=' + icon in desktop.read_text()
assert (root / 'usr/share/icons/hicolor/256x256/apps' / (icon + '.png')).is_file()
assert component.find('releases/release').attrib['version'] == '3.10.5-test.1'
`, extracted, metainfo]);
    }
  }
  assert.throws(() => stagePackage(path.join(temp, 'invalid'), 'mips', binary, binary), /Unsupported/);
});
