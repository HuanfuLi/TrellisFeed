---
created: 2026-05-21T19:30:00.000Z
title: Planner trellis graph laggy with large graph (production-scale perf)
area: performance
files:
  - app/src/screens/PlannerScreen.tsx
  - app/src/state/useTrellisData.ts
  - app/src/services/trellis-state.service.ts
---

## Problem

Surfaced during device UAT (2026-05-21). The Planner screen becomes very laggy
— suspected to scale with the size of the trellis graph (the Planner visual that
renders leaves/fruit/branches). A real user maintaining a large knowledge graph
over time will hit this, so it is a production-level scalability concern, not a
cosmetic one.

## Likely suspects (to confirm during triage)

- `useTrellisData` recomputes the full trellis on REVIEW_COMPLETED /
  GRAPH_UPDATED / ANCHOR_DELETED / HARVEST_COMPLETED — full recompute may be O(N)
  per event with no memoization across nodes.
- `computeLeafState` per node (`trellis-state.service.ts`) run for every anchor
  on every recompute.
- Per-node render cost in `PlannerScreen` (SVG/CSS leaves) without
  virtualization/windowing.

## Direction

Profile with a large seeded graph first (don't guess). Candidate fixes:
incremental/memoized trellis recompute keyed by changed node, virtualize the
leaf render, or throttle recompute on burst events. Needs measurement before a
plan.

## Routing

Triage into a v1.7 perf phase (candidate: fold into Phase 56 polish or a new
perf phase). NOT part of Phase 55.1 (device-test bug fixes).
