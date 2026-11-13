import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import * as reflections from '../public/reflection.mjs';import * as model from '../public/model.mjs';
const app=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
function setup(){const ids=new Map();let renderCalls=0,confirmed=true;const timers=[];
 function element(tag='div'){let id='';return{tag,children:[],parent:null,handlers:{},attributes:{},dataset:{},className:'',textContent:'',value:'',hidden:false,selectionStart:0,selectionEnd:0,set id(v){id=v;ids.set(v,this);},get id(){return id;},append(...xs){xs.forEach(x=>{x.parent=this;this.children.push(x);});},replaceChildren(...xs){this.children.forEach(x=>x.parent=null);this.children=[];this.append(...xs);},after(...xs){if(this.parent){const index=this.parent.children.indexOf(this);xs.forEach(x=>x.parent=this.parent);this.parent.children.splice(index+1,0,...xs);}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];if(k==='maxlength')delete this.maxLength;},addEventListener(k,fn){this.handlers[k]=fn;},focus(){},dispatch(k){this.handlers[k]?.({target:this});}};}
 const body=element('body');
 const c=vm.createContext({...reflections,...model,TextEncoder,structuredClone,document:{body,getElementById(id){if(!ids.has(id))ids.set(id,element());return ids.get(id);},createElement:element,querySelectorAll(selector){return descendants(body).filter(n=>selector==='.'+n.className);}},matchMedia:()=>({matches:false}),confirm:()=>confirmed,setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},fetch:async()=>({ok:true,status:200,json:async()=>({version:1})}),console,renderCounter:()=>renderCalls++});
 vm.runInContext(app.slice(0,app.indexOf('function confirmReload()')).replace(/^import .*;\r?\n/gm,''),c);
 vm.runInContext(app.slice(app.indexOf('function field('),app.indexOf('function iconPicker(')),c);
 vm.runInContext(app.slice(app.indexOf('function reflectionDraft('),app.indexOf('function goalCard(')),c);
 vm.runInContext('function render(){renderCounter();} function exportBackup(){} function confirmReload(){};state={version:3,categories:[],goals:[createGoal("Sample goal")]};loaded=true;const goal=state.goals[0];setSave("All changes saved");const panel=reflectionPanel(goal);document.body.append(panel);',c);
 return{c,ids,element,timers,get renders(){return renderCalls;},set confirmed(v){confirmed=v;}};
}
const run=(x,s)=>vm.runInContext(s,x.c);
const descendants=node=>[node,...node.children.flatMap(descendants)];
test('actual five-answer typing handler preserves DOM and caret; saved values keep line breaks',async()=>{const x=setup(),goal=run(x,'goal'),panel=run(x,'panel'),input=x.ids.get(`reflection-${goal.id}-why`);input.value='  I want to understand\nwhat is possible.  ';input.selectionStart=12;input.selectionEnd=12;input.dispatch('input');assert.equal(x.renders,0);assert.equal(x.ids.get(input.id),input);assert.equal(input.selectionStart,12);assert.equal(goal.reflection.why,input.value);assert.equal(run(x,'dirty'),true);await run(x,'save()');assert.equal(run(x,'dirty||saving'),false);assert.equal(input.value,goal.reflection.why);assert.equal(descendants(panel).filter(n=>n.tag==='textarea').length,5);});
test('custom add preserves original answer nodes; question/answer edit, confirmed removal and cancellation work',()=>{const x=setup(),panel=run(x,'panel'),goal=run(x,'goal'),why=x.ids.get(`reflection-${goal.id}-why`);why.value='Keep this thought';why.dispatch('input');const add=descendants(panel).find(n=>n.tag==='button'&&n.textContent.includes('Add a custom'));add.dispatch('click');assert.equal(x.ids.get(why.id),why);assert.equal(goal.customQuestions.length,1);const item=goal.customQuestions[0],q=x.ids.get(`custom-question-${goal.id}-${item.id}`),a=x.ids.get(`custom-answer-${goal.id}-${item.id}`);q.value='My own question';q.dispatch('input');a.value='My own answer';a.dispatch('input');assert.equal(goal.customQuestions[0].answer,a.value);const remove=descendants(panel).find(n=>n.tag==='button'&&n.textContent==='Remove question');x.confirmed=false;remove.dispatch('click');assert.equal(goal.customQuestions.length,1);x.confirmed=true;remove.dispatch('click');assert.equal(goal.customQuestions.length,0);assert.equal(goal.reflection.why,'Keep this thought');assert.equal(x.renders,0);});
test('overlong paste is not truncated or saved; export overlay retains it and shorter input recovers',()=>{const x=setup(),goal=run(x,'goal'),input=x.ids.get(`reflection-${goal.id}-why`);input.value='x'.repeat(2001);input.dispatch('input');assert.equal(input.value.length,2001);assert.equal(goal.reflection.why,'');assert.equal(run(x,'reflectionSnapshot(state,reflectionDrafts).goals[0].reflection.why.length'),2001);assert.equal(run(x,'reflectionDrafts.size'),1);assert.match(x.ids.get('save-state').textContent,/not saved/);input.value='Short enough';input.dispatch('input');assert.equal(goal.reflection.why,'Short enough');assert.equal(run(x,'reflectionDrafts.size'),0);});
test('an edit made during a pending save is sent again; conflict keeps both text and export draft',async()=>{const x=setup(),goal=run(x,'goal'),input=x.ids.get(`reflection-${goal.id}-why`);let resolve;const requests=[];x.c.fetch=(_,args)=>{requests.push(JSON.parse(args.body));if(requests.length===1)return new Promise(r=>resolve=r);return Promise.resolve({ok:false,status:409});};input.value='First';input.dispatch('input');const pending=run(x,'save()');input.value='Later draft';input.selectionStart=5;input.dispatch('input');resolve({ok:true,status:200,json:async()=>({version:1})});await pending;await new Promise(r=>setImmediate(r));assert.equal(requests.length,2);assert.equal(requests[0].state.goals[0].reflection.why,'First');assert.equal(requests[1].state.goals[0].reflection.why,'Later draft');assert.equal(run(x,'dirty&&blocked&&conflict'),true);assert.equal(input.value,'Later draft');assert.equal(input.selectionStart,5);assert.equal(goal.reflection.why,'Later draft');});
test('account-scope mismatch keeps answer draft and displays a sign-back-in warning without rendering',async()=>{const x=setup(),goal=run(x,'goal'),input=x.ids.get(`reflection-${goal.id}-why`);input.value='Unsaved answer';input.dispatch('input');x.c.fetch=async()=>({status:409,ok:false,json:async()=>({error:'account_changed'})});await run(x,'save()');assert.equal(run(x,'dirty&&blocked&&conflict'),true);assert.equal(goal.reflection.why,'Unsaved answer');assert.equal(input.value,'Unsaved answer');assert.match(x.ids.get('storage-warning').children[0].textContent,/different signed-in account/);assert.equal(x.renders,0);});
test('background refresh cannot replace the loaded goal with another account; scope never enters backups',async()=>{const x=setup(),goal=run(x,'goal');x.c.document.querySelector=()=>null;x.c.document.querySelectorAll=()=>[];vm.runInContext(app.slice(app.indexOf('let refreshing=false;'),app.indexOf("window.addEventListener('focus',refreshFromServer)")),x.c);run(x,"ownerScope='original-scope';");x.c.fetch=async()=>({ok:true,json:async()=>({version:99,ownerScope:'other-scope',state:{version:3,categories:[],goals:[model.createGoal('Other account sample')]}})});await run(x,'refreshFromServer()');assert.equal(run(x,'state.goals[0].id'),goal.id);assert.equal(run(x,'blocked&&conflict'),true);assert.equal(x.renders,0);assert.equal(run(x,'reflectionSnapshot(state,reflectionDrafts).ownerScope'),undefined);});

