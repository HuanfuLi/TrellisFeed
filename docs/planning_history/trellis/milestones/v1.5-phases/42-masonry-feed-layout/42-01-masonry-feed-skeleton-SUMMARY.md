---
phase: 42-masonry-feed-layout
plan: 01
subsystem: ui
tags: [masonry, framer-motion, react, layout, height-accumulator, reduced-motion]

# Dependency graph
requires:
  - phase: 36-curiosity-feed-randomness-weights-gap-closure
    provides: "GAP-C single-emit invariant in MemoizedConceptCard (markExplored + CONCEPT_EXPLORED on video thumbnail tap)"
  - phase: 38-v1-4-carry-over-cleanup
    provides: "Generalized video thumbnail-tap inline-play emit (Phase 38 dropped 'short' post type)"
  - phase: 41-pipeline-wiring-essay-depth
    provides: "Essay depth + citation rendering stable; deep dive plumbing ready for downstream Phase 43 UI"
provides:
  - "MasonryFeed component (276 LOC) implementing 2-column height-accumulating split"
  - "Tile immutability invariant (D-02): tiles never move between columns once rendered"
  - "framer-motion entrance variants (D-03/D-04/D-05) on newly-appended tiles only"
  - "<MotionConfig reducedMotion='user'> wrapper honoring OS Reduce Motion (Pitfall 1 fix)"
  - "Verbatim port of InlineInfoFlow video state ownership (3 useEffects) preserving Phase 36 GAP-C"
  - "VineBloomCard render-gate slot wired (placeholder body — implementation lands in plan 42-04)"
  - "Three new public exports from InfoFlow.tsx: MemoizedConceptCard / ConnectionCard / MilestoneCard"
affects: [phase 42-02 HomeScreen swap, phase 42-04 VineBloomCard, phase 42-05 source-reading invariants]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — framer-motion + react-router-dom already installed
  patterns:
    - "Height-accumulating 2-column masonry via columnHeightsRef + tileColumnAssignmentsRef append-only Map"
    - "Per-tile delay (delay: indexInColumn * 0.04) instead of staggerChildren cascade — UI-SPEC.md D-05"
    - "MotionConfig reducedMotion='user' as the OS-level Reduce Motion gate (framer-motion v12 does NOT auto-respect prefers-reduced-motion)"
    - "ref-callback Map (tileRefsMap) for re-measuring clientHeight in useLayoutEffect — robust against async height growth"

key-files:
  created:
    - "app/src/components/MasonryFeed.tsx (276 LOC)"
  modified:
    - "app/src/components/InfoFlow.tsx (3 export-keyword additions: lines 573, 610, 700)"

key-decisions:
  - "Plan stub specified `import { SwipeTabContext } from './SwipeTabContainer'` — corrected to canonical declarer `'../lib/swipe-tab-context'` (verified by InfoFlow.tsx:5 which imports from the same path). Rule 3 blocking-fix; tsc -b --noEmit would have failed otherwise."
  - "VineBloomCard placeholder returns null AND the {allExplored && <VineBloomCard />} render gate is wired — Plan 42-04 swaps only the function body, not the surrounding JSX."
  - "Video state ownership ported byte-for-byte from InlineInfoFlow (InfoFlow.tsx:746-797): 3 useEffects + setVideoPlaying threaded into MemoizedConceptCard. The single emit (markExplored + CONCEPT_EXPLORED) stays inside MemoizedConceptCard's thumbnail onClick — adding a sibling here would have broken the InfoFlow.video-tap-emit single-emit invariant per RESEARCH.md Pitfall 4."
  - "MotionConfig reducedMotion='user' wraps the ENTIRE return JSX (not just the motion subtree) — at runtime framer-motion checks the prefers-reduced-motion OS query when this prop is set. Without this wrapper the plan-mandated motion.div entrance would override Reduce Motion preferences."

patterns-established:
  - "MasonryFeed leaf-import: downstream consumers can `import { MasonryFeed } from '../components/MasonryFeed'`. Type imports (`type InfoFlowItem`, `type DailyPost`) come along for free via re-export."
  - "Atomic 2-task parallel-friendly plan: task 1 (export keyword additions) is a pure additive change committed first; task 2 (new file) consumes the new exports. No ordering dependency surprises."

requirements-completed: [MASONRY-01]

# Metrics
duration: 3 min
completed: 2026-05-10
---

# Phase 42 Plan 01: Masonry Feed Skeleton Summary

