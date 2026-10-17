const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

async function openDesktop(page, os = 'Windows') {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await page.addInitScript(os => { window.NL_OS = os; window.NL_TOKEN = 'test-token'; }, os);
  await openApp(page);
  if (!(await page.locator('#document-tree').isVisible())) await page.locator('#document-sidebar-open').click();
}

const root = page => page.locator('#document-tree [data-tree-type="linked-workspace"]');
const menu = page => page.locator('.document-menu-dropdown.open');

for (const theme of ['light', 'dark']) {
  test(`linking controls retain their icons without a creation action in ${theme} theme`, async ({ page }) => {
    await openDesktop(page);
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    await expect(page.locator('#sidebar-create-linked-file')).toHaveCount(0);
    await expect(page.locator('#sidebar-new-document > .lucide-file-plus-2')).toHaveCount(1);
    await root(page).dispatchEvent('contextmenu', { clientX: 120, clientY: 160 });
    await expect(menu(page).getByRole('menuitem', { name: /Create new linked/ })).toHaveCount(0);
    for (const [id, name, icon] of [['sidebar-link-files', 'Link Markdown files', 'file-symlink'], ['sidebar-link-folder', 'Link Markdown folder', 'folder-symlink']]) {
      for (const control of [page.locator('#' + id), menu(page).getByRole('menuitem', { name, exact: true })]) {
        const glyph = control.locator('.lucide-' + icon);
        await expect(glyph).toHaveAttribute('aria-hidden', 'true');
        await expect(glyph).toBeVisible();
        expect(await glyph.evaluate(node => getComputedStyle(node).maskImage)).not.toBe('none');
      }
    }
    await page.screenshot({ path: `test-results/linked-menu-${theme}.png`, clip: { x: 0, y: 35, width: 480, height: 380 } });
  });
}

for (const os of ['Windows', 'Darwin']) {
  test(`Linked Workspace root exposes the same actions via right-click and menu button on ${os}`, async ({ page }) => {
    await openDesktop(page, os);
    const expanded = await root(page).getAttribute('aria-expanded');
    for (const trigger of ['contextmenu', 'button']) {
      if (trigger === 'contextmenu') await root(page).dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
      else await root(page).locator('.document-menu-btn').click();
      await expect(menu(page).getByRole('menuitem')).toHaveCount(2);
      await expect(menu(page).getByRole('separator')).toHaveCount(0);
      expect(await menu(page).evaluate(node => Array.from(node.children).map(child => child.getAttribute('role')))).toEqual(['menuitem', 'menuitem']);
      for (const [name, icon] of [['Link Markdown files', 'file-symlink'], ['Link Markdown folder', 'folder-symlink']]) {
        const item = menu(page).getByRole('menuitem', { name, exact: true });
        await expect(item).toBeVisible();
        expect(await item.locator('.lucide-' + icon).evaluate(node => getComputedStyle(node).maskImage)).not.toBe('none');
      }
      await expect(root(page)).toHaveAttribute('aria-expanded', expanded);
      await page.keyboard.press('Escape');
    }
    await expect(root(page).locator('.document-tree-main > .lucide-link-2')).toHaveCount(1);
    await expect(page.locator('#sidebar-linked-separator')).toBeVisible();
    expect(await page.locator('.document-sidebar-actions').evaluate(node => Array.from(node.children).filter(child => !child.hidden).map(child => child.id).slice(0, 5))).toEqual([
      'sidebar-link-files', 'sidebar-link-folder', 'sidebar-linked-separator', 'sidebar-new-document', 'sidebar-new-folder'
    ]);
    const positions = await page.locator('.document-sidebar-actions').evaluate(node => Array.from(node.children).slice(0, 4).map(child => child.getBoundingClientRect().left));
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect(positions[2]).toBeLessThan(positions[3]);
  });
}

