// Shared durable cloud workflows. File references and version tokens belong to the provider.
(function(target) {
  'use strict';
  target.MarkdownCloudOperations=Object.freeze({create(context) {
    const {api,sessions,saves,uploading,reviewedVersions,sessionKey,clientFor,accountState,saveWorkspace,browse,message,refresh}=context;
    const model=target.MarkdownCloudModel;
    const providerLabel=client=>target.MarkdownCloudProviders.get(client.providerId).label;
    function requireCapability(client,name){if(!client.capabilities[name])throw new Error('This cloud connection does not support this action. Your draft was kept.');}
  async function newFile(client, folder) {
    if (!client || sessions.get(sessionKey(client)) !== client || !context.workspace.enabled) throw new Error('Connect to this cloud account first.');
    requireCapability(client,'create');
    folder=client.folderRef(folder);
    const name=await api.requestName({title:'New Markdown file',description:'Create in '+client.account.label+' · '+client.account.userLabel+' · '+client.locationLabel(folder),label:'Filename',value:'Untitled.md',confirmText:'Create',validate:value=>{try { model.markdownName(value);return ''; }catch(error){return error.message;}}});
    if (name===null) return;
    const filename=model.markdownName(name);
    const href=client.childRef(folder,filename);
    if (sessions.get(sessionKey(client)) !== client || !context.workspace.enabled) throw new Error('The account disconnected. Nothing was created.');
    if (api.findRemote(client.source(href))) throw new Error('A local document already exists for this path. Open it or choose another name; nothing was overwritten.');
    let locked=false, tabId, source;
    try {
      api.beginSave();locked=true;
      source=client.source(href,'',{savedDigest:'',attemptDigest:await model.digest(''),status:'uncertain',creationPending:true});
      tabId=await api.createRemoteDraft('',filename,source);
      saves.add(tabId);
      const remote=await client.create(href,'');
      await api.updateRemote(tabId,{...source,version:remote.version,savedDigest:source.attemptDigest,attemptDigest:undefined,creationPending:undefined,status:'saved',availability:'available'});
      if (context.activeClient===client) await browse(folder,client);
      message('Created '+filename+' on '+providerLabel(client)+'.');
    } catch(error) {
      if (tabId && error.code==='CONFLICT') await api.detachRemote(tabId,source);
      throw error;
    } finally { if(tabId)saves.delete(tabId);if(locked)api.endSave();refresh();api.statusChanged(); }
  }
  async function newForDocument(tabId) {
    const tab=await api.snapshot(tabId);
    if (!tab?.remoteSource) return;
    const source=tab.remoteSource;
    await newFile(clientFor(source),clientFor(source).parentRef(source.fileRef));
  }
  async function deleteRemote(client,href,name,tabId) {
    if (!client || sessions.get(sessionKey(client)) !== client) throw new Error('Connect to this cloud account first.');
    requireCapability(client,'delete');
    client.validateFile(href);
    let locked=false, ownsSave=false, approved, intent;
    try {
      api.beginSave();locked=true;
      tabId=tabId || api.findRemote(client.source(href));
      const before=tabId ? await api.snapshot(tabId) : null;
      if(before?.remoteSource && ['uncertain','conflict'].includes(before.remoteSource.status)) throw new Error('Check and resolve the server version before deleting. Your draft was kept.');
      const remote=await client.read(href);
      const version=await client.readVersion(href);
      if (!client.isVersion(version) || !model.equal(version,remote.version) || (before?.remoteSource && !model.equal(before.remoteSource.version,version))) throw new Error('The server version changed or cannot be verified. Refresh and review it before deleting.');
      const accepted=await api.confirm('Delete “'+name+'” from '+client.account.label+' ('+client.account.userLabel+')? The server file will be removed. A local recovery copy will be kept.',{title:'Delete from cloud?',confirmLabel:'Delete from cloud',cancelLabel:'Keep file',destructive:true,focusCancel:true,dedupeKey:'cloud-delete:'+href});
      if (!accepted) {message('Deletion cancelled. Nothing was deleted.');return;}
      if(sessions.get(sessionKey(client))!==client || !context.workspace.enabled) throw new Error('The account disconnected. Nothing was deleted.');
      if(before) {
        const latest=await api.snapshot(tabId);
        if(!latest || latest.content!==before.content || JSON.stringify(latest.remoteSource)!==JSON.stringify(before.remoteSource)) throw new Error('The draft changed while confirmation was open. Nothing was deleted.');
        approved=latest;
      } else {
        const source=client.source(href,version,{savedDigest:await model.digest(remote.content),status:'saved'});
        tabId=await api.createRemoteDraft(remote.content,name,source);approved=await api.snapshot(tabId);
      }
      saves.add(tabId); ownsSave=true;
      intent={...approved.remoteSource,status:'uncertain',deletePending:true};
      await api.updateRemote(tabId,intent); // Exact durable draft/intent precedes DELETE.
      try { await client.remove(href,version); }
      catch(error) {
        if(error.code==='CONFLICT') await api.updateRemote(tabId,{...approved.remoteSource,status:'conflict',deletePending:undefined});
        throw error;
      }
      await api.detachRemote(tabId,intent);
      reviewedVersions.delete(tabId);
      if(context.activeClient===client && context.currentFolder) await browse(context.currentFolder,client);
      message('Deleted from '+providerLabel(client)+'. Your local recovery copy was kept.');
    } finally { if(ownsSave)saves.delete(tabId);if(locked)api.endSave();refresh();api.statusChanged(); }
  }
  async function remove(tabId) {
    const tab=await api.snapshot(tabId);
    if(!tab?.remoteSource)return;
    const source=tab.remoteSource;
    await deleteRemote(clientFor(source),source.fileRef,tab.title,tab.id);
  }
  async function save(tabId) {
    if (saves.has(tabId)) return;
    saves.add(tabId);
    let tab;
    let locked = false;
    try {
      api.beginSave();
      locked = true;
      tab = await api.snapshot(tabId);
      if (!tab?.remoteSource) return;
      let source = tab.remoteSource;
      const client = clientFor(source);
      requireCapability(client,'conditionalSave');
      if (source.status === 'uncertain' || source.status === 'conflict') throw new Error('Check the server version before saving again. Your draft was kept.');
      if(client.readOnlyReason?.(source))throw new Error(client.readOnlyReason(source));
      const preference=accountState(await client.accountId());
      let skipFuture=false;
      const accepted = preference.skipSaveConfirmation === true || await api.confirm('Upload “' + tab.title + '” to ' + client.account.label + ' (' + client.account.userLabel + ')? This updates the cloud file only if its server version has not changed. Your local recovery draft is kept.', {
        title:'Save to cloud?', confirmLabel:'Upload changes', cancelLabel:'Keep local draft', focusCancel:true, dedupeKey:'cloud-save:' + tab.id,
        checkbox:{label: "Don't show again for this account",onChange:checked => { skipFuture=checked; }}
      });
      if (!accepted) { message('Upload cancelled. Your local draft was kept.'); return; }
      if (skipFuture) { preference.skipSaveConfirmation=true; await saveWorkspace(); }
      const approved = await api.snapshot(tabId);
      if (!approved || approved.content !== tab.content || JSON.stringify(approved.remoteSource) !== JSON.stringify(tab.remoteSource)) throw new Error('The draft changed while confirmation was open. Nothing was uploaded. Save again to review the latest draft.');
      if (!client.isVersion(source.version)) {
        message('Checking the original file version…');
        const original = await client.read(source.fileRef);
        if (!client.isVersion(original.version)) throw new Error('The cloud server did not provide a usable file version. Your draft is safe locally; saving to the server is unavailable.');
        if (await model.digest(original.content) !== source.savedDigest) {
          await api.updateRemote(tabId, { ...source, status: 'conflict' });
          throw new Error('The server file changed. Your draft was kept. Check the server version to compare them.');
        }
        source = { ...source, version: original.version };
        await api.updateRemote(tabId, source);
      }
      if (new TextEncoder().encode(tab.content).byteLength > model.MAX_BYTES) throw new Error('The document exceeds the 20 MiB limit. Your draft was kept.');
      const attemptDigest = await model.digest(tab.content);
      // Persist the attempt before issuing PUT: a crash during upload must not enable blind retries.
    await api.updateRemote(tabId, { ...source, status: 'uncertain', attemptDigest });
      uploading.add(tabId); message('Saving to cloud…'); api.statusChanged();
      let saved;
      try { saved = await client.save(source.fileRef, source.version, tab.content); }
      catch (error) {
        await api.updateRemote(tabId, { ...source, attemptDigest, status: error.code === 'CONFLICT' ? 'conflict' : 'uncertain' });
        throw error;
      }
      const finalState = await api.updateRemote(tabId, { ...source, version: saved.version, savedDigest: attemptDigest, creationPending:undefined, deletePending:undefined, status: 'saved', availability:'available' });
      message(finalState === 'draft' ? 'Saved to '+providerLabel(client)+'; newer edits remain in your draft.' : 'Saved to '+providerLabel(client)+'.');
    } catch (error) {
      message(error.message, 'error');
      if (context.isHidden()) api.notify(error.message, true);
    } finally { uploading.delete(tabId); saves.delete(tabId); if (locked) api.endSave(); refresh(); api.statusChanged(); }
  }
  async function checkActive(tabId) {
    const tab = await api.snapshot(tabId);
    if (!tab?.remoteSource) { message('Select a cloud document first.'); return; }
    if (saves.has(tab.id)) { message('Wait for the current Save to finish.'); return; }
    saves.add(tab.id);
    let locked = false;
    try {
      api.beginSave(); locked = true;
      const source = tab.remoteSource;
      let remote;
      try { remote = await clientFor(source).read(source.fileRef); }
      catch(error) {
        if(source.deletePending && error.httpStatus===404) {
          await api.detachRemote(tab.id,source);reviewedVersions.delete(tab.id);
          message('Server deletion confirmed. Your local recovery copy was kept.');return;
        }
        throw error;
      }
      if(source.deletePending) {
        reviewedVersions.set(tab.id,{href:source.fileRef,version:remote.version,digest:await model.digest(remote.content)});
        await api.openComparison(remote.content,tab.title+' (cloud version)');
        message('The file is still on the server. Deletion was not retried; review it before resolving this draft.');return;
      }
      const remoteDigest = await model.digest(remote.content);
      if (source.status === 'uncertain' && remoteDigest === source.savedDigest && remoteDigest !== source.attemptDigest) {
        reviewedVersions.set(tab.id, { href:source.fileRef, version:remote.version, digest:remoteDigest });
        await api.openComparison(remote.content, tab.title + ' (cloud version)');
        message('The previous upload is still unconfirmed. Review the server copy before choosing Resolve using my draft; nothing was retried.');
      } else if (remoteDigest === source.savedDigest || remoteDigest === source.attemptDigest) {
        await api.updateRemote(tab.id, { ...source, version: remote.version, savedDigest: remoteDigest, status: 'saved', attemptDigest: undefined, creationPending:undefined, availability:'available' });
        message('Server version checked. Your current draft was kept.');
      } else {
        await api.updateRemote(tab.id, { ...source, status: 'conflict', availability:'available' });
        await api.openComparison(remote.content, tab.title + ' (cloud version)');
        reviewedVersions.set(tab.id, { href: source.fileRef, version: remote.version, digest: remoteDigest });
        message('Server file changed. Its version opened as a separate local document; your draft was kept.');
      }
    } catch (error) { await markReadFailure(tab.id,error); throw error; }
    finally { saves.delete(tab.id); if (locked) api.endSave(); refresh(); }
  }
  async function markReadFailure(tabId, error) {
    if (!['HTTP','NETWORK','AUTH','NEXTCLOUD_CREDENTIALS','WEBDAV_CREDENTIALS'].includes(error.code)) return;
    const latest = await api.snapshot(tabId);
    if (latest?.remoteSource) await api.updateRemote(tabId, { ...latest.remoteSource, availability:error.httpStatus === 404 ? 'missing' : 'unavailable' });
  }
  async function reloadRemote(tabId) {
    const tab = await api.snapshot(tabId);
    if (!tab?.remoteSource || saves.has(tab.id)) return;
    const source = tab.remoteSource;
    const client = clientFor(source);
    saves.add(tab.id);
    let locked = false;
    try {
      api.beginSave(); locked = true;
      const remote = await client.read(source.fileRef);
      const dirty = await model.digest(tab.content) !== source.savedDigest;
      if (dirty) {
        const accepted = await api.confirm('Replace your local draft with the current cloud version? A recovery copy of this draft will be kept in Cloud Workspace.', {
          title:'Reload cloud file?', confirmLabel:'Keep recovery & reload', cancelLabel:'Keep draft', destructive:true, focusCancel:true, dedupeKey:'cloud-reload:' + tab.id
        });
        if (!accepted) return;
      }
      const latest = await api.snapshot(tab.id);
      if (!latest || latest.content !== tab.content || JSON.stringify(latest.remoteSource) !== JSON.stringify(source)) throw new Error('The draft changed while reload was pending. Nothing was replaced.');
      const verified = await client.read(source.fileRef);
      if (!model.equal(verified.version,remote.version) || verified.content !== remote.content) throw new Error('The server file changed while reload was pending. Nothing was replaced.');
      if (dirty) await api.preserveDraft(tab.id, tab);
      await api.replaceRemote(tab.id, tab, { ...verified, digest:await model.digest(verified.content) });
      reviewedVersions.delete(tab.id);
      message('Reloaded from '+providerLabel(client)+'.');
    } catch (error) { await markReadFailure(tab.id,error); throw error; }
    finally { saves.delete(tab.id); if (locked) api.endSave(); refresh(); }
  }
  async function resolveActive(tabId) {
    const tab = await api.snapshot(tabId);
    const reviewed = tab && reviewedVersions.get(tab.id);
    if (!tab?.remoteSource || !reviewed || reviewed.href !== tab.remoteSource.fileRef) {
      message('Check the server version first, review its copy, then select your original draft.');
      return;
    }
    if (saves.has(tab.id)) return;
    if (!clientFor(tab.remoteSource).isVersion(reviewed.version)) throw new Error('This server version cannot be safely overwritten: no usable version token.');
    if (!(await api.confirm('Keep this draft for the next Save? It will replace the server version you just reviewed, provided that version has not changed again. Nothing is uploaded until you press Save.', {
      title:'Resolve cloud conflict?', confirmLabel:'Keep my draft', cancelLabel:'Cancel', focusCancel:true, dedupeKey:'cloud-resolve:' + tab.id
    }))) return;
    const latest = await api.snapshot(tab.id);
    if (!latest || latest.content !== tab.content || JSON.stringify(latest.remoteSource) !== JSON.stringify(tab.remoteSource)) throw new Error('The draft changed while confirmation was open. Review it again.');
    if (saves.has(tab.id)) throw new Error('A Save started while confirmation was open. Check the server version again.');
    saves.add(tab.id);
    let locked = false;
    try {
      api.beginSave(); locked = true;
      await api.updateRemote(tab.id, { ...tab.remoteSource, version: reviewed.version, savedDigest: reviewed.digest, attemptDigest: undefined, creationPending:undefined, deletePending:undefined, status: 'draft' });
      reviewedVersions.delete(tab.id);
      message('Your draft was kept. Next Save will update the reviewed server version if it is still unchanged.');
    } finally { saves.delete(tab.id); if (locked) api.endSave(); refresh(); }
  }
    return Object.freeze({newFile,newForDocument,deleteRemote,remove,save,checkActive,reloadRemote,resolveActive});
  }});
})(globalThis);
