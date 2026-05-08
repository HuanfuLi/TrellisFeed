---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 07
subsystem: concept-feed-pipeline
tags: [bug-fix, walker, stratified-allocation, gap-closure, regression-guard]
requirements: [GAP-B]
gap_closure: true
requires:
  - 36-01 (stratified style allocation — establishes the N=16 design target)
  - 36-03 (persistent derivedList + cyclic walker — introduces walkDerivedList)
  - 36-04 (integration smoke — the test file we extended with Test 7)
provides:
  - "walkDerivedList honors `count` even when count > derivedList.length × 2"
  - "Single-anchor users (derivedList.length=4) now receive the design-intended N=16 batch instead of a silently truncated N=8"
  - "text-art lands at its 56% target via the largest-remainder bonus that requires N≥12, instead of the floor-pinned 50% the truncation produced"
  - "Regression coverage: Test 11 (16-entry walk on 4-entry list) + Test 12 (lazy-skip across multiple wraps) + Test 7 (integration assertion that text-art ≥ floor(N×0.55) at N=16)"
  - "CLAUDE.md walker contract documented; future agents see the trap before reintroducing it"
affects:
  - app/src/services/post-queue.service.ts (1 line in walkDerivedList + comment block + docstring)
  - app/tests/services/derived-list.test.mjs (+2 tests; 10 → 12)
  - app/tests/services/refill-queue-integration.test.mjs (+1 test; 6 → 7)
  - CLAUDE.md (+1 numeric-defaults bullet, +1 closed-divergence strikethrough)
tech-stack:
  added: []
  patterns:
    - "Termination-guard sizing: `Math.max(count * N, len)` — count-driven for fulfillment, len-floor for minimum-pass property, multiplier for lazy-skip headroom"
    - "Phase 32.1 lesson #2 reinforced: integration tests must exercise the live caller's argument shape (refillQueue calls walkDerivedList(16, ...) — the test must too, not walkDerivedList(2, ...))"
key-files:
  created: []
  modified:
    - path: app/src/services/post-queue.service.ts
      what: "walkDerivedList:301 — `const maxSteps = len * 2;` → `const maxSteps = Math.max(count * 2, len);` + 9-line comment block + updated 7-line docstring"
      why: "Original guard ignored count → walkDerivedList(16, ...) silently returned 8 entries on 4-entry list, defeating Phase 36-01 stratified-allocation design"
    - path: app/tests/services/derived-list.test.mjs
      what: "+Test 11 (walkDerivedList(16, emptySet) on 4-entry list returns 16 via 4 wraps) + Test 12 (walkDerivedList(8, exploredSet) honors count while skipping 'a' lazily across 3 wraps)"
      why: "Pre-Phase-36-07 test suite never exercised count > len × 2 — the GAP-B blind spot"
    - path: app/tests/services/refill-queue-integration.test.mjs
      what: "+Test 7 — full append→walk→stratify pipeline at len=4, asserts text-art count ≥ floor(16 × 0.55) = 8"
      why: "Integration assertion that would have caught GAP-B pre-merge — bridges unit tests and live caller contract"
    - path: CLAUDE.md
      what: "Numeric-defaults bullet documents `Math.max(count * 2, len)` contract; Known-divergences strikethrough entry names Phase 36 GAP-B / Plan 36-07"
      why: "Phase 32.1 lesson #8: when operator catches a recurring trap, document it in three places (CLAUDE.md, code comment, test)"
