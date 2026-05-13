---
phase: 40-source-diversity-leaf-module
plan: 01
subsystem: services
tags: [source-diversity, web-search, tavily, url-normalization, psl, leaf-module, sync-only]

# Dependency graph
requires:
  - phase: 37-i18n-leaf-module-refactor
    provides: leaf-module discipline (no JSON imports, no lib/date.ts, .ts extension on relative imports, source-reading invariant test pattern)
  - phase: 39-engagement-service-walker-extension
    provides: peer leaf-service template (singleton object export shape, JSDoc style, source-reading anti-wire test precedent, docstring de-collision lesson)
provides:
  - Pure-logic source-diversity leaf module (5-function singleton + 2 helpers + 3 consts)
  - Bundled ~219-entry DOMAIN_TIERS quality table spanning 5 tiers (top peer-reviewed, upper-mid journalism, mid encyclopedic, low aggregator/UGC, blocked SEO/farms)
  - 12-entry MULTI_SEGMENT_TLDS PSL slice (CONTEXT's initial 10 + RESEARCH § 2's gob.mx + ac.nz)
  - Two-pass re-rank algorithm (Pass A unseen → Pass B seen, score-desc, V8 stable sort) with D-06 best-of-the-bad fallback
  - Session-scoped Map<anchorId, Set<domain>> bookkeeping with synchronous record/get/reset API
  - Source-reading anti-wire invariant test locking the sync-only contract
affects: [phase-41-pipeline-essay-depth]

# Tech tracking
tech-stack:
  added: []  # Pure-logic leaf — zero new dependencies (no tldts, no PSL package)
  patterns:
    - "Inline tier-table const + module-level Map-from-entries (O(1) lookup, init-once at import time per RESEARCH § 8 Pitfall 5)"
    - "Hand-rolled PSL slice for multi-segment TLDs (12-entry Set; covers ~99% of real Tavily URLs; trivially extensible vs. 30KB tldts dependency)"
    - "Two-pass strict bucket split for re-ranking (Pass A unseen, Pass B seen; concatenate; predictable + auditable vs. weighted score blending)"
    - "Best-of-the-bad fallback semantics: fires ONLY when ALL inputs were malformed URLs, NOT when valid-but-seen results exist (Pass B still surfaces those)"
    - "Single-file source-reading anti-wire test (vs. multi-file walk in engagement-anti-wire) — window-fragility-free by design"

key-files:
  created:
    - "app/src/services/source-diversity.service.ts (513 lines — leaf service + DOMAIN_TIERS table)"
    - "app/tests/services/source-diversity.service.test.mjs (218 lines — 16 behavioral cases)"
    - "app/tests/services/source-diversity-anti-wire.test.mjs (68 lines — 4 source-reading assertions)"
    - ".planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md (this file)"
  modified: []

