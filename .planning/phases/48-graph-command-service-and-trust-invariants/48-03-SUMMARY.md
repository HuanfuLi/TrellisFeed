---
phase: 48-graph-command-service-and-trust-invariants
plan: 03
subsystem: services
tags: [graph-command, merge, detach, prune, abort-signal, blocker-2, blocker-4, warning-2, warning-4, typescript]

requires:
  - phase: 48
    plan: 01
    provides: "graphEditJournal + GraphEditLogEntry + GRAPH_UPDATED payload extension + reorg-prompt injection"
  - phase: 48
    plan: 02
    provides: "graphCommandService boundary with rename + move + delete; merge/detach/prune/undo NOT_IMPLEMENTED stubs"
provides:
  - "graphCommandService.merge — multi-record consolidation: reparent children, recompute survivor, hard-delete loser (Blocker #2 success-check), graceful re-embed (Blocker #4 three-path)"
  - "graphCommandService.detach — clear placement + fire classifyAndAnchorIncremental fire-and-forget with AbortSignal threading (Warning #2 LOCALE_CHANGED cancellation)"
  - "graphCommandService.prune — delegate to trellisActionsService.prune (R6 — preserves ANCHOR_DELETED → PrunedSection chain)"
  - "Extended _trellis-mock-canonical.mjs: recording mock of classifyAndAnchorIncremental with configurable checkpoint delay for Warning #2 cancellation tests"
affects: [48-04, 49]

tech-stack:
  added: []
  patterns:
    - "Delegate-don't-replace consolidation (R6) — prune calls into the existing trellisActionsService.prune so PrunedSection's ANCHOR_DELETED subscriber chain in PlannerScreen survives the new boundary"
    - "Mutex-serialized fire-and-forget (detach) — classifyAndAnchorIncremental is invoked AFTER the mutex releases (read-fresh after patches, void call site), but signal-threaded so the abort path is honored even when the call outlives the mutex"
    - "Three-path graceful embedding (merge mirror of rename) — isConfigured=false / embed-fail / embed-success all preserve the post-state vector invariant; spread-merge in patchQuestion preserves the old vector when embeddingVector is OMITTED from the patch object"
    - "Recording mock with configurable checkpoint delay — _trellis-mock-canonical.mjs's classifyAndAnchorIncremental sleeps then checks signal.aborted; the delay knob lets the abort-mid-flight test land controller.abort() between call entry and the next signal checkpoint deterministically"

key-files:
  created:
    - app/tests/services/graph-command-service.merge.test.mjs
    - app/tests/services/graph-command-service.detach.test.mjs
    - app/tests/services/graph-command-service.prune.test.mjs
  modified:
    - app/src/services/graph-command.service.ts
    - app/tests/services/_trellis-mock-canonical.mjs
    - app/tests/services/graph-command-service.rename.test.mjs
    - app/package.json

key-decisions:
  - "merge mirrors rename's Blocker #4 strategy exactly — patch object OMITS embeddingVector when new vec is undefined; spread-merge in questionService.patchQuestion preserves the OLD vector. INVARIANT: survivor.embeddingVector is NEVER undefined when it had a vector pre-merge."
  - "merge accepts Warning #4 double-emit (questionService.delete's untyped + command-boundary typed). Subscribers are idempotent per CLAUDE.md §Event bus; LAST event has payload.kind === 'merge' so subscribers that dispatch on kind work."
  - "merge's Blocker #2 abort path leaves SURVIVOR + CHILDREN in their updated state — acceptable partial per T-48-14. Operator can retry; the no-op nature of running patchQuestion with identical values prevents corruption. Children already have parentId=survivorId after the first attempt."
  - "detach's typed GRAPH_UPDATED emit happens BEFORE the fire-and-forget classify (so subscribers see the boundary event even if classify hangs). classify's own GRAPH_UPDATED is the intentional second emit per R7 — documented inline."
  - "detach's opts?.signal is forwarded to classifyAndAnchorIncremental but NOT bound to the mutex. The mutex has already released by the time classify runs (fire-and-forget); the signal is the cancellation lever, not the mutex."
  - "prune delegates to trellisActionsService.prune INSTEAD OF re-implementing the flagged+prunedFromTrellis patch. R6 rationale: PlannerScreen's PrunedSection subscriber chain depends on ANCHOR_DELETED. trellisActionsService.prune emits ANCHOR_DELETED (not GRAPH_UPDATED), so no double-emit risk on this verb — the command-boundary GRAPH_UPDATED is the ONLY GRAPH_UPDATED for prune."
  - "Trimmed rename test's 'stubs' assertion from 4 verbs to 1 (undo only) — Plan 48-03 fills in merge/detach/prune, so asserting they return NOT_IMPLEMENTED is now stale. Plan 48-04 will further trim to remove that test entirely once undo lands."
  - "Extended _trellis-mock-canonical.mjs (NOT _actions-mock-llm.mjs) for the recording classify mock. Rationale: the loader stubs canonical-knowledge.service for the trellis-actions test family; reusing that stub keeps test bootstrap consistent. The LLM mock stays a pure no-op since classify is now intercepted at a higher layer."

