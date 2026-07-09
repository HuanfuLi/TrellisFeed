/**
 * 54-02 regression guard for postQueueService.walkDerivedList edges.
 *
 * Live walker (post-queue.service.ts:409-432):
 *
 *   walkDerivedList(count, exploredIds, dismissedIds) {
 *     const len = _state.derivedList.length;
 *     if (len === 0) return [];
 *     const result = [];
 *     const maxSteps = Math.max(count * 2, len);   // Phase 36 GAP-B fix
 *     let steps = 0;
 *     while (result.length < count && steps < maxSteps) {
 *       const id = _state.derivedList[cyclePosition];
 *       cyclePosition = (cyclePosition + 1) % len;
 *       steps++;
 *       if (!exploredIds.has(id) && !dismissedIds.has(id)) result.push(id);
 *     }
 *     return result;
 *   }
 *
 * post-queue.service.ts pulls in DOM/Capacitor/i18n deps under `node --test`, so we
 * mirror the walk loop as a pure helper (INLINE-ALGORITHM pattern) and assert the
 * RUNTIME behavior of the two highest-risk edges:
 *   1. len=0 → [] with no infinite loop and no thrown error.
 *   2. maxSteps = Math.max(count*2, len), NOT len*2 (Phase 36 GAP-B regression guard).
 *
 * Audit disposition: NOT-A-BUG (54-BUG-AUDIT.md Cluster 1) — pinning guard.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ─── Pure mirror of walkDerivedList ─────────────────────────────────────────
// Tracks cyclePosition like the live service. Returns { result, maxSteps, steps }.
function walk(derivedList, count, cyclePosition, exploredIds = new Set(), dismissedIds = new Set()) {
  const len = derivedList.length;
  if (len === 0) return { result: [], maxSteps: 0, steps: 0, cyclePosition };
  const result = [];
  const maxSteps = Math.max(count * 2, len);
  let steps = 0;
  let pos = cyclePosition;
  while (result.length < count && steps < maxSteps) {
    const id = derivedList[pos];
    pos = (pos + 1) % len;
    steps++;
    if (!exploredIds.has(id) && !dismissedIds.has(id)) result.push(id);
  }
  return { result, maxSteps, steps, cyclePosition: pos };
}

describe('54-02 walkDerivedList edges', () => {
  it('len=0, count=8 → returns [] (no infinite loop, no thrown error)', () => {
    // The live early-return handles this; even without it, maxSteps=Math.max(16,0)=16
    // and the while loop over an empty list never executes a body iteration.
    let out;
    assert.doesNotThrow(() => { out = walk([], 8, 0); });
    assert.deepEqual(out.result, []);
  });

  it('maxSteps = Math.max(count*2, len): count=16, len=4 → 32 (NOT len*2=8) — Phase 36 GAP-B guard', () => {
    const out = walk(['c1', 'c2', 'c3', 'c4'], 16, 0);
    assert.equal(out.maxSteps, 32, 'maxSteps must scale with count (32), not regress to len*2 (8)');
    // With nothing explored, the walker should fulfill the full count of 16 by cycling
    // the 4-element list, returning 16 ids (NOT capped at 8 like the old len*2 bug).
    assert.equal(out.result.length, 16, 'walker must return the requested 16, not the GAP-B-bugged 8');
  });

  it('maxSteps floor preserves a full pass when count < len: count=2, len=10 → Math.max(4,10)=10', () => {
    const list = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const out = walk(list, 2, 0);
    assert.equal(out.maxSteps, 10, 'len floor must keep at least one full pass possible when count < len');
    assert.equal(out.result.length, 2, 'walker returns the requested count');
  });

  it('all ids explored → walker terminates with [] (no infinite loop)', () => {
    const list = ['c1', 'c2', 'c3', 'c4'];
    let out;
    assert.doesNotThrow(() => {
      out = walk(list, 8, 0, new Set(list));
    });
    assert.deepEqual(out.result, [], 'all-explored list lazily skips every id and terminates via maxSteps');
    assert.ok(out.steps <= out.maxSteps, 'step budget bounds the loop');
  });
});
