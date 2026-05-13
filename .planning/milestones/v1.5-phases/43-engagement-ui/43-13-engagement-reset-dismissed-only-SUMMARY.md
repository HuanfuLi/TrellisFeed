---
phase: 43-engagement-ui
plan: 13
plan_id: 43-13
slug: engagement-reset-dismissed-only
subsystem: engagement
tags: [engagement, force-new-day, persistent-archives, gap-closure, source-reading-tests]

# Dependency graph
requires:
  - phase: 43-07
    provides: handleForceNewDay wiring + SC-6 source-reading test scaffold (the wholesale-wipe call site that 43-13 surgically corrects)
  - phase: 39
    provides: engagementService surface (savePost/likePost/dismissAnchor + ENGAGEMENT_CHANGED event-bus contract that resetDismissedOnly extends)
  - phase: 43-06
    provides: HomeScreen dual-effect canonical pattern (Effect B re-reads getDismissedAnchorIds on ENGAGEMENT_CHANGED — consumer of the new sentinel emit)
provides:
  - engagementService.resetDismissedOnly() partial-reset API (idempotent, mutates only state.dismissed, emits ENGAGEMENT_CHANGED { kind 'undismiss', id '*' })
  - SettingsDataScreen.handleForceNewDay wired to the partial reset (saved + liked persist across Force-New-Day)
  - SC-6 source-reading test renamed to track resetDismissedOnly() + new negative-invariant guarding against reset() regression inside handleForceNewDay
  - tests/services/engagement.service.reset-dismissed-only.test.mjs — 6 service-level invariants (method shape + persistence-of-archives + idempotence + reset() preservation)
affects: [43-PHASE-SUMMARY, future Force-New-Day flows, Clear-All-Data flow (unchanged), v1.5 milestone close-out]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coexisting reset variants: wholesale `reset()` for Clear-All-Data + granular `resetDismissedOnly()` for dev-affordance — two methods so callers pick the right blast radius."
    - "Sentinel id '*' on ENGAGEMENT_CHANGED for bulk-reset emits (single-event shape; no new event type introduced — preserves Phase 39 D-06 one-signal-per-semantic-event rule)."
    - "Negative-invariant source-reading test pattern: scope a regex to the function body via indexOf anchor pair, then assert.doesNotMatch the forbidden literal. Mirrors Plan 36-15 / 43-07's positive-shape pattern in inverse."

key-files:
  created:
    - app/tests/services/engagement.service.reset-dismissed-only.test.mjs
  modified:
    - app/src/services/engagement.service.ts
    - app/src/screens/settings/SettingsDataScreen.tsx
    - app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs

key-decisions:
  - "Coexist reset() + resetDismissedOnly() — wholesale wipe stays for Clear-All-Data / settingsService.reset() (legitimate full-wipe use case); partial wipe added for dev-affordance UX (preserve user archives)."
  - "Reuse ENGAGEMENT_CHANGED event with sentinel id '*' instead of introducing a bulk-reset event — preserves Phase 39 D-06 one-signal-per-semantic-event rule; existing subscribers re-read getDismissedAnchorIds() regardless of payload id."
  - "Comment in SettingsDataScreen rephrased to 'the wholesale reset method (engagementService dot reset)' instead of the literal 'engagementService.reset()' substring so the SC-6 negative-invariant test can grep the function body without false-positive matches on documentation prose."

patterns-established:
  - "Granular-vs-wholesale reset coexistence (D-08 evolution): when a dev-affordance handler wants partial reset semantics but production paths legitimately need wholesale wipe, add a peer method rather than parameterize the existing one — keeps each call site's intent legible at the call site."
  - "Plan-internal contradiction handling: when a plan's grep acceptance criterion conflicts with the comment text the plan itself specifies, fix the comment text (rephrase the literal so the grep stays satisfied) and document the deviation. The negative-invariant test is the load-bearing artifact; the plain-text comment is the explanatory artifact."

requirements-completed: [ENGAGE-02, ENGAGE-03]

# Metrics
duration: 7min
completed: 2026-05-11
---

# Phase 43 Plan 13: Engagement Reset Dismissed-Only Summary

**Force-New-Day dev affordance now resets ONLY the dismissed list; saved + liked posts persist across days as user archives per operator UAT intent.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-11T10:31:13Z
- **Completed:** 2026-05-11T10:38:00Z (approx)
- **Tasks:** 4
- **Files modified:** 4 (3 src + 1 new test file)

## Accomplishments

