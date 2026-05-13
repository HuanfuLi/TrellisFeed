---
phase: 41-pipeline-wiring-essay-depth
plan: 01
subsystem: services
tags: [source-diversity, web-search, tavily, exclude-domains, day-boundary-reset, walker-dismiss-integration, multi-snippet-grounding]

# Dependency graph
requires:
  - phase: 39-engagement-service-walker-extension
    provides: engagementService.getDismissedAnchorIds() + walkDerivedList(count, exploredIds, dismissedIds) — Phase 39 wired the walker call site at concept-feed.service.ts:1212; Plan 41-01 adds the SC-1 integration test asserting the end-to-end dismiss-skip flow
  - phase: 40-source-diversity-leaf-module
    provides: sourceDiversityService 5-function singleton (filterForDiversity, recordServedDomain, getUsedDomains, scoreSource, reset) + extractDomain helper + DOMAIN_TIERS table — Plan 41-01 wires the leaf into news creation + pre-fetch loops
provides:
  - WebSearchOptions.excludeDomains?: string[] field threaded into Tavily exclude_domains body field (conditional on .length truthy per Pitfall 1)
  - Source-diversity wiring at both news call sites in concept-feed.service.ts (creation loop ~:1083 + pre-fetch loop ~:1293) — the canonical getUsedDomains → excludeDomains+maxResults:3 → filterForDiversity → recordServedDomain triple, with after-commit ordering
  - Multi-snippet newsMeta.sources shape (filtered.slice(0, 3) → indexed { index, title, url, snippet } entries) — consumed by Plan 41-02's generateNewsEssay sources.slice(0, 3) for SC-4 grounding
  - Day-boundary sourceDiversityService.reset() inside loadCache()'s date-mismatch branch (Pitfall 3 Option A — idempotent placement)
  - SC-1 integration test (walker dismissedIds end-to-end) targeting walkDerivedList directly per Pitfall 7 (NOT a mocked refillQueue end-to-end test)
affects: [phase-41-02-essay-depth-citation-rendering, phase-43-engagement-ui]

# Tech tracking
tech-stack:
  added: []  # Pure wiring + interface extension — zero new dependencies
  patterns:
    - "Pattern 2 (per-anchor domain rotation triple): getUsedDomains → exclude+widen → filterForDiversity → recordServedDomain after commit; replicated at BOTH news call sites with identical structure"
    - "After-commit recordServedDomain ordering: record AFTER posts.push (creation loop) or preFetched.news.set (pre-fetch loop) — recording before commit pollutes the per-anchor used set with domains that may not have shipped"
    - "Truthy domain guard on recordServedDomain: `if (domain) sourceDiversityService.recordServedDomain(...)` — extractDomain returns undefined for malformed URLs per Phase 40 D-10; guard prevents 'undefined' polluting the used set"
    - "Conditional Tavily payload field set: `if (options?.excludeDomains?.length) body.exclude_domains = options.excludeDomains` — keeps wire payload minimal when no exclusions needed (Pitfall 1)"
    - "Day-boundary wholesale reset inside loadCache() date-mismatch branch (Pitfall 3 Option A — idempotent Map.clear() on already-empty Map is a no-op; harmless if loadCache fires multiple times before saveCache(today) writes a fresh entry)"
    - "Walker integration test targeting walkDerivedList directly (Pitfall 7) — NOT a mocked refillQueue end-to-end (would require stubbing 8+ dependencies)"
    - "Multi-snippet newsMeta.sources stored as filtered.slice(0, 3).map((r, i) => ({ index: i + 1, title, url, snippet: r.content })) — back-compat additive (1-element array still works for cached-branch path with topSources = [cached])"
    - "Window-based source-reading test pattern with explicit window-bump notes when test windows lag legitimate code growth (Plan 41-01 bumped 2 test windows: post-essay.service.test.mjs 2500→3500, concept-feed-cache-date.test.mjs 1200→1800)"

