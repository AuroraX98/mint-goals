import test from 'node:test';
import assert from 'node:assert/strict';
import { createFocusPreferences, focusSelection, goalsInScope, orderedGoals } from '../public/focus-view.mjs';

function memoryStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}
const goal = (id, categoryId = '', status = 'active') => ({ id, categoryId, status });
const ids = goals => goals.map(item => item.id);
const defaultPreference = { enabled: false, focusedId: null, otherOpen: false, completedOpen: false, order: [] };

test('each category remembers its own focus, priorities and expanded sections after reload', () => {
  const storage = memoryStorage();
  const preferences = createFocusPreferences(storage, 'owner-a');
  assert.deepEqual(preferences.get(''), defaultPreference);
  assert.equal(preferences.patch('', { enabled: true, focusedId: 'read', order: ['read', 'walk'] }), true);
  assert.equal(preferences.patch('health', { enabled: true, focusedId: 'walk', otherOpen: true }), true);
  assert.equal(preferences.patch('uncategorized', { completedOpen: true }), true);
  assert.equal(preferences.setCategory('health'), true);

  const reloaded = createFocusPreferences(storage, 'owner-a');
  assert.equal(reloaded.getCategory(), 'health');
  assert.equal(reloaded.get('').focusedId, 'read');
  assert.deepEqual(reloaded.get('').order, ['read', 'walk']);
  assert.equal(reloaded.get('health').focusedId, 'walk');
  assert.equal(reloaded.get('health').otherOpen, true);
  assert.equal(reloaded.get('health').completedOpen, false);
  assert.equal(reloaded.get('uncategorized').completedOpen, true);
  assert.deepEqual(reloaded.get('new-category'), defaultPreference);
});

test('switching signed-in owners never carries another owner’s focus or category', () => {
  const storage = memoryStorage();
  const alice = createFocusPreferences(storage, 'alice');
  alice.patch('private-category', { enabled: true, focusedId: 'alice-goal' });
  alice.setCategory('private-category');
  const bob = createFocusPreferences(storage, 'bob');
  assert.deepEqual(bob.get('private-category'), defaultPreference);
  assert.equal(bob.getCategory(), '');
  bob.patch('', { enabled: true, focusedId: 'bob-goal' });
  const aliceAgain = createFocusPreferences(storage, 'alice');
  assert.equal(aliceAgain.get('private-category').focusedId, 'alice-goal');
  assert.deepEqual(aliceAgain.get(''), defaultPreference);
  assert.equal(aliceAgain.getCategory(), 'private-category');
  assert.ok(storage.getItem('mint-goals-focus-v1:alice'));
  assert.ok(storage.getItem('mint-goals-focus-v1:bob'));
});

test('priority ordering survives missing IDs and appends new goals without changing notebook order', () => {
  const goals = [goal('walk'), goal('read'), goal('new')];
  const before = structuredClone(goals);
  assert.deepEqual(ids(orderedGoals(goals, ['removed', 'read', 'walk'])), ['read', 'walk', 'new']);
  assert.deepEqual(goals, before);
  const selection = focusSelection(goals, '', { focusedId: 'read', order: ['read', 'walk'] });
  assert.deepEqual(ids(selection.active), ['read', 'walk', 'new']);
  assert.deepEqual(ids(selection.others), ['walk', 'new']);
  assert.equal(selection.focused, goals[1]);
  assert.equal(selection.next.id, 'walk');
});

test('legacy long goal and category IDs retain focus and priorities after reload', () => {
  const storage = memoryStorage();
  const categoryId = `legacy-category-${'c'.repeat(180)}`;
  const focusedId = `legacy-goal-${'g'.repeat(180)}`;
  const goals = [goal('walk', categoryId), goal(focusedId, categoryId)];
  const preferences = createFocusPreferences(storage, 'owner');
  assert.equal(preferences.setCategory(categoryId), true);
  assert.equal(preferences.patch(categoryId, { enabled: true, focusedId, order: [focusedId, 'walk'] }), true);
  const reloaded = createFocusPreferences(storage, 'owner');
  assert.equal(reloaded.getCategory(), categoryId);
  const selection = focusSelection(goals, reloaded.getCategory(), reloaded.get(categoryId));
  assert.equal(selection.focused, goals[1]);
  assert.deepEqual(ids(selection.active), [focusedId, 'walk']);
  assert.equal(selection.next.id, 'walk');
});

