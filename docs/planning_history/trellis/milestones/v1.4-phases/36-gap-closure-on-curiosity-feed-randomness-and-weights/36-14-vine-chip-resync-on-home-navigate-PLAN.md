---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 14
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/screens/HomeScreen.tsx
  - app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs
  - app/tests/screens/HomeScreen.warm-start-refallback.test.mjs
  - CLAUDE.md
autonomous: true
requirements: [GAP-D-round4-a, GAP-D-round4-b-runtime]
gap_closure: true
must_haves:
  truths:
    - "After Force New Day, the vine progress chip on /home shows 0/N (matches natural midnight rollover behavior)."
    - "After Force New Day, /home INSTANTLY shows yesterday's UNSERVED queue posts (no manual swipe needed) — the feed auto-populates from postQueueService.getYesterdayQueue() when conceptFeedService.getCachedDailyPosts() is empty on /home navigation."
    - "HomeScreen's location.pathname === '/home' effect (1) re-syncs dailyPosts from cache, (2) falls back to yesterday's rehydrated queue when cache is empty (mirrors line-38 useState initializer logic), (3) re-syncs exploredAnchors from dailyReadService, (4) resets creditAwardedRef from dailyReadService.isCreditAwarded() — on every navigation to /home, not just on initial mount."
    - "creditAwardedRef.current is reset to dailyReadService.isCreditAwarded() on /home navigation, so the celebration gate at HomeScreen.tsx:516 fires when the user finishes the vine on the simulated new day."
    - "Plan 36-11 + Plan 36-13 contracts preserved: dailyReadService.reset() is still called by handleForceNewDay (Plan 36-13); the rehydrate path on post-queue (Plan 36-11) is unchanged; the existing setDailyPosts(getCachedDailyPosts()) primary path (Plan 36-11 contract) remains as the FIRST branch of the new effect. Sub-issues (c), (d), (e) closed by Plans 36-11/12 remain green."
    - "Source-reading regression tests pin the resync sites so a future refactor cannot silently drop them (matches the prevention pattern of HomeScreen.warm-start-guard.test.mjs and SettingsDataScreen.force-new-day.test.mjs)."
  artifacts:
    - path: app/src/screens/HomeScreen.tsx
      provides: "Extended location.pathname effect that (a) calls setDailyPosts with cache OR yesterday-queue fallback, (b) calls setExploredAnchors, (c) resets creditAwardedRef — on every /home navigation"
    - path: app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs
      provides: "Source-reading guard via anchor-pair extraction that the vine resync references both setExploredAnchors and creditAwardedRef inside the post-creditAwardedRef effect"
    - path: app/tests/screens/HomeScreen.warm-start-refallback.test.mjs
      provides: "Source-reading guard that the dailyPosts resync effect falls back to postQueueService.getYesterdayQueue() when getCachedDailyPosts() returns []"
    - path: CLAUDE.md
      provides: "New bullet under Concept Feed Generation Pipeline → 'Numeric defaults' documenting the always-mounted-state-resync principle"
  key_links:
    - via: "function call"
      from: app/src/screens/HomeScreen.tsx
      pattern: "setExploredAnchors\\(dailyReadService\\.getExploredAnchors\\(\\)\\)"
    - via: "function call"
      from: app/src/screens/HomeScreen.tsx
      pattern: "creditAwardedRef\\.current = dailyReadService\\.isCreditAwarded\\(\\)"
    - via: "function call"
      from: app/src/screens/HomeScreen.tsx
      pattern: "postQueueService\\.getYesterdayQueue\\(\\)"
---

# Plan 36-14 — Re-sync vine state + warm-start re-fallback on /home navigation

## Objective

Close round-4 sub-issues (a) AND the runtime half of (b):

