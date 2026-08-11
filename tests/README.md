# Automated Test Suite

Markdown Viewer is a static browser application with a Neutralino desktop wrapper. The shared test suite uses Playwright to exercise editing, preview rendering, tabs, import/export, sharing, responsive layout, browser storage, and accessibility behavior.

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- npm

Install the locked dependencies and Playwright browsers once:

```bash
npm ci
npm run test:install
```

Use `npx playwright install --with-deps` instead on Linux when system browser dependencies are not already installed.

## Commands

```bash
npm run build                  # static assets, JSON, HTML IDs/references, and JavaScript syntax
npm run test:e2e               # complete Chromium suite
npm test                       # static validation plus the complete Chromium suite
npm run test:e2e:smoke         # fast Chromium smoke suite
npm run test:e2e:cross-browser # smoke suite in Chromium, Firefox, and WebKit
```

Run one file or a matching test:

```bash
npm run test:e2e -- tests/e2e/editor.spec.js
npm run test:e2e -- --grep "workspace backup"
```

For interactive debugging:

```bash
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:report
```

The Playwright configuration starts a cross-platform Node static server automatically. Core browser libraries are fulfilled from locked npm packages during tests. External renderer, GitHub, and Live Share calls are mocked in the specifications that exercise those integrations.

## Coverage

- Static validation and application startup
- Markdown editing, GFM rendering, formatting, tabs, and file import
- Mermaid, PlantUML, Graphviz/DOT, D2, Vega-Lite, WaveDrom, Markmap, math, ABC notation, maps, and STL surfaces
- Share Snapshot and locally mocked Live Share access behavior
- Markdown, HTML, PNG, and browser-print PDF export paths
- Workspace storage, migration, backup/restore, Private mode, and responsive behavior
- Explorer, toolbar, dialogs, keyboard interaction, accessible names, and focus management

Live Share tests use a local WebSocket/Yjs substitute and do not replace a Cloudflare Durable Object integration test. Production CDN availability and deployed Cloudflare bindings should be monitored separately from the deterministic pull-request suite.

## Contributor Workflow

Before changing application behavior, run the focused specification for the affected area. Before opening a pull request, run:

```bash
npm test
npm run test:e2e:cross-browser
```

Tests must be isolated, deterministic, and runnable on Windows, macOS, Linux, and CI. Prefer user-facing roles and labels over DOM implementation selectors. Store fixtures under `tests/fixtures/`; never write artifacts to user-specific paths. Playwright captures screenshots and videos on failure and CI uploads the report and test results.
