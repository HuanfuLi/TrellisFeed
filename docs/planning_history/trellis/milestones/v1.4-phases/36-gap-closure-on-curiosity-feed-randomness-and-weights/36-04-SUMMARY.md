---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 04
subsystem: feed-pipeline
tags: [integration-smoke, gap-1, gap-2, gap-3, gap-4, wave-3, composition-test]

# Dependency graph
requires:
  - phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
    plan: 01
    provides: "assignStylesStratified (largest-remainder + Fisher-Yates) consumed by Test 3 + Test 5"
  - phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
    plan: 02
    provides: "spreadByConcept + spreadByStyle in feed-spread.ts leaf module consumed by Test 4 + Test 5"
  - phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
    plan: 03
    provides: "postQueueService.{appendToDerivedList, walkDerivedList, getDerivedList, getCyclePosition} consumed by Tests 1, 2, 5, 6"
provides:
  - "End-to-end integration smoke verifying Phase 36 helpers COMPOSE correctly (not just work in isolation)"
  - "6 GREEN tests across 4 GAPs + 1 composition + 1 all-explored gate"
  - "Drift-proof STYLE_WEIGHTS import (changes in style-assignment.ts auto-flow into Test 3)"
affects:
  - 36-05-claude-md-doc-sync (Wave 3 — independent doc plan; runs in parallel)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SIMPLIFIED INTEGRATION PATH — compose Phase 36 helpers directly (appendToDerivedList → walkDerivedList → assignStylesStratified → spreadByConcept → spreadByStyle → enqueue) instead of mocking refillQueue's full async chain (LLM/YouTube/Tavily/image-gen). Wave 0-2 unit tests already cover individual helpers in isolation; this file's job is COMPOSITION verification, which the simplified chain captures directly."
    - "Leaf-module imports for spread helpers (`feed-spread.ts`) — concept-feed.service.ts transitively imports the i18n chain (locales/index.ts → en.json) which crashes node --test ESM loader with ERR_IMPORT_ATTRIBUTE_MISSING. The leaf module has zero such deps. Same pattern used by spread-by-concept.test.mjs (Plan 36-02). CLAUDE.md i18n testing rule honored."
    - "Drift-proof STYLE_WEIGHTS import — the test imports STYLE_WEIGHTS from style-assignment.ts (not as an inline literal) so any future weight tuning auto-flows. Negative-grep acceptance criterion (`grep -c 'const STYLE_WEIGHTS = {'` returns 0) catches drift at CI time."
    - "Dynamic await import for modules that touch localStorage at module-load time (post-queue.service.ts) — required so the localStorage polyfill runs FIRST. Static imports would crash before the polyfill executes (post-queue.service.ts module-level `let _state = load()`)."

key-files:
  created:
    - app/tests/services/refill-queue-integration.test.mjs
  modified: []

