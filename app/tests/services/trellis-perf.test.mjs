import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { today, __setNowForTesting } from '../../src/lib/date.ts';

// Pin the clock so blossom/overdue arithmetic is deterministic.
before(() => __setNowForTesting(new Date(2026, 4, 20, 12, 0, 0).getTime()));
after(() => __setNowForTesting(null));

// Spying in-memory localStorage shim: counts setItem writes per key.
const storage = new Map();
const setItemCalls = []; // [key, ...] in order
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => { setItemCalls.push(String(k)); storage.set(String(k), String(v)); },
  removeItem: (k) => storage.delete(String(k)),
  clear: () => storage.clear(),
  key: (i) => Array.from(storage.keys())[i] ?? null,
  get length() { return storage.size; },
};

const BLOSSOM_KEY = 'trellis_blossom_dates';

// Seed N anchors, all reaching 'blossom' (children all reviewed + ease > 2.5),
// so each anchor WOULD have triggered a per-node blossom-date write pre-fix.
function seedBlossomGraph(nAnchors) {
  const questions = [];
  const isoToday = today();
  for (let i = 0; i < nAnchors; i++) {
    const branchIdx = i % 6;
    const anchorId = `anchor-${i}`;
    questions.push({
      id: anchorId, content: `c${i}`, answer: 'a', title: `C${i}`, keywords: [],
      timestamp: Date.now(), date: isoToday, isAnchorNode: true,
      rootLabel: 'Knowledge', branchLabel: `Branch ${branchIdx}`, clusterLabel: `Cluster ${branchIdx}`,
      reviewSchedule: { nextReviewDate: isoToday, reviewCount: 2, easeFactor: 2.8, interval: 5, lastReviewedAt: null },
      createdAt: Date.now(),
    });
    for (let c = 0; c < 2; c++) {
      questions.push({
        id: `${anchorId}-qa-${c}`, content: `qa${i}-${c}`, answer: 'a', title: `QA${i}-${c}`, keywords: [],
        timestamp: Date.now(), date: isoToday, parentId: anchorId,
        rootLabel: 'Knowledge', branchLabel: `Branch ${branchIdx}`, clusterLabel: `Cluster ${branchIdx}`,
        reviewSchedule: { nextReviewDate: '2026-06-10', reviewCount: 3, easeFactor: 2.9, interval: 12, lastReviewedAt: null },
        createdAt: Date.now(),
      });
    }
  }
  return questions;
}

test('PERF: blossom-date persistence is batched to ONE write regardless of N', async () => {
  storage.clear();
  setItemCalls.length = 0;
  const { buildTrellisState } = await import('../../src/services/trellis-state.service.ts');

  const N = 300; // 300 blossom anchors — pre-fix would write 300 times
  const questions = seedBlossomGraph(N);
  buildTrellisState(questions);

  const blossomWrites = setItemCalls.filter((k) => k === BLOSSOM_KEY).length;
  // Confirm the work actually happened (all N anchors blossomed).
  const persisted = JSON.parse(storage.get(BLOSSOM_KEY) ?? '{}');
  assert.equal(Object.keys(persisted).length, N, 'all N blossom anchors persisted');
  // The invariant: the in-loop O(N^2) churn is gone — exactly ONE flush write.
  assert.equal(blossomWrites, 1, `expected exactly 1 batched blossom-dates write, got ${blossomWrites}`);
});

test('PERF: no blossom-dates write when nothing changed (clean flush skip)', async () => {
  storage.clear();
  const { buildTrellisState } = await import('../../src/services/trellis-state.service.ts');

  const N = 50;
  const questions = seedBlossomGraph(N);
  // First pass establishes the blossom dates (one write).
  buildTrellisState(questions);

  // Second pass: blossom dates already match → no set/clear ops → no flush write.
  setItemCalls.length = 0;
  buildTrellisState(questions);
  const blossomWrites = setItemCalls.filter((k) => k === BLOSSOM_KEY).length;
  assert.equal(blossomWrites, 0, 'idempotent recompute must not re-write blossom dates');
});

test('PERF: leaf-state outputs unchanged by the batching fix (semantics frozen)', async () => {
  storage.clear();
  const { buildTrellisState, computeLeafState } = await import('../../src/services/trellis-state.service.ts');

  const questions = seedBlossomGraph(20);
  const layout = buildTrellisState(questions);
  assert.equal(layout.nodes.length, 20, 'one leaf per anchor');
  // Every seeded anchor blossomed → all children reviewed + ease > 2.5.
  for (const node of layout.nodes) {
    assert.ok(node.leafState === 'blossom' || node.leafState === 'fruit',
      `expected blossom/fruit, got ${node.leafState}`);
  }
  // Spot-check computeLeafState directly still returns blossom for the shape.
  const anchor = questions.find((q) => q.isAnchorNode);
  const kids = questions.filter((q) => q.parentId === anchor.id);
  assert.equal(computeLeafState(anchor, kids), 'blossom');
});
