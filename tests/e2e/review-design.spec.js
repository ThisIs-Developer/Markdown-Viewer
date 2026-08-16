const { test, expect } = require('@playwright/test');
const {
  openApp,
  setEditorContent,
  stubLazyRendererLibraries
} = require('../helpers/app');

const reviewMarkdown = `# Review design

This paragraph is ready for focused feedback.`;

test.beforeEach(async ({ page }) => {
  await stubLazyRendererLibraries(page);
  await openApp(page);
  await setEditorContent(page, reviewMarkdown);
  await expect(page.locator('#markdown-preview h1')).toHaveText('Review design');
});

test('matches sidebar filters and keeps review cards compact', async ({ page }) => {
  await page.locator('#review-toggle').click();

  const neutralState = await page.evaluate(() => {
    const activeFilter = document.querySelector('.review-filter-btn.is-active');
    const sidebarFilter = document.querySelector('.document-filter-btn.is-active');
    const inactiveFilter = document.querySelector('.review-filter-btn:not(.is-active)');
    const emptyIcon = document.querySelector('.review-empty-state i');
    const submit = document.querySelector('#review-feedback-submit');
    const panelHeader = document.querySelector('.review-panel-header');
    const readFilterStyle = (element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        borderRadius: style.borderRadius
      };
    };
    return {
      reviewFilter: readFilterStyle(activeFilter),
      sidebarFilter: readFilterStyle(sidebarFilter),
      inactiveFilter: getComputedStyle(inactiveFilter).backgroundColor,
      emptyIcon: getComputedStyle(emptyIcon).color,
      disabledSubmit: getComputedStyle(submit).backgroundColor,
      panelHeaderHeight: panelHeader.getBoundingClientRect().height
    };
  });

  expect(neutralState.reviewFilter).toEqual(neutralState.sidebarFilter);
  expect(neutralState.inactiveFilter).not.toBe(neutralState.reviewFilter.backgroundColor);
  expect(neutralState.panelHeaderHeight).toBeLessThanOrEqual(52);

  const filterGeometry = await page.locator('.review-filter-group').evaluate((group) => {
    const style = getComputedStyle(group);
    const buttons = Array.from(group.querySelectorAll('.review-filter-btn'));
    return {
      gap: style.columnGap,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
      widths: buttons.map((button) => button.getBoundingClientRect().width)
    };
  });
  expect(filterGeometry.gap).toBe('3px');
  expect(filterGeometry.padding).toEqual(['3px', '3px', '3px', '3px']);
  expect(Math.max(...filterGeometry.widths) - Math.min(...filterGeometry.widths)).toBeLessThan(0.5);

  const activeWidths = [];
  for (const filter of ['resolved', 'all', 'open']) {
    await page.locator(`[data-review-filter="${filter}"]`).click();
    activeWidths.push(await page.locator('.review-filter-btn.is-active').evaluate((button) => (
      button.getBoundingClientRect().width
    )));
  }
  expect(Math.max(...activeWidths) - Math.min(...activeWidths)).toBeLessThan(0.5);

  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="heading:"]').click();
  await expect(page.locator('#review-composer')).toBeVisible();
  await expect(page.locator('.review-panel-eyebrow')).toHaveCount(0);
  await expect(page.locator('#review-composer')).not.toContainText('Feedback for');
  await expect(page.locator('.review-kind-btn i')).toHaveCount(0);

  const composerState = await page.locator('#review-composer').evaluate((composer) => {
    const activeKind = composer.querySelector('.review-kind-btn.is-active');
    const kindGroup = composer.querySelector('.review-kind-group');
    const kindButtons = Array.from(kindGroup.querySelectorAll('.review-kind-btn'));
    const heading = composer.querySelector('.review-composer-heading');
    const body = composer.querySelector('.review-composer-body');
    const footer = composer.querySelector('.review-composer-footer');
    const kindStyle = getComputedStyle(activeKind);
    const groupStyle = getComputedStyle(kindGroup);
    return {
      activeKind: {
        backgroundColor: kindStyle.backgroundColor,
        color: kindStyle.color,
        fontSize: kindStyle.fontSize,
        fontWeight: kindStyle.fontWeight,
        borderRadius: kindStyle.borderRadius
      },
      groupGap: groupStyle.columnGap,
      groupPadding: [
        groupStyle.paddingTop,
        groupStyle.paddingRight,
        groupStyle.paddingBottom,
        groupStyle.paddingLeft
      ],
      kindWidths: kindButtons.map((button) => button.getBoundingClientRect().width),
      headingHeight: heading.getBoundingClientRect().height,
      hasStructuredSections: body?.parentElement === composer && footer?.parentElement === composer
    };
  });
  expect(composerState.activeKind).toEqual(neutralState.reviewFilter);
  expect(composerState.groupGap).toBe('3px');
  expect(composerState.groupPadding).toEqual(['3px', '3px', '3px', '3px']);
  expect(Math.max(...composerState.kindWidths) - Math.min(...composerState.kindWidths)).toBeLessThan(0.5);
  expect(composerState.headingHeight).toBeLessThanOrEqual(44);
  expect(composerState.hasStructuredSections).toBe(true);

  const kindWidths = [];
  for (const kind of ['suggestion', 'comment']) {
    await page.locator(`[data-review-kind="${kind}"]`).click();
    kindWidths.push(await page.locator('.review-kind-btn.is-active').evaluate((button) => (
      button.getBoundingClientRect().width
    )));
  }
  expect(Math.max(...kindWidths) - Math.min(...kindWidths)).toBeLessThan(0.5);

  await page.locator('#review-feedback-input').fill('Make the heading more specific.');
  await expect(page.locator('#review-feedback-submit')).toBeEnabled();
  await expect.poll(() => page.locator('#review-feedback-submit').evaluate((button) => (
    getComputedStyle(button).backgroundColor
  ))).not.toBe(neutralState.disabledSubmit);
  const primaryColor = await page.locator('#review-feedback-submit').evaluate((button) => (
    getComputedStyle(button).backgroundColor
  ));
  expect(primaryColor).not.toBe(composerState.activeKind.backgroundColor);
  expect(neutralState.emptyIcon).not.toBe(primaryColor);
  await page.locator('#review-feedback-submit').click();

  const threadState = await page.locator('.review-thread').evaluate((thread) => {
    const header = thread.querySelector('.review-thread-header');
    const meta = thread.querySelector('.review-thread-meta');
    const actions = thread.querySelector('.review-thread-actions');
    const content = thread.querySelector('.review-thread-content');
    const buttons = Array.from(actions.querySelectorAll('.review-thread-action'));
    const threadRect = thread.getBoundingClientRect();
    const metaRect = meta.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    return {
      border: getComputedStyle(thread).borderInlineStartColor,
      bodyFontSize: getComputedStyle(thread.querySelector('.review-thread-body')).fontSize,
      anchorFontSize: getComputedStyle(thread.querySelector('.review-thread-anchor')).fontSize,
      hasStructuredContent: content?.parentElement === thread,
      headerContainsActions: actions.parentElement === header,
      actionCount: buttons.length,
      actionLabels: buttons.map((button) => button.getAttribute('aria-label')),
      actionText: buttons.map((button) => button.textContent.trim()),
      actionIcons: buttons.map((button) => button.querySelector('i')?.className || ''),
      dateIcons: Array.from(thread.querySelectorAll('.review-thread-time i'), (icon) => icon.className),
      actionsRightAligned: actionsRect.left > metaRect.right && actionsRect.right <= threadRect.right
    };
  });
  expect(threadState.border).not.toBe(primaryColor);
  expect(threadState.bodyFontSize).toBe(threadState.anchorFontSize);
  expect(threadState.hasStructuredContent).toBe(true);
  expect(threadState.headerContainsActions).toBe(true);
  expect(threadState.actionCount).toBe(3);
  expect(threadState.actionLabels).toEqual(['Edit comment', 'Resolve comment', 'Delete comment']);
  expect(threadState.actionText).toEqual(['', '', '']);
  expect(threadState.actionIcons).toEqual([
    'lucide lucide-square-pen',
    'lucide lucide-check',
    'lucide lucide-trash-2'
  ]);
  expect(threadState.dateIcons).toEqual(['lucide lucide-clock-3', 'lucide lucide-circle']);
  expect(threadState.actionsRightAligned).toBe(true);

  await page.locator('[data-review-action="toggle-resolved"]').click();
  await page.locator('[data-review-filter="resolved"]').click();
  await expect(page.locator('.review-status-label')).toContainText('Resolved');
  await expect(page.locator('.review-status-label i')).toHaveClass('lucide lucide-check');
  await expect(page.locator('[data-review-action="toggle-resolved"]')).toHaveAttribute('aria-label', 'Reopen comment');
  await expect(page.locator('[data-review-action="toggle-resolved"] i')).toHaveClass('lucide lucide-refresh-cw');

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const colorChannels = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  await expect.poll(() => page.evaluate(() => ({
    reviewFilter: getComputedStyle(document.querySelector('.review-filter-btn.is-active')).backgroundColor,
    sidebarFilter: getComputedStyle(document.querySelector('.document-filter-btn.is-active')).backgroundColor
  })).then(({ reviewFilter, sidebarFilter }) => ({
    reviewFilter: colorChannels(reviewFilter),
    sidebarFilter: colorChannels(sidebarFilter)
  }))).toEqual({
    reviewFilter: [13, 17, 23],
    sidebarFilter: [13, 17, 23]
  });
  const darkState = await page.evaluate(() => {
    const activeFilter = document.querySelector('.review-filter-btn.is-active');
    const sidebarFilter = document.querySelector('.document-filter-btn.is-active');
    const thread = document.querySelector('.review-thread');
    return {
      reviewFilter: getComputedStyle(activeFilter).backgroundColor,
      sidebarFilter: getComputedStyle(sidebarFilter).backgroundColor,
      threadBorder: getComputedStyle(thread).borderInlineStartColor
    };
  });
  expect(colorChannels(darkState.reviewFilter)).toEqual(colorChannels(darkState.sidebarFilter));
  expect(darkState.threadBorder).not.toBe(darkState.reviewFilter);
});

