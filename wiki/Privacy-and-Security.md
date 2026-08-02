# Privacy and Security

Markdown Viewer is local-first: normal editing, Preview rendering, local file import, Workspace organization, and most exports run on the device. It is not network-free. This page is the authoritative user-facing description of local storage, network features, retention, bearer links, content sanitization, deployment protections, and known security limitations.

## Privacy Summary

- No account or login is required.
- The application code does not implement analytics, telemetry, advertising, tracking pixels, or app-specific cookies.
- Normal web documents are stored as per-document IndexedDB records; desktop documents are ordinary files in a durable vault.
- Private mode disables new document-state persistence without deleting existing persisted documents.
- Secret Workspace encrypts its stored files and folder names on the device.
- Network-backed features send only the data needed for that feature, but the receiving service or deployment platform can log requests according to its own policy.
- Share Snapshot and Live Share URLs are bearer links. Possession of a valid link grants the capability encoded in it.
- Live Share is not end-to-end encrypted.

> **Privacy:** Do not place sensitive Markdown in a remote-rendered diagram, managed-media upload, stored Share Snapshot, or Live Share room unless you accept the stated service and bearer-link boundaries.

## Data Stored on the Device

| Data | Web location | Desktop behavior |
| :--- | :--- | :--- |
| Normal Workspace documents and review threads | Per-document `documents` and `contents` IndexedDB records | Individual `.md` files plus vault index metadata |
| Folder and Workspace organization | `markdownViewerDocumentOrganization` plus document metadata | Vault index and app preferences |
| Encrypted Secret Workspace payload | Per-document encrypted `secretRecords` plus a small manifest | Opaque `.mvault` objects under `Secret Workspace/objects` |
| Active document and untitled counter | `markdownViewerActiveTab`, `markdownViewerUntitledCounter` | Mirrored |
| Theme, direction, view, and related preferences | `markdownViewerGlobalState` | Mirrored |
| Interface language | `app-lang` | Local browser value; restored in prepared desktop use where available |
| Find and Replace docking preference | `find-replace-docked` | Local browser value; restored in prepared desktop use where available |
| Private mode preference | `markdownViewerPrivateMode` | Remains locally so the mode survives reload |

Temporary Share Snapshot and Live Share participant tabs are removed before normal tab persistence. Opening someone else's link therefore does not silently add that temporary document to the saved Workspace.

Browser storage quotas and user-cleared site data still apply. The application cannot recover data after the browser, operating system, user, or storage policy deletes it.

## Private Mode, Reset Workspace, and Secret Workspace

These controls have different purposes:

| Control | Effect | Important limitation |
| :--- | :--- | :--- |
| **Private mode** | Pauses new document-state writes while enabled | Existing normal and Secret Workspace documents remain intact; session changes will not survive reload or exit. |
| **Reset workspace** | Permanently deletes files, folders, review data, settings, Secret Workspace, history, and trash | Irreversible after confirmation; create a backup first if data must be retained. |
| **Reset Secret Workspace** | Deletes every encrypted Secret Workspace file and folder | Irreversible; a confirmation is shown. |
| Lock Secret Workspace | Removes the in-memory key and hides encrypted content | The encrypted payload remains stored locally. |

Both **Reset workspace** and **Reset Secret Workspace** are destructive to encrypted content. Reset workspace clears everything; Reset Secret Workspace targets only the encrypted area.

Secret Workspace uses PBKDF2 with SHA-256, 250,000 iterations, a random salt, and AES-GCM with a 256-bit derived key. The key remains in memory only while the Workspace is unlocked. File contents and folder names are encrypted; item counts, salt, initialization vector, iteration count, and format version remain outside the ciphertext as metadata. A forgotten password cannot be recovered.

Secret Workspace protects the stored payload from casual inspection at rest. It does not protect content after you unlock it, export it, send it through a network feature, or expose the running device or browser session.

### Clear Local Data

Clearing site data in the browser removes Markdown Viewer IndexedDB, `localStorage`, preferences, the Service Worker, and cached assets for that origin. Browser-level clearing cannot be undone by Markdown Viewer, so export important content separately.

