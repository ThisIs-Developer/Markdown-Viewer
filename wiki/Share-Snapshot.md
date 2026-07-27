# Share Snapshot

Share Snapshot creates a point-in-time copy of the active Document. Use it when a recipient needs to read or edit a copy without joining a Live Share room.

Share Snapshot is not real-time collaboration. Changes made by the sender or recipient after link creation do not synchronize.

## Create a Snapshot

1. Open the Document you want to share.
2. Select **Share Snapshot**.
3. Choose **View only** or **Can edit**.
4. Select **Share**.
5. Copy the generated URL and send it through a channel you trust.

The application selects URL-hash or Cloudflare KV storage automatically according to content size and encoded URL length.

> **Privacy:** A Share Snapshot is a bearer link. Anyone who obtains the complete URL can open the capability it contains. There is no account check or recipient allowlist.

## Access Modes

| Mode | Recipient experience | What it does not provide |
| :--- | :--- | :--- |
| **View only** | Opens a temporary tab in Preview with editing actions blocked | Authentication, access revocation, or protection against link forwarding |
| **Can edit** | Opens a temporary tab in Split view and lets the recipient edit that local copy | Real-time synchronization or write access to the sender's original Document |

The recipient's temporary snapshot tab is not written into normal Workspace tab storage. Closing or reloading can discard edits unless the recipient exports the Markdown.

The application blocks creating another Share Snapshot from a temporary snapshot. Only the host can create a snapshot from a Live Share Document.

## Storage Modes

| Property | URL-hash snapshot | Stored snapshot |
| :--- | :--- | :--- |
| URL form | `#share=<compressed-content>` | `#id=<snapshot-id>` |
| Selection rule | Used when Markdown is below 3,000 UTF-8 bytes and the encoded URL is no longer than 4,096 characters | Used at 3,000 bytes or more, or when the encoded URL exceeds 4,096 characters |
| Content location | Compressed and base64url-encoded inside the link | Cloudflare KV through `/api/share` |
| Retention | No server-side record created by Markdown Viewer; the copied URL itself remains usable | 90 days |
| Maximum content | Constrained by practical browser, clipboard, and URL handling | 8,000,000 characters |
| Early deletion | Delete every copy of the link that you control | Available through the API only when the caller retained the creation deletion token |
| Server request when opening | The URL hash is not part of the normal HTTP request; the page processes it locally | The application requests `/api/share/<id>` |

The URL-hash title and access flag are also stored in the fragment. Hash fragments can still be exposed through copied messages, browser synchronization/history, extensions, screenshots, logs from surrounding tools, or a person who forwards the URL.

## Stored Snapshot Record

The Share API stores:

- Markdown content;
- access mode;
- sanitized title;
- creation time;
- character count; and
- a hash of the deletion token.

The record is written to `SHARE_KV` with a 90-day time to live. The API response uses `Cache-Control: no-store`.

Creating a stored snapshot returns:

- a random snapshot id;
- a deletion token; and
- the expiry duration.

The deletion token is returned only at creation. The stored record contains its SHA-256 hash, not the original token.

## Delete a Stored Snapshot

The API supports:

```http
DELETE /api/share/<id>
Content-Type: application/json

{"deleteToken":"<token returned at creation>"}
```

> **Important:** The current Markdown Viewer UI does not display or export the deletion token and does not provide a Delete snapshot action. It keeps the token only in page memory while the generated link state exists. Closing/resetting the modal or leaving the session loses normal UI access to it.

An API client that needs early deletion must call `POST /api/share`, securely capture the `deleteToken` from the response, keep it separate from the shared URL, and later submit it to the `DELETE` route. Without the token, wait for the 90-day expiry.

Deleting a snapshot does not delete managed images, GIFs, or videos referenced by the Markdown. Managed media has separate content-addressed records and its own 90-day expiry.

## Images and Other External Content

Share Snapshot copies Markdown, not every referenced resource.

- Managed media remains available through its public-by-link URL until that media record expires.
- External images, media, fonts, and links are requested from their original hosts.
- Legacy inline data images increase the snapshot size and can force stored-snapshot mode.
- Review comments and suggestions are not included.
- A remote diagram fence is re-rendered by the recipient's browser and can send its source to a renderer.

## Security Boundaries

- Snapshot ids and encoded content are difficult to guess but are not authentication.
- View only is enforced by the client interface; it does not encrypt or hide the Markdown from someone who controls their browser.
- Origin checks restrict supported browser origins for API creation and access, but requests without an `Origin` header are accepted and bearer-link secrecy remains essential.
- Allowed application origins include the production site, HTTPS `*.markdownviewer.pages.dev` previews, `null`, and local `localhost`/`127.0.0.1` development origins.
- Stored snapshots are not end-to-end encrypted by the application.
- Cloudflare and the deployer can process normal platform and request logs.

Do not use Share Snapshot as a confidential-document access-control system.

## Failure and Recovery

| Symptom | Likely cause | Action |
| :--- | :--- | :--- |
| “Failed to create share link” | Pako or `/api/share` unavailable, missing `SHARE_KV`, disallowed origin, network error, or oversized content | Check the console/network request, configuration, origin, and 8,000,000-character limit |
| Stored link returns not found | Invalid id, early deletion, or 90-day expiry | Ask the sender for a new snapshot |
| Can edit copy disappeared | Snapshot tabs are temporary | Export Markdown before closing or reloading |
| Image is missing | Managed-media expiry, unavailable external host, or blocked request | Replace the resource and create a new snapshot |
| Remote diagram is missing | Renderer unavailable, CSP restriction, or invalid source | Check the renderer network request and fence syntax |

See [Troubleshooting](Troubleshooting.md) for broader diagnostics.

## API Summary

| Method and route | Purpose |
| :--- | :--- |
| `POST /api/share` | Create a stored snapshot |
| `GET /api/share/<id>` | Load a stored snapshot |
| `DELETE /api/share/<id>` | Delete a stored snapshot with its deletion token |
| `OPTIONS /api/share[/<id>]` | CORS preflight |

Deployment details are in [Configuration](Configuration.md#share-api). For the product-wide data boundary, see [Privacy and Security](Privacy-and-Security.md).
