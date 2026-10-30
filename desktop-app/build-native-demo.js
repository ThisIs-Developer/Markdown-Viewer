#!/usr/bin/env node
// Package only the reviewed Windows runtime, in a staging directory. Standard
// release configuration, downloaded binaries and the user's Vault stay separate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');

const appDir = __dirname;
const root = path.resolve(appDir, '..');
const runtimeCommit = '3c307cba7c6de5eb10db614ae8daad99bf44e51d';
const runtimeSource = path.resolve(process.argv[2] || path.join(appDir, '.native-runtime'));
const runtime = path.join(runtimeSource, 'bin/neutralino-win_x64.exe');
const patch = path.join(appDir, 'experimental/native-drop-windows.patch');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && command === 'npx' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Build the native demo on Windows.');
  if (!fs.existsSync(runtime)) throw new Error(`Compile the reviewed runtime first: ${runtime}`);
  if (git(runtimeSource, 'rev-parse', 'HEAD') !== runtimeCommit) throw new Error('Unexpected runtime source revision.');
  // Require the reviewed Windows WebView and event-bridge patch, excluding
  // unrelated upstream authentication, server and other-platform experiments.
  execFileSync('git', ['apply', '--reverse', '--check', patch], { cwd: runtimeSource, stdio: 'inherit' });
  if (git(runtimeSource, 'diff', '--name-only', 'HEAD') !== 'api/fs/fs.cpp\napi/window/window.cpp\nlib/webview/webview.h') throw new Error('Unexpected runtime source changes.');
  const appCommit = git(root, 'rev-parse', 'HEAD');
  fs.mkdirSync(path.join(appDir, '.tmp'), { recursive: true });
  const stage = fs.mkdtempSync(path.join(appDir, '.tmp/native-demo-'));
  const outputDir = path.join(appDir, 'dist/native-demo');
  fs.mkdirSync(outputDir, { recursive: true });
  try {
    run(process.execPath, ['prepare.js', '--experimental-neutralino-runtime'], appDir);
    fs.cpSync(path.join(appDir, 'resources'), path.join(stage, 'resources'), { recursive: true });
    const config = JSON.parse(fs.readFileSync(path.join(appDir, 'neutralino.experimental.config.json'), 'utf8'));
    config.applicationId = 'com.markdownviewer.desktop.native-demo';
    config.applicationName = 'Markdown Viewer';
    config.description = 'Markdown Viewer';
    config.author = 'Markdown Viewer contributors';
    config.modes.window.title = 'Markdown Viewer';
    config.cli.binaryName = 'markdown-viewer-native-demo';
    config.cli.binaryVersion = '6.10.0';
    config.cli.distributionPath = 'dist';
    fs.writeFileSync(path.join(stage, 'neutralino.config.json'), JSON.stringify(config, null, 2) + '\n');
    fs.writeFileSync(path.join(stage, 'resources/js/desktop-runtime-features.js'),
      'window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES = Object.freeze(' + JSON.stringify({
        sidebarPointerDrag: true, nativeSingleInstance: true, nativeFileDrop: true, isolatedVault: true
      }) + ');\n');
    fs.mkdirSync(path.join(stage, 'bin'));
    fs.copyFileSync(runtime, path.join(stage, 'bin/neutralino-win_x64.exe'));
    run('npx', ['-y', '@neutralinojs/neu@11.7.0', 'build', '--embed-resources', '--clean'], stage);
    const name = `Markdown-Viewer-PR269-${appCommit.slice(0, 8)}-win_x64.exe`;
    const output = path.join(outputDir, name);
    fs.copyFileSync(path.join(stage, 'dist/markdown-viewer-native-demo/markdown-viewer-native-demo-win_x64.exe'), output);
    await require('./experimental/windows/brand-executable').brandExecutable(output);
    const helperName = 'MarkdownViewer-WindowsIntegration.exe';
    const helper = require('./experimental/windows/build-integration').buildWindowsIntegration(path.join(outputDir, helperName));
    const manifest = {
      applicationCommit: appCommit, applicationId: config.applicationId,
      vault: 'Markdown Viewer Native Demo Vault',
      runtimeRepository: 'https://github.com/Kechos23/neutralinojs', runtimeCommit,
      runtimeVersion: config.cli.binaryVersion, clientVersion: config.cli.clientVersion,
      windowsDropPatchSha256: hash(patch), runtimeSha256: hash(runtime),
      executable: name, executableSha256: hash(output),
      integrationHelper: helperName, integrationHelperSha256: hash(helper)
    };
    fs.writeFileSync(path.join(outputDir, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(outputDir, 'SHA256SUMS'), `${manifest.executableSha256}  ${name}\n${manifest.integrationHelperSha256}  ${helperName}\n`);
    console.log(`Native demo: ${output}`);
  } finally {
    run(process.execPath, ['prepare.js'], appDir);
    // Never recursively remove a caller-provided path.
    const tempRoot = path.resolve(appDir, '.tmp') + path.sep;
    if (!path.resolve(stage).startsWith(tempRoot)) throw new Error('Invalid staging path');
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
