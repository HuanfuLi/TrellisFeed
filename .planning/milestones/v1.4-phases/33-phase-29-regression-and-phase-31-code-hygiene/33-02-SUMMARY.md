---
phase: 33-phase-29-regression-and-phase-31-code-hygiene
plan: 02
subsystem: testing
tags: [refactor, supersession, dead-test-cleanup, docs-update, td-04, phase-29-regression, phase-31-d14]

# Dependency graph
requires:
  - phase: 31-curiosity-feed-redesign-post-lifecycle-and-display
    provides: D-14 generation-time weak-concept prioritization (buildConceptBatch — 2 posts per important concept) — semantically subsumes Phase 29 runtime sort bias
  - phase: 33-phase-29-regression-and-phase-31-code-hygiene
    provides: 33-00 working-tree clean prerequisite (commit fe4a2387)
provides:
  - concept-feed-strategy.test.mjs deleted (11 obsolete tests removed under D-01)
  - orchestration-strategy.test.mjs trimmed from 10 → 9 tests (orphan TD-01 plumbing assertion removed; plannerAutoGen-side assertion preserved)
  - 29-VERIFICATION.md TD-01 row + Observable Truths row 1 marked SUPERSEDED-BY-PHASE-31 with 31-CONTEXT.md D-14 evidence pointer
  - 29-UAT-LOG.md Post-sign-off supersession section appended (preserves all original content)
  - npm test baseline reduced by exactly 6 v1.4 regressions (5 from deleted file + 1 from orphan assertion)
affects: [v1.5-milestone-planning, phase-31-code-paths, phase-29-historical-record]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supersession over restoration: when a later phase reimplements a feature at a different layer, mark the original requirement SUPERSEDED-BY-{phase} and delete the obsolete tests, do NOT restore the prior implementation (D-01)"
    - "Two-commit closure pattern for self-referential SHA backfill: content-bearing closure commit lands first, then docs-only amendment commit substitutes the captured SHA into the supersession entry. Prevents amend-induced SHA churn that would yield a forever-stale pointer"
    - "Original sign-off preservation in UAT logs: append Post-sign-off section AFTER existing sign-off; never modify rows 35-78 of an already-signed-off UAT log (D-05)"

key-files:
  created: []
  modified:
    - app/tests/services/orchestration-strategy.test.mjs
    - .planning/phases/29-final-polishment/29-VERIFICATION.md
    - .planning/phases/29-final-polishment/29-UAT-LOG.md
  deleted:
    - app/tests/services/concept-feed-strategy.test.mjs

key-decisions:
  - "D-01 honored: TD-04 closed by SUPERSEDING the Phase 29 TD-01 contract (NOT restoring applyStrategyBias). Phase 31 D-14 already implements weak-concept bias at generation time; restoring runtime sort bias would double-layer the weighting"
  - "D-02 honored: deleted concept-feed-strategy.test.mjs entirely (11 tests — 5 failing on applyStrategyBias structural presence, 6 testing inline algorithm that mirrors removed feature)"
  - "D-03 honored: removed only the concept-feed-side TD-01 plumbing assertion from orchestration-strategy.test.mjs (lines 126-137); plannerAutoGen-side assertion + 8 defaultStrategy.computeHints tests retained"
  - "D-04 honored: 29-VERIFICATION.md TD-01 row + Observable Truths row 1 marked SUPERSEDED-BY-PHASE-31 with explicit pointer to 31-CONTEXT.md D-14"
  - "D-05 honored: 29-UAT-LOG.md preserves entire original content (sign-off block intact, all 27 UAT rows intact); SUPERSEDED entry APPENDED in new Post-sign-off section"
  - "Two-commit pattern: closure commit + SHA backfill amendment, in that order, so the Closure commit cell points at the content-bearing commit (subject begins refactor(29): supersede TD-01), not the docs amendment"

patterns-established:
  - "Plan-supersession workflow: code deletions + docs status flip + UAT supersession entry land in a single atomic content commit per Architecture Pattern #3 (RESEARCH.md). Docs and code reflect the same reality at every commit boundary."
  - "Self-referential SHA backfill: capture HEAD SHA immediately after the content-bearing commit; substitute literal hex into doc placeholder; commit amendment SEPARATELY as a docs-only follow-up. Both commits flow forward in history; neither rewrites the other."

