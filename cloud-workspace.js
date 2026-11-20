// Shared cloud UI. Only non-secret source identity is passed to the editor.
(function (target) {
  'use strict';
  const providers=target.MarkdownCloudProviders, model=target.MarkdownCloudModel;
  let operations,copyOperations;
  const newFile=(...args)=>operations.newFile(...args);
  const newForDocument=(...args)=>operations.newForDocument(...args);
  const deleteRemote=(...args)=>operations.deleteRemote(...args);
  const remove=(...args)=>operations.remove(...args);
  const save=(...args)=>operations.save(...args);
  const checkActive=(...args)=>operations.checkActive(...args);
  const reloadRemote=(...args)=>operations.reloadRemote(...args);
  const resolveActive=(...args)=>operations.resolveActive(...args);
  let platform;
  let api;
  let panel;
  let status;
  let content;
  let activeClient;
  let currentFolder;
  let pendingLogin;
  let body;
  let accountTools;
  let entriesView;
  let entriesData = [];
  let entryClient;
  let draftsView;
  let documentRevision = '';
  let accountList;
  let settingsModal;
  let setupContent;
  let setupStatus;
  let settingsSummary;
  let visibilityToggle;
  let enabledToggle;
  let automaticToggle;
  let connectionEpoch = 0;
  let disclosure;
  const uploading = new Set();
  let workspace = { version: 1, accounts: [], activeId: '', enabled:false, autoConnect:true };
  let workspaceWrites = Promise.resolve();
  const accounts = new Map();
  const WORKSPACE_KEY = 'markdownViewerCloudWorkspace';
  let operation = 0;
  const sessions = new Map();
  const saves = new Set();
  const reviewedVersions = new Map();
  function secureAccountsAvailable() {
    return Boolean(platform?.secureAccounts);
  }
  function accountState(id) {
    let state = workspace.accounts.find(item => item.id === id);
    if (!state) { state = { id, folders: [] }; workspace.accounts.push(state); }
    return state;
  }
  async function saveWorkspace() {
    const storage = platform.storage || target.Neutralino?.storage;
    if (!storage?.setData) return;
    const snapshot = JSON.stringify(workspace);
    workspaceWrites = workspaceWrites.catch(() => {}).then(() => storage.setData(WORKSPACE_KEY, snapshot));
    await workspaceWrites;
  }
  function tools() {
    accountTools.replaceChildren(button('Add cloud account', () => connectForm(), 'plus', true));
    const sort = button('Sort cloud files', () => api.showMenu(sort,'Sort cloud files',[
      {id:'sort-asc',icon:'lucide-case-sensitive',label:'Name A–Z' + (workspace.sort !== 'desc' ? ' ✓' : ''),run:async () => { workspace.sort = 'asc'; await saveWorkspace(); renderDocuments(true); }},
      {id:'sort-desc',icon:'lucide-case-sensitive',label:'Name Z–A' + (workspace.sort === 'desc' ? ' ✓' : ''),run:async () => { workspace.sort = 'desc'; await saveWorkspace(); renderDocuments(true); }}
    ]),'list',true,true);
    accountTools.append(sort);
    if (!activeClient) return;
    accountTools.append(button('Refresh', () => browse(currentFolder || activeClient.root), 'refresh-cw', true));
  }
  function updateVisibility() {
    if (!panel) return;
    const hasDrafts = draftsView && !draftsView.hidden;
    panel.hidden = workspace.hidden === true || (!accounts.size && !hasDrafts);
    if (visibilityToggle) visibilityToggle.checked = workspace.hidden !== true;
    if (enabledToggle) enabledToggle.checked = workspace.enabled;
    if (automaticToggle) automaticToggle.checked = workspace.autoConnect;
  }
  function applyExpansion() {
    if (!body || !disclosure) return;
    body.hidden = workspace.collapsed === true;
    disclosure.setAttribute('aria-expanded',String(!body.hidden));
    disclosure.querySelector('.lucide-chevron-down').classList.toggle('is-collapsed',body.hidden);
  }
  function renderAccounts() {
    accountList.replaceChildren();
    for (const profile of accounts.values()) {
      const group = document.createElement('div');
      group.className = 'cloud-account';
    const state = accountState(profile.id);
    const row = button(profile.client.account.label + ' (' + profile.client.account.userLabel + ')', () => activateAccount(profile), 'cloud-upload');
      row.className = 'nextcloud-entry cloud-account-row' + (profile.client === activeClient ? ' is-active' : '');
      row.title = profile.client.account.label + '\n' + profile.client.account.detail + (profile.remembered ? '\n' + (platform.rememberLabel || 'Remembered securely on this device') : '\nSession only');
      row.replaceChildren(icon('cloud-upload'));
      const copy = document.createElement('span'); copy.className = 'cloud-account-copy';
      const name = document.createElement('span'); name.textContent = profile.client.account.label;
      const detail = document.createElement('small'); detail.textContent = profile.client.account.detail;
      copy.append(name,detail); row.append(copy);
      const connected = sessions.has(sessionKey(profile));
      const connection = document.createElement('span'); connection.className = 'cloud-connection-dot'; connection.dataset.connected = String(connected);
      connection.title = connected ? 'Connected' : 'Offline · local drafts remain available'; connection.setAttribute('aria-label',connection.title); row.append(connection);
      const actions = () => [
        { id:'cloud-connect', icon:'lucide-refresh-cw', label:'Reconnect', run:() => activateAccount(profile) },
        { id:'cloud-new', icon:'lucide-file-plus', label:'New Markdown file', disabled:!profile.client.capabilities.create || !sessions.has(sessionKey(profile)), run:() => newFile(profile.client,profile.client.root) },
        { id:'cloud-forget', icon:'lucide-x', label:profile.remembered ? 'Forget account' : 'Disconnect', run:async () => { activeClient = profile.client; await disconnect(); } }
      ];
      contextMenu(row, profile.client.account.userLabel, actions);
      const toggle = button((state.collapsed ? 'Expand ' : 'Collapse ') + profile.client.account.label, async () => {
        state.collapsed = !state.collapsed; await saveWorkspace(); renderAccounts();
      },state.collapsed ? 'chevron-right' : 'chevron-down',true);
      toggle.setAttribute('aria-expanded', String(!state.collapsed));
      const line = document.createElement('div'); line.className = 'cloud-account-heading';
      const menu = button('Account options for ' + profile.client.account.userLabel, () => api.showMenu(menu,profile.client.account.userLabel,actions()),'ellipsis',true,true);
      line.append(toggle,row,menu); group.append(line);
      const locations = document.createElement('div');
      locations.className = 'cloud-folders';
      for (const folder of accountState(profile.id).folders) {
        try { profile.client.validateRef(folder.href); } catch (_) { continue; }
        const item = document.createElement('div');
        item.className = 'cloud-folder-row';
        const open = button(folder.name, () => activateAccount(profile, folder.href), 'folder');
        open.className = 'nextcloud-entry is-folder';
        open.title = profile.client.locationLabel(folder.href);
        contextMenu(open, folder.name, () => [
          { id:'open', icon:'lucide-folder-open', label:'Open', run:() => activateAccount(profile, folder.href) },
          { id:'refresh', icon:'lucide-refresh-cw', label:'Refresh', run:() => activateAccount(profile, folder.href) },
          { id:'cloud-new', icon:'lucide-file-plus', label:'New Markdown file', disabled:!profile.client.capabilities.create || !sessions.has(sessionKey(profile)), run:() => newFile(profile.client,folder.href) }
        ]);
        const remove = button('Remove folder ' + folder.name + ' from workspace', async () => {
          const state = accountState(profile.id);
          state.folders = state.folders.filter(value => value.href !== folder.href);
          await saveWorkspace(); renderAccounts();
          message('Folder removed from this workspace. Server files were not changed.');
        }, 'x', true);
        item.append(open, remove); locations.append(item);
      }
      const children = document.createElement('div'); children.className = 'cloud-account-children'; children.hidden = state.collapsed === true;
      children.append(locations);
      if (profile.client === activeClient) children.append(content);
      group.append(children);
      accountList.append(group);
    }
    updateVisibility();
  }
  function resetBrowser(){++operation;currentFolder=undefined;content.replaceChildren();entriesView=undefined;entriesData=[];entryClient=undefined;}
  async function activateAccount(profile, href, keepCollapsed = false) {
    if (pendingLogin || saves.size) throw new Error('Wait for the current connection or Save to finish.');
    const epoch = ++connectionEpoch;
    const client = profile.client;
    if(activeClient!==client)resetBrowser();
    activeClient = client;
    if (!keepCollapsed) accountState(profile.id).collapsed = false;
    workspace.activeId = profile.id;
    tools(); renderAccounts();
    try {
      await client.identify();
      if (epoch !== connectionEpoch || !workspace.enabled) return;
      sessions.set(sessionKey(profile), client); platform.keepAlive(true);
      let location = href || accountState(profile.id).lastFolder || client.root;
      try { location = client.validateRef(location); } catch (_) { location = client.root; }
      await browse(location, client);
    } catch (error) {
      if (epoch !== connectionEpoch) return;
      sessions.delete(sessionKey(profile)); platform.keepAlive(sessions.size > 0);
      renderAccounts();
      message('Could not reconnect to ' + profile.client.account.userLabel + '. ' + error.message + ' Use Add cloud account to sign in again if access was revoked.', 'error');
    }
  }
  async function pinFolder() {
    const profile = [...accounts.values()].find(item => item.client === activeClient);
    if (!profile || !currentFolder) return;
    const state = accountState(profile.id);
    if (!state.folders.some(folder => folder.href === currentFolder)) {
      if (state.folders.length >= 50) throw new Error('This account already has 50 selected folders.');
      const suffix = activeClient.locationLabel(currentFolder).replace(/\/$/, '');
      state.folders.push({ href: currentFolder, name: suffix.split('/').pop() || 'Files' });
      await saveWorkspace(); renderAccounts();
    }
    message('Folder added to Cloud Workspace.');
  }
  async function restoreWorkspace() {
    try {
      let hadSavedWorkspace=false;
      const storage = platform.storage || target.Neutralino?.storage;
      if (storage?.getData) {
        try {
          const saved = JSON.parse(await storage.getData(WORKSPACE_KEY));
          if (saved.version === 1 && Array.isArray(saved.accounts)) {hadSavedWorkspace=true;workspace = {
            version: 1, enabled: saved.enabled === true || (saved.enabled === undefined && saved.accounts.length > 0), autoConnect: saved.autoConnect !== false, activeId: String(saved.activeId || ''), hidden:saved.hidden === true, collapsed:saved.collapsed === true, sort:saved.sort === 'desc' ? 'desc' : 'asc', accounts: saved.accounts.slice(0, 20).filter(item => model.isAccountId(item.id)).map(item => ({
              id: item.id, ...(item.providerId ? {providerId:item.providerId} : {}), lastFolder: typeof item.lastFolder === 'string' ? item.lastFolder : '',
              collapsed:item.collapsed === true, skipSaveConfirmation:item.skipSaveConfirmation === true,
              folders: (Array.isArray(item.folders) ? item.folders : []).slice(0,50).filter(folder => typeof folder.href === 'string' && typeof folder.name === 'string').map(folder => ({ href: folder.href, name: folder.name.slice(0,160) }))
            }))
          };
          }
        } catch (_) { /* No saved workspace yet. Credentials are never stored here. */ }
      }
      if(!hadSavedWorkspace && platform.canRestoreSession)workspace.enabled=true;
      applyExpansion(); updateVisibility();
      platform.setEnabled(workspace.enabled);
      if (!workspace.enabled || !workspace.autoConnect || (!workspace.accounts.length && !platform.canRestoreSession)) return;
      await loadRemembered();
    } catch (error) { message(error.message, 'error'); }
  }
  async function loadRemembered(interactive=false) {
    if (!workspace.enabled || (!secureAccountsAvailable() && !platform.canRestoreSession)) return;
    const stored = await platform.listAccounts({interactive});
    if (!workspace.enabled) return;
    for (const account of stored.slice(0,20)) {
      try {
        const provider=providers.accountProvider(account);
        const client=await provider.restore(account,platform);
        accounts.set(account.id,{id:account.id,providerId:provider.id,client,remembered:account.remembered!==false});
      } catch(error) { message(error.message,'error'); }
    }
    renderAccounts();
    const selected = accounts.get(workspace.activeId) || accounts.values().next().value;
    if (selected) { message('Reconnecting to cloud…'); await activateAccount(selected, undefined, true); }
    else { platform.keepAlive(false); message(platform.canRestoreSession?'No cloud connections in this session.':'No remembered cloud accounts.'); }
  }
  async function setCloudEnabled(enabled) {
    if (pendingLogin || saves.size) throw new Error('Wait for the current cloud operation to finish.');
    if (!enabled) {
      await api.flushDrafts();
      platform.setEnabled(false);
      try { await platform.stop(); } catch (error) { platform.setEnabled(workspace.enabled); throw error; }
      ++connectionEpoch; ++operation;
      for (const profile of accounts.values()) profile.client.disconnect();
      sessions.clear(); accounts.clear(); activeClient = undefined;
      platform.keepAlive(false);
      content.replaceChildren(); entriesView=undefined; entriesData=[]; entryClient=undefined;
    }
    workspace.enabled = enabled; platform.setEnabled(enabled);
    await saveWorkspace(); renderAccounts(); updateVisibility(); api.statusChanged();
    message(enabled ? 'Cloud connections enabled. Connect or load a remembered account.' : 'Cloud connections disabled. Local drafts and remembered accounts were kept.');
  }
  function message(text, tone = 'info') {
    if (status) { status.textContent = text; status.dataset.tone = tone; }
    if (setupStatus) { setupStatus.textContent = text; setupStatus.dataset.tone = tone; }
    refresh();
  }
  function icon(name) {
    const element = document.createElement('i');
    element.className = 'lucide lucide-' + name;
    element.setAttribute('aria-hidden', 'true');
    return element;
  }
  function button(label, action, iconName, iconOnly = false, opensMenu = false) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = iconOnly ? 'nextcloud-icon-button' : 'nextcloud-button';
    element.setAttribute('aria-label', label);
    element.title = label;
    if (iconName) element.append(icon(iconName));
    if (!iconOnly) { const span = document.createElement('span'); span.textContent = label; element.append(span); }
    if (opensMenu) element.setAttribute('aria-haspopup','menu');
    element.addEventListener('click', event => {
      if (opensMenu) event.stopPropagation();
      void Promise.resolve().then(action).catch(error => message(error.message, 'error'));
    });
    return element;
  }
  function contextMenu(element, label, actions) {
    element.addEventListener('contextmenu', event => api.showMenu(element, label, actions(), event));
    element.addEventListener('keydown', event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) api.showMenu(element, label, actions(), event);
    });
  }
  function renderDocuments(force = false) {
    if (!panel) return;
    const revision = api.revision() + JSON.stringify([[...reviewedVersions.keys()], [...sessions.keys()], [...uploading],workspace.sort]);
    if (!force && revision === documentRevision) return;
    if (!force && document.querySelector('.document-menu-dropdown.open')) return;
    documentRevision = revision;
    document.querySelectorAll('[data-cloud-panel-menu]').forEach(menu => menu.remove());
    const visible = [];
    if (entriesView && entriesView.isConnected) {
      entriesView.replaceChildren();
      const sortedEntries = entriesData.slice().sort((a,b) => Number(b.directory) - Number(a.directory) || (workspace.sort === 'desc' ? -1 : 1) * a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
      for (const entry of sortedEntries) {
        if (!entry.directory) {
          visible.push(entryClient.source(entry.ref));
          if (api.renderFile(entriesView, entryClient.source(entry.ref))) continue;
        }
        const open = async () => {
          if (activeClient !== entryClient) return;
          if (entry.directory) return browse(entryClient.folderRef(entry.ref));
          if (await api.activateRemote(entryClient.source(entry.ref))) return;
          const client = entryClient;
          const ticket = operation;
          message('Opening ' + entry.name + '…');
          const snapshot = await client.read(entry.ref);
          if (activeClient !== client || ticket !== operation) return;
          await api.openRemote(snapshot.content, entry.name, client.source(entry.ref,snapshot.version,{savedDigest:await model.digest(snapshot.content),status:'saved'}));
          message('');
        };
        const row = button(entry.name, open, entry.directory ? 'folder' : 'file-text');
        row.className = 'nextcloud-entry' + (entry.directory ? ' is-folder' : '');
        row.dataset.nextcloudHref = entry.ref; row.title = entry.name;
        const client=entryClient;
        contextMenu(row, entry.name, () => [
          { id:'open', icon:entry.directory ? 'lucide-folder-open' : 'lucide-file-text', label:'Open', run:open },
          ...(entry.directory ? [{id:'cloud-new',icon:'lucide-file-plus',label:'New Markdown file',disabled:!client.capabilities.create,run:() => newFile(client,entry.ref)}] :
            /\.md$/i.test(entry.name) ? [{id:'cloud-delete',icon:'lucide-trash-2',label:'Delete from cloud',danger:true,disabled:!client.capabilities.delete || Boolean(client.readOnlyReason?.(client.source(entry.ref,entry.version))),run:() => deleteRemote(client,entry.ref,entry.name)}] : [])
        ]);
        entriesView.append(row);
      }
    }
    draftsView.replaceChildren();
    const count = api.renderRecovery(draftsView, visible);
    draftsView.hidden = count === 0;
    if (count) {
      const label = document.createElement('p'); label.className = 'document-tree-section-label'; label.textContent = 'Local cloud drafts';
      draftsView.prepend(label);
    }
    updateVisibility();
  }
  function refresh() {
    if (!panel) return;
    renderDocuments();
    const tab = api.currentRemote();
    const source = tab?.remoteSource;
    panel.querySelectorAll('[data-nextcloud-href]').forEach(row => {
      const selected = Boolean(source && entryClient && activeClient===entryClient && providers.sameFile(source,entryClient.source(row.dataset.nextcloudHref)));
      row.classList.toggle('is-active', selected);
      if (selected) row.setAttribute('aria-current', 'page'); else row.removeAttribute('aria-current');
    });
  }
  function mount() {
    if (panel) { document.querySelector('#document-tree > .cloud-offline-section')?.remove(); document.getElementById('document-tree')?.append(panel); renderDocuments(true); refresh(); updateVisibility(); return true; }
    return false;
  }
  function sessionKey(source) {
    for(const profile of accounts.values()){if(source===profile || source===profile.client)return profile.client.account.key;}
    return providers.sessionKey(source);
  }
  function clientFor(source) {
    const client = sessions.get(sessionKey(source));
    if (!client) throw new Error('Connect to this cloud account again. Your local draft is available.');
    return client;
  }
  async function browse(href, client = activeClient) {
    if (!client || client !== activeClient) return;
    const ticket = ++operation;
    message('Loading folder…');
    const entries = await client.list(href);
    if (ticket !== operation || activeClient !== client) return;
    currentFolder = href;
    const profile = [...accounts.values()].find(item => item.client === client);
    if (profile) { accountState(profile.id).lastFolder = href; workspace.activeId = profile.id; await saveWorkspace(); }
    if (ticket !== operation || activeClient !== client) return;
    content.replaceChildren();
    const account = document.createElement('div');
    account.className = 'nextcloud-account';
    const server = document.createElement('span');
    server.textContent = client.account.label;
    const user = document.createElement('span');
    user.textContent = client.account.userLabel;
    account.title = client.account.label + '\n' + client.account.detail;
    account.append(icon('cloud-upload'), server, user);
    content.append(account);
    tools(); renderAccounts();
    const navigation = document.createElement('div');
    navigation.className = 'nextcloud-navigation';
    const path = document.createElement('div');
    path.className = 'nextcloud-path';
    path.textContent = client.locationLabel(href);
    path.title = path.textContent;
    contextMenu(path,'Cloud folder',()=>[{id:'cloud-new',icon:'lucide-file-plus',label:'New Markdown file',disabled:!client.capabilities.create,run:()=>newFile(client,href)}]);
    if (href !== client.root) {
      navigation.append(button('Up', () => browse(client.upRef(href)), 'chevron-up', true));
    }
    navigation.append(path);
    navigation.append(button('Add current folder to Cloud Workspace', pinFolder, 'folder-plus', true));
    content.append(navigation);
    entriesView = document.createElement('div'); entriesView.className = 'nextcloud-entries';
    entriesData = entries; entryClient = client;
    content.append(entriesView);
    renderDocuments(true);
    message(entries.length ? '' : 'No Markdown files or folders here.');
    api.statusChanged();
  }
  async function disconnect() {
    if (saves.size) throw new Error('Wait for the current Save to finish.');
    await api.flushDrafts();
    const profile = [...accounts.values()].find(item => item.client === activeClient);
    if (profile?.remembered) {
      if (!(await api.confirm('Forget this cloud account on this device? Saved access and folder shortcuts will be removed. Your local drafts and server files will be kept.', {
        title:'Forget cloud account?', confirmLabel:'Forget account', cancelLabel:'Keep account', focusCancel:true, dedupeKey:'cloud-forget:' + profile.id
      }))) return;
      if (saves.size) throw new Error('A cloud operation started while confirmation was open. Try again.');
      await platform.forgetAccount({ id: profile.id, providerId:profile.providerId });
    }
    if (profile && !profile.remembered && platform.releaseAccount) await platform.releaseAccount({id:profile.id,providerId:profile.providerId});
    ++operation;
    pendingLogin?.abort();
    pendingLogin = undefined;
    if (activeClient) {
      sessions.delete(sessionKey(activeClient));
      activeClient.disconnect();
    }
    activeClient = undefined;
    if (profile) {
      accounts.delete(profile.id);
      workspace.accounts = workspace.accounts.filter(item => item.id !== profile.id);
      if (workspace.activeId === profile.id) workspace.activeId = '';
      await saveWorkspace();
    }
    renderAccounts();
    content.replaceChildren(); entriesView = undefined; entriesData = []; entryClient = undefined;
    refresh(); updateVisibility();
    api.statusChanged();
    platform.keepAlive(sessions.size > 0);
    if (!accounts.size) { workspace.enabled=false; platform.setEnabled(false); await saveWorkspace(); await platform.stop(); updateVisibility(); }
    message('Disconnected. Local drafts were kept. App access can be revoked in your cloud account settings.');
  }
  function connectForm(providerId) {
    setupContent.replaceChildren(); settingsSummary.replaceChildren();
    if (platform.logout) {
      const notice=document.createElement('p');notice.className='nextcloud-note';notice.textContent=platform.accountNote;
      settingsSummary.append(notice,button(platform.logoutLabel || 'Sign out of self-hosted connector',async()=>{await api.flushDrafts();await platform.logout();},'log-out'));
    }
    platform.renderProfileControls?.(settingsSummary);
    for (const profile of accounts.values()) {
      const summary = document.createElement('div'); summary.className = 'cloud-settings-account';
      const title = document.createElement('strong'); title.textContent = profile.client.account.label;
      const detail = document.createElement('p'); detail.className = 'nextcloud-note'; detail.textContent = profile.client.account.detail + (profile.remembered ? ' · ' + (platform.rememberLabel || 'Remembered on this device') : ' · Session only');
      const open = button('Open files', async () => { workspace.hidden = false; workspace.collapsed = false; await saveWorkspace(); applyExpansion(); api.closeDialog(settingsModal); await activateAccount(profile); },'folder-open');
      const forget = button(profile.remembered ? 'Forget account' : 'Disconnect', async () => { api.closeDialog(settingsModal); activeClient = profile.client; await disconnect(); },'power');
      summary.append(title,detail,open,forget); settingsSummary.append(summary);
    }
    if (!accounts.size) settingsSummary.append(button('Load remembered accounts', async () => {
      workspace.enabled=true; platform.setEnabled(true); await saveWorkspace(); updateVisibility(); await loadRemembered(true); connectForm();
    },'refresh-cw'));
    const form = document.createElement('form');
    const available=providers.list();
    const selector=document.createElement('select'); selector.id='cloud-provider';
    const providerLabel=document.createElement('label');providerLabel.htmlFor=selector.id;providerLabel.textContent='Cloud provider'; selector.setAttribute('aria-label','Cloud provider');
    for(const candidate of available){const option=document.createElement('option');option.value=candidate.id;option.textContent=candidate.label;selector.append(option);}
    if(typeof providerId==='string' && available.some(item=>item.id===providerId))selector.value=providerId;
    const provider=providers.get(selector.value);
    selector.disabled=available.length===1;
    const fields=document.createElement('div'); fields.className='cloud-connection-fields';
    const inputs=new Map();
    for(const field of provider.connectionFields){
      const label=document.createElement('label');label.htmlFor=field.legacyId || 'cloud-'+field.id;label.textContent=field.label;
      const input=document.createElement('input');input.id=label.htmlFor;input.type=field.type || 'text';input.required=field.required!==false;if(field.maxLength)input.maxLength=field.maxLength;input.placeholder=field.placeholder || '';input.autocomplete=field.autocomplete || 'off';
      inputs.set(field.id,input);fields.append(label,input);
    }
    const input=[...inputs.values()].find(input=>input.required) || inputs.values().next().value;
    const connect=document.createElement('button');connect.type='submit';connect.className='nextcloud-button nextcloud-primary';
    connect.append(icon('cloud-upload'),document.createTextNode('Connect to '+provider.label));
    selector.addEventListener('change',()=>{pendingLogin?.abort();pendingLogin=undefined;connectForm(selector.value);});
    if (!target.MarkdownCloudPlatform?.available()) {
      connect.disabled = true;
      message('The cloud connection extension is unavailable.');
    }
    const cancel = button('Cancel connection', () => { if(pendingLogin?.finishing)return; ++operation; pendingLogin?.abort(); pendingLogin = undefined; connect.disabled = false; selector.disabled=available.length===1;for(const input of inputs.values())if(input.type==='password')input.value=''; message('Connection cancelled.'); });
    const note = document.createElement('p');
    note.className = 'nextcloud-note';
    note.textContent = provider.connectionNote + ' Drafts are kept locally in Cloud Workspace; uploads require your confirmation.' +
      (secureAccountsAvailable() ? ' ' + (platform.credentialNote || 'Remembered access is protected by Windows Credential Manager.') : '');
    const rememberLabel = document.createElement('label');
    rememberLabel.className = 'cloud-remember';
    const remember = document.createElement('input');
    remember.type = 'checkbox';
    remember.id = 'nextcloud-remember';
    remember.checked = secureAccountsAvailable() && platform.rememberDefault !== false;
    remember.disabled = !secureAccountsAvailable();
    rememberLabel.append(remember, document.createTextNode(platform.rememberLabel || 'Remember account on this device'));
    if (!secureAccountsAvailable()) rememberLabel.title = platform.rememberUnavailable || 'Requires a platform adapter with secure credential storage.';
    form.append(providerLabel, selector, fields, rememberLabel, connect, cancel, note);
    cancel.hidden = true;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pendingLogin) return;
      const controller = new AbortController();
      pendingLogin = controller;
      connect.disabled = true; selector.disabled=true;
      cancel.hidden = false;
      message(provider.connectingMessage || 'Complete login in your browser…');
      try {
        workspace.enabled=true; platform.setEnabled(true); await saveWorkspace(); updateVisibility();
        const client = await provider.connect(Object.fromEntries([...inputs].map(([id,input])=>[id,input.value])),platform,url=>platform.openBrowser ? platform.openBrowser(url) : target.Neutralino.os.open(url),controller.signal);
        if (controller.signal.aborted) { client.disconnect(); return; }
        // Authentication is complete. Finalizing secure storage cannot be undone
        // by closing the dialog; Cancel is available only before this boundary.
        controller.finishing=true;cancel.hidden=true;
        for(const input of inputs.values())if(input.type==='password')input.value='';
        message('Finishing connection…');
        let id = await client.accountId();
        let remembered = false;
        let rememberError = '';
        if (remember.checked) {
          try {
            await client.remember(account => platform.storeAccount(account));
            remembered = true;
          } catch (error) {
            rememberError = 'Connected for this session, but the account could not be remembered. ' + error.message;
          }
        }
        const previous = accounts.get(id);
        if (previous?.remembered && !remember.checked) await (platform.forgetRememberedAccount || platform.forgetAccount)({ id, providerId:provider.id });
        if (previous && previous.client !== client) previous.client.disconnect();
        accounts.set(id, { id, providerId:provider.id, client, remembered });
        accountState(id).providerId=provider.id;
        workspace.activeId = id;
        sessions.set(sessionKey(client), client); platform.keepAlive(true);
        if(activeClient!==client)resetBrowser();
        activeClient = client;
        workspace.hidden = false; workspace.collapsed = false; applyExpansion();
        await browse(accountState(id).lastFolder || client.root);
        api.closeDialog(settingsModal);
        if (rememberError) message(rememberError, 'error');
      } catch (error) { if (!controller.signal.aborted) message(error.message, 'error'); }
      finally {
        if (pendingLogin === controller) pendingLogin = undefined;
        connect.disabled = false; selector.disabled=available.length===1;
        for(const input of inputs.values())if(input.type==='password')input.value='';
        cancel.hidden = true;
      }
    });
    setupContent.append(form);
    api.openDialog(settingsModal,input,closeSettings);
  }
  function closeSettings() {
    if(!pendingLogin?.finishing){++operation;pendingLogin?.abort();pendingLogin=undefined;}
    setupContent?.querySelectorAll('input[type="password"]').forEach(input=>input.value='');
    api.closeDialog(settingsModal);
  }
  function init(editorApi) {
    if (panel || !target.MarkdownCloudPlatform?.available()) return;
    api = editorApi;
    platform = target.MarkdownCloudPlatform.create();
    platform.bindIdentity?.({flush:api.flushIdentityDrafts || api.flushDrafts,preserve:api.preserveIdentityDrafts,isBusy:()=>Boolean(pendingLogin) || saves.size>0 || uploading.size>0});
    platform.setEnabled(false);
    operations=target.MarkdownCloudOperations.create({api,sessions,saves,uploading,reviewedVersions,sessionKey,clientFor,accountState,saveWorkspace,browse,message,refresh,
      get activeClient(){return activeClient;},get currentFolder(){return currentFolder;},get workspace(){return workspace;},isHidden:()=>body.hidden || panel.offsetParent===null});
    copyOperations=target.MarkdownCloudCopy.create({api,saves,clients:()=>workspace.enabled?[...sessions.values()]:[],connect:connectForm,refresh});
    panel = document.createElement('section');
    panel.id = 'nextcloud-panel';
    panel.className = 'nextcloud-panel';
    panel.setAttribute('aria-label', 'Cloud Workspace');
    const heading = document.createElement('div');
    heading.className = 'nextcloud-heading';
    body = document.createElement('div');
    body.id = 'nextcloud-body';
    body.className = 'nextcloud-body';
    disclosure = button('Cloud Workspace', async () => {
      workspace.collapsed = !body.hidden; applyExpansion(); await saveWorkspace();
    }, 'chevron-down');
    disclosure.className = 'nextcloud-disclosure';
    disclosure.setAttribute('aria-expanded', 'true');
    disclosure.setAttribute('aria-controls', body.id);
    disclosure.insertBefore(icon('cloud-upload'), disclosure.lastChild);
    accountTools = document.createElement('div');
    accountTools.className = 'nextcloud-tools';
    heading.append(disclosure, accountTools);
    contextMenu(heading, 'Cloud Workspace', () => [
      { id:'add-account', icon:'lucide-plus', label:'Manage cloud connections', run:() => connectForm() },
      ...(activeClient && sessions.has(sessionKey(activeClient)) ? [{id:'cloud-new',icon:'lucide-file-plus',label:'New Markdown file',disabled:!activeClient.capabilities.create,run:()=>newFile(activeClient,currentFolder || activeClient.root)}] : []),
      { id:'hide-cloud', icon:'lucide-eye-off', label:'Hide from Explorer', run:async () => { workspace.hidden = true; await saveWorkspace(); updateVisibility(); api.notify('Cloud Workspace hidden. Show it again from Settings → Cloud connections.'); } }
    ]);
    status = document.createElement('div');
    status.id = 'nextcloud-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    content = document.createElement('div');
    content.className = 'nextcloud-browser';
    accountList = document.createElement('div');
    accountList.className = 'cloud-accounts';
    draftsView = document.createElement('div'); draftsView.className = 'cloud-local-drafts';
    body.append(accountList, draftsView, status);
    panel.append(heading, body);
    panel.addEventListener('keydown', event => {
      if (event.target.tagName === 'INPUT' && !event.ctrlKey && !event.metaKey) event.stopPropagation();
    });
    settingsModal = document.createElement('div'); settingsModal.id = 'cloud-settings-modal';
    settingsModal.className = 'reset-modal-overlay modal-overlay'; settingsModal.style.display = 'none';
    settingsModal.setAttribute('role','dialog'); settingsModal.setAttribute('aria-modal','true'); settingsModal.setAttribute('aria-hidden','true'); settingsModal.setAttribute('aria-labelledby','cloud-settings-title');
    settingsModal.innerHTML = '<div class="reset-modal-box reset-modal-box--wide app-modal-box modal-box cloud-settings-dialog"><div class="modal-header"><p id="cloud-settings-title" class="reset-modal-message">Cloud connections</p><button type="button" class="modal-close-btn" aria-label="Close cloud connections"><i class="lucide lucide-x" aria-hidden="true"></i></button></div><div class="modal-body"><p class="nextcloud-note">Connect a cloud account to browse Markdown files and keep local recovery drafts.</p><label class="cloud-sidebar-choice"><input type="checkbox" id="cloud-enabled"> Enable cloud connections on this device</label><label class="cloud-sidebar-choice"><input type="checkbox" id="cloud-auto-connect"> Reconnect remembered accounts when the application starts</label><label class="cloud-sidebar-choice"><input type="checkbox" id="cloud-sidebar-visible"> Show Cloud Workspace in Explorer when accounts or drafts are available</label><div class="cloud-settings-accounts"></div><div class="cloud-setup-content"></div><p class="cloud-setup-status nextcloud-note" role="status" aria-live="polite"></p></div><div class="reset-modal-actions"><button type="button" class="reset-modal-btn reset-modal-cancel">Close</button></div></div>';
    document.body.append(settingsModal);
    setupContent = settingsModal.querySelector('.cloud-setup-content'); setupStatus = settingsModal.querySelector('.cloud-setup-status'); settingsSummary = settingsModal.querySelector('.cloud-settings-accounts');
    enabledToggle = settingsModal.querySelector('#cloud-enabled');
    automaticToggle = settingsModal.querySelector('#cloud-auto-connect');
    enabledToggle.addEventListener('change', () => {
      enabledToggle.disabled=true;
      void setCloudEnabled(enabledToggle.checked).catch(error => message(error.message,'error')).finally(() => { enabledToggle.disabled=false; updateVisibility(); });
    });
    automaticToggle.addEventListener('change', () => { workspace.autoConnect=automaticToggle.checked; void saveWorkspace().catch(error => message(error.message,'error')); });
    visibilityToggle = settingsModal.querySelector('#cloud-sidebar-visible'); visibilityToggle.checked = true;
    visibilityToggle.addEventListener('change', () => { workspace.hidden = !visibilityToggle.checked; void saveWorkspace().catch(error => message(error.message,'error')); updateVisibility(); });
    settingsModal.querySelectorAll('.modal-close-btn,.reset-modal-cancel').forEach(control => control.addEventListener('click', closeSettings));
    const settingsButton = document.getElementById('cloud-connections-button');
    if (settingsButton) { settingsButton.hidden = false; settingsButton.addEventListener('click',connectForm); }
    mount(); tools();
    platform.onDisconnect(() => {
      ++connectionEpoch; ++operation; sessions.clear(); platform.keepAlive(false);
      renderAccounts(); api.statusChanged();
      message('Cloud connection service stopped. Local drafts were kept; use Reconnect to continue.', 'error');
    });
    void restoreWorkspace();
  }
  function can(source,capability){try {const client=clientFor(source);if(capability==='delete')client.validateFile(providers.normalizeSource(source).fileRef);if(['delete','conditionalSave'].includes(capability) && client.readOnlyReason?.(providers.normalizeSource(source)))return false;return Boolean(client.capabilities[capability]);}catch(_){return false;}}
  function report(operation) { return (...args) => void Promise.resolve().then(() => operation(...args)).catch(error => message(error.message, 'error')); }
  target.MarkdownCloudUI = Object.freeze({ init, save, mount, refresh, newForDocument:report(newForDocument), remove:report(remove),
    copyLocal:descriptor=>Promise.resolve().then(()=>copyOperations.open(descriptor)).catch(error=>{message(error.message,'error');api.notify(error.message,true);}),
    check:report(checkActive), resolve:report(resolveActive), reload:report(reloadRemote),
    readOnlyReason:source=>{try{return clientFor(source).readOnlyReason?.(providers.normalizeSource(source)) || '';}catch(_){return '';}},
    canDelete:source=>can(source,'delete'), canCreate:source=>can(source,'create'), canSave:source=>can(source,'conditionalSave'),
    canResolve: id => reviewedVersions.has(id), isBusy:id => saves.has(id), isUploading:id => uploading.has(id),
    canAccess: source => can(source,'read'), available:() => Boolean(panel) });
})(globalThis);
