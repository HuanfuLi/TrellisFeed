---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 12
subsystem: feed
tags: [post-queue, refill-mutex, concurrency, promise-mutex, race-condition]

requires:
  - phase: 36-09
    provides: STORAGE_KEY_YESTERDAY durable yesterday-snapshot
  - phase: 36-10
    provides: dev "Force new day" affordance — surfaces the refill-race when retesting
provides:
  - Promise-based mutex on refillQueue (concurrent callers await the same Promise instead of bailing)
  - Leaf module `refill-mutex.ts` exposing `createPromiseMutex()` for testability
  - REFILL_THRESHOLD bumped 12 → 16 (more headroom against rapid swiping; double-column-feed prep)
affects: [phase-37-and-later]

tech-stack:
  added: []
  patterns:
    - "Promise-mutex via createPromiseMutex() — finally clears in BOTH success AND error paths"
    - "Leaf-module extraction for node --test exercise of behavior touching the i18n chain (mirrors feed-spread.ts pattern)"

key-files:
  created:
    - app/src/services/refill-mutex.ts
    - app/tests/services/refill-mutex.test.mjs
  modified:
    - app/src/services/concept-feed.service.ts
    - app/src/services/post-queue.service.ts
    - app/tests/services/post-queue.test.mjs
    - CLAUDE.md

key-decisions:
  - "Promise-based mutex replaces boolean: in-flight callers AWAIT the shared Promise (silent-no-op race eliminated)"
  - "Mutex extracted into a leaf module so node --test can exercise it without crashing on en.json import-attribute (matches feed-spread.ts pattern from Plan 36-04)"
  - "REFILL_THRESHOLD bumped 12 → 16 — larger safety margin against rapid swipes + forward-looking for double-column feed"
  - "Test 4 split into 6 source-reading wiring tests because conceptFeedService.generateMorePosts cannot be imported under node --test (i18n chain blocker); leaf-module mutex semantics + source-reading wiring covers the same behavioral surface"

patterns-established:
  - "Promise-mutex pattern (createPromiseMutex): in-flight collapse + clear-on-finally"
  - "Leaf-module extraction for testability when source imports trigger ERR_IMPORT_ATTRIBUTE_MISSING via i18n chain"

requirements-completed: [GAP-D-round3-e]

duration: ~50min
completed: 2026-05-07
---

# Phase 36 Plan 12: Promise-Mutex Refill + REFILL_THRESHOLD Bump Summary

**Replaced refillQueue's boolean mutex with a Promise-based one (extracted into leaf module `refill-mutex.ts`) so concurrent callers await the same Promise instead of silently bailing; bumped REFILL_THRESHOLD 12 → 16 for a larger swipe-safety margin.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-05-07T09:07:00Z (approximate session start)
- **Completed:** 2026-05-07T09:57:10Z
- **Tasks:** 5 (Task 1, Task 2, Task 2.5, Task 3, Task 4)
- **Files modified:** 4 (2 source, 1 test, 1 doc)
- **Files created:** 2 (1 leaf module, 1 test file)

## Accomplishments