key-files:
  created:
    - "app/tests/services/web-search-exclude-domains.test.mjs (151 lines — 7 test cases: 3 source-reading + 4 fetch-capture behavioral)"
    - "app/tests/services/concept-feed-source-diversity-wiring.test.mjs (199 lines — 12 test cases across 5 describe blocks: SC-1 integration + SC-2(a) source-reading + SC-2(b) behavioral + counterweights)"
    - "app/tests/services/source-diversity-day-boundary-reset.test.mjs (113 lines — 4 outcome-based test cases per Pitfall 8)"
    - ".planning/phases/41-pipeline-wiring-essay-depth/41-01-refillqueue-source-diversity-wiring-SUMMARY.md (this file)"
  modified:
    - "app/src/services/web-search.service.ts (+8 lines — WebSearchOptions.excludeDomains?: string[] field + conditional body.exclude_domains assignment)"
    - "app/src/services/concept-feed.service.ts (+~40 net lines across 4 sites — leaf import; news creation loop wiring + multi-snippet shape + after-commit record; news pre-fetch loop wiring + after-commit record; loadCache day-boundary reset)"
    - "app/tests/services/post-essay.service.test.mjs (+5 lines / -3 lines — slice window 2500→3500 for news branch source-reading test, with documenting comment)"
    - "app/tests/services/concept-feed-cache-date.test.mjs (+12 lines / -3 lines — regex updated to accept braced block form alongside one-liner; slice window 1200→1800)"
    - ".planning/REQUIREMENTS.md (CONTENT-02 marked complete; traceability table row updated to 'Phase 40+41 / Wave 1+2 / ✓ Complete')"
    - ".planning/ROADMAP.md (Phase 41 plan list — 41-01 marked [x])"
    - ".planning/STATE.md (close-out section + plan progression)"

key-decisions:
  - "Walker integration test targets walkDerivedList directly (Pitfall 7), NOT a mocked refillQueue end-to-end. Mocking refillQueue would require stubbing settings + Tavily + YouTube + post-history + dailyRead + concept-feed dedup + style-assignment + ~5 other transitive deps; brittle and slow. The semantic load-bearing seam is walkDerivedList(count, exploredIds, dismissedIds) — that's where the dismissed-skip logic lives. Test asserts: dismissAnchor('X') → walker(2, emptySet, dismissedSet) returns conceptIds excluding X."
  - "Pitfall 8 outcome-based test for day-boundary reset (NOT mock.callCount === 1). reset() is idempotent — Map.clear() on already-empty Map is a no-op. Asserting call count would FAIL if loadCache fires multiple times for stale-date cache (which is legitimate). Test asserts the END STATE (recordServedDomain → reset → getUsedDomains returns empty Set) instead."
  - "Multi-snippet shape stored as filtered.slice(0, 3) in CREATION loop only; pre-fetch loop stores ONLY filtered[0] as `chosen` into preFetched.news (single chosen result for cache-hit path). The cached-branch in creation loop wraps single cached result as topSources = [cached] — back-compat with pre-Phase-41 single-source behavior."
  - "Conditional set for exclude_domains body field (Pitfall 1) instead of always-set with empty array. Tavily docs say empty array is a no-op, but minimal payload is cleaner and matches the existing includeImages conditional pattern at web-search.service.ts:48-50."
  - "Auto-fix Rule 1 fold-into-task-2: post-essay.service.test.mjs window 2500 → 3500. The Phase 41 source-diversity wiring block (~600 chars: cached branch / topSources / usedDomains / excludeDomains / filterForDiversity / recordServedDomain) pushed `snippet:` past the prior 2500 cap. Same window-fragility class as Plan 39-01's image-gen-key-gate fix."
  - "Auto-fix Rule 1 fold-into-task-4: concept-feed-cache-date.test.mjs regex + window. Phase 41 Plan 41-01 Task 3 wrapped the early return in a braced block to call sourceDiversityService.reset() alongside return null. The hard-coded one-liner regex `/parsed\\.date !== today\\(\\)\\)\\s*return\\s+null/` no longer matched. Updated to `/parsed\\.date !== today\\(\\)\\)\\s*(\\{[\\s\\S]*?)?return\\s+null/` (multiline-aware optional braced block). Slice window 1200 → 1800 to capture the new return-null position past the comment block."
  - "Walker call at concept-feed.service.ts:1212 UNTOUCHED per plan instruction (Phase 39 D-07 wire is load-bearing). Phase 41 SC-1 only ADDS the integration test asserting end-to-end behavior; the wire itself was already correct."
  - "bodyMarkdown: '' invariant at news creation post object preserved verbatim (CLAUDE.md 'News post pipeline' load-bearing rule). The bodyMarkdown comment block carried over from the pre-Phase-41 code is intact; only the surrounding wiring (cached-branch handling, topSources construction, after-commit record) changed."
  - "extractDomain undefined-guard pattern: `const domain = extractDomain(result.url); if (domain) sourceDiversityService.recordServedDomain(...)`. Phase 40 D-10 made extractDomain defensive (returns undefined on malformed URLs); the guard prevents polluting the per-anchor used set with literal 'undefined' string."
  - "Plan 41-01 close-out: 4 atomic per-task commits + close-out commit. Test baseline: pre-Plan-41-01 603/2 → post-Plan-41-01 626/2 (+23 passes: 7 web-search-exclude-domains + 4 day-boundary-reset + 12 source-diversity-wiring; same 2 pre-existing carry-over failures from Plan 40-01). test:actions 16/16/0 unchanged. tsc -b --noEmit exits 0."

