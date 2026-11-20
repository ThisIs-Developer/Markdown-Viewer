import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHmac} from 'node:crypto';
import {passwordHash} from './security.mjs';
const boolean=(env,name,fallback)=>{if(env[name]===undefined)return fallback;if(!['true','false'].includes(env[name]))throw new Error(name+' must be true or false.');return env[name]==='true';};
const origins=value=>(value || '').split(',').filter(Boolean).map(value=>{const url=new URL(value.trim());if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname))throw new Error('Server policies require HTTPS origins.');return url.origin;});
export async function environmentConfiguration(env){
  const enabled=boolean(env,'CLOUD_ENABLED',false),remember=boolean(env,'CLOUD_REMEMBER_CONNECTIONS',false),development=boolean(env,'CLOUD_DEVELOPMENT',false);
  const mode=env.CLOUD_MODE || 'personal';
  if(!['personal','multi-user'].includes(mode))throw new Error('CLOUD_MODE must be personal or multi-user.');
  const rememberDevice=boolean(env,'CLOUD_REMEMBER_DEVICE',false);
  const maxProfiles=Number(env.CLOUD_MAX_PROFILES || 100);
  if(!Number.isInteger(maxProfiles) || maxProfiles<1 || maxProfiles>10000)throw new Error('CLOUD_MAX_PROFILES must be between 1 and 10000.');
  const dataDirectory=env.CLOUD_DATA_DIR || '/data';
  const config={enabled,remember,rememberDevice,mode,maxProfiles,development,origin:env.CLOUD_PUBLIC_URL || null,dynamicOrigin:!env.CLOUD_PUBLIC_URL,publicApp:true,targets:[],allowAnyPublicTarget:true,allowedServers:origins(env.CLOUD_ALLOWED_SERVERS),privateServers:origins(env.CLOUD_PRIVATE_SERVERS)};
  if(!enabled)return {config,dataDirectory};
  let password;
  if(mode==='personal'){
  if(env.CLOUD_ACCESS_PASSWORD && env.CLOUD_ACCESS_PASSWORD_FILE)throw new Error('Use only one cloud password source.');
  password=env.CLOUD_ACCESS_PASSWORD_FILE?(await readFile(env.CLOUD_ACCESS_PASSWORD_FILE,'utf8')).replace(/\r?\n$/,''):env.CLOUD_ACCESS_PASSWORD;
  if(typeof password!=='string' || password.length<12 || Buffer.byteLength(password)>4096)throw new Error('Configure a cloud access password of at least 12 characters.');
  const salt=randomBytes(16).toString('hex');config.owner={username:'owner',salt,passwordHash:passwordHash(password,salt)};
  }
  let key;
  if(remember || rememberDevice || mode==='multi-user'){
    await mkdir(dataDirectory,{recursive:true,mode:0o700});
    if(env.CLOUD_CREDENTIAL_KEY_FILE)key=await readFile(env.CLOUD_CREDENTIAL_KEY_FILE);
    else {
      const keyFile=path.join(dataDirectory,'credential.key');
      try{key=await readFile(keyFile);}catch(error){if(error.code!=='ENOENT')throw error;key=randomBytes(32);try{await writeFile(keyFile,key,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;key=await readFile(keyFile);}}
    }
    if(key.length!==32)throw new Error('The credential key must contain 32 bytes.');
  }
  if(config.owner && key && rememberDevice){
    // A stable device generation must not introduce a fast password verifier.
    const deviceSalt=createHmac('sha256',key).update('personal-device-salt-v1').digest('hex').slice(0,32);
    config.owner.deviceVersion=createHmac('sha256',key).update(passwordHash(password,deviceSalt)).digest('hex');
  }
  return {config,key,dataDirectory};
}
