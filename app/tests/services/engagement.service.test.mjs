// Phase 39 — engagement.service.ts behavioral test suite.
//
// Mirrors `daily-read.service.test.mjs` shape (localStorage shim + dynamic
// imports). Includes the BEHAVIORAL HALF of D-06 (anti-wire invariant): test
// case 6 asserts dismissAnchor emits exactly 1 anchor-dismiss event AND
// zero engagement-change events AND zero explored-anchor events. The static
// (source-reading) half lives in `engagement-anti-wire.test.mjs`.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill for Node
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { engagementService } = await import('../../src/services/engagement.service.ts');
const { postHistoryService } = await import('../../src/services/post-history.service.ts');
const { eventBus } = await import('../../src/lib/event-bus.ts');
const { dbQuery, clearAllTables } = await import('../../src/services/db.service.ts');

// Phase 55-07: engagement + post-history are now in-memory mirrors persisted to
// IndexedDB (not localStorage). Tests reset via the services' own reset/clear
// methods and assert through public getters instead of reading localStorage.

// Capture buckets refreshed in beforeEach so prior-test subscribers can no-op.
let dismissEvents;
let engagementEvents;
let exploredEvents;
const unsubs = [];

function captureAll() {
  // Each beforeEach replaces these arrays so the closures captured by the
  // singleton event-bus push into the active iteration's arrays. Tests assert
  // against the ACTIVE arrays only.
  dismissEvents = [];
  engagementEvents = [];
  exploredEvents = [];
  // Tear down any previous subscriptions so we don't accumulate handlers.
  while (unsubs.length) {
    try { unsubs.pop()?.(); } catch { /* noop */ }
  }
  unsubs.push(eventBus.subscribe('ANCHOR_DISMISSED', (e) => dismissEvents.push(e)));
  unsubs.push(eventBus.subscribe('ENGAGEMENT_CHANGED', (e) => engagementEvents.push(e)));
  unsubs.push(eventBus.subscribe('CONCEPT_EXPLORED', (e) => exploredEvents.push(e)));
}

