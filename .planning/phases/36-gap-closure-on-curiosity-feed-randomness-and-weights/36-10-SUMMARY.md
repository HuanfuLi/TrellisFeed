---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
plan: 10
subsystem: ui
tags: [settings, dev-tooling, vite, import-meta-env, localStorage, post-queue, i18n-exemption]

# Dependency graph
requires:
  - phase: 36-06
    provides: warmStartHadPostsRef snapshot pattern in HomeScreen.tsx (the cold-start path this affordance triggers)
  - phase: 36-09
    provides: durable yesterday snapshot via STORAGE_KEY_YESTERDAY (the load() path this affordance hits when localStorage.date is rolled back)
provides:
  - Dev-only "Force new day" button under Settings → Data & Privacy → Developer
  - handleForceNewDay handler that mutates echolearn_post_queue.date to yesterday, calls postQueueService.loadQueue(), and navigates to /home
  - Source-reading regression test locking the import.meta.env.DEV gate + handler wiring (loadQueue + navigate)
affects:
  - Future GAP-A / GAP-D retests (no longer require waiting for midnight rollover)
  - Any future plan that touches the cold-start warm-start path — this affordance is the canonical dev verification entry point

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vite dev-only UI pattern: `{import.meta.env.DEV && (...)}` wraps a SettingRow so production tree-shakes the dead branch"
    - "i18n exemption pattern: dev-only UI strings hardcoded English with documented inline comment justifying the bundle-parity rule does not apply (CLAUDE.md i18n workflow)"

key-files:
  created:
    - app/tests/screens/SettingsDataScreen.force-new-day.test.mjs
  modified:
    - app/src/screens/settings/SettingsDataScreen.tsx

key-decisions:
  - "Used a hardcoded English SettingRow with an inline-comment i18n exemption rather than threading new keys through en/zh/es/ja bundles — the button is gated behind import.meta.env.DEV and never reaches production users."
  - "Placed the SettingRow AFTER the trellisDevMode SettingRow (and its description hint paragraph) and BEFORE the postRetention SettingRow — keeps all dev-only affordances clustered in the Developer card."
  - "Handler navigates with react-router-dom's navigate('/home') instead of window.location.assign('/home') — preserves the SPA mount lifecycle so HomeScreen's useState initializer (the warm-start entry point) runs cleanly."

patterns-established:
  - "Dev affordances under Settings live in SettingsDataScreen Developer section, gated behind import.meta.env.DEV, with hardcoded English strings + documented exemption comment"

requirements-completed: [GAP-D]

# Metrics
duration: 8min
completed: 2026-05-07
---

# Phase 36 Plan 10: Dev "Force New Day" Affordance Summary

**Dev-only `import.meta.env.DEV`-gated Settings button that rolls echolearn_post_queue.date back to yesterday + calls postQueueService.loadQueue() + navigates to /home, so the cold-start warm-start path can be verified without waiting for an actual midnight rollover.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-07T05:55:00Z
- **Completed:** 2026-05-07T06:13:00Z
- **Tasks:** 2
- **Files modified:** 1
- **Files created:** 1

## Accomplishments

