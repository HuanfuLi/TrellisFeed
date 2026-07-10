---
phase: 25-anime-knowledge-tree-for-planner-page-motivational-review-visualization
plan: 02
subsystem: ui
tags: [trellis, svg, framer-motion, react, planner, visualization]

# Dependency graph
requires:
  - phase: 25-01
    provides: "trellis data layer (useTrellisData, types, layout/state services)"
provides:
  - "TrellisHero component rendering Variant C (pure SVG trellis) in PlannerScreen"
  - "TrellisLeaf with 7 state colors, 44x44 WCAG hit targets, framer-motion animations"
  - "TrellisTooltip with health copy, review/Q&A navigation buttons"
  - "TrellisEmptyState with CTA to /ask"
  - "TrellisVariantPicker dev-only variant cycle"
  - "TrellisCanvas with vine draw-on animation and ambient leaf sway"
  - "TrellisBackgroundC pure-SVG lattice + gradient background"
affects: [25-03, 25-04, 25-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function exports from .tsx for unit testing (pluralize, resolveHealthCopy, LEAF_STATE_COLOR)"
    - "esbuild-based tsx loader hooks for node --test on .tsx files"
    - "SVG viewBox 800x400 with framer-motion pathLength vine draw-on"
    - "Ambient sway threshold (20 leaves) with 1-in-3 mask above threshold"

key-files:
  created:
    - app/src/components/trellis/TrellisLeaf.tsx
    - app/src/components/trellis/TrellisTooltip.tsx
    - app/src/components/trellis/TrellisEmptyState.tsx
    - app/src/components/trellis/TrellisVariantPicker.tsx
    - app/src/components/trellis/TrellisCanvas.tsx
    - app/src/components/trellis/TrellisHero.tsx
    - app/src/components/trellis/variants/TrellisBackgroundC.tsx
    - app/tests/components/trellis-tooltip-copy.test.mjs
    - app/tests/components/_trellis-tsx-hooks.mjs
    - app/tests/components/_trellis-tsx-loader.mjs
  modified:
    - app/src/screens/PlannerScreen.tsx

key-decisions:
  - "Question type has no 'name' field; anchor display uses title ?? content ?? 'anchor' fallback chain"
  - "esbuild-based custom module loader for unit testing .tsx pure-function exports with node --test"
  - "Pre-existing tsc errors (GraphScreen, canonical-knowledge, review.service) do not affect trellis; Vite build succeeds"

patterns-established:
  - "tsx test loader: --import ./tests/components/_trellis-tsx-loader.mjs with NODE_PATH for esbuild"
  - "Leaf color map as exported Record for both rendering and testing"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-04-15
status: paused-at-checkpoint
---

# Phase 25 Plan 02: Variant C Trellis Hero Components + PlannerScreen Integration

**Pure-SVG Variant C trellis hero with 7-state leaves, vine draw-on animation, tap tooltip, and empty state CTA -- wired into PlannerScreen**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-15T00:03:57Z
- **Paused at checkpoint:** 2026-04-15T00:10:36Z
- **Tasks:** 2/3 completed (Task 3 is human-verify checkpoint)
- **Files created:** 10
- **Files modified:** 1

## Accomplishments
- 7 new trellis component files delivering the full Variant C interaction loop
- PlannerScreen shows TrellisHero as topmost content above Review Banner
- Vine draw-on animation with 200ms stagger per branch via Framer Motion pathLength
- Leaf pop-in with spring animation, ambient sway (3s loop), 44x44 WCAG hit targets
- Tooltip with clamped positioning, health copy per state, Review + View Q&As navigation
- Empty state with seed emoji and "Ask a question" CTA
- Dev-only variant picker cycling A/C/V with localStorage persistence
- 3 unit tests (8+ assertions) for pure functions: pluralize, resolveHealthCopy, LEAF_STATE_COLOR

## Task Commits

1. **Task 1: TrellisLeaf + TrellisTooltip + TrellisEmptyState + TrellisVariantPicker** - `59bc581e` (feat + test)
2. **Task 2: TrellisCanvas + TrellisBackgroundC + TrellisHero + PlannerScreen wiring** - `1aeac535` (feat)
3. **Task 3: Human verification** - PENDING (checkpoint:human-verify)

## Files Created/Modified
- `app/src/components/trellis/TrellisLeaf.tsx` - Leaf SVG with 7-state color map, WCAG hit target, framer-motion spring + sway
- `app/src/components/trellis/TrellisTooltip.tsx` - Popover with anchor name, health badge, review stats, action buttons
- `app/src/components/trellis/TrellisEmptyState.tsx` - 0-anchors overlay with seed emoji and /ask CTA
- `app/src/components/trellis/TrellisVariantPicker.tsx` - Dev-only A/C/V cycle pill (import.meta.env.DEV gate)
- `app/src/components/trellis/TrellisCanvas.tsx` - SVG overlay with vine draw-on and leaf rendering
- `app/src/components/trellis/TrellisHero.tsx` - Variant-agnostic shell composing all trellis components
- `app/src/components/trellis/variants/TrellisBackgroundC.tsx` - Pure-SVG lattice + warm gradient background
- `app/tests/components/trellis-tooltip-copy.test.mjs` - Unit tests for pure tooltip/leaf functions
- `app/tests/components/_trellis-tsx-hooks.mjs` - esbuild-based module hooks for .tsx test loading
- `app/tests/components/_trellis-tsx-loader.mjs` - Loader registration for tsx test hooks
- `app/src/screens/PlannerScreen.tsx` - Added TrellisHero import + render at top of content

## Decisions Made
- Used `title ?? content ?? 'anchor'` fallback for anchor display name since Question type has no `name` field
- Created esbuild-based module loader hooks to enable unit testing of pure functions exported from .tsx files
- Pre-existing tsc errors in GraphScreen/review.service do not block trellis work; Vite production build succeeds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created tsx test loader for node --test**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** node --test cannot load .tsx files; plan's test command fails with ERR_UNKNOWN_FILE_EXTENSION
- **Fix:** Created _trellis-tsx-hooks.mjs + _trellis-tsx-loader.mjs using esbuild to transform .tsx at load time; run with --import flag and NODE_PATH
- **Files created:** app/tests/components/_trellis-tsx-hooks.mjs, app/tests/components/_trellis-tsx-loader.mjs
- **Verification:** All 3 tests pass with `node --import ./tests/components/_trellis-tsx-loader.mjs --test tests/components/trellis-tooltip-copy.test.mjs`
- **Committed in:** 59bc581e (Task 1 commit)

**2. [Rule 1 - Bug] Fixed anchor name field access**
- **Found during:** Task 2 (TrellisCanvas/TrellisHero)
- **Issue:** Plan code used `n.anchor.name` but Question type has no `name` field (would be undefined and cause TypeScript error)
- **Fix:** Changed to `n.anchor.title ?? n.anchor.content ?? 'anchor'` and `n.anchor.title ?? n.anchor.content ?? 'Anchor'` in TrellisHero
- **Files modified:** app/src/components/trellis/TrellisCanvas.tsx, app/src/components/trellis/TrellisHero.tsx
- **Verification:** npx tsc --noEmit shows no trellis-related errors
- **Committed in:** 1aeac535 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes essential for tests to run and TypeScript to compile. No scope creep.

## Animation Timings
- Vine draw-on: 1.2s duration, 200ms stagger per branch, easeInOut
- Leaf pop-in: spring (stiffness: 260, damping: 18), 50ms stagger, 0.8s base delay
- Ambient sway: 3s duration, Infinity repeat, easeInOut (enabled for <= 20 leaves; 1-in-3 above)
- Tooltip: instant show/hide, no transition

## Known Stubs
None -- all components are fully wired to live data via useTrellisData hook.

## Issues Encountered
- Pre-existing tsc errors in GraphScreen.tsx and review.service.ts (GRAPH_UPDATED event type, anchorId property) prevent `npm run build` from passing tsc step, but Vite production build (`npx vite build`) succeeds. These are not caused by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 3 (human-verify checkpoint) must be completed before 25-03/25-04 can begin
- Variant A (25-03) and Variant V (25-04) plug into TrellisHero via the variant === 'A'/'V' conditional slots
- TrellisVariantPicker already cycles through all three variants

---
*Phase: 25-anime-knowledge-tree-for-planner-page-motivational-review-visualization*
*Plan: 02*
*Status: Paused at checkpoint (Task 3: human-verify)*
*Date: 2026-04-15*
