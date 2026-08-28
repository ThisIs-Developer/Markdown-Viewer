const { test, expect } = require('@playwright/test');
const { openApp, readWorkspaceStore, setEditorContent, storedDocuments, stubClipboard } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('tab bar uses standard file, menu, and close controls', async ({ page }) => {
  const tab = page.locator('#tab-list .tab-item.active');
  await expect(tab.locator('.tab-file-icon')).toHaveClass(/lucide-file-text/);
  await expect(tab.locator('.tab-menu-btn i')).toHaveClass(/lucide-ellipsis/);
  await expect(tab.locator('.tab-close-btn')).toBeVisible();
  await expect(page.locator('#document-sidebar-open i')).toHaveClass(/lucide-panel-left-close/);

  const order = await tab.evaluate(node => Array.from(node.children).map(child => child.className));
  expect(order.at(-2)).toContain('tab-menu-btn');
  expect(order.at(-1)).toContain('tab-close-btn');

  const sizing = await page.evaluate(() => {
    const sidebarButton = document.querySelector('#document-sidebar-open');
    const toolbarButton = document.querySelector('.header-icon-command');
    const sidebarStyle = getComputedStyle(sidebarButton);
    const toolbarStyle = getComputedStyle(toolbarButton);
    return {
      sidebar: [sidebarStyle.width, sidebarStyle.height, sidebarStyle.borderRadius],
      toolbar: [toolbarStyle.width, toolbarStyle.height, toolbarStyle.borderRadius]
    };
  });
  expect(sizing.sidebar).toEqual(sizing.toolbar);
});

test('right-click tab menu exposes split and scoped close commands', async ({ page }) => {
  await page.locator('#tab-new-btn').click();
  await page.locator('#tab-new-btn').click();
  const middleTab = page.locator('#tab-list .tab-item').nth(1);
  await middleTab.click({ button: 'right' });

  const menu = page.locator('[data-tab-context-menu="true"]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.tab-menu-item')).toHaveText([
    'Open in split view',
    'Close',
    'Close others',
    'Close to the right',
    'Close to the left',
    'Close all'
  ]);
  await page.keyboard.press('Escape');
  const tabListBox = await page.locator('#tab-list').boundingBox();
  await page.locator('#tab-list').click({ button: 'right', position: { x: tabListBox.width - 4, y: tabListBox.height / 2 } });
  await expect(page.locator('[data-tab-context-menu="true"]')).toBeVisible();
});

