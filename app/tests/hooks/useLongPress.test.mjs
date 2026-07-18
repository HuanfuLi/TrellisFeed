/**
 * useLongPress.test.mjs — Phase 43-01 Task 1
 *
 * Source-reading structural test for the 480ms long-press hook extracted from
 * ChatMessage.tsx:119-140. The assertions stay focused on the current hook's
 * pointer-event contract without importing the React component tree.
 *
 * Asserts:
 * - File exists at app/src/hooks/useLongPress.ts
 * - Exports a named function `useLongPress`
 * - Pattern: setTimeout-based timer with `didLongPress` ref
 * - All 4 pointer-event handlers wired (onPointerDown / Up / Leave / Move)
 * - Pointer-event-only path: NO `contextmenu` / `onContextMenu` handlers
 *   (Android WebView surfaces native text-selection menu on unhandled contextmenu — RESEARCH §1)
 * - At least 30 lines (sanity floor — should not be a trivial stub)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = resolve(here, '../../src/hooks/useLongPress.ts');

test('useLongPress hook file exists at expected location', () => {
  assert.equal(existsSync(HOOK_PATH), true, `Expected file at ${HOOK_PATH}`);
});

test('useLongPress exports a named function', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  assert.match(
    source,
    /export\s+function\s+useLongPress\s*\(/,
    'Expected `export function useLongPress(` declaration',
  );
});

test('useLongPress uses setTimeout-based timer pattern', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  assert.match(source, /setTimeout/, 'Expected setTimeout in hook source');
});

test('useLongPress exposes didLongPress ref (at least 2 references in source)', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  const matches = source.match(/didLongPress/g) || [];
  assert.ok(
    matches.length >= 2,
    `Expected at least 2 didLongPress references (declaration + assignment + return); found ${matches.length}`,
  );
});

test('useLongPress wires all 4 pointer-event handlers', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  for (const handler of ['onPointerDown', 'onPointerUp', 'onPointerLeave', 'onPointerMove']) {
    assert.match(source, new RegExp(handler), `Expected ${handler} in hook source`);
  }
});

test('useLongPress does NOT attach contextmenu handler (Android WebView native menu suppression)', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  const contextMatches = source.match(/contextmenu|onContextMenu/gi) || [];
  assert.equal(
    contextMatches.length,
    0,
    `useLongPress must NOT register contextmenu — Android WebView surfaces the native text-selection menu on long-press if unhandled. Pointer-event-only path is the verified pattern (ChatMessage.tsx:119-140). Found ${contextMatches.length} occurrence(s).`,
  );
});

test('useLongPress source has at least 30 lines (sanity floor)', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  const lines = source.split('\n').length;
  assert.ok(lines >= 30, `Expected at least 30 lines; got ${lines}`);
});

// ─── G13 regression: movement-threshold logic must exist ──────────────────────
// Phase 50 UAT-4 surfaced that the original onPointerMove: cancel binding made
// long-press completely non-functional on real touch hardware (finger jitter
// fires constant pointermoves during a held press → timer never elapses).
// The fix mirrors useLongPressOrDrag.ts:132-159: cancel only when displacement
// from start coord exceeds DRAG_THRESHOLD_PX (8px Euclidean). These tests
// guard against regression to the broken "cancel-on-any-move" shape.

test('G13: useLongPress has DRAG_THRESHOLD_PX constant (or equivalent 8-px threshold)', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  assert.match(
    source,
    /DRAG_THRESHOLD_PX\s*=\s*8/,
    'Expected DRAG_THRESHOLD_PX = 8 — without a movement threshold, touch jitter cancels every long-press on real hardware.',
  );
});

test('G13: useLongPress captures pointerdown coords for threshold comparison', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  // The hook must remember where the pointer started so it can compute
  // displacement on every move event.
  assert.match(
    source,
    /startCoord(?:Ref)?[\s\S]{0,80}clientX/,
    'Expected start-coord capture using e.clientX / clientY in pointerdown handler.',
  );
});

test('G13: useLongPress computes Euclidean distance on pointermove (not cancel-on-any-move)', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  // Either Math.hypot or sqrt(dx*dx + dy*dy) is acceptable. Whichever is used,
  // a deliberate-vs-jitter discrimination must be present.
  const hasHypot = /Math\.hypot\s*\(/.test(source);
  const hasManualDist = /Math\.sqrt\s*\([^)]*\*[^)]*\+[^)]*\*[^)]*\)/.test(source);
  assert.ok(
    hasHypot || hasManualDist,
    'Expected Math.hypot or equivalent Euclidean distance computation in pointermove handler — required to discriminate finger jitter from deliberate movement.',
  );
});

test('G13: useLongPress onPointerMove is NOT directly aliased to cancel', () => {
  const source = readFileSync(HOOK_PATH, 'utf-8');
  // The original broken shape had `onPointerMove: cancel`. The new shape must
  // route move events through a threshold-checking handler (handleMove, or any
  // name other than the bare cancel). This regex catches the exact regression.
  assert.doesNotMatch(
    source,
    /onPointerMove\s*:\s*cancel\b/,
    'REGRESSION: onPointerMove must NOT be aliased directly to cancel. Touch hardware fires pointermove constantly from finger jitter — every long-press will be cancelled. Use a movement-threshold handler instead (see useLongPressOrDrag.ts:132-159).',
  );
});
