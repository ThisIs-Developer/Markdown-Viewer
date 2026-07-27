# Documentation Audit

This page records the July 2026 documentation audit for Markdown Viewer. The audit used the implementation at commit `5511dc7` as the source of truth and covered every tracked `.md` file, the web application, Cloudflare Functions and Workers, Docker configuration, the Neutralino desktop wrapper, the Service Worker/PWA, import/export paths, Share Snapshot, Live Share, renderer integrations, tests, and interface locale catalogs.

The audit changes documentation only. Product behavior, APIs, storage formats, deployment infrastructure, desktop permissions, and application source files are outside its scope.

## Audit Method

1. Inventory every tracked `.md` and `.markdown` file.
2. Compare user-facing claims with `index.html`, `script.js`, `preview-worker.js`, `sw.js`, Cloudflare Functions, `workers/live-room-worker.js`, Docker files, desktop configuration/build scripts, locale catalogs, and Playwright tests.
3. Classify each document and record its audience, relevance, overlap, gaps, links, and translation quality.
4. Make English the source documentation and separate the concise README from detailed Wiki pages.
5. Synchronize Japanese, Korean, Simplified Chinese, and supported Traditional Chinese README summaries against that English source.
6. Validate local links, anchors, Markdown structure, terminology, JSON syntax, the documentation-only diff, and available project checks.

## Initial Inventory

“Current” means relevant to the implementation at the audited commit. “Historical” means useful as a record but not a source of current behavior.

| Path | Language | Purpose and audience | Status and relevance | Overlap, gaps, links, or quality findings | Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `README.md` | English | Product overview for prospective users and contributors | Current, but oversized | Repeated installation, architecture, privacy, and contribution detail from the Wiki; omitted Traditional Chinese navigation; made several high-level claims without nearby limits; embedded a screenshot URL that returned HTTP 404 | **Update**: make it a concise entry point and remove the dead image |
| `CHANGELOG.md` | English | Historical release record for users and maintainers | Historical and current release context | v3.9.0 called stored links `#share=` IDs instead of `#id=...`; older entries can describe behavior that later changed | **Update**: correct the specific historical inaccuracy; preserve release history |
| `desktop-app/README.md` | English | Contributor-facing desktop-folder overview | Current | Overlaps `wiki/Desktop-App.md`, but the local folder context is useful; needed clearer source-of-truth and generated-file guidance | **Update** |
| `locales/README_ja.md` | Japanese | Localized product overview | Current translation | Mirrored the former oversized README; mixed English feature labels with Japanese UI terms; detailed links depended on English anchors | **Update**: concise, natural Japanese summary |
| `locales/README_ko.md` | Korean | Localized product overview | Current translation | Mirrored the former oversized README; terminology varied between English and Korean UI labels | **Update**: concise, natural Korean summary |
| `locales/README_zh.md` | Simplified Chinese | Localized product overview | Current translation | Mirrored the former oversized README; some translated sections were longer than needed for an overview | **Update**: concise, natural Simplified Chinese summary |
| `sample.md` | English | In-product demonstration document for users | Current product content | It is application sample content, not a documentation entry page; syntax examples remain useful | **Keep** |
| `wiki/Home.md` | English | Documentation landing page for all audiences | Current | Wiki-style extensionless links were fragile when files were browsed in the repository; new topic pages were absent | **Update** |
| `wiki/Features.md` | English | Detailed behavior and limits for users, support, and maintainers | Current and authoritative | Strong coverage, but duplicated privacy/security sections; omitted the 10 MB local Markdown import limit; understated persisted Live Share capability metadata | **Update** |
| `wiki/Usage-Guide.md` | English | Task-oriented user guide | Current | Good workflows; extensionless cross-link; missing the 10 MB local import limit and a clearer active-document explanation | **Update** |
| `wiki/Markdown-Reference.md` | English | Syntax reference for Markdown authors | Current | Broad and accurate; needed consistent navigation and related-page links | **Update** |
| `wiki/Installation.md` | English | Setup guide for users and deployers | Current | Docker wording implied worker/offline completeness that the checked-in image does not provide; troubleshooting was dispersed | **Update** |
| `wiki/Configuration.md` | English | Runtime, storage, Cloudflare, renderer, and desktop reference | Current | Strong limits table; Live Share storage description omitted the persisted capability record; needed cross-links to security guidance | **Update** |
| `wiki/Docker-Deployment.md` | English | Docker operations for self-hosters | Current | Claimed the container serves `preview-worker.js`, although the Dockerfile does not copy it; did not identify the resulting Service Worker precache limitation | **Update** |
| `wiki/Desktop-App.md` | English | Desktop behavior, security, build, and platform guide | Current | Useful detail; overlaps folder README by design; needed consistent navigation and local-renderer limitation wording | **Update** |
| `wiki/Live-Share-Cloudflare.md` | English | Live Share user, deployment, role, and protocol reference | Current | Incorrectly implied no database write at all; the Durable Object persists bearer capabilities and `createdAt`, although it does not persist document/review content | **Update** |
| `wiki/Localization.md` | English | UI localization workflow for translators and maintainers | Current | Listed Traditional Chinese UI support but the documentation navigation had no Traditional Chinese README; lacked a shared documentation glossary | **Update** |
| `wiki/Contributing.md` | English | Contribution workflow for code, docs, tests, issues, security, and translation | Current | Needed stronger documentation/translation checks, explicit issue-reporting guidance, and current test expectations | **Update** |
| `wiki/FAQ.md` | English | Short answers for users and support | Current | Mixed frequently asked questions with procedural troubleshooting; several answers repeated full privacy explanations | **Split**: keep concise answers and move diagnostic procedures to `Troubleshooting.md` |
| `wiki/Development-Journey.md` | English | Project narrative and design-history context | Historical/current context | Appropriate as narrative, but current-state claims must defer to feature/privacy references | **Update** |