**2-column height-accumulating masonry layout (MasonryFeed.tsx, 276 LOC) with framer-motion entrance variants and OS-level Reduce Motion gating, ready for Plan 42-02's HomeScreen swap.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-10T01:16:38Z
- **Completed:** 2026-05-10T01:19:03Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `app/src/components/MasonryFeed.tsx` (276 LOC) implementing the verbatim contract from UI-SPEC.md § Layout Algorithm + § Animation Contract + RESEARCH.md § Example 1 with the Pitfall 1 reduced-motion fix.
- Added `export` keyword to MemoizedConceptCard (line 573), ConnectionCard (line 610), and MilestoneCard (line 700) in `InfoFlow.tsx` — pure additive change with zero behavior impact.
- Verified the MasonryFeed component satisfies all 13 acceptance criteria of Task 2 (forbidden-pattern absence + required-pattern presence + LOC ≥ 200 + tsc clean).
- Confirmed the existing `InfoFlow.video-tap-emit.test.mjs` counterweight still passes (4/4) — Phase 36 GAP-C single-emit invariant preserved end-to-end.

## Task Commits

Each task was committed atomically (with `--no-verify` per parallel-execution protocol):

1. **Task 1: Export MemoizedConceptCard + ConnectionCard + MilestoneCard from InfoFlow.tsx** — `9dec16b0` (feat)
2. **Task 2: Create MasonryFeed.tsx with height-accumulating algorithm + framer-motion entrance + MotionConfig wrapper + video state port** — `92494a75` (feat)

**Plan metadata commit:** _pending — created at plan close (this commit)_

## Files Created/Modified

- `app/src/components/MasonryFeed.tsx` (NEW, 276 LOC) — 2-column masonry component:
  - `columnHeightsRef` + `tileColumnAssignmentsRef` (append-only Map) implement the height-accumulating split
  - `tileRefsMap` enables `useLayoutEffect` re-measurement from `clientHeight` to absorb async height growth (image lazy-load, carousel mount)
  - `<MotionConfig reducedMotion="user">` wraps the entire return JSX — opts in to OS Reduce Motion honoring (framer-motion v12 default is OFF)
  - `tileEnterVariants` (`hidden: opacity 0 + y 8` → `visible: opacity 1 + y 0`) animate ONLY newly-appended tiles (tracked via `seenPostIdsRef` Set + `newPostIds` initial-incoming Set)
  - 3 video useEffects ported byte-for-byte from `InlineInfoFlow` (InfoFlow.tsx:746-797): visibilitychange + swipeProgress; intra-app navigation cleanup; IntersectionObserver scroll-out cleanup
  - `videoPlaying` / `setVideoPlaying` threaded through MemoizedConceptCard tile body — single GAP-C emit lives in MemoizedConceptCard's thumbnail onClick (InfoFlow.tsx, untouched here)
  - `getId(item)` helper centralizes the concept/connection/milestone discriminant — used 4 times across mount, post-mount, layout, and column-filter paths
  - `VineBloomCard` placeholder body returns `null`; render gate `{allExplored && <VineBloomCard />}` IS wired so Plan 42-04 only swaps the function body
- `app/src/components/InfoFlow.tsx` (MODIFIED, +3 / -3 lines) — `export` keyword added to:
  - `MemoizedConceptCard` (line 573, `React.memo` wrapper around `ConceptCard`)
  - `ConnectionCard` (line 610, render function)
  - `MilestoneCard` (line 700, render function)

## Decisions Made

