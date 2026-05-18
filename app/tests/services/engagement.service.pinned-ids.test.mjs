// Phase 50 Plan 50-02 — Wave 0 RED scaffold for engagementService.getPinnedIds().
//
// Covers RETRIEVE-02 / CONTEXT D-09 (collection membership pins posts against
// post-history purgeExpired). The getPinnedIds() helper returns the UNION
// (saved ∪ liked ∪ collectionService.getAllMemberPostIds()) so that
// post-history.service can skip-purge any post that belongs to ANY of those
// buckets. Turned GREEN by plan 50-05.
//
// engagementService EXISTS today (Phase 39+) — this file adds a NEW behavior
// for it. Until 50-05 adds getPinnedIds, every it() must fail.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const TURNED_GREEN_BY = 'plan 50-05 (engagementService.getPinnedIds + collection-aware purge)';

describe('engagementService.getPinnedIds — Phase 50 Wave 0 RED scaffold', () => {
  it('getPinnedIds returns union of saved ∪ liked ∪ collection memberships (D-09)', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: with saved=[p1,p2], liked=[p2,p3], collection-member=[p3,p4], getPinnedIds() === Set(p1,p2,p3,p4). Used by post-history.purgeExpired to retain pinned posts.`);
  });

  it('getPinnedIds() is empty when nothing is saved/liked AND no collection membership exists', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: with no engagement and no collections, getPinnedIds() is empty.`);
  });

  it('getPinnedIds() reflects live state — does not cache stale values across mutations', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: getPinnedIds() called BEFORE collectionService.addPost vs AFTER must reflect both states.`);
  });
});
