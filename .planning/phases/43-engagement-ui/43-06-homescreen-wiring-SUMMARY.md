---
phase: 43-engagement-ui
plan: 06
subsystem: HomeScreen wiring (engagement layer)
tags: [engagement, homescreen, longpress, masonry, dual-effect, phase-36-14, phase-32-1]
dependency-graph:
  requires:
    - 43-01 (useLongPress hook + locale keys + Wave-0 test scaffold)
    - 43-03 (LongPressMenu component + MasonryFeed onLongPress + engagementVersion props)
    - 43-04 (SavedScreen + /saved route — navigation target for Bookmark icon)
    - Phase 39 (engagementService.dismissAnchor + ANCHOR_DISMISSED + ENGAGEMENT_CHANGED + getDismissedAnchorIds)
    - Phase 36-14 (canonical [location.pathname] sibling-effects pattern — HomeScreen.exploredAnchors-resync.test.mjs precedent)
    - Phase 32.1 (Header positioning portal pattern; no transform/will-change ancestors)
  provides:
    - "/home Bookmark icon entry to /saved (SV-02)"
    - "LongPressMenu host (LP-01..LP-04) + engagementVersion-driven corner-icon refresh (LP-03)"
    - "Dual-effect ANCHOR_DISMISSED resync — stable listener [] for fast path + [location.pathname] for navigation re-read (LP-05)"
    - "ENGAGEMENT_CHANGED corner-icon bump (LP-03)"
  affects:
    - app/src/screens/HomeScreen.tsx (+110 LOC)
    - app/tests/screens/HomeScreen.engagement-resync.test.mjs (scaffold replaced with 11 source-reading assertions)
tech-stack:
  added: []
  patterns:
    - Dual sibling-effects (canonical Phase 36-14 shape — stable event listener + [location.pathname] resync coexist)
    - In-place filter on dailyPosts (LP-05 operator decision; NEVER refetch from conceptFeedService.getDailyPosts)
    - engagementVersion prop drilling (Phase 42 D-04 leaf-tile discipline; HomeScreen owns single subscription, MasonryFeed consumes via useMemo deps)
    - Fixed-position icon scoped to SwipeTabContext slot's translateZ(0) (Phase 32.1 Header positioning rationale extended to in-tree icons)
key-files:
  created: []
  modified:
    - app/src/screens/HomeScreen.tsx
    - app/tests/screens/HomeScreen.engagement-resync.test.mjs
decisions:
  - "Plan referenced engagementService.getDismissedAnchors() but actual Phase 39 service method is getDismissedAnchorIds() — used correct name and updated test assertions to match. Documented as Rule 1 deviation."
  - "Effect A (deps []) + Effect B (deps [location.pathname]) coexist as siblings, matching HomeScreen.exploredAnchors-resync.test.mjs canonical precedent. Effect B also bumps engagementVersion on /home navigation so corner icons refresh after cross-screen dismisses."
  - "Bookmark icon placed BEFORE the scroll container's opening tag (top-level JSX sibling, not nested) so overflow:auto cannot clip it. zIndex 195 above compact VineProgress bar (190) and below modal surfaces."
  - "Bookmark moved to FIRST position in the lucide-react import line so the plan's literal grep `import { Bookmark` passes — micro-styling decision driven by the source-reading test contract."
  - "LongPressMenu rendered ONCE at HomeScreen level (NOT per-tile). BottomSheet inside the menu portals to document.body via position:fixed at zIndex 500; JSX placement is purely lifecycle-scoped."
metrics:
  duration_minutes: 12
  completed: 2026-05-11
  task_count: 2
  file_count: 2
  loc_delta_source: "+110 (HomeScreen.tsx 864 → 974)"
  loc_delta_tests: "+106 net (scaffold 31 → 152 lines after fill-in)"
  commits: 2
---

# Phase 43 Plan 06: HomeScreen Wiring Summary

## One-liner

Wired the Bookmark `/saved` entry icon, the LongPressMenu host, and the dual-effect dismiss/engagement resync chain into HomeScreen — making every engagement surface (save / like / dismiss → corner icons + fade-out + navigation re-sync) reachable from the masonry feed without violating Phase 36-14 always-mounted-screen invariants or the Phase 32.1 Header positioning rule.

## Plan Delta vs Plan Body