- Closed round-3 sub-issue (e): rapid-swipe / Force-New-Day callers no longer silent-no-op against an empty queue. The in-flight refill body resolves once; all concurrent callers receive the same Promise and dequeue from the populated queue.
- Single LLM body per refill cycle preserved (the boolean mutex's only redeeming property).
- Mutex hygiene on error: `try/finally` in `createPromiseMutex` clears the in-flight Promise on rejection AND fulfillment, so a failed refill cannot permanently lock subsequent callers.
- Bumped `REFILL_THRESHOLD` 12 → 16. Combined with the mutex fix, this further reduces the chance of users encountering empty-state during rapid swiping; forward-looking for the planned double-column feed (which dequeues more per swipe).
- `MAX_QUEUE_SIZE` (32) remains unchanged; new threshold leaves a 16-post runway between threshold and cap.
- Added regression coverage: 9 new GREEN tests in `tests/services/refill-mutex.test.mjs` (3 mutex semantics + 6 wiring); existing `post-queue.test.mjs` threshold test updated 12 → 16 (still GREEN).

## Task Commits

1. **Task 1 — Promise mutex (initial inline IIFE version):** `41b9f7e7` — `fix(36-12): Promise-based mutex on refillQueue (closes round-3 sub-issue e)`
2. **Task 2 — REFILL_THRESHOLD bump:** `5604cd45` — `feat(36-12): bump REFILL_THRESHOLD 12 → 16 (rapid-swipe + double-column readiness)`
3. **Task 2.5 — needsRefill threshold test update:** `567b7c54` — `test(36-12): update needsRefill threshold test 12 → 16`
4. **Task 1 (leaf-module refactor for testability):** `9a0658a5` — `refactor(36-12): extract Promise-mutex into leaf module for testability`
5. **Task 3 — Concurrency tests:** `75d41254` — `test(36-12): Promise-mutex concurrency + generateMorePosts wiring coverage`
6. **Task 4 — CLAUDE.md doc-sync:** `d65f6b90` — `docs(36-12): document refill threshold bump + Promise mutex`

(All commits used `--no-verify` per parallel-execution coordination convention with Wave 1 plans 36-11 / 36-13.)

## Files Created/Modified

- `app/src/services/refill-mutex.ts` (NEW, 60 lines) — Leaf module exposing `createPromiseMutex()`. Zero deps on the i18n chain so `node --test` can exercise the mutex semantics directly.
- `app/src/services/concept-feed.service.ts` — Imports `createPromiseMutex` from the leaf, instantiates `_refillMutex` at module scope, wraps `refillQueue`'s body in `_refillMutex.run(async () => { ... })`. Cheap `!postQueueService.needsRefill()` early-return preserved before the mutex call. The legacy `_queueRefillRunning` boolean and inline finally are gone.
- `app/src/services/post-queue.service.ts` — `REFILL_THRESHOLD` literal 12 → 16. New comment block documents the Phase 36-12 rationale alongside the prior 8 → 12 bump rationale (2026-04-21).
- `app/tests/services/post-queue.test.mjs` — Updated `needsRefill` threshold test (label + enqueue count) 12 → 16. No other test in the file hardcoded the old threshold.
- `app/tests/services/refill-mutex.test.mjs` (NEW, 205 lines) — 9 GREEN tests across two suites: 3 behavioral mutex-semantics tests against `createPromiseMutex()` (single body, shared-Promise, error-clears) + 6 source-reading wiring tests against `concept-feed.service.ts` (import, declaration, `_refillMutex.run` shape, needsRefill pre-check, generateMorePosts await pattern, no leftover `_queueRefillRunning`).
- `CLAUDE.md` — "Numeric defaults" block: refill-threshold bullet updated 12 → 16 with version history; new bullet documents the `createPromiseMutex` mutex.

## Decisions Made

- **Promise-mutex via `createPromiseMutex` factory rather than inline `let _refillInFlight: Promise<void> | null = null;`.** Both shapes are equivalent at runtime, but the factory form (a) exposes a clean `getInFlight()` for tests, (b) packages the `try/finally` clearing semantics in one place so future call sites can't forget the error-path clear, and (c) lives in a leaf module where `node --test` can exercise its semantics directly.
- **Behavioral tests target the leaf, not concept-feed.service.ts.** Importing `concept-feed.service.ts` under `node --test` crashes via the i18n chain (`locales/index.ts → en.json → ERR_IMPORT_ATTRIBUTE_MISSING`). This is the same constraint Plan 36-04 hit; we apply the same workaround. The wiring half of the correctness story is covered by source-reading assertions on `concept-feed.service.ts` (a codebase-canonical pattern — see `ChatInput.flex-shrink.test.mjs`, `HomeScreen.warm-start-guard.test.mjs`, `PostDetailScreen.video-detector.test.mjs`).
- **REFILL_THRESHOLD = 16 picks a value that leaves a 16-post runway from threshold to MAX_QUEUE_SIZE = 32.** Larger values (e.g., 20) would shrink the runway too much; smaller (e.g., 14) wouldn't materially help against rapid swiping.

## Deviations from Plan

### Rule-3 deviation — Behavioral test of `generateMorePosts` integration substituted by source-reading wiring tests

- **Found during:** Task 3 (writing `refill-mutex.test.mjs`)
- **Issue:** Plan §<task><behavior> Test 4 specifies `await conceptFeedService.generateMorePosts(qs, 4)` to verify the in-flight-Promise await pattern. `conceptFeedService` lives in `concept-feed.service.ts`, which cannot be imported under `node --test` (i18n chain → `ERR_IMPORT_ATTRIBUTE_MISSING` on `locales/en.json`). Node 25 has no built-in module mocker (`mock.module` is undefined). The plan's "Following the `refill-queue-integration.test.mjs` pattern" guidance does NOT actually invoke `refillQueue` either — that file imports leaf helpers (`feed-spread.ts`).
- **Fix:** (a) Extracted the Promise-mutex into a new leaf module `app/src/services/refill-mutex.ts` exposing `createPromiseMutex()`. Refactored `refillQueue` to use `_refillMutex.run(...)`. (b) Tests 1–3 (single body, shared-Promise, error-clears) target the leaf module behaviorally — full mutex semantics exercised end-to-end. (c) Test 4 was split into 6 source-reading wiring tests against `concept-feed.service.ts` (import, declaration, `_refillMutex.run(async () => {...})` shape, `needsRefill()` pre-check preserved, `generateMorePosts` retains `await refillQueue(questions)` retry block, no leftover `_queueRefillRunning` references). These prove the wiring is correct without crashing on import.
- **Files modified:** added `app/src/services/refill-mutex.ts`, refactored mutex section in `app/src/services/concept-feed.service.ts`, test file pivoted to leaf-module + source-reading approach.
- **Verification:** 9/9 tests in `refill-mutex.test.mjs` GREEN. Phase 36 quick suite (12 files): 91/91 GREEN. `npx tsc -b --noEmit` exit 0. Phase preservation greps pass: `STORAGE_KEY_YESTERDAY` in post-queue.service.ts, `USER_ACK_BEFORE_GRAPH_CONTEXT` in useQuestions.ts (count=2), `REFILL_THRESHOLD = 16` in post-queue.service.ts.
- **Committed in:** `9a0658a5` (the leaf-module refactor — split out from Task 1's initial inline-IIFE commit `41b9f7e7`) + `75d41254` (the test file).

---

**Total deviations:** 1 Rule-3 (auto-fix blocking issue — i18n chain prevented direct test of refillQueue from node --test)
**Impact on plan:** Behavioral coverage outcomes preserved end-to-end. The leaf-module pattern is a codebase-canonical workaround (Plan 36-04 used it for `feed-spread.ts`); CLAUDE.md's i18n testing rule explicitly endorses it.

## Issues Encountered

- The initial Task 1 commit (`41b9f7e7`) used the plan's prescribed inline IIFE pattern. When writing tests in Task 3, hit the i18n import-chain blocker and reverted to the leaf-module pattern (commit `9a0658a5`). Net effect: two commits for Task 1 instead of one. Both are atomic and bisect-friendly.
- No auth gates, no architectural decisions (Rule 4), no scope creep.

## User Setup Required

None — no external service configuration required. The mutex fix is internal-only.

## Next Phase Readiness

- Phase 36 round-3 gap closure: 1/3 plans complete in this wave (36-12); 36-11 and 36-13 are running in parallel against disjoint files.
- The Promise-mutex pattern (`createPromiseMutex` in `refill-mutex.ts`) is reusable. If future call sites discover similar boolean-mutex bugs (e.g., in canonical-knowledge.service.ts's classification queue), they can adopt the same factory.

## Self-Check: PASSED

- Files created: `app/src/services/refill-mutex.ts` FOUND, `app/tests/services/refill-mutex.test.mjs` FOUND.
- Files modified: `app/src/services/concept-feed.service.ts` modified, `app/src/services/post-queue.service.ts` modified, `app/tests/services/post-queue.test.mjs` modified, `CLAUDE.md` modified.
- Commits: `41b9f7e7`, `5604cd45`, `567b7c54`, `9a0658a5`, `75d41254`, `d65f6b90` — all six present in `git log`.
- Tests: refill-mutex.test.mjs 9/9 GREEN; full Phase 36 quick suite 91/91 GREEN; tsc clean.

---
*Phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights*
*Completed: 2026-05-07*
