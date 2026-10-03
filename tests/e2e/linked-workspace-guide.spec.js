const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

test('desktop guide is stored separately, editable, and does not take startup focus', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  const guide = page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'Welcome to Linked Workspace'});
  await expect(guide).toHaveCount(1);
  await expect(guide).not.toHaveClass(/is-linked-document/);
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('Welcome to Markdown');
  expect(await page.evaluate(() => Array.from(window.__desktopFiles.keys()).some(path => path.includes('/Linked Workspace/Welcome to Linked Workspace--')))).toBe(true);
  await guide.locator('.document-tree-main').click();
  await expect(page.locator('#markdown-editor')).toHaveValue(/# Welcome to Linked Workspace/);
  await expect(page.locator('#markdown-preview')).toContainText('Welcome to Linked Workspace');
  await guide.dispatchEvent('contextmenu', {clientX:120,clientY:120});
  const menu = page.locator('.document-menu-context.open');
  for (const name of ['Save', 'Reload from disk', 'Open containing folder', 'Remove linked file']) {
    await expect(menu.getByRole('menuitem',{name,exact:true})).toHaveCount(0);
  }
  await expect(menu.getByRole('menuitem',{name:'Delete',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.header-view-toolbar [data-view-mode="editor"]').click();
  await page.locator('#markdown-editor').fill('# Edited internal guide');
  await expect.poll(() => page.evaluate(() => Array.from(window.__desktopFiles.entries())
    .find(([path]) => path.includes('/Linked Workspace/Welcome to Linked Workspace--'))?.[1]
  )).toBe('# Edited internal guide');
});

test('guide is seeded once in existing desktop workspaces and deletion is respected', async ({ page }) => {
  // Native capabilities with browser-backed persistence survive page reloads.
  await page.addInitScript(() => {
    window.NL_PORT = 1;
    window.Neutralino = {filesystem:{readFile:async()=>'',writeFile:async()=>true},os:{}};
    if (!localStorage.getItem('markdownViewerTabs')) {
      localStorage.setItem('markdownViewerTabs', JSON.stringify([{
        id:'existing-document', title:'Existing document', content:'# existing',
        workspaceId:'workspace_default', isOpen:true, createdAt:1, lastOpenedAt:1
      }]));
      localStorage.setItem('markdownViewerActiveTab', 'existing-document');
    }
  });
  await openApp(page);
  const guide = page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'Welcome to Linked Workspace'});
  await expect(guide).toHaveCount(1);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await expect(guide).toHaveCount(1);
  await guide.dispatchEvent('contextmenu',{clientX:120,clientY:120});
  await page.locator('.document-menu-context.open').getByRole('menuitem',{name:'Delete',exact:true}).click();
  await expect(guide).toHaveCount(0);
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await expect(guide).toHaveCount(0);
});

test('web does not seed a desktop Linked Workspace guide', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#document-tree [data-tree-type="linked-workspace"]')).toHaveCount(0);
  await expect(page.locator('#document-tree')).not.toContainText('Welcome to Linked Workspace');
});
