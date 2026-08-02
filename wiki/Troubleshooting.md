# Troubleshooting

Use this page to diagnose Markdown Viewer setup, Preview, import, renderer, export, sharing, storage, and desktop problems. Start with the symptom, check the likely causes in order, and avoid clearing site data until you have exported any Document you need.

## Before You Start

1. Export important Documents as Markdown.
2. Record the application version from **About Markdown Viewer**.
3. Record the delivery target: hosted web app, PWA, local static server, Docker, Cloudflare deployment, or desktop application.
4. Open the browser developer console and Network panel when available.
5. Reproduce the problem with a small Document that does not contain confidential data.

When reporting a bug, include the smallest safe reproduction, browser or operating system, delivery target, expected result, actual result, and relevant console/network errors.

## The Application Does Not Load

### You opened `index.html` with `file://`

Serve the repository over HTTP:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`. Web Workers and Service Workers can be blocked under `file://`.

### The page is blank or scripts are blocked

- Confirm that JavaScript is enabled.
- Check the console for CSP, SRI, MIME-type, or network failures.
- Confirm that `index.html`, `workspace-storage.js`, `script.js`, `styles.css`, `preview-worker.js`, `sw.js`, `manifest.json`, `sample.md`, and `assets/` are served at the expected paths.
- If self-hosting under a sub-path, verify Worker, Service Worker, manifest, asset, and dynamic-library URLs.
- Hard-refresh once to bypass a stale page shell.

Do not weaken CSP to `*` as a first response. Add only the specific origins required by the deployed features.

## The Preview Is Blank or Stale

- Check that Marked, Highlight.js, and DOMPurify loaded successfully.
- Look for a DOMPurify error. Secure rendering aborts if the sanitizer is unavailable.
- Confirm that the Document is the active tab and that Preview is visible.
- For a large Document, wait for the worker timeout/fallback and check for `preview-worker.js` 404 errors.
- Try a minimal Document such as:

  ```markdown
  # Preview check

  Plain text.
  ```

- If the minimal Document works, reintroduce custom HTML, references, footnotes, and rich fences in small groups.

Large Documents above 50,000 characters can use the Preview Worker when their structure is safe for segmented rendering. If the Worker fails repeatedly, the application falls back to main-thread rendering; typing can be less responsive.

## Docker Preview or PWA Offline Support Is Incomplete

The checked-in root `Dockerfile` does not copy `preview-worker.js` or `sample.md`, but `sw.js` includes both in its critical precache. In the stock image:

- large-document Preview can fall back to the main thread after the Worker request fails; and
- Service Worker installation can fail because `cache.addAll()` requires every critical asset.

This is a known product packaging limitation at the audited commit. A documentation-only change does not modify the image.

