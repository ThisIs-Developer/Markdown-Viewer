const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function action(page, row, name) {
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name, exact: true }).click();
}
async function setup(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS="Windows";');
  await page.addInitScript(() => {
    const snapshot = sessionStorage.getItem('rename-test-files');
    if (!snapshot) return;
    for (const [path, body] of JSON.parse(snapshot)) {
      const parts = path.split('/');
      for (let end = 2; end < parts.length; end++) void Neutralino.filesystem.createDirectory(parts.slice(0, end).join('/'));
      window.__desktopFiles.set(path, body);
    }
  });
  await openApp(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Original');
    window.__desktopFiles.set('C:/Original/Before.md', '# original bytes');
    await window.NL_IMPORT_EXTERNAL_FILE('# original bytes', 'Before', 'C:/Original/Before.md');
  });
  const row = page.locator('.is-linked-document').filter({ hasText: 'Before' });
  const id = await row.getAttribute('data-document-id');
  await setEditorContent(page, '# retained editor draft');
  await page.evaluate(() => MarkdownViewerFlushWorkspace());
  return { row, id };
}
async function rename(page, row) {
  await action(page, row, 'Rename');
  await page.locator('.document-tree-rename-input').fill('After');
  await page.locator('.document-tree-rename-input').press('Enter');
}

test('lost native rename reply repairs the link and preserves live draft and original bytes', async ({ page }) => {
  const { row, id } = await setup(page);
  await page.evaluate(() => {
    const move = Neutralino.filesystem.move;
    window.__externalMoves = 0;
    Neutralino.filesystem.move = async (from, to) => {
      await move(from, to);
      if (from === 'C:/Original/Before.md') {
        window.__externalMoves++;
        throw new Error('Injected lost response after successful move');
      }
    };
  });
  await rename(page, row);
  const renamed = page.locator(`[data-document-id="${id}"]`);
  await expect(renamed).toHaveAttribute('title', 'C:/Original/After.md');
  await expect(page.locator('#markdown-editor')).toHaveValue('# retained editor draft');
  expect(await page.evaluate(() => window.__externalMoves)).toBe(1);
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/After.md'))).toBe('# original bytes');
  await action(page, renamed, 'Save');
  await expect.poll(() => page.evaluate(() => window.__desktopFiles.get('C:/Original/After.md'))).toBe('# retained editor draft');
});

test('ambiguous rename blocks source writes until an explicit recovery choice, preserving both files', async ({ page }) => {
  const { row, id } = await setup(page);
  await page.evaluate(() => {
    const move = Neutralino.filesystem.move;
    Neutralino.filesystem.move = async (from, to) => {
      if (from === 'C:/Original/Before.md') {
        window.__desktopFiles.set(to, '# unrelated destination');
        throw new Error('Destination appeared before move');
      }
      return move(from, to);
    };
  });
  await rename(page, row);
  await expect(page.locator('.document-tree-rename-input')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('.document-tree-rename-input').press('Escape');
  const pending = page.locator(`[data-document-id="${id}"]`);
  await action(page, pending, 'Save');
  await expect(page.locator('#app-toast-region')).toContainText('Resolve the interrupted rename');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/Before.md'))).toBe('# original bytes');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/After.md'))).toBe('# unrelated destination');
  await page.evaluate(() => { Neutralino.os.showOpenDialog = async () => ['C:/Original/Before.md']; });
  await action(page, pending, 'Resolve interrupted rename…');
  const dialog = page.locator('#linked-confirm-modal');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep draft', exact: true }).click();
  await expect(dialog).toBeHidden();
  await action(page, pending, 'Resolve interrupted rename…');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Connect original', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#markdown-editor')).toHaveValue('# retained editor draft');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/Before.md'))).toBe('# original bytes');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/After.md'))).toBe('# unrelated destination');
  await pending.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await expect(page.locator('.document-menu-context.open').getByRole('menuitem', { name: 'Resolve interrupted rename…', exact: true })).toHaveCount(0);
});

test('Private mode refuses an external rename before changing either original path', async ({ page }) => {
  const { row } = await setup(page);
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#private-mode-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-private-mode', 'true');
  await page.keyboard.press('Escape');
  await rename(page, row);
  await expect(page.locator('.document-tree-rename-input')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => window.__desktopFiles.has('C:/Original/Before.md'))).toBe(true);
  expect(await page.evaluate(() => window.__desktopFiles.has('C:/Original/After.md'))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# retained editor draft');
});

test('restarting after a completed disk move and before its reply recovers the link and draft', async ({ page }) => {
  const { row, id } = await setup(page);
  await page.evaluate(() => {
    const move = Neutralino.filesystem.move;
    Neutralino.filesystem.move = async (from, to) => {
      await move(from, to);
      if (from === 'C:/Original/Before.md') {
        window.__diskRenameCompleted = true;
        await new Promise(() => {}); // Native reply never arrives before restart.
      }
    };
  });
  await rename(page, row);
  await page.waitForFunction(() => window.__diskRenameCompleted);
  await page.evaluate(() => sessionStorage.setItem('rename-test-files', JSON.stringify([...window.__desktopFiles])));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  const recovered = page.locator(`[data-document-id="${id}"]`);
  await expect(recovered).toHaveAttribute('title', 'C:/Original/After.md');
  await action(page, recovered, 'Open');
  await expect(page.locator('#markdown-editor')).toHaveValue('# retained editor draft');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/After.md'))).toBe('# original bytes');
});

test('unavailable recovery storage refuses rename before changing the original', async ({ page }) => {
  const { row } = await setup(page);
  await page.evaluate(() => {
    MarkdownWorkspaceStorage.prototype.saveDocuments = async () => { throw new Error('Injected unavailable storage'); };
  });
  await rename(page, row);
  await expect(page.locator('.document-tree-rename-input')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/Before.md'))).toBe('# original bytes');
  expect(await page.evaluate(() => window.__desktopFiles.has('C:/Original/After.md'))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# retained editor draft');
});

test('an ambiguous rename draft can still be retained and exported as a Vault copy', async ({ page }) => {
  const { row, id } = await setup(page);
  await page.evaluate(() => {
    const move = Neutralino.filesystem.move;
    Neutralino.filesystem.move = async (from, to) => {
      if (from === 'C:/Original/Before.md') {
        window.__desktopFiles.set(to, '# unrelated destination');
        throw new Error('Destination appeared before move');
      }
      return move(from, to);
    };
  });
  await rename(page, row);
  await expect(page.locator('.document-tree-rename-input')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('.document-tree-rename-input').press('Escape');
  const pending = page.locator(`[data-document-id="${id}"]`);
  await action(page, pending, 'Convert to Workspace copy');
  await expect(pending).not.toHaveClass(/is-linked-document/);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Exports');
    Neutralino.os.showSaveDialog = async () => 'C:/Exports/retained.md';
  });
  await action(page, pending, 'Download Markdown');
  await expect.poll(() => page.evaluate(() => window.__desktopFiles.get('C:/Exports/retained.md'))).toBe('# retained editor draft');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/Before.md'))).toBe('# original bytes');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/After.md'))).toBe('# unrelated destination');
});
