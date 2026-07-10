---
phase: 34-v1-4-close-out-verification-debt-and-cleanup
plan: 01
subsystem: testing
tags: [event-bus, trellis-actions, classification, graph-updated, seam-11]

# Dependency graph
requires:
  - phase: 32.1-v1-4-uat-retest-gap-closure
    provides: "GRAPH_UPDATED consolidation (D-W3-02): CLASSIFICATION_COMPLETED tombstoned, single graph-mutation signal"
  - phase: 33-phase-29-regression-and-phase-31-code-hygiene
    provides: "Test baseline 419/27 to validate against; trellis-actions.service.ts already emits GRAPH_UPDATED"
provides:
  - "trellis-replant.test.mjs event test renamed to GRAPH_UPDATED contract"
  - "trellis-prune.test.mjs unpruneQuestion event test renamed to GRAPH_UPDATED contract"
  - "Phase 32.1 D-W3-02 history comments anchoring the rename rationale in test files"
  - "Confirmation that podcast.service ERR_MODULE_NOT_FOUND is a separate failure class blocking ALL tests in these files (loader gap; out of scope per 34-CONTEXT.md deferred)"
affects: [34-02 (32-CLOSURE), 34-03 (30-VERIFICATION), 34-04 (31-VERIFICATION), v1.5 (loader-gap cleanup)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tombstoned-event history comment: when renaming an event subscription, leave a comment naming the old event + the consolidating phase decision (here Phase 32.1 D-W3-02) so future readers understand why the rename happened."
    - "Surgical 4-line rename over inline-mock rewrite: the 34-CONTEXT.md D-01 originally scoped 80-150 lines of inline-mock rewrite; 34-RESEARCH.md Q1 demonstrated 4 surgical lines per file suffice when the failure mode is purely an event-name desync."

key-files:
  created: []
  modified:
    - "app/tests/services/trellis-replant.test.mjs (test 6 rename: CLASSIFICATION_COMPLETED → GRAPH_UPDATED, payload assertion dropped)"
    - "app/tests/services/trellis-prune.test.mjs (test 5 unpruneQuestion rename: CLASSIFICATION_COMPLETED → GRAPH_UPDATED, payload assertion dropped)"

key-decisions:
  - "Honored 34-RESEARCH.md Q1 reframing: skipped the full inline-mock rewrite originally scoped in 34-CONTEXT.md D-01 because the existing _actions-mock-question.mjs import already works and the 2 failing event tests fail purely on event-name desync, not mock infrastructure."
  - "Removed events[0].payload.anchorId assertion per 34-RESEARCH.md Pitfall 1: GRAPH_UPDATED at trellis-actions.service.ts:107,138 emits {type: 'GRAPH_UPDATED'} with NO payload (CLASSIFICATION_COMPLETED used to carry {payload: {anchorId}} but that signal was tombstoned in Phase 32.1 D-W3-02)."
  - "Did NOT touch the prune-emits-ANCHOR_DELETED test (line 47-63 of trellis-prune.test.mjs); ANCHOR_DELETED still legitimately carries {payload: {anchorId}} per trellis-actions.service.ts:128 (prune flow is unchanged by Phase 32.1 D-W3-02)."
  - "Preserved CLAUDE.md 'Event bus — unified GRAPH_UPDATED' invariant: production code at trellis-actions.service.ts:107,138 unmodified per D-04 scope guard."

patterns-established:
  - "Event-rename minimum patch: comment + test name + subscribe call + assert message + payload-assertion deletion. Apply when a tombstoned event needs catch-up in tests but the underlying production emit was already consolidated in a prior phase."

requirements-completed:
  - SEAM-11

# Metrics
duration: ~2 min
completed: 2026-04-25
---

# Phase 34 Plan 01: SEAM-11 trellis-actions test event rename Summary

**Renamed CLASSIFICATION_COMPLETED → GRAPH_UPDATED in 2 trellis-actions test files (replant + unpruneQuestion event tests) and removed the now-stale payload.anchorId assertions per Phase 32.1 D-W3-02 consolidation; production code unmodified.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-25T22:10:16Z
- **Completed:** 2026-04-25T22:12:12Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- `trellis-replant.test.mjs` — test 6 ("replant emits ... event") subscription, test name, history comment, and assert message all renamed CLASSIFICATION_COMPLETED → GRAPH_UPDATED. The `events[0].payload.anchorId` assertion deleted (GRAPH_UPDATED has no payload).
- `trellis-prune.test.mjs` — test 5 ("unpruneQuestion clears ... and emits ... ") same 4-line surgical patch.
- Production code at `app/src/services/trellis-actions.service.ts:107,138` unmodified (D-04 scope guard verified via `git status --short`).
- Confirmed via `npx tsc -b --noEmit`: 0 errors (no source changes; should be unchanged — IS unchanged).

## Task Commits

1. **Task 1: Rename event in trellis-replant.test.mjs and remove payload assertion** — `06012a55` (test)
2. **Task 2: Rename event in trellis-prune.test.mjs and remove payload assertion** — `7a1b84d3` (test)

**Plan metadata commit:** _to follow with this SUMMARY land + STATE/ROADMAP update_

## Files Created/Modified

- `app/tests/services/trellis-replant.test.mjs` — 4 lines patched in test 6: D-14 history comment, test name (now `'replant emits GRAPH_UPDATED event (Phase 32.1 D-W3-02 rename)'`), `eventBus.subscribe('GRAPH_UPDATED', ...)`, assert message; payload assertion `events[0].payload.anchorId` deleted.
- `app/tests/services/trellis-prune.test.mjs` — 4 lines patched in test 5 (unpruneQuestion): D-18 history comment, test name (now `'unpruneQuestion clears flagged and prunedFromTrellis and emits GRAPH_UPDATED (Phase 32.1 D-W3-02 rename)'`), `eventBus.subscribe('GRAPH_UPDATED', ...)`, assert message; payload assertion deleted. The other 5 tests (prune-patches, prune-emits-ANCHOR_DELETED, getPrunedQuestions×2, hardDelete) intentionally untouched per Plan Task 2 "Do NOT modify any other test in this file."

## Reframing rationale

`34-CONTEXT.md` D-01 originally scoped this fix as **inline mocks per test** with **+80-150 lines per file** to drop the `_actions-mock-loader.mjs` dependency entirely. `34-RESEARCH.md` Q1 (verified by reading the test source on Node 25) showed:

1. The `_actions-mock-question.mjs` import already works without `--loader` because the test imports it directly via `await import('./_actions-mock-question.mjs')`.
2. The CLASSIFICATION_COMPLETED test failures are a **distinct issue** from the loader gap — they fail because the test subscribes to an event that was tombstoned in Phase 32.1 D-W3-02 (when the AppEvent union was consolidated to a single graph-mutation signal). See `app/src/types/index.ts:694-696` for the tombstone comment and `CLAUDE.md` "Event bus — unified GRAPH_UPDATED" for the invariant.
3. The two failing tests can be repaired with a **4-line surgical patch each** (comment + test name + subscribe + assert message + payload-assertion deletion), which honors D-01's spirit ("less surface area, more isolation") while shipping a minimal diff.

The verifier should expect the rename to land cleanly without any new mocking surface. This is consistent with the must_haves frontmatter `truths` block which states the assertion path must not reference CLASSIFICATION_COMPLETED — that constraint IS satisfied (only the history comments mention the old event name, by design).

## Decisions Made

- **Honor PLAN action text over verification grep when they conflict.** PLAN Task 1/2 step 1 explicitly mandates a comment containing the string `"CLASSIFICATION_COMPLETED"` (history-comment text quoting Phase 32.1 D-W3-02 consolidation). The PLAN's `<verification>` block then says `grep -rn "CLASSIFICATION_COMPLETED" app/tests/` should return zero. These are mutually exclusive. I honored the explicit action text (which the planner carefully wrote citing the rename history) and the must_haves `truths` constraint ("Neither test references CLASSIFICATION_COMPLETED **in the assertion path**" — comments are documentation, not assertion path). The 2 remaining grep matches are both intentional history comments. Documented as a planner-spec ambiguity for the verifier.
- **Did not touch the prune-emits-ANCHOR_DELETED test.** Line 62 of `trellis-prune.test.mjs` retains `assert.equal(events[0].payload.anchorId, 'anchor-prune-2')` — but that test subscribes to `ANCHOR_DELETED`, not `GRAPH_UPDATED`. `ANCHOR_DELETED` legitimately carries `{payload: {anchorId}}` per `app/src/services/trellis-actions.service.ts:128` (prune flow). PLAN Task 2 explicitly says "Do NOT modify any other test in this file."

## Deviations from Plan

None - plan executed exactly as written for the two task actions.

## Issues Encountered

### Out-of-scope blocker: ERR_MODULE_NOT_FOUND for podcast.service

After the rename, both files run under `node --test` show **all 12 tests** failing with the SAME error:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '/Users/Code/EchoLearn/app/src/services/podcast.service'
  imported from /Users/Code/EchoLearn/app/src/services/trellis-actions.service.ts
```

The `trellis-actions.service.ts` imports `podcast.service` (no `.ts` extension) which Node 25's strict ESM resolver cannot find without a loader/import-map. This blocks ALL 12 tests in both files from completing import — including the 2 renamed tests we just patched.

**This is the SAME failure mode that existed before this plan landed.** Pre-rename baseline: 10 fail / 2 pass. Post-rename baseline: 10 fail / 2 pass — IDENTICAL. The 2 tests that passed (both `getPrunedQuestions` tests at `trellis-prune.test.mjs:66,82`) are the only tests that don't transitively `await import('../../src/services/trellis-actions.service.ts')`, so they're immune to the loader gap.

Per PLAN Task 1 line 144 and Task 2 line 209, this `ERR_MODULE_NOT_FOUND` is the **separate loader gap and is OUT OF SCOPE for this plan** — flag in SUMMARY but do NOT modify tests further.

**Pass-count delta:** 0 (loader gap blocks the rename test from running). Renamed test names appear in fail list with the new `GRAPH_UPDATED` names — confirming the textual rename landed.

**Resolution path:** v1.5 cleanup of `_actions-mock-loader.mjs` and the `podcast.service`/`question.service`/etc. extensionless imports. Per `34-CONTEXT.md` `<deferred>`: "Pre-existing trellis test failures from `ERR_IMPORT_ATTRIBUTE_MISSING` (Node 25 JSON import) — long-standing infrastructure issue, ~20 failures" — same class of problem.

### Planner-spec ambiguity (documented for verifier)

PLAN action steps mandate a comment containing `"CLASSIFICATION_COMPLETED"` while PLAN verification expects `grep -c "CLASSIFICATION_COMPLETED"` to return 0. Both cannot be true. I honored the action-text mandate (explicit instruction with carefully chosen replacement text) and the must_haves frontmatter `truths` (which scopes the constraint to "assertion path"). The 2 remaining occurrences are intentional history comments at:
- `app/tests/services/trellis-replant.test.mjs:136` — D-14 history comment
- `app/tests/services/trellis-prune.test.mjs:94` — D-18 history comment

If the verifier prefers strict-zero, the comments can be reworded (e.g., "Phase 32.1 D-W3-02 consolidated the legacy event into GRAPH_UPDATED" without naming `CLASSIFICATION_COMPLETED`) — but this loses the searchability that helps future readers find this rename via grep.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEAM-11 closed at the test-source level. The renamed tests are textually correct and will pass once the v1.5 loader-gap fix unblocks `podcast.service` import.
- Frontmatter `must_haves.truths` constraints all satisfied:
  - ✓ trellis-replant.test.mjs test 6 subscribes to GRAPH_UPDATED and asserts events.length === 1
  - ✓ trellis-prune.test.mjs test 5 subscribes to GRAPH_UPDATED and asserts events.length === 1
  - ✓ Neither test references CLASSIFICATION_COMPLETED in the **assertion path** (only in history comments)
  - △ "Both test files run under default `npm test` invocation (no --loader / --import flag) and the previously-failing event tests now pass" — the rename is correct but the loader gap blocks all tests; explicitly flagged out of scope per PLAN Task 1 line 144.
  - ✓ Production code in trellis-actions.service.ts is NOT modified (D-04 scope guard verified)
- Ready for plan 34-02 (Phase 32 absorption / 32-CLOSURE.md) to proceed in parallel — no dependency.

## Self-Check: PASSED

- ✓ FOUND: `.planning/phases/34-v1-4-close-out-verification-debt-and-cleanup/34-01-SUMMARY.md`
- ✓ FOUND: `app/tests/services/trellis-replant.test.mjs` (modified)
- ✓ FOUND: `app/tests/services/trellis-prune.test.mjs` (modified)
- ✓ FOUND: commit `06012a55` (Task 1)
- ✓ FOUND: commit `7a1b84d3` (Task 2)

---
*Phase: 34-v1-4-close-out-verification-debt-and-cleanup*
*Completed: 2026-04-25*
