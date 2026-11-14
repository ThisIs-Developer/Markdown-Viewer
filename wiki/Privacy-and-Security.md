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
- New Share Snapshot, managed-media, and Live Share payloads are encrypted on the device before transmission.

> **Privacy:** Protect complete share links: their fragments contain decryption keys. Encrypted shared previews block automatic external assets and remote renderers. Ordinary documents can still contact remote services when those features are used.

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
| Private mode state | In memory only | Cleared on reload or exit so the next page session resumes persistence |
| Deleted documents and encrypted recovery records | IndexedDB `trash` store | Recoverable records under `.markdown-viewer/trash` in the vault |

Temporary Share Snapshot and Live Share participant tabs are removed before normal tab persistence. Opening someone else's link therefore does not silently add that temporary document to the saved Workspace.

Browser storage quotas and user-cleared site data still apply. The application cannot recover data after the browser, operating system, user, or storage policy deletes it.

Normal-document recovery journals retain newer edits and review comments when an
older save completes. Matching committed records are cleared conditionally; a
failed save retains its recovery records. Recovery is local and is not a substitute
for an external backup. Secret Workspace recovery continues using encrypted records.

Document saves and deletions are coordinated to avoid restoring a document through
an obsolete queued save. Desktop moves check their source and destination before
moving a document and reject occupied destinations. These checks are not filesystem
locks or atomic compare-and-swap guarantees; another process can still change files
after a check.

Deleted normal documents and encrypted Secret Workspace recovery records remain in the application Trash for 30 days. Users can restore one item, permanently delete one item, or empty Trash after an explicit confirmation. Automatic cleanup requires a valid deletion timestamp and a recognized, structurally valid Trash record; missing, corrupt, or future-format records are retained rather than guessed at and deleted. Trash is local recovery storage, not a backup, and is excluded from exported workspace ZIP files.

## Private Mode, Reset Workspace, and Secret Workspace

These controls have different purposes:

| Control | Effect | Important limitation |
| :--- | :--- | :--- |
| **Private mode** | Pauses new document-state writes while enabled | Existing normal and Secret Workspace documents remain intact; session changes will not survive reload or exit. |
| **Reset workspace** | Permanently deletes files, folders, review data, settings, Secret Workspace, history, and trash | Irreversible after confirmation; create a backup first if data must be retained. |
| **Reset Secret Workspace** | Deletes every encrypted Secret Workspace file and folder | Irreversible; a confirmation is shown. |
| Lock Secret Workspace | Removes the in-memory key and hides encrypted content | The encrypted payload remains stored locally. |

Both **Reset workspace** and **Reset Secret Workspace** are destructive to encrypted content. Reset workspace clears everything; Reset Secret Workspace targets only the encrypted area.

Whole-workspace reset and backup restore temporarily block editing and new imports,
wait for pending document deletions, and flush current drafts before replacement.
Failure during preparation re-enables editing without starting replacement. If a
restore and its rollback both fail, editing remains blocked until reload so the
application cannot continue writing an uncertain workspace state. These safeguards
do not make reset reversible or guarantee recovery after storage failure.

Secret Workspace uses PBKDF2 with SHA-256, 250,000 iterations, a random salt, and AES-GCM with a 256-bit derived key. The key remains in memory only while the Workspace is unlocked. File contents and folder names are encrypted; item counts, salt, initialization vector, iteration count, and format version remain outside the ciphertext as metadata. A forgotten password cannot be recovered.

Secret Workspace protects the stored payload from casual inspection at rest. It does not protect content after you unlock it, export it, send it through a network feature, or expose the running device or browser session.

### Clear Local Data

Clearing site data in the browser removes Markdown Viewer IndexedDB, `localStorage`, preferences, the Service Worker, and cached assets for that origin. Browser-level clearing cannot be undone by Markdown Viewer, so export important content separately.

In the desktop application, replacing or deleting the binary does not remove `Documents/Markdown Viewer Vault`. Every binary checks that fixed location at startup and restores the existing vault automatically. App-managed workspace files, metadata, encrypted records, history, and trash stay inside the vault; explicit user exports can still be saved to a user-selected destination. The Backup action creates a portable ZIP containing normal documents, organization, review data, selected preferences, and optional encrypted Secret Workspace records. Trash, desktop history, and recovery journals are not included. Importing a backup replaces the current workspace after confirmation. Users can also copy the complete vault with normal filesystem tools.