test('split view uses one combined tab and offers only edit or preview modes', async ({ page }) => {
  const firstTab = page.locator('#tab-list .tab-item').first();
  await firstTab.locator('.tab-menu-btn').click();
  await page.locator('.tab-menu-dropdown.open [data-action="rename"]').click();
  await page.locator('#rename-modal-input').fill('Primary architecture decision record for the document sidebar');
  await page.locator('#rename-modal-confirm').click();
  await expect(firstTab.locator('.tab-title')).toContainText('Primary architecture decision record');
  await page.locator('#tab-new-btn').click();
  const secondaryContent = '# Secondary implementation notes for synchronized preview\n\n' + Array.from({ length: 120 }, (_, index) => `Line ${index + 1}: synchronized split content`).join('\n\n');
  await setEditorContent(page, secondaryContent);
  const secondTab = page.locator('#tab-list .tab-item.active');
  await secondTab.locator('.tab-menu-btn').click();
  await page.locator('.tab-menu-dropdown.open [data-action="rename"]').click();
  await page.locator('#rename-modal-input').fill('Secondary implementation notes for synchronized preview');
  await page.locator('#rename-modal-confirm').click();
  const secondTabId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');

  await firstTab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view' }).click();
  await page.locator('#document-split-destination').selectOption(secondTabId);
  await page.locator('#document-split-modal-confirm').click();

  await expect(page.locator('.content-container')).toHaveClass(/document-split-active/);
  await expect(page.locator('#document-split-pane')).toBeVisible();
  await expect(page.locator('#document-split-editor')).toHaveValue(secondaryContent);
  await expect(page.locator('.document-split-header')).toHaveCount(0);
  await expect(page.locator('#document-split-close')).toHaveCount(0);
  const splitTab = page.locator('#tab-list .tab-item.is-document-split');
  await expect(splitTab).toHaveCount(1);
  await expect(splitTab.locator('.tab-file-icon')).toHaveClass(/lucide-columns-2/);
  await expect(splitTab.locator('.tab-split-title')).toHaveCount(2);
  await expect(page.locator('.view-toolbar [data-view-mode="split"]')).toBeVisible();
  await expect(page.locator('.view-toolbar [data-view-mode="split"]')).toBeDisabled();
  await expect(page.locator('.view-toolbar [data-view-mode="editor"]')).toBeVisible();
  await expect(page.locator('.view-toolbar [data-view-mode="preview"]')).toBeVisible();
  await expect(page.locator('#toggle-sync')).toBeVisible();
  await expect(page.locator('#toggle-sync')).toBeEnabled();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await expect(page.locator('#document-split-editor')).toBeVisible();
  await expect(page.locator('#document-split-preview')).toBeHidden();
  await page.locator('#markdown-editor').evaluate(editor => { editor.scrollTop = editor.scrollHeight; editor.dispatchEvent(new Event('scroll')); });
  await expect.poll(() => page.locator('#document-split-editor').evaluate(editor => editor.scrollTop)).toBeGreaterThan(0);
  await expect(splitTab.locator('.tab-split-title').first()).toHaveCSS('text-overflow', 'ellipsis');
  const splitTabWidth = await splitTab.evaluate(tab => tab.getBoundingClientRect().width);
  expect(splitTabWidth).toBeGreaterThanOrEqual(350);
  expect(splitTabWidth).toBeLessThanOrEqual(360);
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();
  await expect(page.locator('#markdown-preview')).toBeVisible();
  await expect(page.locator('#markdown-editor')).toBeHidden();
  await expect(page.locator('#document-split-pane')).toBeVisible();
  await expect(page.locator('#document-split-editor')).toBeHidden();
  await expect(page.locator('#document-split-preview')).toBeVisible();
  await expect(page.locator('#document-split-preview')).toContainText('Secondary implementation notes');
  await page.locator('.preview-pane').evaluate(preview => { preview.scrollTop = preview.scrollHeight; preview.dispatchEvent(new Event('scroll')); });
  await expect.poll(() => page.locator('#document-split-preview').evaluate(preview => preview.scrollTop)).toBeGreaterThan(0);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.locator('.view-toolbar [data-view-mode="editor"]').click();
  await page.locator('#document-split-editor').fill('# Edited in split');

  await page.locator(`.document-tree-row[data-document-id="${secondTabId}"] .document-tree-main`).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Edited in split');
  await expect(page.locator('#document-split-pane')).toBeVisible();
  await page.locator('#tab-list .tab-item.is-document-split').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Exit split view' }).click();
  await expect(page.locator('#document-split-pane')).toBeHidden();
  await expect(page.locator('.view-toolbar [data-view-mode="split"]')).toBeEnabled();
});

