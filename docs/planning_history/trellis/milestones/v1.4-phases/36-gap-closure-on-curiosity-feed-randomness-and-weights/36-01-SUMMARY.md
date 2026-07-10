---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 01
subsystem: feed-pipeline
tags: [stratified-allocation, largest-remainder, fisher-yates, style-assignment, gap-3, wave-1]

# Dependency graph
requires:
  - phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
    plan: 00
    provides: "RED test stub at tests/services/style-assignment-stratified.test.mjs (10 assertions referencing assignStylesStratified — all RED with TypeError before this plan)"
  - phase: 31-curiosity-feed
    provides: "STYLE_WEIGHTS + assignStyles signature + ApiAvailability interface (preserved unchanged — only inner allocation replaced)"
provides:
  - "assignStyles now uses stratified largest-remainder + Fisher-Yates (drop-in replacement of i.i.d. draw)"
  - "assignStylesStratified named export (alias of assignStyles) for tests / external callers"
  - "Provable ±1 of round(N × weight) distribution invariant for all styles, every run"
affects:
  - 36-02-spread-by-concept (parallel Wave 1 — no shared file, independent)
  - 36-03-persistent-derived-list (Wave 2)
  - 36-04-integration-smoke (Wave 3 — full pipeline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hamilton's largest-remainder method for proportional integer allocation (10 lines, no dependencies)"
    - "Fisher-Yates in-place shuffle for randomizing within-batch ORDER while preserving exact COUNTS"
    - "Defensive sum<=0 short-circuit returning all-text-art fallback for the pathological case"
    - "Drop-in replacement preserving public surface (assignStyles signature unchanged) — call sites at concept-feed.service.ts:1300 etc. require zero churn"
    - "Named alias export (`export const assignStylesStratified = assignStyles`) for test/caller disambiguation"

key-files:
  created: []
  modified:
    - app/src/services/style-assignment.ts

key-decisions:
  - "REPLACE i.i.d. body of assignStyles in place AND additionally export named assignStylesStratified alias — honored verbatim from plan §<objective>. Existing style-assignment.test.mjs distribution tests (N=100 over 100 runs) pass under stratified allocation too (counts are CLOSER to target, not further), so no test file split is required."
  - "Defensive sum<=0 check inserted BEFORE the items-loop. Plan §<action> step 6 prescribed this for the pathological case where every weight has been zeroed (every API key missing). Should not happen — text-art always retains 0.55 + absorbs redistributions — but cover the edge defensively."
  - "Math.random() unseeded for Fisher-Yates per RESEARCH § Risk Register row 3: tests assert COUNT distributions, not specific sequences. Seeded RNG would add complexity without behavioral benefit."
  - "Dev-mode instrumentation block preserved verbatim. The 2026-04-21 console.info diagnostics block sits AFTER `result` is built — no change required since the new code preserves the same `result` variable name."

metrics:
  duration: 1min
  completed: 2026-05-06
---

# Phase 36 Plan 01: Stratified Style Allocation Summary

**Replaced the i.i.d. cumulative-threshold draw inside `assignStyles` with Hamilton's largest-remainder allocation followed by a Fisher-Yates shuffle, eliminating the small-N variance defect (E[image]=0.8 → most 8-entry batches had zero images) and flipping all 10 Wave 0 RED stratified tests to GREEN.**

## Performance

- **Duration:** ~1 min (single surgical edit + verify + commit)
- **Started:** 2026-05-06T06:49:45Z
- **Completed:** 2026-05-06T06:50:48Z
- **Tasks:** 1
- **Files modified:** 1
- **Diff size:** +47 / -12 lines (`app/src/services/style-assignment.ts`)

## Accomplishments

- Removed the i.i.d. cumulative-threshold draw (`r < c.threshold` pattern at the old lines 64-77).
- Inserted Hamilton's largest-remainder + Fisher-Yates allocation, operating on EFFECTIVE post-redirect weights (NOT raw `STYLE_WEIGHTS`) — invariant enforced by the API-redirect block running first (line 51), stratification block running second (line 87).
- Added `sum <= 0` defensive return-all-text-art branch (pathological-case guard prescribed by plan step 6).
- Added `export const assignStylesStratified = assignStyles` alias at end of file.
- Preserved dev-mode instrumentation block verbatim — the `console.info` diagnostics still fire on `import.meta.env?.DEV`.
- Preserved `reassignFailures` body byte-for-byte (verified by `grep -A 8` snapshot).

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Replace i.i.d. body of assignStyles with largest-remainder + Fisher-Yates; add assignStylesStratified alias | `6be153e5` | `app/src/services/style-assignment.ts` |

## Test Results

```
=== Wave 0 stratified tests (target: GREEN-flip) ===
$ cd app && node --test tests/services/style-assignment-stratified.test.mjs
ℹ tests 10
ℹ pass 10
ℹ fail 0

=== Existing style-assignment tests (target: no regression) ===
$ cd app && node --test tests/services/style-assignment.test.mjs
ℹ tests 7
ℹ pass 7
ℹ fail 0

=== TypeScript check ===
$ cd app && npx tsc -b --noEmit
exit 0 (clean)
```

All 17/17 tests across both files GREEN. tsc clean.

## Acceptance Criteria — Verified

| Criterion | Check | Result |
|---|---|---|
| Alias export present | `grep -c "assignStylesStratified = assignStyles"` | 1 ✓ |
| i.i.d. cumulative pattern removed | `grep -c "r < c.threshold"` | 0 ✓ |
| Largest-remainder marker `Math.floor(exact)` | `grep -c "Math.floor(exact)"` | 1 ✓ |
| `items.sort` present | `grep -c "items.sort"` | 1 ✓ |
| Fisher-Yates comment markers | `grep -c "Fisher-Yates"` | 2 ✓ |
| API-redirect line BEFORE stratified line | `grep -n` line 51 vs line 87 | 51 < 87 ✓ |
| `Math.random() * sum` removed | `grep -c "Math.random() \* sum"` | 0 ✓ |
| `reassignFailures` unchanged | `grep -A 8` body comparison | byte-for-byte preserved ✓ |
| Wave 0 stratified tests GREEN | `node --test ...stratified...` | 10/10 ✓ |
| Existing tests still GREEN | `node --test ...assignment.test.mjs` | 7/7 ✓ |
| `npx tsc -b --noEmit` clean | exit code | 0 ✓ |

## Confirmation: Dev-Mode Instrumentation Block Still Runs

Lines 107-115 of the post-edit file preserve the original 2026-04-21 instrumentation block verbatim. It executes AFTER the new `result` array is constructed and BEFORE `return result`, so the `[assignStyles] n=... avail{...} → counts` console.info line continues to fire on every dev-mode call. The block was verified visually (Read tool output, lines 107-115) and is functionally identical to the pre-edit version — only the `result` construction (above it) changed.

## Decisions Made

- **Decision 1 (in-place replacement, alias export):** Honored the plan's locked implementation choice verbatim. The plan §<objective> explicitly stated "REPLACE the i.i.d. body of `assignStyles` in place, AND additionally export a named `assignStylesStratified` symbol that is just an alias / re-export of `assignStyles`." This satisfies both test files (existing distribution tests pass with stratified allocation; Wave 0 tests resolve the new alias) without touching any call site.
- **Decision 2 (sum<=0 defensive guard):** Plan §<action> step 6 prescribed this guard for the pathological case where every weight has been zeroed. Inserted BEFORE the items loop so the function returns immediately without executing largest-remainder math on a zero divisor. In practice this branch is unreachable because text-art always retains its 0.55 base weight and absorbs redistributions — the guard is purely defensive.
- **Decision 3 (Math.random() unseeded):** RESEARCH § Risk Register row 3 explicitly warned against seeded RNG: "Tests assert COUNT distributions only ... Source-reading test can assert that `Math.random()` is used (not a seeded PRNG)." The implementation uses unseeded `Math.random()` for Fisher-Yates, and the Wave 0 stratified test "Fisher-Yates produces different orders across runs" (50 paired runs, ≥1 must differ) confirms non-determinism is preserved. No seedable-RNG dependency was taken.

## Deviations from Plan

None — plan executed exactly as written.

The plan §<action> prescribed every line of the new allocation block verbatim including the `sum <= 0` guard, the comment headers, the Fisher-Yates loop, and the alias export at file end. Each prescription was honored byte-for-byte.

## Issues Encountered

None. The edit landed cleanly on first attempt:
- RED state confirmed before edit (10 tests fail with `TypeError: assignStylesStratified is not a function`).
- Edit applied via two surgical `Edit` calls: one to replace the i.i.d. block, one to add the alias export.
- Both target tests + tsc passed on first run after the edit.

## User Setup Required

None — pure logic change, no new dependencies, no env var, no service config. The change ships transparently to all existing call sites (`concept-feed.service.ts:1300` etc.) without requiring any caller migration.

## Next Phase Readiness

**Wave 2 (Plan 36-03 — persistent derived list) is unblocked.** The stratified allocation does not interact with the derived list / cyclic walker — Plan 36-03 modifies `post-queue.service.ts` and `concept-feed.service.ts` (refillQueue), neither of which this plan touches. They run independently.

**Plan 36-04 (integration smoke) gets one of the four building blocks it needs:** stratified allocation is now live in `assignStyles`, which is called from the `refillQueue` post-generation pipeline. When Plans 36-02 (`spreadByConcept`) and 36-03 (derived list) land, the integration-smoke plan can verify the combined pipeline end-to-end (refillQueue → appendToDerivedList → walkDerivedList → assignStyles[stratified] → spreadByConcept → spreadByStyle → enqueue).

**Forward note for Plan 36-02 (parallel — concurrent execution):** Plan 36-02 modifies `concept-feed.service.ts` (different file from this plan's `style-assignment.ts`). No file conflict. The two plans were correctly scheduled in parallel by the orchestrator.

## Self-Check: PASSED

- File `app/src/services/style-assignment.ts` exists and contains the stratified allocation block. Verified via `Read` tool — line 87 shows `Math.floor(exact)`, line 100-103 shows Fisher-Yates loop, line 141 shows `export const assignStylesStratified = assignStyles`.
- Commit `6be153e5` exists. Verified via `git rev-parse --short HEAD` immediately post-commit.
- Wave 0 stratified tests 10/10 GREEN: verified via `node --test tests/services/style-assignment-stratified.test.mjs` exit 0.
- Existing style-assignment tests 7/7 GREEN: verified via `node --test tests/services/style-assignment.test.mjs` exit 0.
- TypeScript clean: verified via `npx tsc -b --noEmit` exit 0.

---
*Phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights*
*Plan: 01*
*Completed: 2026-05-06*
