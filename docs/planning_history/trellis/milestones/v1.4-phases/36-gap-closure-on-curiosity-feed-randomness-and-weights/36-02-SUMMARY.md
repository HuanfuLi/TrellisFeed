---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 02
subsystem: feed-pipeline
tags: [concept-axis-spread, leaf-module, dominant-bucket-placement, gap-4, wave-1]

# Dependency graph
requires:
  - phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
    plan: 00
    provides: "RED test stub at tests/services/spread-by-concept.test.mjs (7 assertions referencing spreadByConcept/spreadByStyle exports — all RED with TypeError before this plan)"
  - phase: 31-curiosity-feed
    provides: "spreadByStyle (private, half-stride placement) + enqueueInterleaved mixer pattern (preserved verbatim — only the mixer callback is changed to call spreadByConcept first)"
provides:
  - "spreadByConcept exported from a new leaf module app/src/services/feed-spread.ts"
  - "spreadByStyle relocated to the same leaf module and re-exported from concept-feed.service.ts (zero behavior change)"
  - "Two-branch placement strategy in spreadByConcept: dominant-bucket layout when one bucket > n/2, half-stride layout otherwise — provably-optimal max-run for the 6-of-A in 8 slots case"
  - "Concept-before-style mixer wiring in refillQueue's enqueueInterleaved call (Pattern 3 / Why-Concept-First)"
