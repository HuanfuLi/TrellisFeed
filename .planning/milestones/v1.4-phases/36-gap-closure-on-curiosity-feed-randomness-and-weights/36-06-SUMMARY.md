---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 06
subsystem: ui
tags: [react, useref, strict-mode, warm-start, home-feed, error-gate]

requires:
  - phase: pre-Phase-36 (commit 8b344916, 2026-04-17)
    provides: warm-start useState initializer reading postQueueService.getYesterdayQueue()
  - phase: pre-Phase-36 (commit 6cda914e, 2026-04-18)
    provides: generationError gate for empty getDailyPosts results
provides:
  - "GAP-A blocker fixed: cold-start warm-start posts no longer overwritten by setDailyPosts([])"
  - "Pure-updater compliance under React.StrictMode (no nested setState anti-pattern)"
  - "Source-reading regression test that locks the fix at four invariants"
  - "UAT retest recipe for operator walk-through"
affects: [home-feed, post-queue-warm-start, future-react-19-strict-mode-audits]

tech-stack:
  added: []
  patterns:
    - "useRef snapshot pattern for fact-at-mount values read in async callbacks (Strict Mode safe)"
    - "Source-reading regression tests guarding load-bearing inline patterns (continuation of ChatInput.flex-shrink.test.mjs precedent)"

key-files:
  created:
    - app/tests/screens/HomeScreen.warm-start-guard.test.mjs
    - .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md
  modified:
    - app/src/screens/HomeScreen.tsx

key-decisions:
  - "Used useRef-snapshot pattern over functional updater — purity contract under React.StrictMode (main.tsx:14 double-invokes updaters in dev)"
  - "Top-level conditional setters (`if (posts.length > 0)`, `if (... && !warmStartHadPostsRef.current)`) instead of nested setState — avoids the StrictMode side-effect-doubling failure mode"
  - "Source-reading test (no React render harness) chosen as the cheapest durable lock — same pattern as ChatInput.flex-shrink.test.mjs"
  - "Original 6cda914e error-gate intent (genuine bad-API-key state) preserved via the `!warmStartHadPostsRef.current` arm — fix narrows the gate, does not remove it"

patterns-established:
  - "Pattern: warmStartHadPostsRef = useRef(<derived-from-state>.length > 0) — 'fact at mount, read in async closure' canonical placement"
  - "Pattern: load-bearing inline-style/inline-logic guards documented in three places (CLAUDE.md when public-architectural, inline comment, regression test). Phase 36-06 stayed at two places — inline comment + regression test — because the warm-start contract is screen-local, not project-global. Per CLAUDE.md Phase 32.1 lessons rule 8."

requirements-completed: [GAP-A]

duration: 5min
completed: 2026-05-06
---

# Phase 36 Plan 06: Cold-start warm-start guard (GAP-A) Summary

**Fix the cold-start blocker where useEffect overwrote warm-start posts with `[]` and triggered "Check your API keys" toast on every new-day launch — useRef-snapshot disambiguator + pure top-level setters under React.StrictMode**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-06T17:18:37Z
- **Completed:** 2026-05-06T17:23:18Z
- **Tasks:** 3
- **Files modified:** 1 (HomeScreen.tsx) + 2 created (test + retest doc)

## Accomplishments

- **GAP-A blocker closed.** `HomeScreen.tsx` cold-start useEffect no longer wipes the warm-start posts on a new-day cold launch. Yesterday's leftover posts (from `postQueueService.getYesterdayQueue()`) survive the `getDailyPosts() → []` resolution.
- **Strict Mode purity preserved.** Used `useRef(dailyPosts.length > 0)` snapshot pattern over a functional-updater alternative. Updater functions are pure; no nested setState.
- **Error-gate intent preserved.** The misleading `setGenerationError(true)` no longer fires on cold-start [], but DOES still fire when warm-start was empty AND fetch returned [] (genuine bad-config state, original commit 6cda914e intent).
- **Regression locked.** 4-test source-reading guard at `tests/screens/HomeScreen.warm-start-guard.test.mjs` — any PR removing `warmStartHadPostsRef`, the `!warmStartHadPostsRef.current` gate, the `if (posts.length > 0)` guard, OR introducing the nested setState anti-pattern fails CI.
- **UAT retest recipe drafted.** Operator can verify the fix by editing `echolearn_post_queue.date` to yesterday in devtools, reloading, and confirming no flicker + no error UI.