For a custom image, serve every file in the [Installation: Static Hosting](Installation.md#static-hosting) list and verify that each Service Worker critical asset returns `200` with the correct MIME type.

## A Local Markdown File Will Not Import

Check:

- the extension is `.md` or `.markdown`, or the file type is `text/markdown`;
- the file is no larger than 10 MB;
- the first 8 KiB does not contain a null byte, which makes the file look binary;
- browser quota or desktop disk space is available; and
- the browser or desktop application has permission to read the selected file.

Extension matching is case-insensitive. Rename a plain-text file to `.md` only when it is actually Markdown text.

## GitHub Import Fails or Shows Too Few Files

- Use a public `github.com` repository, tree, blob, or `raw.githubusercontent.com` Markdown URL.
- For a private repository, add either a fine-grained or classic PAT with permission to read the required repository. The app detects both formats automatically. If an organization requires approval or SAML authorization, complete that step in GitHub.
- Supported repository, tree, blob, and raw URLs can identify a default branch, explicit branch, tag, or commit SHA. A standard GitHub `/commit/<sha>` page URL is not supported; use a `tree` or `blob` URL containing the commit SHA. For branch names containing `/`, paste the complete GitHub tree or blob URL so the importer can resolve the longest matching ref.
- Select the intended named token before importing. The local vault stores up to 50 named tokens, and each token name is limited to 60 characters. If GitHub rejects a token or reports that it cannot access the repository, check the GitHub-branded error toast, then replace the token or update its repository permissions. Tokens persist locally across refreshes and app restarts until you remove them or clear the site's/app's local data.
- Repository and folder results show every Markdown file found.
- Check GitHub API rate-limit and network responses.
- Confirm that CSP allows `api.github.com` and `raw.githubusercontent.com`.
- For a direct file, verify that the URL returns text rather than a login or HTML error page.

## Media Upload Fails

Check the format and size:

| Media | Limit |
| :--- | ---: |
| Source file before client processing | 25 MiB |
| Optimized still image | 300 KiB |
| GIF | 5 MiB |
| MP4, WebM, or Ogg video | 10 MiB |

Then check:

- first-use consent was accepted;
- `SHARE_KV` is configured;
- the request origin is allowed;
- the file signature matches its declared MIME type;
- `/api/image` or `/api/media` is reachable; and
- CSP permits the production API.

An expired managed-media URL returns not found after 90 days. Create a new upload and update the Markdown reference.

## Math Does Not Render

- Verify the LaTeX delimiters and escape a literal dollar sign as `\$`.
- Check whether MathJax loaded from the CDN or prepared desktop library.
- On first web use, confirm network access; later use can rely on the browser/Service Worker cache.
- Test with:

  ```markdown
  Inline: $E = mc^2$

  $$
  \sum_{i=1}^{n} i = \frac{n(n+1)}{2}
  $$
  ```

- Check the console for MathJax parsing or loading errors.

## A Diagram Does Not Render

1. Confirm the fence name and source syntax in [Markdown Reference](Markdown-Reference.md).
2. Identify the rendering path:

   - Mermaid, Markmap, maps, STL, ABC, and math use client-side libraries.
   - PlantUML uses the PlantUML server, with Kroki as a fallback.
   - D2, Graphviz/DOT, Vega-Lite, and WaveDrom use Kroki.
   - Some insertion previews use mermaid.ink or Kroki.

3. Check CSP and network access to the required renderer.
4. Wait for the 15-second request timeout and retries.
5. Try the same source in a minimal Document.
6. Do not paste confidential source into a third-party renderer during diagnosis.

The standard desktop configuration does not allow `os.execCommand`; local PlantUML/D2 command execution is therefore unavailable unless a custom build changes the native permissions and explicit opt-in.

## A Map, STL Model, or ABC Score Fails

### GeoJSON or TopoJSON

- Validate the JSON.
- Check Leaflet and TopoJSON library loading.
- Check map-tile network requests and CSP.
- Remember that the geometry can render while background tiles remain unavailable.

### STL

- Keep source below 2 MiB.
- Ensure every parsed vertex is finite.
- Keep geometry at or below 300,000 vertices.
- Verify WebGL/GPU availability.
- Try a small ASCII STL to separate source and GPU problems.

### ABC notation

- Validate the ABC header and bar syntax.
- Confirm ABCJS loaded.
- Browser audio requires a supported AudioContext and often a user gesture.
- Check soundfont/network requests when playback, but not notation, fails.

## PDF or PNG Export Is Missing Content

- Wait for math, diagrams, maps, models, images, and fonts to finish rendering.
- Use Browser Print for most long, text-heavy Documents.
- Use Legacy Raster PDF only when screenshot-style pagination is needed.
- Check external images for CORS support; cross-origin images can be omitted from canvas exports.
- Reduce Document length, image dimensions, or renderer size if the browser reaches canvas or memory limits.
- Close other memory-heavy tabs.
- Check whether author-specified dark SVG, image, HTML, or diagram colors remain dark in Browser Print; the print path does not rewrite authored colors.

The final print layout is controlled by the browser or operating system. Different engines can paginate differently.

## Share Snapshot Fails

- Confirm that Pako loaded.
- For stored mode, verify `/api/share`, `SHARE_KV`, request origin, and network access.
- Keep stored content at or below 8,000,000 characters.
- A not-found stored link is invalid, deleted, or expired after 90 days.
- A snapshot tab is temporary. Export Markdown before closing or reloading if you edited it.
- The current UI cannot delete a stored snapshot early because it does not expose the API deletion token.

See [Share Snapshot](Share-Snapshot.md).

## Live Share Fails or Reports an Expired Room

- Ask the host to keep the room and original host Document open.
- Confirm the complete invite URL, including room secret, role, and capability.
- Verify that `/live-room/<room>` upgrades to WebSocket.
- Check `LIVE_ROOMS`, Worker deployment, Durable Object migration, and allowed Origin.
- Join within the 8-second initial-state window.
- A room allows at most 64 WebSocket participants and 8 MB per message.
- Ask the host to start a new session if the room has ended or no host is available to provide initial state.

The Durable Object persists role capability metadata but not Markdown or Review content. A participant cannot recover a Document from the server after every client with the content has left.

See [Live Share](Live-Share-Cloudflare.md).

## Documents Are Missing After an Update or Restart

Private mode does not delete existing documents, but **Reset workspace** permanently does. Private-session changes are deliberately not written, so changes made after Private mode was enabled will not survive reload or exit.

Check:

- a previously exported `.md` file;
- a ZIP previously exported from **Storage and Backup**;
- **Storage and Backup** for the current backend or vault location;
- browser/profile backups or whether site data was cleared;
- `Documents/Markdown Viewer Vault/Workspace`, `.markdown-viewer/history`, and `.markdown-viewer/trash` on desktop;
- verify the desktop app can access the fixed `Documents/Markdown Viewer Vault` path; or
- a Share Snapshot that has not expired.

Replacing the desktop binary does not remove the vault. Do not clear browser site data or manually delete the desktop vault while investigating storage loss.

## Secret Workspace Will Not Unlock

- Use the exact password created on that device/profile.
- Confirm that Web Crypto is available and the page uses a secure context.
- Do not reset the Secret Workspace unless you accept permanent deletion.
- A forgotten password cannot be recovered.
- Corrupt or partially cleared encrypted metadata cannot be reconstructed by the application.

Secret Workspace data is local to the browser profile or desktop storage. It does not synchronize automatically across devices.

## The PWA Is Not Available Offline

- Service Workers require HTTPS or localhost.
- Confirm that `sw.js` registered and activated.
- Inspect the `markdown-viewer-cache-*` cache.
- Every critical asset must load successfully during installation.
- CDN libraries are cached only after their first successful request.
- Managed media, GitHub import, stored Share Snapshot, Live Share, remote diagrams, external assets, and map tiles still require the network.

Clearing site data removes both the cache and locally saved Documents for that origin.

## The Desktop Application Does Not Start

- Run `npm install` and allow setup to download Neutralino binaries and libraries.
- Confirm that preparation generated `desktop-app/resources/libs/`.
- On Windows, review SmartScreen only if you trust the downloaded binary.
- On Linux, add execute permission.
- On macOS, use the documented quarantine command only if you trust the binary.
- Check that the executable matches the operating system and architecture.
- Re-run `npm run build` when prepared resources and root source are out of sync.

See [Desktop Application](Desktop-App.md).

## Report an Issue

Search [existing issues](https://github.com/ThisIs-Developer/Markdown-Viewer/issues) first. If the problem is new, include:

- version or commit;
- browser/OS and delivery target;
- exact reproduction steps;
- minimal non-sensitive Markdown;
- expected and actual result;
- console/network errors; and
- screenshots only when they add information not present in text.

Do not attach confidential Documents, bearer links, deletion tokens, room secrets, or vulnerability details. Follow [Contributing](Contributing.md#security-reports) for security reports.
