const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function setup(page, secondary) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/save.md', '# baseline');
    await window.NL_IMPORT_EXTERNAL_FILE('# baseline', 'save', 'C:/Original/save.md');
    await window.MarkdownViewerFlushWorkspace();
  });
  if (secondary) {
    const linkedId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
    await page.locator('#tab-new-btn').click();
    await page.locator('#markdown-editor').fill('# unrelated primary');
    await page.locator('#tab-list .tab-item.active').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Open in split view', exact: true }).click();
    await page.locator('#document-split-destination').selectOption(linkedId);
    await page.locator('#document-split-modal-confirm').click();
  }
  return page.locator(secondary ? '#document-split-editor' : '#markdown-editor');
}

for (const secondary of [false, true]) for (const phase of ['write', 'verify', 'hash']) {
  test(`${secondary ? 'secondary' : 'primary'} linked Save keeps edits made during ${phase}`, async ({ page }) => {
    const editor = await setup(page, secondary);
    await editor.fill('# requested snapshot');
    await page.evaluate(phase => {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      window.__releaseLinkedSave = release;
      const fs = Neutralino.filesystem;
      const write = fs.writeFile;
      const read = fs.readFile;
      let wrote = false;
      fs.writeFile = async (path, content) => {
        if (path === 'C:/Original/save.md') {
          if (phase === 'write') { window.__linkedSavePending = true; await gate; }
          wrote = true;
        }
        return write(path, content);
      };
      fs.readFile = async path => {
        if (path === 'C:/Original/save.md' && wrote && phase === 'verify') {
          window.__linkedSavePending = true;
          await gate;
        }
        return read(path);
      };
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest = async (algorithm, bytes) => {
        if (phase === 'hash' && wrote && new TextDecoder().decode(bytes) === '# requested snapshot') {
          window.__linkedSavePending = true;
          await gate;
        }
        return digest(algorithm, bytes);
      };
    }, phase);
    // Physical KeyS also covers a Greek keyboard layout in both panes.
    await editor.dispatchEvent('keydown', { key: 'σ', code: 'KeyS', ctrlKey: true });
    await page.waitForFunction(() => window.__linkedSavePending === true);
    await editor.fill('# newer live draft');
    await page.evaluate(() => window.__releaseLinkedSave());
    await expect(page.locator('.app-toast').filter({ hasText: 'Newer edits remain in your draft' })).toBeVisible();
    await expect(editor).toHaveValue('# newer live draft');
    expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/save.md'))).toBe('# requested snapshot');
    await page.evaluate(() => window.MarkdownViewerFlushWorkspace());
    expect(await page.evaluate(async () => {
      const storage = new window.MarkdownWorkspaceStorage();
      await storage.init();
      const record = (await storage.listDocumentMetadata()).find(item => item.sourcePath === 'C:/Original/save.md');
      return storage.loadDocumentContent(record.id);
    })).toBe('# newer live draft');
    if (secondary) await expect(page.locator('#markdown-editor')).toHaveValue('# unrelated primary');
    await editor.dispatchEvent('keydown', { key: 'σ', code: 'KeyS', ctrlKey: true });
    await expect.poll(() => page.evaluate(() => window.__desktopFiles.get('C:/Original/save.md'))).toBe('# newer live draft');
    await expect(page.getByRole('alertdialog', { name: 'Overwrite original file?', exact: true })).toHaveCount(0);
  });
}

test('switching tabs while Save is pending cannot replace the new active editor or the saved draft', async ({ page }) => {
  const editor = await setup(page, false);
  await editor.fill('# requested snapshot');
  await page.evaluate(() => {
    const write = Neutralino.filesystem.writeFile;
    Neutralino.filesystem.writeFile = async (path, content) => {
      if (path === 'C:/Original/save.md') {
        window.__linkedSavePending = true;
        await new Promise(resolve => { window.__releaseLinkedSave = resolve; });
      }
      return write(path, content);
    };
  });
  await editor.press('Control+s');
  await page.waitForFunction(() => window.__linkedSavePending === true);
  await editor.fill('# newer inactive draft');
  await page.locator('#tab-new-btn').click();
  await editor.fill('# other active document');
  await page.evaluate(() => window.__releaseLinkedSave());
  await expect(page.locator('.app-toast').filter({ hasText: 'Newer edits remain in your draft' })).toBeVisible();
  await expect(editor).toHaveValue('# other active document');
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^save/ }).locator('.document-tree-main').click();
  await expect(editor).toHaveValue('# newer inactive draft');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/save.md'))).toBe('# requested snapshot');
});