decisions:
  - "Chose `Math.max(count * 2, len)` over the RESEARCH-pseudocode `fullLoops < 2` alternative: one-line drop-in, preserves existing while-loop structure, the `* 2` factor preserves original lazy-skip headroom, the `len` floor preserves Test 9's all-explored case (count < len). The fullLoops alternative would require a parallel counter and cyclePosition === 0 reset detection — more code, same effect"
  - "Test 11 asserts exact contents (4-wrap concatenation) not just length — catches subtle ordering bugs that a length-only assertion would miss"
  - "Test 12's expected `out.length === 8` (not 6) reflects post-fix behavior: maxSteps=16 lets the walker push past the all-explored-of-'a' steps; result.length<count breaks out at exactly 8"
  - "Did NOT touch style-assignment.ts — Phase 36-01 math is correct. Did NOT touch concept-feed.service.ts — `walkDerivedList(16, exploredIds)` caller is correct. Did NOT change BASE_ENTRIES_PER_CONCEPT — the multiplicity-per-concept design is intentional and orthogonal to walker termination"
  - "CLAUDE.md edit kept all other load-bearing sections byte-stable (verified: html/body overflow, ChatInput minWidth, USER_ACK_BEFORE_GRAPH_CONTEXT, dedup pre-check threshold, MAX_QUEUE_SIZE all unchanged)"
metrics:
  duration: ~12 minutes
  completed: 2026-05-06
  files_changed: 4
  lines_added: 70
  lines_removed: 4
  tests_added: 3
  tests_total_phase36_quick: 56 (was 53)
---

# Phase 36 Plan 07: Walker Termination Guard Summary

One-line code fix in `walkDerivedList` to scale `maxSteps` with the requested `count` instead of hard-capping at `derivedList.length × 2`. The original guard silently truncated `walkDerivedList(16, …)` to 8 entries when `len=4` (single-anchor case), forcing `assignStylesStratified` to operate on N=8 — the exact threshold below which text-art's 0.40 remainder loses to the four minority-style 0.80 remainders, pinning text-art at its floor (50%) instead of reaching the design target (56% via the largest-remainder bonus that activates at N≥12). Plus regression tests at unit + integration layers, plus CLAUDE.md trap-documentation.

## Root cause (from .planning/debug/style-mix-imbalance.md)

`post-queue.service.ts:301` (pre-fix):

```typescript
const maxSteps = len * 2;
```

Caller (concept-feed.service.ts:1218):

```typescript
const conceptIds = postQueueService.walkDerivedList(16, exploredIds);
```

For a single non-important anchor: `BASE_ENTRIES_PER_CONCEPT = 4` → `derivedList = ['anchor1', 'anchor1', 'anchor1', 'anchor1']` → `len = 4` → `maxSteps = 8`. The walker terminates after 8 steps regardless of the requested `count = 16`. `assignStylesStratified` then operates on N=8, where the largest-remainder math produces:

- text-art: exact = 4.40, floor = 4, remainder = 0.40
- minority styles (image/news/video/short): exact = 0.80, floor = 0, remainder = 0.80
- deficit = 4 — exactly enough for each minority style to claim a +1 bonus
- text-art's 0.40 remainder LOSES to all four minority 0.80 remainders → text-art = 4/8 = 50%

