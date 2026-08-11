const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');

test('file sidebar toggle lives beside the tab list and remains available', async ({ page }) => {
  const errors = await openApp(page);
  const tabBar = page.locator('#tab-bar');
  const toggle = page.locator('#document-sidebar-open');

  await expect(tabBar.locator(':scope > #document-sidebar-open')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).not.toHaveClass(/is-active/);
  await expect(toggle).toHaveAttribute('aria-label', 'Close Explorer');
  await expect(toggle.locator('i')).toHaveClass(/lucide-panel-left-close$/);

  await toggle.click();
  await expect(page.locator('body')).toHaveClass(/document-sidebar-collapsed/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('aria-label', 'Open Explorer');
  await expect(toggle.locator('i')).toHaveClass(/lucide-panel-left-open/);
  await expect(page.locator('#document-sidebar')).toBeHidden();

  await toggle.click();
  await expect(page.locator('body')).not.toHaveClass(/document-sidebar-collapsed/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#document-sidebar')).toBeVisible();
  expect(errors).toEqual([]);
});

test('sidebar resizer matches the editor divider and remains keyboard operable', async ({ page }) => {
  await openApp(page);
  const sidebarResizer = page.locator('#document-sidebar-resizer');
  const editorDivider = page.locator('.resize-divider');
  await expect(sidebarResizer.locator('.resize-divider-handle')).toHaveCount(1);

  const metrics = await page.evaluate(() => {
    const sidebar = document.querySelector('#document-sidebar-resizer');
    const divider = document.querySelector('.resize-divider');
    const sidebarHandle = sidebar.querySelector('.resize-divider-handle');
    const dividerHandle = divider.querySelector('.resize-divider-handle');
    return {
      sidebar: [getComputedStyle(sidebar).width, getComputedStyle(sidebarHandle).width, getComputedStyle(sidebarHandle).height],
      divider: [getComputedStyle(divider).width, getComputedStyle(dividerHandle).width, getComputedStyle(dividerHandle).height]
    };
  });
  expect(metrics.sidebar).toEqual(metrics.divider);

  const initialValue = Number(await sidebarResizer.getAttribute('aria-valuenow'));
  await sidebarResizer.focus();
  await sidebarResizer.press('ArrowRight');
  await expect(sidebarResizer).toHaveAttribute('aria-valuenow', String(initialValue + 10));
});

test('sidebar uses toolbar-sized Markdown icons and full-row interaction states', async ({ page }) => {
  await openApp(page);

  const iconSizes = await page.evaluate(() => {
    const toolbarIcon = document.querySelector('.toolbar .tool-button i');
    const documentIcon = document.querySelector('.document-tree-row[data-tree-type="document"] .document-tree-main > i');
    return {
      toolbar: getComputedStyle(toolbarIcon).fontSize,
      document: getComputedStyle(documentIcon).fontSize
    };
  });
  expect(iconSizes).toEqual({ toolbar: '14px', document: '14px' });

  const secretRow = page.locator('.document-tree-row[data-tree-id="workspace_secret"]');
  const secretMenu = secretRow.locator('.document-tree-action');
  await expect(secretMenu).toHaveCSS('opacity', '0');
  await secretRow.hover();
  await expect(secretMenu).toHaveCSS('opacity', '1');

  const background = await secretRow.evaluate(row => getComputedStyle(row).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
});

test('documents open on a single click and collapse all is available', async ({ page }) => {
  await openApp(page);

  const welcomeId = await page.locator('.document-tree-row[data-tree-type="document"]').first().getAttribute('data-document-id');
  const welcomeRow = page.locator(`.document-tree-row[data-document-id="${welcomeId}"]`);
  await page.locator('#tab-new-btn').click();
  await expect(welcomeRow).not.toHaveClass(/is-active/);

  await welcomeRow.locator('.document-tree-main').click();
  await expect(welcomeRow).toHaveClass(/is-active/);
  await expect(page.locator(`.tab-item[data-tab-id="${welcomeId}"]`)).toHaveClass(/active/);

  const workspaceRow = page.locator('.document-tree-row[data-tree-id="workspace_default"]');
  await expect(workspaceRow).toHaveAttribute('aria-expanded', 'true');
  const openFolderIcon = workspaceRow.locator('.document-tree-main > i.lucide-folder-open');
  await expect(openFolderIcon).toHaveCount(1);
  const openFolderColor = await openFolderIcon.evaluate(icon => getComputedStyle(icon).color);
  await page.locator('#document-sidebar-collapse-all').click();
  await expect(workspaceRow).toHaveAttribute('aria-expanded', 'false');
  const closedFolderIcon = workspaceRow.locator('.document-tree-main > i.lucide-folder');
  await expect(closedFolderIcon).toHaveCount(1);
  const closedFolderColor = await closedFolderIcon.evaluate(icon => getComputedStyle(icon).color);
  expect(closedFolderColor).not.toBe(openFolderColor);
  await expect(page.locator('#document-sidebar-collapse-all')).toHaveAttribute('aria-label', 'Expand all folders');
  await expect(page.locator('#document-sidebar-collapse-all i')).toHaveClass(/lucide-unfold-vertical/);
  await page.locator('#document-sidebar-collapse-all').click();
  await expect(workspaceRow).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#document-sidebar-collapse-all')).toHaveAttribute('aria-label', 'Collapse all folders');
});

test('workspace rows toggle from their name and keyboard', async ({ page }) => {
  await openApp(page);
  let workspace = page.locator('.document-tree-row[data-tree-id="workspace_default"]');
  await expect(workspace).toHaveAttribute('aria-expanded', 'true');

  await workspace.locator('.document-tree-label').click();
  workspace = page.locator('.document-tree-row[data-tree-id="workspace_default"]');
  await expect(workspace).toHaveAttribute('aria-expanded', 'false');

  await workspace.focus();
  await workspace.press('Enter');
  workspace = page.locator('.document-tree-row[data-tree-id="workspace_default"]');
  await expect(workspace).toHaveAttribute('aria-expanded', 'true');
});

test('folder menus contain management actions without a redundant Open action', async ({ page }) => {
  await openApp(page);
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill('Menu folder');
  await page.locator('#document-name-modal-confirm').click();

  const folder = page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: 'Menu folder' });
  await folder.click({ button: 'right' });
  const menu = page.locator('.document-menu-context.open');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toContainText(['New file', 'New folder', 'Rename', 'Delete']);
  await expect(menu.getByRole('menuitem', { name: /^Open$/ })).toHaveCount(0);
});

test('folder rows toggle from the label and keyboard while keeping aria-expanded current', async ({ page }) => {
  await openApp(page);
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill('Keyboard folder');
  await page.locator('#document-name-modal-confirm').click();

  let folder = page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: 'Keyboard folder' });
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  await folder.locator('.document-tree-label').click();
  folder = page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: 'Keyboard folder' });
  await expect(folder).toHaveAttribute('aria-expanded', 'false');
  await folder.focus();
  await folder.press('Enter');
  folder = page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: 'Keyboard folder' });
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  await folder.focus();
  await folder.press('Space');
  await expect(page.locator('.document-tree-row[data-tree-type="folder"]', { hasText: 'Keyboard folder' })).toHaveAttribute('aria-expanded', 'false');
});

