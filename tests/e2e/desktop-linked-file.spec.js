const { test, expect } = require('@playwright/test');
const { openApp, editorValue } = require('../helpers/app');

test('deduplicates linked source paths and writes the original only on Ctrl+S', async ({ page }) => {
  await openApp(page);
  await page.evaluate(async () => {
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:\\Docs\\notes.md');
    await window.NL_IMPORT_EXTERNAL_FILE('# changed on disk', 'notes', 'c:/docs/notes.md');
  });

  await expect(page.locator('.tab-item .tab-title').filter({ hasText: 'notes' })).toHaveCount(1);
  await expect.poll(() => editorValue(page)).toBe('# changed on disk');

  await page.evaluate(() => {
    window.__linkedDiskContent = '# changed on disk';
    window.__linkedWrites = [];
    window.Neutralino = {
      filesystem: {
        readFile: async () => window.__linkedDiskContent,
        writeFile: async (path, content) => {
          window.__linkedWrites.push({ path, content });
          window.__linkedDiskContent = content;
        }
      },
      os: { showSaveDialog: async () => null }
    };
  });

  const editor = page.locator('#markdown-editor');
  await editor.fill('# local edit');
  await editor.dispatchEvent('input');
  await page.waitForTimeout(700);
  await expect.poll(() => page.evaluate(() => window.__linkedWrites.length)).toBe(0);

  await editor.press('Control+s');
  await expect.poll(() => page.evaluate(() => window.__linkedWrites)).toEqual([
    { path: 'c:/docs/notes.md', content: '# local edit' }
  ]);
});

test('links a folder, discovers external additions, and converts a file to a copy', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__folderEntries = ['one.md'];
    window.__fileContents = {
      'C:\\Notes\\one.md': '# one',
      'C:\\Notes\\two.md': '# two'
    };
    window.__watchHandlers = {};
    window.__linkedWrites = [];
    window.Neutralino = {
      filesystem: {
        readDirectory: async path => path === 'C:\\Notes'
          ? window.__folderEntries.map(entry => ({ entry, type: 'FILE' })) : [],
        getJoinedPath: async (...parts) => parts.join('\\'),
        readFile: async path => window.__fileContents[path],
        createWatcher: async () => 1,
        removeWatcher: async () => 1
      },
      events: { on: async (name, handler) => { window.__watchHandlers[name] = handler; } },
      os: {
        showFolderDialog: async () => 'C:\\Notes',
        open: async () => ({ success: true })
      },
      storage: { setData: async () => ({ success: true }) }
    };
    document.getElementById('sidebar-link-folder').click();
  });

  await page.locator('#document-sidebar-open').click();
  await expect(page.locator('#document-tree')).toContainText('Linked Locations');
  await expect(page.locator('.document-tree-row[data-tree-type="document"]').filter({ hasText: 'one' })).toContainText('Linked');
  await page.evaluate(async () => {
    await window.NL_START_LINKED_MONITORING();
    window.__folderEntries.push('two.md');
    window.__watchHandlers.watchFile({ detail: { id: 1 } });
  });
  await expect(page.locator('.document-tree-row[data-tree-type="document"]').filter({ hasText: 'two' })).toHaveCount(1);

  const linkedRow = page.locator('.document-tree-row[data-tree-type="document"]').filter({ hasText: 'one' });
  await linkedRow.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  const missingMenuIcons = await page.locator('.document-menu-context [role="menuitem"] i').evaluateAll(nodes => nodes
    .filter(node => getComputedStyle(node).maskImage === 'none' && getComputedStyle(node).webkitMaskImage === 'none')
    .map(node => node.className));
  expect(missingMenuIcons).toEqual([]);
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy' }).click();

  await expect(linkedRow).not.toContainText('Linked');
  await expect(linkedRow.locator('.lucide-file-text')).toHaveCount(1);
  await expect(page.locator('.document-tree-row[data-tree-type="linked-location"]').filter({ hasText: 'Notes' })).toContainText('1');
  await expect.poll(() => page.evaluate(() => window.__fileContents['C:\\Notes\\one.md'])).toBe('# one');
  await expect.poll(() => page.evaluate(() => window.__linkedWrites)).toEqual([]);
});

test('removing an individual link leaves the source on disk', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__original = '# original';
    window.__linkedWrites = [];
    window.Neutralino = {
      filesystem: {
        readFile: async () => window.__original,
        createWatcher: async () => 1,
        removeWatcher: async () => 1
      },
      os: {
        showOpenDialog: async () => ['C:\\Notes\\original.md'],
        open: async () => ({ success: true })
      },
      storage: { setData: async () => ({ success: true }) },
      events: { on: async () => ({ success: true }) }
    };
    document.getElementById('sidebar-link-files').click();
  });
  await page.locator('#document-sidebar-open').click();
  const linkedRow = page.locator('.document-tree-row[data-tree-type="document"]').filter({ hasText: 'original' });
  await expect(linkedRow).toContainText('Linked');
  await page.evaluate(() => {
    window.confirm = () => { throw new Error('browser confirm must not be used'); };
  });
  await linkedRow.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.getByRole('menuitem', { name: 'Remove link from Workspace' }).click();

  await expect(linkedRow).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__original)).toBe('# original');
  await expect.poll(() => page.evaluate(() => window.__linkedWrites)).toEqual([]);
  await expect(page.locator('.app-toast').filter({ hasText: 'original file remains on disk' })).toBeVisible();
});

test('browser Workspace stays distinct and desktop link commands have separate icons', async ({ page }) => {
  await openApp(page);
  await page.locator('#document-sidebar-open').click();
  await expect(page.locator('#document-tree')).toContainText('Workspace');
  await expect(page.locator('#document-tree')).not.toContainText('Workspace (Vault)');
  await expect(page.locator('#sidebar-new-folder i')).toHaveClass(/lucide-folder-plus/);
  await expect(page.locator('#sidebar-link-folder i')).toHaveClass(/lucide-folder-open/);
  const icons = await page.locator('#sidebar-new-folder i, #sidebar-link-folder i').evaluateAll(nodes => nodes.map(node => ({
    mask: getComputedStyle(node).maskImage,
    webkitMask: getComputedStyle(node).webkitMaskImage
  })));
  expect(icons.every(icon => icon.mask !== 'none' || icon.webkitMask !== 'none')).toBeTruthy();
});
