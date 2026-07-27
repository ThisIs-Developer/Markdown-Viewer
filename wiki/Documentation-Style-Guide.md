# Documentation Style Guide

Use this guide for Markdown Viewer READMEs, Wiki pages, release notes, and translated documentation. The goal is accurate, direct, internationally readable documentation that remains maintainable as the product changes.

## Source of Truth

- Treat the current implementation as the source of truth for current behavior.
- Verify a feature in code or tests before documenting it as available.
- Use the changelog for historical context, not as proof of current behavior.
- Document relevant limits, prerequisites, fallback behavior, storage, network requests, and privacy implications.
- Do not imply a guarantee that the implementation cannot provide.
- If code and documentation disagree, update the documentation and record material mismatches in [Documentation Audit](Documentation-Audit.md). Do not change product code as part of a documentation-only change.

## Page Responsibilities

| Page type | Responsibility |
| :--- | :--- |
| Root README | Concise product overview, quick start, key boundaries, and links |
| Documentation Home | Audience-oriented “Start here” navigation |
| Features | Complete implemented behavior and technical limits |
| Usage Guide | Task-oriented user workflows |
| Markdown Reference | Supported syntax and renderer examples |
| Installation and deployment pages | Prerequisites, commands, configuration, validation, and rollback/troubleshooting links |
| Privacy and Security | Authoritative data-flow, retention, bearer-link, sanitization, and deployment-security guidance |
| FAQ | Short answers to common questions |
| Troubleshooting | Symptom, cause, diagnostic, and recovery procedures |
| Changelog | Historical, version-specific product changes |
| Localized README | Concise translated overview linked to detailed English sources |

Link to the responsible page instead of copying its complete explanation. A short summary is acceptable when readers need context before following the link.

## Headings and Structure

- Use one top-level heading per file. Prefer Markdown `#`; a centered README banner can use one HTML `<h1>` instead.
- Use title-style capitalization for English headings. Capitalize major words and leave short articles, conjunctions, and prepositions lowercase unless they begin the heading.
- Keep headings short, specific, and stable because links depend on generated anchors.
- Do not add emoji to headings that must be linked across languages or files.
- Do not skip heading levels.
- Begin task pages with the outcome or purpose, then prerequisites, steps, expected result, limitations, and related pages.
- Use tables for comparisons, limits, mappings, and repeated fields. Use lists for independent items and numbered steps for sequences.

## Product and Feature Names

Use these English names consistently:

- **Markdown Viewer**
- **Editor**
- **Preview**
- **Split view**
- **Workspace**
- **Document**
- **Folder**
- **Share Snapshot**
- **Live Share**
- **View only**
- **Can edit**
- **Private mode**
- **Secret Workspace**
- **Desktop application**
- **Progressive Web App (PWA)**

Do not use “real-time sharing” as a substitute for **Live Share** or “shared link” as a substitute for **Share Snapshot** when referring to the named feature. Use “view-only” as an adjective and **View only** for the UI capability. Use **Can edit** for the UI capability rather than “editable role.”

For translations, use [Terminology Glossary](Terminology-Glossary.md) and match the current interface label where it exists.

## Sentences and Tone

- Prefer direct, active sentences.
- Address the reader as “you” in task instructions.
- Define an acronym at first use unless it is a code identifier.
- Keep one main idea per paragraph.
- Use “can” for capability, “must” for a requirement, and “might” or “can” for a conditional outcome.
- Avoid promotional superlatives, vague claims, and unnecessary adjectives.
- Do not claim “secure,” “private,” “offline,” “local,” or “client-side” without stating the relevant boundary.
- Avoid fabricated performance, compatibility, adoption, security, and reliability claims.

## Code, Commands, Paths, and UI

- Put file names, paths, commands, configuration keys, API routes, hash formats, keyboard keys, code identifiers, and Markdown fences in backticks.
- Use fenced code blocks with a language identifier when practical.
- Keep commands copyable. Do not include a shell prompt character.
- State the working directory before a command when it is not obvious.
- Use the exact capitalization of UI labels in bold, such as **Share Snapshot**.
- Do not translate code, commands, paths, URLs, API routes, configuration keys, library names, Markdown syntax, or Git branch names.

