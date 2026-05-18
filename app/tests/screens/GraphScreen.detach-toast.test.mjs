/**
 * GraphScreen.detach-toast.test.mjs — Phase 49-04 Task 3
 *
 * 9 source-reading tests verifying Plan 49-04 wires detach via the B-1
 * two-emit GRAPH_UPDATED correlation pattern. Phase 48's detach() returns
 * ServiceResult<void> — re-anchored vs same-anchor classification is read
 * AFTER a second GRAPH_UPDATED fires (or after a 5s timeout).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');

function readSrc() {
  return readFileSync(SRC_PATH, 'utf-8');
}

test('Test 1 — handleDetach calls graphCommandService.detach', () => {
  const src = readSrc();
  assert.match(
    src,
    /graphCommandService\.detach\(/,
    'GraphScreen.tsx must call `graphCommandService.detach(qaId)` in the detach handler (Plan 49-04)',
  );
});

test('Test 2 — capture originalParentId BEFORE detach (B-1)', () => {
  const src = readSrc();
  // The handler must declare originalParentId from node.parentId BEFORE the
  // graphCommandService.detach call.
  const handlerIdx = src.indexOf('handleDetach');
  assert.ok(handlerIdx > -1, 'must declare a handleDetach function');
  // Scan ~3000 chars from handler start.
  const block = src.slice(handlerIdx, handlerIdx + 3500);
  const originalIdx = block.search(/originalParentId\s*=\s*node\.parentId/);
  const detachIdx = block.search(/graphCommandService\.detach\(/);
  assert.ok(originalIdx > -1, 'handleDetach must capture originalParentId = node.parentId');
  assert.ok(detachIdx > -1, 'handleDetach must call graphCommandService.detach(...)');
  assert.ok(
    originalIdx < detachIdx,
    'originalParentId capture must happen BEFORE detach call (B-1)',
  );
});

test('Test 3 — detach reads ServiceResult<void> — never references result.data.anchorId (B-1)', () => {
  const src = readSrc();
  // The B-1 fix: Phase 48 detach returns ServiceResult<void>, not { anchorId }.
  // Negative assertion enforced.
  assert.equal(
    /result\.data\.anchorId/.test(src),
    false,
    'must NOT reference result.data.anchorId (B-1: Phase 48 detach returns ServiceResult<void>)',
  );
});

test('Test 4 — detach handler has Two-emit correlation comment marker (B-1)', () => {
  const src = readSrc();
  // B-1 documentation marker — the load-bearing pattern must be greppable.
  assert.match(
    src,
    /Two-emit correlation/,
    'detach handler must include `// Two-emit correlation` comment marker (B-1 — load-bearing)',
  );
});

test('Test 5 — detach toast variants: detachedNewAnchor + detachedSameAnchor (D-12)', () => {
  const src = readSrc();
  assert.match(
    src,
    /detachedNewAnchor/,
    'must reference toast key `detachedNewAnchor` (re-anchored variant — D-12)',
  );
  assert.match(
    src,
    /detachedSameAnchor/,
    'must reference toast key `detachedSameAnchor` (no-op variant — D-12)',
  );
});

test('Test 6 — detach handler subscribes to GRAPH_UPDATED then determines variant', () => {
  const src = readSrc();
  // Subscribe inside the detach handler (after the await on detach()).
  const handlerIdx = src.indexOf('handleDetach');
  const block = src.slice(handlerIdx, handlerIdx + 4000);
  assert.match(
    block,
    /eventBus\.subscribe\(\s*['"]GRAPH_UPDATED['"]/,
    'handleDetach must subscribe to GRAPH_UPDATED to correlate the second emit (B-1)',
  );
});

test('Test 7 — detach handler has 5s timeout fallback with silent exit (B-1)', () => {
  const src = readSrc();
  const handlerIdx = src.indexOf('handleDetach');
  const block = src.slice(handlerIdx, handlerIdx + 4000);
  // 5000ms (5s) timeout fallback for the classify-completion wait.
  assert.match(
    block,
    /setTimeout\([\s\S]+?5000\)/,
    'handleDetach must declare a 5000ms setTimeout fallback for classify completion (B-1)',
  );
});

test('Test 8 — questionService.getAll uses { includeFlagged: true } (B-2)', () => {
  const src = readSrc();
  // B-2 enforcement — the post-classify re-read must include flagged.
  assert.match(
    src,
    /questionService\.getAll\(\s*\{\s*includeFlagged:\s*true\s*\}\s*\)/,
    'must call questionService.getAll({ includeFlagged: true }) in detach re-read (B-2)',
  );
});

test('Test 9 — no ConfirmDialog mounted for detach flow', () => {
  const src = readSrc();
  // Detach commits immediately; no confirm modal for it.
  assert.equal(
    /detachConfirm/.test(src),
    false,
    'detach must NOT mount a confirmation dialog (immediate commit)',
  );
});
