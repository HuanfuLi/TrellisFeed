/**
 * 54-02 regression guard: a first-time user (questions.length === 0, empty feed)
 * must NOT see the generationError state.
 *
 * Original shape (pre-fix), in the getDailyPosts .then:
 *
 *   if (posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current) {
 *     setGenerationError(true);
 *   }
 *
 * That gate protected first-time users but still mis-fired for everyone else: an
 * empty `posts` is the NORMAL cold-start result — today's queue is empty and
 * refillQueue is still running in the background — so a healthy user with a valid
 * API key saw "Couldn't generate posts — check your API keys" immediately, and it
 * never cleared, because /home is always-mounted and nothing signalled that the
 * refill had landed.
 *
 * New contract:
 *   - The success branch NEVER sets generationError. An empty result means
 *     "still refilling", so it stays in the loading state.
 *   - FEED_REFILL_COMPLETED (emitted once per refill cycle that actually runs)
 *     resolves it: `error` → generationError; `added > 0` → refresh; otherwise
 *     the normal empty state.
 *
 * The first-time-user invariant survives: with questions.length === 0,
 * getDailyPosts returns STARTER_POSTS (non-empty), and a refill cycle for zero
 * concepts reports attempted === 0, which is explicitly not an error.
 *
 * HomeScreen.tsx pulls in the i18n chain (locales/en.json) which blocks importing
 * the screen directly under `node --test`, so this uses the source-reading
 * region-slice pattern.
 *
 * Audit disposition: NOT-A-BUG (54-BUG-AUDIT.md Cluster 2) — pinning guard.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_PATH, 'utf-8');
const FEED_PATH = resolve(__dirname, '../../src/services/concept-feed.service.ts');
const feedSource = readFileSync(FEED_PATH, 'utf-8');

/**
 * Slice the main-effect getDailyPosts success branch: from the awaiting-refill
 * comment anchor to the `}).catch((err) => {` that closes the .then. Isolates it
 * from the catch-path gate and from the other getDailyPosts call sites.
 */
function getSuccessBranchSlice() {
  const startMarker = 'An empty `posts` here is NOT an error.';
  const endMarker = '}).catch((err) => {';
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker, startIdx);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    `Could not locate the main-effect success branch. startIdx=${startIdx}, endIdx=${endIdx}. HomeScreen.tsx structure may have changed; update the markers.`,
  );
  return source.slice(startIdx, endIdx);
}

/** Drop `//` comments so prose describing the old code can't satisfy a code assertion. */
function stripLineComments(text) {
  return text.replace(/^\s*\/\/.*$/gm, '');
}

function getRefillSubscriberSlice() {
  const startIdx = source.indexOf("eventBus.subscribe('FEED_REFILL_COMPLETED'");
  assert.ok(startIdx !== -1, 'HomeScreen.tsx must subscribe to FEED_REFILL_COMPLETED');
  const endIdx = source.indexOf('return () => {', startIdx);
  assert.ok(endIdx > startIdx, 'subscriber must be followed by the effect cleanup');
  return source.slice(startIdx, endIdx);
}

describe('54-02 HomeScreen empty-questions does not flag generationError', () => {
  it('the success branch never flags generationError — an empty feed means "still refilling"', () => {
    const slice = stripLineComments(getSuccessBranchSlice());
    assert.doesNotMatch(
      slice,
      /setGenerationError\(true\)/,
      'An empty getDailyPosts result is the normal cold-start state, not an error. ' +
        'Flagging it here is what made a healthy API key render "check your API keys".',
    );
  });

  it('an empty result for a no-questions user does not pin the spinner', () => {
    const slice = getSuccessBranchSlice();
    // questions.length > 0 keeps a first-time user (who gets STARTER_POSTS, and whose
    // refill has nothing to generate) from waiting on a FEED_REFILL_COMPLETED that
    // carries added === 0.
    assert.match(
      slice,
      /posts\.length\s*===\s*0\s*&&\s*questions\.length\s*>\s*0\s*&&\s*!warmStartHadPostsRef\.current/,
      'The awaiting-refill condition must still require questions.length > 0 and no warm-start content.',
    );
  });

  it('only a real refill failure flags generationError', () => {
    const slice = getRefillSubscriberSlice();
    // setGenerationError(true) must sit inside the `if (error)` branch.
    assert.match(
      slice,
      /if\s*\(\s*error\s*\)[\s\S]*?setGenerationError\(true\)/,
      'generationError must be reachable only when the refill cycle reported an error.',
    );
    // added === 0 with no error is the normal empty state, not an error.
    assert.match(
      slice,
      /if\s*\(\s*added\s*>\s*0\s*\)/,
      'A refresh must only be pulled through when the cycle actually added posts.',
    );
  });

  it('the subscriber cannot loop: it no-ops once the feed has posts', () => {
    const slice = getRefillSubscriberSlice();
    assert.match(
      slice,
      /dailyPostsRef\.current\.length\s*>\s*0\)\s*return/,
      'Refreshing a populated feed would call getDailyPosts -> refillQueue -> ' +
        'FEED_REFILL_COMPLETED again, an infinite loop.',
    );
  });
});

describe('refillQueue emits exactly one completion signal per cycle', () => {
  function getWrapperSlice() {
    const start = feedSource.indexOf('return _refillMutex.run(async () => {');
    assert.ok(start !== -1, 'refillQueue must run its body through the mutex');
    const end = feedSource.indexOf('async function runRefillCycle(', start);
    assert.ok(end > start, 'runRefillCycle must follow the mutex wrapper');
    return feedSource.slice(start, end);
  }

  it('emits FEED_REFILL_COMPLETED from inside the mutex body', () => {
    const wrapper = getWrapperSlice();
    // Inside the mutex body: concurrent callers await the SAME promise, so emitting
    // outside it would fire once per caller.
    assert.match(wrapper, /eventBus\.emit\(\{[\s\S]*?FEED_REFILL_COMPLETED/, 'must emit the completion event');
    // `finally` so the cycle's "nothing to do" early returns also signal completion —
    // otherwise HomeScreen waits on a spinner forever.
    assert.match(wrapper, /\}\s*finally\s*\{/, 'emit must live in a finally block');
  });

  it('a cycle that attempted work but generated nothing is reported as an error', () => {
    const wrapper = getWrapperSlice();
    // generatePostBatch swallows per-branch LLM failures, so zero posts from a
    // non-empty concept batch is the only signal a broken key produces.
    assert.match(
      wrapper,
      /attempted\s*>\s*0\s*&&\s*generated\s*===\s*0/,
      'attempted > 0 with generated === 0 must set refillError, or a broken API key ' +
        'renders as "all caught up" instead of an error.',
    );
  });

  it('the cycle distinguishes "nothing to do" from "everything failed"', () => {
    // Both early returns report attempted: 0 — normal empty states, never errors.
    const start = feedSource.indexOf('async function runRefillCycle(');
    const body = feedSource.slice(start, start + 14000);
    const emptyReturns = [...body.matchAll(/return\s*\{\s*attempted:\s*0,\s*generated:\s*0\s*\}/g)];
    assert.equal(
      emptyReturns.length,
      2,
      'the daily-cap and empty-concept-batch early returns must both report attempted: 0',
    );
  });
});