requirements-completed: [GRAPH-03]

metrics:
  duration_min: 13
  tasks: 3
  files_created: 3
  files_modified: 4
  commits: 6
  tests_added: 32
  tests_passing: 32

completed: 2026-05-17
---

# Phase 48-03: Graph Command Service — merge + detach + prune Summary

**`graphCommandService.merge`, `.detach`, `.prune` now fully implemented (replacing Plan 48-02 stubs). merge consolidates duplicates with full undo-ready snapshot + Blocker #2 success-check + Blocker #4 three-path graceful re-embed + Warning #4 typed-discriminator emit. detach clears placement + fires classifyAndAnchorIncremental fire-and-forget with Warning #2 AbortSignal threading. prune delegates to the existing trellisActionsService.prune (R6 — preserves PrunedSection chain). Only `undo` (Plan 48-04) remains stubbed.**

## Performance

- **Duration:** ~13 min (6 commits across 13 min elapsed)
- **Started:** 2026-05-18T02:12:43Z
- **Completed:** 2026-05-18T02:25:27Z
- **Tasks:** 3 (per-plan tasks; each task = 1 RED commit + 1 GREEN commit)
- **Files created:** 3 (one per-verb test file)
- **Files modified:** 4 (service body extension + canonical mock extension + rename-test stub trim + package.json test:actions expansion)

## Accomplishments

