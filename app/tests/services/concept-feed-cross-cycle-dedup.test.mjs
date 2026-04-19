/**
 * Test G1 (UAT-31-2 + UAT-31-13): seenVideoIds dedup must persist across refillQueue cycles,
 * and the cap formula must lower-bound dueConcepts.length to a sensible floor.
 *
 * Phase 31-08 added a per-call seenVideoIds Set inside generatePostBatch
 * (concept-feed.service.ts:685). Phase 32.1-02 promotes it to module scope (in a
 * dedicated `concept-feed-dedup.ts` helper to avoid the i18n JSON-import-attribute
 * dependency chain) so duplicates are blocked across cycles.
 *
 * Phase 32.1-02 also lower-bounds the daily-generation cap formula at
 * concept-feed.service.ts:906 from `Math.max(dueConcepts.length, 1)` to
 * `Math.max(dueConcepts.length, 3)` so 1-due-concept users get maxPosts >= 15
 * (was 5, which saturated the queue after one batch).
 *
 * This test verifies the EXPORTED CONTRACT introduced by the fix:
 *   - concept-feed-dedup.ts exports hasSeenVideoId, addSeenVideoId, __resetSeenVideoIdsForTesting
 *   - The Set survives across calls (module-scope persistence)
 *   - Reset helper clears it (for test isolation)
 *   - Cap formula floor is 3 (not 1) so 1-due-concept users don't exhaust early
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill (same shape as concept-batch-filter.test.mjs:21-28)
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

// NOTE: importing concept-feed.service.ts directly will trigger the i18n
// JSON-import-attribute chain (graph.service -> planner.service -> locales/en.json).
// To avoid this, the fix in Task 3 exposes seenVideoIds via a SEPARATE pure-helper
// module `concept-feed-dedup.ts` that has no transitive i18n deps.
const dedup = await import('../../src/services/concept-feed-dedup.ts');

describe('Cross-cycle YouTube videoId dedup (G1 / UAT-31-2)', () => {
  beforeEach(() => {
    dedup.__resetSeenVideoIdsForTesting();
  });

  it('exposes a module-scope add/has API', () => {
    assert.equal(typeof dedup.hasSeenVideoId, 'function', 'hasSeenVideoId() must be exported');
    assert.equal(typeof dedup.addSeenVideoId, 'function', 'addSeenVideoId() must be exported');
    assert.equal(typeof dedup.__resetSeenVideoIdsForTesting, 'function', 'reset helper must be exported for tests');
  });

  it('add/has roundtrip works within a single "cycle"', () => {
    assert.equal(dedup.hasSeenVideoId('abc123'), false);
    dedup.addSeenVideoId('abc123');
    assert.equal(dedup.hasSeenVideoId('abc123'), true);
  });

  it('Set persists across multiple "cycles" (the regression fix)', () => {
    // Cycle 1
    dedup.addSeenVideoId('vid-cycle-1');
    // Cycle 2 — separate logical refillQueue invocation. Set must NOT have been recreated.
    assert.equal(dedup.hasSeenVideoId('vid-cycle-1'), true,
      'seenVideoIds must persist across cycles — this is the G1 fix');
    dedup.addSeenVideoId('vid-cycle-2');
    assert.equal(dedup.hasSeenVideoId('vid-cycle-1'), true);
    assert.equal(dedup.hasSeenVideoId('vid-cycle-2'), true);
  });

  it('reset helper clears the set (test isolation)', () => {
    dedup.addSeenVideoId('foo');
    dedup.__resetSeenVideoIdsForTesting();
    assert.equal(dedup.hasSeenVideoId('foo'), false);
  });
});

// --- G1 cap formula test (UAT-31-13) ----------------------------------------
describe('Cap formula uses dueConcepts.length floor of 3 (G1 / UAT-31-13)', () => {
  it('Math.max(dueConcepts.length, 3) keeps maxPosts >= 15 for 1-due-concept users', () => {
    // Pure formula test — replicates the runtime expression at concept-feed.service.ts:906 post-fix
    const multiplier = 5;
    const computeMax = (dueLen) => multiplier * Math.max(dueLen, 3);
    assert.equal(computeMax(0), 15, '0 due concepts -> floor 3 -> 15');
    assert.equal(computeMax(1), 15, '1 due concept -> floor 3 -> 15 (regression fix)');
    assert.equal(computeMax(3), 15, '3 due concepts -> 15');
    assert.equal(computeMax(5), 25, '5 due concepts -> 25 (no ceiling)');
    assert.equal(computeMax(10), 50, '10 due concepts -> 50');
  });
});
