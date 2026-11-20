// Also injected into D2's nested worker before the bundled Go runtime starts.
// Keep this function self-contained: the build serializes its source verbatim.
export function lockNetwork(allowWorkers = false) {
  const denied = () => { throw new Error('External resources are disabled in encrypted shares.'); };
  const replacements = {
    fetch: async () => denied(), XMLHttpRequest: denied, WebSocket: denied,
    EventSource: denied, WebTransport: denied, importScripts: denied
  };
  if (!allowWorkers) replacements.Worker = denied;
  for (const [name, value] of Object.entries(replacements)) {
    Object.defineProperty(globalThis, name, { value, writable: false, configurable: false });
  }
}
