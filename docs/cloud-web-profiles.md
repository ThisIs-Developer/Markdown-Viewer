# Cloud web profiles

Personal mode remains compatible with existing installation-password deployments. Multi-user mode offers temporary guest sessions plus optional local profiles, without a shared password. This affects the optional self-hosted web connector; Windows desktop keeps its normal local credential adapter.

## Ownership and storage

Server-generated profile IDs scope every credential lookup, mutation, removal and remembered-browser grant. The same cloud account ID in two profiles does not confer access across profiles. Guests hold credentials only in their own session and cannot persist them. Creating a profile adopts only the current guest's connections; persistence still follows the installation policy.

Profiles/salted scrypt password hashes, encrypted credentials and hashed opaque device grants live in embedded SQLite under `/data`. Metadata/auth payloads, concurrent operations, enrollment and profile/device counts are bounded. No extra database container or initialization script is required. The original personal credential file is not assigned to new profiles.

Browser IndexedDB, local/session preferences and recovery journals are namespaced. Registration retains that guest's local workspace; existing-profile sign-in opens a separate workspace. Drafts do not synchronize between devices. Other tabs pause when the cookie/profile changes; owner headers reject stale cloud operations. Drafts flush before deliberate switches, with recovery journals for stale-tab conflicts. Failed scope bootstrap cannot fall back to the old shared storage.

## Remembered browsers

`CLOUD_REMEMBER_DEVICE` permits an explicit UI choice. Tokens persist across restart with the same `/data` and key, renew a 30-day inactivity window and have a 180-day absolute maximum. Granting access later requires password re-entry. Logout revokes the current device; Sign out all browsers revokes the owner's devices/sessions. Personal password changes invalidate its remembered grants. Profile-password recovery is not implemented.

## Deployment limits

The [deployment guide](../self-hosted/README.md) documents all environments and complete generic templates. Both templates build from source and use a Docker named volume. Keep HTTPS and the existing public origin. A backup must include the key and SQLite WAL state; browser drafts need separate exports.

Namespace separation does not protect against someone controlling the same browser/OS account, developer tools or same-origin scripts. The host operator can access active cloud data. No E2EE, operator-blind privacy, scale-out sessions or independent public-service security audit is claimed. Public operators need traffic/capacity controls and a registration policy; private-server allowances apply to guests too.