key-decisions:
  - "SIMPLIFIED PATH (composition test) over mocked-refillQueue path — plan §<task><behavior> explicitly authorized this: 'Pick the path of least resistance — if concept-feed-cross-cycle-dedup.test.mjs already provides a refillQueue mock harness, REUSE it; otherwise use the simplified path.' That harness does NOT exist (it tests pure formula expressions, not refillQueue itself), so simplified is the correct path. The test's value is `do they COMPOSE correctly?` — which the simplified chain captures directly."
  - "Leaf-module import for spreadByConcept/spreadByStyle (feed-spread.ts) — plan §<action> example code imports these from concept-feed.service.ts. That would crash node --test via the i18n chain. feed-spread.ts is the runtime source (concept-feed.service.ts merely re-exports the same symbols), so behavioral semantics are identical. Same path used by Plan 36-02's spread-by-concept.test.mjs."
  - "Test 1 contract: across-call dedup, NOT within-call dedup. Two appendToDerivedList calls — first ['A','B'], second ['A','C'] — final length=3 (NOT 4 with within-call dedup, NOT 2 with merge). This validates Plan 36-03's seed-once-before-loop invariant from the consumer side: cross-call dedup (Test 2 in derived-list.test.mjs) AND within-call multiplicity preservation (Test 10 in derived-list.test.mjs) both hold. The constraint hierarchy is documented in plan §<critical_constraints> point 1."
  - "Test 3 STYLE_WEIGHTS imported from style-assignment.ts; comment reads 'STYLE_WEIGHTS sum = 1.00 (0.10 + 0.55 + 0.05 + 0.10 + 0.10 + 0.10)'. Negative grep acceptance criterion (`grep -c 'const STYLE_WEIGHTS = {' refill-queue-integration.test.mjs` returns 0) catches drift; the comment 1.00 vs 1.05 was the checker iteration 1 fix (the prior plan revision had `1.05` as a stale calculation including a now-removed weight)."
  - "Test 5 walks 3 unique IDs ['A','B','C'] and asserts conceptIds.length === 3 (matches input cardinality). Plan §<critical_constraints> point 3 explicitly named this: 'Do NOT use repeated-ID input expecting unique-dedup semantics.' Within-call multiplicity is encoded via buildConceptBatch's BASE_ENTRIES_PER_CONCEPT × importance; cross-call dedup is the test's concern."

requirements-completed: [GAP-1, GAP-2, GAP-3, GAP-4]

# Metrics
metrics:
  duration: ~5min
  completed: 2026-05-06
  tasks: 1
  files_modified: 0
  files_created: 1
  diff_size: "+157 lines"
---

# Phase 36 Plan 04: Integration Smoke for GAP-1..4 Composition Summary

**Landed an end-to-end integration smoke (`app/tests/services/refill-queue-integration.test.mjs`, 157 lines, 6 GREEN tests) that verifies all four Phase 36 invariants hold IN CONCERT — not just in isolation. The test composes the Phase 36 helpers directly (appendToDerivedList → walkDerivedList → assignStylesStratified → spreadByConcept → spreadByStyle → enqueue) instead of mocking refillQueue's full async chain, which is the simplified path explicitly authorized by the plan. Full `npm test` reports 448 tests / 422 pass / 26 fail — pass count is +6 vs. baseline-plus-Wave-0 (416), and the fail count is UNCHANGED at 26 (pre-existing JSON-import-attribute issues unrelated to Phase 36).**

## Performance

- **Duration:** ~5 min (read state, locate dependencies, write test, verify, commit)
- **Started:** 2026-05-06T07:45:25Z
- **Completed:** 2026-05-06T07:49:53Z
- **Tasks:** 1
- **Files created:** 1
- **Files modified:** 0
- **Diff size:** +157 / -0 lines

## Accomplishments

- 6 new `it()` blocks across 4 GAPs + 1 composition + 1 all-explored gate.
- All GREEN on first run (+ subsequent regression sweep).
- STYLE_WEIGHTS sourced from `style-assignment.ts` via dynamic `await import` — drift-proof. Any future weight tuning auto-flows.
- Spread helpers sourced from leaf `feed-spread.ts` — avoids the i18n import-attribute chain that crashes when concept-feed.service.ts is imported under `node --test`.
- Localstorage polyfill placed BEFORE dynamic imports so post-queue.service.ts's module-level `_state = load()` does not crash.
- Test 1 validates ACROSS-call dedup (length=3), not within-call dedup — preserves Plan 36-00 Test 10's importance-multiplicity contract.
- Test 3 comment correctly reads `STYLE_WEIGHTS sum = 1.00` (negative grep ensures `1.05` does not appear).
- Test 5 walks 3 UNIQUE IDs and asserts cardinality matches input.
- No production code changes. No new dependencies. No new event subscriptions.

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Write integration smoke test for the full Phase 36 refill pipeline | `f7c0988f` | `app/tests/services/refill-queue-integration.test.mjs` |