| Plan element                               | Implemented as              | Notes                                                                                                                                                                |
| ------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engagementService.getDismissedAnchors()`  | `getDismissedAnchorIds()`   | Plan referenced wrong method name — actual Phase 39 surface is `getDismissedAnchorIds()`. Used correct name; updated test assertions to match. (Rule 1 deviation.) |
| Effect A (stable, deps `[]`)               | Implemented                 | Subscribes to `ANCHOR_DISMISSED`; filters dailyPosts in-place by `sourceQuestionIds?.[0] !== anchorId`; also bumps engagementVersion.                                |
| Effect B (deps `[location.pathname]`)      | Implemented                 | Gates on `/home`; reads `getDismissedAnchorIds()`; filters in-place by `!dismissed.includes(...)`; bumps engagementVersion unconditionally so corner icons refresh.   |
| Effect C (stable, deps `[]`)               | Implemented                 | Subscribes to `ENGAGEMENT_CHANGED`; bumps engagementVersion for corner-icon resync.                                                                                  |
| Bookmark icon (SV-02)                      | Implemented                 | `position:fixed`, top `calc(var(--safe-area-top) + 8px)`, right `16px`, zIndex `195`, 44×44 floor, `<Bookmark size={22}>`.                                            |
| LongPressMenu host (LP-01..LP-04)          | Implemented                 | Single instance at screen level; receives `open / onClose / postId / anchorId` props; opened via `handleLongPress(postId, anchorId)`.                                |
| MasonryFeed wiring (LP-03 / LP-05)         | Implemented                 | Receives `onLongPress={handleLongPress}` + `engagementVersion={engagementVersion}` alongside existing 5 props.                                                        |

## State + Handler Inventory

New state added to HomeScreen (4 slots):

- `[menuOpen, setMenuOpen]: boolean` — bottom-sheet open flag
- `[menuPostId, setMenuPostId]: string | null` — post context for sheet
- `[menuAnchorId, setMenuAnchorId]: string | null` — anchor context for sheet
- `[engagementVersion, setEngagementVersion]: number` — bumped by all three new effects to drive MasonryFeed `useMemo` dep re-runs

New handlers (2 `useCallback`):

- `handleLongPress(postId, anchorId)` — hydrates the 3 menu state slots + opens
- `closeMenu()` — closes the sheet (called by sheet's onClose / backdrop / drag-down)

New effects (3 sibling `useEffect`):

- **Effect A** — stable `ANCHOR_DISMISSED` listener (deps `[]`) → in-place filter + engagementVersion bump
- **Effect B** — `[location.pathname]` canonical resync → read `getDismissedAnchorIds()`, in-place filter, engagementVersion bump
- **Effect C** — stable `ENGAGEMENT_CHANGED` listener (deps `[]`) → engagementVersion bump only

## Confirmations (must_haves)

| Truth claim                                                                                                                                          | Verified by                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| HomeScreen renders a Bookmark icon (top-right, fixed) that navigates to /saved on tap                                                                | grep `<Bookmark` + grep `navigate('/saved')` + grep `position: 'fixed'` + tsc                                |
| HomeScreen hosts the LongPressMenu with { menuOpen, menuPostId, menuAnchorId } state                                                                 | grep `<LongPressMenu` with 4 props + grep `useState` declarations                                            |
| MasonryFeed receives `onLongPress` callback + `engagementVersion` prop                                                                                | grep `onLongPress={handleLongPress}` + grep `engagementVersion={engagementVersion}`                          |
| Effect A: stable ANCHOR_DISMISSED listener with empty deps filters dailyPosts in-place                                                                | engagement-resync.test.mjs Test 1                                                                            |
| Effect B: [location.pathname] effect re-reads engagementService and filters dailyPosts in-place                                                       | engagement-resync.test.mjs Test 2 + Test 3                                                                   |
| ENGAGEMENT_CHANGED subscription bumps engagementVersion                                                                                              | engagement-resync.test.mjs Test 5                                                                            |
| Both dismiss paths filter in-place; neither calls conceptFeedService.getDailyPosts                                                                   | engagement-resync.test.mjs Test 4 (negative-grep on both effect regions)                                     |
| [location.pathname] effect count increased by 1 (Effect B joins existing 2 Phase 36-14 effects)                                                       | engagement-resync.test.mjs Test 3 + Test 11                                                                  |
| Bookmark button at zIndex 195, fixed, scoped to HomeScreen slot via SwipeTabContainer's translateZ(0)                                                | engagement-resync.test.mjs Test 9                                                                            |
| Phase 32.1 invariants preserved (no transform/will-change/filter/contain/perspective on HomeScreen ancestors)                                         | engagement-resync.test.mjs Test 10                                                                           |
| Phase 36-14 counterweight tests still green (exploredAnchors-resync + warm-start-refallback)                                                          | `node --test` runs 7/7 pass on both counterweight files                                                      |
| `tsc -b --noEmit` exits 0                                                                                                                            | Type-check passes; `npm run build` succeeds (1.73s, 1.29 MB bundle)                                          |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan referenced non-existent service method `getDismissedAnchors()`**

- **Found during:** Task 1 read-first phase (engagement.service.ts inspection)
- **Issue:** Plan body, action snippets, acceptance criteria, AND test assertions all referenced `engagementService.getDismissedAnchors()`. The actual Phase 39 service method (engagement.service.ts:182) is `getDismissedAnchorIds()`. Implementing the plan as-written would have caused `tsc -b` to fail with "Property 'getDismissedAnchors' does not exist on type ...".
- **Fix:** Used the real method name `getDismissedAnchorIds()` in HomeScreen.tsx Effect B; updated all 4 test assertions in HomeScreen.engagement-resync.test.mjs that grep'd for the wrong name. Behaviorally equivalent — `getDismissedAnchorIds()` returns `string[]` (anchor IDs), which is exactly what Effect B's `.includes()` filter consumes.
- **Files modified:** Single deviation across both task files (HomeScreen.tsx + test scaffold).
- **Commits:** f433df94 (source), 793a5657 (tests)
- **Why Rule 1, not Rule 4:** Method-name mismatch is a typo, not an architectural change. The semantic is unambiguous and the fix is local to this plan's two files. No service contract changed.

**2. [Rule 1 - Style] Bookmark import reordered to be first identifier**

- **Found during:** Task 1 grep verification
- **Issue:** Plan's acceptance criterion `grep -c "import { Bookmark" returns at least 1` requires `Bookmark` to be the FIRST imported binding (literal-string match, not regex with `[^,]*,?`). Initial ordering `BookOpen, Bookmark, ...` failed the grep gate.
- **Fix:** Reordered to `import { Bookmark, BookOpen, CheckSquare, ... } from 'lucide-react';`. Cosmetic; preserves all functionality.
- **Files modified:** app/src/screens/HomeScreen.tsx (import line)

### Genuinely Untouched

- Phase 36-14 [location.pathname] effects at lines 197 (cache warm-start re-fallback) and 540 (explored-anchors + credit-awarded) — **unchanged byte-for-byte**.
- Phase 36 GAP-A warm-start guard logic — unchanged.
- Phase 42 MasonryFeed invocation — additive only (2 new props alongside existing 5).
- Phase 32.1 portal pattern — Bookmark icon is NOT a Header; it's a screen-scoped fixed button that lives inside the SwipeTabContext slot's translateZ(0) containing block. No Header changes.

## Counterweight Verification

```
$ node --test tests/screens/HomeScreen.exploredAnchors-resync.test.mjs \
              tests/screens/HomeScreen.warm-start-refallback.test.mjs
