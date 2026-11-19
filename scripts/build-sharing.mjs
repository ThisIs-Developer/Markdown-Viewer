import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

// Copy exact locked package bytes, and verify every core script's SRI hash.
const vendor = [
  ['marked/marked.min.js', 'marked.min.js'],
  ['@highlightjs/cdn-assets/highlight.min.js', 'highlight.min.js'],
  ['@highlightjs/cdn-assets/languages/powershell.min.js', 'powershell.min.js'],
  ['dompurify/dist/purify.min.js', 'purify.min.js'],
  ['file-saver/dist/FileSaver.min.js', 'FileSaver.min.js'],
  ['js-yaml/dist/js-yaml.min.js', 'js-yaml.min.js'],
  ['bootstrap/dist/js/bootstrap.bundle.min.js', 'bootstrap.bundle.min.js'],
  ['bootstrap/dist/css/bootstrap.min.css', 'bootstrap.min.css'],
  ['github-markdown-css/github-markdown.css', 'github-markdown.css']
];
mkdirSync('assets/vendor', { recursive: true });
for (const name of ['github', 'github-dark', 'monokai', 'base16/dracula', 'atom-one-dark', 'atom-one-light',
  'base16/solarized-dark', 'base16/solarized-light', 'vs', 'vs2015', 'nord', 'tokyo-night-dark', 'tokyo-night-light', 'default']) {
  const destination = 'assets/vendor/highlight-styles/' + name + '.min.css';
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync('node_modules/@highlightjs/cdn-assets/styles/' + name + '.min.css', destination);
}
const html = readFileSync('index.html', 'utf8');
for (const [source, name] of vendor) {
  const bytes = readFileSync('node_modules/' + source);
  const tag = html.split('\n').find(line => line.includes('"assets/vendor/' + name + '"'));
  const integrity = tag?.match(/integrity="(sha384-[^"]+)"/)?.[1];
  if (integrity !== 'sha384-' + createHash('sha384').update(bytes).digest('base64')) throw new Error('Core dependency integrity mismatch: ' + name);
  copyFileSync('node_modules/' + source, 'assets/vendor/' + name);
}
writeFileSync('assets/vendor/LICENSES.txt', [
  'marked/LICENSE.md', '@highlightjs/cdn-assets/LICENSE', 'dompurify/LICENSE', 'file-saver/LICENSE.md',
  'js-yaml/LICENSE', 'bootstrap/LICENSE', 'github-markdown-css/license'
].map(name => name + '\n' + readFileSync('node_modules/' + name, 'utf8')).join('\n\n'));

await build({ entryPoints: ['yjs'], bundle: true, format: 'esm', platform: 'browser',
  outfile: 'assets/yjs.mjs', minify: true, legalComments: 'inline' });
writeFileSync('assets/yjs.LICENSE.txt', 'Yjs\n' + readFileSync('node_modules/yjs/LICENSE', 'utf8') +
  '\nlib0\n' + readFileSync('node_modules/lib0/LICENSE', 'utf8'));
