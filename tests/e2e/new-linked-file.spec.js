const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";window.NL_TOKEN="test-token";');
  await openApp(page);
  if (!(await page.locator('#document-tree').isVisible())) await page.locator('#document-sidebar-open').click();
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/New');
    Neutralino.os.showSaveDialog = async (title, options) => {
      window.__newPicker = { title, options };
      return 'C:/New/example';
    };
  });
});

async function create(page) {
  await page.locator('#document-tree [data-tree-type="linked-workspace"]').dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.locator('.document-menu-dropdown.open').getByRole('menuitem', { name: 'Create new linked file…', exact: true }).click();
}

test('toolbar creates the same linked file workflow as the context menu', async ({ page }) => {
  await page.locator('#sidebar-create-linked-file').click();
  await expect(page.locator('.app-toast').filter({ hasText: 'Linked file created' })).toBeVisible();
  await expect(page.locator('.tab-item.active .tab-title')).toHaveText('example');
  await expect(page.locator('#markdown-editor')).toBeFocused();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/New/example.md'))).toBe('');
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(1);
});

test('creates empty .md, focuses linked tab, preserves old draft and writes later edits only on Save', async ({ page }) => {
  await page.locator('#markdown-editor').fill('# Keep my Vault draft');
  await page.evaluate(async () => {
    window.__watched = [];
    Neutralino.filesystem.createWatcher = async path => { window.__watched.push(path); return window.__watched.length; };
    await window.NL_START_LINKED_MONITORING();
  });
  await create(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Linked file created' })).toBeVisible();
  await expect(page.locator('.tab-item.active .tab-title')).toHaveText('example');
  await expect(page.locator('#markdown-editor')).toHaveValue('');
  await expect(page.locator('#markdown-editor')).toBeFocused();
  expect(await page.evaluate(() => window.__newPicker.options.defaultPath)).toBe('Untitled.md');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/New/example.md'))).toBe('');
  expect(await page.evaluate(() => window.__watched)).toContain('C:/New');
  const linked = page.locator('#document-tree .is-linked-document').filter({ hasText: 'example' });
  await expect(linked).toHaveCount(1);
  await expect(linked).toHaveAttribute('title', 'C:/New/example.md');
  await page.locator('#markdown-editor').fill('# New local draft');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/New/example.md'))).toBe('');
  await page.keyboard.press('Control+s');
  await expect(page.locator('.app-toast').filter({ hasText: 'Original file updated' })).toBeVisible();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/New/example.md'))).toBe('# New local draft');
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'Welcome to Markdown' }).locator('.document-tree-main').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Keep my Vault draft');
});

test('cancel creates no file or workspace document and leaves the active draft intact', async ({ page }) => {
  await page.locator('#markdown-editor').fill('# Existing draft');
  const count = await page.locator('#document-tree [data-tree-type="document"]').count();
  await page.evaluate(() => { Neutralino.os.showSaveDialog = async () => ''; });
  await create(page);
  await expect(page.locator('.document-menu-dropdown.open')).toHaveCount(0);
  await expect(page.locator('#document-tree [data-tree-type="document"]')).toHaveCount(count);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Existing draft');
  expect(await page.evaluate(() => window.__desktopFiles.has('C:/New/example.md'))).toBe(false);
  await expect(page.locator('.app-toast').filter({ hasText: 'Linked file created' })).toHaveCount(0);
});

for (const content of ['', '# Existing original']) {
  test(`existing destination is refused without overwrite confirmation (content: ${JSON.stringify(content)})`, async ({ page }) => {
    await page.evaluate(content => window.__desktopFiles.set('C:/New/example.md', content), content);
    await create(page);
    await expect(page.locator('.app-toast').filter({ hasText: 'Choose a new file' })).toBeVisible();
    expect(await page.evaluate(() => window.__desktopFiles.get('C:/New/example.md'))).toBe(content);
    await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Replace', exact: true })).toHaveCount(0);
  });
}

test('an existing missing-source link is not reused or overwritten', async ({ page }) => {
  await page.evaluate(async () => {
    await window.NL_IMPORT_EXTERNAL_FILE('# Recover this draft', 'example', 'C:/New/example.md');
  });
  await create(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Choose a new file' })).toBeVisible();
  expect(await page.evaluate(() => window.__desktopFiles.has('C:/New/example.md'))).toBe(false);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Recover this draft');
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(1);
});

test('destination appearing after the first absence check is preserved', async ({ page }) => {
  await page.evaluate(() => {
    const read = Neutralino.filesystem.readDirectory;
    let first = true;
    Neutralino.filesystem.readDirectory = async path => {
      const entries = await read(path);
      if (path === 'C:/New' && first) {
        first = false;
        window.__absencePending = true;
        await new Promise(resolve => { window.__releaseAbsence = resolve; });
      }
      return entries;
    };
  });
  await create(page);
  await page.waitForFunction(() => window.__absencePending);
  await page.evaluate(() => { window.__desktopFiles.set('C:/New/example.md', '# Created externally'); window.__releaseAbsence(); });
  await expect(page.locator('.app-toast').filter({ hasText: 'Creation cancelled' })).toBeVisible();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/New/example.md'))).toBe('# Created externally');
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(0);
});

test('write failure leaves the workspace intact and allows a retry', async ({ page }) => {
  await page.evaluate(() => {
    const write = Neutralino.filesystem.writeFile;
    Neutralino.filesystem.writeFile = async (path, content) => {
      if (path === 'C:/New/example.md' && !window.__allowCreate) throw new Error('Access denied');
      return write(path, content);
    };
  });
  await create(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Access denied' })).toBeVisible();
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(0);
  await page.evaluate(() => { window.__allowCreate = true; });
  await create(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Linked file created' })).toBeVisible();
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(1);
});

test('access denied when checking the destination is not treated as absence', async ({ page }) => {
  await page.evaluate(() => {
    const stats = Neutralino.filesystem.getStats;
    Neutralino.filesystem.getStats = async path => {
      if (path === 'C:/New/example.md') throw new Error('Access denied during inspection');
      return stats(path);
    };
  });
  await create(page);
  await expect(page.locator('.app-toast').filter({ hasText: 'Access denied during inspection' })).toBeVisible();
  expect(await page.evaluate(() => window.__desktopFiles.has('C:/New/example.md'))).toBe(false);
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(0);
});

test('failed verification preserves the created file and reports its location without opening a tab', async ({ page }) => {
  await page.evaluate(() => {
    const write = Neutralino.filesystem.writeFile;
    Neutralino.filesystem.writeFile = async (path, content) => {
      await write(path, content);
      if (path === 'C:/New/example.md') window.__desktopFiles.set(path, '# Changed during verification');
    };
  });
  await create(page);
  const failure = page.locator('.app-toast').filter({ hasText: 'Creation failed' });
  await expect(failure).toBeVisible();
  await expect(failure).toContainText('C:/New/example.md');
  await expect(failure).toContainText('was not removed');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/New/example.md'))).toBe('# Changed during verification');
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(0);
});
