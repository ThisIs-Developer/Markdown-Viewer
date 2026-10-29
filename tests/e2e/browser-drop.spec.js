const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');

test.beforeEach(async ({ page }) => { await openApp(page); });

async function dispatch(page, selector, type, entries, options = {}) {
  await page.evaluate(({ selector, type, entries, options }) => {
    function makeEntry(item) {
      if (item.children) return { name: item.name, isDirectory: true, createReader() {
        let position = 0;
        return { readEntries(resolve) {
          const batch = item.children.slice(position, position += 100).map(makeEntry);
          if (options.hold) window.__finishFolderRead = () => resolve(batch);
          else resolve(batch);
        } };
      } };
      return { name: item.name, isFile: true, file(resolve, reject) {
        if (item.fail) reject(new Error('Unreadable fixture'));
        else resolve(new File([item.content || '# ' + item.name], item.name, { type: 'text/markdown' }));
      } };
    }
    const dt = new DataTransfer();
    const items = entries.map(item => {
      const entry = makeEntry(item);
      const file = item.children ? null : new File([item.content || '# ' + item.name], item.name, { type: item.type || 'text/markdown' });
      if (file) dt.items.add(file);
      return { kind: 'file', webkitGetAsEntry: () => options.protected ? null : entry,
        getAsFile: () => options.protected ? null : file };
    });
    Object.defineProperty(dt, 'items', { value: items });
    Object.defineProperty(dt, 'types', { value: ['Files'] });
    document.querySelector(selector).dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { selector, type, entries, options });
}

async function metadata(page) {
  return page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return storage.listDocumentMetadata();
  });
}

test('web drag feedback handles file, folder, mixed and protected payloads and clears highlights', async ({ page }) => {
  const vault = '[data-tree-id="workspace_default"][data-tree-type="workspace"]';
  const icon = page.locator('#drag-overlay .drag-overlay-icon');
  await dispatch(page, vault, 'dragenter', [{ name: 'one.md' }]);
  await expect(icon).toHaveClass(/lucide-file\b/);
  await expect(page.locator(vault)).toHaveClass(/is-drop-target/);
  await dispatch(page, vault, 'dragover', [{ name: 'Notes', children: [] }]);
  await expect(icon).toHaveClass(/lucide-folder\b/);
  await dispatch(page, vault, 'dragover', [{ name: 'Notes', children: [] }, { name: 'one.md' }]);
  await expect(icon).toHaveClass(/lucide-files\b/);
  await dispatch(page, 'main', 'dragover', [{ name: 'Notes', children: [] }], { protected: true });
  await expect(icon).toHaveClass(/lucide-files\b/);
  await expect(page.locator(vault)).not.toHaveClass(/is-drop-target/);
  await expect(page.locator('#drag-overlay .drag-overlay-text')).toHaveText('Drop to import or insert');
  await dispatch(page, 'main', 'dragleave', [{ name: 'Notes', children: [] }]);
  await expect(page.locator('#drag-overlay')).toBeHidden();
});

test('web folders import every browser batch, preserve hierarchy and remain independent Vault copies', async ({ page }) => {
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill('Destination');
  await page.locator('#document-name-modal-confirm').click();
  await expect(page.locator('#document-name-modal')).toBeHidden();
  const destination = page.locator('[data-tree-type="folder"]').filter({ hasText: 'Destination' });
  const destinationId = await destination.getAttribute('data-tree-id');
  const children = [...Array.from({ length: 101 }, (_, i) => ({ name: i + '.png' })),
    { name: 'δοκιμή.md', content: '# Unicode folder import' }, { name: 'Nested', children: [{ name: 'inside.markdown' }] },
    { name: 'Empty', children: [] }];
  await dispatch(page, '[data-tree-id="' + destinationId + '"]', 'drop', [{ name: 'Dropped folder', children }]);
  await expect.poll(async () => (await metadata(page)).filter(x => ['δοκιμή', 'inside'].includes(x.title)).length).toBe(2);
  const records = await metadata(page);
  expect(records.find(x => x.title === 'δοκιμή').sourcePath).toBeFalsy();
  const organization = await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.getDocumentOrganizationState()).organization;
  });
  const root = organization.folders.find(x => x.name === 'Dropped folder');
  expect(root.parentFolderId).toBe(destinationId);
  expect(organization.folders.find(x => x.name === 'Nested').parentFolderId).toBe(root.id);
  expect(organization.folders.find(x => x.name === 'Empty').parentFolderId).toBe(root.id);
  expect(records.find(x => x.title === 'δοκιμή').folderId).toBe(root.id);
  // Verify persistence, not just the in-memory import result.
  await page.reload();
  await expect(page.locator('[data-tree-type="folder"]').filter({ hasText: 'Destination' })).toBeVisible();
  expect(records.find(x => x.title === 'δοκιμή').folderId).not.toBe(destinationId);
  expect(records.find(x => x.title === 'inside').folderId).not.toBe(records.find(x => x.title === 'δοκιμή').folderId);
  expect((await metadata(page)).find(x => x.title === 'δοκιμή').folderId).toBe(root.id);
  await expect(page.locator('#desktop-drop-modal')).toBeHidden();
  await expect(page.locator('[data-tree-type="linked-workspace"]')).toHaveCount(0);
});

test('dropping a real File onto a web document uses its parent and preserves the active draft', async ({ page }) => {
  const before = await page.locator('#markdown-editor').inputValue();
  const target = page.locator('[data-tree-type="document"]').first();
  const dt = await page.evaluateHandle(() => { const dt = new DataTransfer(); dt.items.add(new File(['# dropped'], 'web-note.md', { type: 'text/markdown' })); return dt; });
  await target.dispatchEvent('drop', { dataTransfer: dt });
  await expect.poll(async () => (await metadata(page)).some(x => x.title === 'web-note')).toBe(true);
  expect(await page.locator('#markdown-editor').inputValue()).toBe(before);
});

test('folder read failures create no documents or folders', async ({ page }) => {
  const before = (await metadata(page)).length;
  await dispatch(page, 'main', 'drop', [{ name: 'Failed folder', children: [{ name: 'good.md' }, { name: 'bad.md', fail: true }] }]);
  await expect(page.locator('.app-toast').filter({ hasText: 'could not be added' })).toBeVisible();
  expect((await metadata(page)).length).toBe(before);
  await expect(page.locator('[data-tree-type="folder"]').filter({ hasText: 'Failed folder' })).toHaveCount(0);
});

test('locked targets reject web drops and unsupported hover shows invalid feedback', async ({ page }) => {
  const secret = '[data-tree-id="workspace_secret"]';
  await dispatch(page, secret, 'dragover', [{ name: 'notes.md' }]);
  await expect(page.locator(secret)).toHaveClass(/is-drop-invalid/);
  await dispatch(page, secret, 'drop', [{ name: 'notes.md' }]);
  expect((await metadata(page)).some(x => x.title === 'notes')).toBe(false);
  await dispatch(page, '[data-tree-id="workspace_default"]', 'dragover', [{ name: 'app.exe' }]);
  await expect(page.locator('#drag-overlay')).toHaveClass(/is-drop-invalid/);
});
