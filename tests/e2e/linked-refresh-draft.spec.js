const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, storedDocuments } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.NL_PORT = 1;
    window.NL_OS = 'Windows';
    window.Neutralino = { filesystem: { readFile: async () => '# Disk original', writeFile: async () => true }, os: {} };
  });
  await openApp(page);
  await page.evaluate(() => window.NL_IMPORT_EXTERNAL_FILE('# Disk original', 'refresh-test', 'C:/Original/refresh-test.md'));
});

test('reopening an external file preserves text typed before the editor debounce', async ({ page }) => {
  await page.evaluate(async () => {
    const editor = document.querySelector('#markdown-editor');
    editor.value = '# Local draft before debounce';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await window.NL_IMPORT_EXTERNAL_FILE('# External change', 'refresh-test', 'C:/Original/refresh-test.md');
  });
  await expect(page.locator('#markdown-editor')).toHaveValue('# Local draft before debounce');
  await expect(page.locator('#document-tree .is-source-conflict .document-source-conflict-indicator')).toBeVisible();
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Local draft before debounce');
  await expect(page.locator('#save-status-text')).toHaveText('Draft saved · Original changed');
  await expect(page.locator('#save-status-icon')).toHaveClass(/lucide-triangle-alert/);
});

test('an edit made while the draft hash is pending cannot be replaced', async ({ page }) => {
  await page.evaluate(async () => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let injected = false;
    crypto.subtle.digest = async function(algorithm, bytes) {
      const text = new TextDecoder().decode(bytes);
      const result = await digest(algorithm, bytes);
      if (!injected && text === '# Disk original') {
        injected = true;
        const editor = document.querySelector('#markdown-editor');
        editor.value = '# Typed during async hash';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return result;
    };
    await window.NL_IMPORT_EXTERNAL_FILE('# External change', 'refresh-test', 'C:/Original/refresh-test.md');
  });
  await expect(page.locator('#markdown-editor')).toHaveValue('# Typed during async hash');
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Typed during async hash');
});

test('repeated external conflict checks do not emit repeated toasts', async ({ page }) => {
  await setEditorContent(page, '# Kept local draft');
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Kept local draft');
  const notifications = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1 && /External change detected|Linked file conflict/.test(node.textContent)) count++;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    for (let i = 0; i < 3; i++) await window.NL_IMPORT_EXTERNAL_FILE('# External change', 'refresh-test', 'C:/Original/refresh-test.md');
    await new Promise(resolve => setTimeout(resolve, 0));
    observer.disconnect();
    return count;
  });
  expect(notifications).toBeLessThanOrEqual(1);
});

test('folder rescan preserves new input arriving during filesystem reads', async ({ page }) => {
  await page.evaluate(async () => {
    Neutralino.filesystem.getStats = async path => ({ isDirectory: path === 'C:/Original', size: 128 });
    Neutralino.filesystem.readDirectory = async () => [{ entry: 'refresh-test.md', type: 'FILE' }];
    Neutralino.filesystem.getJoinedPath = async (...parts) => parts.join('/');
    Neutralino.filesystem.createWatcher = async () => 1;
    Neutralino.filesystem.removeWatcher = async () => true;
    await window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
    Neutralino.filesystem.readFile = async () => {
      const editor = document.querySelector('#markdown-editor');
      editor.value = '# Local input during folder read';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      return '# External change from folder';
    };
  });
  const folder = page.locator('#document-tree [data-tree-type="linked-location"]');
  await folder.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rescan folder', exact: true }).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Local input during folder read');
  await expect(page.locator('#document-tree .is-source-conflict .document-source-conflict-indicator')).toBeVisible();
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Local input during folder read');
  await expect(page.getByText('Linked file conflict', { exact: true })).toHaveCount(0);
});

test('a clean linked secondary editor refreshes without changing the primary editor', async ({ page }) => {
  const linkedId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# Separate primary');
  await page.locator('#tab-list .tab-item.active').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view', exact: true }).click();
  await page.locator('#document-split-destination').selectOption(linkedId);
  await page.locator('#document-split-modal-confirm').click();
  await page.evaluate(async () => {
    Neutralino.filesystem.getStats = async path => ({ isDirectory: path === 'C:/Original', size: 128 });
    Neutralino.filesystem.readDirectory = async () => [{ entry: 'refresh-test.md', type: 'FILE' }];
    Neutralino.filesystem.getJoinedPath = async (...parts) => parts.join('/');
    Neutralino.filesystem.readFile = async () => '# Clean external update';
    Neutralino.filesystem.createWatcher = async () => 1;
    Neutralino.filesystem.removeWatcher = async () => true;
    await window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
  });
  await expect(page.locator('#document-split-editor')).toHaveValue('# Clean external update');
  await expect(page.locator('#markdown-editor')).toHaveValue('# Separate primary');
});
