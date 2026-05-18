// Phase 50 Plan 50-03 — COLLECTIONS_CHANGED event delivery (turned GREEN).
//
// Runtime test: eventBus.emit({ type: 'COLLECTIONS_CHANGED', payload: { kind:
// 'create', collectionId: 'c1' } }) must reach a subscribe('COLLECTIONS_CHANGED',
// fn) listener with the expected payload. The event TYPE itself was added to
// AppEvent in plan 50-01 (D-03 — locked payload shape `{ kind, collectionId }`).
// Plan 50-03 wires collectionService to emit through the bus, so this test
// becomes meaningful (real emit, not just from the test harness).
//
// Note: the locked AppEvent payload for COLLECTIONS_CHANGED is intentionally
// `{ kind, collectionId }` only — discriminating on `kind` ('create' | 'rename'
// | 'delete' | 'add-post' | 'remove-post') is sufficient for every consumer
// (CollectionPickerSheet, SavedScreen Collections tab, CollectionDrillInScreen).
// Subscribers re-read collectionService for full state, matching the
// "one signal per semantic event" rule in CLAUDE.md §"Event bus — unified
// GRAPH_UPDATED". We DO NOT thread postId through the payload — that would
// be a duplicate signal source vs. the post list already exposed via
// collectionService.getCollections().

import test from 'node:test';
import assert from 'node:assert/strict';

const { eventBus } = await import('../../src/lib/event-bus.ts');

test('EB-01: eventBus delivers COLLECTIONS_CHANGED event to subscribers with full payload', () => {
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

  assert.equal(received.length, 1, 'subscriber must receive exactly one event');
  assert.equal(received[0].type, 'COLLECTIONS_CHANGED');
  assert.equal(received[0].payload.kind, 'create');
  assert.equal(received[0].payload.collectionId, 'c1');
});

test('EB-02: eventBus delivers COLLECTIONS_CHANGED with kind: "add-post" (payload variant)', () => {
  // Locked payload shape per 50-CONTEXT D-03 + types/index.ts AppEvent union:
  //   { kind: 'create' | 'rename' | 'delete' | 'add-post' | 'remove-post',
  //     collectionId: string }
  // The `kind: 'add-post'` variant uses the SAME shape — no postId field;
  // subscribers re-read collectionService.getCollectionPosts(collectionId)
  // for the updated membership list.
  const received = [];
  const unsubscribe = eventBus.subscribe('COLLECTIONS_CHANGED', (e) => received.push(e));
  try {
    eventBus.emit({
      type: 'COLLECTIONS_CHANGED',
      payload: { kind: 'add-post', collectionId: 'c1' },
    });
  } finally {
    unsubscribe();
  }

  assert.equal(received.length, 1);
  assert.equal(received[0].payload.kind, 'add-post');
  assert.equal(received[0].payload.collectionId, 'c1');
});

test('EB-03: unsubscribe stops further deliveries (no leak across tests)', () => {
  const received = [];
  const unsubscribe = eventBus.subscribe('COLLECTIONS_CHANGED', (e) => received.push(e));
  unsubscribe();
  eventBus.emit({
    type: 'COLLECTIONS_CHANGED',
    payload: { kind: 'delete', collectionId: 'c1' },
  });
  assert.equal(received.length, 0, 'unsubscribed listener must NOT receive events');
});
