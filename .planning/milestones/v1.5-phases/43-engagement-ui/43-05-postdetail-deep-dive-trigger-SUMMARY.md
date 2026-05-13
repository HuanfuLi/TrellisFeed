---
phase: 43-engagement-ui
plan: 05
subsystem: ui
tags: [react, deep-dive, abort-controller, streaming, segmented-control, post-detail]

# Dependency graph
requires:
  - phase: 41-pipeline-wiring-essay-depth
    provides: "EssayOptions.depth knob + bodyMarkdownDeep schema-additive field on EssayContent/PostSnapshot + depth-aware patchPostEssayInCache + 3 pre-call guard + 4 signal-arg AbortController contract at PostDetailScreen.tsx:313-350"
  - phase: 43-engagement-ui
    provides: "Wave-0 test scaffolds + posts.detail.deepDive.{cta,restoreStandard,toggleStandard,toggleDeep,streamingLabel} i18n keys across 4 locales (shipped by 43-01)"
provides:
  - "User-facing Deep Dive button on PostDetailScreen (DD-01..DD-02): full-width subtle CTA between scroll sentinel and takeaway, Sparkles icon + var(--primary-40) text"
  - "Replace-in-place deep-stream UX (DD-03): streaming body slot swaps to streamingDeep, Restore Standard link aborts + reverts activeVariant"
  - "Standard | Deep segmented toggle (DD-04): replaces button slot once post.bodyMarkdownDeep cached; pure client-side state, no re-stream"
  - "Dedicated deepAbortControllerRef extending DD-05 AbortController contract: 16 pre-call guards (was 3), 6 signal-arg passes (was 4), cache-write guard preserved across both standard + deep paths"
  - "Three source-reading invariant test files locking the three behavior surfaces (deep-dive-trigger / segmented-toggle / abort-contract)"
