---
phase: 25-anime-knowledge-tree-for-planner-page-motivational-review-visualization
plan: "01"
title: "Trellis Data Layer — Seeded Layout, State Aggregation, Hook"
subsystem: trellis-data
tags: [trellis, layout, state-machine, event-bus, deterministic, pure-functions]
dependency_graph:
  requires: [25-00-blossom-dates, canonical-knowledge-service, event-bus]
  provides: [trellis-layout-service, trellis-state-service, useTrellisData-hook, trellis-types]
  affects: [25-02, 25-03, 25-04, 25-05]
tech_stack:
  added: []
  patterns: [seeded-prng-mulberry32, worst-child-wins-aggregation, eventBus-subscription-hook]
key_files:
  created:
    - app/src/services/trellis-layout.service.ts
    - app/src/services/trellis-state.service.ts
    - app/src/components/trellis/types.ts
    - app/src/state/useTrellisData.ts
    - app/tests/services/trellis-layout.test.mjs
    - app/tests/services/trellis-state.test.mjs
    - app/tests/services/_trellis-mock-hooks.mjs
    - app/tests/services/_trellis-mock-loader.mjs
    - app/tests/services/_trellis-mock-canonical.mjs
  modified: []
decisions:
  - "Used .ts explicit extensions in trellis-state.service.ts imports for node:test compatibility"
  - "Created mock loader infrastructure for canonical-knowledge.service transitive dependency chain"
  - "computeLeafState checks fruit before blossom (D-09 7-day gate takes priority over D-08 blossom check)"
metrics:
  duration: "6 minutes"
  completed: "2026-04-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 0
  test_count: 13
  test_pass: 13
---

# Phase 25 Plan 01: Trellis Data Layer Summary

Seeded deterministic vine/leaf layout + worst-child-wins state aggregation + React hook with 3 eventBus subscriptions — zero UI, pure data layer for all three trellis variants.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Seeded PRNG + vine/leaf layout service | `7a5bb012` | trellis-layout.service.ts, trellis-layout.test.mjs |
| 2 | State aggregation (worst-child-wins + blossom/fruit) | `6a327198` | trellis-state.service.ts, trellis-state.test.mjs, mock infra |
| 3 | Shared types + useTrellisData hook | `dd8ae8d2` | trellis/types.ts, useTrellisData.ts |

## Exported APIs

### trellis-layout.service.ts
- `mulberry32(seed)` — canonical 32-bit PRNG returning () => [0,1)
- `hashStr(s)` — djb2-style string to unsigned 32-bit integer
- `generateVinePath(branchId, index, total)` — seeded cubic bezier in 800x400 viewBox
- `cubicBezierPoint(t, ...)` — parametric point on cubic bezier
- `getLeafPosition(anchorId, vineSpec)` — deterministic {x, y, t} on vine with jitter
- `getVineColor(branchId)` — one of 5 CSS variable colors
- `TRELLIS_VIEWBOX_W=800`, `TRELLIS_VIEWBOX_H=400`, `VINE_COLOR_VARS`
- `VinePathSpec` interface (d + 8 control point fields)

### trellis-state.service.ts
- `computeLeafState(anchor, qaChildren, blossomSinceDate?)` — returns LeafState
- `buildTrellisState(questions)` — returns TrellisLayout (nodes + vines)
- Types: `LeafState`, `TrellisAnchorNode`, `TrellisLayout`

### components/trellis/types.ts
- Re-exports: `TrellisLayout`, `TrellisAnchorNode`, `LeafState`, `VinePathSpec`
- `TrellisVariant = 'A' | 'C' | 'V'`
- `LeafRenderNode` — render-ready leaf data
- `TrellisBackgroundProps` — common background contract
- `LEAF_HIT_TARGET_PX = 44`

### state/useTrellisData.ts
- `useTrellisData()` — returns `{ layout: TrellisLayout, refresh: () => void }`
- Subscribes to: REVIEW_COMPLETED, CLASSIFICATION_COMPLETED, ANCHOR_DELETED

## Test Coverage

| Test File | Tests | Covers |
|-----------|-------|--------|
| trellis-layout.test.mjs | 7 | D-16/D-17 determinism, seed non-collision, viewBox bounds, color mapping |
| trellis-state.test.mjs | 6 | D-05 bud, D-06 yellow, D-07 worst-child-wins, D-08 blossom, D-09 fruit, empty input |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .ts extensions to trellis-state.service.ts imports**
- **Found during:** Task 2
- **Issue:** node:test with --experimental-strip-types cannot resolve extensionless imports from .ts files
- **Fix:** Changed imports to use explicit `.ts` extensions (matching canonical-knowledge.service.ts convention)
- **Files modified:** app/src/services/trellis-state.service.ts

**2. [Rule 3 - Blocking] Created mock loader infrastructure for tests**
- **Found during:** Task 2
- **Issue:** canonical-knowledge.service.ts has deep transitive deps (providers/llm, providers/embedding) that fail in node:test
- **Fix:** Created _trellis-mock-hooks.mjs + _trellis-mock-loader.mjs + _trellis-mock-canonical.mjs to stub the dep chain
- **Files created:** 3 mock files in app/tests/services/

## Assumptions Verified

- `Question.reviewSchedule` always has `nextReviewDate`, `reviewCount`, `easeFactor` fields
- `buildAnchorReflectionTree` returns `anchors` and `legacyNodes` arrays per cluster (legacyNodes correctly excluded)
- `getBlossomDates()` returns `Record<string, string>` keyed by anchor ID

## Known Stubs

None. All functions are fully implemented with real logic.
