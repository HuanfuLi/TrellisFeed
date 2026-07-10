---
phase: 12-portal-navigation-rich-moves
plan: "02"
subsystem: navigation
tags: [navigation, gap-closure, move-routing, requirements, typescript]
dependency_graph:
  requires:
    - 12-01 (moveNavigator.ts with MOVE_TYPE_ROUTES constant)
  provides:
    - Correct deepdive routing: MOVE_TYPE_ROUTES.deepdive.screen = 'posts'
    - buildMoveNavigationPath case 'posts' returning /posts/:id
    - NAV-01 and NAV-02 canonical definitions in REQUIREMENTS.md
  affects:
    - app/src/lib/moveNavigator.ts (deepdive routing fix)
    - .planning/REQUIREMENTS.md (NAV section added)
tech_stack:
  added: []
  patterns:
    - Exhaustive switch type narrowing (cast default branch to string on never-typed route.screen)
key_files:
  created: []
  modified:
    - app/src/lib/moveNavigator.ts
    - .planning/REQUIREMENTS.md
decisions:
  - deepdive moves route to PostDetailScreen at /posts/:id (not AskScreen at /ask/:id)
  - paramKey for deepdive changed from 'questionId' to 'postId'
  - TypeScript exhaustive switch requires string cast in default branch when all cases are covered by as const union
  - NAV-01 and NAV-02 registered in REQUIREMENTS.md as checked [x] (implemented in Phase 12)
metrics:
  duration: "5 minutes"
  completed_at: "2026-03-28"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 2
---

# Phase 12 Plan 02: Gap Closure — Deepdive Routing Fix & NAV Requirements Summary

## One-Liner

Fixed deepdive move routing from `/ask/:id` to `/posts/:id` (PostDetailScreen) and registered NAV-01/NAV-02 in REQUIREMENTS.md — closing both gaps identified in Phase 12 verification.

## What Was Built

### Task 1: Fix deepdive routing in moveNavigator.ts (commit: 4303d5d0)

Two targeted edits to `app/src/lib/moveNavigator.ts`:

**Edit 1 — MOVE_TYPE_ROUTES.deepdive (lines 19-22):**
- Changed `screen: 'ask'` to `screen: 'posts'`
- Changed `paramKey: 'questionId'` to `paramKey: 'postId'`

**Edit 2 — buildMoveNavigationPath switch (after line 137):**
- Added `case 'posts': return '/posts/${linkedResource.id}';` between the 'ask' and 'podcast' cases

As a side effect, `getMoveDestination('deepdive move')` now returns `'Post Detail'` instead of `'Unknown'` — the `screenLabels['posts']` entry at line 202 was already present but unreachable before this fix.

### Task 2: Register NAV-01 and NAV-02 in REQUIREMENTS.md (commit: 127cb04b)

Added to `.planning/REQUIREMENTS.md`:

- New subsection `### Navigation (NAV)` in Active Requirements, inserted between PLANNER and CARDS sections:
  - `NAV-01`: Move taps navigate to the screen matching the linkedResource type
  - `NAV-02`: Navigation preserves history stack so back button returns to originating screen
- Both marked `[x]` (implemented in Phase 12)

- New summary entry in Requirements by Category:
  - `### Navigation (2 requirements)` with NAV-01 through NAV-02 description

### Task 3: Confirm build passes (commit: 47b91944)

TypeScript check (`npx tsc --noEmit`) passes with zero errors in moveNavigator.ts.

Build check (`npm run build`) revealed one new TS error in moveNavigator.ts introduced by exhaustive type narrowing: with all MOVE_TYPE_ROUTES screen values now covered by switch cases ('review', 'ask', 'posts', 'podcast'), the `default` branch's `route.screen` was narrowed to `never` by TypeScript's control flow analysis. Fixed by casting to `string` in the `console.warn` template literal.

Pre-existing errors in `gemini.provider.ts`, `nanoBanana.provider.ts`, and `InfoFlow.tsx` (from Phase 7) remain — they are out of scope for this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript never-type error in buildMoveNavigationPath default branch**
- **Found during:** Task 3 (build verification)
- **Issue:** Adding `case 'posts'` to the switch exhausted all possible values of the `as const` union type for `route.screen`. TypeScript narrowed the `default` branch's `route.screen` to `never`, causing a build error: `Property 'screen' does not exist on type 'never'` at line 148.
- **Fix:** Cast `route` to `{ screen: string }` in the `console.warn` call so the default branch compiles while preserving the exhaustive pattern.
- **Files modified:** `app/src/lib/moveNavigator.ts` (line 148)
- **Commit:** 47b91944

### Deferred Items

Pre-existing TypeScript errors in Phase 7 provider files (out of scope for this plan):
- `src/providers/gemini.provider.ts`: ErrorCode incompatibilities ('API_KEY_NOT_CONFIGURED', 'INVALID_REQUEST', 'RETRIES_EXHAUSTED')
- `src/providers/nanoBanana.provider.ts`: Same ErrorCode incompatibilities
- `src/components/InfoFlow.tsx`: Unused variable + missing className prop

These existed before Phase 12 and are logged to deferred-items.

## Known Stubs

None.

## Self-Check: PASSED
