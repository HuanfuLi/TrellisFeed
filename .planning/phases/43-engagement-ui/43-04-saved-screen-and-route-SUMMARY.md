---
phase: 43-engagement-ui
plan: 04
subsystem: ui
tags: [react, engagement, react-router, i18n, sub-screen, archive-view]

requires:
  - phase: 39-engagement-service-walker-extension
    provides: engagementService.getSavedPosts / getLikedPosts / ENGAGEMENT_CHANGED event
  - phase: 43-01-shared-infra-and-locales
    provides: 14 i18n keys under saved.* and the SavedScreen.test.mjs skip-stub scaffold
provides:
  - "/saved sub-screen route with Saved | Liked tab toggle"
  - "Source-reading invariant tests locking the SV-01..SV-04 contract"
affects:
  - 43-06 (HomeScreen wiring will add the Bookmark header icon entry point and dismissed-anchor re-sync; SavedScreen is the navigation target)

tech-stack:
  added: []
  patterns:
    - "Sub-screen archive list: mirror PostHistoryScreen.tsx HistoryPostCard 52×52 thumbnail + lineClamp(2) title + contextLabel meta verbatim — established the canonical archive-view shape for any future per-feature archive (Likes, Dismissed, History extensions)"
    - "ENGAGEMENT_CHANGED re-sync via useEffect subscribe + cleanup-on-unmount — sub-screen lifecycle handles cleanup automatically (Pitfall 7), no manual unsubscribe ref dance needed"

key-files:
  created:
    - app/src/screens/SavedScreen.tsx (308 LOC)
  modified:
    - app/src/App.tsx (+2 lines: import + route entry)
    - app/tests/screens/SavedScreen.test.mjs (scaffold replaced with 7 source-reading assertions)

key-decisions:
  - "Mirror PostHistoryScreen.tsx HistoryPostCard verbatim — operator's 'simplify, don't enrich' framing argues against re-inventing a saved-specific row layout. Same 52×52 thumbnail + emoji fallback + lineClamp(2) title + contextLabel meta + scale(0.98) press state. Entrance keyframes inlined locally (`saved-card-in`) as a peer to `history-card-in` so the two archives stay visually consistent without exporting a shared keyframe (which would re-introduce CLAUDE.md 'one animation system' tension)."
  - "Tab state owned by local useState<'saved' | 'liked'>('saved'), NOT a route param. Operator-locked at SV-04. Plumbing tabs through the router would force /saved/saved and /saved/liked URLs that violate the verb-aligned single-route semantic ('Save' → /saved); tap-toggle in component-state matches ReviewScreen's existing showLibrary precedent."
  - "ENGAGEMENT_CHANGED subscription returns the unsubscribe disposer directly (`return unsub`) rather than wrapping in an arrow `return () => unsub()`. Phase 39 eventBus.subscribe returns the unsubscribe function natively; the direct return is structurally identical, one fewer indirection, and the SavedScreen test asserts both shapes as acceptable (`/return unsub|return\\s*\\(\\)\\s*=>/`)."
  - "Component-local TabButton + SavedRow + EmptyState helpers rather than inlining everything inside SavedScreen. Mirrors PostHistoryScreen's HistoryPostCard extraction; the row press-state useState lives inside SavedRow so each row owns its pressed state without prop-drilling. EmptyState takes `t` as a prop (rather than calling `useTranslation()` itself) to keep the icon + key selection co-located with the parent's tab state."
  - "Header backTo='/home' verbatim from CONTEXT SV-01 + plan must-haves. Critical because SavedScreen is rendered through <Outlet> outside SwipeTabContext — Header.tsx's `insideSwipeTab` detector returns false and the header DOM portals to document.body (Phase 32.1 invariant). Without this, the back-arrow would not appear and the in-tree render would risk Phase 32.1 flicker class."
  - "Test file omits a `filter:` negative grep. Phase 32.1 invariant covers transform/will-change/perspective at the React-tree ancestors of Header; filter is exempted because (a) lucide-react drop-shadow filters live inside leaf-icon SVG nodes, not Header ancestors, and (b) UI-SPEC §2 explicitly permits `filter: drop-shadow` on the future corner-icon overlay (Phase 43-06 wires that). Same exemption pattern used in the existing SavedScreen.test.mjs scaffold comment."

patterns-established:
  - "Sub-screen ENGAGEMENT_CHANGED re-sync — any future archive view (Liked-only route, Dismissed-archive view) should subscribe in useEffect with `return unsub` cleanup; sub-screen unmount on navigation away handles cleanup automatically."
  - "Component-local TabButton + helper extraction for compact two-tab screens — preferred over inline JSX when tab state branches the entire list rendering."

requirements-completed: [ENGAGE-01, ENGAGE-03]

duration: 6 min
completed: 2026-05-11
---

# Phase 43 Plan 04: Saved Screen and Route Summary

