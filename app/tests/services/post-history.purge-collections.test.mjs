// Phase 50 Plan 50-02 — Wave 0 RED scaffold for post-history purge + collection pinning.
//
// Covers RETRIEVE-02 / CONTEXT D-09 retention semantics: a post added to a
// collection MUST survive purgeExpired() even if its generatedAt is older than
// the retentionDays cutoff. Turned GREEN by plan 50-05 (which wires
// post-history.purgeExpired through engagementService.getPinnedIds).
//
// post-history.service.ts EXISTS today. This file adds a NEW invariant
// (collection-pinned survival) that the current purgeExpired does not honor.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const TURNED_GREEN_BY = 'plan 50-05 (post-history.purgeExpired collection-aware retention)';

describe('postHistoryService.purgeExpired collection pinning — Phase 50 Wave 0 RED scaffold', () => {
  it('a post added to a collection survives purgeExpired() when older than retentionDays', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: with retentionDays=30, a post whose generatedAt is 45 days ago must NOT be purged if collectionService has it as a member (D-09).`);
  });

  it('a post NOT in any collection (or saved/liked) is purged when older than retentionDays', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: with retentionDays=30, an unpinned post 45 days old IS purged (regression-guard so collection pinning does not accidentally retain everything).`);
  });

  it('purgeExpired consults engagementService.getPinnedIds() once (no per-post call)', () => {
    assert.fail(`Wave 0 scaffold — implemented in ${TURNED_GREEN_BY}. Behavior: source-reading or call-count assertion that purgeExpired calls getPinnedIds() once per invocation, not once per candidate post (perf guard).`);
  });
});
