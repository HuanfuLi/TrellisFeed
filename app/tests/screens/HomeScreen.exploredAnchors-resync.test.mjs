// Phase 36-14 regression guard: ensures HomeScreen.tsx re-reads dailyReadService
// state on every navigation to /home, not just on initial mount.
//
// HomeScreen is always-mounted in SwipeTabContainer, so useState/useRef
// initializers run once on app boot. Without an explicit resync effect, a
// service-level reset (e.g. dailyReadService.reset() called from the
// Force-New-Day dev button or any future caller) leaves the React state
// stale until the next CONCEPT_EXPLORED event happens to push a fresh read.
// See .planning/debug/vine-chip-not-clearing-after-force-new-day.md.
//
// Source-reading test — same pattern as HomeScreen.warm-start-guard.test.mjs
// and SettingsDataScreen.force-new-day.test.mjs. The i18n chain blocks
// importing screens directly under node --test.
//
// Anchor-pair extraction: the resync MUST live in the new sibling effect
// declared between `creditAwardedRef = useRef(...)` and the next
// `eventBus.subscribe('CONCEPT_EXPLORED'`. A naive regex over the whole
// file source could false-positive by matching across multiple effects
// (e.g. matching `useEffect(() => {` from the line-172 effect, capturing
// `setExploredAnchors(...)` from the CONCEPT_EXPLORED handler). Slicing
// the source down to the anchor pair eliminates that vector.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_PATH, 'utf-8');

// Slice the source to the region between the creditAwardedRef declaration
// and the next CONCEPT_EXPLORED subscription. The new vine-resync effect
// must live in this slice; matches outside it indicate the effect is
// misplaced or the test pattern is regressing.
function getVineResyncSlice() {
  const startMarker = 'creditAwardedRef = useRef(';
  const endMarker = "eventBus.subscribe('CONCEPT_EXPLORED'";
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    `Could not locate vine-resync anchor pair (creditAwardedRef = useRef → eventBus.subscribe('CONCEPT_EXPLORED')). startIdx=${startIdx}, endIdx=${endIdx}. The HomeScreen.tsx file structure may have changed; update the markers in this test.`,
  );
  return source.slice(startIdx, endIdx);
}

describe('HomeScreen vine state resync on /home navigation (Phase 36-14)', () => {
  it('declares an effect (between creditAwardedRef and CONCEPT_EXPLORED) that resyncs setExploredAnchors when location.pathname === "/home"', () => {
    const slice = getVineResyncSlice();
    assert.match(
      slice,
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?location\.pathname\s*===\s*['"]\/home['"][\s\S]*?setExploredAnchors\(dailyReadService\.getExploredAnchors\(\)\)[\s\S]*?\},\s*\[location\.pathname\]\)/,
      'HomeScreen.tsx must declare a useEffect (between the creditAwardedRef declaration and the CONCEPT_EXPLORED subscription) that calls `setExploredAnchors(dailyReadService.getExploredAnchors())` when `location.pathname === "/home"`. Without this, the vine progress chip stays at yesterday\'s count after Force New Day because HomeScreen never remounts. See round-4 sub-issue (a) and .planning/debug/vine-chip-not-clearing-after-force-new-day.md.',
    );
  });

  it('the same resync slice also resets creditAwardedRef from dailyReadService.isCreditAwarded()', () => {
    const slice = getVineResyncSlice();
    assert.match(
      slice,
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?location\.pathname\s*===\s*['"]\/home['"][\s\S]*?creditAwardedRef\.current\s*=\s*dailyReadService\.isCreditAwarded\(\)[\s\S]*?\},\s*\[location\.pathname\]\)/,
      'HomeScreen.tsx must reset `creditAwardedRef.current = dailyReadService.isCreditAwarded()` inside the same /home-navigation effect that resyncs exploredAnchors. Without this, the celebration gate at line ~516 stays closed (creditAwardedRef holds yesterday\'s true) and the user does not see confetti when finishing the vine on a simulated new day.',
    );
  });

  it('preserves the CONCEPT_EXPLORED subscription (in-session updates without a route change)', () => {
    // Defensive: the in-session update path (PostDetailScreen detectors
    // emit CONCEPT_EXPLORED → HomeScreen re-reads exploredAnchors) must
    // still work for normal mid-day exploration. The new /home-navigation
    // resync covers the cross-day case but NOT the typical "user opens a
    // post on /home, returns to /home" same-pathname case.
    assert.match(
      source,
      /eventBus\.subscribe\(['"]CONCEPT_EXPLORED['"][\s\S]*?setExploredAnchors\(dailyReadService\.getExploredAnchors\(\)\)/,
      'HomeScreen.tsx must preserve the CONCEPT_EXPLORED event-bus subscription that updates exploredAnchors mid-day.',
    );
  });
});
