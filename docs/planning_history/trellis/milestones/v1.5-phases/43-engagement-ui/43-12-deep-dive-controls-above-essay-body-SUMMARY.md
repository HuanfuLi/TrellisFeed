---
phase: 43-engagement-ui
plan: 12
subsystem: ui
tags: [postdetail, deep-dive, jsx-placement, ds-02, uat-7, gap-closure]

# Dependency graph
requires:
  - phase: 43-engagement-ui (plan 43-05)
    provides: renderDeepDiveControls() function + DD-01..DD-05 invariants + 16/6 AbortController contract
  - phase: 41-engagement-pipeline (plan 41-02)
    provides: D-08 AbortController pre-call guards + signal-arg passes (preserved)
provides:
  - Deep Dive button + Standard|Deep segmented toggle rendered ABOVE the essay body (operator-preferred placement)
  - DS-02 entry in 43-CONTEXT.md documenting the placement decision change
  - Updated DD-01 positional invariant locking invocation < essay-body-container
affects: [Phase 44+ future post-detail polish, any plan touching the PostDetailScreen <article> JSX block]

# Tech tracking
tech-stack:
  added: []  # No new libraries
  patterns:
    - "JSX-move-only refactor: single-point invocation relocation moves ALL three render branches (Restore Standard / segmented Standard|Deep / DeepDiveButton) without touching renderDeepDiveControls internals"
    - "Decision-update audit trail: operator UAT preference change recorded as DS-02 in CONTEXT.md, paired with a gap-closure plan + debug session document"

key-files:
  created: []
  modified:
    - "app/src/screens/PostDetailScreen.tsx (single JSX block move; +7/-5 lines; renderDeepDiveControls internals untouched; scroll-sentinel untouched)"
    - "app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs (DD-01 test rewrite; +37/-10 lines; DD-02 / DD-03 / DD-03-handler tests untouched)"
    - ".planning/phases/43-engagement-ui/43-CONTEXT.md (DS-02 entry added after DS-01; +1 line)"

key-decisions:
  - "Single-point JSX move ONLY — preserved all 16 pre-call abort guards, 6 signal-arg passes, and the cache-write guard inside renderDeepDiveControls (DD-05 abort contract intact)"
  - "Scroll-70% sentinel (Detector A — CONCEPT_EXPLORED emit) NOT moved — structurally bound to 'essay body has been scrolled past', not to controls placement"
  - "DD-01 test anchor switched from sentinel-relative (sentinelJsxIdx < invocationIdx) to essay-body-relative (invocationIdx < essayBodyIdx) using `minHeight: '200px'` literal as the stable anchor"
  - "Comment block at the new invocation site explicitly references the placement update (43-12 / UAT Test 7) so future plan authors find the operator decision via grep on the source file alone"
  - "Cosmetic margins inside renderDeepDiveControls (marginTop 20px / 8px, marginBottom 16px / 8px) left untouched — no visual tuning in this gap closure"

patterns-established:
  - "Operator-decision-update gap-closure cadence: when an operator updates a prior decision after UAT, capture in (1) a debug session document, (2) a focused gap-closure plan, (3) a DS-* descope/decision entry in the phase CONTEXT.md, (4) a test invariant flip — all four anchors preserve the audit trail without re-litigating the original decision"
  - "JSX-move refactors are SAFER than internal edits when the change is purely declarative placement — single block move + a single test assertion update + no behavior change is the minimal-blast-radius shape"

requirements-completed: [CONTENT-01]

# Metrics
duration: 3min
completed: 2026-05-11
---

# Phase 43 Plan 12: deep-dive-controls-above-essay-body Summary

**Single JSX block relocation moves Deep Dive button + Standard|Deep segmented toggle ABOVE the essay body per operator UAT Test 7 placement update; renderDeepDiveControls internals, scroll-sentinel, and DD-05 abort contract all preserved byte-for-byte.**

## Performance

