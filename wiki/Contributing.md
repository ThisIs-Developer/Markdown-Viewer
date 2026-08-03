# Contributing

Thanks for helping improve Markdown Viewer. Contributions can include bug reports, documentation fixes, renderer improvements, accessibility work, desktop packaging, deployment fixes, tests, and translations.

## Before Changing Code

- Read [Features](Features.md) to understand current user-facing behavior and [Privacy and Security](Privacy-and-Security.md) for data boundaries.
- Check `CHANGELOG.md` for historical context.
- Keep changes scoped to the feature or bug you are working on.
- Do not remove user-facing behavior from docs unless the code no longer implements it.

Create a branch; do not work directly on `main`. Keep documentation-only changes separate from application behavior changes when practical.

## Local Web Development

The root app has no required build step.

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python -m http.server 8080
```

Open `http://localhost:8080`.

Use a local HTTP server, not `file://`, because Web Workers and Service Workers depend on browser origin rules.

## Desktop Development

```bash
cd desktop-app
npm install
npm run dev
```

`npm run dev` triggers setup and preparation automatically. Run `node prepare.js` directly when you only need to refresh desktop resource copies after changing root assets.

## Cloudflare Features

Managed media and stored Share Snapshot require `SHARE_KV`. Live Share requires `LIVE_ROOMS` and the `LiveRoom` Durable Object.

When changing managed media, snapshot, or live behavior, update the relevant files:

- `script.js`
- `functions/api/image/[[id]].js`
- `functions/api/media/[[id]].js`
- `functions/api/share/[[id]].js`
- `functions/live-room/[[room]].js`
- `workers/live-room-worker.js`
- `wiki/Features.md`
- `wiki/Live-Share-Cloudflare.md`
- `wiki/FAQ.md`

## Code Style

- Use plain JavaScript, HTML, and CSS unless a focused dependency is already part of the app.
- Keep browser compatibility in mind.
- Keep expensive work off the hot typing path.
- Sanitize rendered HTML before insertion.
- Preserve accessibility attributes and keyboard behavior.
- Keep desktop native API permissions as narrow as possible.
- Use clear names and comments only where they explain non-obvious logic.

## Documentation Rules

- Use concise, direct, internationally readable language and the approved feature names in [Localization and Terminology](Localization.md).
- Update the responsible Wiki page instead of creating a new page for a small addition.
- Document user-facing behavior, limits, data handling, and privacy implications.
- Keep wording simple and direct.
- If a feature sends data to a service, say so.
- If a feature is local-only, say where it is stored.
- Keep README summaries aligned with the wiki.
- When visible interface text changes, regenerate `assets/i18n/*.json`, review every new translation in context, and update `wiki/Localization.md` if the workflow changes.
- Verify claims against current code and tests rather than copying an older changelog statement.
- Use explicit `.md` extensions for repository-relative documentation links.

## Translation Contributions

1. Finalize the English source.
2. Review the terminology tables in [Localization and Terminology](Localization.md).
3. Update the relevant localized README or interface catalog without translating code, commands, paths, URLs, routes, keys, library names, Markdown syntax, or branch names.
4. Preserve Markdown structure, links, anchors, tables, and code fences.
5. Compare the translation with the English source for technical meaning and omissions.
6. Review grammar, UI-label consistency, heading length, and link targets in context.
7. Run `node assets/i18n/generate-ui-locales.mjs` only when interface catalogs are in scope, then review generated output before committing.
8. Run `node assets/i18n/audit-ui-locales.mjs` and resolve every reported problem.
9. Run the desktop preparation workflow when interface catalogs change so bundled copies remain synchronized.

Detailed Wiki pages are maintained in English. When no localized page exists, label the English destination instead of creating a broken localized link.

## Release Notes Format

Use the single extensionless [`RELEASE_NOTES`](../RELEASE_NOTES) file as both the current release note and the canonical example. Update it in place for each version; do not add a duplicate template or a versioned copy. Keep its source entirely in Markdown. The application adds the branded layout, action icons, section navigation, and active-section state after Markdown rendering.

Every release note must contain these parts in this order:

1. Brand line, version heading, unambiguous release date, one- or two-sentence summary, and the release/changelog links.
2. **Highlights** with at least one user-facing bullet.
3. Zero or more detail sections, each covering one user-facing topic.
4. **Thank you** as the final section, with contributor and change-reference bullets when available.

Scale the same format to the release size:

| Release scope | Highlights | Detail sections | Change references |
| :--- | :--- | :--- | :--- |
| Single fix or one commit | 1 | 0–1 | Link the issue, PR, or commit when useful |
| Small feature or maintenance update | 2–3 | 1–2 | List only the related PRs/issues |
| Large feature release | 3–5 | 2–6 | Curate the important PRs/issues; link the release for the full history |

Authoring rules:

