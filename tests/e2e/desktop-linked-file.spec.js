const { test, expect } = require('@playwright/test');
const { openApp, editorValue } = require('../helpers/app');

// These scenarios simulate desktop linking while retaining browser test storage.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.NL_PORT = 1;
    window.NL_OS = 'Windows';
    window.Neutralino = { filesystem: { readFile: async () => '', writeFile: async () => true }, os: {} };
  });
});

test('linked sidebar rows show source paths only on hover across All, Recent and Favs', async ({ page }) => {
  await page.addInitScript(() => {
    const records = ['healthy', 'missing', 'conflict'].map((title, index) => ({
      id: 'linked_' + title, title, content: '# ' + title,
      sourcePath: 'C:/Original/' + title + '.md',
      sourceMissing: title === 'missing', sourceConflict: title === 'conflict',
      favorite: true, isOpen: true, workspaceId: 'workspace_default',
      createdAt: index + 1, lastOpenedAt: index + 1, lastEditedAt: index + 1
    }));
    localStorage.setItem('markdownViewerTabs', JSON.stringify(records));
  });
  await openApp(page);
  await page.evaluate(async () => {
    await window.NL_IMPORT_EXTERNAL_FILE('# healthy', 'healthy', 'C:/Original/healthy.md');
  });
  const tree = page.locator('#document-tree');
  if (!(await tree.isVisible())) await page.locator('#document-sidebar-open').click();
  for (const filter of ['all', 'recent', 'favorites']) {
    await page.locator(`[data-document-filter="${filter}"]`).click();
    const row = title => tree.locator(`[data-document-id="linked_${title}"]`);
    await expect(row('healthy')).toBeVisible();
    await expect(row('healthy').locator('.document-tree-meta')).toHaveCount(0);
    await expect(row('healthy').locator('.lucide-file-symlink')).toHaveCount(1);
    await expect(row('healthy')).toHaveAttribute('title', 'C:/Original/healthy.md');
    await expect(row('healthy').locator('.document-tree-main')).toHaveAttribute('title', 'C:/Original/healthy.md');
    await expect(row('healthy')).not.toContainText('C:/Original');
    await expect(row('missing').locator('.document-tree-meta')).toHaveText('Missing source');
    await expect(row('conflict').locator('.document-tree-meta')).toHaveText('Conflict');
  }
  await page.locator('#document-sidebar-search').fill('C:/Original/healthy.md');
  await expect(tree.locator('[data-tree-type="document"]')).toHaveCount(1);
});

test('first file-association launch seeds Welcome in the Vault without replacing the linked document', async ({ page }) => {
  await page.addInitScript(() => {
    window.NL_INITIAL_FILE_CONTENT = { content: '# Initial original', name: 'initial', sourcePath: 'C:/Docs/initial.md' };
  });
  await openApp(page);
  const welcome = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'Welcome to Markdown' });
  await expect(welcome).toHaveCount(1);
  await expect(welcome.locator('.lucide-file-text')).toHaveCount(1);
  await expect(welcome).not.toHaveClass(/is-linked-document/);
  await expect(welcome).toHaveAttribute('data-tree-depth', '1');
  await expect.poll(() => editorValue(page)).toBe('# Initial original');
  await expect(page.locator('.tab-item.active .tab-title')).toHaveText('initial');
  await welcome.locator('.document-tree-main').click();
  await expect.poll(() => editorValue(page)).toContain('# Welcome to Markdown Viewer');
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await expect(welcome).toHaveCount(1);
  await expect.poll(() => editorValue(page)).toBe('# Initial original');
  await welcome.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(welcome).toHaveCount(0);
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await expect(welcome).toHaveCount(0);
  await expect.poll(() => editorValue(page)).toBe('# Initial original');
});

test('deduplicates Windows source paths and writes the original only on Ctrl+S', async ({ page }) => {
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
        writeFile: async () => true,
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
  await expect(page.locator('#document-tree')).toContainText('Linked Workspace');
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

  await expect(page.locator('#document-tree')).toContainText('Workspace (Vault)');
  await expect(linkedRow).not.toHaveClass(/is-linked-document/);
  await expect(linkedRow.locator('.lucide-file-text')).toHaveCount(1);
  await expect(page.locator('.document-tree-row[data-tree-type="linked-location"]').filter({ hasText: 'Notes' })).toContainText('1');
  await expect.poll(() => page.evaluate(() => window.__fileContents['C:\\Notes\\one.md'])).toBe('# one');
  await expect.poll(() => page.evaluate(() => window.__linkedWrites)).toEqual([]);
});

