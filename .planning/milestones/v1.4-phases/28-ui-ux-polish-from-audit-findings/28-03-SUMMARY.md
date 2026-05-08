---
phase: 28-ui-ux-polish-from-audit-findings
plan: 03
subsystem: ui
tags: [ui-polish, askscreen, i18n, active-squish, empty-state, 2-line-clamp, touch-targets, wcag]

# Dependency graph
requires:
  - phase: 28-01-UI-UX-polish-foundation
    provides: "Spacing tokens (--space-* scale), 44x44 touch targets, active-squish CSS utility class in index.css:336-342, D-28 off-grid padding normalizations (AskScreen:607 left as TODO for this plan)"
  - phase: 28-02-trellis-interactions-knowledge-graph-rename
    provides: "PlannerScreen focusedAnchorId + onPointerDown plumbing on dead/dying rows (D-12); locale bundles with graph.headerTitle swapped; AskScreen.tsx comment updated for grep hygiene"
  - phase: 27-add-i18n-l10n-support
    provides: "useTranslation + t() i18n infrastructure, 4-locale bundle parity test harness"
provides:
  - "AskScreen recent-question rows as tappable <button> elements with navigate(/ask/:id), 2-line clamp (WebkitLineClamp: 2), 44px minHeight, active-squish press feedback"
  - "ask.recentQuestionsEmpty i18n key in all 4 locale bundles (en/zh/es/ja)"
  - "Pure helpers exported from AskScreen.tsx: renderRecentQuestionsMarker, buildRowClassName"
  - "PlannerScreen dead + dying Suggested Moves rows carry active-squish className"
  - "AskScreen:607 D-28 deferred padding fix (11px -> 12px) resolved via D-15 button refactor"
  - "D-17/D-18/D-19 audit pass: all surfaces documented as consistent (no changes required)"
