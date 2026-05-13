---
phase: 43-engagement-ui
plan: 02
subsystem: ui
tags: [i18n, infoflow, tile-simplification, news-card, source-reading-invariant]

# Dependency graph
requires:
  - phase: 43-engagement-ui (43-01)
    provides: Wave-0 source-reading-invariant test scaffold at app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs
provides:
  - News tile bottom-tags flex row no longer renders the "NEWS" presentation-style chip
  - Locale key `infoFlow.newsTag` removed from all 4 bundles (en/zh/es/ja) in lockstep — bundle-parity preserved
  - Source-reading invariant test that fails if either the JSX element OR the locale key is re-introduced
affects: [43-03, 43-04, 43-05, 43-06, 43-07, 43-08, future tile-polish phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operator-bounded simplification (TS-*) — one rendering element + its i18n key, locked by paired negative-grep + preserved-structure assertions"

key-files:
  created: []
  modified:
    - app/src/components/InfoFlow.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
    - app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs

key-decisions:
  - "TS-01 scope strictly bounded to the news-tile NEWS chip — image/text-art/video/connection/milestone tiles intentionally untouched (operator-bounded simplification per CONTEXT.md §TS-01)"
  - "Locale-key removal lands in the same commit as the JSX deletion so bundle-parity.test.mjs cannot regress (CLAUDE.md i18n Workflow gate)"
  - "Source-reading test is paired: NEGATIVE on newsTag + POSITIVE on flex container and sourceQuestionTitles chip — prevents over-deletion regressions"

patterns-established:
  - "Tile-element removal contract: delete JSX → delete locale key from 4 bundles → keep i18n.d.ts in sync (n/a here since newsTag wasn't explicitly typed) → add paired negative+positive source-reading test"

requirements-completed: [ENGAGE-01]

# Metrics
duration: 2min
completed: 2026-05-11
---

# Phase 43 Plan 02: Trim Presentation-Style Tag (TS-01) Summary

**Removed the "NEWS" presentation-style chip from news tile cards (InfoFlow.tsx) and the `infoFlow.newsTag` key from all 4 locale bundles; paired source-reading test locks absence in both code and locales.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-11T07:32:38Z
- **Completed:** 2026-05-11T07:34:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Deleted the `<span style={{...}}>{t('infoFlow.newsTag')}</span>` element (formerly InfoFlow.tsx:252-264) — surrounding `<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>` (formerly line 251, now line 254) and the `sourceQuestionTitles?.slice(0, 1).map(...)` chip both preserved verbatim.
- Removed `"newsTag": "<localized>"` from `app/src/locales/{en,zh,es,ja}.json` (formerly line 779 in each file) in a single atomic commit so `bundle-parity.test.mjs` never sees an inconsistent intermediate state.
- Filled the Wave-0 scaffold at `app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs` with 4 source-reading assertions (negative grep on the locale key + ts code, positive structural assertions for the preserved flex container and sourceQuestionTitles chip).
- `tsc -b --noEmit` clean — no orphan `t('infoFlow.newsTag')` call sites elsewhere, no `i18n.d.ts` typing needed (the key was not explicitly typed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete NEWS chip from InfoFlow.tsx + delete newsTag key from 4 locale bundles** — `7dc28770` (refactor)
2. **Task 2: Fill in assertions in InfoFlow.no-presentation-style-tag.test.mjs scaffold** — `d4e0a397` (test)

## Files Created/Modified

- `app/src/components/InfoFlow.tsx` — Deleted the inline `<span>{t('infoFlow.newsTag')}</span>` element from the news-card bottom-tags flex row (formerly lines 252-264). Added a 3-line comment block referencing CONTEXT.md §TS-01 so future readers see the why-was-this-removed signal without having to chase phase docs.
- `app/src/locales/en.json` — Removed `"newsTag": "NEWS"` (formerly line 779).
- `app/src/locales/zh.json` — Removed `"newsTag": "新闻"` (formerly line 779).
- `app/src/locales/es.json` — Removed `"newsTag": "NOTICIAS"` (formerly line 779).
- `app/src/locales/ja.json` — Removed `"newsTag": "ニュース"` (formerly line 779).
- `app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs` — Replaced the Wave-0 skip stub with 4 real `node:test` assertions (TS-01 source-reading invariant). 81 lines, zero `skip:` directives.

## Verification Output

```
=== tsc -b --noEmit ===                            exit 0
=== TS-01 invariant test ===                       pass 4 / fail 0
=== bundle-parity.test.mjs ===                     pass 2 / fail 0
=== missing-key.test.mjs ===                       pass 1 / fail 0
=== InfoFlow.video-tap-emit.test.mjs (collateral) ===  pass 5 / fail 0
```

Negative grep results (all 0 — TS-01 absence locked):

```
InfoFlow.tsx infoFlow.newsTag: 0
InfoFlow.tsx newsTag (any):    0
en.json newsTag:               0
zh.json newsTag:               0
es.json newsTag:               0
ja.json newsTag:               0
```

Preserved structure (positive assertions — over-deletion guard):

```
Flex container preserved:               2 occurrences
sourceQuestionTitles chip preserved:    2 occurrences
```

## Decisions Made

- Locale-key removal landed in the SAME commit as the JSX deletion (rather than two commits) so bundle-parity.test.mjs cannot regress at an intermediate sha — the i18n bundle-parity contract is the standing CLAUDE.md gate for any locale-key mutation.
- The scaffold-fill commit was kept separate (Task 2) per the operator's per-file atomic-commit convention (Phase 37 D-03 / Phases 39-42 cadence): source change + test change are paired-but-distinct atomic commits, not amended into one.
- The comment block left at InfoFlow.tsx:251-253 (`TS-01 (Phase 43-02): ...`) explicitly references CONTEXT.md so a future contributor who wonders why the bottom-tags flex row has no NEWS pill can trace the decision in one hop — preventing well-intentioned "completion" PRs that re-add the chip.
- `i18n.d.ts` did NOT explicitly type `newsTag` (verified via grep), so no augmentation file edit was needed. If a future i18n migration adds explicit per-key typing, the `newsTag` field must NOT be re-introduced.

## Deviations from Plan

None - plan executed exactly as written.

The plan's line-number hints (line 743 in locale bundles) drifted to line 779 between research-time and execution-time, but the structural Edit-tool match (matching on the surrounding `"infoFlow": {` block) handled this gracefully — no code-search needed, no deviation worth flagging.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tile simplification scope is sealed for Phase 43; resist any future "while we're here" expansion. Per CONTEXT.md DS-01, broader tile-metadata audit (news source attribution, video channel byline, news date stamp) is explicitly out of scope this phase. A future polish phase (likely v1.5.x or v1.6) can reopen after operator lives with TS-01 for a usage cycle.
- The source-reading invariant test now silently guards against regression. Any future PR that re-adds either the JSX element OR the locale key will fail `node --test tests/components/InfoFlow.no-presentation-style-tag.test.mjs`.
- Parallel-safe with 43-03 (long-press menu + masonry integration), 43-04 (saved screen), 43-05 (PostDetail deep dive), 43-07 (force-new-day engagement reset). None of those plans touch `InfoFlow.tsx`'s news-card branch or `infoFlow.*` namespace.

## Self-Check: PASSED

Files verified:
- FOUND: app/src/components/InfoFlow.tsx (NEWS chip removed)
- FOUND: app/src/locales/en.json (newsTag key removed)
- FOUND: app/src/locales/zh.json (newsTag key removed)
- FOUND: app/src/locales/es.json (newsTag key removed)
- FOUND: app/src/locales/ja.json (newsTag key removed)
- FOUND: app/tests/components/InfoFlow.no-presentation-style-tag.test.mjs (4 source-reading assertions)

Commits verified:
- FOUND: 7dc28770 (refactor(43-02): remove NEWS presentation-style chip from news tiles (TS-01))
- FOUND: d4e0a397 (test(43-02): fill TS-01 source-reading assertions ...)

---
*Phase: 43-engagement-ui*
*Completed: 2026-05-11*
