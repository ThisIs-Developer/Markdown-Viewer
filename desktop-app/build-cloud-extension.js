// Build the standalone Windows adapter; no Neutralino source checkout is required.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
if(process.platform !== 'win32') throw new Error('The current credential adapter targets Windows.');
const root=__dirname;
const result=spawnSync('cmd.exe',['/d','/c',path.join(root,'cloud-extension/build-windows.cmd')],{stdio:'inherit',windowsHide:true});
if(result.status!==0)throw new Error('Cloud extension build failed.');
const binary=path.join(root,'cloud-extension/build/markdown-cloud.exe');
fs.mkdirSync(path.join(root,'extensions/cloud'),{recursive:true});
fs.copyFileSync(binary,path.join(root,'extensions/cloud/markdown-cloud.exe'));
console.log('Cloud extension built and copied to extensions/cloud.');