No tracked `.markdown` files existed at the start of the audit. No documentation file was safe or necessary to remove, archive, redirect, rename, or merge completely. Repository and screenshot references still depend on the existing paths.

## Material Source-to-Documentation Mismatches

| Finding | Implementation evidence | Documentation action |
| :--- | :--- | :--- |
| Local Markdown imports have a 10 MB per-file limit | `script.js` rejects a file above `10 * 1024 * 1024` | Add the limit to Features, Usage Guide, Configuration, Troubleshooting, and README |
| Live Share persists capability metadata | `workers/live-room-worker.js` writes `hostCap`, `editCap`, `viewCap`, and `createdAt` to Durable Object storage under `live-room-auth-v1` | State that Markdown and Review content are relay-only while capability metadata is durable; do not call the entire room “in-memory” |
| Stored snapshots use `#id=...` | `script.js` creates stored links with `#id=` and loads them through `/api/share/<id>` | Correct the v3.9.0 changelog and use `#id=...` consistently |
| The Share API returns a deletion token, but the UI does not expose it | `functions/api/share/[[id]].js` returns `deleteToken`; `script.js` retains it only in an in-memory variable and has no deletion control | Document that API clients must capture the token and that the current UI cannot delete a stored snapshot early |
| Docker does not include all Service Worker critical assets | Root `Dockerfile` does not copy `preview-worker.js` or `sample.md`; `sw.js` includes both in `CRITICAL_ASSETS` | Document main-thread Preview fallback and incomplete PWA/offline installation in the stock image; do not change Docker |
| Remote rendering is the normal path for several engines | `script.js` sends PlantUML to PlantUML/Kroki and D2, Graphviz, Vega-Lite, and WaveDrom to Kroki; default desktop permissions do not allow `os.execCommand` | Avoid “client-side D2/PlantUML” claims for the standard build and explain the disabled local-command path |
| Managed media is public-by-link and time-limited | Media Functions validate supported signatures, store content-addressed records in `SHARE_KV`, and apply a 90-day TTL | Keep the consent, public-link, size, and expiry warning beside every media workflow summary |
| Wiki links were inconsistent by viewing surface | Many Wiki pages linked to `Features` or `Usage-Guide` without `.md` | Normalize repository-relative links to explicit `.md` paths and validated anchors |
| The overview screenshot was unavailable | The `github.com/user-attachments` URL returned HTTP 404 during the final link check | Remove the dead embed from the English and localized READMEs; retain the verified local product icon |
| Traditional Chinese documentation navigation was missing | `assets/i18n/tw.json` and `data-lang="tw"` show active UI support | Add `locales/README_tw.md` and include it in all localized navigation |

## Weighted Audit

The score uses the weights requested for this audit. Each category score is a contribution to the 100-point total, not an unweighted percentage.

