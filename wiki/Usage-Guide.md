# User Operations & Usage Guide

This guide details how to work with the editing workspace, importing flows, exporting tools, and serverless sharing mechanisms in **Markdown Viewer** (v3.8.0).

---

## Table of Contents

- [User Interface Layout](#user-interface-layout)
- [Workspace Tab Management](#workspace-tab-management)
- [Importing Documents](#importing-documents)
- [Exporting & Compiling Documents](#exporting--compiling-documents)
- [View Modes and Layout Control](#view-modes-and-layout-control)
- [Theme Configurations](#theme-configurations)
- [Proportional Scroll Sync](#proportional-scroll-sync)
- [Content Analytics & Metrics](#content-analytics--metrics)
- [Serverless URL Hash Sharing](#serverless-url-hash-sharing)
- [Keyboard Shortcuts Reference](#keyboard-shortcuts-reference)

---

## User Interface Layout

The interface is structured into a header section, formatting toolbar, document tabs, and a resizable workspace.

```
+-----------------------------------------------------------------------+
|  App Header (.app-header)                                             |
|  [Tab 1] [Tab 2] [Tab 3]                   [View Modes] [Settings]    |
+-----------------------------------------------------------------------+
|  Formatting Toolbar (.markdown-format-toolbar)                        |
|  [Bold] [Italic] [Link] [Image] [Table] [Mermaid] [Math]              |
+-----------------------------------------------------------------------+
|                                  |                                    |
|  Editor Pane (.editor-pane)      |  Preview Pane (.preview-pane)      |
|                                  |                                    |
|  [Gutter]  # Welcome...          |  # Welcome...                      |
|    1       This is markdown      |  This is markdown.                 |
|    2                             |                                    |
|                                  |                                    |
+-----------------------------------------------------------------------+
|  Status Bar                                                           |
|  Words: 4   Chars: 21                          Reading Time: 1 min    |
+-----------------------------------------------------------------------+
```

*   **Editor Pane (Left):** Monospace editing workspace with a line gutter showing line numbers.
*   **Preview Pane (Right):** Sandbox layout area rendering GitHub-Flavored Markdown outputs.
*   **Splitter Bar (Center):** Resizable divider allowing width adjustments. Drag boundaries clamp either pane from scaling below 20% width.

---

## Workspace Tab Management

Markdown Viewer allows you to open and edit multiple documents concurrently.

*   **Create Tabs:** Click the **`+`** button in the tab header bar.
*   **Rename Tabs:** Double-click a tab label or open the tab menu to change the name.
*   **Reorder Tabs:** Drag and drop tab components horizontally to reorganize them.
*   **Duplicate Tabs:** Choose **Duplicate** from the tab's context dropdown to clone the document.
*   **Delete Tabs:** Click the **`x`** icon on the tab. Deleting the last tab clears editor content and resets state.
*   **Auto-Save Cache:** Tabs are auto-saved to `localStorage` every 500ms when typing, and flushed immediately during `beforeunload` or `visibilitychange` lifecycle states.

---

## Importing Documents

Load files into the workspace using three different paths:

### 1. Drag & Drop
Drag a `.md` or `.markdown` text file from your file system and drop it directly onto the editor pane. The contents will overwrite the active tab. A binary safety guard scans the first 8 KB of the file for null bytes (`\x00`) to block corrupted or binary files.

### 2. File Picker
Click **Import** in the toolbar, select **From files**, and choose one or more Markdown files from your system.

### 3. GitHub Importer
1.  Click **Import** and select **From GitHub**.
2.  Paste a public GitHub URL (e.g., repository main page, subdirectory, or direct blob file link):
    *   `https://github.com/owner/repository`
    *   `https://github.com/owner/repository/tree/main/src/docs`
    *   `https://github.com/owner/repository/blob/main/README.md`
3.  The importer fetches the file tree from GitHub's API.
4.  In the file selection modal, choose the files you want to import. You can select all files or clear the selection.
5.  Click **Import Selected** to load the selected files into separate document tabs.

---

## Exporting & Compiling Documents

Export options are available in the **Export** dropdown in the toolbar:

### 1. Raw Markdown (`.md`)
Saves the raw text buffer of the active tab.

### 2. Standalone HTML (`.html`)
Generates a self-contained HTML file. It bundles the compiled Markdown content, highlights code blocks, renders diagrams, and inlines GitHub-markdown styles so the document displays correctly offline.

### 3. Compiled PDF (`.pdf`)
Generates a PDF using `jsPDF` and `html2canvas` via an off-screen sandbox. It converts SVG diagrams to rasters, scales oversized elements, and runs a cascade pagination loop to keep headings with their sections and prevent text lines from being cut in half.

> [!TIP]
> For the highest PDF rendering quality, use your browser's built-in Print functionality (`Ctrl+P` or `Cmd+P`) and select "Save as PDF".

---

## View Modes and Layout Control

Configure the workspace layout to fit your current writing context:

| View Mode | Toolbar Icon | Layout Description |
| :--- | :---: | :--- |
| **Split View** | `⬜⬜` | Dual-pane side-by-side editing and previewing (Default desktop view). |
| **Editor Only** | `⬜` | Single pane showing only the editor for distraction-free writing. |
| **Preview Only** | `◼` | Single pane showing only the compiled HTML output for reading. |

*   **Mobile Layout Auto-Collapse:** On viewports below 768px wide, split mode is disabled. The application displays either the editor or the preview, toggling via the view mode icons.

---

## Theme Configurations

Switch themes using the toggle icon in the toolbar:
*   **Light Theme:** White background matching standard GitHub styling.
*   **Dark Theme:** Dark theme (`#0d1117`) matching GitHub Dark.

Theme variables default to system preferences and are written to the document root class attribute.

---

## Proportional Scroll Sync

When working in Split View, scrolling the editor or preview will automatically update the opposite pane:
*   **Scroll Sync Toggle:** Enable or disable synchronization via the scroll lock toggle in the toolbar.
*   **Ratio-Based Calculations:** Computes relative scroll offsets based on total scrollable heights to keep text and headers aligned.
*   **Feedback Mitigation:** Employs scroll event locks and frame scheduling via `requestAnimationFrame` to prevent circular updates.

---

## Content Analytics & Metrics

Toggle the **📊 Stats** view in the toolbar to display:
*   **Word Count:** Total count of space-separated strings.
*   **Character Count:** Total count of character bytes, excluding whitespace.
*   **Lines:** Total line count of the document.
*   **Estimated Reading Time:** Calculated at an average speed of 200 words per minute.

---

## Serverless URL Hash Sharing

Create serverless, database-free sharing links using the **Share** button in the toolbar:
1.  Markdown text is compressed using `Pako.js` (zlib DEFLATE).
2.  Data is converted to a URL-safe Base64 string (replacing `+` with `-`, `/` with `_`, and removing trailing `=` padding).
3.  The string is appended as a URL hash fragment: `http://domain/#share=<payload>`.
4.  Copy and share this link. Opening it decodes and decompresses the hash to load the document in the editor.
5.  A warning is displayed if the generated URL exceeds 32,000 characters.

---

## Keyboard Shortcuts Reference

The following shortcut keys are active inside the editor:

| Action | Windows / Linux | macOS |
| :--- | :--- | :--- |
| **Export raw Markdown** | `Ctrl + S` | `⌘ + S` |
| **Copy Rich HTML** | `Ctrl + C` (with no text selected) | `⌘ + C` (with no text selected) |
| **Toggle Scroll Sync** | `Ctrl + Shift + S` | `⌘ + Shift + S` |
| **Open a New Tab** | `Ctrl + T` | `⌘ + T` |
| **Close the Active Tab** | `Ctrl + W` | `⌘ + W` |
| **Open Find & Replace** | `Ctrl + F` | `⌘ + F` |
| **Undo Last Edit** | `Ctrl + Z` | `⌘ + Z` |
| **Redo Last Edit** | `Ctrl + Shift + Z` / `Ctrl + Y` | `⌘ + Shift + Z` / `⌘ + Y` |
| **Insert Code Block** | `Ctrl + Shift + C` | `⌘ + Shift + C` |
| **Toggle Fullscreen Editor** | `F11` | `F11` |
| **Insert 2-space Indent** | `Tab` | `Tab` |
| **Outdent Line** | `Shift + Tab` | `Shift + Tab` |
