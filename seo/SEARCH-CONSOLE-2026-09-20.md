# Search Console investigation — 20 September 2026

All six CSV files in the two supplied ZIPs and both screenshots were reviewed. The exported URLs were checked against the live site, and the repository was inspected. The changes below are local project changes; they have not been deployed or submitted to Search Console.

**The fixable problem is the language pages' content. The two redirecting URLs are intentional aliases. Google decides indexing, so a code change cannot guarantee that every row will become “Passed.”**

## What the supplied files show

| Archive | File | Findings |
| --- | --- | --- |
| `https___markdownviewer.pages.dev_-Coverage-Drilldown-2026-09-20.zip` | `Metadata.csv` | Issue: Crawled - currently not indexed. Scope: All known pages. |
| Same archive | `Table.csv` | 14 URLs, all non-English `?lang=` versions. Last crawls: 4–14 September. |
| Same archive | `Chart.csv` | 77 daily observations, 30 June–14 September; no missing dates. Count rose to 4 on 22 August and 14 on 29 August, then remained at 14. |
| `https___markdownviewer.pages.dev_-Coverage-Drilldown-2026-09-20 (1).zip` | `Metadata.csv` | Issue: Page with redirect. Scope: All known pages. |
| Same archive | `Table.csv` | `/?lang=en` and `/tips`, last crawled on 15 and 12 September respectively. |
| Same archive | `Chart.csv` | 77 daily observations, 30 June–14 September; no missing dates. Count increased from 0 to 2 on 29 August and remained at 2. |

The screenshots show 16 excluded URLs and 1 indexed URL, with failed validations for the two categories. They do not identify the indexed URL. The two categories with zero affected URLs need no corrective work. The export date is newer than the chart's last observation; it is not a real-time index status check.

## Every affected URL and its solution

All URLs below use `https://markdownviewer.pages.dev`.

| Path | Language | Last Google crawl in export | Live HTTP response | Action |
| --- | --- | --- | --- | --- |
| `/?lang=tr` | Turkish | 2026-09-14 | 200 | Deploy translated initial content and starter |
| `/?lang=es` | Spanish | 2026-09-13 | 200 | Same |
| `/?lang=fr` | French | 2026-09-13 | 200 | Same |
| `/?lang=ru` | Russian | 2026-09-13 | 200 | Same |
| `/?lang=tw` | Traditional Chinese | 2026-09-13 | 200 | Same |
| `/?lang=de` | German | 2026-09-13 | 200 | Same |
| `/?lang=pt` | Brazilian Portuguese | 2026-09-12 | 200 | Same |
| `/?lang=uk` | Ukrainian | 2026-09-12 | 200 | Same |
| `/?lang=zh` | Simplified Chinese | 2026-09-12 | 200 | Same |
| `/?lang=it` | Italian | 2026-09-08 | 200 | Same |
| `/?lang=ja` | Japanese | 2026-09-08 | 200 | Same |
| `/?lang=bg` | Bulgarian | 2026-09-06 | 200 | Same |
| `/?lang=pl` | Polish | 2026-09-06 | 200 | Same |
| `/?lang=ko` | Korean | 2026-09-04 | 200 | Same |
| `/?lang=en` | English alias | 2026-09-15 | 308 → `/` | Retain redirect; inspect the destination `/` |
| `/tips` | Retired alias | 2026-09-12 | 301 → `/` | Retain redirect if the editor is the intended replacement |

The root `/` currently returns 200. Both reported redirects lead directly to it, without a loop. If `/tips` is instead intended to be a separate searchable tutorial, it needs a real, useful tutorial at that address with a 200 response, its own canonical, and internal links. Removing its redirect without providing that page is not a solution.

## Confirmed technical findings