Phase 36-04 integration smoke only exercised `walkDerivedList(2, …)` on a 4-entry list — `count << maxSteps` so the truncation case was untested (Phase 32.1 lesson #2 scenario: tests must guard the live code path, not aspirational shapes).

## Fix

Single-line change at `post-queue.service.ts:301`:

```typescript
// Phase 36 GAP-B fix: termination must scale with `count`, not just with len.
// Original `len * 2` silently capped walkDerivedList(16, ...) at 8 entries
// when len=4 (single non-important anchor case), causing assignStylesStratified
// to receive N=8 instead of N=16 — at N=8 the largest-remainder math pins
// text-art at its floor (4/8 = 50%) because text-art's remainder 0.40 loses
// to minority 0.80. At N=16, text-art's 0.80 beats minority 0.60 → 9/16 = 56%.
// Math.max preserves the original `len * 2` lazy-skip headroom while ALSO
// guaranteeing the walker can fulfill the count request (modulo all-explored).
// See .planning/debug/style-mix-imbalance.md for the full math walkthrough.
const maxSteps = Math.max(count * 2, len);
```

At N=16, the math flips:

- text-art: exact = 8.80, floor = 8, remainder = 0.80
- minority styles: exact ≈ 1.60, floor = 1, remainder = 0.60
- deficit = 4 — text-art's 0.80 remainder BEATS minority 0.60 → text-art gets a bonus
- Result: text-art = 9/16 ≈ 56% (target reached)

## Termination semantics (preserved)

| Scenario              | Pre-fix maxSteps | Post-fix maxSteps         | Behavior change                                                                |
| --------------------- | ---------------- | ------------------------- | ------------------------------------------------------------------------------ |
| count=2, len=4        | 8                | max(4, 4) = 4             | Walker still returns 2; cyclePosition advance unchanged (Test 6 stable)        |
| count=16, len=4       | 8                | max(32, 4) = 32           | **Walker now returns 16 instead of 8** — the GAP-B fix                         |
| count=4, len=6        | 12               | max(8, 6) = 8             | Walker still returns 4; behavior unchanged (Test 6/7 stable)                   |
| count=4, len=3 all-explored | 6          | max(8, 3) = 8             | Walker still returns []; just walks 8 steps instead of 6 to confirm exhaustion |

All 10 pre-existing derived-list tests continue to pass; +2 new tests (Test 11/12) green; +1 new refill-queue integration test (Test 7) green; total Phase 36 quick-suite: 53 → 56 pass / 0 fail.

## Verification

```bash
# 1. Walker fix in place
grep -c "Math.max(count \* 2, len)" app/src/services/post-queue.service.ts
# 1 (post-fix line)

# 2. Old buggy guard gone
grep -c "const maxSteps = len \* 2;" app/src/services/post-queue.service.ts
# 0

# 3. Comment present
grep -c "Phase 36 GAP-B fix" app/src/services/post-queue.service.ts
# 1

# 4. New regression tests pass
cd app && node --test tests/services/derived-list.test.mjs
# tests 12 / pass 12 / fail 0
cd app && node --test tests/services/refill-queue-integration.test.mjs
# tests 7 / pass 7 / fail 0

# 5. Phase 36 quick-suite
cd app && node --test tests/services/derived-list.test.mjs \
  tests/services/style-assignment-stratified.test.mjs \
  tests/services/spread-by-concept.test.mjs \
  tests/services/refill-queue-integration.test.mjs \
  tests/services/style-assignment.test.mjs \
  tests/services/post-queue.test.mjs
# tests 56 / pass 56 / fail 0

# 6. Phase 33 sentinels preserved
grep -q "dueAnchors" app/src/services/concept-feed.service.ts && echo OK
grep -q "allExplored && postQueueService.getTotalGenerated" app/src/services/concept-feed.service.ts && echo OK
# OK / OK

# 7. CLAUDE.md updated; other load-bearing sections byte-stable
grep -c "Phase 36 GAP-B" CLAUDE.md                            # 2
grep -c "Walker termination guard" CLAUDE.md                  # 1
grep -c "html, body { overflow: hidden }" CLAUDE.md           # 3 (unchanged)
grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md             # 2 (unchanged)
grep -c "ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD" CLAUDE.md     # 1 (unchanged)
grep -c "MAX_QUEUE_SIZE" CLAUDE.md                            # 1 (unchanged)
```

## Deviations from Plan

None — plan executed exactly as written. The Edit tool inputs matched the plan's verbatim instructions. All acceptance criteria met on first attempt; no auto-fix triggers fired during execution.

## Out-of-Scope Findings (Logged, Not Fixed)

- `app/src/screens/HomeScreen.tsx:63` — `'warmStartHadPostsRef' is declared but its value is never read` — the parallel 36-06 executor is in-flight on HomeScreen.tsx; this TS warning is in their scope per the parallel_execution boundary. Not introduced by Plan 36-07 (post-queue.service.ts has no TS errors). 36-06 will resolve this in their own commit chain.

## Commits

| Task | Type     | Hash       | Message                                                          |
| ---- | -------- | ---------- | ---------------------------------------------------------------- |
| 1    | fix      | `3664383e` | scale walkDerivedList termination guard with count               |
| 2    | test     | `62a7697f` | add walker truncation regression coverage                        |
| 3    | docs     | `27c941b9` | document walker termination guard contract in CLAUDE.md          |

## Self-Check: PASSED

All claimed files exist and all claimed commits are reachable in `git log`.
