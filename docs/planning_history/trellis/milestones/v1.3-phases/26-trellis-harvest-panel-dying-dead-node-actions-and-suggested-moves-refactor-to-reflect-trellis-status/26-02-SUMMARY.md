---
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
plan: 02
subsystem: ui
tags: [react, trellis, bottom-sheet, harvest, confetti, lucide-react]

requires:
  - phase: 26-01
    provides: trellisCreditsService, HARVEST_COMPLETED event wiring, BottomSheet UI primitive, useTrellisData HARVEST subscription
  - phase: 25
    provides: useTrellisData hook, TrellisAnchorNode + LeafState types, TrellisHero, clearBlossomDate
provides:
  - TrellisStatusPanel component (3-column fruit/dying/dead status + bottom sheets + harvest flow)
  - PlannerScreen integration (panel mounted between TrellisHero and Suggested Moves)
  - Fruit-credit counter pill in Planner header (Cherry icon + live count)
  - Fly-to-counter + confetti celebration on Harvest All
affects: [26-03 dying/dead actions (will reuse bottom sheets), 26-04 suggested moves refactor]

tech-stack:
  added: []
  patterns:
    - "Derived status groups via leafState filters (fruit / yellow+falling / fallen) — single source of truth is useTrellisData layout"
    - "Fly-to-target particle animation using CSS custom properties (--fly-dx/--fly-dy) + computed-key cast for TS"
    - "Panel-owned celebration (particles + confetti) keyed off local state so Planner stays agnostic"

key-files:
  created:
    - app/src/components/trellis/TrellisStatusPanel.tsx
  modified:
    - app/src/screens/PlannerScreen.tsx

key-decisions:
  - "Status panel filters nodes into 3 groups from leafState (fruit / yellow+falling / fallen) — dying explicitly merges yellow AND falling states per D-08"
  - "Fruit glow implemented via inline style + status-glow keyframe injected in a scoped <style> block; pulse only active when fruit count > 0"
  - "Fly-to-counter measures DOMRects at click time (not in render) so the panel does not need to know header geometry ahead of time"
  - "Particle count capped at Math.min(count, 8) — more than 8 flying cherries is visual noise even on large harvests"
  - "Confetti fires 1.2s after harvest click so the fly-to-counter lands first; burst lasts 3.5s"
  - "Computed-key cast `['--fly-dx' as string]` preferred over @ts-expect-error — tsconfig.app.json noUnusedLocals flags the directive as unused when the as-cast already widens the type"
  - "Header counter uses <span ref={counterRef}> inside a pill div so getBoundingClientRect targets the actual number glyph, not the pill padding"

patterns-established:
  - "3-column status panel layout with per-column BottomSheet is the template for future trellis status dashboards"
  - "Celebration choreography: fly-to-counter (1s) → confetti burst (3.5s) unified across harvest types (D-03), not per-fruit-type"
  - "Inline-style convention with CSS variables maintained; no Tailwind classes introduced"

requirements-completed: [D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-10]

duration: 4min
completed: 2026-04-15
---

# Phase 26 Plan 02: Trellis Status Panel + Harvest Flow Summary

**3-column fruit/dying/dead status panel sits between TrellisHero and Suggested Moves; Harvest All clears blossom dates, accumulates credits into a header pill, and celebrates with a fly-to-counter animation followed by confetti.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-15T05:52:40Z
- **Completed:** 2026-04-15T05:57:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- TrellisStatusPanel renders three lucide-icon columns (Cherry / Leaf / XCircle) with live counts derived from `useTrellisData` layout
- Fruit column pulses with a warm amber glow (`status-glow` keyframe) whenever at least one anchor has ripened to fruit
- Tapping any column opens a BottomSheet listing affected anchors by title + branch label; fruit sheet exposes a Harvest All button
- Harvest flow: clears blossom dates per node → increments `trellisCreditsService` → emits `HARVEST_COMPLETED` → flies amber cherry particles to the header counter → fires confetti celebration
- Planner header now shows a Cherry-icon pill counter with `credits` from localStorage; pill background warms to amber when credits > 0

## Task Commits

1. **Task 1: TrellisStatusPanel component + bottom sheets + harvest flow** — `1ccf17f2` (feat)
2. **Task 1 fix: computed-key cast for CSS vars** — `bab3c286` (fix)
3. **Task 2: Wire panel + fruit counter into PlannerScreen** — `157e4861` (feat)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `app/src/components/trellis/TrellisStatusPanel.tsx` (created) — 3-column panel, 3 bottom sheets, harvest handler with fly-to-counter + confetti
- `app/src/screens/PlannerScreen.tsx` (modified) — mounts TrellisStatusPanel, adds header fruit counter pill with counterRef

## Decisions Made
- Dying bucket = `yellow` ∪ `falling` (D-08) — deliberately groups the two ailing states so users see a single "needs attention" column instead of two adjacent yellow-ish indicators.
- Fly-to-counter vector is recomputed on every harvest (not cached) so layout shifts between mount and click do not strand particles mid-air.
- Fruit particles use a single unified animation per D-03 — all particles share one keyframe, staggered by 60ms, not separate per-fruit-type choreography.
- Kept `TrellisStatusPanel` owning both celebration and sheets so `PlannerScreen` only has to pass `layout.nodes`, `setCredits`, and `counterRef`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced `@ts-expect-error` with computed-key cast in TrellisStatusPanel**
- **Found during:** Task 2 (full `tsc -p tsconfig.app.json` verification)
- **Issue:** `tsconfig.app.json` has `noUnusedLocals`/`noUnusedParameters` enabled; the `@ts-expect-error` placed above `'--fly-dx'` was reported as **unused** because the surrounding `as CSSProperties` cast already widened the object type. This blocked clean app-level typecheck.
- **Fix:** Swapped the directive for `['--fly-dx' as string]: ...` / `['--fly-dx' as string]: ...` computed-property keys (still typed via `as CSSProperties`).
- **Files modified:** `app/src/components/trellis/TrellisStatusPanel.tsx`
- **Verification:** `npx tsc --noEmit -p tsconfig.app.json` — no new errors in TrellisStatusPanel or PlannerScreen beyond pre-existing unused-import warnings.
- **Committed in:** `bab3c286`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Purely typecheck hygiene — no runtime behaviour change. No scope creep.

## Issues Encountered

- `tsc -p tsconfig.app.json` surfaces pre-existing errors in `PlannerScreen.tsx` (`Sparkles`, `navigate` unused), `GraphScreen.tsx`, `canonical-knowledge.service.ts`, `review.service.ts`, and `trellis-state.service.ts`. None are caused by this plan — logged to `deferred-items.md` for future cleanup. The default `npx tsc --noEmit` (root config) does not report them and runs clean.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Plan 26-03 (dying/dead actions) can hang action buttons inside the existing dying/dead BottomSheets without restructuring the panel.
- Plan 26-04 (suggested moves refactor) can read the same `layout.nodes` from `useTrellisData` — the hook is already mounted in `PlannerScreen`.
- `trellisCreditsService` now has a live consumer in the header; credits persist via localStorage and survive reloads.
- Fly-to-counter animation established a reusable choreography pattern (celebrate-flying-particles → confetti) future plans can mimic for other reward flows.

## Self-Check

- File `app/src/components/trellis/TrellisStatusPanel.tsx`: CHECK
- File `app/src/screens/PlannerScreen.tsx` (modified): CHECK
- Commit `1ccf17f2`: CHECK
- Commit `bab3c286`: CHECK
- Commit `157e4861`: CHECK

## Self-Check: PASSED

---
*Phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status*
*Completed: 2026-04-15*
