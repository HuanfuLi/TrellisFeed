// Phase 43-06 source-reading invariant test — HomeScreen engagement-resync.
//
// Locks the dual-effect dismiss-resync pattern (canonical Phase 36-14
// sibling-effects shape, see HomeScreen.exploredAnchors-resync.test.mjs
// precedent) plus the SV-02 Bookmark icon entry point plus Phase 32.1/36-14
// non-regression invariants.
//
// Effect A — stable ANCHOR_DISMISSED listener (deps []): fires the in-place
//   filter immediately so the user sees the fade-out without waiting for a
//   navigation event (LP-05 fast path).
// Effect B — [location.pathname] resync: re-reads engagementService and
//   filters dailyPosts in-place on every navigation to /home (canonical
//   Phase 36-14 always-mounted-screen pattern; CLAUDE.md).
// Effect C — stable ENGAGEMENT_CHANGED listener (deps []): bumps
//   engagementVersion for MasonryFeed corner-icon re-renders (LP-03).
//
// IMPORTANT — service method name correction (recorded as a Rule 1 deviation
// in 43-06 SUMMARY.md): the plan body referenced
// `engagementService.getDismissedAnchors()` but the actual Phase 39 service
// surface (engagement.service.ts:182) is `getDismissedAnchorIds()`. This
// test asserts against the real method name so the source-reading
// invariant exercises the actual production wiring.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/screens/HomeScreen.tsx'), 'utf8');

