# Detailed Features & Implementation Deep Dive

This document details the features of **Markdown Viewer**, focusing on their architectural execution, performance strategies, and code-level configurations for version v3.8.0.

---

## Table of Contents

1.  [Off-Thread Web Worker Parser](#1-off-thread-web-worker-parser)
2.  [Segmented DOM Patching Engine](#2-segmented-dom-patching-engine)
3.  [Ratio-Based Proportional Scroll Synchronization](#3-ratio-based-proportional-scroll-synchronization)
4.  [LaTeX Mathematical Typesetting](#4-latex-mathematical-typesetting)
5.  [Interactive Mermaid Diagrams with Drag-to-Pan](#5-interactive-mermaid-diagrams-with-drag-to-pan)
6.  [Cascade PDF Layout Pagination Sandbox](#6-cascade-pdf-layout-pagination-sandbox)
7.  [Multi-Document Session Persistence & Drag Reordering](#7-multi-document-session-persistence--drag-reordering)
8.  [Binary Safety Gutter & Multi-File Importer](#8-binary-safety-gutter--multi-file-importer)
9.  [Serverless Sharing via Compressed Hash Fragments](#9-serverless-sharing-via-compressed-hash-fragments)
10. [Performance, Security, and UI Variables](#10-performance-security-and-ui-variables)

---

## 1. Off-Thread Web Worker Parser

To prevent typing lag and main-thread blocks, Markdown Viewer offloads compilation to a background Web Worker (`preview-worker.js`).

### Size-Aware Debouncing
The main thread throttles render requests based on the character length of the active document to conserve CPU cycles:
*   **Small Documents (<10 KB):** 80ms render debounce.
*   **Medium Documents (10 KB - 50 KB):** 150ms render debounce.
*   **Large Documents (>50 KB):** 300ms render debounce.

### Segmented Worker Parsing
1.  **Block Splitting:** The worker splits incoming markdown strings by double-newlines (`\n\n`) while respecting boundary exclusions (like block math `$$` and code fences ` ``` `).
2.  **FNV-1a Alphanumeric Hashing:** For each block, the worker computes a 32-bit FNV-1a hash. This is a non-cryptographic hash function designed for speed:

    $$H_i = (H_{i-1} \oplus d_i) \times p$$

    where $p = 16777619$ (FNV prime) and $H_0 = 2166136261$ (offset basis).
3.  **Selective Compilation:** If the document doesn't use complex global footnotes or reference-style declarations, the worker compiles only changed blocks using `marked.js` and `highlight.js`. It returns an array of compiled HTML strings paired with their FNV-1a hashes.

---

## 2. Segmented DOM Patching Engine

Updating the entire preview pane using `element.innerHTML` causes layout repaints, resets scrollbar offsets, wipes focus states, and collapses open toggle elements (like `<details>`). Markdown Viewer employs a custom patching controller:

### Patching Algorithm
1.  **Hash Comparison:** The main thread compares the hashes of the incoming HTML block array against the child nodes of the preview pane.
2.  **Targeted Replacement:**
    *   If a node's hash matches, it is skipped.
    *   If a node's hash differs, the script replaces the corresponding child node in place using `replaceWith()`.
    *   If the new array has more elements, new nodes are appended.
    *   Extra trailing nodes are pruned.
3.  **Layout Containment:** Every block is wrapped in a `<section>` container configured with modern CSS rules:
    ```css
    content-visibility: auto;
    contain-intrinsic-size: auto 220px;
    ```
    This instructs the browser's layout engine to bypass formatting and rendering of off-screen markdown sections, reducing repaint and reflow overhead.

---

## 3. Ratio-Based Proportional Scroll Synchronization

When editing in **Split View**, scrolling the editor textarea scrolls the HTML preview pane proportionally, and vice versa.

### Math Formula
Proportional scrolling is mapped using the scroll ratio:

$$R_{\text{scroll}} = \frac{\text{scrollTop}}{\text{scrollHeight} - \text{clientHeight}}$$

The target container's scroll position is then calculated as:

$$\text{Target-scroll-top} = R_{\text{scroll}} \times (\text{Target-scroll-height} - \text{Target-client-height})$$

### Feedback Loop Prevention
Since scrolling the target pane triggers its own scroll events, this can create an infinite update loop. To prevent this:
*   The application implements state locks: `isEditorScrolling = true` and `isPreviewScrolling = true`.
*   Scroll coordinates are updated within `requestAnimationFrame()`.
*   A 50ms timeout releases the locks after scrolling stops.

---

## 4. LaTeX Mathematical Typesetting

LaTeX parsing uses **MathJax** loaded dynamically from a CDN.

### Scanning and Typesetting
*   The controller scans inputs using a regex test: `/\$\$|\$[^$]|\\\(|\\\[/`.
*   If math markers are detected, the MathJax libraries are fetched.
*   Once loaded, equations are rendered by calling:
    ```javascript
    MathJax.typesetPromise([previewElement]);
    ```

### Accessibility Post-Processing
By default, MathJax appends assistive MathML containers (`<mjx-assistive-mml>`) with `tabindex="0"`. This interrupts keyboard tab order. A post-processing script runs after typesetting:
1.  It queries all `<mjx-assistive-mml>` tags in the preview.
2.  It removes the `tabindex` attribute from each element.
3.  These assistive nodes are hidden or stripped prior to PDF canvas capture to prevent overlapping text.

---

## 5. Interactive Mermaid Diagrams with Drag-to-Pan

Mermaid code blocks are rendered as SVG diagrams with custom interactive features.

### Floating Action Toolbar
Every rendered Mermaid diagram is wrapped in a container that appends a floating toolbar with four actions:
1.  **Zoom modal:** Opens the diagram in a full-screen interactive modal.
2.  **Download PNG:** Captures the SVG, draws it to a canvas element, and downloads it.
3.  **Download SVG:** Serializes the SVG XML nodes and triggers a browser download.
4.  **Copy Image:** Renders the diagram as a PNG blob and copies it to the system clipboard using the asynchronous Clipboard API:
    ```javascript
    navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob })
    ]);
    ```

### Drag-to-Pan Mechanics
Inside the zoom modal, the SVG transform matrix is updated during mouse events:
*   **Scale:** Computed using mouse-wheel offsets:

    $$\text{scale} = \max(0.1, \min(\text{scale} + \text{delta}, 10))$$

*   **Panning:** Tracks the difference between starting coordinates and current pointer coordinates:

    $$X_{\text{pan}} = X_{\text{current}} - X_{\text{dragStart}}$$

    $$Y_{\text{pan}} = Y_{\text{current}} - Y_{\text{dragStart}}$$
*   **CSS Transform:** The updates are applied using hardware-accelerated CSS properties:
    ```javascript
    svg.style.transform = `translate(${modalPanX}px, ${modalPanY}px) scale(${modalZoomScale})`;
    ```

---

## 6. Cascade PDF Layout Pagination Sandbox

Exporting long, complex Markdown previews to PDF often leads to sliced text lines and cut-off images. Markdown Viewer uses a custom pagination engine:

### Pagination Pipeline
1.  **Sandbox Cloning:** The preview DOM is cloned into an off-screen sandbox element (`.pdf-export` class) set to A4 width (210mm).
2.  **SVG to Raster Conversion:** Because `html2canvas` struggles to render inline SVGs, all Mermaid diagrams are converted to Base64-encoded PNG image elements inside the sandbox.
3.  **Cascade Pagination Loop:** The pagination engine executes up to 10 passes:
    *   *Keep-with-Next Headings:* Headings within 70px of a page break are shifted down via margin-top spacers (`.pdf-page-break-spacer`).
    *   *Table Splitting:* Split rows are shifted, and the table header (`<thead>`) is duplicated onto the subsequent page.
    *   *Text Alignment:* Lines are shifted downward to align page cuts cleanly between font heights, avoiding sliced characters.
    *   *Oversized Graphics:* Images exceeding page boundaries are downscaled (minimum scale 0.5) to fit.
4.  **Compilation:** The stabilized sandbox is captured page-by-page using `html2canvas`, and the resulting canvases are compiled into a PDF via `jsPDF`.

---

## 7. Multi-Document Session Persistence & Drag Reordering

Markdown Viewer supports working with multiple documents simultaneously via a tabbed workspace.

### Tab State Schema
The workspace is managed in a global `tabs` array:
```javascript
{
  id: "tab_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
  title: "Document Title",
  content: "# Markdown Content...",
  scrollPos: 0,
  viewMode: "split", // split | editor | preview
  createdAt: 1718042710000
}
```

### Save Pipeline
*   **Debounced Save:** Document changes trigger an auto-save that is debounced by 500ms using a window timer to prevent blocking the UI thread with constant serialization.
*   **Beforeunload Flush:** To ensure changes are saved when navigating away or closing the page, the state is flushed immediately during `beforeunload` and `visibilitychange` events (when the page is hidden).

### Drag-and-Drop Reordering
*   Tab elements in the DOM are configured with `draggable="true"`.
*   Drag events track the moving tab (`draggedTabId`).
*   Releasing a tab over another swaps their indices in the state array, saves the updated array to `localStorage`, and updates the tab bar.

---

## 8. Binary Safety Gutter & Multi-File Importer

### Binary File Guard
To prevent importing corrupted binary files, the file reader scans the first 8 KB of any imported file:
*   If a null byte (`\x00`) is found, the import is aborted, and an error is displayed.

### Multi-File GitHub Importer
Users can import documents directly from public GitHub repositories:
1.  **URL Parsing:** The importer resolves repo, branch, folder, or file paths from a pasted URL.
2.  **API Requests:** It queries public GitHub APIs (`api.github.com/repos/.../contents/...`) to fetch file trees.
3.  **File Browser Modal:** Users can preview the file tree in a modal, select the files they want, and import them all at once. Selected files are loaded into separate document tabs.

---

## 9. Serverless Sharing via Compressed Hash Fragments

Markdown Viewer lets you share documents via links that contain the entire compressed document content, eliminating the need for a database.

### Encoding Pipeline

$$\text{Markdown Text} \xrightarrow{\text{TextEncoder}} \text{Bytes} \xrightarrow{\text{Pako.deflate (zlib)}} \text{Compressed Bytes} \xrightarrow{\text{Base64-URL Encoding}} \text{URL Hash}$$

1.  The markdown text is encoded to bytes and compressed using `Pako.js` (DEFLATE).
2.  The compressed bytes are converted to a Base64 string.
3.  The string is made URL-safe by replacing `+` with `-`, `/` with `_`, and removing trailing `=` padding.
4.  The hash is appended to the URL as `#share=<encoded_string>`.
5.  A warning is displayed if the generated link exceeds 32,000 characters.

---

## 10. Performance, Security, and UI Variables

### Repaint & Transition Tuning
*   Theme changes are managed using CSS variables.
*   Transition animations are scoped to specific properties (`background-color`, `border-color`) rather than using `transition: all`.
*   The background transition on the `<body>` element was removed to prevent repainting the entire viewport during theme shifts.

### Resizable Panes
*   The divider between the editor and preview panes can be dragged horizontally.
*   It updates the CSS grid layout dynamically using percentage variables.
*   Drag limits prevent either pane from being scaled below 20% of the viewport width.

### Sanitization and Security
*   All compiled HTML is sanitized on the main thread using **DOMPurify** before being rendered:
    ```javascript
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'draggable', 'contenteditable']
    });
    ```
*   This strips inline script handlers (e.g. `onload`, `onclick`) and `<script>` elements to prevent Cross-Site Scripting (XSS) when importing or loading external markdown files.