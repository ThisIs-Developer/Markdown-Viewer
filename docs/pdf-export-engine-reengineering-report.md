# Enterprise PDF Export Engine Re-engineering Program — Final Investigation Report

**Report date:** June 6, 2026  
**Repository:** `Markdown-Viewer`  
**Centralized manager:** Agent 0 — Chief PDF Platform Architect  
**Scope:** PDF export, generation, rendering, performance, pagination, and PDF-specific layout only.  
**Change policy:** This investigation changes no product code. It creates only this report.

## Governance and evidence standard

Agent 0 created exactly ten specialized agents (Agents 1–10), assigned the roles requested below, coordinated their investigations, reviewed their independent outputs, reconciled disagreements, and retained final approval authority. No additional specialized agent was created. Agent 0 verified material claims against repository evidence and current public primary sources before approving them for this report.

Claims are classified as follows:

- **Observed:** directly established by repository code, documentation, or a cited public source.
- **Inferred:** a technical conclusion derived from observed implementation behavior; it still requires runtime confirmation where noted.
- **Proposed:** a design or validation recommendation, not a description of current behavior.
- **Unverified proprietary detail:** a claim that cannot be confirmed from public source or open code and is not used as an architectural premise.

No measured export-time claim is presented as fact. This checkout contains no PDF benchmark harness, browser executable, generated large-document corpus, or automated PDF visual test suite. The requested 50/100/250/500/1000-page measurements therefore remain acceptance tests, not fabricated results.

---

## Section 1 — Current PDF Export Architecture Analysis

### 1.1 End-to-end workflow

1. **User entry point.** Desktop and mobile PDF controls dispatch the same browser-side click handler. The mobile control forwards to the primary PDF control (`script.js:6172`, `script.js:7461-7650`).
2. **Dependency acquisition.** On first export, the handler lazy-loads jsPDF 2.5.1 and html2canvas 1.4.1 from CDN definitions (`script.js:28-35`, `script.js:7473-7477`). The desktop build copies shared application files and rewrites CDN assets for offline use during preparation (`desktop-app/prepare.js:45-57`, `desktop-app/prepare.js:139-202`).
3. **Duplicate Markdown conversion.** Export reads the editor text and synchronously invokes `marked.parse`, then sanitizes the resulting HTML (`script.js:7480-7488`). This is separate from the normal preview pipeline, which can render in `preview-worker.js` and returns HTML to the UI (`preview-worker.js:330-354`, `preview-worker.js:456-480`).
4. **Off-screen export DOM.** Export creates a fixed-position, off-screen `.markdown-body.pdf-export` element, assigns a 210 mm width, injects the sanitized HTML, applies theme colors, and appends it to the live document (`script.js:7490-7510`).
5. **Special renderer replay.** Mermaid nodes in the export clone are rendered again with Mermaid; math is typeset again with MathJax; assistive MathML and math scripts are then removed from the export clone (`script.js:7512-7563`). Syntax highlighting is produced during Markdown rendering through the configured renderer (`preview-worker.js:306-320`; corresponding main-thread renderer in `script.js:914-933`).
6. **Width mutation.** If content overflows horizontally, export increases the entire export container width to its `scrollWidth` (`script.js:6986-7004`, `script.js:7565-7567`).
7. **Manual page-break heuristic.** Code identifies every `img`, `svg`, `pre`, and `table`; repeatedly reads geometry; calculates synthetic A4 boundaries; and adds top margins to elements predicted to cross boundaries (`script.js:7011-7025`, `script.js:7034-7051`, `script.js:7060-7075`, `script.js:7143-7202`, `script.js:7242-7292`, `script.js:7302-7354`).
8. **Oversize mutation.** Elements taller than a synthetic page are CSS-transformed down, with a negative bottom margin. Scaling is clamped to 50%, after which the code explicitly warns content may be cut off (`script.js:7364-7418`, `script.js:7425-7454`).
9. **Monolithic raster capture.** html2canvas captures the *entire* export DOM into one canvas. Its `windowHeight` is the document's full `scrollHeight`; scale is 2.0, 1.5, or 1.25 according to a coarse pixel-area threshold (`script.js:6974-6979`, `script.js:7593-7603`).
10. **Raster page slicing.** The single canvas is sliced into one page canvas per A4 page. Every page slice is synchronously converted to a PNG data URL and embedded as an image in jsPDF (`script.js:7607-7633`).
11. **Download and cleanup.** jsPDF saves `document.pdf`; temporary UI and DOM state are removed (`script.js:7635-7649`, `script.js:6941-6962`).

### 1.2 Browser rendering and dependency graph

```text
Editor Markdown
  └─ main-thread marked.parse (export-only second parse)
      └─ DOMPurify sanitize
          └─ off-screen export DOM
              ├─ Mermaid lazy load + render (export-only replay)
              ├─ MathJax typeset (export-only replay)
              ├─ image/font/browser layout
              ├─ repeated geometry analysis and margin mutation
              └─ html2canvas full-document raster
                  └─ full-size canvas
                      └─ per-page canvas + PNG data URL
                          └─ jsPDF image-only pages
                              └─ document.pdf
```

Principal PDF dependencies are explicitly documented as html2canvas plus jsPDF (`README.md:183-194`; `wiki/FAQ.md:71-75`). The project documentation itself states that PDF differences are a known limitation of the html2canvas approach and recommends browser Print → Save as PDF for higher quality (`wiki/FAQ.md:144-146`).

