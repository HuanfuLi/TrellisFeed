---
phase: 55-algorithm-mechanism-tuning
plan: 06
subsystem: concept-feed
tags: [refill, under-refill, dequeue-before-refill, shortfall-guard, post-queue, instrumentation, tune-03]

# Dependency graph
requires:
  - phase: 55-04
    provides: "like-boost multiplicity in buildConceptBatch (merged feed state Task 1 root-cause must account for)"
  - phase: 55-05
    provides: "SQLite-primary post-queue/concept-feed (async fire-and-forget write-through; ruled out as a refill-timing factor)"
provides:
  - "Shortfall-refill fix in generateMorePosts: a swipe-for-more awaits a refill + tops up whenever the served batch falls short of the requested count and a refill is warranted — closing the intermittent 1/4/0 under-refill (TUNE-03)"
  - "D-02 dev-gated refill-cycle instrumentation across generateMorePosts (pre/post-dequeue) and refillQueue (early-return, walker yield, enqueue realized-add)"
  - "refill-reliability.test.mjs: under-refill reproduction (a/b/c) + corrected full-8-batch regression"
affects:
  - "HomeScreen swipe-for-more reliably delivers the full 8-post batch when the derived list has unread capacity"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shortfall guard (served < requested && needsRefill) replaces empty-only guard (posts.length === 0) — await + top-up to the intended batch"
    - "Dev-gated decision-point instrumentation logged BEFORE a byte-stable early-return so source-reading invariant tests stay green"

key-files:
  created:
    - "app/tests/services/refill-reliability.test.mjs"
  modified:
    - "app/src/services/concept-feed.service.ts"

key-decisions:
  - "Confirmed dominant cause = (a) dequeue-before-refill shortfall in generateMorePosts; (b) enqueue MAX_QUEUE_SIZE cap and (c) walker sub-count are CORRECT intended behavior, not the bug"
  - "post-queue.service.ts left unmodified — cause (a) lives entirely in concept-feed.service.ts:generateMorePosts; REFILL_THRESHOLD/MAX_QUEUE_SIZE/walker were verified and preserved (no change warranted)"
  - "55-05 async SQLite write-through ruled out: save() is fire-and-forget and all queue reads (dequeue/size/needsRefill/enqueueInterleaved) use the synchronous in-memory mirror — no interaction with refill-mutex timing"
  - "refillQueue early-return instrumentation logged before the guard so `if (!needsRefill()) return;` stays byte-stable for refill-mutex.test.mjs"

metrics:
  duration: ~18 min
  tasks: 2
  files: 2
  completed: 2026-05-21
requirements: [TUNE-03]
---

# Phase 55 Plan 06: Curiosity-Feed Under-Refill Root-Cause + Fix (TUNE-03) Summary

**Root-caused the intermittent 1/4/0 swipe-for-more under-refill to a dequeue-before-refill shortfall — `generateMorePosts` only awaited a refill when the queue popped exactly zero, so a non-empty-but-short queue served the short count even with unread derived-list capacity — then fixed it with a shortfall-and-top-up guard that preserves every load-bearing 3-list pipeline numeric and the single refill-mutex path.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 (both `type=auto`)
- **Files:** 2 (1 created, 1 modified)
- **Completed:** 2026-05-21

## Root Cause (recorded BEFORE the fix — Task 1)

**Confirmed dominant cause: (a) dequeue-before-refill shortfall.**

`generateMorePosts` (concept-feed.service.ts) ran:

```ts
let posts = postQueueService.dequeue(count);        // count = 8
if (posts.length === 0 && postQueueService.needsRefill()) {  // EMPTY-ONLY guard
  await refillQueue(questions);
  posts = postQueueService.dequeue(count);
}
```

The synchronous refill was gated on an **empty** pop. When a swipe popped a **non-empty-but-short** queue — e.g. the queue held 4 posts (below the 8 batch but above 0) because the previous swipe's fire-and-forget background refill had not yet landed — the empty branch was skipped and the user was served **4 instead of 8**, despite the derived list still having unread capacity. The 1/4/0 variance is exactly the range of "however many happened to be left when the next swipe raced ahead of the background refill."