## Notes, Warnings, and Privacy Notices

Use a short bold label when information needs emphasis:

> **Note:** Adds useful context without changing the task.

> **Important:** Identifies a prerequisite or behavior that can materially affect the result.

> **Privacy:** Identifies data that leaves the device, the recipient, retention, and access model.

> **Warning:** Identifies possible data loss, public exposure, irreversible action, or security risk.

Place a warning before the risky step. Do not hide bearer-link, public-media, deletion, expiry, or destructive-reset limitations at the end of a page.

## Links and Anchors

- Use repository-relative links with the `.md` extension for other Markdown files.
- Include an explicit anchor only when linking to a specific section.
- Prefer descriptive link text over “click here.”
- Link localized READMEs to localized pages when they exist. When they do not, identify the target as English.
- Check that local files, images, and heading anchors exist.
- Preserve valid public URLs unless the destination has moved or the URL is demonstrably broken.
- Link directly to official documentation for libraries, Docker, Neutralino, Cloudflare, and renderer services when a reader needs external setup detail.

## Screenshots and Other Images

- Use screenshots only when they clarify a workflow or layout.
- Provide alt text that describes the useful state, not the file name.
- Do not use screenshots as the only source of a command, setting, limit, or warning.
- Prefer stable repository assets for essential documentation. Treat issue-attachment images as external dependencies.
- Update or remove a screenshot when it shows labels or behavior that no longer exists.

## Lists and Tables

- Use parallel grammar within a list.
- End list items consistently when they are full sentences.
- Keep table cells concise; move procedures out of tables.
- Include units in the heading or value.
- Explain whether a size is bytes, characters, source size, optimized payload, or live message size.
- Use “up to” only for an enforced maximum.

## Localization

- Finalize the English source before translating it.
- Translate meaning and user intent, not English word order.
- Preserve Markdown structure, links, anchors, code fences, code, commands, paths, URLs, API routes, configuration keys, and product name.
- Use common software terminology in the target language and the current UI label when available.
- Keep headings concise enough for navigation and tables.
- Verify grammar, technical meaning, terminology, UI consistency, links, anchors, and Markdown structure.
- If a detailed localized page does not exist, link clearly to the English source.
- Record uncertain terminology for native-speaker review instead of guessing silently.

## Changelog Entries

- Keep entries factual, version-specific, and written in past tense.
- Describe user-visible outcomes before implementation detail.
- Do not copy current feature documentation into historical entries.
- Preserve historical behavior, but correct factual errors such as an invalid route or hash format.
- Do not imply that a behavior from an older release remains current; link to current documentation when readers need the present state.
- Documentation-only changes do not need a product changelog entry unless the project explicitly tracks documentation releases.

## Version-Specific Statements

- Prefer current behavior without a version number on evergreen pages.
- When a version matters, name the version and the evidence source.
- Avoid “latest,” “currently,” or “recently” when a stable fact or version number is clearer.
- Keep version numbers synchronized across the application, desktop configuration, Service Worker cache, package metadata, and release notes only when the task authorizes product metadata changes.

## Review Checklist

- [ ] The implementation or a test supports every behavior claim.
- [ ] Limits, fallbacks, network use, storage, retention, and destructive actions are stated.
- [ ] The page has one clear responsibility and does not duplicate another page in full.
- [ ] Product and feature names follow the glossary.
- [ ] Commands, paths, keys, routes, and syntax are formatted correctly.
- [ ] Relative links, images, and anchors resolve.
- [ ] Headings are concise, title style, and structurally valid.
- [ ] Translated pages match the finalized English source and current UI labels.
- [ ] No unsupported performance, compatibility, privacy, or security claim was added.
- [ ] A documentation-only change modifies no application logic.

Related pages: [Contributing](Contributing.md), [Localization](Localization.md), [Terminology Glossary](Terminology-Glossary.md), and [Documentation Audit](Documentation-Audit.md).
