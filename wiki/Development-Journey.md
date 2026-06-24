# Project Development Journey

This page documents the development history, design decisions, and evolution of **Markdown Viewer** from its initial prototype to the current production release (v3.8.0).

---

## Chronological Project Evolution

Markdown Viewer was built to address a common need: a fast, privacy-focused Markdown editor that renders rich formatting, math equations, and diagrams client-side without relying on external databases.

```
+------------------------------------+
|  Phase 1: Basic Renderer (V0.1)     |
|  - Simple textarea & Marked parser |
|  - High typing lag on large files  |
+-----------------+------------------+
                  |
                  v
+------------------------------------+
|  Phase 2: Off-Thread Parser (V0.5) |
|  - Shifted parsing to Web Worker   |
|  - Added basic highlight.js syntax |
+-----------------+------------------+
                  |
                  v
+------------------------------------+
|  Phase 3: Patching & Features (V1.0)|
|  - Incremental DOM patching        |
|  - MathJax & Mermaid integrations  |
|  - Multi-document tab bar added    |
+-----------------+------------------+
                  |
                  v
+------------------------------------+
|  Phase 4: Release & Desktop (V3.8.0)|
|  - Cascade PDF layout pagination   |
|  - Neutralinojs desktop app wrap   |
|  - Service Worker offline cache    |
+------------------------------------+
```

---

## Detailed Version Comparison

To see the differences in user interface design, rendering performance, and feature set, you can compare the original prototype with the current production build:

| Target Area | Initial Prototype (Original V0.1) | Current Production Release (v3.8.0) |
| :--- | :--- | :--- |
| **Hosting Link** | [a1b91221.markdownviewer.pages.dev](https://a1b91221.markdownviewer.pages.dev/) | [markdownviewer.pages.dev](https://markdownviewer.pages.dev/) |
| **Parsing Thread** | Main UI Thread (blocked typing) | Dedicated Background Web Worker |
| **DOM Rendering** | Full `innerHTML` write (slow reflow) | Incremental FNV-1a Hash DOM Patching |
| **Scroll Sync** | Basic scroll mapping (caused loops) | Locked `requestAnimationFrame` Sync |
| **Diagram Support** | None (code text only) | Interactive Mermaid SVGs with Zoom & Pan |
| **Math Typesetting** | None | LaTeX MathJax rendering with accessibility cleanup |
| **Tabbed Sessions** | Single document | Drag-and-drop tab bar with localStorage autosave |
| **Export Formats** | Raw Markdown only | Markdown, Standalone HTML, and sandboxed PDF |
| **App Wrapper** | Browser only | NeutralinoJS Desktop Application shell |
| **Offline Mode** | No (required online refresh) | PWA Service Worker caching (Cache-First) |
| **File Import** | None | Drag & drop file parser and GitHub repo importer |

---

## Key Development Milestones

### 1. Moving to Background Web Workers
Early testing with files larger than 10 KB showed noticeable typing lag because the main thread had to compile Markdown and highlight syntax on every keystroke. 
Moving the parser to `preview-worker.js` resolved this. The main thread now only processes user input and patches the DOM, while the background worker handles document compilation and syntax highlighting.

### 2. Upgrading to Incremental DOM Patching
Using `element.innerHTML` on every keystroke caused the browser to rebuild the entire preview pane. This reset scroll positions, cleared focus states, and collapsed elements like `<details>` blocks. 
To fix this, we implemented an FNV-1a hash matching system. The app now compares hashes of incoming blocks and only replaces the DOM nodes that have changed, preserving the overall page state.

### 3. Preventing Scroll Synchronization Loops
Initially, syncing scrolls between the editor and preview created an infinite feedback loop. 
We resolved this by adding scroll locks (`isEditorScrolling` and `isPreviewScrolling`) combined with scheduling scroll updates inside `requestAnimationFrame`. This ensures scroll sync is smooth and loop-free.

### 4. Implementing Cascade PDF Layout Pagination
Default PDF exports often slice images, diagrams, and text lines across page breaks. 
We addressed this by building a cascade pagination engine in an off-screen sandbox. It converts SVG diagrams to rasters, pushes headings below page breaks, splits tables row-by-row while duplicating the headers, and downscales oversized elements to fit the page.

---

## Transparency & Data Policies

*   **100% Client-Side Processing:** All text parsing, diagram generation, mathematical typesetting, and file exports happen inside the client browser. No document data is ever sent to an external server.
*   **Encrypted Hash Links:** The URL sharing feature uses local zlib/deflate compression via `Pako.js`. The compressed document is stored entirely in the URL hash fragment. Because hash fragments are not sent to servers in HTTP requests, your shared content remains private.
*   **Security Auditing:** External dependencies (DOMPurify, Marked.js, etc.) are loaded with subresource integrity (SRI) hashes to prevent loading modified scripts.
