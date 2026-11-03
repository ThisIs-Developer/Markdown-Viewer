const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test.beforeEach(async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window); window.NL_OS="Windows"; window.MARKDOWN_VIEWER_DESKTOP_RUNTIME_FEATURES={nativeFileDrop:true,sidebarPointerDrag:true};');
  await openApp(page);
  await page.evaluate(() => {
    __desktopFiles.set('C:/Original/δοκιμή notes.md', '# original');
    __desktopFiles.set('C:/Original/second.markdown', '# second');
  });
});

async function at(page, target, paths, phase = 'drop', directories = []) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  await page.evaluate(({x,y,paths,phase,directories}) => {
    // The runtime sends native client pixels, not CSS pixels.
    const detail = {phase, files:paths, directories, x:x*2, y:y*2, width:innerWidth*2, height:innerHeight*2};
    if(phase === 'drop') window.__drop = NL_HANDLE_NATIVE_DROP(paths, detail);
    else NL_HANDLE_NATIVE_DRAG(detail);
  }, {x:box.x+box.width/2,y:box.y+box.height/2,paths,phase,directories});
}

async function records(page) {
  return page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return storage.listDocumentMetadata();
  });
}

async function folder(page) {
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill('Destination');
  await page.locator('#document-name-modal-confirm').click();
  await expect(page.locator('#document-name-modal')).toBeHidden();
  return page.locator('#document-tree [data-tree-type="folder"]').filter({hasText:'Destination'});
}

test('native hover restores the notice, item icons, exact targets and leave cleanup', async ({page}) => {
  const vault = page.locator('[data-tree-id="workspace_default"][data-tree-type="workspace"]');
  const linked = page.locator('[data-tree-type="linked-workspace"]');
  await at(page,vault,['C:/Original/δοκιμή notes.md'],'enter');
  await expect(vault).toHaveClass(/is-drop-target/);
  await expect(page.locator('#drag-overlay')).toBeVisible();
  await expect(page.locator('#drag-overlay .drag-overlay-icon')).toHaveClass(/lucide-file\b/);
  await at(page,linked,[],'over');
  await expect(linked).toHaveClass(/is-drop-target/);
  await expect(vault).not.toHaveClass(/is-drop-target/);
  await expect(page.locator('#drag-overlay .drag-overlay-text')).toHaveText('Link original');
  await at(page,linked,['C:/Folder'],'enter',[true]);
  await expect(page.locator('#drag-overlay .drag-overlay-icon')).toHaveClass(/lucide-folder\b/);
  await page.evaluate(() => NL_HANDLE_NATIVE_DRAG({phase:'leave'}));
  await expect(page.locator('#drag-overlay')).toBeHidden();
  await expect(page.locator('#document-tree .is-drop-target')).toHaveCount(0);
});

test('unsupported files and locked destinations show invalid feedback and change nothing', async ({page}) => {
  const vault = page.locator('[data-tree-id="workspace_default"][data-tree-type="workspace"]');
  await at(page,vault,['C:/program.exe'],'enter');
  await expect(vault).toHaveClass(/is-drop-invalid/);
  const locked = page.locator('[data-tree-id="workspace_secret"]');
  await at(page,locked,['C:/Original/δοκιμή notes.md'],'enter');
  await expect(locked).toHaveClass(/is-drop-invalid/);
  await at(page,locked,['C:/Original/δοκιμή notes.md']);
  expect(await page.evaluate(() => __drop)).toBe(0);
  await expect(page.locator('#desktop-drop-modal')).toBeHidden();
});

