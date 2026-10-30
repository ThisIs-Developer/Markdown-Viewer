// Focused acceptance against the actual isolated Windows trial executable.
// Usage: node tests/native/explorer-rename.cjs <PR269-executable.exe>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');
const executable = path.resolve(process.argv[2] || '');
assert.match(path.basename(executable), /^Markdown-Viewer-PR269-[a-f0-9]+-win_x64\.exe$/);
const output = path.dirname(executable);
const directory = fs.mkdtempSync(path.join(output, 'rename-fixtures-'));
const source = path.join(directory, 'original δοκιμή & %.md');
const renamed = path.join(directory, 'Renamed 日本 & #.markdown');
const occupied = path.join(directory, 'occupied.md');
fs.writeFileSync(source, '# original body');
fs.writeFileSync(occupied, '# unrelated body');
const result = { executable, directory, checks: [] };
const check = name => { result.checks.push(name); console.log('PASS ' + name); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let child, browser, page;
(async () => {
  try {
    let occupiedPort = false;
    try { await fetch('http://127.0.0.1:9389/json/version'); occupiedPort = true; } catch {}
    if (occupiedPort) throw new Error('Close the previous debug trial before testing.');
    child = spawn(executable, [source], { cwd: directory, windowsHide: true, stdio: 'ignore',
      env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9389' } });
    for (let index = 0; index < 120; index++) {
      if (child.exitCode !== null) throw new Error('Trial exited before startup: ' + child.exitCode);
      try { if ((await fetch('http://127.0.0.1:9389/json/version')).ok) break; } catch {}
      await delay(250);
    }
    browser = await chromium.connectOverCDP('http://127.0.0.1:9389');
    // The debugging endpoint can be ready before WebView2 creates its page.
    // Wait for the actual application target, not just the browser connection.
    for (let index = 0; index < 120; index++) {
      page = browser.contexts().flatMap(context => context.pages()).find(candidate => /^http:\/\/(127\.0\.0\.1|localhost):/.test(candidate.url()));
      if (page) break;
      if (child.exitCode !== null) throw new Error('Trial exited while creating its WebView: ' + child.exitCode);
      await delay(250);
    }
    assert.ok(page, 'The native application WebView becomes available');
    page.setDefaultTimeout(60000);
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    assert.equal(await page.evaluate(() => MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES.isolatedVault), true);
    await expect(page.locator('#markdown-editor')).toHaveValue('# original body');
    const id = await page.locator('.tab-item.active').getAttribute('data-tab-id');
    const row = page.locator(`[data-document-id="${id}"]`);
    await page.locator('#markdown-editor').fill('# unsaved draft');
    await row.focus(); await row.press('F2');
    const input = page.locator('.document-tree-rename-input');
    await expect(input).toBeFocused();
    await page.screenshot({ path: path.join(output, 'inline-rename.png') });
    await input.fill(path.basename(renamed)); await input.press('Enter');
    await expect(row).toHaveAttribute('title', renamed.replaceAll('\\', '/'));
    assert.equal(fs.existsSync(source), false);
    assert.equal(fs.readFileSync(renamed, 'utf8'), '# original body');
    await expect(page.locator('#markdown-editor')).toHaveValue('# unsaved draft');
    check('Real Unicode filename renamed inline; original bytes and unsaved draft preserved');
    await page.locator('#markdown-editor').focus(); await page.keyboard.press('Control+s');
    await expect.poll(() => fs.readFileSync(renamed, 'utf8')).toBe('# unsaved draft');
    check('Ctrl+S updates the renamed original');
    await row.focus(); await row.press('F2');
    await input.fill('renamed 日本 & #.markdown'); await input.press('Enter');
    const casePath = path.join(directory, 'renamed 日本 & #.markdown');
    await expect(row).toHaveAttribute('title', casePath.replaceAll('\\', '/'));
    assert.ok(fs.readdirSync(directory).includes(path.basename(casePath)));
    check('Case-only rename succeeds on the real Windows filesystem');
    const collision = await page.evaluate(async ({ source, target }) => {
      try { await Neutralino.filesystem.move(source, target); return null; }
      catch (error) { return error.code; }
    }, { source: casePath, target: occupied });
    assert.equal(collision, 'NE_FS_MOVEERR');
    assert.equal(fs.readFileSync(casePath, 'utf8'), '# unsaved draft');
    assert.equal(fs.readFileSync(occupied, 'utf8'), '# unrelated body');
    check('Native rename atomically rejects replacement, preserving both files');
    await page.evaluate(() => MarkdownViewerFlushWorkspace());
    const metadata = await page.evaluate(async id => {
      const storage = new MarkdownWorkspaceStorage(); await storage.init();
      return (await storage.listDocumentMetadata()).find(item => item.id === id);
    }, id);
    assert.equal(metadata.sourcePath, casePath.replaceAll('\\', '/'));
    check('Updated linked path persists in the isolated Vault');
    result.success = true;
  } catch (error) {
    result.success = false; result.error = error.stack;
    console.error(error); process.exitCode = 1;
    if (page) await page.screenshot({ path: path.join(output, 'rename-failure.png') }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(output, 'native-rename-results.json'), JSON.stringify(result, null, 2));
    if (page) await page.evaluate(async () => { await MarkdownViewerFlushWorkspace(); await Neutralino.app.exit(); }).catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (child && child.exitCode === null) {
      for (let index = 0; index < 20 && child.exitCode === null; index++) await delay(100);
      if (child.exitCode === null) child.kill();
    }
  }
})();