test('keeps the review sheet touch-friendly and stable in narrow layouts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('#mobile-menu-toggle').click();
  await page.locator('#mobile-review-toggle').click();
  await expect(page.locator('#review-panel')).toBeVisible();

  const portraitMetrics = await page.locator('#review-panel').evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    const targets = panel.querySelectorAll(
      '.review-panel-header .review-icon-btn, .review-panel-actions .review-icon-btn, .review-filter-btn'
    );
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      scrollWidth: panel.scrollWidth,
      clientWidth: panel.clientWidth,
      animationName: getComputedStyle(panel).animationName,
      targetHeights: Array.from(targets, (target) => target.getBoundingClientRect().height)
    };
  });

  expect(portraitMetrics.left).toBeGreaterThanOrEqual(0);
  expect(portraitMetrics.right).toBeLessThanOrEqual(portraitMetrics.viewportWidth);
  expect(portraitMetrics.scrollWidth).toBeLessThanOrEqual(portraitMetrics.clientWidth);
  expect(portraitMetrics.animationName).toBe('none');
  portraitMetrics.targetHeights.forEach((height) => expect(height).toBeGreaterThanOrEqual(44));

  await page.locator('#review-pins-layer .review-target-button[data-review-anchor^="heading:"]').evaluate((button) => button.click());
  const mobileComposerMetrics = await page.locator('#review-composer').evaluate((composer) => ({
    scrollWidth: composer.scrollWidth,
    clientWidth: composer.clientWidth,
    kindTargets: Array.from(composer.querySelectorAll('.review-kind-btn'), (button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  }));
  expect(mobileComposerMetrics.scrollWidth).toBeLessThanOrEqual(mobileComposerMetrics.clientWidth);
  mobileComposerMetrics.kindTargets.forEach(({ width, height }) => {
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });
  await page.locator('#review-feedback-input').fill('Keep the mobile review card compact.');
  await page.locator('#review-feedback-submit').click();
  const mobileThreadMetrics = await page.locator('.review-thread').evaluate((thread) => {
    const header = thread.querySelector('.review-thread-header');
    const buttons = Array.from(thread.querySelectorAll('.review-thread-action'));
    return {
      headerScrollWidth: header.scrollWidth,
      headerClientWidth: header.clientWidth,
      targets: buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
    };
  });
  expect(mobileThreadMetrics.headerScrollWidth).toBeLessThanOrEqual(mobileThreadMetrics.headerClientWidth);
  mobileThreadMetrics.targets.forEach(({ width, height }) => {
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });

  await page.setViewportSize({ width: 667, height: 375 });
  const landscapeMetrics = await page.locator('#review-panel').evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: panel.scrollWidth,
      clientWidth: panel.clientWidth
    };
  });

  expect(landscapeMetrics.left).toBeGreaterThanOrEqual(0);
  expect(landscapeMetrics.right).toBeLessThanOrEqual(landscapeMetrics.viewportWidth);
  expect(landscapeMetrics.bottom).toBeLessThanOrEqual(landscapeMetrics.viewportHeight);
  expect(landscapeMetrics.scrollWidth).toBeLessThanOrEqual(landscapeMetrics.clientWidth);
});
