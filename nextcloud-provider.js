(function(target) {
  'use strict';
  const protocol=target.MarkdownNextcloud, model=target.MarkdownCloudModel;
  const id='nextcloud';
  function identity(server,userId) {
    server=protocol.serverUrl(server);
    if(typeof userId!=='string' || !userId || userId==='.' || userId==='..' || /[\\/\u0000-\u001f]/.test(userId))throw new Error('Invalid cloud account identity.');
    return {server,userId};
  }
  const key=account=>JSON.stringify([id,account.server,account.userId]);
  async function accountId(account){return model.digest(JSON.stringify([account.server,account.userId]));}
  function normalizeSource(source,canonical=false) {
    if((source.providerId || source.provider)!==id)throw new Error('Invalid Nextcloud source.');
    const account=identity(source.account?.server || source.server,source.account?.userId || source.userId);
    const fileRef=protocol.documentUrl(source.fileRef || source.href,account.server+'/remote.php/dav/files/'+encodeURIComponent(account.userId)+'/');
    const version=source.version!==undefined?source.version:(source.etag || '');
    if(typeof version!=='string')throw new Error('Invalid Nextcloud version token. The draft was kept.');
    if(!canonical && ((source.server && source.server!==account.server) || (source.userId && source.userId!==account.userId) || (source.href && source.href!==fileRef) || (source.version!==undefined && source.etag!==undefined && source.version!==source.etag)))throw new Error('Cloud source aliases disagree. The draft was kept.');
    return {...source,provider:id,providerId:id,sourceVersion:2,account,accountKey:key(account),fileRef,version,server:account.server,userId:account.userId,href:fileRef,etag:version};
  }
  function recoveryIdentity(source) {
    const normalized=normalizeSource(source);
    const root=normalized.account.server+'/remote.php/dav/files/'+encodeURIComponent(normalized.account.userId)+'/';
    const parts=new URL(normalized.fileRef).pathname.slice(new URL(root).pathname.length).split('/').map(part=>decodeURIComponent(part));
    if(!parts.length || parts.some(part=>!part || part==='.' || part==='..' || /[\\/\u0000-\u001f]/.test(part)))throw new Error('Invalid cloud recovery path.');
    return {accountName:new URL(normalized.account.server).host+' - '+normalized.account.userId,accountIdentity:JSON.stringify([normalized.account.server,normalized.account.userId]),folders:parts.slice(0,-1)};
  }
  function wrap(raw,knownId) {
    const accountIdentity=identity(raw.server,raw.userId);
    const account=Object.freeze({id:knownId,providerId:id,identity:accountIdentity,key:key(accountIdentity),label:new URL(raw.server).host,detail:'Nextcloud · '+raw.userId,userLabel:raw.userId});
    const transportResult=result=>({content:result.content,version:result.etag});
    const client={providerId:id,account,root:raw.root,
      capabilities:Object.freeze({read:true,list:true,create:true,createFolder:true,conditionalSave:true,delete:true}),
      async identify(){await raw.identify();if(raw.userId!==accountIdentity.userId)throw new Error('The account identity changed. Connect again.');return client;},
      async remember(store){return raw.remember(record=>store({...record,providerId:id}));},
      disconnect:()=>raw.disconnect(),
      list:async ref=>(await raw.list(ref)).map(entry=>({ref:entry.href,name:entry.name,directory:entry.directory,version:entry.etag})),
      read:async ref=>transportResult(await raw.read(ref)),
      readVersion:ref=>raw.fileEtag(ref),
      save:async(ref,version,content)=>transportResult(await raw.save(ref,version,content)),
      createFolder:ref=>raw.createFolder(ref),
      create:async(ref,content)=>transportResult(await raw.create(ref,content)),remove:(ref,version)=>raw.remove(ref,version),
      isVersion:protocol.strongEtag,
      validateRef:ref=>protocol.documentUrl(ref,raw.root),
      validateFile:ref=>raw.markdownFile(ref),
      folderRef:ref=>protocol.documentUrl(ref.replace(/\/?$/,'/'),raw.root),
      parentRef:ref=>protocol.documentUrl(new URL('./',ref).href,raw.root),
      upRef:ref=>protocol.documentUrl(new URL('../',ref.replace(/\/?$/,'/')).href,raw.root),
      childRef:(ref,name)=>protocol.documentUrl(ref.replace(/\/?$/,'/')+encodeURIComponent(name),raw.root),
      locationLabel:ref=>decodeURIComponent(new URL(ref).pathname.slice(new URL(raw.root).pathname.length)) || 'Files',
      fileName:ref=>decodeURIComponent(new URL(ref).pathname.split('/').pop()),
      source(ref,version,fields={}){return normalizeSource({...fields,providerId:id,account:accountIdentity,accountId:knownId,fileRef:ref,version},true);},
      accountId:()=>knownId || accountId(accountIdentity)
    };
    return Object.freeze(client);
  }
  target.MarkdownCloudProviders.register({
    id,label:'Nextcloud',legacyAccounts:true,
    connectionFields:Object.freeze([{id:'server',legacyId:'nextcloud-server',label:'Nextcloud server',type:'url',placeholder:'https://cloud.example.com',autocomplete:'url'}]),
    connectionNote:'Login opens in your browser.',
    normalizeSource,serializeSource:source=>normalizeSource(source,true),recoveryIdentity,
    describeSource(source){const value=normalizeSource(source);return new URL(value.account.server).host+' ('+value.account.userId+')';},
    async connect(values,platform,openBrowser,signal){
      if(platform.connectProvider){
        const record=await platform.connectProvider(id,values,openBrowser,signal);
        const client=await target.MarkdownCloudProviders.get(id).restore(record,platform);
        return Object.freeze({...client,remember:store=>store(record)});
      }
      const raw=await protocol.login(values.server,request=>platform.request({...request,providerId:id}),openBrowser,signal);
      return wrap(raw,await accountId(identity(raw.server,raw.userId)));
    },
    async restore(record,platform){
      const account=identity(record.server,record.userId);
      if(!model.isAccountId(record.id) || record.id!==await accountId(account))throw new Error('Invalid remembered Nextcloud identity.');
      return wrap(new protocol.Client(account.server,request=>platform.request({...request,providerId:id}),{credentialId:record.id},account.userId),record.id);
    }
  });
})(globalThis);
