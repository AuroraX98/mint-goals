import test from 'node:test';
import assert from 'node:assert/strict';
import { stageCategory, prepareGoalSave } from '../public/goal-form.mjs';
import { createGoal, createTask } from '../public/model.mjs';
const empty = () => ({ version: 1, goals: [], categories: [] });
const draft = overrides => ({ title: 'Read more', description: 'A chapter a day', icon: 'book', categoryId: '', categories: [], steps: [], ...overrides });

test('staging a category automatically selects it without changing saved categories', () => {
  const state = empty();
  const staged = stageCategory(state.categories, ' Learning ');
  assert.deepEqual(state, empty());
  assert.equal(staged.categories[0].name, 'Learning');
  assert.equal(staged.categoryId, staged.categories[0].id);
});
test('same category name selects existing category instead of duplicating it', () => {
  const categories = [{ id: 'one', name: 'Learning' }];
  assert.deepEqual(stageCategory(categories, ' learning '), { categories, categoryId: 'one' });
});
test('new goal saves category, title, description, icon and ordered initial steps together', () => {
  const state = empty();
  const staged = stageCategory(state.categories, 'Learning');
  const saved = prepareGoalSave(state, draft({ ...staged, steps: [{ text: 'Pick a book', emoji: '📚' }, { text: '  ', emoji: '' }, { text: 'Read a chapter', emoji: '' }] }));
  assert.deepEqual(state, empty());
  const goal = saved.goals[0];
  assert.equal(goal.title, 'Read more');
  assert.equal(goal.description, 'A chapter a day');
  assert.equal(goal.icon, 'book');
  assert.equal(goal.categoryId, saved.categories[0].id);
  assert.deepEqual(goal.tasks.map(({text,emoji,done})=>({text,emoji,done})), [{text:'Pick a book',emoji:'📚',done:false},{text:'Read a chapter',emoji:'',done:false}]);
  assert.notEqual(goal.tasks[0].id, goal.tasks[1].id);
});
test('invalid goal does not commit its new category or steps', () => {
  const state = empty();
  const staged = stageCategory(state.categories, 'Learning');
  assert.throws(() => prepareGoalSave(state, draft({ ...staged, title: '  ' })));
  assert.deepEqual(state, empty());
  assert.throws(() => prepareGoalSave(state, draft({ ...staged, steps: [{text:'a'.repeat(301),emoji:''}] })));
  assert.deepEqual(state, empty());
});
test('steps are optional and blank rows are skipped', () => {
  assert.equal(prepareGoalSave(empty(), draft()).goals[0].tasks.length, 0);
  assert.equal(prepareGoalSave(empty(), draft({steps:[{text:' ',emoji:'✨'}]})).goals[0].tasks.length, 0);
});
test('editing preserves existing steps, completion, identity and creation date', () => {
  const goal = createGoal('Old');goal.tasks=[createTask('Existing step','✅')];goal.tasks[0].done=true;goal.status='completed';
  const state = {...empty(),goals:[goal]};
  const staged = stageCategory(state.categories, 'Learning');
  const updated = prepareGoalSave(state, draft(staged), goal.id).goals[0];
  assert.equal(updated.id, goal.id);assert.equal(updated.createdAt, goal.createdAt);
  assert.equal(updated.status, 'completed');assert.deepEqual(updated.tasks, goal.tasks);
  assert.equal(goal.title, 'Old');assert.equal(state.categories.length, 0);
});
test('category and step limits reject changes without mutation', () => {
  const categories = Array.from({length:50},(_,i)=>({id:`c${i}`,name:`Category ${i}`}));
  assert.throws(()=>stageCategory(categories,'One too many'), /50 categories/);
  assert.equal(stageCategory(categories,'Category 0').categoryId, 'c0');
  const state=empty();
  assert.throws(()=>prepareGoalSave(state,draft({steps:Array.from({length:201},()=>({text:'Step',emoji:''}))})),/200 steps/);
  assert.deepEqual(state,empty());
});
test('a category must exist in the draft', () => {
  assert.throws(()=>prepareGoalSave(empty(), draft({categoryId:'missing'})),/available category/);
});
test('storage-size failure preserves saved state and all draft input', () => {
  const state={...empty(),largeExistingField:'x'.repeat(1_990_000)};
  const staged=stageCategory(state.categories,'Learning');
  const input=draft({...staged,steps:[{text:'Choose a book',emoji:'📚'}]});
  const original=JSON.stringify(state), originalDraft=JSON.stringify(input);
  assert.throws(()=>prepareGoalSave(state,input),/storage size limit/);
  assert.equal(JSON.stringify(state),original);
  assert.equal(JSON.stringify(input),originalDraft);
});
test('goal limit cannot leave an orphaned new category', () => {
  const state={...empty(),goals:Array.from({length:200},()=>createGoal('Existing'))};
  const staged=stageCategory(state.categories,'Learning');
  assert.throws(()=>prepareGoalSave(state,draft(staged)),/200 goals/);
  assert.equal(state.categories.length,0);assert.equal(state.goals.length,200);
});
