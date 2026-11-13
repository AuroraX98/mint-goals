import { attachSurfaceMotion } from './surface-motion.mjs';
import { mountStepOptions, appendStepOptions, trackDialogViewport } from './step-options.mjs?v=ui-refresh-2';
import { mountGlassSwitch } from './filter-switch.mjs?v=2';
import { celebrateStep, celebrateGoal } from './confetti.mjs';
import { REFLECTION_QUESTIONS, REFLECTION_LIMIT, CUSTOM_QUESTION_LIMIT, customQuestionFields, reflectionFields, reflectionSnapshot } from './reflection.mjs';
import { createSignInLink } from './auth-ui.mjs';
import { completionFields, setCompleted } from './completion.mjs';
import { summarizeProgress } from './progress.mjs';
import { createGoal, createTask, progress, moveTask, addSubsteps, setTaskDone, syncTaskDone, NOTEBOOK_VERSION, validateBackup, cleanText, LIMITS, uid, assertStateSize } from './model.mjs';
import { icon, iconGroups, paths } from './icons.mjs';
import { stageCategory, prepareGoalSave } from './goal-form.mjs';
import { createFocusPreferences, focusSelection } from './focus-view.mjs';
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; };
const button = (text, cls, action, label) => { const b=el('button',cls,text); b.type='button'; if(label)b.setAttribute('aria-label',label); b.addEventListener('click',action); return b; };
const emojis=['✨','🌱','📚','✍️','🎨','🎵','💡','🎯','💻','🧠','📝','📖','💪','🏃','🧘','🥗','💧','😴','🚶','❤️','🏡','🧹','🛒','🍳','☕','💰','📅','📞','🌍','✈️','🌸','☀️','🎸','📸','🧵','🛠️','🤝','🐾','🎉','✅'];
let state={version:NOTEBOOK_VERSION,goals:[],categories:[]}, acceptedState=JSON.stringify(state), revision=0, ownerScope=null, loaded=false, filter='active', categoryFilter='', saving=false, dirty=false, blocked=false, conflict=false, scopeMismatch=false, toastTimer, dialogAction, dialogOrigin;
let surfaces=null;
function announce(message){if(surfaces){surfaces.announce(message);return;}$('status').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('status').textContent='',5500);}
const expandedSteps = new Set();
let focusPreferences=null, focusStorageAvailable=true;
const reflectionDrafts=new Map(), reflectionOpen=new Map();let reflectionTimer, lastSaveText='Loading your goals…';
function setSave(text){lastSaveText=text;$('save-state').textContent=reflectionDrafts.size?'Answer draft not saved · shorten it or export':text;syncReflectionSaveStatuses();}

