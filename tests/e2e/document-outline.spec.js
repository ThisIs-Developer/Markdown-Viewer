const { test, expect } = require('@playwright/test');
const { openApp, setEditorContent } = require('../helpers/app');

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

async function openOutline(page) {
  await page.getByRole('button', { name: 'Document Outline', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Document Outline' })).toBeVisible();
}

test('toolbar toggles a keyboard-accessible outline beside fullscreen', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Document Outline', exact: true });
  await expect(page.locator('#document-outline')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle.locator('.lucide-square-menu')).toBeVisible();
  expect(await toggle.evaluate(button => button.previousElementSibling.dataset.mdAction)).toBe('fullscreen');
  expect(await page.locator('#markdown-format-toolbar > .markdown-toolbar-group > button').evaluateAll(buttons =>
    buttons.slice(-4).map(button => button.dataset.mdAction))).toEqual(['emoji', 'find', 'fullscreen', 'outline']);

  await toggle.focus();
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Close Document Outline', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#document-outline')).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(toggle).not.toHaveAttribute('aria-pressed');

  await openOutline(page);
  await toggle.click();
  await expect(page.locator('#document-outline')).toBeHidden();
});

test('uses Find and Replace button and panel styles without a selected toolbar state', async ({ page }) => {
  await setEditorContent(page, '# Parent\n\n## Child');
  await openOutline(page);
  const find = page.locator('[data-md-action="find"]');
  const outline = page.locator('#document-outline-toggle');
  const appearance = element => {
    const style = getComputedStyle(element);
    return ['width', 'height', 'padding', 'border', 'borderRadius', 'color', 'backgroundColor'].map(name => style[name]);
  };
  const finishTransitions = control => control.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await page.locator('#document-outline-title').hover();
  await finishTransitions(outline);
  expect(await outline.evaluate(appearance)).toEqual(await find.evaluate(appearance));
  await find.hover();
  await finishTransitions(find);
  const findHover = await find.evaluate(appearance);
  await outline.hover();
  await finishTransitions(outline);
  expect(await outline.evaluate(appearance)).toEqual(findHover);
  await expect(outline).not.toHaveAttribute('aria-pressed');

  await find.click();
  await expect(page.locator('#find-replace-modal')).toBeVisible();
  const panelSpacing = element => {
    const style = getComputedStyle(element);
    return ['padding', 'gap', 'display', 'alignItems', 'borderBottom'].map(name => style[name]);
  };
  const outlineBody = page.locator('.document-outline-body');
  expect(await outlineBody.evaluate(panelSpacing)).toEqual(await page.locator('#find-replace-modal .find-replace-body').evaluate(panelSpacing));
  expect(await page.locator('.document-outline-header').evaluate(panelSpacing)).toEqual(await page.locator('#find-replace-drag-handle').evaluate(panelSpacing));
  await page.locator('#find-replace-dock').click();
  await expect(page.locator('#find-replace-modal')).toHaveClass(/docked/);
  const headerAppearance = element => {
    const style = getComputedStyle(element);
    return ['height', 'padding', 'gap', 'display', 'alignItems', 'justifyContent', 'borderBottom', 'borderRadius', 'backgroundColor', 'fontFamily'].map(name => style[name]);
  };
  expect(await page.locator('.document-outline-header').evaluate(headerAppearance)).toEqual(await page.locator('#find-replace-drag-handle').evaluate(headerAppearance));
  const titleAppearance = element => {
    const style = getComputedStyle(element);
    return ['fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'color'].map(name => style[name]);
  };
  expect(await page.locator('#document-outline-title').evaluate(titleAppearance)).toEqual(await page.locator('#find-replace-modal .find-replace-title').evaluate(titleAppearance));
  expect(await page.locator('#document-outline-close').evaluate(appearance)).toEqual(await page.locator('#find-replace-close-icon').evaluate(appearance));
  const bulk = page.locator('#document-outline-collapse-all');
  const dock = page.locator('#find-replace-dock');
  await bulk.hover();
  await finishTransitions(bulk);
  const bulkHover = await bulk.evaluate(appearance);
  await dock.hover();
  await finishTransitions(dock);
  expect(bulkHover).toEqual(await dock.evaluate(appearance));
  const panes = await page.locator('.editor-pane, .preview-pane, #document-outline, #find-replace-modal').evaluateAll(elements => elements.map(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })));
  for (let index = 1; index < panes.length; index += 1) expect(panes[index].left).toBeGreaterThanOrEqual(panes[index - 1].right - 1);
  await page.locator('#find-replace-close-icon').click();
  await expect(page.locator('#document-outline')).toBeVisible();
});