- **SwipeTabContext canonical import path** — `'../lib/swipe-tab-context'`, not `'./SwipeTabContainer'`. The plan stub had the consumer path, not the declarer. InfoFlow.tsx:5 demonstrates the canonical pattern. Rule 3 blocking-fix folded into Task 2 (tsc would have failed otherwise).
- **VineBloomCard render gate wired now, body deferred** — Plan 42-04 will swap only the function body of `VineBloomCard()` from `return null` to the real celebration affordance. The `{allExplored && <VineBloomCard />}` render gate (with the surrounding `marginTop: '24px'` div) lives in MasonryFeed, so Plan 42-04 doesn't touch this file's JSX.
- **MotionConfig wraps the ENTIRE return JSX, not just the motion subtree** — wrapping only the `motion.div` instances (e.g., per-tile) would have meant the `allExplored` block (which Plan 42-04 may animate) couldn't share the same Reduce Motion gate. Single wrapper at the top is the canonical framer-motion pattern.
- **Per-tile `delay: indexInColumn * 0.04` (40ms stagger) over `staggerChildren` cascade** — UI-SPEC.md § Animation Contract explicitly chose this approach (RESEARCH.md Open Question 5 closure): the per-column index keeps the cascade visually consistent across both columns even when one column has more tiles than the other.
- **Video state ownership stays at the wrapper level** — porting the 3 `useEffect` blocks into MasonryFeed (rather than into MemoizedConceptCard or a separate hook) preserves the InlineInfoFlow contract verbatim. Phase 36 GAP-C tap detector lives inside MemoizedConceptCard's thumbnail `onClick` — duplicating any emit logic in MasonryFeed would have broken the single-emit invariant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected SwipeTabContext import path**
- **Found during:** Task 2 (writing MasonryFeed.tsx imports)
- **Issue:** The plan's exact-required-structure stub specified `import { SwipeTabContext } from './SwipeTabContainer'`. SwipeTabContainer.tsx itself imports SwipeTabContext from `'../lib/swipe-tab-context'` (verified by `grep "SwipeTabContext" app/src/components/SwipeTabContainer.tsx` → "import { SwipeTabContext } from '../lib/swipe-tab-context'") and re-uses it as `<SwipeTabContext.Provider>`; it does NOT re-export it. Following the plan stub verbatim would have produced a TS2305 import error and broken `tsc -b --noEmit`.
- **Fix:** Used the canonical declarer path `'../lib/swipe-tab-context'` (matches InfoFlow.tsx:5's existing pattern). Added an inline 5-line comment block in MasonryFeed.tsx documenting the deviation so a future reader sees the rationale at the import site.
- **Files modified:** `app/src/components/MasonryFeed.tsx` (single line + 5-line comment)
- **Verification:** `npx tsc -b --noEmit` exits 0 after the change.
- **Committed in:** `92494a75` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep — corrected a single import-path drift in the plan stub against the actual module structure. Documented inline so future readers (and Plan 42-02 which will import MasonryFeed into HomeScreen) see the rationale.

## Issues Encountered

None — both tasks executed cleanly. tsc remained green throughout, the InfoFlow video-tap-emit counterweight (4/4 tests) stayed green, and all 13 Task 2 acceptance criteria passed on first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 42-02 (HomeScreen swap)** can now `import { MasonryFeed } from '../components/MasonryFeed'` and replace the `<InlineInfoFlow ... />` JSX site-by-site. Prop signature is `MasonryFeedProps = { items, onOpenConnection, showConnectionScores?, onOpenPost, allExplored }` — drops InlineInfoFlow's unused `onLoadMore` + `isLoadingMore` (HomeScreen owns swipe-for-more separately). HomeScreen will need to compute `allExplored` from `dailyReadService.getExploredAnchors()` + `useQuestions` (RESEARCH.md Pitfall 2).
- **Plan 42-03 (card-slide-in removal)** unblocked — the 3 `card-slide-in` callsites at InfoFlow.tsx:197, 329, 858 can be removed in a separate atomic commit; MasonryFeed already uses `motion.div` entrance instead of the legacy `card-slide-in` CSS keyframe.
- **Plan 42-04 (VineBloomCard + i18n)** unblocked — only the body of `function VineBloomCard()` in MasonryFeed.tsx (currently `return null`) needs to be swapped; the render gate is already wired. Alternatively Plan 42-04 may extract VineBloomCard to a sibling file at planner discretion.
- **Plan 42-05 (source-reading invariant tests)** has stable targets — all forbidden patterns (column-count, columnCount, break-inside, breakInside, will-change, willChange, perspective:, position: 'fixed', position:fixed, dailyReadService.markExplored, type: 'CONCEPT_EXPLORED') are absent from MasonryFeed.tsx; all required patterns (MotionConfig, columnHeightsRef, tileColumnAssignmentsRef, motion.div, 'visibilitychange', swipeProgress.on('change', IntersectionObserver, framer-motion import, ./InfoFlow import) are present. Plan 42-05's grep tests can be authored against the current shape.
- **No blockers** — Phase 36 GAP-C single-emit invariant preserved (counterweight test 4/4 green); CLAUDE.md Header positioning rule honored (no `transform`/`will-change`/`filter`/`contain`/`perspective` on the MasonryFeed root); CLAUDE.md video-tap-emit single-emit invariant honored (no `dailyReadService.markExplored` and no `type: 'CONCEPT_EXPLORED'` in MasonryFeed.tsx).

## Self-Check: PASSED

Verified after writing this SUMMARY:

- `app/src/components/MasonryFeed.tsx`: FOUND
- `app/src/components/InfoFlow.tsx`: FOUND (modified)
- Commit `9dec16b0` (Task 1): FOUND in `git log`
- Commit `92494a75` (Task 2): FOUND in `git log`

---
*Phase: 42-masonry-feed-layout*
*Plan: 01*
*Completed: 2026-05-10*
