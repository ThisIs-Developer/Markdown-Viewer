import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {request} from 'node:http';
import assert from 'node:assert/strict';
const image=process.argv[2] || 'markdown-viewer-cloud:dev',name='mv-cloud-disabled-'+randomBytes(6).toString('hex');
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();let running=false;
try{
 docker('run','--detach','--name',name,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--publish','127.0.0.1::80',image);running=true;
 const port=Number(docker('port',name,'80/tcp').split(':').at(-1));
 const get=route=>new Promise((resolve,reject)=>{request({hostname:'127.0.0.1',port,path:route},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text}));}).on('error',reject).end();});
 for(let i=0;i<60;i++){try{if((await get('/health')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const html=await get('/');assert.equal(html.status,200);assert.match(html.text,/markdown-editor/);assert.doesNotMatch(html.text,/api\/cloud\/bootstrap.js/);assert.equal((await get('/api/cloud/bootstrap.js')).status,404);assert.equal((await get('/sw.js')).status,200);docker('exec',name,'sh','-c','test ! -e /data/credential.key');console.log('Cloud defaults off: editor works on port 80 without password/volume; API disabled; no key created.');
}finally{if(running)docker('rm','--force',name);}
