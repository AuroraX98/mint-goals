// Five optional, plain-text answers belong to one goal. Preserve spacing and line breaks.
export const REFLECTION_LIMIT = 2000;
export const REFLECTION_QUESTIONS = [
  ['why', 'Why does this goal matter to me?'],
  ['explore', 'What am I curious to explore?'],
  ['learn', 'What do I want to learn or discover?'],
  ['create', 'What would I like to create or accomplish?'],
  ['apply', 'How will I use what I learn?'],
];
export function reflectionFields(value) {
  if (value === undefined) value = {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !REFLECTION_QUESTIONS.some(([k]) => k === key))) throw new Error('Invalid goal reflection.');
  const result = {};
  for (const [key] of REFLECTION_QUESTIONS) {
    const answer = value[key] === undefined ? '' : value[key];
    if (typeof answer !== 'string' || answer.length > REFLECTION_LIMIT) throw new Error(`Each answer can contain up to ${REFLECTION_LIMIT.toLocaleString('en-US')} characters.`);
    result[key] = answer;
  }
  return result;
}
export const CUSTOM_QUESTION_LIMIT = 100;
export function customQuestionFields(value = []) {
  if (!Array.isArray(value) || value.length > CUSTOM_QUESTION_LIMIT) throw new Error('A goal can have up to 100 custom questions.');
  const ids = new Set();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(k=>!['id','question','answer'].includes(k)) || typeof item.id !== 'string' || !item.id || item.id.length > 128 || ids.has(item.id)) throw new Error('Invalid custom question.');
    ids.add(item.id);
    if (typeof item.question !== 'string' || item.question.length > 300 || typeof item.answer !== 'string' || item.answer.length > REFLECTION_LIMIT) throw new Error('Use up to 300 characters for a question and 2,000 for its answer.');
    return {id:item.id, question:item.question, answer:item.answer};
  });
}
export function reflectionSnapshot(state, drafts) {
  return {...state, goals: state.goals.map(goal => ({...goal, reflection:{...reflectionFields(goal.reflection), ...(drafts.get(goal.id)?.reflection||{})},customQuestions:drafts.get(goal.id)?.customQuestions??customQuestionFields(goal.customQuestions)}))};
}