const localStatus=x=>descendants(run(x,'document.body')).find(n=>n.className==='reflection-save-status');
test('all five answers expose precise linked errors and recover without truncating or replacing input',()=>{
 for(const [key] of reflections.REFLECTION_QUESTIONS){
  const x=setup(),goal=run(x,'goal'),input=x.ids.get(`reflection-${goal.id}-${key}`);
  input.value='x'.repeat(2002);input.selectionStart=102;input.dispatch('input');
  const error=x.ids.get(input.id+'-error'),hint=x.ids.get(input.id+'-hint');
  assert.equal(input.attributes['aria-invalid'],'true');
  assert.equal(input.attributes['aria-describedby'],hint.id+' '+error.id);
  assert.match(error.textContent,/2 characters over the 2,000 character limit/);assert.equal(error.hidden,false);
  assert.equal(input.value.length,2002);assert.equal(input.selectionStart,102);assert.equal(x.renders,0);
  assert.equal(localStatus(x).dataset.state,'attention');
  input.value='x'.repeat(2000);input.dispatch('input');
  assert.equal(input.attributes['aria-invalid'],'false');assert.equal(error.hidden,true);assert.equal(error.textContent,'');
  assert.equal(goal.reflection[key].length,2000);assert.equal(localStatus(x).dataset.state,'saving');
 }
});
test('custom questions and answers validate separately while keeping both drafts until corrected',async()=>{
 const x=setup(),goal=run(x,'goal'),panel=run(x,'panel');
 descendants(panel).find(n=>n.tag==='button'&&n.textContent.includes('Add a custom')).dispatch('click');
 const item=goal.customQuestions[0],q=x.ids.get(`custom-question-${goal.id}-${item.id}`),a=x.ids.get(`custom-answer-${goal.id}-${item.id}`);
 q.value='q'.repeat(301);q.dispatch('input');a.value='a'.repeat(2003);a.dispatch('input');
 assert.match(x.ids.get(q.id+'-error').textContent,/1 character over the 300 character limit/);
 assert.match(x.ids.get(a.id+'-error').textContent,/3 characters over the 2,000 character limit/);
 assert.equal(q.attributes['aria-invalid'],'true');assert.equal(a.attributes['aria-invalid'],'true');
 assert.equal(run(x,'reflectionSnapshot(state,reflectionDrafts).goals[0].customQuestions[0].question.length'),301);
 q.value='A question';q.dispatch('input');assert.equal(q.attributes['aria-invalid'],'false');
 assert.equal(localStatus(x).dataset.state,'attention');
 a.value='An answer';a.dispatch('input');await run(x,'save()');
 assert.equal(a.attributes['aria-invalid'],'false');assert.equal(localStatus(x).dataset.state,'saved');
 assert.equal(goal.customQuestions[0].question,q.value);assert.equal(goal.customQuestions[0].answer,a.value);
});
test('local status waits for server acknowledgement and updates replacement panels without retaining old nodes',async()=>{
 const x=setup(),goal=run(x,'goal'),input=x.ids.get(`reflection-${goal.id}-why`);
 const oldStatus=localStatus(x);assert.equal(oldStatus.dataset.state,'saved');
 input.value='A pending answer';input.dispatch('input');assert.match(oldStatus.textContent,/Waiting to save/);
 run(x,'document.body.replaceChildren(reflectionPanel(goal));');const currentStatus=localStatus(x);
 assert.notEqual(currentStatus,oldStatus);assert.match(currentStatus.textContent,/Waiting to save/);
 let resolve;x.c.fetch=()=>new Promise(r=>resolve=r);const pending=run(x,'save()');
 assert.match(currentStatus.textContent,/Saving your answers/);assert.match(oldStatus.textContent,/Waiting to save/);
 resolve({ok:true,status:200,json:async()=>({version:1})});await pending;
 assert.equal(currentStatus.dataset.state,'saved');assert.match(currentStatus.textContent,/Saved/);
 assert.match(oldStatus.textContent,/Waiting to save/);
 assert.equal(currentStatus.attributes['aria-live'],'off');
});
test('an older save response cannot mark a newer invalid draft saved, and connection failures stay visible locally',async()=>{
 const x=setup(),goal=run(x,'goal'),input=x.ids.get(`reflection-${goal.id}-why`);
 input.value='Accepted version';input.dispatch('input');
 let resolve;x.c.fetch=()=>new Promise(r=>resolve=r);const pending=run(x,'save()');
 input.value='x'.repeat(2001);input.dispatch('input');
 resolve({ok:true,status:200,json:async()=>({version:1})});await pending;
 assert.equal(localStatus(x).dataset.state,'attention');assert.match(localStatus(x).textContent,/draft is not saved/);
 assert.equal(run(x,'reflectionDrafts.size'),1);
 input.value='Fixed draft';input.dispatch('input');x.c.fetch=async()=>{throw new Error('Network unavailable');};await run(x,'save()');
 assert.equal(localStatus(x).dataset.state,'attention');assert.match(localStatus(x).textContent,/Changes not saved/);
 assert.equal(input.value,'Fixed draft');assert.equal(run(x,'dirty&&blocked'),true);
});
