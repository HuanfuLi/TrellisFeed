---
phase: 03-graph-memory-recommendation-engine
plan: 07
subsystem: ui
tags: [react, recommendation-feed, interaction-logging, i18n, xss]

requires:
  - phase: 03-06
    provides: persisted recommendation sessions, batches, trace-backed experimental reasons, and fixed-label control reasons
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    provides: immutable frozen post resolver and participant feed-card surface
provides:
  - persisted recommendation-batch rendering and append-only pull-to-load on Home
  - per-recommendation impression and reason-view research events with trace IDs
  - one condition-neutral plain-text reason affordance in EN, ZH, ES, and JA
affects: [03-08, phase-4-study-ui, research-event-replay, phase-uat]

tech-stack:
  added: []
  patterns:
    - retained recommendation session ID in the always-mounted Home slot
    - immutable post resolution layered under persisted recommendation ordering
    - plain React text rendering for persisted LLM reason prose

key-files:
  created:
    - app/tests/screens/HomeScreen.recommendation-feed.test.mjs
  modified:
    - app/src/screens/HomeScreen.tsx
    - app/src/components/FeedCard.tsx
    - app/src/components/MasonryFeed.tsx
    - app/src/services/interaction-log.service.ts
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
    - app/tests/screens/HomeScreen.frozen-feed.test.mjs
    - app/tests/components/FeedCard.test.mjs

key-decisions:
  - "Home retains one recommendation session ID for its always-mounted lifetime and re-reads only persisted items on route return or engagement signals."
  - "Recommendation reasons use one shared FeedCard shape for both study conditions and emit a reason-view event only when expanded."
  - "MasonryFeed carries recommendation, immutable post, and concept-label view models together so ordering and reason provenance cannot drift apart."

patterns-established:
  - "Recommendation view model: keep recommendation metadata adjacent to the immutable post record through the full card-list render path."
  - "Exposure logging: mark recommendation IDs seen before observational async writes to prevent re-render duplicates."

requirements-completed: [RANK-05]

coverage:
  - id: D1
    description: "Home begins or recovers a persisted recommendation session and appends the next batch in stored order."
    requirement: RANK-05
    verification:
      - kind: integration
        ref: "app/tests/screens/HomeScreen.recommendation-feed.test.mjs#Home resolves persisted recommendation items without manifest-order getFeed()"
        status: pass
      - kind: integration
        ref: "app/tests/screens/HomeScreen.recommendation-feed.test.mjs#bottom pull appends the next persisted batch in order without graph-update reshuffling"
        status: pass
    human_judgment: false
  - id: D2
    description: "Feed impressions and reason expansions log postId plus recommendationId without duplicate impressions."
    requirement: RANK-05
    verification:
      - kind: unit
        ref: "app/tests/screens/HomeScreen.recommendation-feed.test.mjs#per-recommendation impressions carry both IDs and dedupe within a session"
        status: pass
      - kind: unit
        ref: "app/tests/screens/HomeScreen.recommendation-feed.test.mjs#expanding a recommendation reason logs one reason-view event with both IDs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both conditions share one reason surface whose persisted prose renders as escaped React text with locale-complete chrome."
    requirement: RANK-05
    verification:
      - kind: unit
        ref: "app/tests/screens/HomeScreen.recommendation-feed.test.mjs#FeedCard renders hostile reason text as escaped plain React text in one shared surface"
        status: pass
      - kind: unit
        ref: "app/tests/locales/bundle-parity.test.mjs#en/zh/es/ja bundles have identical flattened key sets"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reason truncation, expansion, and condition-neutral visual shape behave correctly in the participant WebView."
    requirement: RANK-05
    verification: []
    human_judgment: true
    rationale: "The frozen-pool browser/WebView presentation is the manual-only Phase 3 UAT row and remains scheduled for /gsd-verify-work."

duration: 25min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 7: Recommendation Feed Render Surface Summary

**Persisted recommendation sessions now drive Home ordering, with replayable per-item exposure events and a shared plain-text reason surface across both study conditions.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-18T08:05:00Z
- **Completed:** 2026-07-18T08:30:22Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Replaced Home's manifest-order feed source with retained recommendation sessions, persisted current-item reads, and append-only `nextBatch` pulls while preserving WKWebView direction slop and screen-owned scrolling.
- Replaced the fieldless whole-feed observation with deduplicated `feed_impression` records carrying only `postId` and `recommendationId`.
- Added one expandable FeedCard reason surface for both conditions, escaped hostile prose as React text, and logged traceable `recommendation_reason_view` events.
- Added `feed.reason.toggleLabel` to EN/ZH/ES/JA with bundle parity; non-English wording is flagged for operator review.

## Task Commits

Each task was committed atomically:

1. **Task 1: HomeScreen on recommendation batches + per-item impressions** - `5779041` (feat)
2. **Task 2: FeedCard reason surface + reason-view logging + 4-locale chrome** - `d0dc02a` (feat)

**Plan metadata:** skipped (`commit_docs: false`; planning artifacts remain uncommitted)

## Files Created/Modified

- `app/src/screens/HomeScreen.tsx` - Retained recommendation session loading, persisted append order, immutable post resolution, and per-item impression dedup.
- `app/src/components/FeedCard.tsx` - Shared 44px reason affordance, plain-text reason rendering, and reason-view logging.
- `app/src/components/MasonryFeed.tsx` - Carries recommendation/post/concept-label view models into each card.
- `app/src/services/interaction-log.service.ts` - Requires `postId` and `recommendationId` for feed impressions.
- `app/src/locales/{en,zh,es,ja}.json` - Adds condition-neutral reason toggle chrome.
- `app/tests/screens/HomeScreen.recommendation-feed.test.mjs` - Executable session, append, exposure, XSS, reason-view, and wiring coverage.
- `app/tests/screens/HomeScreen.frozen-feed.test.mjs` - Preserves frozen-record and load-bearing Home guards after the ranking seam cutover.
- `app/tests/components/FeedCard.test.mjs` - Replaces the obsolete no-reason assertion with plain-text reason guards.

## Decisions Made

- Retain a session ID in the always-mounted Home screen instead of generating a new recommendation session on every route return; this recovers served batches without re-ranking them.
- Keep reason prose untranslated data and translate only `feed.reason.toggleLabel`; this preserves the exact persisted reason observed by the participant.
- Log a reason view on expansion, not collapse, so the event represents an intentional request to inspect the rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the Phase 2 Home feed guard after the ranking seam moved**
- **Found during:** Task 1 acceptance verification
- **Issue:** `HomeScreen.frozen-feed.test.mjs` required `frozenFeedService.getFeed()` and the deleted fieldless whole-feed impression, making the full suite incompatible with the planned Phase 3 cutover.
- **Fix:** Kept the immutable post resolver, always-mounted route re-read, empty state, and direction-slop guards while changing ordering and exposure assertions to the recommendation seam.
- **Files modified:** `app/tests/screens/HomeScreen.frozen-feed.test.mjs`
- **Verification:** Both Home screen suites pass together; full `npm test` passes.
- **Committed in:** `5779041`

**2. [Rule 3 - Blocking] Extended the intermediate card-list seam and its obsolete guard**
- **Found during:** Task 2 reason wiring
- **Issue:** `MasonryFeed` accepted only posts and labels, so `Recommendation.reasonText` and its trace ID could not reach `FeedCard`; the existing FeedCard test also prohibited any reason surface.
- **Fix:** Passed the complete recommendation/post/label view model through `MasonryFeed` and updated the stale no-reason test to enforce plain-text rendering instead.
- **Files modified:** `app/src/components/MasonryFeed.tsx`, `app/tests/components/FeedCard.test.mjs`
- **Verification:** Targeted reason tests, 584-test full suite, lint, and production build pass.
- **Committed in:** `d0dc02a`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both changes were necessary to connect the planned render path and keep directly superseded regression guards meaningful; no product scope was added.

## Issues Encountered

None. Lint completed with zero errors and seven pre-existing warnings outside plan files; the production build completed with existing chunk-size/dynamic-import advisories.

## Verification

- `node --test tests/screens/HomeScreen.recommendation-feed.test.mjs` - PASS (8/8 final tests)
- `node --test tests/screens/HomeScreen.recommendation-feed.test.mjs tests/locales/bundle-parity.test.mjs` - PASS (10/10)
- `npm test` - PASS (584 tests, 0 failures)
- `npm run lint` - PASS (0 errors; 7 pre-existing warnings)
- `npm run build` - PASS
- Acceptance greps - PASS (`getFeed()` count 0; feed impression fields present; no `dangerouslySetInnerHTML` in active FeedCard code)

## Translation Review

Operator review requested for the plan-authored non-English chrome values:

- ZH: `为什么推荐这篇？`
- ES: `¿Por qué esta publicación?`
- JA: `この投稿を選んだ理由`

No placeholders or proper nouns occur in the new key; bundle parity is green.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-08 can verify algorithm and integration invariants against the participant-facing recommendation seam.
- Manual browser/WebView reason-surface verification remains intentionally deferred to `/gsd-verify-work` with the fixture/frozen pool.

## Self-Check: PASSED

- All claimed source and test files exist.
- Task commits `5779041` and `d0dc02a` exist in repository history.
- The summary remains uncommitted as required by `commit_docs: false`.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-18*
