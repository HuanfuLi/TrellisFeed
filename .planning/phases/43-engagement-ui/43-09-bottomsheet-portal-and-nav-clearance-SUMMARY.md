---
phase: 43-engagement-ui
plan: 09
subsystem: ui
tags: [gap-closure, uat-test-2, bottom-sheet, react-portal, safe-area, regression-test, phase-32-1-pattern]

# Dependency graph
requires:
  - phase: 43-engagement-ui (plans 43-01 through 43-08)
    provides: "BottomSheet usage at HomeScreen via LongPressMenu; phase already verifier-ready 8/8"
provides:
  - "BottomSheet renders via createPortal(overlay, document.body) — escapes SwipeTabContainer per-slot translateZ(0) containing block (Phase 32.1 portal pattern applied)"
  - "Inner sheet bottom offset calc(80px + var(--safe-area-bottom)) — defense-in-depth nav clearance"
  - "SSR-safe `typeof document === 'undefined'` guard returning null"
  - "Source-reading regression test (6 assertions) at app/tests/components/BottomSheet.portal.test.mjs"
  - "HomeScreen LongPressMenu host comment aligned with implemented portal reality (no aspirational language)"
affects:
  - "Any consumer of BottomSheet — currently LongPressMenu only; sheet now correctly anchors to viewport regardless of mount point"
  - "Phase 43 UAT Test 2 — blocker resolved; Dismiss row visible + tappable"
  - "Phase 43 UAT Test 4 — unblocked for re-test"

# Tech tracking
tech-stack:
  added:
    - "react-dom createPortal (already a transitive dep; new direct import in BottomSheet.tsx)"
  patterns:
    - "Phase 32.1 portal-vs-in-tree pattern extended from Header to BottomSheet — overlays inside SwipeTabContext slots must portal to document.body to escape per-slot translateZ(0) containing blocks"
    - "Defense-in-depth: portal escape (structural) + safe-area-aware bottom clearance (geometric) — neither alone is sufficient against future regressions"
    - "Source-reading regression test discipline — pure regex + indexOf scoping, no React render, no jsdom; matches Phase 39/40/41/42/43 invariant-test pattern"

key-files:
  created:
    - app/tests/components/BottomSheet.portal.test.mjs (92 LOC, 6 tests)
    - .planning/phases/43-engagement-ui/43-09-bottomsheet-portal-and-nav-clearance-SUMMARY.md
  modified:
    - app/src/components/ui/BottomSheet.tsx (76 → 99 LOC; +26 / −3; import + SSR guard + createPortal wrap + clearance offset + header doc-comment)
    - app/src/screens/HomeScreen.tsx (comment block at ~lines 952-961; +9 / −5; references 43-09 + createPortal(overlay, document.body) + calc(80px+safe-area-bottom))
    - .planning/phases/43-engagement-ui/deferred-items.md (new file, 1 deferred item for cross-plan TS6133 noise; not a regression)

decisions:
  - "Portal target = document.body literally (NOT a custom #portal-root div). Matches Phase 32.1 Header pattern + CLAUDE.md guidance. Side-steps any potential ancestor-of-portal-root containing-block reintroduction."
  - "Bottom clearance value = calc(80px + var(--safe-area-bottom)). 80px = BottomNavigation row footprint (8px top + 64px row + 8px bottom = 80px per BottomNavigation.tsx:167-178). safe-area-bottom is the project's standard CSS var (set in index.css from env(safe-area-inset-bottom))."
  - "Inner sheet bottom padding trimmed 40px → 24px because the clearance offset now provides the visual breathing room previously absorbed by the 40px pad. Avoids stacking the buffers redundantly."
  - "Both the portal AND the clearance are kept (defense-in-depth). Portal alone fixes the stacking-context capture; clearance alone fixes the overlap geometry. Either alone is sufficient for the reported symptom, but together they survive future ancestor mutations."
  - "SSR guard returns null (not the overlay) — matches the previous in-tree zero-output behavior on the server. createPortal(overlay, document.body) cannot be reached when document is undefined."
  - "Comment in BottomSheet.tsx header explicitly cross-references .planning/debug/dismiss-row-clipped-by-bottom-nav.md so future maintainers have the geometric proof one grep away. Matches CLAUDE.md 'best practices learned in Phase 32.1' rule 8 (document in three places: CLAUDE.md, auto-memory, inline comment at the load-bearing site)."
  - "HomeScreen comment edit is comment-only — no JSX or behavior change. Per parallel-safety note in plan, my edit at lines ~952-961 stays >250 lines away from 43-11's edits at lines 651-679 + 727-729, so the parallel agents merged cleanly."