test('header groups document actions before application preferences', async ({ page }) => {
  const header = page.locator('.header-right');
  await expect(header.locator('#importDropdown')).toBeVisible();
  await expect(header.locator('#share-button')).toBeVisible();
  await expect(header.locator('#live-share-button')).toBeVisible();
  await expect(header.locator('[aria-label="Report an issue"]')).toBeVisible();
  await expect(header.locator('#header-about-button')).toBeVisible();
  await expect(header.locator('#workspaceSettingsDropdown')).toBeVisible();
  await expect(header.locator('#exportDropdown')).toBeVisible();
  await expect(header.locator('#toggle-sync, #review-toggle, #copy-markdown-button')).toHaveCount(3);
  await expect(header.locator('.header-view-toolbar .view-toggle-btn')).toHaveCount(3);
  const headerActions = await header.locator(':scope > button, :scope > a, :scope > .dropdown > button').evaluateAll(elements =>
    elements.map(element => element.id || element.getAttribute('aria-label'))
  );
  expect(headerActions).toEqual([
    'toggle-sync',
    'importDropdown',
    'copy-markdown-button',
    'exportDropdown',
    'share-button',
    'live-share-button',
    'review-toggle',
    'Report an issue',
    'header-about-button',
    'workspaceSettingsDropdown'
  ]);

  const formatToolbar = page.locator('#markdown-format-toolbar');
  await expect(formatToolbar.locator('#toggle-sync, #copy-markdown-button, #review-toggle')).toHaveCount(0);
  await expect(formatToolbar.locator('#exportDropdown')).toHaveCount(0);
  await expect(formatToolbar.locator('#documentActionsDropdown')).toHaveCount(0);
  await expect(page.locator('.app-brand-logo')).toHaveCount(0);

  await header.locator('#toggle-sync').click();
  await expect(header.locator('#toggle-sync')).toHaveAttribute('aria-pressed', 'false');
  await expect(header.locator('#toggle-sync')).toHaveAttribute('aria-label', 'Enable synchronized scrolling');
  await header.locator('#toggle-sync').click();
  await expect(header.locator('#toggle-sync')).toHaveAttribute('aria-pressed', 'true');
  await stubClipboard(page);
  await header.locator('#copy-markdown-button').click();
  await expect(header.locator('#copy-markdown-button')).toHaveAttribute('aria-label', 'Copied');
  await expect(header.locator('#copy-markdown-button i')).toHaveClass(/lucide-check/);
  await expect.poll(() => page.evaluate(() => window.__copiedText)).not.toBe('');

  const initialTabCount = await page.locator('#tab-list .tab-item').count();
  await header.locator('#importDropdown').click();
  const newMenu = header.locator('[aria-labelledby="importDropdown"]');
  await expect(newMenu).toBeVisible();
  await expect(newMenu.locator('.app-menu-label')).toHaveText(['New document', 'From files', 'From GitHub']);
  await expect(newMenu.locator('.settings-menu-header, .app-menu-description')).toHaveCount(0);
  await newMenu.locator('#header-new-document').click();
  await expect(page.locator('#tab-list .tab-item')).toHaveCount(initialTabCount + 1);

  await page.locator('#workspaceSettingsDropdown').click();
  const settings = page.locator('.settings-menu');
  await expect(settings).toBeVisible();
  await expect(settings).toContainText('Workspace settings');
  await expect(settings).not.toContainText('Appearance and preferences');
  await expect(settings.locator('#theme-toggle')).toContainText('Appearance');
  await expect(settings.locator('#languageDropdown')).toBeVisible();
  await expect(settings.locator('#private-mode-toggle')).toBeVisible();
  await expect(settings.locator('#storage-settings-button')).toContainText('Storage and Backup');
  await expect(settings.locator('#trash-settings-button')).toContainText('Trash');
  await expect(settings.locator('#tab-reset-btn')).toContainText('Reset workspace');
  await settings.locator('#theme-toggle').click();
  await expect(settings.locator('#theme-toggle')).toContainText('Appearance');
  await page.locator('#workspaceSettingsDropdown').click();

  await expect(formatToolbar.locator('.markdown-tool-select--insert, [data-toolbar-menu="insert"]')).toHaveCount(0);
  await expect(formatToolbar.locator('.markdown-toolbar-group--content > .markdown-tool-btn')).toHaveCount(4);
  await expect(formatToolbar.locator('.markdown-toolbar-group--technical > .markdown-tool-btn')).toHaveCount(3);
  await expect(formatToolbar.locator('.markdown-toolbar-group--advanced > .markdown-tool-btn')).toHaveCount(5);

  await header.locator('#exportDropdown').click();
  const exportMenu = page.locator('[aria-labelledby="exportDropdown"]');
  await expect(exportMenu).toBeVisible();
  await expect(exportMenu).not.toHaveClass(/toolbar-portal-menu/);
  await expect(exportMenu).toBeInViewport();

  await expect(header.locator('.header-view-toolbar .view-toggle-btn')).toHaveCount(3);
  expect(await header.locator('.header-view-toolbar .view-toggle-btn').evaluateAll(buttons =>
    buttons.map(button => button.getAttribute('data-view-mode'))
  )).toEqual(['editor', 'split', 'preview']);
  const activeStyle = await page.locator('.view-toggle-btn.is-active').evaluate(button => ({
    borderWidth: getComputedStyle(button).borderTopWidth,
    boxShadow: getComputedStyle(button).boxShadow,
    backgroundColor: getComputedStyle(button).backgroundColor
  }));
  expect(activeStyle.borderWidth).toBe('0px');
  expect(activeStyle.boxShadow).not.toBe('none');
  expect(activeStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
});

test('secret workspace accepts pasted 8-character access keys without password fields', async ({ page }) => {
  await page.locator('.document-tree-row[data-tree-id="workspace_secret"] .document-tree-main').click();
  const password = page.locator('#secret-workspace-key');
  const confirmation = page.locator('#secret-workspace-key-confirm');
  await password.fill('12345678');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
  await page.evaluate(async () => await navigator.clipboard.writeText('12345678'));
  await confirmation.focus();
  await confirmation.press('ControlOrMeta+v');
  await expect(confirmation).toHaveValue('12345678');
  await expect(password).toHaveAttribute('autocomplete', 'off');
  await expect(page.locator('#secret-workspace-modal').locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('#secret-workspace-key-guidance')).toHaveText('Use at least 8 characters.');
  await page.locator('#secret-workspace-modal-confirm').click();
  await expect(page.locator('#secret-workspace-modal')).toBeHidden();
});

test('closing a tab keeps the document in Files and reopening restores the tab', async ({ page }) => {
  await page.locator('#tab-new-btn').click();
  const closedTabId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await setEditorContent(page, '# Kept document');
  await expect.poll(async () => JSON.stringify(await storedDocuments(page))).toContain('# Kept document');
  await page.locator('#tab-list .tab-item.active .tab-close-btn').click();

  await expect(page.locator(`.tab-item[data-tab-id="${closedTabId}"]`)).toHaveCount(0);
  await expect(page.locator(`.document-tree-row[data-document-id="${closedTabId}"]`)).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await expect(page.locator(`.tab-item[data-tab-id="${closedTabId}"]`)).toHaveCount(0);
  await expect(page.locator(`.document-tree-row[data-document-id="${closedTabId}"]`)).toHaveCount(1);
  await page.locator(`.document-tree-row[data-document-id="${closedTabId}"] .document-tree-main`).click();
  await expect(page.locator(`.tab-item[data-tab-id="${closedTabId}"]`)).toBeVisible();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Kept document');

  const reopenedRow = page.locator(`.document-tree-row[data-document-id="${closedTabId}"]`);
  await reopenedRow.hover();
  await reopenedRow.locator('.document-menu-btn').click();
  await page.locator('.document-menu-dropdown.open [data-action="delete"]').click();
  await expect(page.locator('#document-confirm-modal')).not.toBeVisible();
  await expect(reopenedRow).toHaveCount(0);
  const trash = await readWorkspaceStore(page, 'trash');
  expect(trash).toEqual(expect.arrayContaining([
    expect.objectContaining({ documentId: closedTabId, content: '# Kept document' })
  ]));
});

test('reopening the only closed tab restores the word/char/reading-time stats', async ({ page }) => {
  const closedTabId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await setEditorContent(page, '# Kept document\n\nSome words to count here.');

  await expect(page.locator('#word-count')).toHaveText('8');
  await expect(page.locator('#char-count')).toHaveText('42');

  await page.locator('#tab-list .tab-item.active .tab-close-btn').click();
  await expect(page.locator('#word-count')).toHaveText('0');
  await expect(page.locator('#char-count')).toHaveText('0');

  await page.locator(`.document-tree-row[data-document-id="${closedTabId}"] .document-tree-main`).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Kept document\n\nSome words to count here.');
  await expect(page.locator('#word-count')).toHaveText('8');
  await expect(page.locator('#char-count')).toHaveText('42');
  await expect(page.locator('#reading-time')).toHaveText('1');
});

test('format toolbar consolidates heading, case, alignment, and insert actions', async ({ page }) => {
  await expect(page.locator('[data-md-action="clear-formatting"]')).toHaveCount(0);
  await expect(page.locator('[data-md-action="help"]')).toHaveCount(0);
  await expect(page.locator('[data-md-action="info"]')).toBeVisible();
  const headingToggle = page.locator('[data-toolbar-menu-toggle="heading"]');
  await expect(headingToggle).toBeVisible();
  const caseToggle = page.locator('[data-toolbar-menu-toggle="case"]');
  await expect(caseToggle).toBeVisible();
  await expect(caseToggle).toHaveClass(await headingToggle.getAttribute('class'));
  await expect(caseToggle.locator(':scope > .lucide-case-sensitive')).toHaveCount(1);
  expect(await caseToggle.locator(':scope > .lucide-case-sensitive').evaluate(element => getComputedStyle(element).maskImage)).not.toBe('none');
  await expect(caseToggle.locator(':scope > span')).toHaveCount(0);
  await expect(caseToggle.locator(':scope > .lucide-chevron-down')).toHaveCount(1);
  const readToggleStyles = toggle => toggle.evaluate(button => {
    const style = getComputedStyle(button);
    const chevronStyle = getComputedStyle(button.querySelector('.lucide-chevron-down'));
    return {
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height,
      padding: style.padding,
      gap: style.gap,
      borderRadius: style.borderRadius,
      color: style.color,
      backgroundColor: style.backgroundColor,
      chevronSize: chevronStyle.fontSize,
      chevronOpacity: chevronStyle.opacity
    };
  });
  expect(await readToggleStyles(caseToggle)).toEqual(await readToggleStyles(headingToggle));
  const caseIcon = caseToggle.locator('.lucide-case-sensitive');
  const largeIconSize = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ui-icon-size-lg').trim()
  );
  await expect(caseIcon).toHaveCSS('font-size', largeIconSize);
  expect(await caseIcon.evaluate(icon => Number.parseFloat(getComputedStyle(icon).fontSize)))
    .toBeGreaterThan(await page.locator('[data-md-action="bold"] > i').evaluate(icon => Number.parseFloat(getComputedStyle(icon).fontSize)));
  await expect(page.locator('[data-toolbar-menu-toggle="alignment"]')).toBeVisible();
  await expect(page.locator('[data-toolbar-menu-toggle="insert"], [data-toolbar-menu="insert"]')).toHaveCount(0);
  await expect(page.locator('.markdown-toolbar-group--content > .markdown-tool-btn')).toHaveCount(4);
  await expect(page.locator('.markdown-toolbar-group--technical > .markdown-tool-btn')).toHaveCount(3);
  await expect(page.locator('.markdown-toolbar-group--advanced > .markdown-tool-btn')).toHaveCount(5);

  await setEditorContent(page, 'toolbar heading');
  await page.locator('[data-toolbar-menu-toggle="heading"]').click();
  await expect(page.locator('[data-toolbar-menu="heading"] .markdown-tool-menu-item')).toHaveCount(6);
  await expect(page.locator('[data-toolbar-menu="heading"] [data-md-action="paragraph"]')).toHaveCount(0);
  await page.locator('[data-toolbar-menu="heading"] [data-md-level="2"]').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('## toolbar heading');

  await page.locator('#markdown-editor').evaluate(editor => {
    editor.focus();
    editor.setSelectionRange(3, editor.value.length);
  });
  await page.locator('[data-toolbar-menu-toggle="case"]').click();
  await page.locator('[data-toolbar-menu="case"] [data-md-action="uppercase"]').click();
  await expect(page.locator('#markdown-editor')).toHaveValue('## TOOLBAR HEADING');
  await page.locator('[data-md-action="info"]').click();
  await expect(page.locator('#about-modal-title')).toHaveText('About Markdown Viewer');
  await expect(page.locator('#about-modal')).toContainText('Open source');
  await expect(page.locator('#about-modal').getByRole('link', { name: 'GitHub Repository' })).toBeVisible();
  await expect(page.locator('#about-modal')).not.toContainText('Clear local data');
  await expect(page.locator('#about-modal #private-mode-toggle')).toHaveCount(0);
  await page.locator('#about-modal-close').click();
});

