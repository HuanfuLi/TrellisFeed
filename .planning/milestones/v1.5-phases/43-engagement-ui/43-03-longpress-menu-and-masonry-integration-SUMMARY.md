---
phase: 43-engagement-ui
plan: 03
subsystem: ui
tags: [react, framer-motion, animate-presence, long-press, bottom-sheet, engagement, masonry, anti-wire, source-reading-tests]

# Dependency graph
requires:
  - phase: 39-engagement-service-walker-extension
    provides: engagementService.savePost/likePost/dismissAnchor/isSaved/isLiked + ENGAGEMENT_CHANGED / ANCHOR_DISMISSED event surface
  - phase: 42-masonry-feed-layout
    provides: MasonryFeed leaf-tile contract (height-accumulating split + framer-motion entrance + navigation-only video tiles)
  - phase: 43-01-shared-infra-and-locales
    provides: useLongPress(480ms) hook + BottomSheet compact prop + engagement.menu.* + engagement.toast.* locale keys + 2 Wave-0 test scaffolds
provides:
  - LongPressMenu.tsx — bottom-sheet contextual menu with 3 stacked rows (Like/Save/Not interested), state-aware label flip, anti-wire invariant
  - MasonryFeed TileWrapper — per-tile long-press binding + click-after-long-press suppression + corner-icon overlay + AnimatePresence exit
  - onLongPress?: (postId, anchorId) => void prop on MasonryFeed (HomeScreen-host owns the LongPressMenu sheet state in 43-06)
  - engagementVersion?: number prop on MasonryFeed (HomeScreen-host bumps on ENGAGEMENT_CHANGED so corner icons re-render across tiles without per-tile subscription)
  - AnimatePresence column wrappers for LP-05 200ms fade-exit on ANCHOR_DISMISSED tile removal
affects:
  - "43-06 (homescreen-wiring) — mounts LongPressMenu, owns { open, postId, anchorId } sheet state, subscribes to ENGAGEMENT_CHANGED + ANCHOR_DISMISSED, passes onLongPress + engagementVersion props to MasonryFeed"
  - "43-04 (saved-screen-and-route) — separate consumer of engagementService (parallel-safe, no contract overlap)"

# Tech tracking
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - "Hook-out-of-loop refactor: extract a top-level component (TileWrapper) above the parent function so useLongPress obeys rules-of-hooks while still binding per-tile"
    - "engagementVersion bump prop: HomeScreen-owned re-render trigger keyed to ENGAGEMENT_CHANGED, propagated via useMemo dep array, avoids per-tile event-bus subscriptions"
    - "AnimatePresence-per-column wrapping (not AnimatePresence-around-the-grid) keeps the height-accumulating layout intact while still triggering coordinated exit transitions"
    - "Corner state icon overlay as absolute-positioned child of position:relative tile wrapper (UI-SPEC §2 pattern); pointer-events: none keeps taps reaching the tile body"
    - "Defense-in-depth anti-wire enforcement: 0 occurrences of CONCEPT_EXPLORED / eventBus.emit / dailyReadService.markExplored in LongPressMenu (engagementService owns ALL emits)"

key-files:
  created:
    - "app/src/components/LongPressMenu.tsx (141 lines; bottom-sheet menu with 3 state-aware rows + anti-wire invariant)"
  modified:
    - "app/src/components/MasonryFeed.tsx (+217/-42; TileWrapper extraction + AnimatePresence column wrapping + corner overlay; final 658 lines)"
    - "app/tests/components/LongPressMenu.test.mjs (7 source-reading assertions; replaces Wave-0 skip stub)"
    - "app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs (7 source-reading assertions; replaces Wave-0 skip stub)"

key-decisions:
  - "Hook-out-of-loop refactor: TileWrapper extracted above MasonryFeed rather than refactoring renderTile to use a Pattern-B per-call hook factory — cleaner separation, single useLongPress call per tile, no rules-of-hooks violations."
  - "engagementVersion as a parent-bumped prop instead of per-tile useEventBus subscription — keeps the leaf cards purely props-driven (Phase 42 D-04 leaf-discipline) and lets HomeScreen own the single ENGAGEMENT_CHANGED subscription."
  - "AnimatePresence per-column instead of one wrapper around the grid — preserves the height-accumulating column split (Phase 42 D-02 invariant) and matches UI-SPEC §4."
  - "Comment de-collision in MasonryFeed inline-play-removal block: 'Detector D (postMessage CONCEPT_EXPLORED on play ≥ 80%)' rewritten to 'Detector D (postMessage explored-anchor signal on play ≥ 80%)' so the Phase 43 anti-wire test's 0-count assertion stays clean. Same Phase 38 lesson (iii) pattern."
  - "Plan acceptance criteria's visibilitychange + IntersectionObserver presence assertions intentionally omitted from MasonryFeed.dismiss-fade-all.test.mjs — Phase 42 UAT-7+8 removed those useEffects when inline video play left the feed surface. Re-introducing the literal tokens would violate CLAUDE.md 'Don't re-introduce inline play in feed cards.' Test-omission documented inline at the test file's header comment."

