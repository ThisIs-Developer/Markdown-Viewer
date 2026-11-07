import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { stagePackage } = require('../../desktop-app/packaging/package-linux.js');

test('Debian packages preserve launcher permissions, desktop integration and runtime dependencies', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-package-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const binary = path.join(temp, 'input');
  fs.writeFileSync(binary, 'binary fixture', { mode: 0o644 });
  for (const [arch, expected] of Object.entries({ x64: 'amd64', arm64: 'arm64', armhf: 'armhf' })) {
    const root = path.join(temp, arch);
    stagePackage(root, arch, binary, binary, '3.10.5-test.1');
    const control = fs.readFileSync(path.join(root, 'DEBIAN/control'), 'utf8');
    assert.match(control, new RegExp(`Architecture: ${expected}\\n`));
    assert.match(control, /Version: 3\.10\.5~test\.1/);
    assert.match(control, /libwebkit2gtk-4\.1-0 \| libwebkit2gtk-4\.0-37/);
    assert.match(control, /libayatana-appindicator3-1 \| libappindicator3-1/);
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
    }
  }
  assert.throws(() => stagePackage(path.join(temp, 'invalid'), 'mips', binary, binary), /Unsupported/);
});