Single atomic commit on branch `gsd/phase-33-hygiene-and-polish` with `--no-verify` per parallel-execution coordination with Plan 36-05 (which modifies CLAUDE.md — different file from this plan's test file, no conflict).

## Files Created

**Created:** `app/tests/services/refill-queue-integration.test.mjs` (157 lines)
- localStorage polyfill (post-queue.test.mjs pattern)
- SIMPLIFIED INTEGRATION PATH header comment explaining the rationale
- Dynamic imports of: postQueueService, assignStylesStratified, STYLE_WEIGHTS, spreadByConcept, spreadByStyle
- 6 `it()` blocks within a single describe block

## Files Modified

None — pure-test addition.

## Decisions Made

See the `key-decisions` block in the frontmatter. Headlines:

1. **SIMPLIFIED PATH (composition test) over mocked-refillQueue path** — plan §<task><behavior> explicitly authorized this. The test's value is composition verification, which the simplified chain captures directly. Mocking refillQueue's full async chain (LLM + YouTube + Tavily + image gen) is high-effort and creates fragile tests for no marginal value.
2. **Leaf-module import for spread helpers** — concept-feed.service.ts has a transitive i18n import chain that crashes node --test ESM. feed-spread.ts is the runtime source — symbols are identical. Same workaround that Plan 36-02 chose for spread-by-concept.test.mjs.
3. **Test 1 cross-call dedup contract (length=3)** — preserves Plan 36-00 Test 10's importance-multiplicity contract (within-call multiplicity preserved by seed-once-before-loop invariant).
4. **Test 3 drift-proof STYLE_WEIGHTS import** — checker iteration 1 fix; the prior version had an inline literal AND `sum = 1.05` (stale).
5. **Test 5 walks 3 unique IDs** — checker iteration 1 fix; the prior version expected unique-dedup semantics on a repeated-ID input, contradicting the multiplicity contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan example imports spread helpers from concept-feed.service.ts; that crashes node --test**

- **Found during:** Task 1 (test execution attempt)
- **Issue:** Plan §<action> example code imports `spreadByConcept` and `spreadByStyle` from `'../../src/services/concept-feed.service.ts'`. That module transitively imports `question.service.ts → locales/index.ts → en.json`, which crashes Node ESM with `ERR_IMPORT_ATTRIBUTE_MISSING` (CLAUDE.md i18n section explicitly documents this chain).
- **Fix:** Imported from the leaf module `feed-spread.ts` (the runtime source — concept-feed.service.ts merely re-exports the same symbols). Same workaround Plan 36-02 chose for `spread-by-concept.test.mjs`. Behavioral semantics are identical.
- **Files modified:** `app/tests/services/refill-queue-integration.test.mjs` (the file authored in this plan).
- **Why this is a Rule-3 fix:** the import path was a blocking issue — the test would crash at module-load time, never running its assertions.
- **Verification:** `node --test tests/services/refill-queue-integration.test.mjs` runs 6/6 GREEN.

**2. [Rule 3 — Blocking] Static import would crash on localStorage access before polyfill runs**

- **Found during:** Task 1 (initial design)
- **Issue:** ESM `import` statements are hoisted and resolved BEFORE any top-level statements run. `post-queue.service.ts` has `let _state: QueueState = load();` at module-level which calls `localStorage.getItem(...)`. With static imports, the polyfill at the top of the test file runs AFTER the module loads → ReferenceError on `localStorage`.
- **Fix:** Used dynamic `const { ... } = await import(...)` for all three modules. The polyfill runs first, then the modules load cleanly. Same pattern used by `derived-list.test.mjs` and `post-queue.test.mjs`.
- **Why this is a Rule-3 fix:** static imports would crash at module-load time, never running the assertions.
- **Files modified:** `app/tests/services/refill-queue-integration.test.mjs`.
- **Verification:** `node --test tests/services/refill-queue-integration.test.mjs` runs 6/6 GREEN.

## Test Results (verbatim node --test summaries)

### refill-queue-integration.test.mjs (new — 6/6 GREEN)

```
$ cd app && node --test tests/services/refill-queue-integration.test.mjs
▶ refill-queue integration (Phase 36 GAP-1..4 composition)
  ✔ GAP-1 — derivedList grows monotonically across calls; cross-call dedup eliminates repeats (0.537ms)
  ✔ GAP-2 — cyclePosition advances and wraps across multiple walks (0.598ms)
  ✔ GAP-3 — stratification across simulated refill: 12 conceptIds → ±1 of round(12×w) (0.213ms)
  ✔ GAP-4 — combined concept + style spread: no adjacent shares BOTH (0.254ms)
  ✔ Composition smoke — append/walk/stratify/spread chain produces a usable queue (0.179ms)
  ✔ All-explored — walkDerivedList returns [] (caller early-returns) (0.080ms)
✔ refill-queue integration (Phase 36 GAP-1..4 composition) (2.388ms)
ℹ tests 6
ℹ suites 1
ℹ pass 6
ℹ fail 0
```

### No-regression suite (47/47 GREEN — all named adjacent suites unchanged)

```
$ cd app && node --test tests/services/style-assignment-stratified.test.mjs \
    tests/services/style-assignment.test.mjs \
    tests/services/spread-by-concept.test.mjs \
    tests/services/post-queue.test.mjs \
    tests/services/derived-list.test.mjs
ℹ tests 47
ℹ suites 5
ℹ pass 47
ℹ fail 0
```

### Full npm test (baseline comparison)

```
$ cd app && npm test
ℹ tests 448
ℹ pass 422
ℹ fail 26
```

**Comparison vs. STATE.md 2026-04-29 baseline (389 pass / 26 fail):**

| Run | Pass | Fail | Delta |
|---|---|---|---|
| Pre-Phase-36 baseline (STATE.md 2026-04-29) | 389 | 26 | — |
| Post-Wave 0 (Plans 36-00 added 27 tests) | 416 | 26 | +27 / 0 |
| Post-Plan 36-04 (this plan added 6 tests) | 422 | 26 | +6 / 0 |
| Reported (npm test 2026-05-06T07:49Z) | **422** | **26** | **+33 / 0** ✓ |

Pass count delta is +33 (=27 from Wave 0 + 6 from this plan). **Fail count is UNCHANGED at 26.** The 26 pre-existing failures are documented as JSON-import-attribute / module-not-found issues unrelated to Phase 36 work; they have persisted through Phases 33, 34, 35, and 36 unchanged.

The total tests count (448) differs from `pass + fail = 422 + 26 = 448` ✓ — no skipped/cancelled.

### TypeScript

```
$ cd app && npx tsc -b --noEmit
exit 0 (clean)
```

## Acceptance Criteria — Verified

| Criterion | Check | Result |
|---|---|---|
| File exists | `[ -f app/tests/services/refill-queue-integration.test.mjs ]` | ✓ |
| 6 `it(...)` blocks | `grep -cE "^  it\\(" ...` | 6 ✓ |
| imports >= 5 | `grep -E "postQueueService\|assignStylesStratified\|STYLE_WEIGHTS\|spreadByConcept\|spreadByStyle" ... \| wc -l` | 36 ✓ |
| STYLE_WEIGHTS imported (not redeclared) | `grep -c "import.*STYLE_WEIGHTS.*style-assignment" ...` | 1 ✓ |
| No inline STYLE_WEIGHTS literal | `grep -c "const STYLE_WEIGHTS = {" ...` | 0 ✓ (negative grep) |
| Test 3 comment `sum = 1.00` | `grep -c "sum = 1.00" ...` | 1 ✓ |
| `sum = 1.05` absent | `grep -c "sum = 1.05" ...` | 0 ✓ (negative grep) |
| `node --test ...refill-queue-integration.test.mjs` exits 0 | exit code | 0 ✓ |
| `npm test` pass >= 416 | observed 422 | ✓ |
| `npm test` fail <= 26 | observed 26 | ✓ (unchanged) |
| `npx tsc -b --noEmit` exits 0 | exit code | 0 ✓ |
| `SIMPLIFIED INTEGRATION PATH` comment present | `grep -c "SIMPLIFIED INTEGRATION PATH" ...` | 1 ✓ |

## Self-Check: PASSED

- [x] File `app/tests/services/refill-queue-integration.test.mjs` exists at `/Users/Code/EchoLearn/app/tests/services/refill-queue-integration.test.mjs`. Verified via `[ -f ... ]` and inspection.
- [x] Commit `f7c0988f` exists in `git log --oneline -5`.
- [x] 6 it() blocks: verified via `grep -cE '^  it\\(' ...` returns 6.
- [x] All 6 tests GREEN: verified via `node --test ...` exit 0 and pass 6 / fail 0.
- [x] No regression in no-regression suite: 47/47 GREEN across 5 named test files.
- [x] `npx tsc -b --noEmit` clean: verified exit 0.
- [x] STYLE_WEIGHTS imported (drift-proof): verified via `grep -c "import.*STYLE_WEIGHTS.*style-assignment"` returns 1.
- [x] No inline STYLE_WEIGHTS literal: verified via `grep -c "const STYLE_WEIGHTS = {"` returns 0.
- [x] Test 3 comment correct (`sum = 1.00`, not `1.05`): verified via dual grep.
- [x] Full npm test no-NEW-failure check passes: 422 pass / 26 fail; baseline 389/26; delta +33/0 (no NEW failures).
- [x] SIMPLIFIED INTEGRATION PATH comment present at top of file: verified via grep.

## Suite-Level Effects from Waves 0-2 (Plan §<output> requirement)

No unexpected suite-level effects observed. The Wave 0 RED tests landed at 27 new tests (10 derived-list + 10 stratified + 7 spread-by-concept), all of which flipped GREEN by the end of Wave 1 + Wave 2:

- Plan 36-01 flipped 10 stratified tests RED → GREEN (commit `6be153e5`)
- Plan 36-02 flipped 7 spread-by-concept tests RED → GREEN (commit `5f65bf62`)
- Plan 36-03 flipped 10 derived-list tests RED → GREEN (commits `8e70700b` + `82fad9b1`)

Pre-existing 26 failures are unrelated (JSON-import-attribute / module-not-found chains documented in STATE.md from Phases 33+). Phase 36 does not introduce new failures and does not fix existing failures (out-of-scope per `<scope_boundary>` of the deviation rules).

## User Setup Required

None — pure-test addition. No new dependencies, no env vars, no service config, no runtime behavior change for users.

## Next Phase Readiness

**Phase 36 verification gate is now ready.** All four GAP closures are GREEN end-to-end:

- GAP-1 (persistent derivedList append-only): Plan 36-03 + this plan's Test 1
- GAP-2 (cyclic walker advances + wraps): Plan 36-03 + this plan's Test 2
- GAP-3 (stratified style allocation ±1): Plan 36-01 + this plan's Test 3
- GAP-4 (concept-axis spread): Plan 36-02 + this plan's Test 4
- Composition: this plan's Test 5
- All-explored gate: this plan's Test 6

**`/gsd:verify 36` should pass.** All 33 new Phase 36 tests GREEN. Zero NEW failures vs. baseline. tsc clean.

**Plan 36-05 (CLAUDE.md doc-sync) is the parallel sibling — no shared file with this plan.** It runs independently; both can land in either order. The orchestrator scheduled them in the same wave because each is fully independent.

---
*Phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights*
*Plan: 04*
*Completed: 2026-05-06*