patterns-established:
  - "Hook-binding wrapper component: when useXxx hooks need per-element binding inside a render loop, extract a parent-defined wrapper component that calls the hook at its own top level. Cleaner than memoized factory functions."
  - "Engagement-state-aware leaf components stay props-driven: read engagementService synchronously inside useMemo with engagementVersion in the dep array; HomeScreen-host bumps the version on ENGAGEMENT_CHANGED."

requirements-completed: [ENGAGE-01, ENGAGE-02, ENGAGE-03]
# Note: these are Wave-1 partial-completion — full closure requires 43-06 (HomeScreen wiring) to mount the sheet
# and 43-04 (SavedScreen) for the Like browsable surface. This plan ships the components ready for those consumers.

# Metrics
duration: 9min
completed: 2026-05-11
---

# Phase 43 Plan 03: Long-press menu + Masonry integration Summary

**LongPressMenu component + MasonryFeed TileWrapper extraction wiring 480ms long-press → bottom-sheet contextual menu (Like/Save/Not interested) with corner-icon overlay + AnimatePresence 200ms fade-exit for LP-05 same-anchor dismiss cascade**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-11T07:37:06Z
- **Completed:** 2026-05-11T07:46:00Z
- **Tasks:** 4
- **Files modified:** 4 (1 created + 3 modified)

## Accomplishments

- **LongPressMenu component shipped** (141 lines) — wraps BottomSheet compact, renders 3 stacked rows with state-aware Save/Unsave + Like/Unlike label flip from engagementService.isSaved/isLiked at render time, dispatches savePost/removeSavedPost/likePost/unlikePost/dismissAnchor with success/info toast variants per LP-03.
- **MasonryFeed TileWrapper extraction + corner-icon overlay + AnimatePresence column wrapping** — useLongPress hook binds 480ms per tile, click-after-long-press suppression via onClickCapture + didLongPress ref, Bookmark + Heart corner icons rendered on saved/liked concept tiles with drop-shadow, both columns wrapped in `<AnimatePresence initial={false}>` so LP-05's same-anchor cascade fades over 200ms instead of popping.
- **onLongPress + engagementVersion props bubbled to host** — HomeScreen (43-06) owns the LongPressMenu sheet state + ENGAGEMENT_CHANGED subscription; this plan defines the contract.
- **Defense-in-depth anti-wire** — LongPressMenu.tsx has 0 occurrences of CONCEPT_EXPLORED, eventBus.emit, or dailyReadService.markExplored. Source-reading test enforces. Same invariant test pattern as Phase 39/40 anti-wire tests.
- **Phase 42 invariants preserved** — no column-count / break-inside / will-change / perspective. MotionConfig reducedMotion="user" wraps return. Inline-play-removal stays enforced (no iframes mount at feed level). 38/38 LongPressMenu + MasonryFeed dismiss-fade + Phase 42 counterweight tests green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LongPressMenu.tsx component (LP-01..LP-04)** — `c08883df` (feat)
2. **Task 2: Fill LongPressMenu.test.mjs scaffold (7 source-reading + anti-wire assertions)** — `abac15da` (test)
3. **Task 3: Extend MasonryFeed.tsx (TileWrapper + corner overlay + AnimatePresence)** — `f77b2bd1` (feat)
4. **Task 4: Fill MasonryFeed.dismiss-fade-all.test.mjs scaffold (7 LP-03/05 + Phase 42 invariant assertions)** — `d82a6994` (test)

**Plan metadata commit:** (pending — added with SUMMARY.md / STATE.md / ROADMAP.md update)

## Files Created/Modified

