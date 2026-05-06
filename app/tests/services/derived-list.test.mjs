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

const STORAGE_KEY = 'echolearn_post_queue';
const { postQueueService } = await import('../../src/services/post-queue.service.ts');

describe('derived list (GAP-1 + GAP-2)', () => {
  beforeEach(() => {
    localStorage.clear();
    postQueueService.loadQueue();
  });

  // Test 1 — append-only across two calls
  it('appendToDerivedList is append-only across two calls', () => {
    postQueueService.appendToDerivedList(['a', 'b']);
    postQueueService.appendToDerivedList(['c']);
    assert.deepEqual(postQueueService.getDerivedList(), ['a', 'b', 'c']);
  });

  // Test 2 — dedup on append
  it('appendToDerivedList dedups by conceptId equality', () => {
    postQueueService.appendToDerivedList(['a', 'b']);
    postQueueService.appendToDerivedList(['a', 'c']);
    assert.deepEqual(postQueueService.getDerivedList(), ['a', 'b', 'c']);
  });

  // Test 3 — persistence across loadQueue (simulated page reload)
  it('derivedList persists across loadQueue', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c']);
    postQueueService.loadQueue();
    assert.deepEqual(postQueueService.getDerivedList(), ['a', 'b', 'c']);
  });

  // Test 4 — resetForNewDay clears derivedList and cyclePosition
  it('resetForNewDay clears derivedList and cyclePosition', () => {
    postQueueService.appendToDerivedList(['a', 'b']);
    // walk a step so cyclePosition advances
    postQueueService.walkDerivedList(1, new Set());
    postQueueService.resetForNewDay();
    assert.deepEqual(postQueueService.getDerivedList(), []);
    assert.equal(postQueueService.getCyclePosition(), 0);
  });

  // Test 5 — migration: existing localStorage without new fields still loads
  it('loadQueue defensively defaults missing derivedList + cyclePosition', () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        date: today,
        posts: [],
        cycleNumber: 3,
        totalGenerated: 0,
        totalServed: 0,
        // intentionally NO derivedList, NO cyclePosition
      }),
    );
    postQueueService.loadQueue();
    assert.deepEqual(postQueueService.getDerivedList(), []);
    assert.equal(postQueueService.getCyclePosition(), 0);
  });

  // Test 6 — walker advances cyclePosition by `count`
  it('walkDerivedList(4, emptySet) advances cyclePosition by 4', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c', 'd', 'e', 'f']);
    const out = postQueueService.walkDerivedList(4, new Set());
    assert.deepEqual(out, ['a', 'b', 'c', 'd']);
    assert.equal(postQueueService.getCyclePosition(), 4);
  });

  // Test 7 — walker wraps to 0 on overflow
  it('walkDerivedList wraps to position 0 after reaching length', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c']);
    const first = postQueueService.walkDerivedList(2, new Set());
    assert.deepEqual(first, ['a', 'b']);
    assert.equal(postQueueService.getCyclePosition(), 2);
    const second = postQueueService.walkDerivedList(2, new Set());
    assert.deepEqual(second, ['c', 'a']);
    assert.equal(postQueueService.getCyclePosition(), 1);
  });

  // Test 8 — walker lazily skips explored ids
  it('walkDerivedList lazily skips explored ids', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c', 'd']);
    const out = postQueueService.walkDerivedList(3, new Set(['b']));
    assert.deepEqual(out, ['a', 'c', 'd']);
  });

  // Test 9 — walker returns empty when all explored, no infinite loop
  it('walkDerivedList returns [] when every entry is explored', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c']);
    const out = postQueueService.walkDerivedList(4, new Set(['a', 'b', 'c']));
    assert.deepEqual(out, []);
  });

  // Test 10 — REGRESSION: importance weighting preserved by upstream caller
  // (Wave 2's buildConceptBatch passes already-weighted IDs. appendToDerivedList
  // dedups so subsequent calls don't double-weight. This test guards the dedup-on-
  // append contract. See RESEARCH § Pitfall 4.)
  it('appendToDerivedList preserves first-call multiplicity by deduping subsequent calls', () => {
    // Wave 2 caller: anchor "a" is important → 8 entries; "b" is normal → 4 entries.
    // First append carries the weighting:
    postQueueService.appendToDerivedList(['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'b', 'b', 'b', 'b']);
    // Second append (next refill, same anchors due) — dedup means new identical IDs are skipped:
    postQueueService.appendToDerivedList(['a', 'b']);
    const list = postQueueService.getDerivedList();
    // First-call weighting survives: a still appears 8 times, b 4 times.
    assert.equal(list.filter(x => x === 'a').length, 8);
    assert.equal(list.filter(x => x === 'b').length, 4);
  });

  // Test 11 — Phase 36 GAP-B regression: walker honors `count` when count > len * 2
  // Pre-fix: walkDerivedList(16, emptySet) on a 4-entry list returned only 8 entries
  // because maxSteps was hard-capped at len * 2 = 8. assignStylesStratified then
  // operated on N=8 (text-art floor-pinned at 50%) instead of N=16 (text-art = 56%).
  // See .planning/debug/style-mix-imbalance.md for the math walkthrough.
  it('walkDerivedList(16, emptySet) on 4-entry list returns 16 entries (4 wraps)', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c', 'd']);
    const out = postQueueService.walkDerivedList(16, new Set());
    assert.equal(out.length, 16, 'walker must return the requested count, not be capped at len * 2');
    // Contents are the input list cycled 4 times — exact ordering reflects 4 full passes
    assert.deepEqual(out, ['a','b','c','d','a','b','c','d','a','b','c','d','a','b','c','d']);
    // cyclePosition wraps back to 0 after 16 steps (16 mod 4 = 0)
    assert.equal(postQueueService.getCyclePosition(), 0, 'cyclePosition wraps to 0 after 16 steps on a 4-entry list');
  });

  // Test 12 — Phase 36 GAP-B regression: explored skips do not break count fulfillment
  // when count requires multiple wraps. Pre-fix: with len=4 and one explored id,
  // maxSteps=8 = exactly len*2, so the walker would terminate at 6 returns (8 steps
  // - 2 skips of 'a'). Post-fix: maxSteps = max(16, 4) = 16, so the walker can do
  // up to 16 steps, but it terminates EARLY when result.length === count = 8.
  // Wait — re-checking: with count=8 and 'a' explored on a 4-entry list, after
  // 12 steps (3 full loops, skipping 'a' 3 times), result has 9 entries — already
  // exceeded count=8 at step 11 (3 'b'+3 'c'+3 'd' = 9, but result.length<count
  // breaks out at 8). Final result = 8 entries, all non-'a'.
  it('walkDerivedList(8, exploredSet) advances past skipped ids while honoring count', () => {
    postQueueService.appendToDerivedList(['a', 'b', 'c', 'd']);
    const out = postQueueService.walkDerivedList(8, new Set(['a']));
    assert.equal(out.length, 8, 'walker must return count=8 entries, skipping `a` lazily');
    assert.ok(out.every(id => id !== 'a'), 'no explored id should appear in the output');
    // Sanity: contents are b/c/d cycled — first wrap [b,c,d], second wrap [b,c,d], third partial [b,c]
    assert.deepEqual(out, ['b','c','d','b','c','d','b','c']);
  });
});
