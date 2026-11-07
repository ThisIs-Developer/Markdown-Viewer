#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const expected = [
  'markdown-viewer-win_x64.exe', 'MACOS-SIGNING.txt', 'README.md',
  ...['x64', 'arm64', 'universal'].map(arch => `markdown-viewer-mac_${arch}.dmg`),
  ...['amd64', 'arm64', 'armhf'].map(arch => `markdown-viewer-linux_${arch}.deb`),
  ...['x64', 'arm64', 'armhf'].map(arch => `markdown-viewer-linux_${arch}.tar.gz`),
].sort();
function writeManifest(directory) {
  const actual = fs.readdirSync(directory).filter(name => name !== 'SHA256SUMS.txt').sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Unexpected release assets: ${actual.join(', ')}`);
  const checksums = expected.map(name => {
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || !stat.size) throw new Error(`Release asset must be a non-empty regular file: ${name}`);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    return `${digest}  ${name}\n`;
  }).join('');
  fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), checksums);
}

if (require.main === module) {
  if (process.argv.length !== 3) throw new Error('Usage: release-manifest.js <installer-directory>');
  writeManifest(path.resolve(process.argv[2]));
}
module.exports = { writeManifest };
