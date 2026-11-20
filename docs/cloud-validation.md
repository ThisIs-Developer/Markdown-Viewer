# Cloud validation

Cloud-only branch based on upstream v3.10.6. Personal runtime patches and personal release/deployment metadata are excluded.

Review fixes preserve locked/expired web-session cleanup, explicit remembered-account unlock, portable copy-name suggestions, visible Unicode text and the minimum official runtime needed for command restrictions. Existing cloud identities, draft metadata and per-account preferences retain their formats.

Validation on the clean branch:

- 344 unit tests passed, one skipped, and 38 connector/API/browser/template cases passed (including nine self-hosted browser scenarios).
- 97 Chromium cases passed across Nextcloud, WebDAV, copy and existing Linked Workspace/Explorer workflows.
- Official Neutralino 6.10.0 with the actual SDK/helper passed zero automatic startup, concurrent launch, stdin bootstrap, stop/crash recovery and command restriction checks in a disposable headless profile.
- Real helper tests passed bounded DAV, conditional mutations, TLS/redirect restrictions, Unicode, credential scoping/restart/removal and exit-with-live-socket regressions.
- `npm run build:cloud` produced the Windows executable and helper from the official runtime. Static mirror checks passed.
- The locally built all-in-one image passed non-root/read-only operation, Secure/HttpOnly/SameSite sessions, Host/Origin guards, static-source restrictions, encrypted remembered credentials and restart revocation. Cloud-disabled image required neither password nor credential volume.

Personal/multi-user checks cover cross-owner access/deletion, identical cloud IDs, guest flows, remembered-browser restart/revocation, stale-tab recovery, blocked HTTP credentials and fail-closed bootstrap. Both complete Compose templates are parsed and validated against the real settings model; optional settings stay commented and no private registry is required.

These checks use synthetic servers and disposable credentials/profiles. They do not replace real-server acceptance or prove safety for public multi-user hosting, every DAV implementation or abrupt power loss. No real cloud account was used and no production deployment was changed.
