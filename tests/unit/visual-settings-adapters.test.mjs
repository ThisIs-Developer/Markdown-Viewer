import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function createAdapterContext() {
  const createdElements = [];

  const documentElement = {
    getAttribute(name) {
      return this._attrs?.[name] || null;
    },
    setAttribute(name, val) {
      this._attrs = this._attrs || {};
      this._attrs[name] = val;
    },
    removeAttribute(name) {
      if (this._attrs) delete this._attrs[name];
    }
  };

  const head = {
    appendChild(el) {
      createdElements.push(el);
      return el;
    }
  };

  const document = {
    documentElement,
    head,
    createElement(tag) {
      let _href = '';
      let _src = '';
      const el = {
        tagName: tag.toUpperCase(),
        id: '',
        rel: '',
        textContent: '',
        onload: null,
        onerror: null,
        get href() { return _href; },
        set href(val) {
          _href = val;
          setTimeout(() => { if (this.onload) this.onload(); }, 1);
        },
        get src() { return _src; },
        set src(val) {
          _src = val;
          setTimeout(() => { if (this.onload) this.onload(); }, 1);
        },
        setAttribute(k, v) { this[k] = v; },
        getAttribute(k) { return this[k] || null; },
        removeAttribute(k) { delete this[k]; }
      };
      return el;
    },
    getElementById(id) {
      return createdElements.find(e => e.id === id) || null;
    },
    querySelector(selector) {
      return null;
    },
    querySelectorAll(selector) {
      return [];
    }
  };

  class MockMutationObserver {
    constructor(cb) { this.cb = cb; }
    observe() {}
    disconnect() {}
  }

  const context = {
    window: {},
    document,
    MutationObserver: MockMutationObserver,
    console: { warn: () => {}, log: () => {} },
    setTimeout,
    clearTimeout
  };
  context.window = context;

  const code = fs.readFileSync(path.join(rootDir, 'visual-settings-adapters.js'), 'utf8');
  vm.runInNewContext(code, context);

  return { context, adapters: context.window.visualSettingsAdapters };
}

test('getOptions() returns valid metadata for all visual settings', () => {
  const { adapters } = createAdapterContext();
  const options = adapters.getOptions();

  assert.ok(options.hljsTheme && Array.isArray(options.hljsTheme));
  assert.ok(options.mathFont && Array.isArray(options.mathFont));
  assert.ok(options.mermaidTheme && Array.isArray(options.mermaidTheme));
  assert.ok(options.mermaidLook && Array.isArray(options.mermaidLook));
  assert.ok(options.emojiSkinTone && Array.isArray(options.emojiSkinTone));

  // Check required values exist
  const hljsValues = options.hljsTheme.map(o => o.value);
  assert.ok(hljsValues.includes('auto'));
  assert.ok(hljsValues.includes('github'));
  assert.ok(hljsValues.includes('monokai'));
  assert.ok(hljsValues.includes('dracula'));

  const mathValues = options.mathFont.map(o => o.value);
  assert.ok(mathValues.includes('mathjax-modern'));
  assert.ok(mathValues.includes('mathjax-stix2'));

  const mermaidThemes = options.mermaidTheme.map(o => o.value);
  assert.ok(mermaidThemes.includes('auto'));
  assert.ok(mermaidThemes.includes('forest'));
  assert.ok(mermaidThemes.includes('dark'));

  const mermaidLooks = options.mermaidLook.map(o => o.value);
  assert.ok(mermaidLooks.includes('classic'));
  assert.ok(mermaidLooks.includes('handDrawn'));

  const tones = options.emojiSkinTone.map(o => o.value);
  assert.ok(tones.includes('default'));
  assert.ok(tones.includes('tone1'));
  assert.ok(tones.includes('tone5'));
});

test('getDefaults() returns standard default visual settings', () => {
  const { adapters } = createAdapterContext();
  const defaults = JSON.parse(JSON.stringify(adapters.getDefaults()));

  assert.deepEqual(defaults, {
    hljsTheme: 'auto',
    mathFont: 'mathjax-modern',
    mermaidTheme: 'auto',
    mermaidLook: 'classic',
    emojiSkinTone: 'default'
  });
});