- `app/src/components/LongPressMenu.tsx` — **NEW** (141 lines) — Bottom-sheet contextual menu with 3 state-aware rows + anti-wire invariant. Consumed by HomeScreen (43-06 host).
- `app/src/components/MasonryFeed.tsx` — **MODIFIED** (+217/-42, final 658 lines) — TileWrapper extraction above MasonryFeed (hook-out-of-loop pattern), AnimatePresence column wrappers (LP-05 fade), corner-icon overlay (UI-SPEC §2), onLongPress + engagementVersion props (43-06 host contract). Phase 42 invariants intact.
- `app/tests/components/LongPressMenu.test.mjs` — **MODIFIED** (skip stub → 7 real source-reading assertions). LP-01 BottomSheet compact, LP-02 icons + handlers, LP-04 state-flip via isSaved/isLiked, row tap engagement-service wiring + onClose ≥3, LP-03 toast variant mapping, anti-wire 0-count invariant (CONCEPT_EXPLORED / eventBus.emit / dailyReadService.markExplored), 56px row floor.
- `app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs` — **MODIFIED** (skip stub → 7 real source-reading assertions). useLongPress @ 480ms, corner icons reading engagement state + drop-shadow filter, AnimatePresence wraps both columns, exit prop opacity 0 + scale 0.96 + 200ms duration, onClickCapture + didLongPress suppression, onLongPress + engagementVersion prop types, Phase 42 negative invariants intact (CONCEPT_EXPLORED / column-count / will-change / perspective all 0; MotionConfig still wraps).

## Source-reading invariant verification

All 4 invariants from the plan's `<output>` block confirmed:

1. **CONCEPT_EXPLORED count in LongPressMenu.tsx:** 0 ✓
2. **CONCEPT_EXPLORED count in MasonryFeed.tsx:** 0 ✓ (after comment de-collision)
3. **column-count count in MasonryFeed.tsx:** 0 ✓ (D-02 height-accumulating split preserved)
4. **will-change count in MasonryFeed.tsx:** 0 ✓ (CLAUDE.md Header positioning rule preserved)

## Decisions Made

- **Hook-out-of-loop refactor — Pattern A (extract TileWrapper) chosen over Pattern B (per-call hook factory).** The plan's Task 3 action block recommended Pattern A first; following the recommendation produced a clean separation where TileWrapper owns its own useLongPress + useMemo state and MasonryFeed.renderTile is a pure mapping function. The leaf-card props remain unchanged.
- **engagementVersion bump prop** chosen over per-tile event-bus subscription. Matches Phase 42 D-04 leaf-discipline. HomeScreen (43-06) will own the single ENGAGEMENT_CHANGED subscription.
- **AnimatePresence per-column** (not per-grid). Matches UI-SPEC §4 and preserves the height-accumulating column-split invariant.
- **Both branches (newly-appended + pre-existing) render as motion.div** so AnimatePresence's exit detection is uniform. The pre-existing branch intentionally omits variants/initial/animate so it doesn't re-enter on AnimatePresence re-keying (UI-SPEC §4 explicit rule).

## Deviations from Plan

### Plan-spec mismatches (documented; not auto-fixes)

**1. [Spec drift] MasonryFeed.tsx already had the inline-play-removal comment block referencing the literal CONCEPT_EXPLORED token**
- **Found during:** Task 3 (MasonryFeed extension; verification grep step)
- **Issue:** The existing comment at lines 494-502 said "Detector D (postMessage CONCEPT_EXPLORED on play ≥ 80%)" — a single literal-token occurrence that broke the Phase 43 anti-wire negative-grep contract for MasonryFeed.tsx. This pre-existed Plan 43-03 (landed in Phase 42 UAT-7+8 comment).
- **Fix:** De-collided the comment to "Detector D (postMessage explored-anchor signal on play ≥ 80%)" with a trailing note explaining the de-collision. Identical pattern to Phase 38 lesson (iii) + Plan 39-01's lesson and Plan 40-01's docstring de-collision.
- **Files modified:** app/src/components/MasonryFeed.tsx (single comment block)
- **Verification:** `grep -c CONCEPT_EXPLORED src/components/MasonryFeed.tsx` returns 0.
- **Committed in:** f77b2bd1 (Task 3 commit — folded into the same source-modifying commit per Phase 37 D-03 pattern)