metrics:
  duration: "~5 minutes (3 atomic commits, automated verification, source-reading test pass)"
  completed: 2026-05-11
  task_count: 3
  file_count: 3
  commits: 3
---

# Phase 43 Plan 09: BottomSheet Portal + Nav Clearance — Summary

Gap closure for Phase 43 UAT Test 2 (severity: major) — restored the long-press menu's third row ("Not Interested") to a visible, tappable state above the BottomNavigation by porting the Phase 32.1 Header portal-vs-in-tree pattern to `BottomSheet.tsx` and adding defense-in-depth safe-area-aware nav clearance.

## Tasks executed (3 / 3)

1. **Task 1 — Wrap BottomSheet outer overlay in createPortal + add nav clearance offset** (`fix(43-09): portal BottomSheet to document.body + nav clearance — restore Dismiss row`). Two edits to `app/src/components/ui/BottomSheet.tsx`:
   - Added `import { createPortal } from 'react-dom'` to the top of the file alongside the existing `import type { ReactNode, MouseEvent } from 'react'`.
   - Restructured component return: SSR guard (`if (typeof document === 'undefined') return null`) → build the overlay JSX as a local const → `return createPortal(overlay, document.body)`.
   - Flipped the inner sheet's `bottom: 0` → `bottom: 'calc(80px + var(--safe-area-bottom))'` and trimmed the inner padding from `'20px 16px 40px'` → `'20px 16px 24px'`.
   - Added a header doc-comment cross-referencing 43-09 + `.planning/debug/dismiss-row-clipped-by-bottom-nav.md`.
   - File grew 76 → 99 LOC (+26 / −3). Commit: **`d4d5b0f1`**.

2. **Task 2 — Update HomeScreen LongPressMenu host comment** (`docs(43-09): align HomeScreen LongPressMenu host comment with portal reality`). Single comment-block edit in `app/src/screens/HomeScreen.tsx` at lines ~952-961. Replaced the prior aspirational wording ("BottomSheet inside LongPressMenu portals to document.body via position:fixed at zIndex 500" — false before 43-09) with text that explicitly references `createPortal(overlay, document.body)`, the Phase 32.1 pattern, the SwipeTabContainer per-slot translateZ(0) containing-block escape, and the `calc(80px + var(--safe-area-bottom))` clearance offset. Comment-only edit; no JSX or behavior change. +9 / −5. Commit: **`01c43791`**.