test('preview code and terminal blocks show language labels and copy controls', async ({ page }) => {
  await setEditorContent(page, [
    '```javascript',
    'const answer = 42;',
    '```',
    '',
    '```python',
    'print("hello")',
    '```',
    '',
    '```bash',
    'npm run dev',
    '```'
  ].join('\n'));
  await page.locator('.view-toolbar [data-view-mode="preview"]').click();
  const blocks = page.locator('#markdown-preview .code-preview-block');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.locator('.code-preview-language')).toHaveText(['JS', 'PY', 'SH']);
  await expect(blocks.nth(0).locator('.code-preview-language')).toHaveAttribute('title', 'JavaScript');
  await expect(blocks.nth(2)).toHaveClass(/is-terminal/);
  await expect(blocks.locator('.code-preview-copy')).toHaveCount(3);
  await page.evaluate(() => {
    window.__copiedPreviewText = '';
    navigator.clipboard.writeText = text => {
      window.__copiedPreviewText = text;
      return Promise.resolve();
    };
  });
  await blocks.nth(0).locator('.code-preview-copy').click();
  await expect(blocks.nth(0).locator('.code-preview-copy')).toContainText('Copied');
  await expect.poll(() => page.evaluate(() => window.__copiedPreviewText)).toBe('const answer = 42;');
});

