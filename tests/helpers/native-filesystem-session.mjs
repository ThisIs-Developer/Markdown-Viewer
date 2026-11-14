import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Isolated headless runtime: no user profile, single-instance forwarding or UI.
export async function nativeFilesystemSession(binary, additionalMethods = [], options = {}) {
  const parent = await fs.mkdtemp(path.resolve('desktop-app/dist/native-fs-test-'));
  const root = options.profileName ? path.join(parent, options.profileName) : parent;
  if (root !== parent) { if (path.dirname(root) !== parent) throw new Error('Test profile must remain inside its temporary root'); await fs.mkdir(root); }
  await fs.writeFile(path.join(root, 'neutralino.config.json'), JSON.stringify({
    applicationId: options.singleInstance ? 'com.markdownviewer.singleinstancetest.' + Date.now() : 'com.markdownviewer.filesystemtest', version: '0.0.0',
    defaultMode: 'cloud', singleInstance: options.singleInstance === true, port: 0,
    enableServer: true, enableNativeAPI: true, tokenSecurity: 'one-time',
    dataLocation: 'app', storageLocation: 'app', documentRoot: '/', url: '/',
    enableExtensions: Boolean(options.extensions), extensions: options.extensions || [],
    ...(options.commandAllowList ? { commandAllowList: options.commandAllowList } : {}),
    logging: { enabled: false }, nativeAllowList: ['filesystem.*', 'app.exit', ...additionalMethods],
    modes: { cloud: { nativeAllowList: ['filesystem.*', 'app.exit', ...additionalMethods] } }
  }));
  const process = spawn(path.resolve(binary), ['--path=' + root, '--export-auth-info'], {
    cwd: root, windowsHide: true, stdio: 'ignore'
  });
  let socket;
  const pending = new Map();
  const events = [];
  const eventListeners = new Set();
  let sequence = 0;
  async function close() {
    socket?.close();
    process.kill();
    // Leave the disposable files for diagnosis; never delete a user's directory.
  }
  try {
    let auth;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { auth = JSON.parse(await fs.readFile(path.join(root, '.tmp/auth_info.json'), 'utf8')); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    if (!auth) throw new Error('Isolated runtime did not export auth information');
    socket = new WebSocket(`ws://127.0.0.1:${auth.nlPort}?connectToken=${auth.nlConnectToken}`);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.event) { events.push(message); for (const listener of eventListeners) listener(message); }
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.data?.error) request.reject(message.data.error);
      else request.resolve(message.data?.returnValue);
    });
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
      setTimeout(() => reject(new Error('Native socket connection timed out')), 5000).unref();
    });
    function call(method, data) {
      return new Promise((resolve, reject) => {
        const id = String(++sequence);
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Native call timed out')); }, 5000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, data, accessToken: auth.nlToken }));
      });
    }
    return { root, call, close, events, auth, onEvent(listener) { eventListeners.add(listener); return () => eventListeners.delete(listener); } };
  } catch (error) { await close(); throw error; }
}
