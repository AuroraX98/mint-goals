import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleStateRequest as productionRequest, validateState, ownerScopeFor } from '../lib/goal-store.mjs';
async function handleStateRequest(request,db,owner){
 if(request.method==='PUT'&&owner){const body=await request.json();body.ownerScope=await ownerScopeFor(owner);request=new Request(request.url,{method:'PUT',headers:request.headers,body:JSON.stringify(body)});}
 const result=await productionRequest(request,db,owner);
 if(request.method==='GET'&&result.status===200){const body=await result.json();delete body.ownerScope;return Response.json(body);}
 return result;
}
// Run production SQL using a persistent SQLite-backed D1-compatible interface.
function connect(path) { const sql=new DatabaseSync(path); return {sql,prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}};}};}};}}; }
const sample=(title='Read a book')=>({version:1,categories:[{id:'books',name:'Learning'}],goals:[{id:'g1',title,description:'A chapter daily',icon:'book',categoryId:'books',tasks:[{id:'t1',text:'Chapter one',emoji:'📖',done:false}],status:'active',createdAt:'2026-10-25T09:00:00.000Z'}]});
const req=(state,version=0,extra={})=>new Request('https://mint.example/api/state',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://mint.example',...extra},body:JSON.stringify({state,version})});
const get=()=>new Request('https://mint.example/api/state');
test('durable sessions, user isolation, concurrent revision conflicts, authorization and validation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'mint-store-')),path=join(dir,'state.db'); let db=connect(path);
 db.sql.exec('CREATE TABLE goal_states (owner_id TEXT PRIMARY KEY NOT NULL,state_json TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL)');
 try {
 assert.equal((await handleStateRequest(get(),db,null)).status,401);
 const initial=await Promise.all([handleStateRequest(req(sample('First')),db,'new-user'),handleStateRequest(req(sample('Second')),db,'new-user')]);
 assert.deepEqual(initial.map(r=>r.status).sort(),[200,409]);
 assert.equal((await initial.find(r=>r.status===409).json()).state.goals[0].title,'First');
 for(const bad of [null,1,'bad']) {
   assert.equal((await handleStateRequest(req({...sample(),goals:[bad]}),db,'alice')).status,400);
   assert.equal((await handleStateRequest(req({...sample(),categories:[bad]}),db,'alice')).status,400);
   const badTask=sample();badTask.goals[0].tasks=[bad];
   assert.equal((await handleStateRequest(req(badTask),db,'alice')).status,400);
 }
 assert.deepEqual(await (await handleStateRequest(get(),db,'alice')).json(),{state:null,version:0});
 const save=await handleStateRequest(req(sample()),db,'alice');assert.equal(save.status,200);assert.equal((await save.json()).version,1);
 db.sql.close();db=connect(path);
 assert.equal((await (await handleStateRequest(get(),db,'alice')).json()).state.goals[0].title,'Read a book');
 assert.deepEqual(await (await handleStateRequest(get(),db,'bob')).json(),{state:null,version:0});
 assert.equal((await handleStateRequest(req(sample('Bob private')),db,'bob')).status,200);
 assert.equal((await handleStateRequest(req(sample('Late initial write')),db,'alice')).status,409);
 const results=await Promise.all([handleStateRequest(req(sample('Computer'),1),db,'alice'),handleStateRequest(req(sample('Phone'),1),db,'alice')]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const conflict=await results.find(r=>r.status===409).json();assert.equal(conflict.version,2);assert.equal(conflict.state.goals[0].title,'Computer');
 assert.equal((await (await handleStateRequest(get(),db,'bob')).json()).state.goals[0].title,'Bob private');
 assert.equal((await handleStateRequest(req(sample(),2,{Origin:'https://evil.example'}),db,'alice')).status,403);
 assert.equal((await handleStateRequest(req({...sample(),ownerId:'bob'},2),db,'alice')).status,400);
 assert.equal((await handleStateRequest(req(sample(),-1),db,'alice')).status,400);
 assert.equal((await handleStateRequest(req(sample(),2,{'Content-Length':'2000001'}),db,'alice')).status,413);
 const malformed=sample();malformed.goals[0].tasks[0].done='yes';assert.throws(()=>validateState(malformed));
 const duplicate=sample();duplicate.goals.push(duplicate.goals[0]);assert.throws(()=>validateState(duplicate));
 const unknown=sample();unknown.goals[0].categoryId='unknown';assert.throws(()=>validateState(unknown));
 assert.equal((await handleStateRequest(get(),null,'alice')).status,503);
 }finally{db.sql.close();rmSync(dir,{recursive:true,force:true});}
});