affects: ["future polish phases", "any AskScreen consumer test"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline-mirror + source-side grep test pattern (Phase 28 precedent): pure helpers exported at module scope in .tsx, inline JS mirrors in .mjs tests, source grep verifies export symmetry"
    - "IIFE render pattern for marker-driven conditional JSX: renderRecentQuestionsMarker returns a typed marker, IIFE in JSX consumes it to select empty-state vs list branch"

key-files:
  created:
    - "app/tests/components/AskScreen.recent.test.mjs"
  modified:
    - "app/src/screens/AskScreen.tsx"
    - "app/src/screens/PlannerScreen.tsx"
    - "app/src/locales/en.json"
    - "app/src/locales/zh.json"
    - "app/src/locales/es.json"
    - "app/src/locales/ja.json"

key-decisions:
  - "D-15 landed: AskScreen recent-question rows refactored from <button> with bullet prefix to tappable <button> with 2-line clamp, arrow chevron, 12px 16px padding, 44px minHeight, width: 100%, active-squish press feedback. Empty-state branch renders t('ask.recentQuestionsEmpty') via renderRecentQuestionsMarker pure helper."
  - "D-16 landed: active-squish className applied to PlannerScreen dead row (line 210), dying row (line 261), and AskScreen recent-question rows via buildRowClassName helper. Refresh button already had it (Plan 28-02). Scope limited to chip-like pressable elements per UI-SPEC."
  - "D-17 no-op: empty-state copy consistency audit across HomeScreen, PlannerScreen, GraphScreen found all surfaces using appropriate patterns for their context. PlannerScreen emptyHint already uses em-dash + hint. GraphScreen uses heading + body (different structure, appropriate for its full-page empty state). No string changes warranted."
  - "D-18 no-op: GraphScreen toolbar audit found reorganize button with consistent padding (8px 12px = --space-sm), proper vertical alignment via Header component. Expand/collapse button properly positioned. Keyword chips are display-only (not pressable). No micro-tweaks needed."
  - "D-19/D-09 no-op: Residual P2 consistency pass found no remaining off-grid padding values (11px/13px/15px/17px) in target screens. All Header, Badge, and button patterns consistent after Plans 28-01 and 28-02."
  - "D-28 AskScreen:607 deferred fix now complete: padding '11px 16px' replaced with '12px 16px' as part of the D-15 button refactor (was deferred from Plan 28-01 Task 3 with TODO marker)."
  - "Test strategy: inline-mirror pattern with source-side grep (same as Phase 28-01/28-02 precedent). 9 tests: 4 inline-mirror contract tests (pure helpers), 5 source-side structural verifications (export presence, JSX branch, WebkitLineClamp, padding fix)."

patterns-established:
  - "IIFE render pattern for marker-driven JSX: extract pure marker function -> return typed object -> IIFE in JSX switches on marker.kind. Testable without DOM render."

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-04-16
---

# Phase 28 Plan 03: AskScreen Polish + Residual P2 Items Summary

**Shipped D-15/D-16 + D-28 deferred fix + D-17/D-18/D-19 audit (all no-op) -- AskScreen recent-questions refactored to tappable buttons with 2-line clamp + empty-state i18n key across 4 locale bundles, PlannerScreen Suggested Moves rows gain active-squish press feedback, residual audit found all surfaces consistent.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-16T21:02:44Z
- **Completed:** 2026-04-16T21:06:53Z
- **Tasks:** 2 (Task 1: TDD auto with code changes; Task 2: audit-only, no code changes)
- **Files modified:** 7 total (1 new test file + 6 modified: 1 screen refactor, 1 screen active-squish addition, 4 locale bundles)

## Accomplishments

- **AskScreen recent-questions refactored to tappable buttons.** Rows are now `<button>` elements with `navigate(/ask/:id)` on click, 2-line text clamp via `WebkitLineClamp: 2` (replacing prior single-line ellipsis), 44px minHeight touch target, 12px 16px padding (resolving D-28 deferral), and `active-squish` press feedback via `buildRowClassName` helper. The leading bullet `'* '` prefix is removed per UI-SPEC D-15.
- **Empty-state rendering for zero recent questions.** `renderRecentQuestionsMarker` pure helper drives the branch: when `questions.length === 0`, renders `t('ask.recentQuestionsEmpty')` = "No recent questions yet -- ask your first one below." in 0.82rem muted text. Key landed in all 4 locale bundles (en/zh/es/ja) with consistent em-dash + hint tone.
- **PlannerScreen Suggested Moves rows gain press feedback.** `className="active-squish"` added to dead row (replant) and dying row (heal) `<div>` elements. Combined with the existing refresh button, PlannerScreen now has 3 active-squish sites.
- **Residual audit clean.** D-17 (empty-state consistency), D-18 (GraphScreen toolbar), and D-19/D-09 (residual P2 items) all evaluated as no-op -- existing surfaces are consistent after Plans 28-01 and 28-02. Documented in SUMMARY rather than force-fitting unnecessary edits.

## Task Commits

Each task was committed atomically on branch `gsd/phase-28-ui-ux-polish`:

1. **Task 1 RED: Wave 0 test scaffolds** -- `9236c187` (test)
2. **Task 1 GREEN: AskScreen D-15 refactor + D-16 active-squish + i18n key + D-28 fix** -- `e9a94984` (feat)
3. **Task 2: D-17/D-18/D-19 audit** -- no code changes, no commit (documented in this SUMMARY as no-op)

## Files Created/Modified

### Created
- `app/tests/components/AskScreen.recent.test.mjs` -- 9 tests covering D-15-LOGIC (empty-state marker), D-16 (active-squish className), source-side structural safety nets (export presence, WebkitLineClamp, padding fix).

### Modified
- `app/src/screens/AskScreen.tsx` -- Added `RecentQuestionsMarker` interface, `renderRecentQuestionsMarker` and `buildRowClassName` pure helper exports at module scope. Replaced recent-questions rendering block with IIFE-driven conditional: empty-state branch renders `t(marker.i18nKey)` paragraph; list branch renders `<button>` rows with 2-line clamp, arrow chevron, 12px 16px padding, 44px minHeight, `buildRowClassName({ interactive: true })` className. Bullet prefix `'* '` removed. Prior `'11px 16px'` padding replaced with `'12px 16px'` (D-28 completion).
- `app/src/screens/PlannerScreen.tsx` -- Added `className="active-squish"` to dead row (line 210) and dying row (line 261) `<div>` elements for Suggested Moves press feedback.
- `app/src/locales/en.json` -- Added `ask.recentQuestionsEmpty`: `"No recent questions yet -- ask your first one below."`
- `app/src/locales/zh.json` -- Added `ask.recentQuestionsEmpty`: `"暂无近期提问 -- 先问一下吧。"`
- `app/src/locales/es.json` -- Added `ask.recentQuestionsEmpty`: `"Aun no hay preguntas recientes -- haz la primera abajo."`
- `app/src/locales/ja.json` -- Added `ask.recentQuestionsEmpty`: `"最近の質問はまだありません -- 下から最初の質問をどうぞ。"`

## Decisions Made

- **D-15 recent-row structure:** Preserved the existing `<button>` element type (rows were already buttons from a prior phase, contrary to the plan's assumption they were `<div>`s). Refactored internals: removed bullet prefix, added 2-line clamp via `-webkit-box` + `WebkitLineClamp: 2`, added `gap: '8px'` + `minHeight: '44px'` + `width: '100%'`, updated padding from `'11px 16px'` to `'12px 16px'`. The `onPointerEnter/Leave` hover effects were retained.
- **D-17 no-op decision:** PlannerScreen's emptyHint already uses em-dash + hint pattern ("No suggestions right now -- tap refresh to check for new moves."). GraphScreen's two-line heading + body empty state ("Your knowledge reflection map is empty." / "Ask questions and review ideas...") is a different structure appropriate for a full-page empty state -- not inconsistent, just different hierarchy level. ReviewScreen library empty ("No flashcards yet. Start a conversation to generate some!") follows period + CTA which is fine for its context. No forced homogenization warranted.
- **D-18 no-op decision:** GraphScreen reorganize button uses `padding: '8px 12px'` (aligns to `--space-sm` 8px from D-26 scale). Header component handles vertical alignment uniformly. Expand/collapse button is properly absolute-positioned bottom-right. Keyword chips are display-only (non-pressable tags). No toolbar alignment issues found.
- **D-19/D-09 no-op decision:** Exhaustive grep for off-grid padding values (11px/13px/15px/17px) across HomeScreen, PlannerScreen, GraphScreen, AskScreen returned zero hits. All targets cleaned in Plans 28-01/28-02.
- **Test inline-mirror pattern:** Consistent with Phase 28-01 and 28-02 precedent. The 4 pure-helper tests run standalone via inline JS mirrors; 5 source-side greps verify the exports + JSX structure exist in AskScreen.tsx.

## Deviations from Plan

None -- plan executed as written. The D-17/D-18/D-19 audits found no issues requiring changes, which the plan explicitly anticipated as the default outcome ("D-17: Scope-limited to tone/CTA review... Default: no string changes."; "If GraphScreen appears visually consistent on read, document 'no D-18 changes required'"; "Cap total changes at 4 [or] 'no residual items warranted'").

## Issues Encountered

None.

## Deferred Issues

None. All Phase 28 audit findings (D-04 through D-19) are now either landed or documented as no-op.

## Known Stubs

None -- all code paths are wired to live data sources.

## User Setup Required

None -- no external service configuration changes.

## Next Phase Readiness

- **Phase 28 is complete.** All 3 plans (28-01 Wave A+B, 28-02 Wave C, 28-03 Wave D) executed. All D-04 through D-19 audit findings addressed (landed or documented-as-no-op).
- **AskScreen recent-questions surface is clean.** Future features can extend the row (e.g., swipe-to-delete, drag-to-reorder) by building on the `<button>` + flexbox structure.
- **active-squish is now pervasive** across interactive chip-like elements: BottomNavigation tabs, PlannerScreen refresh + dead + dying rows, AskScreen recent-question rows. Future screens with chip-like pressables should apply the same utility class.
- **Locale bundles are at parity.** The new `ask.recentQuestionsEmpty` key is the only addition in Phase 28 (alongside the D-14 graph.headerTitle value swap from Plan 28-02). No stale keys, no orphan keys.

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: `app/tests/components/AskScreen.recent.test.mjs`

**Commits verified in git history:**
- FOUND: `9236c187` (test(28-03): add failing Wave 0 tests for AskScreen D-15-LOGIC + D-16)
- FOUND: `e9a94984` (feat(28-03): AskScreen recent-questions refactor (D-15) + active-squish (D-16) + i18n key + D-28 deferral complete)

**All 10 must_haves truths verified:**
- TRUE: AskScreen recent-question rows render as tappable `<button>` with `navigate('/ask/${q.id}')` -- confirmed by grep.
- TRUE: Recent-question rows have no leading bullet; 2-line clamp via `WebkitLineClamp: 2` -- confirmed by grep (no `'* {q.content}'`, `WebkitLineClamp: 2` present).
- TRUE: Empty-state paragraph renders `t('ask.recentQuestionsEmpty')` -- confirmed by grep.
- TRUE: `ask.recentQuestionsEmpty` key exists in all 4 locale bundles -- grep returns count 4 (one per bundle).
- TRUE: Recent-question rows AND Suggested Moves rows have `className='active-squish'` -- AskScreen has 4 occurrences, PlannerScreen has 3.
- TRUE: AskScreen:607 row padding replaced with `12px 16px` -- no `'11px 16px'` remains.
- TRUE: GraphScreen toolbar alignment consistent -- audit documented as no-op.
- TRUE: Empty-state copy consistent across surfaces -- D-17 audit documented as no-op.
- TRUE: Wave 0 test covers D-15-LOGIC (empty-state marker) -- `renderRecentQuestionsMarker` test present and passing.
- TRUE: Wave 0 test covers D-16 (active-squish className) -- `buildRowClassName` test present and passing.

**Phase-wide verification gates:**
- 12/12 tests green (9 AskScreen.recent + bundle-parity + D-14 value + missing-key)
- vite build green in 2.94s
- Zero new tsc errors in touched files (8 pre-existing errors unchanged)
- All 4 locale bundles parse as valid JSON

---
*Phase: 28-ui-ux-polish-from-audit-findings*
*Completed: 2026-04-16*
