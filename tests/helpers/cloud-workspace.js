const { expect } = require('@playwright/test');
const { openApp, storedDocuments } = require('./app');
const { installDesktopFilesystem } = require('./desktop-filesystem');
const base = 'https://personal-cloud.example/subdir';
const root = base + '/remote.php/dav/files/alice/';
async function openConnections(page) {
  await page.getByRole('button', {name:'Open workspace settings',exact:true}).click();
  await page.locator('#cloud-connections-button').click();
}
async function cloudMenu(page) {
  const id = await page.locator('#tab-list .tab-item.active').getAttribute('data-tab-id');
  await page.locator('#nextcloud-panel [data-cloud-document="' + id + '"]').dispatchEvent('contextmenu', { clientX:150, clientY:250 });
}
async function cloudAction(page, name) {
  await cloudMenu(page);
  await page.locator('.document-menu-dropdown.open').getByRole('menuitem', { name, exact:true }).click();
  if (name === 'Save to cloud') {
    await expect.poll(async () => (await page.locator('#linked-confirm-modal').getAttribute('aria-hidden')) === 'false' || (await page.locator('#nextcloud-status').textContent()).includes('before saving again')).toBe(true);
    if (await page.locator('#linked-confirm-modal').getAttribute('aria-hidden') === 'false') {
      await expect(page.locator('#linked-confirm-modal-cancel')).toBeFocused();
      await page.locator('#linked-confirm-modal-confirm').click();
    }
  }
}
async function setup(page, options = {}) {
  if(options.webdav){let serverFiles;await page.exposeFunction('__webdavServerLoad',()=>serverFiles);await page.exposeFunction('__webdavServerSave',files=>{serverFiles=files;});}
  if (options.secure) {
    const remembered = new Map();
    await page.exposeFunction('__nativeAccountStore', account => {
      remembered.set(account.id, { ...account });
      return account.providerId==='webdav' ? {providerId:'webdav',id:account.id,root:account.root,username:account.username,label:account.label} : {id:account.id,server:account.server,userId:account.userId};
    });
    await page.exposeFunction('__nativeAccountList', () => [...remembered.values()].map(account=>account.providerId==='webdav'?{providerId:'webdav',id:account.id,root:account.root,username:account.username,label:account.label}:{id:account.id,server:account.server,userId:account.userId}));
    await page.exposeFunction('__nativeAccountForget', ({ id }) => remembered.delete(id));
  }
  await page.addInitScript(({ base, root, options }) => {
    window.NL_OS = 'Windows';
    window.NL_TOKEN='fixture.token'; window.NL_PORT=1; window.NL_PATH='C:/fixture';
    window.__helperStopped=true; window.__helperStarts=0; window.__helperCalls=[];

    window.__cloud = { folders:[], content: '# Original', etag: '"v1"', requests: [], mode: '', browser: [], files:{}, notesDeleted:false, headerMode: options.headerMode || 'strong' };
    if(options.webdav){
      const davRoot='https://dav.example/storage/Selected%20folder/';
      Object.assign(__cloud,{webdavRoot:davRoot,webdavFiles:{[davRoot+'notes.md']:{content:'# WebDAV original',etag:'"dav1"'}},webdavFolders:[davRoot,davRoot+'Nested/'],webdavMode:'',webdavVersionMode:''});
    }
    const previous = window.Neutralino || {};
    window.Neutralino = {
      ...previous,
      storage: previous.storage || { getData:async()=>{throw new Error('missing');}, setData:async()=>{} },
      os: { ...previous.os, spawnProcess: async () => {window.__helperStarts++; window.__helperStopped=false; return {id:1,pid:100};}, updateSpawnedProcess:async()=>{}, open: async url => window.__cloud.browser.push(url) },
      net: { request: async (url, method, options) => {
        const state = window.__cloud;
        state.requests.push({ url, method, headers: options.headers, credentialId: options.credentialId || '' });
        const reply = (status, body = '', headers = {}) => ({ status, body, headers, webdavTransportVersion: 1 });
        if(state.webdavRoot && url.startsWith(state.webdavRoot)) {
          if(!state.webdavLoaded){const stored=await window.__webdavServerLoad();if(stored)state.webdavFiles=stored;state.webdavLoaded=true;}
          const davRoot=state.webdavRoot, item=state.webdavFiles[url], folder=state.webdavFolders.includes(url);
          const account=options.credentialId?(await window.__nativeAccountList()).find(account=>account.id===options.credentialId):null;
          if((options.credentialId && (!account || account.providerId!=='webdav' || account.root!==davRoot)) || (!options.credentialId && (options.auth?.username!=='davuser' || options.auth?.password!=='dav-secret')))return reply(401);
          if(state.webdavMode==='redirect')return reply(302,'',{Location:'https://foreign.example/dav/'});
          const version=value=>state.webdavVersionMode==='missing'?'':state.webdavVersionMode==='weak'?'W/'+value:value;
          if(method==='PROPFIND') {
            if(state.webdavMode==='slow-connect')await new Promise(resolve=>state.finishProbe=resolve);
            if(state.webdavMode==='xml-entity')return reply(207,'<!DOCTYPE x [<!ENTITY payload SYSTEM "file:///secret">]><d:multistatus xmlns:d="DAV:"/>');
            if(!folder && !item)return reply(404);
            let records=options.headers.Depth==='0'?[[url,item,folder]]:[
              [url,null,true],...state.webdavFolders.filter(href=>href!==url && href.startsWith(url)).map(href=>[href,null,true]),
              ...Object.entries(state.webdavFiles).filter(([href])=>href.startsWith(url)).map(([href,value])=>[href,value,false])
            ];
            if(state.webdavMode==='foreign-href')records.push(['https://foreign.example/notes.md',item,false]);
            const encoded=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;');
            return reply(207,'<d:multistatus xmlns:d="DAV:">'+records.map(([href,value,isFolder])=>'<d:response><d:href>'+encoded(href)+'</d:href><d:propstat><d:prop><d:resourcetype>'+(isFolder?'<d:collection/>':'')+'</d:resourcetype><d:getetag>'+encoded(version(value?.etag || ''))+'</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>').join('')+'</d:multistatus>');
          }
          if(method==='MKCOL'){if(folder || item)return reply(412);state.webdavFolders.push(url);return reply(201);}
          if(method==='PUT') {
            if(options.headers['If-None-Match']==='*') {if(item || folder)return reply(412);}
            else if(!item || options.headers['If-Match']!==item.etag)return reply(412);
            state.webdavFiles[url]={content:options.body,etag:item?'"dav2"':'"dav-created"'};
            await window.__webdavServerSave(state.webdavFiles);
            if(state.webdavMode==='lost-save')throw new Error('synthetic lost WebDAV acknowledgement');
            return reply(item?204:201);
          }
          if(method==='DELETE') {
            if(!item)return reply(404);
            if(options.headers['If-Match']!==item.etag)return reply(412);
            delete state.webdavFiles[url];await window.__webdavServerSave(state.webdavFiles);
            if(state.webdavMode==='lost-delete')throw new Error('synthetic lost deletion acknowledgement');
            return reply(204);
          }
          if(!item)return reply(404);
          if(options.headers['If-Match'] && options.headers['If-Match']!==item.etag)return reply(412);
          return reply(200,item.content,state.webdavVersionMode==='missing'?{}:{ETag:version(item.etag)});
        }
        if (url === base + '/index.php/login/v2') return reply(200, JSON.stringify({ login: base + '/login', poll: { token: 'poll-secret', endpoint: base + '/poll' } }));
        if (url === base + '/poll') return reply(200, JSON.stringify({ server: base, loginName: (state.loginUser || 'alice') + '@example.com', appPassword: 'app-secret' }));
        let userId = options.auth?.username?.split('@')[0] || 'alice';
        if (options.credentialId) userId = (await window.__nativeAccountList()).find(account => account.id === options.credentialId)?.userId || 'alice';
        if (url.includes('/ocs/v2.php/cloud/user')) return reply(200, JSON.stringify({ ocs: { data: { id: userId } } }));
        const davRoot = base + '/remote.php/dav/files/' + userId + '/';
        if (method === 'PROPFIND' && options.headers.Depth === '1' && state.listing) return reply(207,'<d:multistatus xmlns:d="DAV:">' + state.listing.map(name => '<d:response><d:href>' + davRoot + name + '</d:href><d:propstat><d:prop><d:resourcetype>' + (name.endsWith('/') ? '<d:collection/>' : '') + '</d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>').join('') + '</d:multistatus>');
        const target = url === davRoot+'notes.md' ? (state.notesDeleted ? null : {content:state.content,etag:state.etag}) : state.files[url];
        if(method==='MKCOL'){if(state.folders.includes(url) || target)return reply(412);state.folders.push(url);return reply(201);}
        if(method==='PROPFIND' && state.folders.includes(url)){return reply(207,'<d:multistatus xmlns:d="DAV:"><d:response><d:href>'+url+'</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>');}
        if (method === 'PROPFIND') {
          const records = options.headers.Depth === '0' ? (target ? [[url,target]] : []) : [
            ...(!state.notesDeleted ? [[davRoot+'notes.md',{etag:state.etag}]] : []),
            ...Object.entries(state.files).filter(([href])=>new URL(href).pathname.startsWith(new URL(url).pathname))
          ];
          if (options.headers.Depth==='0' && !records.length) return reply(404);
          return reply(207,'<d:multistatus xmlns:d="DAV:">'+records.map(([href,item])=>'<d:response><d:href>'+href+'</d:href><d:propstat><d:prop><d:resourcetype>'+(state.mode==='collection'?'<d:collection/>':'')+'</d:resourcetype><d:getetag>'+item.etag+'</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>').join('')+'</d:multistatus>');
        }
        if (method==='PUT' && options.headers['If-None-Match']==='*') {
          if(target || state.mode==='create-race')return reply(412);
          state.files[url]={content:options.body,etag:'"created"'};
          if(state.mode==='copy-blocked')await new Promise(resolve=>state.finishCreate=resolve);
          if(state.mode==='lost-create')throw new Error('lost create acknowledgement');
          return reply(201);
        }
        if(method==='DELETE') {
          if(!target)return reply(404);
          if(options.headers['If-Match']!==target.etag || state.mode==='delete-race')return reply(412);
          if(url===davRoot+'notes.md')state.notesDeleted=true;else delete state.files[url];
          if(state.mode==='lost-delete')throw new Error('lost delete acknowledgement');
          return reply(204);
        }
        if (method === 'PUT') {
          if (state.mode === 'lost-before-write') throw new Error('synthetic connection loss before remote commit');
          if (state.mode === 'slow') await new Promise(resolve => state.finishPut = resolve);
          if (options.headers['If-Match'] !== state.etag) return reply(412);
          state.content = options.body;
          state.etag = '"v2"';
          if (state.mode === 'lost') throw new Error('lost response');
          return reply(204);
        }
        if (!target) return reply(404);
        if (url !== davRoot+'notes.md') return reply(200,target.content,{ETag:target.etag});
        if (state.mode === 'denied-read') return reply(403);
        if (state.mode === 'missing-read') return reply(404);
        if (options.headers['If-Match'] && state.mode === 'read-race') { state.etag = '"raced"'; state.content = '# Changed while reading'; }
        if (options.headers['If-Match'] && options.headers['If-Match'] !== state.etag) return reply(412);
        return reply(200, state.content, state.headerMode === 'missing' ? {} : { ETag: state.headerMode === 'weak' ? 'W/' + state.etag : state.etag });
      } }
    };
    const fakeRequest = window.Neutralino.net.request;
    delete window.Neutralino.net;
    delete window.Neutralino.custom;
    const listeners = new Map();
    window.Neutralino.events = { on: async (event, listener) => { listeners.set(event, listener); } };
    window.Neutralino.extensions = { getStats: async () => ({ loaded:['com.markdownviewer.cloud'], connected:window.__helperStopped?[]:['com.markdownviewer.cloud'] }), dispatch: async (extension, event, call) => {
      if (extension !== 'com.markdownviewer.cloud' || event !== 'cloudRequest') throw new Error('Invalid extension request');
      window.__helperCalls.push(call.operation);
      let returnValue;
      if (call.operation === 'capabilities') returnValue = {version:5,providerIds:['nextcloud','webdav'],conditionalWrites:true,requestDeadlineMs:35000};
      else if (call.operation === 'shutdown') returnValue = true;
      else if (call.operation === 'request') {
        const input = call.input;
        returnValue = await fakeRequest(input.url, input.method, {
          ...input, credentialId: input.auth?.credentialId,
          maxResponseBytes: input.maxBytes
        });
        returnValue.transportVersion = 1;
      } else if (call.operation === 'accountStore') {if(window.__cloud.webdavMode==='slow-remember')await new Promise(resolve=>window.__cloud.finishRemember=resolve);returnValue = await window.__nativeAccountStore(call.input);}
      else if (call.operation === 'accountList') returnValue = options.secure ? await window.__nativeAccountList() : [];
      else if (call.operation === 'accountForget') returnValue = await window.__nativeAccountForget(call.input);
      listeners.get('cloudResponse')({ detail: { id: call.id, returnValue } });
      if(call.operation==='shutdown') { window.__helperStopped=true; listeners.get('extClientDisconnect')?.({detail:'com.markdownviewer.cloud'}); }
    } };
    if (options.secure) {
      window.Neutralino.storage = {
        getData: async key => { const value = localStorage.getItem('__nativeMetadata:' + key); if (value === null) throw new Error('missing'); return value; },
        setData: async (key, value) => localStorage.setItem('__nativeMetadata:' + key, value)
      };
    }
  }, { base, root, options });
  await openApp(page);
  if (options.connect === false) return;
  if (options.legacySnapshot) await page.evaluate(() => {
    const read = MarkdownNextcloud.Client.prototype.read;
    let first = true;
    MarkdownNextcloud.Client.prototype.read = async function(...args) {
      const result = await read.apply(this, args);
      if (first) { first = false; return { ...result, etag: '' }; }
      return result;
    };
  });
  await expect(page.locator('#nextcloud-panel')).toBeHidden();
  await openConnections(page);
  await page.locator('#nextcloud-server').fill(base);
  if (!options.secure) await page.getByLabel('Remember account on this device').uncheck();
  await page.getByRole('button', { name: 'Connect to Nextcloud', exact: true }).click();
  await page.locator('#nextcloud-panel').getByRole('button', { name: 'notes.md', exact: true }).click();
  await expect(page.locator('#markdown-editor')).toHaveValue('# Original');
}

module.exports={setup,openConnections,cloudMenu,cloudAction,base,root};
