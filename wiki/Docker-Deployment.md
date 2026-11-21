# Docker Deployment for Markdown Viewer

Markdown Viewer is an HTTP-only, static browser application served by NGINX.
The runtime is custom-compiled upstream NGINX 1.31.9 on
Alpine Linux 3.24, without OpenSSL. No certificates, backend database,
Kubernetes or Node.js production server are required for ordinary local use.

## Quick start: use the published image

With Docker Desktop / Docker Engine running:

~~~sh
docker pull ghcr.io/thisis-developer/markdown-viewer:latest
docker run -d --name markdown-viewer -p 127.0.0.1:8080:80 \
  --restart unless-stopped ghcr.io/thisis-developer/markdown-viewer:latest
~~~

Open http://localhost:8080.

**Important:** The latest tag points to the published GHCR release, not an
open PR. Git clone downloads source; it does not pull or build a Docker image.
A registry pull avoids installing compiler, git and build dependencies locally.

## Host and processor support

Release images contain **linux/amd64 and linux/arm64** variants. CI builds,
runs the browser tests, and scans each on a matching native Ubuntu runner;
it then verifies that the combined release preserves both tested images and
their attestations. Docker selects the matching variant automatically.

| Host | Docker requirement | Image variant |
| --- | --- | --- |
| Linux, including Ubuntu, on Intel/AMD 64-bit | Supported Docker Engine | linux/amd64 |
| Linux on ARM64, including a supported 64-bit Raspberry Pi OS | Supported ARM64 Docker Engine | linux/arm64 |
| Windows on Intel/AMD, including Home | Docker Desktop with Linux containers / WSL 2 | linux/amd64 |
| Intel Mac | Supported Docker Desktop | linux/amd64 |
| Apple Silicon Mac | Supported Docker Desktop | linux/arm64 |
| Windows on ARM | A supported ARM64 Docker Desktop / WSL 2 installation; vendor support may be preview | linux/arm64 |

This is Linux-container support on the two common 64-bit architectures,
not a native Windows-container image or a promise to run on every device.
32-bit x86/ARM, unsupported host OS versions and phones are not Docker
deployment targets. Phones can use the web app served by another device.
Host Docker/virtualization requirements still apply. Native Linux CI does
not replace testing every Windows/macOS Docker Desktop version or physical
device. Desktop-app installer CI is separate from Docker coverage.

Production-style Compose now uses the prebuilt registry image:

~~~sh
docker compose up -d
docker compose logs --tail=50
docker compose down
~~~

The port binds only to localhost by default. To serve LAN/Internet clients,
adjust port exposure deliberately and use the required network protection.
HTTPS for remote deployments belongs at an optional external reverse proxy,
not in this HTTP-only application image. Remote insecure origins do not offer
all localhost browser secure-context APIs.

## Developers: compile locally

~~~sh
git clone https://github.com/ThisIs-Developer/Markdown-Viewer.git
cd Markdown-Viewer
docker build --pull -t markdown-viewer:dev .
docker run --rm -d --name mdv-dev -p 127.0.0.1:8081:80 markdown-viewer:dev
~~~

Or, use the optional Compose build override:

~~~sh
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
~~~

The source build compiles NGINX in a disposable builder stage. It may take
several minutes on a cold machine; a fully cached local rebuild can take
seconds. Do not use --no-cache for every development iteration. The builder
cache can be much larger than the final runtime image. Do not globally prune
unrelated Docker resources to save space.

The previous Dockerfile used a precompiled nginx:alpine image. This one
compiles NGINX to omit TLS/OpenSSL, so a first source build is inherently more
work, particularly on older dual-core processors. Compiler installation is
a separate cached layer, so changing the NGINX source pin need not download
the toolchain again. Changing web files reuses the compiled server layer.
This improves repeat/update builds; it does not make a cold compile as fast
as pulling a prebuilt server. Build speed is not editor/rendering speed.

For normal installation or updates, use docker compose pull followed by
docker compose up -d. The build override is for source development. While a
PR is open, the latest registry tag still contains the existing release.
Avoid forcing --platform linux/amd64 on an ARM device: emulation can slow
both compilation and execution.

## Runtime behavior, tests and logs

- NGINX listens on internal port 80. The root master launches nginx workers.
  A fully non-root/container-read-only runtime is future hardening, not a
  proven property of this PR.
- Docker uses SIGQUIT for graceful stop and a local HTTP healthcheck. For
  larger downloads, permit an appropriate stop grace period.
- NGINX server and shared security headers are maintained as source files:
  docker/nginx-server.conf and docker/security-headers.conf.
- JavaScript modules are served with JavaScript MIME, missing code returns
  404, and the Service Worker can precache all required local files.