### 1.3 Memory lifecycle

At peak, the current path can simultaneously retain:

- Markdown source and parsed/sanitized HTML strings;
- the full off-screen export DOM and rendered SVG/math subtrees;
- html2canvas's internal cloned/rendering structures;
- one full-document RGBA canvas (approximately `width × height × 4` bytes before implementation overhead);
- one page canvas;
- one base64 PNG string (base64 adds roughly one-third encoding overhead before JavaScript string overhead);
- jsPDF's accumulated image/PDF buffers.

This is an inferred peak-memory model from `script.js:7492-7509` and `script.js:7596-7631`. The browser or desktop webview's exact internal copies must be measured with heap and process-memory profiling.

### 1.4 Existing positive controls

The current implementation includes useful safeguards that should be preserved semantically during migration:

- lazy PDF dependency loading (`script.js:7473-7477`);
- single active export guard and disabled triggers (`script.js:6797-6799`, `script.js:6920-6937`, `script.js:7461-7467`);
- progress and ETA UI (`script.js:6841-6916`);
- cancellation checks between phases and pages (`script.js:6811-6829`, `script.js:7611-7633`);
- adaptive raster scale (`script.js:6974-6979`);
- cleanup in `finally` (`script.js:7640-7649`);
- PDF-specific table paint workarounds (`styles.css:1507-1545`).

The cancellation wrapper rejects the caller's wait, but it does not prove that html2canvas's underlying synchronous work stops. That is an inference requiring profiling (`script.js:6817-6829`, `script.js:7596-7603`).

---

## Section 2 — Agent Findings

### Agent 1 — Frontend Architect

**Independent findings**

- **Observed:** The PDF handler is embedded in the 8,887-line `script.js`, and it directly coordinates loading, parsing, rendering, layout, capture, PDF assembly, UI state, cancellation, and download (`script.js:6782-7650`). This is high coupling and prevents isolated testing.
- **Observed:** Normal preview has a worker-capable render pipeline, but PDF export calls `marked.parse` on the main thread (`preview-worker.js:330-354`, `script.js:7480-7487`).
- **Observed:** Export re-renders Mermaid and MathJax into a second DOM rather than consuming a stable export snapshot (`script.js:7512-7563`).
- **Inferred bottleneck:** Full-document capture and PNG conversion dominate for large documents; duplicate parse/render and repeated forced layout amplify the cost.
- **Recommendation:** Separate `ExportDocumentBuilder`, `AssetReadinessGate`, `PrintLayout`, and platform `PdfBackend` interfaces. The UI handler should only start/cancel a job and display progress.

**Agent 0 decision:** **Approved.** Coupling and duplicate work are directly supported by code. The relative share of each bottleneck remains a measurement item.

### Agent 2 — PDF Engine Specialist

**Independent findings**

- **Observed:** The engine creates one document-sized bitmap and then embeds a PNG for every page (`script.js:7596-7631`). Text, vector diagrams, and links therefore do not remain native PDF text/vector/link objects through this path.
- **Observed:** Page boundaries are simulated in CSS pixels before capture, then actual PDF slices are calculated from canvas dimensions and millimetres afterward (`script.js:7060-7075`, `script.js:7607-7621`).
- **Inferred root cause of slowness:** Work and memory scale with total rendered pixel area, while PNG encoding and PDF image compression add per-page CPU cost.
- **Inferred root cause of layout mismatch:** The pre-capture page model and post-capture slice model can diverge after width fitting, scaling, font/image completion, rounding, transforms, and margin mutation.
- **Recommendation:** Replace screenshot-to-PDF with Chromium's print compositor, preserving text/vector output and delegating pagination to a paged-media engine.

**Agent 0 decision:** **Approved.** This is the central architecture decision.

### Agent 3 — Performance Engineer

**Independent findings**

- **Observed:** Geometry is read for all target elements and the document is re-analysed up to ten times after style mutation (`script.js:7034-7051`, `script.js:7302-7345`).
- **Inferred:** Alternating geometry reads and margin writes can trigger repeated style/layout calculation; complexity is approximately `O(iterations × (targets + boundaries comparisons))`, with up to ten whole-document passes.
- **Observed:** `canvas.toDataURL('image/png')` is called inside the page loop on the main thread (`script.js:7623-7632`).
- **Observed:** `requestAnimationFrame` yields occur only between major phases/pages; they do not partition html2canvas capture, canvas draw, PNG encoding, or `addImage` internally (`script.js:6964-6968`, `script.js:7596-7603`, `script.js:7623-7632`).
- **Recommendation:** Profile long tasks, JS heap, DOM nodes, layout duration, canvas allocation, encode duration, and peak resident memory. Move generation out of the interactive renderer process where platform permits.

**Agent 0 decision:** **Approved with qualification.** Exact percentages and task durations are not yet measured.

### Agent 4 — Large Document Specialist

**Independent findings**

- **Observed:** No checked-in benchmark harness, fixture generator, browser automation suite, or PDF parser/visual comparator exists. `desktop-app/package.json` only contains setup/development/build scripts.
- **Observed environment limitation:** This investigation environment has no Chromium/Chrome/Firefox executable and no prepared desktop `libs` directory, so trustworthy 50/100/250/500/1000-page runs could not be executed.
- **Static scalability assessment:** One canvas whose height equals the full document (`script.js:7596-7603`) creates a hard scalability risk. html2canvas's official FAQ warns that empty or truncated output can occur when browser canvas-size limits are reached: <https://html2canvas.hertzen.com/faq.html>.
- **Recommendation:** Do not claim current timing numbers. Build deterministic fixtures and execute the matrix in Section 9 on representative low/mid/high hardware.

