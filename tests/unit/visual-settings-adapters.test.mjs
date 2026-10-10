import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function createAdapterContext() {
  const domListeners = new Map();
  const createdElements = [];

  const documentElement = {
    getAttribute(name) {
      return this._attrs?.[name] || null;
    },
    setAttribute(name, val) {
      this._attrs = this._attrs || {};
      this._attrs[name] = val;
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

  // Mock joypixels emojiList
  context.joypixels = {
    emojiList: {
      ':wave:': {},
      ':wave_tone1:': {},
      ':wave_tone2:': {},
      ':wave_tone3:': {},
      ':wave_tone4:': {},
      ':wave_tone5:': {},
      ':thumbsup:': {},
      ':thumbsup_tone1:': {},
      ':smile:': {}
    }
  };

  // When default tone is active
  adapters.applyEmojiSkinTone('default');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave');
  assert.equal(adapters.resolveEmojiShortcode('smile'), 'smile');

  // When tone1 is active
  adapters.applyEmojiSkinTone('tone1');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave_tone1');
  assert.equal(adapters.resolveEmojiShortcode('thumbsup'), 'thumbsup_tone1');
  // Emoji that does NOT support tone is untouched
  assert.equal(adapters.resolveEmojiShortcode('smile'), 'smile');
  // Emoji with existing tone modifier is untouched
  assert.equal(adapters.resolveEmojiShortcode('wave_tone3'), 'wave_tone3');

  // When tone5 is active
  adapters.applyEmojiSkinTone('tone5');
  assert.equal(adapters.resolveEmojiShortcode('wave'), 'wave_tone5');
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

test('applyHighlightTheme manages stylesheet and auto theme', async () => {
  const { context, adapters } = createAdapterContext();

  context.document.documentElement.setAttribute('data-theme', 'light');
  await adapters.applyHighlightTheme('monokai');
  let link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link);
  assert.ok(link.href.includes('monokai.min.css'));

  await adapters.applyHighlightTheme('auto');
  link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link.href.includes('github.min.css'));

  context.document.documentElement.setAttribute('data-theme', 'dark');
  adapters.onAppThemeChange('dark');
  link = context.document.getElementById('mdv-hljs-theme-link');
  assert.ok(link.href.includes('github-dark.min.css'));
});