In the desktop application, replacing or deleting the binary does not remove `Documents/Markdown Viewer Vault`. Every binary checks that fixed location at startup and restores the existing vault automatically. App-managed workspace files, metadata, encrypted records, history, and trash stay inside the vault; explicit user exports can still be saved to a user-selected destination. The Backup action creates a portable ZIP containing normal documents, organization, review data, selected preferences, and optional encrypted Secret Workspace records. Trash, desktop history, and recovery journals are not included. Importing a backup replaces the current workspace after confirmation. Users can also copy the complete vault with normal filesystem tools.

## Data That Can Leave the Device

| Feature | Data sent | Destination and retention | Access model |
| :--- | :--- | :--- | :--- |
| Web/PWA library loading | Library requests, IP and normal HTTP metadata | cdnjs, jsDelivr, or esm.sh; browser/Service Worker cache | Governed by the remote host |
| GitHub import | Repository/path/ref request and selected content downloads; optional named PATs for private repositories | Public content: GitHub API and `raw.githubusercontent.com`; private content, PAT validation, and PAT-authenticated requests: `api.github.com` only | Fine-grained and classic PATs are accepted automatically. Credential payloads persist locally as AES-GCM ciphertext until removed and are not included in workspace backups. Browser builds keep a non-extractable key in IndexedDB; the desktop build keeps key material in Neutralino's system app storage and imports it as a non-extractable runtime key. PATs are sent only to GitHub. |
| Emoji lookup | Emoji API request | GitHub API; response kept in memory/cache | Remote host |
| Remote diagrams | Diagram source or encoded source | PlantUML, Kroki, or mermaid.ink; response can be browser-cached | Remote renderer receives the source |
| GeoJSON/TopoJSON maps | Tile and external-asset requests | Configured map-tile or asset host | Remote host |
| External Markdown assets | Image, media, font, and link requests | Author-specified host | Remote host |
| Managed media | Optimized image, GIF, or video after first-use consent | Cloudflare KV for 90 days from the latest upload of identical content | Public to anyone with the unguessable URL |
| Stored Share Snapshot | Markdown content, mode, title, creation time, and size | Cloudflare KV for 90 days | Bearer snapshot URL |
| Live Share | Yjs Markdown/Review updates, display name, presence, cursor, sync, leave, and session-end messages | Cloudflare Durable Object relay while clients are connected | Room secret plus host/edit/view capability |
| Live Share capability metadata | Host, edit, and view bearer capability values plus `createdAt` | Durable Object storage; no application TTL or deletion path is implemented | Used by the Durable Object to authenticate roles |

The local GitHub credential vault protects PAT values from plaintext storage and keeps them out of workspace backups. It is not an operating-system keychain: malicious code running in the application origin, a compromised browser/app profile, a hostile extension, or malware on the unlocked device could still use the locally stored key. Remove the local entry and revoke the PAT in GitHub if the device, profile, or token may be compromised.

Cloudflare, CDN, GitHub, renderer, map, external-asset, reverse-proxy, and self-hosting operators can retain normal service logs independently of Markdown Viewer's application-level storage.

## Managed Media

Supported managed media includes AVIF, BMP, GIF, JPEG, PNG, WebP, MP4, WebM, and Ogg. The client asks for consent before its first managed upload.

- Source files are limited to 25 MiB before processing.
- Stored still images are limited to 300 KiB after optimization.
- Stored GIFs are limited to 5 MiB.
- Stored videos are limited to 10 MiB.
- The API validates declared media type and file signature.
- The content-derived URL is difficult to guess but is not an authorization mechanism.
- Uploading identical content reuses its identifier and refreshes the 90-day expiry.
- Share Snapshot and Live Share include the URL in Markdown; they do not make a second media copy.
- After expiry, the Markdown reference remains but the media stops loading.

There is no user deletion token for managed media. Expiry is the implemented removal mechanism.

## Share Snapshot

Small Share Snapshot content remains in the URL hash as `#share=...`. A hash fragment is not included in the normal HTTP request to open the page, although it can be exposed when a user copies the URL into another system, browser history is synchronized, extensions inspect the page, or the page itself processes the hash.

Stored snapshots use `#id=...` and Cloudflare KV. They expire after 90 days. The Share API returns a deletion token to the creating client and stores only its hash. The current application UI does not display the token or offer an early-delete control; an API client must capture the creation response and call `DELETE /api/share/<id>` with that token.

View only prevents normal editing in the client. Can edit lets the recipient change their temporary local copy. Neither mode is an authentication boundary, and Can edit snapshots are not real-time collaboration.

See [Share Snapshot](Share-Snapshot.md).

## Live Share

