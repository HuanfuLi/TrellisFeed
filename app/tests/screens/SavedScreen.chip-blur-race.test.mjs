// Phase 50 gap closure 50-12 (G2). Enforces the chip-tap-survives-empty-query-blur
// fix at source level. Without onPointerDown + onMouseDown preventDefault on the
// FilterChip wrapper, the search input's blur fires before the chip's onClick, and
// showFilterChips's latch (searchFocused || inputDraft.length > 0 || anyFilterActive)
// collapses the chip-row on the empty-query path before tap. Source-reading only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

/**
 * Extract the FilterChip function body from SavedScreen.tsx.
 * Locates `function FilterChip` and captures until the next top-level
 * `function ` or `export` declaration (or end of file).
 */
function extractFilterChipBody(src) {
  const startIdx = src.indexOf('function FilterChip');
  assert.ok(startIdx !== -1, 'Could not locate function FilterChip in SavedScreen.tsx');

  // Find the end — next top-level function/const/export after FilterChip.
  // We look for the pattern "\n\nfunction " or "\n\nexport " or "\n\nconst "
  // which marks a new top-level declaration.
  const afterStart = src.slice(startIdx);
  const endMatch = afterStart.match(/\n\n(?:function |export |const |\/\/\s*───)/);
  if (endMatch) {
    return afterStart.slice(0, endMatch.index);
  }
  return afterStart;
}

test('CBR-01: source contains a function FilterChip declaration (inline per UI-SPEC)', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(src, /function\s+FilterChip/,
    'SavedScreen.tsx must contain an inline function FilterChip declaration.');
});

test('CBR-02: FilterChip contains onPointerDown handler calling e.preventDefault()', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const chip = extractFilterChipBody(src);
  assert.match(chip, /onPointerDown=\{[^}]*e\.preventDefault\(\)/s,
    'FilterChip must have onPointerDown handler that calls e.preventDefault() — G2 blur-race fix.');
});

test('CBR-03: FilterChip contains onMouseDown handler calling e.preventDefault()', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const chip = extractFilterChipBody(src);
  assert.match(chip, /onMouseDown=\{[^}]*e\.preventDefault\(\)/s,
    'FilterChip must have onMouseDown handler that calls e.preventDefault() — Capacitor Android WebView dispatches both pointer and mouse events on touch.');
});

test('CBR-04: onPointerDown and onMouseDown appear BEFORE onClick on the FilterChip button', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const chip = extractFilterChipBody(src);
  // Verify ordering: onPointerDown ... onMouseDown ... onClick in the button attrs
  // The button tag spans multiple lines with comments, so we use [\s\S]*? to
  // match across newlines and comment blocks between attributes.
  assert.match(chip, /<button[\s\S]*?onPointerDown[\s\S]*?onMouseDown[\s\S]*?onClick/,
    'onPointerDown and onMouseDown must appear before onClick on the FilterChip button element — documents intent that prevent-default fires before tap handler.');
});

test('CBR-05: FilterChip has a code comment citing G2 for provenance', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const chip = extractFilterChipBody(src);
  assert.match(chip, /G2/,
    'FilterChip must contain a comment citing G2 so future readers understand why preventDefault is there.');
});

test('CBR-06: FilterChip uses padding 10px 14px — G7 vertical padding follow-up', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const chip = extractFilterChipBody(src);
  assert.match(chip, /padding:\s*['"]10px 14px['"]/,
    'FilterChip must use padding: "10px 14px" after the G7 re-UAT clarification that vertical padding, not horizontal rhythm, was the visible issue.');
});