key-decisions:
  - "DOMAIN_TIERS authored at 219 entries, modestly above the ~180-200 target — adds depth in academic publishers (Springer, Wiley, Cambridge, OUP, ScienceDirect, Tandfonline, Frontiers) and broader social/UGC coverage (Twitter/X, Facebook, LinkedIn, YouTube, Stack Overflow distinguished from Stack Exchange) without bloating file size."
  - "Special-cased Stanford Encyclopedia of Philosophy (plato.stanford.edu = 0.85), ProPublica (0.85), and Harvard Health (health.harvard.edu = 0.85) as journalism-tier quality despite encyclopedic/general-interest classification — peer-reviewed and primary-source proximity warrant the bump."
  - "Docstring de-collision applied PROACTIVELY (Phase 39 lesson). The leaf header originally listed forbidden patterns verbatim ('No async, No await, No fetch, No chatStream, No chatCompletion, No localStorage'). These would have false-positively matched the plan's `! grep -q '\\basync\\b'` and `! grep -q 'chatStream|chatCompletion'` and `! grep -q 'localStorage'` acceptance grep checks. Rephrased to surrogate language ('No deferred-execution function declarations', 'no suspending expression', 'no LLM call', 'no browser-storage read or write'). The actual runtime anti-wire test uses /\\basync\\s/ which would have been safer (excludes backtick-wrapped instances), but the plan's structural grep assertions are stricter and forced the rephrase."
  - "Anti-wire test sanity-check performed (per plan): temporarily injected `async function _antiwire_probe() { await Promise.resolve(); }` into source-diversity.service.ts → assertion fired with the expected message at line 46 → reverted; clean test run confirmed all 4 assertions still pass against the production source."
  - "Phase 41 boundary held strictly. NO edits to concept-feed.service.ts, web-search.service.ts, or any consumer. NO recordServedDomain call site added. NO Tavily maxResults widening. The leaf is ready-to-be-consumed; Phase 41 owns the wiring."
  - "Filter and sort steps within filterForDiversity use Array methods (.filter, .sort, .map) without intermediate caching of scoreSource calls. For N≤5 (Phase 41's planned Tavily maxResults), the redundant lookups are <0.01ms. For larger N a memoization wrapper would be trivial; deferred until profiling shows need."
  - "DOMAIN_TIERS placed at the bottom of the file (per plan ordering note) with _tierMap initialized via Object.entries immediately after — module-load runs top-to-bottom, scoreSource is only invoked AFTER import completes (from external callers + tests), so the function-declaration vs. _tierMap-init ordering is safe."

patterns-established:
  - "Pure-logic leaf with session-scoped Map state — differs from engagement.service.ts (localStorage-backed cross-day) and refill-mutex.ts (Promise-reference closure) by being in-memory only and Map-shaped. Lost on cold-boot by design."
  - "Hand-rolled PSL slice over hostname-parser dependency (tldts is 30KB; Phase 37 leaf-module discipline forbids new deps; 12-entry Set covers ~99% of real-world Tavily URLs and is trivially extensible)."
  - "Best-of-the-bad fallback as a load-bearing UX choice (not a safety net). The fallback PREVENTS silent zero-posts-for-concept failures and is referenced inline in code with both D-06 + ROADMAP success criterion #1 anchors."
  - "Single-file anti-wire scan for sync-only invariant — simpler than engagement-anti-wire's multi-file walk because the invariant is 'no async/fetch/LLM in THIS leaf' not 'no co-emission across the codebase'. Window-fragility-free by design (no 800-char or 6000-char proximity check)."

requirements-completed: [CONTENT-02]

# Metrics
duration: 11 min
completed: 2026-05-09
---

# Phase 40 Plan 01: Source Diversity Leaf Module Summary

**Pure-logic leaf service with 219-entry hand-curated domain quality table, hand-rolled 12-entry PSL slice, two-pass re-rank with best-of-bad fallback, and session-scoped per-anchor Map bookkeeping — sync-only, zero new dependencies, ready for Phase 41 wiring into concept-feed.service.ts's news branch**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-09T12:43:19Z
- **Completed:** 2026-05-09T12:53:55Z
- **Tasks:** 4 (3 implementation + 1 verification gate)
- **Files created:** 3 (1 source + 2 tests)
- **Files modified:** 0 (Phase 41 boundary held — no edits to concept-feed.service.ts or web-search.service.ts)

## Accomplishments

