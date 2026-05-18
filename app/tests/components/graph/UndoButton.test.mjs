/**
 * UndoButton.test.mjs — Phase 49-04 Task 1
 *
 * 8 source-reading tests that verify Plan 49-04 ships
 * `app/src/components/graph/UndoButton.tsx` with:
 *   - 36px circular button at `bottom: 12px; right: 56px`
 *   - GRAPH_UPDATED subscriber recomputing `isEnabled` from journal length
 *   - Initial state read from `graphEditJournal.list().length`
 *   - Disabled visual + "Nothing to undo" toast when journal empty
 *   - Disabled visual when reorganizing === true
 *   - Successful undo toast uses `result.data.summary` (B-5 — NOT undoneCmd)
 *   - Cleanup unsubscribes
 *   - aria-label on button (a11y)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/UndoButton.tsx');

function readSrc() {
  return readFileSync(SRC_PATH, 'utf-8');
}

test('Test 1 — UndoButton renders 36px circular button at bottom:12px right:56px', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `UndoButton.tsx must exist after Plan 49-04 (path: ${SRC_PATH})`,
  );
  const src = readSrc();
  assert.match(
    src,
    /export\s+function\s+UndoButton\s*\(/,
    'must export `UndoButton` component',
  );
  assert.match(src, /width:\s*['"]36px['"]/, 'must set width: 36px');
  assert.match(src, /height:\s*['"]36px['"]/, 'must set height: 36px');
  assert.match(src, /borderRadius:\s*['"]50%['"]/, 'must set borderRadius: 50% (circular)');
  assert.match(src, /bottom:\s*['"]12px['"]/, 'must place at bottom: 12px');
  assert.match(src, /right:\s*['"]56px['"]/, 'must place at right: 56px (D-13 / R17)');
  assert.match(
    src,
    /border:\s*['"]1px solid var\(--border\)['"]/,
    'must use var(--border) for the 1px border',
  );
  assert.match(
    src,
    /backgroundColor:\s*['"]var\(--surface\)['"]/,
    'must use var(--surface) backgroundColor',
  );
  assert.match(
    src,
    /boxShadow:\s*['"]var\(--shadow-1\)['"]/,
    'must use var(--shadow-1) boxShadow (matches expand/collapse button)',
  );
  assert.match(src, /<Undo2\s+size=\{18\}/, 'must render <Undo2 size={18} /> icon');
});

test('Test 2 — UndoButton subscribes to GRAPH_UPDATED on mount', () => {
  const src = readSrc();
  assert.match(
    src,
    /eventBus\.subscribe\(\s*['"]GRAPH_UPDATED['"]/,
    'must subscribe to GRAPH_UPDATED (D-13 — recompute enabled state)',
  );
  // Subscriber body must recompute isEnabled from graphEditJournal.list().length
  assert.match(
    src,
    /graphEditJournal\.list\(\)\.length/,
    'subscriber must recompute isEnabled from graphEditJournal.list().length',
  );
});

test('Test 3 — UndoButton initial state reads graphEditJournal.list().length', () => {
  const src = readSrc();
  // useState initial value derived from journal length (lazy-init form). The
  // useState call must appear AND reference graphEditJournal.list().length
  // inside the same statement (single-line lazy initializer is the convention).
  assert.match(
    src,
    /useState[\s\S]*?graphEditJournal\.list\(\)\.length/,
    'useState initial value must read graphEditJournal.list().length (no hydration flicker)',
  );
});

test('Test 4 — disabled empty-journal tap toasts "Nothing to undo" (R11)', () => {
  const src = readSrc();
  assert.match(
    src,
    /graph\.correction\.toast\.nothingToUndo/,
    'must reference the nothingToUndo i18n key on empty-journal tap',
  );
  // Visual disabled state: opacity 0.4 + cursor not-allowed
  assert.match(src, /opacity:\s*[^,;]*0\.4/, 'must dim button to opacity 0.4 when disabled');
  assert.match(
    src,
    /cursor:\s*[^,;]*['"]not-allowed['"]/,
    'must use cursor: not-allowed when disabled',
  );
});

test('Test 5 — reorganizing prop disables tap (D-16)', () => {
  const src = readSrc();
  // Props interface must declare reorganizing.
  assert.match(
    src,
    /reorganizing:\s*boolean/,
    'UndoButtonProps must declare `reorganizing: boolean` (D-16)',
  );
  // Handler must early-return when reorganizing.
  assert.match(
    src,
    /if\s*\(\s*reorganizing\s*\)\s*return/,
    'handleUndo must early-return when reorganizing === true (D-16)',
  );
});

test('Test 6 — successful undo toast uses result.data.summary (B-5)', () => {
  const src = readSrc();
  assert.match(
    src,
    /graphCommandService\.undo\(\)/,
    'must call graphCommandService.undo() on enabled tap',
  );
  // POSITIVE: must reference result.data.summary in the toast call.
  assert.match(
    src,
    /result\.data\.summary/,
    'must use result.data.summary in toast (B-5 — operator-facing text)',
  );
  // NEGATIVE: must NOT reference result.data.undoneCmd in toast (B-5 enforcement).
  assert.equal(
    /result\.data\.undoneCmd/.test(src),
    false,
    'must NOT reference result.data.undoneCmd in user-facing toast (B-5 — log telemetry only)',
  );
  // The undone toast key.
  assert.match(
    src,
    /graph\.correction\.toast\.undone/,
    'must reference graph.correction.toast.undone i18n key',
  );
});

test('Test 7 — cleanup unsubscribes from GRAPH_UPDATED on unmount', () => {
  const src = readSrc();
  // useEffect with return value that calls the unsub fn.
  assert.match(
    src,
    /const\s+unsub\s*=\s*eventBus\.subscribe/,
    'must capture subscribe return as `unsub`',
  );
  assert.match(
    src,
    /return\s*\(\s*\)\s*=>\s*unsub\(\s*\)/,
    'useEffect must return `() => unsub()` cleanup',
  );
});

test('Test 8 — a11y aria-label uses i18n actions.undo key', () => {
  const src = readSrc();
  assert.match(
    src,
    /aria-label=\{t\(\s*['"]graph\.correction\.actions\.undo['"]/,
    'button must declare aria-label via t("graph.correction.actions.undo") for screen readers',
  );
});