The Live Share relay does not persist Markdown or Review document state to KV or Durable Object storage. It does persist the host/edit/view capability record and `createdAt` in Durable Object storage so sockets can be authenticated.

- Hosts, editors, and viewers use distinct bearer capabilities.
- The server filters supported message types by role.
- Viewers cannot send Markdown updates or end the session; they can send presence, sync requests, and Review updates.
- The room secret and selected role capability are included in the invite URL.
- Anyone with a valid invite can attempt to join while a host is available.
- There is no end-to-end encryption.
- Ending a session broadcasts a client event and disconnects participants; it does not delete the stored capability record.
- No application TTL, explicit capability-record deletion, or server-side document history is implemented.

See [Live Share](Live-Share-Cloudflare.md).

## Content Sanitization

Markdown is parsed with Marked, then rendered HTML is sanitized with DOMPurify before insertion into Preview. The allowlist includes the elements and attributes needed for math, task lists, media, renderer metadata, and accessibility. Scripts, inline event handlers, unsafe URI schemes, and SVG data URLs are not preserved.

Remote SVG diagrams receive additional processing: scripts and `foreignObject` elements are removed, unsafe attributes are stripped, and the result is sanitized before use.

Sanitization reduces cross-site scripting risk. It is not a guarantee against browser defects, third-party library vulnerabilities, malicious external resources, or unsafe changes to the sanitizer configuration.

## Export Security

- Markdown export writes the raw source.
- HTML export uses sanitized content, a restrictive Content Security Policy (CSP), and Subresource Integrity (SRI) metadata where external assets have known hashes.
- Browser Print delegates final output to the browser or operating system.
- Legacy raster PDF and PNG use `html2canvas` with `allowTaint: false` and CORS-aware fetching.
- An exported HTML file can still request external images, media, fonts, or renderer libraries that the document references and the CSP permits.

Inspect sensitive documents and their external URLs before distributing an exported file.

## Deployment Protections

Cloudflare Pages uses the checked-in `_headers` and `_redirects` files for:

- CSP;
- HSTS;
- clickjacking protection;
- MIME-sniffing protection;
- referrer and permissions policies;
- cross-origin opener/resource policies; and
- 404 responses for selected sensitive or source-map paths.

The stock Docker image defines its own Nginx CSP and security headers. It is not identical to the Cloudflare policy. Self-hosters are responsible for TLS, logs, updates, headers, reverse-proxy behavior, compatible endpoint configuration, and retention in any replacement storage service.

Origin allowlists on Share and Live Share endpoints reduce unauthorized browser-origin use. They do not make bearer URLs secret and do not replace authentication, authorization, or encryption.

## Desktop Native API Restrictions

The default Neutralino configuration enables only:

- app exit;
- open/save dialogs and message boxes;
- external URL opening and tray setup;
- file read/write; and
- storage get/set/list/remove/clear.

`os.execCommand` is not in the default allowlist. The standard desktop application therefore cannot execute PlantUML or D2 command-line programs through the local-renderer code path. PlantUML and D2 use remote services in the standard build. A custom build that enables command execution changes the threat model and must use explicit user consent and narrowly fixed commands.

## Security Reporting

Do not publish vulnerability details in a normal issue. Use GitHub's private security-reporting channel when it is available for this repository, or contact the maintainers privately with:

- the affected version or commit;
- a minimal reproduction;
- security impact;
- required preconditions; and
- suggested mitigation, if known.

See [Contributing: Security Reports](Contributing.md#security-reports).

## Known Limitations

- Bearer links can be forwarded, logged by surrounding systems, copied into chat, or exposed through browser synchronization.
- Live Share is not end-to-end encrypted and persists capability metadata without an application TTL.
- The current Share Snapshot UI does not expose the early-deletion token.
- Managed media has no early-delete control.
- Private mode preserves persisted Secret Workspace data. Reset workspace and Reset Secret Workspace are irreversible after confirmation.
- Security headers differ by deployment target and can be weakened by self-hosting changes.
- Remote services and external assets operate under their own privacy, availability, and logging policies.
- Browser storage, extensions, malware, a compromised device, and users with local profile access remain outside the application's protection boundary.

Related pages: [Features](Features.md), [Configuration](Configuration.md), [Share Snapshot](Share-Snapshot.md), [Live Share](Live-Share-Cloudflare.md), and [Troubleshooting](Troubleshooting.md).