**`/saved` sub-screen with Saved | Liked tab toggle, mirroring PostHistoryScreen's compact archive layout and re-syncing on ENGAGEMENT_CHANGED events.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-11T07:50:03Z
- **Completed:** 2026-05-11T07:56:00Z
- **Tasks:** 3 / 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- SavedScreen.tsx ships at 308 LOC: two-tab archive backed by `engagementService.getSavedPosts()` (Saved tab) and `engagementService.getLikedPosts()` (Liked tab), with full empty states, Header backTo='/home', and ENGAGEMENT_CHANGED-driven in-place re-sync.
- /saved route registered in App.tsx: `{ path: 'saved', element: <PageTransition><SavedScreen /></PageTransition> }` inserted between `'review'` and `'podcast'`. `npm run build` succeeds; route reachable in production bundle.
- SavedScreen.test.mjs Wave-0 scaffold replaced with 7 source-reading invariants covering SV-01..SV-04 + Phase 32.1 negative guards; all 7 green (`node --test tests/screens/SavedScreen.test.mjs` exits 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SavedScreen.tsx** — `fc5515ff` (feat)
2. **Task 2: Register /saved route in App.tsx** — `a7a3afa2` (feat)
3. **Task 3: Fill assertions in SavedScreen.test.mjs scaffold** — `974066d5` (test)

**Plan metadata:** _to be assigned at close-out commit_

## Files Created/Modified

- `app/src/screens/SavedScreen.tsx` — NEW (308 LOC). Two-tab archive sub-screen. Owns local `useState<Tab>('saved')`; subscribes to ENGAGEMENT_CHANGED in useEffect; sub-components TabButton, SavedRow, EmptyState; entrance keyframes inlined as `saved-card-in` (peer to `history-card-in` in PostHistoryScreen).
- `app/src/App.tsx` — +2 lines. Added `import SavedScreen from './screens/SavedScreen';` alongside the PostHistoryScreen import, and the route entry between `/review` and `/podcast` in the router children array.
- `app/tests/screens/SavedScreen.test.mjs` — Wave-0 skip-stub scaffold replaced with 7 source-reading assertions (SV-01 route registration; SV-03/04 service consumption; SV-04 useState<Tab> + 6 i18n keys; ENGAGEMENT_CHANGED subscribe + cleanup; Header backTo='/home'; Phase 32.1 negative invariants; row tap → /posts/:id). 111 lines added, 25 removed.

## Decisions Made

See `key-decisions` in the frontmatter above (6 substantive decisions, each justifying a divergence-or-affirmation of plan guidance):

- Mirror PostHistoryScreen verbatim (no new archive shape).
- Local useState<Tab> not route param (operator SV-04 lock).
- Direct `return unsub` cleanup (no arrow wrapper).
- Component-local TabButton + SavedRow + EmptyState helpers.
- Header backTo='/home' load-bearing for portal split.
- Test file omits `filter:` negative grep (lucide drop-shadow exemption).

## Deviations from Plan

None — plan executed exactly as written.

- All 3 tasks ran clean without auto-fix triggers.
- All acceptance grep counts met or exceeded plan thresholds (LOC 308 ≥ 150; i18n keys 5 matches via `grep -oE` ≥ 5; engagementService.getSavedPosts/getLikedPosts each ≥ 1; ENGAGEMENT_CHANGED ≥ 1; eventBus.subscribe ≥ 1; backTo="/home" = 1; useState<Tab> = 1; navigate = 1; forbidden CSS = 0; Bookmark/Heart icons = 2).
- `tsc -b --noEmit` exits 0 after every task.
- `npm run build` succeeds after Task 2.
- `node --test tests/screens/SavedScreen.test.mjs` exits 0 after Task 3 (7/7 pass).
- `node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` exits 0 (i18n parity unchanged — all 14 saved.* keys were already shipped in 43-01).

**Total deviations:** 0
**Impact on plan:** None. Plan was specification-complete.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- **/saved route is live** — manual navigation via address bar to `/saved` renders SavedScreen.
- **Empty states render correctly** with the existing 43-01 i18n keys; no further bundle work required.
- **HomeScreen Bookmark header icon entry point** is the missing piece — lives in Plan 43-06 (file-touch separation; HomeScreen.tsx is shared with the dismissed-anchor re-sync + warm-start re-fallback effects). After 43-06 lands, users will reach `/saved` via a single tap from the always-mounted Home tab.
- **LongPressMenu (Plan 43-03, shipped)** + SavedScreen (this plan) are the two consumers of `ENGAGEMENT_CHANGED`. Save/like from the long-press sheet will refresh the SavedScreen list in real time the moment a user transitions to /saved with the sheet still open.
- **Phase 43 plans remaining:** 43-05 (deep-dive trigger on PostDetailScreen — parallel-safe), 43-06 (HomeScreen wiring — sequential after 43-04/43-05), 43-07 (Force-New-Day engagement reset — parallel-safe), 43-08 (phase close-out).

## Self-Check: PASSED

- app/src/screens/SavedScreen.tsx → FOUND (308 LOC)
- app/src/App.tsx → FOUND (+2 lines)
- app/tests/screens/SavedScreen.test.mjs → FOUND (7/7 tests green)
- .planning/phases/43-engagement-ui/43-04-saved-screen-and-route-SUMMARY.md → FOUND (this file)
- Commit fc5515ff (Task 1 feat) → FOUND
- Commit a7a3afa2 (Task 2 feat) → FOUND
- Commit 974066d5 (Task 3 test) → FOUND
- tsc -b --noEmit → exits 0
- npm run build → exits 0
- node --test tests/screens/SavedScreen.test.mjs → 7 pass / 0 fail
- node --test tests/locales/bundle-parity.test.mjs → green (i18n parity unchanged)

---
*Phase: 43-engagement-ui*
*Completed: 2026-05-11*