3. **Task 3 — Add BottomSheet.portal.test.mjs source-reading regression test** (`test(43-09): source-reading regression for BottomSheet portal + nav clearance`). Created `app/tests/components/BottomSheet.portal.test.mjs` (92 LOC, 6 tests). Pure regex + indexOf assertions against the live source file — no React render, no jsdom (matches Phase 39/40/41/42/43 invariant-test pattern, follows `LongPressMenu.test.mjs` + `SettingsDataScreen.force-new-day-engagement-reset.test.mjs` style). Tests:
   1. `createPortal` imported from `'react-dom'`
   2. `createPortal(node, document.body)` invocation present (regex tolerant of whitespace)
   3. `typeof document === 'undefined'` guard present AND `return null` within 80 chars of the guard
   4. Inner sheet bottom is `calc(80px + var(--safe-area-bottom))`
   5. Inner sheet keeps `position: 'absolute'` (translateY animation depends on it)
   6. Negative invariant — inner sheet does NOT regress to `bottom: 0,` (scoped between `position: 'absolute'` and `left: 0` to avoid false-positives on overlay's `inset: 0`)

   6/6 pass. Full component-suite regression run (`node --test 'tests/components/**/*.test.mjs'`) shows 105/105 pass, no neighbor regressions. Commit: **`eff0adba`**.

## Commits (3 atomic)

| # | Hash | Type | Message |
|---|------|------|---------|
| 1 | `d4d5b0f1` | fix | portal BottomSheet to document.body + nav clearance — restore Dismiss row |
| 2 | `01c43791` | docs | align HomeScreen LongPressMenu host comment with portal reality |
| 3 | `eff0adba` | test | source-reading regression for BottomSheet portal + nav clearance |

## Verification

- [x] `grep -c "createPortal" app/src/components/ui/BottomSheet.tsx` returns 4 (import + invocation + 2 doc references; spec required ≥2)
- [x] `grep -c "document.body" app/src/components/ui/BottomSheet.tsx` returns 3 (spec required ≥1)
- [x] `grep -c "typeof document === 'undefined'" app/src/components/ui/BottomSheet.tsx` returns 1 (spec required =1)
- [x] `grep -c "calc(80px + var(--safe-area-bottom))" app/src/components/ui/BottomSheet.tsx` returns 2 (1 in header doc-comment, 1 in live style; spec required ≥1 effective)
- [x] `node --test tests/components/BottomSheet.portal.test.mjs` → 6 pass, 0 fail
- [x] `node --test 'tests/components/**/*.test.mjs'` → 105 pass, 0 fail (no neighbor regression)
- [x] HomeScreen.tsx comment references `createPortal(overlay, document.body)` + `43-09` + `calc(80px + var(--safe-area-bottom))`

## Deviations from Plan

- **[Rule 2 — Critical] Added `.planning/phases/43-engagement-ui/deferred-items.md`.** During Task 2's `npx tsc -b --noEmit` step I observed a `TS6133` error in `src/screens/PostDetailScreen.tsx:595` (`'renderDeepDiveControls' is declared but its value is never read.`). This is cross-plan noise from plan **43-12** (Deep Dive Controls above essay body), which is executing in parallel and had partially landed `renderDeepDiveControls` as an extracted helper without yet rendering it. Per executor scope rules ("Only auto-fix issues DIRECTLY caused by the current task's changes"), I did NOT fix it; instead I logged it to `deferred-items.md` and continued. By the end of execution, sibling commit `0033073c fix(43-12): move Deep Dive controls above essay body (operator placement update)` had already landed; the deferred item is resolved naturally by 43-12. Documented for traceability.

- **None other.** All three plan tasks executed exactly as specified. No Rule-1 bugs, no Rule-3 blockers, no Rule-4 architectural questions.

## Auth Gates

None.

## What 43-09 closes

- **UAT Test 2** (severity: major) — long-press menu's third row ("Not Interested" / Dismiss) was clipped behind the BottomNavigation bar. Root cause was missing `createPortal` (the HomeScreen comment was aspirational, not implemented) compounded by no offset for the nav's ~80–110px footprint. Both layers fixed.
- **UAT Test 4** (previously blocked by this gap) — unblocked for re-test.

## Cross-references

- `.planning/debug/dismiss-row-clipped-by-bottom-nav.md` — full root-cause diagnosis with geometric proof
- `CLAUDE.md` "Header positioning (Phase 32.1 — load-bearing)" — origin of the portal-vs-in-tree pattern; same bug class (`position: fixed` + ancestor `transform` + Android Chromium WebView)
- `app/src/components/SwipeTabContainer.tsx` lines 252-280 — the per-slot `transform: translateZ(0)` containing block we now escape via portal
- `app/src/components/BottomNavigation.tsx` lines 167-178 — the 80px nav footprint we now clear via the calc(...) offset

## Self-Check: PASSED

- `app/src/components/ui/BottomSheet.tsx` — FOUND (99 LOC; portal + SSR guard + clearance offset present)
- `app/src/screens/HomeScreen.tsx` — FOUND (comment block at ~952-961 updated)
- `app/tests/components/BottomSheet.portal.test.mjs` — FOUND (92 LOC, 6 tests)
- Commit `d4d5b0f1` — FOUND in `git log`
- Commit `01c43791` — FOUND in `git log`
- Commit `eff0adba` — FOUND in `git log`

## Known Stubs

None. No empty data sources, placeholder text, or unwired components introduced by this plan.