The two other candidates were reproduced and shown to be **correct intended behavior, not the bug**:

- **(b) `enqueueInterleaved` MAX_QUEUE_SIZE cap** — `addedCount = Math.min(fresh.length, MAX_QUEUE_SIZE - size)` clamps fresh additions into a near-full queue. But a near-full queue always has ≥ 8 to serve, so the cap never produces a sub-8 served batch. Documented so Task 2 did not "fix" it.
- **(c) `walkDerivedList(24,…)` sub-count** — a small/mostly-explored derived list returns < 24 conceptIds bounded by `maxSteps = Math.max(count*2, len)`. This is genuine vine exhaustion (a finished list correctly yields fewer posts), not an under-refill defect. The GAP-B floor was preserved.

**55-05 async write-through ruled out:** `post-queue.service.ts:save()` performs a fire-and-forget `void dbExecute(...).catch(...)` SQLite upsert, and every queue read (`dequeue`, `size`, `needsRefill`, `enqueueInterleaved`) operates on the synchronous in-memory `_state.posts` mirror. The async write-through never gates a read, so it has **no interaction** with the refill-mutex timing. The bug predates 55-05 and is pure control-flow in `generateMorePosts`.

D-02 dev-gated instrumentation was added so the operator can reproduce the decision state in `npm run dev`: `generateMorePosts` logs requested/queueSize/needsRefill pre-dequeue and served/postPopSize/shortfall post-dequeue; `refillQueue` logs the early-return, the `walkDerivedList` yield (returned vs derivedList length + cyclePosition), and the `enqueueInterleaved` realized-add (size before vs after).

## The Fix (Task 2)

In `generateMorePosts`, the empty-only guard became a **shortfall guard**:

```ts
let posts = postQueueService.dequeue(count);
const refillBranchFired = posts.length < count && postQueueService.needsRefill();
if (refillBranchFired) {
  await refillQueue(questions);
  const topUp = postQueueService.dequeue(count - posts.length);
  posts = posts.concat(topUp);
}
```

- Awaits **at most one** refill per swipe; the `_refillMutex` single-body guarantee means a concurrent background refill is awaited rather than re-run.
- The pre-existing `allExplored` / `bonusCap` early-returns (top of `generateMorePosts`) and `refillQueue`'s own `walkDerivedList(...).length === 0` guard short-circuit a genuinely exhausted vine, so a finished list still correctly yields **fewer than 8** (no false 8, no top-up loop).
- Empty queue is now just the `posts.length === 0 < count` case of the same guard — it tops up to 8 when capacity exists.

## Before/After served-batch evidence (refill-reliability.test.mjs)

| Scenario | Pre-fix served | Post-fix served |
|----------|---------------|-----------------|
| Queue=4, derived list has capacity, swipe(8) | 4 (bug) | 8 (4 + 4 top-up) |
| Queue=0, derived list has capacity, swipe(8) | 0 then late-refill | 8 |
| Queue=3, derived list exhausted, swipe(8) | 3 | 3 (correct — no false 8) |
| Queue=0, refill yields nothing, swipe(8) | 0 | 0 (single refill attempt, no loop) |

## Pipeline-invariant preservation

- `MAX_QUEUE_SIZE = 32`, `REFILL_THRESHOLD = 24`, 8-per-swipe default, `maxSteps = Math.max(count * 2, len)` — all **unchanged**.
- No fourth list, no collapsed lists; `walkDerivedList` + `_refillMutex` remain the single refill path (`_refillMutex` referenced 3× in concept-feed.service.ts).
- `post-queue.service.ts` not modified — the artifact's `contains: REFILL_THRESHOLD` is satisfied by the verified, preserved constant; cause (a) lives entirely in `generateMorePosts`.

## Deviations from Plan

