---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 09
subsystem: post-queue / concept-feed-pipeline
tags:
  - gap-closure
  - localStorage
  - cold-start
  - warm-start
  - durability
requirements: [GAP-D]
gap_closure: true
dependency-graph:
  requires:
    - "Phase 36-06 useRef-snapshot pattern in HomeScreen.tsx (warm-start guard) — its caller-side discipline is what consumes getYesterdayQueue() on every mount"
  provides:
    - "Durable yesterday-queue snapshot via STORAGE_KEY_YESTERDAY — survives any number of save() calls of today's queue"
    - "getYesterdayQueue() contract: read from snapshot key, not the live key"
  affects:
    - "HomeScreen.tsx warm-start path (now actually durable across all cold-start mounts of a new day)"
    - "SettingsDataScreen.tsx 'Reset today' button (snapshot survives explicit reset — see Test 7)"
tech-stack:
  added: []
  patterns:
    - "Durable snapshot in a separate localStorage key — mirrors the dailyRead/postHistory persistence pattern (D-W4-04 from Phase 32.1 Wave 4: prefer derivation/persistence over single-key in-memory)"
    - "Skip-empty guard on snapshot write (no point persisting an empty posts[])"
key-files:
  created:
    - app/tests/services/post-queue-yesterday-snapshot.test.mjs
  modified:
    - app/src/services/post-queue.service.ts
    - app/tests/services/post-queue.test.mjs
    - CLAUDE.md
decisions:
  - "Use a separate localStorage key (STORAGE_KEY_YESTERDAY = 'echolearn_post_queue_yesterday') instead of overloading the live STORAGE_KEY with a {today, yesterday} composite shape — minimal blast radius (load() and getYesterdayQueue() change; save()/enqueue/markServed/dequeue all unchanged)"
  - "Snapshot only when prior posts.length > 0 (skip-empty guard) — avoids persisting useless empty payloads and avoids leaking a stale snapshot date with no content"
  - "resetForNewDay() does NOT clear STORAGE_KEY_YESTERDAY — operator's 'Reset today' button is meant to clear today's progress, not destroy yesterday's warm-start fallback (Test 7 / checker invariant I-2)"
  - "Updated existing 3 post-queue.test.mjs cases to match the new contract (read from snapshot key, not the live key) — Rule-1 deviation logged below"
metrics:
  duration: "200s (~3.3 min)"
  completed: 2026-05-07T05:33:49Z
  tasks: 3
  commits: 3
  files-touched: 4
---

# Phase 36 Plan 09: Durable Yesterday Snapshot (GAP-D Fix A) Summary

`postQueueService.getYesterdayQueue()` is now durable across multiple cold-start mounts of a new day — reads from a dedicated `STORAGE_KEY_YESTERDAY` key that `load()` populates on date-mismatch, instead of the live key that today's first `save()` overwrites within milliseconds.

## What landed

**Source change (1 file, ~25 lines).** `app/src/services/post-queue.service.ts`:

1. New constant `STORAGE_KEY_YESTERDAY = 'echolearn_post_queue_yesterday'` immediately below `STORAGE_KEY`, with a 10-line comment documenting the durable-snapshot rationale.
2. `load()`'s date-mismatch branch (was: 1-line return) now snapshots `parsed.{date,posts}` to the new key BEFORE returning `freshState()`, gated by `Array.isArray(parsed.posts) && parsed.posts.length > 0`. Wrapped in try/catch with a `console.warn` fallback (mirrors the pattern of the existing `save()` failure handler).
3. `getYesterdayQueue()` rewritten to read from `STORAGE_KEY_YESTERDAY` (no date check needed — the snapshot is already known to be a prior day; if no snapshot exists, return `[]`).

**Test changes (2 files).**

- `app/tests/services/post-queue-yesterday-snapshot.test.mjs` — NEW file, 7 tests, 252 lines. Covers Tests 1–7 from the plan (snapshot-on-load, read-from-snapshot, survives-save, skip-empty, multi-step rollover with W-1 explicit enqueue between rollovers, first-install graceful empty W-2, and resetForNewDay-preserves-snapshot I-2).
- `app/tests/services/post-queue.test.mjs` — UPDATED 3 existing test cases (lines 147–179) that asserted the OLD `getYesterdayQueue` contract (read from `STORAGE_KEY`). They now write to `STORAGE_KEY_YESTERDAY` and assert the new contract.

**Doc-sync (1 file, 1 line added).** `CLAUDE.md` "Concept Feed Generation Pipeline" → "Numeric defaults" gained a new bullet about `STORAGE_KEY_YESTERDAY`, the load()-on-date-mismatch trigger, and a pointer to `.planning/debug/cold-start-warm-start-fragile.md`.

## Verification

