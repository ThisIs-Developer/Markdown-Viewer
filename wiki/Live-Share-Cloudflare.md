# Encrypted Live Share on Cloudflare

Live Share provides temporary collaboration with end-to-end encrypted document updates, Review threads, display names, presence, cursor positions, and session controls. It uses a WebSocket relay and locally bundled Yjs.

## Start and Join

1. Open a Document, select **Live Share**, and choose **Can edit** or **View only**.
2. Start the room. The browser creates a read key, independent role signing keys, and separate host/edit/view connection capabilities.
3. After the relay authenticates the host, copy the complete invite link to a trusted recipient.
4. Participants decrypt and synchronize locally in temporary tabs. Their role controls whether they can edit Markdown; both roles can contribute Review feedback.
5. Export any needed copies and let the host **End session** when finished.

The invite fragment carries the read key, the selected guest role's signing key and capability, and public verification information. It never includes the host signing key. Anyone receiving an invite can use or forward its authority, so protect complete links.

## Runtime and Authorization

The Pages route `functions/live-room/[[room]].js` and standalone `workers/live-room-worker.js` route new `room2_` rooms into a separate Durable Object namespace. Connections use `/live-room/<room>?v=2`; no key or capability is in the request URL. An initial WebSocket authentication frame carries the role capability and public room configuration. Only capability hashes, public verification keys, expiry, and ended status persist in `live-room-auth-v2`.

Each client derives a fresh per-session AES-GCM key from the room read key with HKDF-SHA-256. Monotonic counters form unique nonces within that session. Frames bind room, sender, session, role, type, and sequence as authenticated data and are signed with the role's ECDSA P-256 key. The relay and recipients verify signatures and allowed message types; recipients also authenticate ciphertext and reject replays. Host-only controls use a separate Yjs document.

Viewers can send presence, synchronization requests, and Review changes. Editors can also send document updates. Only the host can send room controls, full Review state, or end the room. Unsupported or malformed encrypted traffic closes the connection without a fallback.

## Retention and Limits

| Item | Behavior |
| :--- | :--- |
| Document and Review history | Not persisted by the relay |
| Room authentication record | Expires 24 hours after creation; an alarm removes it |
| End session | Persists ended status, relays the signed end event, and closes peers; rejoining is rejected |
| Maximum participants | 64, including pending authentication |
| Authentication deadline | 5 seconds |
| Application payload | Up to 8 MiB before encryption; bounded encoded frames and queues |
| Participant stale timeout | 45 seconds |
| Initial state timeout | 8 seconds |

The host supplies initial state. Once no client retains content, the relay cannot recover it. Existing rooms continue through the compatibility path; their records and lifetime are not rewritten. New legacy room creation is disabled.

## Privacy Boundaries

The relay handles ciphertext and operational metadata, including room identifiers, roles, message types, timing, and sizes. TLS protects transport and connection capabilities. Encryption does not hide metadata, prevent recipients copying content, provide forward secrecy, or protect a compromised browser/device/application delivery path. There is no account-based recipient verification.

Encrypted shared previews block automatic external assets and remote rendering; advanced diagrams/maps display local source. Keys stay in the client and private invite fragment. Keep exports and complete links private. See [Privacy and Security](Privacy-and-Security.md) and [protocol and rollout notes](../docs/ENCRYPTED_SHARING.md).

## Required Configuration

`wrangler.toml` binds `LIVE_ROOMS` for the Pages project and binds `SHARE_KV` for Share Snapshot plus managed media records. `wrangler.live-room.toml` deploys the standalone Durable Object worker:

```toml
name = "markdown-viewer-live-room"
main = "workers/live-room-worker.js"
compatibility_date = "2026-07-02"

[[durable_objects.bindings]]
name = "LIVE_ROOMS"
class_name = "LiveRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["LiveRoom"]
```

Share Snapshot and managed media use separate key prefixes in `SHARE_KV`; Live Share uses `LIVE_ROOMS`. They should not be described as the same storage path.

Related pages: [Share Snapshot](Share-Snapshot.md), [Privacy and Security](Privacy-and-Security.md), [Configuration](Configuration.md), and [Troubleshooting](Troubleshooting.md#live-share-fails-or-reports-an-expired-room).
