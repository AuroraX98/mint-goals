import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, createGoal, addSubsteps, setTaskDone, syncTaskDone, progress, validateBackup, NOTEBOOK_VERSION } from '../public/model.mjs';
import { validateState } from '../lib/goal-store.mjs';

test('nested completion updates a single parent step and empty steps stay independent', () => {
 const goal = createGoal('Start Python');
 const step = createTask('Choose an editor');
 goal.tasks.push(step);
 setTaskDone(step, true);
 addSubsteps(step, [' Open an editor ', '', 'Find the code area']);
 assert.equal(step.done, false);
 assert.equal(step.substeps[0].text, 'Open an editor');
 step.substeps[0].done = true;
 syncTaskDone(step);
 assert.deepEqual(progress(goal), {total:1,done:0,percent:0});
 step.substeps[1].done = true;
 syncTaskDone(step);
 assert.deepEqual(progress(goal), {total:1,done:1,percent:100});
 setTaskDone(step, false);
 assert.ok(step.substeps.every(item => !item.done));
 setTaskDone(step, true);
 assert.ok(step.substeps.every(item => item.done));
 step.substeps = [];
 syncTaskDone(step);
 assert.equal(step.done, true);
 assert.equal(step.substeps, undefined);
});

test('partial substeps survive save, restore and import as fresh copies', () => {
 const goal = createGoal('Start Python');
 const step = createTask('Choose an editor');
 goal.tasks.push(step);
 addSubsteps(step, ['Find a file', 'Open it']);
 step.substeps[0].done = true;
 const state = {version:NOTEBOOK_VERSION, goals:[goal], categories:[]};
 assert.doesNotThrow(() => validateState(state));
 const restored = validateBackup(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored[0].tasks, goal.tasks);
 const copied = validateBackup(state, true)[0].tasks[0];
 assert.notEqual(copied.id, step.id);
 assert.notEqual(copied.substeps[0].id, step.substeps[0].id);
 assert.deepEqual(copied.substeps.map(item => item.done), [true, false]);
 assert.throws(() => validateState({...state, version:3}));
 delete step.substeps;
 for (const version of [1,2,3]) {
  assert.doesNotThrow(() => validateState({...state, version}));
  assert.deepEqual(validateBackup({...state, version})[0].tasks, goal.tasks);
 }
});

test('invalid batches cannot partly add substeps and invalid saved checklists are rejected', () => {
 const goal = createGoal('Start Python'), step = createTask('Choose an editor');
 goal.tasks.push(step);
 for (const lines of [['  '], ['valid', 'x'.repeat(301)], Array(201).fill('item')]) {
  assert.throws(() => addSubsteps(step, lines));
  assert.equal(step.substeps, undefined);
 }
 const state = {version:NOTEBOOK_VERSION, goals:[goal], categories:[]};
 const child = {id:'child', text:'Find a file', done:false};
 for (const bad of [null, {}, [null], [child,child], [{...child, done:'yes'}], [{...child, done:true}], [{...child, text:' '}], [{...child, substeps:[]}]]) {
  step.substeps = bad;
  assert.throws(() => validateBackup(state));
  assert.throws(() => validateState(state));
 }
});
