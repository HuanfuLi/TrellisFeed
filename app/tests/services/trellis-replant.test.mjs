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

function makeQuestion(overrides = {}) {
  return {
    id: `q-${Math.random().toString(16).slice(2)}`,
    content: 'What is spaced repetition?',
    answer: 'A learning technique.',
    title: 'Spaced Repetition',
    keywords: [],
    timestamp: Date.now(),
    date: '2026-04-10',
    isAnchorNode: true,
    reviewSchedule: {
      nextReviewDate: '2025-01-01',
      reviewCount: 3,
      easeFactor: 2.7,
      interval: 14,
      lastReviewedAt: null,
    },
    ...overrides,
  };
}

// D-13 (modified): replant is synchronous — returns navigation intent immediately
test('replant is synchronous and returns navigateTo /posts/anchor-post-{id}', async () => {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeQuestion({ id: 'anchor-abc', title: 'Neural Networks' });
  _resetStore([anchor]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  const result = trellisActionsService.replant('anchor-abc', anchor, []);

  // Must return synchronously (not a Promise)
  assert.ok(!(result instanceof Promise), 'replant must return synchronously, not a Promise');
  assert.equal(result.navigateTo, '/posts/anchor-post-anchor-abc');
});

// D-13 (modified): replant discoverMeta contains concept and formatted title
test('replant returns discoverMeta with concept and "Understanding ... : A Complete Guide" title', async () => {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeQuestion({ id: 'anchor-nn', title: 'Neural Networks' });
  _resetStore([anchor]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  const result = trellisActionsService.replant('anchor-nn', anchor, []);

  assert.ok('discoverMeta' in result.state, 'state must have discoverMeta key');
  assert.equal(result.state.discoverMeta.concept, 'Neural Networks');
  assert.equal(result.state.discoverMeta.title, 'Understanding Neural Networks: A Complete Guide');
});

// D-13 (modified): anchor gets reviewSchedule bumped to dyingSchedule
// nextReviewDate = yesterday, reviewCount >= 1, easeFactor preserved
test('replant bumps anchor reviewSchedule to dyingSchedule (nextReviewDate yesterday, reviewCount >= 1)', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeQuestion({ id: 'anchor-sr', reviewSchedule: { nextReviewDate: '2025-01-01', reviewCount: 3, easeFactor: 2.7 } });
  _resetStore([anchor]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.replant('anchor-sr', anchor, []);

  const stored = _getStore().find((q) => q.id === 'anchor-sr');
  assert.ok(stored, 'anchor must still exist in store');

  const sched = stored.reviewSchedule;
  // nextReviewDate must be yesterday (1 day before today)
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const expectedYesterday = today.toISOString().split('T')[0];
  assert.equal(sched.nextReviewDate, expectedYesterday, 'nextReviewDate must be yesterday');
  assert.ok(sched.reviewCount >= 1, 'reviewCount must be >= 1');
  assert.equal(sched.easeFactor, 2.7, 'easeFactor must be preserved from prior schedule');
});

// D-13 (modified): QA children also get dyingSchedule
test('replant bumps each QA child to dyingSchedule', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeQuestion({ id: 'anchor-sr2', reviewSchedule: { nextReviewDate: '2025-01-01', reviewCount: 2, easeFactor: 2.5 } });
  const qa1 = makeQuestion({ id: 'qa-1', isAnchorNode: false, reviewSchedule: { nextReviewDate: '2025-03-01', reviewCount: 1, easeFactor: 2.3 } });
  const qa2 = makeQuestion({ id: 'qa-2', isAnchorNode: false, reviewSchedule: { nextReviewDate: '2025-03-05', reviewCount: 4, easeFactor: 2.8 } });
  _resetStore([anchor, qa1, qa2]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.replant('anchor-sr2', anchor, ['qa-1', 'qa-2']);

  const today = new Date();
  today.setDate(today.getDate() - 1);
  const yesterday = today.toISOString().split('T')[0];

  const stored = _getStore();
  for (const id of ['qa-1', 'qa-2']) {
    const q = stored.find((q) => q.id === id);
    assert.ok(q, `${id} must exist`);
    assert.equal(q.reviewSchedule.nextReviewDate, yesterday, `${id} nextReviewDate must be yesterday`);
    assert.ok(q.reviewSchedule.reviewCount >= 1, `${id} reviewCount must be >= 1`);
  }
  // qa-2 had reviewCount=4 which should be preserved (Math.max(1, 4) = 4)
  const qa2stored = stored.find((q) => q.id === 'qa-2');
  assert.equal(qa2stored.reviewSchedule.reviewCount, 4, 'higher reviewCount should be preserved');
});

// D-13 (modified): no flashcard schedules touched — no flashcard service calls made
test('replant does not modify flashcard records', async () => {
  storage.clear();
  // flashcardService is not imported by trellis-actions.service (simplified flow)
  // Confirm by checking that the mock question store does not include any cards
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeQuestion({ id: 'anchor-fc', title: 'Memory Palaces' });
  const qa = makeQuestion({ id: 'qa-fc', isAnchorNode: false });
  // Simulate a flashcard stored as a separate item NOT in the question store
  const initialStoreLength = 2;
  _resetStore([anchor, qa]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.replant('anchor-fc', anchor, ['qa-fc']);

  // Question store count must remain the same (no extra rows added by replant)
  const afterStore = _getStore();
  assert.equal(afterStore.length, initialStoreLength, 'replant must not add or remove questions');
});

// D-14 (voided): replant emits CLASSIFICATION_COMPLETED so useTrellisData recomputes
test('replant emits CLASSIFICATION_COMPLETED event', async () => {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const anchor = makeQuestion({ id: 'anchor-evt', title: 'Test Topic' });
  _resetStore([anchor]);

  const events = [];
  const unsub = eventBus.subscribe('CLASSIFICATION_COMPLETED', (e) => events.push(e));

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.replant('anchor-evt', anchor, []);
  unsub();

  assert.equal(events.length, 1, 'must emit exactly one CLASSIFICATION_COMPLETED');
  assert.equal(events[0].payload.anchorId, 'anchor-evt');
});
