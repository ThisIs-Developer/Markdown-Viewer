const { test, expect } = require('@playwright/test');
const {
  fixture,
  openApp,
  setEditorContent,
  readWorkspaceStore,
  storedDocuments,
  waitForAppReady
} = require('../helpers/app');

test('theme switching stores and restores the selected theme', async ({ page }) => {
  await openApp(page);

  const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const initialThemeIcon = initialTheme === 'dark' ? 'lucide-moon' : 'lucide-sun-medium';
  const toggledThemeIcon = initialTheme === 'dark' ? 'lucide-sun-medium' : 'lucide-moon';
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  const themeToggle = page.locator('#theme-toggle');
  const themeSwitch = themeToggle.locator('.settings-switch');
  const privateModeSwitch = page.locator('#private-mode-toggle .settings-switch');

  await expect(themeToggle).toHaveClass(/settings-menu-item--toggle/);
  await expect(themeToggle).toHaveAttribute('aria-pressed', String(initialTheme === 'dark'));
  await expect(themeSwitch).toBeVisible();
  await expect(page.locator('#theme-switch-icon')).toHaveClass(new RegExp(`\\b${initialThemeIcon}\\b`));
  await expect(page.locator('#theme-switch-icon')).not.toHaveCSS('mask-image', 'none');
  await expect(themeSwitch).toHaveCSS('width', await privateModeSwitch.evaluate(element => getComputedStyle(element).width));
  await expect(themeSwitch).toHaveCSS('height', await privateModeSwitch.evaluate(element => getComputedStyle(element).height));

  await themeToggle.click();
  const toggledTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

  expect(toggledTheme).not.toBe(initialTheme);
  await expect(themeToggle).toHaveAttribute('aria-pressed', String(toggledTheme === 'dark'));
  await expect(page.locator('#theme-switch-icon')).toHaveClass(new RegExp(`\\b${toggledThemeIcon}\\b`));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('markdownViewerGlobalState') || '{}').theme)).toBe(toggledTheme);

  await page.reload();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(toggledTheme);
});

test('document tabs persist across reload in normal mode', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Persistence Check\n\nSaved locally.');

  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Persistence Check');
  await page.reload();
  await expect(page.locator('#markdown-editor')).toHaveValue(/Persistence Check/);
  await expect(page.locator('#markdown-preview')).toContainText('Saved locally.');
});

test('private mode pauses writes without deleting existing saved documents', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Persisted Before Private Mode\n\nKeep this document.');
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Persisted Before Private Mode');

  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#private-mode-toggle').click();
  await expect(page.locator('#private-mode-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#private-mode-description')).toHaveText('Session activity is not persisted');
  await page.keyboard.press('Escape');

  await setEditorContent(page, '# Private Content\n\nDo not store this.');
  await page.waitForTimeout(750);

  const stored = JSON.stringify(await storedDocuments(page));
  expect(stored).toContain('Persisted Before Private Mode');
  expect(stored).not.toContain('Private Content');
});

test('reset workspace permanently deletes documents and blocks repeated clicks', async ({ page }) => {
  await openApp(page);
  await setEditorContent(page, '# Delete On Reset\n\nThis document must be removed.');
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Delete On Reset');
  await page.evaluate(async () => {
    localStorage.setItem('find-replace-docked', 'true');
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.saveSecretRecord('reset_secret', {
      version: 2,
      iv: 'cmVzZXQtaXY=',
      ciphertext: 'cmVzZXQtY2lwaGVydGV4dA=='
    });
    await storage.setSecretManifest({
      version: 2,
      salt: 'cmVzZXQtc2FsdA==',
      iterations: 250000,
      documentCount: 1,
      folderCount: 0
    });
  });

  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#tab-reset-btn').click();
  await expect(page.locator('#reset-modal-description')).toContainText('permanently deletes all documents');
  await page.locator('#reset-modal-backup').click();
  await expect(page.locator('#storage-settings-title')).toHaveText('Storage and Backup');
  await page.locator('#storage-settings-close').click();
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#tab-reset-btn').click();
  const reloadPromise = page.waitForEvent('load');
  await page.locator('#reset-modal-confirm').click();
  await expect(page.locator('#reset-modal-confirm')).toBeDisabled();
  await expect(page.locator('#reset-modal-confirm')).toHaveClass(/is-loading/);
  await reloadPromise;
  await waitForAppReady(page);

  await expect.poll(async () => JSON.stringify(await storedDocuments(page)), {
    timeout: 15_000
  }).not.toContain('Delete On Reset');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('find-replace-docked'))).toBeNull();
  await expect.poll(() => page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    return (await storage.listSecretRecords()).length;
  })).toBe(0);
});

