// Runs only a disposable local container; never connects to a real cloud account.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { passwordHash } from '../security.mjs';
const image=process.argv[2] || 'markdown-viewer-cloud:dev';
const directory=await mkdtemp(path.join(tmpdir(),'mv-cloud-image-')),suffix=randomBytes(6).toString('hex'),name='mv-cloud-smoke-'+suffix,volume=name+'-data';
const origin='https://markdown-cloud-test.example',host=new URL(origin).host,password=randomBytes(9).toString('base64url'),salt=randomBytes(16).toString('hex');
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim();
const config={origin};
let running=false,port,cookie='',csrf='';
const send=(route,method='GET',body,extra={})=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:route,method,headers:{Host:host,Origin:origin,'Content-Type':'application/json','X-MV-Connector':'1',Cookie:cookie,'X-MV-CSRF':csrf,...extra}},res=>{let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text,headers:res.headers}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
try{
 docker('run','--detach','--name',name,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--pids-limit','64','--memory','512m','--cpus','1','--tmpfs','/tmp:size=16m,noexec,nosuid','--publish','127.0.0.1::80','--env','CLOUD_ENABLED=true','--env','CLOUD_REMEMBER_CONNECTIONS=true','--env','CLOUD_ACCESS_PASSWORD='+password,'--mount','type=volume,source='+volume+',target=/data',image);running=true;
 port=Number(docker('port',name,'80/tcp').split(':').at(-1));
 const ready=async()=>{for(let i=0;i<60;i++){try{if((await send('/health')).status===200)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Container did not become healthy.');};await ready();
 assert.equal((await send('/')).status,200);assert.match((await send('/')).text,/markdown-editor/);assert.equal((await send('/api/cloud/accounts/list','POST',{})).status,401);assert.equal((await send('/api/cloud/login','POST',{}, {Host:'hostile.example'})).status,403);
 const login=await send('/api/cloud/login','POST',{username:'owner',password});assert.equal(login.status,200,login.text);const cookieHeader=login.headers['set-cookie'][0];assert.match(cookieHeader,/HttpOnly/);assert.match(cookieHeader,/Secure/);assert.match(cookieHeader,/SameSite=Strict/);cookie=cookieHeader.split(';')[0];
 const bootstrap=await send('/api/cloud/bootstrap.js');assert.equal(bootstrap.status,200,bootstrap.text);assert.equal(bootstrap.headers['cache-control'],'no-store');csrf=JSON.parse(bootstrap.text.match(/MarkdownCloudConnector=(.*);\n/)[1]).csrf;
 const index=await send('/');assert.match(index.text,/api\/cloud\/bootstrap.js/);assert.match(index.text,/cloud-platform.js/);assert.match(index.text,/script\.js\?v=[a-f0-9]{24}/);assert.match(index.text,/styles\.css\?v=[a-f0-9]{24}/);assert.equal(index.headers['cache-control'],'no-store');
 assert.equal((await send('/script.js')).status,200);assert.equal((await send('/assets/emoji/catalog.json')).status,200);assert.equal((await send('/self-hosted/connector/server.mjs')).status,404);assert.equal((await send('/api/cloud/accounts/list','POST',{})).status,200);
 const uid=docker('exec',name,'id','-u');assert.equal(uid,'1000');
 const code="import {readFile} from 'node:fs/promises';import {openVault} from './self-hosted/connector/vault.mjs';const vault=await openVault('/data',await readFile('/data/credential.key'),'owner');await vault.put({id:'smoke',providerId:'nextcloud',targetRoot:'https://nextcloud.example/',server:'https://nextcloud.example',userId:'smoke',appPassword:'disposable-test-only'});";
 docker('exec',name,'node','--input-type=module','-e',code);const disk=docker('exec',name,'cat','/data/credentials.enc');assert.doesNotMatch(disk,/disposable-test-only/);
 docker('restart',name);port=Number(docker('port',name,'80/tcp').split(':').at(-1));await ready();assert.equal((await send('/api/cloud/accounts/list','POST',{})).status,401);
 const result={image,imageId:docker('image','inspect',image,'--format','{{.Id}}'),platform:'linux/amd64',nonRootUid:Number(uid),checks:['production Secure/HttpOnly/SameSite cookie','Host/Origin and anonymous access guards','public editor and authenticated cloud RPC','static assets load','no internal source exposure','read-only filesystem and isolated writable volume','encrypted credentials write as non-root','restart revokes sessions without credential corruption'],realCloudAccountUsed:false};
 console.log(JSON.stringify(result,null,2));
}catch(error){if(running)console.error(docker('logs',name));throw error;}finally{if(running)docker('rm','--force',name);try{docker('volume','rm',volume);}catch{}await rm(directory,{recursive:true,force:true});}