**Agent 0 decision:** **Approved.** Absence of measurements is explicitly recorded; no synthetic result is substituted.

### Agent 5 — Markdown Rendering Specialist

**Independent findings**

- **Observed:** Export does not reuse worker-rendered preview HTML; it reparses Markdown on the main thread (`script.js:7480-7487`).
- **Observed:** Mermaid and MathJax are replayed in the export DOM (`script.js:7512-7563`).
- **Observed:** Syntax highlighting occurs as part of code rendering (`preview-worker.js:306-320`), so the export parse may repeat highlighting work for every code block.
- **Inferred:** Image readiness is not represented by an explicit `Promise.all(img.decode())` gate before page analysis/capture. html2canvas may perform its own loading, but layout analysis can still precede final intrinsic image geometry.
- **Recommendation:** Build a single immutable export snapshot in a worker where possible, then await fonts, decoded images, Mermaid completion, Math completion, and two stable layout frames before print.

**Agent 0 decision:** **Approved.** The image-readiness gap is a code-level absence, while resulting failures require runtime fixtures.

### Agent 6 — Document Layout Engineer

**Independent findings**

- **Observed:** Only `img`, `svg`, `pre`, and whole `table` elements are protected by the manual algorithm (`script.js:7011-7025`). It does not model figures/captions, headings with following paragraphs, list items, blockquotes, alerts, table rows, widows, or orphans.
- **Observed:** “Page breaks” are implemented as accumulating `margin-top`, not semantic `break-before`/`break-inside` rules (`script.js:7274-7291`).
- **Observed:** A table larger than one page is scaled as one unit rather than fragmented by row; code blocks larger than one page are similarly scaled, with a 50% floor that can still cut content (`script.js:7364-7454`).
- **Observed:** After oversized transforms are applied, the code does not run a final full pagination stabilization before capture (`script.js:7569-7578`).
- **Inferred:** Mermaid handling targets nested SVGs and sometimes their parent, which can create duplicate/nested target interactions because both container descendants and other graphic nodes participate independently.
- **Recommendation:** Use print CSS and browser fragmentation: `break-inside: avoid-page` for atomic content that fits; allow controlled row/line fragmentation for oversized tables/code; repeat table headers; apply heading keep-with-next rules; never downscale body text/code to 50% merely to avoid a break.

**Agent 0 decision:** **Approved.** Browser support and exact oversized policies must be covered by cross-platform golden tests.

### Agent 7 — Obsidian Benchmark Researcher

**Independent findings**

- **Observed public facts:** Obsidian is proprietary; its production export implementation is not available for source inspection. The official organization publishes help and APIs, not the application source: <https://github.com/obsidianmd>.
- **Observed public ecosystem:** Community export plugins advertise either Electron `printToPDF` or Pandoc-based pipelines, demonstrating two common ecosystem strategies, but plugin claims are not evidence of Obsidian's internal implementation. Examples: <https://community.obsidian.md/plugins/advanced-pdf-export> and <https://github.com/mokeyish/obsidian-enhancing-export>.
- **Qualification:** Claims that Obsidian internally uses a specific print API are **unverified proprietary detail** and are excluded from the design rationale.
- **Benchmark lesson:** Match the rendered HTML with print-specific CSS, expose explicit page controls, and use a real print/PDF compositor; preserve a Pandoc/LaTeX route only for publication workflows that intentionally trade preview fidelity for typesetting control.

**Agent 0 decision:** **Approved with qualification.** No proprietary implementation inference is presented as fact.

### Agent 8 — VS Code & Typora Benchmark Researcher

**Independent findings**

- **Observed:** VS Code core does not provide a built-in Markdown-to-PDF architecture documented as such; comparison must be to extensions. The open-source `yzane/vscode-markdown-pdf` extension uses a Chromium-based browser and Puppeteer PDF options: <https://github.com/yzane/vscode-markdown-pdf>.
- **Observed:** As of its public 2.0.x documentation/release notes, that extension resolves installed Chrome/Edge/Chromium or a managed Chromium and includes unit/integration test suites. This is an open-source implementation fact, not a statement about VS Code core.
- **Observed:** Typora's official export documentation says its PDF is rendered from HTML, supports paper size/margins/theme/page-break/header/footer configuration, and also offers an optional Pandoc/LaTeX PDF route: <https://support.typora.io/Export/>.
- **Qualification:** Typora is proprietary. Public documentation establishes features and HTML-derived output, but not its private internal call graph or performance characteristics.
- **Recommendation:** Adopt the proven HTML → Chromium print path for fidelity, with configuration surfaces for paper/margins/background/header/footer, and maintain an optional future publication backend only if demanded.

**Agent 0 decision:** **Approved.** The VS Code comparison is correctly scoped to a named extension.

### Agent 9 — QA & Regression Engineer

**Independent findings**