test('header follows Find and Replace sizing on tablet and small screens', async ({ page }) => {
  await setEditorContent(page, '# Parent\n\n## Child');
  await openOutline(page);
  await page.locator('[data-md-action="find"]').click();
  const sizing = element => {
    const style = getComputedStyle(element);
    return ['height', 'padding', 'display', 'gap', 'alignItems', 'justifyContent', 'borderBottom', 'fontFamily'].map(name => style[name]);
  };
  for (const width of [820, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.locator('.document-outline-header').evaluate(sizing)).toEqual(await page.locator('#find-replace-drag-handle').evaluate(sizing));
    expect(await page.locator('#document-outline-close').evaluate(sizing)).toEqual(await page.locator('#find-replace-close-icon').evaluate(sizing));
    expect(await page.locator('.document-outline-header').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const id of ['document-outline-collapse-all', 'document-outline-close']) {
      const bounds = await page.locator('#' + id).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
  }
});

test('header collapses and expands every heading group with the File Sidebar interaction pattern', async ({ page }) => {
  const markdown = '# Architecture\n\n## Core\n\n### Engine\n\n#### Storage\n\n##### Cache\n\n###### Details\n\n## Data flow\n\n# Features\n\n## Reading';
  await setEditorContent(page, markdown);
  await openOutline(page);
  const outline = page.locator('#document-outline');
  const bulk = page.locator('#document-outline-collapse-all');
  const branches = outline.locator('.document-outline-chevron');
  const visibleHeadings = outline.locator('.document-outline-link:visible');
  await expect(bulk).toHaveAttribute('title', 'Collapse all headings');
  await expect(bulk.locator('i')).toHaveClass(/lucide-fold-vertical/);
  await expect(bulk).not.toHaveAttribute('aria-pressed');
  await outline.getByRole('button', { name: 'Collapse: Core', exact: true }).click();
  await expect(bulk).toHaveAttribute('aria-label', 'Collapse all headings');
  const before = await page.locator('.preview-pane').evaluate(pane => pane.scrollTop);
  await bulk.click();
  await expect(outline).toBeVisible();
  await expect(visibleHeadings).toHaveText(['Architecture', 'Features']);
  expect(await branches.evaluateAll(buttons => buttons.every(button => button.getAttribute('aria-expanded') === 'false'))).toBe(true);
  expect(await page.locator('.preview-pane').evaluate(pane => pane.scrollTop)).toBe(before);
  await expect(bulk).toHaveAttribute('aria-label', 'Expand all headings');
  await expect(bulk.locator('i')).toHaveClass(/lucide-unfold-vertical/);
  await setEditorContent(page, markdown + '\n\n# Standalone');
  await expect(visibleHeadings).toHaveText(['Architecture', 'Features', 'Standalone']);
  await expect(bulk).toHaveAttribute('title', 'Expand all headings');
  await bulk.press('Enter');
  await expect(bulk).toBeFocused();
  await expect(visibleHeadings).toHaveCount(10);
  expect(await branches.evaluateAll(buttons => buttons.every(button => button.getAttribute('aria-expanded') === 'true'))).toBe(true);
  await expect(bulk).toHaveAttribute('aria-label', 'Collapse all headings');
  // Individual chevrons also update the aggregate action, including nested groups.
  for (const branch of (await branches.all()).reverse()) await branch.click();
  await expect(bulk).toHaveAttribute('aria-label', 'Expand all headings');
  await outline.getByRole('button', { name: 'Expand: Architecture', exact: true }).click();
  await expect(bulk).toHaveAttribute('aria-label', 'Collapse all headings');
  await setEditorContent(page, '# One\n\n# Two');
  await expect(bulk).toBeDisabled();
  await setEditorContent(page, 'No headings.');
  await expect(page.locator('#document-outline-empty')).toBeVisible();
  await expect(bulk).toBeDisabled();
});

test('collapses only a parent branch and preserves nested collapse state while editing', async ({ page }) => {
  const markdown = '# Architecture\n\n## Core\n\n### Engine\n\n#### Storage\n\n##### Cache\n\n###### Details\n\n## Data flow\n\n# Features\n\n## Reading';
  await setEditorContent(page, markdown);
  await openOutline(page);
  const outline = page.locator('#document-outline');
  const core = outline.getByRole('button', { name: 'Collapse: Core', exact: true });
  const heading = name => outline.locator('.document-outline-link').filter({ hasText: new RegExp('^' + name + '$') });
  await expect(outline.locator('.document-outline-chevron')).toHaveCount(6);
  await expect(heading('Details').locator('..').locator('.document-outline-chevron')).toHaveCount(0);
  await expect(outline.locator('.document-outline-children').first()).toHaveCSS('border-inline-start-width', '1px');
  const before = await page.locator('.preview-pane').evaluate(pane => pane.scrollTop);
  await core.click();
  await expect(heading('Engine')).toBeHidden();
  await expect(heading('Data flow')).toBeVisible();
  await expect(heading('Reading')).toBeVisible();
  expect(await page.locator('.preview-pane').evaluate(pane => pane.scrollTop)).toBe(before);

  await outline.getByRole('button', { name: 'Collapse: Architecture', exact: true }).click();
  await expect(heading('Core')).toBeHidden();
  await outline.getByRole('button', { name: 'Expand: Architecture', exact: true }).press('Enter');
  await expect(heading('Core')).toBeVisible();
  await expect(heading('Engine')).toBeHidden();
  await setEditorContent(page, markdown + '\n\n## New feature');
  await expect(heading('New feature')).toBeVisible();
  await expect(heading('Engine')).toBeHidden();
  await outline.getByRole('button', { name: 'Expand: Core', exact: true }).click();
  await expect(heading('Details')).toBeVisible();
});

test('Editor navigation locates real headings after code, quotes, lists, and frontmatter', async ({ page }) => {
  const markdown = ['---', 'title: Metadata', '---', '', '```md', '# Repeated', '```', '',
    '# Repeated', '', '> ## Quoted', '', '> Setext quote', '> ---', '',
    '- ### List heading', '', '<h4>HTML heading</h4>', '', 'Setext heading', '===', '', '## Repeated'].join('\n');
  await setEditorContent(page, markdown);
  await page.locator('[data-view-mode="editor"]').click();
  await openOutline(page);
  const links = page.locator('#document-outline-list .document-outline-link');
  await expect(links).toHaveText(['Repeated', 'Quoted', 'Setext quote', 'List heading', 'HTML heading', 'Setext heading', 'Repeated']);
  const targets = [markdown.indexOf('# Repeated', markdown.indexOf('```\n') + 4), markdown.indexOf('## Quoted'), markdown.indexOf('Setext quote'), markdown.indexOf('### List heading'), markdown.indexOf('<h4>'), markdown.indexOf('Setext heading'), markdown.lastIndexOf('## Repeated')];
  for (let index = 0; index < targets.length; index += 1) {
    await links.nth(index).click();
    await expect(page.locator('.content-container')).toHaveClass(/view-editor-only/);
    expect(await page.locator('#markdown-editor').evaluate(editor => editor.selectionStart)).toBe(targets[index]);
  }
});

test('resizing Split preserves the pane ratio with the outline open or closed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setEditorContent(page, '# Primary\n\n## Section');
  const divider = page.locator('.content-container > .resize-divider');
  await divider.press('ArrowRight');
  const ratio = () => page.evaluate(() => {
    const editor = document.querySelector('.editor-pane').getBoundingClientRect().width;
    const preview = document.querySelector('.preview-pane').getBoundingClientRect().width;
    return editor / (editor + preview);
  });
  const before = await ratio();
  await openOutline(page);
  expect(Math.abs(await ratio() - before)).toBeLessThan(0.01);
  const content = await page.locator('.content-container').boundingBox();
  const outline = await page.locator('#document-outline').boundingBox();
  const handle = await divider.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(content.x + (outline.x - content.x) * 0.65, handle.y + handle.height / 2);
  await page.mouse.up();
  expect(await ratio()).toBeCloseTo(0.65, 1);
  await page.locator('#document-outline-close').click();
  expect(await ratio()).toBeCloseTo(0.65, 1);
});

