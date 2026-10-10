import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage and window in Node environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};
global.window = {};

// Import store
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const store = require('../../visual-settings-store.js');

test('visualSettingsStore - returns initial defaults', () => {
  mockStorage.clear();
  store.resetSettings();
  const settings = store.getSettings();
  assert.equal(settings.hljsTheme, 'auto');
  assert.equal(settings.mathFont, 'mathjax-modern');
  assert.equal(settings.mermaidTheme, 'auto');
  assert.equal(settings.mermaidLook, 'classic');
  assert.equal(settings.emojiSkinTone, 'default');
});

test('visualSettingsStore - updateSetting updates value, persists, and notifies listeners', () => {
  mockStorage.clear();
  store.resetSettings();

  let changeNotified = false;
  let notifiedKey = null;
  let notifiedVal = null;
  let notifiedSettings = null;

  const unsubscribe = store.onSettingsChange((settings, key, val) => {
    changeNotified = true;
    notifiedKey = key;
    notifiedVal = val;
    notifiedSettings = settings;
  });

  const success = store.updateSetting('hljsTheme', 'monokai');
  assert.equal(success, true);
  assert.equal(store.getSettings().hljsTheme, 'monokai');
  assert.equal(changeNotified, true);
  assert.equal(notifiedKey, 'hljsTheme');
  assert.equal(notifiedVal, 'monokai');
  assert.equal(notifiedSettings.hljsTheme, 'monokai');

  // Verify saved in localStorage
  const saved = JSON.parse(mockStorage.get(store.STORAGE_KEY));
  assert.equal(saved.hljsTheme, 'monokai');

  unsubscribe();
});

test('visualSettingsStore - rejects invalid values or unknown keys', () => {
  store.resetSettings();

  // Invalid value
  const badValSuccess = store.updateSetting('mermaidTheme', 'nonexistent-theme');
  assert.equal(badValSuccess, false);
  assert.equal(store.getSettings().mermaidTheme, 'auto');

  // Unknown key
  const badKeySuccess = store.updateSetting('unknownKey', 'something');
  assert.equal(badKeySuccess, false);
});

test('visualSettingsStore - resetSettings restores defaults and saves', () => {
  store.updateSetting('mermaidLook', 'handDrawn');
  store.updateSetting('emojiSkinTone', 'tone3');
  assert.equal(store.getSettings().mermaidLook, 'handDrawn');
  assert.equal(store.getSettings().emojiSkinTone, 'tone3');

  let resetNotified = false;
  const unsub = store.onSettingsChange((settings, key) => {
    if (key === '*') resetNotified = true;
  });

  const resetResult = store.resetSettings();
  assert.equal(resetResult.mermaidLook, 'classic');
  assert.equal(resetResult.emojiSkinTone, 'default');
  assert.equal(resetNotified, true);

  const saved = JSON.parse(mockStorage.get(store.STORAGE_KEY));
  assert.equal(saved.mermaidLook, 'classic');
  assert.equal(saved.emojiSkinTone, 'default');

  unsub();
});

test('visualSettingsStore - validation recovers from corrupted or invalid localStorage data', () => {
  mockStorage.set(store.STORAGE_KEY, JSON.stringify({
    hljsTheme: 'invalid-hljs',
    mathFont: 'mathjax-stix2',
    mermaidTheme: 'invalid-mermaid',
    corruptKey: 123
  }));

  // Re-run validation
  const validated = store.validateSettings(JSON.parse(mockStorage.get(store.STORAGE_KEY)));
  assert.equal(validated.hljsTheme, 'auto'); // Fell back to default
  assert.equal(validated.mathFont, 'mathjax-stix2'); // Kept valid value
  assert.equal(validated.mermaidTheme, 'auto'); // Fell back to default
  assert.equal(validated.mermaidLook, 'classic'); // Restored missing key
  assert.equal(validated.emojiSkinTone, 'default'); // Restored missing key
});
