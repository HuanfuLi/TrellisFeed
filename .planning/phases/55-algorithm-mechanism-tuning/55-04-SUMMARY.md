---
phase: 55-algorithm-mechanism-tuning
plan: 04
subsystem: concept-feed
tags: [like-boost, derived-list, multiplicity, style-weights, trajectory-analyzer, verify-and-keep, instrumentation, tune-02]
requires:
  - phase: 55-01
    provides: "like-boost.test.mjs Wave-0 RED scaffold (source-reading + negative pipeline invariants)"
provides:
  - "Like signal wired into buildConceptBatch: a liked concept gets BASE_ENTRIES_PER_CONCEPT * 2 (8) derived-list entries via the existing importance/overdue lever — no new list, no new pipeline stage"
  - "STYLE_WEIGHTS + trajectoryAnalyzer weights verified-and-kept (D-15): rationale comments complete, behavior asserted, no value drift"
  - "D-02 dev-gated instrumentation for per-anchor like-boost decisions"
affects:
  - "HomeScreen feed ordering (liked concepts surface ~2x more)"
  - "engagementService.liked[] is now a live recommendation signal (was recorded-but-unused)"
tech-stack:
  added: []
  patterns:
    - "Boost-as-OR (isImportant || isLiked): worst-case multiplicity stays BASE*2, no new starvation vector"
    - "Verify-and-keep tuning: add rationale comment + behavior assertion, change a constant only on instrumented drift evidence"
key-files:
  created: []
  modified:
    - "app/src/services/concept-feed.service.ts"
    - "app/src/services/trajectoryAnalyzer.service.ts"
    - "app/tests/services/like-boost.test.mjs"
key-decisions:
  - "Liked post → anchor id maps via sourceQuestionIds[0] (the live pipeline convention) — the plan's interface note referenced a non-existent DailyPost.conceptId field (Rule 3 fix)"
  - "STYLE_WEIGHTS + trajectoryAnalyzer constants VERIFIED, KEPT — no drift observed; only rationale comments added (D-15 verify-and-keep, not retune)"
  - "like-boost.test.mjs source-slice widened from a fixed 1200-char window to the full function body so the rationale comment block does not push boost code out of scan range"
metrics:
  duration: ~12 min
  tasks: 2
  files: 3
  completed: 2026-05-21
requirements: [TUNE-02]
---

# Phase 55 Plan 04: Like-Signal Multiplicity Boost + Weights Verify-and-Keep Summary

**Connected the previously-inert `engagementService.liked[]` recommendation signal to the home feed by reusing the existing 4→8 derived-list multiplicity lever in `buildConceptBatch` (D-14) — a liked concept now surfaces twice as much without starving due-for-review concepts — and verified-and-kept the already-tuned `STYLE_WEIGHTS` + `trajectoryAnalyzer` weights with behavior tests, rationale comments, and dev instrumentation (D-15).**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (both `type=auto`, Task 1 `tdd=true`)
- **Files modified:** 3
- **Completed:** 2026-05-21

## What Was Built

### Task 1 — Like → multiplicity boost (D-14)

In `concept-feed.service.ts:buildConceptBatch`:

- Before the anchor loop, resolve liked postIds → anchor conceptIds once: `new Set(engagementService.getLikedPostIds())` then iterate `postHistoryService.getPosts()` collecting `p.sourceQuestionIds[0]` (the anchor id) for liked posts into `likedConceptIds`.
- Inside the per-anchor loop, after the existing `isImportant` computation: `const isLiked = likedConceptIds.has(anchor.id)`, `const isBoosted = isImportant || isLiked`, `const count = isBoosted ? BASE_ENTRIES_PER_CONCEPT * 2 : BASE_ENTRIES_PER_CONCEPT`.
- `BASE_ENTRIES_PER_CONCEPT` stays `4`. The `exploredIds` filter still runs before the loop.
- A load-bearing rationale block sits ABOVE the function (no fourth list, no pipeline stage, no derived-list mutation; OR-not-additive so worst-case multiplicity is unchanged).
- D-02 dev-gated (`import.meta.env?.DEV`) instrumentation logs per-anchor `count`/`isLiked`/`isImportant` and the `likedConceptIds.size`/`conceptIds.length` totals.

### Task 2 — STYLE_WEIGHTS + trajectoryAnalyzer verify-and-keep (D-15)