- **Sub-issue (a):** vine progress chip on /home keeps showing yesterday's `exploredCount` after Force New Day. Plan 36-13 added `dailyReadService.reset()` (persistence is cleared) but HomeScreen's React state doesn't re-read the service after navigation. Fix: re-read `dailyReadService.getExploredAnchors()` and reset `creditAwardedRef` on every /home navigation.
- **Sub-issue (b) RUNTIME:** Plan 36-15 makes `loadCache()` reject the stale daily-posts cache (returns `null` → `getCachedDailyPosts()` returns `[]`), but the existing line-172 effect just calls `setDailyPosts([])`. The async `getDailyPosts(questions)` flow that would consume the rehydrated `_state.posts` only runs in the `[questions, questionsLoading]` mount-effect. Fix: when `getCachedDailyPosts()` returns `[]` on /home navigation, fall back to `postQueueService.getYesterdayQueue()` — the SAME fallback chain the line-38 useState initializer uses for cold-start. This is the runtime mirror of the mount-only initializer.

**Why this plan owns the runtime fix for sub-issue (b) instead of Plan 36-15:** the runtime mirror lives in HomeScreen.tsx, which Plan 36-15 already overlapped on in the original draft. Consolidating all HomeScreen.tsx edits here keeps Plan 36-15 a small surgical revert + test inversion, eliminates wave-1 file overlap, and groups both /home-navigation fixes (vine state AND warm-start re-fallback) under a single coherent truth — "navigation to /home re-syncs ALL always-mounted-state from underlying services/storage." Plan 36-15 still owns the SettingsDataScreen storage mutation; without that mutation, this plan's re-fallback never triggers (cache is non-empty → primary branch wins). They are complementary, not redundant.

## Background

See `.planning/debug/vine-chip-not-clearing-after-force-new-day.md` and `.planning/debug/feed-not-auto-populating-after-force-new-day.md` for the full root-cause walkthroughs. Summary:

- HomeScreen is one of 5 always-mounted slots in `SwipeTabContainer` (CLAUDE.md "Header positioning"). `navigate('/home')` does NOT remount it.
- `exploredAnchors` is `useState(() => dailyReadService.getExploredAnchors())` (HomeScreen.tsx:442) — initializer runs once on app boot, never again.
- `creditAwardedRef = useRef(dailyReadService.isCreditAwarded())` (HomeScreen.tsx:475) has the same mount-frozen problem and blocks the celebration on simulated new day.
- `dailyPosts` initializer at HomeScreen.tsx:38-47 has a 3-tier fallback chain (cache → yesterday-queue → history) for cold-start. The line-172 navigation effect only does tier 1 (`setDailyPosts(conceptFeedService.getCachedDailyPosts())`). When tier 1 is empty AND tier 2 (`postQueueService.getYesterdayQueue()`) has unserved posts, the navigation effect today renders an empty feed instead of the warm-start that the initializer would have rendered.
- The only post-mount setter for `exploredAnchors` (HomeScreen.tsx:478-483) is gated on `CONCEPT_EXPLORED`, which `dailyReadService.reset()` never emits.
- Adding all three resync clauses to the single `[location.pathname]` effect chain is a precedent-following change.

**Why option (b) (piggyback on /home navigation) over option (a) (new event):** option (a) would add a `DAILY_READ_RESET` (or similar) variant to the AppEvent union and require dailyReadService to emit it on `reset()`. That works, but every future caller of `reset()` would need to remember to fire the event (or we couple service to event-bus). Option (b) makes the resync triggered by the user-observable event the chip cares about (navigation to /home). It piggybacks on the existing pattern at lines 172-176 and is a one-file change. Lower blast radius, no architectural change.

This plan is parallel-safe with Plan 36-15 (different files entirely — Plan 36-15 only touches `SettingsDataScreen.tsx` + the existing force-new-day test file).

## Tasks

### Task 1 — Widen the existing `[location.pathname]` effect with warm-start re-fallback; add a sibling effect for vine state

**File:** `app/src/screens/HomeScreen.tsx`

**Action:**

There are TWO source-position constraints that shape this fix:

1. The existing `[location.pathname]` effect (currently at lines 172-176) lives BEFORE the `setExploredAnchors` and `creditAwardedRef` declarations (lines 442 and 475). React function components run top-to-bottom; while JS closures DO resolve identifiers at call time (so a callback at line 172 referencing line-475 identifiers is technically valid), a reader scanning HomeScreen.tsx top-to-bottom would be surprised by such a forward reference. Splitting the vine resync into a SECOND effect placed adjacent to its useState/useRef declarations is more readable.

