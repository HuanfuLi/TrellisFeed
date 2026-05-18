// Phase 50 Plan 50-05 — engagementService.getPinnedIds() behavioral tests.
//
// Covers RETRIEVE-02 / CONTEXT D-09: getPinnedIds() returns the union of
// saved ∪ liked ∪ collectionService.getAllMemberPostIds(). This pin set is
// consumed by postHistoryService.purgeExpired() so collection-member posts
// survive the 7-day rolling history purge.
//
// Turned GREEN by plan 50-05 (this file replaces the Wave 0 RED scaffold).

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill — matches engagement.service.test.mjs (lines 13-19).
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { engagementService } = await import('../../src/services/engagement.service.ts');
const { collectionService } = await import('../../src/services/collection.service.ts');

describe('engagementService.getPinnedIds — D-09 union with collection members', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns Set([p1]) when only collectionService has p1 as a member (D-09)', () => {
    const created = collectionService.createCollection('For thesis');
    assert.equal(created.success, true);
    collectionService.addPost(created.data.id, 'p1');

    const pinned = engagementService.getPinnedIds();
    assert.ok(pinned instanceof Set);
    assert.equal(pinned.has('p1'), true);
    assert.equal(pinned.size, 1);
  });

  it('returns the union of saved=[p1], liked=[p2], collection-member=[p3] → Set(p1,p2,p3)', () => {
    engagementService.savePost('p1');
    engagementService.likePost('p2');
    const created = collectionService.createCollection('Inspiration');
    collectionService.addPost(created.data.id, 'p3');

    const pinned = engagementService.getPinnedIds();
    assert.equal(pinned.size, 3);
    assert.equal(pinned.has('p1'), true);
    assert.equal(pinned.has('p2'), true);
    assert.equal(pinned.has('p3'), true);
  });

  it('de-duplicates when the same id appears in saved AND a collection (Set semantics)', () => {
    engagementService.savePost('p1');
    const created = collectionService.createCollection('Overlap');
    collectionService.addPost(created.data.id, 'p1');

    const pinned = engagementService.getPinnedIds();
    assert.equal(pinned.size, 1, 'Set must de-duplicate p1 across saved + collection');
    assert.equal(pinned.has('p1'), true);
  });

  it('returns saved ∪ liked union when NO collections exist (zero regression)', () => {
    engagementService.savePost('p1');
    engagementService.likePost('p2');

    const pinned = engagementService.getPinnedIds();
    assert.equal(pinned.size, 2);
    assert.equal(pinned.has('p1'), true);
    assert.equal(pinned.has('p2'), true);
  });

  it('returns an empty Set when no engagement and no collection membership exist', () => {
    const pinned = engagementService.getPinnedIds();
    assert.equal(pinned.size, 0);
  });

  it('does NOT include dismissed anchor ids in the pin set (saved/liked union only)', () => {
    engagementService.savePost('p1');
    engagementService.dismissAnchor('a1');

    const pinned = engagementService.getPinnedIds();
    assert.equal(pinned.has('p1'), true);
    assert.equal(pinned.has('a1'), false);
    assert.equal(pinned.size, 1);
  });

  it('unions across multiple collections (Set merges all member lists)', () => {
    const a = collectionService.createCollection('Alpha');
    const b = collectionService.createCollection('Beta');
    collectionService.addPost(a.data.id, 'p1');
    collectionService.addPost(a.data.id, 'p2');
    collectionService.addPost(b.data.id, 'p2'); // duplicated across collections
    collectionService.addPost(b.data.id, 'p3');

    const pinned = engagementService.getPinnedIds();
    assert.equal(pinned.size, 3);
    assert.equal(pinned.has('p1'), true);
    assert.equal(pinned.has('p2'), true);
    assert.equal(pinned.has('p3'), true);
  });

  it('reflects live state — pin set changes when a collection adds a post mid-session', () => {
    const created = collectionService.createCollection('Live');
    const before = engagementService.getPinnedIds();
    assert.equal(before.size, 0);

    collectionService.addPost(created.data.id, 'p1');
    const after = engagementService.getPinnedIds();
    assert.equal(after.size, 1);
    assert.equal(after.has('p1'), true);
  });

  it('reflects removal — when a post is removed from a collection AND not saved/liked, it drops from the pin set', () => {
    const created = collectionService.createCollection('Removal');
    collectionService.addPost(created.data.id, 'p1');
    assert.equal(engagementService.getPinnedIds().has('p1'), true);

    collectionService.removePost(created.data.id, 'p1');
    const pinned = engagementService.getPinnedIds();
    assert.equal(pinned.has('p1'), false);
    assert.equal(pinned.size, 0);
  });
});