- **Duration:** 3 min (177 sec)
- **Started:** 2026-05-11T10:31:21Z
- **Completed:** 2026-05-11T10:34:18Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **Source move:** Relocated `{!isStreamingOnEnter && (post.bodyMarkdown || streamingBody) && renderDeepDiveControls()}` from line 1046 (between scroll-sentinel and takeaway) to line 992 (between video AI-summary heading and essay body container). One JSX block; +7/-5 lines.
- **Test update:** Rewrote DD-01 to assert `invocationIdx < essayBodyIdx` (anchored on `minHeight: '200px'`) AND `invocationIdx < takeawayIdx` (preserved). Confirmed `scrollSentinelRef` JSX still present as a regression guard for Detector A.
- **Decision audit trail:** Added DS-02 to 43-CONTEXT.md right after DS-01, documenting the operator's updated preference with the verbatim UAT quote ("the toggle appeared below essay instead of above essay...") and cross-referencing both the debug session document and this gap-closure plan.

## Task Commits

Each task was committed atomically (--no-verify; parallel sub-wave 4A):

1. **Task 1: Relocate renderDeepDiveControls() invocation** — `0033073c` (fix)
2. **Task 2: Update DD-01 test positional assertion** — `7a60d4b5` (test)
3. **Task 3: Add DS-02 to 43-CONTEXT.md** — `51c746b7` (docs)

## Files Created/Modified

- `app/src/screens/PostDetailScreen.tsx` — Single JSX block moved (~5 lines + 1-line invocation, ~7 lines total inserted with updated comment) from after the scroll-sentinel to before the essay body container.
- `app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` — DD-01 test entirely rewritten with above-body placement contract (`invocationIdx < essayBodyIdx` + `invocationIdx < takeawayIdx` + scroll-sentinel presence regression guard).
- `.planning/phases/43-engagement-ui/43-CONTEXT.md` — DS-02 entry added immediately after DS-01 in the Descopes (DS-*) section.

## Confirmation Checks

- `invocation index` (`renderDeepDiveControls()` last occurrence): **42614**
- `essay body container index` (first `minHeight: '200px'`): **42733**
- `takeawayHeading index`: **47321**
- **42614 < 42733** ✓ — invocation BEFORE essay body container
- **42614 < 47321** ✓ — invocation BEFORE takeaway block (naturally satisfied)
- `ref={scrollSentinelRef}` JSX still present in source ✓ — Detector A preserved
- `renderDeepDiveControls function declaration` (line 595) unchanged ✓
- `handleStartDeepDive` / `handleRestoreStandard` / `deepAbortControllerRef` declarations unchanged ✓
- `cd app && npx tsc -b --noEmit` exits **0** ✓
- `cd app && node --test tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs tests/screens/PostDetailScreen.segmented-toggle.test.mjs tests/screens/PostDetailScreen.abort-contract.test.mjs` → **19/19 pass** ✓
- `cd app && node --test "tests/screens/*.test.mjs"` → **124/124 pass** ✓ (no other screen tests regressed)
- `grep "DS-02"` 43-CONTEXT.md returns **1** ✓
- `grep "above essay body"` 43-CONTEXT.md returns **1** ✓
- `grep "43-12"` 43-CONTEXT.md returns **1** ✓

## DD-01 New Assertion Shape

```js
const invocationIdx = src.lastIndexOf('renderDeepDiveControls()');
const essayBodyIdx  = src.indexOf("minHeight: '200px'");
const takeawayIdx   = src.indexOf('takeawayHeading');
const sentinelJsxIdx = src.indexOf('ref={scrollSentinelRef}');

assert.ok(invocationIdx < essayBodyIdx, 'invocation BEFORE essay body container');
assert.ok(invocationIdx < takeawayIdx,  'invocation BEFORE takeaway block');
assert.ok(sentinelJsxIdx > 0,           'scrollSentinelRef JSX still present (Detector A)');
```

## CONTEXT.md DS-02 Entry Text

