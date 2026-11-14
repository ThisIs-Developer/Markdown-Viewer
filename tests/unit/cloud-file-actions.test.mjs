import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../cloud-operations.js',import.meta.url),'utf8');
test('a delete refused by the global save lock cannot release another operation ownership',async()=>{
 const start=source.indexOf('  async function deleteRemote('),end=source.indexOf('  async function remove(',start);
 const client={capabilities:{delete:true},validateFile(){}};
 const state={requireCapability(){},sessions:new Map([['account',client]]),sessionKey:()=> 'account',saves:new Set(['document']),api:{beginSave(){throw Error('busy');},statusChanged(){}},refresh(){}};
 vm.createContext(state);vm.runInContext(source.slice(start,end),state);
 await assert.rejects(state.deleteRemote(client,'https://test/file.md','file.md','document'),/busy/);
 assert.equal(state.saves.has('document'),true);
});
