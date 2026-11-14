// Installed only by the optional self-hosted server. Stock web and desktop never load this adapter.
(function(target){
  'use strict';
  if(target.NL_OS || !target.MarkdownCloudConnector)return;
  const config=target.MarkdownCloudConnector,listeners=new Set();let enabled=false;
  const identityUI=target.MarkdownCloudIdentity;
  let authentication;
  function secureContext(){if(location.protocol!=='https:' && !(config.development && ['localhost','127.0.0.1'].includes(location.hostname)))throw new Error('Cloud connections require HTTPS. Your local documents remain available.');}
  async function login(values){secureContext();const response=await fetch('/api/cloud/login',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','X-MV-Connector':'1'},body:JSON.stringify(values)});const value=await response.json();if(!response.ok)throw Error(value.error?.message || 'Sign in failed.');return value;}
  const disconnected=()=>{config.csrf='';for(const listener of listeners)listener();};
  async function session(){const response=await fetch('/api/cloud/session',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','X-MV-Connector':'1'},body:'{}'});if(response.status===401)return false;const result=await response.json();if(!response.ok)throw new Error(result.error?.message || 'Cloud access is unavailable.');identityUI?.check(result.result.identity);config.csrf=result.result.csrf;return true;}
  async function authenticate(interactive=true){
    secureContext();
    if(config.csrf)return true;
    if(authentication)return interactive?authentication:false;
    identityUI?.assert();
    if(await session())return true;if(!interactive)return false;
    if(config.mode==='multi-user'){
      if(config.identity?.kind==='profile'){void identityUI.changed();throw Error('Profile session expired. Reload and sign in again; drafts were kept.');}
      const response=await fetch('/api/cloud/guest',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','X-MV-Connector':'1'},body:'{}'}),value=await response.json();
      if(!response.ok)throw Error(value.error?.message || 'Temporary access is unavailable.');identityUI.check(value.result.identity);config.csrf=value.result.csrf;return true;
    }
    authentication=new Promise((resolve,reject)=>{
      const dialog=document.createElement('dialog');dialog.className='reset-modal-box app-modal-box';dialog.style.cssText='position:fixed;inset:0;margin:auto;max-width:440px;width:calc(100% - 32px);max-height:calc(100dvh - 32px);overflow:auto;border:1px solid var(--border-color);border-radius:12px;padding:20px';
      const colors=getComputedStyle(document.body);dialog.style.background=colors.backgroundColor;dialog.style.color=colors.color;
      const form=document.createElement('form'),title=document.createElement('h2'),note=document.createElement('p'),label=document.createElement('label'),input=document.createElement('input'),error=document.createElement('p'),submit=document.createElement('button'),cancel=document.createElement('button');
      title.style.cssText='font-size:var(--ui-font-lg,18px);font-weight:600;margin:0 0 12px';title.textContent='Unlock cloud connections';title.id='cloud-unlock-title';dialog.setAttribute('aria-labelledby',title.id);
      note.textContent='Enter the cloud access password configured for this personal server. Your Nextcloud sign-in is separate.';note.className='nextcloud-note';note.style.marginBottom='12px';
      label.textContent='Cloud access password';input.type='password';input.autocomplete='current-password';input.required=true;input.id='cloud-access-password';input.className='form-control';input.style.cssText='width:100%;margin:6px 0 12px;padding:9px;color:var(--text-color);background:var(--editor-bg);border:1px solid var(--border-color);border-radius:6px;font:inherit';label.htmlFor=input.id;error.setAttribute('role','status');
      submit.type='submit';submit.className='nextcloud-button nextcloud-primary';submit.textContent='Unlock';cancel.type='button';cancel.className='nextcloud-button';cancel.textContent='Cancel';cancel.style.marginInlineStart='8px';
      const remember=document.createElement('input'),rememberLabel=document.createElement('label');remember.type='checkbox';remember.id='cloud-unlock-remember';rememberLabel.className='cloud-sidebar-choice';rememberLabel.append(remember,document.createTextNode('Remember this browser for 30 days'));
      const done=(success,message)=>{input.value='';dialog.close();dialog.remove();success?resolve(true):reject(new Error(message || 'Cloud unlock cancelled. Your drafts were kept.'));};
      cancel.addEventListener('click',()=>done(false));dialog.addEventListener('cancel',event=>{event.preventDefault();if(!submit.disabled)done(false);});dialog.addEventListener('keydown',event=>event.stopPropagation());
      form.addEventListener('submit',async event=>{event.preventDefault();event.stopPropagation();submit.disabled=true;cancel.disabled=true;try{const response=await fetch('/api/cloud/login',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','X-MV-Connector':'1'},body:JSON.stringify({username:'owner',password:input.value,remember:config.rememberDevice && remember.checked})});input.value='';const result=await response.json();if(!response.ok)throw new Error(result.error?.message || 'Unlock failed.');if(!(await session()))throw new Error('Cloud session could not be established.');done(true);}catch(problem){error.textContent=problem.message;input.focus();}finally{submit.disabled=false;cancel.disabled=false;}});
      form.append(title,note,label,input);if(config.rememberDevice)form.append(rememberLabel);form.append(error,submit,cancel);dialog.append(form);document.body.append(dialog);dialog.showModal();input.focus();
    }).finally(()=>authentication=undefined);return authentication;
  }
  async function call(operation,input={}){
    identityUI?.assert();await authenticate();
    const response=await fetch('/api/cloud/'+operation,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','X-MV-CSRF':config.csrf,...(config.mode==='multi-user'?{'X-MV-Workspace':config.identity.id}:{})},body:JSON.stringify(input)});
    const value=await response.json();if(!response.ok){if(value.error?.code==='IDENTITY_CHANGED')void identityUI.changed();if(response.status===401)disconnected();throw Object.assign(new Error(value.error?.message || 'Connector request failed. Your local draft was kept.'),{code:'CONNECTOR',httpStatus:response.status});}return value.result;
  }
  // Cleanup must never request a new credential or create a replacement session.
  async function endSession(operation){
    if(!(await authenticate(false)))return;
    try{await call(operation);}
    catch(error){if(error.httpStatus!==401)throw error;}
  }
  const scopedLocal=target.MarkdownCloudBrowserStorage?.local || target.localStorage;
  const storage={getData:async key=>{const value=scopedLocal.getItem(key);if(value===null)throw new Error('No cloud preferences yet.');return value;},setData:async(key,value)=>scopedLocal.setItem(key,value)};
  const sleep=()=>new Promise(resolve=>setTimeout(resolve,1500));
  const platform=Object.freeze({
    canRestoreSession:config.mode==='multi-user',
    get secureAccounts(){return config.remember!==false && (config.mode!=='multi-user' || config.identity?.kind==='profile');},storage,
    bindIdentity:hooks=>identityUI?.bind(hooks),renderProfileControls:container=>identityUI?.render(container),
    credentialNote:'Remembered access is encrypted on your self-hosted connector. Its administrator can technically access it. Local drafts stay in this browser.',
    rememberLabel:'Remember account on this self-hosted connector',rememberDefault:false,
    accountNote:config.mode==='multi-user'?(config.identity?.kind==='profile'?'Cloud profile: '+config.identity.name+'. Connections belong to this profile. Drafts stay in this browser.':'Temporary access: create a personal profile to keep cloud connections. Use separate browser profiles on shared computers.'):'Personal server: cloud accounts are shared by people who know its cloud access password. Use a separate browser profile on shared devices.',
    logoutLabel:config.mode==='multi-user'?(config.identity?.kind==='profile'?'Sign out profile':'End temporary cloud session'):'Lock cloud access',rememberUnavailable:config.mode==='multi-user' && config.identity?.kind==='guest'?'Create a personal profile to remember cloud connections.':'Remembering connections is disabled by this server. Access lasts for the session only.',
    openBrowser:url=>{const popup=window.open(url,'_blank','noopener,noreferrer');return popup;},
    setEnabled:value=>{enabled=Boolean(value);},keepAlive:()=>{},
    onDisconnect:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
    stop:()=>endSession('disconnect'),
    logout:async()=>{await endSession('logout');disconnected();if(config.mode==='multi-user')identityUI.finishLogout();},
    request:async input=>{if(!enabled)throw new Error('Cloud connections are disabled.');const result=await call('request',input);if(result.transportVersion!==1 || typeof result.body!=='string' || new TextEncoder().encode(result.body).length>input.maxBytes)throw new Error('Invalid connector response.');return result;},
    releaseAccount:record=>call('accounts/release',record),forgetRememberedAccount:record=>call('accounts/unremember',record),
    storeAccount:record=>call('accounts/store',{id:record.id,providerId:record.providerId}),listAccounts:async(options={})=>await authenticate(options.interactive===true)?call('accounts/list'):[],forgetAccount:record=>call('accounts/forget',record),
    async connectProvider(providerId,values,_openBrowser,signal){
      if(!enabled)throw new Error('Cloud connections are disabled.');
      const root=providerId==='nextcloud'?values.server:values.root;
      let canonical;try{canonical=new URL(root).href.replace(/\/+$/,'')+'/';}catch{throw new Error('Enter a valid server URL.');}
      if(!config.anyServer && !config.targets.some(t=>t.providerId===providerId && t.root===canonical))throw new Error('This server/folder has not been approved by the administrator.');
      if(providerId==='webdav') {const record=await call('connect/webdav',values);if(signal?.aborted){await call('accounts/release',record);throw new Error('Connection cancelled.');}return record;}
      await authenticate();
      const popup=window.open('about:blank','_blank');if(!popup)throw new Error('Allow the sign-in window, then connect again.');popup.opener=null;
      let flow,finished=false;
      try{
        flow=await call('connect/nextcloud/start',values);if(signal?.aborted)throw new Error('Connection cancelled.');popup.location=flow.login;
        while(!signal?.aborted){const reply=await call('connect/nextcloud/poll',{id:flow.id});if(signal?.aborted){if(reply.account)await call('accounts/release',reply.account);throw new Error('Connection cancelled.');}if(reply.account){finished=true;return reply.account;}await sleep();}
        throw new Error('Connection cancelled.');
      }finally{if(!finished){try{popup.close();}catch{}if(flow)await call('connect/cancel',{id:flow.id}).catch(()=>{});}}
    }
  });
  identityUI?.operations({call,login,verify:session,disconnected});
  target.MarkdownCloudPlatform=Object.freeze({available:()=>true,create:()=>platform});
})(globalThis);
