# Security Policy

This is the single security policy for Markdown Viewer, covering the web/PWA app, desktop app, and the repository's sharing and media services. Product behavior, data flows, and known limitations are documented in [Privacy and Security](wiki/Privacy-and-Security.md).

## Supported Versions

Security fixes target the [latest published release](https://github.com/ThisIs-Developer/Markdown-Viewer/releases/latest) and the current `main` branch. Older releases do not receive guaranteed backports; upgrading may be required to receive a fix.

If you discover a vulnerability in an older version, report the affected version even if you cannot check the latest release.

## Reporting a Vulnerability

Use [GitHub's private vulnerability reporting form](https://github.com/ThisIs-Developer/Markdown-Viewer/security/advisories/new). Private vulnerability reporting is enabled for this repository. If you cannot use that form, email the maintainer at [baivabsarkar@gmail.com](mailto:baivabsarkar@gmail.com).

Do not disclose vulnerability details in public issues, discussions, or pull requests before a fix or coordinated disclosure. Include:

- The affected version or commit, and whether you use the hosted web app, PWA, desktop app, Docker, or another self-hosted deployment.
- The browser and operating system, where relevant.
- Required permissions, configuration, and other preconditions.
- Minimal reproduction steps or a proof of concept using synthetic, non-sensitive data.
- Expected behavior, actual behavior, and security impact.
- A suggested mitigation or fix, if known.

Do not include real private documents, passwords, access tokens, live invitation links, room secrets, or deletion tokens. Test only systems and data you own or have explicit permission to assess, and avoid disrupting other users.

## Handling Reports

Maintainers will assess the report, request clarification when needed, and coordinate fixes and disclosure through the private report or email thread. This is a volunteer-maintained project; response and resolution times are not guaranteed.

Use the [contributing guide](CONTRIBUTING.md#issue-reports) for ordinary bugs and feature requests that do not involve a security vulnerability.
