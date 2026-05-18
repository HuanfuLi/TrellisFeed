/**
 * CorrectionCard.test.mjs — Phase 49-02 (Wave 0 scaffold)
 *
 * Asserts the per-node-type action matrix (GRAPHUI-01) via the
 * `getActionsForNode` helper. 3 failing assertions go GREEN when Plan 49-02
 * ships `app/src/components/graph/CorrectionCard.tsx`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/CorrectionCard.tsx');

// FAILS until Plan 49-02 ships app/src/components/graph/CorrectionCard.tsx
test('CorrectionCard.tsx exports getActionsForNode function', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `CorrectionCard.tsx must exist after Plan 49-02 (path: ${SRC_PATH})`,
  );
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /export\s+function\s+getActionsForNode\s*\(/,
    'must export `getActionsForNode` function (per-node-type matrix per D-15)',
  );
});

// FAILS until Plan 49-02 ships getActionsForNode with anchor branch
test('getActionsForNode returns 5 actions for anchor (Rename, Move, Merge, Prune, Delete)', async () => {
  const mod = await import('../../../src/components/graph/CorrectionCard.tsx');
  const anchorFixture = {
    id: 'anchor-1',
    title: 'Spaced Repetition',
    content: 'What is spaced repetition?',
    isAnchorNode: true,
    isClusterNode: false,
    parentId: 'cluster-1',
    flagged: false,
  };
  const actions = mod.getActionsForNode(anchorFixture);
  assert.equal(
    actions.length,
    5,
    `anchor must yield 5 actions (Rename, Move, Merge, Prune, Delete); got ${actions.length}`,
  );
});

// FAILS until Plan 49-02 ships getActionsForNode with QA-leaf branch
test('getActionsForNode returns 2 actions for QA leaf (Detach, Delete)', async () => {
  const mod = await import('../../../src/components/graph/CorrectionCard.tsx');
  const qaFixture = {
    id: 'qa-1',
    title: 'Forgetting curve',
    content: 'What is the forgetting curve?',
    isAnchorNode: false,
    isClusterNode: false,
    parentId: 'anchor-1',
    flagged: false,
  };
  const actions = mod.getActionsForNode(qaFixture);
  assert.equal(
    actions.length,
    2,
    `QA leaf must yield 2 actions (Detach, Delete); got ${actions.length}`,
  );
});
