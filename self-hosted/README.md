# Self hosted cloud connections

The optional all-in-one image serves Markdown Viewer and its cloud connector on container port **80**. Nextcloud and generic WebDAV use the existing Cloud Workspace. No separate connector/database container, initialization script or mandatory hostname configuration is required. Cloud defaults off.

This branch provides personal and multi-user modes. The cloud-enabled image is built locally as `markdown-viewer-cloud:local`; no official upstream cloud image is assumed or published by these templates.

## Compose

Keep the existing URL, reverse proxy and host-port mapping. HTTPS is required for cloud access. A named `/data` volume persists cloud state; host bind mounts must be writable by UID/GID 1000.

Personal installation: [compose.yml](compose.yml). Put a private random password of at least 12 characters in `self-hosted/.env`, then run from the repository root:

```sh
docker compose -f self-hosted/compose.yml up -d --build
```

Its cloud environment is:

```yaml
CLOUD_ENABLED: "true"
CLOUD_MODE: "personal"
CLOUD_ACCESS_PASSWORD: "${CLOUD_ACCESS_PASSWORD:?Set a private cloud access password}"
CLOUD_REMEMBER_CONNECTIONS: "true"
CLOUD_REMEMBER_DEVICE: "true"
```

Multi-user installation: [compose.multi-user.yml](compose.multi-user.yml):

```sh
docker compose -f self-hosted/compose.multi-user.yml up -d --build
```

```yaml
CLOUD_ENABLED: "true"
CLOUD_MODE: "multi-user"
CLOUD_REMEMBER_CONNECTIONS: "true"
CLOUD_REMEMBER_DEVICE: "true"
CLOUD_MAX_PROFILES: "100"
```

Multi-user mode needs **no shared password in Compose**. Each user may connect temporarily, or create a personal profile from Cloud connections with a profile name and password. Names are case-insensitive, 3–64 ASCII letters/digits/dots/underscores/hyphens, starting with a letter/digit; profile passwords require at least 12 characters. Profile credentials are separate from Nextcloud/WebDAV sign-in. No email/SMTP service is required. Automatic profile-password recovery is not implemented; keep the password safe and export local drafts before abandoning a profile.

Both templates build the same all-in-one image from this branch and use one `cloud-state:/data` volume. They include every supported environment option, with optional/unused settings commented out. For an existing Compose, use the locally built image and the corresponding environment block, add the volume, and declare `cloud-state:` under top-level `volumes`. The example hardening uses non-root UID 1000, read-only root filesystem, no extra capabilities and a small writable `/tmp`. To build without Compose, run `docker build -f self-hosted/Dockerfile -t markdown-viewer-cloud:local .` from the repository root and use that local tag in the Compose image field.

## Environment reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLOUD_ENABLED` | `false` | Enable connector/bootstrap endpoints. Disabled mode serves the ordinary editor without cloud credentials/state. |
| `CLOUD_MODE` | `personal` | `personal`: shared installation owner. `multi-user`: isolated guests and optional personal profiles. |
| `CLOUD_ACCESS_PASSWORD` | unset | Personal-mode installation password, at least 12 characters. Unused in multi-user mode. |
| `CLOUD_ACCESS_PASSWORD_FILE` | unset | Personal-mode Docker-secret/file alternative; cannot be combined with the env password. |
| `CLOUD_REMEMBER_CONNECTIONS` | `false` | Permit explicitly remembered provider credentials. Guests cannot persist credentials; profiles may remember their own. |
| `CLOUD_REMEMBER_DEVICE` | `false` | Offer remember-browser after personal unlock or profile sign-in. Does not enable it automatically. |
| `CLOUD_MAX_PROFILES` | `100` | Multi-user registration cap, integer 1–10000. Applies to profiles, not individual cloud accounts. |
| `CLOUD_DATA_DIR` | `/data` | Persistent connector state. Required for multi-user mode, remembering connections or remembering browsers. |
| `CLOUD_CREDENTIAL_KEY_FILE` | unset | Optional external 32-byte key; otherwise `credential.key` is generated automatically in `/data`. Keep it with backups. |
| `CLOUD_ALLOWED_SERVERS` | unset | Optional comma-separated HTTPS origins limiting cloud destinations. Without it, public HTTPS origins are allowed subject to network restrictions. |
| `CLOUD_PRIVATE_SERVERS` | unset | Specific HTTPS origins allowed to resolve to private addresses. Does not open all internal hosts/ports. An allowed-server policy still applies if set. |
| `CLOUD_PUBLIC_URL` | unset | Optional exact HTTPS origin when the proxy requires one. Normally Host/Origin are checked dynamically. |
| `CLOUD_DEVELOPMENT` | `false` | Test-only allowance for HTTP literal localhost/127.0.0.1 origins. Keep false for normal deployment. |
| `PORT` | `80` | Connector container listening port. Keep 80 with the existing Compose mapping. |
| `HOST` | `0.0.0.0` | Container listening interface. Normally leave unchanged. |

