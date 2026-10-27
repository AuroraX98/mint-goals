import { completionFields } from './completion.mjs';
export const STORAGE_KEY = 'mint-goals.v1';
export const LIMITS = { goals: 200, tasks: 200, title: 140, description: 3000, task: 300, emoji: 24 };
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function cleanText(value, max, required = false) {
  if (typeof value !== 'string') throw new Error('Please enter text.');
  const text = value.trim();
  if (required && !text) throw new Error('Please enter a name.');
  if (text.length > max) throw new Error(`Please use ${max} characters or fewer.`);
  return text;
}
export function createGoal(title, description = '') {
  return { id: uid(), title: cleanText(title, LIMITS.title, true), description: cleanText(description, LIMITS.description), icon: 'target', categoryId: '', tasks: [], status: 'active', completedAt: null, completionDate: null, createdAt: new Date().toISOString() };
}
export function createTask(text, emoji = '✨') {
  return { id: uid(), text: cleanText(text, LIMITS.task, true), emoji: cleanText(emoji, LIMITS.emoji), done: false };
}
export function progress(goal) {
  const done = goal.tasks.filter(t => t.done).length;
  return { done, total: goal.tasks.length, percent: goal.tasks.length ? Math.round(done / goal.tasks.length * 100) : goal.status === 'completed' ? 100 : 0 };
}
export function moveTask(goal, id, direction) {
  const from = goal.tasks.findIndex(t => t.id === id), to = from + direction;
  if (from < 0 || to < 0 || to >= goal.tasks.length || ![-1, 1].includes(direction)) return false;
  [goal.tasks[from], goal.tasks[to]] = [goal.tasks[to], goal.tasks[from]];
  return true;
}
export function validateBackup(raw, newIds = false) {
  if (!raw || ![1,2].includes(raw.version) || !Array.isArray(raw.goals) || raw.goals.length > LIMITS.goals) throw new Error('Choose a valid Mint Goals backup (up to 200 goals).');
  const ids = new Set();
  return raw.goals.map(g => {
    if (!g || !['active', 'completed', 'archived'].includes(g.status) || !Array.isArray(g.tasks) || g.tasks.length > LIMITS.tasks) throw new Error('This backup contains an invalid goal.');
    const goal = createGoal(g.title, g.description);
    if (!newIds && (typeof g.id !== 'string' || !g.id || ids.has(g.id))) throw new Error('This backup contains duplicate or invalid goal IDs.');
    goal.id = newIds ? goal.id : g.id; ids.add(goal.id);
    goal.icon = typeof g.icon === 'string' ? g.icon : 'target'; goal.categoryId = typeof g.categoryId === 'string' ? g.categoryId : '';
    goal.status = g.status; goal.previousStatus = g.previousStatus === 'completed' ? 'completed' : 'active';
    if (typeof g.createdAt !== 'string' || g.createdAt.length > 40 || !Number.isFinite(Date.parse(g.createdAt))) throw new Error('This backup contains an invalid creation date.');
    goal.createdAt = g.createdAt;
    Object.assign(goal, completionFields({...g, createdAt:goal.createdAt}));
    const taskIds = new Set();
    goal.tasks = g.tasks.map(t => {
      if (!t || typeof t.done !== 'boolean' || (!newIds && (typeof t.id !== 'string' || !t.id || taskIds.has(t.id)))) throw new Error('This backup contains an invalid step.');
      const task = createTask(t.text, t.emoji);
      task.id = newIds ? task.id : t.id; taskIds.add(task.id); task.done = t.done;
      return task;
    });
    return goal;
  });
}

export function assertStateSize(state) { if (new TextEncoder().encode(JSON.stringify(state)).byteLength > 1_990_000) throw new Error("Your goals are at the storage size limit. This change was not added. Export a backup before making more room."); }
