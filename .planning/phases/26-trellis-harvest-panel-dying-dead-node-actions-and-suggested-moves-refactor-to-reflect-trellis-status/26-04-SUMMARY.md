---
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
plan: 04
subsystem: ui
tags: [planner, trellis, suggested-moves, refactor, lucide-react, react]

requires:
  - phase: 26-01
    provides: trellisCreditsService, BottomSheet, getPrunedQuestions
  - phase: 26-02
    provides: TrellisStatusPanel, Planner fruit counter pill, layout.nodes mount in PlannerScreen
  - phase: 26-03
    provides: trellisActionsService (heal + replant navigation intents)
  - phase: 25
    provides: useTrellisData, TrellisAnchorNode + LeafState
provides:
  - trellis-health-driven Suggested Moves on PlannerScreen (dead → dying → filtered autoGen)
  - dyingDeadIds Set for autoGen dedup against dying/dead anchors (D-23)
  - Re-plant and Heal row entries with Sprout/Heart icons and Badge labels
  - Removal of suggestedChunks / ChunkCard / SIGNAL_DOT_COLOR / handleRegenerateChunk from PlannerScreen
  - @deprecated marker on usePlanner hook (no remaining consumers)
affects: [future trellis UX iterations — autoGen service can now assume dying/dead anchors are surfaced elsewhere]

tech-stack:
  added: []
  patterns:
    - "Trellis-first move ordering: derive dead + dying node arrays from layout.nodes each render, then filter autoGen by a Set of anchor IDs to avoid duplicates"
    - "Visible-slice math with priority rows: `slice(0, Math.max(0, TOP_N - trellisCount))` keeps TOP_N total visible across priority groups"
    - "Deprecation via JSDoc `@deprecated` (file retained, not deleted) when a hook loses its last consumer — preserves downstream safety while signalling intent"

key-files:
  created: []
  modified:
    - app/src/screens/PlannerScreen.tsx
    - app/src/state/usePlanner.ts

key-decisions:
  - "Derive deadNodes / dyingNodes / filteredAutoMoves inline in the component body (not in useEffect / useMemo) — cheap array filters on a small list, re-runs correctly every time layout changes without explicit invalidation"
  - "Wrap trellisActionsService.replant in try/catch at the call site — the service itself already swallows post-generation failures, but any unexpected throw should surface a toast rather than leave the user stranded mid-navigation"
  - "Skip-all button visibility gated on filteredAutoMoves.length (not autoMoves.length) so it hides when only trellis moves remain — skipAll only dismisses autoMoves; trellis rows need explicit Heal/Prune/Replant actions"
  - "Replace signal-dot row style (Play/X action buttons) with lucide Sprout + Heart leading icons + Badge trailing tag — matches the TrellisStatusPanel visual language and tap-anywhere-to-act affordance"
  - "Deprecate (not delete) usePlanner.ts — tests or dev-only screens may still import it; JSDoc marks intent without breaking external references"
  - "Use `typeof deadNodes[number]` as parameter type on handleReplant / handleHeal — avoids importing TrellisAnchorNode while staying typesafe"

patterns-established:
  - "Suggested Moves is no longer a single-source list — it is a priority-ordered composition (dead > dying > autoGen) where each group is derived independently and slotted into one scroll section"
  - "AutoGen dedup pattern: build a Set of trellis anchor IDs per render, filter moves with `!set.has(move.conceptId)` — cheap and deterministic, no service-layer change required"

requirements-completed: [D-19, D-20, D-21, D-22, D-23]

duration: 2min
completed: 2026-04-15
---

# Phase 26 Plan 04: Suggested Moves Refactor (Trellis-Driven) Summary

**PlannerScreen's Suggested Moves section is now trellis-health-driven: dead anchors render first with a Re-plant action, dying anchors second with Heal, and deduped autoGen moves third — suggestedChunks + ChunkCard scaffolding removed entirely.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-15T06:05:02Z
- **Completed:** 2026-04-15T06:07:04Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- Removed the entire `suggestedChunks` system from PlannerScreen: `ChunkCard` component, `SIGNAL_DOT_COLOR` constant, `handleRegenerateChunk` function, and the `usePlanner` / `PlannerChunk` / `plannerService` imports (D-22, Pitfall 3).
- `deadNodes` derived from `layout.nodes.filter(n => n.leafState === 'fallen')`; `dyingNodes` from `leafState === 'yellow' || 'falling'` (D-20).
- `dyingDeadIds` `Set<string>` built per render from dead + dying anchor IDs; `filteredAutoMoves` drops any autoGen move whose `conceptId` matches (D-23).
- Render order: dead (Sprout icon, `Re-plant` red badge) → dying (Heart icon, `Heal` yellow badge) → filtered autoGen via existing `PortalCard` (D-20).
- Ripe fruits automatically excluded from Suggested Moves — `leafState === 'fruit'` is not in either filter (D-21). Fruit harvesting remains the exclusive concern of `TrellisStatusPanel`.
- `totalSuggestions` and `visibleAutoMoves` recalculated: `TOP_N - trellisCount` leaves room for trellis rows within the TOP_N budget; Show-all / Show-less / Skip-all buttons updated accordingly.
- `usePlanner` hook marked `@deprecated` (no remaining consumers after PlannerScreen migration) — file retained for safety.

