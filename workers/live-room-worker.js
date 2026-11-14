import '../sharing-crypto.js';
const Sharing = globalThis.MarkdownShareCrypto;
const MAX_MESSAGE_BYTES = 8 * 1024 * 1024;
const MAX_ENCRYPTED_MESSAGE_BYTES = Math.ceil((Sharing.LIVE_LIMIT + 16) * 4 / 3) + 4096;
const ENCRYPTED_AUTH_KEY = 'live-room-auth-v2';
const MAX_PARTICIPANTS = 64;
const AUTH_STORAGE_KEY = "live-room-auth-v1";
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{24,160}$/;
const ROLE_HOST = "host";
const ROLE_EDIT = "edit";
const ROLE_VIEW = "view";

function parseRoomMessage(data) {
  if (typeof data === "string") {
    if (data.length > MAX_MESSAGE_BYTES) return null;
    return JSON.parse(data);
  }

  if (data instanceof ArrayBuffer) {
    if (data.byteLength > MAX_MESSAGE_BYTES) return null;
    return JSON.parse(new TextDecoder().decode(data));
  }

  return null;
}

function safeSend(socket, message) {
  try {
    socket.send(JSON.stringify(message));
  } catch (_) {
    try {
      socket.close(1011, "send failed");
    } catch (_) {}
  }
}

