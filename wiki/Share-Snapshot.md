# Share Snapshot

Share Snapshot creates an encrypted, point-in-time copy of the active Document. Choose **View only** or **Can edit**, select **Share**, and send the complete link through a trusted channel. Changes to a snapshot do not synchronize with the sender.

## Encryption and Access

New snapshots encrypt the Markdown, title, and access mode on the device with AES-256-GCM. Each snapshot has an independent random key carried in the URL fragment. The application never sends that key to the share API. Recipients decrypt locally.

Anyone with the complete link can decrypt its content; keep it private. View only restricts the application interface, while Can edit permits changes to a temporary local copy. Neither prevents a recipient from copying content or forwarding the link. Temporary snapshot tabs are excluded from normal Workspace persistence. Export edits before leaving.

## Storage and Retention

| Property | Inline snapshot | Stored snapshot |
| :--- | :--- | :--- |
| URL | `#share=v2.<encrypted-envelope>&key=<key>` | `#id=s2_<id>&key=<key>` |
| Selection | Below 3,000 UTF-8 content bytes and at most 4,096 URL characters | Larger content or URL |
| Stored data | Ciphertext in the link | Ciphertext, creation time, format version, and deletion-token hash in Cloudflare KV |
| Lifetime | The link itself remains usable | 90 days from creation |
| Payload limit | Constrained by URL size | 8 MiB of UTF-8 JSON, including title and mode |
| Early deletion | No server record to delete | **Delete snapshot** in the current generated-link modal |

Fragments are excluded from normal HTTP requests, but complete links can appear in browser history, clipboard managers, extensions, and messaging systems. Losing the key means the content cannot be recovered through the service.

Existing links keep their existing format and expiry. Reading them does not rewrite records or extend their lifetime. New creation requires the encrypted format; refresh an older client if creation requests an upgrade.

## Delete a Stored Snapshot

The creator can select **Delete snapshot** while the generated-link modal retains its deletion credential. Closing/resetting the modal or leaving the page loses that in-memory credential. The deletion token is independent of the decryption key and is never included in recipient links.

API clients can retain the creation response's `deleteToken` separately and submit `DELETE /api/share/<id>` with JSON `{"deleteToken":"..."}`. The service stores only its hash. Deletion removes the stored snapshot, not previously downloaded copies or separately stored media. Without the token, the original 90-day expiry applies.

## Media and Rendering

New managed images, GIFs, and videos are encrypted separately before upload. Their complete URLs, including media keys, are inside the encrypted Markdown. The browser retrieves ciphertext without the key and renders decrypted bytes locally. Media expires 90 days after its own upload.

Encrypted shared previews block automatic external media and remote diagram requests. Advanced diagrams/maps are shown as local source; explicit link navigation remains available. Upload required images through the encrypted media flow before sharing. Older managed URLs are preserved for existing documents but are not automatically loaded in encrypted shared previews. Review comments are not included in snapshots.

Web Markdown exports inline decrypted managed media. Encrypted-share HTML exports use local content, inline media, and a restrictive content security policy without scripts. Exported files contain readable content: protect them as documents.

## Failure and Recovery

| Symptom | Action |
| :--- | :--- |
| Incomplete link or decryption failure | Ask for the entire original link, including everything after `#`; there is no plaintext fallback |
| Stored snapshot missing | Check expiry or deletion; ask the sender for a new snapshot |
| Creation unavailable | Refresh the app and check connectivity, secure-context Web Crypto support, deployment bindings, and payload size |
| External image or diagram source shown | Expected private preview behavior; use encrypted managed attachments |
| Managed attachment missing | Check the complete media key, connection, and its separate expiry |

See [Privacy and Security](Privacy-and-Security.md), [Configuration](Configuration.md#share-api), and the [protocol and rollout notes](../docs/ENCRYPTED_SHARING.md).
