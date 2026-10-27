import test from 'node:test';
import assert from 'node:assert/strict';
import { isCompleted, summarizeProgress } from '../src/progress.mjs';

const goal = (id, fields = {}) => ({ id, status: 'completed', categoryId: '', createdAt: '2026-01-01T00:00:00.000Z', ...fields });
const summarize = (goals, options = {}) => summarizeProgress(goals, { now: new Date('2026-03-09T12:00:00Z'), timeZone: 'UTC', ...options });

test('empty totals have stable eight Monday buckets and no median', () => {
  const result = summarize([]);
  assert.equal(result.buckets.length, 8);
  assert.equal(result.buckets[0].key, '2026-01-19');
  assert.equal(result.buckets.at(-1).key, '2026-03-09');
  assert.ok(result.buckets.every(b => b.count === 0));
  assert.equal(result.medianDays, null);
  assert.equal(result.unknownCount, 0);
});

test('month buckets cross years and do not overflow short months', () => {
  const result = summarize([], { period: 'month', now: new Date('2026-03-31T12:00:00Z') });
  assert.equal(result.buckets.length, 12);
  assert.equal(result.buckets[0].key, '2025-04');
  assert.deepEqual(result.buckets.slice(-3).map(b => b.key), ['2026-01', '2026-02', '2026-03']);
});

test('viewer timezone determines Monday boundary across DST', () => {
  const goals = [goal('sun', { completedAt: '2026-03-09T06:59:59Z' }), goal('mon', { completedAt: '2026-03-09T07:00:00Z' })];
  const result = summarize(goals, { timeZone: 'America/Los_Angeles' });
  assert.deepEqual(result.buckets.slice(-2).map(b => b.count), [1, 1]);
  assert.deepEqual(result.timeline.map(t => t.dateKey), ['2026-03-09', '2026-03-08']);
  const beforeMidnight = summarize([], { timeZone: 'America/Los_Angeles', now: new Date('2026-03-09T06:59:59Z') });
  assert.equal(beforeMidnight.buckets.at(-1).key, '2026-03-02');
});

test('local month and year boundaries respect positive timezone offsets', () => {
  const result = summarize([goal('new', { completedAt: '2025-12-31T15:00:00Z' })], {
    period: 'month', now: new Date('2025-12-31T15:01:00Z'), timeZone: 'Asia/Tokyo',
  });
  assert.equal(result.buckets.at(-1).key, '2026-01');
  assert.equal(result.buckets.at(-1).count, 1);
  assert.equal(result.timeline[0].dateKey, '2026-01-01');
});

test('archived completions count; active, reopened and archived-active goals do not', () => {
  assert.equal(isCompleted(null), false);
  const result = summarize([
    goal('done'), goal('archived', { status: 'archived', previousStatus: 'completed' }),
    goal('active', { status: 'active', completedAt: '2026-03-01T00:00:00Z' }),
    goal('archived-active', { status: 'archived', previousStatus: 'active' }),
    goal('reopened', { previousStatus: 'completed', status: 'active' }),
  ]);
  assert.equal(result.completedCount, 2);
  assert.equal(result.unknownCount, 2);
});

test('manual dates enter buckets but not durations; unknown dates sort last', () => {
  const result = summarize([
    goal('unknown'), goal('manual', { completionDate: '2026-03-08' }),
    goal('exact', { createdAt: '2026-03-08T00:00:00Z', completedAt: '2026-03-09T12:00:00Z' }),
  ]);
  assert.deepEqual(result.timeline.map(t => t.goal.id), ['exact', 'manual', 'unknown']);
  assert.deepEqual(result.timeline.map(t => t.dateSource), ['precise', 'manual', 'unknown']);
  assert.deepEqual(result.timeline.map(t => t.durationDays), [1.5, null, null]);
  assert.equal(result.medianDays, 1.5);
  assert.equal(result.unknownCount, 1);
  assert.deepEqual(result.buckets.slice(-2).map(b => b.count), [1, 1]);
});

