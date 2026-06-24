# Frequently Asked Questions (FAQ)

This FAQ answers common questions about using, deploying, and troubleshooting **Markdown Viewer** (v3.8.0).

---

## Table of Contents

- [General & Privacy](#general--privacy)
- [Editor & Preview Features](#editor--preview-features)
- [Installation & Deployment](#installation--deployment)
- [Troubleshooting](#troubleshooting)

---

## General & Privacy

### What is Markdown Viewer?
Markdown Viewer is a client-side Markdown editing suite and live preview tool. It features off-thread Web Worker parsing, incremental DOM patching, responsive split views, interactive diagrams (Mermaid), and mathematical equation formatting (LaTeX).

### Is Markdown Viewer free to use?
Yes. It is free and open-source software licensed under the **Apache License 2.0**.

### Do I need to create an account?
No. The application is serverless and does not require registration, login, or subscription.

### Does Markdown Viewer send my content to any servers?
No. All parsing, rendering, typesetting, and exporting happen entirely on your computer inside the browser. No document text or metadata is uploaded to external servers.

### Do you collect analytics or telemetry data?
No. The application does not contain tracking scripts, telemetry code, cookies, or advertising pixels.

### What information is stored in my browser?
The app saves your settings (theme, view mode, scroll synchronization state) and open tab documents to your browser's local storage (`localStorage`). This enables auto-saving and restores your workspace when you reload the page.

### How do I clear all local storage data?
You can clear this data by using your browser's site settings or developer tools:
1.  Open the browser console (press `F12`).
2.  Navigate to the **Application** or **Storage** tab.
3.  Select **Local Storage** and clear the records for the site.
4.  Alternatively, click the **Reset** button in the tab bar to clear all documents.

---

## Editor & Preview Features

### Does the app support GitHub-Flavored Markdown (GFM)?
Yes. It uses the `marked.js` library to support standard GFM features, including tables, task checklists, strikethrough, autolinks, and emoji shortcodes.

### Can I write math formulas and LaTeX equations?
Yes. The application uses MathJax to format equations. You can write inline equations using single dollar signs (`$E=mc^2$`) or block equations using double dollar signs (`$$...$$`). For more details, see the [Markdown Reference](Markdown-Reference) page.

### Can I draw flowcharts and diagrams?
Yes. You can write diagrams using Mermaid syntax inside fenced code blocks marked with `mermaid`. The preview pane displays these as interactive SVG diagrams. Double-click any diagram in the preview to open a zoomable, draggable modal.

### Why does the exported PDF look different from the live preview?
Exporting to PDF uses `html2canvas` and `jsPDF` to capture screenshots of the preview pane page-by-page. While the app uses a sandboxing and pagination engine to adjust page breaks and scale elements, some complex CSS layouts, font styles, or wide code blocks may not render perfectly.

> [!TIP]
> For the highest PDF quality, use your browser's built-in print command (`Ctrl + P` or `Cmd + P`) and select "Save as PDF".

---

## Installation & Deployment

### Can I run the application offline?
*   **Web version:** The default build loads libraries (like MathJax and Mermaid) from external CDNs, requiring an active internet connection on first load. Once these files are cached by the Service Worker, the application can run offline.
*   **Desktop version:** The desktop application requires internet access on first launch to cache CDN assets. To run fully offline from the start, download the CDN dependencies locally, update the script paths in `index.html`, and rebuild the application.

### How do I host Markdown Viewer on my own server?
Copy the static assets (`index.html`, `script.js`, `preview-worker.js`, `styles.css`, `sw.js`, and `assets/`) and serve them using a static web server (such as Nginx, Apache, or Caddy). 

> [!WARNING]
> Do not open the `index.html` file directly using the `file://` protocol in your browser. Security policies (CORS) block Web Workers from running from local files, which will break the preview parser.

---

## Troubleshooting

### Why is the preview pane blank or not updating?
1.  Check that JavaScript is enabled in your browser.
2.  Open your browser console (`F12`) to check for scripts blocked by security policies or network errors.
3.  Perform a hard refresh (`Ctrl + Shift + R` or `Cmd + Shift + R`) to clear cached script instances.

### Why are my math equations not formatting?
MathJax loads dynamically when math markers are detected in your document. Ensure you have an active internet connection to download the library on first use, and check that your LaTeX syntax is correct.

### Why are my Mermaid diagrams showing syntax errors?
Check that:
*   The code block tag is written in lowercase as `mermaid`.
*   Your diagram syntax is correct. You can verify your syntax using the [Mermaid Live Editor](https://mermaid.live).

### Why won't the desktop application launch on macOS?
macOS blocks unsigned binaries by default. To run the app, clear the quarantine flag using your terminal:
```bash
xattr -d com.apple.quarantine markdown-viewer-mac_universal
chmod +x markdown-viewer-mac_universal
```
You can also right-click the binary in Finder, click **Open**, and confirm the launch prompt.
