const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function openDesktop(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);window.NL_OS="Windows";window.NL_TOKEN="test-token";');
  await openApp(page);
  if (!(await page.locator('#document-tree').isVisible())) await page.locator('#document-sidebar-open').click();
}

for (const theme of ['light', 'dark']) {
  test(`ordinary documents render the plain file icon in ${theme} theme`, async ({ page }, testInfo) => {
    await openDesktop(page);
    await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
    await page.locator('#tab-new-btn').click();
    const tab = page.locator('#tab-list .tab-item.active');
    const id = await tab.getAttribute('data-tab-id');
    const row = page.locator(`#document-tree [data-document-id="${id}"]`);
    for (const icon of [row.locator('.lucide-file'), tab.locator('.lucide-file')]) {
      await expect(icon).toBeVisible();
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      const svg = await icon.evaluate(async node => {
        const mask = getComputedStyle(node).maskImage;
        const image = new Image();
        image.src = mask.match(/^url\(["']?(.*?)["']?\)$/)[1];
        await image.decode();
        return atob(image.src.split(',')[1]);
      });
      expect(svg).toContain('class="lucide lucide-file"');
      expect(svg).toContain('stroke-width="1.5"');
    }
    await expect(page.locator('#document-tree .lucide-book-open')).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath('file-icons.png') });
  });

  test(`linked actions use distinct official icons in ${theme} theme without changing Vault icons`, async ({ page }) => {
    await openDesktop(page);
    await page.evaluate(async theme => {
      document.documentElement.setAttribute('data-theme', theme);
      window.__desktopFiles.set('C:/Original/notes.md', '# Notes');
      await window.NL_IMPORT_EXTERNAL_FILE('# Notes', 'notes', 'C:/Original/notes.md');
    }, theme);
    await page.locator('#document-tree .is-linked-document').dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    const menu = page.locator('.document-menu-dropdown.open');
    const masks = [];
    for (const [action, icon] of [['Save', 'save'], ['Save As…', 'save-plus'], ['Open in File Explorer', 'folder-input'], ['Convert to Workspace copy', 'copy-plus']]) {
      const glyph = menu.getByRole('menuitem', { name: action, exact: true }).locator('.lucide-' + icon);
      await expect(glyph).toBeVisible();
      const mask = await glyph.evaluate(node => getComputedStyle(node).maskImage);
      expect(mask).not.toBe('none');
      masks.push(mask);
      const svg = Buffer.from(mask.match(/base64,([^"\)]+)/)[1], 'base64').toString('utf8');
      expect(svg).toContain('stroke-width="1.5"');
    }
    expect(new Set(masks).size).toBe(4);
    await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'Welcome to Markdown' }).dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await expect(menu.getByRole('menuitem', { name: 'Save As linked file…', exact: true }).locator('.lucide-save-plus')).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Save As…', exact: true })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Download Markdown', exact: true }).locator('.lucide-download')).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Duplicate', exact: true }).locator('.lucide-files')).toBeVisible();
    await expect(page.locator('#sidebar-new-document > .lucide-file-plus-2')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      await Neutralino.filesystem.createDirectory('C:/Original');
      Neutralino.os.showFolderDialog = async () => 'C:/Original';
      Neutralino.os.open = async path => { window.__openedFolder = path; };
    });
    await page.locator('#sidebar-link-folder').click();
    const folder = page.locator('#document-tree [data-tree-type="linked-location"]');
    await expect(folder).toHaveCount(1);
    await folder.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    const openFolder = menu.getByRole('menuitem', { name: 'Open folder', exact: true });
    expect(await openFolder.locator('.lucide-folder-input').evaluate(node => getComputedStyle(node).maskImage)).toBe(masks[2]);
    await expect(menu.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).locator('.lucide-copy-plus')).toBeVisible();
    await openFolder.click();
    expect(await page.evaluate(() => window.__openedFolder)).toBe('C:/Original');
  });
}

test('desktop Download Markdown exports without a link while Save As creates and focuses a linked copy', async ({ page }) => {
  await openDesktop(page);
  await page.locator('#markdown-editor').fill('# My Vault draft');
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Exports');
    Neutralino.os.showSaveDialog = async () => 'C:/Exports/download.md';
  });
  const vault = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'Welcome to Markdown' });
  const menu = page.locator('.document-menu-dropdown.open');
  await vault.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await menu.getByRole('menuitem', { name: 'Download Markdown', exact: true }).click();
  await expect(page.locator('.app-toast').filter({ hasText: 'Saved to C:/Exports/download.md' })).toBeVisible();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Exports/download.md'))).toBe('# My Vault draft');
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(0);
  await expect(page.locator('.tab-item.active .tab-title')).toHaveText('Welcome to Markdown');
  await page.evaluate(() => { Neutralino.os.showSaveDialog = async () => 'C:/Exports/linked-copy.md'; });
  await vault.dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await menu.getByRole('menuitem', { name: 'Save As linked file…', exact: true }).click();
  await expect(page.locator('.tab-item.active .tab-title')).toHaveText('linked-copy');
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(1);
  await expect(vault).toHaveCount(1);
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Exports/linked-copy.md'))).toBe('# My Vault draft');
});