- **Observed:** No automated PDF export tests are checked in. Existing documentation acknowledges visual differences and recommends browser printing (`wiki/FAQ.md:144-146`).
- **Observed:** Web and desktop share product sources through a copy/rewrite build step (`desktop-app/prepare.js:45-57`), but checked-in copies can drift until preparation runs.
- **Required regression baseline:** Markdown constructs, theme colors, GitHub alerts, local/remote images, SVG, Mermaid, MathJax, syntax highlighting, rowspan/colspan tables, links, Unicode, emoji, page size, margins, and cancellation.
- **Recommendation:** Use structural PDF assertions plus visual golden pages and semantic extraction checks. Compare legacy and new output on a frozen corpus before removal of the fallback.

**Agent 0 decision:** **Approved.** A two-layer visual and semantic test strategy is mandatory.

### Agent 10 — Desktop Platform Engineer

**Independent findings**

- **Observed:** Desktop is Neutralino 6.5.0 in window mode, not Electron (`desktop-app/neutralino.config.json:1-10`, `desktop-app/neutralino.config.json:27-44`, `desktop-app/neutralino.config.json:60-66`).
- **Observed:** Desktop receives the same `script.js`, worker, styles, and assets from the web root during preparation (`desktop-app/prepare.js:45-57`). Therefore it currently executes the same raster engine in its webview.
- **Observed:** The current native allow list includes file and dialog APIs but no process-launching capability (`desktop-app/neutralino.config.json:16-25`).
- **Platform conclusion:** Electron `webContents.printToPDF` cannot simply be called from this application. A desktop background exporter requires either (a) a Neutralino extension/sidecar with a controlled Chromium/DevTools Protocol backend, (b) a supported native print-to-PDF API exposed by the selected webview platform, or (c) a desktop-shell migration, which is not justified solely for PDF export without a separate product decision.
- **Recommendation:** Prefer a narrowly scoped sidecar/extension backend and keep the interactive renderer responsive. Do not migrate the whole desktop shell as part of this PDF program.

**Agent 0 decision:** **Approved.** This resolves a disagreement with agents proposing direct Electron use.

---

## Section 3 — Performance Bottleneck Analysis

### 3.1 Critical path

| Stage | Current behavior | Scaling/risk | Priority |
|---|---|---|---|
| Parse/sanitize | Duplicate main-thread parse | Document size and code blocks | Medium |
| Mermaid/math | Duplicate export rendering | Number/complexity of diagrams/equations | Medium–high |
| Layout heuristic | Up to 10 geometry/mutation passes | Targets × pages × iterations | High |
| Full capture | One document-height canvas | Total pixel area | Critical |
| Page slicing | Canvas allocation/draw per page | Pages × page pixels | High |
| PNG encoding | `toDataURL` per page | Pages and image entropy | Critical |
| jsPDF assembly | Full-page PNG per page | Pages and compressed bytes | High |
| UI execution | Interactive renderer/main thread | Long tasks and freeze risk | Critical |

### 3.2 Why 10–15 minute exports are plausible

This duration is a user-reported symptom, not reproduced in this environment. It is technically plausible because the pipeline performs several total-document operations and produces high-resolution raster pages. At A4 proportions, doubling capture scale approximately quadruples pixel count. A long document can therefore create hundreds of millions of pixel operations, large transient allocations, repeated PNG compression, and garbage-collection pressure.

### 3.3 Responsiveness defects

- The progress overlay does not make synchronous capture or encoding non-blocking.
- `AbortController` checks cannot preempt a library while it is executing synchronous work.
- The desktop webview shares the same renderer workload as the UI.
- No backpressure, page streaming, worker-owned OffscreenCanvas path, or child-process isolation exists.

### 3.4 Instrumentation required before implementation acceptance

Record per phase: wall time, CPU time where available, long tasks over 50 ms, peak JS heap, peak process resident set, DOM-node count, layout/style duration, canvas dimensions/bytes, output bytes, page count, and cancellation latency. Include hardware/OS/browser versions and cold/warm dependency state.

---

## Section 4 — Layout Quality Analysis

### 4.1 Images and Mermaid

Current logic predicts crossings and pushes elements with margins. This can work for some atomic graphics, but it is fragile because pagination is not performed by the same engine that later slices pages. Oversized content is transformed rather than semantically paginated, and the 50% clamp admits cut-off output (`script.js:7374-7387`). Mermaid is rasterized as part of the page image, losing vector scalability.

### 4.2 Code blocks

A `pre` that fits is pushed to a later synthetic page; a taller `pre` is scaled as a whole. Professional behavior should be policy-driven:

- keep short code blocks atomic;
- allow oversized blocks to fragment between lines;
- repeat an optional code caption/header, not the whole block;
- preserve readable font size;
- show an explicit continuation marker only if product design approves it.

### 4.3 Tables

Whole-table avoidance is unsuitable for multi-page tables. The target behavior is row-boundary fragmentation, repeated `<thead>`, avoidance within ordinary rows, controlled splitting only for an individually oversized row, and preservation of rowspan/colspan semantics. Existing cell-background workarounds show that raster capture already has table-specific fidelity issues (`styles.css:1511-1545`).

### 4.4 Complex flow

Current targeting omits heading keep-with-next, figures with captions, alerts, blockquotes, lists, widows/orphans, footnotes, and user-inserted semantic page breaks. Chromium paged media supports `@page` and fragmentation controls; MDN documents `break-before`, `break-after`, `break-inside`, `orphans`, and `widows`: <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Paged_media> and <https://developer.mozilla.org/en-US/docs/Web/CSS/break-inside>.

### 4.5 Important limitation

