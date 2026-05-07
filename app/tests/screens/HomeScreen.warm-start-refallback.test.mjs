// Phase 36-14 regression guard: ensures HomeScreen.tsx's /home-navigation
// effect (currently around line 172) falls back to postQueueService.
// getYesterdayQueue() when conceptFeedService.getCachedDailyPosts() returns
// [], mirroring the line-38 useState initializer's tier-2 cold-start chain.
//
// Without this re-fallback, after Plan 36-15's SettingsDataScreen mutation
// invalidates the daily-posts cache (so loadCache() returns null), the
// navigation effect calls setDailyPosts([]) and the feed renders empty —
// even though the rehydrated _state.posts (Plan 36-11 Task 2) is sitting
// in localStorage waiting to be served. The async getDailyPosts(questions)
// flow that would consume the rehydrated state only fires on the
// [questions, questionsLoading] mount-effect, NOT on navigation.
//
// See .planning/debug/feed-not-auto-populating-after-force-new-day.md.
//
// Source-reading test — same pattern as HomeScreen.warm-start-guard.test.mjs
// (which guards the mount-time initializer; this guards the runtime mirror
// at navigation time).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_PATH, 'utf-8');

// Slice the source to the navigation-time effect region. The line-172
// effect is the FIRST useEffect in the file with `[location.pathname]`
// as its dep array (the new vine resync at Task-1 Edit B is the SECOND;
// the CONCEPT_EXPLORED subscription has `[]`, not [location.pathname]).
// Use the comment marker introduced in Task 1 Edit A as the anchor.
function getNavEffectSlice() {
  const startMarker = '// Re-sync feed from cache when navigating back to /home';
  const endMarker = '}, [location.pathname]);';
  const startIdx = source.indexOf(startMarker);
  assert.ok(
    startIdx !== -1,
    'Could not locate the navigation-time effect comment marker. Task 1 Edit A may have changed the comment text; update this test marker if so.',
  );
  // Find the FIRST closing `}, [location.pathname]);` after the comment.
  const endIdx = source.indexOf(endMarker, startIdx);
  assert.ok(
    endIdx !== -1,
    'Could not locate the navigation-time effect closing brace `}, [location.pathname]);`',
  );
  return source.slice(startIdx, endIdx + endMarker.length);
}

describe('HomeScreen warm-start re-fallback on /home navigation (Phase 36-14)', () => {
  it('preserves the primary branch — setDailyPosts(conceptFeedService.getCachedDailyPosts()) (Plan 36-11 contract regression guard)', () => {
    const slice = getNavEffectSlice();
    assert.match(
      slice,
      /conceptFeedService\.getCachedDailyPosts\(\)/,
      'The /home-navigation effect must still call `conceptFeedService.getCachedDailyPosts()` as the primary branch. Plan 36-11\'s rehydrate path relies on this resync to surface yesterday\'s served posts on cold-start. Removing it would regress sub-issue (b cause #1) AND the warm-start cold-start contract.',
    );
    assert.match(
      slice,
      /setDailyPosts\(/,
      'The /home-navigation effect must call `setDailyPosts(...)` (the resync writes to React state).',
    );
  });

  it('falls back to postQueueService.getYesterdayQueue() when the primary branch returns []', () => {
    const slice = getNavEffectSlice();
    assert.match(
      slice,
      /postQueueService\.getYesterdayQueue\(\)/,
      'The /home-navigation effect must fall back to `postQueueService.getYesterdayQueue()` when the primary getCachedDailyPosts() branch returns []. Without this, after Plan 36-15\'s SettingsDataScreen mutation invalidates the daily-posts cache, the feed renders empty even though the rehydrated _state.posts is available. See round-4 sub-issue (b) runtime half.',
    );
  });

  it('wires the yesterday-queue fallback to setDailyPosts (i.e., the fallback is consumed, not just declared)', () => {
    const slice = getNavEffectSlice();
    // Match a setDailyPosts call inside the same slice that contains the
    // getYesterdayQueue reference, with a variable bridge between them
    // (the slice declares `const yesterdayQueue = ...getYesterdayQueue()`
    // then calls `setDailyPosts(yesterdayQueue.slice(0, 8))`). Tolerant
    // of variable naming and slicing details.
    assert.match(
      slice,
      /getYesterdayQueue\(\)[\s\S]*?setDailyPosts\(/,
      'The /home-navigation effect must call setDailyPosts(...) after fetching getYesterdayQueue() — otherwise the fallback computes the value but never writes it to React state.',
    );
  });

  it('calls postQueueService.loadQueue() before reading yesterday queue (defensive re-load)', () => {
    const slice = getNavEffectSlice();
    assert.match(
      slice,
      /postQueueService\.loadQueue\(\)[\s\S]*?postQueueService\.getYesterdayQueue\(\)/,
      'The /home-navigation effect should call `postQueueService.loadQueue()` before `getYesterdayQueue()` so the in-memory _state is freshly synced with localStorage (defensive against fast Settings → /home navigation where the SettingsDataScreen handler may not have called loadQueue yet — though it does).',
    );
  });
});