test('highlights the last Editor section and its visible parent when collapsed', async ({ page }) => {
  await setEditorContent(page, '# Parent\n\n' + 'Paragraph content.\n\n'.repeat(80) + '## Last section\n\nEnd.');
  await page.locator('[data-view-mode="editor"]').click();
  await openOutline(page);
  const links = page.locator('#document-outline-list .document-outline-link');
  await links.last().click();
  await expect(links.last()).toHaveAttribute('aria-current', 'location');
  await page.getByRole('button', { name: 'Collapse: Parent', exact: true }).click();
  await expect(links.last()).toBeHidden();
  await expect(links.first()).toHaveAttribute('aria-current', 'location');
  await page.getByRole('button', { name: 'Expand: Parent', exact: true }).click();
  await expect(links.last()).toHaveAttribute('aria-current', 'location');
});

test('keeps both documents visible when an outline is opened in document Split View', async ({ page }) => {
  await setEditorContent(page, '# Primary document');
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# Secondary document');
  const secondId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#tab-list .tab-item').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open in split view' }).click();
  await page.locator('#document-split-destination').selectOption(secondId);
  await page.locator('#document-split-modal-confirm').click();
  await openOutline(page);
  await expect(page.locator('#document-outline-list .document-outline-link')).toHaveText(['Primary document']);
  await page.locator('#document-outline-list .document-outline-link').click();
  await expect(page.locator('#markdown-editor')).toBeVisible();
  await expect(page.locator('#document-split-editor')).toBeVisible();
  await page.locator('[data-view-mode="preview"]').click();
  await page.locator('#document-outline-list .document-outline-link').click();
  await expect(page.locator('#markdown-preview')).toBeVisible();
  await expect(page.locator('#document-split-preview')).toBeVisible();
  const secondary = await page.locator('#document-split-pane').boundingBox();
  const outline = await page.locator('#document-outline').boundingBox();
  expect(secondary.x + secondary.width).toBeLessThanOrEqual(outline.x + 1);
  await page.locator('#document-outline-close').click();
  await expect(page.locator('#document-split-preview')).toBeVisible();
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1100, height: 768 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'narrow', width: 320, height: 740 }
]) {
  test(`keeps Editor, Preview, and Split usable at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const longTitle = 'Long heading ' + 'abcdefghij'.repeat(10);
    const markdown = [1, 2, 3, 4, 5, 6].map(level => '#'.repeat(level) + ' ' + (level === 6 ? longTitle : 'Level ' + level) + '\n\n' + 'Content for this section.\n\n'.repeat(4)).join('\n');
    const paneGeometry = () => page.locator('.editor-pane, .preview-pane').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
    for (const mode of ['editor', 'preview', 'split']) {
      // Set the mode through the existing control; smaller screens expose it in the mobile menu.
      await page.locator(`[data-view-mode="${mode}"]`).evaluate(button => { if (button.getAttribute('aria-pressed') !== 'true') button.click(); });
      await setEditorContent(page, markdown);
      const before = await paneGeometry();
      await openOutline(page);
      const links = page.locator('#document-outline-list .document-outline-link');
      await expect(links).toHaveCount(6);
      const bulk = page.locator('#document-outline-collapse-all');
      await bulk.click();
      await expect(page.locator('#document-outline-list .document-outline-link:visible')).toHaveCount(1);
      await expect(bulk).toHaveAttribute('aria-label', 'Expand all headings');
      await bulk.press('Enter');
      await expect(page.locator('#document-outline-list .document-outline-link:visible')).toHaveCount(6);
      const bounds = await page.locator('#document-outline').boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(await page.locator('.document-outline-body').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      const controls = page.locator('.workspace-format-actions .markdown-tool-btn');
      for (const control of await controls.all()) await expect(control).toBeInViewport();
      if (mode === 'split') {
        await expect(page.locator('#markdown-editor')).toBeVisible();
        await expect(page.locator('#markdown-preview')).toBeVisible();
        const preview = await page.locator('.preview-pane').boundingBox();
        if (viewport.width >= 1080) expect(preview.x + preview.width).toBeLessThanOrEqual(bounds.x + 1);
        else expect(await paneGeometry()).toEqual(before);
      }
      await links.last().click();
      await expect(page.locator('.content-container')).toHaveClass(new RegExp('view-' + (mode === 'split' ? 'split' : mode + '-only')));
      if (mode === 'editor') {
        expect(await page.locator('#markdown-editor').evaluate(editor => editor.selectionStart)).toBe(markdown.indexOf('######'));
        expect(await page.locator('#markdown-editor').evaluate(editor => editor.scrollTop)).toBeGreaterThan(0);
      } else await expect(page.locator('#markdown-preview h6')).toBeInViewport();
      if (viewport.width >= 1080) await page.locator('#document-outline-close').click();
      else await expect(page.locator('#document-outline')).toBeHidden();
      expect(await paneGeometry()).toEqual(before);
      await setEditorContent(page, 'No headings here.');
      await openOutline(page);
      await expect(links).toHaveCount(0);
      await expect(page.locator('#document-outline-empty')).toBeVisible();
      await expect(bulk).toBeDisabled();
      await page.locator('#document-outline-close').click();
    }
  });
}

test('lists rendered headings in order with hierarchy and plain text labels', async ({ page }) => {
  await setEditorContent(page, [
    '---', 'title: Metadata only', '---', '',
    '# **Project** &amp; `API`', '',
    '## [Setup](https://example.com)', '',
    '### Install', '', '#### Configure', '', '##### Advanced', '', '###### Details', '',
    'Setext heading', '---', '',
    '> ## Quoted heading', '',
    '```markdown', '# Fenced code is not a heading', '```', '',
    '    # Indented code is not a heading', '',
    '<h2>HTML <em>heading</em></h2>', '',
    '## <img alt="Image label">', '',
    '##', ''
  ].join('\n'));
  await openOutline(page);
  const items = page.locator('#document-outline-list .document-outline-link');
  await expect(items).toHaveText([
    'Project & API', 'Setup', 'Install', 'Configure', 'Advanced', 'Details',
    'Setext heading', 'Quoted heading', 'HTML heading', 'Image label', 'Untitled heading'
  ]);
  await expect(page.locator('#document-outline-list a, #document-outline-list img')).toHaveCount(0);
  const indents = await items.evaluateAll(buttons => buttons.slice(0, 6).map(button => button.getBoundingClientRect().left));
  expect(indents.every((indent, index) => index === 0 || indent > indents[index - 1])).toBe(true);
});

