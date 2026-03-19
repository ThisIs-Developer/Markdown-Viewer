# Markdown Viewer

<div align="center">
    <img src="assets/icon.jpg" alt="Markdown Viewer Logo" width="150px"/>
    <h3>A powerful GitHub-style Markdown rendering tool</h3>
    <p>Fast, secure, and feature-rich - all running in your browser</p>
    <a href="https://markdownviewer.pages.dev/">Live Demo</a> • 
    <a href="#-features">Features</a> • 
    <a href="#-screenshots">Screenshots</a> • 
    <a href="#-usage">Usage</a> • 
    <a href="#-license">License</a>
</div>

## 🚀 Overview

Markdown Viewer is a professional, full-featured Markdown editor and preview application that runs entirely in your browser. It provides a GitHub-style rendering experience with a clean split-screen interface, allowing you to write Markdown on one side and instantly preview the formatted output on the other.

## ✨ Features

- **GitHub-style Markdown rendering** - See your Markdown exactly as it would appear on GitHub
- **Live preview** - Instantly see changes as you type
- **Syntax highlighting** - Beautiful code highlighting for multiple programming languages
- **LaTeX math support** - Render mathematical equations using LaTeX syntax
- **Mermaid diagrams** - Create diagrams and flowcharts within your Markdown; hover over any diagram to reveal a toolbar for zooming, downloading (PNG/SVG), and copying to clipboard
- **Dark mode toggle** - Switch between light and dark themes for comfortable viewing
- **Export options** - Download your content as Markdown, HTML, or PDF
- **Import Markdown files** - Drag & drop or select files to open, or import directly from GitHub URLs
- **Copy to clipboard** - Quickly copy your Markdown content with one click
- **Sync scrolling** - Keep editor and preview panes aligned (toggleable)
- **Content statistics** - Track word count, character count, and reading time
- **Fully responsive** - Works on desktop and mobile devices
- **Emoji support** - Convert emoji shortcodes into actual emojis
- **100% client-side** - No server processing, ensuring complete privacy and security
- **No sign-up required** - Use instantly without any registration

## 📸 Screenshots

### Code Syntax Highlighting
![Code Syntax Highlighting](assets/code.png)

### Mathematical Expressions Support
![Mathematical Expressions](assets/mathexp.png)

### Mermaid Diagrams
![Mermaid Diagrams](assets/mermaid.png)

### Tables Support
![Tables Support](assets/table.png)

## 📝 Usage

1. **Writing Markdown** - Type or paste Markdown content in the left editor panel
2. **Viewing Output** - See the rendered HTML in the right preview panel
3. **Importing Files**
   - Click "Import" dropdown and select "From File" to choose local .md files
   - Drag and drop .md files into the interface
   - Click "Import" dropdown and select "From GitHub" to import from a GitHub URL
4. **Importing from GitHub** - Enter a GitHub URL in one of these formats:
   - `https://github.com/user/repo/blob/branch/path/file.md`
   - `https://github.com/user/repo/raw/branch/path/file.md`
   - `https://raw.githubusercontent.com/user/repo/branch/path/file.md`
5. **Exporting Content** - Use the "Export" dropdown to download as MD, HTML, or PDF
6. **Toggle Dark Mode** - Click the moon icon to switch between light and dark themes
7. **Toggle Sync Scrolling** - Enable/disable synchronized scrolling between panels

### Mermaid Diagram Toolbar

When a Mermaid diagram is rendered, hover over it to reveal a small toolbar with the following actions:

| Button | Action |
|--------|--------|
| ⛶ (arrows) | Open diagram in a zoom/pan modal |
| PNG | Download the diagram as a PNG image |
| 📋 (clipboard) | Copy the diagram image to the clipboard |
| SVG | Download the diagram as an SVG file |

Inside the **zoom modal** you can:
- **Zoom in / out** using the buttons or the mouse wheel
- **Pan** by clicking and dragging the diagram
- **Reset** zoom and position with the Reset button
- **Download PNG or SVG** directly from the modal
- **Close** with the × button or by pressing `Escape`

### Supported Markdown Features

- Headings (# H1, ## H2, etc.)
- **Bold** and *italic* text
- ~~Strikethrough~~
- [Links](https://example.com)
- Images
- Lists (ordered and unordered)
- Tables
- Code blocks with syntax highlighting
- Blockquotes
- Horizontal rules
- Task lists
- LaTeX equations (inline and block)
- Mermaid diagrams
- And more!

## 🔧 Technologies Used

- HTML5
- CSS3
- JavaScript
- [Bootstrap](https://getbootstrap.com/) - Responsive UI framework
- [Marked.js](https://marked.js.org/) - Markdown parser
- [highlight.js](https://highlightjs.org/) - Syntax highlighting
- [MathJax](https://www.mathjax.org/) - Mathematical expressions
- [Mermaid](https://mermaid-js.github.io/mermaid/) - Diagrams and flowcharts
- [DOMPurify](https://github.com/cure53/DOMPurify) - HTML sanitization
- [html2canvas.js](https://github.com/niklasvh/html2canvas) + [jsPDF](https://www.npmjs.com/package/jspdf)- PDF generation
- [FileSaver.js](https://github.com/eligrey/FileSaver.js) - File download handling
- [JoyPixels](https://www.joypixels.com/) - Emoji support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📈 Development Journey

The Markdown Viewer has undergone significant evolution since its inception. What started as a simple markdown parser has grown into a full-featured, professional application with multiple advanced capabilities. By comparing the [current version](https://markdownviewer.pages.dev/) with the [original version](https://a1b91221.markdownviewer.pages.dev/), you can see the remarkable progress in UI design, performance optimization, and feature implementation.

---

<div align="center">
    <p>Developed with ❤️ by <a href="https://github.com/ThisIs-Developer">ThisIs-Developer</a></p>
</div>
