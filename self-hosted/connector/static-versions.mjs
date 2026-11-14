import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Content identities bypass previously cached unversioned scripts after an upgrade.
// Only trusted, local source-page assets qualify; request paths never enter this step.
export async function versionStylesAndScripts(html, root) {
  const references=[...html.matchAll(/\b(?:src|href)="((?:\.\/)?[a-zA-Z0-9_/-]+\.(?:js|mjs|css))"/g)];
  const versions=new Map();
  for(const [,reference] of references) {
    if(versions.has(reference))continue;
    const bytes=await readFile(path.join(root,reference));
    versions.set(reference,createHash('sha256').update(bytes).digest('hex').slice(0,24));
  }
  return html.replace(/\b(src|href)="((?:\.\/)?[a-zA-Z0-9_/-]+\.(?:js|mjs|css))"/g,
    (_match,attribute,reference)=>attribute+'="'+reference+'?v='+versions.get(reference)+'"');
}