test('Explorer supports modifier selection, contextual bulk delete, and selection clearing', async ({ page }) => {
  await openApp(page);
  await page.locator('#tab-new-btn').click();
  await page.locator('#tab-new-btn').click();
  const rows = page.locator('.document-tree-row[data-tree-type="document"]:not(.document-tree-temporary)');
  await expect(rows).toHaveCount(3);

  await rows.nth(0).focus();
  await rows.nth(0).press('Shift+F10');
  await expect(page.locator('.document-menu-context.open')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(rows.nth(0)).toBeFocused();

  await rows.nth(0).click();
  await rows.nth(1).click({ modifiers: ['Control'] });
  await expect(page.locator('.document-tree-row.is-selected')).toHaveCount(2);
  await rows.nth(2).click({ modifiers: ['Meta'] });
  await expect(page.locator('.document-tree-row.is-selected')).toHaveCount(3);
  await rows.nth(2).click({ modifiers: ['Meta'] });
  await expect(page.locator('.document-tree-row.is-selected')).toHaveCount(2);
  await rows.nth(0).click();
  await rows.nth(2).click({ modifiers: ['Shift'] });
  await expect(page.locator('.document-tree-row.is-selected')).toHaveCount(3);

  await rows.nth(1).click({ button: 'right' });
  const contextMenu = page.locator('.document-menu-context.open');
  await expect(contextMenu).toHaveCount(1);
  await expect(contextMenu.getByRole('menuitem')).toHaveText([
    'Open all',
    'Move to…',
    'Delete 3 selected items'
  ]);
  await contextMenu.getByRole('menuitem', { name: 'Move to…' }).click();
  await expect(page.locator('#document-move-modal')).toBeVisible();
  await expect(page.locator('#document-move-modal-title')).toHaveText('Move 3 selected files');
  await page.locator('#document-move-modal-cancel').click();

  await rows.nth(1).click({ button: 'right' });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name: 'Delete 3 selected items' }).click();
  await expect(page.locator('#document-confirm-modal')).toBeVisible();
  await expect(page.locator('#document-confirm-modal-title')).toHaveText('Delete 3 selected items?');
  await page.locator('#document-confirm-modal-cancel').click();

  await rows.nth(1).click({ button: 'right' });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name: 'Delete 3 selected items' }).click();
  await page.locator('#document-confirm-modal-confirm').click();
  await expect(page.locator('.document-tree-row[data-tree-type="document"]:not(.document-tree-temporary)')).toHaveCount(0);

  await page.locator('#document-tree').evaluate(tree => tree.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(page.locator('.document-tree-row.is-selected')).toHaveCount(0);
});

