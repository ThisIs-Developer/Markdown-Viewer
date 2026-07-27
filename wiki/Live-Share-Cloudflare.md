# Live Share Rooms for Markdown Collaboration on Cloudflare

Live Share is the temporary Markdown collaboration feature in Markdown Viewer. It is separate from Share Snapshot. Share Snapshot creates a point-in-time link; Live Share creates a temporary WebSocket room.

## User Flow

1. The host clicks Live Share.
2. The host enters or accepts a display name.
3. The host chooses Can edit or View only.
4. The app creates a random room id and a random room secret.
5. The app creates separate Yjs documents for Markdown/session state and Review threads.
6. The host opens a WebSocket to `/live-room/<room-id>?secret=<secret>`.
7. The host connection establishes separate host, edit, and view capabilities before the invite link is shown.
8. The invite link includes the selected role and capability for the recipient. Participants open it, join a temporary live tab, request the current Yjs state, and render participant avatars/cursors.
9. The host can end the room for everyone.

The invite URL contains the room id, secret, and title. It does not embed the full Markdown document body.

## Cloudflare Runtime

There are two checked-in Cloudflare entry points:

- `functions/live-room/[[room]].js` is the Pages Function endpoint for `/live-room/<room>`.
- `workers/live-room-worker.js` contains the `LiveRoom` Durable Object class and a Worker export.

The Pages Function:

- Requires a WebSocket upgrade request.
- Allows the production app, HTTPS `*.markdownviewer.pages.dev` preview deployments, `null`, and localhost/127.0.0.1 development `Origin` values.
- Requires a `LIVE_ROOMS` Durable Object binding.
- Rejects room names over 160 characters.
- Rejects secrets over 256 characters.
- Uses `roomName + ":" + secret` to select the Durable Object id.
- Returns `Cache-Control: no-store` for non-upgrade status responses.

The Durable Object:

- Accepts the WebSocket pair.
- Authenticates the host capability when the room is first created and checks edit/view capabilities against the stored room credentials for later connections.
- Assigns a temporary socket participant id.
- Relays only known message types: `hello`, `presence`, `sync-request`, `sync-state`, `y-update`, `review-sync-request`, `review-sync-state`, `review-update`, `leave`, and `session-end`.
- Filters messages by role: viewers can send presence, sync requests, and Review updates but not Markdown updates or session-end; editors can send Markdown and Review updates; only the host can publish full Review state and every supported message type.
- Adds `roomId` and `sentAt` to normalized messages.
- Broadcasts messages to other sockets in the same room.
- Broadcasts `leave` when a socket closes or errors.

## Limits

| Limit | Value |
| :--- | :--- |
| Max live message size | 8 MB |
| Max WebSocket participants per room | 64 |
| Participant stale timeout in client UI | 45 seconds |
| Client join timeout | 8 seconds |
| Room name length at Pages Function | 160 characters |
| Secret length at Pages Function | 256 characters |

If the room is full, the Durable Object returns HTTP 429. If credentials or bindings are missing, the endpoints return a plain error response.

## Data Handling

Live Share relays:

- Yjs document updates.
- Review comments, suggestions, and thread status updates through a separate Yjs document.
- Initial sync state.
- Display names.
- Participant presence.
- Cursor positions.
- Leave events.
- Host session-end events.

Live Share does not write document content to Cloudflare KV or a database. State is temporary room/connection state in the Durable Object and clients. The normal local workspace remains local, and joined live tabs are temporary so they are not saved into the participant's tab storage.

## Privacy and Security Notes

- The room secret is part of the invite URL. Anyone with the link can try to join while the room is active.
- No end-to-end encryption is implemented in the app.
- View-only and editable roles are checked by the Durable Object, which filters message types by capability. Each capability is still a bearer credential, so treat role-specific invite links as sensitive and do not paste them into public channels.
- The server rejects unsupported WebSocket origins, but origin checks do not replace authentication or end-to-end encryption.
- The host should end the room when collaboration is finished.
- Cloudflare deployment logs and platform behavior are controlled by the deployer's Cloudflare account configuration.

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
