const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function setup(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Original');
    window.__desktopFiles.set('C:/Original/notes.md', '# disk');
    await window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
    await window.MarkdownViewerFlushWorkspace();
  });
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^notes$/ }).click();
}

async function pauseScan(page, phase = 'read') {
  await page.evaluate(phase => {
    if (phase === 'hash') {
      window.__desktopFiles.set('C:/Original/notes.md', '# paused hash from scan');
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      let paused = false;
      crypto.subtle.digest = async (algorithm, data) => {
        if (!paused && new TextDecoder().decode(data) === '# paused hash from scan') {
          paused = true;
          window.__scanPaused = true;
          await new Promise(resolve => { window.__releaseScan = resolve; });
        }
        return digest(algorithm, data);
      };
      window.__scanPromise = window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
      return;
    }
    const read = Neutralino.filesystem.readFile;
    let paused = false;
    Neutralino.filesystem.readFile = async path => {
      const body = await read(path);
      if (path === 'C:/Original/notes.md' && !paused) {
        paused = true;
        window.__scanPaused = true;
        await new Promise(resolve => { window.__releaseScan = resolve; });
      }
      return body;
    };
    window.__scanPromise = window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
  }, phase);
  await expect.poll(() => page.evaluate(() => window.__scanPaused)).toBe(true);
}

async function finishScan(page) {
  await page.evaluate(async () => { window.__releaseScan(); await window.__scanPromise; await window.MarkdownViewerFlushWorkspace(); });
}

async function state(page) {
  return page.evaluate(async () => {
    await window.MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const docs = await storage.listDocumentMetadata();
    return { docs, org: await storage.getDocumentOrganization(), bodies: await Promise.all(docs.filter(x => x.title === 'notes').map(x => storage.loadDocumentContent(x.id))), original: window.__desktopFiles.get('C:/Original/notes.md') };
  });
}

test('an open paused in the managed-Vault guard cannot replace a later successful save', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    let paused = false;
    Neutralino.filesystem.getNormalizedPath = async path => {
      if (!paused) {
        paused = true;
        window.__guardPaused = true;
        await new Promise(resolve => { window.__releaseGuard = resolve; });
      }
      return path;
    };
    window.__pendingOpen = NL_OPEN_EXTERNAL_MARKDOWN_FILE('C:/Original/notes.md');
  });
  await expect.poll(() => page.evaluate(() => window.__guardPaused)).toBe(true);
  await page.locator('#markdown-editor').fill('# saved while guard waited');
  await page.locator('#markdown-editor').press('Control+s');
  await expect(page.getByText('Original file updated', { exact: true })).toBeVisible();
  await page.evaluate(async () => { window.__releaseGuard(); await window.__pendingOpen; });
  await expect(page.locator('#markdown-editor')).toHaveValue('# saved while guard waited');
  const saved = await state(page);
  expect(saved.original).toBe('# saved while guard waited');
  expect(saved.bodies).toEqual(['# saved while guard waited']);
  expect(saved.docs.find(item => item.title === 'notes').sourceConflict).toBe(false);
});

for (const phase of ['read', 'hash']) {
  test(`a scan paused during ${phase} cannot roll back a later successful Ctrl+S`, async ({ page }) => {
    await setup(page);
    await pauseScan(page, phase);
    await page.locator('#markdown-editor').fill('# saved after scan began');
    await page.locator('#markdown-editor').press('Control+s');
    if (phase === 'hash') await page.getByRole('button', { name: 'Overwrite original', exact: true }).click();
    await expect(page.getByText('Original file updated', { exact: true })).toBeVisible();
    await finishScan(page);
    await expect(page.locator('#markdown-editor')).toHaveValue('# saved after scan began');
    const saved = await state(page);
    expect(saved.original).toBe('# saved after scan began');
    expect(saved.bodies).toContain('# saved after scan began');
    expect(saved.docs.find(x => x.title === 'notes').sourceConflict).toBe(false);
  });
}

test('a delayed individual reload cannot roll back a later successful Ctrl+S', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const read = Neutralino.filesystem.readFile;
    let once = false;
    Neutralino.filesystem.readFile = async (path, options) => {
      const body = await read(path, options);
      if (path === 'C:/Original/notes.md' && !once) {
        once = true; window.__scanPaused = true;
        await new Promise(resolve => { window.__releaseScan = resolve; });
      }
      return body;
    };
  });
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^notes$/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Reload from disk', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__scanPaused)).toBe(true);
  await page.locator('#markdown-editor').fill('# saved after reload began');
  await page.locator('#markdown-editor').press('Control+s');
  await expect(page.getByText('Original file updated', { exact: true })).toBeVisible();
  await page.evaluate(() => window.__releaseScan());
  await expect(page.locator('#markdown-editor')).toHaveValue('# saved after reload began');
  expect((await state(page)).bodies).toContain('# saved after reload began');
});