patterns-established:
  - "Pattern 2 wiring template (per-anchor domain rotation triple at any future call site): getUsedDomains BEFORE the external call → pass [...usedDomains] as exclude → filterForDiversity on results → record AFTER commit guarded by truthy domain check. Replicable for any future search-source rotation seam (e.g., YouTube channel rotation if a parallel `videoDiversityService` is built)."
  - "Window-bump-with-comment auto-fix discipline: when a window-based source-reading test fails because legitimate new code pushed a referenced symbol past the window cap, bump the window AND add a comment naming the phase that bumped it + why. Two such bumps in this plan; same class as Plan 39-01's image-gen-key-gate fix and 38-02's style-assignment-stratified test fixture."
  - "Outcome-based test for idempotent functions (Pitfall 8): assert end state after sequence of operations, NOT call count. Applies to any future wholesale-wipe / clear() / reset() function whose 'fired N times' semantics may legitimately vary."

requirements-completed: [CONTENT-02]

# Metrics
duration: 28 min
completed: 2026-05-09
---

# Phase 41 Plan 01: Refill-queue Source Diversity Wiring Summary

**Wires Phase 40's `sourceDiversityService` into both news call sites in `concept-feed.service.ts` (creation loop + pre-fetch loop), adds `WebSearchOptions.excludeDomains?: string[]` threaded into Tavily's `exclude_domains` body field, installs the day-boundary `reset()` inside `loadCache()`'s date-mismatch branch, and adds the SC-1 walker dismissedIds integration test — closing CONTENT-02 from `◐ Partial` → `✓ Complete` and landing the multi-snippet `newsMeta.sources` shape that Plan 41-02 consumes via `sources.slice(0, 3)`.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-05-09T18:30:00Z (approximate)
- **Completed:** 2026-05-09T18:58:00Z (approximate)
- **Tasks:** 5 (1 web-search interface + 1 concept-feed wiring + 1 day-boundary reset + 1 integration tests + 1 close-out)
- **Files created:** 4 (3 test files + this SUMMARY)
- **Files modified:** 6 (2 source files + 2 carry-over test files for window/regex auto-fix + REQUIREMENTS.md + ROADMAP.md + STATE.md to be updated by close-out)

## Accomplishments

- `WebSearchOptions.excludeDomains?: string[]` field added; Tavily request body conditionally sets `exclude_domains` only when array has length (Pitfall 1 — minimal payload)
- Both news call sites in concept-feed.service.ts (creation loop ~:1083 + pre-fetch loop ~:1293) now follow Pattern 2: read usedDomains BEFORE webSearch → pass `[...usedDomains]` as excludeDomains + widen maxResults from 1 → 3 → filterForDiversity on results → record AFTER commit (guarded by truthy domain check)
- Multi-snippet `newsMeta.sources` shape stored as `topSources.map((r, i) => ({ index: i + 1, title: r.title, url: r.url, snippet: r.content }))` from `filtered.slice(0, 3)` — up to 3 entries indexed 1..N (was 1-element array); Plan 41-02 consumes this via `sources.slice(0, 3)` for SC-4 multi-snippet grounding
- `sourceDiversityService.reset()` placed inside `loadCache()`'s date-mismatch branch BEFORE `return null` (Pitfall 3 Option A — idempotent placement; Map.clear() on already-empty Map is a no-op)
- SC-1 integration test landed: `engagementService.dismissAnchor('X')` → `walkDerivedList(N, emptySet, new Set(getDismissedAnchorIds()))` returns conceptIds excluding 'X' (targets walkDerivedList directly per Pitfall 7, NOT a mocked refillQueue)
- 23 new test cases across 3 new test files, all green
- Phase 36-12 `_refillMutex` discipline preserved: `recordServedDomain` is pure-Map mutation (cannot throw per Phase 40 D-10); the mutex's try/finally cannot be subverted
- Walker call at concept-feed.service.ts:1212 (`walkDerivedList(16, exploredIds, dismissedIds)`) UNTOUCHED — Phase 39 D-07 wire is load-bearing; counterweight test asserts continued presence
- `bodyMarkdown: ''` invariant at news creation post object preserved verbatim (CLAUDE.md "News post pipeline" load-bearing rule)
- CONTENT-02 promoted from `◐ Partial` (Phase 40 leaf only) → `✓ Complete` (Phase 40 leaf + Phase 41-01 Tavily wire) in REQUIREMENTS.md

