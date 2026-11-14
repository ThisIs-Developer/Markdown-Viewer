import '../../../sharing-crypto.js';
const Sharing = globalThis.MarkdownShareCrypto;
const MAX_IMAGE_BYTES = 300 * 1024;
const MAX_GIF_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
const MEDIA_TTL_SECONDS = 60 * 60 * 24 * 90;
const MEDIA_TTL_MILLISECONDS = MEDIA_TTL_SECONDS * 1000;
const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{20,32}$/;
// Keep the established prefix so links created before video support remain valid.
const MEDIA_KEY_PREFIX = "managed-image-v1:";
const ENCRYPTED_MEDIA_ID = /^e2_[A-Za-z0-9_-]{24}$/;
const ENCRYPTED_MEDIA_PREFIX = 'managed-media-v2:';
const ALLOWED_ORIGINS = new Set([
  "https://markdownviewer.pages.dev",
  "null"
]);
const ALLOWED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/ogg",
  "video/webm"
]);
const ALLOWED_MEDIA_TYPES = new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.markdownviewer\.pages\.dev$/i.test(origin)) return true;
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
}

function applySecurityHeaders(headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "accelerometer=(), autoplay=(), browsing-topics=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), usb=(), xr-spatial-tracking=()");
}

function jsonResponse(body, init, request) {
  const headers = new Headers(init && init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  applySecurityHeaders(headers);
  const origin = request && request.headers.get("Origin");
  if (origin && isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), {
    status: init && init.status ? init.status : 200,
    headers
  });
}

function getMediaId(params) {
  const raw = params && params.id;
  if (Array.isArray(raw)) return raw.join("/");
  return typeof raw === "string" ? raw : "";
}

function decodeBase64(value) {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch (_) {
    return null;
  }
}

function bytesStartWith(bytes, values) {
  return values.every((value, index) => bytes[index] === value);
}

function asciiSlice(bytes, start, end) {
  return String.fromCharCode.apply(null, bytes.subarray(start, end));
}

function hasValidMediaSignature(mimeType, bytes) {
  if (!bytes || !bytes.length) return false;
  if (mimeType === "image/png") return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/jpeg") return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/gif") return asciiSlice(bytes, 0, 6) === "GIF87a" || asciiSlice(bytes, 0, 6) === "GIF89a";
  if (mimeType === "image/webp") return asciiSlice(bytes, 0, 4) === "RIFF" && asciiSlice(bytes, 8, 12) === "WEBP";
  if (mimeType === "image/bmp") return asciiSlice(bytes, 0, 2) === "BM";
  if (mimeType === "image/avif") {
    const brand = asciiSlice(bytes, 8, 12);
    return asciiSlice(bytes, 4, 8) === "ftyp" && (brand === "avif" || brand === "avis");
  }
  if (mimeType === "video/mp4") return asciiSlice(bytes, 4, 8) === "ftyp";
  if (mimeType === "video/webm") return bytesStartWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (mimeType === "video/ogg") return asciiSlice(bytes, 0, 4) === "OggS";
  return false;
}

function getMediaByteLimit(mimeType) {
  if (ALLOWED_VIDEO_TYPES.has(mimeType)) return MAX_VIDEO_BYTES;
  if (mimeType === "image/gif") return MAX_GIF_BYTES;
  return MAX_IMAGE_BYTES;
}



