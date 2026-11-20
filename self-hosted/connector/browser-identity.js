// Loaded by the connector before workspace storage; never loaded in stock web/desktop.
(function(target){
  'use strict';
  const config=target.MarkdownCloudConnector,multi=config.mode==='multi-user';
  const nativeLocal=target.localStorage,nativeSession=target.sessionStorage;
  const guestKey='mv-cloud-guest-scope',eventKey='mv-cloud-profile-event';
  let hooks,operations,blocked=false,scope;
  function browserScope(){
    const key=config.identity?.kind==='profile'?'mv-cloud-profile-scope:'+config.identity.id:guestKey;
    let value=nativeLocal.getItem(key);
    if(!value || !/^[a-zA-Z0-9_-]{16,80}$/.test(value)){value=target.crypto.randomUUID();nativeLocal.setItem(key,value);}
    return value;
  }
  function scopedStorage(storage,prefix){
    const keys=()=>{const values=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix))values.push(key.slice(prefix.length));}return values;};
    return Object.freeze({getItem:key=>storage.getItem(prefix+String(key)),setItem:(key,value)=>storage.setItem(prefix+String(key),String(value)),removeItem:key=>storage.removeItem(prefix+String(key)),clear:()=>keys().forEach(key=>storage.removeItem(prefix+key)),key:index=>keys()[Number(index)] ?? null,get length(){return keys().length;}});
  }
  if(multi){
    scope=browserScope();const prefix='mv-cloud-workspace:'+scope+':';
    target.MarkdownCloudBrowserStorage=Object.freeze({local:scopedStorage(nativeLocal,prefix),session:scopedStorage(nativeSession,prefix),databaseName:'markdownViewerWorkspace-cloud-'+scope});
  }
  const button=(text,run)=>{const item=document.createElement('button');item.type='button';item.className='nextcloud-button';item.textContent=text;item.addEventListener('click',()=>void Promise.resolve().then(run).catch(error=>target.alert(error.message)));return item;};
  async function flush(){if(!hooks || hooks.isBusy())throw Error('Wait for the current cloud operation before switching profiles.');await hooks.flush();}
  async function changed(){
    if(blocked)return;blocked=true;
    const panel=document.createElement('dialog');panel.className='cloud-identity-block app-modal-box';
    const title=document.createElement('h2'),note=document.createElement('p');title.textContent='Cloud profile changed';note.textContent='Saving this tab’s drafts before switching workspace…';panel.append(title,note);document.body.append(panel);panel.showModal();panel.addEventListener('cancel',event=>event.preventDefault());
    document.querySelector('.app-container')?.setAttribute('inert','');
    async function save(){
      try{try{await flush();}catch(error){if(!hooks?.preserve)throw error;await hooks.preserve();}note.textContent='This tab’s drafts were saved in their own workspace or its recovery journal. Reload to use the active profile.';panel.append(button('Reload workspace',()=>location.reload()));}
      catch(error){note.textContent='This tab is paused. '+error.message+' Keep it open to preserve recovery.';panel.append(button('Keep this local workspace open',()=>{panel.close();panel.remove();document.querySelector('.app-container')?.removeAttribute('inert');}),button('Retry saving drafts',async()=>{panel.querySelectorAll('button').forEach(item=>item.remove());await save();}));}
    }
    await save();
  }
  function check(next){
    if(!multi){config.identity=next;return;}
    if(!next || next.kind!==config.identity?.kind || (next.kind==='profile' && next.id!==config.identity.id)){void changed();throw Error('The active profile changed. This tab was paused to keep its drafts separate.');}
    // A temporary session may expire without changing this browser's local guest workspace.
    config.identity=next;
  }
  function finish(result,adopt){
    if(adopt){nativeLocal.setItem('mv-cloud-profile-scope:'+result.identity.id,scope);nativeLocal.removeItem(guestKey);}
    nativeLocal.setItem(eventKey,JSON.stringify({id:result.identity?.id || '',kind:result.identity?.kind || 'guest',nonce:target.crypto.randomUUID()}));
    location.reload();
  }
  function form(register,rememberOnly=false){
    const dialog=document.createElement('dialog');dialog.className='cloud-profile-dialog app-modal-box';dialog.setAttribute('aria-labelledby','cloud-profile-title');
    const form=document.createElement('form'),title=document.createElement('h2'),note=document.createElement('p'),status=document.createElement('p');title.id='cloud-profile-title';title.textContent=rememberOnly?'Remember this browser':register?'Create personal cloud profile':'Sign in to cloud profile';
    note.className='nextcloud-note';note.textContent=rememberOnly?'Enter your '+(multi?'profile':'cloud access')+' password to remember this browser for 30 days.':register?'Your temporary workspace stays on this browser and will belong to this profile. Saved cloud access belongs only to you. This is separate from your Nextcloud password. Keep the profile password safely; automatic password recovery is not available.':'Your current drafts stay in their workspace. This browser will open the selected profile’s separate local workspace; drafts do not sync between browsers.';
    if(register)note.textContent+=' '+(config.remember?'Current cloud connections will also be remembered on this connector.':'This server keeps cloud connections for the session only.');
    const field=(text,type,id)=>{const label=document.createElement('label'),input=document.createElement('input');label.textContent=text;input.type=type;input.id=id;input.required=true;input.autocomplete=type==='password'?(register?'new-password':'current-password'):'username';input.maxLength=type==='password'?4096:64;if(type==='password' && register)input.minLength=12;label.htmlFor=id;form.append(label,input);return input;};
    form.append(title,note);const name=field('Profile name','text','cloud-profile-name'),password=field('Profile password','password','cloud-profile-password'),confirm=register?field('Confirm profile password','password','cloud-profile-confirm'):null;
    if(rememberOnly){name.value=config.identity.name;name.readOnly=true;}
    const remember=document.createElement('input'),rememberLabel=document.createElement('label');remember.type='checkbox';remember.id='cloud-profile-remember';rememberLabel.className='cloud-sidebar-choice';rememberLabel.append(remember,document.createTextNode('Remember this browser for 30 days'));if(config.rememberDevice && !rememberOnly)form.append(rememberLabel);
    status.setAttribute('role','status');const submit=document.createElement('button'),cancel=button('Cancel',()=>{password.value='';if(confirm)confirm.value='';dialog.close();dialog.remove();});submit.type='submit';submit.className='nextcloud-button nextcloud-primary';submit.textContent=rememberOnly?'Remember browser':register?'Create profile':'Sign in';form.append(status,submit,cancel);
    form.addEventListener('submit',async event=>{
      event.preventDefault();event.stopPropagation();submit.disabled=true;cancel.disabled=true;
      try{
        if(confirm && password.value!==confirm.value)throw Error('The profile passwords do not match.');
        await flush();const values={username:name.value,password:password.value,remember:config.rememberDevice && remember.checked};
        const result=rememberOnly?await operations.call('devices/remember',{password:password.value}):register?await operations.call('profile/register',values):await operations.login(values);
        password.value='';if(confirm)confirm.value='';if(rememberOnly){dialog.close();dialog.remove();target.alert('This browser is remembered. Sign out to revoke its access.');}else finish(result,register);
      }catch(error){status.textContent=error.message;password.value='';if(confirm)confirm.value='';password.focus();}
      finally{submit.disabled=false;cancel.disabled=false;}
    });
    dialog.addEventListener('keydown',event=>event.stopPropagation());dialog.addEventListener('cancel',event=>{if(submit.disabled){event.preventDefault();return;}password.value='';if(confirm)confirm.value='';dialog.remove();});dialog.append(form);document.body.append(dialog);dialog.showModal();name.focus();
  }
  target.addEventListener('storage',event=>{if(!multi || event.key!==eventKey)return;try{const value=JSON.parse(event.newValue);if(value.kind==='guest' && config.identity?.kind==='guest')return;if(value.id!==config.identity?.id)void changed();}catch{}});
  target.addEventListener('focus',()=>{if(multi && !blocked && operations)void operations.verify().catch(()=>{});});
  target.MarkdownCloudIdentity=Object.freeze({
    bind:value=>{hooks=value;},operations:value=>{operations=value;},check,assert:()=>{if(blocked)throw Error('This tab is paused because the profile changed.');},changed,
    finishLogout:()=>finish({identity:null},false),
    render(container){
      if(!multi && (!config.rememberDevice || !config.identity))return;
      const row=document.createElement('div');row.className='cloud-profile-controls';
      if(multi && config.identity?.kind==='guest'){row.append(button('Create personal profile',()=>form(true)),button('Sign in to profile',()=>form(false)));}
      else{
        if(config.rememberDevice && config.identity)row.append(button('Remember this browser',()=>form(false,true)));
        row.append(button('Sign out all browsers',async()=>{if(!target.confirm('Sign out all browsers for this cloud profile? Saved cloud connections and local drafts will be kept.'))return;await flush();await operations.call('devices/revoke');if(multi)finish({identity:null},false);else operations.disconnected();}));
      }
      container.append(row);
    }
  });
})(globalThis);