| Category | Weight | Initial | Problems found | Required improvement | Updated | Evidence after changes |
| :--- | ---: | ---: | :--- | :--- | ---: | :--- |
| Technical accuracy | 20 | 15 | Live Share persistence, Docker contents, snapshot hash, deletion-token usability, and 10 MB import limit were inaccurate or absent | Verify limits and data paths against code; publish implementation limitations | 19 | Feature, Share Snapshot, Live Share, Docker, Configuration, and Privacy pages cite the implemented boundaries |
| Feature completeness | 15 | 13 | No dedicated Share Snapshot or privacy/security page; some document/import limits were missing | Cover every verified product area without copying full explanations into the README | 14 | README map plus Features, Usage, Markdown Reference, Share Snapshot, Live Share, and Privacy pages |
| Information architecture | 10 | 6 | Root README duplicated detailed pages; FAQ mixed explanation and diagnosis; no audit/style/glossary pages | Keep README concise; create clear topic ownership and “Start here” navigation | 9 | `README.md`, `wiki/Home.md`, and the new focused pages |
| Installation clarity | 10 | 7 | Docker/PWA behavior was overstated and troubleshooting was scattered | Separate install targets, prerequisites, deployment boundaries, and known limitations | 9 | Installation, Docker Deployment, Desktop Application, Configuration, and Troubleshooting |
| Usage clarity | 10 | 9 | Strong guide, but a few limits and active/temporary document behaviors were not prominent | Add limits and direct workflow cross-links | 9 | Usage Guide and focused sharing pages |
| International readability | 10 | 8 | Long README, dense repeated prose, and inconsistent feature naming | Short sentences, scan-friendly tables, stable terminology, and explicit network notices | 9 | Rewritten English source and style guide |
| Translation quality | 10 | 6 | Traditional Chinese README absent; localized READMEs mirrored excessive English detail; terminology varied | Use one English source, native phrasing, UI-aligned terminology, and a five-language glossary | 9 | Four localized READMEs plus Terminology Glossary |
| Link and navigation quality | 5 | 3 | Extensionless Wiki links were fragile; Traditional Chinese was missing from language navigation | Validate relative paths, anchors, images, and localized fallback links | 5 | Explicit `.md` paths, complete language switcher, automated local link check |
| Privacy and security transparency | 5 | 4 | Generally strong, but Live Share capability storage and deletion-token UI limits were not transparent | Publish one user-facing data-flow and security source | 5 | Privacy and Security, Share Snapshot, and Live Share pages |
| Contribution readiness | 5 | 4 | Translation, documentation validation, issue quality, and baseline test caveats needed clearer instructions | Add scoped conventions, checks, PR expectations, and reporting paths | 5 | Contributing and Documentation Style Guide |
| **Total** | **100** | **75** |  |  | **93** |  |

The final score is intentionally below 100. External service behavior, every browser/OS combination, published Wiki synchronization, and native-speaker review by four independent reviewers were not available within this repository-only audit. The stock Docker/PWA limitation and a pre-existing project validation issue also remain outside the documentation-only scope.

## Files Added During the Audit

| Path | Purpose |
| :--- | :--- |
| `locales/README_tw.md` | Traditional Chinese product overview |
| `wiki/Documentation-Audit.md` | Inventory, mismatches, scores, evidence, and remaining limits |
| `wiki/Documentation-Style-Guide.md` | Writing, structure, link, privacy, localization, and changelog rules |
| `wiki/Privacy-and-Security.md` | Authoritative user-facing data handling and security boundaries |
| `wiki/Share-Snapshot.md` | Point-in-time sharing workflow, storage modes, deletion token, security, and limits |
| `wiki/Terminology-Glossary.md` | Approved English/Japanese/Korean/Simplified Chinese/Traditional Chinese terms |
| `wiki/Troubleshooting.md` | Diagnostic procedures separated from short FAQ answers |

## Final Verification

| Check | Result |
| :--- | :--- |
| Documentation inventory | Reviewed 20 existing documentation files and 7 newly added files; no `.markdown` files exist |
| Local navigation | All relative links, image paths, and heading anchors resolved across 27 Markdown files |
| External links | All 27 unique linked external URLs returned HTTP 2xx or 3xx after the dead screenshot was removed |
| Markdown structure | Every file has one top-level heading; no unclosed code fences, duplicate headings, Unicode replacement characters, or exact repeated prose paragraphs of at least 180 characters |
| Localized README parity | English, Japanese, Korean, Simplified Chinese, and Traditional Chinese each contain the five-language switcher, four peer links, and the same nine-heading overview structure |
| UI locale catalogs | All 14 JSON catalogs parsed and matched the 1,072-key English catalog |
| Terminology and claims | Targeted searches found no obsolete `#share=` stored-id claim, client-side PlantUML/D2 claim, or unsupported offline/security guarantee in current guidance |
| Focused application checks | The Share Snapshot temporary-tab test and Private mode local-storage test passed in Chromium |
| Repository static validator | `npm run build` remains blocked before validation because the existing checker requires missing `functions/api/report-issue.js`; documentation changes did not create or alter that condition |
| Diff scope | `git diff --check` passed, and all 26 changed or added paths are Markdown documentation |

See [Contributing](Contributing.md) and the [Documentation Style Guide](Documentation-Style-Guide.md) for the maintenance workflow.