function warning(message, actions=[]){const box=$('storage-warning');box.replaceChildren(el('div','',message));actions.forEach(a=>box.append(button(a.text,'small-button',a.action)));box.hidden=false;}
function showSignIn(preserveEdits=false){warning(preserveEdits?'Your session expired. Export your unsaved edits first. Sign in with the same ChatGPT account in a new tab, then return here and retry saving. Keep this tab open.':'Sign in with your own ChatGPT account to load and save your goals. No installation is needed.',preserveEdits?[{text:'Export your edits',action:exportBackup},{text:'Retry save after signing in',action:()=>{blocked=false;save();}}]:[]);$('storage-warning').append(createSignInLink(document,preserveEdits));setSave(preserveEdits?'Sign in needed · edits not saved':'Not signed in');}
function clearWarning(){if(!reflectionDrafts.size)$('storage-warning').hidden=true;}
function validateState(data,newIds=false){const goals=validateBackup(data,newIds);if(!Array.isArray(data.categories)||data.categories.length>50)throw new Error('Invalid category list.');const seen=new Set(), mapping=new Map();const categories=data.categories.map(c=>{if(!c||typeof c.id!=='string'||!c.id||seen.has(c.id))throw new Error('Invalid category.');seen.add(c.id);const id=newIds?uid():c.id;mapping.set(c.id,id);return {id,name:cleanText(c.name,60,true)};});goals.forEach(g=>{g.categoryId=mapping.get(g.categoryId)||'';if(!paths[g.icon])g.icon='target';});const result={version:NOTEBOOK_VERSION,goals,categories};assertStateSize(result);return result;}
async function load(){setSave('Loading your goals…');$('new-goal').disabled=true;try{const r=await fetch('/api/state',{cache:'no-store',credentials:'same-origin'});if(r.status===401){loaded=false;showSignIn();return;}if(!r.ok)throw new Error('Your goals could not be loaded. Please check your connection.');const data=await r.json();if(!Number.isInteger(data.version)||typeof data.ownerScope!=='string'||!/^[a-f0-9]{64}$/.test(data.ownerScope))throw new Error('Unexpected server response.');ownerScope=data.ownerScope;state=data.state?validateState(data.state):{version:NOTEBOOK_VERSION,goals:[],categories:[]};revision=data.version;acceptedState=JSON.stringify(state);loaded=true;loadFocusPreferences();expandedSteps.clear();stepDrafts.clear();reflectionDrafts.clear();dirty=false;blocked=false;conflict=false;scopeMismatch=false;clearWarning();setSave('All changes saved');render();}catch(e){warning(e.message,[{text:'Try loading again',action:load}]);setSave('Not connected');}finally{$('new-goal').disabled=!loaded;}}
function changed(message,redraw=true){
 try{assertStateSize(state);}catch(error){state=JSON.parse(acceptedState);render();announce(error.message);return false;}
 acceptedState=JSON.stringify(state);dirty=true;
 if(redraw)render();
 if(message)announce(message);
 save();
 return true;
}
async function save(){if(saving||blocked||!dirty||!loaded)return;saving=true;dirty=false;const snapshot=JSON.parse(JSON.stringify(state));setSave('Saving…');try{const r=await fetch('/api/state',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot,version:revision,ownerScope})});if(r.status===401){dirty=true;blocked=true;showSignIn(true);return;}if(r.status===409){conflict=true;const problem=await r.json().catch(()=>({}));if(problem.error==='account_changed'){scopeMismatch=true;throw new Error('This tab belongs to a different signed-in account. Your edits have NOT been saved to the current account. Export them, then sign back in with the original account and retry, or explicitly load the current account’s saved goals.');}if(problem.error==='upgrade_required')throw new Error('This app needs to be reloaded before it can save. Export your unsaved edits first.');throw new Error('Your goals changed on another device, or this tab uses an older app version. Your edits are still here, but have not been saved. Export them first, then load the latest saved version.');}if(!r.ok)throw new Error('Your latest changes are not saved yet. They are still in this tab. Check your connection and try again, or export a backup.');const result=await r.json();if(!Number.isInteger(result.version))throw new Error('The server returned an unexpected save response. Export a backup before reloading.');revision=result.version;setSave(dirty?'Saving…':'All changes saved');clearWarning();}catch(e){dirty=true;blocked=true;setSave('Changes not saved');const actions=[{text:'Export your edits',action:exportBackup}];if(scopeMismatch)actions.push({text:'Retry after signing back in',action:()=>{blocked=false;conflict=false;scopeMismatch=false;save();}});if(conflict)actions.push({text:'Load saved version…',action:confirmReload});else actions.push({text:'Retry save',action:()=>{blocked=false;save();}});warning(e.message,actions);}finally{saving=false;if(dirty&&!blocked)save();}}
function confirmReload(){openDialog('Load the saved version?','PROTECT YOUR EDITS',fields=>{fields.append(el('p','field-hint','This replaces the unsaved changes in this tab with the version saved on the server. Export your edits first if you want to keep them.'));},async()=>{closeDialog();loaded=false;await load();},'Replace with saved version');}
function openDialog(title,kicker,build,onSave,saveLabel='Save'){dialogOrigin=document.activeElement?.closest('.step-options')?.querySelector('summary')||document.activeElement;$('editor-title').textContent=title;$('editor-kicker').textContent=kicker;$('editor-error').textContent='';$('save-editor').textContent=saveLabel;$('editor-fields').replaceChildren();build($('editor-fields'));dialogAction=onSave;const body=$('editor').querySelector('.dialog-body');if(body)body.scrollTop=0;if(surfaces)surfaces.openDialog();else $('editor').showModal();const first=$('editor-fields').querySelector('input,textarea,select,button');first?.focus();}
function closeDialog(){if(surfaces)surfaces.closeDialog();else $('editor').close();dialogAction=null;dialogOrigin?.focus();}
$('close-editor').onclick=closeDialog;$('cancel-editor').onclick=closeDialog;$('editor').addEventListener('close',()=>{if($('editor').open)return;const active=document.activeElement;if(active?.isConnected&&active!==document.body&&!$('editor').contains(active))return;if(dialogOrigin?.isConnected){dialogOrigin.focus();return;}
 const oldCard=dialogOrigin?.closest('article');
 const oldId=oldCard?.getAttribute('aria-labelledby');
 const fresh=oldId&&document.getElementById(oldId)?.closest('article');
 const role=dialogOrigin?.getAttribute('aria-label');
 const candidate=fresh&&Array.from(fresh.querySelectorAll('button,summary')).find(b=>dialogOrigin.dataset.focusKey?b.dataset.focusKey===dialogOrigin.dataset.focusKey:role?b.getAttribute('aria-label')===role:b.textContent===dialogOrigin.textContent);
 (candidate||fresh?.querySelector('.goal-title')||document.querySelector('[data-filter][aria-pressed=true]'))?.focus();
});
$('editor-form').onsubmit=async e=>{e.preventDefault();try{await dialogAction?.();}catch(error){$('editor-error').textContent=error.message;}};
function field(parent,label,id,value,max,multiline=false){const l=el('label','',label);l.htmlFor=id;const input=el(multiline?'textarea':'input');input.id=id;input.value=value;input.maxLength=max;if(!multiline)input.type='text';parent.append(l,input);return input;}
function iconPicker(parent,selected,onSelect){const wrap=el('div','icon-section');wrap.setAttribute('aria-label','Choose a goal icon');let current=selected;for(const [group,names]of Object.entries(iconGroups)){wrap.append(el('h3','',group));const grid=el('div','icon-options');names.forEach(name=>{const b=button('','icon-option',()=>{current=name;wrap.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.icon===name)));onSelect(name);},name);b.dataset.icon=name;b.title=name;b.setAttribute('aria-pressed',String(name===current));b.append(icon(name));grid.append(b);});wrap.append(grid);}parent.append(wrap);}
function editGoal(goal=null){
  if(!loaded)return;
  let name,description,category,newCategory,selected=goal?.icon||'target';
  let draftCategories=state.categories.map(c=>({...c}));
  const steps=[];
  const addCategory=()=>{
    const staged=stageCategory(draftCategories,newCategory.value);
    draftCategories=staged.categories;
    category.replaceChildren(new Option('Uncategorized',''));
    draftCategories.forEach(c=>category.append(new Option(c.name,c.id)));
    category.value=staged.categoryId;
    newCategory.value='';
  };
  openDialog(goal?'Edit your goal':'A new goal',goal?'MAKE IT YOURS':'A FRESH START',fields=>{
    name=field(fields,'Goal name','goal-name',goal?.title||'',140);name.required=true;name.placeholder='What would you like to work toward?';
    description=field(fields,'Description (optional)','goal-description',goal?.description||'',3000,true);description.placeholder='What does this goal mean to you?';
    const label=el('label','','Category');label.htmlFor='goal-category';category=el('select');category.id='goal-category';category.append(new Option('Uncategorized',''));
    draftCategories.forEach(c=>category.append(new Option(c.name,c.id)));category.value=goal?.categoryId??(categoryFilter==='uncategorized'?'':categoryFilter);
    fields.append(label,category);
    const categoryDetails=el('details','goal-category-details');categoryDetails.append(el('summary','','＋ Create a category'));
    newCategory=field(categoryDetails,'New category name','goal-new-category','',60);newCategory.placeholder='e.g. Learning or Wellbeing';
    categoryDetails.append(button('Add category','small-button',()=>{try{addCategory();$('editor-error').textContent='';categoryDetails.open=false;category.focus();}catch(error){$('editor-error').textContent=error.message;}}),el('p','field-hint','Your new category is selected automatically and saved with this goal.'));
    fields.append(categoryDetails);
    if(!goal){
      fields.append(el('h3','','Steps (optional)'),el('p','field-hint','Write your first steps here, or add them to the goal later. Blank steps are skipped.'));
      const list=el('div','goal-draft-steps');fields.append(list);
      let stepSequence=0;
      const addStep=()=>{
        if(steps.length>=LIMITS.tasks){$('editor-error').textContent='A goal can have up to 200 steps.';return;}
        const row=el('div'),id=++stepSequence;
        const text=field(row,'Step',`goal-step-${id}`,'',300);text.placeholder='A small, doable next step…';
        const emojiLabel=el('label','','Emoji (optional)');emojiLabel.htmlFor=`goal-step-emoji-${id}`;
        const emoji=el('select');emoji.id=emojiLabel.htmlFor;emoji.append(new Option('No emoji',''));emojis.forEach(value=>emoji.append(new Option(value,value)));emoji.value='✨';
        const entry={text,emoji};steps.push(entry);
        row.append(emojiLabel,emoji,button('Remove step','text-button goal-remove-step',()=>{steps.splice(steps.indexOf(entry),1);row.remove();addStepButton.focus();}));list.append(row);
        return text;
      };
      const addStepButton=button('＋ Add step','small-button goal-add-step',()=>addStep()?.focus());fields.append(addStepButton);addStep();
    }
    const details=el('details','goal-icon-details');details.append(el('summary','','Choose a goal icon'));iconPicker(details,selected,id=>selected=id);fields.append(details);
  },()=>{
    if(newCategory.value.trim())addCategory();
    state=prepareGoalSave(state,{title:name.value,description:description.value,categoryId:category.value,icon:selected,categories:draftCategories,steps:steps.map(step=>({text:step.text.value,emoji:step.emoji.value}))},goal?.id);
    if(!goal){
     filter='active';
     if(categoryFilter)categoryFilter=category.value||'uncategorized';
     rememberFocusCategory();switchView('goals');
    }
    closeDialog();changed(goal?'Goal updated.':'Your goal is ready.');
  },goal?'Save changes':'Create goal');
}
function chooseGoalIcon(goal){let chosen=goal.icon;openDialog('An icon for your goal','A LITTLE PERSONALITY',fields=>iconPicker(fields,chosen,id=>chosen=id),()=>{goal.icon=chosen;closeDialog();changed('Goal icon updated.');},'Use this icon');}
function chooseEmoji(initial,onSave){let value;openDialog('Make this step yours','CHOOSE AN EMOJI',fields=>{value=field(fields,'Emoji (or leave blank)','emoji-value',initial,24);const grid=el('div','emoji-grid');emojis.forEach(emoji=>{const b=button(emoji,'',()=>{value.value=emoji;grid.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.textContent===emoji)));},`Choose ${emoji}`);b.setAttribute('aria-pressed',String(initial===emoji));grid.append(b);});fields.append(grid,el('p','field-hint','Pick one above, or use your device’s emoji keyboard.'));},()=>{const emoji=cleanText(value.value,24);closeDialog();onSave(emoji);},'Use emoji');}
function editTask(goal,task){let input,emoji;openDialog('Edit your step','ONE STEP AT A TIME',fields=>{input=field(fields,'Step','task-text',task.text,300);input.required=true;emoji=field(fields,'Emoji (optional)','task-emoji',task.emoji,24);const grid=el('div','emoji-grid');emojis.forEach(e=>grid.append(button(e,'',()=>emoji.value=e,`Choose ${e}`)));fields.append(grid);},()=>{task.text=cleanText(input.value,300,true);task.emoji=cleanText(emoji.value,24);closeDialog();changed('Step updated.');},'Save step');}
function manageCategories(){if(!loaded)return;let inputs=[],newName;openDialog('Your categories','A PLACE FOR EVERY GOAL',fields=>{fields.append(el('p','field-hint','Rename a category below, or add a new one. Your goals stay linked when you rename.'));state.categories.forEach((c,i)=>{const input=field(fields,`Category ${i+1}`,`category-${i}`,c.name,60);input.required=true;inputs.push({id:c.id,input});});newName=field(fields,'New category (optional)','new-category','',60);newName.placeholder='e.g. Learning, Wellbeing, Creative projects';},()=>{const updated=inputs.map(c=>({id:c.id,name:cleanText(c.input.value,60,true)}));const name=cleanText(newName.value,60);if(name){if(updated.length>=50)throw new Error('You can keep up to 50 categories.');updated.push({id:uid(),name});}if(new Set(updated.map(c=>c.name.toLowerCase())).size!==updated.length)throw new Error('Please give each category a different name.');state.categories=updated;closeDialog();changed('Categories saved.');},'Save categories');}
let currentView='goals', progressPeriod='week', progressCategory='';
const progressZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
function switchView(view,updateAddress=true){
 currentView=view;
 if(updateAddress && location.hash!=='#'+view)history.pushState(null,'','#'+view);
 const isProgress=view==='progress';
 document.title=(isProgress?'Progress':'Goals')+' · Mint Goals';
 $('workspace-title').textContent=isProgress?'Progress history':'My goals';
 $('page-title').textContent=isProgress?'Your progress.':'Your goals.';
 $('goals-view').hidden=view!=='goals';$('progress-view').hidden=view!=='progress';syncView(view);if(isProgress)renderProgress();}
