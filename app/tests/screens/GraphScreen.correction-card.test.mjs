/**
 * GraphScreen.correction-card.test.mjs — Phase 49-01 Task 4 + Plan 49-02 (Wave 0 scaffold)
 *
 * 7 source-reading tests on GraphScreen.tsx. Tests 1-3 + 5 go GREEN at end of
 * Plan 49-01 (gesture wiring + DragOverlay mount). Tests 4, 6, 7 go GREEN
 * when Plan 49-02 wires CorrectionCard.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');

// FAILS until Plan 49-01 Task 4 ships GraphScreen.tsx import edit
test('GraphScreen imports createLongPressOrDragMachine from useLongPressOrDrag', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /import\s*\{[^}]*createLongPressOrDragMachine[^}]*\}\s*from\s*['"][^'"]*useLongPressOrDrag['"]/,
    'GraphScreen.tsx must import `createLongPressOrDragMachine` from `../hooks/useLongPressOrDrag`',
  );
});

// FAILS until Plan 49-01 Task 4 ships DragOverlay import + types
test('GraphScreen imports DragOverlay + DragState + DropTargetSnapshot', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /import\s*\{[^}]*DragOverlay[^}]*\}\s*from\s*['"][^'"]*components\/graph\/DragOverlay['"]/,
    'GraphScreen.tsx must import `DragOverlay` from `../components/graph/DragOverlay`',
  );
  // Types are imported separately or alongside; verify presence.
  assert.match(src, /DragState/, 'must reference DragState type');
  assert.match(src, /DropTargetSnapshot/, 'must reference DropTargetSnapshot type');
});

// FAILS until Plan 49-01 Task 4 ships dragState useState + DragOverlay mount
test('GraphScreen defines dragState useState and conditionally mounts DragOverlay', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /useState<DragState\s*\|\s*null>\(null\)/,
    'must declare `useState<DragState | null>(null)`',
  );
  assert.match(
    src,
    /<DragOverlay\s+dragState=\{dragState\}\s+targets=\{dropTargets\}/,
    'must render `<DragOverlay dragState={dragState} targets={dropTargets} ... />`',
  );
});

// FAILS until Plan 49-02 mounts CorrectionCard gated on correctionNode
test('GraphScreen mounts CorrectionCard gated on correctionNode (Plan 49-02)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /correctionNode\s*&&/,
    'must render `correctionNode && <CorrectionCard ...>` (Plan 49-02)',
  );
  assert.match(
    src,
    /<CorrectionCard\b/,
    'must include `<CorrectionCard` mount (Plan 49-02)',
  );
});

// FAILS until Plan 49-01 Task 4 ships pointerdown listener alongside existing click listener
test('GraphScreen preserves existing click listener and adds sibling pointerdown listener', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Existing click listener at MasterMap's useEffect must remain.
  assert.match(
    src,
    /addEventListener\(\s*['"]click['"]\s*,\s*handleClick/,
    'existing click listener must remain wired',
  );
  // New pointerdown listener must be added (sibling).
  assert.match(
    src,
    /addEventListener\(\s*['"]pointerdown['"]/,
    'new pointerdown listener must be added',
  );
});

// FAILS until Plan 49-01 Task 4 ships drop-commit branch with graphCommandService.move
test('GraphScreen routes drop-commit via graphCommandService.move (cluster drop)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /graphCommandService\.move\(/,
    'must call `graphCommandService.move(...)` on cluster drop',
  );
});

// FAILS until Plan 49-01 Task 4 ships invalid-drop toast branch
test('GraphScreen invalid drop branch toasts dropInvalid key', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /graph\.correction\.toast\.dropInvalid/,
    'invalid drop must toast `graph.correction.toast.dropInvalid`',
  );
});