## Task Commits

Each task was committed atomically with `(41-01)` scope (--no-verify per parallel-execution protocol — orchestrator validates hooks once after all wave agents complete):

1. **Task 1: WebSearchOptions.excludeDomains + Tavily body threading** — `88c5bc3d` (feat)
2. **Task 2: Wire sourceDiversityService into news creation + pre-fetch loops + multi-snippet shape** — `83804b5c` (feat) — also folds Rule 1 auto-fix to post-essay.service.test.mjs window 2500→3500
3. **Task 3: Day-boundary sourceDiversityService.reset() at loadCache** — `c68bd4b2` (feat)
4. **Task 4: SC-1 integration test + SC-2(a)/(b) wiring assertions** — `436e8279` (test) — also folds Rule 1 auto-fix to concept-feed-cache-date.test.mjs regex (one-liner → braced block) + window 1200→1800

**Plan close-out commit:** to follow this SUMMARY (docs(41-01) — see git log)

## Files Created/Modified

### Created

- `app/tests/services/web-search-exclude-domains.test.mjs` (NEW, 151 lines) — 7 cases: 3 source-reading (interface field, conditional body set, max_results regression guard) + 4 fetch-capture behavioral (excludeDomains threads to body, omits when undefined, omits when empty array, preserves other body fields)
- `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` (NEW, 199 lines) — 12 cases across 5 describe blocks: SC-1 integration (walker excludes dismissed; counterweight empty-dismissed) + SC-2(a) source-reading wiring (getUsedDomains BEFORE webSearch at both sites; excludeDomains+maxResults:3 spread; filterForDiversity calls excluding docstring matches) + SC-2(a) counterweight (recordServedDomain after posts.push; after preFetched.news.set; both guarded by `if (domain)`) + SC-2(b) behavioral rerank (mit.edu unseen beats nature.com seen; counterweight: with no used, top-quality wins) + Phase 39 walker counterweight
- `app/tests/services/source-diversity-day-boundary-reset.test.mjs` (NEW, 113 lines) — 4 outcome-based cases per Pitfall 8: source-reading (reset() inside date-mismatch branch BEFORE return null) + behavioral (wholesale wipe) + behavioral (idempotent two consecutive resets) + behavioral (doesNotThrow on already-empty)
- `.planning/phases/41-pipeline-wiring-essay-depth/41-01-refillqueue-source-diversity-wiring-SUMMARY.md` (this file)

### Modified

- `app/src/services/web-search.service.ts` (+8 lines) — `WebSearchOptions.excludeDomains?: string[]` field added (4th optional slot); body builder gains conditional `if (options?.excludeDomains?.length) body.exclude_domains = options.excludeDomains;` block before headers construction
- `app/src/services/concept-feed.service.ts` (+~40 net lines across 4 sites):
  - Top-of-file leaf import: `import { sourceDiversityService, extractDomain } from './source-diversity.service.ts';`
  - News creation loop (~:1083): rewritten to use Pattern 2 triple + multi-snippet topSources shape + after-commit recordServedDomain (preserves bodyMarkdown:'' invariant verbatim)
  - News pre-fetch loop (~:1293): rewritten to use Pattern 2 triple (stores filtered[0] as `chosen` into preFetched.news) + after-commit recordServedDomain
  - loadCache() date-mismatch branch (~:186): wrapped early return in braced block, calls sourceDiversityService.reset() before `return null`
