import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('every native-drop dialog string and dynamic message has a catalog entry', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const dialog = html.slice(html.indexOf('id="desktop-drop-modal"'), html.indexOf('<!-- Shared Diagram Viewer Modal -->'));
  const sourceStrings = [...dialog.matchAll(/>([^<>]+)</g)].map(x => x[1].trim()).filter(x => x && !/^\s*$/.test(x));
  sourceStrings.push('Cancel dropped file import', 'Folder', 'Files and folders', 'Files',
    'Importing folder', 'Insert media', 'Drop to choose Vault Workspace or Linked Workspace.',
    'Linked files: {{0}}. Linked folders: {{1}}. Originals remain on disk.',
    'Files imported to Vault: {{0}}.', 'Could not add dropped items: {{0}}',
    'Too many dropped items. Drop at most 1,000 files or folders at a time.',
    'The dropped items could not be added. Please try again.', 'Move here', 'Cannot drop here',
    'Confirm linked file', 'Confirm the dropped Markdown file in the Windows dialog so Markdown Viewer can retain its real path.', 'Imported to Vault');
  const dir = new URL('../../assets/i18n/', import.meta.url);
  const helper = readFileSync(new URL('../../desktop-app/experimental/windows/WindowsIntegration.cs', import.meta.url), 'utf8');
  sourceStrings.push(...[...helper.matchAll(/T\("([^"]+)"\)/g)].map(match => match[1]));
  for (const file of readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const catalog = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    for (const key of sourceStrings) assert.ok(catalog[key], `${file}: missing ${key}`);
  }
});