1. **All 15 initial page bodies were identical.** The live root and the 14 translated URLs returned different translated titles, descriptions, language headers, and self-canonicals, but the same English body text. After removing script/style/template/textarea blocks, their normalized body text was 9,068 characters with the same SHA-256 prefix, `0b4ed4d4f2cb456b`.
2. **The visible preview initially contained only a skeleton.** Main document content depended on JavaScript.
3. **The first-run welcome document was English for every URL.** The client translated interface labels, while the main sample document remained English. This is a plausible contributor to the indexing outcome, not proof of Google's exact reason. Google determines a page's language from visible content; translated metadata or interface labels alone are insufficient. [Google's multilingual-site guidance](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
4. **Startup could overwrite the localized title.** The interface translation code reused an initial title instead of consistently applying the selected locale's SEO metadata. Saved/browser language could also change the root's interface independently of its English URL.
5. **The sitemap and canonical setup already do useful work.** The live sitemap returns 200 and contains the root plus 14 translated URLs. The redirects are absent. Canonicals are self-referencing, language alternates are reciprocal, and the inspected robots rules permit the public pages. No blocking `X-Robots-Tag` was present on the checked pages.

These observations do not establish a Google penalty, a hosting restriction, or a need to buy a domain. The exports do not contain Google's selected canonical, rendered screenshot, or detailed validation history for individual URLs. Those require authenticated URL Inspection.

## Changes made in this project

- Added useful welcome text for all 15 languages: opening/importing documents, editing, preview, exports, sharing, storage, and backups.
- Rendered that content directly in the initial, visible preview. Visitors and crawlers receive the same content; it is not a hidden SEO block or a bot-specific response.
- Added translated starter documents for first-time visits to the 14 non-English URLs, including code, math, and Mermaid examples. The English starter retains the full demonstration.
- Kept saved and edited documents unchanged when switching languages or reloading.
- Made web URL language authoritative. `/` stays English; a supported `?lang=` selects that language. Desktop preference detection remains available.
- Synchronized the title, canonical, schema, and language after interface initialization and language changes, including `pt-BR`.
- Made HEAD responses describe the same language as GET responses.
- Updated the service-worker asset list and synchronized generated desktop resources.
- Updated the development server to exercise the actual Pages SEO middleware. Earlier browser tests could pass through client-side metadata updates without checking production-like HTML.
- Added `npm run audit:seo`, a read-only deployment check for all language pages, redirects, canonical URLs, alternates, and discovery files. This checks responses, not Google's index.

Relevant implementation: [server rendering](server-render.mjs), [welcome translations](welcome-content.mjs), [browser metadata](../assets/seo-metadata.mjs), and [localization documentation](../wiki/Localization.md).

## Deployment and Search Console steps

1. **Deploy these changes through the site's existing Cloudflare Pages process.** The public site must run the Pages Functions middleware in `functions/_middleware.js`; uploading only static HTML will leave initial translated responses dependent on JavaScript. Keep `_routes.json` routing `/` through Functions. No deployment was performed during this investigation.
2. **Verify the deployed responses.** From the repository run `npm run audit:seo`. Before deployment the live site will fail the new translated-content check; after deployment all response checks should pass. A preview can be checked with `npm run audit:seo -- https://YOUR-PREVIEW.pages.dev`. Production canonicals intentionally remain on `markdownviewer.pages.dev`.
3. **Inspect the canonical URLs in Search Console.** Start with `/` and a few affected languages, then cover all 14. Use **Test live URL → View tested page** and inspect both HTML and screenshot. Confirm a successful fetch, indexing allowed, visible translated content, and a canonical matching the inspected language URL. In the indexed inspection results, separately check Google's selected canonical when available; the live test does not predict Google's canonical choice.
4. **Check the submitted sitemap.** In Sitemaps, submit `https://markdownviewer.pages.dev/sitemap.xml` if missing, or verify the existing submission is successful. It already contains the 15 intended URLs. Do not add `/?lang=en` or `/tips`.
5. **Request indexing after the substantive content change.** Use Request indexing for the changed canonical URLs within the available quota. Repeating the same request does not make Google crawl faster. Restart validation for the crawled/not-indexed group after deployment and live checks, if Search Console offers it. Inspect any failed example individually before retrying.
6. **Leave intentional redirects in place.** They can continue to appear under Page with redirect. Google is supposed to index the destination instead. Revalidating unchanged redirects does not turn them into separately indexable pages. [Google's Page indexing report documentation](https://support.google.com/webmasters/answer/7440203?hl=en)
7. **Allow time for recrawling and reassessment.** Compare Google's new crawl date with the deployment date. Google says crawling can take days to weeks and does not guarantee inclusion. There is no reliable deadline for an indexing or validation pass. [Google's recrawl guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)

If a translated page remains excluded after a fresh crawl, inspect the rendered content and Google-selected canonical. Review translation quality and whether the page provides enough value for that audience. A Search Console live-test success only confirms technical accessibility; it does not prove indexing. Server-rendering helps users and crawlers, but quality and selection remain Google's decision. [Google's JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

## Avoid changes that only move the exclusion elsewhere

- Do not block the language URLs in robots.txt or mark them noindex when you want them indexed.
- Do not canonicalize genuine translated pages to English merely to reduce an error count.
- Do not remove useful redirects just to make the report green.
- Do not create empty language landing pages or stuff repeated keywords into hidden text.
- There is no need to migrate all query URLs to new paths solely for this report. That would introduce another URL migration without addressing the English content.

The intended outcome is that the 15 useful canonical language pages are accessible and eligible for indexing, and the two intentional aliases remain redirects. Zero excluded URLs is not the success criterion.

## Verification

- `npm run build`: passed, including static checks, every locale's server-rendered content, HEAD handling, and sitemap consistency.
- `tests/e2e/seo.spec.js` on Chromium: 7 passed, covering all 15 initial responses, JavaScript-disabled visibility, static-host fallback, metadata, saved/browser-language consistency, redirects, and document preservation.
- `tests/e2e/smoke.spec.js` on Chromium: 4 passed, including normal startup and release-note behavior.
- The GitHub importer localization regression: 1 passed, exercising all 15 interface languages.
- `npm run audit:seo -- http://127.0.0.1:4173`: all 15 canonical pages passed; English, tips, and index aliases returned the expected permanent redirects.
- French desktop rendering without JavaScript and French mobile rendering were visually checked. The mobile page produced no browser errors or horizontal page overflow.

Translations are authored product copy, not a claim of native-speaker review. Indexing and validation status remain unverified until deployment and Google's subsequent processing.