No engine can keep an element taller than the printable page entirely unbroken. “Prevent splitting” must mean:

1. avoid splitting atomic content that fits on one page;
2. apply an explicit, tested fallback for oversized content (scale graphics within a readable bound, rotate/select landscape where allowed, or fragment at semantic boundaries);
3. never silently clip.

---

## Section 5 — Industry Benchmark Findings

| Product/project | Publicly established approach | Useful technique | Qualification |
|---|---|---|---|
| Obsidian | Proprietary app; community plugins use Electron print or Pandoc | Print-specific styling; plugin ecosystem demonstrates demand for page controls | Internal native pipeline not publicly verified |
| Typora | Official docs: PDF rendered from HTML; configurable page size, margins, theme, breaks, header/footer; optional Pandoc/LaTeX | HTML print fidelity plus advanced alternate backend | Proprietary internals/performance unknown |
| VS Code Markdown PDF extension | Open-source Chromium/Puppeteer exporter | Installed/managed Chromium, `page.pdf`, configurable PDF options, tests | Extension, not VS Code core |
| MarkText | Open-source Electron Markdown editor with PDF output | Relevant codebase for implementation comparison | Repository feature claim alone does not establish current performance |
| Zettlr | Open-source Pandoc/LaTeX-centered publication workflow | AST/toolchain separation and templates | Different fidelity/performance trade-off from WYSIWYG print |
| Chromium/Puppeteer | Native paged PDF compositor with page size, margins, background, headers/footers, CSS page-size preference, font waiting | Vector text, browser pagination, accessibility options | Requires browser/native backend; not silently available to ordinary web pages |
| html2canvas | DOM-to-canvas renderer with documented canvas/CORS constraints | Useful for screenshots, not ideal as the primary long-document PDF engine | Official FAQ warns about canvas limits |

### Source-backed standards and APIs

- Puppeteer PDF options include format, margins, background, header/footer, CSS page-size preference, tagged PDF, and font waiting: <https://pptr.dev/api/puppeteer.pdfoptions>.
- Electron exposes `webContents.printToPDF`, but this repository does not use Electron: <https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions>.
- Chrome DevTools Protocol provides browser instrumentation used by automation tools: <https://chromedevtools.github.io/devtools-protocol/>.
- CSS Paged Media and Fragmentation are the standards-based pagination model: <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Paged_media>.
- Zettlr publicly states that Pandoc is expected for import/export and exposes publication templates: <https://github.com/Zettlr/Zettlr> and <https://github.com/Zettlr/pandoc-templates>.
- MarkText publicly identifies itself as an Electron Markdown editor with HTML/PDF output: <https://github.com/marktext/marktext>.

### Industry conclusion

The recurring proven patterns are:

1. create deterministic HTML;
2. load all dependent assets before pagination;
3. apply dedicated print CSS;
4. let a browser print compositor or publication engine paginate;
5. isolate heavy work from the interactive renderer;
6. test PDFs structurally and visually;
7. avoid turning every page into a high-resolution screenshot unless image output is specifically requested.

---

## Section 6 — Root Cause Analysis

### Primary root cause

**The current engine treats a document as one giant screenshot and treats a PDF as a stack of PNG images.** This is fundamentally mismatched to long, structured, paginated documents.

### Contributing causes

1. **Monolithic full-document canvas:** memory and CPU follow pixel area and browser canvas limits.
2. **Main-thread execution:** capture, drawing, PNG encoding, and assembly compete with UI responsiveness.
3. **Two pagination coordinate systems:** synthetic CSS-pixel breaks precede millimetre-derived canvas slicing.
4. **Layout mutation heuristic:** repeated geometry reads and margin writes are expensive and unstable.
5. **Duplicate render path:** export reparses and rerenders Markdown, Mermaid, math, and highlighting.
6. **Incomplete readiness contract:** no explicit unified gate for fonts, images, diagrams, and stable layout.
7. **Wrong oversized-content policy:** scale-to-fit can harm readability and still clip.
8. **No platform abstraction:** web and desktop run the same implementation despite different native capabilities.
9. **No performance/visual acceptance harness:** regressions and target claims cannot be objectively enforced.
10. **Single-file orchestration:** tightly coupled code inhibits isolated tests and incremental backend replacement.

### Rejected explanations

- **“jsPDF alone is slow.”** Incomplete: jsPDF contributes assembly cost, but full canvas capture and per-page PNG encoding are upstream critical costs.
- **“Mermaid alone causes the freeze.”** Incomplete: diagrams add work, but plain long text still traverses the monolithic raster path.
- **“Add more `requestAnimationFrame` calls.”** Rejected as a primary fix: yielding around indivisible synchronous operations does not reduce their cost or memory.
- **“Only lower canvas scale.”** Rejected: this trades quality for capacity while retaining the flawed architecture.
- **“Use Electron directly.”** Rejected for this repository: desktop is Neutralino, not Electron.

---

## Section 7 — New PDF Export Architecture

### 7.1 Approved target architecture