requirements-completed: [TD-04]

# Metrics
duration: ~6min
completed: 2026-04-19
---

# Phase 33 Plan 02: TD-04 supersession Summary

**Closed TD-04 by superseding (not restoring) the Phase 29 TD-01 contract — deleted concept-feed-strategy.test.mjs entirely (11 obsolete tests), removed the orphan TD-01 plumbing assertion from orchestration-strategy.test.mjs, and updated 29-VERIFICATION.md + 29-UAT-LOG.md to mark TD-01 SUPERSEDED-BY-PHASE-31 with pointer to 31-CONTEXT.md D-14 (generation-time weak-concept prioritization). Two atomic commits land the closure + the SHA backfill.**

## Performance

- **Duration:** ~6 min (324 s)
- **Started:** 2026-04-19T23:43:59Z
- **Completed:** 2026-04-19T23:49:23Z
- **Tasks:** 2 (Task 2.1 code deletions + Task 2.2 docs update + atomic closure commit + SHA backfill amendment)
- **Files modified:** 3 (orchestration-strategy.test.mjs, 29-VERIFICATION.md, 29-UAT-LOG.md)
- **Files deleted:** 1 (concept-feed-strategy.test.mjs, 240 lines)
- **Commits:** 2 (closure + amendment)

## Accomplishments

- Removed 240-line orphan test file `app/tests/services/concept-feed-strategy.test.mjs` (11 tests across 4 describe blocks: 3 priority-sort tests + 2 no-op-when-empty tests + 1 empty-sourceQuestionIds test + 5 structural-presence assertions; all obsolete since Phase 31 D-14 removed `applyStrategyBias`)
- Trimmed `app/tests/services/orchestration-strategy.test.mjs` from 10 → 9 tests by deleting one orphan TD-01 plumbing assertion (lines 126-137) that grep-asserted `concept-feed.service.ts` contains a now-removed `applyStrategyBias`/`computeHints(signals, checkInSignals)` body. The plannerAutoGen-side assertion (lines 114-124) and 8 `defaultStrategy.computeHints` tests are unaffected.
- Updated `29-VERIFICATION.md` TD-01 row in Requirements Coverage table: status flipped from `SATISFIED` → `SUPERSEDED-BY-PHASE-31`; Evidence cell rewritten to point at 31-CONTEXT.md D-14 with rationale (generation-time prioritization subsumes runtime sort bias).
- Updated `29-VERIFICATION.md` Observable Truths row 1: status flipped from `VERIFIED` → `VERIFIED / SUPERSEDED`; description and evidence cells rewritten to reflect that only the plannerAutoGen call site retains the wiring.
- Appended `Post-sign-off supersession` section to `29-UAT-LOG.md` after the existing Sign-off block; entire pre-existing log content preserved (27 UAT rows + sign-off checklist intact). Closure commit SHA backfilled in the new section's table.
- Test suite delta verified end-to-end: 391 tests / 359 pass / **32 fail** → 379 tests / 353 pass / **26 fail** (exactly -6 v1.4 regressions, exactly as predicted in plan).
- `npx tsc -b --noEmit` exits 0.

## Task Commits

