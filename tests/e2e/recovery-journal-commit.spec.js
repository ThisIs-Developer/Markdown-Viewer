const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, storedDocuments, waitForAppReady } = require('../helpers/app');

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

for (const journalStorage of ['localStorage', 'sessionStorage', 'indexedDB']) {
  for (const sourceState of ['changed', 'missing']) {
    test(`${journalStorage} recovery of a ${sourceState} original does not create another copy after reopening`, async ({ page }) => {
      await openApp(page);
      await setEditorContent(page, '# Persisted original');
      if (journalStorage === 'localStorage' && sourceState === 'changed') {
        await page.locator('#review-toggle').click();
        await page.locator('#markdown-preview h1').evaluate(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const selection = window.getSelection();
          selection.removeAllRanges(); selection.addRange(range);
          element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        });
        await page.locator('#review-new-comment').click();
        await page.locator('#review-feedback-input').fill('Keep this recovered comment.');
        await page.locator('#review-feedback-submit').click();
      }
      await page.evaluate(() => window.MarkdownViewerFlushWorkspace());
      const original = (await storedDocuments(page)).find(item => item.content === '# Persisted original');
      expect(original.storageRevision).toBeGreaterThan(0);
      const documentId = sourceState === 'missing' ? 'missing-' + original.id : original.id;
      const key = 'markdownViewerDirtyDocument:interrupted-writer:' + encodeURIComponent(documentId);
      await page.evaluate(async ({ documentId, original, key, journalStorage }) => {
        const journal = {
          version: 1, writerId: 'interrupted-writer', documentId,
          expectedRevision: original.storageRevision - 1,
          savedAt: Date.now(), content: '# Recovered draft',
          metadata: { title: 'Recovery test', workspaceId: original.workspaceId, reviewThreads: original.reviewThreads || [] }
        };
        if (journalStorage !== 'indexedDB') window[journalStorage].setItem(key, JSON.stringify(journal));
        else {
          const storage = new window.MarkdownWorkspaceStorage();
          await storage.init();
          await storage.saveDirtyJournal({ ...journal, journalId: key });
        }
      }, { documentId, original, key, journalStorage });

      let recoveredId;
      for (let reopen = 0; reopen < 3; reopen++) {
        await page.reload();
        await waitForAppReady(page);
        const documents = await storedDocuments(page);
        const copies = documents.filter(item => item.content === '# Recovered draft');
        expect(copies).toHaveLength(1);
        expect(copies[0].reviewThreads).toEqual(original.reviewThreads || []);
        expect(documents.find(item => item.id === original.id).content).toBe('# Persisted original');
        if (recoveredId) expect(copies[0].id).toBe(recoveredId);
        recoveredId = copies[0].id;
        const retained = await page.evaluate(async ({ key, journalStorage }) => {
          if (journalStorage !== 'indexedDB') return !!window[journalStorage].getItem(key);
          const storage = new window.MarkdownWorkspaceStorage(); await storage.init();
          return (await storage.listDirtyJournals()).some(record => record.journalId === key);
        }, { key, journalStorage });
        expect(retained).toBe(false);
      }
    });
  }
}
