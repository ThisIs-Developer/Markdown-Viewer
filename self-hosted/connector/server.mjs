import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { DOMParser } from '@xmldom/xmldom';
import { MAX, fail, hash, passwordHash, equal, remoteURL, targetFor, upstream, validateConfig } from './security.mjs';
import { openVault } from './vault.mjs';
import { openProfiles } from './profiles.mjs';
import { environmentConfiguration } from './settings.mjs';
import { versionStylesAndScripts } from './static-versions.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const context=vm.createContext({URL,TextEncoder,DOMParser:class extends DOMParser {constructor(){super({onError:()=>{throw fail('Malformed DAV response.',502);}});}}});
vm.runInContext(await readFile(path.join(project,'webdav-source.js'),'utf8'),context);
const dav=context.MarkdownWebDAV;
const metadata=record=>record.providerId==='nextcloud'?{providerId:'nextcloud',id:record.id,server:record.server,userId:record.userId}:{providerId:'webdav',id:record.id,root:record.root,username:record.username,label:record.label};
const secret=()=>randomBytes(32).toString('base64url');
const types={'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.md':'text/markdown; charset=utf-8','.webmanifest':'application/manifest+json'};
const allowedFiles=new Set(['index.html','404.html','script.js','styles.css','workspace-storage.js','visual-settings-adapters.js','visual-settings-store.js','native-markdown-source.js','cloud-model.js','cloud-providers.js','cloud-platform.js','cloud-copy.js','cloud-workspace.js','cloud-operations.js','nextcloud-source.js','nextcloud-provider.js','nextcloud-ui.js','webdav-source.js','webdav-provider.js','preview-worker.js','manifest.json','RELEASE_NOTES','sample.md','robots.txt','sitemap.xml','sw.js']);
async function jsonBody(req,limit=MAX+65536) {
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))throw fail('JSON requests are required.',415);
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw fail('Request exceeds the limit.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('Invalid JSON.');}
}
export async function createConnector({config,key,dataDirectory,rootDirectory=project,transport=upstream}) {
  validateConfig(config);
  const indexHTML=await versionStylesAndScripts(await readFile(path.join(rootDirectory,'index.html'),'utf8'),rootDirectory);
  const persistent=config.enabled!==false && config.remember!==false;
  const multi=config.mode==='multi-user';
  const profiles=config.enabled!==false && (multi || config.rememberDevice)?await openProfiles(dataDirectory,key,{maxProfiles:config.maxProfiles || 100}):null;
  const personal=multi?null:{id:'personal-owner',kind:'personal',name:config.owner?.username || 'owner',generation:config.owner?.deviceVersion || hash(JSON.stringify(config.owner || {}))};
  const vault=persistent && !multi?await openVault(dataDirectory,key,config.owner.username):{get:()=>undefined,list:()=>[],put:async()=>{throw fail('Remembering connections is disabled.',403);},remove:async()=>{}};
  const sessions=new Map(),attempts=new Map();
  const publicOrigin=config.origin?new URL(config.origin):null,cookieName=config.development?'mv_connector':'__Host-mv_connector';
  const activeRequests=new Set();
  const deviceName=config.development?'mv_cloud_device':'__Host-mv_cloud_device';
  const cookie=(req,name)=>(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
  const setCookie=(res,name,value,maxAge)=>{const wire=name+'='+value+'; Path=/; HttpOnly; SameSite=Strict'+(config.development?'':'; Secure')+(maxAge===undefined?'':'; Max-Age='+maxAge);const previous=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[...(Array.isArray(previous)?previous:previous?[previous]:[]),wire]);};
  const identity=principal=>({id:principal.id,kind:principal.kind,name:principal.name});
  const emptyVault={get:()=>undefined,list:()=>[],put:async()=>{throw fail('Create or sign in to a profile before remembering connections.',403);},remove:async()=>{}};
  const vaultFor=session=>!multi?vault:persistent && session.principal.kind==='profile'?profiles.vault(session.principal.id):emptyVault;
  function throttle(req,type,limit){const now=Date.now();for(const [key,item] of attempts)if(item.until<now)attempts.delete(key);const key=type+':'+req.socket.remoteAddress;const bucket=attempts.get(key) || {count:0,until:now+60000};if(attempts.size>=1000 && !attempts.has(key))throw fail('Authentication is busy.',429);attempts.set(key,bucket);if(++bucket.count>limit)throw fail('Too many attempts. Wait a minute.',429);const globalKey=type+':global',global=attempts.get(globalKey) || {count:0,until:now+60000};attempts.set(globalKey,global);if(++global.count>limit*4)throw fail('Authentication is busy.',429);}
  function newSession(req,res,principal){const now=Date.now();for(const [id,item] of sessions)if(item.expires<now || item.created+86400000<now)sessions.delete(id);if(sessions.size>=(multi?256:16))throw fail('Session limit reached. Try later.',429);const token=secret(),session={principal,created:now,expires:now+1800000,csrf:secret(),accounts:new Map(),logins:new Map(),busy:false};sessions.set(hash(token),session);setCookie(res,cookieName,token);return session;}
  function revokeSession(req){const token=cookie(req,cookieName);if(token)sessions.delete(hash(token));}
  function assertScope(req,session){if(multi && req.headers['x-mv-workspace']!==session.principal.id)throw Object.assign(fail('The active profile changed. Reload this tab; its drafts were kept.',409),{code:'IDENTITY_CHANGED'});}
  function assertSwitchable(session){if(session?.busy || session?.logins.size)throw fail('Finish or cancel the current cloud operation before switching profiles.',409);}
  const reply=(res,status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
  const validHost=req=>{const host=req.headers.host;if(typeof host!=='string' || host.length>255 || /[\\/\s@,#?]/.test(host))throw fail('Host was refused.',403);let url;try{url=new URL('https://'+host);}catch{throw fail('Host was refused.',403);}if(url.host!==host || (publicOrigin && host!==publicOrigin.host))throw fail('Host was refused.',403);return host;};
  const checkOrigin=req=>{const host=validHost(req);let origin;try{origin=new URL(req.headers.origin);}catch{throw fail('Request origin was refused.',403);}if(origin.origin!==req.headers.origin || origin.host!==host || (publicOrigin && origin.origin!==config.origin) || (origin.protocol!=='https:' && !(config.development && origin.protocol==='http:' && ['localhost','127.0.0.1'].includes(origin.hostname))) || (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site'])))throw fail('Request origin was refused.',403);};
  function getSession(req,res) {
    const raw=cookie(req,cookieName),existing=raw && sessions.get(hash(raw)),now=Date.now();
    if(existing && existing.expires>=now && existing.created+86400000>=now){existing.expires=now+1800000;return existing;}
    if(raw)sessions.delete(hash(raw));
    if(config.rememberDevice && profiles){const token=cookie(req,deviceName),owner=profiles.restore(token,personal);if(owner && owner.kind===(multi?'profile':'personal')){setCookie(res,deviceName,token,30*86400);return newSession(req,res,owner);}}
    throw fail('Your connector session expired. Sign in again; local drafts were kept.',401);
  }
  function account(session,id,providerId) {const record=session.accounts.get(id) || vaultFor(session).get(id);if(!record || record.providerId!==providerId)throw fail('Reconnect this account.',403);targetFor(config,record.providerId,record.targetRoot);return record;}
  const rootOf=r=>r.providerId==='nextcloud'?r.server+'/remote.php/dav/files/'+encodeURIComponent(r.userId)+'/':r.root;
  const authenticate=r=>({username:r.providerId==='nextcloud'?r.loginName:r.username,password:r.appPassword});
  async function perform(record,url,method,options={}) {const target=targetFor(config,record.providerId,record.targetRoot);return transport(target,url,method,{...options,auth:authenticate(record)});}
  async function connectWebDAV(session,values) {
    const target=targetFor(config,'webdav',values.root),root=target.root,username=values.username;
    if(typeof username!=='string' || !username || username.includes(':') || /[\u0000-\u001f\u007f]/.test(username) || Buffer.byteLength(username)>512 || typeof values.password!=='string' || !values.password || /[\u0000-\u001f\u007f]/.test(values.password) || Buffer.byteLength(values.password)>4096)throw fail('Enter a valid WebDAV username and app password.');
    const label=String(values.label || '').trim();if(label.length>80 || /[\u0000-\u001f\u007f]/.test(label))throw fail('Invalid connection label.');
    const record={providerId:'webdav',id:'webdav-'+hash(JSON.stringify(['webdav',root,username])),root,username,label,appPassword:values.password,targetRoot:root};
    const client=new dav.Client(root,input=>perform(record,input.url,input.method,input),{});await client.identify();
    if(session.accounts.size>=20 && !session.accounts.has(record.id))throw fail('Account limit reached.');session.accounts.set(record.id,record);return metadata(record);
  }
  async function nextcloudStart(session,values) {
    const target=targetFor(config,'nextcloud',values.server),server=target.root.replace(/\/$/,'');
    const response=await transport(target,server+'/index.php/login/v2','POST',{maxBytes:256*1024});dav.checked(response,[200]);const flow=JSON.parse(response.body);
    const login=remoteURL(flow.login),endpoint=remoteURL(flow.poll?.endpoint);
    if(login.origin!==new URL(server).origin || endpoint.origin!==login.origin || login.search || endpoint.search || !login.pathname.startsWith(new URL(target.root).pathname) || !endpoint.pathname.startsWith(new URL(target.root).pathname) || typeof flow.poll?.token!=='string' || flow.poll.token.length>4096)throw fail('Unexpected Nextcloud login response.',502);
    for(const [id,flow] of session.logins)if(flow.expires<Date.now())session.logins.delete(id);
    if(session.logins.size>=3)throw fail('Finish or cancel the current connection.');const id=secret();session.logins.set(id,{target,server,endpoint:endpoint.href,token:flow.poll.token,expires:Date.now()+20*60*1000});return {id,login:login.href};
  }
  async function nextcloudPoll(session,id) {
    const flow=session.logins.get(id);if(!flow || flow.expires<Date.now()){session.logins.delete(id);throw fail('Connection expired. Start again.');}
    const response=await transport(flow.target,flow.endpoint,'POST',{body:new URLSearchParams({token:flow.token}).toString(),contentType:'application/x-www-form-urlencoded',maxBytes:256*1024});
    if(response.status===404)return {pending:true};session.logins.delete(id);dav.checked(response,[200]);const credentials=JSON.parse(response.body);
    if(credentials.server?.replace(/\/+$/,'')!==flow.server || typeof credentials.loginName!=='string' || !credentials.loginName || /[:\u0000-\u001f\u007f]/.test(credentials.loginName) || typeof credentials.appPassword!=='string' || !credentials.appPassword || /[\u0000-\u001f\u007f]/.test(credentials.appPassword) || credentials.appPassword.length>4096)throw fail('Unexpected Nextcloud identity.',502);
    const identity=await transport(flow.target,flow.server+'/ocs/v2.php/cloud/user?format=json','GET',{auth:{username:credentials.loginName,password:credentials.appPassword},headers:{'OCS-APIRequest':'true',Accept:'application/json'},maxBytes:256*1024});dav.checked(identity,[200]);const userId=JSON.parse(identity.body).ocs?.data?.id;
    if(typeof userId!=='string' || !userId || userId==='.' || userId==='..' || /[\\/\u0000-\u001f\u007f]/.test(userId))throw fail('Invalid Nextcloud user ID.',502);
    const record={providerId:'nextcloud',id:hash(JSON.stringify([flow.server,userId])),server:flow.server,userId,loginName:credentials.loginName,appPassword:credentials.appPassword,targetRoot:flow.target.root};
    if(session.accounts.size>=20 && !session.accounts.has(record.id))throw fail('Account limit reached.');session.accounts.set(record.id,record);return {account:metadata(record)};
  }
  async function request(session,input) {
    const record=account(session,input.auth?.credentialId,input.providerId),root=rootOf(record);
    if(input.auth?.username || input.auth?.password)throw fail('Raw credentials are not accepted here.',403);
    let url=remoteURL(input.url).href;
    const identity=record.providerId==='nextcloud' && url===record.server+'/ocs/v2.php/cloud/user?format=json';
    if(identity){if(input.method!=='GET')throw fail('Invalid identity operation.');}
    else url=dav.documentUrl(input.url,root);
    if(record.providerId==='webdav' && input.root!==record.root)throw fail('Account root changed.',403);
    if(!['GET','PROPFIND','PUT','DELETE','MKCOL'].includes(input.method))throw fail('Unsupported cloud operation.',405);
    const headers={};for(const [name,value] of Object.entries(input.headers || {})){if(!['Depth','If-Match','If-None-Match','Accept-Encoding','OCS-APIRequest','Accept'].includes(name) || typeof value!=='string' || /[\r\n]/.test(value))throw fail('Unsupported cloud header.');headers[name]=value;}
    if(headers['Accept-Encoding'] && headers['Accept-Encoding']!=='identity')throw fail('Unsupported encoding.');
    if(identity){headers['OCS-APIRequest']='true';headers.Accept='application/json';}
    if(input.method==='PROPFIND' && !['0','1'].includes(headers.Depth))throw fail('Invalid WebDAV depth.');
    if(input.method==='PROPFIND' && !['<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>','<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/></d:prop></d:propfind>','<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:resourcetype/></d:prop></d:propfind>'].includes(input.body))throw fail('Unsupported DAV query.');
    if(input.method==='MKCOL' && (url===root || !url.endsWith('/') || input.body!==undefined && input.body!=='' || headers['If-None-Match']!=='*' || headers['If-Match']))throw fail('Folder creation requires an empty, create-only child collection.',409);
    if(['PUT','DELETE'].includes(input.method)) {
      const client=new dav.Client(root,req=>perform(record,req.url,req.method,req),{});client.markdownFile(url);
      if(input.method==='PUT' && headers['If-None-Match']==='*' && !headers['If-Match']) { /* create only */ }
      else if(!dav.strongEtag(headers['If-Match']) || headers['If-None-Match'])throw fail('A strong version precondition is required.',409);
      if(input.method==='DELETE' || headers['If-Match']){const current=await client.fileEtag(url);if(current!==headers['If-Match'])return {transportVersion:1,status:412,headers:{},body:''};}
    }
    if(input.body!==undefined && (typeof input.body!=='string' || Buffer.byteLength(input.body)>MAX))throw fail('Document exceeds the limit.',413);
    const maxBytes=Number(input.maxBytes);if(!Number.isInteger(maxBytes) || maxBytes<1 || maxBytes>MAX)throw fail('Invalid response limit.');
    const contentType=input.method==='PUT'?'text/markdown; charset=utf-8':input.method==='PROPFIND'?'application/xml; charset=utf-8':undefined;
    return perform(record,url,input.method,{headers,contentType,body:['PUT','PROPFIND'].includes(input.method)?input.body:undefined,maxBytes});
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'");
    let session,leased=false;
    try {
      validHost(req);
      const url=new URL(req.url,config.origin || 'https://'+req.headers.host);
      if(config.enabled===false && (url.pathname.startsWith('/api/cloud/') || url.pathname==='/login.js'))throw fail('Cloud connections are disabled.',404);
      if(url.pathname==='/health' && req.method==='GET')return reply(res,200,{ok:true});
      if(url.pathname==='/login.js' && req.method==='GET')return reply(res,200,await readFile(new URL('./login.js',import.meta.url),'utf8'),'text/javascript; charset=utf-8');
      if(url.pathname==='/api/cloud/login' && req.method==='POST'){
        checkOrigin(req);if(req.headers['x-mv-connector']!=='1')throw fail('Request refused.',403);
        throttle(req,'login',10);
        const body=await jsonBody(req,8192),password=typeof body.password==='string'?body.password:'';
        if(Buffer.byteLength(password)>4096)throw fail('Invalid sign-in.',401);
        const previousToken=cookie(req,cookieName),previous=previousToken && sessions.get(hash(previousToken));assertSwitchable(previous);
        const owner=multi?await profiles.login(body.username,password):personal;
        if(!multi && !(equal(passwordHash(password,config.owner.salt),config.owner.passwordHash) && equal(body.username,config.owner.username)))throw fail('Invalid sign-in.',401);
        if(body.remember===true && !config.rememberDevice)throw fail('Remember browser is disabled by this server.',403);
        const remembered=body.remember===true?profiles.remember(owner):null;
        profiles?.forget(cookie(req,deviceName));revokeSession(req);
        session=newSession(req,res,owner);setCookie(res,deviceName,remembered || '',remembered?30*86400:0);
        return reply(res,200,{ok:true,identity:identity(owner),csrf:session.csrf});
      }
      if(url.pathname==='/api/cloud/guest' && req.method==='POST'){
        checkOrigin(req);if(!multi || req.headers['x-mv-connector']!=='1')throw fail('Request refused.',403);
        try{session=getSession(req,res);}catch(error){if(error.status!==401)throw error;}
        if(!session){throttle(req,'guest',30);session=newSession(req,res,{id:secret(),kind:'guest',name:'Temporary browser session'});}
        return reply(res,200,{result:{csrf:session.csrf,identity:identity(session.principal)}});
      }
      if(url.pathname==='/api/cloud/session' && req.method==='POST'){
        checkOrigin(req);if(req.headers['x-mv-connector']!=='1')throw fail('Request refused.',403);
        session=getSession(req,res);return reply(res,200,{result:{csrf:session.csrf,username:session.principal.name,identity:identity(session.principal)}});
      }
      if(config.enabled!==false && url.pathname==='/sw.js' && req.method==='GET')return reply(res,200,"self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.registration.unregister()));",'text/javascript');
      if(!config.publicApp || url.pathname.startsWith('/api/cloud/') && url.pathname!=='/api/cloud/bootstrap.js'){try{session=getSession(req,res);}catch(error){if((url.pathname==='/' || url.pathname==='/index.html') && req.method==='GET')return reply(res,200,await readFile(new URL('./login.html',import.meta.url),'utf8'),'text/html; charset=utf-8');throw error;}}
      else {try{session=getSession(req,res);}catch{}}
      if(url.pathname==='/api/cloud/bootstrap.js' && req.method==='GET'){
        if(multi && req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site']))throw fail('Request refused.',403);
        if(multi && !session){throttle(req,'guest',30);session=newSession(req,res,{id:secret(),kind:'guest',name:'Temporary browser session'});}
        const configJSON=JSON.stringify({csrf:session?.csrf || '',mode:multi?'multi-user':'personal',rememberDevice:config.rememberDevice===true,identity:session?identity(session.principal):null,username:session?.principal.name || 'owner',anyServer:config.allowAnyPublicTarget===true,remember:persistent,development:config.development===true,targets:config.targets.map(t=>({providerId:t.providerId,root:t.root}))}).replaceAll('<','\\u003c');
        return reply(res,200,'window.MarkdownCloudConnector='+configJSON+';\n'+await readFile(new URL('./browser-identity.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('./web-platform.js',import.meta.url),'utf8'),'text/javascript; charset=utf-8');
      }
      if(url.pathname.startsWith('/api/cloud/')){
        if(req.method!=='POST')throw fail('POST is required.',405);checkOrigin(req);assertScope(req,session);if(!equal(req.headers['x-mv-csrf'],session.csrf))throw fail('Request verification failed.',403);
        if(session.busy || activeRequests.size>=8)throw fail('A cloud operation is still running. Wait before retrying.',429);
        session.busy=true;leased=true;activeRequests.add(session);
        const body=await jsonBody(req,url.pathname==='/api/cloud/request'?MAX+65536:16384);let result;
        const ownedVault=vaultFor(session);
        switch(url.pathname){
          case '/api/cloud/request':result=await request(session,body);break;
          case '/api/cloud/connect/webdav':result=await connectWebDAV(session,body);break;
          case '/api/cloud/connect/nextcloud/start':result=await nextcloudStart(session,body);break;
          case '/api/cloud/connect/nextcloud/poll':result=await nextcloudPoll(session,body.id);break;
          case '/api/cloud/connect/cancel':session.logins.delete(body.id);result=true;break;
          case '/api/cloud/accounts/list':{
            const saved=ownedVault.list(),records=new Map(saved.map(r=>[r.id,r]));if(multi)for(const [id,record] of session.accounts)records.set(id,record);
            result=[...records.values()].filter(r=>{try{targetFor(config,r.providerId,r.targetRoot);return true;}catch{return false;}}).map(record=>multi?{...metadata(record),remembered:saved.some(item=>item.id===record.id)}:metadata(record));break;
          }
          case '/api/cloud/accounts/store':{const record=session.accounts.get(body.id);if(!record || record.providerId!==body.providerId)throw fail('Connect before remembering this account.',403);await ownedVault.put(record);result=metadata(record);break;}
          case '/api/cloud/accounts/release':{session.accounts.delete(body.id);result=true;break;}
          case '/api/cloud/accounts/unremember':{const record=session.accounts.get(body.id);if(!record || record.providerId!==body.providerId)throw fail('Reconnect before changing remembered access.',403);await ownedVault.remove(body.id);for(const s of sessions.values())if(s!==session && s.principal.id===session.principal.id)s.accounts.delete(body.id);result=true;break;}
          case '/api/cloud/accounts/forget':{account(session,body.id,body.providerId);await ownedVault.remove(body.id);for(const s of sessions.values())if(s.principal.id===session.principal.id)s.accounts.delete(body.id);result=true;break;}
          case '/api/cloud/disconnect':session.accounts.clear();session.logins.clear();result=true;break;
          case '/api/cloud/profile/register':{
            if(!multi || session.principal.kind!=='guest')throw fail('Use a temporary session to create a profile.',403);
            if(session.logins.size)throw fail('Finish the cloud sign-in before creating a profile.',409);
            throttle(req,'register',5);
            if(body.remember===true && !config.rememberDevice)throw fail('Remember browser is disabled by this server.',403);
            const owner=await profiles.register(body.username,body.password,persistent?[...session.accounts.values()]:[]);
            const remembered=body.remember===true?profiles.remember(owner):null;
            const accounts=session.accounts;revokeSession(req);const replacement=newSession(req,res,owner);replacement.accounts=accounts;
            if(remembered)setCookie(res,deviceName,remembered,30*86400);
            result={identity:identity(owner),csrf:replacement.csrf};break;
          }
          case '/api/cloud/devices/remember':{
            if(!config.rememberDevice || session.principal.kind==='guest')throw fail('Remember browser requires an authenticated profile and server permission.',403);
            throttle(req,'login',10);
            if(typeof body.password!=='string' || Buffer.byteLength(body.password)>4096)throw fail('Enter your password to remember this browser.',401);
            if(multi){const verified=await profiles.login(session.principal.name,body.password);if(verified.id!==session.principal.id)throw fail('Invalid sign-in.',401);}
            else if(!equal(passwordHash(body.password,config.owner.salt),config.owner.passwordHash))throw fail('Invalid sign-in.',401);
            const token=profiles.remember(session.principal);profiles.forget(cookie(req,deviceName));setCookie(res,deviceName,token,30*86400);result=true;break;
          }
          case '/api/cloud/devices/revoke':{
            if(session.principal.kind==='guest')throw fail('A profile is required.',403);
            profiles?.revoke(session.principal);
            for(const [id,s] of sessions)if(s.principal.id===session.principal.id)sessions.delete(id);
            setCookie(res,cookieName,'',0);setCookie(res,deviceName,'',0);result=true;break;
          }
          case '/api/cloud/logout':{
            profiles?.forget(cookie(req,deviceName));revokeSession(req);
            setCookie(res,cookieName,'',0);setCookie(res,deviceName,'',0);result=true;break;
          }
          default:throw fail('Unknown connector operation.',404);
        }
        return reply(res,200,{result});
      }
      if(!['GET','HEAD'].includes(req.method))throw fail('Method not permitted.',405);
      const relative=decodeURIComponent(url.pathname).replace(/^\//,'') || 'index.html';
      if(relative.split('/').some(part=>part==='.' || part==='..' || !part) || /[%\\\u0000-\u001f\u007f]/.test(relative))throw fail('Not found.',404);
      if(!allowedFiles.has(relative) && !/^(assets|seo)\/[a-zA-Z0-9_./@+-]+$/.test(relative))throw fail('Not found.',404);
      const root=await realpath(rootDirectory),file=await realpath(path.join(root,relative));if(!file.startsWith(root+path.sep) || (!allowedFiles.has(relative) && !file.startsWith(path.join(root,relative.split('/')[0])+path.sep)))throw fail('Not found.',404);
      let content=await readFile(file);if(relative==='index.html'){
        content=indexHTML;
        if(config.enabled!==false && multi)content=content.replace(/<html\b/,'<html data-cloud-mode="multi-user"');
        if(config.enabled!==false)content=content.replace(/(<script src="cloud-platform\.js\?v=[a-f0-9]+" defer><\/script>)/,'$1\n    <script src="/api/cloud/bootstrap.js" defer></script>');
        // Keep the source page CSP, including its existing CDN restrictions.
        res.removeHeader('Content-Security-Policy');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; form-action 'none'");
      }else if(relative.endsWith('.js') || relative.endsWith('.mjs'))res.removeHeader('Content-Security-Policy');
      res.writeHead(200,{'Content-Type':types[path.extname(relative)] || 'application/octet-stream'});res.end(req.method==='HEAD'?undefined:content);
    } catch(error){if(!res.headersSent)reply(res,error.status || 502,{error:{message:error.status?error.message:'Cloud operation failed. Its outcome may be unconfirmed; local drafts were kept.',code:error.code==='IDENTITY_CHANGED'?'IDENTITY_CHANGED':'CONNECTOR'}});else res.destroy();}
    finally{if(leased){session.busy=false;activeRequests.delete(session);}}
  });
  server.maxConnections=64;server.requestTimeout=45000;server.headersTimeout=10000;server.maxHeadersCount=50;server.keepAliveTimeout=5000;
  return {server,vault,close:()=>new Promise(resolve=>{server.close(()=>{profiles?.close();resolve();});server.closeIdleConnections();})};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    const settings=await environmentConfiguration(process.env);
    const app=await createConnector(settings);
    app.server.listen(Number(process.env.PORT || 80),process.env.HOST || '0.0.0.0',()=>console.log('Markdown Viewer all-in-one started; cloud '+(settings.config.enabled?'enabled':'disabled')+'.'));
    process.on('SIGTERM',()=>{app.server.close();setTimeout(()=>process.exit(0),40000).unref();});
  }catch{console.error('Startup failed. Check cloud environment/secret configuration; existing data was preserved.');process.exitCode=1;}
}
