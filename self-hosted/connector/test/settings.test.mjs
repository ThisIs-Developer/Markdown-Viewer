import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {environmentConfiguration} from '../settings.mjs';
import {validateConfig,targetFor} from '../security.mjs';
test('cloud defaults off without passwords, hostname, volume or initialization',async()=>{const result=await environmentConfiguration({});assert.equal(result.config.enabled,false);assert.equal(result.key,undefined);validateConfig(result.config);});
test('enabled personal cloud has no required hostname, but requires an access secret',async()=>{await assert.rejects(environmentConfiguration({CLOUD_ENABLED:'true'}),/password/);const result=await environmentConfiguration({CLOUD_ENABLED:'true',CLOUD_ACCESS_PASSWORD:'a-personal-cloud-password'});validateConfig(result.config);assert.equal(result.config.remember,false);assert.equal(result.config.origin,null);assert.equal(targetFor(result.config,'webdav','https://other.example/folder').allowPrivate,false);});
test('server policies are optional but private access is explicitly origin-scoped',async()=>{const result=await environmentConfiguration({CLOUD_ENABLED:'true',CLOUD_ACCESS_PASSWORD:'a-personal-cloud-password',CLOUD_PRIVATE_SERVERS:'https://nc.local.example',CLOUD_ALLOWED_SERVERS:'https://nc.local.example,https://dav.example'});assert.equal(targetFor(result.config,'nextcloud','https://nc.local.example/subdir').allowPrivate,true);assert.equal(targetFor(result.config,'webdav','https://dav.example/folder').allowPrivate,false);assert.throws(()=>targetFor(result.config,'webdav','https://not-approved.example/'));assert.throws(()=>targetFor(result.config,'nextcloud','http://nc.local.example'));});
test('remembering initializes a key once and secret-file input never enters public config',async t=>{const directory=await mkdtemp(path.join(tmpdir(),'mv-cloud-env-'));t.after(()=>rm(directory,{recursive:true,force:true}));const secret=path.join(directory,'password');await writeFile(secret,'a-personal-cloud-password\n');const env={CLOUD_ENABLED:'true',CLOUD_ACCESS_PASSWORD_FILE:secret,CLOUD_REMEMBER_CONNECTIONS:'true',CLOUD_DATA_DIR:directory};const first=await environmentConfiguration(env),second=await environmentConfiguration(env);assert.deepEqual(first.key,second.key);assert.equal((await readFile(path.join(directory,'credential.key'))).length,32);assert.doesNotMatch(JSON.stringify(first.config),/a-personal-cloud-password/);await assert.rejects(environmentConfiguration({...env,CLOUD_ACCESS_PASSWORD:'another-password'}),/one cloud password/);});

test('personal cloud accepts 12-character passwords and rejects shorter env and file input',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'mv-password-boundary-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const base={CLOUD_ENABLED:'true'},password='abcDEF123!xy',file=path.join(directory,'password');
 validateConfig((await environmentConfiguration({...base,CLOUD_ACCESS_PASSWORD:password})).config);
 await assert.rejects(environmentConfiguration({...base,CLOUD_ACCESS_PASSWORD:password.slice(1)}),/at least 12/);
 await writeFile(file,password+'\n');validateConfig((await environmentConfiguration({...base,CLOUD_ACCESS_PASSWORD_FILE:file})).config);
 await writeFile(file,password.slice(1));await assert.rejects(environmentConfiguration({...base,CLOUD_ACCESS_PASSWORD_FILE:file}),/at least 12/);
});


test('multi-user needs no common password, initializes persistent profile state and validates policies',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'mv-multi-settings-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const env={CLOUD_ENABLED:'true',CLOUD_MODE:'multi-user',CLOUD_REMEMBER_DEVICE:'true',CLOUD_DATA_DIR:directory};
 const result=await environmentConfiguration(env);validateConfig(result.config);assert.equal(result.config.owner,undefined);assert.equal(result.key.length,32);assert.equal(result.config.remember,false);assert.equal(result.config.maxProfiles,100);
 assert.deepEqual((await environmentConfiguration(env)).key,result.key);
 for(const change of [{CLOUD_MODE:'open'},{CLOUD_REMEMBER_DEVICE:'yes'},{CLOUD_MAX_PROFILES:'0'},{CLOUD_MAX_PROFILES:'10001'}])await assert.rejects(environmentConfiguration({...env,...change}));
});
