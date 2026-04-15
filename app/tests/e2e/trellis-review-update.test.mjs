import assert from 'node:assert/strict';
import test from 'node:test';

// localStorage shim
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const mkQ = (id, overrides = {}) => ({
  id,
  content: 'q',
  answer: 'a',
  title: id,
  keywords: [],
  timestamp: Date.now(),
  date: '2026-04-10',
  reviewSchedule: {
    nextReviewDate: daysAgo(-5), // 5 days in the future = healthy
    reviewCount: 1,
    easeFactor: 2.5,
    interval: 2,
    lastReviewedAt: null,
  },
  ...overrides,
});

test('buildTrellisState returns green leaf for anchor with healthy child', async () => {
  storage.clear();
  const { buildTrellisState } = await import('../../src/services/trellis-state.service.ts');

  const anchor = mkQ('anchor-1', {
    isAnchorNode: true,
    branchLabel: 'Branch A',
    clusterLabel: 'Cluster A',
    rootLabel: 'Knowledge',
  });
  const child = mkQ('child-1', {
    parentId: 'anchor-1',
    anchorId: 'anchor-1',
    branchLabel: 'Branch A',
    clusterLabel: 'Cluster A',
    rootLabel: 'Knowledge',
  });

  const result = buildTrellisState([anchor, child]);
  const anchorNode = result.nodes.find((n) => n.anchor.id === 'anchor-1');
  assert.ok(anchorNode, 'anchor node should be present');
  assert.equal(anchorNode.leafState, 'green');
});

test('buildTrellisState transitions anchor to falling when child goes 10-day overdue', async () => {
  storage.clear();
  const { buildTrellisState } = await import('../../src/services/trellis-state.service.ts');

  const anchor = mkQ('anchor-2', {
    isAnchorNode: true,
    branchLabel: 'Branch B',
    clusterLabel: 'Cluster B',
    rootLabel: 'Knowledge',
  });
  const child = mkQ('child-2', {
    parentId: 'anchor-2',
    anchorId: 'anchor-2',
    branchLabel: 'Branch B',
    clusterLabel: 'Cluster B',
    rootLabel: 'Knowledge',
    reviewSchedule: {
      nextReviewDate: daysAgo(10),
      reviewCount: 1,
      easeFactor: 2.0,
      interval: 2,
      lastReviewedAt: null,
    },
  });

  const result = buildTrellisState([anchor, child]);
  const anchorNode = result.nodes.find((n) => n.anchor.id === 'anchor-2');
  assert.ok(anchorNode, 'anchor node should be present');
  assert.equal(anchorNode.leafState, 'falling');
});

test('eventBus emit REVIEW_COMPLETED does not throw', async () => {
  const { eventBus } = await import('../../src/lib/event-bus.ts');
  assert.doesNotThrow(() => {
    eventBus.emit({ type: 'REVIEW_COMPLETED', payload: { questionId: 'q1', anchorId: 'a1' } });
  });
});

test('eventBus REVIEW_COMPLETED subscriber fires exactly once per emit', async () => {
  const { eventBus } = await import('../../src/lib/event-bus.ts');
  let callCount = 0;
  let received = null;
  const unsub = eventBus.subscribe('REVIEW_COMPLETED', (e) => {
    callCount++;
    received = e;
  });
  eventBus.emit({ type: 'REVIEW_COMPLETED', payload: { questionId: 'q1', anchorId: 'a1' } });
  assert.equal(callCount, 1);
  assert.equal(received.payload.anchorId, 'a1');
  unsub();
  eventBus.emit({ type: 'REVIEW_COMPLETED', payload: { questionId: 'q2' } });
  assert.equal(callCount, 1, 'unsubscribed handler should not fire');
});