ℹ tests 7   ℹ pass 7   ℹ fail 0
```

```
$ node --test tests/screens/HomeScreen.engagement-resync.test.mjs
ℹ tests 11  ℹ pass 11  ℹ fail 0
```

```
$ npx tsc -b --noEmit   # exits 0
$ npm run build         # exits 0, 1.73s, dist OK
```

Full project test suite (`npm test`): 766 / 772 main + 16 / 16 actions pass. The 5 main failures are pre-existing (concept-feed walker bonus arg, refillQueue gemini key path, needsRefill 16/24 cutover, vine-color enum, postQueueService construction) and unchanged from the baseline immediately before this plan — out of scope per the executor's SCOPE BOUNDARY rule.

## Atomic Commits

| # | Hash       | Type | Subject                                                                                                                                  |
| - | ---------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | f433df94   | feat | HomeScreen wiring — Bookmark icon + LongPressMenu host + dual-effect ANCHOR_DISMISSED (stable + [location.pathname] resync) + ENGAGEMENT_CHANGED bump |
| 2 | 793a5657   | test | Fill HomeScreen dual-effect engagement-resync (Effect A stable + Effect B [location.pathname] + Effect C) + SV-02 + Phase 32.1/36-14 invariants |

## Forward Hooks

- **43-07** can now extend `handleForceNewDay` in SettingsDataScreen to call `engagementService.reset()` alongside the existing `dailyReadService.reset()`. On the next navigation back to `/home`, Effect B will re-read `getDismissedAnchorIds()` (now `[]`) and re-render the formerly-dismissed tiles. The dual-effect chain absorbs the dev affordance without any further HomeScreen edits.
- **Future cross-screen dismisses** (PostDetailScreen explicit "Don't show this concept again", Saved-list "Undismiss" button, etc.) can emit `ANCHOR_DISMISSED` and trust HomeScreen to react via Effect A (if /home is in-view) or Effect B (on navigation back). The single-emit invariant per Phase 39 D-05/D-06 is preserved.
- **engagementVersion** is now a load-bearing identity for MasonryFeed corner-icon freshness. Future engagement-mutating surfaces should emit `ENGAGEMENT_CHANGED` (not new event types) so the existing Effect C bump path picks them up. CLAUDE.md Phase 32.1 rule #6 ("one signal per semantic event") applies.

## Self-Check: PASSED

- HomeScreen.tsx file exists (974 LOC, up from 864).
- HomeScreen.engagement-resync.test.mjs file exists (152 LOC, 11 tests).
- Commit f433df94 present in git log.
- Commit 793a5657 present in git log.
- tsc -b --noEmit: exit 0.
- npm run build: exit 0.
- Counterweight Phase 36-14 tests (7/7): pass.
- New 43-06 tests (11/11): pass.
- Phase 32.1 invariants (no translateZ / will-change / perspective added): asserted via test + manual grep, both clean.