Boolean policies accept only `true` or `false`. Do not publish `.env`, credential volumes or Docker secrets. Env passwords can be read by the host operator/container inspection. The Docker image supplies a compatible Node runtime; direct Node execution needs Node 22.13+ or Node 24 because profiles use built-in SQLite.

## Sessions and browser behavior

- Guests have isolated server-side sessions and in-memory provider credentials. Reloading the same valid session can restore these connections. Expiry, connector restart or ending the session removes temporary access; local drafts remain on that browser.
- Creating a profile adopts only the current guest's connections (persisted only when permitted) and its current local workspace. Signing into an existing profile opens that profile's separate local workspace. Drafts are **not synchronized between browsers**.
- Remember-browser uses an opaque HttpOnly/Secure/SameSite cookie; only its hash is stored on the server. It survives container restart with the same `/data` and key. It expires after 30 days without renewal and has an absolute 180-day maximum. Restoring a session renews the inactivity window. Each owner may remember up to 20 browsers.
- Enabling remember-browser later from settings requires re-entering the owner/profile password. Personal Lock / profile Sign out revokes the current remembered browser. Sign out all browsers revokes all grants and active sessions for that owner. Already-started bounded requests may finish; no new requests are authorized. Changing the personal installation password invalidates its remembered grants on restart.
- Without remember-browser, sessions are kept in memory: 30-minute sliding inactivity timeout and 24-hour maximum. Restart requires another unlock/profile sign-in. Saved provider credentials remain available after sign-in when remembering was enabled.
- Other tabs pause when the active profile changes. Drafts are flushed, with a recovery-journal fallback for local storage conflicts, before reload is offered. Failed recovery keeps the tab open. Private mode must be off before profile transitions that persist drafts.

## Isolation and trust

Every profile has an immutable server-generated ID. Credential lookups, deletion, login flows and device revocation are owner scoped, including when two profiles connect to the same remote account. Per-tab workspace headers reject stale requests after a cookie/profile change. Guests cannot list another guest's credentials or use a guessed account/login-flow ID. Same-origin, CSRF, bounded authentication/registration/session limits and the existing TLS/DNS/redirect/mutation safeguards remain in force.

The server stores profiles/password hashes, encrypted provider credentials and hashed remembered-browser tokens in `profiles.sqlite` (including SQLite WAL files), not Markdown bodies. Personal-mode credentials keep the existing `credentials.enc` format and namespace. The key is separate from the DB but defaults to the same `/data` volume for simple deployment. Backups of the whole volume contain both and must be treated as secrets.

Multi-user browser workspaces use separate IndexedDB/local/session storage namespaces. This prevents accidental cross-profile UI/recovery/backup exposure; it is **not encryption against someone controlling the same browser/OS account, same-origin script or developer tools**. Guests share their local anonymous workspace within a browser profile. Use separate browser/OS profiles on shared computers. The served frontend and host administrator remain trusted: the connector handles readable cloud content/credentials, and no operator-blind or E2EE guarantee is made.

The current implementation provides local profile auth and basic bounded abuse controls. Internet-facing operators still need HTTPS, capacity/traffic monitoring, appropriate proxy rate limits and a deliberate registration policy/profile cap. Private-server exceptions apply to every visitor allowed to use this connector, including guests; keep them narrow and do not expose internal origins to untrusted public visitors. This is not a claim of independent public-service security certification.

## Mode changes, backups and upgrades

Default mode is personal, so old Compose files retain their behavior. Switching to multi-user does not assign old personal credentials/drafts to a newly registered person. The existing unscoped browser workspace and personal credential file remain separate; multi-user starts in its own browser spaces. Returning to personal mode restores the original namespace. New temporary drafts are carried into a newly created profile on the same browser. No automatic account takeover, old-store deletion or replay of uncertain uploads occurs.

Keep the same application URL to retain browser storage. A different hostname has its own browser workspaces. Back up the full `/data` while the container is stopped, or use SQLite-aware backups including WAL state; export browser workspaces separately. Losing `/data`, its key or browser cookies invalidates remembered access. Losing the key prevents decryption and startup refuses to overwrite the old store. Do not clear browser site data to fix caching.

The all-in-one server content-versions local JS/CSS and release-note requests. API/bootstrap/session responses are no-store and must never be cached by a proxy. Cloudflare/proxy rules must respect query strings and no-store; rules overriding those require correction or a cache purge.