test('workspace backup ZIP restores documents and folder organization', async ({ page }) => {
  await openApp(page);
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill('Backup Folder');
  await page.locator('#document-name-modal-confirm').click();
  await setEditorContent(page, '# Backup Round Trip\n\nRestore this content.');
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Backup Round Trip');
  await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.saveSecretRecord('encrypted_test', {
      version: 2,
      iv: 'c2FtZS1pdg==',
      ciphertext: 'c2FtZS1jaXBoZXJ0ZXh0'
    });
    await storage.setSecretManifest({
      version: 2,
      salt: 'c2FtZS1zYWx0',
      iterations: 250000,
      documentCount: 1,
      folderCount: 0
    });
  });

  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#storage-settings-button').click();
  await expect(page.locator('#storage-settings-title')).toHaveText('Storage and Backup');
  await expect(page.locator('#storage-include-secure')).toBeHidden();
  await page.locator('#storage-backup-button').click();
  await expect(page.locator('#storage-backup-options-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#storage-include-secure')).toBeChecked();
  expect(await page.evaluate(() => Boolean(window.JSZip))).toBe(false);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#storage-backup-options-confirm').click();
  const download = await downloadPromise;
  expect(await page.evaluate(() => Boolean(window.JSZip))).toBe(true);
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.resetAllData();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#storage-settings-button').click();
  await page.locator('#storage-backup-file-input').setInputFiles(backupPath);
  await expect(page.locator('#storage-import-confirm-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#storage-import-confirm-title')).toHaveText('Replace current workspace?');
  await expect(page.locator('#storage-import-confirm-cancel')).toBeFocused();
  await page.locator('#storage-import-confirm-confirm').click();

  await expect(page.locator('#import-progress-title')).toHaveText(/Import (complete|failed)/, { timeout: 20_000 });
  await expect(page.locator('#import-progress-title')).toHaveText('Import complete');
  await page.waitForEvent('load');
  await expect(page.locator('#markdown-editor')).toHaveValue(/Backup Round Trip/);
  await expect(page.locator('.document-tree-row[data-tree-type="folder"]')).toContainText('Backup Folder');
  await expect.poll(() => page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    const records = await storage.listSecretRecords();
    return records.find(record => record.id === 'encrypted_test')?.envelope?.ciphertext || '';
  })).toBe('c2FtZS1jaXBoZXJ0ZXh0');
});

test('legacy localStorage workspaces migrate once into per-document storage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('markdownViewerTabs', JSON.stringify([{
      id: 'legacy_document_1',
      title: 'Migrated Legacy Document',
      content: '# Migrated\n\nLegacy content survives.',
      workspaceId: 'workspace_default',
      folderId: null,
      isOpen: true,
      viewMode: 'split',
      createdAt: 1,
      lastOpenedAt: 1,
      lastEditedAt: 1
    }]));
    localStorage.setItem('markdownViewerActiveTab', 'legacy_document_1');
  });
  await openApp(page);

  await expect(page.locator('#markdown-editor')).toHaveValue(/Legacy content survives/);
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('Migrated Legacy Document');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('markdownViewerTabs'))).toBeNull();
});