- `STYLE_WEIGHTS` already carried full rationale (2026-04-21 re-balance + Phase 38 short-removal) and sums to 1.0 — **kept, unchanged**.
- `assignStyles` already has dev-gated realized-mix instrumentation (`[assignStyles]` log) — **kept**.
- `trajectoryAnalyzer.service.ts` had two tunable magic constants lacking explicit rationale: the **7-day signal window** and the **weak-area `easeFactor < 2.0` band**. Added rationale comments to both (matching SM-2 cadence / SM-2 default-ease reasoning). **Values unchanged — verified, kept.**
- Extended `like-boost.test.mjs` with a `weights verify-and-keep (Phase 55 D-15)` describe block: STYLE_WEIGHTS sum=1.0, rationale-comment presence, dev-gated instrumentation presence, and trajectoryAnalyzer rationale-comment presence. The exhaustive sum/stratified-allocation coverage stays in `style-assignment.test.mjs` + `style-assignment-stratified.test.mjs` (referenced, not duplicated).

## Weights drift evidence

**No weight constant was changed.** Both `STYLE_WEIGHTS` (sum 1.0; image 0.10 / text-art 0.55 / suggestion 0.05 / news 0.10 / video 0.20) and the `trajectoryAnalyzer` constants (7-day window, weak-area ease<2.0) were verified to behave correctly against existing + new behavior tests and carry rationale comments. Per D-15 this is the "verified, kept" outcome — re-tuning was not warranted because instrumentation revealed no drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `DailyPost.conceptId` does not exist**
- **Found during:** Task 1 (`tsc -b --noEmit` after first implementation)
- **Issue:** The plan's `<interfaces>` note and 55-PATTERNS sample mapped a liked post → anchor via `p.conceptId`, but `DailyPost` (extends `PostSnapshot`) has no `conceptId` field — `tsc` errored TS2339.
- **Fix:** Mapped via `p.sourceQuestionIds?.[0]`, the established pipeline convention (documented in `concept-feed.service.ts` ~line 245: "post.sourceQuestionIds[0] is the anchor.id"). The variable name `likedConceptIds` is retained, satisfying the plan's `contains: conceptId` artifact note.
- **Files modified:** `app/src/services/concept-feed.service.ts`
- **Commit:** 6f0bb2e1

**2. [Rule 3 - Blocking] like-boost.test.mjs 1200-char source slice too small**
- **Found during:** Task 1 (positive assertions failed after implementation)
- **Issue:** The scaffold sliced `buildConceptBatch` + 1200 chars. The real implementation's load-bearing rationale comment pushed `isBoosted`/`BASE_ENTRIES_PER_CONCEPT * 2` past offset 1200, so the positive assertions could not find them.
- **Fix:** Widened the slice to the full function body (`function buildConceptBatch` → its column-0 closing brace). The negative assertion (no `appendToDerivedList`/`splice`) remains sound across the whole body. The scaffold was explicitly "turned green by 55-04," so adjusting the slice window is in-scope.
- **Files modified:** `app/tests/services/like-boost.test.mjs`
- **Commit:** 6f0bb2e1

### Environment

- `app/node_modules` was absent in the fresh worktree; symlinked to the main repo's identical tree after confirming `package-lock.json` is byte-identical (Rule 3 env fix, not a package install). Not committed (node_modules is gitignored).
- Early Edit/Read calls landed in the main checkout (`/Users/Code/EchoLearn/app`) because absolute paths there resolve to the main repo, not the worktree (#3099). Changes were patch-transferred into the worktree and the main checkout reverted; all commits are on the worktree branch.

## Threat Model Compliance

- **T-55-04a (self-starvation):** Mitigated. `isBoosted = isImportant || isLiked` is OR, not additive — worst-case multiplicity is `BASE*2`, identical to the pre-existing all-important case. A negative test asserts no `BASE_ENTRIES_PER_CONCEPT * 3/4`. Due-for-review concepts still receive their `BASE*2` entries.
- **T-55-04b (pipeline drift):** Mitigated. Negative test asserts `buildConceptBatch` does not call `appendToDerivedList` or splice the derived list; the `exploredIds` filter and append-only invariant are preserved (CLAUDE.md 3-list pipeline).

## Verification

- `like-boost.test.mjs` — 9/9 pass (5 D-14 + 4 D-15).
- `derived-list.test.mjs`, `refill-queue-integration.test.mjs`, `style-assignment.test.mjs`, `style-assignment-stratified.test.mjs` — all green (49/49 combined).
- `tsc -b --noEmit` — clean (exit 0).

## Commits

- `6f0bb2e1` — feat(55-04): hook like signal into buildConceptBatch multiplicity (D-14)
- `295dfca1` — test(55-04): verify-and-keep STYLE_WEIGHTS + trajectoryAnalyzer weights (D-15)

## Self-Check: PASSED

All modified files exist; both task commits (`6f0bb2e1`, `295dfca1`) present on the worktree branch.
