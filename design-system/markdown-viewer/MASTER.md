# Markdown Viewer Design System

This file records the approved visual direction for the workspace redesign. The written product requirements and supplied reference image override generic UI recommendations.

## Product character

- Professional productivity workspace: calm, dense, precise, and document-first.
- Light mode is the primary reference; dark mode preserves the same hierarchy and contrast.
- The application should feel like one connected desktop tool, not a collection of cards.
- Decorative effects stay restrained. Borders, spacing, typography, and state color create the hierarchy.

## Foundations

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#eef2f7` | `#0b1120` |
| Workspace | `#ffffff` | `#111827` |
| Sidebar | `#f8fafc` | `#0f172a` |
| Soft surface | `#f4f7fb` | `#172033` |
| Primary text | `#172033` | `#f8fafc` |
| Secondary text | `#667085` | `#a8b3c7` |
| Border | `#dde3ec` | `#2a364b` |
| Active blue | `#3978e8` | `#6ea3ff` |
| Success | `#22a06b` | `#39c98a` |
| Warning | `#d7951b` | `#f0b84b` |
| Destructive | `#dc4c64` | `#ff758b` |

- UI font: IBM Plex Sans, with system sans-serif fallback.
- Editor font: JetBrains Mono, with system monospace fallback.
- Base type is 14px on desktop and 15–16px for mobile form controls.
- Spacing follows a 4px grid. Dense controls use 6–10px gaps; sections use 16–24px.
- Radius scale: 6px for compact controls, 9px for buttons/inputs, 12–14px for panels.
- Permanent layout uses 1px borders. Shadows are reserved for floating menus, dialogs, and Live Share.

## Layout

- Desktop: full-width header, 236px sidebar, tab row, formatting toolbar, split editor/preview, status bar.
- 1024px: sidebar becomes a drawer; editor and preview remain side by side where practical.
- 768px: compact header and horizontal split with accessible controls.
- 320–375px: single-pane editor/preview workflow controlled from a persistent segmented switch in the status bar.
- Every viewport must avoid horizontal page scrolling; internal tab and toolbar rows may scroll deliberately.

## Components and states

- Buttons are compact, white/soft-surface, 1px bordered, and use consistent Bootstrap outline icons.
- Active states use a pale blue fill plus blue text/icon; do not rely on color alone for selected tabs or views.
- Inputs have a visible 3px focus ring. Keyboard access is required for menus, dialogs, search, and view switching.
- Sidebar sections use muted uppercase labels and flat rows. Diagram engines use compact two-column buttons.
- Markdown content prioritizes comfortable reading width, semantic heading hierarchy, bordered tables, and readable code cards.
- Mobile interactive targets are at least 44px.

## Motion and accessibility

- Transitions are 120–180ms and limited to color, opacity, border, and drawer movement.
- Respect `prefers-reduced-motion`.
- Maintain WCAG AA text contrast, visible focus, semantic button labels, and no emoji-only UI icons.
- Use real controls for actions. Informational navigation rows are visually distinct from interactive editor commands.

## Delivery checklist

- [ ] Complete keyboard-visible focus treatment
- [ ] No unintended horizontal overflow at 320, 375, 768, 1024, or 1440px
- [ ] Editor, preview, split view, search, import, export, theme, language, diagrams, review, and Live Share remain accessible
- [ ] Dark mode and reduced motion remain supported
- [ ] New scripts/styles are cached for offline startup
- [ ] No console or syntax errors