| Check | Result |
| --- | --- |
| Phase 36 quick suite (10 files, includes new) | **77/77 GREEN** (70 prior + 7 new) |
| `npx tsc -b --noEmit` | exit 0 |
| Phase 33 grep `dueAnchors` | preserved |
| Phase 33 grep `allExplored && postQueueService.getTotalGenerated` | preserved |
| Phase 35 grep `USER_ACK_BEFORE_GRAPH_CONTEXT` | preserved |
| CLAUDE.md sentinel `html, body { overflow: hidden }` | 3 (unchanged) |
| CLAUDE.md sentinel `minWidth: 0` | 2 (unchanged) |
| CLAUDE.md sentinel `USER_ACK_BEFORE_GRAPH_CONTEXT` | 2 (unchanged) |
| CLAUDE.md sentinel `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD` | 1 (unchanged) |
| CLAUDE.md sentinel `MAX_QUEUE_SIZE` | 1 (unchanged) |
| CLAUDE.md sentinel `STORAGE_KEY_YESTERDAY` | 1 (new) |

## Commits

- `f19d2d9c` — Task 1: source change in `post-queue.service.ts` + corresponding 3-test update in `post-queue.test.mjs` (`fix(36-09): durable yesterday snapshot via separate localStorage key (GAP-D Fix A)`)
- `ca5e8fe4` — Task 2: new behavioral test file `post-queue-yesterday-snapshot.test.mjs` (`test(36-09): behavioral coverage for durable yesterday snapshot (GAP-D Fix A)`)
- `9e4f6e1a` — Task 3: CLAUDE.md "Numeric defaults" new bullet (`docs(36-09): document STORAGE_KEY_YESTERDAY durable snapshot in CLAUDE.md`)

All 3 commits used `--no-verify` per parallel-execution coordination with Plan 36-10 (running concurrently against `SettingsDataScreen.tsx` — disjoint files).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Updated existing post-queue.test.mjs cases to match new getYesterdayQueue contract**

- **Found during:** Task 1 verification (`node --test tests/services/post-queue.test.mjs`)
- **Issue:** The plan listed only `app/src/services/post-queue.service.ts` and the new snapshot test file in `files_modified`. But the existing `post-queue.test.mjs` had 3 tests (lines 147–179) that asserted the OLD `getYesterdayQueue()` contract — namely that writing to `STORAGE_KEY` with a stale date would make `getYesterdayQueue()` return those posts. Under the new contract (read from `STORAGE_KEY_YESTERDAY` only), those tests fail. Without the fix, the existing baseline's 13 post-queue tests would be 12/13 passing (1 false fail).
- **Fix:** Rewrote the 3 cases to write to `STORAGE_KEY_YESTERDAY` instead, asserting the new read-from-snapshot contract. Added a comment in each pointing to the new comprehensive lifecycle file (`post-queue-yesterday-snapshot.test.mjs`) so future readers know where the full coverage lives.
- **Files modified:** `app/tests/services/post-queue.test.mjs` (3 test cases, lines 147–179)
- **Commit:** Folded into Task 1 commit `f19d2d9c` (single atomic change — the test edits are the test-side mirror of the source change in the same commit).

**No other deviations.** All three task prescriptions in the plan landed verbatim. No architectural decisions, no auth gates, no Rule-2 missing-functionality additions.

## Notes for downstream

- The plan explicitly preserves `resetForNewDay()` semantics (does NOT clear the snapshot). Test 7 locks this contract because Plan 36-10's "Reset today" button (parallel territory) invokes `resetForNewDay`, and an unsuspecting future agent might assume "reset" should clear everything. It must not, or the warm-start regresses.
- The "first-install graceful empty" Test 6 is intentional regression-protection — any future refactor that removes the `if (!raw) return []` guard will fail this test loudly.
- `getYesterdayQueue()` no longer applies a "stale-too-old" rejection. If a user is away for a week and returns, they'll see the week-old yesterday snapshot. Treated as out-of-scope per `.planning/debug/cold-start-warm-start-fragile.md` § "Out-of-Scope". A future polish phase can add an age threshold via `parsed.date` comparison to `today()` if needed.

## Self-Check: PASSED

- Source file `app/src/services/post-queue.service.ts` exists and contains `STORAGE_KEY_YESTERDAY` (verified via Read)
- Test file `app/tests/services/post-queue-yesterday-snapshot.test.mjs` exists with 7 GREEN tests
- CLAUDE.md exists with new STORAGE_KEY_YESTERDAY bullet (sentinel grep = 1)
- All 3 commits found in `git log --oneline`: `f19d2d9c`, `ca5e8fe4`, `9e4f6e1a`
- All 5 byte-stability sentinels in CLAUDE.md unchanged
- Phase 36 quick suite 77/77 GREEN
- `npx tsc -b --noEmit` exit 0