test('native drop onto a Vault folder imports there without a chooser or source mutation', async ({page}) => {
  const target = await folder(page);
  await at(page,target,['C:/Original/δοκιμή notes.md']);
  expect(await page.evaluate(() => __drop)).toBe(1);
  await expect(page.locator('#desktop-drop-modal')).toBeHidden();
  const item = (await records(page)).find(x=>x.title === 'δοκιμή notes');
  expect(item.sourcePath).toBeFalsy();
  expect(item.vaultRelativePath).toMatch(/^Workspace\/Destination\//);
  expect(await page.evaluate(()=>__desktopFiles.get('C:/Original/δοκιμή notes.md'))).toBe('# original');
});

test('native drop onto a Vault file selects its parent folder', async ({page}) => {
  const target = await folder(page);
  await at(page,target,['C:/Original/δοκιμή notes.md']);
  await page.evaluate(()=>__drop);
  const file = page.locator('[data-tree-type="document"]').filter({hasText:'δοκιμή notes'});
  await at(page,file,['C:/Original/second.markdown']);
  expect(await page.evaluate(()=>__drop)).toBe(1);
  const item = (await records(page)).find(x=>x.title==='second');
  expect(item.vaultRelativePath).toMatch(/^Workspace\/Destination\//);
});

test('native drop onto Linked Workspace links in place without a Vault copy', async ({page}) => {
  await at(page,page.locator('[data-tree-type="linked-workspace"]'),['C:/Original/δοκιμή notes.md']);
  expect(await page.evaluate(()=>__drop)).toBe(1);
  const matching = (await records(page)).filter(x=>x.title==='δοκιμή notes');
  expect(matching).toHaveLength(1);
  expect(matching[0].sourcePath).toBe('C:/Original/δοκιμή notes.md');
  await expect(page.locator('#desktop-drop-modal')).toBeHidden();
});

test('a linked folder is a sidebar grouping destination, never a disk-copy destination', async ({page}) => {
  await page.evaluate(async()=>{
    await Neutralino.filesystem.createDirectory('C:/Group');
    __desktopFiles.set('C:/Group/inside.md','# inside');
    await NL_LINK_MARKDOWN_FOLDER_PATH('C:/Group');
  });
  const group = page.locator('[data-tree-type="linked-location"]').filter({hasText:'Group'});
  const id = await group.getAttribute('data-tree-id');
  await at(page,group,['C:/Original/δοκιμή notes.md']);
  expect(await page.evaluate(()=>__drop)).toBe(1);
  const item = (await records(page)).find(x=>x.title==='δοκιμή notes');
  expect(item.sourcePath).toBe('C:/Original/δοκιμή notes.md');
  expect(item.linkedParentId).toBe(id);
  expect(await page.evaluate(()=>__desktopFiles.has('C:/Group/δοκιμή notes.md'))).toBe(false);
  // The in-memory filesystem resets on navigation; assert both persisted
  // grouping metadata above and the current rendered hierarchy here.
  await expect(page.locator('[data-tree-type="document"]').filter({hasText:'δοκιμή notes'})).toHaveAttribute('data-tree-depth','2');
});

test('chooser presents Vault first, names the folder, and cancel leaves it untouched', async ({page}) => {
  await page.evaluate(async()=>{
    await Neutralino.filesystem.createDirectory('C:/Dropped folder');
    __desktopFiles.set('C:/Dropped folder/one.md','# one');
    window.__drop=NL_HANDLE_NATIVE_DROP(['C:/Dropped folder']);
  });
  const choices=page.locator('#desktop-drop-modal .desktop-drop-choice');
  await expect(choices.nth(0)).toContainText('Vault Workspace');
  await expect(choices.nth(1)).toContainText('Linked Workspace');
  await expect(page.locator('#desktop-drop-file-summary')).toHaveText('Dropped folder');
  await expect(page.locator('#desktop-drop-item-icon')).toHaveClass(/lucide-folder/);
  await page.locator('#desktop-drop-modal-cancel').click();
  expect(await page.evaluate(()=>__drop)).toBe(0);
  expect((await records(page)).some(x=>x.title==='one')).toBe(false);
});

test('folder Vault copies preserve hierarchy and never create a temporary link', async ({page}) => {
  await page.evaluate(async()=>{
    await Neutralino.filesystem.createDirectory('C:/Dropped folder');
    await Neutralino.filesystem.createDirectory('C:/Dropped folder/Sub');
    __desktopFiles.set('C:/Dropped folder/Sub/one.md','# one');
    window.__drop=NL_HANDLE_NATIVE_DROP(['C:/Dropped folder']);
  });
  await page.locator('#desktop-drop-copy').click();
  expect(await page.evaluate(()=>__drop)).toBe(1);
  const item=(await records(page)).find(x=>x.title==='one');
  expect(item.sourcePath).toBeFalsy();
  expect(item.vaultRelativePath).toMatch(/^Workspace\/Dropped folder\/Sub\//);
  await expect(page.locator('[data-tree-type="linked-location"]')).toHaveCount(0);
});

test('HTML drop on Linked Workspace requests a real linked path rather than importing a Vault copy', async ({page}) => {
  await page.evaluate(()=>{
    window.__picker=0;
    Neutralino.os.showOpenDialog=async()=>{__picker++;return ['C:/Original/δοκιμή notes.md'];};
  });
  const transfer=await page.evaluateHandle(()=>{const dt=new DataTransfer();dt.items.add(new File(['# body'],'δοκιμή notes.md',{type:'text/markdown'}));return dt;});
  await page.locator('[data-tree-type="linked-workspace"]').dispatchEvent('drop',{dataTransfer:transfer});
  await expect.poll(()=>page.evaluate(()=>__picker)).toBe(1);
  await expect(page.locator('.is-linked-document').filter({hasText:'δοκιμή notes'})).toBeVisible();
  expect((await records(page)).filter(x=>x.title==='δοκιμή notes'&&!x.sourcePath)).toHaveLength(0);
});

test('Private mode accepts native file and folder copies without persisting or reporting failure', async ({page}) => {
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#private-mode-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-private-mode', 'true');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Private folder');
    __desktopFiles.set('C:/Private folder/private-child.md', '# private folder');
  });
  const vault = page.locator('[data-tree-id="workspace_default"][data-tree-type="workspace"]');
  await at(page, vault, ['C:/Original/δοκιμή notes.md', 'C:/Private folder']);
  expect(await page.evaluate(() => __drop)).toBe(2);
  await expect(page.locator('#app-toast-region')).not.toContainText('Could not add dropped items');
  expect((await records(page)).some(x => x.title === 'private-child' || x.title === 'δοκιμή notes')).toBe(false);
});

test('native folder import waits for encrypted Secret storage and reports a failed encryption commit', async ({page}) => {
  const secret = page.locator('[data-tree-id="workspace_secret"]');
  await secret.locator('.document-tree-main').click();
  await page.locator('#secret-workspace-key').fill('native-secret-test');
  await page.locator('#secret-workspace-key-confirm').fill('native-secret-test');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    await Neutralino.filesystem.createDirectory('C:/Encrypted folder');
    __desktopFiles.set('C:/Encrypted folder/secret-child.md', '# secret import');
    const original = MarkdownWorkspaceStorage.prototype.applySecretRecordChanges;
    MarkdownWorkspaceStorage.prototype.applySecretRecordChanges = async function(changes, manifest) {
      if (changes.upserts.some(item => item.id !== '__folders__')) throw new Error('Simulated encrypted storage failure');
      return original.call(this, changes, manifest);
    };
  });
  await at(page, secret, ['C:/Encrypted folder']);
  expect(await page.evaluate(() => __drop)).toBe(0);
  await expect(page.locator('#app-toast-region')).toContainText('Could not add dropped items: Encrypted folder');
  await expect(page.locator('#import-progress-toast')).toHaveAttribute('data-state', 'partial');
  expect(await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.listDocumentMetadata()).some(item => item.title === 'secret-child');
  })).toBe(false);
});