test('Files tree highlights only the active file and draws nesting guides', async ({ page }) => {
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill('Research');
  await page.locator('#document-name-modal-confirm').click();
  const folderRow = page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: 'Research' });
  await page.locator('#sidebar-new-document').click();

  const activeRow = page.locator('.document-tree-row.is-active');
  await activeRow.hover();
  await activeRow.locator('.document-menu-btn').click();
  await page.locator('.document-menu-dropdown.open [data-action="favorite"]').click();

  await expect(activeRow).toHaveCount(1);
  await expect(activeRow).toHaveAttribute('data-tree-type', 'document');
  await expect(page.locator('.document-tree-row[data-tree-type="workspace"].is-active')).toHaveCount(0);
  await expect(page.locator('.document-tree-row[data-tree-type="folder"].is-active')).toHaveCount(0);
  await expect(page.locator('.document-tree-row[data-tree-type="document"][data-tree-depth="2"]')).toHaveCount(1);
  await expect(activeRow.locator('.document-favorite-indicator')).toHaveClass(/lucide-star-filled/);
  const activeVisuals = await activeRow.evaluate(row => {
    const rowStyle = getComputedStyle(row);
    const mainStyle = getComputedStyle(row.querySelector('.document-tree-main'));
    const starStyle = getComputedStyle(row.querySelector('.document-favorite-indicator'));
    return { rowBackground: rowStyle.backgroundColor, mainBackground: mainStyle.backgroundColor, starColor: starStyle.color };
  });
  expect(activeVisuals.rowBackground).toBe('rgba(0, 0, 0, 0)');
  expect(activeVisuals.mainBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(activeVisuals.starColor).toBe('rgb(217, 119, 6)');
  await expect(folderRow.locator('.document-tree-main > i')).toHaveClass(/lucide-folder-open/);
  await folderRow.locator('.document-tree-toggle').click();
  await expect(page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: 'Research' }).locator('.document-tree-main > i')).toHaveClass(/lucide-folder$/);
  await page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: 'Research' }).locator('.document-tree-toggle').click();
  const guideColor = await page.locator('.document-tree-group--folder').evaluate(group => getComputedStyle(group, '::before').backgroundColor);
  expect(guideColor).not.toBe('rgba(0, 0, 0, 0)');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(activeRow.locator('.document-favorite-indicator')).toHaveCSS('color', 'rgb(251, 191, 36)');
});

