// Shared copy workflow: snapshot locally, create exclusively, never replay uncertain writes.
(function(target){
  'use strict';
  const model=target.MarkdownCloudModel;
  const LIMITS=Object.freeze({files:500,folders:200,depth:20,totalBytes:50*1024*1024});
  function segment(value){
    if(typeof value!=='string' || !value || value!==value.trim() || /[\\/\u0000-\u001f\u007f:*?"<>|%]/.test(value) || /[. ]$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value) || new TextEncoder().encode(value).length>200)throw new Error('Choose a portable name without path separators or reserved characters.');
    return value;
  }
  // Propose a portable destination from a local display name, never from a remote URL.
  // Manual destination input still passes the strict validator without substitution.
  function suggestName(value,{file=false}={}){
    let stem=String(value || '').trim();if(file)stem=stem.replace(/\.(md|markdown)$/i,'');
    stem=stem.replace(/[\\/\u0000-\u001f\u007f:*?"<>|%]/g,'_').replace(/[. ]+$/,'');
    if(!stem || stem==='.' || stem==='..')stem=file?'Untitled':'Folder';
    if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem))stem='_'+stem;
    const characters=Array.from(stem),extension=file?'.md':'';
    while(new TextEncoder().encode(characters.join('')+extension).length>160)characters.pop();
    stem=characters.join('').replace(/[. ]+$/,'') || (file?'Untitled':'Folder');
    return file?model.markdownName(stem+extension):segment(stem);
  }
  const key=parts=>parts.map(p=>p.normalize('NFC').toLowerCase()).join('/');
  function validatePlan(input){
    if(!input || !Array.isArray(input.files) || !Array.isArray(input.folders) || input.files.length>LIMITS.files || input.folders.length>LIMITS.folders)throw new Error('Copy a smaller folder (up to 500 files and 200 folders).');
    const occupied=new Set(),directories=new Set(['']);let total=0;
    const path=parts=>{if(!Array.isArray(parts) || !parts.length || parts.length>LIMITS.depth)throw new Error('Invalid or overly deep copy hierarchy.');return parts.map(segment);};
    const folders=input.folders.map(path).sort((a,b)=>a.length-b.length);
    for(const parts of folders){const name=key(parts);if(occupied.has(name) || !directories.has(key(parts.slice(0,-1))))throw new Error('Duplicate or missing parent folder.');occupied.add(name);directories.add(name);}
    const files=input.files.map(file=>{
      const parts=path(file.path),name=key(parts);
      if(!/\.md$/.test(parts.at(-1)) || occupied.has(name) || !directories.has(key(parts.slice(0,-1))))throw new Error('Duplicate, non-Markdown or invalid copy destination.');occupied.add(name);
      if(typeof file.content!=='string')throw new Error('A source draft could not be loaded. Nothing was copied.');
      const bytes=new TextEncoder().encode(file.content).length;total+=bytes;
      if(bytes>model.MAX_BYTES || total>LIMITS.totalBytes)throw new Error('Copy exceeds the 20 MiB file or 50 MiB total limit.');
      return {path:parts,content:file.content};
    });
    if(!input.folder && (files.length!==1 || folders.length))throw new Error('Invalid file copy.');
    return {folder:!!input.folder,files,folders,totalBytes:total};
  }
  async function execute({plan,client,parent,name,api,isConnected,cancelled=()=>false,progress=()=>{},saves}){
    plan=validatePlan(plan);name=plan.folder?segment(name):model.markdownName(name);
    const requireLive=()=>{api.assertCopyAllowed?.();if(cancelled())throw new Error('Copy stopped. Completed files remain on the server; remaining drafts were kept.');if(!isConnected(client))throw new Error('The account disconnected. Check the server before retrying; all local drafts were kept.');};
    const root=plan.folder?client.folderRef(client.childRef(parent,name)):parent;
    const ref=(parts,folder=false)=>{let result=root;for(const part of parts)result=client.childRef(client.folderRef(result),part);return folder?client.folderRef(result):result;};
    const items=plan.files.map(file=>({file,href:plan.folder?ref(file.path):client.childRef(parent,name)}));
    // Validate every destination and check local ownership before any draft or network mutation.
    for(const item of items){client.validateFile(item.href);if(api.findRemote(client.source(item.href)))throw new Error('A local cloud draft already exists at the destination. Choose another name.');}
    const directories=plan.folder?[root,...plan.folders.map(parts=>ref(parts,true))]:[];
    directories.forEach(href=>client.validateRef(href));
    let completed=0,createdFolders=0,attempted=false;const drafts=[];
    try{
      requireLive();
      for(const item of items){
        requireLive();
        const digest=await model.digest(item.file.content);
        const source=client.source(item.href,'',{savedDigest:'',attemptDigest:digest,status:'uncertain',creationPending:true});
        item.source=source;item.id=await api.createRemoteDraft(item.file.content,client.fileName(item.href),source,{activate:false});drafts.push(item);saves.add(item.id);
      }
      // All recovery bodies are durable before the first MKCOL/PUT.
      requireLive();
      for(const folder of directories){requireLive();attempted=true;await client.createFolder(folder);createdFolders++;progress({completed,total:items.length,createdFolders});}
      for(const item of items){
        requireLive();attempted=true;
        try{const remote=await client.create(item.href,item.file.content);await api.updateRemote(item.id,{...item.source,version:remote.version,savedDigest:item.source.attemptDigest,attemptDigest:undefined,creationPending:undefined,status:'saved',availability:'available'});}
        catch(error){if(error.code==='CONFLICT')await api.detachRemote(item.id,item.source);throw error;}
        completed++;progress({completed,total:items.length,createdFolders});
      }
      return {completed,createdFolders,root,firstId:items[0]?.id};
    }catch(error){
      // A refused new root grants no authority over an existing directory's contents.
      if(!attempted || (plan.folder && createdFolders===0 && error.code==='CONFLICT'))for(const item of drafts)await api.detachRemote(item.id,item.source).catch(()=>{});
      throw Object.assign(new Error(completed+' of '+items.length+' files copied; '+createdFolders+' folders created. '+error.message+' No automatic retry or cleanup was performed.'),{code:error.code,completed,createdFolders});
    }finally{for(const item of drafts)saves.delete(item.id);api.statusChanged();}
  }
  function create(context){
    const {api,saves}=context;let dialog,busy=false;
    async function open(descriptor){
      if(dialog || busy)throw new Error('Finish the current cloud copy first.');
      const description=api.describeCopySource(descriptor),clients=context.clients().filter(client=>client.capabilities.create);
      if(!clients.length){api.notify('Connect a cloud account, then choose Copy to cloud again.');context.connect();return;}
      const modal=document.createElement('div');dialog=modal;modal.className='reset-modal-overlay modal-overlay';modal.id='cloud-copy-modal';modal.style.display='none';
      modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-hidden','true');modal.setAttribute('aria-labelledby','cloud-copy-title');
      modal.innerHTML='<div class="reset-modal-box reset-modal-box--wide app-modal-box modal-box cloud-settings-dialog"><div class="modal-header"><p id="cloud-copy-title" class="reset-modal-message">Copy to cloud</p><button type="button" class="modal-close-btn" aria-label="Close cloud copy"><i class="lucide lucide-x" aria-hidden="true"></i></button></div><div class="modal-body nextcloud-panel"><p class="cloud-copy-source"></p><p class="nextcloud-note">Copies the current workspace drafts, including unsaved edits. Originals stay unchanged. Linked folders are not rescanned; only their currently linked files are included. A folder copy creates a new folder and never merges into an existing one. Copies use .md; unsupported name characters become underscores and duplicate names receive a numbered suffix.</p><label for="cloud-copy-account">Cloud account</label><select id="cloud-copy-account"></select><label>Destination folder</label><div class="cloud-copy-navigation"><button type="button" class="nextcloud-button cloud-copy-up">Up</button><span class="cloud-copy-path"></span></div><div class="cloud-copy-folders" aria-label="Destination folders"></div><label for="cloud-copy-name">Name of the new copy</label><input id="cloud-copy-name" maxlength="200"><p class="cloud-copy-status nextcloud-note" role="status" aria-live="polite"></p></div><div class="reset-modal-actions"><button type="button" class="reset-modal-btn reset-modal-cancel">Cancel</button><button type="button" class="reset-modal-btn reset-modal-confirm">Copy</button></div></div>';
      document.body.append(modal);
      const select=modal.querySelector('select'),input=modal.querySelector('input'),list=modal.querySelector('.cloud-copy-folders'),status=modal.querySelector('.cloud-copy-status'),up=modal.querySelector('.cloud-copy-up'),confirm=modal.querySelector('.reset-modal-confirm'),cancel=modal.querySelector('.reset-modal-cancel');
      modal.querySelector('.cloud-copy-source').textContent=description.label+' \u00b7 '+description.count+' Markdown file(s)';input.value=description.name;
      clients.forEach((client,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=client.account.label+' \u00b7 '+client.account.detail+' \u00b7 '+decodeURIComponent(new URL(client.root).pathname);select.append(option);});
      let client=clients[0],folder=client.root,epoch=0,stop=false,finished=false,result;
      modal._confirmationCancel=()=>{stop=true;if(!busy){epoch++;modal.remove();dialog=undefined;}};
      const close=()=>{if(busy){stop=true;status.textContent='Stopping after the current operation settles\u2026';return;}epoch++;api.closeDialog(modal);modal.remove();dialog=undefined;};
      const live=()=>context.clients().includes(client);
      async function browse(href){
        const ticket=++epoch;const chosen=client;folder=chosen.folderRef(href);list.replaceChildren();confirm.disabled=true;up.disabled=true;status.textContent='Loading folders\u2026';
        modal.querySelector('.cloud-copy-path').textContent=chosen.locationLabel(folder);
        try{const entries=await chosen.list(folder);if(ticket!==epoch || dialog!==modal)return;if(!live())throw new Error('Reconnect the selected account.');
          for(const entry of entries.filter(item=>item.directory)){const button=document.createElement('button');button.type='button';button.className='nextcloud-entry is-folder';const icon=document.createElement('i');icon.className='lucide lucide-folder';icon.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=entry.name;button.append(icon,label);button.addEventListener('click',()=>void browse(entry.ref));list.append(button);}
          status.textContent='New files are created only if their names are free.';confirm.disabled=false;up.disabled=folder===chosen.root;
        }catch(error){if(ticket===epoch)status.textContent=error.message;}
      }
      select.addEventListener('change',()=>{client=clients[Number(select.value)];void browse(client.root);});up.addEventListener('click',()=>void browse(client.upRef(folder)));
      cancel.addEventListener('click',close);modal.querySelector('.modal-close-btn').addEventListener('click',close);
      confirm.addEventListener('click',async()=>{
        if(finished){try{if(result?.firstId && !description.folder)await api.activateRemote(client.source(planFileRef()));close();}catch(error){status.textContent=error.message;}return;}
        if(busy || confirm.disabled)return;
        let locked=false;
        try{
          const name=description.folder?segment(input.value):model.markdownName(input.value);
          if(!live())throw new Error('Reconnect the selected account.');
          busy=true;confirm.disabled=true;select.disabled=input.disabled=up.disabled=true;list.querySelectorAll('button').forEach(b=>b.disabled=true);cancel.textContent='Stop after current operation';cancel.focus();
          api.beginSave();locked=true;
          const plan=await api.captureCopySource(descriptor,description.signature);
          result=await execute({plan,client,parent:folder,name,api,saves,isConnected:c=>context.clients().includes(c),cancelled:()=>stop,progress:p=>{status.textContent=p.completed+' of '+p.total+' files copied \u00b7 '+p.createdFolders+' folders created';}});
          status.textContent='Copy complete. '+result.completed+' files copied. Originals remain unchanged.';api.notify(status.textContent);
          finished=true;confirm.textContent=description.folder?'Done':'Open copy';confirm.disabled=false;

        }catch(error){status.textContent=error.message;api.notify(error.message,true);finished=true;confirm.textContent='Done';confirm.disabled=false;result=undefined;}
        finally{if(locked)api.endSave();busy=false;cancel.textContent='Close';api.statusChanged();context.refresh();if(modal.getAttribute('aria-hidden')==='true'){epoch++;modal.remove();dialog=undefined;}}
      });
      function planFileRef(){return client.childRef(folder,model.markdownName(input.value));}
      // Closing via Escape/backdrop also stops future writes, but never abandons a live request.
      api.openDialog(modal,select,close);
      await browse(folder);
    }
    return {open};
  }
  target.MarkdownCloudCopy=Object.freeze({LIMITS,segment,suggestName,validatePlan,execute,create});
})(globalThis);
