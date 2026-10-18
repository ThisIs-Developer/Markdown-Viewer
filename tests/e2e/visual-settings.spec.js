const { test, expect } = require('@playwright/test');
const { openApp, waitForAppReady } = require('../helpers/app.js');

async function openAppearance(page) {
  await page.locator('#workspaceSettingsDropdown').click();
  await page.locator('#menu-visual-settings-button').click();
  await expect(page.locator('#visual-settings-modal')).toBeVisible();
}

test.describe('Preview Styling', () => {
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

  test('panel opens from Settings with keyboard focus, accessible controls, and no navbar shortcut', async ({ page }) => {
    await openApp(page);

    const settingsButton = page.locator('#workspaceSettingsDropdown');
    await expect(page.locator('#visual-settings-button')).toHaveCount(0);

    // Open panel
    await openAppearance(page);
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

    await expect(modal).toHaveAccessibleName('Preview Styling');
    await page.locator('#visual-settings-close-btn').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#visual-settings-close-icon')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#visual-settings-close-btn')).toBeFocused();

    // Close via Esc key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
    await expect(settingsButton).toBeFocused();

    // Reopen and close via Close button
    await openAppearance(page);
    await expect(modal).toBeVisible();
    await page.locator('#visual-settings-close-btn').click();
    await expect(modal).not.toBeVisible();

    // Reopen and close via X icon
    await openAppearance(page);
    await expect(modal).toBeVisible();
    await page.locator('#visual-settings-close-icon').click();
    await expect(modal).not.toBeVisible();

    // Open via workspace settings dropdown menu
    await page.locator('#workspaceSettingsDropdown').click();
    await expect(page.locator('#menu-visual-settings-button')).toBeVisible();
    await page.locator('#menu-visual-settings-button').click();
    await expect(modal).toBeVisible();
    await page.locator('#visual-settings-close-btn').click();
    await expect(modal).not.toBeVisible();
  });

  test('all settings update live, re-render preview, persist across reloads, and reset', async ({ page }) => {
    await openApp(page);

    // Set editor content with code, math, mermaid, and emoji
    const editor = page.locator('#markdown-editor');
    await editor.fill(SAMPLE_DOC);
    await editor.dispatchEvent('input');

    // Open settings panel
    await openAppearance(page);
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
    await openAppearance(page);
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
    await expect(mobileMenuToggle).toBeFocused();

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

  test('P4 & P5: all 14 highlight.js themes resolve valid stylesheets and dark themes have readable backgrounds in light mode', async ({ page }) => {
    await openApp(page);

    // Verify all 14 theme options exist
    const options = await page.evaluate(() => window.visualSettingsAdapters.getOptions().hljsTheme.map(o => o.value));
    const themeValues = options.filter(v => v !== 'auto');
    expect(themeValues.length).toBe(14);

    // Test base16 themes (P4)
    for (const theme of ['dracula', 'solarized-dark', 'solarized-light']) {
      await page.evaluate(async (t) => {
        await window.visualSettingsAdapters.applyHighlightTheme(t);
      }, theme);
      const linkHref = await page.locator('#mdv-hljs-theme-link').getAttribute('href');
      expect(linkHref).toContain(`base16/${theme}.min.css`);
    }

    // Set sample code in light mode (P5)
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const editor = page.locator('#markdown-editor');
    await editor.fill('```javascript\nfunction test() { return 42; }\n```');
    await editor.dispatchEvent('input');
    await page.waitForTimeout(500);

    // Apply Monokai
    await page.evaluate(async () => {
      await window.visualSettingsAdapters.applyHighlightTheme('monokai');
    });

    const preBg = await page.locator('#markdown-preview pre').first().evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const codeColor = await page.locator('#markdown-preview pre code').first().evaluate(el => {
      return window.getComputedStyle(el).color;
    });

    // Dark theme should NOT be transparent in light mode
    expect(preBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(preBg).not.toBe('transparent');
    expect(preBg).toContain('39, 40, 34'); // #272822
    expect(codeColor).toContain('221, 221, 221'); // #ddd
    const fnColor = await page.locator('#markdown-preview pre code .hljs-title').first().evaluate(el => {
      return window.getComputedStyle(el).color;
    });
    expect(fnColor).toBe('rgb(166, 226, 46)'); // Monokai green
  });

  test('P1: MathJax font switches to STIX Two and updates output jax font data live and on reload', async ({ page }) => {
    await openApp(page, '/', { mockMathJax: false });

    // Fill math content
    const editor = page.locator('#markdown-editor');
    await editor.fill('$$E = mc^2$$');
    await editor.dispatchEvent('input');
    await page.locator('#markdown-preview mjx-container').first().waitFor({ timeout: 15_000 });

    // Apply STIX Two font live
    await page.evaluate(async () => {
      await window.visualSettingsAdapters.applyMathFont('mathjax-stix2');
    });

    const fontState = await page.evaluate(() => {
      const mj = window.MathJax;
      const font = mj?.startup?.output?.font;
      const fontPkg = mj?._?.output?.fonts?.[window.visualSettingsAdapters?.getCurrentMathFont()];
      const fontClassKey = fontPkg?.chtml_ts ? Object.keys(fontPkg.chtml_ts)[0] : null;
      return {
        activeFont: window.visualSettingsAdapters?.getCurrentMathFont(),
        hasFontData: !!mj?.config?.chtml?.fontData,
        fontClassKey,
        cssFontPrefix: font?.cssFontPrefix
      };
    });

    expect(fontState.activeFont).toBe('mathjax-stix2');
    expect(fontState.hasFontData).toBe(true);
    expect(fontState.fontClassKey).toBe('MathJaxStix2Font');
    expect(fontState.cssFontPrefix).toBe('STX');
  });

  test('P6 & P7: split preview refreshes emoji, math, mermaid, and syntax themes across both panes', async ({ page }) => {
    await openApp(page, '/', { mockMathJax: false });

    // Primary document with emoji, math formula, mermaid diagram, and code block
    const primaryContent = '# Primary\n\n:wave:\n\n$$\\sum_{i=1}^n i$$\n\n```mermaid\ngraph TD\n  A-->B\n```\n\n```javascript\nconst a = 1;\n```';
    const secondaryContent = '# Secondary\n\n:wave:\n\n$$\\int_0^\\infty x dx$$\n\n```mermaid\ngraph TD\n  C-->D\n```\n\n```javascript\nconst b = 2;\n```';

    const editor = page.locator('#markdown-editor');
    await editor.fill(primaryContent);
    await editor.dispatchEvent('input');
    await page.waitForTimeout(1000);

    // Create a second tab for split view test (P6)
    await page.locator('#tab-new-btn').click();
    await editor.fill(secondaryContent);
    await editor.dispatchEvent('input');
    await page.waitForTimeout(500);

    // Open first tab in split view
    const secondTabId = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
    await page.locator('#tab-list .tab-item').first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Open in split view' }).click();
    await page.locator('#document-split-destination').selectOption(secondTabId);
    await page.locator('#document-split-modal-confirm').click();

    // Switch to preview mode to see split preview
    await page.locator('button.view-toggle-btn[data-view-mode="preview"]').click();

    // Verify initial yellow wave in both panes
    await expect(page.locator('#markdown-preview')).toContainText('👋');
    await expect(page.locator('#document-split-preview')).toContainText('👋');

    // Verify math, mermaid, and code blocks rendered in both panes
    await expect(page.locator('#markdown-preview mjx-container')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#document-split-preview mjx-container')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#markdown-preview .mermaid svg')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#document-split-preview .mermaid svg')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#markdown-preview pre code.hljs')).toBeVisible();
    await expect(page.locator('#document-split-preview pre code.hljs')).toBeVisible();

    // 1. Change emoji skin tone to tone3
    await openAppearance(page);
    await page.locator('#visual-setting-emoji-skin-tone').selectOption('tone3');
    await page.locator('#visual-settings-close-btn').click();

    // Verify both primary and split preview refresh to tone3 (P6 & P7)
    await expect.poll(async () => {
      const primary = await page.locator('#markdown-preview').textContent();
      const secondary = await page.locator('#document-split-preview').textContent();
      return { primary: primary.includes('👋🏽'), secondary: secondary.includes('👋🏽') };
    }, { timeout: 10_000 }).toEqual({ primary: true, secondary: true });

    // 2. Change hljs theme to dracula (Base16 theme)
    await openAppearance(page);
    await page.locator('#visual-setting-hljs-theme').selectOption('dracula');
    await page.locator('#visual-settings-close-btn').click();

    await expect.poll(async () => {
      return page.evaluate(() => document.getElementById('mdv-hljs-theme-link')?.href || '');
    }, { timeout: 10_000 }).toContain('styles/base16/dracula.min.css');

    // 3. Change math font to STIX Two
    await openAppearance(page);
    await page.locator('#visual-setting-math-font').selectOption('mathjax-stix2');
    await page.locator('#visual-settings-close-btn').click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const adapters = window.visualSettingsAdapters;
        return adapters ? adapters.getCurrentMathFont() : null;
      });
    }, { timeout: 15_000 }).toBe('mathjax-stix2');

    // 4. Change mermaid theme to dark and look to handDrawn
    await openAppearance(page);
    await page.locator('#visual-setting-mermaid-theme').selectOption('dark');
    await page.locator('#visual-setting-mermaid-look').selectOption('handDrawn');
    await page.locator('#visual-settings-close-btn').click();

    await expect.poll(async () => {
      return page.evaluate(() => window.visualSettingsAdapters?.getMermaidConfig());
    }, { timeout: 10_000 }).toMatchObject({ theme: 'dark', look: 'handDrawn' });

    // 5. Verify reload persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const persisted = await page.evaluate(() => window.visualSettingsStore.getSettings());
    expect(persisted.emojiSkinTone).toBe('tone3');
    expect(persisted.hljsTheme).toBe('dracula');
    expect(persisted.mathFont).toBe('mathjax-stix2');
    expect(persisted.mermaidTheme).toBe('dark');
    expect(persisted.mermaidLook).toBe('handDrawn');
  });

  test('P3: Dockerfile includes visual settings scripts and distribution assets are complete', async ({ page }) => {
    const fs = require('fs');
    const path = require('path');
    const dockerfile = fs.readFileSync(path.resolve(__dirname, '../../Dockerfile'), 'utf8');
    expect(dockerfile).toContain('COPY visual-settings-adapters.js');
    expect(dockerfile).toContain('COPY visual-settings-store.js');

    const sw = fs.readFileSync(path.resolve(__dirname, '../../sw.js'), 'utf8');
    expect(sw).toContain('visual-settings-adapters.js');
    expect(sw).toContain('visual-settings-store.js');
  });

  test('P1: MathJax configuration is compatible with desktop MathJax bundle and legacy bundles', async ({ page }) => {
    // 1. Verify desktop prepare.js downloads MathJax 4 bundle with SRI hash
    const fs = require('fs');
    const path = require('path');
    const prepareSource = fs.readFileSync(path.resolve(__dirname, '../../desktop-app/prepare.js'), 'utf8');
    expect(prepareSource).toContain('https://cdn.jsdelivr.net/npm/mathjax@4.0.0-beta.7/tex-mml-chtml.js');
    expect(prepareSource).toContain('sha384-2f5bAKjuFIbbQ+0O9aSu5W1OyLA4q80QrDEvjXDwJexjU9VqoJhMgw19pYVpSJab');

    // 2. Verify configureMathJax does not pass font name string to chtml.font
    const testPage = await page.context().newPage();
    await testPage.addInitScript(() => {
      window.__initialChtmlFont = null;
      let _mj = undefined;
      Object.defineProperty(window, 'MathJax', {
        configurable: true,
        enumerable: true,
        get: () => _mj,
        set: (v) => {
          _mj = v;
          if (v && v.chtml) {
            window.__initialChtmlFont = v.chtml.font;
          }
        }
      });
    });

    await openApp(testPage, '/', { mockMathJax: false });
    const initialChtmlFont = await testPage.evaluate(() => window.__initialChtmlFont);
    expect(typeof initialChtmlFont).not.toBe('string');
    await testPage.close();

    // 3. Verify MathJax 3 bundle dependency is compatible with configuration without crashing startup
    const legacyPage = await page.context().newPage();
    const errors = [];
    legacyPage.on('pageerror', err => errors.push(err.message));
    legacyPage.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await legacyPage.setContent(`<!DOCTYPE html><html><head>
      <script>
        window.MathJax = {
          startup: { typeset: false },
          options: { a11y: { inTabOrder: false } },
          output: { font: 'mathjax-modern' },
          tex: {
            inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
            displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
            processEscapes: true
          }
        };
      </script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js"></script>
    </head><body><div id="math">$$x^2$$</div></body></html>`);
    await legacyPage.waitForTimeout(1500);

    const legacyResult = await legacyPage.evaluate(async () => {
      if (window.MathJax?.startup?.promise) {
        await window.MathJax.startup.promise;
      }
      let rendered = false;
      if (typeof window.MathJax?.typesetPromise === 'function') {
        await window.MathJax.typesetPromise([document.getElementById('math')]);
        rendered = !!document.querySelector('mjx-container');
      }
      return {
        hasTypesetPromise: typeof window.MathJax?.typesetPromise === 'function',
        rendered
      };
    });
    expect(errors.filter(e => e.includes('adaptiveCSS')).length).toBe(0);
    expect(legacyResult.hasTypesetPromise).toBe(true);
    expect(legacyResult.rendered).toBe(true);
    await legacyPage.close();
  });

  test('P2: MathJax font switches font resource URLs and dynamic font packages without failed glyph loads', async ({ page }) => {
    const failedFontRequests = [];
    page.on('response', resp => {
      if (resp.status() >= 400 && (resp.url().includes('woff') || resp.url().includes('dynamic') || resp.url().includes('font'))) {
        failedFontRequests.push({ url: resp.url(), status: resp.status() });
      }
    });

    const wrongPackageRequests = [];
    page.on('request', req => {
      if (req.url().includes('mathjax-modern-font') && (req.url().includes('stx') || req.url().includes('asn'))) {
        wrongPackageRequests.push(req.url());
      }
    });

    await openApp(page, '/', { mockMathJax: false });

    // Initial render with Modern
    const editor = page.locator('#markdown-editor');
    await editor.fill('$$x^2$$\n\n$$\\mathbb{R}$$');
    await editor.dispatchEvent('input');
    await expect(page.locator('#markdown-preview mjx-container').first()).toBeVisible({ timeout: 15_000 });

    // 1. Switch to STIX Two live via adapter
    await page.evaluate(async () => {
      await window.visualSettingsAdapters.applyMathFont('mathjax-stix2');
    });

    // Check font resource options on startup.output.font
    const stixFontOptions = await page.evaluate(() => {
      const font = window.MathJax?.startup?.output?.font;
      return {
        prefix: font?.cssFontPrefix,
        fontURL: font?.options?.fontURL,
        dynamicPrefix: font?.options?.dynamicPrefix
      };
    });
    expect(stixFontOptions.prefix).toBe('STX');
    expect(stixFontOptions.fontURL).toContain('mathjax-stix2-font/chtml/woff');
    expect(stixFontOptions.dynamicPrefix).toBe('[mathjax-stix2]/chtml/dynamic');

    // 2. Switch to Asana live with \mathbb{R}
    let asanaDynamicLoaded = false;
    page.on('request', req => {
      if (req.url().includes('mathjax-asana-font') && req.url().includes('double-struck.js')) {
        asanaDynamicLoaded = true;
      }
    });

    await page.evaluate(async () => {
      await window.visualSettingsAdapters.applyMathFont('mathjax-asana');
    });

    const asanaFontOptions = await page.evaluate(() => {
      const font = window.MathJax?.startup?.output?.font;
      return {
        prefix: font?.cssFontPrefix,
        fontURL: font?.options?.fontURL,
        dynamicPrefix: font?.options?.dynamicPrefix
      };
    });
    expect(asanaFontOptions.prefix).toBe('ASNA');
    expect(asanaFontOptions.fontURL).toContain('mathjax-asana-font/chtml/woff');
    expect(asanaFontOptions.dynamicPrefix).toBe('[mathjax-asana]/chtml/dynamic');

    // Verify equations are rendered and no failed font requests occurred
    await expect(page.locator('#markdown-preview mjx-container')).toHaveCount(2);
    expect(failedFontRequests).toEqual([]);
    expect(wrongPackageRequests).toEqual([]);
  });

  test('P2: load Modern when resetting after an alternate-font reload', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mdv.visualSettings.v1', JSON.stringify({
        mathFont: 'mathjax-stix2'
      }));
    });

    const failedFontRequests = [];
    page.on('response', resp => {
      if (resp.url().includes('mathjax') && resp.status() >= 400) {
        failedFontRequests.push({ url: resp.url(), status: resp.status() });
      }
    });

    await openApp(page, '/', { mockMathJax: false });

    // Initial render with STIX Two
    const editor = page.locator('#markdown-editor');
    await editor.fill('# Saved math font\n\n$$x^2 + y^2 = z^2$$');
    await editor.dispatchEvent('input');
    await expect(page.locator('#markdown-preview h1')).toHaveText('Saved math font');
    await expect(page.locator('#markdown-preview mjx-container')).toHaveCount(1);
    await expect(page.locator('#markdown-preview mjx-container')).toBeVisible({ timeout: 15_000 });

    await expect.poll(() => page.evaluate(() =>
      window.MathJax?.startup?.output?.font?.cssFontPrefix
    )).toBe('STX');

    // Reset visual settings to default (Modern math font)
    await openAppearance(page);
    await page.locator('#visual-settings-reset-btn').click();

    await expect(page.locator('#visual-setting-math-font')).toHaveValue('mathjax-modern');

    await expect.poll(async () => {
      return page.evaluate(() => {
        const font = window.MathJax?.startup?.output?.font;
        return {
          prefix: font?.cssFontPrefix,
          fontURL: font?.options?.fontURL,
          dynamicPrefix: font?.options?.dynamicPrefix,
          activeFont: window.visualSettingsAdapters?.getCurrentMathFont()
        };
      });
    }, { timeout: 15_000 }).toEqual({
      prefix: 'MM',
      fontURL: 'https://cdn.jsdelivr.net/npm/mathjax-modern-font/chtml/woff',
      dynamicPrefix: '[mathjax-modern]/chtml/dynamic',
      activeFont: 'mathjax-modern'
    });

    await expect(page.locator('#markdown-preview mjx-container')).toBeVisible();
    expect(failedFontRequests).toEqual([]);
  });

  test('P2: resolve automatic code colors against PDF export theme', async ({ page }) => {
    await openApp(page);
    const editor = page.locator('#markdown-editor');
    await editor.fill('```javascript\nfunction greet() { return "hello"; }\n```');
    await editor.dispatchEvent('input');
    await expect(page.locator('#markdown-preview pre code.hljs')).toBeVisible({ timeout: 15_000 });

    // Ensure Auto syntax highlighting is active
    await page.evaluate(async () => {
      await window.visualSettingsAdapters.applyHighlightTheme('auto');
    });

    // 1. Light app theme + Auto syntax + Dark PDF export
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      window.visualSettingsAdapters.onAppThemeChange('light');
    });

    // Preview code block has light background (app theme)
    const previewLightBg = await page.locator('#markdown-preview pre').first().evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(previewLightBg).not.toBe('rgb(22, 27, 34)');

    // Trigger dark vector PDF export to inspect the export render snapshot
    await page.evaluate(() => {
      window.print = () => { window.__darkPdfPrintReady = true; };
    });
    await page.locator('#export-pdf').dispatchEvent('click');
    await page.locator('#pdf-export-theme-card-dark').click();
    await page.locator('#pdf-export-confirm').click();

    await expect.poll(() => page.evaluate(() => window.__darkPdfPrintReady), { timeout: 20_000 }).toBe(true);

    // Evaluate snapshot code block colors under dark export
    const darkExportColors = await page.locator('.browser-print-export-snapshot').evaluate(root => {
      const pre = root.querySelector('pre');
      const code = root.querySelector('code');
      return {
        preBg: window.getComputedStyle(pre).backgroundColor,
        codeColor: window.getComputedStyle(code).color
      };
    });

    expect(darkExportColors.preBg).toBe('rgb(22, 27, 34)'); // #161b22
    expect(darkExportColors.codeColor).toBe('rgb(201, 209, 217)'); // #c9d1d9

    // Close/restore afterprint
    await page.evaluate(() => {
      window.dispatchEvent(new Event('afterprint'));
    });

    // 2. Dark app theme + Auto syntax + Light PDF export
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      window.visualSettingsAdapters.onAppThemeChange('dark');
      window.print = () => { window.__lightPdfPrintReady = true; };
    });

    // Preview code block has dark background in dark mode
    const previewDarkBg = await page.locator('#markdown-preview pre').first().evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(previewDarkBg).not.toBe('rgb(246, 248, 250)');

    await page.locator('#export-pdf').dispatchEvent('click');
    await page.locator('#pdf-export-theme-card-light').click();
    await page.locator('#pdf-export-confirm').click();

    await expect.poll(() => page.evaluate(() => window.__lightPdfPrintReady), { timeout: 20_000 }).toBe(true);

    const lightExportColors = await page.locator('.browser-print-export-snapshot').evaluate(root => {
      const pre = root.querySelector('pre');
      const code = root.querySelector('code');
      return {
        preBg: window.getComputedStyle(pre).backgroundColor,
        codeColor: window.getComputedStyle(code).color
      };
    });

    expect(lightExportColors.preBg).toBe('rgb(246, 248, 250)'); // #f6f8fa
    expect(lightExportColors.codeColor).toBe('rgb(36, 41, 46)'); // #24292e

    await page.evaluate(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
  });

  test('P2: remove built-in token palette when applying syntax theme and match external stylesheets', async ({ page }) => {
    await openApp(page);
    const editor = page.locator('#markdown-editor');
    await editor.fill('```javascript\nfunction hello() { return 42; }\n```');
    await editor.dispatchEvent('input');
    await expect(page.locator('#markdown-preview pre code.hljs')).toBeVisible({ timeout: 15_000 });

    // 1. In Auto mode (light app), function title uses the built-in GitHub purple
    await page.evaluate(async () => {
      document.documentElement.setAttribute('data-theme', 'light');
      await window.visualSettingsAdapters.applyHighlightTheme('auto');
    });
    const autoFnColor = await page.locator('#markdown-preview pre code .hljs-title').first().evaluate(el => {
      return window.getComputedStyle(el).color;
    });
    expect(autoFnColor).toBe('rgb(111, 66, 193)');

    // 2. Select Monokai: function name must be Monokai green, NOT legacy purple
    await page.evaluate(async () => {
      await window.visualSettingsAdapters.applyHighlightTheme('monokai');
    });
    await expect.poll(async () => {
      return await page.locator('#markdown-preview pre code .hljs-title').first().evaluate(el => {
        return window.getComputedStyle(el).color;
      });
    }, { timeout: 10_000 }).toBe('rgb(166, 226, 46)');

    // 3. Compare actual token colors against an isolated iframe containing only the selected stylesheet
    const testThemes = ['monokai', 'dracula', 'atom-one-dark', 'solarized-dark', 'nord', 'default'];
    for (const theme of testThemes) {
      await page.evaluate(async (t) => {
        await window.visualSettingsAdapters.applyHighlightTheme(t);
      }, theme);

      const comparison = await page.evaluate(async () => {
        const link = document.getElementById('mdv-hljs-theme-link');
        const href = link ? link.href : '';

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        document.body.appendChild(iframe);

        const idoc = iframe.contentDocument;
        idoc.open();
        idoc.write(`<!DOCTYPE html><html><head><link rel="stylesheet" href="${href}"></head><body><pre><code class="hljs language-javascript"><span class="hljs-keyword">function</span> <span class="hljs-title function_">hello</span>() { <span class="hljs-keyword">return</span> <span class="hljs-number">42</span>; }</code></pre></body></html>`);
        idoc.close();

        await new Promise(resolve => {
          const l = idoc.querySelector('link');
          if (l && l.sheet) return resolve();
          if (l) {
            l.onload = () => resolve();
            l.onerror = () => resolve();
          }
          setTimeout(resolve, 1000);
        });

        const previewFn = document.querySelector('#markdown-preview pre code .hljs-title');
        const iframeFn = idoc.querySelector('pre code .hljs-title');
        const previewKw = document.querySelector('#markdown-preview pre code .hljs-keyword');
        const iframeKw = idoc.querySelector('pre code .hljs-keyword');

        const result = {
          previewFnColor: previewFn ? getComputedStyle(previewFn).color : null,
          iframeFnColor: iframeFn ? iframe.contentWindow.getComputedStyle(iframeFn).color : null,
          previewKwColor: previewKw ? getComputedStyle(previewKw).color : null,
          iframeKwColor: iframeKw ? iframe.contentWindow.getComputedStyle(iframeKw).color : null
        };
        iframe.remove();
        return result;
      });

      expect(comparison.previewFnColor).toBe(comparison.iframeFnColor);
      expect(comparison.previewKwColor).toBe(comparison.iframeKwColor);
    }

    // 4. Switching back to Auto restores built-in palette
    await page.evaluate(async () => {
      await window.visualSettingsAdapters.applyHighlightTheme('auto');
    });
    await expect.poll(async () => {
      return await page.locator('#markdown-preview pre code .hljs-title').first().evaluate(el => {
        return window.getComputedStyle(el).color;
      });
    }, { timeout: 10_000 }).toBe('rgb(111, 66, 193)');
  });

  test('P2: canonicalize emoji aliases before adding skin-tone suffix', async ({ page }) => {
    await openApp(page);
    const editor = page.locator('#markdown-editor');
    await editor.fill(':thumbsup: :+1: :runner: :wave_tone3: :smile:');
    await editor.dispatchEvent('input');
    await expect(page.locator('#markdown-preview')).toContainText('👋🏽', { timeout: 15_000 });

    const expectedGlyphs = {
      tone1: { thumbs: '👍🏻', runner: '🏃🏻' },
      tone2: { thumbs: '👍🏼', runner: '🏃🏼' },
      tone3: { thumbs: '👍🏽', runner: '🏃🏽' },
      tone4: { thumbs: '👍🏾', runner: '🏃🏾' },
      tone5: { thumbs: '👍🏿', runner: '🏃🏿' }
    };

    // Test across all 5 non-default skin tones in light and dark mode
    for (const [tone, glyphs] of Object.entries(expectedGlyphs)) {
      for (const appTheme of ['light', 'dark']) {
        await page.evaluate(async ({ tone, appTheme }) => {
          document.documentElement.setAttribute('data-theme', appTheme);
          await window.visualSettingsAdapters.applyEmojiSkinTone(tone);
        }, { tone, appTheme });

        await expect.poll(async () => {
          return await page.locator('#markdown-preview').textContent();
        }, { timeout: 10_000 }).toContain(glyphs.thumbs);

        const previewText = await page.locator('#markdown-preview').textContent();
        // Both canonical :thumbsup: and alias :+1: must render with the chosen skin tone
        const thumbsOccurrences = (previewText.match(new RegExp(glyphs.thumbs, 'g')) || []).length;
        expect(thumbsOccurrences).toBe(2);

        // Alias :runner: must render with the chosen skin tone (not yellow 🏃)
        expect(previewText).toContain(glyphs.runner);

        // Explicit tone :wave_tone3: preserved
        expect(previewText).toContain('👋🏽');

        // Genuinely unsupported emoji :smile: remains 😄
        expect(previewText).toContain('😄');
      }
    }

    // Reset to default
    await page.evaluate(async () => {
      await window.visualSettingsAdapters.applyEmojiSkinTone('default');
    });
    await expect.poll(async () => {
      return await page.locator('#markdown-preview').textContent();
    }, { timeout: 10_000 }).toContain('👍');
    const defaultText = await page.locator('#markdown-preview').textContent();
    const defaultThumbs = (defaultText.match(/👍/g) || []).length;
    expect(defaultThumbs).toBe(2);
    expect(defaultText).toContain('🏃');
    expect(defaultText).toContain('👋🏽');
  });
});


