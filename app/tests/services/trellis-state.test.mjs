import assert from 'node:assert/strict';
import test from 'node:test';

// localStorage shim (same pattern as 25-00 test)
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const mkQ = (overrides = {}) => ({
  id: `q-${Math.random().toString(16).slice(2)}`,
  content: 'q',
  answer: 'a',
  title: 't',
  keywords: [],
  timestamp: Date.now(),
  date: '2026-04-10',
  reviewSchedule: {
    nextReviewDate: '2026-04-10',
    reviewCount: 0,
    easeFactor: 2.5,
    interval: 1,
    lastReviewedAt: null,
  },
  ...overrides,
});

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

test('computeLeafState returns bud when reviewCount is zero everywhere', async () => {
  storage.clear();
  const { computeLeafState } = await import('../../src/services/trellis-state.service.ts');
  const anchor = mkQ({ reviewSchedule: { ...mkQ().reviewSchedule, reviewCount: 0 } });
  assert.equal(computeLeafState(anchor, []), 'bud');
});

test('computeLeafState returns dying for 1-7 day overdue child', async () => {
  storage.clear();
  const { computeLeafState } = await import('../../src/services/trellis-state.service.ts');
  const anchor = mkQ({ reviewSchedule: { ...mkQ().reviewSchedule, reviewCount: 1 } });
  const child = mkQ({ reviewSchedule: { nextReviewDate: daysAgo(3), reviewCount: 1, easeFactor: 2.0, interval: 2, lastReviewedAt: null } });
  assert.equal(computeLeafState(anchor, [child]), 'dying');
});

test('worst-child-wins: one 14-day child beats healthy sibling', async () => {
  storage.clear();
  const { computeLeafState } = await import('../../src/services/trellis-state.service.ts');
  const anchor = mkQ({ reviewSchedule: { ...mkQ().reviewSchedule, reviewCount: 1 } });
  const bad = mkQ({ reviewSchedule: { nextReviewDate: daysAgo(14), reviewCount: 1, easeFactor: 2.0, interval: 2, lastReviewedAt: null } });
  const good = mkQ({ reviewSchedule: { nextReviewDate: daysAgo(-5), reviewCount: 1, easeFactor: 2.5, interval: 2, lastReviewedAt: null } });
  assert.equal(computeLeafState(anchor, [bad, good]), 'dead');
});

test('blossom state when all reviewed AND easeFactor > 2.5', async () => {
  storage.clear();
  const { computeLeafState } = await import('../../src/services/trellis-state.service.ts');
  const anchor = mkQ({ reviewSchedule: { ...mkQ().reviewSchedule, reviewCount: 2 } });
  const c1 = mkQ({ reviewSchedule: { nextReviewDate: daysAgo(-5), reviewCount: 3, easeFactor: 2.8, interval: 10, lastReviewedAt: null } });
  const c2 = mkQ({ reviewSchedule: { nextReviewDate: daysAgo(-5), reviewCount: 3, easeFactor: 2.7, interval: 10, lastReviewedAt: null } });
  assert.equal(computeLeafState(anchor, [c1, c2]), 'blossom');
});

test('fruit state when blossomSinceDate >= 7 days ago', async () => {
  storage.clear();
  const { computeLeafState } = await import('../../src/services/trellis-state.service.ts');
  const anchor = mkQ({ reviewSchedule: { ...mkQ().reviewSchedule, reviewCount: 2 } });
  const c1 = mkQ({ reviewSchedule: { nextReviewDate: daysAgo(-5), reviewCount: 3, easeFactor: 2.8, interval: 10, lastReviewedAt: null } });
  assert.equal(computeLeafState(anchor, [c1], daysAgo(8)), 'fruit');
});

test('buildTrellisState([]) returns empty nodes and vines', async () => {
  storage.clear();
  const { buildTrellisState } = await import('../../src/services/trellis-state.service.ts');
  const result = buildTrellisState([]);
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.vines, []);
});