test('43-06 Effect A: ANCHOR_DISMISSED stable event listener (deps [], canonical fast-path)', () => {
  // Effect A pattern: useEffect(() => { eventBus.subscribe('ANCHOR_DISMISSED', ...); return unsub }, [])
  assert.match(src, /eventBus\.subscribe\(\s*['"]ANCHOR_DISMISSED['"]/);
  // The subscribe call must live inside a useEffect (matching Phase 36-14 sibling-effects rule).
  // Source-reading: find the subscribe location and assert there's a useEffect opener in the preceding ~300 chars.
  const subIdx = src.indexOf("subscribe('ANCHOR_DISMISSED'");
  assert.ok(subIdx > 0, 'ANCHOR_DISMISSED subscribe must exist');
  const preceding = src.slice(Math.max(0, subIdx - 300), subIdx);
  assert.match(preceding, /useEffect\(/, 'ANCHOR_DISMISSED subscribe must be inside a useEffect');
  // In-place filter pattern
  assert.match(src, /setDailyPosts\(\s*prev\s*=>\s*prev\.filter/);
  assert.match(src, /sourceQuestionIds\??\.\??\[0\]\s*!==\s*anchorId/);
});

test('43-06 Effect B: engagementService.getDismissedAnchorIds() inside a [location.pathname] resync effect (canonical Phase 36-14 pattern)', () => {
  // Effect B pattern: useEffect(() => { if (location.pathname !== '/home') return; const dismissed = engagementService.getDismissedAnchorIds(); ...filter... }, [location.pathname])
  assert.match(src, /engagementService\.getDismissedAnchorIds\(\)/);
  // The getDismissedAnchorIds() call must be inside a useEffect whose deps array is [location.pathname]
  const dismissCallIdx = src.indexOf('engagementService.getDismissedAnchorIds()');
  assert.ok(dismissCallIdx > 0, 'engagementService.getDismissedAnchorIds() must be referenced');
  // Find the next "}, [...])" closing deps array after the call site
  const trailing = src.slice(dismissCallIdx, dismissCallIdx + 800);
  assert.match(trailing, /\}\s*,\s*\[location\.pathname\]\s*\)/, 'engagementService.getDismissedAnchorIds() must appear inside a useEffect with [location.pathname] deps');
  // Effect B also filters in-place (no refetch)
  assert.match(src, /dismissed\.includes|!dismissed\.includes/);
});

test('43-06 dual-effect: BOTH Effect A and Effect B exist (sibling-effects pattern per HomeScreen.exploredAnchors-resync precedent)', () => {
  // Effect A indicator: ANCHOR_DISMISSED subscribe
  assert.match(src, /eventBus\.subscribe\(\s*['"]ANCHOR_DISMISSED['"]/);
  // Effect B indicator: getDismissedAnchorIds inside [location.pathname]
  assert.match(src, /engagementService\.getDismissedAnchorIds/);
  // [location.pathname] deps array appears at least 3 times in HomeScreen.tsx:
  //   - existing Phase 36-14 cached-posts + warm-start fallback effect
  //   - existing Phase 36-14 explored-anchors + credit-awarded resync effect
  //   - new Effect B engagement resync
  const locPathnameMatches = (src.match(/\[location\.pathname\]/g) || []).length;
  assert.ok(locPathnameMatches >= 3, `Expected at least 3 [location.pathname] resync effects (2 Phase 36-14 canonical + 1 new Effect B), found ${locPathnameMatches}`);
});

test('43-06 in-place filter only: neither effect calls conceptFeedService.getDailyPosts (LP-05 operator decision)', () => {
  // Slice the source around each effect site and confirm no getDailyPosts call inside
  const subStart = src.indexOf("subscribe('ANCHOR_DISMISSED'");
  const handlerRegion = src.slice(subStart, subStart + 600);
  assert.doesNotMatch(handlerRegion, /conceptFeedService\.getDailyPosts/);

  const dismissCallIdx = src.indexOf('engagementService.getDismissedAnchorIds()');
  const effectBRegion = src.slice(Math.max(0, dismissCallIdx - 200), dismissCallIdx + 400);
  assert.doesNotMatch(effectBRegion, /conceptFeedService\.getDailyPosts/);
});

test('43-06 Effect C: ENGAGEMENT_CHANGED subscription bumps engagementVersion (LP-03)', () => {
  assert.match(src, /eventBus\.subscribe\(\s*['"]ENGAGEMENT_CHANGED['"]/);
  assert.match(src, /setEngagementVersion\(\s*\w+\s*=>\s*\w+\s*\+\s*1\s*\)/);
});

test('43-06: LongPressMenu hosted at HomeScreen level with all four props', () => {
  assert.match(src, /<LongPressMenu/);
  assert.match(src, /open=\{menuOpen\}/);
  assert.match(src, /onClose=\{closeMenu\}/);
  assert.match(src, /postId=\{menuPostId\}/);
  assert.match(src, /anchorId=\{menuAnchorId\}/);
});

test('43-06: MasonryFeed receives onLongPress + engagementVersion props', () => {
  assert.match(src, /<MasonryFeed[\s\S]*?onLongPress=\{handleLongPress\}/);
  assert.match(src, /<MasonryFeed[\s\S]*?engagementVersion=\{engagementVersion\}/);
});

test('SV-02: Bookmark icon entry button navigates to /saved', () => {
  assert.match(src, /import \{[^}]*Bookmark[^}]*\}\s+from\s+['"]lucide-react['"]/);
  assert.match(src, /<Bookmark\s+size=\{22\}/);
  assert.match(src, /navigate\(['"]\/saved['"]\)/);
  assert.match(src, /aria-label=\{t\(['"]saved\.title['"]\)\}/);
  // WCAG floor enforced
  assert.match(src, /minWidth:\s*['"]44px['"]/);
  assert.match(src, /minHeight:\s*['"]44px['"]/);
});

test('SV-02 layering: fixed position + zIndex 195 (above compact VineProgress bar at 190)', () => {
  // Bookmark button block should have position: fixed and zIndex: 195
  const bookmarkBlock = src.indexOf("aria-label={t('saved.title')}");
  assert.ok(bookmarkBlock > 0);
  const region = src.slice(bookmarkBlock - 500, bookmarkBlock + 300);
  assert.match(region, /position:\s*['"]fixed['"]/);
  assert.match(region, /zIndex:\s*195/);
});

test('Phase 32.1 invariant preserved: no new transform/will-change/filter/contain/perspective on HomeScreen ancestors', () => {
  assert.strictEqual((src.match(/transform:\s*translateZ/g) || []).length, 0, 'No translateZ added to HomeScreen ancestor');
  assert.strictEqual((src.match(/will-change:|willChange:/g) || []).length, 0, 'No will-change added');
  assert.strictEqual((src.match(/perspective:/g) || []).length, 0, 'No perspective added');
});

test('Phase 36-14 invariant preserved: existing [location.pathname] resync effects untouched (3+ total after Effect B joins as sibling)', () => {
  // After Effect B, [location.pathname] should appear at least 3 times:
  //   - cached-posts warm-start re-fallback (Phase 36-14 existing)
  //   - explored-anchors + credit-awarded resync (Phase 36-14 existing)
  //   - Effect B engagement resync (Phase 43 new)
  const locPathnameMatches = (src.match(/\[location\.pathname\]/g) || []).length;
  assert.ok(locPathnameMatches >= 3, `Expected at least 3 [location.pathname] resync effects after Phase 43 Effect B joins, found ${locPathnameMatches}`);
});
