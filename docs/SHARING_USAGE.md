# Sharing usage and free-plan limits

Encryption runs on the device and needs no paid cryptography or key-management service. Usage still consumes Cloudflare allowances. This implementation adds no Workers KV counter, polling, recovery, or live-message writes.

## Workers KV operations

| Action | Previous encrypted implementation (5141100) | Hardened implementation |
| --- | --- | --- |
| Create inline snapshot | 0 reads, 0 writes | Same |
| Create stored snapshot | 1 read, 1 write | 0 reads, 1 write |
| Open stored snapshot | 1 read | Same |
| Upload one managed attachment | 0 reads, 1 write | Same |
| Download one attachment | 1 read per resolution | 1 cold read; no read for an eligible memory-cache hit |
| Delete stored snapshot | 1 read, 1 delete | Same |
| Live text/comments/presence | 0 Workers KV operations | Same; uses separate Durable Object service |
| Recovery export | No recovery feature | 0 writes; up to 1 cold read per managed attachment |
| Recovery restore | No recovery feature | 0 reads, writes, deletes or lists |

The cache lasts at most 60 seconds, never beyond attachment expiry, and is bounded to 24 MiB/32 entries. Reopening the app, expiry and eviction can cause another read. Failed/missing-key KV lookups also count. API abuse, retries, other applications, dashboard and CLI activity can consume allowances. These are per-action counts, not a guarantee about total daily use.

Cloudflare's published Workers KV Free allowances, checked November 20, 2026, are **100,000 reads/day, 1,000 writes/day, 1,000 deletes/day, 1,000 list requests/day and 1 GB stored data**. Daily counters reset at 00:00 UTC (05:30 India time). Exceeding a Free allowance makes further operations of that type fail. Allowances are shared at the account level. [Official KV pricing](https://developers.cloudflare.com/kv/platform/pricing/).

For example, 200 stored snapshots plus 300 separately uploaded attachments consume 500 writes. With no other writes, 500 remain that day. Reading 200 snapshots once and all 300 attachments once consumes 500 reads. Encryption does not multiply these operation counts. Ciphertext/base64 and metadata occupy storage, however; existing records also continue occupying storage until their original expiry. The follow-up hardening does not re-encrypt, duplicate, or extend those records. At 90-day retention, the 1 GB storage allowance can become the limiting factor before daily operations do.

## Live rooms use separate allowances

Durable Object storage is distinct from Workers KV. The room stores public configuration, capability hashes, expiry/ended status and at most 1,024 used-session hashes. One admission transaction reads and writes that record; the expiry alarm is set on first creation. No document body is persisted by the relay and no per-frame storage write is added. Ending and expiring rooms perform lifecycle operations.

Freshness proofs add signed handshake messages and post-proof synchronization traffic. These consume the separate Durable Object request allowance, so the change is not neutral for every Cloudflare meter even though it adds no Workers KV live-message operations.

SQLite Durable Objects on Workers Free currently include 100,000 requests/day, 13,000 GB-s/day, 5 million rows read/day, 100,000 rows written/day and 5 GB storage. WebSocket upgrades and inbound traffic use that service's request accounting. [Official Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

The current relay uses standard accepted WebSockets, so idle connected rooms can consume duration. Using Cloudflare's published billing examples (128 MB / 1 GB = 0.128), a continuously active room for 24 hours is approximately 11,059 GB-s, before other rooms or usage. This is material to Free-plan capacity even though it consumes zero Workers KV operations. This change does not migrate the relay to WebSocket hibernation. That is a separate performance change requiring wake/reconnect/state verification. [Cloudflare WebSocket lifecycle guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

**Zero additional service cost is possible within all existing Free allowances; unlimited zero-cost use is not promised.** Check account usage before rollout, use the creation-pause controls if necessary, and do not enable a Paid plan automatically. Local tests use synthetic services and do not consume production KV allowances.

## Local rendering follow-up

Rendering diagrams, charts, vector maps, inline STL, notation and LaTeX uses browser CPU and static assets. It adds **zero Workers KV reads, writes, deletes or lists**. The assets are loaded when needed and cached by the browser. Rendered SVGs are held only in bounded device memory (at most 32 entries / 24 MiB / 60 seconds); they are never uploaded.

The relay compatibility endpoint reads no room storage. It adds one Pages/Worker/DO request when run as an operational check, or when diagnosing a failed connection. Successful live connections do not make this extra request. Existing snapshot/media expiry and KV operation counts are unchanged.

Compact live invitations store two encrypted envelopes in the existing admission record without another creation write. Resolving a short invite adds one Durable Object request/read per join, not a Workers KV operation. Compact snapshot encoding preserves the existing inline/storage thresholds and never increases the per-share KV operation count. A consistently short URL for every snapshot would require storing formerly inline snapshots and therefore additional KV writes; that tradeoff is not enabled by default.