- Added `engagementService.resetDismissedOnly()` as a peer to existing `reset()` — idempotent partial-reset that mutates only `state.dismissed`, emits one `ENGAGEMENT_CHANGED { kind: 'undismiss', id: '*' }` sentinel event for bulk-reset signaling.
- Swapped `engagementService.reset()` → `engagementService.resetDismissedOnly()` at the Force-New-Day call site in `SettingsDataScreen.handleForceNewDay`; saved + liked archives now survive the dev affordance.
- Renamed SC-6 test assertions (2/3/4) to track the new method name; added a 5th negative-invariant test asserting `engagementService.reset()` does NOT appear in `handleForceNewDay`'s body — regression guard against re-introducing the wholesale wipe.
- Added new `tests/services/engagement.service.reset-dismissed-only.test.mjs` with 6 service-level invariants: method shape, dismissed-only mutation, archive-non-mutation, idempotence guard ordering, ENGAGEMENT_CHANGED payload shape, and reset() preservation.

## Task Commits

Each task was committed atomically (all with `--no-verify` per parallel-executor protocol):

1. **Task 1: Add `resetDismissedOnly()` to engagement.service.ts** — `644de616` (feat)
2. **Task 2: Swap reset() → resetDismissedOnly() in SettingsDataScreen + rewrite comment** — `75e2efa9` (fix)
3. **Task 3: Update SC-6 test (rename + negative-invariant)** — `44436da6` (test)
4. **Task 4: Add engagement.service.reset-dismissed-only.test.mjs (6 service-level assertions)** — `9f0116c4` (test)

_Note: Tasks 3 and 4 marked `tdd="true"` in the plan; both follow source-reading test discipline so RED→GREEN was verified by running the existing test against the post-Task-2 source (Task 3 RED before edit; GREEN after) and writing the new test directly against the post-Task-1 source (Task 4 — single GREEN commit since the contract IS the new code from Task 1)._

## Files Created/Modified

- `app/src/services/engagement.service.ts` — Added `resetDismissedOnly()` method (lines 211-236, immediately after `reset()` at lines 207-209). 27 insertions. `reset()` unchanged.
- `app/src/screens/settings/SettingsDataScreen.tsx` — Swap at line 143 (`engagementService.reset()` → `engagementService.resetDismissedOnly()`); comment block at lines 135-142 rewritten to reflect persistent-archives semantics; 8 insertions / 4 deletions.
- `app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` — Tests 2/3/4 renamed to track `resetDismissedOnly()`; Test 5 added as negative invariant against `reset()` regression; file-header comment updated to describe the 5-assertion contract. 44 insertions / 20 deletions.
- `app/tests/services/engagement.service.reset-dismissed-only.test.mjs` — NEW. 119 lines. 6 source-reading assertions against `engagement.service.ts`.

## Decisions Made