- Stable filenames (HTML, JS, CSS, manifest and worker files) revalidate,
  rather than using one-year immutable caching. ETags enable 304 responses.
- When upgrading from an older image that already sent one-year immutable
  headers, perform a browser hard refresh once if old behavior persists.
  New server headers cannot retroactively expire an existing browser HTTP
  cache entry. Do not clear site storage: that can delete local documents.
- Normal file content is browser-local. CDN renderers are loaded lazily:
  complete offline rendering requires those dependencies to have been fetched.
- The final image does not contain the APK command or OpenSSL runtime libs.
  No in-container package upgrade is supported; updates are new builds.

Basic diagnostics:

~~~sh
docker logs --tail=100 markdown-viewer
docker exec markdown-viewer nginx -t
docker inspect markdown-viewer --format '{{json .State.Health}}'
docker scout cves ghcr.io/thisis-developer/markdown-viewer:latest
~~~

Scans must target the actual deployed image digest. A Trivy zero-count does
not prove a custom NGINX binary has no vulnerabilities.

## Privacy and sharing service boundaries

The container serves a static web client, not Cloudflare KV, Durable Objects,
or a Live Share signaling service. The normal editor stores documents in the
browser. When opened on localhost or 127.0.0.1, both stored Share Snapshot
and Live Share use the existing markdownviewer.pages.dev services. Small
snapshots remain embedded in their links. Generating a stored snapshot sends
that document to the hosted snapshot API; starting/joining Live Share sends
collaboration data through the hosted WebSocket relay. Ordinary local editing
does not start either sharing operation. Internet access is required for the
hosted services and collaboration library.

Docker's CSP permits the specific hosted HTTPS/WSS endpoints and esm.sh Yjs
module. The hosted services already permit localhost origins. Public/LAN
custom hostnames are not automatically accepted by their origin policy:
self-host those compatible APIs or explicitly configure a trusted backend
origin policy. For custom Live Share deployments, the existing
window.MARKDOWN_VIEWER_LIVE_ROOM_URL override takes precedence over defaults;
both the HTML and NGINX CSP must permit the chosen endpoint. Use HTTPS for
remote deployments. This change does not open the backend to arbitrary origins
or deploy a backend inside the container. Standard HTTP access logging applies.

Docker CI covers embedded and stored snapshots in view/edit modes and real
Yjs host/guest updates, read-only access, and session ending. It intercepts
backend I/O with the actual snapshot handler and a test relay to avoid writing
test documents to production on every PR. A separate opt-in acceptance run
uses the real hosted API, CDN and WebSocket service:

~~~sh
MARKDOWN_VIEWER_TEST_CONTAINER=1 MARKDOWN_VIEWER_TEST_PORT=8080 \
MARKDOWN_VIEWER_TEST_HOSTED_SHARING=1 \
npx playwright test tests/e2e/docker-sharing.spec.js --project=chromium --workers=1
~~~

This uses synthetic documents, deletes only snapshots created by the test,
and ends its test rooms. It also checks a Docker host with a public-web guest.

## Release integrity and maintenance

PR verification never writes to GHCR. Separate native AMD64/ARM64 jobs test
and scan immutable candidates in disposable local registries. OCI archives
preserve all image and attestation digests between jobs. An assembly job
combines the exact verified manifests, checks SBOM/provenance for both
architectures, and rehearses digest-preserving promotion. Main publishing
copies that complete verified release to GHCR without a rebuild, verifies
the registry digest and attestations again, then promotes release tags.
A failed architecture check or digest mismatch prevents latest promotion.

The release includes an upstream NGINX source commit identifier, upstream
license, supplementary SPDX inventory and owner-maintained NGINX advisory
procedure (see docker/SECURITY-MAINTENANCE.md). Package scanners that enumerate
only Alpine packages do not automatically cover custom-compiled NGINX.

Current CI validates **linux/amd64 and linux/arm64 natively**. Production-load
behavior must be tested separately before being advertised. There is no
in-container auto-updater. Record digest-specific releases for rollback rather
than relying only on the mutable latest tag.

Performance and footprint should distinguish final image size, compressed
registry transfer, builder cache, runtime memory at peak load and cold/warm
build times. Optional compression tuning is deferred until measured.

## Operations

The Compose service uses Docker local log rotation. Outside Compose, the
configured host logging driver applies. Resource ceilings should follow real
measurements, not arbitrary values that might break large files. Previous
NGINX_HOST and NGINX_PORT Compose variables were removed: they did not affect
the custom hardcoded NGINX config.

More context: Privacy-and-Security.md; Troubleshooting.md; and
docker/SECURITY-MAINTENANCE.md.