affects:
  - 36-03-persistent-derived-list (Wave 2 — no shared file; concept-feed.service.ts edits in 36-03 will not collide with 36-02's mixer line)
  - 36-04-integration-smoke (Wave 3 — full-pipeline smoke must observe no concept clustering in served windows after this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf-module extraction for pure-logic helpers — feed-spread.ts has zero transitive deps on settings.service / locales bundles, so node --test can import it directly without ERR_IMPORT_ATTRIBUTE_MISSING on en.json (CLAUDE.md i18n testing pattern honored)"
    - "Re-export from the original module (concept-feed.service.ts) so runtime callers and downstream tests that import from the feed service are unaffected"
    - "Two-branch placement: dominant (> n/2) uses skip-position symmetric formula `floor(n*(i+1)/(skipCount+1))`; balanced (≤ n/2) uses the existing half-stride formula. Both branches share the collision-bump and leftover-fill safety net."
    - "Concept-axis spread runs BEFORE style-axis spread in the mixer — concept distribution is established first, style spread refines within it. Reversing the order corrupts concept separation via style spread's collision-bump (RESEARCH § Pattern 3 Why-Concept-First)"

key-files:
  created:
    - app/src/services/feed-spread.ts
  modified:
    - app/src/services/concept-feed.service.ts
    - app/tests/services/spread-by-concept.test.mjs

key-decisions:
  - "Plan-prescribed Approach: extract spreadByStyle (verbatim) AND spreadByConcept (new) into a leaf module. Plan §<action> EDIT 1+2 said 'add spreadByConcept after spreadByStyle and add export keyword'; the previous executor went one better and moved both into a leaf file so the Wave 0 test no longer needs the i18n try/catch dance. concept-feed.service.ts re-exports both to keep the public surface unchanged."
  - "Two-branch placement strategy in spreadByConcept (deviation from plan's '15-line clone of spreadByStyle' prescription — Rule 1 bug). The plan's literal clone produced a max-run=3 layout for the 6-A/2-B/n=8 input (Test 5), failing the assertion `runMax <= 2`. Pigeonhole shows max-run=2 is feasible (AABAABAA), so the test is correct and the algorithm is wrong. Fix: when one bucket > n/2, place dominant items at non-skip positions in order with skip slots from `floor(n*(i+1)/(skipCount+1))`; otherwise fall back to the half-stride formula (which alternates correctly for balanced inputs). spreadByStyle is intentionally NOT switched to this — its 2026-04-21 [T*5,V*2,S*1] empirical fix is preserved."
  - "Test file updated to import directly from the leaf module (no try/catch). The Wave 0 stub had a deviation note at line 19 saying 'Plan 36-02 must either extract spreadByConcept to a leaf module without the i18n chain OR avoid touching the import path' — extracting was the cleaner of the two options."
  - "No new event subscriptions added. Plan §<action> Constraints honored. CLAUDE.md best-practice rule 6 (one signal per semantic event) preserved."

requirements-completed: [GAP-4]

# Metrics
duration: ~3min
completed: 2026-05-06
---

# Phase 36 Plan 02: Concept-Axis Spread Summary

**Added `spreadByConcept` to a new leaf module `feed-spread.ts` and wired it BEFORE `spreadByStyle` in `refillQueue`'s mixer callback — same-anchor entries no longer cluster in the served window even when one anchor (important / overdue) holds more than half the batch. Closes GAP-4. The plan-prescribed half-stride clone produced a 3-run on the dominant 6-of-A in 8-slots case; replaced with a two-branch dominant-aware algorithm that achieves the pigeonhole-feasible max-run=2 layout (AABAABAA).**

## Performance

- **Duration:** ~3 min (read state, identify why test failed, design two-branch algorithm, implement, verify, commit)
- **Started:** 2026-05-06T07:25Z (resume after rate-limit kill)
- **Completed:** 2026-05-06T07:31Z
- **Tasks:** 1 (continuation: previous executor had completed extraction + mixer wiring; this agent fixed the failing test 5 and committed)
- **Files modified:** 2 (concept-feed.service.ts, spread-by-concept.test.mjs)
- **Files created:** 1 (feed-spread.ts)
- **Diff size (vs main):** +248 / −109 lines across the 3 files

## Accomplishments

- Failing Test 5 (dominant concept 6-of-8) flipped GREEN. All 7 spread-by-concept assertions pass.
- spreadByConcept and spreadByStyle now live in a leaf module — the 36-00 Wave 0 test's i18n try/catch deviation is permanently retired.
- spreadByConcept handles the dominant-bucket case algorithmically (not via post-pass swap) so future inputs with one >50% bucket get optimal layout for free.
- spreadByStyle body unchanged — its 2026-04-21 empirical fix is preserved verbatim, only its location moved.
- Mixer at refillQueue's enqueueInterleaved call now runs concept-spread first, style-spread second — the documented Pattern 3 Why-Concept-First order.
- Zero new events, zero new state, zero new dependencies.

## Task Commits

Single atomic commit (continuation merged the extraction + algorithm-fix into one logical unit):

1. **Task 1: extract + concept-axis spread + algorithm fix** — `5f65bf62` (feat)

   Commit subject: `feat(36-02): extract spreadByStyle/spreadByConcept to leaf feed-spread module + concept-before-style mixer (closes GAP-4)`

   Files in commit:
   - `app/src/services/feed-spread.ts` (created, 224 lines)
   - `app/src/services/concept-feed.service.ts` (modified, +24 / −83 lines — removed inline spreadByStyle, added re-export, updated mixer)
   - `app/tests/services/spread-by-concept.test.mjs` (modified, +6 / −32 lines — replaced i18n try/catch with direct leaf-module import)

## Files Created/Modified

- **Created:** `app/src/services/feed-spread.ts` — leaf module containing `spreadByStyle` (relocated, body unchanged) and `spreadByConcept` (new, two-branch placement). Zero transitive deps on settings.service, locales/index.ts, llm provider, etc.
- **Modified:** `app/src/services/concept-feed.service.ts` — removed inline `spreadByStyle` definition; added `import { spreadByStyle, spreadByConcept } from './feed-spread'; export { spreadByStyle, spreadByConcept };` at the import block; replaced the single-arg mixer call `enqueueInterleaved(posts, spreadByStyle)` with `enqueueInterleaved(posts, (combined) => { spreadByConcept(combined); spreadByStyle(combined); })`.
- **Modified:** `app/tests/services/spread-by-concept.test.mjs` — replaced the Wave 0 try/catch dynamic import + localStorage polyfill with a direct static import from the leaf module. Test bodies unchanged.

## Decisions Made

See the `key-decisions` block in the frontmatter. Headline: the plan's prescribed "15-line clone of spreadByStyle" was a Rule-1 bug in disguise — it produced a 3-run on the dominant-bucket Test 5 input. The fix is a two-branch placement that switches to a skip-position formula when one bucket > n/2; balanced inputs continue to use the proven half-stride formula. spreadByStyle was deliberately NOT touched — its [T×5, V×2, S×1] fix is the 2026-04-21 production tuning we don't want to regress.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan-prescribed half-stride clone failed dominant-bucket test**

- **Found during:** Task 1 (test 5 execution)
- **Issue:** Plan §<action> EDIT 1 prescribed a verbatim clone of `spreadByStyle`'s half-stride placement formula (`Math.floor(i * stride + stride / 2)`) for `spreadByConcept`, with the rationale "literally the same algorithm with a different key extractor" (RESEARCH § Pattern 3). However, for input `[A×6, B×2]` in n=8 slots, the half-stride math places A at indices `{0, 2, 3, 4, 6, 7}` because non-integer stride 1.333 aliases consecutive integers via floor — leaving B at indices `{1, 5}` and producing `[A,B,A,A,A,B,A,A]` with max-run=3. Test 5 (`runMax <= 2`) fails. The pigeonhole bound is max-run=2 (`AABAABAA`), so the test is correct.
- **Fix:** Replaced the single-branch placement with a two-branch strategy. When the largest bucket holds > n/2 of the items (`isDominant`), place its items at non-skip positions in order. Skip positions are computed via the symmetric formula `floor(n * (i+1) / (skipCount + 1))` — for `[A×6, B×2, n=8]` this gives skips at `{2, 5}`, A at `{0,1,3,4,6,7}`, B at `{2,5}`, producing the optimal `AABAABAA` (max-run=2). When no bucket dominates (≤ n/2), fall back to the existing half-stride formula — this preserves the alternation behavior for balanced inputs (Tests 1, 7).
- **Why this is a Rule-1 fix and not a Rule-4 architectural change:** the algorithm change is internal to `spreadByConcept`. The function signature, file location, mixer call site, and `spreadByStyle` body are all unchanged. The two-branch strategy is a defensive-correctness fix for a function whose plan-prescribed body was insufficient to satisfy the plan-prescribed test contract.
- **Files modified:** `app/src/services/feed-spread.ts` (the new leaf module — Branch A = lines 159-187, Branch B = lines 188-205, JSDoc rationale at 95-141).
- **Verification:** `node --test tests/services/spread-by-concept.test.mjs` reports `tests 7 / pass 7 / fail 0`. No regression in `style-assignment.test.mjs` (7/7), `style-assignment-stratified.test.mjs` (10/10), `post-queue.test.mjs` (13/13), `post-queue-dedup.test.mjs` (5/5), `concept-batch-filter.test.mjs`, `concept-feed-cross-cycle-dedup.test.mjs`. `tsc -b --noEmit` exit 0.
- **Committed in:** `5f65bf62` (combined with the extraction work — single logical commit per the original plan's intent).

**2. [Rule 3 — Blocking] Wave 0 i18n import-attribute chain superseded**

- **Found during:** Task 1 (test file imports)
- **Issue:** The Wave 0 test stub used a try/catch dynamic import + localStorage polyfill to work around `concept-feed.service.ts → question.service.ts → locales/index.ts → en.json` ESM import-attribute crash. With both spread helpers now in a leaf module without the i18n chain, the workaround is dead code.
- **Fix:** Replaced the try/catch with a static import from `../../src/services/feed-spread.ts`. Removed the localStorage polyfill (no longer needed). Test bodies unchanged.
- **Why this is a Rule-3 fix:** the cleanup is required because the workaround would have flagged as dead-code by tests-must-guard-live-paths (CLAUDE.md best practice 2).
- **Files modified:** `app/tests/services/spread-by-concept.test.mjs`.
- **Verification:** node --test runs the file cleanly, no warnings.
- **Committed in:** `5f65bf62`.

## Test Results (verbatim node --test summaries)

### spread-by-concept.test.mjs (formerly RED, now GREEN — closes GAP-4)

```
ℹ tests 7
ℹ suites 1
ℹ pass 7
ℹ fail 0
```

Individual tests:
- ✔ 2 concepts x 3 each: no adjacent same-concept after spread
- ✔ single concept input: length preserved, no crash
- ✔ empty array does not throw
- ✔ single-element array unchanged
- ✔ dominant concept (6 of 8): no 3+ A in consecutive positions  ← formerly failing
- ✔ starter/connection posts (empty sourceQuestionIds) NOT clustered (Pitfall 5)
- ✔ combined spreadByConcept + spreadByStyle: no two adjacent share BOTH concept AND style

### No regressions in named existing tests

```
node --test tests/services/style-assignment-stratified.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs
ℹ tests 30
ℹ pass 30
ℹ fail 0

node --test tests/services/post-queue-dedup.test.mjs tests/services/concept-batch-filter.test.mjs tests/services/concept-feed-cross-cycle-dedup.test.mjs
ℹ tests 18
ℹ pass 18
ℹ fail 0
```

### TypeScript

```
$ npx tsc -b --noEmit
EXIT=0
```

### No new events confirmed

```
$ git diff HEAD~1 -- app/src/services/concept-feed.service.ts app/src/services/feed-spread.ts | grep -c "eventBus.emit\|eventBus.subscribe"
0
```

## Acceptance Criteria (plan §<task><acceptance_criteria>)

- [x] `app/src/services/concept-feed.service.ts` re-exports `spreadByConcept` (verified via `grep -c "export.*spreadByConcept" app/src/services/concept-feed.service.ts` = 1)
- [x] Function `spreadByConcept` defined with `export function` (in feed-spread.ts — Plan accepted relocation as the cleaner of the two prescribed options)
- [x] `export function spreadByStyle` exists (in feed-spread.ts, body unchanged from concept-feed.service.ts:619-670 pre-extraction)
- [x] Concept-key fallback extractor present (`grep -c "p.sourceQuestionIds\\[0\\] ?? p.id"` in feed-spread.ts = 1)
- [x] Mixer callback wires both functions in concept-first/style-second order (verified via inspection of concept-feed.service.ts at the enqueueInterleaved call site, with the prescribed `Phase 36 GAP-4` comment immediately above)
- [x] `node --test tests/services/spread-by-concept.test.mjs` exits 0 (Wave 0 test 7/7 GREEN)
- [x] `npx tsc -b --noEmit` exits 0
- [x] Plan-named existing tests do NOT regress (post-queue, post-queue-dedup, concept-batch-filter, concept-feed-cross-cycle-dedup all pass)
- [x] No new event names introduced (`grep -c "eventBus" diff` = 0)
- [x] Previous mixer call `enqueueInterleaved(posts, spreadByStyle)` removed (`grep -c` returns 0 in concept-feed.service.ts)

## Self-Check: PASSED

- [x] feed-spread.ts exists at `/Users/Code/EchoLearn/app/src/services/feed-spread.ts`
- [x] commit 5f65bf62 exists in `git log --oneline`
- [x] Failing test now GREEN (spread-by-concept.test.mjs 7/7)
- [x] No-regression suite GREEN (style-assignment-stratified 10/10, style-assignment 7/7, post-queue 13/13, post-queue-dedup 5/5, concept-batch-filter, concept-feed-cross-cycle-dedup)
- [x] tsc -b --noEmit exit 0
