const ALLOWED_ORIGINS = new Set([
  "https://markdownviewer.pages.dev",
  "null"
]);

const VALID_ISSUE_TYPES = new Set([
  "Bug Report",
  "Feature Request",
  "UI/UX Issue",
  "Performance Issue",
  "Documentation Issue",
  "Security Concern",
  "Other"
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "txt", "log", "json"
]);

const ALLOWED_ATTACHMENT_MIMES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "text/plain", "text/log", "application/json", "application/octet-stream"
]);

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;

  if (/^https:\/\/[a-z0-9-]+\.markdownviewer\.pages\.dev$/i.test(origin)) {
    return true;
  }

  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
}

function applyCorsHeaders(headers, request) {
  const origin = request ? request.headers.get("Origin") || "" : "";
  headers.set("Vary", "Origin");
  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Turnstile-Token");
}

function applySecurityHeaders(headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "accelerometer=(), autoplay=(), camera=(), geolocation=(), microphone=()");
}

function jsonResponse(body, init, request) {
  const headers = new Headers(init && init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  applySecurityHeaders(headers);
  if (request) applyCorsHeaders(headers, request);

  return new Response(JSON.stringify(body), {
    status: init && init.status ? init.status : 200,
    headers
  });
}

function emptyResponse(init, request) {
  const headers = new Headers(init && init.headers);
  headers.set("Cache-Control", "no-store");
  applySecurityHeaders(headers);
  if (request) applyCorsHeaders(headers, request);

  return new Response(null, {
    status: init && init.status ? init.status : 204,
    headers
  });
}

function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") ||
         request.headers.get("X-Forwarded-For") ||
         "127.0.0.1";
}

async function checkRateLimit(ip, kv) {
  if (!kv) return true; // If no KV binding, pass
  const key = `rate_limit_issue_${ip}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  await kv.put(key, (count + 1).toString(), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return true;
}

async function verifyTurnstile(token, secret, remoteIp) {
  if (!secret) return true; // Turnstile not configured
  if (!token) return false;

  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);
  if (remoteIp) formData.append("remoteip", remoteIp);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData
    });
    const outcome = await res.json();
    return outcome.success === true;
  } catch (_) {
    return false;
  }
}

function getIssueLabel(issueType) {
  switch (issueType) {
    case "Bug Report": return ["bug"];
    case "Feature Request": return ["enhancement"];
    case "Documentation Issue": return ["documentation"];
    case "UI/UX Issue": return ["ui"];
    case "Performance Issue": return ["performance"];
    case "Security Concern": return ["security"];
    default: return [];
  }
}

function base64ToUint8Array(base64) {
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function pemToArrayBuffer(pem) {
  const b64Lines = pem.replace(/-----\BEGIN PRIVATE KEY-----/, "")
                      .replace(/-----\END PRIVATE KEY-----/, "")
                      .replace(/[\r\n\s]/g, "");
  const binary = atob(b64Lines);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function generateGitHubAppToken(appId, privateKeyPem, installationId) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + (10 * 60),
    iss: appId
  };

  const base64UrlEncode = (obj) => {
    const str = typeof obj === "string" ? obj : JSON.stringify(obj);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const unsignedJwt = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
  const keyBuffer = pemToArrayBuffer(privateKeyPem);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedJwt}.${signatureB64}`;

  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "MarkdownViewer-App"
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to obtain GitHub App installation token: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.token;
}

