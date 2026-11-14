# Encrypted sharing protocol and rollout

New snapshots, managed attachments, and live rooms use version 2 client-side encryption. The implementation uses browser Web Crypto and locally bundled Yjs. No server encryption secret or key-management service is required.

## Snapshot and attachment envelopes

`sharing-crypto.js` generates independent 32-byte random keys. AES-256-GCM encrypts UTF-8 JSON with a random 12-byte IV, a 128-bit tag, and additional authenticated data `markdown-viewer:v2:snapshot` or `markdown-viewer:v2:media`. The exact envelope fields are `v: 2`, `alg: "A256GCM"`, `iv`, and `ct`; binary fields use unpadded canonical base64url. `ct` includes the authentication tag. The content key never appears in the envelope or API request.

Snapshot plaintext is `{content,title,mode}`. Managed-media plaintext is `{dataUrl}` including the MIME type and base64 file bytes. JSON limits are 8 MiB and 15 MiB respectively; encoded request limits allow only the corresponding bounded overhead. The client verifies media signatures, allowed raster/video types, and decoded sizes before upload and after decryption. The server validates envelope shape, lengths, and version without decrypting content.

New ids use 18 random bytes: `s2_<base64url>` and `e2_<base64url>`. Storage prefixes are `share-v2:` and `managed-media-v2:`. Snapshot records contain ciphertext, creation time, version, and a deletion-token hash. Media records contain ciphertext, creation/expiry times, and version. Both have a fixed 90-day TTL. Identical media uploads create independent records without refreshing older records.

Complete links carry `key` in the fragment. Inline snapshots pack the encrypted envelope into `#share=v2.<base64url-json>&key=...`; stored snapshots use `#id=s2_...&key=...`. Attachments use `/api/image/e2_...#key=...` or `/api/media/e2_...#key=...`. The client removes fragments before requests. Snapshot deletion uses an independent random token; only its SHA-256 hash is stored. The recipient link does not include it.

## Live protocol

Rooms use independent read keys and ECDSA P-256 host/edit/view signing pairs. The public configuration contains exactly `v`, `roomId`, `expiresAt`, `host`, `edit`, `view`. Public keys are raw P-256 points; role private keys are PKCS8 and remain in clients or the role-specific invite fragment. The host key is never included in guest invites. Each role also has an independent connection capability. The first WebSocket frame authenticates that capability over TLS; the relay stores SHA-256 capability hashes, public configuration, expiry, and ended status.

Each connection generates a random 16-byte session salt and derives a session AES-256-GCM key from the read key with HKDF-SHA-256. HKDF info binds room and sender. A 12-byte IV contains a zero prefix and a monotonically increasing 32-bit big-endian sequence counter. A session stops before counter exhaustion. New session salts yield independent keys. Frames contain exactly `v,roomId,sender,session,seq,type,role,iv,ct,sig`.

The canonical authenticated header is the JSON array `["markdown-viewer:live", 2, roomId, sender, session, seq, type, role]`. ECDSA-SHA-256 signs UTF-8 JSON `[headerString, iv, ct]` as defined in `header`/`signedBytes`. Relay and recipients verify signatures against the public role key and reject unauthorized channels. Recipients authenticate AES-GCM before applying payloads and track per-role/sender/session sequence numbers to reject duplicates and reordering. Queues, frame sizes, session histories, sockets, and authentication time are bounded. Processing is serialized per connection.

Document, Review, and host control state use separate channels/documents. Names, cursors, presence, sync content, leave and end events are encrypted. Only host signatures authorize room controls, full Review state, and session end. Viewers may contribute Review changes but cannot publish document changes. Editors cannot publish host controls. Same-role participants share role authority; signatures are not individual identity certificates.

New rooms last at most 24 hours. End persists an ended marker before closing sockets, preventing rejoining. Expiry alarms close sockets and remove authentication state. The relay has no document history. Capability authentication and public signatures do not give the relay content-decryption keys.

## Client rendering and exports

Decrypted content is sanitized before rendering. Inert templates remove external resource attributes before nodes enter the live DOM. Encrypted attachments resolve to local blob URLs, revoked on rerender/disposal. Private shared previews do not invoke remote diagram engines, external maps, or automatic resource loading; advanced blocks display source. Explicit user navigation remains possible. Web Markdown exports inline decrypted attachments. Private HTML exports are static, include inline media, and use a restrictive CSP. Exported files contain readable content.

## Deployment and compatibility

1. Build with `npm ci` and `npm run build`; prepare desktop resources with `node desktop-app/prepare.js` when packaging desktop.
2. Deploy the updated Durable Object Worker, then the Pages Functions and matching browser assets as one coordinated rollout. Preserve the existing KV namespace, Durable Object binding, and class migration. Include all three `sharing-*.js` files and `assets/yjs.mjs`.
3. Refresh clients. The service worker cache version changes. Older clients attempting new snapshot/media or room creation receive an upgrade/failure response; they must not retry with an older content format.
4. Existing snapshot/media reads and provisioned legacy rooms retain their compatibility paths. No migration, bulk deletion, or TTL refresh is performed. Naturally expiring records keep their timeline; legacy records without an expiry are not assigned one implicitly.
5. Validate synthetic snapshot round trips, encrypted media, host/editor/viewer collaboration, end/expiry behavior, and legacy reads in the target environment before promoting a release. Never log complete links, content keys, role private keys, decrypted content, or raw capabilities.

This change does not re-encrypt existing links. Rollback must retain v2 readers and relay support for already-created encrypted links; reverting to a build without these readers makes them unavailable. Do not restore plaintext creation as an automatic fallback.

## Security scope and verification

Operational metadata remains visible: identifiers, roles, frame types, timing, sizes, and network addresses. Complete links are bearer credentials. Recipients may copy content. Client/application delivery compromise, extensions, exported files, lost keys, and forward secrecy are outside the protection provided here. TLS is still required. There is no claim of an independent cryptographic audit.

Unit tests cover authenticated encryption, malformed envelopes, wrong keys, tampering, context separation, role forgery, replays, record opacity, legacy retention, and bounded requests. Local Miniflare/workerd tests exercise the real relay and storage. Browser tests cover snapshots, media/export, private rendering, and real Yjs collaboration with synthetic local services.
