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

  // Mapping for highlight.js themes on cdnjs 11.9.0 (dracula & solarized live under base16/)
  const HLJS_THEME_PATHS = Object.freeze({
    'github': 'github.min.css',
    'github-dark': 'github-dark.min.css',
    'monokai': 'monokai.min.css',
    'dracula': 'base16/dracula.min.css',
    'atom-one-dark': 'atom-one-dark.min.css',
    'atom-one-light': 'atom-one-light.min.css',
    'solarized-dark': 'base16/solarized-dark.min.css',
    'solarized-light': 'base16/solarized-light.min.css',
    'vs': 'vs.min.css',
    'vs2015': 'vs2015.min.css',
    'nord': 'nord.min.css',
    'tokyo-night-dark': 'tokyo-night-dark.min.css',
    'tokyo-night-light': 'tokyo-night-light.min.css',
    'default': 'default.min.css'
  });

  // Fallback background and foreground colors for syntax themes
  const HLJS_THEME_COLORS = Object.freeze({
    'github': { bg: '#ffffff', color: '#24292e' },
    'github-dark': { bg: '#0d1117', color: '#c9d1d9' },
    'monokai': { bg: '#272822', color: '#dddddd' },
    'dracula': { bg: '#282a36', color: '#f8f8f2' },
    'atom-one-dark': { bg: '#282c34', color: '#abb2bf' },
    'atom-one-light': { bg: '#fafafa', color: '#383a42' },
    'solarized-dark': { bg: '#002b36', color: '#839496' },
    'solarized-light': { bg: '#fdf6e3', color: '#657b83' },
    'vs': { bg: '#ffffff', color: '#000000' },
    'vs2015': { bg: '#1e1e1e', color: '#dcdcdc' },
    'nord': { bg: '#2e3440', color: '#d8dee9' },
    'tokyo-night-dark': { bg: '#1a1b26', color: '#a9b1d6' },
    'tokyo-night-light': { bg: '#d5d6db', color: '#343b58' },
    'default': { bg: '#f3f3f3', color: '#444444' }
  });

  function getEffectiveAppTheme() {
    if (typeof document === 'undefined' || !document.documentElement) return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function resolveHljsThemeName(theme, themeOverride) {
    if (theme === 'auto') {
      const effective = themeOverride || getEffectiveAppTheme();
      return effective === 'dark' ? 'github-dark' : 'github';
    }
    return theme || 'github';
  }

  function resolveMermaidThemeName(theme, themeOverride) {
    if (theme === 'auto') {
      const effective = themeOverride || getEffectiveAppTheme();
      return effective === 'dark' ? 'dark' : 'default';
    }
    return theme || 'default';
  }

  // Update dynamic helper stylesheet so code blocks adopt the theme's background and contrast
  function updateHljsHelperStyle(effectiveName) {
    if (typeof document === 'undefined') return;
    let style = document.getElementById('mdv-hljs-style-helper');
    if (!style) {
      style = document.createElement('style');
      style.id = 'mdv-hljs-style-helper';
      if (document.head) document.head.appendChild(style);
    }

    const fallback = HLJS_THEME_COLORS[effectiveName] || HLJS_THEME_COLORS['github'];
    let bg = fallback.bg;
    let fg = fallback.color;

    if (document.body && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      try {
        const probe = document.createElement('div');
        probe.className = 'hljs';
        probe.style.position = 'fixed';
        probe.style.top = '-9999px';
        probe.style.left = '-9999px';
        probe.style.visibility = 'hidden';
        document.body.appendChild(probe);
        const cs = window.getComputedStyle(probe);
        if (cs && cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
          bg = cs.backgroundColor;
        }
        if (cs && cs.color && cs.color !== 'rgba(0, 0, 0, 0)' && cs.color !== 'transparent') {
          fg = cs.color;
        }
        document.body.removeChild(probe);
      } catch (_) {}
    }

    if (_activeHljsTheme === 'auto') {
      style.textContent = `
        /* Preview code blocks in Auto mode adopt application theme */
        .markdown-body:not(.pdf-export):not(.export-render-root) pre:has(> code.hljs) {
          background-color: ${bg} !important;
          color: ${fg} !important;
          border-radius: 6px;
          padding: 16px !important;
          overflow: auto;
        }
        .markdown-body:not(.pdf-export):not(.export-render-root) pre > code.hljs,
        .markdown-body:not(.pdf-export):not(.export-render-root) code.hljs {
          background-color: ${bg} !important;
          color: ${fg} !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }

        /* Export documents in Auto mode resolve against the selected export theme */
        .pdf-export.theme-dark pre:has(> code.hljs),
        .pdf-export[data-theme="dark"] pre:has(> code.hljs),
        .export-render-root[data-theme="dark"] pre:has(> code.hljs),
        .export-render-root.theme-dark pre:has(> code.hljs) {
          background-color: #161b22 !important;
          color: #c9d1d9 !important;
          border-radius: 6px;
          padding: 16px !important;
          overflow: auto;
        }
        .pdf-export.theme-dark pre > code.hljs,
        .pdf-export[data-theme="dark"] pre > code.hljs,
        .export-render-root[data-theme="dark"] pre > code.hljs,
        .export-render-root.theme-dark pre > code.hljs,
        .pdf-export.theme-dark code.hljs,
        .pdf-export[data-theme="dark"] code.hljs,
        .export-render-root[data-theme="dark"] code.hljs,
        .export-render-root.theme-dark code.hljs {
          background-color: #161b22 !important;
          color: #c9d1d9 !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }

        .pdf-export.theme-light pre:has(> code.hljs),
        .pdf-export[data-theme="light"] pre:has(> code.hljs),
        .export-render-root[data-theme="light"] pre:has(> code.hljs),
        .export-render-root.theme-light pre:has(> code.hljs) {
          background-color: #f6f8fa !important;
          color: #24292e !important;
          border-radius: 6px;
          padding: 16px !important;
          overflow: auto;
        }
        .pdf-export.theme-light pre > code.hljs,
        .pdf-export[data-theme="light"] pre > code.hljs,
        .export-render-root[data-theme="light"] pre > code.hljs,
        .export-render-root.theme-light pre > code.hljs,
        .pdf-export.theme-light code.hljs,
        .pdf-export[data-theme="light"] code.hljs,
        .export-render-root[data-theme="light"] code.hljs,
        .export-render-root.theme-light code.hljs {
          background-color: #f6f8fa !important;
          color: #24292e !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }

        @media print {
          .markdown-body:not(.pdf-export):not(.export-render-root) pre:has(> code.hljs),
          .markdown-body:not(.pdf-export):not(.export-render-root) pre > code.hljs,
          .markdown-body:not(.pdf-export):not(.export-render-root) code.hljs {
            background-color: ${bg} !important;
            color: ${fg} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html[data-browser-print-export="dark"] .markdown-body pre:has(> code.hljs),
          html[data-browser-print-export="dark"] .markdown-body pre > code.hljs,
          html[data-browser-print-export="dark"] .markdown-body code.hljs,
          .pdf-export.theme-dark pre:has(> code.hljs),
          .pdf-export.theme-dark pre > code.hljs,
          .pdf-export.theme-dark code.hljs {
            background-color: #161b22 !important;
            color: #c9d1d9 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html:not([data-browser-print-export="dark"]) .markdown-body.pdf-export.theme-light pre:has(> code.hljs),
          html:not([data-browser-print-export="dark"]) .markdown-body.pdf-export.theme-light pre > code.hljs,
          html:not([data-browser-print-export="dark"]) .markdown-body.pdf-export.theme-light code.hljs,
          html[data-browser-print-export="light"] .markdown-body pre:has(> code.hljs),
          html[data-browser-print-export="light"] .markdown-body pre > code.hljs,
          html[data-browser-print-export="light"] .markdown-body code.hljs,
          .pdf-export.theme-light pre:has(> code.hljs),
          .pdf-export.theme-light pre > code.hljs,
          .pdf-export.theme-light code.hljs {
            background-color: #f6f8fa !important;
            color: #24292e !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
    } else {
      style.textContent = `
        .markdown-body pre:has(> code.hljs) {
          background-color: ${bg} !important;
          color: ${fg} !important;
          border-radius: 6px;
          padding: 16px !important;
          overflow: auto;
        }
        .markdown-body pre > code.hljs,
        .markdown-body code.hljs {
          background-color: ${bg} !important;
          color: ${fg} !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        @media print {
          .markdown-body pre:has(> code.hljs),
          .markdown-body pre > code.hljs,
          .markdown-body code.hljs {
            background-color: ${bg} !important;
            color: ${fg} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
    }
  }

  /**
   * Apply highlight.js theme stylesheet.
   * Dynamically manages the <link id="mdv-hljs-theme-link"> in <head>.
   */
  function applyHighlightTheme(theme) {
    _activeHljsTheme = theme || DEFAULTS.hljsTheme;
    const effectiveName = resolveHljsThemeName(_activeHljsTheme);
    updateHljsHelperStyle(effectiveName);

    if (typeof document === 'undefined') return Promise.resolve();

    if (document.documentElement) {
      if (_activeHljsTheme !== 'auto') {
        document.documentElement.setAttribute('data-custom-syntax-theme', _activeHljsTheme);
        document.documentElement.setAttribute('data-hljs-theme', _activeHljsTheme);
      } else {
        if (typeof document.documentElement.removeAttribute === 'function') {
          document.documentElement.removeAttribute('data-custom-syntax-theme');
        }
        document.documentElement.setAttribute('data-hljs-theme', 'auto');
      }
    }

    const subpath = HLJS_THEME_PATHS[effectiveName] || `${effectiveName}.min.css`;
    const href = `${HLJS_CDN_BASE}${subpath}`;

    let link = document.getElementById('mdv-hljs-theme-link');
    if (!link) {
      link = document.createElement('link');
      link.id = 'mdv-hljs-theme-link';
      link.rel = 'stylesheet';
      link.crossOrigin = 'anonymous';
      if (document.head) document.head.appendChild(link);
    }

    if (link.getAttribute('href') === href) {
      updateHljsHelperStyle(effectiveName);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      link.onload = () => {
        updateHljsHelperStyle(effectiveName);
        resolve();
      };
      link.onerror = () => {
        console.warn(`[VisualAdapters] Failed to load highlight.js theme: ${href}`);
        updateHljsHelperStyle(effectiveName);
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
    if (typeof document === 'undefined') return Promise.resolve();
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
      if (document.head) document.head.appendChild(script);
      else if (document.body) document.body.appendChild(script);
    });
  }

  /**
   * Apply MathJax mathematical font.
   */
  async function applyMathFont(font) {
    _activeMathFont = font || DEFAULTS.mathFont;

    if (typeof window === 'undefined' || !window.MathJax) {
      return;
    }

    const isMathJax3 = (window.MathJax.version && String(window.MathJax.version).startsWith('3.')) ||
                       (window.MathJax._ && !window.MathJax._.output?.fonts);

    // Configure font and complete resource configuration in MathJax
    const fontPkgUrl = `${MATHJAX_FONT_CDN_BASE}${_activeMathFont}-font`;
    const fontWoffUrl = `${fontPkgUrl}/chtml/woff`;
    const fontDynamicPrefix = `[${_activeMathFont}]/chtml/dynamic`;

    window.MathJax.output = window.MathJax.output || {};
    window.MathJax.output.font = _activeMathFont;

    window.MathJax.config = window.MathJax.config || {};
    window.MathJax.config.output = window.MathJax.config.output || {};
    window.MathJax.config.output.font = _activeMathFont;

    window.MathJax.chtml = window.MathJax.chtml || {};
    window.MathJax.config.chtml = window.MathJax.config.chtml || {};
    if (typeof window.MathJax.chtml.font === 'string') {
      delete window.MathJax.chtml.font;
    }
    if (typeof window.MathJax.config.chtml.font === 'string') {
      delete window.MathJax.config.chtml.font;
    }

    if (!isMathJax3) {
      window.MathJax.chtml.fontURL = fontWoffUrl;
      window.MathJax.chtml.dynamicPrefix = fontDynamicPrefix;
      window.MathJax.config.chtml.fontURL = fontWoffUrl;
      window.MathJax.config.chtml.dynamicPrefix = fontDynamicPrefix;

      window.MathJax.loader = window.MathJax.loader || {};
      window.MathJax.loader.paths = window.MathJax.loader.paths || {};
      window.MathJax.loader.paths[_activeMathFont] = fontPkgUrl;

      window.MathJax.config.loader = window.MathJax.config.loader || {};
      window.MathJax.config.loader.paths = window.MathJax.config.loader.paths || {};
      window.MathJax.config.loader.paths[_activeMathFont] = fontPkgUrl;

      if (window.MathJax._ && window.MathJax._.components && window.MathJax._.components.loader && window.MathJax._.components.loader.CONFIG && window.MathJax._.components.loader.CONFIG.paths) {
        window.MathJax._.components.loader.CONFIG.paths[_activeMathFont] = fontPkgUrl;
      }
    }

    // Load external font script if needed and MathJax core is already loaded.
    // If MathJax has not loaded yet, configuring output.font and resource URLs
    // is sufficient because MathJax's startup loader will load the font component itself.
    if (_activeMathFont !== 'mathjax-modern' && window.MathJax._) {
      const fontUrl = `${MATHJAX_FONT_CDN_BASE}${_activeMathFont}-font/chtml.js`;
      try {
        await loadScriptOnce(fontUrl);
      } catch (err) {
        console.warn(`[VisualAdapters] MathJax font load failed (${_activeMathFont}), falling back to bundled Modern:`, err);
        _activeMathFont = 'mathjax-modern';
      }
    }

    // Extract registered font class and activate its fontData
    let fontClass = null;
    if (window.MathJax._ && window.MathJax._.output && window.MathJax._.output.fonts) {
      const fontPkg = window.MathJax._.output.fonts[_activeMathFont];
      if (fontPkg && fontPkg.chtml_ts) {
        fontClass = Object.values(fontPkg.chtml_ts)[0] || null;
      }
    }

    // If font class was not found (e.g. offline fallback), fall back to bundled modern font
    if (!fontClass && _activeMathFont !== 'mathjax-modern' && window.MathJax._ && window.MathJax._.output && window.MathJax._.output.fonts && window.MathJax._.output.fonts['mathjax-modern']) {
      _activeMathFont = 'mathjax-modern';
      const modernPkg = window.MathJax._.output.fonts['mathjax-modern'];
      if (modernPkg.chtml_ts) {
        fontClass = Object.values(modernPkg.chtml_ts)[0] || null;
      }
    }

    // Update MathJax configuration with effective font and complete resource configuration
    const effectivePkgUrl = `${MATHJAX_FONT_CDN_BASE}${_activeMathFont}-font`;
    const effectiveWoffUrl = `${effectivePkgUrl}/chtml/woff`;
    const effectiveDynamicPrefix = `[${_activeMathFont}]/chtml/dynamic`;

    window.MathJax.config.output.font = _activeMathFont;
    if (typeof window.MathJax.config.chtml.font === 'string') {
      delete window.MathJax.config.chtml.font;
    }
    if (typeof window.MathJax.chtml.font === 'string') {
      delete window.MathJax.chtml.font;
    }
    window.MathJax.config.chtml.fontURL = effectiveWoffUrl;
    window.MathJax.config.chtml.dynamicPrefix = effectiveDynamicPrefix;
    window.MathJax.chtml.fontURL = effectiveWoffUrl;
    window.MathJax.chtml.dynamicPrefix = effectiveDynamicPrefix;

    window.MathJax.config.loader = window.MathJax.config.loader || {};
    window.MathJax.config.loader.paths = window.MathJax.config.loader.paths || {};
    window.MathJax.config.loader.paths[_activeMathFont] = effectivePkgUrl;
    window.MathJax.loader = window.MathJax.loader || {};
    window.MathJax.loader.paths = window.MathJax.loader.paths || {};
    window.MathJax.loader.paths[_activeMathFont] = effectivePkgUrl;
    if (window.MathJax._ && window.MathJax._.components && window.MathJax._.components.loader && window.MathJax._.components.loader.CONFIG && window.MathJax._.components.loader.CONFIG.paths) {
      window.MathJax._.components.loader.CONFIG.paths[_activeMathFont] = effectivePkgUrl;
    }

    if (fontClass) {
      window.MathJax.config.chtml.fontData = fontClass;
      window.MathJax.chtml.fontData = fontClass;
    } else if (_activeMathFont === 'mathjax-modern' && window.MathJax._ && window.MathJax._.output && window.MathJax._.output.fonts && window.MathJax._.output.fonts['mathjax-modern']) {
      const modernPkg = window.MathJax._.output.fonts['mathjax-modern'];
      if (modernPkg.chtml_ts) {
        window.MathJax.config.chtml.fontData = Object.values(modernPkg.chtml_ts)[0] || null;
        window.MathJax.chtml.fontData = window.MathJax.config.chtml.fontData;
      }
    }

    // If MathJax startup has completed, switch output jax, document and re-typeset
    if (!isMathJax3 && window.MathJax.startup && typeof window.MathJax.startup.getOutputJax === 'function') {
      try {
        const newOutputJax = window.MathJax.startup.getOutputJax();
        if (newOutputJax) {
          if (newOutputJax.font && newOutputJax.font.options) {
            newOutputJax.font.options.fontURL = effectiveWoffUrl;
            newOutputJax.font.options.dynamicPrefix = effectiveDynamicPrefix;
          }
          window.MathJax.startup.output = newOutputJax;
          if (typeof window.MathJax.startup.getDocument === 'function') {
            window.MathJax.startup.document = window.MathJax.startup.getDocument();
          }
        }

        // Re-render math in preview if present
        if (typeof document !== 'undefined') {
          const preview = document.getElementById('markdown-preview');
          const splitPreview = document.getElementById('document-split-preview');
          const roots = [];
          if (preview && preview.querySelector('mjx-container, .math-block, .math-inline')) roots.push(preview);
          if (splitPreview && splitPreview.querySelector('mjx-container, .math-block, .math-inline')) roots.push(splitPreview);

          if (roots.length > 0) {
            if (typeof window.renderMarkdown === 'function') {
              window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
            } else if (typeof window.MathJax.typesetPromise === 'function') {
              await window.MathJax.typesetPromise(roots);
            }
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
    if (typeof document !== 'undefined') {
      const preview = document.getElementById('markdown-preview');
      if (preview) {
        const mermaidNodes = preview.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
          mermaidNodes.forEach((node) => {
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
    const joy = typeof joypixels !== 'undefined' ? joypixels : (typeof window !== 'undefined' ? window.joypixels : undefined);
    if (joy && joy.emojiList) {
      if (joy.emojiList[`:${toneCandidate}:`]) {
        return toneCandidate;
      }
      return shortcode;
    }

    return toneCandidate;
  }

  /**
   * Apply JoyPixels emoji skin tone.
   */
  function applyEmojiSkinTone(tone) {
    _activeEmojiSkinTone = tone || DEFAULTS.emojiSkinTone;

    const joy = typeof joypixels !== 'undefined' ? joypixels : (typeof window !== 'undefined' ? window.joypixels : undefined);
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

    if (typeof document !== 'undefined') {
      const preview = document.getElementById('markdown-preview');
      if (preview && typeof window.renderMarkdown === 'function') {
        window.renderMarkdown({ force: true, forceAdvancedPostProcess: true });
      }
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
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement) {
    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          onAppThemeChange(getEffectiveAppTheme());
        }
      }
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  /**
   * Check if setting change needs a markdown document re-render.
   */
  function needsRerender(key) {
    if (key === 'hljsTheme') return false;
    return true;
  }

  /**
   * Generic apply method for any setting key.
   */
  async function apply(key, value) {
    if (key === 'hljsTheme') {
      return applyHighlightTheme(value);
    } else if (key === 'mathFont') {
      return applyMathFont(value);
    } else if (key === 'mermaidTheme') {
      return applyMermaid({ theme: value, look: _activeMermaidLook });
    } else if (key === 'mermaidLook') {
      return applyMermaid({ theme: _activeMermaidTheme, look: value });
    } else if (key === 'emojiSkinTone') {
      return applyEmojiSkinTone(value);
    }
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
  }

  // Public API exported to window.visualSettingsAdapters
  const adapters = {
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
      theme: resolveMermaidThemeName(_activeMermaidTheme, themeOverride),
      look: _activeMermaidLook === 'handDrawn' ? 'handDrawn' : 'classic'
    }),
    getHljsTheme: (themeOverride) => resolveHljsThemeName(_activeHljsTheme, themeOverride),
    resolveHljsThemeName,
    needsRerender,
    apply,
    resolveEmojiShortcode,
    applyHighlightTheme,
    applyMathFont,
    applyMermaid,
    applyEmojiSkinTone,
    applyAll,
    onAppThemeChange
  };

  if (typeof window !== 'undefined') {
    window.visualSettingsAdapters = adapters;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = adapters;
  }

})();