test('Explorer opens and moves multiple selected documents', async ({ page }) => {
  await openApp(page);
  await page.locator('#sidebar-new-folder').click();
  await page.locator('#document-name-modal-input').fill('Bulk destination');
  await page.locator('#document-name-modal-confirm').click();

  await page.locator('#tab-new-btn').click();
  const firstId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#tab-new-btn').click();
  const secondId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator(`#tab-list .tab-item[data-tab-id="${secondId}"] .tab-close-btn`).click();
  await page.locator(`#tab-list .tab-item[data-tab-id="${firstId}"] .tab-close-btn`).click();

  const firstRow = page.locator(`.document-tree-row[data-document-id="${firstId}"]`);
  const secondRow = page.locator(`.document-tree-row[data-document-id="${secondId}"]`);
  await firstRow.click();
  await secondRow.click({ modifiers: ['Control'] });
  await secondRow.click({ button: 'right' });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name: 'Open all' }).click();
  await expect(page.locator(`#tab-list .tab-item[data-tab-id="${firstId}"]`)).toBeVisible();
  await expect(page.locator(`#tab-list .tab-item[data-tab-id="${secondId}"]`)).toBeVisible();

  await firstRow.click();
  await secondRow.click({ modifiers: ['Control'] });
  await secondRow.click({ button: 'right' });
  await page.locator('.document-menu-context.open').getByRole('menuitem', { name: 'Move to…' }).click();
  await page.locator('#document-move-destination').selectOption({ label: 'Workspace / Bulk destination' });
  await page.locator('#document-move-modal-confirm').click();
  await expect(firstRow).toHaveAttribute('data-tree-depth', '2');
  await expect(secondRow).toHaveAttribute('data-tree-depth', '2');
});

test('sidebar filters use a compact three-part segmented control', async ({ page }) => {
  await openApp(page);
  const filters = page.locator('.document-sidebar-filters');
  await expect(filters.locator('.document-filter-btn')).toHaveText(['All', 'Recent', 'Favs']);
  const layout = await filters.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      columns: style.gridTemplateColumns.split(' ').length,
      radius: style.borderRadius,
      borderStyle: style.borderStyle
    };
  });
  expect(layout.columns).toBe(3);
  expect(layout.radius).toBe('6px');
  expect(layout.borderStyle).toBe('solid');
  await page.locator('[data-document-filter="recent"]').click();
  await expect(page.locator('[data-document-filter="recent"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-document-filter="all"]')).not.toHaveClass(/is-active/);
});

test('mobile keeps a touch-sized sidebar toggle in the tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);

  const toggle = page.locator('#document-sidebar-open');
  await expect(page.locator('#tab-bar')).toBeVisible();
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  const box = await toggle.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  await toggle.click();
  await expect(page.locator('body')).toHaveClass(/document-sidebar-mobile-open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#document-sidebar-search')).not.toBeFocused();
  await page.locator('#document-sidebar-close').click();
  await expect(page.locator('body')).not.toHaveClass(/document-sidebar-mobile-open/);

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
});

test('sidebar remains usable on a small landscape viewport with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 667, height: 375 });
  await openApp(page);

  await expect(page.locator('#document-sidebar-open')).toBeVisible();
  const transitionDuration = await page.locator('.document-tree-row').first().evaluate(row => getComputedStyle(row).transitionDuration);
  expect(transitionDuration).toBe('0s');

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
});