Desktop releases publish `SHA256SUMS.txt` for the assembled application assets and verify
the complete manifest before publication. macOS releases also include
`MACOS-SIGNING.txt`, which states whether the package is Developer ID signed/notarized or
ad-hoc signed. Product name, publisher, license, icons, desktop entries, and AppStream or
Finder metadata improve identification but are not a cryptographic publisher guarantee.
Organizations should verify checksums and signing state and test the selected package on
representative devices before broad deployment.

## Data That Can Leave the Device

| Feature | Data sent | Destination and retention | Access model |
| :--- | :--- | :--- | :--- |
| Web/PWA library loading | Library requests, IP and normal HTTP metadata | cdnjs, jsDelivr, or esm.sh; browser/Service Worker cache | Governed by the remote host |
| GitHub import | Repository/path/ref request and selected content downloads; optional named PATs for private repositories | Public content: GitHub API and `raw.githubusercontent.com`; private content, PAT validation, and PAT-authenticated requests: `api.github.com` only | Fine-grained and classic PATs are accepted automatically. Credential payloads persist locally as AES-GCM ciphertext until removed and are not included in workspace backups. Browser builds keep a non-extractable key in IndexedDB; the desktop build keeps key material in Neutralino's system app storage and imports it as a non-extractable runtime key. PATs are sent only to GitHub. |
| Emoji lookup | Emoji API request | GitHub API; response kept in memory/cache | Remote host |
| Remote diagrams | Diagram source or encoded source | PlantUML, Kroki, or mermaid.ink; response can be browser-cached | Remote renderer receives the source |
| GeoJSON/TopoJSON maps | Tile and external-asset requests | Configured map-tile or asset host | Remote host |
| External Markdown assets | Image, media, font, and link requests | Author-specified host | Remote host |
| Managed media | Encrypted image, GIF, or video after first-use consent | Cloudflare KV for 90 days per upload | Complete URL includes the client decryption key |
| Stored Share Snapshot | Encrypted Markdown, mode, and title; creation metadata and deletion-token hash | Cloudflare KV for 90 days | Complete URL includes the client decryption key |
| Live Share | Encrypted and signed document/Review updates, names, presence, cursors, and controls | Cloudflare Durable Object relay while clients are connected | Read key, role signing key, and role capability |
| Live Share authentication metadata | Capability hashes, public role keys, room expiry, ended status | Durable Object storage for 24 hours in new rooms | Used to authenticate connections and verify signatures |

The local GitHub credential vault protects PAT values from plaintext storage and keeps them out of workspace backups. It is not an operating-system keychain: malicious code running in the application origin, a compromised browser/app profile, a hostile extension, or malware on the unlocked device could still use the locally stored key. Remove the local entry and revoke the PAT in GitHub if the device, profile, or token may be compromised.

Cloudflare, CDN, GitHub, renderer, map, external-asset, reverse-proxy, and self-hosting operators can retain normal service logs independently of Markdown Viewer's application-level storage.

## Encrypted Sharing and Managed Media

New snapshots encrypt Markdown, titles, and access mode using AES-256-GCM with an independent random key. New managed uploads encrypt validated image/video data before transmission, including its media type. New live rooms encrypt document and Review updates, identities, presence, cursors, and controls, and verify role-based signatures. Keys remain in clients and complete share-link fragments; API requests and WebSocket URLs do not carry decryption or private signing keys.

Managed media supports AVIF, BMP, GIF, JPEG, PNG, WebP, MP4, WebM, and Ogg. The client validates file types and signatures. Source files are limited to 25 MiB, optimized still images to 300 KiB, GIFs to 5 MiB, and videos to 10 MiB. Each upload has a random identifier and expires after 90 days; repeated content creates a separate record. There is no managed-media deletion control.

Small snapshots carry ciphertext in the fragment. Larger snapshots store ciphertext in Cloudflare KV for 90 days, with a separate deletion-token hash. **Delete snapshot** is available while the current generated-link modal retains its token. Closing/resetting it loses that in-memory credential. Deletion cannot remove copies already downloaded or separately stored media.

New live rooms store only capability hashes, public verification keys, expiry, and ended status. Their 24-hour deadline is fixed at creation. The relay does not persist document history. Ending a room rejects rejoining; an expiry alarm removes its authentication record. Existing shares, media, and rooms retain their compatibility behavior and original lifetime, with no migration or expiry extension.

