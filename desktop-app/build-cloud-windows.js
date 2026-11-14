#!/usr/bin/env node
// Uses the official pinned Neutralino release. No custom runtime is required.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
if (process.platform !== 'win32') throw new Error('The cloud credential adapter currently supports Windows only.');
for (const [script, ...args] of [['setup-binaries.js'], ['prepare.js'], ['build-cloud-extension.js'], ['build-standalone.js', 'win_x64']]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {cwd:__dirname, stdio:'inherit', windowsHide:true});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const destination = path.join(__dirname, 'dist/markdown-viewer/extensions/cloud');
fs.mkdirSync(destination, {recursive:true});
fs.copyFileSync(path.join(__dirname,'extensions/cloud/markdown-cloud.exe'), path.join(destination,'markdown-cloud.exe'));
fs.copyFileSync(path.join(__dirname,'cloud-extension/vendor/LICENSE.json'), path.join(destination,'LICENSE.json'));
console.log('Keep the extensions directory alongside markdown-viewer-win_x64.exe when distributing this build.');
