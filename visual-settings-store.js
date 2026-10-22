(function () {
  'use strict';

  const STORAGE_KEY = 'mdv.visualSettings.v1';

  const DEFAULT_SETTINGS = Object.freeze({
    hljsTheme: 'auto',
    mathFont: 'mathjax-modern',
    mermaidTheme: 'auto',
    mermaidLook: 'classic',
    emojiSkinTone: 'default'
  });

  const DEFAULT_OPTIONS = Object.freeze({
    hljsTheme: Object.freeze([
      'auto', 'github', 'github-dark', 'monokai', 'dracula',
      'atom-one-dark', 'atom-one-light', 'solarized-dark', 'solarized-light',
      'vs', 'vs2015', 'nord', 'tokyo-night-dark', 'tokyo-night-light', 'default'
    ]),
    mathFont: Object.freeze([
      'mathjax-modern', 'mathjax-tex', 'mathjax-stix2', 'mathjax-asana',
      'mathjax-bonum', 'mathjax-dejavu', 'mathjax-fira', 'mathjax-pagella',
      'mathjax-schola', 'mathjax-termes'
    ]),
    mermaidTheme: Object.freeze([
      'auto', 'default', 'neutral', 'dark', 'forest', 'base'
    ]),
    mermaidLook: Object.freeze([
      'classic', 'handDrawn'
    ]),
    emojiSkinTone: Object.freeze([
      'default', 'tone1', 'tone2', 'tone3', 'tone4', 'tone5'
    ])
  });

  function getEffectiveDefaults() {
    if (typeof window !== 'undefined' && window.visualSettingsAdapters && typeof window.visualSettingsAdapters.getDefaults === 'function') {
      try {
        const defs = window.visualSettingsAdapters.getDefaults();
        if (defs && typeof defs === 'object') {
          return Object.assign({}, DEFAULT_SETTINGS, defs);
        }
      } catch (e) {
        console.warn('Error reading defaults from visualSettingsAdapters:', e);
      }
    }
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function getAllowedValues(key) {
    if (typeof window !== 'undefined' && window.visualSettingsAdapters && typeof window.visualSettingsAdapters.getOptions === 'function') {
      try {
        const opts = window.visualSettingsAdapters.getOptions();
        if (opts && Array.isArray(opts[key])) {
          return opts[key].map(item => (typeof item === 'object' && item !== null ? item.value : item));
        }
      } catch (e) {
        console.warn('Error reading options from visualSettingsAdapters:', e);
      }
    }
    return DEFAULT_OPTIONS[key] || [];
  }

  function validateSettings(settings) {
    const defaults = getEffectiveDefaults();
    const valid = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const allowed = getAllowedValues(key);
      const val = settings && settings[key];
      if (typeof val === 'string' && allowed.includes(val)) {
        valid[key] = val;
      } else {
        valid[key] = defaults[key];
      }
    }
    return valid;
  }

  function loadFromStorage() {
    const defaults = getEffectiveDefaults();
    try {
      if (typeof localStorage === 'undefined') return defaults;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return validateSettings(parsed);
    } catch (e) {
      console.warn('Failed to parse visual settings from localStorage:', e);
      return defaults;
    }
  }

  function saveToStorage(settings) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      }
    } catch (e) {
      console.warn('Failed to save visual settings to localStorage:', e);
    }
  }

  let currentSettings = loadFromStorage();
  const listeners = new Set();

  function notify(changedKey, changedValue) {
    const settingsSnapshot = getSettings();
    listeners.forEach(cb => {
      try {
        cb(settingsSnapshot, changedKey, changedValue);
      } catch (e) {
        console.error('Error in visual settings change listener:', e);
      }
    });
  }

  function getSettings() {
    return Object.assign({}, currentSettings);
  }

  function updateSetting(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
      console.warn('Unknown visual setting key:', key);
      return false;
    }
    const allowed = getAllowedValues(key);
    if (!allowed.includes(value)) {
      console.warn(`Invalid value "${value}" for visual setting "${key}"`);
      return false;
    }
    if (currentSettings[key] === value) {
      return true;
    }
    currentSettings[key] = value;
    saveToStorage(currentSettings);
    notify(key, value);
    return true;
  }

  function resetSettings() {
    const defaults = getEffectiveDefaults();
    currentSettings = Object.assign({}, defaults);
    saveToStorage(currentSettings);
    notify('*', null);
    return getSettings();
  }

  function onSettingsChange(cb) {
    if (typeof cb === 'function') {
      listeners.add(cb);
    }
    return function unsubscribe() {
      listeners.delete(cb);
    };
  }

  // Refresh settings when adapters become available or options change
  function refreshValidation() {
    currentSettings = validateSettings(currentSettings);
    saveToStorage(currentSettings);
  }

  const store = {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    DEFAULT_OPTIONS,
    getSettings,
    updateSetting,
    resetSettings,
    onSettingsChange,
    validateSettings,
    getAllowedValues,
    refreshValidation
  };

  if (typeof window !== 'undefined') {
    window.visualSettingsStore = store;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = store;
  }
})();
