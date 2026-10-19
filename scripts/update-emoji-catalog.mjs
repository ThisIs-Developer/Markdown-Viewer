// Run explicitly when refreshing picker metadata; normal builds use the checked-in file.
import { mkdir, writeFile } from 'node:fs/promises';

const revision = 'ee6e06c648e85d601756b573d356327d4e51031d';
const source = `https://raw.githubusercontent.com/github/gemoji/${revision}`;
const directory = new URL('../assets/emoji/', import.meta.url);
const categories = {
  'Smileys & Emotion': 'smileys',
  'People & Body': 'people',
  'Animals & Nature': 'nature',
  'Food & Drink': 'food',
  'Travel & Places': 'travel',
  Activities: 'activities',
  Objects: 'objects',
  Symbols: 'symbols',
  Flags: 'flags'
};

async function download(path) {
  const response = await fetch(`${source}/${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}

const [data, license] = await Promise.all([download('db/emoji.json'), download('LICENSE')]);
const entries = JSON.parse(data).map(({ emoji, description, category, aliases, tags }) => {
  if (!categories[category]) throw new Error(`Unknown emoji category: ${category}`);
  return { emoji, description, category: categories[category], aliases, tags };
});
await mkdir(directory, { recursive: true });
await writeFile(new URL('catalog.json', directory), '[\n' + entries.map(entry => '  ' + JSON.stringify(entry)).join(',\n') + '\n]\n');
await writeFile(new URL('LICENSE', directory), license);
console.log(`Updated ${entries.length} emoji records from github/gemoji@${revision}.`);
