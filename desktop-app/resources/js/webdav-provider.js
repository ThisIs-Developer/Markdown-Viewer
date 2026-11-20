// Generic WebDAV account adapter. No Nextcloud endpoints or browser login are used.
(function(target) {
  'use strict';
  const protocol=target.MarkdownWebDAV, model=target.MarkdownCloudModel, id='webdav';
  function identity(root,username) {
    root=protocol.rootUrl(root);
    if(typeof username!=='string' || !username || username.includes(':') || /[\u0000-\u001f\u007f]/.test(username) || new TextEncoder().encode(username).byteLength>512)throw new Error('Enter a valid WebDAV username.');
    return {root,username};
  }
  const key=account=>JSON.stringify([id,account.root,account.username]);
  const accountId=async account=>'webdav-'+await model.digest(key(account));
  function label(value){value=String(value || '').trim();if(value.length>80 || /[\u0000-\u001f\u007f]/.test(value))throw new Error('Use a connection name of up to 80 characters.');return value;}
  function normalizeSource(source) {
    if(source.providerId!==id || (source.provider && source.provider!==id))throw new Error('Invalid WebDAV source.');
    const account=identity(source.account?.root,source.account?.username);
    const fileRef=protocol.documentUrl(source.fileRef,account.root);
    const version=source.version ?? '';
    if(typeof version!=='string')throw new Error('Invalid WebDAV version token.');
    return {...source,providerId:id,sourceVersion:2,account,accountKey:key(account),fileRef,version};
  }
  function recoveryIdentity(source) {
    const value=normalizeSource(source),root=new URL(value.account.root),file=new URL(value.fileRef);
    const parts=file.pathname.slice(root.pathname.length).split('/').map(part=>decodeURIComponent(part));
    if(parts.some(part=>!part || part==='.' || part==='..' || /[\\/\u0000-\u001f]/.test(part)))throw new Error('Invalid WebDAV recovery hierarchy.');
    return {accountName:'WebDAV - '+root.host+' - '+value.account.username,accountIdentity:key(value.account),folders:parts.slice(0,-1)};
  }
  function wrap(raw,account,knownId,connectionLabel) {
    const display=connectionLabel || new URL(account.root).host;
    const readOnlyReason=source=>protocol.strongEtag(source.version)?'':'This WebDAV file has no usable server version. It remains read-only; your local draft is kept. Use Check server version to check again.';
    return Object.freeze({providerId:id,root:account.root,
      account:Object.freeze({id:knownId,key:key(account),identity:account,label:display,detail:'WebDAV · '+account.username,userLabel:account.username}),
      capabilities:Object.freeze({read:true,list:true,create:true,createFolder:true,conditionalSave:true,delete:true}),
      identify:()=>raw.identify(),disconnect:()=>raw.disconnect(),accountId:()=>knownId,
      remember:store=>raw.rememberAccount({providerId:id,id:knownId,root:account.root,username:account.username,label:connectionLabel},store),
      list:async ref=>(await raw.list(ref)).map(entry=>({ref:entry.href,name:entry.name,directory:entry.directory,version:entry.etag})),
      read:async ref=>{const result=await raw.read(ref);return {content:result.content,version:result.etag};},readVersion:ref=>raw.fileEtag(ref),
      save:async(ref,version,content)=>{const result=await raw.save(ref,version,content);return {content:result.content,version:result.etag};},
      createFolder:ref=>raw.createFolder(ref),
      create:async(ref,content)=>{const result=await raw.create(ref,content);return {content:result.content,version:result.etag};},remove:(ref,version)=>raw.remove(ref,version),
      isVersion:protocol.strongEtag,readOnlyReason,validateRef:ref=>protocol.documentUrl(ref,account.root),validateFile:ref=>raw.markdownFile(ref),
      folderRef:ref=>protocol.documentUrl(ref.replace(/\/?$/,'/'),account.root),parentRef:ref=>protocol.documentUrl(new URL('./',ref).href,account.root),
      upRef:ref=>protocol.documentUrl(new URL('../',ref).href,account.root),childRef:(ref,name)=>protocol.documentUrl(ref.replace(/\/?$/,'/')+encodeURIComponent(name),account.root),
      locationLabel:ref=>decodeURIComponent(new URL(ref).pathname.slice(new URL(account.root).pathname.length)) || 'Files',fileName:ref=>decodeURIComponent(new URL(ref).pathname.split('/').pop()),
      source:(fileRef,version='',fields={})=>normalizeSource({...fields,providerId:id,accountId:knownId,account,fileRef,version,connectionLabel})
    });
  }
  function createRaw(account,platform,auth){return new protocol.Client(account.root,request=>platform.request({...request,providerId:id,root:account.root}),auth);}
  target.MarkdownCloudProviders.register({id,label:'WebDAV',
    connectionFields:Object.freeze([
      {id:'label',label:'Connection name (optional)',required:false,placeholder:'Personal NAS',maxLength:80},
      {id:'root',label:'WebDAV folder URL',type:'url',placeholder:'https://server.example/dav/documents/',autocomplete:'url'},
      {id:'username',label:'Username',autocomplete:'username',maxLength:512},
      {id:'password',label:'Password or app password',type:'password',autocomplete:'current-password'}
    ]),connectionNote:'Connect directly to the folder URL using your WebDAV username and password. HTTPS is required.',connectingMessage:'Connecting to WebDAV…',
    normalizeSource,serializeSource:normalizeSource,recoveryIdentity,
    describeSource(source){const value=normalizeSource(source);return (value.connectionLabel || new URL(value.account.root).host)+' (WebDAV · '+value.account.username+')';},
    async connect(values,platform,_openBrowser,signal){
      if(platform.connectProvider){
        const record=await platform.connectProvider(id,values,_openBrowser,signal);
        const client=await target.MarkdownCloudProviders.get(id).restore(record,platform);
        return Object.freeze({...client,remember:store=>store(record)});
      }
      const account=identity(values.root,values.username),connectionLabel=label(values.label);
      if(typeof values.password!=='string' || !values.password || /[\u0000-\u001f\u007f]/.test(values.password) || new TextEncoder().encode(values.password).byteLength>4096)throw new Error('Enter a valid WebDAV password or app password.');
      const raw=createRaw(account,platform,{username:account.username,password:values.password});
      try {
        if(signal?.aborted)throw new Error('Connection cancelled.');
        await raw.identify();
        if(signal?.aborted)throw new Error('Connection cancelled.');
        return wrap(raw,account,await accountId(account),connectionLabel);
      } catch(error){raw.disconnect();if(error.httpStatus===401)throw Object.assign(new Error('WebDAV sign-in was not accepted. Check your username/app password; this connection supports Basic authentication over HTTPS.'),{code:'AUTH',httpStatus:401});throw error;}
    },
    async restore(record,platform){
      const account=identity(record.root,record.username),connectionLabel=label(record.label);
      if(record.providerId!==id || record.id!==await accountId(account))throw new Error('Invalid remembered WebDAV identity.');
      return wrap(createRaw(account,platform,{credentialId:record.id}),account,record.id,connectionLabel);
    }
  });
})(globalThis);
