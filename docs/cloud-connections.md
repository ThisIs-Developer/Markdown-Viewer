# Cloud connections

Experimental remote folder access for Nextcloud and generic WebDAV, based on upstream 3.10.6. This is explicit remote access, not background synchronization. Provider identity/capabilities and shared recovery, copy and UI workflows are separated from platform transport and credential storage. Other providers are not implemented.

## Try the preview

Use a disposable Markdown folder on a Nextcloud or WebDAV server you control. Open **Workspace settings → Cloud connections**, add an account and choose a folder. Open a `.md`, edit it and confirm **Save to cloud**. Check the result in your provider. To try conflict recovery, edit a separate test file on the server after opening it, then try saving your local changes. The local draft stays available when the server refuses the conditional write.

| Platform | Cloud preview |
| --- | --- |
| Windows desktop | Nextcloud and WebDAV through the on-demand helper on official Neutralino 6.10.0. |
| macOS and Linux desktop | The editor remains available. Native cloud adapters are future work. |
| Self-hosted web and Docker | Browser access through the same-origin connector and locally built image. Cloud is opt-in. |
| Static web and offline PWA | Local editor and offline assets. Remote cloud access needs the online connector, and cloud PWA installation is outside this preview. |

### Windows

Extract the complete Windows test bundle, keep `extensions` beside `markdown-viewer-win_x64.exe` and launch it. To build from source, install Node 22–26 and the Visual Studio C++ tools, CMake and Ninja, then run `npm ci` and `npm run build:cloud` inside `desktop-app`. The output is `desktop-app/dist/markdown-viewer/`. Use a disposable Windows profile if you want a separate local workspace.

### Docker on this machine

Build from the repository root. Create `self-hosted/.env` locally with `CLOUD_ACCESS_PASSWORD` set to a private value of at least 12 characters. Use the loopback test mode for this short trial.

```sh
docker build -f self-hosted/Dockerfile -t markdown-viewer-cloud:local .
docker run --rm --name markdown-viewer-cloud-test -p 127.0.0.1:8080:80 --env-file self-hosted/.env -e CLOUD_ENABLED=true -e CLOUD_DEVELOPMENT=true markdown-viewer-cloud:local
```

Open `http://127.0.0.1:8080`, unlock cloud access with the test password and connect to an HTTPS provider. This example keeps credentials in the running session. For a persistent HTTPS deployment or isolated multi-user profiles, follow the [Compose guide](../self-hosted/README.md).

## Files and recovery

Browse folders, open Markdown, explicitly save, create `.md`, and delete individual `.md` files. Creation/deletion are context-menu actions; deletion always confirms. Save confirmation can be suppressed per account. Cloud documents have their own sidebar and recovery storage rather than becoming Vault copies. Connections can be hidden or disabled, and remembered accounts are optional.

Existing-file writes/deletes require a strong server ETag and matching precondition. New files are create-only. Local recovery is committed before mutation. Conflicts, missing validators, unknown write outcomes and changed editor content preserve the draft; no silent overwrite or automatic retry is allowed. A server must correctly enforce its preconditions. Batch copying cannot be atomic across HTTP operations.

Vault and Linked file/folder context menus offer Copy to cloud. A destination picker selects account, folder and a portable new name. Linked folders use currently indexed files in the selected subtree, not an unrequested disk scan. Copies snapshot current primary/split-editor drafts and commit all source/destination recovery before uploading. Existing targets are never overwritten or merged. Cancellation stops future operations after the current request settles; completed remote objects remain. Secret Workspace and Private mode are excluded. Limits: 500 files, 200 descendant folders, 20 path segments, 20 MiB/file and 50 MiB total.

## Windows desktop

Cloud uses a separate application-owned helper through official Neutralino extension APIs. The runtime is pinned to official 6.10.0 for command allowlist enforcement. The helper starts only on demand, uses authenticated IPC with bootstrap over stdin, and exits on shutdown/disable/idle. Credentials can be stored in Windows Credential Manager; stored passwords do not return to UI JavaScript. No custom runtime patch is required. See [build instructions](../desktop-app/cloud-extension/README.md).

The cloud implementation requires no runtime patch. macOS/Linux native cloud adapters remain future work.

## Self hosted web

The optional [all-in-one image](../self-hosted/README.md) serves the editor and same-origin connector on container port 80. The original static Dockerfile remains available. Cloud defaults off. The complete [personal](../self-hosted/compose.yml) and [multi-user](../self-hosted/compose.multi-user.yml) templates build a neutral local image from this branch, with optional environments commented out. They do not refer to a private/custom registry or assume the official upstream image includes cloud support.

- **Personal** is the default and uses an installation cloud access password of at least 12 characters. Sessions share that owner's cloud accounts. The existing credential format remains supported.
- **Multi-user** requires no shared installation password. Each guest has an isolated temporary session; an optional personal profile owns its remembered cloud connections. Registering a profile adopts only the current guest's workspace/connections. Signing into an existing profile opens its separate local workspace.
- `CLOUD_REMEMBER_CONNECTIONS` permits explicit credential storage. `CLOUD_REMEMBER_DEVICE` offers remember-browser, surviving container restart with the same volume/key/cookies. Remembering is optional; grants expire and can be revoked. Profiles currently have no automatic forgotten-password recovery.

One `/data` volume stores the automatically initialized key and embedded SQLite profile/device state. No database service, init script or mandatory hostname configuration is needed. Browser drafts stay local and are not synchronized between devices. Browser namespaces separate profile data and recovery; an identity bootstrap failure stops startup rather than opening shared legacy data. Stale tabs pause and preserve drafts before reload. See [profile behavior](cloud-web-profiles.md).

HTTPS, Host/Origin/CSRF checks, bounded authentication and requests, DNS/IP filtering, destination-scoped credentials and encrypted remembered credentials remain required. Private-server exceptions grant reachability to every permitted visitor, including guests. Existing-file mutation safeguards are shared with desktop. Local assets and release-note requests are versioned; API/bootstrap/session responses must respect no-store.

Profile isolation protects normal UI/API flows. It does not encrypt against someone controlling the same browser/OS account or same-origin JavaScript. The connector operator can access active cloud content and credentials; this is not E2EE/operator-blind hosting. Internet-facing deployments still need traffic/capacity controls and a considered registration policy, not just an enabled environment flag. No independent public-service security audit is claimed.

## Deferred providers

Google Drive folder browsing with save/create/delete was explored but deferred. An integration needs an application Google Cloud project with Drive API enabled, OAuth consent/client configuration and an owner responsible for credentials, policies and any verification. Each user would authorize their own account; requiring every user to create a developer project would be poor onboarding. A narrow `drive.file` scope does not automatically grant recursive access to arbitrary pre-existing folder contents; full folder browsing may require broader permissions, subject to [Google's scope and verification policy](https://developers.google.com/workspace/drive/api/guides/api-specific-auth). Safe mutation, token refresh/revocation and recovery need provider-specific design. No Google project, credentials or provider was created. The maintainer should decide ownership and scope before development.

OneDrive, Dropbox, GitHub, GitLab, Bitbucket and iCloud are future capability discussions only; sharing a provider interface does not make their protocols or authentication equivalent.

## Validation boundaries

Automated checks cover synthetic protocol/connector servers, isolated browser profiles, recovery migrations and the real official Windows runtime/helper lifecycle. They do not establish real-account compatibility with every DAV server, power-loss durability, macOS/Linux cloud support or public multi-user safety. Back up browser drafts and server state before upgrades; never clear site data to fix cache problems.
