---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 06
subsystem: frozen-feed
tags: [indexeddb, frozen-content, engagement, saved, deterministic-feed]
requires:
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    plan: 05
    provides: ready-only frozen content-pool repository and packaged-data integrity boundary
provides:
  - Condition-neutral frozen feed, detail, suggestion, concept, claim, and original-content selectors
  - ID-only saved, liked, dismissed, and viewed-history state persisted through the DB seam
  - Saved/history resolution through the immutable frozen content facade
affects: [02-feed-ui, 03-graph-memory, saved, post-detail]
tech-stack:
  added: []
  patterns: [single frozen-feed facade, immutable-content-by-id, metadata-only observation history]
key-files:
  created: [app/src/services/frozen-feed.service.ts]
  modified: [app/src/services/engagement.service.ts, app/src/services/post-history.service.ts, app/src/screens/SavedScreen.tsx]
key-decisions:
  - "Frozen feed ordering and selectors remain condition- and question-history-blind; dismissed post IDs filter without re-ranking."
  - "Frozen saved/history state stores IDs and timestamps only; immutable records are resolved from frozenFeedService."
  - "Generated-feed history compatibility remains isolated until Plan 02-07 removes the transitional generator consumers, preserving the load-bearing generated-body persistence invariant between waves."
patterns-established:
  - "Mutable engagement and observation stores reference immutable content by post ID only."
  - "Saved routes navigate by /posts/:id without copying post records into router state."
requirements-completed: [FEED-01, FEED-02]
coverage:
  - id: D1
    description: Deterministic repository-only feed, detail, source, and suggestion facade with condition/question-history parity
    requirement: FEED-01
    verification:
      - kind: integration
        ref: "app/tests/services/frozen-feed.service.test.mjs#FrozenFeedService"
        status: pass
      - kind: integration
        ref: "app/tests/services/suggested-questions.test.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: ID-only engagement and viewed-history metadata persist through the DB seam with idempotent semantic events
    requirement: FEED-01
    verification:
      - kind: integration
        ref: "app/tests/services/engagement.service.test.mjs#persists engagement as ID-only metadata through the DB seam"
        status: pass
      - kind: integration
        ref: "app/tests/services/engagement.service.test.mjs#post history persists only postId and viewedAt"
        status: pass
    human_judgment: false
  - id: D3
    description: Saved and history cards resolve immutable posts through the facade while preserving route, Header, and event resync behavior
    requirement: FEED-02
    verification:
      - kind: integration
        ref: "app/tests/screens/SavedScreen.test.mjs"
        status: pass
    human_judgment: false
duration: 16min
completed: 2026-07-11
status: complete
---

# Phase 02 Plan 06: Frozen Feed and ID-Only Engagement Summary

**A condition-neutral frozen-content facade now owns feed order and immutable record resolution while engagement, history, and Saved retain only post IDs and observation timestamps.**

## Performance

- **Duration:** 16 min across the resumed execution
- **Started:** 2026-07-11T23:16:44Z
- **Completed:** 2026-07-11T23:32:44Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added deterministic, fail-closed frozen feed/detail/concept/claim/suggestion/source selectors with byte-equivalent output across study conditions and no runtime network/provider path.
- Migrated canonical save/like/dismiss/history behavior to post IDs and `{ postId, viewedAt }` metadata persisted through `dbQuery`/`dbExecute`, with idempotent event and research-log emission.
- Rewired Saved/history cards to resolve immutable records through `frozenFeedService`, retain the portal Header/event subscriptions, and navigate by post ID without router snapshots.

## Task Commits

Each TDD task has a RED/GREEN pair. Task 1 was verified and preserved from before the quota interruption; resumed work began at Task 2.

1. **Task 1: Deterministic condition-blind feed/detail/suggestion selectors** - `ade5e88` (test), `6b7c908` (feat)
2. **Task 2: Immutable post-ID engagement/history/Saved migration** - `d75a6ac` (test), `5a1a980` (feat)

## Files Created/Modified