2. The dailyPosts re-fallback MUST live inside the existing line-172 effect (or a same-position widen) — the function symbols it needs (`setDailyPosts`, `conceptFeedService`, `postQueueService`) are all imported at the top of the file or declared via `useState` at line 38, so they're in scope for both positions. The line-172 widen is structurally simpler and reuses the same effect dependency array.

**Two edits, both atomic in the same file:**

#### Edit A — Widen the existing line-172 effect with warm-start re-fallback (sub-issue (b) runtime mirror)

Locate the existing block at HomeScreen.tsx:171-176 (current text):

```typescript
  // Re-sync feed from cache when navigating back to /home
  useEffect(() => {
    if (location.pathname === '/home') {
      setDailyPosts(conceptFeedService.getCachedDailyPosts());
    }
  }, [location.pathname]);
```

Replace it with the following expanded form. The expansion (1) keeps the existing `setDailyPosts(getCachedDailyPosts())` as the primary branch (Plan 36-11 contract — DO NOT remove it; the existing test in Plan 36-15 will assert this branch is preserved), (2) adds a fallback to `postQueueService.getYesterdayQueue()` when the primary branch returned `[]`, mirroring tier 2 of the line-38 useState initializer's cold-start chain.

```typescript
  // Re-sync feed from cache when navigating back to /home.
  // Mirrors the line-38 useState initializer's fallback chain (tier 1: cache,
  // tier 2: yesterday's rehydrated queue). The initializer runs ONCE at mount
  // — HomeScreen is always-mounted in SwipeTabContainer, so navigate('/home')
  // does NOT remount it. Without this re-fallback, after Plan 36-15's
  // SettingsDataScreen mutation invalidates the daily-posts cache,
  // getCachedDailyPosts() returns [] and the feed renders empty — the
  // rehydrated _state.posts (Plan 36-11 Task 2) sits unreachable until the
  // next async getDailyPosts run (which is mount-only, not navigation-fired).
  // Phase 36-14 — closes the runtime half of round-4 sub-issue (b).
  useEffect(() => {
    if (location.pathname !== '/home') return;
    const cached = conceptFeedService.getCachedDailyPosts();
    if (cached.length > 0) {
      setDailyPosts(cached);
      return;
    }
    // Tier-2 fallback: yesterday's UNSERVED queue, rehydrated by
    // postQueueService.load()'s date-mismatch branch (Plan 36-11 Task 2).
    // This is the runtime mirror of the line-38 useState initializer's tier 2.
    postQueueService.loadQueue();
    const yesterdayQueue = postQueueService.getYesterdayQueue();
    if (yesterdayQueue.length > 0) {
      setDailyPosts(yesterdayQueue.slice(0, 8));
      return;
    }
    // Both tiers empty — preserve current behavior (set to empty so the
    // generic empty-state rendering takes over). The async getDailyPosts
    // flow elsewhere will repopulate when its triggers fire.
    setDailyPosts([]);
  }, [location.pathname]);
```

Notes on the form:
- Tier 3 (`postHistoryService.getPosts().slice(0, 4)`) from the line-38 initializer is intentionally NOT mirrored here. The mount-time initializer uses tier 3 as a last-ditch "show SOMETHING on first paint" — at navigation time the user has already been in the app and a momentary empty state is acceptable.
- `postQueueService.loadQueue()` is called BEFORE `getYesterdayQueue()` to defensively reload `_state` from localStorage. After Plan 36-15's SettingsDataScreen mutation runs, localStorage is updated but the in-memory `_state` may not have re-read yet if the user navigated to /home faster than the SettingsDataScreen handler finishes (unlikely but cheap to guard).
- The `setDailyPosts([])` in the both-tiers-empty branch is not strictly necessary today (the previous code did the same thing implicitly) but is explicit so a reader sees the three tiers symmetrically.

#### Edit B — Add a NEW sibling effect for vine state, placed after line 475

Add the following NEW effect IMMEDIATELY after the `creditAwardedRef = useRef(...)` declaration (currently line 475) and BEFORE the existing `CONCEPT_EXPLORED` subscription effect (currently line 478). All referenced identifiers are in scope at parse time at this position: `location` from `useLocation` (line 33), `setExploredAnchors` from `useState` destructure (line 442), `creditAwardedRef` from `useRef` (line 475), `dailyReadService` imported at line 23.

