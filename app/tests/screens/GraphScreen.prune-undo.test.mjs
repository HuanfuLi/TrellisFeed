/**
 * GraphScreen.prune-undo.test.mjs — Phase 49-04 Task 3
 *
 * 5 source-reading tests verifying Plan 49-04 wires soft-prune snackbar
 * (D-10 / D-14 / W-6) via graphCommandService.prune + extended toast({action})
 * with [Undo] that invokes graphCommandService.undo and uses
 * result.data.summary (B-5).
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

test('Test 1 — handlePrune calls graphCommandService.prune', () => {
  const src = readSrc();
  assert.match(
    src,
    /graphCommandService\.prune\(/,
    'GraphScreen.tsx must call `graphCommandService.prune(...)` in the prune handler (Plan 49-04)',
  );
});

test('Test 2 — prune toast includes Undo action; type "info" (W-6)', () => {
  const src = readSrc();
  // Toast extended signature: 3rd arg `{ action: { label, onAction } }` (49-03).
  assert.match(
    src,
    /\{\s*action:\s*\{\s*label:/,
    'prune handler must pass `{ action: { label: ... } }` as toast 3rd arg (Snackbar-with-Undo per D-10)',
  );
  // The pruned toast must reference the i18n key.
  assert.match(
    src,
    /graph\.correction\.toast\.pruned/,
    'prune toast must use graph.correction.toast.pruned i18n key',
  );
  // The action label must be the undo action label.
  assert.match(
    src,
    /label:\s*t\(\s*['"]graph\.correction\.actions\.undo['"]/,
    'prune action label must be t("graph.correction.actions.undo")',
  );
});

test('Test 3 — prune-toast Undo action invokes graphCommandService.undo with summary (B-5)', () => {
  const src = readSrc();
  assert.match(
    src,
    /graphCommandService\.undo\(\)/,
    'prune toast Undo action must invoke `graphCommandService.undo()` (D-10)',
  );
  // B-5: the follow-up toast inside the prune-undo callback uses
  // result.data.summary (or optional-chain undoResult.data?.summary) — never
  // the verb-literal field.
  // We assert there's at least one `result.data.summary` (or `undoResult.data.summary`)
  // somewhere in the file referenced after a prune-undo callback's awaited undo().
  assert.match(
    src,
    /undoResult\.data\??\.\s*summary|result\.data\??\.\s*summary/,
    'prune-undo callback follow-up toast must use result.data.summary (B-5)',
  );
});

test('Test 4 — no ConfirmDialog mounted for prune flow (D-10 soft prune)', () => {
  const src = readSrc();
  // The plan: soft prune commits immediately, no modal. We assert the prune
  // case in handleCorrectionAction does NOT setPruneConfirm (no such state
  // exists) and does NOT mount any ConfirmDialog gated on `pruneConfirm`.
  assert.equal(
    /pruneConfirm/.test(src),
    false,
    'soft prune must NOT mount a confirmation dialog (D-10)',
  );
});

test('Test 5 — handleCorrectionAction prune branch routes through handlePrune', () => {
  const src = readSrc();
  // The 'prune' case in handleCorrectionAction must call handlePrune(node).
  assert.match(
    src,
    /case\s+['"]prune['"]:\s*[\s\S]{0,400}handlePrune\(/,
    'handleCorrectionAction case "prune" must call handlePrune(node)',
  );
});