describe('engagementService — Phase 39', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearAllTables();
    // Reset the in-memory mirrors (the localStorage clear no longer does this
    // now that the stores are in-memory + IndexedDB).
    engagementService.reset();
    postHistoryService.clear();
    captureAll();
  });

  it('savePost adds postId to the saved set', () => {
    engagementService.savePost('p1');
    assert.deepEqual(engagementService.getSavedPostIds(), ['p1']);
  });

  it('savePost is idempotent — duplicate calls do not add twice and emit only one event', () => {
    engagementService.savePost('p1');
    engagementService.savePost('p1');
    assert.equal(engagementService.getSavedPostIds().length, 1);
    const saveEvents = engagementEvents.filter(e => e.payload.kind === 'save' && e.payload.id === 'p1');
    assert.equal(saveEvents.length, 1, 'expected exactly one ENGAGEMENT_CHANGED kind=save event for p1');
  });

  it("removeSavedPost removes postId and emits ENGAGEMENT_CHANGED kind:'unsave'", () => {
    engagementService.savePost('p1');
    engagementEvents.length = 0;
    engagementService.removeSavedPost('p1');
    assert.deepEqual(engagementService.getSavedPostIds(), []);
    assert.equal(engagementEvents.length, 1);
    assert.equal(engagementEvents[0].payload.kind, 'unsave');
    assert.equal(engagementEvents[0].payload.id, 'p1');
  });

  it('removeSavedPost on never-saved post is a no-op (no event emitted)', () => {
    engagementService.removeSavedPost('p-nope');
    assert.equal(engagementEvents.length, 0, 'no ENGAGEMENT_CHANGED event should be emitted for a no-op remove');
  });

  it("likePost / unlikePost / isLiked round-trip with kind:'like'/'unlike'", () => {
    engagementService.likePost('p1');
    assert.equal(engagementService.isLiked('p1'), true);
    assert.equal(engagementEvents.length, 1);
    assert.equal(engagementEvents[0].payload.kind, 'like');
    assert.equal(engagementEvents[0].payload.id, 'p1');
    engagementService.unlikePost('p1');
    assert.equal(engagementService.isLiked('p1'), false);
    assert.equal(engagementEvents.length, 2);
    assert.equal(engagementEvents[1].payload.kind, 'unlike');
    assert.equal(engagementEvents[1].payload.id, 'p1');
  });

  // CASE 6 — D-06 BEHAVIORAL HALF
  it('dismissAnchor emits EXACTLY ONE anchor-dismiss event + ZERO engagement-change events + ZERO explored events', () => {
    engagementService.dismissAnchor('a1');
    assert.equal(dismissEvents.length, 1, 'expected exactly one ANCHOR_DISMISSED');
    assert.equal(dismissEvents[0].payload.anchorId, 'a1');
    assert.equal(engagementEvents.length, 0, 'dismissAnchor must NOT emit ENGAGEMENT_CHANGED — D-06');
    assert.equal(exploredEvents.length, 0, 'dismissAnchor must NOT emit CONCEPT_EXPLORED — D-06 anti-wire');
  });

  it('dismissAnchor is idempotent — duplicate calls do not re-emit', () => {
    engagementService.dismissAnchor('a1');
    engagementService.dismissAnchor('a1');
    assert.equal(dismissEvents.length, 1, 'second dismissAnchor on the same anchor must not re-emit');
    assert.deepEqual(engagementService.getDismissedAnchorIds(), ['a1']);
  });

  it("undismissAnchor emits EXACTLY ONE engagement-change event kind:'undismiss' + ZERO anchor-dismiss events", () => {
    engagementService.dismissAnchor('a1');
    dismissEvents.length = 0;
    engagementEvents.length = 0;
    engagementService.undismissAnchor('a1');
    assert.deepEqual(engagementService.getDismissedAnchorIds(), []);
    assert.equal(engagementEvents.length, 1);
    assert.equal(engagementEvents[0].payload.kind, 'undismiss');
    assert.equal(engagementEvents[0].payload.id, 'a1');
    assert.equal(dismissEvents.length, 0, 'undismissAnchor must NOT emit ANCHOR_DISMISSED — D-06');
  });

  it('getPinnedIds returns saved ∪ liked, NOT dismissed', () => {
    engagementService.savePost('p1');
    engagementService.likePost('p2');
    engagementService.dismissAnchor('a1');
    const pinned = engagementService.getPinnedIds();
    assert.equal(pinned.has('p1'), true);
    assert.equal(pinned.has('p2'), true);
    assert.equal(pinned.has('a1'), false);
    assert.equal(pinned.size, 2);
  });

  it('state round-trips through the public getters (saved/liked/dismissed)', () => {
    engagementService.savePost('p1');
    engagementService.likePost('p2');
    engagementService.dismissAnchor('a1');
    assert.deepEqual(engagementService.getSavedPostIds(), ['p1']);
    assert.deepEqual(engagementService.getLikedPostIds(), ['p2']);
    assert.deepEqual(engagementService.getDismissedAnchorIds(), ['a1']);
  });

  it('reset() clears saved, liked, and dismissed state AND emits NOTHING (D-08)', () => {
    engagementService.savePost('p1');
    engagementService.likePost('p2');
    engagementService.dismissAnchor('a1');
    // Clear capture arrays so the assertions below only see post-reset events.
    dismissEvents.length = 0;
    engagementEvents.length = 0;
    exploredEvents.length = 0;
    engagementService.reset();
    assert.deepEqual(engagementService.getSavedPostIds(), []);
    assert.deepEqual(engagementService.getLikedPostIds(), []);
    assert.deepEqual(engagementService.getDismissedAnchorIds(), []);
    assert.equal(dismissEvents.length, 0, 'reset() must not emit ANCHOR_DISMISSED');
    assert.equal(engagementEvents.length, 0, 'reset() must not emit ENGAGEMENT_CHANGED');
    assert.equal(exploredEvents.length, 0, 'reset() must not emit CONCEPT_EXPLORED');
  });

  it('a freshly-reset store reports empty saved/liked/dismissed (no throw)', () => {
    // Phase 55-07: the prior variant seeded corrupt localStorage JSON. The store
    // no longer reads localStorage, so the equivalent guarantee is that a fresh
    // (reset) mirror reports empty arrays.
    engagementService.reset();
    assert.deepEqual(engagementService.getSavedPostIds(), []);
    assert.deepEqual(engagementService.getLikedPostIds(), []);
    assert.deepEqual(engagementService.getDismissedAnchorIds(), []);
  });

  it('canonical save and like APIs accept immutable post IDs only', () => {
    assert.equal(engagementService.savePost.length, 1);
    assert.equal(engagementService.likePost.length, 1);
  });

  it('dismissPost is idempotent and emits one engagement event', () => {
    engagementService.dismissPost('post-1');
    engagementService.dismissPost('post-1');
    assert.deepEqual(engagementService.getDismissedPostIds(), ['post-1']);
    assert.equal(engagementEvents.length, 1);
    assert.deepEqual(engagementEvents[0].payload, { kind: 'dismiss', id: 'post-1' });
  });

  it('persists engagement as ID-only metadata through the DB seam', async () => {
    engagementService.savePost('post-saved');
    engagementService.dismissPost('post-dismissed');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const rows = await dbQuery('SELECT * FROM engagement WHERE id = ?', ['engagement_state']);
    assert.equal(rows.length, 1);
    const stored = JSON.parse(rows[0].data);
    assert.deepEqual(stored.saved, ['post-saved']);
    assert.deepEqual(stored.dismissed, ['post-dismissed']);
    assert.equal(JSON.stringify(stored).includes('bodyMarkdown'), false);
  });

  it('post history persists only postId and viewedAt and groups metadata by day', async () => {
    await postHistoryService.recordPostViewed('post-viewed', '2026-07-11T12:30:00.000Z');
    const rows = await dbQuery('SELECT * FROM post_history WHERE id = ?', ['post-viewed']);
    assert.equal(rows.length, 1);
    assert.deepEqual(JSON.parse(rows[0].data), {
      postId: 'post-viewed',
      viewedAt: '2026-07-11T12:30:00.000Z',
    });
    assert.deepEqual(postHistoryService.getViewedPostIds(), ['post-viewed']);
    assert.equal(postHistoryService.getEntriesByDay().get('2026-07-11')?.[0].postId, 'post-viewed');
  });
});
