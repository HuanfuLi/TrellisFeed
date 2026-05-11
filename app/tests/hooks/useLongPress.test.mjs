/**
 * useLongPress.test.mjs — Phase 43-01 Task 1
 *
 * Source-reading structural test for the 480ms long-press hook extracted from
 * ChatMessage.tsx:119-140. Project convention is structural / source-reading tests
 * over React render testing (see canonical-knowledge.test.mjs + InfoFlow.video-tap-emit.test.mjs).
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