async function getGitHubAccessToken(env) {
  if (env.GITHUB_TOKEN) {
    return env.GITHUB_TOKEN;
  }

  if (env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && env.GITHUB_INSTALLATION_ID) {
    return await generateGitHubAppToken(
      env.GITHUB_APP_ID,
      env.GITHUB_APP_PRIVATE_KEY,
      env.GITHUB_INSTALLATION_ID
    );
  }

  return null;
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get("Origin") || "";
  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, { status: 403 }, request);
  }

  if (request.method === "OPTIONS") {
    return emptyResponse({ status: 204 }, request);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 }, request);
  }

  const clientIp = getClientIp(request);
  const kv = env.SHARE_KV || env.REPORT_KV;
  const rateOk = await checkRateLimit(clientIp, kv);
  if (!rateOk) {
    return jsonResponse({ error: "Rate limit exceeded. Please wait before submitting another report." }, { status: 429 }, request);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ error: "Invalid JSON payload" }, { status: 400 }, request);
  }

  // Turnstile verification
  const turnstileToken = request.headers.get("X-Turnstile-Token") || (body && body.turnstileToken);
  const turnstileValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, clientIp);
  if (!turnstileValid) {
    return jsonResponse({ error: "Turnstile verification failed" }, { status: 403 }, request);
  }

  // Fields validation
  const rawIssueType = body && typeof body.issueType === "string" ? body.issueType.trim() : "Bug Report";
  const issueType = VALID_ISSUE_TYPES.has(rawIssueType) ? rawIssueType : "Bug Report";

  const title = body && typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length < 3) {
    return jsonResponse({ error: "Issue title must be at least 3 characters long." }, { status: 400 }, request);
  }
  if (title.length > 200) {
    return jsonResponse({ error: "Issue title must not exceed 200 characters." }, { status: 400 }, request);
  }

  const description = body && typeof body.description === "string" ? body.description.trim() : "";
  if (!description || description.length < 10) {
    return jsonResponse({ error: "Issue description must be at least 10 characters long." }, { status: 400 }, request);
  }
  if (description.length > 10000) {
    return jsonResponse({ error: "Issue description must not exceed 10,000 characters." }, { status: 400 }, request);
  }

  const stepsToReproduce = body && typeof body.stepsToReproduce === "string" ? body.stepsToReproduce.trim().slice(0, 5000) : "";
  const expectedBehaviour = body && typeof body.expectedBehaviour === "string" ? body.expectedBehaviour.trim().slice(0, 5000) : "";
  const actualBehaviour = body && typeof body.actualBehaviour === "string" ? body.actualBehaviour.trim().slice(0, 5000) : "";
  const environment = body && typeof body.environment === "object" && body.environment ? body.environment : null;
  const attachment = body && typeof body.attachment === "object" && body.attachment ? body.attachment : null;

  // Process Attachment if present
  let attachmentUrl = null;
  if (attachment && attachment.base64Data && attachment.fileName) {
    const ext = String(attachment.fileName).split(".").pop().toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
      return jsonResponse({ error: `File type .${ext} is not supported.` }, { status: 400 }, request);
    }

    const mime = attachment.mimeType || "application/octet-stream";
    if (mime && !ALLOWED_ATTACHMENT_MIMES.has(mime) && !mime.startsWith("image/") && !mime.startsWith("text/")) {
      return jsonResponse({ error: "Unsupported MIME type for attachment." }, { status: 400 }, request);
    }

    let fileBuffer;
    try {
      fileBuffer = base64ToUint8Array(attachment.base64Data);
    } catch (_) {
      return jsonResponse({ error: "Invalid base64 encoding for attachment." }, { status: 400 }, request);
    }

    if (fileBuffer.byteLength > MAX_ATTACHMENT_BYTES) {
      return jsonResponse({ error: "Attachment file size exceeds the 5 MB limit." }, { status: 400 }, request);
    }

    const r2 = env.ATTACHMENTS_R2 || env.R2_BUCKET;
    if (r2) {
      const key = `attachments/${crypto.randomUUID()}.${ext}`;
      await r2.put(key, fileBuffer, {
        httpMetadata: { contentType: mime }
      });
      const baseUrl = env.ATTACHMENT_BASE_URL || `https://${request.headers.get("Host") || "markdownviewer.pages.dev"}/api/attachments`;
      attachmentUrl = `${baseUrl}/${key}`;
    } else {
      // Fallback message if R2 is not configured
      attachmentUrl = `[Attachment included: ${attachment.fileName} (${(fileBuffer.byteLength / 1024).toFixed(1)} KB) - Storage unconfigured]`;
    }
  }

  // Construct Markdown Issue Body
  let markdownBody = `## Issue Type\n\n${issueType}\n\n## Description\n\n${description}\n\n`;

  if (stepsToReproduce) {
    markdownBody += `## Steps to Reproduce\n\n${stepsToReproduce}\n\n`;
  }
  if (expectedBehaviour) {
    markdownBody += `## Expected Behaviour\n\n${expectedBehaviour}\n\n`;
  }
  if (actualBehaviour) {
    markdownBody += `## Actual Behaviour\n\n${actualBehaviour}\n\n`;
  }

  if (environment) {
    markdownBody += `## Environment\n\n`;
    if (environment.appName) markdownBody += `- **Application:** ${environment.appName}\n`;
    if (environment.appVersion) markdownBody += `- **Version:** ${environment.appVersion}\n`;
    if (environment.browser) markdownBody += `- **Browser:** ${environment.browser}\n`;
    if (environment.os) markdownBody += `- **Operating System:** ${environment.os}\n`;
    if (environment.screenResolution) markdownBody += `- **Screen Resolution:** ${environment.screenResolution}\n`;
    if (environment.viewport) markdownBody += `- **Viewport:** ${environment.viewport}\n`;
    if (environment.currentMode) markdownBody += `- **Current Mode:** ${environment.currentMode}\n`;
    if (environment.pageUrl) markdownBody += `- **Page URL:** ${environment.pageUrl}\n`;
    if (environment.language) markdownBody += `- **Language:** ${environment.language}\n`;
    if (environment.submittedAt) markdownBody += `- **Submitted At:** ${environment.submittedAt}\n`;
    markdownBody += `\n`;
  }

  if (attachmentUrl) {
    markdownBody += `## Attachment\n\n`;
    if (attachmentUrl.startsWith("http")) {
      markdownBody += `[View Attachment](${attachmentUrl})\n\n`;
    } else {
      markdownBody += `${attachmentUrl}\n\n`;
    }
  }

  markdownBody += `---\n\n*Submitted through the Markdown Viewer in-app issue reporter.*`;

  // Obtain GitHub token
  let token;
  try {
    token = await getGitHubAccessToken(env);
  } catch (err) {
    return jsonResponse({ error: "Backend GitHub authentication error: " + err.message }, { status: 503 }, request);
  }

  if (!token) {
    return jsonResponse({ error: "In-app issue reporter backend is not configured with GitHub credentials." }, { status: 503 }, request);
  }

  const labels = getIssueLabel(issueType);
  const repoOwner = env.GITHUB_REPO_OWNER || "ThisIs-Developer";
  const repoName = env.GITHUB_REPO_NAME || "Markdown-Viewer";

  const issuePayload = {
    title,
    body: markdownBody
  };
  if (labels.length > 0) {
    issuePayload.labels = labels;
  }

  // Create GitHub Issue
  let ghRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/issues`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "MarkdownViewer-App"
    },
    body: JSON.stringify(issuePayload)
  });

  // If label failed (e.g. 422 Unprocessable Entity due to missing label), retry without labels
  if (!ghRes.ok && labels.length > 0 && ghRes.status === 422) {
    delete issuePayload.labels;
    ghRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/issues`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "MarkdownViewer-App"
      },
      body: JSON.stringify(issuePayload)
    });
  }

  if (!ghRes.ok) {
    const errorData = await ghRes.json().catch(() => ({}));
    const message = errorData.message || `GitHub API error (${ghRes.status})`;
    return jsonResponse({ error: `Failed to create GitHub issue: ${message}` }, { status: 502 }, request);
  }

  const ghData = await ghRes.json();
  return jsonResponse({
    success: true,
    issueNumber: ghData.number,
    issueUrl: ghData.html_url,
    issueTitle: ghData.title
  }, { status: 201 }, request);
}
