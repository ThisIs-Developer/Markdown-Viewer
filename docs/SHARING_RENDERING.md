# Local rendering and Live Share rollout

Encrypted snapshots, live rooms and recovery documents use the same private preview path. Rich blocks remain renderer shells after the initial URL sanitization. Local rendering produces passive SVG images that work in the preview, split pane, print, PDF/image capture and standalone HTML export.

Supported engines: Mermaid, PlantUML, Graphviz/DOT, D2, Markmap, Vega-Lite, WaveDrom, inline STL, GeoJSON, TopoJSON, ABC notation and MathJax LaTeX. Diagram previews are static. Vector maps preserve geometry without requesting external basemap tiles. Remote includes, external chart datasets, linked STL and other network resources remain blocked; use self-contained input. Optional PlantUML libraries not present in the bundled engine report an explicit error.

## Isolation

SVG engines run in an iframe with only the sandbox allow-scripts permission. It cannot access the app origin, storage or parent DOM. Its document CSP authenticates the generated bootstrap by hash, then a second policy restricts scripts to the local renderer asset directory. Embedded images are allowed and outbound connections are denied. This handles WebKit's interpretation of an opaque frame's self origin without sharing the application's origin. Classic script bundles keep the opaque frame compatible with native and plain static servers without requiring CORS headers. D2 needs nested workers, which browsers reject in an opaque iframe, so it runs in a dedicated worker. Network APIs are disabled in both D2 worker layers before rendering starts; response CSP adds a second restriction on supported hosts. No encryption key or application state is passed to a renderer. SVG output is embedded as a passive image, rather than inserted as active document markup.

Private engines are pinned in package-lock.json. The build wraps PlantUML's original compiled module, changing only its export statement, because re-minification changes its labeled control flow. A checked transform of the pinned D2 browser bundle installs the network restriction inside its nested worker. Both transforms fail the build if the upstream structure changes, and generated assets retain upstream licenses. Vega uses its CSP-compatible expression interpreter. Markmap's optional asset loader is not called. Render results are cached only in bounded local memory to avoid recomputing unchanged diagrams on every live edit. No result is uploaded or stored in KV.

## Build and test

1. Run npm ci, npm run build:sharing and npm run build:private-renderers.
2. Run node desktop-app/prepare.js, then npm run build.
3. Run the unit suite and private-renderers, encrypted-sharing, sharing-hardening and share-live browser tests. The renderer tests use real engines and the real local relay, including prohibited outbound resources, standalone export, and a host with no renderer CORS/CSP response headers.

The generated assets directory is rebuilt from locked packages (116 files, approximately 35.8 MiB). Unused alternative MathJax startup bundles are excluded; TeX extensions and SVG font chunks remain available. Every static file is checked against Cloudflare Pages' 25 MiB per-file limit. Full renderer assets are lazy-loaded; normal app startup does not download all engines.

## Relay deployment

Pages and the live relay are separate deployments. A Pages deployment does not update the Worker named markdown-viewer-live-room. Deploy in this order:

1. Authenticate with npx wrangler@4.165.0 login if needed.
2. Run npm run deploy:live. Preserve wrangler.live-room.toml's existing binding and migration.
3. Deploy the matching Pages build and functions.
4. Run npm run check:live-relay. This checks the bound Worker protocol, rather than merely checking that the Pages URL responds. It performs no room-storage reads or writes.
5. With synthetic content, verify host start, guest join, updates in both directions and authenticated termination. Do not log complete invite URLs or credentials.

The production relay was updated and its encrypted host/guest/edit/end flow verified during this fix. This does not publish the new rendering assets; those ship with the follow-up PR's Pages deployment. Existing stored shares keep their expiry and are not migrated.

## Compact links

New live invitations use `#l=<room>.<role><key>` (105 characters on the production domain). The existing room admission stores two small encrypted invitation envelopes with independently generated 256-bit keys, one per participant role. Only the corresponding fragment key can open its envelope. The host credential is never included. Joining fetches one opaque envelope from the existing Durable Object before the unchanged signed/encrypted handshake. The envelope is immutable and unavailable after termination or expiry. It uses one additional DO read/request per join and zero Workers KV operations. Deploy the updated relay before Pages.

Stored snapshot links use `#s=<id>.<key>` (104 characters). Inline snapshots use `#i=<key>.<iv><ciphertext>`, eliminating JSON and a second base64 layer without changing the AES-GCM envelope. Inline length still depends on document size; the existing size thresholds remain, so this change never forces an extra KV write. Old encrypted and legacy links continue to open. No third-party URL shortener receives complete links.