test('a file-association launch paused before linked-open cannot roll back Ctrl+S', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const read = Neutralino.filesystem.readFile; let paused = false;
    Neutralino.filesystem.readFile = async (...args) => {
      const body = await read(...args);
      if (args[0] === 'C:/Original/notes.md' && !paused) {
        paused = true; window.__launchPaused = true;
        await new Promise(resolve => { window.__releaseLaunch = resolve; });
      }
      return body;
    };
    window.__launch = NL_OPEN_EXTERNAL_MARKDOWN_FILE('C:/Original/notes.md');
  });
  await expect.poll(() => page.evaluate(() => window.__launchPaused)).toBe(true);
  await setEditorContent(page, '# new saved after launch started');
  await page.locator('#markdown-editor').press('Control+s');
  await expect(page.locator('.app-toast').filter({ hasText: 'Original file updated' })).toBeVisible();
  await page.evaluate(async () => { __releaseLaunch(); await __launch; });
  await expect(page.locator('#markdown-editor')).toHaveValue('# new saved after launch started');
  expect((await state(page)).bodies).toEqual(['# new saved after launch started']);
});

for (const phase of ['read', 'hash']) {
for (const action of ['Convert to Workspace copy', 'Remove linked file']) {
  test(`an in-flight scan ${phase} cannot restore a file after ${action}`, async ({ page }) => {
    await setup(page);
    await setEditorContent(page, '# retained local draft');
    await pauseScan(page, phase);
    const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^notes$/ });
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: action, exact: true }).click();
    await expect(page.locator('.app-toast').filter({ hasText: action === 'Remove linked file' ? 'Linked file closed' : 'Converted to Workspace copy' })).toBeVisible();
    await finishScan(page);
    const result = await state(page);
    expect(result.docs.filter(x => x.sourcePath === 'C:/Original/notes.md')).toHaveLength(0);
    expect(result.org.linkedLocations[0].excludedPaths).toContain('notes.md');
    expect(result.bodies).toEqual(action === 'Remove linked file' ? [] : ['# retained local draft']);
    expect(result.original).toBe(phase === 'hash' ? '# paused hash from scan' : '# disk');
    // A new intentional rescan after the mutation still restores the link.
    await page.evaluate(() => window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original'));
    expect((await state(page)).docs.filter(x => x.sourcePath === 'C:/Original/notes.md')).toHaveLength(1);
  });
}
}

test('a removed linked root cannot receive late scan results or ghost file associations', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__desktopFiles.set('C:/Original/new.md', '# discovered late'); });
  await pauseScan(page);
  await page.locator('#document-tree [data-tree-type="linked-location"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Remove linked folder', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Remove linked folder', exact: true }).getByRole('button', { name: 'Remove link', exact: true }).click();
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder unlinked' })).toBeVisible();
  await finishScan(page);
  const result = await state(page);
  expect(result.org.linkedLocations).toEqual([]);
  expect(result.docs.filter(x => x.linkedRootId || x.sourcePath)).toEqual([]);
  expect(result.original).toBe('# disk');
});

test('a newer queued rescan supersedes an older pending read', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__desktopFiles.set('C:/Original/notes.md', '# older scan snapshot'); });
  await pauseScan(page);
  await page.evaluate(() => {
    window.__desktopFiles.set('C:/Original/notes.md', '# newest scan snapshot');
    window.__newerScan = window.NL_LINK_MARKDOWN_FOLDER_PATH('C:/Original');
  });
  await finishScan(page);
  await page.evaluate(async () => { await window.__newerScan; await window.MarkdownViewerFlushWorkspace(); });
  expect((await state(page)).bodies).toEqual(['# newest scan snapshot']);
});

test('folder removal includes links discovered while its confirmation is open', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__desktopFiles.set('C:/Original/new.md', '# discovered during confirmation'); });
  await pauseScan(page);
  await page.locator('#document-tree [data-tree-type="linked-location"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Remove linked folder', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Remove linked folder', exact: true });
  await expect(confirmation).toBeVisible();
  await finishScan(page);
  expect((await state(page)).docs.filter(x => x.linkedRootId)).toHaveLength(2);
  await confirmation.getByRole('button', { name: 'Remove link', exact: true }).click();
  await expect(page.locator('.app-toast').filter({ hasText: 'Folder unlinked' })).toBeVisible();
  const result = await state(page);
  expect(result.org.linkedLocations).toEqual([]);
  expect(result.docs.filter(x => x.linkedRootId)).toEqual([]);
});
