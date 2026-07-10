---
phase: 12-portal-navigation-rich-moves
plan: "01"
subsystem: navigation
tags: [navigation, planner, move-cards, react-router, deep-linking]
dependency_graph:
  requires:
    - phase-10 (PlannedMove type with linkedResource field)
    - phase-11 (MoveCard component, usePlannerAutoGen hook)
  provides:
    - moveNavigator utility for move-based screen routing
    - Move breadcrumbs in ReviewScreen, PostDetailScreen, QuestionDetailScreen
    - End-to-end navigation from Planner suggested moves to target content
  affects:
    - MoveCard (Add button behavior)
    - PlannerScreen (onNavigate callback)
    - ReviewScreen (card filtering, breadcrumb)
    - PostDetailScreen (breadcrumb, back navigation)
    - QuestionDetailScreen (breadcrumb)
tech_stack:
  added: []
  patterns:
    - moveNavigator utility pattern (centralized routing logic)
    - MoveNavigationState via location.state (React Router 7)
    - parseMoveNavigationState for safe state extraction in target screens
key_files:
  created:
    - app/src/lib/moveNavigator.ts
  modified:
    - app/src/components/MoveCard.tsx
    - app/src/screens/PlannerScreen.tsx
    - app/src/screens/ReviewScreen.tsx
    - app/src/screens/PostDetailScreen.tsx
    - app/src/screens/QuestionDetailScreen.tsx
decisions:
  - Centralized move routing in moveNavigator.ts utility (not inline in components)
  - MoveNavigationState passed via location.state (React Router 7 pattern)
  - ReviewScreen filters items by linkedResource.id (nodeId match) when from move navigation
  - PostDetailScreen back button navigates to -1 when moveState present (returns to Planner)
  - parseMoveNavigationState returns null when required fields missing (safe default)
metrics:
  duration: "4 minutes"
  completed_at: "2026-03-27"
  tasks_completed: 4
  tasks_total: 4
  files_created: 1
  files_modified: 5
---

# Phase 12 Plan 01: Portal Navigation & Rich Moves Linking Summary

## One-Liner

Centralized move navigation via `moveNavigator.ts` with React Router location.state context passing — review/question/podcast moves now route directly to target screens with breadcrumb indicators.

## What Was Built

### Task 1: moveNavigator Utility (commit: 5e57d4a9)

Created `app/src/lib/moveNavigator.ts` with:
- `navigateToMove(move, navigate, options)` — async function that validates move's `linkedResource`, builds path, passes `MoveNavigationState` via `location.state`, returns `Promise<boolean>`
- `buildMoveNavigationPath(move, route)` — builds `/review`, `/ask/:id`, `/podcast` paths based on move type
- `parseMoveNavigationState(locationState)` — safely extracts `MoveNavigationState` from location state, returns null if not a move navigation
- `getMoveDestination(move)` — returns human-readable screen label for a move
- `MoveNavigationState` interface exported for type safety in target screens

Route mapping: `review` → `/review`, `deepdive|connection` → `/ask/:id`, `podcast` → `/podcast`

### Task 2: MoveCard Navigation Integration (commit: 16ba403c)

Updated `MoveCard.tsx`:
- Added `useNavigate` and `navigateToMove` imports
- Added `onNavigate?: (success: boolean) => void` prop
- Replaced `onClick={() => onAccept(move.id)}` with `handleAddClick` function
- `handleAddClick` calls `onAccept(move.id)` first, then calls `navigateToMove()` after 50ms timeout to allow state flush

Updated `PlannerScreen.tsx`:
- Added `onNavigate` callback to `MoveCard` renders
- Shows `toast('Navigation failed...', 'error')` on navigation failure

### Task 3: Target Screen Updates (commit: d70397e6)

**ReviewScreen:**
- Added `useLocation` and `parseMoveNavigationState` imports
- Extracts `moveState` and `linkedResource` from location state
- Filters `items` by `card.nodeId === linkedResource.id` when coming from a review move
- Uses filtered `reviewItems` throughout session (total, currentItem, sessionCards init, done conditions)
- Shows breadcrumb: "Suggested move: [title]" above progress bar

**PostDetailScreen:**
- Added `parseMoveNavigationState` import
- Extracts `moveState` alongside existing `post`/`connectionMeta` state
- Validates `linkedResource.id` matches URL `:id` param (console.warn on mismatch)
- Shows breadcrumb above back button when `moveState` present
- Back button uses `navigate(-1)` when from move (returns to Planner), `navigate('/home')` otherwise

**QuestionDetailScreen:**
- Added `useLocation` and `parseMoveNavigationState` imports
- Extracts `moveState` from location state
- Validates `linkedResource.id` matches URL `:id` param (console.warn on mismatch)
- Shows breadcrumb: "Suggested move: [title]" above back button

### Task 4: Validation

All verification checks passed:
- TypeScript compilation: clean (no errors)
- Build: success (`vite build` outputs `✓ built`)
- All 10 success criteria verified
- Skip/Dismiss buttons on MoveCard unaffected (regression check passed)

## Deviations from Plan

### Auto-fixed Issues

None.

### Plan Adaptations

**1. ReviewScreen items filtering uses `items` (from useReview hook), not `allCards`**

The plan showed filtering `allCards`, but `allCards` is the full library while `items` is the active review queue. The correct data to filter for a review session is `items` (due cards). `filteredItems` filters `items` by `card.nodeId === linkedResource.id`, and falls back to all `items` if no matches found. This correctly narrows the review session to the concept while using the proper data source.

**2. Route mapping: `post` type → `/posts/:id` not in MOVE_TYPE_ROUTES**

The current `PlannedMoveType` is `'review' | 'deepdive' | 'connection' | 'podcast'` — there is no `post` move type in the type system. `PostDetailScreen` is navigated to from `deepdive` or `connection` moves via `/ask/:id` (which maps to `QuestionDetailScreen`). The `PostDetailScreen` integration follows the plan's intent by using `parseMoveNavigationState` and showing a breadcrumb when navigated from a move.

**3. `buildMoveNavigationPath` switch case**

The plan included a `case 'posts':` in the switch, but `MOVE_TYPE_ROUTES` never maps to `'posts'` screen (podcast/review/ask are the actual screen values). The switch correctly covers all mapped screens without a `posts` case.

## Known Stubs

None. All navigation logic is wired end-to-end.

## Self-Check: PASSED

- moveNavigator.ts: FOUND (`app/src/lib/moveNavigator.ts`)
- MoveCard.tsx: FOUND with handleAddClick and navigateToMove
- Task commits: FOUND (5e57d4a9, 16ba403c, d70397e6)
- TypeScript: clean
- Build: success
