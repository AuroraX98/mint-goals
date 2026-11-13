import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import * as offline from '../offline/src/model.mjs';import * as sites from '../sites/public/model.mjs';import {paths as offPaths} from '../offline/src/icons.mjs';import {paths as sitePaths} from '../sites/public/icons.mjs';import {validateState as serverValidate} from '../sites/lib/goal-store.mjs';
function validator(path,model,paths){const s=readFileSync(new URL(path,import.meta.url),'utf8');const code=s.slice(s.indexOf('function validateState('),s.indexOf('async function load('));return new Function('validateBackup','cleanText','uid','paths','assertStateSize','NOTEBOOK_VERSION',code+';return validateState;')(model.validateBackup,model.cleanText,model.uid,paths,model.assertStateSize,model.NOTEBOOK_VERSION);}
const off=validator('../offline/src/app.mjs',offline,offPaths),site=validator('../sites/public/app.mjs',sites,sitePaths);
const fixture={version:3,categories:[{id:'learn',name:'Learning'}],goals:[{id:'precise',title:'Sample goal',description:'Sample description',reflection:{why:'  Keep these line breaks\nExactly  ',explore:'A possibility',learn:'',create:'',apply:''},customQuestions:[{id:'q1',question:'My custom question',answer:'My answer'}],icon:'book',categoryId:'learn',tasks:[{id:'t',text:'Sample step',emoji:'📚',done:true}],status:'archived',previousStatus:'completed',createdAt:'2026-01-01T12:00:00.000Z',completedAt:'2026-01-10T12:00:00.000Z',completionDate:null},{id:'manual',title:'Historical goal',description:'',icon:'target',categoryId:'learn',tasks:[],status:'completed',previousStatus:'active',createdAt:'2026-01-01T12:00:00.000Z',completedAt:null,completionDate:'2026-01-05'}]};
function assertContentPreserved(actual, original) {
  assert.notEqual(actual.goals[0].id, original.goals[0].id);
  assert.notEqual(actual.categories[0].id, original.categories[0].id);
  assert.equal(actual.categories[0].name, 'Learning');
  for (let i = 0; i < original.goals.length; i++) {
    const goal = actual.goals[i], before = original.goals[i];
    for (const key of ['title','description','icon','status','previousStatus','createdAt','completedAt','completionDate']) {
      assert.deepEqual(goal[key], before[key]);
    }
    assert.equal(goal.categoryId, actual.categories[0].id);
    assert.deepEqual(goal.tasks.map(({id, ...rest}) => rest), before.tasks.map(({id, ...rest}) => rest));
  }
  assert.deepEqual(actual.goals[0].reflection, original.goals[0].reflection);
  assert.deepEqual(actual.goals[0].customQuestions, original.goals[0].customQuestions);
}

test('legacy v3 backups retain their content and linked IDs when imported into either edition', () => {
  for (const validate of [off, site]) {
    const imported = validate(structuredClone(fixture), true);
    assertContentPreserved(imported, fixture);
    serverValidate(imported);
  }
});

test('an exported offline notebook imports online with reflections, dates and category links intact', () => {
  const offlineNotebook = off(structuredClone(fixture));
  assert.equal(offlineNotebook.version, 3);
  const imported = site(JSON.parse(JSON.stringify(offlineNotebook)), true);
  assert.equal(imported.version, sites.NOTEBOOK_VERSION);
  assertContentPreserved(imported, offlineNotebook);
  serverValidate(imported);
});

test('current online backups are rejected by the older offline edition instead of losing newer data', () => {
  const online = site(structuredClone(fixture));
  const snapshot = JSON.stringify(online);
  assert.throws(() => off(JSON.parse(snapshot)), /valid Mint Goals backup/);
  online.goals[0].tasks[0].substeps = [
    {id:'child-1', text:'Read the instructions', done:true},
    {id:'child-2', text:'Try the example', done:true},
  ];
  const withSubsteps = JSON.stringify(online);
  assert.throws(() => off(JSON.parse(withSubsteps), true), /valid Mint Goals backup/);
  assert.equal(JSON.stringify(online), withSubsteps);
  const restored = site(JSON.parse(withSubsteps));
  serverValidate(restored);
  assert.deepEqual(restored.goals[0].tasks[0].substeps, online.goals[0].tasks[0].substeps);
});

test('legacy v1 completion dates remain unknown while each edition upgrades to its own schema', () => {
  const old = structuredClone(fixture);
  old.version = 1;
  for (const goal of old.goals) { delete goal.completedAt; delete goal.completionDate; }
  for (const [validate, version] of [[off, 3], [site, sites.NOTEBOOK_VERSION]]) {
    const result = validate(old, true);
    assert.equal(result.version, version);
    assert.ok(result.goals.every(goal => goal.completedAt === null && goal.completionDate === null));
    serverValidate(result);
  }
});
