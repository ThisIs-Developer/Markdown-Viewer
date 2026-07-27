# Contributing

Thanks for helping improve Markdown Viewer. Contributions can include bug reports, documentation fixes, renderer improvements, accessibility work, desktop packaging, deployment fixes, tests, and translations.

## Before Changing Code

- Read [Features](Features) to understand current user-facing behavior and privacy boundaries.
- Check `CHANGELOG.md` for historical context.
- Keep changes scoped to the feature or bug you are working on.
- Do not remove user-facing behavior from docs unless the code no longer implements it.

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

- Update existing wiki pages instead of creating new pages for small topics.
- Document user-facing behavior, limits, data handling, and privacy implications.
- Keep wording simple and direct.
- If a feature sends data to a service, say so.
- If a feature is local-only, say where it is stored.
- Keep README summaries aligned with the wiki.
- When visible interface text changes, regenerate `assets/i18n/*.json`, review every new translation in context, and update `wiki/Localization.md` if the workflow changes.

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

## Repository Map

| Path | Purpose |
| :--- | :--- |
| `index.html` | App shell, toolbar, modals, default content, CDN tags. |
| `script.js` | Main application logic. |
| `preview-worker.js` | Worker Markdown rendering path. |
| `styles.css` | Layout, themes, renderer styles, modals, responsive UI. |
| `sw.js` | PWA/service-worker cache behavior. |
| `assets/i18n/` | Interface catalogs and their generator. |
| `functions/api/image/[[id]].js` | Content-addressed managed raster image and GIF API. |
| `functions/api/media/[[id]].js` | Route alias for content-addressed managed video uploads and delivery. |
| `functions/api/share/[[id]].js` | Stored Share Snapshot API. |
| `functions/live-room/[[room]].js` | Cloudflare Pages Live Share WebSocket entry. |
| `workers/live-room-worker.js` | Live Share Durable Object relay. |
| `desktop-app/` | Neutralino desktop wrapper and build preparation. |
| `wiki/` | Documentation source pages. |
