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
const { eventBus } = await import('../../src/lib/event-bus.ts');

const STORAGE_KEY = 'trellis_engagement_v1';

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
  beforeEach(() => {
    localStorage.clear();
    captureAll();
  });

  it('savePost adds postId to saved array and persists to trellis_engagement_v1', () => {
    engagementService.savePost('p1');
    assert.deepEqual(engagementService.getSavedPostIds(), ['p1']);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert.deepEqual(raw.saved, ['p1']);
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

  it('getSavedPosts resolves through postHistoryService and silently drops missing posts', () => {
    // Pre-seed post-history so 'p1' resolves but 'p-missing' does not.
    localStorage.setItem(
      'trellis_post_history',
      JSON.stringify([{ id: 'p1', generatedAt: Date.now(), title: 'one' }]),
    );
    engagementService.savePost('p1');
    engagementService.savePost('p-missing');
    assert.equal(engagementService.getSavedPostIds().length, 2);
    const posts = engagementService.getSavedPosts();
    assert.equal(posts.length, 1, 'missing post should be silently dropped (D-04 graceful degradation)');
    assert.equal(posts[0].id, 'p1');
  });

  it('state persists across same-day reload (round-trip via raw JSON)', () => {
    engagementService.savePost('p1');
    engagementService.likePost('p2');
    engagementService.dismissAnchor('a1');
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert.deepEqual(raw, { saved: ['p1'], liked: ['p2'], dismissed: ['a1'] });
  });

  it('reset() clears all three collections AND emits NOTHING (D-08)', () => {
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

  it('corrupted localStorage value loads as freshState (no throw)', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    assert.deepEqual(engagementService.getSavedPostIds(), []);
    assert.deepEqual(engagementService.getLikedPostIds(), []);
    assert.deepEqual(engagementService.getDismissedAnchorIds(), []);
  });

  // Phase 50 UAT G14: optional snapshot parameter persists stub posts to
  // postHistoryService at save/like time so unopened posts surface on /saved
  // and /saved → Liked. Without this, resolvePostsByIds silently drops the
  // id because postHistoryService.getPosts() is the only resolution path.
  it('G14: savePost with snapshot persists the post to postHistoryService and getSavedPosts resolves it', () => {
    const stub = {
      id: 'stub-1',
      generatedAt: Date.now(),
      title: 'Unopened stub',
      bodyMarkdown: '', // deliberate — stub posts have empty body before on-open generation
    };
    engagementService.savePost('stub-1', stub);
    const posts = engagementService.getSavedPosts();
    assert.equal(posts.length, 1, 'getSavedPosts must surface the stub even before it has a body');
    assert.equal(posts[0].id, 'stub-1');
    assert.equal(posts[0].title, 'Unopened stub');
  });

  it('G14: likePost with snapshot persists the post to postHistoryService and getLikedPosts resolves it', () => {
    const stub = {
      id: 'stub-2',
      generatedAt: Date.now(),
      title: 'Unopened liked stub',
      bodyMarkdown: '',
    };
    engagementService.likePost('stub-2', stub);
    const posts = engagementService.getLikedPosts();
    assert.equal(posts.length, 1, 'getLikedPosts must surface the stub even before it has a body');
    assert.equal(posts[0].id, 'stub-2');
  });

  it('G14: savePost WITHOUT snapshot leaves history unchanged (back-compat with non-host callers)', () => {
    // No prior history seed → no post resolves. The id is still saved.
    engagementService.savePost('p-no-snapshot');
    assert.deepEqual(engagementService.getSavedPostIds(), ['p-no-snapshot']);
    // History remains untouched.
    const raw = localStorage.getItem('trellis_post_history');
    assert.equal(raw, null, 'savePost without snapshot must not create a history entry');
    // getSavedPosts silently drops the unresolved id (T-50-ORPHAN / D-04).
    assert.equal(engagementService.getSavedPosts().length, 0);
  });

  it('G14: savePost with snapshot is idempotent — second call does not duplicate history entry', () => {
    const stub = { id: 'stub-3', generatedAt: Date.now(), title: 'once', bodyMarkdown: '' };
    engagementService.savePost('stub-3', stub);
    // Second call with a DIFFERENT title — postHistoryService.addPost dedups
    // by id, so the original snapshot survives. savePost itself is also
    // idempotent (already covered above) so no double-event either.
    engagementService.savePost('stub-3', { ...stub, title: 'twice' });
    const posts = engagementService.getSavedPosts();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, 'once', 'postHistoryService.addPost dedups by id; original snapshot wins');
    const saveEvents = engagementEvents.filter(e => e.payload.kind === 'save');
    assert.equal(saveEvents.length, 1, 'savePost idempotency still holds — second call must not re-emit');
  });
});