- `app/tests/services/post-essay.service.test.mjs` (+5 / -3 lines) — slice window 2500 → 3500 chars in `news branch in concept-feed.service.ts defers body to streaming` test, with documenting comment naming Phase 41-01 as the source of the bump
- `app/tests/services/concept-feed-cache-date.test.mjs` (+12 / -3 lines) — regex updated to accept braced block form (multiline-aware `[\s\S]*?` inside optional `\{...\}`); slice window 1200 → 1800 chars to capture new return-null position past the comment block

## Test Baselines

| Suite | Pre-Plan-41-01 (post-40-01) | Post-Plan-41-01 | Delta |
|-------|------------------------------|-----------------|-------|
| `tsc -b --noEmit` | exit 0 | exit 0 | unchanged |
| `npm run test:main` | 603 pass / 2 fail | **626 pass / 2 fail** | +23 passes (7 + 4 + 12 across 3 new files) |
| `npm run test:actions` | 16/16/0 | 16/16/0 | unchanged |

**Pass count exceeds plan's expected lower bound.** The 2 remaining test:main failures are the SAME pre-existing carry-overs from Plan 39-01 / 40-01 close:

1. `tests/concept-feed.test.mjs` — `ERR_MODULE_NOT_FOUND` for extensionless `youtube.service` import (pre-existing extension-resolution issue)
2. `tests/services/trellis-layout.test.mjs:64` — `getVineColor returns one of the 5 --node-* variables` date-dependent assertion (pre-existing timezone/date-sensitive test)

Neither failure mentions source-diversity, source-diversity-anti-wire, source-diversity-day-boundary-reset, web-search-exclude-domains, concept-feed-source-diversity-wiring, or any Phase 41 file. Phase 41 Plan 41-01 introduces ZERO regressions.

## Decisions Made

