// Phase 43 Plan 43-10 — source-reading regression for UAT Test 3 fix.
//
// Asserts that the engagement corner-icon overlay in MasonryFeed.tsx:
//   (a) wraps each icon in a 26x26 circular chip span using the
//       --corner-chip-bg + --corner-chip-fg-saved/liked CSS vars
//   (b) Heart fg/color does NOT reference --node-salmon (which inverts in
//       dark mode to #1E2326 and makes the heart disappear)
//   (c) chip wrapping replaces the per-icon drop-shadow filter
//
// Also asserts that index.css declares the three new CSS vars in both
// :root and .dark blocks so the inline-style consumption resolves in
// both themes.
//
// Pattern: pure regex + indexOf against the live source — no React render,
// no jsdom. Follows the Phase 39/40/41/42/43 source-reading discipline.
//
// See .planning/debug/engagement-corner-icon-no-background.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const feedSrc = readFileSync(path.join(appRoot, 'src/components/MasonryFeed.tsx'), 'utf8');
const cssSrc = readFileSync(path.join(appRoot, 'src/index.css'), 'utf8');

// Scope all MasonryFeed assertions to the cornerOverlay region to avoid
// cross-region false-positives. Anchor on `const cornerOverlay =`.
// Note: function return-type annotation intentionally omitted — node --test
// parses plain .mjs without a TS loader, so `: string` would be a syntax
// error here (plan-checker flagged).
function cornerOverlayRegion() {
  const start = feedSrc.indexOf('const cornerOverlay');
  assert.ok(start > 0, 'MasonryFeed.tsx must declare const cornerOverlay');
  // Region ends at the close of the ternary (`) : null;`) — a generous-but-safe
  // upper bound that captures the entire cornerOverlay block.
  const end = feedSrc.indexOf(') : null;', start);
  assert.ok(end > start, 'cornerOverlay ternary must close with `) : null;`');
  return feedSrc.slice(start, end + ') : null;'.length);
}

test('43-10: cornerOverlay chips use var(--corner-chip-bg) for backdrop', () => {
  const region = cornerOverlayRegion();
  const matches = region.match(/var\(--corner-chip-bg\)/g) || [];
  assert.ok(
    matches.length >= 2,
    'each chip span must use backgroundColor: var(--corner-chip-bg) — expected at least 2 occurrences (one per icon chip)',
  );
});

test('43-10: cornerOverlay Bookmark + Heart use --corner-chip-fg-* color tokens', () => {
  const region = cornerOverlayRegion();
  const savedHits = (region.match(/var\(--corner-chip-fg-saved\)/g) || []).length;
  const likedHits = (region.match(/var\(--corner-chip-fg-liked\)/g) || []).length;
  assert.ok(
    savedHits >= 2,
    'Bookmark must use --corner-chip-fg-saved on both fill and color — expected >= 2',
  );
  assert.ok(
    likedHits >= 2,
    'Heart must use --corner-chip-fg-liked on both fill and color — expected >= 2',
  );
});

test('43-10: cornerOverlay no longer references --node-salmon (Heart legible in dark mode)', () => {
  const region = cornerOverlayRegion();
  assert.doesNotMatch(
    region,
    /var\(--node-salmon\)/,
    'Heart fill/color must NOT reference --node-salmon — that token is repurposed as a dark-mode block tint and inverts to near-black',
  );
});

test('43-10: each icon is wrapped in a 26x26 circular chip span', () => {
  const region = cornerOverlayRegion();
  // Chip dimensions — both width and height must be the 26px chip size,
  // each appearing twice (once per icon span).
  const widthHits = (region.match(/width:\s*['"]26px['"]/g) || []).length;
  const heightHits = (region.match(/height:\s*['"]26px['"]/g) || []).length;
  assert.ok(widthHits >= 2, 'expected >= 2 width: 26px declarations (one per chip span)');
  assert.ok(heightHits >= 2, 'expected >= 2 height: 26px declarations (one per chip span)');
  const radiusHits = (region.match(/borderRadius:\s*['"]999px['"]/g) || []).length;
  assert.ok(radiusHits >= 2, 'expected >= 2 borderRadius: 999px declarations (circular chips)');
});

test('43-10: index.css declares --corner-chip-* vars in :root AND .dark', () => {
  // :root block — split at the .dark selector to scope.
  const darkIdx = cssSrc.indexOf('.dark {');
  assert.ok(darkIdx > 0, 'index.css must declare a .dark { ... } block');
  const rootRegion = cssSrc.slice(0, darkIdx);
  const darkRegion = cssSrc.slice(darkIdx);

  for (const v of ['--corner-chip-bg', '--corner-chip-fg-saved', '--corner-chip-fg-liked']) {
    assert.match(rootRegion, new RegExp(v + ':'), `:root must declare ${v}`);
    assert.match(darkRegion, new RegExp(v + ':'), `.dark must declare ${v}`);
  }
});

test('43-10: cornerOverlay no longer uses per-icon drop-shadow filter (chip box-shadow replaces it)', () => {
  const region = cornerOverlayRegion();
  assert.doesNotMatch(
    region,
    /filter:\s*['"]drop-shadow/,
    'cornerOverlay must not retain the per-icon drop-shadow filter — chip box-shadow replaces it',
  );
});