test('close all produces an empty editor state without deleting files', async ({ page }) => {
  await page.locator('#tab-new-btn').click();
  const fileCount = await page.locator('.document-tree-row[data-document-id]').count();
  await page.locator('#tab-list .tab-item.active').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Close all' }).click();

  await expect(page.locator('#tab-list .tab-item')).toHaveCount(0);
  await expect(page.locator('#no-open-document')).toBeVisible();
  await expect(page.locator('.document-tree-row[data-document-id]')).toHaveCount(fileCount);
  await expect(page.locator('#no-open-document-new')).toHaveClass(/no-open-document-action/);
  await page.locator('#no-open-document').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#no-open-document-explorer')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#no-open-document-new')).toBeFocused();
  expect(await page.locator('#no-open-document-new').evaluate(button => getComputedStyle(button).outlineStyle)).not.toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#no-open-document-new')).toHaveCSS('transition-duration', '0s');
  for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport);
    const metrics = await page.locator('#no-open-document').evaluate(emptyState => ({
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      buttonHeights: Array.from(emptyState.querySelectorAll('.no-open-document-action'), button => button.getBoundingClientRect().height)
    }));
    expect(metrics.horizontalOverflow).toBe(false);
    expect(metrics.buttonHeights.every(height => height >= 44)).toBe(true);
  }
  await page.locator('#no-open-document-new').click();
  await expect(page.locator('#tab-list .tab-item')).toHaveCount(1);
  await expect(page.locator('.document-tree-row[data-document-id]')).toHaveCount(fileCount + 1);
});

