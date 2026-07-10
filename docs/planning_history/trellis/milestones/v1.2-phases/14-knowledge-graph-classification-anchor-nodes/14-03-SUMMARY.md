---
phase: 14-knowledge-graph-classification-anchor-nodes
plan: 03
subsystem: ui
tags: [typescript, mind-elixir, knowledge-graph, anchor-nodes, mindmap]

# Dependency graph
requires:
  - phase: 14-knowledge-graph-classification-anchor-nodes
    plan: 01
    provides: isAnchorNode/qaCount/parentId fields on Question type
  - phase: 14-knowledge-graph-classification-anchor-nodes
    plan: 02
    provides: Anchor nodes created and stored in localStorage
provides:
  - buildAnchorReflectionTree in canonical-knowledge.service.ts
  - Anchor-based mindmap rendering in GraphScreen (anchors as collapsed leaves)
  - Q&A children accessible via mind-elixir expand/retract
  - Legacy Q&A nodes shown directly under cluster (backward compatibility)
  - CONCEPT ANCHOR detail panel with qaCount display
affects:
  - app/src/screens/GraphScreen.tsx
  - app/src/services/canonical-knowledge.service.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - buildAnchorReflectionTree: separates anchor/anchored-QA/legacy-QA into hierarchical tree
    - expanded=false on anchor NodeObj to use mind-elixir built-in collapse behavior
    - isAnchorNode guard in selectedNode panel to prevent navigation to empty ask/:id

key-files:
  created: []
  modified:
    - app/src/services/canonical-knowledge.service.ts
    - app/src/screens/GraphScreen.tsx

key-decisions:
  - "buildAnchorReflectionTree added as new export alongside buildReflectionTree — no removal of existing function (used by buildTreeContext)"
  - "Anchor NodeObj uses expanded=false; mind-elixir built-in expand/collapse requires no extra code"
  - "Legacy Q&As (no parentId matching an anchor) rendered as direct cluster leaves — full backward compatibility"
  - "Detail panel cursor:default and no 'View details' chevron for anchor nodes to signal non-navigable"

requirements-completed: [GRAPH-06]

# Metrics
duration: ~2min
completed: 2026-03-29
---

# Phase 14 Plan 03: Anchor-Based Mindmap Rendering Summary

**Mindmap now shows only concept anchor nodes as cluster leaves (collapsed with Q&A children), replacing the flat list of individual Q&As**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-29T19:22:53Z
- **Completed:** 2026-03-29T19:24:17Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added `buildAnchorReflectionTree` to `canonical-knowledge.service.ts` — new exported function that partitions questions into: anchor nodes (isAnchorNode===true), Q&As attached to anchors (parentId matches), and legacy Q&As (no anchor parent)
- `buildAnchorReflectionTree` groups anchors by rootLabel > branchLabel > clusterLabel, attaches their Q&A children, and includes legacy Q&As as direct cluster leaves
- Updated `buildMindElixirData` in `GraphScreen.tsx` to import and use `buildAnchorReflectionTree` instead of `buildReflectionTree`
- Anchor nodes rendered with `expanded: false` — mind-elixir's built-in collapse behavior hides Q&A children until user taps the expand toggle
- Each anchor's topic string includes `(N)` Q&A count when children exist
- Legacy Q&As (pre-Phase 14 data without anchor parents) still render directly as cluster leaves — zero regression for existing data
- Detail panel updated: anchor nodes show `CONCEPT ANCHOR — N Q&As` header, cursor is `default` (not pointer), no "View details" chevron, and click does not navigate to `/ask/:id`

## Task Commits

1. **Task 1: Update buildReflectionTree to produce anchor-based hierarchy and update buildMindElixirData** — `c8a5f263`

## Files Created/Modified

- `app/src/services/canonical-knowledge.service.ts` — Added `buildAnchorReflectionTree` export (76 lines)
- `app/src/screens/GraphScreen.tsx` — Changed import, rewrote `buildMindElixirData`, updated selectedNode detail panel

## Decisions Made

- Kept `buildReflectionTree` (unchanged) since it's used by `buildTreeContext` in the same service — only added `buildAnchorReflectionTree` as a new export
- Mind-elixir's built-in expand/collapse is triggered by `expanded: false` on a NodeObj with children — no custom event handlers needed
- `truncate(anchor.title || anchor.content, 50)` used for anchor labels (shorter than 60 for Q&A nodes, to account for the `(N)` count suffix)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows from the Question store (localStorage). Anchor nodes with `qaCount: 0` correctly show "(0 Q&As)" in the detail panel until Q&As are classified and attached via Plan 02's `classifyAndAnchor`.

## Self-Check: PASSED

- `app/src/services/canonical-knowledge.service.ts` — contains `export function buildAnchorReflectionTree(`
- `app/src/screens/GraphScreen.tsx` — imports `buildAnchorReflectionTree`, uses `expanded: false`, contains "CONCEPT ANCHOR"
- Commit `c8a5f263` exists in git log
- `npx tsc --noEmit` produced zero errors

---
*Phase: 14-knowledge-graph-classification-anchor-nodes*
*Completed: 2026-03-29*
