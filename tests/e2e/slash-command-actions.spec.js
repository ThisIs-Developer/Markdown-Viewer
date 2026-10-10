const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, stubRemoteDiagramServices, stubLazyRendererLibraries, storedDocuments, waitForAppReady } = require('../helpers/app');
test.use({ timezoneId: 'UTC' });

const mediaId = 'slashAuditMedia0000000001';
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function chooseUpload(page, editor) {
  await enterCommand(page, editor, 'image', 'image');
  await page.locator('#image-source-upload').check();
  await page.locator('#image-modal-file').setInputFiles({ name: 'audit.gif', mimeType: 'image/gif', buffer: gif });
}

async function mockMediaDownload(page) {
  await page.route('**/api/image/' + mediaId, route => route.fulfill({ contentType: 'image/gif', body: gif }));
}

async function expectPersistedAfterReload(page, content) {
  let saved;
  await expect.poll(async () => {
    saved = (await storedDocuments(page)).find(doc => doc.content === content);
    return saved?.content;
  }).toBe(content);
  await page.reload();
  await waitForAppReady(page);
  // The split layout is transient; verify the saved document independently of its pane.
  await expect.poll(async () => (await storedDocuments(page)).find(doc => doc.id === saved.id)?.content).toBe(content);
}

const prefix = 'Before\n\n';
const suffix = '\n\nAfter';
const direct = [
  ['paragraph', 'paragraph', ''],
  ...Array.from({ length: 6 }, (_, i) => ['heading-' + (i + 1), 'h' + (i + 1), '#'.repeat(i + 1) + ' ']),
  ['bulleted-list', 'bullet', '- '], ['numbered-list', 'number', '1. '],
  ['task-list', 'checklist', '- [ ] '], ['blockquote', 'quote', '> '],
  ['code-block', 'fence', '```\ncode\n```\n', 'code'],
  ['horizontal-rule', 'divider', '---\n'],
  ['link', 'hyperlink', '[text](https://example.com)', 'text'],
  ['math', 'latex', '$$\nformula\n$$\n', 'formula'],
  ['terminal-block', 'shell', '```bash\nnpm run dev\n```\n', 'npm run dev'],
  ['date', 'today', null]
];
async function enterCommand(page, editor, query, id) {
  await expect(page.locator('.reset-modal-overlay:visible')).toHaveCount(0);
  await editor.evaluate((node, value) => {
    node.focus(); node.value = value; node.setSelectionRange(8, 8);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, prefix + suffix);
  await editor.pressSequentially('/' + query);
  await expect(page.locator('#slash-command-' + id)).toHaveAttribute('aria-selected', 'true');
  await editor.press('Enter');
  await expect(page.locator('#slash-command-menu')).toBeHidden();
}
for (const pane of ['primary', 'secondary']) {
  test.describe(pane, () => {
    let editor;
    test.beforeEach(async ({ page }) => {
      await stubRemoteDiagramServices(page);
      await stubLazyRendererLibraries(page);
      await openApp(page);
      await page.getByRole('button', { name: 'Edit Markdown' }).click();
      if (pane === 'secondary') {
        await setEditorContent(page, 'PRIMARY MUST STAY UNCHANGED');
        await page.locator('#tab-new-btn').click();
        const secondId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
        await page.locator('#tab-list .tab-item').first().click({ button: 'right' });
        await page.getByRole('menuitem', { name: 'Open in split view' }).click();
        await page.locator('#document-split-destination').selectOption(secondId);
        await page.locator('#document-split-modal-confirm').click();
      }
      editor = page.locator(pane === 'primary' ? '#markdown-editor' : '#document-split-editor');
      await expect(editor).toBeVisible();
    });
    test.afterEach(async ({ page }) => {
      if (pane === 'secondary') await expect(page.locator('#markdown-editor')).toHaveValue('PRIMARY MUST STAY UNCHANGED');
    });
    test('all 17 direct commands preserve surrounding text and select the correct placeholder', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-10T10:30:00Z'));
      for (const [id, query, insert, selected = ''] of direct) {
        await test.step(id, async () => {
          const expected = insert === null ? '2026-10-10 10:30 AM Saturday' : insert;
          await enterCommand(page, editor, query, id);
          await expect(editor).toHaveValue(prefix + expected + suffix);
          const selection = await editor.evaluate(node => ({ text: node.value.slice(node.selectionStart, node.selectionEnd), start: node.selectionStart, end: node.selectionEnd }));
          expect(selection.text).toBe(selected);
          if (selected) {
            await editor.pressSequentially('replacement');
            await expect(editor).toHaveValue(prefix + expected.replace(selected, 'replacement') + suffix);
          } else expect(selection.start).toBe(prefix.length + expected.length);
        });
      }
    });
    test('table, all five alerts, diagram, image URL, and video URL insert into the correct editor', async ({ page }) => {
      await enterCommand(page, editor, 'table', 'table');
      await page.locator('#table-modal-columns').fill('2');
      await page.locator('#table-modal-rows').fill('2');
      await page.locator('#table-modal-insert').click();
      await expect(editor).toHaveValue(prefix + '| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n' + suffix);
      for (const type of ['note', 'tip', 'important', 'warning', 'caution']) {
        await enterCommand(page, editor, 'alert', 'alert');
        await page.locator(`#alert-modal [data-alert-type="${type}"]`).click();
        await page.locator('#alert-modal-insert').click();
        await expect(editor).toHaveValue(prefix + `> [!${type.toUpperCase()}]\n> ${type[0].toUpperCase() + type.slice(1)} details go here.\n` + suffix);
      }
      await enterCommand(page, editor, 'diagram', 'diagram');
      await page.locator('#diagram-modal .diagram-card').first().click();
      const template = await page.locator('#diagram-modal-preview-code').inputValue();
      expect(template).toMatch(/^```/);
      await page.locator('#diagram-modal-insert').click();
      await expect.poll(async () => (await editor.inputValue()).slice(prefix.length, -suffix.length).trim()).toBe(template.trim());
      for (const ext of ['png', 'mp4']) {
        await enterCommand(page, editor, 'image', 'image');
        await page.locator('#image-modal-url').fill('https://example.com/audit.' + ext);
        await page.locator('#image-modal-alt').fill('Audit media');
        await page.locator('#image-modal-insert').click();
        const expected = ext === 'png' ? '![Audit media](https://example.com/audit.png "Audit media")' : '<video controls preload="metadata" src="https://example.com/audit.mp4" aria-label="Audit media"></video>';
        await expect(editor).toHaveValue(prefix + expected + suffix);
      }
    });
    test('media upload stays in the command target editor (mock upload API)', async ({ page }) => {
      await page.route('**/api/image', route => route.fulfill({ json: { id: mediaId } }));
      await mockMediaDownload(page);
      await chooseUpload(page, editor);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(page.locator('#image-modal')).toBeHidden();
      await expect(editor).toHaveValue(new RegExp('^Before\\n\\n!\\[alt text\\]\\(https?://[^)]+/api/image/' + mediaId + '\\)\\n\\nAfter$'));
      const insertedValue = await editor.inputValue();
      await expectPersistedAfterReload(page, insertedValue);
    });

    test('reference chooser preserves text and avoids duplicate definition numbers', async ({ page }) => {
      await enterCommand(page, editor, 'reference', 'reference');
      await expect(page.locator('#reference-modal-number')).toHaveValue('[1]');
      await page.locator('#reference-modal-url').fill('https://example.com/first');
      await page.locator('#reference-modal-title-input').fill('First source');
      await page.locator('#reference-modal-apply').click();
      const first = prefix + '[1]' + suffix + '\n[1]: https://example.com/first "First source"';
      await expect(editor).toHaveValue(first);
      await expect(page.locator('.reset-modal-overlay:visible')).toHaveCount(0);
      await editor.evaluate(node => {
        node.focus();
        node.setSelectionRange(node.value.length, node.value.length);
      });
      await editor.press('End');
      await editor.press('Enter');
      await editor.pressSequentially('/reference');
      await editor.press('Enter');
      await expect(page.locator('#reference-modal-number')).toHaveValue('[2]');
      await page.locator('#reference-modal-number').fill('[1]');
      await page.locator('#reference-modal-url').fill('https://example.com/second');
      await page.locator('#reference-modal-url').press('Enter');
      await expect(editor).toHaveValue(first + '\n[2]\n[2]: https://example.com/second');
      await expect(editor).toBeFocused();
    });

    test('cancels insertion when the target changes during upload', async ({ page }) => {
      let releaseUpload;
      const pendingUpload = new Promise(resolve => { releaseUpload = resolve; });
      let uploadStarted = false;
      await page.route('**/api/image', async route => {
        uploadStarted = true;
        await pendingUpload;
        await route.fulfill({ json: { id: mediaId } });
      });
      await chooseUpload(page, editor);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect.poll(() => uploadStarted).toBe(true);
      await editor.evaluate(node => {
        node.value = 'Updated while upload was pending';
        node.dispatchEvent(new Event('input', { bubbles: true }));
      });
      releaseUpload();
      await expect(page.getByText('Media insertion cancelled', { exact: true })).toBeVisible();
      await expect(editor).toHaveValue('Updated while upload was pending');
      await page.locator('#image-modal-cancel').click();
    });

    test('cancels before uploading when the target changes during consent', async ({ page }) => {
      let uploadCount = 0;
      await page.route('**/api/image', route => {
        uploadCount += 1;
        return route.fulfill({ json: { id: mediaId } });
      });
      await chooseUpload(page, editor);
      await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
      await editor.evaluate(node => {
        node.value = 'Updated while consent was pending';
        node.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(page.locator('#image-modal-cancel')).toBeEnabled();
      await expect(editor).toHaveValue('Updated while consent was pending');
      expect(uploadCount).toBe(0);
      await page.locator('#image-modal-cancel').click();
    });

    test('restores only the target editor if saving the uploaded link fails', async ({ page }) => {
      await page.route('**/api/image', route => route.fulfill({ json: { id: mediaId } }));
      await mockMediaDownload(page);
      await chooseUpload(page, editor);
      await page.evaluate(() => {
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value, ...args) {
          if (this.name === 'contents' && value.content && value.content.includes('/api/image/')) {
            throw new DOMException('Injected media persistence failure', 'QuotaExceededError');
          }
          return originalPut.call(this, value, ...args);
        };
      });
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(page.getByText('The browser could not save the short media link.', { exact: true })).toBeVisible();
      await expect(editor).toHaveValue(prefix + suffix);
      await expect(page.locator('#image-modal-cancel')).toBeEnabled();
      await page.locator('#image-modal-cancel').click();
      await expectPersistedAfterReload(page, prefix + suffix);
    });
    test('all 22 entries have visible labels and icons; unsupported searches show no results', async ({ page }) => {
      await editor.fill('/');
      const menu = page.locator('#slash-command-menu');
      await expect(menu.getByRole('option')).toHaveCount(22);
      const entries = await menu.getByRole('option').evaluateAll(nodes => nodes.map(node => ({ label: node.querySelector('.app-menu-label').textContent, icon: node.querySelector('.lucide') ? getComputedStyle(node.querySelector('.lucide')).maskImage !== 'none' : !!node.querySelector('.slash-command-text-icon').textContent })));
      expect(entries.every(entry => entry.label && entry.icon)).toBe(true);
      for (const query of ['emoji', 'symbols', 'bold', 'italic', 'comment']) {
        await editor.fill('/' + query);
        await expect(menu.getByRole('option')).toHaveCount(0);
        await expect(menu).toContainText('No matching commands');
      }
    });
  });
}
