import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const requiredFiles = [
  'index.html',
  'workspace-storage.js',
  'script.js',
  'preview-worker.js',
  'styles.css',
  'sw.js',
  'manifest.json',
  'vercel.json',
  'desktop-app/resources/index.html',
  'functions/api/share/[[id]].js',
  'workers/live-room-worker.js'
];

for (const relativePath of requiredFiles) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required project file: ${relativePath}`);
  }
}

const syntaxCheckedFiles = [
  'script.js',
  'workspace-storage.js',
  'preview-worker.js',
  'sw.js',
  'desktop-app/resources/js/main.js',
  'desktop-app/resources/js/script.js',
  'desktop-app/resources/js/workspace-storage.js',
  'desktop-app/resources/js/preview-worker.js',
  'assets/i18n/generate-ui-locales.mjs',
  'assets/i18n/audit-ui-locales.mjs'
];

for (const relativePath of syntaxCheckedFiles) {
  execFileSync(process.execPath, ['--check', path.join(rootDir, relativePath)], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
}

for (const [sourcePath, desktopPath] of [
  ['script.js', 'desktop-app/resources/js/script.js'],
  ['workspace-storage.js', 'desktop-app/resources/js/workspace-storage.js'],
  ['preview-worker.js', 'desktop-app/resources/js/preview-worker.js'],
  ['styles.css', 'desktop-app/resources/styles.css']
]) {
  const source = fs.readFileSync(path.join(rootDir, sourcePath));
  const desktopCopy = fs.readFileSync(path.join(rootDir, desktopPath));
  if (!source.equals(desktopCopy)) {
    throw new Error(`Desktop resource is stale: ${desktopPath}. Run node desktop-app/prepare.js.`);
  }
}

for (const relativePath of ['manifest.json', 'vercel.json', ...fs.readdirSync(path.join(rootDir, 'assets', 'i18n'))
  .filter(name => name.endsWith('.json'))
  .map(name => path.join('assets', 'i18n', name))]) {
  JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');
const storageJs = fs.readFileSync(path.join(rootDir, 'workspace-storage.js'), 'utf8');

const requiredIndexMarkers = [
  'id="markdown-editor"',
  'id="markdown-preview"',
  'id="tab-list"',
  'id="share-modal"',
  'id="live-share-modal"',
  'src="script.js"',
  'src="workspace-storage.js"',
  'href="styles.css"'
];

for (const marker of requiredIndexMarkers) {
  if (!indexHtml.includes(marker)) {
    throw new Error(`index.html is missing expected marker: ${marker}`);
  }
}

const seenIds = new Set();
for (const match of indexHtml.matchAll(/\bid="([^"]+)"/g)) {
  if (seenIds.has(match[1])) throw new Error(`index.html contains duplicate id: ${match[1]}`);
  seenIds.add(match[1]);
}

for (const match of indexHtml.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  const reference = match[1];
  if (/^(?:https?:|data:|blob:|#)/.test(reference)) continue;
  const relativePath = reference.split(/[?#]/, 1)[0].replace(/^\/+/, '');
  if (!relativePath || !fs.existsSync(path.join(rootDir, relativePath))) {
    throw new Error(`index.html references missing local asset: ${reference}`);
  }
}

for (const marker of [
  'class MarkdownWorkspaceStorage',
  'indexedDB.open',
  'Markdown Viewer Vault',
  'listDocumentMetadata',
  'loadDocumentContent'
]) {
  if (!storageJs.includes(marker)) {
    throw new Error(`workspace-storage.js is missing expected marker: ${marker}`);
  }
}

const requiredScriptMarkers = [
  'marked.setOptions',
  'preview-worker.js',
  'function renderMarkdown',
  'function importMarkdownFile',
  'exportMd.addEventListener',
  'exportHtml.addEventListener',
  'exportPdf.addEventListener',
  'exportPng.addEventListener',
  'function encodeMarkdownForShare',
  'function startLiveSession',
  'function loadFromShareHash',
  'function loadFromLiveHash'
];

for (const marker of requiredScriptMarkers) {
  if (!appJs.includes(marker)) {
    throw new Error(`script.js is missing expected marker: ${marker}`);
  }
}

console.log('Static build smoke check passed.');
