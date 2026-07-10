---
phase: 39-engagement-service-walker-extension
plan: 01
subsystem: services

tags: [engagement, save, like, dismiss, leaf-service, localStorage, walker, derived-list, post-history, anti-wire, source-reading-invariant]

# Dependency graph
requires:
  - phase: 36-curiosity-feed-randomness-and-weights-gap-closure
    provides: derivedList walker (walkDerivedList with maxSteps Math.max(count*2, len))
  - phase: 37-i18n-leaf-module-refactor
    provides: leaf-module discipline pattern + atomic per-file commit norm + .ts extension imports
  - phase: 38-v1-4-carry-over-cleanup
    provides: youtube-no-short post-type cleanup baseline (test:main 566/564/2 + test:actions 16/16/0)
provides:
  - engagementService leaf module (save/like/dismiss/reset + getPinnedIds)
  - walkDerivedList(count, exploredIds, dismissedIds) — required positional 3rd arg per D-07
  - ANCHOR_DISMISSED + ENGAGEMENT_CHANGED event types in AppEvent union
  - source-reading anti-wire invariant test (D-06 static half) + behavioral half
  - cross-module pin-against-purge wire (post-history → engagement → saved/liked IDs)
affects:
  - phase 41 (pipeline + essay depth — walker dismiss-skip exercised end-to-end via refillQueue cycle)
  - phase 43 (engagement UI — long-press menus, action rows, "Saved" view, Force-New-Day reset wiring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf service with cross-day persistence (no date-keyed reset, unlike daily-read.service.ts)"
    - "Source-reading anti-wire invariant: 800-char window co-emit scan + counterweight assertion"
    - "Required positional arg (not defaulted) to force explicit caller opt-in to new behavior"

key-files:
  created:
    - app/src/services/engagement.service.ts
    - app/tests/services/engagement.service.test.mjs
    - app/tests/services/engagement-anti-wire.test.mjs
  modified:
    - app/src/types/index.ts
    - app/src/services/post-queue.service.ts
    - app/src/services/concept-feed.service.ts
    - app/src/services/post-history.service.ts
    - app/tests/services/derived-list.test.mjs
    - app/tests/services/refill-queue-integration.test.mjs

key-decisions:
  - "Storage key `trellis_engagement_v1` locked verbatim (`_v1` suffix unusual but mandated by ROADMAP success criterion #1; not normalized away)."
  - "ID-only storage with snapshot resolution via postHistoryService at read time (D-03) — avoids duplicating snapshot data and risk of drift if post is updated post-save."
  - "Pin saved/liked posts against post-history retention purge via `getPinnedIds()` (D-04) — single-line filter predicate extension keeps cross-module coupling minimal; ESM cycle is value-level only (both sides defer the cross-import to call-time)."
  - "Two events with payload-discriminated kind (D-05): ANCHOR_DISMISSED for walker subscriber + ENGAGEMENT_CHANGED { kind } for UI subscribers. Mirrors GRAPH_UPDATED { kind } precedent in CLAUDE.md."
  - "dismissAnchor emits ONLY ANCHOR_DISMISSED; undismissAnchor emits ONLY ENGAGEMENT_CHANGED kind:'undismiss'. Asymmetric by design: walker only needs the dismiss signal."
  - "Defense-in-depth anti-wire (D-06): static 800-char window source scan + behavioral event-bus capture both enforce no co-emit of ANCHOR_DISMISSED + CONCEPT_EXPLORED. Static catches unreachable code paths; behavioral catches runtime composition (e.g., a helper that calls markExplored)."
  - "walkDerivedList third arg is REQUIRED positional, NOT defaulted (D-07). Defaulting to new Set() would let new callers silently bypass dismiss-skip; required arg forces explicit consideration. Cost: one line at the single existing caller."
  - "reset() emits NOTHING (D-08). Wholesale wipe is not a per-id change; UI consumers re-read on Force-New-Day rather than chase per-action events."
  - "Phase 36 GAP-B math (`Math.max(count * 2, len)`) preserved verbatim in walker — load-bearing per CLAUDE.md; the inline comment block was untouched."
  - "Engagement-service docstrings rephrased to surrogate naming ('anchor-dismiss event' / 'engagement-change event') to avoid the source-reading anti-wire test (Task 4) false-positiving on docstring substrings."
  - "Phase 39 D-07 inline comment trimmed from 6 lines to 3 lines in concept-feed.service.ts to keep the hasImageGenKey assignment within the 6000-char window read by image-gen-key-gate.test.mjs (regression caught during Task 8 full-suite run)."

patterns-established:
  - "Anti-wire defense-in-depth pair: behavioral test (event-bus capture) + source-reading test (windowed regex with counterweight). Pattern reusable for other 'one signal per semantic event' invariants."
  - "Leaf service with cross-day persistence: omit `date` field from EngagementState; loadState performs no date-mismatch reset. Mirrors daily-read.service.ts shape but with explicit cross-day semantics."
  - "Cross-module value-level cycle is acceptable when both sides defer the cross-import to call-time. engagement.service.ts ↔ post-history.service.ts is the canonical example: getSavedPosts and purgeExpired both invoke the other side at call time, never at module-init."

requirements-completed:
  - ENGAGE-01
  - ENGAGE-02
  - ENGAGE-03

# Metrics
duration: 17min
completed: 2026-05-09
---

# Phase 39 Plan 01: Engagement Service + Walker Extension Summary

**Local-first engagement leaf service (save/like/dismiss) backed by `trellis_engagement_v1` localStorage, plus walkDerivedList signature extended with required positional dismissedIds for lazy dismiss-skip in the concept-feed pipeline.**

## Performance

- **Duration:** ~17 min (991 seconds)
- **Started:** 2026-05-09T09:37:33Z
- **Completed:** 2026-05-09T09:54:04Z
- **Tasks:** 8 / 8 complete
- **Files modified:** 7 (3 new + 4 modified)
- **Commits:** 8 atomic per-task commits + plan-metadata commit

## Accomplishments

- engagementService leaf module shipped with full API: savePost / removeSavedPost / isSaved / getSavedPostIds / getSavedPosts, likePost / unlikePost / isLiked / getLikedPostIds / getLikedPosts, dismissAnchor / undismissAnchor / isDismissed / getDismissedAnchorIds, getPinnedIds (saved ∪ liked), reset.
- walkDerivedList signature extended to `(count, exploredIds, dismissedIds)` — required positional, NOT defaulted — with predicate ANDing both sets and Phase 36 GAP-B `Math.max(count * 2, len)` math preserved verbatim.
- Anti-wire invariant locked in two ways: behavioral test asserts dismissAnchor emits exactly 1 ANCHOR_DISMISSED + 0 ENGAGEMENT_CHANGED + 0 CONCEPT_EXPLORED on a captured event-bus log; source-reading test scans every .ts/.tsx under app/src/ for the two emit substrings within an 800-char window and fails with offset diagnostics on co-emission.
- Cross-module pin: post-history.service.ts purgeExpired now skips posts in `engagementService.getPinnedIds()` so saved/liked posts survive past retentionDays.
- Test baseline: test:main 583 pass / 2 fail (only the two pre-existing carry-overs from Phase 38 — `tests/concept-feed.test.mjs` ERR_MODULE_NOT_FOUND and `getVineColor` date assertion); test:actions 16/16/0; tsc -b --noEmit exits 0. Pass count exceeds the plan's expected lower bound of 582.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend AppEvent union** — `7dc20dac` (feat)
2. **Task 2: Implement engagement.service.ts** — `84ed50d2` (feat)
3. **Task 3: Behavioral test suite (D-06 behavioral half)** — `c332ba82` (test)
4. **Task 4: Source-reading anti-wire test (D-06 static half)** — `ab56005e` (test)
5. **Task 5: Extend walkDerivedList + update existing derived-list tests** — `6b4d40da` (feat)
6. **Task 6: Update sole walker caller in concept-feed.service.ts** — `040a865d` (feat)
7. **Task 7: Pin saved/liked against retention purge (D-04)** — `aca300b8` (feat)
8. **Task 8: Full-suite green check + auto-fix walker-signature regressions** — `d15fc16f` (fix)

## Files Created/Modified

**Created:**
- `app/src/services/engagement.service.ts` — Leaf service (210 lines) with full save/like/dismiss API + getPinnedIds + reset; STORAGE_KEY = 'trellis_engagement_v1'; resolves saved/liked DailyPost objects through postHistoryService at read time.
- `app/tests/services/engagement.service.test.mjs` — 13 behavioral test cases covering round-trip, idempotency, event emissions, getPinnedIds union, graceful degradation on missing posts, raw JSON shape, reset() (D-08), corrupted JSON handling. Case 6 is the D-06 BEHAVIORAL HALF.
- `app/tests/services/engagement-anti-wire.test.mjs` — 2 test cases: counterweight (engagement.service.ts is in scan AND emits ANCHOR_DISMISSED at least once) + 800-char-window co-emit scan across all .ts/.tsx files under app/src/.

**Modified:**
- `app/src/types/index.ts` — AppEvent union gains ANCHOR_DISMISSED + ENGAGEMENT_CHANGED { kind } members adjacent to CONCEPT_EXPLORED.
- `app/src/services/post-queue.service.ts` — walkDerivedList signature extended with required positional `dismissedIds: Set<string>`; predicate ANDs both sets; Phase 36 GAP-B math + comment block preserved verbatim; new Phase 39 D-07 marker comment added.
- `app/src/services/concept-feed.service.ts` — engagementService import (with .ts extension); sole walker caller passes `new Set(engagementService.getDismissedAnchorIds())` as third arg; existing comment block extended with one-line Phase 39 D-07 reference.
- `app/src/services/post-history.service.ts` — engagementService import; purgeExpired filter predicate extended to `pinned.has(p.id) || p.generatedAt > cutoff`; Phase 39 D-04 marker comment added.
- `app/tests/services/derived-list.test.mjs` — 8 existing walkDerivedList calls updated with empty third arg (preserves semantics); 4 new dismiss-skip test cases added under a new describe block (lazy-skip while honoring count + cyclePosition advances; lazy-skip both explored+dismissed; returns [] when all dismissed; Phase 36 GAP-B preserved at N=16 with 1 dismissed on 4-entry list).
- `app/tests/services/refill-queue-integration.test.mjs` — 5 walkDerivedList call sites updated with empty third arg (Task 8 auto-fix).

## Decisions Made

See frontmatter `key-decisions:` section above. The notable in-execution decisions (not pre-locked by CONTEXT.md):

- **Engagement-service docstring rephrasing.** The Task 4 source-reading anti-wire test would falsely flag the engagement.service.ts docstring as a co-emit if it literally mentioned both `ANCHOR_DISMISSED` and `CONCEPT_EXPLORED` in the same window. Chose to rephrase docstrings to surrogate names (`anchor-dismiss event` / `explored-anchor signal` / `engagement-change event`) over weakening the test regex. Single literal occurrence of `ANCHOR_DISMISSED` is the single emit site; zero `CONCEPT_EXPLORED` occurrences in the file. Preserves both the static invariant AND the documentation intent.
- **Phase 39 D-07 comment trim in concept-feed.service.ts.** Original 6-line comment block pushed `hasImageGenKey: imageGenEnabled && (nanoBananaKeyPresent || geminiImageKeyPresent)` past the 6000-char window read by `tests/services/image-gen-key-gate.test.mjs`. Trimmed to 3-line block while preserving the Phase 39 D-07 marker token. This is structurally equivalent to the Phase 38 SUMMARY's note about source-reading-window fragility; future test-infrastructure improvement could widen the test window.
- **Variable form `pinned.has(p.id)` vs inline form.** Plan acceptance criteria lists both grep patterns; chose the variable form for readability. The inline-strict regex grep returns 0; the alternate `pinned.has\|pinned = engagementService.getPinnedIds` grep returns 2 (≥2 required). Both forms are explicitly accepted in the acceptance criteria.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Updated 4 walkDerivedList call sites in refill-queue-integration.test.mjs**
- **Found during:** Task 8 (full-suite green check)
- **Issue:** My Task 5 walker signature change broke 4 tests in `tests/services/refill-queue-integration.test.mjs` because they were passing only 2 arguments. The plan listed only `derived-list.test.mjs` as needing the third-arg update, but `refill-queue-integration.test.mjs` also calls `walkDerivedList` (a Phase 36 GAP-1..4 composition smoke test — the planner could not have known about it without exhaustively scanning `tests/`).
- **Fix:** Added `, new Set()` as the third arg to all 5 walkDerivedList calls in that file (4 inside test cases, plus 1 inside the GAP-2 cyclePosition test that was already breaking).
- **Files modified:** `app/tests/services/refill-queue-integration.test.mjs`
- **Verification:** `node --test tests/services/refill-queue-integration.test.mjs` → 7/7 pass.
- **Committed in:** `d15fc16f` (Task 8 commit).

**2. [Rule 1 — Bug] Trimmed Phase 39 D-07 comment block in concept-feed.service.ts**
- **Found during:** Task 8 (full-suite green check)
- **Issue:** My added 6-line Phase 39 D-07 comment block immediately above the walkDerivedList call pushed the `hasImageGenKey` assignment line from offset ~5016 (pre-Phase-39) to offset ~5274 (with the full-RHS assignment now extending past the 6000-char window). `tests/services/image-gen-key-gate.test.mjs:22` reads source within a 6000-char window starting at `export async function refillQueue` and matches a regex requiring the full RHS — so the regex no longer matched. The test was also failing on the post-Plan-39 state seen during Task 8's first run (visible in the 6-failure delta vs 2-failure pre-baseline).
- **Fix:** Collapsed the Phase 39 D-07 comment from 2 lines (separator + 2 content lines) to 3 lines that integrate the dismiss-skip semantic into the existing comment block as a continuation of the explored-skip description. Phase 39 D-07 marker token preserved verbatim. Distance now ~5196 (within window).
- **Files modified:** `app/src/services/concept-feed.service.ts`
- **Verification:** `node --test tests/services/image-gen-key-gate.test.mjs` → 2/2 pass; `grep -c "Phase 39 D-07" app/src/services/concept-feed.service.ts` returns 1.
- **Committed in:** `d15fc16f` (Task 8 commit).

**3. [Rule 2 — Missing Critical] Engagement-service docstring de-collision (proactive)**
- **Found during:** Task 2 (Implement engagement.service.ts) — caught BEFORE the first commit, while writing the file.
- **Issue:** Original docstring directly named `ANCHOR_DISMISSED`, `ENGAGEMENT_CHANGED`, and `CONCEPT_EXPLORED` in the leading file comment block AND in two method docstrings. The static anti-wire test (Task 4) would falsely flag the file as a co-emit because the 800-char window walking from a single `ANCHOR_DISMISSED` mention would catch the `CONCEPT_EXPLORED` mention 4 lines below. Also: acceptance criteria specified ANCHOR_DISMISSED count = 1 (single emit site) and CONCEPT_EXPLORED count = 0; original docstring violated both.
- **Fix:** Rephrased all docstring references to surrogate names ("anchor-dismiss event" / "engagement-change event" / "explored-anchor signal"). Single literal `ANCHOR_DISMISSED` occurrence is the emit site; ENGAGEMENT_CHANGED count is exactly 5 (one per emit site); CONCEPT_EXPLORED count is 0.
- **Files modified:** `app/src/services/engagement.service.ts` (3 docstring blocks)
- **Verification:** `grep -c` confirms 1 / 5 / 0 counts; Task 4's anti-wire test passes; manual sanity-check (temporarily injecting a co-emit) confirms the test correctly fails with offset diagnostics, then reverted.
- **Committed in:** `84ed50d2` (Task 2 commit, no separate fix commit needed because de-collision happened pre-commit).

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical, 1 Rule 3 blocking)
**Impact on plan:** All three deviations addressed test infrastructure side-effects of Phase 39's intentional changes. None introduced scope creep; none changed the engagement-service contract or walker semantics. The Task 4 false-positive risk had been documented in the plan's `<read_first>` section pointing at the leaf-shim docstring de-collision precedent from Plan 37-03 SUMMARY Deviation 2; my Task 2 de-collision applies the same lesson proactively. The Task 8 fixes addressed regressions caused directly by my walker signature change and my comment additions; both restored the test:main pass count to 583 (≥ plan's 582 lower bound).

## Issues Encountered

- ESM cycle warning was a non-issue: `engagementService` imports `postHistoryService` (Task 2) and `postHistoryService` imports `engagementService` (Task 7). Both sides only INVOKE the cross-import at function-call time (getSavedPosts / getLikedPosts / purgeExpired), never at module-init time. tsc -b --noEmit exits 0; engagement.service.test.mjs runs cleanly. Captured as a `patterns-established` entry for future reference.
- Test infrastructure fragility surfaced (image-gen-key-gate's 6000-char window) — see Deviation 2 above. Same class as the leaf-shim docstring de-collision in Plan 37-03 (regex-based source-reading tests can be brittle to surrounding code growth). Recommend a Phase 45 or future hygiene phase widen these windows or adopt anchor-pair extraction (the Plan 36-13/14 meta-rule pattern).

## User Setup Required

None — all changes are local-first / runtime-only.

## Next Phase Readiness

- **Phase 41 (pipeline + essay depth):** dismiss-skip is now wired end-to-end through the refillQueue cycle. Phase 41 can write an integration test exercising `dismissAnchor` → `walkDerivedList` → `refillQueue` to validate that dismissed anchors disappear from the live feed.
- **Phase 43 (engagement UI):** the API surface is complete. Phase 43 owns the SettingsDataScreen Force-New-Day reset() call site, UI subscriber wiring (long-press menus, action rows), and the future "Saved" view. The `subscribeEngagement(handler)` convenience helper is intentionally NOT shipped — defer to Phase 43 if duplicate-subscribe boilerplate (ANCHOR_DISMISSED + ENGAGEMENT_CHANGED) proves annoying in practice.
- **Phase 44/45 (deps + code quality):** consider widening test infrastructure source-reading windows (image-gen-key-gate's 6000-char window, useQuestions-system-prompt-stability's 200-char windows) or adopting anchor-pair extraction so adjacent code growth doesn't trip these tests.

## Self-Check: PASSED

**Files verified:**
- FOUND: app/src/services/engagement.service.ts
- FOUND: app/tests/services/engagement.service.test.mjs
- FOUND: app/tests/services/engagement-anti-wire.test.mjs

**Commits verified:** All 8 task commits present in `git log` — `7dc20dac, 84ed50d2, c332ba82, ab56005e, 6b4d40da, 040a865d, aca300b8, d15fc16f`.

**Test baselines verified:**
- tsc -b --noEmit exits 0
- test:main: 583 pass / 2 fail (≥ plan's 582 pass lower bound; both fails are pre-existing carry-overs)
- test:actions: 16 pass / 0 fail (matches required 16/16/0)

**Stub scan:** No new stubs introduced. engagementService.getSavedPosts / getLikedPosts gracefully return fewer items than the corresponding ID list when post-history is missing entries — this is the documented D-04 graceful-degradation behavior, NOT a stub. No hardcoded empty arrays flow to UI rendering (no UI in this phase).

---

*Phase: 39-engagement-service-walker-extension*
*Completed: 2026-05-09*
