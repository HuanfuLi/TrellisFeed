/**
 * DragOverlay.test.mjs — Phase 49-01 Task 3 (Wave 0 scaffold)
 *
 * Source-reading + structural assertions on DragOverlay component:
 *  - portal target = document.body
 *  - magnetic-snap radius = 32px Euclidean
 *  - halo color mapping (cluster → --primary-40, anchor → --node-peach)
 *
 * Failing assertions go GREEN when Plan 49-01 Task 3 ships
 * `app/src/components/graph/DragOverlay.tsx`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/DragOverlay.tsx');

// FAILS until Plan 49-01 Task 3 ships app/src/components/graph/DragOverlay.tsx
test('DragOverlay.tsx source file exists', () => {
  assert.equal(existsSync(SRC_PATH), true, `Expected ${SRC_PATH} after Plan 49-01 Task 3`);
});

// Test 1: portal mounts to document.body
test('DragOverlay portals to document.body via createPortal', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /import\s*\{[^}]*createPortal[^}]*\}\s*from\s*['"]react-dom['"]/,
    'must import createPortal from react-dom',
  );
  assert.match(
    src,
    /createPortal\([\s\S]*?document\.body/,
    'must call createPortal(..., document.body)',
  );
});

// Test 2: ghost within 32px of target center sets snappedTargetId — via 32px constant
test('DragOverlay uses 32px magnetic-snap radius (Euclidean)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  // Either a literal 32 in a snap-radius / threshold context, or a default param
  // `snapRadiusPx = 32` on the component signature.
  const has32Default = /snapRadiusPx\s*[:=]\s*32/.test(src) || /snapRadiusPx\s*=\s*32/.test(src);
  const hasHypot = /Math\.hypot\(/.test(src);
  assert.ok(has32Default, 'must default snapRadiusPx = 32 (DragOverlay default per R3)');
  assert.ok(hasHypot, 'must compute Euclidean distance via Math.hypot for snap math');
});

// Test 3: halo color mapping — cluster → --primary-40, anchor → --node-peach
test('DragOverlay halo color maps cluster→--primary-40 and anchor→--node-peach', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /var\(--primary-40\)/,
    'must reference var(--primary-40) (Move target halo)',
  );
  assert.match(
    src,
    /var\(--node-peach\)/,
    'must reference var(--node-peach) (Merge target halo)',
  );
});

// Test 4: SVG origin-line at zIndex 9000, ghost at zIndex 9001
test('DragOverlay layers SVG origin-line (zIndex 9000) below ghost div (zIndex 9001)', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(src, /zIndex:\s*9000/, 'must reference zIndex 9000 (origin-line SVG)');
  assert.match(src, /zIndex:\s*9001/, 'must reference zIndex 9001 (ghost div above origin-line)');
});

// Test 5: returns null when dragState is null (and SSR guard)
test('DragOverlay returns null when dragState is null AND guards SSR with typeof document', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(
    src,
    /typeof\s+document\s*===\s*['"]undefined['"]/,
    'must guard SSR via `typeof document === "undefined"`',
  );
  assert.match(
    src,
    /dragState\s*===\s*null/,
    'must guard against dragState === null',
  );
});

// Test 6 (source-reading): exports DragOverlay + DragState + DropTargetSnapshot
test('DragOverlay.tsx exports DragOverlay, DragState, DropTargetSnapshot', () => {
  const src = readFileSync(SRC_PATH, 'utf-8');
  assert.match(src, /export\s+function\s+DragOverlay\s*\(/, 'must export DragOverlay');
  assert.match(src, /export\s+interface\s+DragState\b/, 'must export DragState interface');
  assert.match(src, /export\s+interface\s+DropTargetSnapshot\b/, 'must export DropTargetSnapshot interface');
});