test('resolveEmojiShortcode handles skin tones accurately', () => {
  const { context, adapters } = createAdapterContext();

  // Mock joypixels emojiList and altShortNames
  context.joypixels = {
    emojiList: {
      ':wave:': {},
      ':wave_tone1:': {},
      ':wave_tone2:': {},
      ':wave_tone3:': {},
      ':wave_tone4:': {},
      ':wave_tone5:': {},
      ':thumbsup:': { shortnames: [':+1:', ':thumbup:'] },
      ':thumbsup_tone1:': { shortnames: [':+1_tone1:'] },
      ':thumbsup_tone5:': { shortnames: [':+1_tone5:'] },
      ':person_running:': { shortnames: [':runner:'] },
      ':person_running_tone1:': { shortnames: [':runner_tone1:'] },
      ':person_running_tone5:': { shortnames: [':runner_tone5:'] },
      ':smile:': {}
    },
    altShortNames: {
      ':+1:': ':thumbsup:',
      ':+1_tone1:': ':thumbsup_tone1:',
      ':runner:': ':person_running:',
      ':runner_tone1:': ':person_running_tone1:'
    }
  };

  // When default tone is active
  adapters.applyEmojiSkinTone('default');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave');
  assert.equal(adapters.resolveEmojiShortcode('thumbsup'), 'thumbsup');
  assert.equal(adapters.resolveEmojiShortcode('+1'), '+1');
  assert.equal(adapters.resolveEmojiShortcode('runner'), 'runner');
  assert.equal(adapters.resolveEmojiShortcode('smile'), 'smile');

  // When tone1 is active
  adapters.applyEmojiSkinTone('tone1');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave_tone1');
  assert.equal(adapters.resolveEmojiShortcode('thumbsup'), 'thumbsup_tone1');
  // Aliases canonicalize to JoyPixels canonical keys with tone
  assert.equal(adapters.resolveEmojiShortcode('+1'), 'thumbsup_tone1');
  assert.equal(adapters.resolveEmojiShortcode('runner'), 'person_running_tone1');
  // Emoji that does NOT support tone is untouched
  assert.equal(adapters.resolveEmojiShortcode('smile'), 'smile');
  // Emoji with existing tone modifier is untouched
  assert.equal(adapters.resolveEmojiShortcode('wave_tone3'), 'wave_tone3');
  assert.equal(adapters.resolveEmojiShortcode('+1_tone3'), '+1_tone3');
  assert.equal(adapters.resolveEmojiShortcode('runner_tone2'), 'runner_tone2');

  // When tone5 is active
  adapters.applyEmojiSkinTone('tone5');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave_tone5');
  assert.equal(adapters.resolveEmojiShortcode('thumbsup'), 'thumbsup_tone5');
  assert.equal(adapters.resolveEmojiShortcode('+1'), 'thumbsup_tone5');
  assert.equal(adapters.resolveEmojiShortcode('runner'), 'person_running_tone5');
  assert.equal(adapters.resolveEmojiShortcode('smile'), 'smile');
});

test('applyMermaid handles auto theme and look style', async () => {
  const { context, adapters } = createAdapterContext();

  context.document.documentElement.setAttribute('data-theme', 'dark');
  await adapters.applyMermaid({ theme: 'auto', look: 'handDrawn' });

  let config = adapters.getMermaidConfig();
  assert.equal(config.theme, 'dark');
  assert.equal(config.look, 'handDrawn');

  context.document.documentElement.setAttribute('data-theme', 'light');
  adapters.onAppThemeChange('light');
  config = adapters.getMermaidConfig();
  assert.equal(config.theme, 'default');
  assert.equal(config.look, 'handDrawn');

  // Explicit theme overrides auto
  await adapters.applyMermaid({ theme: 'forest', look: 'classic' });
  config = adapters.getMermaidConfig();
  assert.equal(config.theme, 'forest');
  assert.equal(config.look, 'classic');
});

