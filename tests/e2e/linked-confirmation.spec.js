const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    window.confirm = () => { throw new Error('Native confirmation is forbidden'); };
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
    await window.MarkdownViewerFlushWorkspace();
  });
  await page.locator('#markdown-editor').fill('# local draft');
});

async function action(page, name) {
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^notes/ }).dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name, exact: true }).click();
}
const toast = (page, title) => ['Reload linked file?', 'Overwrite original file?', 'Recreate linked file?'].includes(title)
  ? page.getByRole('alertdialog', { name: title, exact: true })
  : page.locator('.app-toast').filter({ hasText: title });

test('reload uses a centered confirmation with safe cancel focus and explicit discard', async ({ page }) => {
  await action(page, 'Reload from disk');
  const prompt = toast(page, 'Reload linked file?');
  await expect(prompt.getByRole('button', { name: 'Keep draft', exact: true })).toBeFocused();
  await prompt.getByRole('button', { name: 'Keep draft', exact: true }).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# local draft');
  await action(page, 'Reload from disk');
  await prompt.getByRole('button', { name: 'Discard draft & reload', exact: true }).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# original');
});

for (const change of ['draft', 'disk']) {
  test('reload aborts when the ' + change + ' changes while confirmation is open', async ({ page }) => {
    await action(page, 'Reload from disk');
    const prompt = toast(page, 'Reload linked file?');
    await expect(prompt).toBeVisible();
    if (change === 'draft') await page.locator('#markdown-editor').fill('# newer local draft');
    else await page.evaluate(() => window.__desktopFiles.set('C:/Original/notes.md', '# newer disk'));
    await prompt.getByRole('button', { name: 'Discard draft & reload', exact: true }).click();
    await expect(toast(page, 'Reload cancelled')).toBeVisible();
    await expect(page.locator('#markdown-editor')).toHaveValue(change === 'draft' ? '# newer local draft' : '# local draft');
  });
}

test('Escape dismisses reload without discarding the draft', async ({ page }) => {
  await action(page, 'Reload from disk');
  await expect(toast(page, 'Reload linked file?')).toBeVisible();
  await expect(toast(page, 'Reload linked file?').getByRole('button', { name: 'Keep draft', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toast(page, 'Reload linked file?')).toHaveCount(0);
  await expect(page.locator('#markdown-editor')).toHaveValue('# local draft');
});

test('overwrite original requires explicit approval and cancels if the draft changes', async ({ page }) => {
  await page.evaluate(() => window.__desktopFiles.set('C:/Original/notes.md', '# external change'));
  await action(page, 'Save');
  const prompt = toast(page, 'Overwrite original file?');
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Keep draft', exact: true }).click();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# external change');
  await action(page, 'Save');
  await expect(prompt).toBeVisible();
  await page.locator('#markdown-editor').fill('# newer local draft');
  await prompt.getByRole('button', { name: 'Overwrite original', exact: true }).click();
  await expect(toast(page, 'Save cancelled')).toBeVisible();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# external change');
  await action(page, 'Save');
  await prompt.getByRole('button', { name: 'Overwrite original', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# newer local draft');
});

test('recreating an unreadable original uses the project confirmation modal', async ({ page }) => {
  await page.evaluate(() => window.__desktopFiles.delete('C:/Original/notes.md'));
  await action(page, 'Save');
  const prompt = toast(page, 'Recreate linked file?');
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Keep draft', exact: true }).click();
  expect(await page.evaluate(() => window.__desktopFiles.has('C:/Original/notes.md'))).toBe(false);
  await action(page, 'Save');
  await prompt.getByRole('button', { name: 'Create file', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# local draft');
});