- **Walker integration test targets walkDerivedList directly per Pitfall 7.** Mocking refillQueue end-to-end would require stubbing settings + Tavily + YouTube + post-history + dailyRead + concept-feed-dedup + style-assignment + ~5 other transitive deps — brittle and slow. The semantic load-bearing seam is `walkDerivedList(count, exploredIds, dismissedIds)`. Test setup: `engagementService.dismissAnchor('X') → postQueueService.appendToDerivedList(['X','Y','Z']) → walkDerivedList(2, emptySet, new Set(getDismissedAnchorIds()))`; assertion: result excludes 'X', includes Y + Z.
- **Outcome-based reset() test per Pitfall 8 (NOT mock.callCount).** `reset()` is idempotent — `Map.clear()` on already-empty Map is a no-op. The plan-prescribed test `mock.callCount === 1` would FAIL if loadCache fires multiple times during stale-date scenarios (which is the legitimate path until saveCache(today) writes a fresh entry). End-state assertion: `recordServedDomain → reset → getUsedDomains returns empty Set` is invariant regardless of how many times reset fires.
- **Multi-snippet shape stored at creation loop only.** Pre-fetch loop stores ONLY `filtered[0]` as `chosen` into `preFetched.news` (one result per anchor for the cache hit path). The creation loop's cached-branch wraps single cached result as `topSources = [cached]` (1-element array — back-compat). The full multi-snippet `topSources = filtered.slice(0, 3)` array is built only when the creation loop calls webSearch directly (cache miss). This matches the existing pre-fetch architecture (Promise.all over many anchors selecting one each) without restructuring.
- **Conditional `exclude_domains` body set (Pitfall 1).** Always-set-with-empty-array would work (Tavily docs say empty arrays are no-ops), but the conditional pattern matches the existing `includeImages` conditional at web-search.service.ts:48-50 and keeps the wire payload minimal. Future Tavily payload additions should follow the same convention.
- **Auto-fix Rule 1 fold into Task 2.** post-essay.service.test.mjs has a window-based source-reading test that asserts `snippet:` appears within 2500 chars of `for (const a of newsAssignments)`. The Phase 41 wiring block (cached branch handling + topSources allocation + sourceDiversityService.getUsedDomains + 3-line excludeDomains+maxResults webSearch call + filterForDiversity + slice) added ~600 chars BEFORE the `newsMeta` block where `snippet:` lives. Window bumped 2500 → 3500 with documenting comment naming Phase 41-01 as the source. Same window-fragility class as Plan 39-01's image-gen-key-gate fix.
- **Auto-fix Rule 1 fold into Task 4.** concept-feed-cache-date.test.mjs hard-coded `if (parsed.date !== today()) return null;` as a one-liner via regex `/parsed\.date !== today\(\)\)\s*return\s+null/`. Phase 41 Plan 41-01 Task 3 wrapped this in a braced block to call sourceDiversityService.reset() alongside the return. Updated regex to `/parsed\.date !== today\(\)\)\s*(\{[\s\S]*?)?return\s+null/` (multiline-aware optional braced block); window bumped 1200 → 1800 to capture the new return-null position past the 4-line comment that explains the day-boundary reset.
- **Walker call at concept-feed.service.ts:1212 UNTOUCHED per plan instruction.** Phase 39 D-07 wired `walkDerivedList(16, exploredIds, dismissedIds)` with `dismissedIds = new Set(engagementService.getDismissedAnchorIds())`; this was already correct. Plan 41-01 SC-1 only ADDS the integration test (Phase 39 didn't have an end-to-end test). Counterweight test in Task 4 asserts continued presence of the verbatim line + the dismissedIds Set construction.
- **`bodyMarkdown: ''` invariant preserved at news creation post object.** The pre-Phase-41 comment block above `bodyMarkdown: ''` (5 lines explaining the 2026-04-19 regression) is intact; only the surrounding wiring (cached-branch + topSources + after-commit record) changed. CLAUDE.md "News post pipeline" load-bearing rule held; tests/services/post-essay.service.test.mjs `news branch defers body to streaming` test confirms it.
- **`extractDomain` undefined-guard pattern.** Phase 40 D-10 made `extractDomain` return `undefined` for malformed URLs (defensive try/catch around `new URL(...)`). The guard `const domain = extractDomain(url); if (domain) sourceDiversityService.recordServedDomain(...)` prevents polluting the per-anchor used set with literal 'undefined' string. Counterweight test in Task 4 asserts both call sites use this guard.

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — bug fixes folded into the source-modifying task's commit)

**1. [Rule 1 — Bug] post-essay.service.test.mjs window-fragility (folded into Task 2 commit `83804b5c`)**

- **Found during:** Task 2 (after running `npm test`)
- **Issue:** `tests/services/post-essay.service.test.mjs:113` slices 2500 chars from `for (const a of newsAssignments)` and asserts `snippet:` is present. Phase 41 wiring (cached branch + topSources + getUsedDomains + 3-line excludeDomains+maxResults webSearch + filterForDiversity + slice — ~600 chars) pushed the `snippet:` line in `newsMeta.sources` past the 2500-char window cap.
- **Fix:** Bumped window 2500 → 3500 chars. Updated the test's documenting comment to name Phase 41-01 as the source of the bump and explain the wiring block size.
- **Files modified:** `app/tests/services/post-essay.service.test.mjs` (5 lines added, 3 lines removed)
- **Commit:** `83804b5c` (folded into Task 2 source commit)
- **Why this is in scope:** My Task 2 source change directly broke this test by growing the news loop. Test-infrastructure fragility (window-based source-reading) is not the production bug; the production code is correct. Same class as Plan 39-01's image-gen-key-gate window fix.

**2. [Rule 1 — Bug] concept-feed-cache-date.test.mjs regex + window-fragility (folded into Task 4 commit `436e8279`)**

- **Found during:** Task 3 verification (running `npm test` after Task 3 commit revealed the failure)
- **Issue:** `tests/services/concept-feed-cache-date.test.mjs:49` hard-coded `if (parsed.date !== today()) return null;` as a one-liner via regex `/parsed\.date !== today\(\)\)\s*return\s+null/`. Phase 41 Plan 41-01 Task 3 wrapped the early return in a braced block to call `sourceDiversityService.reset()` alongside the return. Regex no longer matched. Slice window 1200 chars also no longer reached the new `return null` position (now at offset 1312 from function start, past the 4-line comment block explaining the day-boundary reset).
- **Fix:** Updated regex to `/parsed\.date !== today\(\)\)\s*(\{[\s\S]*?)?return\s+null/` (multiline-aware optional braced block). Bumped slice window 1200 → 1800 chars with documenting comment naming Phase 41-01 Task 3 as the source.
- **Files modified:** `app/tests/services/concept-feed-cache-date.test.mjs` (12 lines added, 3 lines removed)
- **Commit:** `436e8279` (folded into Task 4 commit)
- **Why this is in scope:** My Task 3 source change (wrap early-return in braced block) directly broke this test. Test-infrastructure fragility — same class as Plan 39-01's image-gen-key-gate window fix.

### No Other Deviations

The plan's task list, file list, action steps, and acceptance criteria executed verbatim aside from the two Rule 1 auto-fixes folded into the affected source commits. No Rule 2 / Rule 3 / Rule 4 events. No architectural questions raised.

## Issues Encountered

None beyond the two Rule 1 auto-fixes documented above. Both auto-fixes are window/regex fragility class — same root cause as Plan 39-01 / 38-02 carry-over patterns. Captured as Phase 44/45 candidate (test infrastructure modernization to use AST-based assertions instead of fragile window+regex pattern).

## User Setup Required

None. Plan 41-01 is pure-wiring + interface extension; no new external services, no new env vars, no migrations. Existing Tavily account requirement (settings.webSearch.tavilyApiKey) is unchanged from v1.4+.

## Next Phase Readiness

**Plan 41-02 (essay-depth + citation rendering) ready to proceed.** All Plan 41-01 dependencies for Plan 41-02 are now in place:

- `newsMeta.sources` is now an array of up to 3 indexed entries (was 1-element array). Plan 41-02's `generateNewsEssay` consumes this via `sources.slice(0, 3)` for SC-4 multi-snippet grounding — no further structural change needed.
- `sourceDiversityService` wiring is complete; Plan 41-02 does NOT touch concept-feed.service.ts (file-level overlap, but Wave 2 sequencing avoids parallel-write corruption).

Plan 41-02 covers: SC-3 (`EssayOptions.depth: 'deep'` 350-600w), SC-4 (consumes Plan 41-01's multi-snippet shape), SC-5 (ReactMarkdown sup/a/section overrides + LLM footnote prompt), SC-6 (body-slice cap 2000→4000), SC-7 (signal threading on generateConnectionPost + generateDiscoverPost + 3-branch abort audit in PostDetailScreen.tsx). Files touched: post-essay.service.ts + PostDetailScreen.tsx + Markdown.tsx + types/index.ts + 3 new test files.

**Closes:** CONTENT-02 (Phase 41 wires Phase 40 leaf into Tavily; user-visible behavior — repeat anchors return fresh sources — now shippable).

**Lands shape consumed by:** CONTENT-03 (Plan 41-02 SC-4 — multi-snippet grounding via `sources.slice(0, 3)`).

## Self-Check

After writing this SUMMARY, the following claims are verified by direct inspection:

- File `app/src/services/web-search.service.ts` modified: `grep -c "excludeDomains?: string\[\]" app/src/services/web-search.service.ts` returns 1 ✓
- File `app/src/services/concept-feed.service.ts` modified: `grep -c "sourceDiversityService.getUsedDomains" app/src/services/concept-feed.service.ts` returns 2 ✓
- File `app/tests/services/web-search-exclude-domains.test.mjs` exists ✓ (created in Task 1)
- File `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` exists ✓ (created in Task 4)
- File `app/tests/services/source-diversity-day-boundary-reset.test.mjs` exists ✓ (created in Task 3)
- Commit `88c5bc3d` (Task 1: web-search excludeDomains) exists in `git log` ✓
- Commit `83804b5c` (Task 2: source-diversity wiring) exists in `git log` ✓
- Commit `c68bd4b2` (Task 3: day-boundary reset) exists in `git log` ✓
- Commit `436e8279` (Task 4: integration tests) exists in `git log` ✓
- `cd app && npm test` exits with the expected baseline (626 pass / 2 fail in test:main; 16/16/0 in test:actions) ✓
- `cd app && tsc -b --noEmit` exits 0 ✓
- Walker call at concept-feed.service.ts:1212 untouched: `grep -c "walkDerivedList(16, exploredIds, dismissedIds)" app/src/services/concept-feed.service.ts` returns 1 ✓
- Phase 36-12 `_refillMutex` discipline preserved (visual inspection — wiring lives inside `_refillMutex.run(...)` body; no throw paths added) ✓

## Self-Check: PASSED