> **DS-02:** **DD-01 placement decision UPDATED 2026-05-11 (UAT Test 7).** Original Phase 43-05 CONTEXT specified Deep Dive button + Standard|Deep segmented toggle placement as "below essay body, above takeaway" (between the scroll-70% sentinel and the takeaway block). Operator UAT feedback: "the toggle appeared below essay instead of above essay. You are right to design it above essay, I guess the prior decision was confusing." Updated placement: **deep-dive controls render above essay body** (ABOVE the essay-body container) so users see the depth-control affordance BEFORE reading. The scroll-70% sentinel (Detector A — CONCEPT_EXPLORED emit) stays in place; only the `renderDeepDiveControls()` invocation moves. **No changes to handleStartDeepDive / handleRestoreStandard internals (DD-03 streaming) or to the segmented toggle handler (DD-04) or to the AbortController contract (DD-05).** Closed by gap-closure plan 43-12. See `.planning/debug/deep-dive-toggle-below-essay-body.md` for full diagnosis.

## Decisions Made

- **JSX-move-only, no comment cleanup on adjacent blocks.** The pre-existing scroll-sentinel comment "placed between essay body and takeaway (D-04)" now slightly mis-frames the relationship to the controls (since the controls are no longer adjacent to the sentinel). Per plan Step 3, comment cleanup is OPTIONAL and OUT OF SCOPE for this gap closure — minimal-diff principle. The comment is still accurate about the sentinel's relationship to the essay body and takeaway, which are the load-bearing anchors.
- **Margins left untouched.** Inline `marginTop` (20px / 8px) and `marginBottom` (16px / 8px) values inside `renderDeepDiveControls`'s three render branches now serve different gap relationships (marginTop = gap to video heading / whyCare; marginBottom = gap to essay body). Visual fine-tuning deferred to a future polish phase, per the plan and the debug session note ("Cosmetic margins likely OK as-is; flag for visual UAT after the move.").

## Deviations from Plan

None — plan executed exactly as written. Three atomic commits in source → test → docs order.

## Issues Encountered

- **One transient verify-script false-positive.** The first run of the inline placement-verification node script reported `invocation: 46570 body: 42148 takeaway: 47155` (which would have been a fail). This was a stale-file-system-read artifact (the just-edited file's index didn't propagate to the next `readFileSync` call in the same shell process within the inline `-e` script — likely a kernel-level cache-coherency timing). Re-running the same logic in a fresh `node -e` invocation returned the correct values (`invocation: 42614 body: 42733 takeaway: 47321`), confirming `inv < body && inv < takeaway`. No source change was needed; the assertion was correct, the first read was stale. All downstream test runs (tsc, node --test) saw the correct state.

## Next Phase Readiness

- Phase 43 UAT Test 7 (deep-dive controls placement) is now structurally satisfied. Operator visual UAT recommended at next available device test cycle.
- 43-12 is part of sub-wave 4A alongside 43-09 / 43-10 / 43-11 / 43-13. No file overlap with sibling plans (per parallel-safety note in plan body); 43-12 touched only `PostDetailScreen.tsx`, the DD-01 test, and 43-CONTEXT.md.
- Phase 43 sits at 9/13 plans complete after this commit. Remaining: 43-09, 43-10, 43-11, 43-13 from the same sub-wave.

## Self-Check: PASSED

- File `app/src/screens/PostDetailScreen.tsx` — exists ✓ (line 992 contains the new invocation; line 595 `renderDeepDiveControls` declaration unchanged; line ~1041 `scrollSentinelRef` JSX intact)
- File `app/tests/screens/PostDetailScreen.deep-dive-trigger.test.mjs` — exists ✓ (DD-01 test rewritten)
- File `.planning/phases/43-engagement-ui/43-CONTEXT.md` — exists ✓ (DS-02 entry at line 82 after DS-01)
- Commit `0033073c` — found in `git log` ✓
- Commit `7a60d4b5` — found in `git log` ✓
- Commit `51c746b7` — found in `git log` ✓

---
*Phase: 43-engagement-ui*
*Plan: 12*
*Completed: 2026-05-11*