test('groups linked files under Workspaces and persists independent nested folder expansion', async ({ page }) => {
  await openApp(page);
  await page.evaluate(async () => {
    const directories = {
      'C:/Notes': [{ entry: 'first', type: 'DIRECTORY' }, { entry: 'second', type: 'DIRECTORY' }],
      'C:/Notes/first': [{ entry: 'deep', type: 'DIRECTORY' }, { entry: 'one.md', type: 'FILE' }],
      'C:/Notes/first/deep': [{ entry: 'nested.md', type: 'FILE' }],
      'C:/Notes/second': [{ entry: 'two.md', type: 'FILE' }]
    };
    window.Neutralino = {
      filesystem: {
        getStats: async path => ({ isDirectory: Boolean(directories[path.replace(/\\/g, '/')]), isFile: !directories[path.replace(/\\/g, '/')] }),
        readDirectory: async path => directories[path.replace(/\\/g, '/')] || [],
        getJoinedPath: async (...parts) => parts.join('/'),
        readFile: async path => '# ' + path,
        writeFile: async () => true,
        createWatcher: async () => 1,
        removeWatcher: async () => 1
      },
      events: { on: async () => ({ success: true }) },
      storage: { setData: async () => ({ success: true }) },
      os: {}
    };
    Neutralino.os = { showFolderDialog: async () => 'C:/Notes' };
    document.getElementById('sidebar-link-folder').click();
    await window.NL_IMPORT_EXTERNAL_FILE('# loose', 'loose', 'C:/loose.md');
  });
  const tree = page.locator('#document-tree');
  if (!(await tree.isVisible())) await page.locator('#document-sidebar-open').click();
  const roots = tree.locator('.document-tree-row[data-tree-depth="0"]');
  await expect(roots.locator('.document-tree-label')).toHaveText(['Workspace (Vault)', 'Linked Workspace', 'Secret Workspace']);
  await expect(tree).not.toContainText('Linked Locations');
  await expect(tree.locator('[data-tree-type="linked-workspace"] > .document-tree-main > i')).toHaveClass('lucide lucide-link-2');
  await expect(tree.locator('[data-tree-type="linked-location"] > .document-tree-main > i')).toHaveClass('lucide lucide-folder-symlink');
  const symlinkMasks = await tree.locator('[data-tree-type="linked-virtual-folder"] > .document-tree-main > i').evaluateAll(icons => icons.map(icon => ({ className: icon.className, mask: getComputedStyle(icon).maskImage })));
  expect(symlinkMasks.length).toBeGreaterThan(0);
  expect(symlinkMasks.every(icon => icon.className === 'lucide lucide-folder-symlink' && icon.mask !== 'none')).toBe(true);
  const folder = name => tree.locator('[data-tree-type="linked-virtual-folder"]').filter({ has: page.locator('.document-tree-label', { hasText: new RegExp('^' + name + '$') }) });
  const documentRow = name => tree.locator('[data-tree-type="document"]').filter({ has: page.locator('.document-tree-label', { hasText: new RegExp('^' + name + '$') }) });
  await folder('deep').locator('.document-tree-toggle').click();
  await expect(folder('deep')).toHaveAttribute('aria-expanded', 'false');
  await expect(documentRow('nested')).toBeHidden();
  await expect(documentRow('one')).toBeVisible();
  await folder('first').locator('.document-tree-toggle').click();
  await expect(documentRow('one')).toBeHidden();
  await expect(documentRow('two')).toBeVisible();
  await folder('first').locator('.document-tree-main').click();
  await expect(documentRow('one')).toBeVisible();
  await expect(documentRow('nested')).toBeHidden();

  await documentRow('one').locator('.document-tree-main').click();
  const colors = await tree.evaluate(element => {
    const iconColor = row => getComputedStyle(row.querySelector('.document-tree-main > i')).color;
    const rows = Array.from(element.querySelectorAll('[data-tree-type="document"]'));
    return {
      active: iconColor(rows.find(row => row.classList.contains('is-active'))),
      inactive: rows.filter(row => !row.classList.contains('is-active')).map(iconColor),
      folders: Array.from(element.querySelectorAll('[data-tree-type="linked-virtual-folder"]')).map(iconColor),
      root: iconColor(element.querySelector('[data-tree-type="linked-location"]')),
      gray: getComputedStyle(element.querySelector('.document-tree-meta')).color
    };
  });
  expect(colors.active).not.toBe(colors.gray);
  expect(colors.root).toBe(colors.active);
  expect(colors.inactive.every(color => color === colors.gray)).toBe(true);
  expect(colors.folders.every(color => color === colors.gray)).toBe(true);

  const linkedRoot = tree.locator('[data-tree-type="linked-workspace"]');
  await linkedRoot.locator('.document-tree-toggle').click();
  await expect(documentRow('loose')).toBeHidden();
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await page.evaluate(async () => {
    await window.NL_IMPORT_EXTERNAL_FILE('# loose', 'loose', 'C:/loose.md');
  });
  await expect(linkedRoot).toHaveAttribute('aria-expanded', 'false');
  await linkedRoot.locator('.document-tree-main').click();
  await expect(folder('deep')).toHaveAttribute('aria-expanded', 'false');
  await expect(documentRow('nested')).toBeHidden();
  await folder('deep').focus();
  await folder('deep').press('ArrowRight');
  await expect(documentRow('nested')).toBeVisible();
  await page.locator('#document-sidebar-collapse-all').click();
  await expect(linkedRoot).toHaveAttribute('aria-expanded', 'false');
  await expect(folder('deep')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#document-sidebar-collapse-all').click();
  await expect(linkedRoot).toHaveAttribute('aria-expanded', 'true');
  await expect(documentRow('nested')).toBeVisible();
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
  await page.getByRole('menuitem', { name: 'Remove linked file' }).click();

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
  await expect(page.locator('#sidebar-link-folder i')).toHaveClass(/lucide-folder-symlink/);
  await expect(page.locator('#sidebar-link-files i')).toHaveClass(/lucide-file-symlink/);
  const icons = await page.locator('#sidebar-new-folder i, #sidebar-link-folder i, #sidebar-link-files i').evaluateAll(nodes => nodes.map(node => ({
    mask: getComputedStyle(node).maskImage,
    webkitMask: getComputedStyle(node).webkitMaskImage
  })));
  expect(icons.every(icon => icon.mask !== 'none' || icon.webkitMask !== 'none')).toBeTruthy();
});
