# In-App Issue Reporter Setup Guide

This guide explains how to configure and deploy the secure **In-App Issue Reporter** for Markdown Viewer.

---

## Architecture Overview

1. **Frontend Modal**: Renders inside the application with design system parity (Share Snapshot / Live Share).
2. **Cloudflare Pages Function**: `/api/report-issue` validates payload, enforces rate-limiting and origin checks, handles Turnstile verification, uploads attachments to Cloudflare R2, and creates a GitHub Issue via the GitHub REST API.
3. **Fallback Mode**: If the backend endpoint is unconfigured or unreachable, the modal presents a direct **"Open GitHub Issue Page"** fallback button with pre-filled title and body URL parameters.

---

## 1. GitHub Integration Setup

You can authenticate the backend using either a **GitHub App** (Recommended) or a **Personal Access Token (PAT)**.

### Option A: GitHub App (Recommended)

1. Go to **GitHub Settings** > **Developer Settings** > **GitHub Apps** > **New GitHub App**.
2. Set **App Name**: `Markdown-Viewer-Issue-Reporter`.
3. Set **Homepage URL**: `https://markdownviewer.pages.dev`.
4. Deactivate **Webhook** (active = false).
5. Set **Repository Permissions**:
   - `Issues`: **Read & write**
6. Save and note down your **App ID**.
7. Generate a **Private Key** (.pem file) and download it.
8. Install the GitHub App on your repository: `ThisIs-Developer/Markdown-Viewer`.
9. Note down the **Installation ID** from the URL (`https://github.com/settings/installations/<INSTALLATION_ID>`).

### Option B: GitHub Personal Access Token (PAT)

1. Go to **GitHub Settings** > **Developer Settings** > **Personal Access Tokens** > **Fine-grained tokens**.
2. Target repository: `ThisIs-Developer/Markdown-Viewer`.
3. Permission: **Repository permissions** > **Issues** > **Read and write**.
4. Generate and save token.

---

## 2. Cloudflare Environment Variables & Secrets

Configure the following secrets in Cloudflare Pages via **Wrangler** or the **Cloudflare Dashboard**:

```bash
# Option A: GitHub App Secrets
npx wrangler pages secret put GITHUB_APP_ID --project-name=markdown-viewer
npx wrangler pages secret put GITHUB_APP_PRIVATE_KEY --project-name=markdown-viewer
npx wrangler pages secret put GITHUB_INSTALLATION_ID --project-name=markdown-viewer

# Option B: GitHub Token Secret (Fallback / Alternative)
npx wrangler pages secret put GITHUB_TOKEN --project-name=markdown-viewer

# Optional Custom Repository Target (Defaults to ThisIs-Developer/Markdown-Viewer)
npx wrangler pages secret put GITHUB_REPO_OWNER --project-name=markdown-viewer
npx wrangler pages secret put GITHUB_REPO_NAME --project-name=markdown-viewer

# Optional Cloudflare Turnstile Verification
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name=markdown-viewer

# Optional Public Base URL for Attachments R2
npx wrangler pages secret put ATTACHMENT_BASE_URL --project-name=markdown-viewer
```

---

## 3. Cloudflare R2 Storage Binding (Attachments)

1. Create an R2 bucket named `markdown-viewer-attachments` in your Cloudflare account.
2. In `wrangler.toml`, ensure the binding is defined:
   ```toml
   [[r2_buckets]]
   binding = "ATTACHMENTS_R2"
   bucket_name = "markdown-viewer-attachments"
   ```
3. Attach the R2 bucket in Cloudflare Pages Settings > Functions > R2 bucket bindings with variable name `ATTACHMENTS_R2`.

---

## 4. Allowed Origins & Security

The backend origin check automatically permits:
- `https://markdownviewer.pages.dev`
- Preview deployments matching `https://*.markdownviewer.pages.dev`
- Local development origins (`http://localhost:*`, `http://127.0.0.1:*`)

---

## 5. Local Development & Testing

Run local development using Wrangler:

```bash
npx wrangler pages dev .
```

To test locally with dummy or live secrets, create a `.dev.vars` file (never commit to git):

```env
GITHUB_TOKEN=ghp_your_secret_pat_here
# or
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GITHUB_INSTALLATION_ID=7890123
```

---

## 6. Disabling In-App Reporter / Using GitHub Fallback

If `GITHUB_TOKEN` or `GITHUB_APP_ID` is not configured on the backend, the API responds with a `503 Service Unavailable` status. The frontend automatically shows an error notification with the **"Open GitHub Issue Page"** fallback button, keeping the entered report intact and allowing direct creation on GitHub without losing user input.