test('category selection excludes other categories and gives uncategorized goals their own scope', () => {
  const goals = [goal('walk', 'health'), goal('read', 'study'), goal('free'), { id: 'legacy', status: 'active' }, goal('none', null)];
  assert.deepEqual(ids(goalsInScope(goals, '')), ['walk', 'read', 'free', 'legacy', 'none']);
  assert.deepEqual(ids(goalsInScope(goals, 'uncategorized')), ['free', 'legacy', 'none']);
  assert.deepEqual(ids(goalsInScope(goals, 'health')), ['walk']);
  const selection = focusSelection(goals, 'health', { focusedId: 'read' });
  assert.equal(selection.focused, null);
  assert.equal(selection.next.id, 'walk');
  assert.deepEqual(ids(selection.others), ['walk']);
});

test('completing the focused goal keeps the completion pause and waits for an explicit next choice', () => {
  const storage = memoryStorage();
  const preferences = createFocusPreferences(storage, 'owner');
  preferences.patch('', { enabled: true, focusedId: 'read', order: ['read', 'walk'] });
  const goals = [goal('read', '', 'completed'), goal('walk'), goal('archived-completion', '', 'archived')];
  const selection = focusSelection(goals, '', preferences.get(''));
  assert.equal(selection.focused.id, 'read');
  assert.equal(selection.focused.status, 'completed');
  assert.deepEqual(ids(selection.completed), ['read']);
  assert.deepEqual(ids(selection.active), ['walk']);
  assert.equal(selection.next.id, 'walk');
  assert.equal(createFocusPreferences(storage, 'owner').get('').focusedId, 'read');
  assert.equal(focusSelection([goals[0]], '', preferences.get('')).next, null);
});

test('archiving or deleting the focused goal never silently selects a replacement', () => {
  const preference = { enabled: true, focusedId: 'read', order: ['read', 'walk'] };
  const archived = focusSelection([goal('read', '', 'archived'), goal('walk')], '', preference);
  assert.equal(archived.focused.status, 'archived');
  assert.deepEqual(archived.completed, []);
  assert.equal(archived.next.id, 'walk');
  const deleted = focusSelection([goal('walk')], '', preference);
  assert.equal(deleted.focused, null);
  assert.equal(deleted.next.id, 'walk');
  assert.equal(preference.focusedId, 'read');
  assert.equal(focusSelection([goal('walk')], '', defaultPreference).focused, null);
});

test('preference snapshots and caller arrays cannot change preferences without an explicit patch', () => {
  const preferences = createFocusPreferences(memoryStorage(), 'owner');
  const order = ['walk', 'read'];
  preferences.patch('', { order, focusedId: 'walk' });
  order.reverse();
  const snapshot = preferences.get('');
  snapshot.order.push('intruder');
  snapshot.focusedId = 'read';
  assert.deepEqual(preferences.get('').order, ['walk', 'read']);
  assert.equal(preferences.get('').focusedId, 'walk');
});

