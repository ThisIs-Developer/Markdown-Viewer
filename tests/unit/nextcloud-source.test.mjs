import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
const context = vm.createContext({ URL, URLSearchParams, TextEncoder, crypto: webcrypto, setTimeout });
vm.runInContext(fs.readFileSync(new URL('../../webdav-source.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('../../nextcloud-source.js', import.meta.url), 'utf8'), context);
const { Client, login, serverUrl, documentUrl, digest } = context.MarkdownNextcloud;
const base = 'https://cloud.example/nextcloud';
const root = base + '/remote.php/dav/files/alice/';
const file = root + 'notes.md';

test('arbitrary HTTPS servers and subdirectory installs; unsafe URLs rejected', () => {
  assert.equal(serverUrl(base + '/'), base);
  for (const input of ['http://cloud.example', 'https://user:secret@cloud.example', 'https://cloud.example/?token=x', 'https://cloud.example/#x', 'file:///tmp']) {
    assert.throws(() => serverUrl(input));
  }
});
test('remote identity cannot escape the authenticated account or forward credentials', async () => {
  let calls = 0;
  const client = new Client(base, async () => { calls++; }, { username: 'alice', password: 'secret' }, 'alice');
  for (const input of ['https://evil.example/notes.md', root + '../bob/notes.md', root + 'a%2Fb.md', root + 'x.md?token=secret']) {
    await assert.rejects(client.read(input));
  }
  assert.equal(calls, 0);
  assert.equal(documentUrl(file, root), file);
});
test('conditional Save protects competing edits with the original ETag', async () => {
  const requests = [];
  const client = new Client(base, async request => { requests.push(request); return { status: 412 }; }, {}, 'alice');
  await assert.rejects(client.save(file, '"version-1"', '# draft'), error => error.code === 'CONFLICT');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].headers['If-Match'], '"version-1"');
});
test('no ETag or weak ETag prevents PUT entirely', async () => {
  let calls = 0;
  const client = new Client(base, async () => { calls++; }, {}, 'alice');
  for (const etag of ['', 'W/"v1"', '*', '"v1"\r\nInjected: yes']) {
    await assert.rejects(client.save(file, etag, '# draft'), error => error.code === 'ETAG');
  }
  assert.equal(calls, 0);
});
test('successful PUT is verified by reading its exact body and fresh ETag', async () => {
  const requests = [];
  const client = new Client(base, async request => {
    requests.push(request);
    return request.method === 'PUT' ? { status: 204 } : { status: 200, body: '# Ελληνικά', headers: { ETag: '"v2"' } };
  }, {}, 'alice');
  assert.equal((await client.save(file, '"v1"', '# Ελληνικά')).etag, '"v2"');
  assert.deepEqual(requests.map(request => request.method), ['PUT', 'GET']);
});
test('lost upload response is uncertain and is never automatically retried', async () => {
  let calls = 0;
  const client = new Client(base, async () => { calls++; throw new Error('socket lost'); }, {}, 'alice');
  await assert.rejects(client.save(file, '"v1"', '# draft'), error => error.code === 'UNCERTAIN');
  assert.equal(calls, 1);
});
test('native multimap header representation retains the ETag', async () => {
  const client = new Client(base, async () => ({ status: 200, body: '# Native', headers: [['ETag', '"native-v1"']] }), {}, 'alice');
  assert.equal((await client.read(file)).etag, '"native-v1"');
});
test('verification mismatch, missing ETag and server errors never announce success', async () => {
  for (const verify of [{ status: 200, body: '# someone else', headers: { etag: '"v3"' } }, { status: 200, body: '# draft', headers: {} }, { status: 500 }]) {
    const client = new Client(base, async request => request.method === 'PUT' ? { status: 204 } : verify, {}, 'alice');
    await assert.rejects(client.save(file, '"v1"', '# draft'), error => error.code === 'UNCERTAIN');
  }
});
test('login rejects off-origin poll endpoints before opening browser or sending token', async () => {
  let requests = 0;
  let opens = 0;
  await assert.rejects(login(base, async () => {
    requests++;
    return { status: 200, body: JSON.stringify({ poll: { token: 'secret', endpoint: 'https://evil.example/poll' }, login: base + '/login' }) };
  }, async () => { opens++; }));
  assert.equal(requests, 1);
  assert.equal(opens, 0);
});
test('login flow resolves canonical user ID and keeps credentials out of serialized client', async () => {
  const requests = [];
  const client = await login(base, async request => {
    requests.push(request);
    if (request.url.endsWith('/login/v2')) return { status: 200, body: JSON.stringify({ poll: { token: 'poll-secret', endpoint: base + '/poll' }, login: base + '/login' }) };
    if (request.url.endsWith('/poll')) return { status: 200, body: JSON.stringify({ server: base, loginName: 'alice@example.com', appPassword: 'app-secret' }) };
    return { status: 200, body: JSON.stringify({ ocs: { data: { id: 'alice' } } }) };
  }, async () => {});
  assert.equal(client.userId, 'alice');
  assert.equal(client.root, root);
  assert.equal(JSON.stringify(client).includes('app-secret'), false);
  assert.equal(requests[2].auth.username, 'alice@example.com');
});
test('content bound is enforced before any upload; digest is stable', async () => {
  let calls = 0;
  const client = new Client(base, async () => { calls++; }, {}, 'alice');
  await assert.rejects(client.save(file, '"v1"', 'x'.repeat(20 * 1024 * 1024 + 1)), error => error.code === 'SIZE');
  assert.equal(calls, 0);
  assert.equal((await digest('# test')).length, 64);
});
test('remember replaces JS credentials with an opaque native handle', async () => {
  const requests = [];
  const client = new Client(base, async request => { requests.push(request); return { status: 200, body: '# body', headers: { etag: '"v1"' } }; }, { username: 'alice@example.com', password: 'private-app-password' }, 'alice');
  let received;
  const account = await client.remember(async data => { received = data; return { id: data.id, server: data.server, userId: data.userId }; });
  assert.equal(received.appPassword, 'private-app-password');
  assert.equal(account.id.length, 64);
  await client.read(file);
  assert.equal(requests[0].auth.credentialId, account.id);
  assert.equal(requests[0].auth.password, undefined);
  assert.equal(JSON.stringify(client).includes('private-app-password'), false);
});

test('create uses If-None-Match and verifies the exact new Markdown body',async()=>{
  const calls=[];const client=new Client(base,async request=>{calls.push(request);return request.method==='PUT'?{status:201}:{status:200,body:'# new',headers:{ETag:'"created"'}};},{},'alice');
  assert.equal((await client.create(file,'# new')).etag,'"created"');
  assert.equal(calls[0].headers['If-None-Match'],'*');assert.equal(calls[0].headers['If-Match'],undefined);
});
test('create refuses an occupied name without retrying or overwriting',async()=>{
  const calls=[];const client=new Client(base,async request=>{calls.push(request);return {status:412};},{},'alice');
  await assert.rejects(client.create(file,''),{code:'CONFLICT'});assert.equal(calls.length,1);
});
test('creation and deletion accept only .md files inside the account',async()=>{
  let calls=0;const client=new Client(base,async()=>{calls++;},{},'alice');
  for(const href of [root,root+'folder/',root+'notes.txt',root+'notes.md/',root+'a%2Fb.md','https://evil.example/a.md']){
    await assert.rejects(client.create(href,''));await assert.rejects(client.remove(href,'"v1"'));
  }
  assert.equal(calls,0);
});
test('delete checks the pinned file version and verifies absence without retrying',async()=>{
  const calls=[];const client=new Client(base,async request=>{calls.push(request);return {status:204};},{},'alice');
  let metadataReads=0;client.fileEtag=async()=>{if(++metadataReads===1)return '"v1"';throw Object.assign(Error('missing'),{httpStatus:404});};
  await client.remove(file,'"v1"');assert.equal(calls.length,1);assert.equal(calls[0].method,'DELETE');assert.equal(calls[0].headers['If-Match'],'"v1"');
});
test('delete stops before HTTP if file version changed or no strong ETag exists',async()=>{
  let calls=0;const client=new Client(base,async()=>{calls++;},{},'alice');client.fileEtag=async()=> '"v2"';
  await assert.rejects(client.remove(file,'"v1"'),{code:'CONFLICT'});
  await assert.rejects(client.remove(file,'W/"v2"'),{code:'ETAG'});assert.equal(calls,0);
});
test('lost delete acknowledgement remains uncertain and is not retried',async()=>{
  let calls=0;const client=new Client(base,async()=>{calls++;throw Error('lost response');},{},'alice');client.fileEtag=async()=> '"v1"';
  await assert.rejects(client.remove(file,'"v1"'),{code:'UNCERTAIN'});assert.equal(calls,1);
});