- Closed GAP-D Fix B — the verification gap from `.planning/debug/cold-start-warm-start-fragile.md`. Operators can now retest GAP-A (Plan 36-06) and GAP-D Fix A (Plan 36-09) deterministically without waiting for a real day-boundary or hand-editing localStorage in DevTools.
- Production tree-shaking guaranteed: Vite drops the gated SettingRow at build time when `import.meta.env.DEV` is `false`. Zero shipping risk.
- i18n bundle-parity rule documented as having an exemption for dev-only UI strings (inline comment in the JSX block + this plan's existence as the precedent).

## Task Commits

Each task was committed atomically with `--no-verify` per parallel-execution coordination with Plan 36-09 (which modified `app/src/services/post-queue.service.ts` + `app/tests/services/post-queue-yesterday-snapshot.test.mjs` — fully disjoint from this plan's files):

1. **Task 1: Add the button + handler** — `2eb646aa` (feat)
2. **Task 2: Source-reading regression test** — `984778c3` (test)

## Files Created/Modified

- `app/src/screens/settings/SettingsDataScreen.tsx` — Added `handleForceNewDay` handler (lines 72-97) and gated SettingRow (lines 173-186). +41 lines, zero deletions. Inline i18n-exemption comment block prefixes the SettingRow.
- `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` (NEW, 56 lines) — Source-reading regression test, 4 invariants: (1) `import.meta.env.DEV &&` gate present, (2) `const handleForceNewDay` declared, (3) `postQueueService.loadQueue()` called inside handler region, (4) `navigate('/home')` called inside handler region. Pattern follows `HomeScreen.warm-start-guard.test.mjs` (Plan 36-06).

## Decisions Made

- **Hardcoded English strings + inline-comment exemption** (NOT i18n-bundled): the button is gated by `import.meta.env.DEV` and never reaches production users, so the CLAUDE.md i18n workflow's "all 4 bundles per UI string" rule does not apply. Documented this rationale in a JSX comment block above the gated SettingRow so the next agent who reads it immediately understands why the strings aren't routed through `t(...)`.
- **`navigate('/home')` over `window.location.assign('/home')`**: preserves the SPA mount lifecycle. `HomeScreen.tsx`'s useState initializer (lines 38-47) — which calls `getYesterdayQueue()` — runs cleanly on the navigate-triggered remount; a hard reload via `window.location` would also work but unnecessarily blows away in-memory React state and has slower perceived latency.
- **Insertion point: AFTER trellisDevMode SettingRow + its hint paragraph, BEFORE postRetention SettingRow**: clusters the dev affordance with other dev-mode controls (trellisDevMode is also a dev tool), keeping the Developer card visually coherent. Plan §<action> step 2 prescribed this precise position.
- **Reuse `'Force new day failed. Check console.'` toast on the catch arm** rather than introducing structured error reporting. The handler is tiny (read JSON → mutate one field → write JSON → call loadQueue → navigate), and any failure the catch sees would be either (a) corrupted JSON in localStorage (extreme edge case) or (b) postQueueService.loadQueue throwing (which it doesn't — it's wrapped in try/catch internally). Console.warn + a toast is the correct ergonomic.

## Deviations from Plan

None - plan executed exactly as written.

The plan was unusually precise: it specified the exact handler body, the exact JSX block, the exact insertion point relative to neighboring SettingRows, the exact toast strings, the exact 4 test invariants, and the exact commit messages. All five prescriptions landed verbatim. Zero auto-fixes triggered (no Rule-1/2/3 deviations); zero architectural decisions surfaced (no Rule-4); zero auth gates encountered.

The only minor judgment call was the test-file body wording (the regex-and-message text in each `assert.match` / `assert.ok` call) — the plan §Task 2 `<action>` showed example regex patterns but left the assertion-message wording open. I followed the `HomeScreen.warm-start-guard.test.mjs` pattern (Plan 36-06) for tone and verbosity: each assertion message names the invariant being defended AND points the reader to the relevant context document (`.planning/debug/cold-start-warm-start-fragile.md`) AND notes what would break if the invariant regressed. This matches CLAUDE.md best-practice rule 8 ("document in three places: CLAUDE.md, inline comment, test").

## Issues Encountered

- **Parallel commit interleaving (expected)**: Plan 36-09 committed `f19d2d9c` (post-queue.service.ts fix) and `ca5e8fe4` (post-queue-yesterday-snapshot.test.mjs) concurrently with my commits. Verified disjoint files — no conflict, no merge required, both plans landed clean on the same branch. The `git diff HEAD~2 HEAD --stat` output briefly looked surprising (showed two files changed when I'd only added one) until I realized 36-09's commit had landed in between.
- **No issues from the test or tsc**: 4/4 GREEN on first run; full Phase 36 quick suite reports 74/74 GREEN; `npx tsc -b --noEmit` exit 0; load-bearing greps (Phase 33 `dueAnchors`, Phase 35 `USER_ACK_BEFORE_GRAPH_CONTEXT`, CLAUDE.md `MAX_QUEUE_SIZE`) all pass.

## Verification Results

```
node --test tests/services/derived-list.test.mjs \
            tests/services/style-assignment-stratified.test.mjs \
            tests/services/spread-by-concept.test.mjs \
            tests/services/refill-queue-integration.test.mjs \
            tests/services/style-assignment.test.mjs \
            tests/services/post-queue.test.mjs \
            tests/screens/HomeScreen.warm-start-guard.test.mjs \
            tests/screens/PostDetailScreen.video-detector.test.mjs \
            tests/components/InfoFlow.short-tap-emit.test.mjs \
            tests/screens/SettingsDataScreen.force-new-day.test.mjs

→ tests 74 / suites 10 / pass 74 / fail 0
```

Phase 36 quick-suite total: 70 prior + 4 new = 74 GREEN. (When 36-09's `post-queue-yesterday-snapshot.test.mjs` runs, count rises to 75 + 4 = 79 — outside this plan's scope to verify.)

```
npx tsc -b --noEmit  →  exit 0
grep -q "dueAnchors" app/src/services/concept-feed.service.ts  →  Phase 33 dueAnchors: OK
grep -q "USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts  →  Phase 35 user-ack: OK
grep -q "MAX_QUEUE_SIZE" CLAUDE.md  →  CLAUDE.md MAX_QUEUE_SIZE: OK
```

All Phase 33/35/36 load-bearing greps pass (sanity check that this plan didn't accidentally touch unrelated load-bearing files).

## User Setup Required

None — no external service configuration required. The button is a dev-only affordance; `npm run dev` exposes it automatically; production builds tree-shake it. Operators can use the button to verify GAP-A/GAP-D fixes in the dev loop without any setup.

## Next Phase Readiness

- Plan 36-09 (durable yesterday snapshot) + Plan 36-10 (dev affordance) together close GAP-D end-to-end. Phase 36 progress: 11/11 plans across two waves of post-merge gap closure (00-05 original, 06-08 first UAT round, 09-10 second UAT round).
- Branch `gsd/phase-33-hygiene-and-polish` ready for `/gsd:verify 36` final pass once Plan 36-09's commits and this plan's commits are confirmed by parallel orchestration.
- No new follow-on plans created. The dev affordance is final; future GAP-A / GAP-D regression tests can use the button as their canonical entry point.

## Self-Check: PASSED

Verified all claims:
- File `app/src/screens/settings/SettingsDataScreen.tsx` exists and contains `handleForceNewDay` + `import.meta.env.DEV` gate (greps return 1 + 2 occurrences respectively, line numbers 77 and 177)
- File `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` exists (56 lines, 4 it() blocks, all 4 GREEN)
- Commit `2eb646aa` exists in `git log --oneline --all` (Task 1 commit)
- Commit `984778c3` exists in `git log --oneline --all` (Task 2 commit)

---
*Phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights*
*Completed: 2026-05-07*