```text
ExportJobController (UI contract only)
  ├─ cancellation / progress / telemetry
  └─ ExportDocumentBuilder
       ├─ worker-based Markdown parse and sanitize
       ├─ export-only immutable HTML document
       ├─ deterministic IDs and metadata
       └─ AssetReadinessGate
            ├─ document.fonts.ready
            ├─ img.decode() / error policy
            ├─ Mermaid render completion
            ├─ Math render completion
            └─ stable-layout check
                 └─ PrintLayout stylesheet
                      ├─ @page size/margins
                      ├─ break rules
                      ├─ table fragmentation/repeated headers
                      ├─ code and graphic oversized policies
                      └─ light/dark/background policy
                           └─ PdfBackend
                                ├─ WebPrintBackend
                                ├─ DesktopChromiumSidecarBackend
                                └─ LegacyRasterBackend (temporary fallback only)
```

### 7.2 Shared export document builder

- Must not modify editor, preview, toolbar design, search, tabs, themes, settings, or non-PDF Markdown behavior.
- Consumes Markdown plus a frozen set of PDF options.
- Reuses parsing modules/worker logic, but has export-only extensions and CSS.
- Produces a complete isolated document (prefer sandboxed iframe/blob URL in web; temporary local HTML in desktop).
- Resolves local images through a platform resource resolver and enforces a clear CORS/error policy.
- Emits readiness and diagnostic events instead of inspecting the live preview DOM.

### 7.3 Print layout policy

- `@page { size: A4; margin: 15mm; }` by default, configurable through existing/new PDF-only options when product scope permits.
- `break-inside: avoid-page` for images, figures, Mermaid containers, short `pre`, ordinary table rows, alerts, and other atomic blocks.
- `break-after: avoid-page`/keep-with-next strategy for headings.
- `orphans` and `widows` for paragraphs where supported.
- Tables may span pages; `<thead>` repeats; whole-table avoidance is prohibited for long tables.
- Oversized graphics scale to printable width/height with a documented minimum readability threshold and no silent clipping.
- Oversized code blocks fragment at line boundaries instead of shrinking to 50%.
- Print CSS owns pagination; no pixel-coordinate margin insertion algorithm remains in the final engine.

### 7.4 Web backend

A normal web page cannot silently write a PDF using Chromium's privileged `printToPDF` API. Therefore:

- **Default privacy-preserving client path:** open an isolated prepared export document and invoke browser print, where the user selects “Save as PDF.” This is standards-based, vector-capable, and already recommended by project documentation (`wiki/FAQ.md:73-75`, `wiki/FAQ.md:144-146`).
- **Optional managed-service path:** only if product requirements demand one-click file download, send the prepared HTML/assets to a controlled headless-Chromium service. This changes the current all-client privacy model and requires explicit security/privacy approval; it is not approved by this report.
- Keep the old raster download behind a temporary compatibility flag during migration, clearly labelled as legacy and unsuitable for very large documents.

### 7.5 Desktop backend

- Implement a narrowly scoped Neutralino extension/sidecar that launches or communicates with a pinned/validated Chromium-compatible executable using Puppeteer Core or Chrome DevTools Protocol.
- Generate in a separate process, stream progress/logs, enforce timeout and cancellation by terminating the job process, write to a temporary file, then atomically move to the user-selected destination.
- Package or resolve the browser deterministically and record its version. Prefer installed compatible Chrome/Edge/Chromium with an approved managed fallback, similar in principle to the open-source VS Code Markdown PDF extension.
- Do not expose arbitrary process execution to page content. The extension accepts a constrained export request schema and whitelisted paths.
- Do not migrate the whole app to Electron for this feature.

### 7.6 Output characteristics

Expected qualitative improvements:

- selectable/searchable text;
- vector SVG/Mermaid where Chromium preserves it;
- functional hyperlinks where supported;
- browser-native font shaping and pagination;
- much lower peak raster memory;
- no per-page PNG encoding loop;
- semantic page fragmentation;
- desktop cancellation that can terminate actual work.

Tagged/accessibility output must be tested rather than assumed. Puppeteer exposes a tagged-PDF option, but semantic quality depends on source HTML and Chromium behavior.

---

## Section 8 — Implementation Plan

### Phase 0 — Baseline and decision records

1. Add architecture decision record selecting browser print composition over raster PDF.
2. Freeze a representative PDF corpus and legacy outputs.
3. Add telemetry hooks around the existing path before replacement.
4. Define supported browsers/desktop OS versions and output fidelity rules.
5. Define privacy decision: client print only for web unless separately approved.

**Exit gate:** reproducible baseline and agreed acceptance thresholds.

### Phase 1 — Modular export document builder

1. Extract PDF orchestration from `script.js` into PDF-only modules without changing behavior.
2. Reuse worker parsing/highlighting logic through shared pure functions.
3. Add isolated export document creation and resource resolution.
4. Add `AssetReadinessGate` for fonts, decoded images, Mermaid, math, and layout stability.
5. Preserve progress, cancellation, theme, GitHub alerts, and sanitation behavior.

**Exit gate:** generated export HTML is deterministic and fixture-tested.

### Phase 2 — Standards-based print layout

1. Create PDF-only print stylesheet.
2. Implement block policies for images, Mermaid, tables, code, headings, alerts, lists, and oversized content.
3. Remove manual margin insertion from the new backend.
4. Add page-size/margin/background/header/footer schema as PDF-only options if approved.

**Exit gate:** golden pagination corpus passes in pinned Chromium.

### Phase 3 — Web print backend

1. Create sandboxed export iframe/window from the prepared document.
2. Show a clear “Preparing” → “Ready to print” progression.
3. Invoke print only after readiness.
4. Ensure cleanup after `afterprint`, cancellation, or timeout.
5. Keep legacy direct-download fallback during controlled rollout.