test('workspace storage accepts more than the former 50-document limit', async ({ page }) => {
  await openApp(page);

  for (let index = 0; index < 55; index += 1) {
    await page.locator('#tab-new-btn').click();
  }

  await expect.poll(async () => (await readWorkspaceStore(page, 'documents')).length, {
    timeout: 30_000
  }).toBeGreaterThan(50);
  await page.getByRole('button', { name: 'Open workspace settings' }).click();
  await page.locator('#storage-settings-button').click();
  await expect(page.locator('#storage-settings-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#storage-backend-value')).toHaveText('Browser IndexedDB');
  await expect(page.locator('.storage-status-list dt')).toHaveText([
    'Storage',
    'Documents',
    'Location',
    'Usage',
    'Persistence'
  ]);
  await expect(page.locator('#storage-document-count-value')).toHaveText(/^\d+ normal, 0 secret$/);
  await expect(page.locator('#storage-location-value')).toHaveText('Browser profile · IndexedDB');
  await expect(page.locator('#storage-usage-value')).toContainText('used locally');
  await expect(page.locator('#storage-usage-value')).not.toContainText('Browser quota');
  await expect(page.locator('#storage-persistence-value')).toContainText(/Best-effort browser storage|Persistent browser storage/);
  await expect(page.locator('#storage-recovery-note')).toHaveText(
    "Clearing this site's browser data will delete local documents."
  );
  await expect(page.locator('#storage-settings-description')).toHaveCount(0);
  await expect(page.locator('#storage-request-persistence')).toHaveCount(0);
  await expect(page.locator('#storage-locate-vault')).toHaveCount(0);
  await expect(page.locator('.storage-backup-options')).toHaveCount(0);
  await expect(page.locator('.storage-secure-option')).toBeHidden();
  await page.locator('#storage-backup-button').click();
  await expect(page.locator('#storage-backup-options-title')).toHaveText('Create workspace backup');
  await expect(page.locator('.storage-secure-option')).toBeVisible();
  await expect(page.locator('#storage-secure-note')).toHaveText(
    'Secure workspace files will remain encrypted in the backup. They can only be accessed after importing the backup into Markdown Viewer and unlocking them with the correct password.'
  );
  await expect(page.locator('#storage-secure-note .lucide-shield-check')).toBeVisible();
  const noteStyles = await page.evaluate(() => {
    const recovery = getComputedStyle(document.querySelector('.storage-recovery-note'));
    const secure = getComputedStyle(document.querySelector('#storage-secure-note'));
    return {
      recovery: [recovery.backgroundColor, recovery.borderColor, recovery.color],
      secure: [secure.backgroundColor, secure.borderColor, secure.color]
    };
  });
  expect(noteStyles.recovery).toEqual(['rgb(255, 248, 197)', 'rgb(212, 167, 44)', 'rgb(99, 60, 1)']);
  expect(noteStyles.secure).toEqual(['rgb(221, 244, 255)', 'rgb(84, 174, 255)', 'rgb(5, 80, 174)']);
  await expect(page.locator('#storage-backup-options-modal .reset-modal-box')).toHaveCSS('width', '420px');
});

test('storage and backup remains usable on phone portrait and landscape layouts', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);
  await page.locator('#mobile-menu-toggle').click();
  await page.locator('[data-mobile-menu-section-toggle]', { hasText: 'Settings' }).click();
  await page.locator('#mobile-storage-settings-button').click();

  await expect(page.locator('#storage-backup-button')).toBeVisible();
  await expect(page.locator('#storage-import-button')).toBeVisible();
  await expect(page.locator('.storage-secure-option')).toBeHidden();
  await page.locator('#storage-backup-button').click();
  await expect(page.locator('.storage-secure-option')).toBeVisible();
  await expect(page.locator('#storage-secure-note')).toBeVisible();
  await expect(page.locator('#storage-backup-options-confirm')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await page.locator('#storage-backup-options-modal .reset-modal-box').boundingBox()).width).toBeLessThanOrEqual(351);

  await page.setViewportSize({ width: 812, height: 375 });
  await expect(page.locator('#storage-backup-options-title')).toBeVisible();
  await expect(page.locator('.storage-secure-option')).toBeVisible();
  await expect(page.locator('#storage-backup-options-cancel')).toBeVisible();
  await expect(page.locator('#storage-backup-options-confirm')).toBeVisible();
  await expect(page.locator('#storage-backup-options-modal .reset-modal-box')).toHaveCSS('width', '420px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.locator('#storage-backup-options-cancel').click();
  await expect(page.locator('#storage-settings-modal')).toHaveClass(/is-visible/);
  await page.locator('#storage-backup-file-input').setInputFiles({
    name: 'workspace-backup.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not parsed before confirmation')
  });
  await expect(page.locator('#storage-import-confirm-modal')).toHaveClass(/is-visible/);
  await expect(page.locator('#storage-import-confirm-title')).toHaveText('Replace current workspace?');
  await expect(page.locator('#storage-import-confirm-cancel')).toBeFocused();
  await expect(page.locator('#storage-import-confirm-modal .reset-modal-box')).toHaveCSS('width', '420px');

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('#storage-import-confirm-confirm')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#storage-settings-modal')).toHaveClass(/is-visible/);
});

