# Localization and Internationalization

Markdown Viewer translates its interface in the browser. Core labels live in `I18N_DICTS` in `script.js`, while broader static and dynamic interface strings are loaded from `assets/i18n/<language>.json`. User-authored Markdown and filenames are never translated.

## Supported Locales

| Code | Language |
| :--- | :--- |
| `en` | English |
| `zh` | Simplified Chinese |
| `ja` | Japanese |
| `ko` | Korean |
| `pt` | Portuguese (Brazil) |
| `es` | Spanish |
| `fr` | French |
| `de` | German |
| `ru` | Russian |
| `it` | Italian |
| `tr` | Turkish |
| `pl` | Polish |
| `tw` | Traditional Chinese |
| `uk` | Ukrainian |

## Selection Order

The app chooses a language in this order:

1. URL query parameter, such as `?lang=pt`.
2. Hash query parameter when present in a shared URL.
3. Saved `localStorage` key `app-lang`.
4. Browser language from `navigator.language`.
5. English fallback.

When a user picks a language from the dropdown, the app saves `app-lang` and updates the URL query parameter.

## What Gets Translated

The catalogs cover:

- Header, toolbar, Explorer, tab, context-menu, and bulk-action labels.
- Import, media upload, GitHub import, export, Share Snapshot, and Live Share flows.
- View, review, theme, direction, statistics, workspace, and Secret Workspace controls.
- Modal titles, instructions, buttons, placeholders, progress messages, validation errors, tooltips, and accessibility labels.

Renderer output, browser messages, third-party text, generated filenames, external services, and some low-level errors can remain English.

## Dictionary Shape

`assets/i18n/en.json` is the source list. Every translated catalog uses the same English keys:

```json
{
  "New file": "新文件",
  "Reset workspace": "重置工作区",
  "Live Share": "实时共享"
}
```

The runtime also supports numbered templates such as `{{0}} files`. If a catalog entry is missing, the English source remains visible.

## Contributor Checklist

- Add or update visible English source text first.
- Regenerate catalogs from the repository root with `node assets/i18n/generate-ui-locales.mjs`.
- Review every new translation in context; use curated overrides where literal machine translation is unclear.
- Keep all locale catalogs on the same key set as `en.json`.
- Run the desktop prepare step so bundled catalogs match the web app.
- Check desktop and mobile menus, context menus, modal buttons, validation messages, Share Snapshot, Live Share, and `?lang=` URLs.

## Privacy

Localization is local. The app does not send document text or UI text to machine translation APIs.