## Task Commits

1. **Task 1: Add warm-start guard to HomeScreen.tsx cold-start useEffect** — `3664383e` (fix)
2. **Task 2: Add source-reading regression test for warm-start guard** — `460340fd` (test)
3. **Task 3: Manual UAT recipe for cold-start verification** — `5c61427b` (docs)

**Plan metadata commit:** _(pending — will be added by orchestrator's final commit step)_

## Files Created/Modified

- `app/src/screens/HomeScreen.tsx` — Added `warmStartHadPostsRef = useRef(dailyPosts.length > 0)` after the warm-start useState initializer; replaced unconditional `setDailyPosts(posts)` with `if (posts.length > 0) setDailyPosts(posts)`; gated `setGenerationError(true)` on `!warmStartHadPostsRef.current`. 34 inserts / 2 deletes.
- `app/tests/screens/HomeScreen.warm-start-guard.test.mjs` — NEW. 4 source-reading tests asserting the four invariants of the fix. Pattern lifted from `ChatInput.flex-shrink.test.mjs`.
- `.planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md` — NEW. Operator-facing retest recipe for GAP-A, reusable for 36-07 + 36-08.

## Decisions Made

- **useRef vs functional updater.** Plan considered `setDailyPosts(prev => { if (prev.length === 0) setGenerationError(true); return prev; })` to read latest state. Rejected — under `React.StrictMode` (main.tsx:14) updater functions are double-invoked in dev, which would fire `setGenerationError(true)` twice and violate React's "updaters must be pure" contract. useRef captures the warm-start fact ONCE at mount, read in the async closure with no purity hazard.
- **Two-place documentation, not three.** Per CLAUDE.md Phase 32.1 lessons rule 8 ("document load-bearing fixes in three places"), this fix is documented in (a) inline comments at the patched site and (b) the regression test. NOT in CLAUDE.md, because the warm-start contract is screen-local (HomeScreen only) and not a project-wide architectural rule. The Phase 36-05 doc-sync plan already covered project-wide concept feed pipeline contracts.

## Deviations from Plan

None — plan executed exactly as written.

The plan was unusually precise: it specified the exact useRef placement, the exact conditional shapes, the exact comment text, and the exact test invariants. All three tasks landed verbatim. No auto-fixes (Rules 1-3) needed; no architectural decisions (Rule 4) raised; no auth gates encountered.

---

**Total deviations:** 0
**Impact on plan:** Plan was implementation-ready as written.

## Issues Encountered

None.

## Verification Results

```
=== source-reading regression test ===
ℹ tests 4
ℹ pass 4
ℹ fail 0

=== HomeScreen.tsx invariants ===
warmStartHadPostsRef occurrences: 4 (≥3 required)
useRef(dailyPosts.length > 0) occurrences: 1
!warmStartHadPostsRef.current occurrences: 2 (≥1 required)
if (posts.length > 0) occurrences: 1 (≥1 required)

=== Full test suite ===
tests 455 / pass 429 / fail 26
(Phase 36 baseline: 422 pass / 26 fail. New baseline: +7 pass / 0 new fail.
 The +4 from this plan + +3 from parallel plan 36-07 — both met their +N targets.)

=== TypeScript ===
npx tsc -b --noEmit → exit 0
```

## User Setup Required

None — no external service configuration. The fix is a UI-layer change to existing code.

## Next Phase Readiness

- Plan 36-07 (walker-termination-guard) ran in parallel — disjoint files, no merge contention.
- Plan 36-08 (video-completion-signal) is the remaining GAP closure for Phase 36.
- After 36-08, the operator should walk through `36-UAT-RETEST.md` Test 1 to confirm GAP-A on a real cold-start scenario before declaring Phase 36 closed.

## Self-Check: PASSED

- FOUND: app/src/screens/HomeScreen.tsx (modified)
- FOUND: app/tests/screens/HomeScreen.warm-start-guard.test.mjs (created)
- FOUND: .planning/phases/36-gap-closure-on-curiosity-feed-randomness-and-weights/36-UAT-RETEST.md (created)
- FOUND: commit 3664383e (Task 1)
- FOUND: commit 460340fd (Task 2)
- FOUND: commit 5c61427b (Task 3)

---
*Phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights*
*Plan: 06*
*Completed: 2026-05-06*
