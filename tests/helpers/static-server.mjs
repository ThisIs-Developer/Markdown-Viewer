import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleSeoRequest } from '../../seo/server-render.mjs';

const host = '127.0.0.1';
const port = Number(process.env.MARKDOWN_VIEWER_TEST_PORT || process.argv[2] || 4173);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8']
]);

// Apply the real Pages rules in file order, including header detachment.
const headerRules = [];
for (const line of (await readFile(path.join(rootDir, '_headers'), 'utf8')).split(/\r?\n/)) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue;
  if (!/^\s/.test(line)) headerRules.push({ pattern: line.trim(), entries: [] });
  else headerRules.at(-1)?.entries.push(line.trim());
}
function rendererHeaders(pathname) {
  const headers = {};
  for (const rule of headerRules) {
    if (!(rule.pattern.endsWith('*') ? pathname.startsWith(rule.pattern.slice(0,-1)) : pathname === rule.pattern)) continue;
    for (const entry of rule.entries) {
      if (entry.startsWith('! ')) { delete headers[entry.slice(2).toLowerCase()]; continue; }
      const colon = entry.indexOf(':');
      const key = entry.slice(0,colon).toLowerCase(), value = entry.slice(colon+1).trim();
      headers[key] = headers[key] ? headers[key] + ', ' + value : value;
    }
  }
  return headers;
}

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl || '/', `http://${host}:${port}`).pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname === '/assets/private-renderers/frame' ? 'assets/private-renderers/frame.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  const url = new URL(request.url, `http://${host}:${port}`);
  // Match Pages' HTML canonicalization so renderer CSP is tested on its final URL.
  if (url.pathname === '/assets/private-renderers/frame.html') {
    response.writeHead(301, { Location: '/assets/private-renderers/frame' });
    response.end();
    return;
  }
  if (url.pathname === '/tips' || url.pathname === '/index.html') {
    response.writeHead(301, { Location: '/' + url.search });
    response.end();
    return;
  }
  if (url.pathname === '/') {
    try {
      const result = await handleSeoRequest({
        request: new Request(url, { method: request.method }),
        // The local Miniflare integration relay uses a random HTTP port for
        // encrypted invitation GETs as well as its existing WebSocket port.
        next: async () => new Response((await readFile(path.join(rootDir, 'index.html'), 'utf8'))
          .replace('ws://127.0.0.1:*', 'ws://127.0.0.1:* http://127.0.0.1:*'), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        })
      });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(request.method === 'HEAD' ? undefined : await result.text());
    } catch (error) {
      console.error(error);
      response.writeHead(500);
      response.end('Unable to render page');
    }
    return;
  }

  const filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': fileStats.size,
      ...(url.pathname.startsWith('/assets/private-renderers/') ? rendererHeaders(url.pathname) : {}),
      'Content-Type': contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch (_) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Markdown Viewer test server listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
