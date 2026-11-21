const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent, storedDocuments } = require('../helpers/app');

for (const scenario of ['identical edit', 'newer edit', 'storage failure']) {
  test(`a snapshot recipient finishes startup during recovery with ${scenario}`, async ({ page, context }) => {
    const recoveredBody = '# Snapshot recovery\n\nPending host edit.';
    const newerBody = '# Newer host edit\n\nKeep this newer document.';
    await openApp(page);
    await page.evaluate(() => window.MarkdownViewerFlushWorkspace());
    const id = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
    // Hold the sender's real autosave until the recipient reaches its recovery
    // commit. This forces the revision race independently of CPU/network speed.
    await page.evaluate(() => {
      const prototype = window.MarkdownWorkspaceStorage.prototype;
      const original = prototype.saveDocuments;
      const pending = [];
      prototype.saveDocuments = async function(...args) {
        await new Promise(resolve => pending.push(resolve));
        return original.apply(this, args);
      };
      window.__releaseHostSaves = () => {
        prototype.saveDocuments = original;
        pending.splice(0).forEach(resolve => resolve());
      };
    });
    try {
      await setEditorContent(page, recoveredBody);
      await page.locator('#share-button').click();
      await page.locator('#share-generate-btn').click();
      await expect(page.locator('#share-url-input')).toHaveValue(/#share=/);
      const hash = new URL(await page.locator('#share-url-input').inputValue()).hash;
      const guest = await context.newPage();
      await guest.exposeBinding('__commitHostBeforeRecovery', async () => {
        if (scenario === 'newer edit') await setEditorContent(page, newerBody);
        await page.evaluate(async () => {
          window.__releaseHostSaves();
          await window.MarkdownViewerFlushWorkspace();
        });
      });
      await guest.addInitScript(({ id, scenario }) => {
        document.addEventListener('DOMContentLoaded', () => {
          const prototype = window.MarkdownWorkspaceStorage.prototype;
          const original = prototype.saveDocuments;
          prototype.saveDocuments = async function(documents, organization, options) {
            if (!window.__recoveryRaceInjected && options?.changedIds?.includes(id)) {
              window.__recoveryRaceInjected = true;
              if (scenario === 'storage failure') throw Error('Injected recovery storage failure');
              await window.__commitHostBeforeRecovery();
            }
            return original.call(this, documents, organization, options);
          };
        }, { once: true });
      }, { id, scenario });
      const errors = await openApp(guest, '/' + hash, { expectEditorVisible: false });
      expect(await guest.evaluate(() => window.__recoveryRaceInjected)).toBe(true);
      await expect(guest.locator('#markdown-editor')).toHaveValue(recoveredBody);
      await expect(guest.locator('#markdown-editor')).toHaveJSProperty('readOnly', true);
      await expect(guest.locator('#markdown-preview')).toContainText('Pending host edit.');
      if (scenario === 'storage failure') {
        await expect(guest.locator('html')).toHaveAttribute('data-workspace-storage-state', 'error');
        expect(errors.some(error => error.includes('Injected recovery storage failure'))).toBe(true);
        expect(await guest.evaluate(() => Object.keys(localStorage).some(key =>
          key.startsWith('markdownViewerDirtyDocument:') && localStorage.getItem(key).includes('Pending host edit.')))).toBe(true);
      } else {
        expect(errors).toEqual([]);
        await expect(guest.locator('html')).toHaveAttribute('data-workspace-storage-state', 'ready');
        const saved = await storedDocuments(guest);
        expect(saved.find(document => document.id === id).content).toBe(scenario === 'newer edit' ? newerBody : recoveredBody);
        const copies = saved.filter(document => document.id !== id && document.content === recoveredBody);
        expect(copies).toHaveLength(scenario === 'newer edit' ? 1 : 0);
      }
    } finally {
      await page.evaluate(() => {
        window.__releaseHostSaves();
      });
    }
  });
}
