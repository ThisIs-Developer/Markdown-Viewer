# Cloud extension (Windows)

This application-owned helper uses official Neutralino extension APIs. The cloud branch requires no modified Neutralino source or binary. The runtime is pinned to 6.10.0 because its command allowlist enforcement is required for on-demand launch.

Run `npm run build:cloud` from `desktop-app` on Windows with Node 22–26, Visual Studio C++ tools, CMake and Ninja installed. Visual Studio is discovered with vswhere, or an existing developer shell is used. The build downloads the official pinned runtime, prepares offline resources, compiles the helper and packages the Windows app. Distribute the complete `desktop-app/dist/markdown-viewer` directory: the helper must remain at `extensions/cloud/markdown-cloud.exe` beside the main executable. The end user needs no Node or C++ installation. Standalone helper build: `node desktop-app/build-cloud-extension.js`.

The extension ID has no startup command. The app launches the fixed helper path only when cloud is used, passes authenticated IPC bootstrap over stdin, and stops the helper on shutdown, disable or idle. The helper monitors IPC and the real parent process handle. It exposes bounded cloud operations, never a shell or listening proxy. TLS verification remains enabled; redirects, implicit Windows auth and automatic cookies are disabled.

Nextcloud and generic WebDAV have separate validated credential namespaces in Windows Credential Manager. Remembering is optional; stored passwords never return to browser JavaScript. Conditional existing-file writes/deletes require a strong ETag; creation is create-only. The helper also validates mutation headers and destinations. Timeouts cannot silently retry an uncertain write. Local recovery remains separate from Vault.

Trusted application JavaScript and the operating-system account remain security boundaries. An extension is not a sandbox against compromised application code. macOS/Linux cloud credential adapters are not implemented; their ordinary editor builds remain available. See [cloud connections](../../docs/cloud-connections.md) and the [self-hosted guide](../../self-hosted/README.md).
