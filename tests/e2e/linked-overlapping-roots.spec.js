const {test, expect} = require('@playwright/test');
const {openApp} = require('../helpers/app');
const {installDesktopFilesystem} = require('../helpers/desktop-filesystem');

async function setup(page, childFirst = false) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS="Windows";');
  await openApp(page);
  await page.evaluate(async childFirst => {
    window.__linkedEvents = {};
    window.__linkedWatchers = new Map();
    let nextWatcher = 1;
    Neutralino.events.on = async (name, handler) => { __linkedEvents[name] = handler; };
    Neutralino.filesystem.createWatcher = async path => {
      const id = nextWatcher++; __linkedWatchers.set(id, path); return id;
    };
    Neutralino.filesystem.removeWatcher = async id => __linkedWatchers.delete(id);
    await Neutralino.filesystem.createDirectory('C:/Parent');
    await Neutralino.filesystem.createDirectory('C:/Parent/Sub');
    __desktopFiles.set('C:/Parent/Sub/Note.md', '# original');
    for (const root of childFirst ? ['C:/Parent/Sub', 'C:/Parent'] : ['C:/Parent', 'C:/Parent/Sub']) {
      await NL_LINK_MARKDOWN_FOLDER_PATH(root);
    }
    await NL_START_LINKED_MONITORING();
    await MarkdownViewerFlushWorkspace();
  }, childFirst);
}

const note = page => page.locator('#document-tree .is-linked-document').filter({hasText:/^Note$/});
async function action(page, name) {
  await note(page).click({button:'right'});
  await page.getByRole('menuitem', {name, exact:true}).click();
}

async function state(page) {
  return page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return {roots:(await storage.getDocumentOrganization()).linkedLocations,
      docs:await storage.listDocumentMetadata(), original:__desktopFiles.get('C:/Parent/Sub/Note.md')};
  });
}

async function refresh(page, watcher = false) {
  const before = (await state(page)).roots.map(root => [root.id, root.lastScanAt]);
  await page.evaluate(watcher => {
    if (watcher) __linkedWatchers.forEach((_, id) => __linkedEvents.watchFile({detail:{id}}));
    else __linkedEvents.windowFocus();
  }, watcher);
  await expect.poll(async () => {
    const after = (await state(page)).roots;
    return before.every(([id, time]) => after.find(root => root.id === id)?.lastScanAt > time);
  }).toBe(true);
}

for (const childFirst of [false, true]) {
  test(`removed links stay removed on focus and watcher refresh (${childFirst ? 'child' : 'parent'} linked first)`, async ({page}) => {
    await setup(page, childFirst);
    await expect(note(page)).toHaveCount(1);
    await action(page, 'Remove linked file');
    await expect(note(page)).toHaveCount(0);
    const result = await state(page);
    expect(result.roots.find(root => root.path === 'C:/Parent').excludedPaths).toContain('Sub/Note.md');
    expect(result.roots.find(root => root.path === 'C:/Parent/Sub').excludedPaths).toContain('Note.md');
    await refresh(page);
    await refresh(page, true);
    await expect(note(page)).toHaveCount(0);
    expect((await state(page)).original).toBe('# original');
  });
}

test('explicit rescan restores one link and continues monitoring it without duplicates', async ({page}) => {
  await setup(page);
  await action(page, 'Remove linked file');
  await expect(note(page)).toHaveCount(0);
  const root = (await state(page)).roots.find(root => root.path === 'C:/Parent');
  await page.locator(`#document-tree [data-tree-id="${root.id}"][data-tree-type="linked-location"]`).click({button:'right'});
  await page.getByRole('menuitem', {name:'Rescan folder', exact:true}).click();
  await expect(note(page)).toHaveCount(1);
  await page.evaluate(() => __desktopFiles.set('C:/Parent/Sub/Note.md', '# updated externally'));
  await refresh(page, true);
  await expect(note(page)).toHaveCount(1);
  await note(page).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# updated externally');
});

test('conversion excludes the original from all covering roots but keeps the Vault draft', async ({page}) => {
  await setup(page);
  await action(page, 'Convert to Workspace copy');
  await expect(page.getByText('Converted to Workspace copy', {exact:true})).toBeVisible();
  await refresh(page);
  await expect(note(page)).toHaveCount(0);
  const result = await state(page);
  expect(result.docs.filter(doc => doc.title === 'Note')).toHaveLength(1);
  expect(result.docs.find(doc => doc.title === 'Note').sourcePath).toBeUndefined();
  expect(result.original).toBe('# original');
});

test('failed deletion rolls back every newly added exclusion and permits retry', async ({page}) => {
  await setup(page);
  await page.evaluate(() => {
    const remove = MarkdownWorkspaceStorage.prototype.deleteDocument;
    window.__restoreDelete = () => { MarkdownWorkspaceStorage.prototype.deleteDocument = remove; };
    MarkdownWorkspaceStorage.prototype.deleteDocument = async function() { throw Error('Injected deletion failure'); };
  });
  await action(page, 'Remove linked file');
  await expect(page.getByText('Delete failed', {exact:true})).toBeVisible();
  await expect.poll(async () => (await state(page)).roots.every(root => !root.excludedPaths.length)).toBe(true);
  await page.evaluate(() => __restoreDelete());
  await refresh(page);
  await expect(note(page)).toHaveCount(1);
  await action(page, 'Remove linked file');
  await expect(note(page)).toHaveCount(0);
  await refresh(page, true);
  await expect(note(page)).toHaveCount(0);
});

test('a covering-root read already in flight cannot resurrect a removed link', async ({page}) => {
  await setup(page);
  await page.evaluate(() => {
    const read = Neutralino.filesystem.readFile;
    let held = false;
    Neutralino.filesystem.readFile = async (path, ...args) => {
      if (!held && path === 'C:/Parent/Sub/Note.md') {
        held = true; window.__linkedReadHeld = true;
        await new Promise(resolve => { window.__releaseLinkedRead = resolve; });
      }
      return read(path, ...args);
    };
    __linkedEvents.windowFocus();
  });
  await expect.poll(() => page.evaluate(() => window.__linkedReadHeld)).toBe(true);
  await action(page, 'Remove linked file');
  await expect(note(page)).toHaveCount(0);
  await page.evaluate(() => __releaseLinkedRead());
  await refresh(page, true);
  await expect(note(page)).toHaveCount(0);
  expect((await state(page)).original).toBe('# original');
});
