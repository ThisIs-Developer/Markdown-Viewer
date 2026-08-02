import { readFile, readdir } from 'node:fs/promises';

const CATALOG_DIR = new URL('./', import.meta.url);
const EXPECTED_LOCALES = ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'tw', 'uk', 'zh'];
const ALLOWED_IDENTICAL_TRANSLATIONS = {
  de: ['{{0}}m', '{{0}}m {{1}}s', '{{0}}s', 'Ab', 'Explorer', 'FAQ', 'h1, h2, h3, h4, h5, h6', 'HTML', 'JavaScript', 'Link', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'Name', 'PDF', 'PNG', 'SVG', 'ThisIs-Developer', 'Version', 'Wrap'],
  es: ['{{0}}m', '{{0}}m {{1}}s', '{{0}}s', 'Ab', 'Ctrl', 'h1, h2, h3, h4, h5, h6', 'HTML', 'JavaScript', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'PDF', 'PNG', 'SVG'],
  fr: ['{{0}}m', '{{0}}m {{1}}s', '{{0}}s', 'Ab', 'Actions', 'Ctrl', 'Description', 'Destination', 'Documents', 'FAQ', 'h1, h2, h3, h4, h5, h6', 'HTML', 'Image (.png)', 'JavaScript', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'Menu', 'Notifications', 'Participants', 'PDF', 'PNG', 'Session active', 'suggestion.', 'SVG', 'Version'],
  it: ['{{0}} file', '{{0}}m', '{{0}}m {{1}}s', '{{0}}s', '1 file', 'Ab', 'Backup', 'file', 'h1, h2, h3, h4, h5, h6', 'HTML', 'JavaScript', 'Markdown (.md)', 'Markdown file', 'Markdown Viewer', 'MD', 'PDF', 'PNG', 'SVG', 'ThisIs-Developer', 'Wireframe'],
  ja: ['Ctrl', 'GitHub URL', 'HTML', 'JavaScript', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'PDF', 'PNG', 'SVG'],
  ko: ['Ab', 'Ctrl', 'FAQ', 'GitHub URL', 'h1, h2, h3, h4, h5, h6', 'HTML', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'PDF', 'PNG', 'SVG'],
  pl: ['{{0}}m', '{{0}}m {{1}}s', 'Ab', 'Ctrl', 'h1, h2, h3, h4, h5, h6', 'HTML', 'JavaScript', 'Link', 'Markdown (.md)', 'Markdown alert', 'Markdown Viewer', 'Menu', 'PDF', 'PNG', 'SVG'],
  pt: ['{{0}}m', '{{0}}m {{1}}s', '{{0}}s', 'Ab', 'Backup', 'Ctrl', 'h1, h2, h3, h4, h5, h6', 'HTML', 'item', 'JavaScript', 'Link', 'Markdown (.md)', 'Markdown Viewer', 'PDF', 'PNG', 'SVG', 'ThisIs-Developer'],
  ru: ['Ctrl', 'h1, h2, h3, h4, h5, h6', 'HTML', 'JavaScript', 'Markdown (.md)', 'Markdown Viewer', 'PDF', 'PNG', 'SVG'],
  tr: ['{{0}}m {{1}}s', '{{0}}s', 'Ab', 'Ctrl', 'h1, h2, h3, h4, h5, h6', 'HTML', 'JavaScript', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'PDF', 'PNG', 'Shift', 'SVG'],
  tw: ['Ab', 'Ctrl', 'HTML', 'JavaScript', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'PDF', 'PNG', 'SVG'],
  uk: ['Ctrl', 'Git Graph', 'h1, h2, h3, h4, h5, h6', 'HTML', 'JavaScript', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'PDF', 'PNG', 'Shift', 'SVG', 'ThisIs-Developer'],
  zh: ['Ab', 'Ctrl', 'HTML', 'JavaScript', 'Markdown (.md)', 'Markdown Viewer', 'MD', 'PDF', 'PNG', 'SVG']
};

function placeholderSignature(value) {
  return Array.from(String(value).matchAll(/\{\{(\d+)\}\}/g), match => match[1]).sort().join(',');
}

function addFailures(failures, locale, category, values) {
  if (!values.length) return;
  failures.push({ locale, category, values });
}

const files = (await readdir(CATALOG_DIR))
  .filter(file => file.endsWith('.json'))
  .map(file => file.replace(/\.json$/, ''))
  .sort();
const failures = [];

addFailures(failures, 'all', 'catalog set', [
  ...EXPECTED_LOCALES.filter(locale => !files.includes(locale)).map(locale => `missing ${locale}.json`),
  ...files.filter(locale => !EXPECTED_LOCALES.includes(locale)).map(locale => `unexpected ${locale}.json`)
]);

const catalogs = Object.fromEntries(await Promise.all(files.map(async locale => [
  locale,
  JSON.parse(await readFile(new URL(`${locale}.json`, CATALOG_DIR), 'utf8'))
])));
const english = catalogs.en || {};
const englishKeys = Object.keys(english);
const englishKeySet = new Set(englishKeys);

addFailures(failures, 'en', 'source/value mismatch', englishKeys.filter(source => english[source] !== source));
addFailures(failures, 'en', 'non-English source pollution', englishKeys.filter(source =>
  /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Script=Cyrillic}|\p{Script=Arabic}/u.test(source)
));
addFailures(failures, 'en', 'non-interface source key', englishKeys.filter(source =>
  /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/i.test(source)
  || /^bi(?:\s+bi-[\w-]+)+$/i.test(source)
  || /(?:^|\s)(?:style|class|id|aria-[\w-]+|data-[\w-]+|role|tabindex)=/i.test(source)
));

for (const locale of files) {
  const catalog = catalogs[locale];
  const keys = Object.keys(catalog);
  const keySet = new Set(keys);
  addFailures(failures, locale, 'missing keys', englishKeys.filter(key => !keySet.has(key)));
  addFailures(failures, locale, 'extra keys', keys.filter(key => !englishKeySet.has(key)));
  addFailures(failures, locale, 'empty values', keys.filter(key => typeof catalog[key] !== 'string' || !catalog[key].trim()));
  addFailures(failures, locale, 'placeholder mismatch', keys.filter(key =>
    englishKeySet.has(key) && placeholderSignature(key) !== placeholderSignature(catalog[key])
  ));
  addFailures(failures, locale, 'generator/encoding marker or merged value', keys.filter(key =>
    /[\r\n]|MV\d+|__MVTERM_|\uFFFD/i.test(catalog[key])
  ));
  addFailures(failures, locale, 'protected GitHub/Markdown term', keys.filter(key =>
    (key.includes('GitHub') && !catalog[key].includes('GitHub'))
    || (key.includes('Markdown') && !catalog[key].includes('Markdown'))
  ));
  if (locale !== 'en') {
    const allowed = new Set(ALLOWED_IDENTICAL_TRANSLATIONS[locale] || []);
    addFailures(failures, locale, 'unexpected English fallback', keys.filter(key =>
      catalog[key] === key && !allowed.has(key)
    ));
  }
  console.log(`${locale}: ${keys.length} keys`);
}

if (failures.length) {
  failures.forEach(({ locale, category, values }) => {
    console.error(`\n${locale} — ${category} (${values.length})`);
    values.slice(0, 20).forEach(value => console.error(`  ${value}`));
    if (values.length > 20) console.error(`  …and ${values.length - 20} more`);
  });
  process.exitCode = 1;
} else {
  console.log(`\nTranslation audit passed: ${files.length} catalogs × ${englishKeys.length} keys.`);
}
