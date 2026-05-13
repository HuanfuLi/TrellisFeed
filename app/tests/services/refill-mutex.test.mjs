import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import fs from 'node:fs';

// Phase 36-12 — Concurrency tests for the Promise-based mutex on refillQueue.
//
// The previous boolean mutex (`_queueRefillRunning`) made `await refillQueue()`
// callers in generateMorePosts silently no-op when a refill was already in
// flight, leaving the dequeue against an unchanged empty queue. Plan 36-12
// replaces it with a Promise-based mutex so concurrent callers AWAIT the same
// Promise instead of bailing.
//
// ─── Why the leaf-module approach ─────────────────────────────────────────
//
// The mutex itself lives in `refill-mutex.ts` (zero transitive deps on the
// i18n chain) so this test can import + exercise the mutex semantics
// directly. Importing concept-feed.service.ts under `node --test` crashes
// via the i18n chain (locales/index.ts → en.json → ERR_IMPORT_ATTRIBUTE_MISSING)
// — see CLAUDE.md's testing rule "Phase 27 locale tests avoid the JSON-import-
// attribute failure chain by importing i18next directly; follow the same
// pattern for any new pure-logic helpers." (refill-queue-integration.test.mjs
// uses the same workaround for spreadByConcept/spreadByStyle.)
//
// Tests 1–3 exercise the mutex semantics behaviorally via the leaf module.
// Test 4 verifies the WIRING in concept-feed.service.ts (refillQueue uses
// _refillMutex.run + generateMorePosts retains the `await refillQueue(...)`
// retry pattern) via source-reading assertions — the canonical pattern for
// asserting code shape in this codebase (see ChatInput.flex-shrink.test.mjs,
// HomeScreen.warm-start-guard.test.mjs).

const { createPromiseMutex } = await import('../../src/services/refill-mutex.ts');

describe('createPromiseMutex (Phase 36-12)', () => {
  // Test 1 — three concurrent callers collapse to one body execution.
  // The boolean-mutex predecessor produced 1 body execution AND 2 silent
  // no-op resolutions; the Promise mutex preserves the single-body
  // invariant AND lets all three callers await the same execution.
  it('single body executes when 3 callers race', async () => {
    const mutex = createPromiseMutex();
    let bodyCallCount = 0;
    // Body that resolves on a microtask delay so concurrent callers
    // genuinely race (not just synchronous chain).
    const fn = async () => {
      bodyCallCount++;
      await new Promise((resolve) => setImmediate(resolve));
    };

    await Promise.all([mutex.run(fn), mutex.run(fn), mutex.run(fn)]);

    assert.equal(
      bodyCallCount,
      1,
      `body must execute exactly once for 3 races; got ${bodyCallCount}`,
    );
  });

  // Test 2 — all 3 awaiters share the SAME in-flight Promise reference and
  // resolve at the same point. Reference equality proves the Promise was
  // shared (the boolean predecessor returned `undefined` to bailing
  // callers; this test enforces shared-Promise semantics structurally).
  it('all 3 awaiters share the same Promise and resolve together', async () => {
    const mutex = createPromiseMutex();
    let bodyCallCount = 0;
    const fn = async () => {
      bodyCallCount++;
      await new Promise((resolve) => setImmediate(resolve));
    };

    const p1 = mutex.run(fn);
    const p2 = mutex.run(fn);
    const p3 = mutex.run(fn);

    assert.equal(p2, p1, 'concurrent caller must receive the in-flight Promise');
    assert.equal(p3, p1, 'concurrent caller must receive the in-flight Promise');

    const results = await Promise.all([p1, p2, p3]);
    assert.equal(results.length, 3, 'all three awaiters must resolve');
    assert.equal(bodyCallCount, 1, 'still single body execution');

    // After resolution the in-flight reference should be cleared.
    assert.equal(mutex.getInFlight(), null, 'mutex must clear after body completes');
  });

  // Test 3 — failed body clears the mutex so the next caller fires a fresh
  // body. The boolean predecessor's `_queueRefillRunning = false;` lived
  // inside refillQueue's outer finally, so it cleared on error too — but
  // the silent-bail behavior prevented other races from observing the
  // failure. The Promise mutex's finally must mirror this hygiene so
  // `_refillInFlight = null` on rejection.
  it('failed body clears mutex so next caller fires fresh body', async () => {
    const mutex = createPromiseMutex();
    let bodyCallCount = 0;
    const failingFn = async () => {
      bodyCallCount++;
      throw new Error('forced failure');
    };
    const okFn = async () => {
      bodyCallCount++;
      await new Promise((resolve) => setImmediate(resolve));
    };

    // First call — body throws; the Promise should reject AND the finally
    // must clear the in-flight reference.
    let firstThrew = false;
    try {
      await mutex.run(failingFn);
    } catch (e) {
      firstThrew = true;
      assert.equal(e.message, 'forced failure');
    }
    assert.ok(firstThrew, 'rejection must propagate to the awaiter');
    assert.equal(bodyCallCount, 1, 'first call invoked body once');
    assert.equal(mutex.getInFlight(), null, 'mutex must clear on body error');

    // Second call — should fire a fresh body (mutex was cleared in finally).
    await mutex.run(okFn);
    assert.equal(bodyCallCount, 2, 'second call must invoke a fresh body, not bail');
  });
});

