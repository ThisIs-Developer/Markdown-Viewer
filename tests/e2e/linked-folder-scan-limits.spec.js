const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function setup(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Original');
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    window.__desktopFiles.set('C:/Original/archived.md', '# converted');
    await window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
  });
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^archived$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Convert to Workspace copy', exact: true }).click();
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^notes$/ }).click();
  await setEditorContent(page, '# Kept local draft');
}

async function rescan(page) {
  await page.locator('#document-tree [data-tree-type="linked-location"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rescan folder', exact: true }).click();
  await expect(page.getByText('Folder scan stopped', { exact: true })).toBeVisible();
}

async function snapshot(page) {
  return page.evaluate(async () => {
    await window.MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const docs = await storage.listDocumentMetadata();
    // The editor's ordinary debounced save may advance its internal revision
    // while the scan runs; compare content and all user/source metadata instead.
    const comparableDocs = docs.map(({ _storageRevision, ...doc }) => doc);
    return { docs: comparableDocs, org: await storage.getDocumentOrganization(),
      bodies: await Promise.all(docs.map(doc => storage.loadDocumentContent(doc.id))) };
  });
}

test('oversized scan stops before reads and preserves drafts, exclusions and successful scan state', async ({ page }) => {
  await setup(page);
  const before = await snapshot(page);
  expect(before.org.linkedLocations[0].excludedPaths).toContain('archived.md');
  await page.evaluate(() => {
    const stats = Neutralino.filesystem.getStats;
    Neutralino.filesystem.getStats = async path => path === 'C:/Original/huge.md' ? { size: 21 * 1024 * 1024, isFile: true } : stats(path);
    window.__desktopFiles.set('C:/Original/huge.md', '# Not actually large');
    const read = Neutralino.filesystem.readFile;
    window.__sourceReads = [];
    Neutralino.filesystem.readFile = async (path, options) => {
      if (path.startsWith('C:/Original/')) window.__sourceReads.push(path);
      return read(path, options);
    };
  });
  await rescan(page);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Kept local draft');
  expect(await snapshot(page)).toEqual(before);
  expect(await page.evaluate(() => window.__sourceReads)).toEqual([]);
});

test('later read failure applies no staged content and does not mark previously linked sources missing', async ({ page }) => {
  await setup(page);
  const before = await snapshot(page);
  await page.evaluate(() => {
    window.__desktopFiles.set('C:/Original/notes.md', '# changed externally');
    window.__desktopFiles.set('C:/Original/failing.md', '# inaccessible');
    const read = Neutralino.filesystem.readFile;
    Neutralino.filesystem.readFile = async (path, options) => {
      if (path === 'C:/Original/failing.md') throw new Error('Permission denied');
      return read(path, options);
    };
  });
  await rescan(page);
  expect(await snapshot(page)).toEqual(before);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Kept local draft');
  await expect(page.locator('#document-tree .is-source-conflict')).toHaveCount(0);
});

test('junction-like recursion is bounded without modifying the workspace', async ({ page }) => {
  await setup(page);
  const before = await snapshot(page);
  await page.evaluate(() => {
    const read = Neutralino.filesystem.readDirectory;
    window.__visitedDirectories = 0;
    Neutralino.filesystem.readDirectory = async path => {
      if (!path.startsWith('C:/Original')) return read(path);
      window.__visitedDirectories++;
      return [{ entry: 'cycle', type: 'DIRECTORY' }];
    };
  });
  await rescan(page);
  expect(await page.evaluate(() => window.__visitedDirectories)).toBe(33);
  expect(await snapshot(page)).toEqual(before);
});
