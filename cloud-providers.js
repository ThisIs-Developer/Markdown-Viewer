(function(target) {
  'use strict';
  // Only application-registered providers confer remote authority. Workspace or
  // backup metadata cannot register code or enable an unknown provider.
  const providers=new Map();
  function get(id) {
    const provider=providers.get(id);
    if(!provider)throw new Error('This cloud provider is unavailable. The local draft remains available.');
    return provider;
  }
  function forSource(source) {
    if(!source || (source.providerId && source.provider && source.providerId!==source.provider))throw new Error('Invalid cloud provider identity.');
    return get(source.providerId || source.provider);
  }
  function normalizeSource(source) { return forSource(source).normalizeSource(source); }
  function sameFile(a,b) {
    try {const x=normalizeSource(a),y=normalizeSource(b);return x.providerId===y.providerId && x.accountKey===y.accountKey && x.fileRef===y.fileRef;}catch(_){return false;}
  }
  function accountProvider(account) {
    if(!account || (account.providerId && account.provider && account.providerId!==account.provider))throw new Error('Invalid cloud account provider.');
    if(account.providerId || account.provider)return get(account.providerId || account.provider);
    const legacy=[...providers.values()].filter(provider=>provider.legacyAccounts);
    if(legacy.length!==1)throw new Error('Unknown legacy cloud account.');
    return legacy[0];
  }
  target.MarkdownCloudProviders=Object.freeze({
    register(provider) {
      if(!provider || !/^[a-z][a-z0-9-]{0,63}$/.test(provider.id) || providers.has(provider.id))throw new Error('Invalid or duplicate cloud provider.');
      for(const method of ['normalizeSource','serializeSource','recoveryIdentity','restore','connect'])if(typeof provider[method]!=='function')throw new Error('Incomplete cloud provider contract.');
      providers.set(provider.id,Object.freeze(provider));
    },
    list:()=>[...providers.values()],get,forSource,accountProvider,normalizeSource,sameFile,
    serializeSource:source=>forSource(source).serializeSource(source),
    sessionKey:source=>normalizeSource(source).accountKey,
    recoveryIdentity:source=>forSource(source).recoveryIdentity(source),
    describe(source){try{return forSource(source).describeSource(source);}catch(_){return 'Unavailable cloud provider';}}
  });
})(globalThis);
