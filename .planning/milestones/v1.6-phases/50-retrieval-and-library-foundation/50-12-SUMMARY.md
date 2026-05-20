---
phase: 50-retrieval-and-library-foundation
plan: 12
title: "Gap Closure: Chip Blur-Race, Tab-Preserves-Query, Uniform Chip Padding"
subsystem: saved-screen
tags: [gap-closure, ux-fix, regression-test]
requires: [SavedScreen.tsx]
provides: [chip-blur-race-fix, tab-preserves-query-contract, uniform-chip-padding]
affects: [/saved route, FilterChip, tab-change effect]
key-files:
  created:
    - app/tests/screens/SavedScreen.tab-preserves-query.test.mjs
    - app/tests/screens/SavedScreen.chip-blur-race.test.mjs
  modified:
    - app/src/screens/SavedScreen.tsx
key-decisions: []
requirements-completed: [RETRIEVE-01]
duration: "8min"
completed: "2026-05-18"
---

# Phase 50 Plan 12: Gap Closure -- Chip Blur-Race, Tab-Preserves-Query, Uniform Chip Padding Summary

Closed gaps G2, G6, and G7 from 50-UAT.md with three localized edits to SavedScreen.tsx and two new source-reading regression test files (11 tests total).

## Task table

| Task | Commit | Files changed | Description | Issues |
|------|--------|---------------|-------------|--------|
| 1 | `0ada01c2` | 1 modified | G2 onPointerDown/onMouseDown preventDefault on FilterChip; G6 remove setInputDraft/setQuery from tab-change effect; G7 padding 6px 12px | None |
| 2 | `6480fef9` | 1 created | TPQ-01..05 tab-preserves-query source-reading tests | None |
| 3 | `d83b10b9` | 1 created | CBR-01..06 chip blur-race source-reading tests | CBR-04 regex needed `[\s\S]*?` instead of `[^>]*` due to multi-line JSX comments between attributes; fixed before commit |

## Verification

All 19 SavedScreen tests pass (8 existing + 5 TPQ + 6 CBR):

```
node --test tests/screens/SavedScreen.tab-preserves-query.test.mjs \
  tests/screens/SavedScreen.chip-blur-race.test.mjs \
  tests/screens/SavedScreen.search-scope.test.mjs \
  tests/screens/SavedScreen.collections-tab.test.mjs
# pass 19, fail 0
```

## Next

Ready for 50-13.