function normalizeLiveRole(role) {
  return role === ROLE_HOST || role === ROLE_EDIT ? role : ROLE_VIEW;
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

function isValidCapability(value) {
  return CAPABILITY_PATTERN.test(String(value || ""));
}

function canSendMessageType(role, type) {
  if (role === ROLE_HOST) return true;
  if (role === ROLE_EDIT) {
    return new Set([
      "hello",
      "presence",
      "sync-request",
      "sync-state",
      "y-update",
      "review-sync-request",
      "review-update",
      "leave"
    ]).has(type);
  }
  return new Set([
    "hello",
    "presence",
    "sync-request",
    "review-sync-request",
    "review-update",
    "leave"
  ]).has(type);
}

function normalizeOutboundMessage(message, fallbackSender, roomId, role) {
  if (!message || typeof message.type !== "string") return null;
  if (message.roomId && message.roomId !== roomId) return null;
  if (!canSendMessageType(role, message.type)) return null;

  const sender = String(message.sender || fallbackSender || "").slice(0, 120);
  if (!sender) return null;

  const allowedTypes = new Set([
    "hello",
    "presence",
    "sync-request",
    "sync-state",
    "y-update",
    "review-sync-request",
    "review-sync-state",
    "review-update",
    "leave",
    "session-end"
  ]);
  if (!allowedTypes.has(message.type)) return null;

  return Object.assign({}, message, {
    sender,
    roomId,
    role,
    sentAt: Date.now()
  });
}

export class LiveRoom {
  constructor(state) {
    this.state = state;
    this.sessions = new Map();
  }

  broadcast(message, exceptSocket) {
    this.sessions.forEach((session, socket) => {
      if (socket !== exceptSocket) {
        safeSend(socket, message);
      }
    });
  }

  removeSocket(socket) {
    const session = this.sessions.get(socket);
    if (!session) return;
    this.sessions.delete(socket);
    if (session.encrypted) return;
    this.broadcast({
      type: "leave",
      sender: session.participantId,
      roomId: session.roomId,
      role: session.role,
      sentAt: Date.now()
    }, socket);
  }

  async authenticateSocket(url) {
    const role = normalizeLiveRole(url.searchParams.get("role") || "");
    const capability = url.searchParams.get("cap") || "";
    if (!isValidCapability(capability)) return null;

    let auth = await this.state.storage.get(AUTH_STORAGE_KEY);
    if (role === ROLE_HOST) {
      const hostCap = url.searchParams.get("hostCap") || "";
      const editCap = url.searchParams.get("editCap") || "";
      const viewCap = url.searchParams.get("viewCap") || "";
      if (![hostCap, editCap, viewCap].every(isValidCapability) || capability !== hostCap) {
        return null;
      }

      // Existing rooms remain compatible. New rooms require protocol v2.
      if (!auth) return null;
      if (auth.hostCap !== capability) return null;
      return ROLE_HOST;
    }

    if (!auth) return null;
    if (role === ROLE_EDIT) {
      return capability === auth.editCap ? ROLE_EDIT : null;
    }
    return capability === auth.viewCap ? ROLE_VIEW : null;
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Markdown Viewer live room Durable Object", {
        headers: secureHeaders({
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8"
        })
      });
    }

    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (!isAllowedLiveOrigin(origin)) {
      return new Response("Live room origin is not allowed", {
        status: 403,
        headers: secureHeaders({ "Cache-Control": "no-store" })
      });
    }

    if (url.searchParams.get('v') === '2') return this.fetchEncrypted(request);

    const roomId = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    const secret = url.searchParams.get("secret") || "";
    if (!roomId || !secret) {
      return new Response("Missing live room credentials", {
        status: 400,
        headers: secureHeaders({ "Cache-Control": "no-store" })
      });
    }

    const role = await this.authenticateSocket(url);
    if (!role) {
      return new Response("Invalid live room credentials", {
        status: 403,
        headers: secureHeaders({ "Cache-Control": "no-store" })
      });
    }

    if (this.sessions.size >= MAX_PARTICIPANTS) {
      return new Response("Live room is full", {
        status: 429,
        headers: secureHeaders({ "Cache-Control": "no-store" })
      });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const participantId = "socket-" + crypto.randomUUID();

    server.accept();
    this.sessions.set(server, {
      participantId,
      roomId,
      role,
      joinedAt: Date.now()
    });

    server.addEventListener("message", (event) => {
      let parsed;
      try {
        parsed = parseRoomMessage(event.data);
      } catch (_) {
        return;
      }

      const session = this.sessions.get(server);
      const normalized = normalizeOutboundMessage(parsed, participantId, roomId, session ? session.role : ROLE_VIEW);
      if (!normalized) return;

      if (session && parsed.sender) {
        session.participantId = String(parsed.sender).slice(0, 120);
      }

      this.broadcast(normalized, server);
    });

    const close = () => this.removeSocket(server);
    server.addEventListener("close", close);
    server.addEventListener("error", close);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async authenticateEncrypted(message, roomId) {
    const role = message.role;
    if (!Sharing.exactKeys(message, role === 'host'
      ? ['type', 'v', 'role', 'sender', 'session', 'config', 'capability', 'capabilities']
      : ['type', 'v', 'role', 'sender', 'session', 'config', 'capability'])) return null;
    if (!['host', 'edit', 'view'].includes(role) || !isValidCapability(message.capability) ||
        typeof message.sender !== 'string' || !/^[A-Za-z0-9_-]{16,120}$/.test(message.sender) ||
        typeof message.session !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(message.session)) return null;
    let config;
    try { config = Sharing.publicConfig(message.config, roomId); } catch (_) { return null; }
    if (config.expiresAt <= Date.now() || config.expiresAt > Date.now() + 86400000) return null;
    const providedHash = await Sharing.hash(message.capability);
    let hashes = null;
    if (role === 'host') {
      const caps = message.capabilities;
      if (!Sharing.exactKeys(caps, ['host', 'edit', 'view']) || !['host', 'edit', 'view'].every(name => isValidCapability(caps[name])) ||
          new Set(Object.values(caps)).size !== 3 || caps.host !== message.capability) return null;
      hashes = {};
      for (const name of ['host', 'edit', 'view']) hashes[name] = await Sharing.hash(caps[name]);
    }
    const auth = await this.state.storage.transaction(async txn => {
      let current = await txn.get(ENCRYPTED_AUTH_KEY);
      if (!current) {
        if (role !== 'host') return null;
        current = { config, hashes, expiresAt: config.expiresAt, ended: false };
        await txn.put(ENCRYPTED_AUTH_KEY, current);
      }
      if (current.ended || current.expiresAt <= Date.now() || current.hashes[role] !== providedHash ||
          JSON.stringify(current.config) !== JSON.stringify(config)) return null;
      return current;
    });
    if (auth) await this.state.storage.setAlarm(auth.expiresAt);
    return auth;
  }

  async fetchEncrypted(request) {
    const roomId = new URL(request.url).pathname.split('/').filter(Boolean).pop() || '';
    if (!/^room2_[A-Za-z0-9_-]{24}$/.test(roomId)) return new Response('Invalid room', { status: 400 });
    if (this.sessions.size >= MAX_PARTICIPANTS) return new Response('Room is full', { status: 429 });
    const [client, socket] = Object.values(new WebSocketPair());
    socket.accept();
    const session = { encrypted: true, roomId, authenticated: false, pending: 0, pendingBytes: 0, sequence: 0, chain: Promise.resolve() };
    this.sessions.set(socket, session);
    const timeout = setTimeout(() => {
      if (!session.authenticated) { socket.close(1008, 'Authentication timeout'); this.sessions.delete(socket); }
    }, 5000);
    const close = () => { clearTimeout(timeout); this.sessions.delete(socket); };
    socket.addEventListener('close', close);
    socket.addEventListener('error', close);
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string' || event.data.length > (session.authenticated ? MAX_ENCRYPTED_MESSAGE_BYTES : 16384) ||
          session.pending >= 100 || session.pendingBytes + event.data.length > MAX_ENCRYPTED_MESSAGE_BYTES * 2) {
        socket.close(1009, 'Message limit'); close(); return;
      }
      session.pending += 1;
      session.pendingBytes += event.data.length;
      session.chain = session.chain.then(async () => {
        if (!this.sessions.has(socket)) return;
        const message = JSON.parse(event.data);
        if (!session.authenticated) {
          if (message.type !== 'authenticate' || message.v !== 2) throw new Error('Authentication required');
          const auth = await this.authenticateEncrypted(message, roomId);
          if (!auth) throw new Error('Invalid credentials');
          Object.assign(session, { authenticated: true, role: message.role, participantId: message.sender,
            cryptoSession: message.session, config: auth.config, expiresAt: auth.expiresAt });
          clearTimeout(timeout);
          safeSend(socket, { type: 'ready', v: 2 });
          return;
        }
        if (session.expiresAt <= Date.now()) throw new Error('Room expired');
        Sharing.liveFrame(message);
        if (message.roomId !== roomId || message.role !== session.role || message.sender !== session.participantId ||
            message.session !== session.cryptoSession || message.seq <= session.sequence) throw new Error('Invalid frame');
        await Sharing.verifyFrame(message, session.config);
        session.sequence = message.seq;
        if (message.type === 'session-end') {
          await this.state.storage.transaction(async txn => {
            const auth = await txn.get(ENCRYPTED_AUTH_KEY);
            if (auth) { auth.ended = true; await txn.put(ENCRYPTED_AUTH_KEY, auth); }
          });
        }
        this.sessions.forEach((peer, peerSocket) => {
          if (peerSocket !== socket && peer.authenticated) safeSend(peerSocket, message);
        });
        if (message.type === 'session-end') {
          for (const peerSocket of this.sessions.keys()) peerSocket.close(1000, 'Session ended');
          this.sessions.clear();
        }
      }).catch(() => { socket.close(1008, 'Invalid encrypted room message'); close(); })
        .finally(() => { session.pending -= 1; session.pendingBytes -= event.data.length; });
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm() {
    for (const socket of this.sessions.keys()) socket.close(1000, 'Session expired');
    this.sessions.clear();
    await this.state.storage.deleteAll();
  }
}

