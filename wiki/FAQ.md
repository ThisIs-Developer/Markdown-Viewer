# FAQ

Frequently asked questions about **Markdown Viewer**.

---

## General

### What is Markdown Viewer?

Markdown Viewer is a free, open-source, GitHub-style Markdown editor and live-preview application that runs entirely in the browser. It lets you write Markdown and see the rendered output side by side in real-time, with support for syntax highlighting, LaTeX math, Mermaid diagrams, and more.

### Is it free to use?

Yes. Markdown Viewer is completely free and open-source under the [Apache 2.0 License](https://github.com/ThisIs-Developer/Markdown-Viewer/blob/main/LICENSE).

### Do I need to create an account?

No. The application requires no sign-up, registration, or login.

### Does Markdown Viewer send my content to a server?

No. All processing is done **entirely in your browser**. No text you type is ever transmitted to any server. Your content stays on your device.

### Do you collect analytics or telemetry?

No. The application does not include analytics scripts, advertising pixels, or tracking beacons.

### What data is stored locally?

Markdown Viewer stores editor content, tab state, and preferences (theme, view mode, sync scroll) in your browser’s `localStorage` for autosave and restore.

### How do I clear my local data?

Use your browser’s **Site Data** or **Clear Storage** controls for the site. This removes autosaved content and preferences.

### What external network requests are made?

By default, the app loads libraries from public CDNs (cdnjs, jsDelivr). GitHub Import uses `api.github.com` and `raw.githubusercontent.com` to fetch public files. Self-host the libraries and avoid GitHub import to eliminate these requests.

### Which browsers are supported?

Markdown Viewer works in all modern browsers:
- Chrome / Chromium 90+
- Firefox 90+
- Edge 90+
- Safari 15+

---

## Features

### Does it support GitHub Flavored Markdown (GFM)?

Yes. Markdown Viewer implements the full [GitHub Flavored Markdown](https://github.github.com/gfm/) specification, including tables, task lists, strikethrough, and autolinks.

### Can I render mathematical equations?

Yes. Markdown Viewer supports LaTeX math via **MathJax**:
- **Inline math**: `$E = mc^2$`
- **Block/display math**: `$$\int_0^\infty e^{-x} dx = 1$$`

See the [Markdown Reference — Math](Markdown-Reference#math-latex) section for more examples.

### Can I render diagrams?

Yes. Markdown Viewer supports **Mermaid** diagrams using fenced code blocks with the `mermaid` language identifier. Supported diagram types include flowcharts, sequence diagrams, Gantt charts, class diagrams, entity-relationship diagrams, and more.

See the [Features — Mermaid Diagrams](Features#mermaid-diagrams) section for details.

### Can I export to PDF?

Yes. Click the **Export → PDF** button in the toolbar. The PDF is generated client-side using jsPDF and html2canvas.

For higher-quality PDF output (especially for wide code blocks or complex diagrams), use your browser's built-in **Print → Save as PDF** function (`Ctrl+P` / `Cmd+P`).

### Does the editor auto-save my content?

Yes. The editor content is automatically saved to the browser's `localStorage` after each change. Your content is restored the next time you open the application in the same browser.

### Can I share my document with someone?

Yes. Click the **Share** button in the toolbar. Your content is compressed and encoded into the URL. Share the resulting URL — when the recipient opens it, the editor is pre-populated with your content.

> **Note**: Very large documents produce very long URLs, which may not work in all contexts.

---

## Installation & Deployment

### How do I run Markdown Viewer locally?

The quickest options are:

```bash
# With Docker:
docker run -p 8080:80 ghcr.io/thisis-developer/markdown-viewer:latest

# With Python:
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python3 -m http.server 8080
```

See the [Installation](Installation) page for all options.

### Can I run it without Docker?

Yes. The web app is pure HTML/CSS/JavaScript with no build step. Clone the repository and serve the root directory with any static web server (Python, Node.js `serve`, VS Code Live Server, Apache, Nginx, etc.).

### Can I use it offline?

- **Web app**: The application loads libraries from CDNs, so you need an internet connection for the initial load. Once assets are cached, it works offline until the cache is cleared.
- **Desktop app**: The desktop application uses the same CDN libraries by default. It can run offline after caching or if you replace CDN links with local copies and rebuild.
- **Self-hosted Docker**: Bundling CDN libraries locally makes the web app fully offline. By default, the Docker image still loads CDN libraries.

### Is there a desktop version?

Yes. A native cross-platform desktop app is available for Windows, Linux, and macOS, built with [Neutralinojs](https://neutralino.js.org/). Download the binary for your platform from the [Releases page](https://github.com/ThisIs-Developer/Markdown-Viewer/releases).

See the [Desktop App](Desktop-App) wiki page for build instructions.

---

## Troubleshooting

### The preview is not updating in real-time.

1. Make sure JavaScript is enabled in your browser.
2. Try a hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`).
3. Check the browser console (F12 → Console) for errors and report them as a [GitHub Issue](https://github.com/ThisIs-Developer/Markdown-Viewer/issues).

### Math equations are not rendering.

MathJax loads from a CDN. Ensure you have an active internet connection. If MathJax has already loaded but equations still don't render, check that your LaTeX syntax is correct — see [Markdown Reference — Math](Markdown-Reference#math-latex).

### Mermaid diagrams are not rendering.

Check that:
1. The code block is tagged with `mermaid` (lowercase).
2. Your diagram syntax is valid. You can validate it at [mermaid.live](https://mermaid.live/).
3. There are no JavaScript errors in the browser console.

### The PDF export looks different from the preview.

This is a known limitation of the html2canvas approach. For better-quality PDF output, use **Print → Save as PDF** in your browser (`Ctrl+P` / `Cmd+P`).

### The desktop app binary won't open on macOS.

macOS blocks unsigned binaries. Run this command to remove the quarantine flag:

```bash
xattr -d com.apple.quarantine markdown-viewer-mac_universal
chmod +x markdown-viewer-mac_universal
./markdown-viewer-mac_universal
```

Alternatively, right-click the file in Finder, select **Open**, and confirm the prompt.

### The desktop app binary won't open on Linux.

Make sure the binary is executable:

```bash
chmod +x markdown-viewer-linux_x64
./markdown-viewer-linux_x64
```

---

## Contributing

### How can I contribute?

See the [Contributing](Contributing) page for the full guide. In summary:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/my-feature`).
3. Make and test your changes.
4. Open a Pull Request against `main`.

### Where do I report bugs or request features?

Open a [GitHub Issue](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) with a clear description and (for bugs) steps to reproduce.
