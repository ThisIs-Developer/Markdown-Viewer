const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function setup(page) {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(() => {
    window.__saveChoices = [];
    window.__saveDialogs = [];
    Neutralino.os.showSaveDialog = async (title, options) => {
      window.__saveDialogs.push({ title, options });
      return window.__saveChoices.shift() || '';
    };
  });
}
async function importNotes(page) {
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
    await window.MarkdownViewerFlushWorkspace();
  });
}
async function menu(page, name, action) {
  await page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: name }).dispatchEvent('contextmenu', {clientX:120,clientY:120});
  await page.locator('.document-menu-context.open').getByRole('menuitem', {name:action,exact:true}).click();
}
async function records(page) {
  return page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    return storage.listDocumentMetadata();
  });
}

test('Greek Ctrl+S creates and focuses a linked copy while preserving the Vault document and proposed filename', async ({ page }) => {
  await setup(page);
  const originalId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#markdown-editor').fill('# Vault draft');
  await page.evaluate(() => window.__saveChoices.push('C:/Saved/example'));
  await page.locator('#markdown-editor').dispatchEvent('keydown', { key:'σ',code:'KeyS',ctrlKey:true });
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('example');
  await expect(page.locator('#markdown-editor')).toBeFocused();
  expect(await page.evaluate(() => window.__saveDialogs[0].options.defaultPath)).toBe('Welcome to Markdown.md');
  const metadata = await records(page);
  expect(metadata.find(item => item.id === originalId).sourcePath).toBeFalsy();
  expect(metadata.find(item => item.sourcePath === 'C:/Saved/example.md')).toBeTruthy();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Saved/example.md'))).toBe('# Vault draft');
  await page.locator('#markdown-editor').fill('# updated original');
  await page.locator('#markdown-editor').dispatchEvent('keydown', {key:'σ',code:'KeyS',ctrlKey:true});
  await expect.poll(() => page.evaluate(() => window.__desktopFiles.get('C:/Saved/example.md'))).toBe('# updated original');
  expect(await page.evaluate(() => window.__saveDialogs.length)).toBe(1);
});

test('linked Save As creates a second linked document, keeping the old draft and disk original', async ({ page }) => {
  await setup(page);
  await importNotes(page);
  await page.locator('#markdown-editor').fill('# edited draft');
  await page.evaluate(() => window.__saveChoices.push('C:/Saved/copy.MD'));
  await menu(page, 'notes', 'Save As…');
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('copy');
  await expect(page.locator('#markdown-editor')).toBeFocused();
  expect(await page.evaluate(() => window.__saveDialogs[0].options.defaultPath)).toBe('notes.md');
  const metadata = await records(page);
  expect(metadata.filter(item => item.sourcePath)).toHaveLength(2);
  expect(metadata.some(item => item.sourcePath === 'C:/Saved/copy.MD')).toBe(true);
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# original');
  await menu(page, 'notes', 'Save');
  await expect.poll(() => page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# edited draft');
  expect(await page.evaluate(() => window.__saveDialogs.length)).toBe(1);
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('copy');
});

test('Vault context Save As targets an inactive document and preserves it', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').fill('# Vault content');
  await importNotes(page);
  await page.evaluate(() => window.__saveChoices.push('C:/Saved/welcome.markdown'));
  await menu(page, 'Welcome to Markdown', 'Save As…');
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('welcome');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Saved/welcome.markdown'))).toBe('# Vault content');
  expect((await records(page)).some(item => item.title === 'Welcome to Markdown' && !item.sourcePath)).toBe(true);
});

test('appended .md overwrite prompts protect the real destination and cancellation changes nothing', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').fill('# new');
  await page.evaluate(() => {
    window.__desktopFiles.set('C:/Saved/existing.md', '# old');
    window.__saveChoices.push('C:/Saved/existing');
  });
  await menu(page, 'Welcome to Markdown', 'Save As…');
  const toast = page.locator('.app-toast').filter({hasText:'Replace Markdown file?'});
  await expect(toast).toBeVisible();
  await toast.getByRole('button', {name:'Cancel',exact:true}).click();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Saved/existing.md'))).toBe('# old');
  expect((await records(page)).filter(item => item.sourcePath)).toHaveLength(0);
  await page.evaluate(() => window.__saveChoices.push('C:/Saved/existing'));
  await menu(page, 'Welcome to Markdown', 'Save As…');
  await toast.getByRole('button', {name:'Replace',exact:true}).click();
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('existing');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Saved/existing.md'))).toBe('# new');
});

test('cancelled or failed Save As does not create a link or change focus', async ({ page }) => {
  await setup(page);
  await importNotes(page);
  const id = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await menu(page, 'notes', 'Save As…');
  await expect.poll(() => page.evaluate(() => window.__saveDialogs.length)).toBe(1);
  await page.evaluate(() => {
    window.__saveChoices.push('C:/Saved/failure.md');
    const write = Neutralino.filesystem.writeFile;
    Neutralino.filesystem.writeFile = async (path, content) => {
      if (path === 'C:/Saved/failure.md') throw new Error('Permission denied');
      return write(path, content);
    };
  });
  await menu(page, 'notes', 'Save As…');
  await expect(page.locator('.app-toast').filter({hasText:'Save failed'})).toBeVisible();
  await expect(page.locator('#tab-list .tab-item.active')).toHaveAttribute('data-tab-id',id);
  expect((await records(page)).filter(item => item.sourcePath)).toHaveLength(1);
});

test('Ctrl+Shift+S retains scroll-sync behavior and does not open Save As', async ({ page }) => {
  await setup(page);
  await page.locator('#markdown-editor').press('Control+Shift+s');
  expect(await page.evaluate(() => window.__saveDialogs.length)).toBe(0);
});

test('Save As refuses the current linked source path rather than overwriting it', async ({ page }) => {
  await setup(page);
  await importNotes(page);
  await page.locator('#markdown-editor').fill('# draft');
  await page.evaluate(() => window.__saveChoices.push('C:/Original/notes.md'));
  await menu(page, 'notes', 'Save As…');
  await expect(page.locator('.app-toast').filter({hasText:'Choose a new file'})).toBeVisible();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# original');
  expect((await records(page)).filter(item => item.sourcePath)).toHaveLength(1);
});

test('Download Markdown uses the same filename and extension rules without creating a link', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.__saveChoices.push('C:/Saved/download'));
  await menu(page, 'Welcome to Markdown', 'Download Markdown');
  await expect.poll(() => page.evaluate(() => window.__desktopFiles.has('C:/Saved/download.md'))).toBe(true);
  expect(await page.evaluate(() => window.__saveDialogs[0].options.defaultPath)).toBe('Welcome to Markdown.md');
  expect((await records(page)).filter(item => item.sourcePath)).toHaveLength(0);
});