test('damaged JSON and invalid stored fields recover to safe defaults', () => {
  const storage = memoryStorage();
  storage.setItem('mint-goals-focus-v1:owner', '{not json');
  const damaged = createFocusPreferences(storage, 'owner');
  assert.deepEqual(damaged.get(''), defaultPreference);
  assert.equal(damaged.patch('', { enabled: true }), true);
  assert.equal(createFocusPreferences(storage, 'owner').get('').enabled, true);

  storage.setItem('mint-goals-focus-v1:owner', JSON.stringify({ category: 5, scopes: {
    '': { enabled: 'true', focusedId: {}, otherOpen: 1, completedOpen: true, order: ['read', 7] },
    health: { enabled: true, focusedId: ' ', order: ['same', 'same'] },
  } }));
  const invalid = createFocusPreferences(storage, 'owner');
  assert.equal(invalid.getCategory(), '');
  assert.deepEqual(invalid.get(''), { ...defaultPreference, completedOpen: true });
  assert.deepEqual(invalid.get('health'), { ...defaultPreference, enabled: true });
});

test('malformed changes cannot overwrite a valid focus or change the selected category', () => {
  const preferences = createFocusPreferences(memoryStorage(), 'owner');
  preferences.patch('', { focusedId: 'read', enabled: true });
  preferences.setCategory('health');
  for (const invalid of [
    { enabled: 'false' }, { otherOpen: 1 }, { completedOpen: null },
    { focusedId: '' }, { focusedId: [] }, { order: 'read' },
    { order: ['read', null] }, { order: ['read', 'read'] },
    { focusedId: ' ' }, { unknown: true },
  ]) {
    assert.equal(preferences.patch('', invalid), false);
    assert.deepEqual(preferences.get(''), { ...defaultPreference, enabled: true, focusedId: 'read' });
  }
  assert.equal(preferences.setCategory(null), false);
  assert.equal(preferences.getCategory(), 'health');
});

test('category names resembling prototype properties stay independent and survive reload', () => {
  const storage = memoryStorage();
  const preferences = createFocusPreferences(storage, 'owner');
  for (const category of ['__proto__', 'constructor', 'toString']) {
    assert.deepEqual(preferences.get(category), defaultPreference);
    preferences.patch(category, { enabled: true, focusedId: `goal-${category}` });
  }
  const reloaded = createFocusPreferences(storage, 'owner');
  for (const category of ['__proto__', 'constructor', 'toString']) {
    assert.equal(reloaded.get(category).focusedId, `goal-${category}`);
  }
  assert.deepEqual(reloaded.get(''), defaultPreference);
  assert.equal(Object.prototype.enabled, undefined);
});

test('unavailable storage preserves choices for the current tab and reports they were not saved', () => {
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  for (const storage of [unavailable, null, undefined]) {
    const preferences = createFocusPreferences(storage, 'owner');
    assert.equal(preferences.patch('', { enabled: true, focusedId: 'read' }), false);
    assert.equal(preferences.setCategory('health'), false);
    assert.equal(preferences.get('').focusedId, 'read');
    assert.equal(preferences.get('').enabled, true);
    assert.equal(preferences.getCategory(), 'health');
  }
});

test('a full storage quota does not discard this tab’s new preference or the previous saved preference', () => {
  const storage = memoryStorage();
  createFocusPreferences(storage, 'owner').patch('', { focusedId: 'read' });
  const full = { getItem: storage.getItem, setItem() { throw new Error('quota'); } };
  const preferences = createFocusPreferences(full, 'owner');
  assert.equal(preferences.get('').focusedId, 'read');
  assert.equal(preferences.patch('', { focusedId: 'walk' }), false);
  assert.equal(preferences.get('').focusedId, 'walk');
  assert.equal(createFocusPreferences(storage, 'owner').get('').focusedId, 'read');
});

test('preferences without an authenticated owner stay in memory and do not share a storage key', () => {
  const storage = { getItem() { assert.fail('must not read shared anonymous preferences'); }, setItem() { assert.fail('must not write shared anonymous preferences'); } };
  for (const owner of [null, undefined, '', ' ']) {
    const preferences = createFocusPreferences(storage, owner);
    assert.equal(preferences.patch('', { focusedId: 'temporary' }), false);
    assert.equal(preferences.setCategory('health'), false);
    assert.equal(preferences.get('').focusedId, 'temporary');
    assert.equal(preferences.getCategory(), 'health');
  }
});
