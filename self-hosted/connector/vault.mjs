import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import path from 'node:path';
export async function openVault(directory,key,owner) {
  if(key.length!==32)throw new Error('The credential encryption key must contain 32 bytes.');
  await mkdir(directory,{recursive:true,mode:0o700});
  const file=path.join(directory,'credentials.enc');let records={};
  try {const envelope=JSON.parse(await readFile(file,'utf8'));const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'hex'));decipher.setAAD(Buffer.from('MarkdownViewer.connector.v1:'+owner));decipher.setAuthTag(Buffer.from(envelope.tag,'hex'));records=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.body,'base64')),decipher.final()]).toString());}catch(error){if(error.code!=='ENOENT')throw new Error('Credential store cannot be decrypted; refusing to overwrite it.');}
  let queue=Promise.resolve();
  const change=mutate=>{const task=queue.then(async()=>{const next=structuredClone(records);mutate(next);const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('MarkdownViewer.connector.v1:'+owner));const body=Buffer.concat([cipher.update(JSON.stringify(next)),cipher.final()]);const temporary=file+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(temporary,JSON.stringify({version:1,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),body:body.toString('base64')}),{mode:0o600,flag:'wx'});await rename(temporary,file);records=next;});queue=task.catch(()=>{});return task;};
  return {get:id=>records[id] && structuredClone(records[id]),list:()=>Object.values(records).map(value=>structuredClone(value)),put:record=>change(next=>{if(!next[record.id] && Object.keys(next).length>=20)throw new Error('Account limit reached.');next[record.id]=record;}),remove:id=>change(next=>{delete next[id];})};
}
