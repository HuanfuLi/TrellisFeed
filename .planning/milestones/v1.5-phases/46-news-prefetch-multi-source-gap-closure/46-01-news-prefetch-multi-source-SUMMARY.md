---
phase: 46-news-prefetch-multi-source-gap-closure
plan: 01
subsystem: services
tags: [concept-feed, news, tavily, source-diversity, testing]

requires:
  - phase: 40-source-diversity-leaf-module
    provides: sourceDiversityService.filterForDiversity and domain rotation
  - phase: 41-pipeline-wiring-essay-depth
    provides: newsMeta.sources and generateNewsEssay sources.slice(0, 3)
provides:
  - Queued news prefetch carries top-source arrays into newsMeta.sources
  - Shared news source metadata helper for top-source selection and source mapping
  - CONTENT-03 regression evidence and close-out docs
affects: [concept-feed, post-essay, milestone-v1.5-audit]

tech-stack:
  added: []
  patterns: [leaf-helper-for-service-testability, source-reading-regression]

key-files:
  created:
    - app/src/services/news-source-metadata.ts
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VERIFY.md
  modified:
    - app/src/services/concept-feed.service.ts
    - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
    - app/tests/services/post-essay.service.test.mjs
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "Use a leaf helper for news top-source selection and newsMeta source mapping rather than importing the full concept-feed service in tests."
  - "Keep Tavily ranking/domain scoring, prompt wording, and broad concept-feed refactors out of scope."
  - "Treat npm test as passed-with-known-baseline because the script exits 0 while test:main retains the Phase 45 deferred buildFallbackPosts import failure."

patterns-established:
  - "News source metadata helper: selectNewsTopSources filters and slices; mapNewsSourcesToNewsMeta assigns stable 1-based indexes."
  - "Queued-prefetch cache arrays: PreFetchCache.news stores WebSearchResult[] keyed by conceptId."

requirements-completed: [CONTENT-03]

duration: 14m 08s
completed: 2026-05-13
---

# Phase 46 Plan 01: News Prefetch Multi-Source Summary

**Queued news posts now preserve top 2-3 Tavily sources from refillQueue prefetch into `newsMeta.sources`.**

## Performance

- **Duration:** 14m 08s
- **Started:** 2026-05-13T08:00:59Z
- **Completed:** 2026-05-13T08:15:07Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `news-source-metadata.ts` with `selectNewsTopSources` and `mapNewsSourcesToNewsMeta`.
- Changed `PreFetchCache.news` from a single `WebSearchResult` cache to `WebSearchResult[]`.
- Wired queued-prefetch and direct no-prefetch news paths through the same top-source helper.
- Added CONTENT-03 regression coverage proving multiple sources map to stable indexed `newsMeta.sources`.
- Marked CONTENT-03 complete and recorded final verification evidence for milestone re-audit.

## Task Commits

1. **Task 1: Add RED regression for queued-news prefetch multi-source cache** - `9a7a3be7` (test)
2. **Task 2: Carry top 2-3 Tavily results through PreFetchCache.news** - `1857820c` (feat)
3. **Rule 1 auto-fix: update news snippet invariant for helper mapper** - `398686a2` (test)
4. **Task 3: Record final verification and mark CONTENT-03 ready for milestone re-audit** - metadata commit (docs)

## Files Created/Modified

- `app/src/services/news-source-metadata.ts` - Leaf helper for source diversity selection and `newsMeta.sources` mapping.
- `app/src/services/concept-feed.service.ts` - Array cache for queued news prefetch; cached branch maps up to three prefetched sources.
- `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` - Behavioral regression plus source-reading checks for CONTENT-03.
- `app/tests/services/post-essay.service.test.mjs` - Updated snippet-preservation invariant to follow the helper mapper.
- `.planning/phases/46-news-prefetch-multi-source-gap-closure/46-VERIFY.md` - Final command evidence.
- `.planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md` - Validated/compliant sign-off.
- `.planning/REQUIREMENTS.md` - CONTENT-03 checked complete.
- `.planning/ROADMAP.md` - Phase 46 marked 1/1 complete.
- `.planning/STATE.md` - Current position and last decisions updated for milestone re-audit.

## Decisions Made

- The helper module is intentionally small and leaf-like so Node tests can exercise production logic without importing the full concept-feed/i18n chain.
- `generateNewsEssay` was left unchanged and still consumes `sources.slice(0, 3)`.
- Tavily ranking, domain scoring, prompt wording, queue sizing, and broad concept-feed refactors stayed out of scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale source-reading invariant after helper extraction**
- **Found during:** Task 3 verification
- **Issue:** `post-essay.service.test.mjs` still looked for inline `snippet:` mapping inside `concept-feed.service.ts`, but the snippet mapping moved to `news-source-metadata.ts`.
- **Fix:** The test now asserts the news branch calls `mapNewsSourcesToNewsMeta(topSources)` and the helper maps `snippet: r.content`.
- **Files modified:** `app/tests/services/post-essay.service.test.mjs`
- **Verification:** `cd app && node --test tests/services/post-essay.service.test.mjs`
- **Committed in:** `398686a2`

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** No scope expansion; the fix preserved the same news body streaming invariant after the planned helper extraction.

## Issues Encountered

- `npm test` exits 0, but `test:main` still reports the known deferred `tests/concept-feed.test.mjs` stale `buildFallbackPosts` import failure from Phase 45. This phase did not fix that unrelated baseline issue.

## Verification

- `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs` - exit 0, 17/17 pass.
- `cd app && npm run build` - exit 0.
- `cd app && npm run lint` - exit 0 with existing 24 warnings.
- `cd app && npm test` - exit 0; `test:main` 850 pass / 1 known deferred fail, `test:actions` 16/16 pass.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

CONTENT-03 is ready for v1.5 milestone re-audit. Next action: rerun `$gsd-audit-milestone 1.5`, then `$gsd-complete-milestone 1.5`.

## Self-Check: PASSED

- Found created files: `app/src/services/news-source-metadata.ts`, `46-VERIFY.md`, `46-01-news-prefetch-multi-source-SUMMARY.md`.
- Found commits: `9a7a3be7`, `1857820c`, `398686a2`.
- Acceptance checks for validation, requirements, roadmap, state, and summary all returned matches.

---
*Phase: 46-news-prefetch-multi-source-gap-closure*
*Completed: 2026-05-13*
