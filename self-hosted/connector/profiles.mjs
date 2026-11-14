// Server-owned profile IDs scope every credential/device lookup. No remote bodies are stored.
import {mkdir,chmod} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv,createHmac,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {fail,hash,equal} from './security.mjs';
const derive=promisify(scrypt),deviceLifetime=30*86400000,deviceMaximum=180*86400000;
const passwordDigest=async(password,salt)=>(await derive(password,salt,64,{N:65536,r:8,p:2,maxmem:128*1024*1024})).toString('hex');
export async function openProfiles(directory,key,{maxProfiles=100}={}) {
  if(!Buffer.isBuffer(key) || key.length!==32)throw Error('Profile storage requires a 32-byte key.');
  const {DatabaseSync}=await import('node:sqlite');
  await mkdir(directory,{recursive:true,mode:0o700});
  const file=path.join(directory,'profiles.sqlite'),db=new DatabaseSync(file);
  await chmod(file,0o600);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
  db.exec(`CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, digest TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS credentials (owner TEXT NOT NULL REFERENCES profiles(id), id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(owner,id));
    CREATE TABLE IF NOT EXISTS devices (token TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL, generation TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  const verifier=createHmac('sha256',key).update('MarkdownViewer.profiles.v1').digest('hex');
  const stored=db.prepare("SELECT value FROM meta WHERE name='key'").get();
  if(!stored && ['profiles','credentials','devices'].some(table=>db.prepare('SELECT count(*) AS n FROM '+table).get().n>0)){db.close();throw Error('Profile key metadata is missing; existing data was preserved.');}
  if(stored && !equal(stored.value,verifier)){db.close();throw Error('Profile key mismatch; existing data was preserved.');}
  db.prepare("INSERT OR IGNORE INTO meta VALUES ('key',?)").run(verifier);
  const dummySalt=randomBytes(16).toString('hex');
  const profile=row=>row && {id:row.id,kind:'profile',name:row.name,generation:hash(row.digest)};
  const encrypt=(owner,id,record)=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(JSON.stringify(['profile-credential-v1',owner,id])));const body=Buffer.concat([cipher.update(JSON.stringify(record)),cipher.final()]);return JSON.stringify({iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),body:body.toString('base64')});};
  const decrypt=(owner,id,wire)=>{const value=JSON.parse(wire),cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(value.iv,'hex'));cipher.setAAD(Buffer.from(JSON.stringify(['profile-credential-v1',owner,id])));cipher.setAuthTag(Buffer.from(value.tag,'hex'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.body,'base64')),cipher.final()]).toString());};
  function vault(owner){
    if(!db.prepare('SELECT id FROM profiles WHERE id=?').get(owner))throw fail('Profile unavailable.',403);
    return {
      get(id){const row=db.prepare('SELECT body FROM credentials WHERE owner=? AND id=?').get(owner,String(id));return row?decrypt(owner,String(id),row.body):undefined;},
      list(){return db.prepare('SELECT id,body FROM credentials WHERE owner=?').all(owner).map(row=>decrypt(owner,row.id,row.body));},
      put(record){if(!record || typeof record.id!=='string')throw fail('Invalid credential.');if(!db.prepare('SELECT id FROM credentials WHERE owner=? AND id=?').get(owner,record.id) && db.prepare('SELECT count(*) AS n FROM credentials WHERE owner=?').get(owner).n>=20)throw fail('Account limit reached.');db.prepare('INSERT INTO credentials VALUES (?,?,?) ON CONFLICT(owner,id) DO UPDATE SET body=excluded.body').run(owner,record.id,encrypt(owner,record.id,record));},
      remove(id){db.prepare('DELETE FROM credentials WHERE owner=? AND id=?').run(owner,String(id));}
    };
  }
  let closed=false,authBusy=false;
  const api={
    async register(name,password,records=[]){
      if(authBusy)throw fail('Authentication is busy. Try again shortly.',429);authBusy=true;
      try{
        if(typeof name!=='string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/.test(name) || typeof password!=='string' || password.length<12 || Buffer.byteLength(password)>4096)throw fail('Use a profile name of 3–64 letters/numbers and a password of at least 12 characters.');
        const canonical=name.toLowerCase();
        if(db.prepare('SELECT count(*) AS n FROM profiles').get().n>=maxProfiles)throw fail('This installation has reached its profile limit.',429);
        const id=randomUUID(),salt=randomBytes(16).toString('hex'),digest=await passwordDigest(password,salt);
        db.exec('BEGIN IMMEDIATE');
        try{
          if(db.prepare('SELECT id FROM profiles WHERE name=?').get(canonical))throw fail('This profile name is unavailable.',409);
          db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?)').run(id,canonical,salt,digest,Date.now());
          for(const record of records)vault(id).put(record);
          db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
        return {id,kind:'profile',name:canonical,generation:hash(digest)};
      }finally{authBusy=false;}
    },
    async login(name,password){
      if(authBusy)throw fail('Authentication is busy. Try again shortly.',429);authBusy=true;
      try{
        if(typeof name!=='string' || name.length>64 || typeof password!=='string' || Buffer.byteLength(password)>4096)throw fail('Invalid profile name or password.',401);
        const row=db.prepare('SELECT * FROM profiles WHERE name=?').get(name.toLowerCase()),digest=await passwordDigest(password,row?.salt || dummySalt);
        if(!row || !equal(digest,row.digest))throw fail('Invalid profile name or password.',401);
        return profile(row);
      }finally{authBusy=false;}
    },
    vault,
    principal(id){return profile(db.prepare('SELECT * FROM profiles WHERE id=?').get(String(id)));},
    remember(principal){
      const now=Date.now();db.prepare('DELETE FROM devices WHERE expires<? OR created<?').run(now,now-deviceMaximum);
      if(db.prepare('SELECT count(*) AS n FROM devices').get().n>=10000)throw fail('Remembered browser limit reached.',429);
      if(db.prepare('SELECT count(*) AS n FROM devices WHERE owner=? AND kind=?').get(principal.id,principal.kind).n>=20)throw fail('Profile browser limit reached. Sign out other browsers.',429);
      const token=randomBytes(32).toString('base64url');db.prepare('INSERT INTO devices VALUES (?,?,?,?,?,?)').run(hash(token),principal.id,principal.kind,principal.generation,now,now+deviceLifetime);return token;
    },
    restore(token,personal){
      if(typeof token!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(token))return;
      const row=db.prepare('SELECT * FROM devices WHERE token=?').get(hash(token)),now=Date.now();if(!row)return;
      const owner=row.kind==='personal'?personal:api.principal(row.owner);
      if(row.expires<now || row.created+deviceMaximum<now || !owner || owner.id!==row.owner || owner.kind!==row.kind || !equal(owner.generation,row.generation)){api.forget(token);return;}
      db.prepare('UPDATE devices SET expires=? WHERE token=?').run(Math.min(row.created+deviceMaximum,now+deviceLifetime),hash(token));return owner;
    },
    forget(token){if(typeof token==='string')db.prepare('DELETE FROM devices WHERE token=?').run(hash(token));},
    revoke(principal){db.prepare('DELETE FROM devices WHERE owner=? AND kind=?').run(principal.id,principal.kind);},
    close(){if(!closed){closed=true;db.close();}}
  };
  return api;
}
