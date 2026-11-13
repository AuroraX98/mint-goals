import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readState,writeState } from '../lib/goal-store.mjs';
import { createGoal,createTask,addSubsteps,NOTEBOOK_VERSION } from '../public/model.mjs';
test('real local D1 persists across worker lifetimes and protects owners and revisions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'mint-d1-'));
 const start=()=>new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-15',d1Databases:['DB'],d1Persist:dir});
 let mf=start();
 try {
 let db=await mf.getD1Database('DB');
 await db.prepare(readFileSync(new URL('../drizzle/0000_funny_maggott.sql',import.meta.url),'utf8')).run();
 const goal=createGoal('Python'),task=createTask('Choose an editor');
 goal.tasks.push(task);
 addSubsteps(task,['Open the file list','Find the code pane']);
 task.substeps[0].done=true;
 const state={version:NOTEBOOK_VERSION,categories:[],goals:[goal]};
 assert.equal((await writeState(db,'alice',state,0)).version,1);
 await mf.dispose();mf=start();db=await mf.getD1Database('DB');
 assert.deepEqual(await readState(db,'alice'),{state,version:1});
 assert.deepEqual(await readState(db,'bob'),{state:null,version:0});
 assert.equal((await writeState(db,'alice',{version:3,categories:[],goals:[]},1)).conflict,true);
 const writes=await Promise.all([writeState(db,'alice',state,1),writeState(db,'alice',state,1)]);
 assert.equal(writes.filter(x=>x.conflict).length,1);
 assert.equal((await readState(db,'alice')).version,2);
 }finally{await mf.dispose();rmSync(dir,{recursive:true,force:true});}
});