- **merge(loserId, survivorId):**
  - D-07/D-08/D-09: reparent loser's children to survivor; survivor's parentage fields win (cross-cluster case included).
  - D-10: hard-delete loser via questionService.delete AFTER reparent + survivor update.
  - D-11: recompute survivor.qaCount + nodeSummary append (using `child.shortSummary ?? child.content.slice(0, 80)` per Warning #3) + re-embed survivor title.
  - **Blocker #2 fix** — questionService.delete(loserId) ServiceResult.success is INSPECTED before journal + command-boundary emit. On failure: returns STORAGE_ERROR (retryable), NO journal entry, NO typed emit; survivor + children left in their updated state (acceptable partial per T-48-14).
  - **Blocker #4 three-path graceful re-embed** (mirror of rename):
    - isConfigured=false → skip embed; survivor.embeddingVector preserved.
    - embed rejects → catch + console.warn; survivor.embeddingVector preserved.
    - embed succeeds → patch qaCount + nodeSummary + embeddingVector atomically in a single patchQuestion call.
    - **INVARIANT:** survivor.embeddingVector is NEVER undefined when it had a vector pre-merge.
  - **Warning #4 fix (Option C)** — accepted intentional double-emit: questionService.delete emits an untyped GRAPH_UPDATED at question.service.ts:569; the command boundary emits a SECOND typed event with payload.kind='merge'. The LAST event observed has the discriminator; subscribers are idempotent per CLAUDE.md.
  - Validation: self-merge → VALIDATION_ERROR; missing loser/survivor → NOT_FOUND.
  - Journal: ONE entry with `cmd='merge'`, `targetIds=[loserId, survivorId]`, `before={loser: <full record>, survivor: {qaCount, embeddingVector, nodeSummary}, reparentedChildren: [{id, parentId, clusterNodeId, branchLabel, clusterLabel} × N]}`, `after={reparentedCount, newSurvivorQaCount}`.

- **detach(qaId):**
  - D-13: clear placement fields (parentId/branchLabel/clusterLabel/clusterNodeId/nodeSummary/placementReason) on target; old parent's qaCount decrements; old anchor's nodeSummary strips the matching `[qa-id] ` line (mirrors move's old-parent update).
  - D-17: ONE typed GRAPH_UPDATED with payload.kind='detach' emitted SYNCHRONOUSLY from the command boundary at command-return time.
  - D-18 / R7: classifyAndAnchorIncremental fires fire-and-forget AFTER the synchronous patches + journal append + command-boundary emit. Downstream classify's eventual GRAPH_UPDATED is an intentional second emit (documented inline; subscribers re-read twice).
  - **D-19 / Warning #2 fix** — opts?.signal is forwarded to classifyAndAnchorIncremental. LOCALE_CHANGED (Phase 27 D-22) or operator-initiated abort cancels the in-flight call at its next checkpoint (signal.aborted === true observed; call short-circuits without proceeding to its final patchQuestion).
  - R10 risk 14: already-unassigned QA (parentId === undefined) → success no-op (no journal, no emit, no classify).
  - Validation: anchor/cluster targets rejected with VALIDATION_ERROR; missing target → NOT_FOUND.
  - Journal: `cmd='detach'`, `targetIds=[qaId]`, `before={parentId, branchLabel, clusterLabel, clusterNodeId, nodeSummary, placementReason}`, `after={classificationFired: true}`.

- **prune(anchorId):**
  - R6 / D-14: delegates to trellisActionsService.prune so the existing ANCHOR_DELETED emit is preserved (PrunedSection in PlannerScreen depends on this chain). Adding a parallel prune that bypassed trellisActionsService would break the chain.
  - D-17: ONE typed GRAPH_UPDATED with payload.kind='prune' emitted from the command boundary AFTER the delegated call + journal append. trellisActionsService.prune emits ANCHOR_DELETED (different event type), so the command-boundary GRAPH_UPDATED is the ONLY GRAPH_UPDATED for this verb — **no double-emit risk on prune** (contrast with delete + merge).
  - No-op: already-pruned anchor (flagged && prunedFromTrellis) → success without journal/emit/delegate call.
  - Validation: non-anchor targets (Q&As use detach, clusters use delete) rejected with VALIDATION_ERROR; NOT_FOUND for missing target.
  - Journal: `cmd='prune'`, `targetIds=[anchorId]`, `before={flagged, prunedFromTrellis}`, `after={flagged: true, prunedFromTrellis: true}`.

- **Mock extension:** `_trellis-mock-canonical.mjs` now exports `classifyAndAnchorIncremental` as a recording mock with `_resetClassifyCalls` / `_getClassifyCalls` / `_setClassifyCheckpointDelay` helpers. The configurable checkpoint delay lets the Warning #2 cancellation test land `controller.abort()` deterministically between call entry and the next `signal.aborted` checkpoint.

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| 1 | RED | `ba60febb` | test: failing merge tests + package.json extension |
| 1 | GREEN | `509944e3` | feat: implement merge with Blocker #2/#4 + Warning #4 fixes |
| 2 | RED | `14749afb` | test: failing detach tests + canonical mock extension |
| 2 | GREEN | `8025d99f` | feat: implement detach with AbortSignal threading (Warning #2) |
| 3 | RED | `1b5a2d7e` | test: failing prune tests |
| 3 | GREEN | `fd3ae43d` | feat: implement prune via trellisActionsService delegation (R6) |

## Files Created/Modified

- `app/src/services/graph-command.service.ts` — `merge` / `detach` / `prune` bodies replace Plan 48-02 NOT_IMPLEMENTED stubs. Imports added for `classifyAndAnchorIncremental` (canonical-knowledge.service) and `trellisActionsService` (trellis-actions.service). Total file ~890 lines (up from 469).
- `app/tests/services/graph-command-service.merge.test.mjs` — 13 tests (6 source-reading invariants + 7 behavioral incl. Blocker #2 abort-before-journal + Blocker #4 three-path graceful degradation + Warning #4 last-event-kind-discriminator).
- `app/tests/services/graph-command-service.detach.test.mjs` — 14 tests (5 source-reading + 9 behavioral incl. AbortSignal mid-flight cancellation, fire-and-forget classify call assertions).
- `app/tests/services/graph-command-service.prune.test.mjs` — 9 tests (3 source-reading + 6 behavioral incl. R6 ANCHOR_DELETED preservation, no-double-emit invariant, no-op already-pruned guard).
- `app/tests/services/_trellis-mock-canonical.mjs` — extended with recording `classifyAndAnchorIncremental` mock + `_resetClassifyCalls` / `_getClassifyCalls` / `_setClassifyCheckpointDelay` helpers. `buildAnchorReflectionTree` unchanged.
- `app/tests/services/graph-command-service.rename.test.mjs` — trimmed `stubs` test from asserting 4 verbs return NOT_IMPLEMENTED to asserting only `undo` does (Plans 48-03/04 progressive fill-in).
- `app/package.json` — `test:actions` script extended with the 3 new test files.

## Decisions Made

- **merge mirrors rename's Blocker #4 strategy exactly.** Same patch-object-OMITS-embeddingVector pattern when new vec is undefined; same spread-merge preservation in `questionService.patchQuestion`. Inline comment ("never overwrite a vector with undefined") duplicated in both bodies — tests assert presence ≥ 2.
- **merge accepts Warning #4 double-emit.** `questionService.delete(loserId)` emits an untyped GRAPH_UPDATED at question.service.ts:569 BEFORE we know if delete succeeded (the mock currently does, real impl also does). The command boundary emits a SECOND typed event ONLY AFTER the success check passes AND the journal entry is appended. Subscribers are idempotent per CLAUDE.md; LAST event has `payload.kind === 'merge'`.
- **merge's Blocker #2 abort leaves partial state.** Survivor + children are in their updated form when delete fails. Acceptable per T-48-14. Documented inline; test acknowledges partial state with a "comment in test" stub.
- **detach's typed emit happens BEFORE fire-and-forget classify.** Subscribers must see the detach event regardless of classify's fate. The classify's own GRAPH_UPDATED (whenever it lands) is an intentional second emit per R7.
- **detach's opts?.signal is forwarded to classify but NOT bound to the mutex.** The mutex has already released by the time classify runs (fire-and-forget). The signal is the cancellation lever, not the mutex. This matches the Phase 27 D-22 LOCALE_CHANGED pattern.
- **prune delegates to trellisActionsService.prune (R6).** Re-implementing the flagged+prunedFromTrellis patch in graph-command would have required replacing trellisActionsService.prune's existing PlannerScreen call sites (scissors button) — high churn for low value. Delegation preserves the ANCHOR_DELETED → PrunedSection chain with zero call-site change.
- **prune has NO double-emit risk.** trellisActionsService.prune emits ANCHOR_DELETED (different event type from GRAPH_UPDATED), so the command-boundary GRAPH_UPDATED is the ONLY GRAPH_UPDATED. Contrast with delete + merge where questionService.delete emits an untyped GRAPH_UPDATED.
- **Trimmed rename's 'stubs' test to 1 verb (undo).** Plan 48-03 filled in 3 of the 4 stubs; asserting they return NOT_IMPLEMENTED is now stale. Plan 48-04 will further trim (remove the test entirely once undo lands).
- **Extended _trellis-mock-canonical.mjs (not _actions-mock-llm.mjs).** Rationale: the actions-mock-hooks loader stubs canonical-knowledge.service; the LLM mock is a pure no-op. Hooking classify at the higher layer keeps test bootstrap consistent and avoids tangling the LLM stub with classify-specific recording state.

## Deviations from Plan

None — plan executed exactly as written. TDD discipline preserved (per-task RED + GREEN commits). All Blocker #2 / Blocker #4 / Warning #2 / Warning #4 fixes from the plan are closed:

- **Blocker #2 (merge)** — `questionService.delete(loserId)` ServiceResult.success is checked before journal append (test at `graph-command-service.merge.test.mjs:362` proves the abort-before-journal path).
- **Blocker #4 (merge)** — three-path graceful-degradation tests:
  - `merge.test.mjs:295` for isConfigured=false PRESERVES old vector
  - `merge.test.mjs:319` for embed-fail PRESERVES old vector + console.warn
  - `merge.test.mjs:354` cross-cutting invariant: across all 3 paths post-merge survivor.embeddingVector is never undefined when it was defined pre-merge
- **Warning #2 (detach)** — `graph-command-service.detach.test.mjs:347` asserts `signal.aborted === true` observed at the next checkpoint AND `completed === false` (classify did NOT proceed to its final patchQuestion).
- **Warning #4 (merge)** — `graph-command-service.merge.test.mjs:402` asserts `events.length === 2` AND `events[events.length-1].payload?.kind === 'merge'` (LAST event has the discriminator).

A small in-scope update that wasn't strictly a "deviation" but worth noting: the rename test's `stubs: merge/detach/prune/undo return NOT_IMPLEMENTED` test was trimmed to `stub: undo() returns NOT_IMPLEMENTED` since 3 of the 4 verbs are no longer stubs. This is the natural Plan 03/04 progressive fill-in.

## Issues Encountered

- **Pre-existing failures persist (unchanged from 48-01/02).** 4 tests in 3 files fail (concept-feed import error, trellis-state worst-child-wins, trellis-replant 2× hardcoded dates). All documented in `deferred-items.md`; verified non-causation by inspection (none touch graph-command, journal, classify, or trellis-actions surfaces this plan modifies). Not fixed in Phase 48 per scope boundary.

## Threat Surface Scan

No new threat surface introduced. All Plan 48-03 commands route through the existing single-write path (`questionService.patchQuestion` / `questionService.delete` / `trellisActionsService.prune` which itself only patches via patchQuestion); no direct localStorage writes from this service (`grep -c "localStorage.setItem" app/src/services/graph-command.service.ts` returns 0). Threat register dispositions T-48-09 (merge partial-state on mid-loop throw — accept), T-48-10 (merge journal full loser record — accept), T-48-11 (detach classify DoS — mitigate via AbortSignal threading; Warning #2 fix enforces with explicit test), T-48-15 (merge partial-state on failed delete — accept; Blocker #2 ensures STORAGE_ERROR is the return path, not a silent journal write) all addressed.

## Next Phase Readiness

- **Plan 48-04 (undo)** can now plug into all 6 implemented verbs. Journal entry shapes:
  - rename: `before = {title, content, summary, embeddingVector}`, swap with `after`
  - move: `before = {parentId, clusterNodeId, branchLabel, clusterLabel, placementReason}`, swap with `after`; side effects (qaCount + nodeSummary on old/new parents) recomputed by walking children
  - delete: `before = {deletedRecord: <full Question>, reparentedChildren: [{id, parentId, clusterNodeId, branchLabel, clusterLabel}]}` — undo inserts the full record back + re-parents the listed children to their OLD parentage
  - merge: `before = {loser: <full Question>, survivor: {qaCount, embeddingVector, nodeSummary}, reparentedChildren: [{id, parentId, clusterNodeId, branchLabel, clusterLabel}]}` — undo inserts loser back + restores survivor's pre-merge fields + re-parents children to loser
  - detach: `before = {parentId, branchLabel, clusterLabel, clusterNodeId, nodeSummary, placementReason}` — undo restores placement AND skips re-classification per D-13
  - prune: `before = {flagged, prunedFromTrellis}` — undo restores pre-state (calls trellisActionsService.unpruneQuestion or equivalent patch)
- **Phase 49 UI** can now dispatch on `payload.kind` for all 6 verbs from every command boundary. Plan 48-04's undo will add a 7th kind ('undo' or back-reference) once the inverse strategy is locked.
- **Cross-cutting invariant:** every successful Plan 48-03 command writes EXACTLY ONE journal entry; the LAST GRAPH_UPDATED observed by subscribers has `payload.kind` matching the verb. Merge produces 2 GRAPH_UPDATED events (untyped from questionService.delete + typed from command boundary); detach + classify also produces 2 (typed from command + downstream classify's own emit); prune produces 1 (no double-emit since trellisActionsService.prune emits ANCHOR_DELETED, not GRAPH_UPDATED).

## Self-Check: PASSED

- ✅ All 32 Plan 48-03 own tests pass (`cd app && npm run test:actions -- tests/services/graph-command-service.merge.test.mjs tests/services/graph-command-service.detach.test.mjs tests/services/graph-command-service.prune.test.mjs`): 13 merge + 14 detach + 9 prune − 4 shared pre-existing trellis-replant tests = 32 new tests, all pass.
- ✅ TypeScript compiles cleanly (`npx tsc -b --noEmit` returns 0).
- ✅ Full suite: 981/983 test:main + 97/99 test:actions = **1078/1082 pass** — the 4 failing tests are pre-existing (concept-feed import error, trellis-state worst-child-wins, trellis-replant 2× hardcoded dates), all documented in `deferred-items.md` with stash-verified non-causation.
- ✅ Atomic commits with conventional-commit format (`test(48-03)` / `feat(48-03)` prefixes; per-task RED + GREEN).
- ✅ All `must_haves.truths` from plan frontmatter satisfied:
  - merge reparents children + hard-deletes loser with success check + recomputes survivor + never silently clears vector ✓
  - detach clears placement + fires classifyAndAnchorIncremental fire-and-forget with AbortSignal threading; LOCALE_CHANGED-mid-flight cancellation works ✓
  - prune delegates to trellisActionsService.prune (preserving ANCHOR_DELETED) + writes journal + emits one GRAPH_UPDATED ✓
  - Every successful command writes EXACTLY ONE GraphEditLogEntry; LAST GRAPH_UPDATED has payload.kind matching cmd; merge double-emit is documented and accepted ✓
  - Blocker #2 fix: failed loser delete aborts before journal + emit ✓
  - Blocker #4 invariant: post-merge survivor.embeddingVector is NEVER undefined when defined pre-merge ✓
- ✅ All `key_links` patterns present (verified via grep):
  - `questionService\.delete\(loserId\)` ✓ (merge body)
  - `classifyAndAnchorIncremental` ✓ (detach body + canonical mock)
  - `trellisActionsService\.prune` ✓ (prune body)
- ✅ All acceptance-criteria grep gates pass:
  - merge: self-merge guard, full-loser snapshot, deleteResult.success check, `kind: 'merge'`, `never overwrite a vector with undefined` × 2, `subscribers are already idempotent / LAST event observed` × 2
  - detach: classifyAndAnchorIncremental ref, downstream-COMMAND comment, opts?.signal ref, isAnchorNode/isClusterNode validation, `kind: 'detach'`
  - prune: `trellisActionsService.prune` ref, isAnchorNode validation, `kind: 'prune'`
  - package.json `test:actions` includes all 3 new test files ✓
- ✅ Plan verification gates:
  - `grep -c "questionService.delete" app/src/services/graph-command.service.ts` returns 8 (≥ 2 required) ✓
  - Only `undo` remains stubbed (Plan 48-04's scope); `grep -n "NOT_IMPLEMENTED" src/services/graph-command.service.ts` shows 1 fail() call (in undo) plus the type union + comment block ✓

---
*Phase: 48-graph-command-service-and-trust-invariants*
*Completed: 2026-05-17*