## Task Commits

1. **Task 1: PlannerScreen refactor (suggestedChunks out, trellis moves in)** — `aa043247` (refactor)
2. **Task 2: Deprecate usePlanner hook** — `bc0f3d35` (chore)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified

- `app/src/screens/PlannerScreen.tsx` (modified) — 113 insertions, 185 deletions. Removed ChunkCard (127 lines), SIGNAL_DOT_COLOR, handleRegenerateChunk, usePlanner destructure, isLoading spinner. Added deadNodes/dyingNodes/dyingDeadIds/filteredAutoMoves derivations, handleReplant/handleHeal handlers, and two new JSX row renderers (Sprout + Heart + Badge).
- `app/src/state/usePlanner.ts` (modified) — added `@deprecated` JSDoc comment block at the top.

## Decisions Made

- Derivations (`deadNodes`, `dyingNodes`, `filteredAutoMoves`, `dyingDeadIds`) are plain `const` computations in the component body — not `useMemo`. With the trellis node list size (typically < 50) the filter cost is negligible, and re-deriving on every render is always correct when `layout.nodes` changes.
- `handleReplant` wraps `trellisActionsService.replant` in try/catch at the call site even though the service already swallows post-generation failures — a raw throw should toast rather than strand the user mid-flow.
- The "Skip all suggestions" button now gates on `filteredAutoMoves.length > 0` (not `autoMoves.length`) so it hides when only trellis rows remain — `skipAll()` only dismisses autoMoves; trellis rows require explicit Heal / Prune / Re-plant actions per D-11 through D-18.
- `typeof deadNodes[number]` is used as the handler parameter type — keeps the component self-contained without a second `TrellisAnchorNode` import.
- `usePlanner.ts` is deprecated (not deleted). The file may still be referenced by tests or other agents; leaving it compiling preserves safety while the `@deprecated` tag signals removal intent.
- All new UI kept to the project's inline-styles + CSS-variables convention (no Tailwind classes introduced).

## Deviations from Plan

None — plan executed exactly as written. TypeScript compiled clean on first attempt for both tasks.

## Issues Encountered

- `tsc -p tsconfig.app.json` still surfaces pre-existing errors from earlier phases (GraphScreen `ArrowLeft` unused, canonical-knowledge.service `GRAPH_UPDATED`/`COVERAGE_ERROR`, review.service `anchorId` on Question, trellis-state.service unused `FlashCard`/`ALL_LEAF_STATES`/`hashStr`). None are caused by Plan 26-04 — already logged in the phase-level `deferred-items.md` during Plan 26-02. The default `npx tsc --noEmit` (root config) passes clean.

## User Setup Required

None — no external services, env vars, or CLI tools.

## Next Phase Readiness

- PlannerScreen is now a thin composition: `TrellisHero` + `TrellisStatusPanel` + trellis-first Suggested Moves. Any future enhancement (e.g. sorting by anchor priority, grouping by branch) can operate on the single `layout.nodes` source.
- `plannerAutoGenService` can assume dying/dead anchors are now handled separately — future autoGen heuristics may drop their own "revive weak anchor" logic since the trellis layer surfaces these deterministically.
- `usePlanner.ts` is ready for deletion once one more phase passes without any consumer appearing.
- Phase 26 as a whole is complete: all 5 wave dependencies (D-01 through D-23) are implemented, committed, and typecheck-clean.

## Self-Check

- File `app/src/screens/PlannerScreen.tsx` (modified): CHECK
- File `app/src/state/usePlanner.ts` (modified, @deprecated): CHECK
- Commit `aa043247`: CHECK
- Commit `bc0f3d35`: CHECK

## Self-Check: PASSED

---
*Phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status*
*Completed: 2026-04-15*
