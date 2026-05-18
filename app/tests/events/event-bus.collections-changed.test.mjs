// Phase 50 Plan 50-02 — Wave 0 RED scaffold for COLLECTIONS_CHANGED event delivery.
//
// Runtime test: eventBus.emit({ type: 'COLLECTIONS_CHANGED', payload: { kind:
// 'create', collectionId: 'c1' } }) must reach a subscribe('COLLECTIONS_CHANGED',
// fn) listener with the expected payload. The event TYPE itself is added to
// AppEvent in plan 50-01 (same wave); the underlying eventBus runtime is
// type-agnostic but TypeScript callers will only compile after 50-01 lands.
//
// This runtime test passes ONLY if AppEvent in src/types/index.ts already has
// the 'COLLECTIONS_CHANGED' member (otherwise the .mjs file still runs because
// node --test does not type-check). We add the failing assertion to keep the
// scaffold RED until plan 50-03 wires collectionService through eventBus
// (which is when the test becomes meaningful: emit happens for real, not from
// the test harness).
//
// Turned GREEN by plan 50-03 (collectionService implementation emits the
// event from its CRUD verbs — at that point the runtime delivery contract is
// observably correct).

import test from 'node:test';
import assert from 'node:assert/strict';

const { eventBus } = await import('../../src/lib/event-bus.ts');

const TURNED_GREEN_BY = 'plan 50-03 (collectionService emits COLLECTIONS_CHANGED)';

test(`EB-01: eventBus delivers COLLECTIONS_CHANGED event to subscribers with full payload [${TURNED_GREEN_BY}]`, () => {
  const received = [];
  const unsubscribe = eventBus.subscribe('COLLECTIONS_CHANGED', (e) => received.push(e));
  try {
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind: 'create', collectionId: 'c1' },
    });
  } finally {
    unsubscribe();
  }

  // Until plan 50-01 adds COLLECTIONS_CHANGED to AppEvent AND plan 50-03 wires
  // a real emit from collectionService, this scaffold remains RED.
  assert.fail(`Wave 0 scaffold — turns GREEN in ${TURNED_GREEN_BY}. Expected: received.length === 1 && received[0].payload.kind === 'create' && received[0].payload.collectionId === 'c1'. Actual: received.length=${received.length}.`);
});

test(`EB-02: eventBus delivers COLLECTIONS_CHANGED with kind: 'add-post' (payload variant) [${TURNED_GREEN_BY}]`, () => {
  const received = [];
  const unsubscribe = eventBus.subscribe('COLLECTIONS_CHANGED', (e) => received.push(e));
  try {
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind: 'add-post', collectionId: 'c1', postId: 'p1' },
    });
  } finally {
    unsubscribe();
  }
  assert.fail(`Wave 0 scaffold — turns GREEN in ${TURNED_GREEN_BY}. Expected the add-post variant delivered with collectionId+postId.`);
});

test(`EB-03: unsubscribe stops further deliveries (no leak across tests) [${TURNED_GREEN_BY}]`, () => {
  const received = [];
  const unsubscribe = eventBus.subscribe('COLLECTIONS_CHANGED', (e) => received.push(e));
  unsubscribe();
  eventBus.emit({
    type: 'COLLECTIONS_CHANGED',
    payload: { kind: 'delete', collectionId: 'c1' },
  });
  assert.fail(`Wave 0 scaffold — turns GREEN in ${TURNED_GREEN_BY}. Expected: unsubscribed listener does NOT receive events. Actual received.length=${received.length}.`);
});
