const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

test('an edit arriving as an older save finishes keeps its browser recovery journal', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const prototype = window.MarkdownWorkspaceStorage.prototype;
    const save = prototype.saveDocuments;
    prototype.saveDocuments = async function(documents, ...args) {
      const shouldInject = !window.__newJournalInjected && documents.some(tab => tab.content === '# Older snapshot');
      const result = await save.call(this, documents, ...args);
      if (shouldInject) {
        const editor = document.querySelector('#markdown-editor');
        editor.value = '# Newer recovery draft';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        window.__newJournalInjected = true;
        // Observe after the old flush cleanup, before the next debounced save.
        setTimeout(() => {
          window.__journalAfterOldSave = Object.keys(localStorage)
            .filter(key => key.startsWith('markdownViewerDirtyDocument:'))
            .map(key => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } })
            .filter(Boolean);
        }, 100);
      }
      return result;
    };
  });
  await setEditorContent(page, '# Older snapshot');
  await page.waitForFunction(() => window.__journalAfterOldSave);
  const records = await page.evaluate(() => window.__journalAfterOldSave);
  expect(records.some(record => record.content === '# Newer recovery draft')).toBe(true);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Newer recovery draft');
});

test('IndexedDB compare-and-delete retains a replacement record and deletes a matching record', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    const old = { journalId: 'conditional-journal-test', documentId: 'test-document', content: 'OLD', savedAt: 1 };
    const newer = { ...old, content: 'NEW', savedAt: 2 };
    await storage.saveDirtyJournal(old);
    await storage.saveDirtyJournal(newer);
    await storage.deleteDirtyJournals([old.journalId], { expectedJournals: { [old.journalId]: old } });
    const retained = (await storage.listDirtyJournals()).find(record => record.journalId === old.journalId);
    await storage.deleteDirtyJournals([old.journalId], { expectedJournals: { [old.journalId]: newer } });
    return { retained: retained?.content, remaining: (await storage.listDirtyJournals()).some(record => record.journalId === old.journalId) };
  });
  expect(result).toEqual({ retained: 'NEW', remaining: false });
});
