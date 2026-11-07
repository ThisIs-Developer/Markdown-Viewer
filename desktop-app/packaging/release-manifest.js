#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = path.resolve(process.argv[2]);
const expected = [
  'markdown-viewer-win_x64.exe', 'MACOS-SIGNING.txt',
  ...['x64', 'arm64', 'universal'].map(arch => `markdown-viewer-mac_${arch}.dmg`),
  ...['amd64', 'arm64', 'armhf'].map(arch => `markdown-viewer-linux_${arch}.deb`),
  ...['x64', 'arm64', 'armhf'].map(arch => `markdown-viewer-linux_${arch}.tar.gz`),
].sort();
const actual = fs.readdirSync(directory).filter(name => name !== 'SHA256SUMS.txt').sort();
if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Unexpected release assets: ${actual.join(', ')}`);
fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), expected.map(name => {
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex');
  return `${digest}  ${name}\n`;
}).join(''));
