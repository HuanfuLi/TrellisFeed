---
phase: 01-rebrand-research-shell-hardening
plan: 10
subsystem: shell-cleanup
tags: [dead-code, pruning, locales, css, regression-test]

requires:
  - phase: 01-01
    provides: "QuestionTrace rebrand and storage namespace baseline."
  - phase: 01-02
    provides: "Research identity, condition, and event contracts."
  - phase: 01-09
    provides: "Minimal participant and researcher settings surfaces."
provides:
  - "Mind-map reorganization and daily gamification-credit residue removed without disturbing canonical anchoring or exploration behavior."
  - "Dead reorganization/dev locale keys, news/empty-state CSS variables, profiler, parser test, and unused mock-loader family removed."
  - "Regression coverage that keeps pruned residue absent and load-bearing graph, ChatInput, and daily-read infrastructure present."
affects: [phase-2, canonical-knowledge, interaction-logging, locales]

tech-stack:
  added: []
  patterns: [call-site-verified deletion, positive-and-negative cleanup gate, locale-parity deletion]

key-files:
  created:
    - app/tests/phase1/pruned-residue.test.mjs
  modified:
    - app/src/services/canonical-knowledge.service.ts
    - app/src/services/daily-read.service.ts
    - app/src/types/index.ts
    - app/src/index.css
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json

key-decisions:
  - "Kept questionService.replaceAll because it remains a tested durable bulk-write API even though its removed reorganization caller was dead."
  - "Preserved GRAPH_UPDATED, commitClassificationResult/classifyAndAnchorIncremental, ChatInput, exploredAnchors, and lazy exploration skipping as explicit positive regression assertions."
  - "Deleted only mock helpers with no live test importer; retained the live filter embedding mock and removed its stale reference to the deleted family."

patterns-established:
  - "Pruned-feature gates scan non-comment production lines for forbidden symbols and separately assert required infrastructure survives."

requirements-completed: [SHELL-04]

duration: 24m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 10: Dead-Code Sweep Summary

**The remaining Phase 0 prune residue is gone, while canonical graph writes, post-scoped input, daily exploration, locale parity, and research logging types remain intact.**

## Performance

- **Duration:** 24m
- **Completed:** 2026-07-11
- **Tasks:** 3
- **Net production/test cleanup:** more than 1,500 stale lines removed

## Accomplishments

- Verified the reorganization API had no live route, screen, subscriber, or service caller, then removed its snapshot storage, parser/retry/rebuild path, result type, and three application events as one coherent deletion.
- Removed `creditAwarded` persistence and methods while retaining `exploredAnchors`, date reset behavior, and the lazy-skip feed path.
- Removed reorganization and leaf-debug locale keys identically from all four bundles, along with unused news-card/empty-state CSS variables.
- Deleted the obsolete Trellis profiler, reorganization parser test, and unreferenced action/Trellis mock-loader family.
- Added a regression test that locks both sides of the cleanup boundary: forbidden residue stays absent and load-bearing infrastructure stays present.

## Task Commits

1. **Task 1: Remove reorganization and credit residue** — `643f602` (refactor)
2. **Task 2: Remove dead locales, styles, script, and mock helpers** — `729dec8` (chore)
3. **Task 3: Add the pruned-residue regression boundary** — `561a3e8` (test)
4. **Task 3 RED: Detect stale references to deleted helpers** — `51c3f99` (test)
5. **Task 3 GREEN: Remove the stale reference from the retained live mock** — `97cf981` (feat)

## Files Created/Modified

- `app/src/services/canonical-knowledge.service.ts` — removed the dead reorganization subsystem while preserving incremental classification and commit paths.
- `app/src/services/daily-read.service.ts` — removed gamification credit state; retained exploration state.
- `app/src/services/question.service.ts` — kept the durable `replaceAll` API and rewrote its obsolete caller-specific comment.
- `app/src/types/index.ts` — removed the dead result type and `REORG_*` events; retained unified `GRAPH_UPDATED`.
- `app/src/locales/{en,zh,es,ja}.json` — removed matching dead keys with parity intact.
- `app/src/index.css` — removed unused news-card and retired empty-state variables.
- `app/tests/phase1/pruned-residue.test.mjs` — guards residue absence, infrastructure survival, and deleted paths.
- `app/tests/services/_filter-mock-embedding.mjs` — removed stale documentation references while preserving the live test helper.

## Decisions Made

- Call-site scans, not filenames or old comments, determined deletion eligibility. `questionService.replaceAll` was retained because live persistence tests call it and it remains a valid data-layer API.
- Video interaction event types were retained because they are part of the research logging contract; this sweep removed obsolete news/video presentation residue only where the plan identified dead CSS.
- `GRAPH_UPDATED`, anchor normalization/classification, question filtering, and daily exploration paths were treated as load-bearing and protected with positive assertions.

## Deviations from Plan

No scope deviation. The plan listed `canonical-knowledge.test.mjs` in one focused command, but that file does not exist; canonical behavior was covered by the repository's existing canonical pipeline, classification-dedup, persistence, and full-suite tests.

## TDD Gate Compliance

- **RED:** `51c3f99` added an assertion that failed on two stale references to the deleted embedding helper.
- **GREEN:** `97cf981` removed those references without changing the retained mock's behavior; the regression test passed.
- The broader regression file was first committed in `561a3e8` after Tasks 1–2, matching the plan's task order; the additional RED/GREEN pair supplied an observable cleanup boundary for the remaining inert reference.

## Issues Encountered

- `npm test` embeds Unix `$(find ...)` and is not directly runnable from PowerShell. The equivalent PowerShell-expanded suite ran 839 tests: 833 passed and the same six unrelated pre-existing source-contract failures remained (BottomSheet overscroll placement, two ChatInput guards, BottomSheet consumer autoFocus scan, and two post-history contracts).
- Lint passes with 26 pre-existing warnings and zero errors. Build passes with existing chunk-size and mixed dynamic/static import warnings.

## Verification

- `node --test tests/phase1/pruned-residue.test.mjs` — 3 passed.
- Daily-read plus locale parity/missing-key focused run — 11 passed.
- `npx tsc -b --noEmit` — passed.
- `npm run lint` — passed with 26 pre-existing warnings, zero errors.
- `npm run build` — passed.
- PowerShell-expanded full suite — 833 passed; six documented unrelated pre-existing failures.
- Final `rg` call-site/residue scan — no forbidden production residue; only the regression test's own token constants remain.

## User Setup Required

None.

## Next Phase Readiness

- Phase 1 production code no longer exposes or exports the removed reorganization/gamification paths.
- Phase 2 can build the frozen content pool and post UI on a cleaner shell without inheriting dead locale, CSS, or test-loader contracts.

## Self-Check: PASSED

- Confirmed all five plan commits exist in order.
- Confirmed the pruned-residue test passes after the GREEN commit.
- Confirmed locale bundles parse and have identical flattened key sets.
- Confirmed no plan file, `.codex` content, roadmap, or unrelated user change was staged or committed.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
