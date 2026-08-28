const { test, expect } = require('@playwright/test');
const { openApp } = require('../helpers/app');

const requiredViewports = [320, 375, 768, 1024, 1440];

for (const width of requiredViewports) {
  test(`workspace redesign has no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    const errors = await openApp(page);

    await expect(page.locator('#document-workspace-shell')).toBeVisible();
    await expect(page.locator('#markdown-format-toolbar')).toBeVisible();
    await expect(page.locator('#document-sidebar-status')).toBeAttached();

    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth
    }));
    expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
    expect(errors).toEqual([]);
  });
}

test('mobile workspace switches between editor, split, and preview', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await openApp(page);

  const container = page.locator('.content-container');
  const openMobileViewMenu = async () => {
    await page.locator('#mobile-menu-toggle').click();
    await expect(page.locator('#mobile-menu-panel')).toHaveClass(/active/);
  };

  await openMobileViewMenu();
  await page.locator('.mobile-view-mode-btn[data-mode="preview"]').click();
  await expect(container).toHaveClass(/view-preview-only/);
  await expect(page.locator('#markdown-preview')).toBeVisible();

  await openMobileViewMenu();
  await page.locator('.mobile-view-mode-btn[data-mode="editor"]').click();
  await expect(container).toHaveClass(/view-editor-only/);
  await expect(page.locator('#markdown-editor')).toBeVisible();

  await openMobileViewMenu();
  await page.locator('.mobile-view-mode-btn[data-mode="split"]').click();
  await expect(container).toHaveClass(/view-split/);
  await expect(page.locator('#markdown-preview')).toBeVisible();
});

test('workspace search and sidebar commands remain interactive', async ({ page }) => {
  await openApp(page);

  const sidebarSearch = page.locator('#document-sidebar-search');
  await sidebarSearch.focus();
  await expect(sidebarSearch).toBeFocused();
  await sidebarSearch.fill('Welcome');
  await expect(page.locator('#document-sidebar-status')).toContainText('result');

  await page.locator('#table-picker-toggle').click();
  await expect(page.locator('#table-picker-menu')).toBeVisible();
});

test('quick table selector inserts dimensions with the header included in the row count', async ({ page }) => {
  await openApp(page);

  const editor = page.locator('#markdown-editor');
  await editor.fill('');
  await page.locator('#table-picker-toggle').click();

  const picker = page.locator('#table-picker-menu');
  const cells = page.locator('.markdown-table-picker-cell');
  await expect(picker).toBeVisible();
  await expect(cells).toHaveCount(64);
  const pickerBox = await picker.boundingBox();
  const firstCellBox = await cells.first().boundingBox();
  expect(pickerBox.x).toBeGreaterThanOrEqual(0);
  expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(firstCellBox.width).toBeGreaterThanOrEqual(21);
  expect(firstCellBox.width).toBeLessThanOrEqual(23);
  await expect(page.locator('.markdown-table-picker-cell.is-selected')).toHaveCount(0);
  await expect(page.locator('#table-picker-status')).toHaveText('Select table size');

  const largest = page.locator('.markdown-table-picker-cell[data-table-columns="8"][data-table-rows="8"]');
  await largest.hover();
  await expect(page.locator('#table-picker-status')).toHaveText('8 columns × 8 rows');
  await expect(page.locator('.markdown-table-picker-cell.is-selected')).toHaveCount(64);

  const customTableButton = page.locator('#custom-table-button');
  const customTableLabel = customTableButton.locator('span');
  const customTableTextColor = await customTableLabel.evaluate(element => getComputedStyle(element).color);
  await customTableButton.hover();
  await expect(customTableLabel).toHaveCSS('color', customTableTextColor);
  await expect(page.locator('.markdown-table-picker-cell.is-selected')).toHaveCount(0);
  await expect(page.locator('#table-picker-status')).toHaveText('Select table size');

  const target = page.locator('.markdown-table-picker-cell[data-table-columns="2"][data-table-rows="3"]');
  await target.hover();
  await expect(page.locator('#table-picker-status')).toHaveText('2 columns × 3 rows');
  await expect(page.locator('.markdown-table-picker-cell.is-selected')).toHaveCount(6);
  await target.click();

  await expect(page.locator('#table-picker-menu')).toBeHidden();
  await expect(editor).toHaveValue('| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n| Value | Value |\n');
});

test('quick table selector supports keyboard dimension selection', async ({ page }) => {
  await openApp(page);

  const editor = page.locator('#markdown-editor');
  const toggle = page.locator('#table-picker-toggle');
  await editor.fill('');
  await toggle.focus();
  await toggle.press('Enter');

  await expect(page.locator('.markdown-table-picker-cell[data-table-columns="1"][data-table-rows="1"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const target = page.locator('.markdown-table-picker-cell[data-table-columns="2"][data-table-rows="2"]');
  await expect(target).toBeFocused();
  await expect(page.locator('#table-picker-status')).toHaveText('2 columns × 2 rows');
  await page.keyboard.press('Enter');

  await expect(editor).toHaveValue('| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n');
});

test('custom table option matches export option styling', async ({ page }) => {
  await openApp(page);

  const readOptionStyles = locator => locator.evaluate(element => {
    const itemStyle = getComputedStyle(element);
    const iconStyle = getComputedStyle(element.querySelector('i'));
    const labelStyle = getComputedStyle(element.querySelector('.app-menu-label'));
    return {
      display: itemStyle.display,
      minHeight: itemStyle.minHeight,
      gap: itemStyle.gap,
      padding: itemStyle.padding,
      borderRadius: itemStyle.borderRadius,
      backgroundColor: itemStyle.backgroundColor,
      color: itemStyle.color,
      fontSize: itemStyle.fontSize,
      iconColor: iconStyle.color,
      iconSize: iconStyle.fontSize,
      labelColor: labelStyle.color,
      labelSize: labelStyle.fontSize,
      labelWeight: labelStyle.fontWeight
    };
  });

  await page.locator('#exportDropdown').click();
  const exportOption = page.locator('#export-md');
  await expect(exportOption).toBeVisible();
  const exportRestStyles = await readOptionStyles(exportOption);
  await exportOption.hover();
  const exportHoverStyles = await readOptionStyles(exportOption);
  await page.keyboard.press('Escape');

  await page.locator('#table-picker-toggle').click();
  const customTableOption = page.locator('#custom-table-button');
  await expect(customTableOption).toBeVisible();
  await expect(customTableOption).toHaveClass(/app-menu-item/);
  await expect(customTableOption.locator('.app-menu-label')).toHaveText('Custom table…');
  expect(await readOptionStyles(customTableOption)).toEqual(exportRestStyles);
  await customTableOption.hover();
  expect(await readOptionStyles(customTableOption)).toEqual(exportHoverStyles);
});

test('custom table dialog is compact and applies total row count', async ({ page }) => {
  await openApp(page);

  const editor = page.locator('#markdown-editor');
  await editor.fill('');
  const pickerIcon = page.locator('#table-picker-toggle i');
  await expect(pickerIcon).toHaveClass('lucide lucide-grid-2x2');
  expect(await pickerIcon.evaluate(element => getComputedStyle(element).maskImage)).not.toBe('none');
  const pickerIconSvg = await pickerIcon.evaluate(element => {
    const maskImage = getComputedStyle(element).maskImage;
    const encodedSvg = maskImage.match(/base64,([^"')]+)/)?.[1];
    return encodedSvg ? atob(encodedSvg) : '';
  });
  expect(pickerIconSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
  await page.locator('#table-picker-toggle').click();
  const customIcon = page.locator('#custom-table-button i');
  await expect(customIcon).toHaveClass(/lucide-grid-2x2-plus/);
  expect(await customIcon.evaluate(element => getComputedStyle(element).maskImage)).not.toBe('none');
  await page.locator('#custom-table-button').click();

  await expect(page.locator('#table-modal')).toBeVisible();
  await expect(page.locator('#table-modal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#table-modal-title')).toHaveText('Custom table');
  await expect(page.locator('label[for="table-modal-rows"]')).toHaveText('Total rows');
  await expect(page.getByText('The header is included in the row count.')).toHaveCount(0);

  const dialogBox = page.locator('#table-modal .table-modal-box');
  const columnsField = page.locator('#table-modal-columns');
  const rowsField = page.locator('#table-modal-rows');
  const [dialogBounds, columnsBounds, rowsBounds] = await Promise.all([
    dialogBox.boundingBox(),
    columnsField.boundingBox(),
    rowsField.boundingBox()
  ]);
  expect(dialogBounds.width).toBeLessThanOrEqual(320);
  expect(Math.abs(columnsBounds.y - rowsBounds.y)).toBeLessThan(2);
  await page.locator('#table-modal-columns').fill('2');
  await page.locator('#table-modal-rows').fill('2');
  await page.locator('#table-modal-insert').click();

  await expect(page.locator('#table-modal')).toHaveAttribute('aria-hidden', 'true');
  await expect(editor).toHaveValue('| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n');
});