- **Coexist reset() + resetDismissedOnly() rather than parameterize a single method** — A `reset({ keepArchives: true })` signature would have made every call site's intent invisible at the call site; the peer-method approach keeps blast radius explicit. Also keeps `reset()`'s "emits NOTHING" D-08 invariant intact (the partial-reset's emit semantics differ; merging would have required conditional emit logic).
- **Sentinel `id: '*'` instead of a new event type** — Phase 39 D-06 ("one signal per semantic event") rules out a `ENGAGEMENT_RESET_BULK` event-type. The undismiss kind already exists from per-id `undismissAnchor`; the sentinel id is forward-compatible (HomeScreen Effect B re-reads `getDismissedAnchorIds()` regardless of payload id; future subscribers can discriminate on `id === '*'` if they want a bulk-aware code path).
- **Rephrase the SettingsDataScreen comment to avoid the literal `engagementService.reset()` substring** — The plan's Task 2 acceptance grep + Task 3 negative-invariant test both forbid the literal anywhere in `handleForceNewDay`'s body. The comment originally specified by the plan contained the literal; rephrasing to "the wholesale reset method (engagementService dot reset)" preserves the explanatory intent without tripping the test. Documented as a Rule-1 deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / plan-internal contradiction] Rephrased inline comment in SettingsDataScreen to avoid the forbidden literal substring**
- **Found during:** Task 2 (verification step)
- **Issue:** The plan's Task 2 specified inserting an inline comment block containing the literal `engagementService.reset()` ("Wholesale engagementService.reset() is reserved for Clear-All-Data / settingsService.reset() paths"). The plan's Task 2 acceptance grep AND the Task 3 negative-invariant test both forbid the literal `engagementService.reset()` anywhere in the function body — and the comment block is inside `handleForceNewDay`'s body. The plan-as-written would have failed its own negative invariant.
- **Fix:** Rephrased the comment text from `Wholesale engagementService.reset() is reserved for…` to `The wholesale reset method (engagementService dot reset) is reserved for…`. Same explanatory content, different literal — passes the Task 3 negative-invariant test without weakening the regex.
- **Files modified:** `app/src/screens/settings/SettingsDataScreen.tsx`
- **Verification:** `grep -nE "engagementService\.reset\(\)" src/screens/settings/SettingsDataScreen.tsx` returns no matches; Task 3's 5th test (negative invariant) passes.
- **Committed in:** `75e2efa9` (Task 2 commit; folded inline rather than a separate commit because the comment rephrase IS part of Task 2's "rewrite comment" deliverable).

---

**Total deviations:** 1 auto-fixed (1 plan-internal contradiction resolution).
**Impact on plan:** No scope creep. The fix preserved the plan's intent (call-site swap + comment block explaining the rationale + negative invariant test) while resolving an internal contradiction between the plan's prescribed comment text and the plan's prescribed acceptance test. The negative-invariant test is the load-bearing artifact; the plain-text comment is the explanatory artifact. Phase 32.1 lesson #5 ("docs in three places: CLAUDE.md, auto-memory, inline comment at the load-bearing site") preserved — the comment still references the debug file and gap-closure plan ID.

## Issues Encountered

- **Pre-existing TypeScript error in PostDetailScreen.tsx (`renderDeepDiveControls` unused) surfaced during the initial `tsc -b --noEmit` after Task 1.** Out of scope (CLAUDE.md SCOPE BOUNDARY rule: only auto-fix issues directly caused by current task's changes; this file is owned by parallel sibling executor 43-12). Confirmed resolved by sibling commit `d3f2d40e` (docs(43-12): complete deep-dive-controls-above-essay-body plan) landing between my Task 1 and final verification. Not logged to `deferred-items.md` because it was actively being worked by a sibling and resolved during this plan's execution.
- **`engagementService.reset()` literal match in comment text** — caught during Task 2 verification; resolved as the Rule-1 deviation documented above.

## User Setup Required

None — purely additive code change behind an existing dev-only UI button (Force New Day under Settings → Data → Developer, gated by `import.meta.env.DEV`). No external service configuration; no env vars; no DB migrations.

## Manual UAT (post-merge — operator)

The plan's `<verification>` block enumerates a 5-step manual UAT:

1. Save and Like several posts; dismiss several anchors.
2. Settings → Data → Force New Day.
3. Navigate to `/saved` — Saved tab still lists previously-saved posts; Liked tab still lists previously-liked posts (both archives intact).
4. Return to `/home` — previously-dismissed anchors reappear in feed (dismissed list cleared).
5. Corner-icon overlays on still-saved / still-liked tiles remain visible (state preserved per the chip backdrop fix from 43-10).

Automated source-reading and behavioral coverage is exhaustive (11 tests across the two test files, all GREEN); manual UAT is a confidence check on the dev affordance's end-to-end UX before Phase 43 milestone close-out.

## Next Phase Readiness

- Phase 43 gap-closure milestone fully closed at the engagement-service surface area; the operator-named gap from `.planning/debug/force-new-day-wipes-saved-liked.md` is resolved.
- No follow-up plans required.
- Phase 44 + 45 (parallel-safe Wave 5 — dependency-version sweep + code-quality / dead-code closure) remain queued; this plan adds no new blockers.

## Self-Check: PASSED

**Files verified to exist:**
- `app/src/services/engagement.service.ts` — FOUND (modified; resetDismissedOnly present)
- `app/src/screens/settings/SettingsDataScreen.tsx` — FOUND (modified; resetDismissedOnly call site present)
- `app/tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` — FOUND (modified; 5 assertions present)
- `app/tests/services/engagement.service.reset-dismissed-only.test.mjs` — FOUND (new; 6 assertions present)

**Commits verified to exist:**
- `644de616` — FOUND (Task 1: feat resetDismissedOnly)
- `75e2efa9` — FOUND (Task 2: fix handleForceNewDay call swap)
- `44436da6` — FOUND (Task 3: test SC-6 rename + negative invariant)
- `9f0116c4` — FOUND (Task 4: test engagement.service.reset-dismissed-only)

**Test runs:**
- `tests/services/engagement.service.reset-dismissed-only.test.mjs` — 6/6 GREEN
- `tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs` — 5/5 GREEN
- `tests/services/engagement.service.test.mjs` + `tests/services/engagement-anti-wire.test.mjs` — 15/15 GREEN (existing tests unbroken; `reset() clears all three collections AND emits NOTHING (D-08)` still passes — proving reset() preserved)
- `npm run test:main` — 789/794 pass / 5 fail; all 5 failures match the documented pre-existing Phase 37 + Phase 42 carry-overs (concept-feed ERR_MODULE_NOT_FOUND, walkDerivedList(16,...) const-drift, needsRefill 16 threshold const-drift, getVineColor date-dependent, hasImageGenKey assertion). Zero new failures introduced.
- `npx tsc -b --noEmit` — exits 0
- `npm run build` — exits 0

---
*Phase: 43-engagement-ui*
*Plan: 13 (gap-closure)*
*Completed: 2026-05-11*
