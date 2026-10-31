const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

async function action(page, row, name) {
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name, exact: true }).click();
}
async function setup(page) {
  await openApp(page);
  const secret = page.locator('[data-tree-id="workspace_secret"]');
  await action(page, secret, 'Set password');
  await page.locator('#secret-workspace-key').fill('secret-lock-regression');
  await page.locator('#secret-workspace-key-confirm').fill('secret-lock-regression');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  await action(page, secret, 'New file');
  await setEditorContent(page, '# Keep this encrypted document');
  await page.evaluate(() => MarkdownViewerFlushWorkspace());
  return secret;
}

test('a flush queued during Secret lock cannot replace real IndexedDB records with an empty workspace', async ({ page }) => {
  const secret = await setup(page);
  const before = await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.listSecretRecords()).map(record => record.id).sort();
  });
  await page.evaluate(() => {
    const original = MarkdownWorkspaceStorage.prototype.applySecretRecordChanges;
    let hold = true;
    MarkdownWorkspaceStorage.prototype.applySecretRecordChanges = async function(...args) {
      if (hold) {
        hold = false;
        window.__secretWriteHeld = true;
        await new Promise(resolve => { window.__releaseSecretWrite = resolve; });
      }
      return original.apply(this, args);
    };
  });
  await action(page, secret, 'Lock workspace');
  await page.waitForFunction(() => window.__secretWriteHeld);
  await expect(page.locator('.app-container')).toHaveJSProperty('inert', true);
  await page.evaluate(() => { window.__queuedFlush = MarkdownViewerFlushWorkspace(); });
  // Let the normal-document flush finish and enqueue its Secret save.
  await expect.poll(() => page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    return !!window.__queuedFlush;
  })).toBe(true);
  await page.evaluate(() => { window.__releaseSecretWrite(); });
  await page.evaluate(() => window.__queuedFlush);
  await expect(page.locator('.app-container')).toHaveJSProperty('inert', false);
  const after = await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.listSecretRecords()).map(record => record.id).sort();
  });
  expect(after).toEqual(before);
  await action(page, secret, 'Unlock workspace');
  await page.locator('#secret-workspace-key').fill('secret-lock-regression');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  await expect(secret).toHaveAttribute('aria-expanded', 'true');
  const id = before.find(value => value !== '__folders__');
  await action(page, page.locator(`[data-document-id="${id}"]`), 'Open');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Keep this encrypted document');
});

test('failed encrypted storage leaves Secret documents open and the UI usable', async ({ page }) => {
  const secret = await setup(page);
  await page.evaluate(() => {
    MarkdownWorkspaceStorage.prototype.applySecretRecordChanges = async () => { throw new Error('Injected storage failure'); };
  });
  await action(page, secret, 'Lock workspace');
  await expect(page.locator('#app-toast-region')).toContainText('could not be locked');
  await expect(page.locator('.app-container')).toHaveJSProperty('inert', false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Keep this encrypted document');
});