test('updates while editing, switching documents, and closing the last tab', async ({ page }) => {
  await setEditorContent(page, '# First document');
  await openOutline(page);
  const items = page.locator('#document-outline-list .document-outline-link');
  await expect(items).toHaveText(['First document']);
  await setEditorContent(page, '# Renamed heading\n\n## Added section');
  await expect(items).toHaveText(['Renamed heading', 'Added section']);
  await setEditorContent(page, 'Plain text without headings.');
  await expect(items).toHaveCount(0);
  await expect(page.getByText('No headings in this document.', { exact: true })).toBeVisible();

  await setEditorContent(page, '# First document');
  await page.locator('#tab-new-btn').click();
  await setEditorContent(page, '# Second document');
  await expect(items).toHaveText(['Second document']);
  await page.locator('#tab-list .tab-item').first().click();
  await expect(items).toHaveText(['First document']);

  while (await page.locator('#tab-list .tab-item').count()) {
    await page.locator('#tab-list .tab-item.active .tab-menu-btn').click();
    await page.locator('.tab-menu-dropdown.open [data-action="close"]').click();
  }
  await expect(page.locator('#document-outline')).toBeHidden();
  await expect(items).toHaveCount(0);
  await expect(page.locator('#document-outline-toggle')).toBeDisabled();
});

