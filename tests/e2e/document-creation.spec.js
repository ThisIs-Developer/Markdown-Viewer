const { test, expect } = require('@playwright/test');
const { openApp, storedDocuments } = require('../helpers/app');

function folderRow(page, name) {
  return page.locator('.document-tree-row[data-tree-type="folder"]').filter({ has: page.locator('.document-tree-label', { hasText: new RegExp('^' + name + '$') }) });
}

async function createFolder(page, name, parent) {
  if (parent) {
    await parent.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'New folder', exact: true }).click();
  } else {
    await page.locator('#sidebar-new-folder').click();
  }
  await page.locator('#document-name-modal-input').fill(name);
  await page.locator('#document-name-modal-confirm').click();
  const row = folderRow(page, name);
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  return row;
}

async function expectNewFileLocation(page, folderId) {
  const active = page.locator('#tab-list .tab-item.active');
  await expect(active).toContainText('Untitled');
  const id = await active.getAttribute('data-tab-id');
  await expect(page.locator('#markdown-editor')).toBeEditable();
  await expect(page.locator(`.document-tree-row[data-document-id="${id}"]`)).toBeVisible();
  await expect.poll(async () => (await storedDocuments(page)).find(doc => doc.id === id)?.folderId).toBe(folderId);
}

for (const collapse of ['folder', 'ancestor', 'workspace', 'all']) {
  test(`new documents use the workspace root after closing tabs and collapsing ${collapse}`, async ({ page }) => {
    await openApp(page);
    const parent = await createFolder(page, 'Parent');
    const child = await createFolder(page, 'Child', parent);
    const childId = await child.getAttribute('data-tree-id');
    await page.locator('#sidebar-new-document').click();
    await expectNewFileLocation(page, childId);
    await page.locator('#tab-list .tab-item.active').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Close all', exact: true }).click();
    await expect(page.locator('#tab-list .tab-item')).toHaveCount(0);

    if (collapse === 'all') await page.locator('#document-sidebar-collapse-all').click();
    else {
      const row = collapse === 'folder' ? child : collapse === 'ancestor' ? parent : page.locator('[data-tree-id="workspace_default"]');
      await row.locator('.document-tree-toggle').click();
    }
    await expect(page.locator('#sidebar-new-document')).toHaveAttribute('aria-label', 'New Markdown file in Workspace (Vault)');
    await page.locator('#sidebar-new-document').click();
    await expectNewFileLocation(page, null);
  });
}

test('opening a folder selects it for new documents, and explicit creation reveals collapsed parents', async ({ page }) => {
  await openApp(page);
  const parent = await createFolder(page, 'Parent');
  const child = await createFolder(page, 'Child', parent);
  await child.locator('.document-tree-toggle').click();
  await parent.locator('.document-tree-toggle').click();
  await createFolder(page, 'Sibling', parent);
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await child.locator('.document-tree-toggle').click();
  await page.locator('#tab-new-btn').click();
  await expectNewFileLocation(page, await child.getAttribute('data-tree-id'));

  await parent.locator('.document-tree-toggle').click();
  await parent.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'New file', exact: true }).click();
  await expect(parent).toHaveAttribute('aria-expanded', 'true');
  await expectNewFileLocation(page, await parent.getAttribute('data-tree-id'));
});

test('creating items clears filters that would hide them and selects new folders', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-document-filter="favorites"]').click();
  await page.locator('#document-sidebar-search').fill('no matching files');
  const folder = await createFolder(page, 'Visible folder');
  await expect(folder).toHaveAttribute('aria-selected', 'true');
  await expect(folder).toBeFocused();
  await expect(page.locator('#document-sidebar-search')).toHaveValue('');
  await expect(page.locator('[data-document-filter="all"]')).toHaveClass(/is-active/);

  await page.locator('[data-document-filter="favorites"]').click();
  await page.locator('#document-sidebar-search').fill('hidden document');
  await page.locator('#sidebar-new-document').click();
  await expectNewFileLocation(page, await folder.getAttribute('data-tree-id'));
  await expect(page.locator('#document-sidebar-search')).toHaveValue('');
});

test('a remembered folder from an older session is ignored when its parent is collapsed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('markdownViewerDocumentOrganization', JSON.stringify({
      workspaces: [{ id: 'workspace_default', name: 'Workspace (Vault)', expanded: true }],
      folders: [
        { id: 'parent', name: 'Parent', workspaceId: 'workspace_default', expanded: false },
        { id: 'child', name: 'Child', workspaceId: 'workspace_default', parentFolderId: 'parent', expanded: true }
      ],
      ui: { lastWorkspaceId: 'workspace_default', lastFolderId: 'child' }
    }));
  });
  await openApp(page);
  await expect(folderRow(page, 'Parent')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#sidebar-new-document')).toHaveAttribute('aria-label', 'New Markdown file in Workspace (Vault)');
  await page.locator('#sidebar-new-document').click();
  await expectNewFileLocation(page, null);
});
