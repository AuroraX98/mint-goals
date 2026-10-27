import { createGoal, createTask, cleanText, LIMITS, uid, assertStateSize } from './model.mjs';

// All form work is local until the whole goal passes validation.
export function stageCategory(categories, name) {
  const cleaned = cleanText(name, 60, true);
  const existing = categories.find(category => category.name.toLowerCase() === cleaned.toLowerCase());
  if (existing) return { categories, categoryId: existing.id };
  if (categories.length >= 50) throw new Error('You can keep up to 50 categories.');
  const category = { id: uid(), name: cleaned };
  return { categories: [...categories, category], categoryId: category.id };
}

export function prepareGoalSave(state, draft, goalId = null) {
  const title = cleanText(draft.title, LIMITS.title, true);
  const description = cleanText(draft.description, LIMITS.description);
  const existing = goalId ? state.goals.find(goal => goal.id === goalId) : null;
  if (goalId && !existing) throw new Error('This goal is no longer available.');
  if (!existing && state.goals.length >= LIMITS.goals) throw new Error('You can keep up to 200 goals.');
  const categories = draft.categories.map(category => ({ ...category }));
  if (categories.length > 50) throw new Error('You can keep up to 50 categories.');
  if (draft.categoryId && !categories.some(category => category.id === draft.categoryId)) throw new Error('Please choose an available category.');
  const goal = { ...(existing || createGoal(title, description)), title, description, icon: draft.icon, categoryId: draft.categoryId };
  if (!existing) {
    const steps = draft.steps.filter(step => cleanText(step.text, LIMITS.task));
    if (steps.length > LIMITS.tasks) throw new Error('A goal can have up to 200 steps.');
    goal.tasks = steps.map(step => createTask(step.text, step.emoji));
  }
  const nextState = { ...state, categories, goals: existing ? state.goals.map(item => item.id === goalId ? goal : item) : [goal, ...state.goals] };
  assertStateSize(nextState);
  return nextState;
}