test('close all batches 400 open tabs without blocking the page', async ({ page }) => {
  const seededCount = 400;
  await page.evaluate(async count => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('markdownViewerWorkspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['documents', 'contents'], 'readwrite');
    const documents = transaction.objectStore('documents');
    const contents = transaction.objectStore('contents');
    const now = Date.now();
    for (let index = 0; index < count; index++) {
      const id = `bulk_${String(index).padStart(3, '0')}`;
      documents.put({
        id,
        title: `Bulk ${index + 1}`,
        scrollPos: 0,
        viewMode: 'split',
        reviewThreads: [],
        favorite: false,
        isOpen: true,
        createdAt: now + index,
        lastOpenedAt: now + index,
        lastEditedAt: now + index,
        workspaceId: 'workspace_default',
        folderId: null,
        contentLoaded: false,
        contentSize: 8
      });
      contents.put({ id, content: '# Bulk', updatedAt: now });
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    localStorage.setItem('markdownViewerActiveTab', `bulk_${String(count - 1).padStart(3, '0')}`);
  }, seededCount);
  await page.reload();
  await expect(page.locator('#tab-list .tab-item')).toHaveCount(seededCount + 1);

  await page.locator('#tab-list .tab-item.active').click({ button: 'right' });
  const startedAt = Date.now();
  await page.getByRole('menuitem', { name: 'Close all' }).click();
  await expect(page.locator('#tab-list .tab-item')).toHaveCount(0);
  expect(Date.now() - startedAt).toBeLessThan(3000);
  await expect(page.locator('#no-open-document')).toBeVisible();
  await expect.poll(async () => (await storedDocuments(page)).filter(document => document.isOpen === false).length).toBeGreaterThanOrEqual(seededCount);
});

test('toolbar stays usable on phone and landscape widths', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('#markdown-format-toolbar')).toBeVisible();
  await expect(page.locator('[data-toolbar-menu-toggle="heading"]')).toBeVisible();
  await page.locator('[data-toolbar-menu-toggle="heading"]').click();
  await expect(page.locator('[data-toolbar-menu="heading"]')).toBeVisible();
  await page.keyboard.press('Escape');
  const toolbar = page.locator('#markdown-format-toolbar');
  await toolbar.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await expect(toolbar.locator('.markdown-toolbar-group--advanced [data-md-action="alert"]')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
