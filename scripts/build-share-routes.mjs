import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
if (!html.includes('<head>')) throw new Error('Missing app HTML head.');
const versioned = html.replace('<head>', '<head>\n    <base href="/">\n    <meta name="robots" content="noindex,nofollow">');
mkdirSync('v2', { recursive: true });
writeFileSync('v2/index.html', versioned);
