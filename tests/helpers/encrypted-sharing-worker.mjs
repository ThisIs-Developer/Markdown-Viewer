// Local synthetic integration harness only; this is not a deployment entry point.
import liveWorker, { LiveRoom } from '../../workers/live-room-worker.js';
import { onRequest as share } from '../../functions/api/share/[[id]].js';
import { onRequest as media } from '../../functions/api/image/[[id]].js';

export class TestLiveRoom extends LiveRoom {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/__test/inspect') return Response.json(await this.state.storage.get('live-room-auth-v2') || null);
    if (url.pathname === '/__test/alarm') return Response.json(await this.state.storage.getAlarm());
    if (url.pathname === '/__test/expire') { await super.alarm(); return Response.json({ expired: true }); }
    if (url.pathname === '/__test/legacy') {
      await this.state.storage.put('live-room-auth-v1', await request.json());
      return Response.json({ seeded: true });
    }
    return super.fetch(request);
  }
}
export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const match = /^\/api\/(share|image|media)(?:\/([^/]+))?$/.exec(url.pathname);
    if (match) return (match[1] === 'share' ? share : media)({ request, env, params: { id: match[2] || '' } });
    return liveWorker.fetch(request, env);
  }
};
