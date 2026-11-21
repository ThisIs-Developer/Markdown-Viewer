import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as Y from 'yjs';

const source = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const start = source.indexOf('  function handleLiveRoomMessage(');
assert.ok(start >= 0);
const handler = source.slice(start, source.indexOf('\n  }', start) + 4);

for (const type of ['y-update', 'sync-state']) {
  for (const outcome of ['active', 'ended', 'replaced']) {
    test(`${type} safely handles a session ${outcome} by a Yjs observer`, () => {
      const remote = new Y.Doc();
      const local = new Y.Doc();
      const warnings = [];
      const synced = [];
      const session = {
        roomId: 'room', localParticipantId: 'guest', Y, ydoc: local,
        yText: local.getText('markdown'), sessionMap: local.getMap('session')
      };
      const target = {
        liveCollaboration: session,
        LIVE_SHARE_ACCESS_VIEW: 'view', LIVE_RELAY_ORIGIN: 'relay',
        getCurrentLiveAccessMode: () => 'edit', decodeLiveBytes: bytes => bytes,
        markLiveJoinSynced: content => synced.push(content),
        console: { warn: (...args) => warnings.push(args) }
      };
      vm.createContext(target);
      vm.runInContext(handler, target);
      local.getMap('session').observe(() => {
        if (outcome !== 'active') {
          target.liveCollaboration = outcome === 'ended' ? null : {
            ...session, yText: { toString: () => 'Unrelated new session' }
          };
        }
      });
      remote.transact(() => {
        remote.getText('markdown').insert(0, 'Shared content');
        remote.getMap('session').set('endedAt', 1);
      });
      try {
        target.handleLiveRoomMessage({
          type, roomId: 'room', sender: 'host', update: Y.encodeStateAsUpdate(remote)
        }, {});
        assert.deepEqual(warnings, []);
        assert.equal(local.getText('markdown').toString(), 'Shared content');
        assert.deepEqual(synced, outcome === 'active' ? ['Shared content'] : []);
      } finally {
        remote.destroy();
        local.destroy();
      }
    });
  }
}
