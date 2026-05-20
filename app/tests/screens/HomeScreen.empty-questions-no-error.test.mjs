/**
 * 54-02 regression guard: a first-time user (questions.length === 0, empty feed)
 * must NOT see the generationError state.
 *
 * Live gate (HomeScreen.tsx ~223, getDailyPosts .then):
 *
 *   if (posts.length === 0 && questions.length > 0 && !warmStartHadPostsRef.current) {
 *     setGenerationError(true);
 *   }
 *
 * The `questions.length > 0` clause is the load-bearing guard: a brand-new user with
 * no anchors yet legitimately gets an empty feed, and that is NOT an error condition.
 * Removing the clause would surface a false "generation failed" error on first launch.
 *
 * HomeScreen.tsx pulls in the i18n chain (locales/en.json) which blocks importing the
 * screen directly under `node --test`, so this uses the source-reading region-slice
 * pattern — the same approach as HomeScreen.exploredAnchors-resync.test.mjs for
 * screen-level invariants where a runtime render is impractical. The slice is bounded
 * so a match cannot drift to an unrelated setGenerationError call site (e.g. the catch).
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

// Slice the source to the main-effect success-branch generationError gate. The
// start anchor is the unique "Error-gate suppression (Phase 36 GAP-A)" comment
// that documents this exact gate; the end anchor is the block-form `}).catch((err)
// => {` that closes the .then. This isolates the guarded success-path gate from the
// catch-path gate (which intentionally has NO questions.length guard) and from the
// other getDailyPosts call sites (the line-194 refresh and the line-390 retry).
function getSuccessBranchSlice() {
  const startMarker = 'Error-gate suppression (Phase 36 GAP-A)';
  const endMarker = '}).catch((err) => {';
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker, startIdx);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    `Could not locate the main-effect generationError gate slice. startIdx=${startIdx}, endIdx=${endIdx}. HomeScreen.tsx structure may have changed; update the markers.`,
  );
  return source.slice(startIdx, endIdx);
}

describe('54-02 HomeScreen empty-questions does not flag generationError', () => {
  it('the success-branch generationError gate requires questions.length > 0', () => {
    const slice = getSuccessBranchSlice();
    assert.match(
      slice,
      /posts\.length\s*===\s*0\s*&&\s*questions\.length\s*>\s*0\s*&&\s*!warmStartHadPostsRef\.current/,
      'HomeScreen.tsx success-branch must gate setGenerationError on `questions.length > 0` (alongside posts.length===0 and !warmStartHadPostsRef.current). Without the questions.length>0 clause a first-time user with no anchors sees a false "generation failed" error.',
    );
  });

  it('the questions.length>0 clause directly guards setGenerationError(true) in the success branch', () => {
    const slice = getSuccessBranchSlice();
    assert.match(
      slice,
      /questions\.length\s*>\s*0[\s\S]*?setGenerationError\(true\)/,
      'The questions.length>0 clause must guard the setGenerationError(true) call so an empty feed for a no-questions user is treated as a normal cold-start, not an error.',
    );
  });
});