test('applyHighlightTheme manages stylesheet, auto theme, and export styling', async () => {
  const { context, adapters } = createAdapterContext();

  context.document.documentElement.setAttribute('data-theme', 'light');
  await adapters.applyHighlightTheme('monokai');
  let link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link);
  assert.ok(link.href.includes('monokai.min.css'));
  assert.equal(context.document.documentElement.getAttribute('data-custom-syntax-theme'), 'monokai');
  assert.equal(context.document.documentElement.getAttribute('data-hljs-theme'), 'monokai');

  // Test getHljsTheme and resolveHljsThemeName
  assert.equal(adapters.resolveHljsThemeName('monokai'), 'monokai');
  assert.equal(adapters.resolveHljsThemeName('auto', 'dark'), 'github-dark');
  assert.equal(adapters.resolveHljsThemeName('auto', 'light'), 'github');
  assert.equal(adapters.getHljsTheme(), 'monokai');

  await adapters.applyHighlightTheme('auto');
  link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link.href.includes('github.min.css'));
  assert.equal(adapters.getHljsTheme(), 'github');
  assert.equal(adapters.getHljsTheme('dark'), 'github-dark');
  assert.equal(context.document.documentElement.getAttribute('data-custom-syntax-theme'), null);
  assert.equal(context.document.documentElement.getAttribute('data-hljs-theme'), 'auto');

  // Verify mdv-hljs-style-helper content scopes preview and provides export rules
  const helper = context.document.getElementById('mdv-hljs-style-helper');
  assert.ok(helper);
  assert.ok(helper.textContent.includes('.markdown-body:not(.pdf-export):not(.export-render-root)'));
  assert.ok(helper.textContent.includes('.pdf-export.theme-dark'));
  assert.ok(helper.textContent.includes('.pdf-export.theme-light'));
  assert.ok(helper.textContent.includes('data-browser-print-export="dark"'));

  context.document.documentElement.setAttribute('data-theme', 'dark');
  adapters.onAppThemeChange('dark');
  link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link.href.includes('github-dark.min.css'));
  assert.equal(adapters.getHljsTheme(), 'github-dark');
  assert.equal(adapters.getHljsTheme('light'), 'github');
});

test('applyMathFont maintains MathJax 3 and 4 configuration compatibility without chtml.font string', async () => {
  const { context, adapters } = createAdapterContext();

  // Test when MathJax is not yet loaded
  context.window.MathJax = {};
  await adapters.applyMathFont('mathjax-stix2');

  assert.equal(context.window.MathJax.config.output.font, 'mathjax-stix2');
  assert.equal(typeof context.window.MathJax.config.chtml.font, 'undefined');

  // Test when MathJax 3 is present (has version 3.x and no modular fonts)
  context.window.MathJax = {
    version: '3.2.2',
    config: {
      output: {},
      chtml: {}
    },
    startup: {
      getOutputJax: () => ({ name: 'chtml' })
    }
  };

  await adapters.applyMathFont('mathjax-modern');
  assert.equal(typeof context.window.MathJax.config.chtml.font, 'undefined');
  assert.equal(context.window.MathJax.config.output.font, 'mathjax-modern');
});

