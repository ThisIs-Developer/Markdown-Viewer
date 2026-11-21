# Source-compiled NGINX: security inventory and maintenance

**Owner:** Markdown Viewer maintainers.
**Cadence:** Review upstream NGINX and Alpine advisories monthly and on
security announcements. The scheduled monthly GitHub Actions verification
is non-publishing; it does not replace a human upstream advisory review.

## Decision and trade-off

The requirement is an HTTP-only image without shipping OpenSSL runtime
libraries. The Dockerfile builds upstream NGINX 1.31.9 from
release-1.31.9, verified commit
c2c44702c2fbc572e4cfb0a52331061d7fcaca16.

An official, version-and-digest-pinned slim NGINX image simplifies compiler
and patch maintenance, but should **not** be called OpenSSL-free without
independent package and runtime-linkage inspection. Replacing this custom
binary later needs a separate product decision and corresponding tests.

The 2026-11-20 review updates the pinned source to 1.31.9 following the
2026-11-18 upstream security release. Review advisory applicability as well
as versions: TLS, HTTP/2, HTTP/3, mail and stream are not enabled here;
the stock static configuration does not use resolver, alias or PROXY protocol.
Keep the source, runtime assertion, labels and component inventory aligned.

## Identity and license

- Component: nginx 1.31.9, from https://github.com/nginx/nginx
- Source commit: c2c44702c2fbc572e4cfb0a52331061d7fcaca16
- License: BSD-2-Clause, distributed at
  /usr/share/licenses/nginx/LICENSE
- Supplementary SPDX at /usr/local/share/sbom/nginx.spdx.json and
  /usr/share/doc/nginx/component.spdx.json
- Binary: /usr/sbin/nginx (no SSL/QUIC build modules)
- OS inventory: /lib/apk/db/installed

The supplementary SPDX identifies the custom binary without inventing an
Alpine APK entry. The release job must verify NGINX is present in the actual
BuildKit-attested OCI index SBOM or stop promotion. Document uncertainty if
the SBOM generator omits it. A zero-CVE OS package scan is NOT a NGINX scan.

PRs build and test attested AMD64 and ARM64 candidates on native runners in
ephemeral localhost registries. Each architecture has independent browser,
runtime and vulnerability checks. OCI archives preserve the tested manifests
and attestations between jobs; assembly rejects missing or substituted
manifests. The combined index is verified and its promotion rehearsed before
main copies it to GHCR without rebuilding. PRs do not publish to GHCR.
Both single-platform
and multi-platform Buildx attestation output are supported; missing SPDX or
BuildKit provenance blocks promotion. This rehearses the release mechanism,
but real GHCR credentials/permissions are only exercised after merge.

## Release/advisory review

1. Examine https://nginx.org/en/security_advisories.html and recent upstream
   releases. Compare actual affected versions, configurations and build
   options with this pinned upstream-source build.
2. Inspect Alpine stable branch package advisories separately. Do not install
   edge patches or misclassify upstream vs Alpine rebuild versions.
3. Validate final runtime-package inventory, NGINX executable linkage,
   source version, distributed license and SBOM component metadata.
4. For a release, verify the single immutable OCI index digest is the one
   tested, vulnerability-scanned and promoted. Record both the OCI manifest
   digest and platform-specific image config ID; they are different.
5. Inspect the registry SBOM/provenance, browser checks, mandatory assets,
   security response headers and 404 paths.
6. Compare Trivy and Docker Scout only on the same digest/platform/database
   time; retain full results and don't suppress findings for a zero score.
7. Keep an immutable commit tag and exact digest to support rollback.

Known limitations: automated OS-package scanning does not fully analyze a
source-built NGINX executable; current browser tests are not a complete
security audit. Root-master removal, read-only filesystem, production
load/peak memory, and all CDN-dependent
offline renderers require independent validation. No false zero-risk claim.

Do not automatically delete users' Docker caches, volumes or containers.
A scoped, age-filtered build-cache cleanup is optional and trades disk space
against future cold build time.