affects: [43-06-homescreen-wiring, 43-07-force-new-day-engagement-reset, 43-08-phase-close-out, future-phases-touching-PostDetailScreen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedicated AbortController per logical stream (Pitfall 3): each independently-cancellable streaming flow owns its own ref; cleanup cascade aborts all controllers"
    - "Defer-to-streamer + cache-write guard: cache patch only fires when !aborted, guaranteeing bodyMarkdownDeep is NEVER written from partial/aborted stream"
    - "Replace-in-place body slot variant rendering: activeVariant + isStreamingDeep flags compose into a 4-way branch (error / streaming-deep / cached-deep / standard)"
    - "Failure attribution via dedicated test files per VALIDATION line 53: DD-04 segmented-toggle and DD-01..DD-03 deep-dive-trigger separated so a regression in one surface fails exactly one file"

key-files:
  created:
    - "app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs (filled from Wave 0 scaffold — 5 DD-01..DD-03 assertions)"
    - "app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs (filled from Wave 0 scaffold — 7 DD-04 assertions)"
    - "app/tests/screens/PostDetailScreen.abort-contract.test.mjs (filled from Wave 0 scaffold — 7 DD-05 assertions)"
  modified:
    - "app/src/screens/PostDetailScreen.tsx (+208 LOC: new state slots, handleStartDeepDive, handleRestoreStandard, renderDeepDiveControls, body-slot 4-way branch, cleanup cascade extension, Sparkles icon import)"

key-decisions:
  - "handleStartDeepDive owns a NEW dedicated AbortController stored on deepAbortControllerRef — RESEARCH Pitfall 3 (reusing on-enter controller would immediately bail after unmount/postId-change aborted it)"
  - "Cache-write guard pattern (DD-05): patchPostEssayInCache only fires when !ctrl.signal.aborted — bodyMarkdownDeep cache is NEVER written from a partial stream, even on rapid Restore Standard taps mid-stream"
  - "Body slot extended to a 4-way conditional (error / streaming-deep / cached-deep / standard) instead of factoring a sub-component — keeps the diff additive and preserves Phase 41 + Phase 36 GAP-C render branches verbatim"
  - "renderDeepDiveControls placed AFTER the scroll sentinel JSX (between sentinel and takeaway) per DD-01 — natural reading endpoint, doesn't compete with takeaway hierarchy"
  - "Cleanup useEffect's return function aborts BOTH controllers (existing abortController + new deepAbortControllerRef.current) on unmount and postId change — prevents in-flight deep stream from patching cache for a post the user has navigated away from"
  - "setDeepError currently destructured as [, setDeepError] — error state captured but not yet rendered; UI parity with onEnterError reserved for follow-up phase if needed (kept minimal per plan; deepError doesn't appear in the success criteria)"

patterns-established:
  - "Multi-controller cleanup cascade: when a screen owns multiple in-flight streams, the unmount/postId-change cleanup must abort EVERY controller; pattern is `abortController.abort(); deepAbortControllerRef.current?.abort();` in the same return-from-useEffect block"
  - "Source-reading anti-regression count assertions: pre-call guard counts and signal-arg pass counts are floor-asserted (≥4 / ≥5) rather than exact-matched, so additive future work can extend without breaking the test (CLAUDE.md #1 — tests guard live code path, not aspirational shape)"
  - "Dedicated test file per DD sub-decision (VALIDATION.md line 53 pattern) — DD-04 in segmented-toggle.test.mjs, DD-01..DD-03 in deep-dive-trigger.test.mjs, DD-05 in abort-contract.test.mjs — clear failure attribution at test-run time"

requirements-completed: [CONTENT-01]

# Metrics
duration: 5min
completed: 2026-05-11
---

# Phase 43 Plan 43-05: PostDetail Deep Dive Trigger Summary

**Deep Dive button + Restore Standard streaming UX + Standard|Deep segmented toggle on PostDetailScreen, backed by a dedicated deepAbortControllerRef extending the Phase 41-02 AbortController contract from 3 pre-call guards / 4 signal-arg passes to 16 / 6.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-11T07:57:08Z
- **Completed:** 2026-05-11T08:01:29Z
- **Tasks:** 4
- **Files modified:** 4 (1 source, 3 test files)
- **LOC delta:** +208 source / +192 test (4 commits)

## Accomplishments

- **DD-01..DD-02 — Deep Dive button** rendered between scroll sentinel and takeaway (`PostDetailScreen.tsx` line ~860 in the updated file). Full-width, Sparkles icon, `var(--primary-40)` text, `t('posts.detail.deepDive.cta')` label.
- **DD-03 — Replace-in-place streaming**: tap kicks off a new dedicated `AbortController` stored on `deepAbortControllerRef`, calls `generatePostEssay(post, questions, { depth: 'deep', signal: ctrl.signal })`, accumulates into `streamingDeep` state (post.bodyMarkdown untouched). During stream, a small Restore Standard link appears that aborts the deep controller + reverts `activeVariant` to `'standard'`.
- **DD-04 — Standard | Deep segmented control** replaces the button slot once `post.bodyMarkdownDeep` is non-empty. Pure client-side toggle: `onClick={() => setActiveVariant(variant)}` — no `handleStartDeepDive` or `generatePostEssay` call. Active segment renders `var(--primary-40)` background + `#FFFFFF` text + `aria-selected={isActive}` + `minHeight: 44px` (WCAG 2.5.8).
- **DD-05 — AbortController contract preserved + extended.** Final counts in `PostDetailScreen.tsx`:
  - **Pre-call AbortController guards: 16** (was 3 in Phase 41 — Phase 41's three call sites each have a guard before for-await AND inside the loop; the new deep handler adds two more; total reads via regex hits the upper bound, well above the ≥4 floor required)
  - **Signal-arg passes: 6** (was 4 — added `signal: ctrl.signal` on the deep `generatePostEssay` call; `signal: abortController.signal` retained on 4 existing call sites; one extra match from the deep handler's pre-call guard documentation comment)
  - **`patchPostEssayInCache` invocations: 2** (standard at line ~395, deep at line ~566 — both guarded by `!signal.aborted` pre-write)
  - **Cleanup cascade**: unmount + postId change abort BOTH controllers via `abortController.abort(); deepAbortControllerRef.current?.abort();`
- **Three source-reading invariant test files** lock the three behavior surfaces:
  - `PostDetailScreen.deep-dive-trigger.test.mjs` — 5 tests (DD-01..DD-03)
  - `PostDetailScreen.segmented-toggle.test.mjs` — 7 tests (DD-04, dedicated file per VALIDATION.md line 53)
  - `PostDetailScreen.abort-contract.test.mjs` — 7 tests (DD-05)
  - **All 19 new tests pass; all 20 pre-existing PostDetailScreen tests pass; all 17 post-essay tests pass; `tsc -b --noEmit` clean; `npm run build` succeeds.**

## Task Commits

Each task was committed atomically:

1. **Task 1: Source — Deep Dive state + handlers + AbortController + body-slot extension** — `be0a1585` (feat)
2. **Task 2: Fill DD-01..DD-03 deep-dive-trigger.test.mjs** — `1735be2d` (test)
3. **Task 3: Fill DD-05 abort-contract.test.mjs** — `217b21d8` (test)
4. **Task 4: Fill DD-04 segmented-toggle.test.mjs (dedicated file per VALIDATION line 53)** — `f2d131ad` (test)

## Files Created/Modified

- **`app/src/screens/PostDetailScreen.tsx`** — added `Sparkles` to lucide import; added 5 state slots (`streamingDeep`, `isStreamingDeep`, `setDeepError`, `activeVariant`, `deepAbortControllerRef`); added `handleStartDeepDive` + `handleRestoreStandard` + `renderDeepDiveControls`; extended on-enter cleanup return-block to abort the deep controller; extended body-slot conditional to 4-way (error / streaming-deep / cached-deep / standard); inserted `renderDeepDiveControls()` call after `scrollSentinelRef` JSX and before the takeaway block.
- **`app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs`** — replaced Wave-0 skip-stub with 5 DD-01..DD-03 assertions (slot position relative to sentinel/takeaway; CTA i18n key + Sparkles + primary-40; streamingDeep separate state; handleRestoreStandard aborts + flips variant; deep handler never assigns post.bodyMarkdown directly).
- **`app/tests/screens/PostDetailScreen.segmented-toggle.test.mjs`** — replaced Wave-0 skip-stub with 7 DD-04 assertions (gate on bodyMarkdownDeep length > 0; pure setActiveVariant onClick; negative-grep on handleStartDeepDive + generatePostEssay inside the segmented branch; UI-SPEC §9 active visual; i18n keys referenced exactly once each; minHeight 44px touch-target floor).
- **`app/tests/screens/PostDetailScreen.abort-contract.test.mjs`** — replaced Wave-0 skip-stub with 7 DD-05 assertions (≥4 pre-call guards; ≥5 signal-arg passes; deep generatePostEssay invocation shape; bodyMarkdownDeep cache-write guard inside deep handler; cleanup aborts both controllers; abort() invocation lower bound ≥3; deep handler scoped via useCallback anchor to avoid false-positives from skeleton-post `bodyMarkdown: ''` literals).

## Decisions Made

- **Dedicated `deepAbortControllerRef` over reuse** — Pitfall 3: if we reused the on-enter `abortController`, the unmount-cleanup `.abort()` already fired by the time the user taps Deep Dive (because the on-enter effect's cleanup runs whenever `post?.bodyMarkdown` changes, and once the on-enter stream patches the cache, that dep changes). A separate ref guarantees the deep stream gets a fresh, unaborted controller every tap.
- **Test anchor on `useCallback` declaration, not bare identifier** — the abort-contract test's `bodyMarkdown:` negative-grep initially failed because `src.indexOf('handleStartDeepDive')` matched the JSDoc comment occurrence first (line ~519), and `indexOf('handleRestoreStandard')` matched its JSDoc occurrence too — slicing too wide and including the skeleton-post `bodyMarkdown: ''` literals from the post-loading useEffect. Anchored on `handleStartDeepDive = useCallback` / `handleRestoreStandard = useCallback` to scope the region to the actual handler body. (Minor implementation correction during Task 3 verification; documented in the test file's anchor comment.)
- **`setDeepError` kept but unused on render path** — the plan called for `deepError` state with future error-toast surfacing. Currently destructured as `[, setDeepError]` (state slot exists but no consumer reads it). Deferred: error-UI parity with the existing `onEnterError` retry surface is a follow-up if device UAT shows partial-stream errors are user-visible. Tests don't assert error-surface behavior, so this stays minimal.
- **Body-slot extended in-place, not refactored to sub-component** — kept the diff strictly additive. The existing 3-way branch (error / streaming / standard) became a 5-way branch (error / streaming-on-enter / streaming-deep / cached-deep / standard) by inserting two new conditionals before the existing standard `post.bodyMarkdown ?` branch. No prop-drilling, no break of the Phase 41-02 isNews font-family hand-off.
- **Bottom (insertion point) for renderDeepDiveControls is BELOW the scroll-sentinel JSX** — DD-01 says "between essay body and takeaway." The sentinel is conceptually part of the essay-body region (it's the 70%-read detector). Placing controls after the sentinel JSX and before the takeaway block satisfies the verbatim DD-01 spec AND avoids any interaction with the IntersectionObserver detector logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test region anchor false-positive on JSDoc occurrences**

- **Found during:** Task 3 verification (abort-contract test initial run)
- **Issue:** The DD-05 "deep-stream never overwrites post.bodyMarkdown" test used `src.indexOf('handleStartDeepDive')` and `src.indexOf('handleRestoreStandard')` to slice the deep handler region. Both `indexOf` calls matched the JSDoc comment occurrences (above the actual `useCallback` declarations), so the slice spanned ~10KB of unrelated source code — including the post-loading `useEffect` that legitimately constructs `DailyPost` skeletons with `bodyMarkdown: ''` literals. The negative-grep `assert.doesNotMatch(..., /bodyMarkdown:\s*[^D]/)` failed on `bodyMarkdown: '',` from the connection skeleton.
- **Fix:** Anchored the region on `handleStartDeepDive = useCallback` / `handleRestoreStandard = useCallback` (the actual declarations) rather than the bare identifiers. Region now correctly spans only the handler body.
- **Files modified:** `app/tests/screens/PostDetailScreen.abort-contract.test.mjs`
- **Verification:** All 7 abort-contract tests now pass.
- **Committed in:** `217b21d8` (Task 3 commit — fix applied before commit)

---

**Total deviations:** 1 auto-fixed (1 blocking test scaffold issue)
**Impact on plan:** Cosmetic test-authoring correction during initial run; no scope creep, no source-code changes triggered by the deviation. The negative invariant is now correctly scoped.

## Issues Encountered

- **No production-code issues encountered.** TypeScript clean throughout, no runtime errors in build, no regression in pre-existing PostDetailScreen tests (20 pass) or post-essay tests (17 pass).
- The test-anchor false-positive (above) was caught during Task 3 verification and corrected before commit — standard self-check loop.

## User Setup Required

None — no external service configuration required. Deep Dive uses the existing LLM provider configured in Settings.

## Next Phase Readiness

**Ready for 43-06 (HomeScreen wiring) + 43-07 (Force-New-Day engagement reset) + 43-08 (phase close-out)** — these three remaining Phase 43 plans are parallel-safe with 43-05 (separate file surfaces):
- 43-06 touches `HomeScreen.tsx` (Bookmark header icon → `/saved` + ANCHOR_DISMISSED re-sync)
- 43-07 touches `SettingsDataScreen.tsx` (engagementService.reset() in handleForceNewDay)
- 43-08 closes the phase (REQUIREMENTS.md flips, ROADMAP updates, PROJECT.md evolve)

**Deep-dive UI is feature-complete for v1.5.** Future polish (if device UAT surfaces issues):
- Surface `deepError` via toast or inline retry button (currently captured but not rendered)
- Add a small inline progress indicator during deep streaming (currently the body-slot skeleton handles warm-up; no progress for in-flight chunks)
- Consider scroll-position preservation across activeVariant toggles (currently the body re-renders at natural scroll position; UI-SPEC didn't specify behavior)

**CLAUDE.md update candidate (post-43-08):** Add a load-bearing section documenting the multi-controller cleanup cascade pattern + DD-05 cache-write guard for future maintainers touching streaming flows in PostDetailScreen.

## Self-Check: PASSED

- `app/src/screens/PostDetailScreen.tsx` exists at expected path with all 11 acceptance-criteria identifiers present (deepAbortControllerRef ×6, handleStartDeepDive ×3, handleRestoreStandard ×2, renderDeepDiveControls ×3, depth: 'deep' ×2, bodyMarkdownDeep ×7, activeVariant ×3, posts.detail.deepDive.cta ×1, posts.detail.deepDive.restoreStandard ×1, posts.detail.deepDive.toggleStandard ×1, posts.detail.deepDive.toggleDeep ×1, Sparkles ×2)
- All 4 task commits exist in git log: `be0a1585`, `1735be2d`, `217b21d8`, `f2d131ad`
- All 3 test files exit 0 (19 tests pass)
- `tsc -b --noEmit` exits 0
- `npm run build` exits 0
- Pre-existing PostDetailScreen tests not regressed (20/20 pass)
- Pre-existing post-essay tests not regressed (17/17 pass)

---
*Phase: 43-engagement-ui*
*Completed: 2026-05-11*
