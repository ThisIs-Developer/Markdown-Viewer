export async function onRequest(context) {
  const { request, env, params } = context;
  const upgradeHeader = request.headers.get("Upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Markdown Viewer live room endpoint", {
      headers: secureHeaders({
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      })
    });
  }

  if (!env || !env.LIVE_ROOMS) {
    return new Response("Missing LIVE_ROOMS Durable Object binding", {
      status: 503,
      headers: secureHeaders({
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      })
    });
  }

  const origin = request.headers.get("Origin") || "";
  if (!isAllowedLiveOrigin(origin)) {
    return new Response("Live room origin is not allowed", {
      status: 403,
      headers: secureHeaders({
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      })
    });
  }

  const roomParam = Array.isArray(params.room) ? params.room.join("/") : params.room;
  const roomName = String(roomParam || "").trim();
  if (!roomName || roomName.length > 160) {
    return new Response("Invalid live room", { status: 400 });
  }
  const url = new URL(request.url);
  const encrypted = url.searchParams.get('v') === '2';
  if ((url.searchParams.has('v') && !encrypted) || (encrypted && url.searchParams.size !== 1)) {
    return new Response('Unsupported live room protocol', { status: 400 });
  }
  const secret = url.searchParams.get("secret") || "";
  if (!encrypted && (!secret || secret.length > 256)) {
    return new Response("Invalid live room credentials", { status: 400 });
  }

  if (encrypted && !/^room2_[A-Za-z0-9_-]{24}$/.test(roomName)) return new Response('Invalid encrypted room', { status: 400 });
  const id = env.LIVE_ROOMS.idFromName(encrypted ? 'encrypted-v2:' + roomName : roomName + ":" + secret);
  return env.LIVE_ROOMS.get(id).fetch(request);
}

function secureHeaders(base) {
  return Object.assign({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "accelerometer=(), autoplay=(), browsing-topics=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), usb=(), xr-spatial-tracking=()",
    "Cross-Origin-Resource-Policy": "same-site"
  }, base || {});
}

function isAllowedLiveOrigin(origin) {
  if (origin === "https://markdownviewer.pages.dev" || origin === "null") {
    return true;
  }
  if (/^https:\/\/[a-z0-9-]+\.markdownviewer\.pages\.dev$/i.test(origin || "")) {
    return true;
  }
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin || "")) {
    return true;
  }
  return false;
}
