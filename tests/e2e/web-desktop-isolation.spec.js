const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

for (const partialRuntime of [false, true]) {
  test(`web keeps linked recovery documents usable without native controls (${partialRuntime ? 'partial library' : 'no runtime'})`, async ({ page }) => {
    await page.addInitScript(partial => {
      if (partial) { window.Neutralino = {}; window.NL_PORT = 1; }
      localStorage.setItem('markdownViewerTabs', JSON.stringify([{
        id: 'recovered-linked', title: 'Recovered', content: '# recovery draft',
        sourcePath: 'C:/Original/recovered.md', sourceMissing: true, sourceConflict: true,
        favorite: true, isOpen: true, workspaceId: 'workspace_default',
        createdAt: 1, lastOpenedAt: 1, lastEditedAt: 1
      }]));
    }, partialRuntime);
    await openApp(page);
    const tree = page.locator('#document-tree');
    await expect(tree).not.toContainText('Workspace (Vault)');
    const row = tree.locator('[data-document-id="recovered-linked"]');
    await expect(tree.locator('[data-tree-type="linked-workspace"]')).toHaveCount(0);
    for (const filter of ['all', 'recent', 'favorites']) {
      await page.locator(`[data-document-filter="${filter}"]`).click();
      await expect(row).toBeVisible();
      await expect(row).not.toHaveClass(/is-linked-document|is-source-missing|is-source-conflict/);
      await expect(row.locator('.lucide-file-text')).toHaveCount(1);
      await expect(row.locator('.document-tree-main')).toHaveAttribute('title','Recovered');
      await expect(row).toHaveAttribute('draggable','true');
      await row.dispatchEvent('contextmenu', {clientX:120,clientY:120});
      const menu = page.locator('.document-menu-context.open');
      for (const action of ['Save','Save As…','Reload from disk','Open containing folder','Convert to Workspace copy','Remove linked file']) {
        await expect(menu.getByRole('menuitem',{name:action,exact:true})).toHaveCount(0);
      }
      await expect(menu.getByRole('menuitem',{name:'Download Markdown',exact:true})).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('#sidebar-link-files')).toBeHidden();
    await expect(page.locator('#sidebar-link-folder')).toBeHidden();
    await row.locator('.document-tree-main').click();
    await expect(page.locator('#markdown-editor')).toHaveValue('# recovery draft');
    await expect(page.locator('#save-status')).not.toContainText('updates original');
    const download = page.waitForEvent('download');
    await page.locator('#markdown-editor').dispatchEvent('keydown',{key:'σ',code:'KeyS',ctrlKey:true});
    expect((await download).suggestedFilename()).toBe('Recovered.md');
    await page.evaluate(async () => {
      await window.NL_IMPORT_EXTERNAL_FILE('# ignored','Ignored','C:/Ignored.md');
    });
    await expect(tree.locator('[data-tree-type="document"]')).toHaveCount(1);
    await expect(page.locator('.app-toast').filter({hasText:'Save failed'})).toHaveCount(0);
  });
}

test('standard desktop HTML dragging converts a linked document without the custom pointer layer', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original','notes','C:/Original/notes.md');
  });
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'notes'});
  const root = page.locator('#document-tree [data-tree-type="workspace"]').filter({hasText:'Workspace (Vault)'});
  await expect(row).toHaveAttribute('draggable','true');
  await row.locator('.document-tree-main').dragTo(root);
  await expect(row).not.toHaveClass(/is-linked-document/);
  await expect(row).toHaveAttribute('data-tree-depth','1');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# original');
});