Two commits per the two-commit closure pattern (D-01..D-05 + RESEARCH.md Architecture Pattern #3 + self-referential SHA backfill protocol):

1. **Task 2.1 + 2.2 (atomic content closure):** `e6ca3d35` (refactor) — deletes test file, removes orphan assertion, updates both 29 docs (4 files in one commit). Subject: `refactor(29): supersede TD-01 — Phase 31 D-14 generation-time prioritization subsumes runtime sort bias (TD-04)`.
2. **Task 2.2 Step 8 (SHA backfill amendment):** `69389d45` (docs) — substitutes the captured `e6ca3d35` SHA into the `Closure commit` cell of the supersession entry. Subject: `docs(29): record TD-04 closure commit SHA in UAT-LOG supersession entry`.

## Files Created/Modified

- `app/tests/services/concept-feed-strategy.test.mjs` — **DELETED** (-240 lines, 11 obsolete tests, zero live consumers post Phase 31 D-14)
- `app/tests/services/orchestration-strategy.test.mjs` — removed 13 lines (one TD-01 plumbing assertion + surrounding blank line), retained the plannerAutoGen-side TD-01 plumbing test + 8 `defaultStrategy.computeHints` tests
- `.planning/phases/29-final-polishment/29-VERIFICATION.md` — 2 row rewrites: TD-01 row in Requirements Coverage table (line 93 area) + Observable Truths row 1 (line 21 area). Status `SATISFIED` → `SUPERSEDED-BY-PHASE-31` and `VERIFIED` → `VERIFIED / SUPERSEDED` respectively
- `.planning/phases/29-final-polishment/29-UAT-LOG.md` — appended new Post-sign-off section (10 markdown lines) after existing Sign-off block; preserves all 27 UAT rows + sign-off checklist; backfilled SHA `e6ca3d35` in second commit

Total: **4 files changed, 16 insertions, 255 deletions** (across both commits).

## Decisions Made

None new — followed plan as specified. All decisions are pre-locked in 33-CONTEXT.md (D-01 through D-05).

## Deviations from Plan

### Plan acceptance criterion error (informational only)

**1. [Plan documentation error — not auto-fix] Plan's "SATISFIED preservation" grep was for the wrong file**
- **Found during:** Task 2.2 Step 4 (grep-verify edits before committing)
- **Issue:** Plan acceptance criteria specified `grep -c "SATISFIED" .planning/phases/29-final-polishment/29-UAT-LOG.md` should return `>= 1` for "original preservation". But TD-01 has never been a row in 29-UAT-LOG.md — it lives only in 29-VERIFICATION.md. The UAT-LOG vocabulary uses `PASS`/`SKIP` (not `SATISFIED`) for its 27 UAT rows. The grep returned `0`.
- **Resolution:** Verified preservation through equivalent stronger checks: (a) all 27 PASS/SKIP rows intact, (b) Sign-off line `Operator sign-off: HuanfuLi 2026-04-16` intact, (c) last UAT row `26-UAT-7` intact. The append-only D-05 contract is honored — original content unchanged, supersession section appended after sign-off.
- **Files modified:** None — this is a verification semantics correction, not a code change.
- **Verification:** `grep -cE "\\| (PASS|SKIP) \\|" 29-UAT-LOG.md` returns `27`; `grep -c "Operator sign-off: HuanfuLi 2026-04-16"` returns `1`.
- **Committed in:** N/A (informational only — no fix needed).

---

**Total deviations:** 1 informational only (plan grep semantics correction); 0 auto-fixes (Rules 1-3 not triggered)
**Impact on plan:** Zero — all D-01..D-05 acceptance criteria met through equivalent verification. Plan executed exactly as written for all code/docs edits.

## Issues Encountered

None. Both commits landed on first attempt. No retries, no rollbacks.

## User Setup Required

None — no external service configuration required.

## Verification

### Pre-deletion baseline (HEAD = 579c4fc5)

```
npm test:       391 tests / 359 pass / 32 fail
orchestration-strategy.test.mjs:  10 tests / 9 pass / 1 fail
concept-feed-strategy.test.mjs:   11 tests / 6 pass / 5 fail (under capacitor-mock-loader)
```

### Post-deletion verification (HEAD = 69389d45)

```
git status --porcelain:                    empty (working tree clean)
grep -c "SUPERSEDED-BY-PHASE-31" 29-VERIFICATION.md:  1 ✓
grep -c "VERIFIED / SUPERSEDED" 29-VERIFICATION.md:   1 ✓
grep -c "TD-01 SUPERSEDED" 29-UAT-LOG.md:             1 ✓
grep -c "TD-01 plumbing: concept-feed.service.ts" orchestration-strategy.test.mjs:  0 ✓
grep -c "TD-01 plumbing: plannerAutoGen.service.ts" orchestration-strategy.test.mjs: 1 ✓
test ! -f app/tests/services/concept-feed-strategy.test.mjs:  exit 0 ✓
node --test orchestration-strategy.test.mjs:    9 tests / 9 pass / 0 fail ✓
npx tsc -b --noEmit:                            exit 0 ✓
npm test (final):                               379 tests / 353 pass / 26 fail (delta -6 v1.4 regressions exactly as predicted)
```

### SHA backfill correctness check

```
Extracted SHA from UAT-LOG Closure commit cell:  e6ca3d35
git cat-file -e e6ca3d35:                         SHA resolves ✓
git log --format=%s e6ca3d35 -1:                  refactor(29): supersede TD-01 — Phase 31 D-14 generation-time prioritization subsumes runtime sort bias (TD-04) ✓
                                                  (Subject begins with refactor(29): supersede TD-01 — confirms it points at content-bearing commit, NOT the docs-only amendment)
git log -2 --format=%s:
  docs(29): record TD-04 closure commit SHA in UAT-LOG supersession entry      ← amendment (HEAD)
  refactor(29): supersede TD-01 — Phase 31 D-14 generation-time prioritization subsumes runtime sort bias (TD-04)  ← closure (HEAD~1)
```

### Test suite delta confirmation

| Bucket | Pre-Plan-33-02 | Post-Plan-33-02 | Delta |
| --- | --- | --- | --- |
| Total tests | 391 | 379 | -12 |
| Pass | 359 | 353 | -6 |
| Fail | **32** | **26** | **-6** |

Delta breakdown:
- 5 failing tests deleted: `applyStrategyBias function is defined`, `applyStrategyBias sorts by priorityConceptIds`, `applyStrategyBias is called at getDailyPosts return paths`, `applyStrategyBias is wrapped in try-catch`, `defaultStrategy.computeHints is called inside applyStrategyBias` (all in concept-feed-strategy.test.mjs)
- 1 failing test deleted: `TD-01 plumbing: concept-feed.service.ts applyStrategyBias passes checkInSignals to computeHints` (in orchestration-strategy.test.mjs)
- 6 passing tests deleted: 6 inline-algorithm tests in concept-feed-strategy.test.mjs (`priority concept posts are sorted to front`, `no-op when priorityConceptIds is empty`, `posts with empty sourceQuestionIds are not matched`)

The remaining 26 failures are the pre-existing Node-25 JSON-import-attribute failures in trellis test files (pre-existing baseline per CLAUDE.md / 33-RESEARCH.md Finding 8 / 32.1 Wave 4 validation status). Zero new failures introduced.

## Next Phase Readiness

- TD-04 closed for v1.4. Closure commit `e6ca3d35` is referenced from 29-UAT-LOG.md's supersession entry — historical traceability preserved.
- Plan 33-03 (TD-06 LeafState rename: `'yellow'` → `'dying'`, `'fallen'` → `'dead'`) remains in queue. It is independent of this plan (different files, different decisions).
- Plans 33-06 (perf memoization) and 33-07 (cosmetic polish) gated only by 33-05 (already SATISFIED-BY-6066c709), so they remain unblocked from a working-tree-cleanliness perspective.
- Test baseline now sits at 379 / 353 pass / 26 fail. Phase 33 success criterion in research (365 / 339 / 26) was a forecast based on incremental file counts — the actual count is slightly higher because additional tests landed during 33-00/33-01. Zero v1.4-specific regressions remain; only the pre-existing Node-25 trellis baseline persists.

## Self-Check: PASSED

- `app/tests/services/concept-feed-strategy.test.mjs`: confirmed ABSENT (`test ! -f` exits 0)
- Closure commit `e6ca3d35`: confirmed PRESENT (`git log --oneline | grep e6ca3d35` → match; subject `refactor(29): supersede TD-01 — Phase 31 D-14 generation-time prioritization subsumes runtime sort bias (TD-04)`)
- Amendment commit `69389d45`: confirmed PRESENT (`git log --oneline | grep 69389d45` → match; subject `docs(29): record TD-04 closure commit SHA in UAT-LOG supersession entry`)
- 29-VERIFICATION.md: contains `SUPERSEDED-BY-PHASE-31` (1 occurrence) + `VERIFIED / SUPERSEDED` (1 occurrence)
- 29-UAT-LOG.md: contains `TD-01 SUPERSEDED` (1 occurrence) + Closure commit cell shows `e6ca3d35` (not `PENDING`); 27 original PASS/SKIP rows + sign-off checklist intact
- orchestration-strategy.test.mjs: 9 tests / 9 pass / 0 fail
- `npx tsc -b --noEmit`: exit 0
- `git status --porcelain`: empty (working tree clean)

---
*Phase: 33-phase-29-regression-and-phase-31-code-hygiene*
*Completed: 2026-04-19*