test('category filters all metrics and old completions remain in timeline', () => {
  const result = summarize([
    goal('old', { categoryId: 'a', completedAt: '2026-01-02T00:00:00Z' }),
    goal('other', { categoryId: 'b' }),
  ], { categoryId: 'a' });
  assert.equal(result.completedCount, 1);
  assert.equal(result.medianDays, 1);
  assert.equal(result.unknownCount, 0);
  assert.equal(result.buckets.reduce((sum, b) => sum + b.count, 0), 0);
});

test('uncategorized sentinel matches missing or empty categories only', () => {
  const result = summarize([
    goal('empty'), goal('missing', { categoryId: undefined }),
    goal('null', { categoryId: null }), goal('assigned', { categoryId: 'a' }),
  ], { categoryId: 'uncategorized' });
  assert.deepEqual(result.timeline.map(t => t.goal.id), ['empty', 'missing', 'null']);
  assert.equal(result.completedCount, 3);
  assert.equal(result.unknownCount, 3);
});

test('median averages middle values, excludes negative and invalid durations', () => {
  const result = summarize([
    goal('two', { completedAt: '2026-01-03T00:00:00Z' }),
    goal('four', { completedAt: '2026-01-05T00:00:00Z' }),
    goal('negative', { completedAt: '2025-12-31T00:00:00Z' }),
    goal('bad-created', { createdAt: null, completedAt: '2026-01-05T00:00:00Z' }),
  ]);
  assert.equal(result.medianDays, 3);
});

test('invalid dates are unknown, valid manual fallback is retained, invalid timezone falls back', () => {
  const result = summarize([
    goal('invalid', { completedAt: 'not-a-date', completionDate: '2026-02-30' }),
    goal('rolled', { completedAt: '2026-02-30T00:00:00Z' }),
    goal('date-only', { completedAt: '2026-03-09' }),
    goal('fallback', { completedAt: 'bad', completionDate: '2026-03-09' }),
  ], { timeZone: 'invalid/timezone' });
  assert.equal(result.timeZone, 'UTC');
  assert.equal(result.unknownCount, 3);
  assert.equal(result.buckets.at(-1).count, 1);
  assert.equal(result.medianDays, null);
});

test('last record per ID wins before filtering and inputs are not mutated', () => {
  const goals = [goal('same'), goal('same', { status: 'active' }), goal('done', { completionDate: '2026-03-09' }), goal('done', { completionDate: '2026-03-08' })];
  const before = structuredClone(goals);
  const result = summarize(goals);
  assert.equal(result.completedCount, 1);
  assert.equal(result.timeline[0].dateKey, '2026-03-08');
  assert.deepEqual(goals, before);
});

test('DST changes do not change elapsed day math', () => {
  const result = summarize([goal('dst', { createdAt: '2026-03-08T00:00:00-08:00', completedAt: '2026-03-09T00:00:00-07:00' })], { timeZone: 'America/Los_Angeles' });
  assert.equal(result.medianDays, 23 / 24);
});

test('Monday weeks cross the year without resetting and leap-day manual dates are valid', () => {
  const year = summarize([goal('new-year', { completionDate: '2026-01-01' })], { now: new Date('2026-01-01T12:00:00Z') });
  assert.equal(year.buckets.at(-1).key, '2025-12-29');
  assert.equal(year.buckets.at(-1).count, 1);
  const leap = summarize([goal('leap', { completionDate: '2024-02-29' }), goal('not-leap', { completionDate: '2025-02-29' })], { period: 'month', now: new Date('2024-02-29T12:00:00Z') });
  assert.equal(leap.buckets.at(-1).count, 1);
  assert.equal(leap.unknownCount, 1);
});

test('fall DST repeated local hour sorts by precise instant', () => {
  const result = summarize([
    goal('earlier', { completedAt: '2026-11-01T01:30:00-07:00' }),
    goal('later', { completedAt: '2026-11-01T01:30:00-08:00' }),
  ], { now: new Date('2026-11-01T12:00:00Z'), timeZone: 'America/Los_Angeles' });
  assert.deepEqual(result.timeline.map(t => t.goal.id), ['later', 'earlier']);
  assert.equal(result.buckets.at(-1).count, 2);
});
