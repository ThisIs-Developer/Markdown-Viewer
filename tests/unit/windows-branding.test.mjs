import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../desktop-app/package.json', import.meta.url));
const { brandExecutable } = require('./experimental/windows/brand-executable.js');

test('Windows packaging sets app/version metadata and preserves resources', async t => {
  let pe, resedit;
  try { pe = require.resolve('pe-library'); resedit = require.resolve('resedit'); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    t.skip('Install desktop packaging dependencies with npm ci --prefix desktop-app');
    return;
  }
  const { NtExecutable, NtExecutableResource } = await import(pathToFileURL(pe));
  const { Resource, Data } = await import(pathToFileURL(resedit));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-branding-'));
  const file = path.join(directory, 'Markdown-Viewer.exe');
  try {
    const binary = NtExecutable.createEmpty(false, false);
    const resources = NtExecutableResource.from(binary);
    const version = Resource.VersionInfo.create(1033, {}, [{ lang: 1033, codepage: 1200, values: { FileDescription: 'A Neutralinojs application' } }]);
    version.outputToResourceEntries(resources.entries);
    const png = fs.readFileSync(new URL('../../assets/icon.png', import.meta.url));
    const icon = Data.RawIconItem.from(png, 256, 256, 32);
    Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 1, 1033, [icon]);
    const originalIcon = Buffer.from(resources.entries.find(entry => entry.type === 14).bin);
    resources.entries.push({ type: 10, id: 99, lang: 1033, codepage: 0, bin: Uint8Array.from([1, 2, 3, 4]).buffer });
    resources.outputResource(binary);
    fs.writeFileSync(file, Buffer.from(binary.generate()));
    await brandExecutable(file);
    const entries = NtExecutableResource.from(NtExecutable.from(fs.readFileSync(file))).entries;
    const values = Resource.VersionInfo.fromEntries(entries)[0].getStringValues({ lang: 1033, codepage: 1200 });
    assert.equal(values.ProductName, 'Markdown Viewer');
    assert.equal(values.FileDescription, 'Markdown Viewer');
    assert.equal(values.OriginalFilename, 'Markdown-Viewer.exe');
    assert.equal(values.FileVersion, '3.10.5.0');
    assert.deepEqual(Buffer.from(entries.find(entry => entry.type === 14 && entry.id === 1).bin), originalIcon);
    assert.deepEqual([...new Uint8Array(entries.find(entry => entry.type === 10).bin)], [1, 2, 3, 4]);
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
});
