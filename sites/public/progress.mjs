// Calendar buckets use the viewer's timezone; elapsed durations use exact instants.
const DAY = 86_400_000;

export function isCompleted(goal) {
  return Boolean(goal && (goal.status === 'completed' ||
    (goal.status === 'archived' && goal.previousStatus === 'completed')));
}

function validDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validDateKey(value.slice(0, 10))) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function calendarDate(key) { return new Date(`${key}T00:00:00.000Z`); }
function keyOf(date) { return date.toISOString().slice(0, 10); }
function monday(key) {
  const date = calendarDate(key);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return keyOf(date);
}

/**
 * One current completion per goal, including archived completed goals. Last duplicate
 * ID wins. Unknown dates stay in the timeline but never enter a time bucket.
 * Manual completion dates have deliberately unknown durations. medianDays is an
 * unrounded elapsed-day median across all filtered precise, nonnegative durations.
 */
export function summarizeProgress(goals, { period = 'week', categoryId = '', now = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone } = {}) {
  period = period === 'month' ? 'month' : 'week';
  let localFormatter;
  try {
    localFormatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    timeZone = localFormatter.resolvedOptions().timeZone;
  } catch {
    timeZone = 'UTC';
    localFormatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  const localKey = value => {
    const parts = Object.fromEntries(localFormatter.formatToParts(value).map(p => [p.type, p.value]));
    return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
  };
  const nowDate = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const today = localKey(nowDate);
  const first = calendarDate(period === 'week' ? monday(today) : `${today.slice(0, 7)}-01`);
  const count = period === 'week' ? 8 : 12;
  const labelFormat = new Intl.DateTimeFormat('en-US', period === 'week'
    ? { timeZone: 'UTC', month: 'short', day: 'numeric' }
    : { timeZone: 'UTC', month: 'short', year: 'numeric' });
  const buckets = Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    if (period === 'week') date.setUTCDate(date.getUTCDate() - (count - 1 - index) * 7);
    else date.setUTCMonth(date.getUTCMonth() - (count - 1 - index));
    return { key: keyOf(date).slice(0, period === 'week' ? 10 : 7), label: labelFormat.format(date), count: 0 };
  });
  const bucketMap = new Map(buckets.map(bucket => [bucket.key, bucket]));
  const unique = new Map();
  for (const goal of Array.isArray(goals) ? goals : []) {
    if (goal && typeof goal === 'object') unique.set(typeof goal.id === 'string' && goal.id ? goal.id : Symbol(), goal);
  }
  const timeline = [];
  for (const goal of unique.values()) {
    const matchesCategory = !categoryId || (categoryId === 'uncategorized' ? !goal.categoryId : goal.categoryId === categoryId);
    if (!isCompleted(goal) || !matchesCategory) continue;
    const completed = instant(goal.completedAt);
    const created = instant(goal.createdAt);
    const dateKey = completed !== null ? localKey(completed) : validDateKey(goal.completionDate) ? goal.completionDate : null;
    const dateSource = completed !== null ? 'precise' : dateKey ? 'manual' : 'unknown';
    const durationDays = completed !== null && created !== null && completed >= created ? (completed - created) / DAY : null;
    timeline.push({ goal, dateKey, dateSource, durationDays });
    if (dateKey) {
      const bucket = bucketMap.get(period === 'week' ? monday(dateKey) : dateKey.slice(0, 7));
      if (bucket) bucket.count++;
    }
  }
  timeline.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey === null ? 1 : b.dateKey === null ? -1 : b.dateKey.localeCompare(a.dateKey);
    return (instant(b.goal.completedAt) ?? 0) - (instant(a.goal.completedAt) ?? 0);
  });
  const durations = timeline.map(item => item.durationDays).filter(value => value !== null).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const medianDays = durations.length ? durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2 : null;
  return { period, timeZone, buckets, timeline, completedCount: timeline.length, unknownCount: timeline.filter(item => item.dateSource === 'unknown').length, medianDays };
}