**Exit gate:** supported browsers export without UI lockups in the test matrix.

### Phase 4 — Desktop sidecar backend

1. Define minimal request/response protocol.
2. Implement constrained Neutralino extension/sidecar.
3. Resolve/pin Chromium and generate with `preferCSSPageSize`, `printBackground`, font waiting, and configured margins.
4. Add hard cancellation, crash isolation, temporary-file cleanup, and atomic save.
5. Package and sign per platform.

**Exit gate:** desktop matrix passes and UI remains responsive during 1000-page generation.

### Phase 5 — Cutover and retirement

1. Run dual-backend comparison in development/QA.
2. Roll out new backend behind a PDF-only feature flag.
3. Monitor failures, duration, peak memory, and cancellations without collecting document content.
4. Make new backend default after gates pass.
5. Remove html2canvas/jsPDF PDF dependencies and manual pagination only after fallback retirement approval.

**Explicit non-goals:** no editor, preview, toolbar layout, search, tab, theme system, settings system, or non-export Markdown behavior redesign.

---

## Section 9 — Performance Validation Plan

### 9.1 Required fixture matrix

Generate deterministic documents that produce approximately 50, 100, 250, 500, and 1000 A4 pages in each profile:

1. text/headings/lists;
2. syntax-highlighted code;
3. large and numerous images;
4. Mermaid diagrams;
5. MathJax expressions;
6. wide and long tables with rowspan/colspan;
7. mixed “real-world worst case.”

Use local assets for repeatability and a separate remote/CORS reliability suite.

### 9.2 Metrics

For every run capture:

- prepare, render, readiness, paginate/print, write, and total duration;
- p50/p95 over at least five warm runs plus one cold run;
- renderer long-task count and maximum long task;
- UI heartbeat/input latency during export;
- peak JS heap and process RSS;
- child-process peak RSS for desktop;
- output size and page count;
- cancellation latency at each phase;
- failures, blank pages, clipped content, missing assets, and PDF parser errors.

### 9.3 Target gates

Targets must be tied to fixture definitions and reference hardware:

- **Small (≤10 pages, ordinary content):** under 2 seconds on reference desktop backend; web preparation under 2 seconds before print UI.
- **Medium (≤50 pages):** under 5 seconds on reference desktop backend.
- **Large (≤250 pages mixed):** under 15 seconds on reference desktop backend, excluding remote asset download.
- **Very large (500/1000 pages):** no UI freeze; heartbeat gaps under 100 ms in the interactive app; bounded memory with no crash; report actual completion time rather than promise under 15 seconds without evidence.
- **Cancellation:** UI acknowledges within 100 ms; desktop job process terminates and cleans temporary files within 2 seconds.

The user's “large <15 seconds” goal is adopted for a defined ≤250-page reference workload. A universal 1000-page <15-second promise is not approved without benchmark evidence.

### 9.4 Test hardware and platforms

- Low: 4 logical cores, 8 GB RAM.
- Reference: 8 logical cores, 16 GB RAM, SSD.
- High: 12+ logical cores, 32 GB RAM.
- Windows 11, current supported macOS, Ubuntu LTS.
- Current stable Chrome/Edge plus one previous supported major for web; pinned desktop Chromium version.

### 9.5 Comparative runs

Run legacy raster and new backend on 50/100/250 pages where legacy completes safely. Do not force 500/1000 legacy runs after memory safety thresholds are exceeded. Report speedup as measured ratios, not projections.

---

## Section 10 — Regression Prevention Plan

### 10.1 Test layers

1. **Unit:** option normalization, resource URL resolution, break-policy classification, readiness timeout/error handling, cancellation state machine.
2. **HTML snapshot:** deterministic export DOM for every Markdown feature.
3. **Browser integration:** render and print with pinned Chromium.
4. **PDF structural:** page count, media box, metadata, text extraction, link annotations, embedded fonts, image presence, no corrupt objects.
5. **Visual regression:** render selected PDF pages to images and compare with perceptual thresholds plus masked dynamic areas.
6. **Cross-platform end-to-end:** web print flow and desktop save flow.
7. **Performance budgets:** fail CI/nightly gates on statistically significant regression.

### 10.2 Frozen corpus

Include headings, paragraphs, emphasis, links, task lists, nested lists, blockquotes, GitHub alerts, footnotes if supported, code languages, math, Mermaid types, SVG/raster images, transparent images, very wide images, large images, tables, rowspan/colspan, Unicode/RTL/CJK/emoji, light/dark export policy, and malformed/missing assets.

### 10.3 Compatibility controls

- Compare the new export against the current preview and legacy PDF, but treat documented html2canvas defects as defects to fix—not golden behavior to preserve.
- Preserve sanitation and no-network/default privacy expectations.
- Version the export request schema and print stylesheet.
- Pin desktop Chromium and update it through security-reviewed releases.
- Keep output diagnostics free of document content by default.
- Require Agent 0/architecture owner approval before removing the legacy fallback.

---

## Section 11 — Web Verification

### Supported workflow to verify

1. Load each fixture through the normal web application.
2. Start PDF export and confirm editor input remains responsive during preparation.
3. Verify the export document is isolated and does not mutate preview/editor DOM.
4. Confirm fonts, local images, permitted remote images, Mermaid, math, and highlighting are complete before print opens.
5. Use Chrome/Edge “Save as PDF”; verify page size, margins, backgrounds, page count, text selection, links, and layout.
6. Repeat cancellation before readiness and close/after-print cleanup.
7. Test offline behavior with cached/local dependencies.
8. Test CORS failures and missing assets with explicit warnings rather than silent omission.

