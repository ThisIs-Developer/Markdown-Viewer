import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SEO_LOCALES, canonicalUrlForLocale, hreflangEntries } from '../../seo/locales.mjs';
import { buildSitemap } from '../../seo/generate-sitemap.mjs';
import { handleSeoRequest, renderLocalizedSeoHtml } from '../../seo/server-render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const requiredFiles = [
  'index.html',
  '404.html',
  'workspace-storage.js',
  'script.js',
  'preview-worker.js',
  'styles.css',
  'sw.js',
  'manifest.json',
  '_routes.json',
  'assets/seo-metadata.mjs',
  'seo/locales.mjs',
  'seo/server-render.mjs',
  'seo/generate-sitemap.mjs',
  'functions/_middleware.js',
  'sitemap.xml',
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
  'assets/seo-metadata.mjs',
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
const sitemapXml = fs.readFileSync(path.join(rootDir, 'sitemap.xml'), 'utf8');

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

if (SEO_LOCALES.length !== 15) {
  throw new Error(`Expected 15 supported SEO locales, found ${SEO_LOCALES.length}.`);
}

if (sitemapXml !== buildSitemap()) {
  throw new Error('sitemap.xml does not match the canonical locale configuration. Run npm run seo:sitemap.');
}

const expectedAlternates = hreflangEntries();
for (const alternate of expectedAlternates) {
  const marker = `rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}"`;
  if (!indexHtml.includes(marker)) {
    throw new Error(`index.html is missing SEO alternate: ${alternate.hreflang} -> ${alternate.href}`);
  }
}

for (const locale of SEO_LOCALES) {
  const renderedHtml = renderLocalizedSeoHtml(indexHtml, locale);
  const canonicalUrl = canonicalUrlForLocale(locale);
  for (const marker of [
    `<html lang="${locale.htmlLang}">`,
    `href="${canonicalUrl}" data-seo-field="canonical"`,
    `content="${locale.title}" data-seo-field="meta-title"`,
    `content="${locale.description}" data-seo-field="description"`,
    `content="${canonicalUrl}" data-seo-field="og-url"`,
    `<title data-seo-field="document-title">${locale.title}</title>`,
    `"inLanguage": "${locale.htmlLang}"`
  ]) {
    if (!renderedHtml.includes(marker)) {
      throw new Error(`Server-rendered SEO for ${locale.code} is missing: ${marker}`);
    }
  }
}

async function runSeoRequest(url, method = 'GET') {
  return handleSeoRequest({
    request: new Request(url, { method }),
    next: async () => new Response(indexHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': String(Buffer.byteLength(indexHtml)),
        ETag: 'test-etag'
      }
    })
  });
}

const traditionalChineseResponse = await runSeoRequest('https://markdownviewer.pages.dev/?lang=tw');
const traditionalChineseHtml = await traditionalChineseResponse.text();
if (traditionalChineseResponse.headers.get('Content-Language') !== 'zh-Hant') {
  throw new Error('SEO middleware did not set the Traditional Chinese Content-Language header.');
}
if (!traditionalChineseHtml.includes('href="https://markdownviewer.pages.dev/?lang=tw" data-seo-field="canonical"')) {
  throw new Error('SEO middleware did not render the Traditional Chinese self-canonical URL.');
}
if (traditionalChineseResponse.headers.has('Content-Length') || traditionalChineseResponse.headers.has('ETag')) {
  throw new Error('SEO middleware retained stale representation headers after rewriting HTML.');
}

for (const url of [
  'https://markdownviewer.pages.dev/?lang=en',
  'https://markdownviewer.pages.dev/?lang=unsupported'
]) {
  const response = await runSeoRequest(url);
  if (response.status !== 308 || response.headers.get('Location') !== 'https://markdownviewer.pages.dev/') {
    throw new Error(`SEO middleware should redirect non-canonical language URL: ${url}`);
  }
}

const normalizedLanguageResponse = await runSeoRequest('https://markdownviewer.pages.dev/?lang=TW');
if (normalizedLanguageResponse.status !== 308 || normalizedLanguageResponse.headers.get('Location') !== 'https://markdownviewer.pages.dev/?lang=tw') {
  throw new Error('SEO middleware should normalize language URL casing.');
}

const routes = JSON.parse(fs.readFileSync(path.join(rootDir, '_routes.json'), 'utf8'));
for (const route of ['/', '/api/*', '/live-room/*']) {
  if (!routes.include?.includes(route)) throw new Error(`_routes.json must include ${route}.`);
}

const redirects = fs.readFileSync(path.join(rootDir, '_redirects'), 'utf8');
for (const redirect of ['/tips / 301', '/index.html / 301']) {
  if (!redirects.includes(redirect)) throw new Error(`_redirects is missing: ${redirect}`);
}
if (/\s404(?:\s|$)/m.test(redirects)) {
  throw new Error('_redirects contains an unsupported synthetic 404 status. Use the top-level 404.html page.');
}

const notFoundHtml = fs.readFileSync(path.join(rootDir, '404.html'), 'utf8');
for (const marker of ['<meta name="robots" content="noindex, follow">', '<h1>Page not found</h1>']) {
  if (!notFoundHtml.includes(marker)) throw new Error(`404.html is missing: ${marker}`);
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
  if (!relativePath && reference.startsWith('/')) continue;
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
