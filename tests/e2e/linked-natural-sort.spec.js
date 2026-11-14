const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

for (const kind of ['individual files', 'folder files', 'nested folders']) {
  test(`linked ${kind} use the Vault's natural numeric order`, async ({ page }) => {
    await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
    await openApp(page);
    await page.evaluate(async kind => {
      await Neutralino.filesystem.createDirectory('C:/Numbered');
      for (const number of [10, 2, 1]) {
        const title = number + '-notes';
        let path = 'C:/Numbered/' + title + '.md';
        if (kind === 'nested folders') {
          await Neutralino.filesystem.createDirectory('C:/Numbered/' + title);
          path = 'C:/Numbered/' + title + '/document.md';
        }
        __desktopFiles.set(path, '# ' + title);
        if (kind === 'individual files') await NL_IMPORT_EXTERNAL_FILE('# ' + title, title, path);
      }
      if (kind !== 'individual files') await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Numbered');
      await MarkdownViewerFlushWorkspace();
    }, kind);

    const rows = kind === 'nested folders'
      ? page.locator('#document-tree [data-tree-type="linked-virtual-folder"] .document-tree-label')
      : page.locator('#document-tree .is-linked-document .document-tree-label');
    await expect(rows).toHaveText(['1-notes', '2-notes', '10-notes']);
    await page.locator('#document-sidebar-collapse-all').click();
    await page.locator('#document-sidebar-collapse-all').click();
    await expect(rows).toHaveText(['1-notes', '2-notes', '10-notes']);
  });
}
