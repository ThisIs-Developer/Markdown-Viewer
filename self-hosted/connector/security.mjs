import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import http from 'node:http';
import { createHash, scryptSync, timingSafeEqual } from 'node:crypto';
export const MAX = 20 * 1024 * 1024;
export const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export const hash = value => createHash('sha256').update(value).digest('hex');
export function passwordHash(password, salt) { return scryptSync(password, salt, 64, {N:65536,r:8,p:2,maxmem:128*1024*1024}).toString('hex'); }
export function equal(a, b) { const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length && timingSafeEqual(x,y); }
export function remoteURL(value) {
  if(typeof value!=='string' || value.length>4096 || /[\\\s\u0000-\u001f\u007f]/.test(value))throw fail('Invalid remote URL.');
  const raw=value.replace(/^[a-z]+:\/\/[^/]*/i,'').split(/[?#]/)[0];
  for(const part of raw.split('/')) {let d;try{d=decodeURIComponent(part);}catch{throw fail('Invalid remote path.');}if(d==='.' || d==='..' || /[%\\/\u0000-\u001f\u007f]/.test(d))throw fail('Unsupported remote path.');}
  const url=new URL(value);
  if(url.username || url.password || url.hash || !['https:','http:'].includes(url.protocol))throw fail('Invalid remote URL.');
  return url;
}
export function targetFor(config, providerId, root) {
  const url=remoteURL(root);if(url.search)throw fail('Invalid remote root.');
  const normalized=url.href.replace(/\/+$/,'')+'/';
  const target=config.targets.find(t=>t.providerId===providerId && t.root===normalized);
  if(target)return target;
  if(config.allowAnyPublicTarget && ['nextcloud','webdav'].includes(providerId) && url.protocol==='https:'){
    if(config.allowedServers?.length && !config.allowedServers.includes(url.origin))throw fail('This server has not been allowed by the administrator.',403);
    return {providerId,root:normalized,allowPrivate:config.privateServers?.includes(url.origin)===true};
  }
  throw fail('This server/folder has not been approved by the administrator.',403);
}
export function publicAddress(address) {
  if(isIP(address)===4) {
    const [a,b]=address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===100 && b>=64 && b<=127) || (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && [0,168].includes(b)) || (a===198 && [18,19,51].includes(b)) || (a===203 && b===0));
  }
  // Only global unicast IPv6. Mapped IPv4, loopback, local and link-local fail closed.
  if(isIP(address)!==6)return false;
  const normalized=new URL('http://['+address+']/').hostname.slice(1,-1),parts=normalized.split(':'),first=parseInt(parts[0],16),second=parseInt(parts[1] || '0',16);
  return first>=0x2000 && first<=0x3fff && first!==0x2002 && !(first===0x2001 && (second<0x200 || second===0xdb8));
}
export async function pinnedAddress(url, target, resolver=lookup) {
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await resolver(host,{all:true,verbatim:true});
  if(!addresses.length || addresses.some(item=>!isIP(item.address) || (!target.allowPrivate && !publicAddress(item.address))))throw fail('Remote address is not permitted.',403);
  if(url.protocol!=='https:' && !(target.allowHttpLoopback && ['127.0.0.1','::1'].includes(host)))throw fail('HTTPS is required.',403);
  return addresses[0];
}
export async function upstream(target, value, method, options={}) {
  const url=remoteURL(value),base=remoteURL(target.root);
  if(url.origin!==base.origin)throw fail('Cross-origin requests are not permitted.',403);
  const address=await pinnedAddress(url,target);
  return new Promise((resolve,reject)=>{
    const headers={...options.headers,'Accept-Encoding':'identity'};
    if(options.auth)headers.Authorization='Basic '+Buffer.from(options.auth.username+':'+options.auth.password,'utf8').toString('base64');
    if(options.contentType)headers['Content-Type']=options.contentType;
    const payload=options.body===undefined?undefined:Buffer.from(options.body,'utf8');
    if(payload)headers['Content-Length']=payload.length;
    const req=(url.protocol==='https:'?https:http).request(url,{method,headers,agent:false,autoSelectFamily:false,lookup:(_host,_opts,callback)=>callback(null,address.address,address.family),rejectUnauthorized:true},res=>{
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>(options.maxBytes || MAX)) {const error=fail('Remote response exceeds the limit.',413);reject(error);res.destroy();req.destroy(error);}else chunks.push(chunk);});
      res.on('error',()=>reject(fail('Remote response was interrupted.',502)));
      res.on('end',()=>{clearTimeout(timer);if(res.statusCode>=300 && res.statusCode<400)return reject(fail('Remote redirects are not permitted.',502));if(res.headers['content-encoding'] && res.headers['content-encoding']!=='identity')return reject(fail('Unexpected compressed remote response.',502));let body;try{body=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{return reject(fail('Remote content is not valid UTF-8.',502));}resolve({transportVersion:1,status:res.statusCode,headers:Object.fromEntries(['etag','content-type'].filter(k=>res.headers[k]).map(k=>[k,res.headers[k]])),body});});
    });
    const timer=setTimeout(()=>req.destroy(fail('Cloud request timed out. Its outcome is unconfirmed; your local draft was kept.',504)),35000);
    req.on('error',error=>{clearTimeout(timer);reject(error.status?error:fail('Cloud request failed. Its outcome may be unconfirmed; your draft was kept.',502));});
    req.end(payload);
  });
}
export function validateConfig(config) {
  const origin=config.origin?new URL(config.origin):null;
  if(!origin && !config.dynamicOrigin)throw fail('Configure a public origin or dynamic same-origin mode.');
  if(origin && (origin.origin!==config.origin || (origin.protocol!=='https:' && !(config.development===true && ['localhost','127.0.0.1'].includes(origin.hostname)))))throw fail('Configure an HTTPS public origin (HTTP loopback only in development).');
  if(config.enabled===false)return config;
  if(config.mode!==undefined && !['personal','multi-user'].includes(config.mode))throw fail('Unknown cloud mode.');
  if(config.mode!=='multi-user' && (!config.owner || !/^[a-zA-Z0-9._-]{1,64}$/.test(config.owner.username) || !/^[0-9a-f]{32}$/.test(config.owner.salt) || !/^[0-9a-f]{128}$/.test(config.owner.passwordHash)))throw fail('Provision one owner before startup.');
  if(!Array.isArray(config.targets) || (!config.targets.length && !config.allowAnyPublicTarget) || config.targets.length>20)throw fail('Configure 1–20 approved remote targets.');
  const roots=new Set();
  for(const target of config.targets){for(const name of ['allowPrivate','allowHttpLoopback'])if(target[name]!==undefined && typeof target[name]!=='boolean')throw fail('Target policy flags must be boolean.');if(!['nextcloud','webdav'].includes(target.providerId))throw fail('Unsupported provider.');const url=remoteURL(target.root);if(url.search)throw fail('Invalid target.');target.root=url.href.replace(/\/+$/,'')+'/';if(roots.has(target.root))throw fail('Duplicate targets.');roots.add(target.root);if(url.protocol!=='https:' && !(config.development && target.allowHttpLoopback && ['127.0.0.1','[::1]'].includes(url.hostname)))throw fail('Target requires HTTPS.');}
  return config;
}
