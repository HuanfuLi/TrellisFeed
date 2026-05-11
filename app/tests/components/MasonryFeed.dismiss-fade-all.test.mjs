// Phase 43 Plan 43-03 — LP-03 + LP-05 source-reading invariants for MasonryFeed.
//
// Coverage:
//   - useLongPress hook bound at 480ms (codebase convention)
//   - Corner state icons (Bookmark / Heart) reading engagementService at render
//   - <AnimatePresence> wraps each column tile list (LP-05)
//   - Tile wrappers have exit prop with opacity 0 + scale 0.96 (LP-05 fade)
//   - onClickCapture + didLongPress click-after-long-press suppression
//   - onLongPress / engagementVersion props declared (bubbled to host)
//   - Phase 42 negative invariants preserved (no CONCEPT_EXPLORED,
//     no column-count, no will-change/perspective, MotionConfig still wraps)
//
// Note: The plan's earlier draft also asserted visibilitychange +
// IntersectionObserver preservation, but Phase 42 UAT-7+8 removed inline video
// play from feed cards, deleting those useEffects. Re-introducing the literal
// tokens would violate CLAUDE.md "Don't re-introduce inline play in feed
// cards." Those two assertions are intentionally omitted.
//
// Reference: CONTEXT.md LP-05, UI-SPEC §4 Dismiss fade animation,
// MasonryFeed.tsx TileWrapper component (Phase 43-03).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/components/MasonryFeed.tsx'), 'utf8');

test('LP-03/05: MasonryFeed integrates useLongPress hook at 480ms', () => {
  assert.match(src, /import\s+\{\s*useLongPress\s*\}\s+from\s+['"]\.\.\/hooks\/useLongPress['"]/);
  assert.match(src, /useLongPress\s*\(\s*480/, 'Must invoke useLongPress with 480ms (codebase-wide long-press convention)');
});

test('LP-03: corner icon overlay reads engagement state per tile', () => {
  assert.match(src, /engagementService\.isSaved/);
  assert.match(src, /engagementService\.isLiked/);
  assert.match(src, /\bBookmark\b/);
  assert.match(src, /\bHeart\b/);
  // Phase 43-10 (gap closure): corner icons now wrapped in a circular chip
  // (--corner-chip-bg backdrop + --shadow-1 lift) instead of a per-icon
  // drop-shadow filter. Same spirit (visibility on busy thumbnails), better
  // execution. See MasonryFeed.corner-chip.test.mjs for the full chip
  // invariant set.
  assert.match(src, /var\(--corner-chip-bg\)/);
});

test('LP-05: each column tile list is wrapped in AnimatePresence', () => {
  assert.match(src, /import\s+\{[^}]*AnimatePresence[^}]*\}\s+from\s+['"]framer-motion['"]/);
  const apTagCount = (src.match(/<AnimatePresence/g) || []).length;
  assert.ok(apTagCount >= 2, `Expected at least 2 <AnimatePresence> tags (one per column), found ${apTagCount}`);
});

test('LP-05: tile wrappers have exit prop with opacity 0 + scale 0.96', () => {
  assert.match(src, /opacity:\s*0,?\s*\n?\s*scale:\s*0\.96/, 'Exit prop must include opacity 0 + scale 0.96 together (Phase 42 tile motion vocabulary)');
  // 200ms duration (UI-SPEC §4 exit transition)
  assert.match(src, /duration:\s*0\.2/);
});

test('LP: click-after-long-press suppression via onClickCapture + didLongPress', () => {
  assert.match(src, /onClickCapture/);
  assert.match(src, /didLongPress\.current/);
});

test('LP: onLongPress + engagementVersion props bubbled up to host (HomeScreen owns menu state in 43-06)', () => {
  assert.match(src, /onLongPress\?\s*:\s*\(/, 'Must declare onLongPress?: (...) => void prop type');
  assert.match(src, /engagementVersion\?\s*:\s*number/, 'Must declare engagementVersion?: number prop type');
});

test('Phase 42 invariants preserved (load-bearing CLAUDE.md rules)', () => {
  // Single-emit invariant: MasonryFeed must not re-introduce CONCEPT_EXPLORED
  // emits (the signal lives in PostDetailScreen detectors / MemoizedConceptCard).
  assert.strictEqual(
    (src.match(/CONCEPT_EXPLORED/g) || []).length,
    0,
    'CONCEPT_EXPLORED must not appear in MasonryFeed (single-emit invariant)',
  );
  assert.strictEqual(
    (src.match(/dailyReadService\.markExplored/g) || []).length,
    0,
    'dailyReadService.markExplored must not appear in MasonryFeed (single-emit invariant)',
  );
  // D-02 height-accumulating split, not CSS column-count
  assert.strictEqual(
    (src.match(/\bcolumn-count\b|\bcolumnCount\b|\bbreak-inside\b|\bbreakInside\b/g) || []).length,
    0,
    'D-02: height-accumulating JS split, not CSS column-count',
  );
  // CLAUDE.md Header positioning: no will-change/perspective on Header ancestors
  assert.strictEqual(
    (src.match(/\bwill-change\b|\bwillChange\b|\bperspective:\b/g) || []).length,
    0,
    'CLAUDE.md Header positioning: no will-change/perspective on Header ancestors',
  );
  // MotionConfig reducedMotion="user" must still wrap MasonryFeed return
  assert.match(src, /MotionConfig/, 'MotionConfig reducedMotion="user" must still wrap MasonryFeed return');
});
