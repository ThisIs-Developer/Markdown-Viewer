const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');
test.beforeEach(async ({page}) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS="Windows";');
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/safe.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'safe', 'C:/Original/safe.md');
    await window.MarkdownViewerFlushWorkspace();
  });
  await page.locator('#markdown-editor').fill('# recovery draft');
});
for (const phase of ['partial-write','verification','read-denied','stat-denied','recovery-failed','recovery-missing','recovery-corrupt']) {
  test('linked Save retains draft on ' + phase, async ({page}) => {
    await page.evaluate(phase => {
      const api = Neutralino.filesystem, write = api.writeFile, read = api.readFile, stat = api.getStats;
      let wrote = false;
      api.writeFile = async (p,text) => {
        if(p==='C:/Original/safe.md') {
          wrote=true;
          if(phase==='partial-write') { await write(p,'partial'); throw new Error('Disk full'); }
        }
        return write(p,text);
      };
      api.readFile = async p => {
        if(p==='C:/Original/safe.md' && (phase==='read-denied' || (phase==='verification' && wrote))) throw new Error('Read denied');
        return read(p);
      };
      api.getStats = async p => {
        if(p==='C:/Original/safe.md' && phase==='stat-denied') throw {code:'NE_FS_NOPATHE'};
        return stat(p);
      };
      if(phase==='recovery-failed') window.MarkdownWorkspaceStorage.prototype.saveDocuments = async () => { throw new Error('Storage unavailable'); };
      if (phase === 'recovery-missing' || phase === 'recovery-corrupt') {
        const load = MarkdownWorkspaceStorage.prototype.loadDocumentContent;
        MarkdownWorkspaceStorage.prototype.loadDocumentContent = async function(id, options) {
          if (options && options.fresh) {
            const doc = this.vaultIndex.documents.find(x => x.id === id);
            const path = this.vaultPath + '/' + doc.vaultRelativePath;
            if (phase === 'recovery-missing') __desktopFiles.delete(path);
            else __desktopFiles.set(path, '# corrupted recovery');
          }
          return load.call(this, id, options);
        };
      }
    }, phase);
    await page.locator('#markdown-editor').press('Control+s');
    const failure = page.locator('.app-toast').filter({hasText:'Save failed'});
    await expect(failure).toBeVisible();
    await expect(page.locator('#markdown-editor')).toHaveValue('# recovery draft');
    await expect(page.getByRole('alertdialog', { name: 'Recreate linked file?', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/safe.md'))).toBe(phase==='partial-write' ? 'partial' : phase==='verification' ? '# recovery draft' : '# original');
    if(['partial-write','verification'].includes(phase)) {
      await expect(failure).toContainText('original may be incomplete');
      expect(await page.evaluate(async () => {
        const storage = new window.MarkdownWorkspaceStorage(); await storage.init();
        const meta = (await storage.listDocumentMetadata()).find(x => x.sourcePath==='C:/Original/safe.md');
        return storage.loadDocumentContent(meta.id);
      })).toBe('# recovery draft');
    }
    expect(await page.evaluate(() => Array.from(window.__desktopFiles.keys()).some(p=>p.includes('.markdown-viewer-')))).toBe(false);
  });
}