- Use the Markdown syntax supported by the editor: headings, paragraphs, emphasis, inline or fenced code, links, images, blockquotes, GitHub-style alerts, ordered or unordered lists, task lists, tables, definition lists, footnotes, and horizontal rules. Use a construct only when it helps explain the release.
- Do not embed HTML elements, inline styles, `<style>` blocks, or scripts in `RELEASE_NOTES`. Presentation belongs to the scoped release-note renderer and stylesheet.
- Describe user impact instead of copying commit subjects.
- Do not show commit, PR, issue, file, or line counts in the introduction.
- Do not add empty headings. Delete any optional section that has no useful content.
- Keep **Highlights** to five bullets or fewer. Combine related changes instead of creating a card for every commit.
- Use `##` for sidebar topics and `###` only for supporting content inside a topic. The sidebar is generated automatically from the `##` headings.
- Use alerts only for migration steps, compatibility notes, data-loss risks, or other actions the user must notice.
- Keep references as Markdown bullets, not tables. For a very large release, list the most important references and rely on the release/changelog link for the complete history.
- With one contributor, use one bullet. With multiple contributors, use one bullet per person in display-name order and state each contribution briefly.
- When no individual credit is appropriate, replace the Contributors subsection with a short maintainer acknowledgement. Never leave a placeholder or empty list.
- Keep **Thank you** last because the application gives the final section its closing-card treatment.
- Preserve the standard release and changelog URLs so the application can add their icons.

Before publishing a release:

1. Verify the version and date in `RELEASE_NOTES`, `CHANGELOG.md`, `script.js`, `sw.js`, and the desktop package/configuration files.
2. Verify every contributor and PR, issue, or commit link against GitHub.
3. Confirm that `RELEASE_NOTES` contains no raw HTML and remove any headings or Markdown constructs that are not useful for the current version.
4. Run `node assets/i18n/generate-ui-locales.mjs` and `node assets/i18n/audit-ui-locales.mjs` when visible labels or the version title change.
5. Run `node desktop-app/prepare.js`, `npm run build`, and the focused release-note lifecycle/responsive tests.

## Testing

Choose checks that match the change:

```bash
npm run build
npm run test:e2e
```

`npm run build` runs the repository static asset validator. `npm run test:e2e` runs Playwright, and `npm test` runs both. Use a focused Playwright spec while iterating, then the broader applicable suite before a pull request.

For documentation:

- run `git diff --check`;
- validate every relative file, image, and heading anchor;
- check Markdown fences and one-H1 structure;
- compare localized README headings and navigation;
- search for outdated terminology and unsupported claims; and
- review `git diff --name-only` to confirm the intended scope.

## Issue Reports

Search [existing issues](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) before opening a new one. Include:

- affected version or commit;
- browser/operating system and delivery target;
- exact reproduction steps;
- minimal non-sensitive Markdown;
- expected and actual results;
- console/network errors; and
- screenshots only when they add useful evidence.

Do not attach confidential Documents, managed-media URLs, Share Snapshot bearer links, Live Share invitations, room secrets, capabilities, or deletion tokens.

## Commit Messages

Conventional commit style is preferred:

```text
feat(editor): add table alignment option
fix(pdf): prevent blank trailing raster page
docs(wiki): clarify live share storage behavior
perf(render): reduce line gutter layout work
```

Useful types include `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, and `chore`.

## Pull Requests

A good PR includes:

- What changed.
- Why it changed.
- How it was tested.
- Screenshots or recordings for UI changes.
- Privacy/storage notes for share, import, live, renderer, or desktop changes.
- Documentation updates when behavior changes.

## Security Reports

Please do not open public issues for vulnerabilities. Use GitHub Security Advisories if available or contact the maintainers privately with a minimal reproduction and impact notes.

Include the affected version/commit, required preconditions, impact, minimal reproduction, and a suggested mitigation when known. Do not test against data or systems you do not own or have permission to assess.

## Repository Map

| Path | Purpose |
| :--- | :--- |
| `index.html` | App shell, toolbar, modals, default content, CDN tags. |
| `workspace-storage.js` | Browser IndexedDB and desktop vault storage, migration, backup, history, trash, and recovery operations. |
| `script.js` | Main application logic. |
| `preview-worker.js` | Worker Markdown rendering path. |
| `styles.css` | Layout, themes, renderer styles, modals, responsive UI. |
| `sw.js` | PWA/service-worker cache behavior. |
| `RELEASE_NOTES` | Single canonical extensionless release note bundled with web/PWA and desktop builds. |
| `assets/i18n/` | Interface catalogs, generator, and catalog-audit tool. |
| `functions/api/image/[[id]].js` | Content-addressed managed raster image and GIF API. |
| `functions/api/media/[[id]].js` | Route alias for content-addressed managed video uploads and delivery. |
| `functions/api/share/[[id]].js` | Stored Share Snapshot API. |
| `functions/live-room/[[room]].js` | Cloudflare Pages Live Share WebSocket entry. |
| `workers/live-room-worker.js` | Live Share Durable Object relay. |
| `desktop-app/` | Neutralino desktop wrapper and build preparation. |
| `wiki/` | Documentation source pages. |

Related pages: [Installation](Installation.md), [Localization and Terminology](Localization.md), and [Troubleshooting](Troubleshooting.md).
