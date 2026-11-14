import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {environmentConfiguration} from '../settings.mjs';
import {validateConfig} from '../security.mjs';
const require=createRequire(new URL('../../../package.json',import.meta.url)),yaml=require('js-yaml');
for(const [file,mode] of [['compose.yml','personal'],['compose.multi-user.yml','multi-user']])test('documented '+mode+' template configures the intended mode without a private image',async t=>{
 const text=await readFile(new URL('../../'+file,import.meta.url),'utf8'),template=yaml.load(text),service=template.services['markdown-viewer'];
 assert.equal(service.image,'markdown-viewer-cloud:local');assert.equal(service.build.context,'..');assert.equal(service.build.dockerfile,'self-hosted/Dockerfile');assert.equal(service.environment.CLOUD_MODE,mode);
 assert.ok(service.volumes.includes('cloud-state:/data'));assert.ok(template.volumes['cloud-state']===null || typeof template.volumes['cloud-state']==='object');
 const directory=await mkdtemp(path.join(tmpdir(),'mv-template-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const env={...service.environment,CLOUD_DATA_DIR:directory};if(mode==='personal')env.CLOUD_ACCESS_PASSWORD='template-test-password';else assert.equal(env.CLOUD_ACCESS_PASSWORD,undefined);
 const settings=await environmentConfiguration(env);validateConfig(settings.config);assert.equal(settings.config.mode,mode);assert.equal(settings.config.rememberDevice,true);
});