- 5-function singleton API ready for Phase 41 consumption: `filterForDiversity`, `recordServedDomain`, `getUsedDomains`, `scoreSource`, `reset`
- 219-entry DOMAIN_TIERS quality table covering peer-reviewed academic (0.95), engineering/CS publishers (0.88-0.93), government primary (0.92), academic institutions (0.90), wire services + intl broadcasting (0.88), major newspapers (0.85), intl news (0.85), science/tech journalism (0.83), gov policy/stats (0.82), encyclopedic (0.72-0.78), science communication (0.70-0.78), tech/business trade (0.68), general aggregators (0.65), niche/expert blogs (0.62), educational platforms (0.60), blog platforms (0.15-0.30), social/UGC (0.10-0.45), news aggregators (0.20-0.35), link aggregators (0.25), AI content farms (0.0), SEO aggregators (0.0), doorway/thin-content (0.0)
- 12-entry MULTI_SEGMENT_TLDS Set (CONTEXT's 10 + RESEARCH § 2 additions: `gob.mx`, `ac.nz`)
- Two-pass re-rank with V8 stable sort preserving Tavily-original tie-break order; best-of-bad fallback fires only when ALL inputs are malformed URLs (load-bearing per ROADMAP success criterion #1)
- Defensive try/catch around `new URL()` in `extractDomain` so one malformed URL never crashes a refill cycle
- 16 behavioral test cases (15 plan-required + 1 singleton-shape sanity check) — all green
- 4 source-reading anti-wire assertions locking the sync-only contract — all green; manual sanity-check (inject probe → fail → revert) passed
- Zero new dependencies; zero edits to existing services; zero regressions in test:main + test:actions

## Task Commits

Each task was committed atomically with `(40-01)` scope:

1. **Task 1: Implement source-diversity.service.ts** — `934343a3` (feat)
2. **Task 2: Behavioral test suite (16 cases)** — `8e67b6e1` (test)
3. **Task 3: Source-reading anti-wire test (4 assertions)** — `780c00c3` (test)
4. **Task 4: Full-suite green check** — verification-only, no commit (per plan)

**Plan close-out commit:** to follow this SUMMARY (docs(40-01) — see git log)

## Files Created/Modified

- `app/src/services/source-diversity.service.ts` (NEW, 513 lines) — Phase 40 leaf service: 5-function singleton + extractDomain + normalizeHost + DOMAIN_TIERS (219 entries) + MULTI_SEGMENT_TLDS (12 entries) + UNKNOWN_DOMAIN_SCORE (0.5)
- `app/tests/services/source-diversity.service.test.mjs` (NEW, 218 lines) — 16 behavioral test cases covering CONTENT-02 SC-1 (filterForDiversity bucket split + D-06 fallback + D-10 malformed exclusion + D-07 stable sort + valid-but-seen surfaces via Pass B), SC-2 (recordServedDomain + getUsedDomains + reset round-trip + idempotence), SC-3 (scoreSource [0,1] from O(1) Map lookup)
- `app/tests/services/source-diversity-anti-wire.test.mjs` (NEW, 68 lines) — 4 source-reading invariant assertions covering CONTENT-02 SC-4: counterweight (filterForDiversity present), no async-function declarations (proves no awaited expression can exist), no fetch( call, no chatStream/chatCompletion calls

## Test Baselines

| Suite | Pre-Phase-40 (post-39-01) | Post-Plan-40-01 | Delta |
|-------|---------------------------|------------------|-------|
| `tsc -b --noEmit` | exit 0 | exit 0 | unchanged |
| `npm run test:main` | 583 pass / 2 fail | **603 pass / 2 fail** | +20 passes (16 behavioral + 4 anti-wire) |
| `npm run test:actions` | 16/16/0 | 16/16/0 | unchanged |

**Pass count exceeds plan's expected lower bound of 601.** The 2 remaining test:main failures are the SAME pre-existing carry-overs from Plan 39-01 close:

1. `tests/concept-feed.test.mjs` — `ERR_MODULE_NOT_FOUND` for extensionless `youtube.service` import in `concept-feed.service.ts` (pre-existing extension-resolution issue)
2. `tests/services/trellis-layout.test.mjs:64` — `getVineColor returns one of the 5 --node-* variables` date-dependent assertion (pre-existing timezone/date-sensitive test)

Neither failure mentions source-diversity, source-diversity-anti-wire, or any Phase 40 file. Phase 40 introduces ZERO regressions.

## Decisions Made

- **DOMAIN_TIERS authored at 219 entries** (target was ~180-200). Above-target depth came from broader academic publisher coverage (added Springer, Wiley, Cambridge, OUP, ScienceDirect, Tandfonline, Frontiers, Plos, USENIX) and wider social/UGC distinction (Twitter/X 0.10, Stack Overflow 0.45 separate from Stack Exchange 0.35). Operator can override any entry in PR review.
- **Special-cased plato.stanford.edu (0.85), ProPublica (0.85), Harvard Health (0.85)** as journalism-tier quality despite encyclopedic/general-interest classification. Stanford Encyclopedia of Philosophy is peer-reviewed; ProPublica is investigative journalism; Harvard Health is primary-source clinical. RESEARCH § 1 mid-tier guidance was conservative; the operator's editorial-line directive (D-03) supports the bump.
- **Anti-wire test uses regex `/\basync\s/`** (not substring scan for the suspending keyword). RESEARCH § 8 Pitfall 4 explicitly recommends this — substring scan false-positives on JSDoc comments mentioning the word; the regex requires the keyword to be followed by whitespace (a function-declaration position).
- **Docstring de-collision applied PROACTIVELY (Phase 39 lesson — "engagement-service docstring de-collision proactive Rule 2 fix").** The leaf header originally listed forbidden patterns verbatim. These would have false-positively matched the plan's `! grep -q '\basync\b'`, `! grep -q 'chatStream|chatCompletion'`, and `! grep -q 'localStorage'` acceptance grep checks. Rephrased to surrogate language. Cost: ~3 lines of header text. Benefit: structural acceptance grep checks pass without weakening the runtime invariant test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Docstring de-collision against acceptance grep patterns**
- **Found during:** Task 1 (after writing initial source-diversity.service.ts and running the acceptance grep checks)
- **Issue:** The leaf header's "sync-only invariant" docstring section originally listed forbidden patterns verbatim ("No `await`, no `fetch`, no `chatStream`, no `chatCompletion`, no I/O" + "No `async` keyword anywhere" + "No localStorage"). These literal substrings caused the plan's structural acceptance criteria to fail: `! grep -q '\basync\b'` matched the comment text, `! grep -q 'chatStream|chatCompletion'` matched the comment text, `! grep -q 'localStorage'` matched the comment text. Initial grep counts: async=2, chatStream/chatCompletion=1, localStorage=1.
- **Fix:** Rephrased the docstring sync-only-invariant section to surrogate language: "No deferred-execution function declarations" instead of "No async", "no suspending expression" instead of "no await", "no LLM call" instead of "no chatStream/chatCompletion", "no browser-storage read or write" instead of "no localStorage".
- **Files modified:** `app/src/services/source-diversity.service.ts` (lines 31-46 — docstring section only; no code change)
- **Verification:** Re-ran grep checks; all 5 forbidden-pattern counts now 0. Re-ran tsc; still exit 0. Re-ran behavioral test suite; still 16/16 pass. Re-ran anti-wire test; still 4/4 pass.
- **Committed in:** `934343a3` (Task 1 commit — folded into the initial source-diversity.service.ts ship; never landed as a separate fix-up)
- **Lesson source:** Identical to Plan 39-01 close decision "Engagement-service docstring de-collision (proactive Rule 2 fix during Task 2)". Same root cause: docstrings naming forbidden patterns trip source-reading invariants. Same fix: rephrase docstring with surrogate names.

---

**Total deviations:** 1 auto-fixed (1 missing critical — proactive docstring fix for acceptance grep compatibility)

**Impact on plan:** Fix was structural and changed only comment text. The actual code semantics, test coverage, and runtime behavior are unchanged. The runtime anti-wire assertion `/\basync\s/` would have been more permissive than the plan's structural `! grep -q '\basync\b'` — but the plan's grep is what acceptance criteria gates on, so the docstring fix was required.

## Issues Encountered

- **None.** Plan executed cleanly. All four tasks landed without blocked dependencies, missing imports, or unexpected test failures. The single auto-fix was a docstring rephrase folded into Task 1's initial commit, not a mid-execution course correction.
- **Note on parallelism:** No sibling agents are running this plan; no parallelism artifacts to report.

## User Setup Required

None — pure-logic leaf module; no external service configuration, no environment variables, no API keys, no CLI tools.

## Next Phase Readiness

Phase 41 is unblocked and may proceed in parallel-or-sequential per the v1.5 wave plan.

**Phase 41 contract — what Phase 40 ships:**
```ts
sourceDiversityService.filterForDiversity(results: WebSearchResult[], usedDomains: Set<string>): WebSearchResult[]
sourceDiversityService.recordServedDomain(anchorId: string, domain: string): void
sourceDiversityService.getUsedDomains(anchorId: string): Set<string>
sourceDiversityService.scoreSource(domain: string): number
sourceDiversityService.reset(): void

// Exported internals (D-15 — Phase 41 may use extractDomain after committing a result):
extractDomain(url: string): string | undefined
normalizeHost(hostname: string): string
MULTI_SEGMENT_TLDS: ReadonlySet<string>
DOMAIN_TIERS: Readonly<Record<string, number>>
UNKNOWN_DOMAIN_SCORE: number  // 0.5
```

**Phase 41 wiring sites (NOT Phase 40's job — explicitly out of scope):**

1. **News pre-fetch loop** at `app/src/services/concept-feed.service.ts` ~line 1293–1312:
   - Call `sourceDiversityService.getUsedDomains(a.conceptId)` → `Set<string>`
   - Pass `[...usedDomains]` to Tavily as `exclude_domains` (after Phase 41 adds `excludeDomains?` to `WebSearchOptions` in `web-search.service.ts`)
   - Widen `maxResults` from 1 to ~5
   - Call `sourceDiversityService.filterForDiversity(results.data.results, usedDomains)` on the array
   - Take `filtered[0]` as the pre-fetched result
   - Call `sourceDiversityService.recordServedDomain(a.conceptId, extractDomain(filtered[0].url))` after committing

2. **News creation loop** at `app/src/services/concept-feed.service.ts` ~line 1083–1131:
   - Same pattern as pre-fetch loop, for the non-pre-fetched path

3. **Day-boundary reset** at `app/src/services/concept-feed.service.ts:loadCache()`:
   - The existing `cached.date !== today()` branch gains `sourceDiversityService.reset()`

4. **`web-search.service.ts:WebSearchOptions`** must gain `excludeDomains?: string[]` and pass it to Tavily's `exclude_domains` field. Phase 40 explicitly did NOT modify `web-search.service.ts` — that is Phase 41's deliverable.

5. **Multi-snippet essay grounding** (Phase 41 success criterion #4) — `sources.slice(0, 3)` instead of `sources[0]` — Phase 40's `filterForDiversity` returns a re-ranked array of arbitrary length; Phase 41 decides how many to take.

6. **Citation rendering polish** (Phase 41 success criterion #5) — sup/a/section ReactMarkdown overrides — Phase 41.

**No blockers. No concerns.** Phase 40 leaf is production-ready as soon as Phase 41 wires the consumers.

## Self-Check: PASSED

Verified before close-out:

- ✓ `app/src/services/source-diversity.service.ts` exists (513 lines)
- ✓ `app/tests/services/source-diversity.service.test.mjs` exists (218 lines, 16 cases)
- ✓ `app/tests/services/source-diversity-anti-wire.test.mjs` exists (68 lines, 4 assertions)
- ✓ Commit `934343a3` exists (Task 1 — feat: leaf service)
- ✓ Commit `8e67b6e1` exists (Task 2 — test: behavioral suite)
- ✓ Commit `780c00c3` exists (Task 3 — test: anti-wire)
- ✓ tsc -b --noEmit exit 0
- ✓ test:main 603 pass / 2 fail (≥ plan lower bound 601; pre-existing carry-overs only)
- ✓ test:actions 16/16/0 unchanged
- ✓ Both new test files visible in test runner output (16 source-diversity + 4 anti-wire descriptions counted)

---

*Phase: 40-source-diversity-leaf-module*
*Plan: 01*
*Completed: 2026-05-09*
