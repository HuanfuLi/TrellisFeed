---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 07
subsystem: frozen-feed-ui
tags: [react, frozen-content, youtube, post-qa, i18n, accessibility]
requires:
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    plan: 06
    provides: condition-neutral frozen feed/detail/suggestion selectors and ID-only engagement
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    plan: 08
    provides: canonical post-bounded Ask coordinator and durable same-post threads
provides:
  - Authentic canonical frozen-post cards and always-mounted Home feed
  - In-app stored article reader plus selected YouTube playback and transcript fallback
  - Schema-backed pre-generated suggestions sharing the canonical Ask path
affects: [02-09, 03-graph-memory, home, post-detail, participant-ui]
tech-stack:
  added: []
  patterns: [condition-neutral frozen UI, inert stored-text rendering, transcript-first video fallback, exact suggestion provenance]
key-files:
  created: [app/src/components/FeedCard.tsx, app/src/components/OriginalContent.tsx, app/src/components/SuggestedQuestionList.tsx]
  modified: [app/src/components/MasonryFeed.tsx, app/src/screens/HomeScreen.tsx, app/src/screens/PostDetailScreen.tsx, app/src/locales/en.json, app/src/locales/zh.json, app/src/locales/es.json, app/src/locales/ja.json]
key-decisions:
  - "Frozen Home and PostDetail consume only frozenFeedService records; condition and question history remain outside feed presentation."
  - "Articles render as React text blocks, while YouTube is the sole embedded remote original and always retains a stored transcript fallback."
  - "Suggested-question controls pass the exact frozen record to one shared Ask handler and persist only its canonical ID/text source fields."
patterns-established:
  - "Participant content UI resolves immutable posts and metadata at render time instead of accepting router snapshots."
  - "Remote media events are translated into allowlisted, once-per-semantic-action research events."
requirements-completed: [FEED-01, FEED-02]
coverage:
  - id: D1
    description: Canonical frozen cards and Home feed replace generated-content presentation with accessible real-post metadata
    requirement: FEED-01
    verification:
      - kind: integration
        ref: "app/tests/components/FeedCard.test.mjs + app/tests/screens/HomeScreen.frozen-feed.test.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: Stored articles render inertly and selected YouTube originals degrade to stored transcript and summary
    requirement: FEED-01
    verification:
      - kind: automated_ui
        ref: "app/tests/components/OriginalContent.test.mjs#React SSR hostile article and online/offline video paths"
        status: pass
      - kind: integration
        ref: "app/tests/screens/PostDetailScreen.frozen-content.test.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: Exact pre-generated suggestion provenance reaches the condition-neutral canonical Ask path with four-locale chrome
    requirement: FEED-02
    verification:
      - kind: integration
        ref: "app/tests/screens/PostDetailScreen.suggested-questions.test.mjs + app/tests/locales/bundle-parity.test.mjs"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-11
status: complete
---

# Phase 02 Plan 07: Frozen Feed and Post UI Summary

**Home and PostDetail now present immutable curated posts, canonical stored originals, pre-generated questions, and one shared post-scoped Ask path without generated-feed or condition-specific presentation.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-12T00:24:27Z
- **Completed:** 2026-07-12T00:38:44Z
- **Tasks:** 3
- **Files modified:** 34

## Accomplishments

- Replaced generated masonry branches with accessible whole-card frozen posts containing source identity, summary, concepts, time, difficulty, and viewpoint metadata.
- Rebuilt PostDetail around immutable frozen records, inert full article text, selected YouTube playback, stored transcript fallback, source attribution, canonical history, engagement, and preserved exploration/logging signals.
- Added 3–5 schema-backed suggestion controls that retain exact provenance through the same condition-neutral Ask coordinator as typed questions, with all visible chrome shipped in en/zh/es/ja.

## Task Commits

1. **Task 1: Build accessible real-content cards and frozen Home feed** — `fa12368` (RED), `6489cd3` (GREEN)
2. **Task 2: Render canonical stored articles and YouTube/transcript fallback** — `735ca1a` (RED), `b6b64f6` (GREEN)
3. **Task 3: Show schema-backed suggested questions and four-locale chrome** — `63390a5` (RED), `ef0c953` (GREEN)
4. **Acceptance hardening: retire replaced-shell regressions and execute hostile/offline render paths** — `45ab18c`, `24a7d8a`, `36644c3` (test)