Encrypted shared previews block automatic external images/media, remote diagrams, maps, and renderer-specific network loading. Advanced content is shown as local source, and managed encrypted media decrypts to local blob URLs. Explicit link navigation and user-selected exports remain available. Web Markdown and encrypted-share HTML exports inline decrypted attachments; exported documents are readable files.

## Encryption Boundaries

- Anyone with a complete valid link can decrypt content and forward that authority. View-only UI controls do not prevent copying or screenshots.
- Lost keys cannot be recovered by the service. Missing keys, unsupported versions, or failed authentication do not fall back to another format.
- Room identifiers, roles, message types, ciphertext sizes, timing, network addresses, and normal platform logs remain operational metadata.
- TLS remains necessary for transport and connection capabilities. Encryption does not provide forward secrecy or protect a compromised device, browser extension, application origin, or application delivery path.
- Role signatures distinguish host/editor/viewer authority; they do not verify a person's real-world identity. Participants sharing the same role credential share that authority.
- The implementation has automated security and integration coverage; it is not a claim of an independent cryptographic audit.

See [Share Snapshot](Share-Snapshot.md), [Live Share](Live-Share-Cloudflare.md), and [protocol and rollout notes](../docs/ENCRYPTED_SHARING.md).

## Content Sanitization

Markdown is parsed with Marked, then rendered HTML is sanitized with DOMPurify before insertion into Preview. The allowlist includes the elements and attributes needed for math, task lists, media, renderer metadata, and accessibility. Scripts, inline event handlers, unsafe URI schemes, and SVG data URLs are not preserved.

Remote SVG diagrams receive additional processing: scripts and `foreignObject` elements are removed, unsafe attributes are stripped, and the result is sanitized before use.

Sanitization reduces cross-site scripting risk. It is not a guarantee against browser defects, third-party library vulnerabilities, malicious external resources, or unsafe changes to the sanitizer configuration.

## Export Security

- Markdown export writes the raw source.
- HTML export uses sanitized content, a restrictive Content Security Policy (CSP), and Subresource Integrity (SRI) metadata where external assets have known hashes.
- Standard PDF delegates final output to the browser or operating system.
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
- open/save/folder dialogs and message boxes;
- external URL opening and tray setup;
- file read/write, app-managed directory/metadata operations and linked-source watchers; and
- storage get/set/list/remove/clear.

`os.execCommand` is not in the default allowlist. The standard desktop application therefore cannot execute PlantUML or D2 command-line programs through the local-renderer code path. PlantUML and D2 use remote services in the standard build. A custom build that enables command execution changes the threat model and must use explicit user consent and narrowly fixed commands.

### Linked-source data boundaries

Desktop linked originals are external files explicitly selected by the user. Editing
stores an internal recovery draft, separate from the ordinary Vault root; explicit Save
is required to update an original. A recovered draft is not a backup guarantee.
Conflicts and missing originals require an explicit decision before replacement or
recreation. Removing a link does not delete its original. Conversion produces an
independent Vault document from the live draft.

Workspace ZIPs include linked recovery documents, but importing a ZIP does not restore
authority to write its recorded external paths or register watchers for them. Recovered
documents must be explicitly re-linked before they can modify originals.

Source reads and scans are bounded. Native filesystem checks and verification reduce
accidental data loss but are not atomic no-overwrite operations or multi-file
transactions. Another local program can race a write; partial folder results are
reported and retained rather than treated as a completed transaction.

## Security Reporting

See the [Security Policy](../SECURITY.md) for supported versions and vulnerability-reporting instructions.

## Known Limitations

- Bearer links can be forwarded, logged by surrounding systems, copied into chat, or exposed through browser synchronization.
- New live rooms encrypt content and retain authentication metadata for 24 hours; complete links still grant bearer access.
- Snapshot deletion authority is kept only in the current generated-link modal; closing/resetting it loses that credential.
- Managed media has no early-delete control.
- Private mode preserves persisted Secret Workspace data. Reset workspace and Reset Secret Workspace are irreversible after confirmation.
- Security headers differ by deployment target and can be weakened by self-hosting changes.
- Remote services and external assets operate under their own privacy, availability, and logging policies.
- Browser storage, extensions, malware, a compromised device, and users with local profile access remain outside the application's protection boundary.

Related pages: [Features](Features.md), [Configuration](Configuration.md), [Share Snapshot](Share-Snapshot.md), [Live Share](Live-Share-Cloudflare.md), and [Troubleshooting](Troubleshooting.md).
