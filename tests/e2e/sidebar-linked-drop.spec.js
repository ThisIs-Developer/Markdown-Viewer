const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');
const { installDesktopFilesystem } = require('../helpers/desktop-filesystem');

// Exercise the existing HTML drop entry point without the custom pointer layer.
async function dropDocument(page, row, target) {
  const id = await row.getAttribute('data-document-id');
  const transfer = await page.evaluateHandle(id => {
    const data = new DataTransfer();
    data.setData('application/x-markdown-viewer-document', id);
    return data;
  }, id);
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

for (const desktop of [false, true]) test(`dropping several Vault documents into fresh Secret initializes one key and survives locking (${desktop ? 'desktop' : 'browser'})`, async ({ page }) => {
  if (desktop) await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.locator('#tab-new-btn').click();
  await page.locator('#markdown-editor').fill('# first secret');
  await page.locator('#tab-new-btn').click();
  await page.locator('#markdown-editor').fill('# second secret');
  await page.evaluate(async () => {
    await MarkdownViewerFlushWorkspace();
    window.__keyDerivations = 0;
    const derive = crypto.subtle.deriveKey.bind(crypto.subtle);
    crypto.subtle.deriveKey = async (...args) => { window.__keyDerivations++; return derive(...args); };
  });
  const ids = await page.locator('#document-tree [data-tree-type="document"]').evaluateAll(rows => rows
    .filter(row => row.textContent.includes('Untitled')).map(row => row.dataset.documentId));
  expect(ids).toHaveLength(2);
  const transfer = await page.evaluateHandle(ids => {
    const data = new DataTransfer();
    data.setData('application/x-markdown-viewer-documents', JSON.stringify(ids));
    return data;
  }, ids);
  const secret = page.locator('#document-tree [data-tree-id="workspace_secret"]');
  await secret.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
  await page.locator('#secret-workspace-key').fill('test-secret-password');
  await page.locator('#secret-workspace-key-confirm').fill('test-secret-password');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  await expect.poll(() => page.evaluate(async ids => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.listDocumentMetadata()).filter(tab => ids.includes(tab.id)).length;
  }, ids)).toBe(0);
  await page.evaluate(() => MarkdownViewerFlushWorkspace());
  expect(await page.evaluate(() => window.__keyDerivations)).toBe(1);
  const records = await page.evaluate(async () => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return { normal: await storage.listDocumentMetadata(), secret: await storage.listSecretRecords(), trash: await storage.listTrash() };
  });
  expect(records.secret).toHaveLength(3); // Includes the encrypted folder record.
  expect(records.trash).toHaveLength(0);
  for (const id of ids) expect(records.normal.some(tab => tab.id === id)).toBe(false);
  await secret.dispatchEvent('contextmenu', { clientX: 120, clientY: 160 });
  await page.getByRole('menuitem', { name: 'Lock workspace', exact: true }).click();
  for (const id of ids) await expect(page.locator(`#document-tree [data-document-id="${id}"]`)).toHaveCount(0);
  await secret.dispatchEvent('contextmenu', { clientX: 120, clientY: 160 });
  await page.getByRole('menuitem', { name: 'Unlock workspace', exact: true }).click();
  await page.locator('#secret-workspace-key').fill('test-secret-password');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  const bodies = [];
  for (const id of ids) {
    await page.locator(`#document-tree [data-document-id="${id}"] .document-tree-main`).click();
    bodies.push(await page.locator('#markdown-editor').inputValue());
  }
  expect(bodies.sort()).toEqual(['# first secret', '# second secret']);
});

