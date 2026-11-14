import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

await build({ entryPoints: ['yjs'], bundle: true, format: 'esm', platform: 'browser',
  outfile: 'assets/yjs.mjs', minify: true, legalComments: 'inline' });
writeFileSync('assets/yjs.LICENSE.txt', 'Yjs\n' + readFileSync('node_modules/yjs/LICENSE', 'utf8') +
  '\nlib0\n' + readFileSync('node_modules/lib0/LICENSE', 'utf8'));
