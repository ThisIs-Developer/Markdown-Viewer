import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { versionStylesAndScripts } from '../static-versions.mjs';

test('asset identities change with source content, preserving external URLs',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'mv-assets-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(path.join(root,'script.js'),'// old');
  await writeFile(path.join(root,'styles.css'),'/* stable */');
  const html='<script src="script.js" defer></script><link href="styles.css"><script src="https://cdn.example/library.js"></script>';
  const first=await versionStylesAndScripts(html,root);
  assert.match(first,/script\.js\?v=[a-f0-9]{24}/);
  assert.match(first,/src="https:\/\/cdn.example\/library.js"/);
  assert.equal(first,await versionStylesAndScripts(html,root));
  await writeFile(path.join(root,'script.js'),'// new');
  const second=await versionStylesAndScripts(html,root);
  assert.notEqual(first,second);
  assert.equal(first.match(/styles.css[^"]*/)[0],second.match(/styles.css[^"]*/)[0]);
});