**1. [Rule 3 - Blocking] refill-mutex.test.mjs source-reading regex broke on the early-return instrumentation**
- **Found during:** Task 2 verification (the test suite run).
- **Issue:** Task 1's first instrumentation wrapped `if (!postQueueService.needsRefill()) return;` in a `{ ... }` block to log the early-return. `refill-mutex.test.mjs:168` source-asserts the verbatim single-statement guard `/if\s*\(\s*!postQueueService\.needsRefill\(\)\s*\)\s*return\s*;/`.
- **Fix:** Moved the dev log to a separate preceding `if (...DEV && !needsRefill())` line so the guard statement stays byte-stable as `if (!postQueueService.needsRefill()) return;`. Both the instrumentation and the cheap-pre-check-before-mutex intent are preserved.
- **Files modified:** `app/src/services/concept-feed.service.ts`
- **Commit:** `8cca887d` (the fix landed in the Task 2 commit; the test was caught before Task 1 was finalized in the combined verification).

**2. [Scope] post-queue.service.ts left unmodified.**
- The plan listed `post-queue.service.ts` in `files_modified`, but the confirmed dominant cause (a) lives entirely in `concept-feed.service.ts:generateMorePosts`. Modifying post-queue (threshold/cap/walker) would have changed correct intended behavior (causes b/c). The plan's Task 2 explicitly says "fix the dominant confirmed cause … do not blanket-rewrite the pipeline," so post-queue's constants were verified and preserved rather than changed. The `contains: REFILL_THRESHOLD` artifact note is satisfied by the unchanged constant.

### Environment

- `app/node_modules` was absent in the fresh worktree; symlinked to the main repo's tree after confirming `package-lock.json` is byte-identical (Rule 3 env fix, not a package install; not committed).
- The WASM SQLite "OpfsDb is not a constructor" warning during `node --test` is the expected non-browser fallback to `LocalStorageBackend`; the fire-and-forget write-through swallows it (`.catch`).

## Threat Model Compliance

- **T-55-06a (self-starvation / DoS):** Accept — the shortfall fix awaits at most one extra `refillQueue` per swipe; `_refillMutex` already prevents a refill storm (concurrent callers await the same Promise); `allExplored`/`bonusCap`/walker-empty guards bound generation. No external input, no amplification. A regression test asserts a single refill attempt on empty+empty-refill (no top-up loop).
- **T-55-06b (pipeline drift):** Mitigated — fix reuses the existing walker/mutex path only; no fourth list, walker `maxSteps=Math.max(count*2,len)` preserved. `refill-reliability.test.mjs` + the unchanged `derived-list.test.mjs` / `refill-queue-integration.test.mjs` / `refill-mutex.test.mjs` assert the append-only + cyclic-walker + mutex invariants stay intact.
- **T-55-06-SC (package installs):** n/a — no package installs; modified one service + added one test file.

## Verification

- `refill-reliability.test.mjs` — 7/7 pass (3 reproduction + 4 corrected-path).
- `refill-queue-integration.test.mjs` — 7/7. `derived-list.test.mjs` — 16/16. `refill-mutex.test.mjs` — 9/9.
- `./node_modules/.bin/tsc -b --noEmit` — clean (exit 0).
- Dev-gated instrumentation present in both `generateMorePosts` and `refillQueue` (`import.meta.env?.DEV`).

## Commits

- `b1d5c92b` — test(55-06): reproduce TUNE-03 under-refill + add D-02 refill instrumentation
- `8cca887d` — fix(55-06): await a shortfall refill in generateMorePosts (TUNE-03)

## Self-Check: PASSED

- `refill-reliability.test.mjs`, `concept-feed.service.ts`, `55-06-SUMMARY.md` all exist at stated paths — VERIFIED
- Both task commits (`b1d5c92b`, `8cca887d`) present on the worktree branch — VERIFIED
- No STATE.md / ROADMAP.md modifications (orchestrator owns those writes) — VERIFIED
