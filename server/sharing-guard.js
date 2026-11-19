// Best-effort burst protection within one isolate, with no KV counter writes.
// This is deliberately not an account-wide daily quota or distributed limiter.
const clients = new Map();
export function sharingGuard(request, env = {}) {
  if (request.method === 'POST' && env.SHARING_WRITES_ENABLED === 'false') {
    return { status: 503, error: 'New sharing uploads are temporarily paused.' };
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !['GET', 'HEAD', 'POST', 'DELETE'].includes(request.method)) return null;
  const now = Date.now();
  for (const [key, value] of clients) if (value.until <= now) clients.delete(key);
  const key = ip + ':' + (request.method === 'POST' ? 'write' : 'read');
  if (!clients.has(key)) {
    if (clients.size >= 4096) return { status: 429, error: 'Sharing is busy. Try again in a minute.' };
    clients.set(key, { count: 0, until: now + 60000 });
  }
  const value = clients.get(key);
  if (++value.count > (request.method === 'POST' ? 60 : 180)) return { status: 429, error: 'Sharing request limit reached. Try again in a minute.' };
  return null;
}
