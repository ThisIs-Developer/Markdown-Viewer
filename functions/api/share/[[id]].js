import '../../../sharing-crypto.js';
const Sharing = globalThis.MarkdownShareCrypto;
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;
const SHARE_DELETE_TOKEN_BYTES = 18;
const SHARE_ID_PATTERN = /^(?:[a-z2-9]{6,20}|s2_[A-Za-z0-9_-]{24})$/;
const storageKey = id => id.startsWith('s2_') ? 'share-v2:' + id : id;
const ALLOWED_ORIGINS = new Set([
  "https://markdownviewer.pages.dev",
  "null"
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;

  if (/^https:\/\/[a-z0-9-]+\.markdownviewer\.pages\.dev$/i.test(origin)) {
    return true;
  }

  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
}

function applyCorsHeaders(headers, request) {
  const origin = request.headers.get("Origin") || "";
  headers.set("Vary", "Origin");
  if (isAllowedOrigin(origin) && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
}

function applySecurityHeaders(headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "accelerometer=(), autoplay=(), browsing-topics=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), usb=(), xr-spatial-tracking=()");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
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

function getShareId(params) {
  const raw = params && params.id;
  if (Array.isArray(raw)) return raw.join("/");
  return typeof raw === "string" ? raw : "";
}

function generateShareId() { return 's2_' + Sharing.random(18); }

function generateShareDeleteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_DELETE_TOKEN_BYTES));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hashDeleteToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(token || "")));
  let binary = "";
  const bytes = new Uint8Array(digest);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createUniqueShareId(kv) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = generateShareId();
    const existing = await kv.get(storageKey(id));
    if (!existing) return id;
  }
  throw new Error("Unable to allocate share id");
}

function sanitizeMode(mode) {
  return mode === "edit" ? "edit" : "view";
}

function sanitizeTitle(title) {
  return String(title || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

export async function onRequest({ request, env, params }) {
  if (!isAllowedOrigin(request.headers.get("Origin") || "")) {
    return jsonResponse({ error: "origin not allowed" }, { status: 403 }, request);
  }

  if (request.method === "OPTIONS") {
    return emptyResponse({ status: 204 }, request);
  }

  if (!env || !env.SHARE_KV) {
    return jsonResponse({ error: "SHARE_KV binding is not configured" }, { status: 503 }, request);
  }

  const id = getShareId(params);

  if (request.method === "POST" && !id) {
    let body;
    try {
      body = await Sharing.readJson(request, Math.ceil((Sharing.SNAPSHOT_LIMIT + 16) * 4 / 3) + 1024);
    } catch (_) {
      return jsonResponse({ error: "invalid json" }, { status: 400 }, request);
    }

    if (!Sharing.exactKeys(body, ['encrypted'])) {
      return jsonResponse({ error: 'Update Markdown Viewer to create an encrypted share.' }, { status: 426 }, request);
    }
    let encrypted;
    try { encrypted = Sharing.envelope(body.encrypted, Sharing.SNAPSHOT_LIMIT); }
    catch (_) { return jsonResponse({ error: 'invalid encrypted snapshot' }, { status: 400 }, request); }

    const shareId = await createUniqueShareId(env.SHARE_KV);
    const deleteToken = generateShareDeleteToken();
    const record = {
      version: 2,
      encrypted,
      createdAt: Date.now(),
      deleteTokenHash: await hashDeleteToken(deleteToken)
    };

    await env.SHARE_KV.put(storageKey(shareId), JSON.stringify(record), {
      expirationTtl: SHARE_TTL_SECONDS
    });

    return jsonResponse({
      id: shareId,
      deleteToken,
      expiresIn: SHARE_TTL_SECONDS
    }, { status: 201 }, request);
  }

  if (request.method === "DELETE" && id) {
    if (!SHARE_ID_PATTERN.test(id)) {
      return jsonResponse({ error: "invalid id" }, { status: 400 }, request);
    }

    let body;
    try {
      body = await Sharing.readJson(request, 1024);
    } catch (_) {
      return jsonResponse({ error: "invalid json" }, { status: 400 }, request);
    }

    const providedToken = body && typeof body.deleteToken === "string" ? body.deleteToken : "";
    if (!providedToken || providedToken.length > 128) {
      return jsonResponse({ error: "delete token required" }, { status: 400 }, request);
    }

    const raw = await env.SHARE_KV.get(storageKey(id));
    if (!raw) {
      return jsonResponse({ error: "not found" }, { status: 404 }, request);
    }

    let record;
    try {
      record = JSON.parse(raw);
    } catch (_) {
      return jsonResponse({ error: "invalid record" }, { status: 500 }, request);
    }

    if (!record.deleteTokenHash || record.deleteTokenHash !== await hashDeleteToken(providedToken)) {
      return jsonResponse({ error: "not found" }, { status: 404 }, request);
    }

    await env.SHARE_KV.delete(storageKey(id));
    return jsonResponse({ deleted: true }, {}, request);
  }

  if (request.method === "GET" && id) {
    if (!SHARE_ID_PATTERN.test(id)) {
      return jsonResponse({ error: "invalid id" }, { status: 400 }, request);
    }

    const raw = await env.SHARE_KV.get(storageKey(id));
    if (!raw) {
      return jsonResponse({ error: "not found" }, { status: 404 }, request);
    }

    let record;
    try {
      record = JSON.parse(raw);
    } catch (_) {
      return jsonResponse({ error: "invalid record" }, { status: 500 }, request);
    }

    if (id.startsWith('s2_')) {
      try {
        return jsonResponse({ encrypted: Sharing.envelope(record.encrypted, Sharing.SNAPSHOT_LIMIT) }, {}, request);
      } catch (_) { return jsonResponse({ error: 'invalid encrypted snapshot' }, { status: 500 }, request); }
    }
    return jsonResponse({
      content: record.content || "",
      mode: sanitizeMode(record.mode),
      title: sanitizeTitle(record.title),
      createdAt: record.createdAt || null,
      size: record.size || (record.content ? record.content.length : 0)
    }, {}, request);
  }

  return jsonResponse({ error: "not found" }, { status: 404 }, request);
}
