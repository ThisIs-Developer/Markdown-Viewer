const MAX_IMAGE_BYTES = 300 * 1024;
const MAX_GIF_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 14_100_000;
const MEDIA_TTL_SECONDS = 60 * 60 * 24 * 90;
const MEDIA_TTL_MILLISECONDS = MEDIA_TTL_SECONDS * 1000;
const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{20,32}$/;
// Keep the established prefix so links created before video support remain valid.
const MEDIA_KEY_PREFIX = "managed-image-v1:";
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
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_UPLOADS = 20;

async function isWithinUploadRateLimit(env, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = "ratelimit:image-upload:" + ip;
  const current = Number(await env.SHARE_KV.get(key)) || 0;
  if (current >= RATE_LIMIT_MAX_UPLOADS) return false;
  await env.SHARE_KV.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return true;
}

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

function parseMediaDataUrl(value) {
  if (typeof value !== "string" || value.length > MAX_DATA_URL_CHARS) return null;
  const match = value.match(/^data:((?:image\/(?:avif|bmp|gif|jpeg|png|webp))|(?:video\/(?:mp4|ogg|webm)));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_MEDIA_TYPES.has(mimeType)) return null;
  const bytes = decodeBase64(match[2]);
  if (!bytes || bytes.byteLength > getMediaByteLimit(mimeType) || !hasValidMediaSignature(mimeType, bytes)) return null;
  return { mimeType, base64: match[2], bytes };
}

async function createMediaId(mimeType, bytes) {
  const typeBytes = new TextEncoder().encode(mimeType + "\0");
  const input = new Uint8Array(typeBytes.length + bytes.length);
  input.set(typeBytes, 0);
  input.set(bytes, typeBytes.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  let binary = "";
  digest.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 24);
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
    if (!(await isWithinUploadRateLimit(env, request))) {
      return jsonResponse({ error: "too many upload requests, please try again later" }, { status: 429 }, request);
    }
    const contentLength = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_DATA_URL_CHARS + 1024) {
      return jsonResponse({ error: "media upload is too large" }, { status: 413 }, request);
    }
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return jsonResponse({ error: "invalid json" }, { status: 400 }, request);
    }
    const media = parseMediaDataUrl(body && body.dataUrl);
    if (!media) return jsonResponse({ error: "invalid or oversized image, GIF, or video" }, { status: 400 }, request);

    const mediaId = await createMediaId(media.mimeType, media.bytes);
    const storageKey = MEDIA_KEY_PREFIX + mediaId;
    const existing = await env.SHARE_KV.get(storageKey);
    const createdAt = Date.now();
    const expiresAt = createdAt + MEDIA_TTL_MILLISECONDS;
    await env.SHARE_KV.put(storageKey, JSON.stringify({
      version: 2,
      mimeType: media.mimeType,
      base64: media.base64,
      size: media.bytes.byteLength,
      createdAt,
      expiresAt
    }), { expirationTtl: MEDIA_TTL_SECONDS });

    return jsonResponse({
      id: mediaId,
      url: getPublicMediaUrl(request, mediaId),
      mimeType: media.mimeType,
      size: media.bytes.byteLength,
      expiresAt
    }, { status: existing ? 200 : 201 }, request);
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
    if (remainingTtl < 60) {
      await env.SHARE_KV.delete(MEDIA_KEY_PREFIX + id);
      return jsonResponse({ error: "media expired" }, { status: 404 }, request);
    }
    if (!Number.isFinite(storedExpiresAt) || storedExpiresAt <= 0) {
      record.version = 2;
      record.expiresAt = expiresAt;
      await env.SHARE_KV.put(MEDIA_KEY_PREFIX + id, JSON.stringify(record), { expirationTtl: remainingTtl });
    }
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