test('applyMathFont initializes complete font resource configuration in MathJax 4', async () => {
  const { context, adapters } = createAdapterContext();

  const mockOutputJax = {
    font: {
      name: 'mathjax-modern',
      options: {
        fontURL: 'https://cdn.jsdelivr.net/npm/mathjax-modern-font/chtml/woff',
        dynamicPrefix: '[mathjax-modern]/chtml/dynamic'
      }
    }
  };

  context.window.MathJax = {
    version: '4.0.0-beta.7',
    config: {},
    loader: { paths: {} },
    _: {
      components: {
        loader: {
          CONFIG: {
            paths: {
              mathjax: 'https://cdn.jsdelivr.net/npm/mathjax@4.0.0-beta.7'
            }
          }
        }
      },
      output: {
        fonts: {
          'mathjax-stix2': {
            chtml_ts: {
              MathJaxStix2Font: class MockStixFont {}
            }
          }
        }
      }
    },
    startup: {
      getOutputJax: () => mockOutputJax,
      getDocument: () => ({})
    }
  };

  await adapters.applyMathFont('mathjax-stix2');

  const mj = context.window.MathJax;
  assert.equal(mj.config.chtml.fontURL, 'https://cdn.jsdelivr.net/npm/mathjax-stix2-font/chtml/woff');
  assert.equal(mj.config.chtml.dynamicPrefix, '[mathjax-stix2]/chtml/dynamic');
  assert.equal(mj.config.loader.paths['mathjax-stix2'], 'https://cdn.jsdelivr.net/npm/mathjax-stix2-font');
  assert.equal(mj.loader.paths['mathjax-stix2'], 'https://cdn.jsdelivr.net/npm/mathjax-stix2-font');
  assert.equal(mj._.components.loader.CONFIG.paths['mathjax-stix2'], 'https://cdn.jsdelivr.net/npm/mathjax-stix2-font');
  assert.equal(mockOutputJax.font.options.fontURL, 'https://cdn.jsdelivr.net/npm/mathjax-stix2-font/chtml/woff');
  assert.equal(mockOutputJax.font.options.dynamicPrefix, '[mathjax-stix2]/chtml/dynamic');
});

test('applyMathFont loads Modern font resources when resetting after alternate-font boot', async () => {
  const { context, adapters } = createAdapterContext();

  const mockOutputJax = {
    font: {
      name: 'mathjax-stix2',
      options: {
        fontURL: 'https://cdn.jsdelivr.net/npm/mathjax-stix2-font/chtml/woff',
        dynamicPrefix: '[mathjax-stix2]/chtml/dynamic'
      }
    }
  };

  context.window.MathJax = {
    version: '4.0.0-beta.7',
    config: {},
    loader: { paths: {} },
    _: {
      components: {
        loader: {
          CONFIG: {
            paths: {
              mathjax: 'https://cdn.jsdelivr.net/npm/mathjax@4.0.0-beta.7'
            }
          }
        }
      },
      output: {
        fonts: {
          'mathjax-stix2': {
            chtml_ts: {
              MathJaxStix2Font: class MockStixFont {}
            }
          }
        }
      }
    },
    startup: {
      getOutputJax: () => mockOutputJax,
      getDocument: () => ({})
    }
  };

  const origCreateElement = context.document.createElement.bind(context.document);
  context.document.createElement = function(tag) {
    const el = origCreateElement(tag);
    if (tag.toLowerCase() === 'script') {
      let _src = '';
      Object.defineProperty(el, 'src', {
        get() { return _src; },
        set(val) {
          _src = val;
          if (val.includes('mathjax-modern-font')) {
            context.window.MathJax._.output.fonts['mathjax-modern'] = {
              chtml_ts: {
                MathJaxModernFont: class MockModernFont {}
              }
            };
          }
          setTimeout(() => { if (this.onload) this.onload(); }, 1);
        }
      });
    }
    return el;
  };

  await adapters.applyMathFont('mathjax-modern');

  const mj = context.window.MathJax;
  assert.equal(mj.config.output.font, 'mathjax-modern');
  assert.equal(mj.config.chtml.fontURL, 'https://cdn.jsdelivr.net/npm/mathjax-modern-font/chtml/woff');
  assert.equal(mj.config.chtml.dynamicPrefix, '[mathjax-modern]/chtml/dynamic');
  assert.equal(mj.config.loader.paths['mathjax-modern'], 'https://cdn.jsdelivr.net/npm/mathjax-modern-font');
  assert.equal(mockOutputJax.font.options.fontURL, 'https://cdn.jsdelivr.net/npm/mathjax-modern-font/chtml/woff');
  assert.equal(mockOutputJax.font.options.dynamicPrefix, '[mathjax-modern]/chtml/dynamic');
  assert.ok(mj._.output.fonts['mathjax-modern']);
});