function getPublicMediaUrl(request, id) {
  const url = new URL(request.url);
  url.pathname = url.pathname.startsWith("/api/media") ? "/api/media/" + id : "/api/image/" + id;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function onRequest({ request, env, params }) {
  const id = getMediaId(params);

  if (request.method === "OPTIONS") {
    const headers = new Headers({
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store"
    });
    const origin = request.headers.get("Origin") || "";
    if (isAllowedOrigin(origin) && origin) headers.set("Access-Control-Allow-Origin", origin);
    applySecurityHeaders(headers);
    return new Response(null, { status: 204, headers });
  }

  if (!env || !env.SHARE_KV) {
    return jsonResponse({ error: "media storage is not configured" }, { status: 503 }, request);
  }

  if (request.method === "POST" && !id) {
    const origin = request.headers.get("Origin") || "";
    if (!isAllowedOrigin(origin)) return jsonResponse({ error: "origin not allowed" }, { status: 403 }, request);
    let body;
    try {
      body = await Sharing.readJson(request, Math.ceil((Sharing.MEDIA_LIMIT + 16) * 4 / 3) + 1024);
    } catch (_) {
      return jsonResponse({ error: "invalid json" }, { status: 400 }, request);
    }
    if (!Sharing.exactKeys(body, ['encrypted'])) {
      return jsonResponse({ error: 'Update Markdown Viewer to upload encrypted media.' }, { status: 426 }, request);
    }
    let encrypted;
    try { encrypted = Sharing.envelope(body.encrypted, Sharing.MEDIA_LIMIT); }
    catch (_) { return jsonResponse({ error: 'invalid encrypted media' }, { status: 400 }, request); }
    const mediaId = 'e2_' + Sharing.random(18);
    const storageKey = ENCRYPTED_MEDIA_PREFIX + mediaId;
    const createdAt = Date.now();
    const expiresAt = createdAt + MEDIA_TTL_MILLISECONDS;
    await env.SHARE_KV.put(storageKey, JSON.stringify({
      version: 3,
      encrypted,
      createdAt,
      expiresAt
    }), { expirationTtl: MEDIA_TTL_SECONDS });

    return jsonResponse({
      id: mediaId,
      url: getPublicMediaUrl(request, mediaId),
      expiresAt
    }, { status: 201 }, request);
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && ENCRYPTED_MEDIA_ID.test(id)) {
    const raw = await env.SHARE_KV.get(ENCRYPTED_MEDIA_PREFIX + id);
    if (!raw) return jsonResponse({ error: 'media not found' }, { status: 404 }, request);
    try {
      const record = JSON.parse(raw);
      if (!Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now()) {
        return jsonResponse({ error: 'media expired' }, { status: 404 }, request);
      }
      const response = jsonResponse({ encrypted: Sharing.envelope(record.encrypted, Sharing.MEDIA_LIMIT) }, {}, request);
      response.headers.set('Access-Control-Allow-Origin', '*');
      return request.method === 'HEAD' ? new Response(null, { headers: response.headers }) : response;
    } catch (_) { return jsonResponse({ error: 'media unavailable' }, { status: 500 }, request); }
  }

  if ((request.method === "GET" || request.method === "HEAD") && MEDIA_ID_PATTERN.test(id)) {
    const raw = await env.SHARE_KV.get(MEDIA_KEY_PREFIX + id);
    if (!raw) return jsonResponse({ error: "media not found" }, { status: 404 }, request);
    let record;
    try {
      record = JSON.parse(raw);
    } catch (_) {
      return jsonResponse({ error: "media unavailable" }, { status: 500 }, request);
    }
    if (!record || !ALLOWED_MEDIA_TYPES.has(record.mimeType)) {
      return jsonResponse({ error: "media unavailable" }, { status: 500 }, request);
    }
    const createdAt = Number(record.createdAt);
    const storedExpiresAt = Number(record.expiresAt);
    const expiresAt = Number.isFinite(storedExpiresAt) && storedExpiresAt > 0
      ? storedExpiresAt
      : createdAt + MEDIA_TTL_MILLISECONDS;
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) {
      return jsonResponse({ error: "media unavailable" }, { status: 500 }, request);
    }
    const remainingTtl = Math.floor((expiresAt - Date.now()) / 1000);
    if (remainingTtl <= 0) {
      return jsonResponse({ error: "media expired" }, { status: 404 }, request);
    }
    // Legacy media keeps its original expiry; reading never extends retention.
    const bytes = decodeBase64(record.base64);
    if (!bytes || bytes.byteLength > getMediaByteLimit(record.mimeType) || !hasValidMediaSignature(record.mimeType, bytes)) {
      return jsonResponse({ error: "media unavailable" }, { status: 500 }, request);
    }
    const headers = new Headers({
      "Content-Type": record.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=" + remainingTtl + ", immutable",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin"
    });
    applySecurityHeaders(headers);
    return new Response(request.method === "HEAD" ? null : bytes, { status: 200, headers });
  }

  return jsonResponse({ error: "not found" }, { status: 404 }, request);
}
