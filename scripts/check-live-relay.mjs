// A read-only check of the Pages -> Durable Object deployment contract.
const base = process.argv[2] || 'https://markdownviewer.pages.dev';
const url = new URL('/live-room/__protocol', base);
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  const body = await response.json();
  if (!response.ok || body.protocol !== 2 || body.freshness !== 1 || body.invitations !== 1) throw new Error('Incompatible relay');
  console.log('Live Share relay supports encrypted protocol 2, freshness proofs and compact invitations.');
} catch (_) {
  console.error('Live Share relay is unavailable or outdated. Deploy wrangler.live-room.toml, then deploy Pages and retry this check.');
  process.exitCode = 1;
}
