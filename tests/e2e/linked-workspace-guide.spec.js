const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');
const fs = require('node:fs');
const path = require('node:path');
const defaultGuide = fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8')
  .match(/<textarea id="default-markdown"[^>]*>([\s\S]*?)<\/textarea>/)[1].replace(/\r\n/g,'\n').trim();

test('desktop guide is stored separately, editable, and does not take startup focus', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  const guide = page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'Welcome to Linked Workspace'});
  await expect(guide).toHaveCount(1);
  await expect(guide).not.toHaveClass(/is-linked-document/);
  await expect(guide.locator('.lucide-file-text')).toHaveCount(1);
  await expect(guide.locator('.document-tree-main')).toHaveAttribute('title', 'Built-in Linked Workspace guide');
  const vaultGuide = page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'Welcome to Markdown'});
  await expect(vaultGuide.locator('.lucide-file-text')).toHaveCount(1);
  await expect(vaultGuide.locator('.document-tree-main')).toHaveAttribute('title', 'Built-in Workspace guide');
  await expect(page.locator('#tab-list .tab-item.active .tab-title')).toHaveText('Welcome to Markdown');
  expect(await page.evaluate(() => Array.from(window.__desktopFiles.keys()).some(path => path.includes('/Linked Workspace/Welcome to Linked Workspace--')))).toBe(true);
  await guide.locator('.document-tree-main').click();
  await expect(page.locator('#tab-list .tab-item.active .lucide-file-text')).toHaveCount(1);
  await expect(page.locator('#markdown-editor')).toHaveValue(/# Welcome to Linked Workspace/);
  for (const topic of ['Save As linked folder', 'only groups links in the sidebar', 'not all-or-nothing', 'partial completion', 'without reconnecting their original paths']) {
    await expect(page.locator('#markdown-editor')).toHaveValue(new RegExp(topic));
  }
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
  await expect(guide.locator('.lucide-file-text')).toHaveCount(1);
});

for (const scenario of [
  {name:'unique exact template', documents:[{id:'legacy',title:'Renamed old Welcome',content:defaultGuide}],expected:1},
  {name:'edited guide',documents:[{id:'legacy',title:'Welcome to Markdown',content:defaultGuide+'\nMy edits'}],expected:0},
  {name:'ambiguous exact templates',documents:[{id:'legacy',title:'Welcome to Markdown',content:defaultGuide},{id:'copy',title:'Same text under another name',content:defaultGuide}],expected:0},
  {name:'linked original with the same template',documents:[{id:'legacy',title:'Welcome to Markdown',content:defaultGuide,sourcePath:'C:/Original/welcome.md'}],expected:0}
]) {
  test('legacy guide migration: '+scenario.name,async({page})=>{
    await page.addInitScript(documents=>{
      if(localStorage.getItem('markdownViewerTabs'))return;
      localStorage.setItem('markdownViewerTabs',JSON.stringify(documents.map(tab=>Object.assign({workspaceId:'workspace_default',isOpen:true,createdAt:1,lastOpenedAt:1},tab))));
      localStorage.setItem('markdownViewerActiveTab','legacy');
    },scenario.documents);
    await openApp(page);
    await expect(page.locator('#document-tree .document-tree-main[title="Built-in Workspace guide"]')).toHaveCount(scenario.expected);
    await expect(page.locator('#markdown-editor')).toHaveValue(scenario.documents[0].content);
    await page.waitForTimeout(700);
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
    await expect(page.locator('#document-tree .document-tree-main[title="Built-in Workspace guide"]')).toHaveCount(scenario.expected);
    await expect(page.locator('#markdown-editor')).toHaveValue(scenario.documents[0].content);
  });
}

test('legacy desktop guide receives persisted metadata without changing its Markdown body',async({page})=>{
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await page.addInitScript(content=>{
    localStorage.setItem('markdownViewerTabs',JSON.stringify([{id:'legacy',title:'Old guide',content,workspaceId:'workspace_default',isOpen:true,createdAt:1,lastOpenedAt:1}]));
    localStorage.setItem('markdownViewerActiveTab','legacy');
  },defaultGuide);
  await openApp(page);
  await expect(page.locator('#document-tree [data-document-id="legacy"] .lucide-file-text')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>{
    const entry=Array.from(window.__desktopFiles.entries()).find(([path])=>path.endsWith('/index.json'));
    return entry ? JSON.parse(entry[1]).documents.find(tab=>tab.id==='legacy')?.kind : null;
  })).toBe('workspace-guide');
  expect(await page.evaluate(()=>Array.from(window.__desktopFiles.entries()).find(([path])=>path.includes('/Workspace/Old guide--'))?.[1])).toBe(defaultGuide);
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
  await expect(page.locator('#document-tree .lucide-file-text')).toHaveCount(1);
  await expect(page.locator('#tab-list .tab-item.active .lucide-file-text')).toHaveCount(1);
});

test('guide metadata survives edits and reloads, while names alone never identify guides', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('markdownViewerTabs')) return;
    localStorage.setItem('markdownViewerTabs', JSON.stringify([
      {id:'guide', title:'Renamed guide', content:'# Edited guide', kind:'workspace-guide', workspaceId:'workspace_default', favorite:true, isOpen:true, createdAt:1, lastOpenedAt:3},
      {id:'ordinary', title:'Welcome to Markdown', content:'# My own file', workspaceId:'workspace_default', favorite:true, isOpen:true, createdAt:2, lastOpenedAt:2},
      {id:'ordinary-linked-name', title:'Welcome to Linked Workspace', content:'# Another own file', workspaceId:'workspace_default', favorite:true, isOpen:true, createdAt:3, lastOpenedAt:1}
    ]));
    localStorage.setItem('markdownViewerActiveTab', 'guide');
  });
  await openApp(page);
  for (const filter of ['all','recent','favorites']) {
    await page.locator(`[data-document-filter="${filter}"]`).click();
    const row = id => page.locator(`#document-tree [data-document-id="${id}"]`);
    await expect(row('guide').locator('.lucide-file-text')).toHaveCount(1);
    await expect(row('guide').locator('.document-tree-main')).toHaveAttribute('title','Built-in Workspace guide');
    await expect(row('ordinary').locator('.lucide-file-text')).toHaveCount(1);
    await expect(row('ordinary-linked-name').locator('.lucide-file-text')).toHaveCount(1);
  }
  await page.locator('#markdown-editor').fill('# Edited again');
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
  await expect(page.locator('#tab-list .tab-item.active .lucide-file-text')).toHaveCount(1);
  await expect(page.locator('#markdown-editor')).toHaveValue('# Edited again');
  await page.locator('[data-document-filter="all"]').click();
  await page.locator('#document-tree [data-document-id="guide"]').dispatchEvent('contextmenu',{clientX:120,clientY:120});
  await page.locator('.document-menu-context.open').getByRole('menuitem',{name:'Duplicate',exact:true}).click();
  const copy = page.locator('#document-tree [data-tree-type="document"]').filter({hasText:'Renamed guide (copy)'});
  await expect(copy.locator('.lucide-file-text')).toHaveCount(1);
  await expect(copy.locator('.lucide-book-open-text')).toHaveCount(0);
});