```typescript
  // Re-sync daily-read state from service when navigating back to /home.
  // HomeScreen is always-mounted in SwipeTabContainer (see CLAUDE.md
  // "Header positioning"), so navigate('/home') does NOT remount this
  // component — useState/useRef initializers run once on app boot and never
  // again. Without this resync, dailyReadService.reset() (called from
  // SettingsDataScreen's Force-New-Day handler) clears persistence but the
  // React state retains yesterday's exploredAnchors and creditAwardedRef
  // keeps yesterday's "true". Result: vine chip on /home still shows
  // yesterday's count, celebration gate at line ~516 is permanently closed.
  // Phase 36-14 — closes round-4 sub-issue (a).
  useEffect(() => {
    if (location.pathname === '/home') {
      setExploredAnchors(dailyReadService.getExploredAnchors());
      creditAwardedRef.current = dailyReadService.isCreditAwarded();
    }
  }, [location.pathname]);
```

**Don't touch:**
- The CONCEPT_EXPLORED subscription effect (lines 477-484 currently) — still load-bearing for in-session updates that don't involve a route change.
- The `useState(() => dailyReadService.getExploredAnchors())` initializer at line 442 — still correct for the initial-mount case.
- The `useRef(dailyReadService.isCreditAwarded())` initializer at line 475 — still correct for the initial-mount case.
- The line-38 `useState<DailyPost[]>(() => ...)` initializer with its 3-tier chain — Edit A mirrors tiers 1 + 2 at navigation time but the initializer itself stays as-is for mount.

**Why TWO effects rather than one widened block:** the line-172 effect runs on a separate dependency array (`[location.pathname]`) AND lives at file source position 172, before `setExploredAnchors`/`creditAwardedRef` are declared. While `[location.pathname]` is the same dependency array as the new sibling effect, fusing them at line 172 would force forward-references that a top-to-bottom reader would find surprising. Two effects with the same dep-array fire in the same React commit phase — there is no observable behavior difference vs one fused effect. Readability wins.

**Verification (compile):**

```bash
cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit
```

Exit 0 expected.