**2. [Spec drift] Plan's Task 4 acceptance criteria + test scaffold required visibilitychange + IntersectionObserver presence assertions in MasonryFeed**
- **Found during:** Task 4 (filling the MasonryFeed.dismiss-fade-all.test.mjs scaffold)
- **Issue:** Plan acceptance criteria lines 617-618 + Task 4 action block lines 685-686 required positive grep assertions for `visibilitychange` and `IntersectionObserver` to confirm Phase 36 GAP-C video-state useEffects were preserved. But Phase 42 UAT-7+8 (commits in CLAUDE.md "Video post completion signals" section) REMOVED those useEffects from MasonryFeed when inline video play left the feed surface. The current MasonryFeed.tsx has zero of those tokens — re-introducing them via test assertions OR re-adding the dead code would violate CLAUDE.md rule "Don't re-introduce inline play in feed cards."
- **Fix:** Omitted the two stale presence assertions from the test file. Documented the omission inline at the test file's header comment so future plan-checker sees the rationale and doesn't reopen.
- **Files modified:** app/tests/components/MasonryFeed.dismiss-fade-all.test.mjs (test omission + header comment)
- **Verification:** All other 7 assertions in the file pass. CLAUDE.md invariant honored.
- **Committed in:** d82a6994 (Task 4 commit)

---

**Total deviations:** 2 spec-drift adjustments (zero auto-fix Rules 1-3 fired during execution)
**Impact on plan:** Both adjustments necessary to honor CLAUDE.md invariants that landed AFTER the plan was authored. Plan content otherwise executed exactly as written; zero scope creep.

## Issues Encountered

None — execution flowed cleanly Task 1 → 2 → 3 → 4 with single-commit-per-task cadence. tsc clean after every task. Plan acceptance criteria's two stale presence assertions (visibilitychange / IntersectionObserver) discovered and resolved via CLAUDE.md-precedence (deviation #2 above).

## Test results

- **app:** test:main 740 tests / 729 pass / 5 fail / 6 skip — pre-existing failures unchanged from Phase 42 baseline (concept-feed.test.mjs ERR_MODULE_NOT_FOUND from Phase 37 carry-over; needsRefill 16-threshold stale from Phase 42's 16→24 bump; walkDerivedList(16,...) constant stale similarly; getVineColor date-dependent assertion). Zero new failures introduced.
- **app:** test:actions 16/16 pass.
- **app:** tsc -b --noEmit exits 0.
- **app:** node --test on the 5 directly-affected test files (LongPressMenu + MasonryFeed.dismiss-fade-all + InfoFlow.video-tap-emit counterweight + MasonryFeed.celebration + MasonryFeed.layout) — 38/38 pass.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **43-06 (homescreen-wiring) unblocked** — LongPressMenu component + MasonryFeed onLongPress / engagementVersion contract shipped. 43-06 will:
  1. `useState` for `{ menuOpen: boolean, menuPostId: string | null, menuAnchorId: string | null }`,
  2. `onLongPress={(postId, anchorId) => set… true / postId / anchorId}` passed to MasonryFeed,
  3. Mount `<LongPressMenu open={menuOpen} onClose={() => set…false} postId={menuPostId} anchorId={menuAnchorId} />`,
  4. Subscribe to `ENGAGEMENT_CHANGED` with `setEngagementVersion(v => v + 1)` and pass `engagementVersion` to MasonryFeed,
  5. Subscribe to `ANCHOR_DISMISSED` in a `[location.pathname]` effect and `setDailyPosts(prev => prev.filter(p => p.sourceQuestionIds?.[0] !== anchorId))` — LP-05 same-anchor cascade naturally fades via AnimatePresence.
- **43-04 (saved-screen-and-route) parallel-safe** — separate consumer of engagementService (getSavedPosts / getLikedPosts), no MasonryFeed/LongPressMenu coupling.
- **43-05 (postdetail-deep-dive-trigger) parallel-safe** — separate file (PostDetailScreen.tsx).

## Self-Check: PASSED

Verified before continuing to state updates:

```
$ test -f app/src/components/LongPressMenu.tsx && echo FOUND
FOUND
$ git log --oneline | grep -E "(c08883df|abac15da|f77b2bd1|d82a6994)" | wc -l
4
$ npx tsc -b --noEmit; echo $?
0
$ node --test tests/components/LongPressMenu.test.mjs tests/components/MasonryFeed.dismiss-fade-all.test.mjs 2>&1 | grep -E "^ℹ (pass|fail)"
ℹ pass 14
ℹ fail 0
```

All claimed artifacts exist. All claimed commit hashes are in the git log. tsc clean. New tests green.

---
*Phase: 43-engagement-ui*
*Plan: 03 (longpress-menu-and-masonry-integration)*
*Completed: 2026-05-11*
