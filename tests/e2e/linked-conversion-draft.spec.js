const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function setup(page, secondary) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/convert.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'convert', 'C:/Original/convert.md');
    await window.MarkdownViewerFlushWorkspace();
  });
  const id = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  if (secondary) {
    await page.locator('#tab-new-btn').click();
    await page.locator('#markdown-editor').fill('# unrelated primary');
    await page.locator('#tab-list .tab-item.active').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Open in split view', exact: true }).click();
    await page.locator('#document-split-destination').selectOption(id);
    await page.locator('#document-split-modal-confirm').click();
    await expect(page.locator('#document-split-modal')).not.toBeVisible();
  }
  return { id, selector: secondary ? '#document-split-editor' : '#markdown-editor',
    row: page.locator(`#document-tree [data-document-id="${id}"]`) };
}
async function stored(page, id) {
  return page.evaluate(async id => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    const record = (await storage.listDocumentMetadata()).find(item => item.id === id);
    return { linked: Boolean(record.sourcePath), content: await storage.loadDocumentContent(id),
      original: window.__desktopFiles.get('C:/Original/convert.md') };
  }, id);
}

for (const secondary of [false, true]) {
  test(`${secondary ? 'secondary' : 'primary'} menu conversion captures input before debounce`, async ({ page }) => {
    const { id, selector, row } = await setup(page, secondary);
    await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await page.evaluate(selector => {
      const editor = document.querySelector(selector);
      editor.value = '# typed just before conversion';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      Array.from(document.querySelectorAll('.document-menu-context.open [role="menuitem"]'))
        .find(item => item.textContent.includes('Convert to Workspace copy')).click();
    }, selector);
    await expect(page.locator('.app-toast').filter({ hasText: 'Converted to Workspace copy' })).toBeVisible();
    expect(await stored(page, id)).toEqual({ linked: false, content: '# typed just before conversion', original: '# original' });
    await expect(page.locator(selector)).toHaveValue('# typed just before conversion');
    if (secondary) await expect(page.locator('#markdown-editor')).toHaveValue('# unrelated primary');
  });

  test(`${secondary ? 'secondary' : 'primary'} failed conversion preserves edits made while persistence is pending`, async ({ page }) => {
    const { id, selector, row } = await setup(page, secondary);
    await page.evaluate(() => {
      const save = window.MarkdownWorkspaceStorage.prototype.saveDocuments;
      let intercepted = false;
      window.MarkdownWorkspaceStorage.prototype.saveDocuments = async function(documents, ...args) {
        if (!intercepted && documents.some(item => item.title === 'convert' && !item.sourcePath)) {
          intercepted = true;
          window.__conversionPending = true;
          await new Promise(resolve => { window.__releaseConversion = resolve; });
          throw new Error('Simulated conversion write failure');
        }
        return save.call(this, documents, ...args);
      };
    });
    await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await page.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).click();
    await page.waitForFunction(() => window.__conversionPending === true);
    await page.locator(selector).fill('# newer text while converting');
    await page.evaluate(() => window.__releaseConversion());
    await expect(page.locator('.app-toast').filter({ hasText: 'Conversion failed' })).toBeVisible();
    await expect(row).toHaveClass(/is-linked-document/);
    await expect(page.locator(selector)).toHaveValue('# newer text while converting');
    await page.evaluate(() => window.MarkdownViewerFlushWorkspace());
    expect(await stored(page, id)).toEqual({ linked: true, content: '# newer text while converting', original: '# original' });
    await expect(page.locator('.app-toast').filter({ hasText: 'Converted to Workspace copy' })).toHaveCount(0);
  });
}

test('HTML sidebar drop captures immediate live input before conversion', async ({ page }) => {
  const { id, row } = await setup(page, false);
  await page.evaluate(id => {
    const editor = document.querySelector('#markdown-editor');
    editor.value = '# fresh drop draft';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    const transfer = new DataTransfer();
    transfer.setData('application/x-markdown-viewer-document', id);
    const target = Array.from(document.querySelectorAll('#document-tree [data-tree-type="workspace"]'))
      .find(item => item.textContent.includes('Workspace (Vault)'));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, id);
  await expect(page.locator('.app-toast').filter({ hasText: 'Converted to Workspace copy' })).toBeVisible();
  await expect(row).not.toHaveClass(/is-linked-document/);
  expect(await stored(page, id)).toEqual({ linked: false, content: '# fresh drop draft', original: '# original' });
});

test('successful conversion retains edits arriving after the disk write snapshot was captured', async ({ page }) => {
  const { id, row } = await setup(page, false);
  await page.evaluate(() => {
    const write = Neutralino.filesystem.writeFile;
    let intercepted = false;
    Neutralino.filesystem.writeFile = async (path, content) => {
      if (!intercepted && /\/Workspace\/convert-/.test(path)) {
        intercepted = true;
        window.__conversionPending = true;
        await new Promise(resolve => { window.__releaseConversion = resolve; });
      }
      return write(path, content);
    };
  });
  await row.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await page.locator('#markdown-editor').fill('# snapshot before conversion write');
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).click();
  await page.waitForFunction(() => window.__conversionPending === true);
  await page.locator('#markdown-editor').fill('# newer draft during disk write');
  await page.evaluate(() => window.__releaseConversion());
  await expect(page.locator('.app-toast').filter({ hasText: 'Converted to Workspace copy' })).toBeVisible();
  await expect(page.locator('#markdown-editor')).toHaveValue('# newer draft during disk write');
  await page.evaluate(() => window.MarkdownViewerFlushWorkspace());
  expect(await stored(page, id)).toEqual({ linked: false, content: '# newer draft during disk write', original: '# original' });
});