### Browser-specific acceptance

- Chromium browsers are the reference because desktop generation also uses Chromium pagination.
- Firefox/Safari must be tested for the web print flow; documented pagination differences may require browser-specific print CSS or a support limitation.
- One-click silent file save is not a web acceptance criterion because it is not available to ordinary page JavaScript.

### Current verification status

**Static review complete; runtime verification pending.** This environment had no browser executable and no test harness. The repository currently recommends browser Print → Save as PDF for higher quality (`wiki/FAQ.md:73-75`, `wiki/FAQ.md:144-146`), supporting feasibility but not replacing formal tests.

---

## Section 12 — Desktop Verification

### Desktop-specific workflow

1. Run `desktop-app/prepare.js` and verify web PDF modules/styles are copied exactly.
2. Launch Neutralino packages on Windows/macOS/Linux.
3. Confirm the sidecar accepts only the constrained export schema and approved paths.
4. Generate every fixture with pinned/resolved Chromium.
5. Monitor UI renderer and sidecar separately for CPU/RSS.
6. Cancel during parse, asset load, layout, print, and file write.
7. Kill/crash the sidecar and verify recovery, diagnostics, and temp-file cleanup.
8. Verify native save dialog, overwrite behavior, permissions, long paths, Unicode paths, read-only destinations, and disk-full errors.
9. Verify offline export and package integrity/signing.
10. Confirm output parity with the reference web Chromium print layout.

### Current platform facts

Neutralino configuration identifies version 6.5.0, window mode, and the existing native API allow list (`desktop-app/neutralino.config.json:1-25`, `desktop-app/neutralino.config.json:27-44`, `desktop-app/neutralino.config.json:60-66`). Shared root sources are copied into desktop resources during preparation (`desktop-app/prepare.js:45-57`). Thus current desktop export has the same performance architecture as web, while the proposed desktop backend must be added as a constrained platform service.

### Current verification status

**Static review complete; runtime verification pending.** No Neutralino binaries, browser engine executable, prepared offline libraries, or GUI test capability were available in this checkout environment.

---

## Section 13 — Chief PDF Platform Architect Final Recommendation

### Is the current PDF engine fundamentally flawed?

**Yes, for the stated enterprise and large-document goals.** It is a competent small-document screenshot exporter with progress, cancellation checks, and several targeted workarounds, but its core full-document raster model is fundamentally unsuitable for scalable, high-fidelity paginated documents.

### Is a rewrite justified?

**Yes—a bounded PDF-subsystem rewrite is justified.** Do not rewrite the editor or preview. Replace PDF orchestration, print layout, and backends behind a narrow interface. Preserve the current engine temporarily as a fallback until regression and performance gates pass.

### What architecture should replace it?

A shared deterministic export-document builder plus asset-readiness gate and dedicated print stylesheet, feeding:

- a standards-based browser print backend for web; and
- an isolated Neutralino sidecar/extension using pinned/resolved Chromium PDF generation for desktop.

Chromium paged-media composition—not html2canvas plus per-page PNGs—is the approved primary engine. Pandoc/LaTeX is not the default because it risks diverging from current rendered Markdown, but it may be evaluated later as an optional publication backend under separate scope.

### What performance improvements are expected?

Expected, pending measurement:

- elimination of the full-document RGBA canvas and per-page PNG data URLs;
- elimination of repeated manual page-boundary stabilization in the new path;
- lower main-renderer CPU and memory;
- selectable vector/text output with smaller files for text-heavy documents;
- desktop UI responsiveness through process isolation;
- material speedups likely to be multiple-fold on long text-heavy documents.

No numeric speedup is approved until Section 9 benchmarks run. The program accepts <2 s small, <5 s medium, and <15 s defined large targets, with responsiveness rather than an unsubstantiated fixed deadline for 500/1000 pages.

### How will layout quality improve?

- The same Chromium engine will paginate and emit the PDF, eliminating the current split between synthetic page coordinates and raster slicing.
- Print CSS will express semantic break policies.
- Images and Mermaid that fit will remain atomic; oversized graphics will use explicit no-clip policy.
- Short code blocks remain atomic; oversized code fragments at line boundaries without unreadable global shrink.
- Tables fragment by rows with repeatable headers rather than being treated as one giant image.
- Text, links, and supported SVG remain native rather than page-wide PNG pixels.

### Approved guardrails

1. Strictly PDF-only product changes.
2. No proprietary-app behavior asserted without public evidence.
3. No replacement library selected solely by anecdote.
4. No removal of fallback before objective regression gates.
5. No web server upload/backend without separate privacy/security approval.
6. No whole-desktop migration to Electron solely for PDF.
7. No performance claim without reproducible fixtures and environment metadata.

## Final Status: **APPROVED FOR IMPLEMENTATION**

Approval covers the phased architecture and validation program in this report. It does **not** approve immediate deletion of the legacy exporter, a server-side web export service, or a desktop-shell migration. Production cutover remains conditional on the 50/100/250/500/1000-page performance and regression gates.

### Changed paths

- `docs/pdf-export-engine-reengineering-report.md` — investigation and approved architecture report only.