**Commit:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "fix(36-14): re-sync vine state + warm-start re-fallback on /home navigation (closes round-4 sub-issues a + b runtime)" --files app/src/screens/HomeScreen.tsx
```

===

### Task 2 — Source-reading regression test for vine resync (anchor-pair extraction)

**File:** `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` (NEW)

**Action:**

The Plan 36-13 force-new-day test demonstrates the anchor-pair extraction pattern that prevents regex false-positives across multi-effect spans. Apply the same pattern here: extract the source slice between `creditAwardedRef = useRef(...)` (the declaration line) and the next `eventBus.subscribe('CONCEPT_EXPLORED'` (the start of the existing CONCEPT_EXPLORED effect). Anything matching inside that slice is GUARANTEED to be inside the new sibling effect — not the line-172 effect, not the CONCEPT_EXPLORED handler.

```javascript
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
```

**Verification:**

```bash
cd /Users/Code/EchoLearn/app && node --test tests/screens/HomeScreen.exploredAnchors-resync.test.mjs
```

Expected: 3 GREEN.

**Commit:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test(36-14): pin vine resync via anchor-pair extraction (creditAwardedRef → CONCEPT_EXPLORED)" --files app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs
```

===

### Task 3 — Source-reading regression test for warm-start re-fallback on navigation

**File:** `app/tests/screens/HomeScreen.warm-start-refallback.test.mjs` (NEW)

**Action:**

Mirror the structural pattern of `HomeScreen.warm-start-guard.test.mjs` (which guards the line-38 useState initializer's tier-2 fallback) but for the navigation-time mirror. The test asserts:

1. The line-172 effect's body still calls `conceptFeedService.getCachedDailyPosts()` as the primary branch (Plan 36-11 contract preservation — regression guard).
2. The same effect's body falls back to `postQueueService.getYesterdayQueue()` when the primary branch returns `[]`.
3. The fallback assigns the result to `setDailyPosts(...)` (i.e., the fallback is wired, not just declared).

```javascript
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
```

**Verification:**

```bash
cd /Users/Code/EchoLearn/app && node --test tests/screens/HomeScreen.warm-start-refallback.test.mjs
```

Expected: 4 GREEN.

**Commit:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test(36-14): pin warm-start re-fallback on /home navigation (sub-issue b runtime)" --files app/tests/screens/HomeScreen.warm-start-refallback.test.mjs
```

===

### Task 4 — CLAUDE.md doc-sync (always-mounted-state principle)

**File:** `CLAUDE.md`

**Action:**

The "dev button must mimic every wall-clock side effect" principle from Plan 36-13's pattern-established list, combined with the "always-mounted screens need explicit resync" principle that Plan 36-14 establishes, are both general principles that future agents will hit again. They're not yet in CLAUDE.md.

Add a NEW bullet under the "Concept Feed Generation Pipeline" section's "Numeric defaults" list, near the "New-day rehydration (Phase 36-11)" bullet that's already there. Place it AFTER the new-day-rehydration bullet so the two related bullets sit together.

Phrase it as a load-bearing rule, not as historical narrative:

```markdown
- **Always-mounted screens must explicitly re-read service state on /home navigation (Phase 36-14):** HomeScreen, PlannerScreen, AskScreen, GraphScreen, and SettingsScreen are all always-mounted slots in `SwipeTabContainer` (see "Header positioning" section). `useState(() => svc.get())` initializers fire ONCE at app boot — they never re-run on `navigate('/home')` (or to any other top-level swipe route). Any screen that reads from a service whose state can change while another screen is in the foreground (e.g., `dailyReadService` reset by Force-New-Day in SettingsDataScreen, or any future cross-screen state mutation) MUST add a `useEffect` that re-reads the service when its `location.pathname` matches the screen's route. HomeScreen.tsx has the canonical pattern: one effect re-syncs `dailyPosts` from `conceptFeedService.getCachedDailyPosts()` with a fallback to `postQueueService.getYesterdayQueue()` when the cache is empty (Plan 36-11 + 36-14 — mirroring the line-38 useState initializer's tier-1/tier-2 chain at runtime), another sibling effect re-syncs `exploredAnchors` + `creditAwardedRef` from `dailyReadService` (Plan 36-14). Tests at `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` and `app/tests/screens/HomeScreen.warm-start-refallback.test.mjs` enforce both resyncs structurally via anchor-pair extraction. Related principle: when a dev affordance simulates a wall-clock event the service code can't observe (e.g., `today()` cannot advance under Force-New-Day), the dev handler must explicitly call every service `reset()` AND mutate every date-stamped storage key that the natural event would have triggered, AND any always-mounted screen reading the service must re-sync on navigation. Single source of asymmetry → three layers of defense (handler mutates storage; rejection-on-mismatch fires on next read; navigation effect re-pulls from service).
```

**Don't touch:**
- Other sections of CLAUDE.md
- The existing "New-day rehydration (Phase 36-11)" bullet
- The "Header positioning" section (already cross-references this)

**Verification:**

```bash
grep -c "Always-mounted screens must explicitly re-read" /Users/Code/EchoLearn/CLAUDE.md
```

Expected: ≥1.

**Commit:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(36-14): document always-mounted-screen state-resync principle" --files CLAUDE.md
```

===

## Verification (post-execution)

Plan-specific tests:

```bash
cd /Users/Code/EchoLearn/app && node --test tests/screens/HomeScreen.exploredAnchors-resync.test.mjs tests/screens/HomeScreen.warm-start-refallback.test.mjs
```

Expected: 7 GREEN total (3 in exploredAnchors-resync + 4 in warm-start-refallback).

Full Phase 36 quick suite (must remain GREEN — sub-issues c/d/e regressions check). The suite gains TWO new test files relative to the post-Plan-36-13 list (15 files total: the original 13 from Plan 36-13's verification block + Plan 36-14's 2 new files). Note that Plan 36-15 runs in parallel and adds 0 new test files (Plan 36-15 only inverts an existing test in place), so the post-wave-1 suite is also 15 files:

```bash
cd /Users/Code/EchoLearn/app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-yesterday-snapshot.test.mjs tests/services/post-queue-rehydrate.test.mjs tests/services/concept-feed-cache-date.test.mjs tests/screens/HomeScreen.warm-start-guard.test.mjs tests/screens/PostDetailScreen.video-detector.test.mjs tests/components/InfoFlow.short-tap-emit.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs tests/screens/HomeScreen.exploredAnchors-resync.test.mjs tests/screens/HomeScreen.warm-start-refallback.test.mjs
```

Expected: all GREEN. The Phase 36 contracts from Plans 36-00 through 36-13 are not touched.

TypeScript clean:

```bash
cd /Users/Code/EchoLearn/app && npx tsc -b --noEmit
```

Exit 0.

CLAUDE.md doc-sync grep:

```bash
grep -c "Always-mounted screens must explicitly re-read" /Users/Code/EchoLearn/CLAUDE.md
```

Expected: ≥1.

Phase preservation greps (must all match — these guard the Plan 36-11/12/13 contracts from regression):

```bash
grep -q "STORAGE_KEY_YESTERDAY" /Users/Code/EchoLearn/app/src/services/post-queue.service.ts
grep -q "USER_ACK_BEFORE_GRAPH_CONTEXT" /Users/Code/EchoLearn/app/src/state/useQuestions.ts
grep -q "MAX_QUEUE_SIZE" /Users/Code/EchoLearn/CLAUDE.md
grep -q "dailyReadService\.reset()" /Users/Code/EchoLearn/app/src/screens/settings/SettingsDataScreen.tsx
```

All four must succeed.

## Success Criteria

- [ ] HomeScreen.tsx's line-172 effect contains BOTH `conceptFeedService.getCachedDailyPosts()` (primary branch) AND `postQueueService.getYesterdayQueue()` (fallback branch), with `setDailyPosts(...)` wired to both.
- [ ] HomeScreen.tsx contains a NEW useEffect (placed between `creditAwardedRef = useRef(...)` declaration and the `eventBus.subscribe('CONCEPT_EXPLORED'` block) with `[location.pathname]` dependency that calls `setExploredAnchors(dailyReadService.getExploredAnchors())` AND assigns `creditAwardedRef.current = dailyReadService.isCreditAwarded()`.
- [ ] `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` exists and reports 3/3 GREEN under `node --test`.
- [ ] `app/tests/screens/HomeScreen.warm-start-refallback.test.mjs` exists and reports 4/4 GREEN under `node --test`.
- [ ] CLAUDE.md contains the new "Always-mounted screens must explicitly re-read service state on /home navigation" bullet.
- [ ] No other tests regress: full Phase 36 quick suite (15 files) stays GREEN.
- [ ] `npx tsc -b --noEmit` exits 0.
- [ ] All four phase-preservation greps pass.

## Output

After completion, create `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-14-SUMMARY.md` documenting:
- Why Option A (consolidate runtime fix into Plan 36-14) was chosen over Options B/C: the runtime mirror lives in HomeScreen.tsx, which Plan 36-15's original draft also overlapped on. Consolidating eliminates wave-1 file overlap and groups both /home-navigation fixes (vine state AND warm-start re-fallback) under a single coherent truth.
- The chosen design for sub-issue (a) (option b — piggyback on location.pathname effect via a new sibling effect placed after creditAwardedRef declaration, NOT new event)
- The chosen design for sub-issue (b) runtime (widen line-172 effect to mirror tier-1/tier-2 of line-38 useState initializer's fallback chain)
- The complementary nature of Plans 36-14 and 36-15: Plan 36-15 mutates the storage so loadCache rejects (the trigger); Plan 36-14 adds the fallback that actually populates the feed when loadCache rejects (the consequence). Without 36-15, Plan 36-14's fallback never fires (cache stays warm). Without 36-14, Plan 36-15's mutation just produces an empty feed.
- Test count delta (+7 source-reading: 3 exploredAnchors-resync + 4 warm-start-refallback)
- CLAUDE.md doc-sync content
- Self-check that this plan's changes do NOT regress sub-issues (c), (d), (e) closed by Plans 36-11/12 (the rehydration path is unchanged; the dailyPosts primary branch at HomeScreen.tsx:172 is preserved with explicit regression guard via Test 3.1; the post-queue mutex from 36-12 is unrelated).