// Test 4 — source-reading verification that concept-feed.service.ts wires
// the mutex correctly: refillQueue uses _refillMutex.run() + generateMorePosts
// retains the `await refillQueue(...)` retry pattern. This is the wiring
// half of the mutex correctness story; tests 1–3 covered the mutex semantics
// half. Source-reading is the codebase-canonical pattern for these assertions
// (see ChatInput.flex-shrink.test.mjs, HomeScreen.warm-start-guard.test.mjs,
// PostDetailScreen.video-detector.test.mjs).
describe('refillQueue + generateMorePosts wiring (Phase 36-12)', () => {
  let source;

  beforeEach(() => {
    source = fs.readFileSync(
      new URL('../../src/services/concept-feed.service.ts', import.meta.url),
      'utf-8',
    );
  });

  it('imports createPromiseMutex from the leaf module', () => {
    assert.match(
      source,
      /import\s*\{\s*createPromiseMutex\s*\}\s*from\s*['"]\.\/refill-mutex(?:\.ts)?['"]/,
      'concept-feed.service.ts must import createPromiseMutex from refill-mutex.ts',
    );
  });

  it('declares _refillMutex via createPromiseMutex()', () => {
    assert.match(
      source,
      /const\s+_refillMutex\s*=\s*createPromiseMutex\(\)/,
      'concept-feed.service.ts must instantiate the mutex at module scope',
    );
  });

  it('refillQueue uses _refillMutex.run(async () => { ... })', () => {
    // Match `_refillMutex.run(async () => {` as a single token; the body
    // is multi-line so we don't try to match it exhaustively.
    assert.match(
      source,
      /_refillMutex\.run\s*\(\s*async\s*\(\s*\)\s*=>\s*\{/,
      'refillQueue must wrap its body in _refillMutex.run(async () => { ... })',
    );
  });

  it('refillQueue keeps the cheap pre-check: needsRefill() short-circuits before mutex', () => {
    // The body extracted into the mutex body is preceded by an early-return
    // when the queue isn't actually low. This avoids spinning up the mutex
    // when no work is needed.
    assert.match(
      source,
      /if\s*\(\s*!postQueueService\.needsRefill\(\)\s*\)\s*return\s*;/,
      'refillQueue must keep the !needsRefill() early-return',
    );
  });

  it('generateMorePosts retains the `await refillQueue(questions)` retry pattern', () => {
    // Anchor the search to the generateMorePosts function. The await is the
    // critical bit — under the boolean mutex, the awaited Promise resolved
    // immediately to undefined, leaving the subsequent dequeue() against an
    // empty queue. The Promise mutex makes this await actually meaningful.
    const fnStart = source.indexOf('async generateMorePosts(');
    assert.ok(fnStart > -1, 'generateMorePosts must exist on conceptFeedService');
    // Slice ~3000 chars after the function start to capture the retry block.
    const fnRegion = source.slice(fnStart, fnStart + 3000);
    assert.match(
      fnRegion,
      /await\s+refillQueue\s*\(\s*questions\s*\)/,
      'generateMorePosts must `await refillQueue(questions)` inside the retry block',
    );
    assert.match(
      fnRegion,
      /needsRefill\(\)/,
      'generateMorePosts must guard the await with a needsRefill() check',
    );
  });

  it('does NOT reintroduce the legacy boolean mutex name', () => {
    // Negative regression: ensure the rename completed cleanly. Any leftover
    // _queueRefillRunning references would suggest the refactor was partial.
    assert.doesNotMatch(
      source,
      /_queueRefillRunning/,
      'concept-feed.service.ts must not reference the legacy _queueRefillRunning name',
    );
  });
});