function backfillDate(goal){let input;openDialog('Completion date','YOUR RECORD',fields=>{fields.append(el('p','field-hint','Only add a date you know. Leaving this blank keeps the date unknown. A manually entered date appears on the chart, but is excluded from typical duration because the exact time is unknown.'));input=field(fields,'Date completed (optional)','completion-date',goal.completionDate||'',10);input.type='date';const today=new Date();input.max=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;},()=>{const candidate={...goal,completedAt:null,completionDate:input.value||null};if(input.value&&input.value>input.max)throw new Error('Choose today or an earlier date.');Object.assign(goal,completionFields(candidate));closeDialog();changed('Completion date updated.');},'Save date');}
function renderProgress(){
 if(!$('progress-category'))return;
 const select=$('progress-category');select.replaceChildren(new Option('All categories',''),new Option('Uncategorized','uncategorized'));state.categories.forEach(c=>select.append(new Option(c.name,c.id)));select.value=progressCategory;
 const box=$('progress-content');box.replaceChildren();if(!loaded){box.append(el('p','','Load your goals to see progress.'));return;}
 const report=summarizeProgress(state.goals,{period:progressPeriod,categoryId:progressCategory,timeZone:progressZone});
 const summary=el('div','progress-summary');
 const total=el('div','progress-stat');total.append(el('strong','',String(report.completedCount)),el('span','','currently completed'));
 const typical=el('div','progress-stat');typical.append(el('strong','',report.medianDays===null?'Not known yet':`${new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(report.medianDays)} days`),el('span','','typical elapsed time (median)'));
 summary.append(total,typical);box.append(summary,el('p','field-hint','Typical time is elapsed calendar time from goal creation to its latest recorded completion—not hours worked. Only exact recorded timestamps are included; older and manually dated goals are excluded.'));
 const panel=el('section','progress-panel');panel.append(el('h3','',progressPeriod==='week'?'Completions by week':'Completions by month'),el('p','field-hint',`Dates use ${report.timeZone}. Weeks start Monday. The chart shows only dates within this window.`));
 const chart=el('div','completion-chart');chart.setAttribute('aria-hidden','true');const max=Math.max(1,...report.buckets.map(b=>b.count));report.buckets.forEach(b=>{const col=el('div','chart-column');const bar=el('div','chart-bar');bar.style.height=`${b.count/max*120}px`;col.append(el('span','chart-count',String(b.count)),bar,el('span','chart-label',b.label));chart.append(col);});panel.append(chart);
 const details=el('details','chart-data');details.append(el('summary','','View chart as a table'));const table=el('table');const caption=el('caption','','Completed goals by '+progressPeriod);table.append(caption);const head=el('thead'),hr=el('tr');['Period starting','Goals completed'].forEach(t=>{const th=el('th','',t);th.scope='col';hr.append(th);});head.append(hr);table.append(head);const body=el('tbody');report.buckets.forEach(b=>{const row=el('tr');const th=el('th','',b.key);th.scope='row';row.append(th,el('td','',String(b.count)));body.append(row);});table.append(body);details.append(table);panel.append(details);box.append(panel);
 if(report.unknownCount)box.append(el('p','unknown-dates',`${report.unknownCount} completed ${report.unknownCount===1?'goal has':'goals have'} an unknown date and ${report.unknownCount===1?'is':'are'} not plotted. Add a known date below if you wish.`));
 const timeline=el('section','progress-panel');timeline.append(el('h3','','Your completed-goal timeline'),el('p','field-hint','All completion dates, not just the chart window. Category filter applies to everything in this view.'));
 if(!report.timeline.length)timeline.append(el('p','','No completed goals in this category yet. When you finish one, its completion date will appear here.'));
 const list=el('ol','completion-timeline');report.timeline.forEach(item=>{const g=item.goal,row=el('li');const title=el('strong','',g.title);const category=state.categories.find(c=>c.id===g.categoryId)?.name||'Uncategorized';row.append(title,el('span','timeline-meta',`${category}${g.status==='archived'?' · Archived':''}`),el('span','timeline-date',item.dateKey?`${item.dateKey}${item.dateSource==='manual'?' · Entered by you':''}`:'Completion date unknown'));if(item.durationDays!==null)row.append(el('span','timeline-meta',`${new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(item.durationDays)} days elapsed`));if(!g.completedAt)row.append(button(g.completionDate?'Edit date':'Add known date','small-button',()=>backfillDate(g),`${g.completionDate?'Edit':'Add known'} completion date for ${g.title}`));list.append(row);});timeline.append(list);box.append(timeline);
}
const syncView=mountGlassSwitch(document.querySelector('.view-switch'),switchView,'data-view');
$('progress-period').onchange=e=>{progressPeriod=e.target.value;renderProgress();};$('progress-category').onchange=e=>{progressCategory=e.target.value;renderProgress();};
function updateCounts(){
 const live=state.goals.filter(g=>g.status!=='archived');
 $('active-count').textContent=live.filter(g=>g.status==='active').length;
 $('completed-count').textContent=live.filter(g=>g.status==='completed').length;
 $('step-count').textContent=live.reduce((count,goal)=>count+goal.tasks.filter(task=>task.done).length,0);
}
function render(){
 if(categoryFilter&&categoryFilter!=='uncategorized'&&!state.categories.some(c=>c.id===categoryFilter))categoryFilter='';
 if(currentView==='progress')renderProgress();renderCategories();syncFilters(filter);
 if(!loaded)return;
 updateCounts();renderFocusBar();
 const box=$('goals');box.replaceChildren();
 const focused=filter==='active'&&focusPreference().enabled;
 box.classList.toggle('focus-layout',focused);
 if(focused){renderFocusedGoals();return;}
 const shown=state.goals.filter(g=>g.status===filter&&(!categoryFilter||(categoryFilter==='uncategorized'?!g.categoryId:g.categoryId===categoryFilter)));
 if(!shown.length){empty();return;}
 shown.forEach(g=>box.append(goalCard(g)));
}
function goalPosition(goalId){return [...$('goals').querySelectorAll('article')].findIndex(card=>card.getAttribute('aria-labelledby')==='goal-'+goalId);}
function focusGoalAfterChange(goalId,position){
 const cards=[...$('goals').querySelectorAll('article')];
 const card=cards.find(item=>item.getAttribute('aria-labelledby')==='goal-'+goalId)||cards[Math.max(0,Math.min(position,cards.length-1))];
 (card?.querySelector('.goal-title')||$('focus-next')||$('focus-pause-title')||document.querySelector('[data-filter][aria-pressed=true]'))?.focus();
}
function renderCategories(){const select=$('category-filter');select.replaceChildren(new Option('All categories',''),new Option('Uncategorized','uncategorized'));state.categories.forEach(c=>select.append(new Option(c.name,c.id)));select.value=categoryFilter;}
function loadFocusPreferences(){
 let storage;
 try{storage=window.localStorage;}catch{}
 focusPreferences=createFocusPreferences(storage,ownerScope);
 focusStorageAvailable=true;
 categoryFilter=focusPreferences.getCategory();
 if(categoryFilter&&categoryFilter!=='uncategorized'&&!state.categories.some(c=>c.id===categoryFilter))categoryFilter='';
}
function focusPreference(){return focusPreferences?.get(categoryFilter)||{enabled:false,focusedId:null,otherOpen:false,completedOpen:false,order:[]};}
function rememberFocus(patch){
 if(!focusPreferences?.patch(categoryFilter,patch)){
  focusStorageAvailable=false;
  announce('This view works for this visit. Your browser could not remember it for next time.');
 }
}
function rememberFocusCategory(){
 if(focusPreferences&&!focusPreferences.setCategory(categoryFilter))focusStorageAvailable=false;
}
function focusGoal(goal){
 rememberFocus({enabled:true,focusedId:goal.id,otherOpen:false,completedOpen:false});
 rememberFocusCategory();render();
 $('goal-'+goal.id)?.focus();
}
function renderFocusBar(){
 const bar=$('focus-controls');bar.hidden=filter!=='active';bar.replaceChildren();
 if(bar.hidden)return;
 const preference=focusPreference(),label=el('label','focus-switch'),toggle=el('input');
 toggle.type='checkbox';toggle.id='one-goal-at-a-time';toggle.checked=preference.enabled;
 toggle.setAttribute('role','switch');toggle.setAttribute('aria-describedby','focus-hint');
 toggle.addEventListener('change',()=>{
  const selection=focusSelection(state.goals,categoryFilter,focusPreference());
  rememberFocus({enabled:toggle.checked,focusedId:selection.focused?.status==='active'?selection.focused.id:selection.active[0]?.id||null});
  rememberFocusCategory();render();$('one-goal-at-a-time')?.focus();
 });
 label.append(toggle,el('span','','One goal at a time'));
 const hint=el('p','field-hint',preference.enabled?'Your other goals are below. This view is remembered in this browser.':'Choose a goal to focus on and tuck the others away.');
 // A storage failure does not prevent using the view during this visit.
 if(!focusStorageAvailable)hint.textContent='This view lasts for this visit. Browser storage is unavailable.';
 hint.id='focus-hint';bar.append(label,hint);
}
function focusDisclosure(title,count,field,build){
 const details=el('details','focus-disclosure'),summary=el('summary','',`${title} (${count})`);
 details.id=field==='otherOpen'?'other-goals':'completed-goals';
 details.open=focusPreference()[field];details.append(summary);
 let built=false;
 function expand(){if(details.open&&!built){build(details);built=true;}}
 expand();
 details.addEventListener('toggle',()=>{
  if(!details.isConnected)return;
  expand();
  if(focusPreference()[field]!==details.open)rememberFocus({[field]:details.open});
 });
 return details;
}
function renderFocusedGoals(){
 const box=$('goals'),selection=focusSelection(state.goals,categoryFilter,focusPreference());
 const {focused,active,others,completed,next}=selection;
 if(focused?.status==='active'){
  const card=goalCard(focused);card.classList.add('focused-goal');box.append(card);
 }else{
  const pause=el('section','focus-pause'),title=el('h3','',focused?.status==='completed'?'Goal complete.':active.length?'Choose your next goal.':'No goals waiting.');
  title.id='focus-pause-title';title.tabIndex=-1;pause.setAttribute('aria-labelledby',title.id);pause.append(title);
  if(focused?.status==='completed')pause.append(el('p','',focused.title));
  if(next){
   pause.append(el('p','field-hint','Open the next goal when you’re ready, or choose one from Other goals.'));
   const open=button('Open next goal','primary',()=>focusGoal(next));open.id='focus-next';
   pause.append(open,el('p','focus-next-title','Up next: '+next.title));
  }else{
   pause.append(el('p','field-hint',completed.length?'You’ve finished the goals in this view. Revisit them below or add a new goal.':'Add a goal here, or choose another category.'));
   pause.append(button('＋ New goal','primary',()=>editGoal()));
  }
  box.append(pause);
 }
 box.append(focusDisclosure('Other goals',others.length,'otherOpen',details=>{
  if(!others.length){details.append(el('p','focus-list-hint','No other goals waiting in this view.'));return;}
  details.append(el('p','focus-list-hint','Choose a goal to focus on. Move goals up or down to set what comes next.'));
  const list=el('ol','focus-queue');
  others.forEach((goal,index)=>{
   const row=el('li','focus-queue-row'),info=el('div','focus-queue-info'),value=progress(goal);
   info.append(el('strong','',goal.title),el('span','field-hint',`${value.done} of ${value.total} steps complete`));
   if(!categoryFilter)info.append(el('span','field-hint',state.categories.find(c=>c.id===goal.categoryId)?.name||'Uncategorized'));
   const actions=el('div','focus-queue-actions');
   for(const [direction,symbol,name]of [[-1,'↑','up'],[1,'↓','down']]){
    const move=button(symbol,'small-button',()=>{
     const neighbor=others[index+direction];if(!neighbor)return;
     const order=active.map(g=>g.id),from=order.indexOf(goal.id),to=order.indexOf(neighbor.id);
     [order[from],order[to]]=[order[to],order[from]];
     rememberFocus({order,otherOpen:true});render();
     const buttons=Array.from(document.querySelectorAll('[data-queue-goal]')).filter(b=>b.dataset.queueGoal===goal.id&&!b.disabled);
     (buttons.find(b=>b.dataset.direction===name)||buttons[0])?.focus();
    },`Move ${goal.title} ${name} in queue`);
    move.disabled=index+direction<0||index+direction>=others.length;
    move.dataset.queueGoal=goal.id;move.dataset.direction=name;actions.append(move);
   }
   actions.append(button('Focus on this','small-button',()=>focusGoal(goal),`Focus on ${goal.title}`));
   row.append(info,actions);list.append(row);
  });
  details.append(list);
 }));
 box.append(focusDisclosure('Completed goals',completed.length,'completedOpen',details=>{
  if(!completed.length){details.append(el('p','focus-list-hint','Your completed goals will appear here.'));return;}
  const cards=el('div','focus-completed-list');completed.forEach(goal=>cards.append(goalCard(goal)));details.append(cards);
 }));
}
function empty(){const box=el('div','empty-state');box.append(el('div','empty-symbol',filter==='completed'?'✓':filter==='archived'?'↶':'✳'));const title=categoryFilter?'A little space for this category.':filter==='completed'?'Your finished goals will live here.':filter==='archived'?'Nothing tucked away.':'What would you like to make happen?';box.append(el('h3','',title),el('p','',categoryFilter?'Add a goal to this category, or choose All categories to see the rest.':filter==='active'?'Start with something that matters to you. Give it a name, then break it into small, doable steps.':filter==='completed'?'When a goal feels finished, mark it complete. You can revisit or reopen it anytime.':'Archived goals stay safe here. Restore them whenever you’re ready.'));if(filter==='active'){const actions=el('div','empty-actions');actions.append(button('＋ Create a goal','primary',()=>editGoal()));if(!state.goals.length)actions.append(button('Try an example','text-button',example));box.append(actions);}$('goals').append(box);}
function reflectionDraft(goal){return reflectionDrafts.get(goal.id)||{reflection:reflectionFields(goal.reflection),customQuestions:customQuestionFields(goal.customQuestions)};}
function paintReflectionSaveStatus(status,goalId){
 let state='attention',text;
 if(reflectionDrafts.has(goalId))text='Needs attention · this answer draft is not saved. Shorten any marked fields, or review the message above.';
 else if(lastSaveText==='All changes saved'){state='saved';text='Saved · your answers are up to date.';}
 else if(lastSaveText==='Saving…'){state='saving';text='Saving your answers…';}
 else if(lastSaveText==='Unsaved answers…'){state='saving';text='Waiting to save your answers…';}
 else if(lastSaveText==='Loading your goals…'){state='loading';text='Loading your saved answers…';}
 else text='Needs attention · '+lastSaveText+'. Review the message above before closing.';
 status.dataset.state=state;status.textContent=text;
}
function syncReflectionSaveStatuses(){
 // Look up only current nodes; replaced or collapsed cards never leave subscriptions behind.
 document.querySelectorAll('.reflection-save-status').forEach(status=>paintReflectionSaveStatus(status,status.dataset.goalId));
}
function reflectionFieldFeedback(input,limit){
 const hint=el('span','reflection-count'),error=el('p','reflection-field-error');
 hint.id=input.id+'-hint';error.id=input.id+'-error';
 input.setAttribute('aria-describedby',hint.id+' '+error.id);
 input.after(hint,error);
 const update=()=>{
  const extra=input.value.length-limit;
  hint.textContent=`${input.value.length.toLocaleString()} / ${limit.toLocaleString()}`;
  input.setAttribute('aria-invalid',String(extra>0));
  error.hidden=extra<=0;
  error.textContent=extra>0?`${extra.toLocaleString()} ${extra===1?'character':'characters'} over the ${limit.toLocaleString()} character limit. Shorten this text to save.`:'';
 };
 update();return update;
}
function updateReflection(goal,patch){
 reflectionDrafts.set(goal.id,{...reflectionDraft(goal),...patch});
 try{
  const next=reflectionSnapshot(state,reflectionDrafts);
  next.goals.forEach(g=>{reflectionFields(g.reflection);customQuestionFields(g.customQuestions);});assertStateSize(next);
  for(const g of state.goals){const updated=next.goals.find(n=>n.id===g.id);g.reflection=updated.reflection;g.customQuestions=updated.customQuestions;}
  reflectionDrafts.clear();acceptedState=JSON.stringify(state);dirty=true;
  setSave(blocked?'Changes not saved · see message above':'Unsaved answers…');
  clearTimeout(reflectionTimer);reflectionTimer=setTimeout(save,600);
 }catch(error){setSave('Answer draft not saved');warning(`Your answer draft is still in this tab, but has not been saved. ${error.message} Shorten it or export your edits before leaving.`,[{text:'Export your edits',action:exportBackup}]);}
}
function reflectionPanel(goal,lazy=false){
 const panel=el('details','goal-reflection');panel.open=reflectionOpen.has(goal.id)?reflectionOpen.get(goal.id):false;
 panel.addEventListener('toggle',()=>reflectionOpen.set(goal.id,panel.open));
 const summary=el('summary','','Why this goal?');panel.append(summary);
 function buildContents(){
 const body=el('div','reflection-scroll');body.setAttribute('role','region');body.setAttribute('aria-label',`Optional ideas and intentions for ${goal.title}`);body.tabIndex=0;
 body.append(el('p','reflection-intro','Your ideas & intentions, connected to this goal. Every question is optional.'));
 const status=el('p','reflection-save-status');status.dataset.goalId=goal.id;
 // The page's existing live status announces saves once. This copy stays readable beside the answers.
 status.setAttribute('role','status');status.setAttribute('aria-live','off');paintReflectionSaveStatus(status,goal.id);
 for(const [key,question] of REFLECTION_QUESTIONS){
  const wrap=el('div','reflection-answer'),id=`reflection-${goal.id}-${key}`,label=el('label','',question),input=el('textarea');
  label.htmlFor=id;input.id=id;input.rows=2;input.value=reflectionDraft(goal).reflection[key];input.placeholder='A thought to come back to…';
  wrap.append(label,input);const updateFeedback=reflectionFieldFeedback(input,REFLECTION_LIMIT);
  input.addEventListener('input',()=>{updateFeedback();updateReflection(goal,{reflection:{...reflectionDraft(goal).reflection,[key]:input.value}});});
  body.append(wrap);
 }
 const custom=el('div','custom-questions');body.append(custom);
 const add=button('＋ Add a custom question','small-button',()=>{
  const items=reflectionDraft(goal).customQuestions;if(items.length>=CUSTOM_QUESTION_LIMIT)return;
  const item={id:uid(),question:'',answer:''};updateReflection(goal,{customQuestions:[...items,item]});drawCustom();document.getElementById(`custom-question-${goal.id}-${item.id}`)?.focus();
 });
 const capacity=el('p','field-hint');body.append(add,capacity,el('p','reflection-save-hint','Answers save automatically with your goal. Check the save status before closing.'));
 function drawCustom(){
  custom.replaceChildren();const items=reflectionDraft(goal).customQuestions;
  for(const item of items){
   const row=el('div','custom-question'),qid=`custom-question-${goal.id}-${item.id}`,aid=`custom-answer-${goal.id}-${item.id}`;
   const q=field(row,'Your question (optional)',qid,item.question,300,true);q.removeAttribute('maxlength');q.rows=2;q.placeholder='What else would I like to ask myself?';
   const a=field(row,'Your answer (optional)',aid,item.answer,REFLECTION_LIMIT,true);a.removeAttribute('maxlength');a.rows=2;a.placeholder='Leave this blank, or follow the thought…';
   for(const [input,key,limit]of [[q,'question',300],[a,'answer',REFLECTION_LIMIT]]){
    const updateFeedback=reflectionFieldFeedback(input,limit);
    input.addEventListener('input',()=>{updateFeedback();updateReflection(goal,{customQuestions:reflectionDraft(goal).customQuestions.map(entry=>entry.id===item.id?{...entry,[key]:input.value}:entry)});});
   }
   row.append(button('Remove question','text-button',()=>{
    const current=reflectionDraft(goal).customQuestions.find(x=>x.id===item.id);
    if((current.question||current.answer)&&!confirm('Remove this custom question and its answer? This cannot be undone. Export a backup first if you want to keep it.'))return;
    updateReflection(goal,{customQuestions:reflectionDraft(goal).customQuestions.filter(x=>x.id!==item.id)});drawCustom();add.focus();
   },'Remove this custom question and answer'));custom.append(row);
  }
  add.disabled=items.length>=CUSTOM_QUESTION_LIMIT;capacity.textContent=`${items.length} of 100 custom questions · optional`;
 }
 drawCustom();panel.append(status,body);
 }
 if(!lazy||panel.open)buildContents();
 else {
  function expand(){if(panel.open){buildContents();panel.removeEventListener('toggle',expand);}}
  panel.addEventListener('toggle',expand);
 }
 return panel;
}
function paintProgress(goal,ring,percentage,label){
 const value=progress(goal);
 ring.style.setProperty('--fill',value.percent+'%');
 ring.setAttribute('aria-valuenow',value.percent);
 percentage.textContent=value.percent+'%';
 label.textContent=value.done+' of '+value.total+' steps complete';
}
function goalCard(goal){
 const card=el('article','goal-card');
 const header=el('div','goal-top');
 const iconButton=button('','goal-symbol',()=>chooseGoalIcon(goal),'Choose icon for '+goal.title);
 iconButton.append(icon(goal.icon));header.append(iconButton);
 if(goal.categoryId){
  const category=state.categories.find(c=>c.id===goal.categoryId);
  if(category)header.append(el('span','category-badge',category.name));
 }
 const tools=el('div','goal-tools');
 if(goal.status==='active'){
  if(filter==='active'&&focusPreference().enabled&&focusPreference().focusedId===goal.id)header.append(el('span','focus-badge','Current goal'));
  else tools.append(button('Focus on this','small-button',()=>focusGoal(goal),`Focus on ${goal.title}`));
 }
 tools.append(button('Edit goal','small-button',()=>editGoal(goal)));header.append(tools);
 const title=el('h3','goal-title',goal.title);title.id='goal-'+goal.id;title.tabIndex=-1;
 card.setAttribute('aria-labelledby',title.id);card.append(header,title);
 if(goal.description)card.append(el('p','goal-description',goal.description));
 const workspace=el('div','goal-workspace'),stepArea=el('div','goal-step-area');
 card.append(workspace);workspace.append(stepArea,reflectionPanel(goal,true));
 const summary=el('div','progress-label'),ring=el('div','liquid-ring'),percentage=el('span'),label=el('span');
 ring.setAttribute('role','progressbar');ring.setAttribute('aria-label','Steps completed for '+goal.title);
 ring.setAttribute('aria-valuemin','0');ring.setAttribute('aria-valuemax','100');
 ring.append(percentage);summary.append(ring,label);stepArea.append(summary);paintProgress(goal,ring,percentage,label);
 const list=el('ul','steps');
 const onStepChange = (task, target, justFinished) => {
  paintProgress(goal,ring,percentage,label);
  updateCounts();
  if (justFinished && task.done) {
   card.classList.remove('step-pulse');
   requestAnimationFrame(()=>card.classList.add('step-pulse'));
   celebrateStep(target);
  }
 };
 goal.tasks.forEach((task,index)=>list.append(taskRow(goal,task,index,onStepChange)));
 stepArea.append(list);if(goal.status==='active'){if(!goal.tasks.length)stepArea.append(el('p','no-steps','Every goal starts somewhere. What’s your first step?'));stepArea.append(addTaskForm(goal));}else if(goal.status==='completed')stepArea.append(el('p','complete-note','Completed. A little moment to appreciate how far you came.'));
 const footer=el('div','card-footer');
 if(goal.status==='archived'){
  footer.append(button('↶ Restore goal','complete-button',()=>{
   const position=goalPosition(goal.id);goal.status=goal.previousStatus||'active';filter=goal.status;changed('Goal restored.');focusGoalAfterChange(goal.id,position);
  }));
 }else{
  function finish(){
   const position=goalPosition(goal.id);
   const stayFocused=filter==='active'&&focusPreference().enabled;
   setCompleted(goal,true);filter=stayFocused?'active':'completed';
   if(changed('Goal completed. Nicely done.')){
    celebrateGoal();
    if(stayFocused){dialogOrigin=$('focus-next')||$('focus-pause-title');dialogOrigin?.focus();}
    else focusGoalAfterChange(goal.id,position);
   }
  }
  footer.append(button(goal.status==='completed'?'↶ Reopen goal':'✓ Mark complete','complete-button',()=>{
   if(goal.status==='completed'){
    const position=goalPosition(goal.id);setCompleted(goal,false);filter=goal.status;changed('Goal reopened.');focusGoalAfterChange(goal.id,position);return;
   }
   if(goal.tasks.every(task=>task.done)){finish();return;}
   openDialog('Complete this goal?','YOUR GOAL, YOUR CALL',fields=>{
    fields.append(el('p','field-hint','Some steps are still unchecked. You can finish the goal as it is, or cancel and keep going. Your step history will stay unchanged.'));
   },()=>{closeDialog();finish();},'Complete goal');
  }));
  footer.append(button('Archive','text-button',()=>{
   const position=goalPosition(goal.id);goal.previousStatus=goal.status;goal.status='archived';changed('Goal archived. Restore it anytime from Archived.');focusGoalAfterChange(goal.id,position);
  }));
 }
 card.append(footer);return card;}