test('large workspaces page Explorer rows instead of blocking on the full DOM', async ({ page }) => {
  await openApp(page);
  await page.evaluate(async () => {
    const storage = new window.MarkdownWorkspaceStorage();
    await storage.init();
    await storage.clearNormalDocuments();
    const documents = Array.from({ length: 600 }, (_, index) => ({
      id: `large_document_${index}`,
      title: `Large document ${String(index).padStart(3, '0')}`,
      content: `# Document ${index}`,
      contentLoaded: true,
      workspaceId: 'workspace_default',
      folderId: null,
      isOpen: index === 0,
      viewMode: 'split',
      createdAt: index + 1,
      lastOpenedAt: index + 1,
      lastEditedAt: index + 1
    }));
    await storage.saveDocuments(documents, null, { fullSnapshot: true, forceContent: true });
    localStorage.removeItem('markdownViewerActiveTab');
  });
  await page.reload();

  await expect(page.locator('#document-sidebar-count')).toHaveText(/60[01] files/);
  const documentCount = Number(((await page.locator('#document-sidebar-count').textContent()) || '').match(/\d+/)?.[0]);
  expect(documentCount).toBeGreaterThanOrEqual(600);
  await expect(page.locator('#document-tree .document-tree-row[data-tree-type="document"]')).toHaveCount(250);
  await expect(page.locator('.document-tree-load-more')).toContainText(`Show ${documentCount - 250} more`);
  await page.locator('.document-tree-load-more').click();
  await expect(page.locator('#document-tree .document-tree-row[data-tree-type="document"]')).toHaveCount(documentCount);
  await expect(page.locator('.document-tree-load-more')).toHaveCount(0);
});