test('navigates repeated headings and follows the current preview section', async ({ page }) => {
  await setEditorContent(page, '# Repeated\n\n' + 'Paragraph content.\n\n'.repeat(70) +
    '## Repeated\n\n' + 'More paragraph content.\n\n'.repeat(70));
  await openOutline(page);
  const items = page.locator('#document-outline-list .document-outline-link');
  await expect(items).toHaveText(['Repeated', 'Repeated']);
  await items.nth(1).click();
  await expect(items.nth(1)).toHaveAttribute('aria-current', 'location');
  const sectionOffset = await page.locator('#markdown-preview h2').evaluate(heading =>
    heading.getBoundingClientRect().top - document.querySelector('.preview-pane').getBoundingClientRect().top);
  expect(sectionOffset).toBeGreaterThanOrEqual(0);
  expect(sectionOffset).toBeLessThan(50);
  await page.locator('.preview-pane').click();
  await page.locator('.preview-pane').evaluate(pane => { pane.scrollTop = 0; });
  await expect(items.first()).toHaveAttribute('aria-current', 'location');

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await items.nth(1).click();
  await expect(page.locator('.content-container')).toHaveClass(/view-editor-only/);
  expect(await page.locator('#markdown-editor').evaluate(editor => editor.selectionStart)).toBe((await page.locator('#markdown-editor').inputValue()).indexOf('## Repeated'));
  expect(await page.locator('#markdown-editor').evaluate(editor => editor.scrollTop)).toBeGreaterThan(0);
});