for (const failRead of [false, true]) test(`moving an unopened document to Secret ${failRead ? 'preserves the Vault on read failure' : 'encrypts its full stored content'}`, async ({ page }) => {
  await openApp(page);
  await page.locator('#tab-new-btn').click();
  await page.locator('#markdown-editor').fill('# unopened secret body');
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^Untitled 1$/ });
  const id = await row.getAttribute('data-document-id');
  await page.locator('#tab-new-btn').click();
  await page.locator('#markdown-editor').fill('# stays in Vault');
  await page.evaluate(() => MarkdownViewerFlushWorkspace());
  await page.reload();
  await expect(page.locator('#markdown-editor')).toHaveValue('# stays in Vault');
  await page.evaluate(({ id, failRead }) => {
    window.__movingBodyReads = 0;
    const load = MarkdownWorkspaceStorage.prototype.loadDocumentContent;
    MarkdownWorkspaceStorage.prototype.loadDocumentContent = function(documentId) {
      if (documentId === id) {
        window.__movingBodyReads++;
        if (failRead) return Promise.reject(new Error('Injected body read failure'));
      }
      return load.call(this, documentId);
    };
  }, { id, failRead });
  page.on('dialog', dialog => dialog.accept());
  const secret = page.locator('#document-tree [data-tree-id="workspace_secret"]');
  await dropDocument(page, row, secret);
  await page.locator('#secret-workspace-key').fill('test-secret-password');
  await page.locator('#secret-workspace-key-confirm').fill('test-secret-password');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__movingBodyReads)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(async id => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    return (await storage.listDocumentMetadata()).some(tab => tab.id === id);
  }, id)).toBe(failRead);
  if (failRead) {
    await expect(page.getByText('Document unavailable', { exact: true })).toBeVisible();
    await page.reload();
  } else {
    await secret.dispatchEvent('contextmenu', { clientX: 120, clientY: 160 });
    await page.getByRole('menuitem', { name: 'Lock workspace', exact: true }).click();
    await expect(row).toHaveCount(0);
    await secret.dispatchEvent('contextmenu', { clientX: 120, clientY: 160 });
    await page.getByRole('menuitem', { name: 'Unlock workspace', exact: true }).click();
    await page.locator('#secret-workspace-key').fill('test-secret-password');
    await page.locator('#secret-workspace-modal-confirm').click();
    await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  }
  await row.locator('.document-tree-main').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# unopened secret body');
});

for (const afterDeletion of [false, true]) test(`failed plaintext cleanup ${afterDeletion ? 'after deletion' : 'before deletion'} rolls the move back to the Vault without losing content`, async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.locator('#tab-new-btn').click();
  await page.locator('#markdown-editor').fill('# retained after failed move');
  await page.evaluate(async afterDeletion => {
    await MarkdownViewerFlushWorkspace();
    const remove = MarkdownWorkspaceStorage.prototype.deleteDocument;
    MarkdownWorkspaceStorage.prototype.deleteDocument = async function(id, options) {
      if (options && options.discardAfterSecretMove) {
        if (afterDeletion) await remove.call(this, id, options);
        throw new Error('Injected cleanup failure');
      }
      return remove.call(this, id, options);
    };
  }, afterDeletion);
  page.on('dialog', dialog => dialog.accept());
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: /^Untitled 1$/ });
  const id = await row.getAttribute('data-document-id');
  await dropDocument(page, row, page.locator('#document-tree [data-tree-id="workspace_secret"]'));
  await page.locator('#secret-workspace-key').fill('test-secret-password');
  await page.locator('#secret-workspace-key-confirm').fill('test-secret-password');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect.poll(() => page.evaluate(async id => {
    const storage = new MarkdownWorkspaceStorage(); await storage.init();
    const metadata = (await storage.listDocumentMetadata()).find(tab => tab.id === id);
    return metadata && metadata.workspaceId;
  }, id)).toBe('workspace_default');
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
  await row.locator('.document-tree-main').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# retained after failed move');
});

