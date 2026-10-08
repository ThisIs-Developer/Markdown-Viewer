// In-memory Neutralino filesystem for testing the real desktop storage backend.
function installDesktopFilesystem(target) {
  const files = new Map();
  const directories = new Set(['C:', 'C:/Documents']);
  const normalize = value => String(value).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  const join = (...parts) => normalize(parts.filter(Boolean).join('/'));
  const storageData = new Map();
  target.__desktopFiles = files;
  target.NL_PORT = 1;
  target.Neutralino = {
    os: { getPath: async () => 'C:/Documents', open: async () => true },
    events: { on: async () => true },
    storage: {
      getData: async key => {
        if (!storageData.has(key)) throw new Error('missing');
        return storageData.get(key);
      },
      setData: async (key, value) => storageData.set(key, value),
      removeData: async key => storageData.delete(key)
    },
    filesystem: {
      getJoinedPath: async (...parts) => join(...parts),
      getStats: async path => {
        path = normalize(path);
        if (directories.has(path)) return { isDirectory: true, size: 0, modifiedAt: Date.now() };
        if (files.has(path)) return { isDirectory: false, size: files.get(path).length, modifiedAt: Date.now() };
        throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' });
      },
      createDirectory: async path => directories.add(normalize(path)),
      readFile: async path => {
        path = normalize(path);
        if (!files.has(path)) throw new Error('missing');
        return files.get(path);
      },
      writeFile: async (path, value) => files.set(normalize(path), String(value)),
      copy: async (source, destination) => files.set(normalize(destination), files.get(normalize(source))),
      move: async (source, destination) => {
        source = normalize(source);
        destination = normalize(destination);
        if (!files.has(source)) throw new Error('missing');
        files.set(destination, files.get(source));
        files.delete(source);
      },
      remove: async path => {
        path = normalize(path);
        files.delete(path);
        directories.delete(path);
      },
      readDirectory: async path => {
        const prefix = normalize(path) + '/';
        const entries = new Map();
        directories.forEach(candidate => {
          if (!candidate.startsWith(prefix)) return;
          const rest = candidate.slice(prefix.length);
          if (rest && !rest.includes('/')) entries.set(rest, { entry: rest, type: 'DIRECTORY' });
        });
        files.forEach((_, candidate) => {
          if (!candidate.startsWith(prefix)) return;
          const rest = candidate.slice(prefix.length);
          if (rest && !rest.includes('/')) entries.set(rest, { entry: rest, type: 'FILE' });
        });
        return Array.from(entries.values());
      },
      createWatcher: async () => 1,
      removeWatcher: async () => true
    }
  };
}

module.exports = { installDesktopFilesystem };