## Files Created/Modified

- `app/src/components/FeedCard.tsx` — Accessible canonical Post card with resolved concept labels.
- `app/src/components/OriginalContent.tsx` — Inert stored article blocks and selected YouTube/transcript rendering with safe source attribution.
- `app/src/components/SuggestedQuestionList.tsx` — 44px schema-provenance suggestion controls.
- `app/src/components/MasonryFeed.tsx` — Frozen-post-only card layout with no generated style/connection/milestone branches.
- `app/src/screens/HomeScreen.tsx` — Condition-neutral frozen feed, route reread, impression deduplication, and direction-safe local refresh gesture.
- `app/src/screens/PostDetailScreen.tsx` — Frozen detail, original content, engagement, exploration signals, suggestions, canonical thread hydration, and shared Ask.
- `app/src/locales/{en,zh,es,ja}.json` — Exact empty/fallback copy and localized frozen-detail chrome.
- `app/tests/components/` and `app/tests/screens/` — Executable/source contract coverage for cards, originals, Home, PostDetail, and suggestions.

## Decisions Made

- Used one frozen facade for every participant-visible post lookup, including route return and detail hydration; no router post snapshot or condition input is accepted.
- Kept article rendering deliberately text-only and allowed remote content only for an explicitly selected YouTube source.
- Preserved the existing `CONCEPT_EXPLORED` event as the sole exploration signal for scroll, dwell, successful Q&A, and the explicit seen-enough control.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retired generated-shell regression tests after the intentional UI cutover**
- **Found during:** Plan-level full regression verification
- **Issue:** 82 assertions pinned generated masonry engagement overlays, refill/warm-start behavior, AI essay streaming, image carousel, and deep-dive controls that Plan 02-07 explicitly removes.
- **Fix:** Removed only obsolete generated Home/Masonry/PostDetail tests, retained generator service tests, and updated bookmark/logging guards to their frozen UI owners.
- **Files modified:** 19 app test files
- **Verification:** Full `npm test` passes 804/804; plan and load-bearing suites pass separately.
- **Committed in:** `45ab18c`

**2. [Rule 2 - Missing Critical] Upgraded original-content security checks from source-only to executable rendering**
- **Found during:** Acceptance review
- **Issue:** Initial component tests proved structural guards but did not execute hostile article escaping or online/offline video output.
- **Fix:** Rendered `OriginalContent` through Vite SSR using fixture posts/assets, a network-failing spy, hostile markup, and online/offline navigator states.
- **Files modified:** `app/tests/components/OriginalContent.test.mjs`
- **Verification:** Hostile markup is escaped, article rendering makes zero network calls, online video emits only the selected embed, and offline output contains stored transcript + summary.
- **Committed in:** `24a7d8a`, `36644c3`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical).
**Impact on plan:** Both changes enforce the planned generated-shell removal and threat mitigations; no participant feature scope or condition behavior expanded.

## Issues Encountered

- The repository retained extensive historical source-reading tests for the intentionally removed generated UI. They were migrated at the cutover boundary; generator services and their own tests remain untouched.
- Lint passes with zero errors and 23 pre-existing warnings. Build retains existing Vite chunk/dynamic-import warnings.

## User Setup Required

None - no external service configuration required.

## Test Results

- Plan UI/behavior suite — 24/24 passed, including executable hostile article and online/offline video fixtures.
- Load-bearing root overflow, SwipeTab resize, ChatInput flex, and locale suite — 9/9 passed.
- Full `npm test` — 804/804 passed.
- `npm run lint` — passed with 0 errors and 23 pre-existing warnings.
- `npm run build` — passed.

## Next Phase Readiness

- Plan 02-09 can bind the final packaged frozen artifact without changing participant UI or Ask behavior.
- The real pool remains intentionally unfabricated; validated fixture-injected data covers 02-07 until Plan 02-04's human freeze checkpoint completes.

## Self-Check: PASSED

- Confirmed all three required components exist and all RED/GREEN plus acceptance-hardening commits are present.
- Re-ran every task verification, plan acceptance suite, UI-SPEC/load-bearing contract suite, full app suite, lint, and production build.
- Confirmed no generated Home/PostDetail consumer, raw HTML renderer, article/transcript fetch, condition branch, personalized suggestion, recommendation reason, or unresolved HIGH threat remains in the 02-07 surface.

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-11*