- `app/src/services/frozen-feed.service.ts` - Ready-only deterministic frozen-content facade and dismissed-post filtering.
- `app/src/services/engagement.service.ts` - ID-only save/like/dismiss state with idempotent semantic emissions.
- `app/src/services/post-history.service.ts` - Durable viewed-post metadata selectors plus isolated transitional generated-post compatibility.
- `app/src/screens/SavedScreen.tsx` - Saved/history post resolution through the frozen facade and ID-only navigation.
- `app/src/components/LongPressMenu.tsx` - Removes generated snapshot arguments from save/like calls.
- `app/src/types/index.ts` - Adds the canonical dismiss engagement event kind.
- `app/tests/services/frozen-feed.service.test.mjs` - Ordering, parity, immutability, fail-closed, and no-network coverage.
- `app/tests/services/suggested-questions.test.mjs` - Exact suggestion provenance and dangling-target coverage.
- `app/tests/services/engagement.service.test.mjs` - DB-seam ID-only engagement/history and event idempotency coverage.
- `app/tests/screens/SavedScreen.test.mjs` - Facade resolution, Header, event subscription, and no-router-snapshot coverage.

## Decisions Made

- Kept study condition and question history entirely outside the frozen-feed API; Phase 3 personalization must replace selection behind this facade.
- Used one engagement `dismissed` ID set for canonical frozen post IDs and preserved old anchor-named methods only as an explicitly transitional generated-feed bridge.
- Preserved generated-post full-body history methods until Plan 02-07 removes their callers because deleting them now would break the current build and violate the load-bearing generated-body durability rule. Frozen posts never use those methods.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated the LongPressMenu snapshot call sites**
- **Found during:** Task 2
- **Issue:** Narrowing `savePost`/`likePost` to one post-ID argument left generated snapshot arguments at the UI call sites and would fail TypeScript compilation.
- **Fix:** Removed the concept-feed snapshot lookup and passed post IDs only.
- **Files modified:** `app/src/components/LongPressMenu.tsx`
- **Verification:** LongPressMenu regression tests, full `npm test`, lint, and build pass.
- **Committed in:** `5a1a980`

**2. [Rule 3 - Blocking] Extended the existing engagement event union for post dismissal**
- **Found during:** Task 2
- **Issue:** The canonical `dismissPost` semantic event was not representable by the existing `ENGAGEMENT_CHANGED` payload type.
- **Fix:** Added `dismiss` to the existing event kind union instead of introducing a new event type.
- **Files modified:** `app/src/types/index.ts`
- **Verification:** Engagement event-count tests and TypeScript build pass.
- **Committed in:** `5a1a980`

**3. [Rule 2 - Missing Critical] Preserved generated-post durability until its scheduled removal**
- **Found during:** Task 2
- **Issue:** Fully deleting old post-history snapshot methods in Plan 06 would break current generated-feed, essay-patch, and post-detail consumers before Plan 07 replaces them.
- **Fix:** Isolated metadata-only frozen history from marked legacy generated-post methods; frozen Saved/history uses only the new metadata path.
- **Files modified:** `app/src/services/post-history.service.ts`
- **Verification:** Post-history regression tests, full `npm test`, lint, and build pass; DB assertions prove frozen history rows contain only `postId` and `viewedAt`.
- **Committed in:** `5a1a980`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical).
**Impact on plan:** Canonical frozen behavior matches the plan; compatibility is narrowly retained only for load-bearing transitional generated-feed consumers scheduled for removal in Plan 02-07.

## Issues Encountered

- Execution resumed after a quota interruption with Task 1 already committed and Task 2 tests partially edited. The useful partial tests were preserved, verified RED, committed once, and no Task 1 work was duplicated.
- Lint passes with 24 pre-existing warnings and zero errors. Build retains pre-existing Vite chunk/dynamic-import warnings.

## User Setup Required

None - no external service configuration required.

## Test Results

- Plan acceptance set — 34/34 passed.
- Extended engagement/history/LongPress regression set — 49/49 passed.
- Full `npm test` — 892/892 passed.
- `npm run lint` — passed with 0 errors and 24 pre-existing warnings.
- `npm run build` — passed.

## Next Phase Readiness

- Plans 02-07 and 03 can consume one stable condition-neutral frozen-feed boundary.
- Plan 02-07 should remove the marked generated-feed history/anchor compatibility methods when it replaces their remaining callers.

## Self-Check: PASSED

- Confirmed the required frozen-feed artifact and all Task 2 sources/tests exist.
- Confirmed both RED/GREEN commit pairs are present in git history.
- Re-ran plan acceptance tests, the full Node suite, lint, and production build after the final Task 2 commit.
- Confirmed no live fetch/provider path, question-history input, condition input, router post snapshot, or immutable frozen body persistence was introduced.

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-11*
