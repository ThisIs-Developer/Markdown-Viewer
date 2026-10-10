/**
 * visual-settings-adapters.js
 * Library adapters for Markdown Viewer visual settings (Issue #129).
 * Manages runtime theming and visual configurations for:
 * - highlight.js: theme stylesheets (auto, github, monokai, dracula, etc.)
 * - MathJax: mathematical typesetting fonts (Modern, STIX2, Asana, Bonum, etc.)
 * - Mermaid: diagram themes (auto, default, dark, forest, neutral, base) & looks (classic, handDrawn)
 * - JoyPixels: emoji Fitzpatrick skin tones (default, tone1 - tone5)
 */

(function () {
  'use strict';

  // Allowed options metadata
  const OPTIONS = Object.freeze({
    hljsTheme: [
      { value: 'auto', label: 'Auto (Follow App)' },
      { value: 'github', label: 'GitHub' },
      { value: 'github-dark', label: 'GitHub Dark' },
      { value: 'monokai', label: 'Monokai' },
      { value: 'dracula', label: 'Dracula' },
      { value: 'atom-one-dark', label: 'Atom One Dark' },
      { value: 'atom-one-light', label: 'Atom One Light' },
      { value: 'solarized-dark', label: 'Solarized Dark' },
      { value: 'solarized-light', label: 'Solarized Light' },
      { value: 'vs', label: 'Visual Studio' },
      { value: 'vs2015', label: 'Visual Studio 2015' },
      { value: 'nord', label: 'Nord' },
      { value: 'tokyo-night-dark', label: 'Tokyo Night Dark' },
      { value: 'tokyo-night-light', label: 'Tokyo Night Light' },
      { value: 'default', label: 'Default' }
    ],
    mathFont: [
      { value: 'mathjax-modern', label: 'Computer Modern (TeX)' },
      { value: 'mathjax-tex', label: 'TeX (Classic)' },
      { value: 'mathjax-stix2', label: 'STIX Two' },
      { value: 'mathjax-asana', label: 'Asana Math' },
      { value: 'mathjax-bonum', label: 'Gyre Bonum' },
      { value: 'mathjax-dejavu', label: 'DejaVu Math' },
      { value: 'mathjax-fira', label: 'Fira Math' },
      { value: 'mathjax-pagella', label: 'Gyre Pagella' },
      { value: 'mathjax-schola', label: 'Gyre Schola' },
      { value: 'mathjax-termes', label: 'Gyre Termes' }
    ],
    mermaidTheme: [
      { value: 'auto', label: 'Auto (Follow App)' },
      { value: 'default', label: 'Default' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'dark', label: 'Dark' },
      { value: 'forest', label: 'Forest' },
      { value: 'base', label: 'Base' }
    ],
    mermaidLook: [
      { value: 'classic', label: 'Classic' },
      { value: 'handDrawn', label: 'Hand Drawn' }
    ],
    emojiSkinTone: [
      { value: 'default', label: 'Default (Yellow)' },
      { value: 'tone1', label: 'Light (Tone 1)' },
      { value: 'tone2', label: 'Medium-Light (Tone 2)' },
      { value: 'tone3', label: 'Medium (Tone 3)' },
      { value: 'tone4', label: 'Medium-Dark (Tone 4)' },
      { value: 'tone5', label: 'Dark (Tone 5)' }
    ]
  });

  const DEFAULTS = Object.freeze({
    hljsTheme: 'auto',
    mathFont: 'mathjax-modern',
    mermaidTheme: 'auto',
    mermaidLook: 'classic',
    emojiSkinTone: 'default'
  });

  // Active state
  let _activeHljsTheme = DEFAULTS.hljsTheme;
  let _activeMathFont = DEFAULTS.mathFont;
  let _activeMermaidTheme = DEFAULTS.mermaidTheme;
  let _activeMermaidLook = DEFAULTS.mermaidLook;
  let _activeEmojiSkinTone = DEFAULTS.emojiSkinTone;

  const HLJS_CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/';
  const MATHJAX_FONT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/';

  function getEffectiveAppTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function resolveHljsThemeName(theme) {
    if (theme === 'auto') {
      return getEffectiveAppTheme() === 'dark' ? 'github-dark' : 'github';
    }
    return theme || 'github';
  }

  function resolveMermaidThemeName(theme) {
    if (theme === 'auto') {
      return getEffectiveAppTheme() === 'dark' ? 'dark' : 'default';
    }
    return theme || 'default';
  }

  // Ensure helper styling so highlight.js themes integrate cleanly with the editor preview
  function ensureHljsStyleHelper() {
    if (!document.getElementById('mdv-hljs-style-helper')) {
      const style = document.createElement('style');
      style.id = 'mdv-hljs-style-helper';
      style.textContent = `
        .markdown-body pre:has(> code.hljs) {
          background-color: transparent !important;
          padding: 0 !important;
        }
        .markdown-body pre > code.hljs {
          border-radius: 6px;
          padding: 16px !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Apply highlight.js theme stylesheet.
   * Dynamically manages the <link id="mdv-hljs-theme-link"> in <head>.
   */
  function applyHighlightTheme(theme) {
    _activeHljsTheme = theme || DEFAULTS.hljsTheme;
    ensureHljsStyleHelper();

    const effectiveName = resolveHljsThemeName(_activeHljsTheme);
    const href = `${HLJS_CDN_BASE}${effectiveName}.min.css`;

    let link = document.getElementById('mdv-hljs-theme-link');
    if (!link) {
      link = document.createElement('link');
      link.id = 'mdv-hljs-theme-link';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    if (link.getAttribute('href') === href) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () => {
        console.warn(`[VisualAdapters] Failed to load highlight.js theme: ${href}`);
        resolve(); // resolve gracefully so UI does not stall
      };
      link.href = href;
    });
  }

  /**
   * Dynamically loads a script tag if not already loaded.
   */
  const _loadedScripts = new Set();
  function loadScriptOnce(src) {
    if (_loadedScripts.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        _loadedScripts.add(src);
        return resolve();
      }
      const script = document.createElement('script');
      script.src = src;
      script.charset = 'UTF-8';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        _loadedScripts.add(src);
        resolve();
      };
      script.onerror = (err) => {
        console.warn(`[VisualAdapters] Script load failed: ${src}`, err);
        reject(err);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Apply MathJax mathematical font.
   */
  async function applyMathFont(font) {
    _activeMathFont = font || DEFAULTS.mathFont;

    if (!window.MathJax) {
      return;
    }

    // Configure font in MathJax configuration object
    window.MathJax.config = window.MathJax.config || {};
    window.MathJax.config.output = window.MathJax.config.output || {};
    window.MathJax.config.output.font = _activeMathFont;
    window.MathJax.config.chtml = window.MathJax.config.chtml || {};
    window.MathJax.config.chtml.font = _activeMathFont;

    // If MathJax startup has completed, switch the font and re-typeset
    if (window.MathJax.startup && typeof window.MathJax.startup.getOutputJax === 'function') {
      try {
        // Load external font script if needed (Modern is bundled by default)
        if (_activeMathFont !== 'mathjax-modern') {
          const fontUrl = `${MATHJAX_FONT_CDN_BASE}${_activeMathFont}-font/chtml.js`;
          await loadScriptOnce(fontUrl).catch(() => {});
        }

        const newOutputJax = window.MathJax.startup.getOutputJax();
        if (newOutputJax) {
          window.MathJax.startup.output = newOutputJax;
          if (typeof window.MathJax.startup.getDocument === 'function') {
            window.MathJax.startup.document = window.MathJax.startup.getDocument();
          }
        }

        // Re-render math in preview if present
        const preview = document.getElementById('markdown-preview');
        if (preview && preview.querySelector('mjx-container, .math-block, .math-inline')) {
          if (typeof window.renderMarkdown === 'function') {
            window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
          } else if (typeof window.MathJax.typesetPromise === 'function') {
            await window.MathJax.typesetPromise([preview]);
          }
        }
      } catch (err) {
        console.warn('[VisualAdapters] MathJax font switch error:', err);
      }
    }
  }

  /**
   * Apply Mermaid theme and look drawing style.
   */
  async function applyMermaid(options) {
    if (options) {
      if (typeof options.theme !== 'undefined') _activeMermaidTheme = options.theme;
      if (typeof options.look !== 'undefined') _activeMermaidLook = options.look;
    }

    if (typeof mermaid === 'undefined') {
      return;
    }

    const effectiveTheme = resolveMermaidThemeName(_activeMermaidTheme);
    const effectiveLook = _activeMermaidLook === 'handDrawn' ? 'handDrawn' : 'classic';

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: effectiveTheme,
        look: effectiveLook,
        securityLevel: 'strict',
        flowchart: { useMaxWidth: true, htmlLabels: true },
        fontSize: 16,
        gantt: { useWidth: 1200 }
      });
    } catch (err) {
      console.warn('[VisualAdapters] Mermaid initialize error:', err);
    }

    // Re-render existing Mermaid nodes in the preview
    const preview = document.getElementById('markdown-preview');
    if (preview) {
      const mermaidNodes = preview.querySelectorAll('.mermaid');
      if (mermaidNodes.length > 0) {
        mermaidNodes.forEach((node) => {
          // Restore source code to avoid rendering already rendered SVG
          const originalCode = node.getAttribute('data-original-code');
          if (originalCode) {
            node.innerHTML = decodeURIComponent(originalCode)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          }
          node.removeAttribute('data-processed');

          const container = node.closest('.mermaid-container');
          if (container) {
            const oldToolbar = container.querySelector('.mermaid-toolbar');
            if (oldToolbar) oldToolbar.remove();
          }
        });

        if (typeof window.renderMarkdown === 'function') {
          window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
        }
      }
    }
  }

  /**
   * Resolves an emoji shortcode to include the active Fitzpatrick skin tone modifier
   * if the emoji supports skin tone modifiers, otherwise returns the original shortcode.
   * Shortcodes with explicit tone modifiers are left untouched.
   */
  function resolveEmojiShortcode(shortcode) {
    if (!_activeEmojiSkinTone || _activeEmojiSkinTone === 'default') {
      return shortcode;
    }

    // If already has an explicit skin tone suffix, preserve it
    if (/_tone[1-5]$/.test(shortcode)) {
      return shortcode;
    }

    // Check JoyPixels library list if available
    const toneCandidate = `${shortcode}_${_activeEmojiSkinTone}`;
    const joy = typeof joypixels !== 'undefined' ? joypixels : window.joypixels;
    if (joy && joy.emojiList) {
      if (joy.emojiList[`:${toneCandidate}:`]) {
        return toneCandidate;
      }
      return shortcode;
    }

    // If JoyPixels isn't loaded yet, candidate will be validated when loaded
    return toneCandidate;
  }

  /**
   * Apply JoyPixels emoji skin tone.
   */
  function applyEmojiSkinTone(tone) {
    _activeEmojiSkinTone = tone || DEFAULTS.emojiSkinTone;

    // Wrap joypixels.shortnameToUnicode if loaded
    const joy = typeof joypixels !== 'undefined' ? joypixels : window.joypixels;
    if (joy && typeof joy.shortnameToUnicode === 'function' && !joy._visualAdapterWrapped) {
      const origShortnameToUnicode = joy.shortnameToUnicode.bind(joy);
      joy.shortnameToUnicode = function (str) {
        if (_activeEmojiSkinTone && _activeEmojiSkinTone !== 'default') {
          str = str.replace(/:([\w+-]+):/g, function (match, code) {
            const resolved = resolveEmojiShortcode(code);
            return `:${resolved}:`;
          });
        }
        return origShortnameToUnicode(str);
      };
      joy._visualAdapterWrapped = true;
    }

    // Re-render preview so shortcodes reflect new tone
    const preview = document.getElementById('markdown-preview');
    if (preview && typeof window.renderMarkdown === 'function') {
      window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
    }
  }

  /**
   * React to application light/dark theme toggle.
   * Idempotently re-applies any setting configured as 'auto'.
   */
  function onAppThemeChange(newAppTheme) {
    if (_activeHljsTheme === 'auto') {
      applyHighlightTheme('auto');
    }
    if (_activeMermaidTheme === 'auto') {
      applyMermaid({ theme: 'auto', look: _activeMermaidLook });
    }
  }

  // Observe theme changes on documentElement
  const themeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        onAppThemeChange(getEffectiveAppTheme());
      }
    }
  });

  if (document.documentElement) {
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  /**
   * Apply all settings simultaneously.
   */
  async function applyAll(settings) {
    if (!settings) return;
    const tasks = [];
    if (typeof settings.hljsTheme !== 'undefined') {
      tasks.push(applyHighlightTheme(settings.hljsTheme));
    }
    if (typeof settings.mathFont !== 'undefined') {
      tasks.push(applyMathFont(settings.mathFont));
    }
    if (typeof settings.mermaidTheme !== 'undefined' || typeof settings.mermaidLook !== 'undefined') {
      tasks.push(applyMermaid({
        theme: settings.mermaidTheme !== undefined ? settings.mermaidTheme : _activeMermaidTheme,
        look: settings.mermaidLook !== undefined ? settings.mermaidLook : _activeMermaidLook
      }));
    }
    if (typeof settings.emojiSkinTone !== 'undefined') {
      tasks.push(applyEmojiSkinTone(settings.emojiSkinTone));
    }

    await Promise.all(tasks);

    if (typeof window.renderMarkdown === 'function') {
      window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
    }
  }

  // Public API exported to window.visualSettingsAdapters
  window.visualSettingsAdapters = {
    getOptions: () => JSON.parse(JSON.stringify(OPTIONS)),
    getDefaults: () => Object.assign({}, DEFAULTS),
    getCurrentSettings: () => ({
      hljsTheme: _activeHljsTheme,
      mathFont: _activeMathFont,
      mermaidTheme: _activeMermaidTheme,
      mermaidLook: _activeMermaidLook,
      emojiSkinTone: _activeEmojiSkinTone
    }),
    getCurrentMathFont: () => _activeMathFont,
    getMermaidConfig: (themeOverride) => ({
      theme: resolveMermaidThemeName(_activeMermaidTheme),
      look: _activeMermaidLook === 'handDrawn' ? 'handDrawn' : 'classic'
    }),
    resolveEmojiShortcode,
    applyHighlightTheme,
    applyMathFont,
    applyMermaid,
    applyEmojiSkinTone,
    applyAll,
    onAppThemeChange
  };

})();