test('bulk selection containing linked files does not offer Move or change save authority', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    for (const name of ['one', 'two']) {
      window.__desktopFiles.set('C:/Original/' + name + '.md', '# ' + name);
      await NL_IMPORT_EXTERNAL_FILE('# ' + name, name, 'C:/Original/' + name + '.md');
    }
    await MarkdownViewerFlushWorkspace();
  });
  const rows = page.locator('#document-tree .is-linked-document');
  await rows.nth(0).click();
  await rows.nth(1).click({ modifiers: ['Control'] });
  await expect(page.locator('#document-tree .is-selected')).toHaveCount(2);
  await rows.nth(1).dispatchEvent('contextmenu', { clientX: 120, clientY: 160 });
  await expect(page.locator('.document-menu-context.open').getByRole('menuitem', { name: /^Move/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const one = rows.filter({ hasText: /^one$/ });
  await one.locator('.document-tree-main').click();
  await page.locator('#markdown-editor').fill('# updated one');
  await page.locator('#markdown-editor').press('Control+s');
  await expect(page.getByText('Original file updated', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/one.md'))).toBe('# updated one');
});

for (const destination of ['root', 'folder']) {
  test(`HTML sidebar drop converts linked files into the Vault ${destination}`, async ({ page }) => {
    await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
    await openApp(page);
    await page.locator('#sidebar-new-folder').click();
    await page.locator('#document-name-modal-input').fill('Destination');
    await page.locator('#document-name-modal-confirm').click();
    await page.evaluate(async () => {
      window.__desktopFiles.set('C:/Original/notes.md', '# original');
      await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
    });
    const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
    const secret = page.locator('#document-tree [data-tree-type="workspace"]').filter({ hasText: 'Secret Workspace' });
    await dropDocument(page, row, secret);
    await expect(row).toHaveClass(/is-linked-document/);
    const target = destination === 'folder'
      ? page.locator('#document-tree [data-tree-type="folder"]').filter({ hasText: 'Destination' })
      : page.locator('#document-tree [data-tree-type="workspace"]').filter({ hasText: 'Workspace (Vault)' });
    await dropDocument(page, row, target);
    await expect(row).not.toHaveClass(/is-linked-document/);
    await expect(row).toHaveAttribute('data-tree-depth', destination === 'folder' ? '2' : '1');
    const result = await page.evaluate(async () => {
      const storage = new window.MarkdownWorkspaceStorage();
      await storage.init();
      const record = (await storage.listDocumentMetadata()).find(item => item.title === 'notes');
      return { linked: Boolean(record.sourcePath), path: record.vaultRelativePath, original: window.__desktopFiles.get('C:/Original/notes.md') };
    });
    expect(result.linked).toBe(false);
    expect(result.original).toBe('# original');
    expect(result.path).toMatch(destination === 'folder' ? /^Workspace\/Destination\// : /^Workspace\/notes-/);
  });
}

test('HTML conversion failure preserves the linked document', async ({ page }) => {
  await page.addInitScript('(' + installDesktopFilesystem.toString() + ')(window);');
  await openApp(page);
  await page.evaluate(async () => {
    window.__desktopFiles.set('C:/Original/notes.md', '# original');
    await window.NL_IMPORT_EXTERNAL_FILE('# original', 'notes', 'C:/Original/notes.md');
    await window.MarkdownViewerFlushWorkspace();
    const save = window.MarkdownWorkspaceStorage.prototype.saveDocuments;
    window.MarkdownWorkspaceStorage.prototype.saveDocuments = function(documents, ...args) {
      if (documents.some(item => item.title === 'notes' && !item.sourcePath)) return Promise.reject(new Error('Simulated disk failure'));
      return save.call(this, documents, ...args);
    };
  });
  const row = page.locator('#document-tree [data-tree-type="document"]').filter({ hasText: 'notes' });
  const target = page.locator('#document-tree [data-tree-type="workspace"]').filter({ hasText: 'Workspace (Vault)' });
  await dropDocument(page, row, target);
  await expect(page.locator('.app-toast').filter({ hasText: 'Conversion failed' })).toBeVisible();
  await expect(row).toHaveClass(/is-linked-document/);
  expect(await page.evaluate(() => window.__desktopFiles.get('C:/Original/notes.md'))).toBe('# original');
});
