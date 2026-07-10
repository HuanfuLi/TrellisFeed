---
phase: 25-anime-knowledge-tree-for-planner-page-motivational-review-visualization
plan: 03
subsystem: ui
tags: [react, trellis, image-background, vite-glob, graceful-fallback]

requires:
  - phase: 25-02
    provides: TrellisHero shell with variant picker and conditional background rendering
provides:
  - TrellisBackgroundA component with static image + gradient fallback
  - Variant A wired into TrellisHero conditional render
affects: [25-04, 25-05]

tech-stack:
  added: []
  patterns: [import.meta.glob for optional asset resolution with eager+url query]

key-files:
  created:
    - app/src/components/trellis/variants/TrellisBackgroundA.tsx
  modified:
    - app/src/components/trellis/TrellisHero.tsx

key-decisions:
  - "Used import.meta.glob instead of new URL() for asset resolution — handles missing .webp/.png gracefully at build time"
  - "PNG-first with WebP fallback via glob pattern matching both extensions"
  - "Real asset is .png (3.6MB) not .webp — glob pattern resolves whichever exists on disk"

patterns-established:
  - "Optional asset pattern: import.meta.glob with eager+query for assets that may or may not exist"

requirements-completed: [PHASE-25-VARIANT-A]

duration: 2min
completed: 2026-04-15
---

# Phase 25 Plan 03: Variant A Background Summary

**TrellisBackgroundA with import.meta.glob asset resolution and warm gradient fallback when image absent**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-15T01:37:43Z
- **Completed:** 2026-04-15T01:39:24Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created TrellisBackgroundA component using import.meta.glob for png/webp resolution
- Wired variant A conditional render into TrellisHero
- Gradient fallback (peach to surface) renders when no asset exists
- D-31 compliant: zero runtime image generation dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1: TrellisBackgroundA with graceful fallback** - `3ad217ba` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `app/src/components/trellis/variants/TrellisBackgroundA.tsx` - Image background variant with glob-based asset resolution and gradient fallback
- `app/src/components/trellis/TrellisHero.tsx` - Added TrellisBackgroundA import and variant A conditional render

## Decisions Made
- Used `import.meta.glob` with `{ eager: true, import: 'default', query: '?url' }` instead of `new URL()` pattern from the plan. Reason: `new URL()` would fail at Vite build time if the referenced file does not exist on disk. The glob pattern gracefully resolves to an empty object when no matching files exist, making the build always succeed regardless of asset state.
- Asset is .png (trellis-bg-default.png, 3.6MB) not .webp as originally spec'd. The glob pattern `trellis-bg-default.{png,webp}` handles both extensions, picking whichever exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed asset import strategy from new URL() to import.meta.glob**
- **Found during:** Task 1 (TrellisBackgroundA creation)
- **Issue:** Plan specified `new URL('../../../assets/planner-trellis/trellis-bg-default.webp', import.meta.url).href` but: (a) the file is .png not .webp, and (b) `new URL()` with a non-existent file path can cause Vite build failures
- **Fix:** Used `import.meta.glob` with `{png,webp}` pattern that resolves whichever extension exists, or returns empty object if neither exists
- **Files modified:** app/src/components/trellis/variants/TrellisBackgroundA.tsx
- **Verification:** `npx vite build` succeeds; grep confirms no banned imports
- **Committed in:** 3ad217ba (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Asset import strategy change was necessary for build safety with the actual .png asset. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in GraphScreen.tsx, PlannerScreen.tsx, canonical-knowledge.service.ts, review.service.ts prevent `tsc -b` from passing. These are unrelated to this plan's changes (confirmed by grep — no errors reference TrellisBackgroundA or TrellisHero). Vite build succeeds independently.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - component is fully functional with real asset (trellis-bg-default.png exists on disk).

## Next Phase Readiness
- Variant A is live and selectable via dev picker
- Real PNG asset renders as full-bleed background
- Variant V (25-04) can follow same import.meta.glob pattern for video assets

---
*Phase: 25-anime-knowledge-tree-for-planner-page-motivational-review-visualization*
*Completed: 2026-04-15*
