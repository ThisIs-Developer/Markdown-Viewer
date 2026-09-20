import { SEO_LOCALES, SITE_ORIGIN, canonicalPathForLocale, canonicalUrlForLocale, hreflangEntries } from './locales.mjs';
import { getWelcomeCopy } from './welcome-content.mjs';

// Read-only check. Pass a preview origin to inspect a deployment before release.
const origin = process.argv[2] || SITE_ORIGIN;
const failures = [];
const results = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function get(path) {
  return fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
}

for (const locale of SEO_LOCALES) {
  const path = canonicalPathForLocale(locale);
  try {
    const response = await get(path);
    const html = await response.text();
    const start = failures.length;
    check(response.status === 200, `${path}: expected HTTP 200; got ${response.status}`);
    check(!/noindex/i.test(response.headers.get('x-robots-tag') || ''), `${path}: X-Robots-Tag blocks indexing`);
    check(!/<meta\b[^>]*name=["'](?:robots|googlebot)["'][^>]*content=["'][^"']*noindex/i.test(html), `${path}: meta robots blocks indexing`);
    check(html.includes(`href="${canonicalUrlForLocale(locale)}" data-seo-field="canonical"`), `${path}: wrong canonical`);
    check(response.headers.get('content-language') === locale.htmlLang, `${path}: wrong Content-Language`);
    const intro = getWelcomeCopy(locale.code).intro;
    check(html.includes(`<p>${intro}</p>`), `${path}: translated welcome content missing from initial HTML`);
    check(html.includes('id="welcome-preview"'), `${path}: public preview missing`);
    for (const alternate of hreflangEntries()) {
      check(html.includes(`hreflang="${alternate.hreflang}" href="${alternate.href}"`), `${path}: missing ${alternate.hreflang} alternate`);
    }
    results.push({ path, status: response.status, checks: failures.length === start ? 'PASS' : 'FAIL' });
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
    results.push({ path, checks: 'FAIL' });
  }
}

for (const path of ['/?lang=en', '/tips', '/index.html']) {
  try {
    const response = await get(path);
    const location = response.headers.get('location');
    const destination = location ? new URL(location, origin) : null;
    const valid = [301, 308].includes(response.status) && destination?.href === new URL('/', origin).href;
    check(valid, `${path}: expected a single permanent redirect to /`);
    results.push({ path, status: response.status, checks: valid ? 'EXPECTED REDIRECT' : 'FAIL' });
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
  }
}

try {
  const sitemap = await get('/sitemap.xml');
  const xml = await sitemap.text();
  check(sitemap.status === 200, 'sitemap.xml: not HTTP 200');
  check((xml.match(/<loc>/g) || []).length === SEO_LOCALES.length, 'sitemap.xml: wrong canonical URL count');
  for (const locale of SEO_LOCALES) {
    check(xml.includes(`<loc>${canonicalUrlForLocale(locale)}</loc>`), `sitemap.xml: missing ${locale.code}`);
  }
  check(!/\?lang=en|\/tips|\/index\.html/.test(xml), 'sitemap.xml: contains redirecting aliases');
  const robots = await get('/robots.txt');
  const text = await robots.text();
  check(robots.status === 200 && text.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`), 'robots.txt: missing or wrong sitemap');
  // This project uses one wildcard group. Flag newly introduced homepage/query blocks.
  check(!/^Disallow:\s*\/(?:\s*$|\*|\?)/im.test(text), 'robots.txt: review a rule that may block the canonical pages');
} catch (error) {
  failures.push(`Discovery files: ${error.message}`);
}

console.log(`SEO response audit: ${origin} (${new Date().toISOString()})`);
console.table(results);
if (failures.length) {
  failures.forEach(failure => console.error(`FAIL: ${failure}`));
  process.exitCode = 1;
} else {
  console.log('All response checks passed. This verifies deployment, not Google indexing or Search Console validation.');
}
