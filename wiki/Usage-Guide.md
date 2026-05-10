# Usage Guide

This page explains how to use every feature of **Markdown Viewer** once it is running.

---

## Table of Contents

- [Interface Overview](#interface-overview)
- [Writing Markdown](#writing-markdown)
- [Importing Files](#importing-files)
- [Exporting Content](#exporting-content)
- [View Modes](#view-modes)
- [Dark / Light Mode](#dark--light-mode)
- [Synchronized Scrolling](#synchronized-scrolling)
- [Content Statistics](#content-statistics)
- [Sharing via URL](#sharing-via-url)
- [Data Storage & Privacy](#data-storage--privacy)
- [Copy to Clipboard](#copy-to-clipboard)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Interface Overview

The application is divided into two main panes and a top toolbar:

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: theme | view mode | stats | share | export… │
├──────────────────────────┬──────────────────────────────┤
│   EDITOR (left pane)     │   PREVIEW (right pane)       │
│   Write Markdown here    │   Rendered HTML output       │
└──────────────────────────┴──────────────────────────────┘
```

- **Toolbar** — Contains all application controls.
- **Editor pane** — A plain-text area where you type Markdown.
- **Preview pane** — Shows the live-rendered output, styled like GitHub.

The divider between the two panes can be **dragged** to resize them.

---

## Writing Markdown

1. Click anywhere in the **Editor** (left pane).
2. Start typing Markdown. The **Preview** (right pane) updates in real-time.

The editor supports the full [CommonMark](https://commonmark.org/) specification plus GitHub Flavored Markdown (GFM) extensions. See the [Markdown Reference](Markdown-Reference) page for a complete syntax guide.

### Default Content

When you first open the application, the editor contains a sample document demonstrating the key features. You can clear it and start writing your own content.

---

## Importing Files

You can load Markdown into the editor in three ways:

### Drag & Drop

Drag a `.md` file from your file explorer directly onto the **editor pane**. The file content replaces the current editor content.

### File Picker

1. Click the **📂 Import** button in the toolbar.
2. Select a `.md` file in the file picker dialog.
3. The file content is loaded into the editor.

### GitHub Import

1. Click **GitHub Import** in the toolbar (or in the mobile menu).
2. Paste a public GitHub URL:
   - Repository URL (for example: `https://github.com/owner/repo`)
   - Folder URL (for example: `https://github.com/owner/repo/tree/main/docs`)
   - Markdown file URL (for example: `https://github.com/owner/repo/blob/main/README.md`)
3. If multiple Markdown files are found, use the in-app file browser to select one or more `.md` files.
4. Use **Select All** to quickly select every listed Markdown file (or clear the selection).
5. Click **Import Selected** to open all selected files in new tabs.

> **Tip**: Only `.md` and `.markdown` files are accepted.

---

## Exporting Content

Click the **Export** button (or the dropdown arrow next to it) to save your content in different formats.

### Export as Markdown (`.md`)

Saves the raw Markdown source exactly as typed in the editor.

### Export as HTML (`.html`)

Saves the full rendered HTML, including the GitHub Markdown stylesheet, so the file looks the same when opened in any browser.

### Export as PDF (`.pdf`)

Generates a PDF of the rendered preview using jsPDF and html2canvas. The PDF preserves styling, code highlighting, and diagrams.

> **Note**: For best PDF quality, use the **Print** dialog (`Ctrl+P` / `Cmd+P`) in your browser and choose "Save as PDF". This provides higher-fidelity output than the built-in PDF export.

---

## View Modes

Use the **View Mode** buttons in the toolbar to change the layout:

| Icon | Mode | Description |
|------|------|-------------|
| `⬜⬜` | Split View (default) | Editor and preview side by side |
| `⬜` | Editor Only | Full-width editor, preview hidden |
| `◼` | Preview Only | Full-width preview, editor hidden |

On mobile devices, the app automatically switches to **Preview Only** mode to save space, and you can tap the editor icon to switch to editing.

---

## Dark / Light Mode

Click the **🌙 / ☀️** toggle button in the toolbar to switch between:

- **Light Mode** — White background, dark text (default)
- **Dark Mode** — Dark background, light text

Your preference is saved in the browser's `localStorage` and restored on the next visit.

---

## Synchronized Scrolling

When in **Split View** mode, the editor and preview panes scroll in sync by default. To toggle this:

- Click the **🔗 Sync Scroll** button in the toolbar to disable synchronization.
- Click again to re-enable it.

When sync scroll is **on**, scrolling either pane causes the other to follow proportionally.

---

## Content Statistics

Click the **📊 Stats** button in the toolbar to see:

| Stat | Description |
|------|-------------|
| Words | Total word count |
| Characters | Total character count (excluding whitespace) |
| Reading time | Estimated reading time at 200 words/minute |
| Lines | Total number of lines |

Stats update in real-time as you type.

---

## Sharing via URL

Click the **🔗 Share** button to generate a shareable URL that encodes your entire Markdown document:

1. The content is compressed using **pako** (zlib/deflate).
2. The compressed bytes are Base64-encoded.
3. The encoded string is appended to the URL as a hash fragment (`#content=…`).

Share the resulting URL with anyone. When they open it, the editor is automatically populated with your content.

> **Warning**: Very large documents produce very long URLs. Some browsers and link-shorteners may have URL length limits.

---

## Data Storage & Privacy

Markdown Viewer is transparent about where your data lives:

- **Autosave**: Your content and tab state are stored in your browser’s `localStorage`.
- **Preferences**: Theme, view mode, and sync scroll settings are saved locally.
- **Clearing data**: Use your browser’s site data controls to remove saved content.
- **GitHub import**: Imports access public GitHub URLs via `api.github.com` and `raw.githubusercontent.com`.
- **Share links**: Shared URLs embed content in the hash portion of the URL; avoid sharing sensitive content.

---

## Copy to Clipboard

Click the **📋 Copy** button to copy the **rendered HTML** of the preview to the clipboard. You can then paste it into email clients, word processors, or any tool that accepts rich text.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` / `Cmd + S` | Export as Markdown |
| `Tab` | Insert 2 spaces (inside editor) |
| `Ctrl + Z` / `Cmd + Z` | Undo |
| `Ctrl + Y` / `Cmd + Y` | Redo |
