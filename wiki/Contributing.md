# Contributing

Thank you for your interest in contributing to **Markdown Viewer**! All contributions — bug reports, feature requests, documentation improvements, and code changes — are welcome.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Reporting Bugs](#reporting-bugs)
- [Security Reporting](#security-reporting)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please be kind and constructive in all interactions.

---

## Reporting Bugs

1. **Check existing issues** first: [GitHub Issues](https://github.com/ThisIs-Developer/Markdown-Viewer/issues)
2. If the bug hasn't been reported, open a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected behavior
   - Actual behavior
   - Browser/OS version (for web bugs) or platform (for desktop bugs)
   - Screenshots or screen recordings if applicable

---

## Security Reporting

If you discover a security issue, please report it responsibly:

1. Avoid posting sensitive details in public issues.
2. If GitHub Security Advisories are enabled for the repo, open a private advisory.
3. Otherwise, contact the maintainer via GitHub and provide a clear, minimal reproduction.

---

## Suggesting Features

1. **Check existing issues and discussions** to avoid duplicates.
2. Open a new issue with the label `enhancement`, describing:
   - The problem your feature solves
   - Your proposed solution
   - Any alternatives you considered
   - Mockups or examples if applicable

---

## Development Setup

### Web App

No build tools are required. Serve the root directory with any static server:

```bash
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
python3 -m http.server 8080
# or: npx serve . -p 8080
```

Open **http://localhost:8080** and start editing `index.html`, `script.js`, or `styles.css`.

### Desktop App

```bash
cd Markdown-Viewer/desktop-app
npm install
node setup-binaries.js
node prepare.js
npm run dev
```

See the [Desktop App](Desktop-App) wiki page for full instructions.

---

## Making Changes

1. **Fork** the repository on GitHub.
2. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feature/my-feature-name
   # or for bug fixes:
   git checkout -b fix/issue-123-description
   ```

3. **Make your changes**, following the [Code Style Guidelines](#code-style-guidelines).
4. **Test your changes** in multiple browsers (Chrome, Firefox, Safari, Edge).
5. **Commit** your changes with a descriptive commit message.
6. **Push** your branch and open a Pull Request.

---

## Code Style Guidelines

### HTML (`index.html`)

- Use **2-space indentation**.
- Use **semantic HTML5 elements** where appropriate (`<header>`, `<main>`, `<section>`, etc.).
- Keep inline styles minimal; use CSS classes instead.
- Add `aria-*` attributes for accessibility on interactive elements.

### CSS (`styles.css`)

- Use **CSS custom properties** (variables) for colors, fonts, and spacing to support theming.
- Group related rules together with a comment header.
- Use **2-space indentation**.
- Prefer **class selectors** over ID selectors for general styles.
- Use `rem` for font sizes and `px` / `%` for layout spacing.

### JavaScript (`script.js`)

- Use **vanilla JavaScript** — no new external frameworks.
- Use `const` / `let`; avoid `var`.
- Write clear, self-documenting function and variable names.
- Add brief comments for complex logic.
- Avoid direct DOM manipulation from within utility functions; keep rendering logic centralized.
- Debounce any event handlers that trigger expensive operations (e.g., Markdown rendering).

---

## Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting changes that don't affect logic |
| `refactor` | Code refactoring without feature/fix |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates, etc. |
| `ci` | CI/CD configuration changes |

### Examples

```
feat(editor): add keyboard shortcut for toggling dark mode
fix(export): correct PDF page break for long code blocks
docs(wiki): add Mermaid diagram examples to Markdown Reference
chore(deps): update DOMPurify to 3.1.0
```

---

## Pull Request Process

1. **Target the `main` branch** with your PR.
2. Fill in the PR template:
   - Description of the change
   - Related issue number (if applicable)
   - Screenshots for UI changes
3. Ensure your branch is **up to date** with `main` before requesting review:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

4. PRs are reviewed and merged by the project maintainer(s). Feedback may be provided as review comments — please address all comments before the PR can be merged.
5. Once approved, the PR will be squash-merged into `main`.

---

## Project Structure

```
Markdown-Viewer/
├── index.html              # Main web app HTML
├── script.js               # Core JavaScript logic
├── styles.css              # All styles (light + dark themes)
├── Dockerfile              # Nginx-based web app container
├── docker-compose.yml      # Docker Compose configuration
├── README.md               # Project overview
├── LICENSE                 # Apache 2.0 License
├── assets/                 # Screenshots and icons for documentation
├── wiki/                   # GitHub Wiki source pages
└── desktop-app/            # Neutralinojs desktop app
    ├── package.json
    ├── neutralino.config.json
    ├── setup-binaries.js
    ├── prepare.js
    └── resources/
        ├── index.html
        ├── styles.css
        └── js/
            ├── main.js
            ├── script.js
            └── neutralino.js
```
