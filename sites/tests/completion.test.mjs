import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoal,validateBackup} from '../public/model.mjs';
import {completionFields,setCompleted} from '../public/completion.mjs';
import {validateState,writeState,readState} from '../lib/goal-store.mjs';
import {DatabaseSync} from 'node:sqlite';
const goal=()=>({...createGoal('Study'),createdAt:'2026-01-01T12:00:00.000Z'});
const state=g=>({version:2,categories:[],goals:[g]});
test('legacy JSON migration preserves all goal content and keeps dates unknown',()=>{
 const g=goal();delete g.completedAt;delete g.completionDate;g.status='completed';
 const out=validateBackup({version:1,goals:[g]});
 assert.equal(out[0].completedAt,null);assert.equal(out[0].completionDate,null);
 assert.equal(out[0].title,g.title);assert.equal(out[0].createdAt,g.createdAt);assert.equal(g.completedAt,undefined);
 assert.doesNotThrow(()=>validateState(state(out[0])));
});
test('completion, reopen, recomplete, archive retain exactly one current completion',()=>{
 const g=goal();setCompleted(g,true,new Date('2026-01-04T12:00:00.000Z'));assert.equal(g.completedAt,'2026-01-04T12:00:00.000Z');
 setCompleted(g,false);assert.equal(g.completedAt,null);assert.equal(g.completionDate,null);
 setCompleted(g,true,new Date('2026-02-04T12:00:00.000Z'));g.previousStatus='completed';g.status='archived';
 assert.deepEqual(completionFields(g),{completedAt:'2026-02-04T12:00:00.000Z',completionDate:null});
 const out=validateBackup({version:2,goals:[g]},true)[0];assert.notEqual(out.id,g.id);assert.equal(out.completedAt,g.completedAt);assert.equal(out.previousStatus,'completed');
});
test('manual dates survive export/import without invented timestamps',()=>{
 const g=goal();g.status='completed';g.completionDate='2025-12-01';
 const out=validateBackup(JSON.parse(JSON.stringify(state(g))))[0];assert.equal(out.completedAt,null);assert.equal(out.completionDate,'2025-12-01');assert.doesNotThrow(()=>validateState(state(out)));
});
test('client and server reject malformed, impossible, future or inconsistent dates',()=>{
 for(const fields of [{completedAt:'bad'},{completedAt:'2026-02-30T12:00:00.000Z'},{completedAt:'2025-01-01T12:00:00.000Z'},{completedAt:'2999-01-01T12:00:00.000Z'},{completionDate:'2026-02-30'},{completionDate:4},{completionDate:'2999-01-01'},{completedAt:'2026-02-01T12:00:00.000Z',completionDate:'2026-02-01'}]){
  const g={...goal(),status:'completed',...fields};assert.throws(()=>validateBackup(state(g)));assert.throws(()=>validateState(state(g)));
 }
 const active={...goal(),completionDate:'2026-01-01'};assert.throws(()=>validateState(state(active)));
});
test('upgraded JSON stays CAS protected and stale v1 clients cannot erase dates',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE goal_states(owner_id TEXT PRIMARY KEY,state_json TEXT,revision INTEGER,updated_at TEXT)');
 const db={prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async run(){return {meta:{changes:sql.prepare(query).run(...args).changes}};}};}};}};
 try{
 const g=goal(),legacy={version:1,categories:[],goals:[g]};delete g.completedAt;delete g.completionDate;
 await writeState(db,'owner',legacy,0);const unchanged=await readState(db,'owner');assert.equal(unchanged.state.version,1);assert.equal(unchanged.version,1);
 const upgraded=state(validateBackup(legacy)[0]);setCompleted(upgraded.goals[0],true,new Date('2026-01-05T12:00:00.000Z'));
 assert.equal((await writeState(db,'owner',upgraded,1)).version,2);
 assert.equal((await writeState(db,'owner',legacy,2)).conflict,true);
 assert.equal((await writeState(db,'owner',upgraded,1)).conflict,true);
 assert.equal((await readState(db,'owner')).state.goals[0].completedAt,'2026-01-05T12:00:00.000Z');
 assert.equal((await readState(db,'other')).state,null);
 }finally{sql.close();}
});