test('mobile layout exposes menu controls at 375px width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);
  await setEditorContent(page, await fixture('basic.md'));

  await expect(page.locator('.app-brand > .github-link')).toBeVisible();
  await expect(page.locator('#stats-container')).toBeHidden();

  await page.locator('#mobile-menu-toggle').click();
  await expect(page.locator('#mobile-menu-panel')).toHaveClass(/active/);
  await expect(page.locator('#mobile-stats-container')).toBeVisible();
  await expect(page.locator('#mobile-tab-list')).toHaveCount(0);
  await expect(page.locator('#mobile-menu-panel')).toHaveCSS('position', 'fixed');
  await expect(page.locator('#mobile-menu-panel')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('#mobile-menu-title')).toHaveText('Workspace menu');
  await expect(page.locator('.mobile-menu-group-label')).toHaveText(['View', 'Document tools', 'Actions']);
  await expect(page.locator('.mobile-menu-accordion')).toHaveCSS('border-radius', '10px');
  await expect(page.locator('#mobile-stats-container')).toHaveCSS('border-top-style', 'solid');
  const menuOrder = await page.locator('.mobile-menu-accordion').evaluate(element =>
    Array.from(element.children).map(child => {
      const toggle = child.querySelector(':scope > .mobile-menu-section-toggle');
      return (toggle || child).textContent.replace(/\s+/g, ' ').trim();
    })
  );
  expect(menuOrder).toEqual(['New', 'Export', 'Share Snapshot', 'Live Share', 'Report', 'About', 'Settings']);

  const newSection = page.locator('[data-mobile-menu-section-toggle]', { hasText: 'New' });
  const exportSection = page.locator('[data-mobile-menu-section-toggle]', { hasText: 'Export' });
  const settingsSection = page.locator('[data-mobile-menu-section-toggle]', { hasText: 'Settings' });
  await newSection.click();
  await expect(newSection).toHaveAttribute('aria-expanded', 'true');
  await exportSection.click();
  await expect(newSection).toHaveAttribute('aria-expanded', 'false');
  await expect(exportSection).toHaveAttribute('aria-expanded', 'true');
  await settingsSection.click();
  await expect(exportSection).toHaveAttribute('aria-expanded', 'false');
  await expect(settingsSection).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-toggle-sync')).toBeVisible();
  await expect(page.locator('#mobile-copy-markdown')).toBeVisible();
  await expect(page.locator('#mobile-review-toggle')).toBeVisible();
  await expect(page.locator('#mobile-private-mode-toggle')).toBeVisible();
  await expect(page.locator('#mobile-theme-toggle .settings-switch')).toBeVisible();
  await expect(page.locator('#mobile-theme-switch-icon')).toHaveClass(/lucide-(sun-medium|moon)/);
  await expect(page.locator('#mobile-theme-switch-icon')).not.toHaveCSS('mask-image', 'none');
  await expect(page.locator('#mobile-private-mode-toggle .settings-switch')).toBeVisible();
  const settingsOrder = await page.locator('#mobile-menu-settings-panel > *').evaluateAll(elements =>
    elements.filter(element => element.matches('button, .mobile-menu-language')).map(element => element.id || element.className)
  );
  expect(settingsOrder[0]).toBe('mobile-theme-toggle');
  expect(settingsOrder[1]).toContain('mobile-menu-language');
  expect(settingsOrder[2]).toBe('mobile-private-mode-toggle');
  expect(settingsOrder[3]).toBe('mobile-storage-settings-button');
  expect(settingsOrder[4]).toBe('mobile-tab-reset-btn');
  await expect(page.locator('#mobile-tab-reset-btn')).toBeVisible();
  await expect(page.locator('#mobile-about-button')).toBeVisible();

  await page.locator('#close-mobile-menu').click();
  await expect(settingsSection).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#mobile-menu-toggle').click();
  await expect(settingsSection).toHaveAttribute('aria-expanded', 'false');

  await page.locator('#mobile-about-button').click();
  await expect(page.locator('#about-modal')).toHaveClass(/is-visible/);
  await page.locator('#about-modal-close').click();
  await page.locator('#mobile-menu-toggle').click();

  await page.locator('#mobile-menu-panel .mobile-view-mode-btn[data-mode="preview"]').click();
  await expect(page.locator('.content-container')).toHaveClass(/view-preview-only/);
  await expect(page.locator('#markdown-preview')).toContainText('Local Test Document');
});

test('mobile drawer resets state across dismissal and responsive changes', async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await openApp(page);

  const toggle = page.locator('#mobile-menu-toggle');
  const panel = page.locator('#mobile-menu-panel');
  const newSection = page.locator('[data-mobile-menu-section-toggle]', { hasText: 'New' });
  const settingsSection = page.locator('[data-mobile-menu-section-toggle]', { hasText: 'Settings' });
  const languageToggle = page.locator('#mobileLanguageDropdown');

  await toggle.click();
  const panelBox = await panel.boundingBox();
  expect(panelBox.height).toBe(375);
  expect(panelBox.width).toBeLessThanOrEqual(340);

  await settingsSection.click();
  await languageToggle.click();
  await expect(languageToggle).toHaveAttribute('aria-expanded', 'true');
  await newSection.click();
  await expect(settingsSection).toHaveAttribute('aria-expanded', 'false');
  await expect(languageToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(newSection).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  await expect(toggle).toBeFocused();

  await toggle.click();
  await expect(newSection).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#mobile-menu-overlay').click({ position: { x: 8, y: 8 } });
  await expect(panel).toHaveAttribute('aria-hidden', 'true');

  await toggle.click();
  await newSection.click();
  await page.setViewportSize({ width: 1080, height: 700 });
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  await expect(newSection).toHaveAttribute('aria-expanded', 'false');
});
