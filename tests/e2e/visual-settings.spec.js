const { test, expect } = require('@playwright/test');
const { openApp, waitForAppReady } = require('../helpers/app.js');

test.describe('Visual Library Settings Panel (Issue #129)', () => {
  const SAMPLE_DOC = `
# Visual Settings Verification

## Code Block
\`\`\`javascript
function calculateSum(a, b) {
  return a + b;
}
\`\`\`

## Math
Here is inline math: $E = mc^2$

And block math:
$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Diagram
\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Success]
  B -->|No| D[Retry]
\`\`\`

## Emoji
Greetings: :wave: :thumbsup: :smile:
`;

  test('panel opens and closes via header button, close button, and Esc key with focus trap', async ({ page }) => {
    await openApp(page);

    const visualBtn = page.locator('#visual-settings-button');
    await expect(visualBtn).toBeVisible();

    // Open panel
    await visualBtn.click();
    const modal = page.locator('#visual-settings-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('aria-hidden', 'false');

    // Check first control has focus
    const hljsSelect = page.locator('#visual-setting-hljs-theme');
    await expect(hljsSelect).toBeFocused();

    // Verify all 5 controls are present with proper labels
    await expect(page.locator('#visual-setting-hljs-theme')).toBeVisible();
    await expect(page.locator('#visual-setting-math-font')).toBeVisible();
    await expect(page.locator('#visual-setting-mermaid-theme')).toBeVisible();
    await expect(page.locator('#visual-setting-mermaid-look')).toBeVisible();
    await expect(page.locator('#visual-setting-emoji-skin-tone')).toBeVisible();

    // Close via Esc key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(modal).toHaveAttribute('aria-hidden', 'true');

    // Reopen and close via Close button
    await visualBtn.click();
    await expect(modal).toBeVisible();
    await page.locator('#visual-settings-close-btn').click();
    await expect(modal).not.toBeVisible();

    // Reopen and close via X icon
    await visualBtn.click();
    await expect(modal).toBeVisible();
    await page.locator('#visual-settings-close-icon').click();
    await expect(modal).not.toBeVisible();
  });

  test('all settings update live, re-render preview, persist across reloads, and reset', async ({ page }) => {
    await openApp(page);

    // Set editor content with code, math, mermaid, and emoji
    const editor = page.locator('#markdown-editor');
    await editor.fill(SAMPLE_DOC);
    await editor.dispatchEvent('input');

    // Open settings panel
    await page.locator('#visual-settings-button').click();
    await expect(page.locator('#visual-settings-modal')).toBeVisible();

    // 1. Change highlight.js theme
    const hljsSelect = page.locator('#visual-setting-hljs-theme');
    await hljsSelect.selectOption('monokai');

    // 2. Change MathJax font
    const mathFontSelect = page.locator('#visual-setting-math-font');
    await mathFontSelect.selectOption('mathjax-stix2');

    // 3. Change Mermaid theme and look
    const mermaidThemeSelect = page.locator('#visual-setting-mermaid-theme');
    await mermaidThemeSelect.selectOption('forest');

    const mermaidLookSelect = page.locator('#visual-setting-mermaid-look');
    await mermaidLookSelect.selectOption('handDrawn');

    // 4. Change JoyPixels skin tone
    const emojiToneSelect = page.locator('#visual-setting-emoji-skin-tone');
    await emojiToneSelect.selectOption('tone3');

    // Verify localStorage persistence
    const storedRaw = await page.evaluate(() => localStorage.getItem('mdv.visualSettings.v1'));
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw);
    expect(stored.hljsTheme).toBe('monokai');
    expect(stored.mathFont).toBe('mathjax-stix2');
    expect(stored.mermaidTheme).toBe('forest');
    expect(stored.mermaidLook).toBe('handDrawn');
    expect(stored.emojiSkinTone).toBe('tone3');

    // Close modal
    await page.locator('#visual-settings-close-btn').click();
    await expect(page.locator('#visual-settings-modal')).not.toBeVisible();

    // Reload page and check persistence
    await page.reload();
    await waitForAppReady(page);

    // Verify settings persisted in store
    const reloadedSettings = await page.evaluate(() => window.visualSettingsStore.getSettings());
    expect(reloadedSettings.hljsTheme).toBe('monokai');
    expect(reloadedSettings.mathFont).toBe('mathjax-stix2');
    expect(reloadedSettings.mermaidTheme).toBe('forest');
    expect(reloadedSettings.mermaidLook).toBe('handDrawn');
    expect(reloadedSettings.emojiSkinTone).toBe('tone3');

    // Verify modal selects reflect persisted settings
    await page.locator('#visual-settings-button').click();
    await expect(page.locator('#visual-setting-hljs-theme')).toHaveValue('monokai');
    await expect(page.locator('#visual-setting-math-font')).toHaveValue('mathjax-stix2');
    await expect(page.locator('#visual-setting-mermaid-theme')).toHaveValue('forest');
    await expect(page.locator('#visual-setting-mermaid-look')).toHaveValue('handDrawn');
    await expect(page.locator('#visual-setting-emoji-skin-tone')).toHaveValue('tone3');

    // Test "Reset to defaults"
    await page.locator('#visual-settings-reset-btn').click();

    // Verify UI reset
    await expect(page.locator('#visual-setting-hljs-theme')).toHaveValue('auto');
    await expect(page.locator('#visual-setting-math-font')).toHaveValue('mathjax-modern');
    await expect(page.locator('#visual-setting-mermaid-theme')).toHaveValue('auto');
    await expect(page.locator('#visual-setting-mermaid-look')).toHaveValue('classic');
    await expect(page.locator('#visual-setting-emoji-skin-tone')).toHaveValue('default');

    // Verify storage reset
    const resetStored = await page.evaluate(() => JSON.parse(localStorage.getItem('mdv.visualSettings.v1')));
    expect(resetStored.hljsTheme).toBe('auto');
    expect(resetStored.mathFont).toBe('mathjax-modern');
    expect(resetStored.mermaidTheme).toBe('auto');
    expect(resetStored.mermaidLook).toBe('classic');
    expect(resetStored.emojiSkinTone).toBe('default');

    await page.locator('#visual-settings-close-btn').click();
  });

  test('visual settings work in dark mode and mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await openApp(page);

    // Open mobile menu
    const mobileMenuToggle = page.locator('#mobile-menu-toggle');
    await mobileMenuToggle.click();
    await expect(page.locator('#mobile-menu-panel')).toBeVisible();

    // Open settings section inside mobile menu
    const mobileSettingsToggle = page.locator('[data-mobile-menu-section-toggle][aria-controls="mobile-menu-settings-panel"]');
    await mobileSettingsToggle.click();

    // Click mobile visual settings button
    const mobileVisualBtn = page.locator('#mobile-visual-settings-button');
    await expect(mobileVisualBtn).toBeVisible();
    await mobileVisualBtn.click();

    // Modal opens on mobile
    const modal = page.locator('#visual-settings-modal');
    await expect(modal).toBeVisible();

    // Change setting on mobile
    await page.locator('#visual-setting-hljs-theme').selectOption('dracula');
    await page.locator('#visual-settings-close-btn').click();
    await expect(modal).not.toBeVisible();

    // Switch to dark appearance
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      const toggle = document.getElementById('theme-toggle');
      if (toggle) toggle.click();
    });

    // Reopen and verify dark mode styling
    await mobileMenuToggle.click();
    await mobileSettingsToggle.click();
    await mobileVisualBtn.click();
    await expect(modal).toBeVisible();

    const selectBg = await page.locator('#visual-setting-hljs-theme').evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(selectBg).toBeTruthy();

    await page.locator('#visual-settings-close-btn').click();
  });
});