test('root Link Markdown files reuses the multi-file picker without modifying originals', async ({ page }) => {
  await openDesktop(page);
  await page.evaluate(() => {
    window.__desktopFiles.set('C:/Original/one.md', '# One');
    window.__desktopFiles.set('C:/Original/two.markdown', '# Two');
    Neutralino.os.showOpenDialog = async (title, options) => {
      window.__picker = { title, options };
      return ['C:/Original/one.md', 'C:/Original/two.markdown'];
    };
  });
  await root(page).dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
  await menu(page).getByRole('menuitem', { name: 'Link Markdown files', exact: true }).click();
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(2);
  expect(await page.evaluate(() => window.__picker)).toEqual({
    title: 'Link Markdown files',
    options: { filters: [{ name: 'Markdown files (*.md, *.markdown)', extensions: ['md', 'markdown'] }], multiSelections: true }
  });
  expect(await page.evaluate(() => [window.__desktopFiles.get('C:/Original/one.md'), window.__desktopFiles.get('C:/Original/two.markdown')])).toEqual(['# One', '# Two']);
});

test('root Link Markdown folder reuses recursive folder linking', async ({ page }) => {
  await openDesktop(page);
  await page.evaluate(async () => {
    await Neutralino.filesystem.createDirectory('C:/Original');
    await Neutralino.filesystem.createDirectory('C:/Original/Nested');
    window.__desktopFiles.set('C:/Original/one.md', '# One');
    window.__desktopFiles.set('C:/Original/Nested/two.md', '# Two');
    Neutralino.os.showFolderDialog = async title => { window.__pickerTitle = title; return 'C:/Original'; };
  });
  await root(page).locator('.document-menu-btn').click();
  await menu(page).getByRole('menuitem', { name: 'Link Markdown folder', exact: true }).click();
  await expect(page.locator('#document-tree [data-tree-type="linked-location"]')).toHaveCount(1);
  await expect(page.locator('#document-tree .is-linked-document')).toHaveCount(2);
  expect(await page.evaluate(() => window.__pickerTitle)).toBe('Link Markdown folder');
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/Nested/two.md'))).toBe('# Two');
});

test('cancelling either root picker preserves workspace and shows no success toast', async ({ page }) => {
  await openDesktop(page);
  await page.evaluate(() => {
    Neutralino.os.showOpenDialog = async () => [];
    Neutralino.os.showFolderDialog = async () => '';
  });
  const count = await page.locator('#document-tree [data-tree-type="document"]').count();
  for (const name of ['Link Markdown files', 'Link Markdown folder']) {
    await root(page).dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await menu(page).getByRole('menuitem', { name, exact: true }).click();
    await expect(menu(page)).toHaveCount(0);
    await expect(page.locator('#document-tree [data-tree-type="document"]')).toHaveCount(count);
  }
  await expect(page.locator('.app-toast[data-tone="success"]')).toHaveCount(0);
});

for (const partialRuntime of [false, true]) {
  test(`web has no Linked Workspace root or native linking menu (partial runtime: ${partialRuntime})`, async ({ page }) => {
    if (partialRuntime) await page.addInitScript(() => { window.Neutralino = { os: {}, filesystem: {} }; window.NL_PORT = 1; });
    await openApp(page);
    if (!(await page.locator('#document-tree').isVisible())) await page.locator('#document-sidebar-open').click();
    await expect(root(page)).toHaveCount(0);
    await expect(page.locator('#sidebar-link-files')).toBeHidden();
    await expect(page.locator('#sidebar-create-linked-file')).toBeHidden();
    await expect(page.locator('#sidebar-link-folder')).toBeHidden();
    await expect(page.locator('#sidebar-linked-separator')).toBeHidden();
    expect(await page.locator('.document-sidebar-actions').evaluate(node => Array.from(node.children).filter(child => !child.hidden).map(child => child.id).slice(0, 2))).toEqual(['sidebar-new-document', 'sidebar-new-folder']);
    await page.locator('#document-tree [data-tree-type="workspace"]').first().dispatchEvent('contextmenu', { clientX: 120, clientY: 120 });
    await expect(menu(page).getByRole('menuitem', { name: /^(Link Markdown|Create new linked)/ })).toHaveCount(0);
  });
}
