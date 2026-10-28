const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function buildWindowsIntegration(output) {
  const root = path.resolve(__dirname, '../../..');
  const compiler = path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const args = ['/nologo', '/target:winexe', '/utf8output', '/out:' + output,
    '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll'];
  for (const entry of fs.readdirSync(path.join(root, 'assets/i18n')).filter(x => x.endsWith('.json'))) {
    args.push('/resource:' + path.join(root, 'assets/i18n', entry) + ',locale.' + entry);
  }
  args.push(path.join(__dirname, 'WindowsIntegration.cs'));
  const result = spawnSync(compiler, args, {encoding:'utf8', windowsHide:true});
  if(result.error || result.status !== 0) throw new Error(result.error || result.stdout + result.stderr);
  return output;
}
module.exports = { buildWindowsIntegration };