const pythonEditorChecklist = [
 'Open Visual Studio Code (VS Code) as your Python editor.',
 'Choose File → Open Folder and select a folder for your Python practice.',
 'Click Explorer in the left sidebar. Use New File to create hello.py. The list showing hello.py is the file area.',
 'Click hello.py and type print("Hello!") in the large editing pane. That pane is the code area.'
];

function taskRow(goal, task, index, onStepChange) {
 const active = goal.status === 'active';
 const key = JSON.stringify([goal.id, task.id]);
 const row = el('li', 'step');
 const heading = el('div', 'step-heading');
 const checkLabel = el('label', 'step-check'), check = el('input');
 check.type = 'checkbox';
 check.id = 'task-' + goal.id + '-' + task.id;
 check.disabled = !active;
 checkLabel.append(check, el('span', 'step-emoji', task.emoji), el('span', 'step-text', task.text));
 heading.append(checkLabel);
 if (active) {
  heading.append(taskControls(goal, task, index));
  const menu=appendStepOptions(heading,{document,task,index,total:goal.tasks.length,onEdit:()=>editTask(goal,task),onMove:direction=>{
   moveTask(goal,task.id,direction);changed();
   const fresh=document.getElementById('goal-'+goal.id)?.closest('article');
   [...(fresh?.querySelectorAll('.step-options')||[])].find(item=>item.dataset.task===task.id)?.querySelector('summary').focus();
  }});menu.querySelector('summary').dataset.focusKey='options-'+task.id;
 }
 row.append(heading);

 const disclosure = button('', 'substeps-toggle', () => {
  if (expandedSteps.has(key)) expandedSteps.delete(key);
  else expandedSteps.add(key);
  showPanel();
 });
 const arrow = el('span', 'substeps-arrow'), caption = el('span', '', 'Substeps'), counter = el('span', 'substeps-count');
 arrow.setAttribute('aria-hidden', 'true');
 disclosure.append(arrow, caption, counter);
 const panel = el('div', 'substeps-panel');
 let addButton;
 panel.id = 'substeps-' + uid();
 disclosure.setAttribute('aria-controls', panel.id);
 row.append(disclosure, panel);

 function paintChecks() {
  const children = task.substeps || [];
  const done = children.filter(child => child.done).length;
  row.classList.toggle('done', task.done);
  check.checked = task.done;
  check.indeterminate = done > 0 && done < children.length;
  counter.textContent = children.length ? done + '/' + children.length : '';
  disclosure.setAttribute('aria-label', 'Substeps for ' + task.text + (children.length ? ', ' + done + ' of ' + children.length + ' complete' : ''));
  panel.querySelectorAll('input[type=checkbox]').forEach((box, i) => { box.checked = children[i].done; });
 }

 function commit(wasDone, target, message, rebuild = false) {
  if (!changed(message, false)) return;
  if (rebuild) showPanel();
  paintChecks();
  onStepChange(task, target, !wasDone && task.done);
 }

 function checkSizeWith(candidate) {
  const tasks = goal.tasks.map(item => item === task ? candidate : item);
  const goals = state.goals.map(item => item === goal ? {...goal, tasks} : item);
  assertStateSize({...state, goals});
 }

 function add(lines, target) {
  const wasDone = task.done;
  const candidate = {...task};
  addSubsteps(candidate, lines);
  checkSizeWith(candidate);
  Object.assign(task, candidate);
  commit(wasDone, target, 'Substeps added.', true);
 }

 function addDialog(target) {
  let input;
  openDialog('Add substeps', '', fields => {
   fields.append(el('p', 'substep-context', task.text));
   const label = el('label', '', 'Write one action per line');
   input = el('textarea');
   input.id = 'new-substeps'; input.rows = 4; input.required = true;
   input.placeholder = 'What is the first thing you need to do?';
   label.htmlFor = input.id;
   fields.append(label, input);
  }, () => {
   add(input.value.split(/\r?\n/), target);
   dialogOrigin = addButton;
   closeDialog();
  }, 'Add substeps');
 }

 function editChild(child, target) {
  let input;
  openDialog('Edit substep', '', fields => {
   input = field(fields, 'Substep', 'substep-text', child.text, LIMITS.task, true);
   input.required = true;
   fields.append(button('Remove substep', 'text-button substep-remove', () => {
    const wasDone = task.done;
    task.substeps = task.substeps.filter(item => item.id !== child.id);
    syncTaskDone(task);
    commit(wasDone, disclosure, 'Substep removed.', true);
    dialogOrigin = disclosure;
    closeDialog();
   }));
  }, () => {
   const text = cleanText(input.value, LIMITS.task, true);
   checkSizeWith({...task, substeps: task.substeps.map(item => item === child ? {...item, text} : item)});
   child.text = text;
   if (changed('Substep updated.', false)) {
    const item = target.closest('li');
    item.querySelector('.substep-text').textContent = child.text;
    target.setAttribute('aria-label', 'Edit substep ' + child.text);
   }
   closeDialog();
  }, 'Save substep');
 }

 function showPanel() {
  const open = expandedSteps.has(key);
  disclosure.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
  panel.replaceChildren();
  if (!open) return;
  const children = task.substeps || [];
  if (children.length) {
   const list = el('ul', 'substep-list');
   for (const child of children) {
    const item = el('li', 'substep-row');
    const label = el('label', 'step-check substep-check');
    const box = el('input');
    box.type = 'checkbox'; box.disabled = !active; box.checked = child.done;
    box.onchange = () => {
     const wasDone = task.done;
     child.done = box.checked;
     syncTaskDone(task);
     commit(wasDone, box);
    };
    label.append(box, el('span', 'substep-text', child.text));
    item.append(label);
    if (active) {
     const edit = button('✎', 'icon-button', () => editChild(child, edit), 'Edit substep ' + child.text);
     item.append(edit);
    }
    list.append(item);
   }
   panel.append(list);
  } else if (!active) {
   panel.append(el('p', 'field-hint', 'No substeps added.'));
  }
  if (active) {
   const actions = el('div', 'substep-actions');
   addButton = button('＋ Add substeps', 'small-button', () => addDialog(addButton));
   actions.append(addButton);
   if (!children.length && /python/i.test(task.text) && /editor/i.test(task.text) && /file/i.test(task.text) && /code/i.test(task.text)) {
    const useExample = button('Use VS Code checklist', 'text-button', () => {
     try {
      add(pythonEditorChecklist, disclosure);
      disclosure.focus();
     } catch (error) { announce(error.message); }
    });
    actions.append(useExample);
   }
   panel.append(actions);
  }
 }

 check.onchange = () => {
  const wasDone = task.done;
  setTaskDone(task, check.checked);
  commit(wasDone, check);
 };
 showPanel();
 paintChecks();
 return row;
}

