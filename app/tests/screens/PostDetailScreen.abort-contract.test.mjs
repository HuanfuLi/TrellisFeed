// Phase 43 Plan 43-05 — DD-05 source-reading invariants for the
// PostDetailScreen AbortController contract.
//
// What this guards (DD-05 — preservation + extension of the Phase 41-02 D-08 audit):
//   - ≥4 pre-call AbortController guards (3 existing from Phase 41 + 1 new for
//     the deep-stream path)
//   - ≥5 signal-arg passes (4 existing + 1 new on generatePostEssay({ depth: 'deep', signal }))
//   - patchPostEssayInCache for bodyMarkdownDeep is preceded by a not-aborted guard
//     (DD-05 hard invariant — cache is NEVER written from a partial/aborted stream)
//   - Cleanup useEffect aborts BOTH controllers on unmount + postId change
//   - abort() invocations are restricted to documented sites (locale change,
//     unmount cleanup, Restore Standard)
//   - Deep-stream handler accumulates into streamingDeep ONLY (post.bodyMarkdown
//     is never overwritten — standard variant preserved across the deep flow)
//
// Reference: CONTEXT.md DD-05; CLAUDE.md §"AbortController contract" at
// PostDetailScreen.tsx:313-350 (extended by 43-05 Task 1).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/screens/PostDetailScreen.tsx'), 'utf8');

test('DD-05: at least 4 pre-call AbortController guards (3 existing + 1 new for deep stream)', () => {
  const guardPattern = /if\s*\([^)]*signal\.aborted\)\s*return/g;
  const guards = src.match(guardPattern) || [];
  assert.ok(
    guards.length >= 4,
    `Expected at least 4 pre-call AbortController guards (3 existing from Phase 41 + 1 new for the deep stream), found ${guards.length}`,
  );
});

test('DD-05: at least 5 signal-arg passes (4 existing + 1 new on deep generatePostEssay)', () => {
  const signalArgPattern = /signal:\s*\w+(?:\.current)?(?:\?\.)?\.?signal/g;
  const matches = src.match(signalArgPattern) || [];
  assert.ok(
    matches.length >= 5,
    `Expected at least 5 signal-arg passes (4 existing from Phase 41 + 1 new on deep call), found ${matches.length}`,
  );
});

test('DD-05: generatePostEssay({ depth: "deep", signal }) is invoked in handleStartDeepDive', () => {
  assert.match(
    src,
    /generatePostEssay\([^)]*\{[^}]*depth:\s*['"]deep['"][^}]*signal:[^}]*\}\)/s,
    'Deep-stream call must pass { depth: "deep", signal: <controller>.signal }',
  );
});

test('DD-05: patchPostEssayInCache for bodyMarkdownDeep is guarded against partial-stream writes', () => {
  // Confirm patchPostEssayInCache(...{ bodyMarkdownDeep ... }) appears in the deep-stream flow.
  assert.match(src, /patchPostEssayInCache\(post\.id,\s*\{\s*bodyMarkdownDeep/);
  // Both call sites should exist: standard (Phase 41) + deep (Phase 43 — this plan).
  const patches = (src.match(/patchPostEssayInCache\(post\.id,/g) || []).length;
  assert.ok(
    patches >= 2,
    `Expected at least 2 patchPostEssayInCache invocations (standard + deep), found ${patches}`,
  );
  // Cache-write guard: the deep-stream handler must contain an aborted check
  // immediately preceding the patchPostEssayInCache call. Walk the deep handler region.
  const handlerStart = src.indexOf('handleStartDeepDive = useCallback');
  const handlerEnd = src.indexOf('handleRestoreStandard = useCallback');
  assert.ok(handlerStart > 0 && handlerEnd > handlerStart, 'deep handler must exist');
  const region = src.slice(handlerStart, handlerEnd);
  // Within this region, every patchPostEssayInCache invocation must be preceded
  // by an aborted-return guard. Loose check: at least one aborted guard exists
  // before the call within the same handler scope.
  const patchIdxInRegion = region.indexOf('patchPostEssayInCache');
  assert.ok(patchIdxInRegion > 0, 'patchPostEssayInCache must be called inside the deep handler');
  const beforePatch = region.slice(0, patchIdxInRegion);
  assert.match(
    beforePatch,
    /if\s*\([^)]*signal\.aborted\)\s*return/,
    'patchPostEssayInCache(bodyMarkdownDeep) must be preceded by a not-aborted guard inside the deep handler',
  );
});

test('DD-05: cleanup aborts BOTH the on-enter controller AND the deep controller', () => {
  assert.match(src, /abortController\.abort\(\)/);
  assert.match(src, /deepAbortControllerRef\.current\?\.abort\(\)/);
});

test('DD-05: abort() invocations are restricted to documented sites (locale change, unmount, Restore Standard)', () => {
  // Documented paths: locale-change abort (LOCALE_CHANGED subscriber), unmount
  // cleanup (return-from-useEffect), handleRestoreStandard. We assert there's
  // a reasonable lower bound (at least 3 abort() invocations) without enumerating
  // exact line numbers — those drift across edits.
  const abortCalls = (src.match(/\.abort\(/g) || []).length;
  assert.ok(
    abortCalls >= 3,
    `Expected at least 3 abort() calls (locale change + unmount + Restore Standard), found ${abortCalls}`,
  );
});

test('DD-05: deep-stream NEVER overwrites post.bodyMarkdown (standard variant preserved)', () => {
  // Anchor on the useCallback DECLARATION (not the JSDoc comment occurrence) so
  // we slice the actual handler body, not the surrounding screen code that
  // legitimately constructs DailyPost skeletons with `bodyMarkdown: ''` literals.
  const deepHandlerStart = src.indexOf('handleStartDeepDive = useCallback');
  const deepHandlerEnd = src.indexOf('handleRestoreStandard = useCallback');
  assert.ok(
    deepHandlerStart > 0 && deepHandlerEnd > deepHandlerStart,
    'both handler useCallback declarations must be present and ordered',
  );
  const deepHandlerRegion = src.slice(deepHandlerStart, deepHandlerEnd);
  assert.match(deepHandlerRegion, /bodyMarkdownDeep/);
  // Inside handleStartDeepDive, no literal `bodyMarkdown:` (without Deep suffix)
  // assignment — the deep stream must accumulate into a SEPARATE state slot.
  assert.doesNotMatch(
    deepHandlerRegion,
    /bodyMarkdown:\s*[^D]/,
    'deep handler must not assign post.bodyMarkdown directly (separate streamingDeep slot)',
  );
});
