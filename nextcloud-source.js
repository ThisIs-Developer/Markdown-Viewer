// Nextcloud authentication and legacy protocol facade over the shared WebDAV client.
(function(target) {
  'use strict';
  const protocol=target.MarkdownWebDAV;
  const {serverUrl,sameServer,documentUrl,parseListing,parseFileEtag,strongEtag,digest,checked,fail,MAX_BYTES}=protocol;
  class Client extends protocol.Client {
    constructor(server,request,auth,userId) {
      const base=serverUrl(server);
      super(base+'/',request,auth);this.server=base;this.userId=userId || '';
      this.root=userId?base+'/remote.php/dav/files/'+encodeURIComponent(userId)+'/':'';
    }
    scope(url) {
      if(url===this.server+'/ocs/v2.php/cloud/user?format=json')return url;
      return documentUrl(url,this.root);
    }
    async remember(store) {
      const id=await digest(JSON.stringify([this.server,this.userId]));
      return this.rememberAccount({id,server:this.server,userId:this.userId},store);
    }
    async identify() {
      const response=checked(await this.call(this.server+'/ocs/v2.php/cloud/user?format=json','GET',{
        headers:{'OCS-APIRequest':'true',Accept:'application/json'},maxBytes:256*1024
      }),[200]);
      const id=JSON.parse(response.body).ocs?.data?.id;
      if(typeof id!=='string' || !id || id==='.' || id==='..' || /[\\/\u0000-\u001f]/.test(id))throw fail('Cannot determine the Nextcloud user ID.','ACCOUNT');
      this.userId=id;this.root=this.server+'/remote.php/dav/files/'+encodeURIComponent(id)+'/';return this;
    }
  }
  async function login(server, request, openBrowser, signal) {
    const base = serverUrl(server);
    const initial = checked(await request({ url: base + '/index.php/login/v2', method: 'POST', maxBytes: 256 * 1024 }), [200]);
    const flow = JSON.parse(initial.body);
    const endpoint = sameServer(flow.poll?.endpoint, base);
    const loginUrl = sameServer(flow.login, base);
    if (!flow.poll?.token || typeof flow.poll.token !== 'string') throw fail('Invalid Nextcloud login response.', 'LOGIN');
    if (signal?.aborted) throw fail('Connection cancelled.', 'CANCELLED');
    await openBrowser(loginUrl);
    const deadline = Date.now() + 20 * 60 * 1000;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw fail('Connection cancelled.', 'CANCELLED');
      const res = await request({ url: endpoint, method: 'POST', contentType: 'application/x-www-form-urlencoded',
        body: new URLSearchParams({ token: flow.poll.token }).toString(), maxBytes: 256 * 1024 });
      if (res.status !== 404) {
        checked(res, [200]);
        const account = JSON.parse(res.body);
        if (signal?.aborted) throw fail('Connection cancelled.', 'CANCELLED');
        if (serverUrl(account.server) !== base || typeof account.loginName !== 'string' || !account.loginName ||
            typeof account.appPassword !== 'string' || !account.appPassword) throw fail('Unexpected account returned by Nextcloud.', 'LOGIN');
        return new Client(base, request, { username: account.loginName, password: account.appPassword }).identify();
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw fail('Login timed out. Connect again.', 'LOGIN');
  }
  target.MarkdownNextcloud=Object.freeze({Client,login,serverUrl,documentUrl,parseListing,parseFileEtag,strongEtag,digest,MAX_BYTES});
})(globalThis);