function taskControls(goal, task, index) {
 const controls = el('div', 'step-controls');
 for (const [direction, label, symbol] of [[-1, 'up', '↑'], [1, 'down', '↓']]) {
  const move = button(symbol, '', () => {
   moveTask(goal, task.id, direction);
   changed();
   const card = $('goal-' + goal.id)?.closest('article');
   const buttons = Array.from(card?.querySelectorAll('[data-move]') || []).filter(b => b.dataset.task === task.id && !b.disabled);
   (buttons.find(b => b.dataset.move === label) || buttons[0])?.focus();
  }, 'Move ' + task.text + ' ' + label);
  move.disabled = index + direction < 0 || index + direction >= goal.tasks.length;
  move.dataset.task = task.id; move.dataset.move = label;
  controls.append(move);
 }
 const edit=button('✎', '', () => editTask(goal, task), 'Edit ' + task.text);edit.dataset.focusKey='edit-'+task.id;
 controls.append(edit);
 return controls;
}


const stepDrafts=new Map();
function addTaskForm(goal){const form=el('form','add-step');const draft=stepDrafts.get(goal.id);let selected=draft?.emoji??'✨';const emoji=button(selected,'emoji-trigger',()=>chooseEmoji(selected,value=>{selected=value;emoji.textContent=value||'＋';stepDrafts.set(goal.id,{text:input.value,emoji:selected});}),`Choose emoji for a new step in ${goal.title}`);const input=el('input');input.type='text';input.value=draft?.text||'';input.addEventListener('input',()=>stepDrafts.set(goal.id,{text:input.value,emoji:selected}));input.placeholder='Add a small next step…';input.maxLength=300;input.required=true;input.setAttribute('aria-label',`New step for ${goal.title}`);const submit=el('button','','＋');submit.type='submit';submit.setAttribute('aria-label','Add step');form.append(emoji,input,submit);form.onsubmit=e=>{e.preventDefault();try{if(goal.tasks.length>=200)throw new Error('This goal already has 200 steps.');goal.tasks.push(createTask(input.value,selected));stepDrafts.delete(goal.id);changed('Step added.');document.querySelector(`[data-add-goal="${CSS.escape(goal.id)}"] input`)?.focus();}catch(error){announce(error.message);}};form.dataset.addGoal=goal.id;return form;}
function example(){if(!loaded)return;const g=createGoal('Make more room for reading','A little time away from the screen, with a book I’m excited to pick up.');g.icon='book';g.tasks=[createTask('Choose a book that sparks my curiosity','📚'),createTask('Find a cozy spot to read','☕'),createTask('Read the first chapter','✨')];state.goals.unshift(g);changed('Example added. Make it yours, or archive it anytime.');}
function exportBackup(){if(!loaded){announce('Load your goals before exporting a backup.');return;}const blob=new Blob([JSON.stringify(reflectionSnapshot(state,reflectionDrafts),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`mint-goals-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Backup downloaded. Keep it somewhere safe.');}
$('export').onclick=exportBackup;$('import').onclick=()=>{if(!loaded){announce('Load your goals before importing a backup.');return;}$('import-file').click();};
$('import-file').onchange=async event=>{
 const file=event.target.files[0];event.target.value='';
 if(!file||!loaded)return;
 try {
  if(file.size>5000000)throw new Error('Please choose a backup smaller than 5 MB.');
  const raw=JSON.parse(await file.text());
  const emptyNotebook=!state.goals.length&&!state.categories.length;
  const data=validateState(raw,!emptyNotebook);
  const count=data.goals.length+' goals, '+data.goals.reduce((n,g)=>n+g.tasks.length,0)+' steps and '+data.categories.length+' categories.';
  const append=()=>{
   if(!loaded||blocked||scopeMismatch)throw new Error('Resolve the save warning before importing.');
   if(emptyNotebook&&(state.goals.length||state.categories.length))throw new Error('The notebook changed. Cancel and choose the file again.');
   const next={...state,goals:[...state.goals,...data.goals],categories:[...state.categories,...data.categories]};
   if(next.goals.length>200||next.categories.length>50)throw new Error('This import would exceed 200 goals or 50 categories.');
   assertStateSize(next);state=next;closeDialog();changed(emptyNotebook?'Notebook restored.':'Copies added.');
  };
  openDialog('Review backup','BACKUP',fields=>{
   fields.append(el('p','',count),el('p','field-hint',emptyNotebook
    ?'Your notebook is empty. Restore once to keep the original goal and step IDs.'
    :'This notebook already contains data. Continuing adds copies, including goals or categories already here. Cancel to leave it as it is.'));
  },append,emptyNotebook?'Restore to empty notebook':'Add copies');
 }catch(error){announce(error instanceof SyntaxError?'That file is not valid JSON. Choose a Mint Goals backup.':error.message);}
};
$('new-goal').onclick=()=>editGoal();$('manage-categories').onclick=manageCategories;$('category-filter').onchange=e=>{categoryFilter=e.target.value;rememberFocusCategory();render();};const syncFilters=mountGlassSwitch(document.querySelector('.filters'),value=>{filter=value;render();});syncFilters(filter);window.addEventListener('beforeunload',e=>{if(dirty||saving||reflectionDrafts.size){e.preventDefault();e.returnValue='';}});window.addEventListener('online',()=>{if(blocked&&!conflict){blocked=false;save();}});
let refreshing=false;
function safeToRefresh(){return loaded&&!dirty&&!saving&&!blocked&&!refreshing&&!$('editor').open&&!reflectionDrafts.size&&!document.querySelector('.goal-reflection textarea:focus')&&!document.querySelector('.add-step input:focus')&&![...document.querySelectorAll('.add-step input')].some(i=>i.value.trim());}
async function refreshFromServer(){if(!safeToRefresh())return;refreshing=true;try{const r=await fetch('/api/state',{cache:'no-store',credentials:'same-origin'});if(!r.ok)return;const data=await r.json();if(data.ownerScope!==ownerScope){blocked=true;conflict=true;scopeMismatch=true;setSave('Account changed · edits kept');warning('The signed-in account changed. This tab still holds the previous account’s goals. Export any edits, then sign back in with the original account, or load the current account’s saved goals.',[{text:'Export your edits',action:exportBackup},{text:'Load current account…',action:confirmReload}]);return;}if(!dirty&&!saving&&!blocked&&!$('editor').open&&!reflectionDrafts.size&&!document.querySelector('.goal-reflection textarea:focus')&&!document.querySelector('.add-step input:focus')&&![...document.querySelectorAll('.add-step input')].some(i=>i.value.trim())&&Number.isSafeInteger(data.version)&&data.version>revision){state=validateState(data.state);revision=data.version;acceptedState=JSON.stringify(state);render();setSave('All changes saved');announce('Updated from your other device.');}}catch{}finally{refreshing=false;}}
window.addEventListener('focus',refreshFromServer);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFromServer();});setInterval(()=>{if(!document.hidden)refreshFromServer();},30000);
document.querySelectorAll('[data-icon]').forEach(node=>node.append(icon(node.dataset.icon)));
const today=new Date();
$('today').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(today);
$('today').dateTime=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
function routeFromAddress(){switchView(location.hash==='#progress'?'progress':'goals',false);}
addEventListener('hashchange',routeFromAddress);
routeFromAddress();
const backups=document.querySelector('.backup-menu');
const movingLight=matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
let lightFrame=0,litCard=null;
function clearLight(){
 cancelAnimationFrame(lightFrame);
 litCard?.style.removeProperty('--light-x');
 litCard?.style.removeProperty('--light-y');
 litCard=null;
}
$('goals').addEventListener('pointermove',event=>{
 if(!movingLight.matches)return;
 const card=event.target.closest('.goal-card');
 if(card!==litCard){clearLight();litCard=card;}
 if(!card)return;
 cancelAnimationFrame(lightFrame);
 const {clientX,clientY}=event;
 lightFrame=requestAnimationFrame(()=>{
  const box=card.getBoundingClientRect();
  card.style.setProperty('--light-x',(clientX-box.left)+'px');
  card.style.setProperty('--light-y',(clientY-box.top)+'px');
 });
});
$('goals').addEventListener('pointerleave',clearLight);
movingLight.addEventListener('change',clearLight);
surfaces=attachSurfaceMotion({dialog:$('editor'),toast:$('status'),backups});
mountStepOptions(document);trackDialogViewport($('editor'));
document.addEventListener('click',event=>{if(!backups.contains(event.target))surfaces.closeBackups();});
backups.addEventListener('keydown',event=>{if(event.key==='Escape'){surfaces.closeBackups({immediate:true});backups.querySelector('summary').focus();}});
load();
