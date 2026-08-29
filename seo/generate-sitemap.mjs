import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_LOCALES, canonicalUrlForLocale, hreflangEntries } from './locales.mjs';

const modulePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(modulePath), '..');
const sitemapPath = path.join(rootDir, 'sitemap.xml');

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildSitemap() {
  const alternates = hreflangEntries();
  const canonicalLocales = SEO_LOCALES;
  const urlBlocks = canonicalLocales.map(locale => {
    const links = alternates
      .map(alternate => `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}" />`)
      .join('\n');
    return `  <url>\n    <loc>${escapeXml(canonicalUrlForLocale(locale))}</loc>\n${links}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlBlocks}\n</urlset>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const expected = buildSitemap();
  if (process.argv.includes('--check')) {
    const actual = fs.readFileSync(sitemapPath, 'utf8');
    if (actual !== expected) {
      throw new Error('sitemap.xml is stale. Run: npm run seo:sitemap');
    }
    console.log('SEO sitemap is current.');
  } else {
    fs.writeFileSync(sitemapPath, expected, 'utf8');
    console.log(`Generated ${path.relative(rootDir, sitemapPath)} with ${SEO_LOCALES.length} canonical language URLs.`);
  }
}