export default {
  fetch(request, env) {
    if (!env || !env.LIVE_ROOMS) {
      return new Response("Missing LIVE_ROOMS binding", {
        status: 500,
        headers: secureHeaders({ "Cache-Control": "no-store" })
      });
    }

    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (!isAllowedLiveOrigin(origin)) {
      return new Response("Live room origin is not allowed", {
        status: 403,
        headers: secureHeaders({ "Cache-Control": "no-store" })
      });
    }

    const roomId = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    if (!roomId) {
      return new Response("Missing live room", {
        status: 400,
        headers: secureHeaders({ "Cache-Control": "no-store" })
      });
    }

    const encrypted = url.searchParams.get('v') === '2';
    if ((url.searchParams.has('v') && !encrypted) ||
        (encrypted && (url.searchParams.size !== 1 || !/^room2_[A-Za-z0-9_-]{24}$/.test(roomId)))) {
      return new Response('Unsupported live room protocol', { status: 400 });
    }
    const secret = url.searchParams.get("secret") || "";
    if (!encrypted && !secret) {
      return new Response("Missing live room credentials", {
        status: 400,
        headers: secureHeaders({ "Cache-Control": "no-store" })
      });
    }

    const id = env.LIVE_ROOMS.idFromName(encrypted ? 'encrypted-v2:' + roomId : roomId + ":" + secret);
    return env.LIVE_ROOMS.get(id).fetch(request);
  }
};