test('works with large documents rendered by the preview worker', async ({ page }) => {
  const paragraphs = Array.from({ length: 90 }, (_, index) => `Paragraph ${index} ${'worker filler '.repeat(70)}`);
  await setEditorContent(page, ['# Large document', ...paragraphs, '## Last section', 'Final paragraph.'].join('\n\n'));
  await openOutline(page);
  await expect(page.locator('#markdown-preview .preview-render-block')).not.toHaveCount(0);
  await expect(page.locator('#document-outline-list .document-outline-link')).toHaveText(['Large document', 'Last section']);
  await page.locator('#document-outline-list .document-outline-link').last().click();
  await expect(page.locator('#markdown-preview h2')).toBeInViewport();
  await expect(page.locator('#document-outline-list .document-outline-link').last()).toHaveAttribute('aria-current', 'location');

  // A lazy block can change height after the browser has completed the jump.
  await page.locator('#markdown-preview h2').evaluate(heading => {
    heading.closest('.preview-render-block').previousElementSibling.style.minHeight = '1800px';
  });
  await expect(page.locator('#markdown-preview h2')).toBeInViewport();

  // Subsequent user scrolling must take precedence over the outline's target.
  await page.locator('.preview-pane').click();
  await page.locator('.preview-pane').evaluate(pane => { pane.scrollTop = 0; });
  await expect(page.locator('#markdown-preview h1')).toBeInViewport();
  await page.locator('#markdown-preview h2').evaluate(heading => {
    heading.closest('.preview-render-block').previousElementSibling.style.minHeight = '2000px';
  });
  await expect(page.locator('#markdown-preview h1')).toBeInViewport();
});

test('shares the right side with Comments and stays out of print', async ({ page }) => {
  await setEditorContent(page, '# A document');
  await openOutline(page);
  await page.locator('#review-toggle').click();
  await expect(page.locator('#review-panel')).toBeVisible();
  await expect(page.locator('#document-outline')).toBeHidden();
  await openOutline(page);
  await expect(page.locator('#review-panel')).toBeHidden();
  await expect(page.locator('#document-outline-list .document-outline-link')).toHaveText(['A document']);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#document-outline')).toBeHidden();
});

test('fits small screens, wraps long headings, and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setEditorContent(page, '# Mobile document\n\n## A very long heading that should wrap inside the outline without overflowing the screen');
  await openOutline(page);
  const panel = page.locator('#document-outline');
  const bounds = await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await panel.getByRole('button', { name: 'A very long heading', exact: false }).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('#markdown-preview h2')).toBeInViewport();
});
