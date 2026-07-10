---
phase: 47-filter-redesign-off-topic-malicious-prompt-prevention
plan: 05
subsystem: filter
tags:
  - filter
  - pipeline-inversion
  - question-service
  - service-result
  - error-codes

# Dependency graph
requires:
  - phase: 47-01
    provides: filter-corpus.service.ts loader + on-disk corpus JSON consumed by Layer 2
  - phase: 47-02
    provides: question-filter.service rewrite — three-label FilterResult contract; evaluateQuestion(content, sessionContext, signal) signature; lazy settings import
provides:
  - question.service.ask inverted to pre-LLM filter gate (mirror of useQuestions per D-18)
  - Three-branch dispatch with ServiceResult error shape for the malicious branch (D-01)
  - ErrorCode union extended with BLOCKED_MALICIOUS and ABORTED so the new error returns compile
  - Source-reading regression guard (7 cases) for D-18 ordering, D-19 abort threading, D-01 malicious-no-LLM, D-01 off-topic-skip-classification, patchQuestion non-modification, and one-event-per-semantic-event
affects:
  - 47-04 (parallel — same inversion in useQuestions; tests Plan 04 will land complete the pre-gate coverage on both filterQuestion consumers)
  - 47-06 (override re-fire path closes D-06 by routing through patchQuestion + classifyAndAnchorIncremental from AskScreen.handleQuestionOverride; this plan keeps patchQuestion pure persistence so Plan 06's call site is the sole trigger)
  - 47-09 (eval set runs against the three-branch contract this plan locks for the service-layer path)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-LLM filter gate (D-18) with ServiceResult<T> error for the malicious branch — mirror of the React-hook inversion in useQuestions"
    - "ErrorCode discriminated union extended only when a new error truly needs callers to discriminate it (BLOCKED_MALICIOUS gets a no-override surface; ABORTED matches existing AbortSignal semantics)"
    - "Source-reading guard tests for inversion ordering — offset comparisons inside method-body slices to assert structural invariants without provider stubbing"

key-files:
  created:
    - app/tests/services/question-service-pre-gate.test.mjs
  modified:
    - app/src/services/question.service.ts
    - app/src/types/index.ts

key-decisions:
  - "Implement the malicious branch as a ServiceResult<T> error with code BLOCKED_MALICIOUS (mirroring the NOT_CONFIGURED error precedent at the same call site) instead of a side-channel signal — keeps the existing caller error-handling shape"
  - "Extend the ErrorCode union with BLOCKED_MALICIOUS + ABORTED rather than introducing a parallel error-code type — single discriminator union keeps switch-on-code exhaustive"
  - "Keep patchQuestion's body verbatim — the override re-fire belongs at AskScreen.handleQuestionOverride (Plan 06), not inside patchQuestion (14+ call sites would fire spuriously)"
  - "On filter pre-gate failure (non-abort exception), gracefully degrade to label='on-topic' (D-12) so a transient embedding outage does not block legitimate questions; abort signal returns a clean ABORTED error instead"
  - "The new related-questions read uses a SECOND loadStore({includeFlagged:true}) read at the end of ask() (after the off-topic flag-write or on-topic fire-and-forget) so the related-IDs filter sees a fresh post-write store; mirrors buildAndSave's read-modify-write discipline"

patterns-established:
  - "Pattern: pre-LLM gate inversion in service-layer ask (mirror of state-hook ask) — filterQuestion(content, sessionContext, signal) BEFORE embedText AND BEFORE chatCompletion; three-branch dispatch on filterResult.label; off-topic persists with flagged:true via the existing read-modify-write idiom and SKIPS classifyAndAnchorIncremental; on-topic preserves the existing fire-and-forget classification"
  - "Pattern: source-reading test slice via brace-depth walking — getBranchSlice(label) walks { -> } depth from a `filterResult.label === '<label>'` anchor so positive AND negative assertions stay scoped to the correct branch body without leaking into siblings"

requirements-completed:
  - FILTER-01
  - FILTER-02

# Metrics
duration: ~25min
completed: 2026-05-15
---

# Phase 47 Plan 05: Pipeline Inversion in question.service.ask Summary

**question.service.ask now runs the three-label filter as a pre-LLM gate; malicious prompts return a ServiceResult error with code BLOCKED_MALICIOUS without ever reaching chatCompletion or embedText, off-topic prompts persist with flagged:true and skip classifyAndAnchorIncremental, and on-topic prompts follow the existing flow unchanged.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-15
- **Completed:** 2026-05-15
- **Tasks:** 2 / 2
- **Files modified:** 3 (2 modified, 1 created)
- **Diff size in question.service.ts:** +84 lines / -23 lines (76 net additions; ask() body grew by the pre-gate block + three-branch post-LLM block)

## Accomplishments

- Inverted `question.service.ask` to call `filterQuestion(content, sessionContext, signal)` immediately after the `!llmConfig.isConfigured` early-return (line 213) and before the embedding precompute at line 261.
- Added the malicious branch returning `{ success: false, error: { code: 'BLOCKED_MALICIOUS', message: t('chatMessage.maliciousBlocked.body'), retryable: false } }` (line 238) — zero LLM tokens, zero embedding tokens, no Question persisted.
- Replaced the post-LLM `filterQuestion(question, sessionContext)` re-call with a branch on `filterResult.label`: off-topic persists with `flagged:true` via the existing read-modify-write idiom and skips `classifyAndAnchorIncremental`; on-topic fires `classifyAndAnchorIncremental(question, ...)` verbatim from the prior shape.
- Extended `ErrorCode` union (`app/src/types/index.ts`) with `BLOCKED_MALICIOUS` (D-01) and `ABORTED` (D-19) so the new ServiceResult shapes compile.
- Created 7-case source-reading regression test at `app/tests/services/question-service-pre-gate.test.mjs` covering D-18 ordering, D-19 abort threading, D-01 malicious-no-LLM-no-embedding, D-01 off-topic-skip-classification, patchQuestion non-modification, and the one-event-per-semantic-event invariant.
- Confirmed patchQuestion implementation is unchanged (still 5 references to the symbol; method body is identical to baseline — pure persistence).

## Task Commits

Each task was committed atomically:

1. **Task 1: Invert question.service.ask pipeline (mirror Plan 04 with ServiceResult error shape)** — `b82684f7` (refactor)
2. **Task 2: Source-reading test enforcing D-18 + D-19 + D-01 invariants for question.service.ask** — `17f99230` (test)

## Files Created/Modified

- `app/src/services/question.service.ts` — Inverted `ask` method. Pre-gate at line 213; malicious-branch return at line 238 (BLOCKED_MALICIOUS); off-topic flag-persist + classification-skip at lines ~315-327; on-topic fire-and-forget classification preserved at lines ~333-336. Added `FilterResult` to the type-only import alongside `QuestionFilterContext`.
- `app/src/types/index.ts` — Extended `ErrorCode` union with `BLOCKED_MALICIOUS` (D-01) and `ABORTED` (D-19); added inline doc comments referencing the phase + decision IDs.
- `app/tests/services/question-service-pre-gate.test.mjs` — New 7-case source-reading regression test. Pure `fs.readFileSync` + offset-comparison; no service instantiation, no provider stubs, no settings shim. Mirrors Plan 04's analog test pointed at `useQuestions.ts`.

## Decisions Made

- **Use ServiceResult error shape for the malicious branch.** The plan called for it explicitly (mirror of the existing `NOT_CONFIGURED` precedent at the same call site, line 191). Callers of `ask` already discriminate on `error.code`, so adding `BLOCKED_MALICIOUS` slots cleanly into existing call-site error paths.
- **Add BLOCKED_MALICIOUS and ABORTED to the ErrorCode union directly** (Rule 3 — fix blocking issue). Without it, the new returns produce TS2322 errors. Alternative was a parallel error-code type — rejected because it splits exhaustive switching across two unions. The deviation is small and well-bounded; documented inline with phase + decision references.
- **Keep the related-questions slice at the end of ask() reading from a fresh `loadStore({includeFlagged:true})` call.** The original code held a `freshStore` variable from the post-LLM filter loop; after inversion, the off-topic branch creates its own fresh store inside the if-block and the on-topic branch does not allocate one. A single re-read at the end keeps both branches consistent without duplicating the slice.
- **On filterQuestion exception path, distinguish abort from other errors.** Aborted signal → return `{ code: 'ABORTED', retryable: false }`. Other errors → log warning and proceed as `label: 'on-topic'` (D-12 graceful degradation). This matches the contract documented in `question-filter.service.ts:270-283`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] ErrorCode union missing BLOCKED_MALICIOUS and ABORTED**
- **Found during:** Task 1 typecheck after Edit 1+2.
- **Issue:** `app/src/types/index.ts:634-654` defined `ErrorCode` as a closed union; the plan's required `code: 'BLOCKED_MALICIOUS'` (and the abort path's `code: 'ABORTED'`) produced two TS2322 errors at lines 219 and 238 of `question.service.ts`. Without the extension, Task 1's required behavior could not compile.
- **Fix:** Extended the union with `'BLOCKED_MALICIOUS'` and `'ABORTED'` and added inline doc comments referencing Phase 47 D-01 and D-19. The plan's `files_modified` did not include `types/index.ts`, but the type union is structurally part of the ServiceResult contract this plan must satisfy.
- **Files modified:** `app/src/types/index.ts`
- **Verification:** `tsc -b --noEmit` shows zero errors in `question.service.ts` after the edit. The remaining 10 typecheck errors are all in `app/src/state/useQuestions.ts`, which is Plan 04's territory (parallel wave with zero file overlap with this plan).
- **Committed in:** `b82684f7` (part of Task 1 commit).

## Authentication Gates

None — this plan is pure source code + tests; no provider, network, or auth interaction.

## Verification Results

- `cd app && node --test tests/services/question-service-pre-gate.test.mjs` → PASSES (7 / 7 cases).
- `cd app && node --test tests/services/classification-dedup.test.mjs` → PASSES (no regression in the canonical-knowledge analog tests, per the plan's verification checklist).
- `cd app && ./node_modules/.bin/tsc -b --noEmit` → `question.service.ts` is fully type-clean (0 errors). The remaining 10 typecheck errors are all in `app/src/state/useQuestions.ts` — Plan 04's territory in the parallel wave. Wave-2 cross-worktree verification is the orchestrator's responsibility post-merge.
- `grep -c "filterQuestion(" app/src/services/question.service.ts` → returns `1` (the pre-gate call site at line 213).
- `grep -c "BLOCKED_MALICIOUS" app/src/services/question.service.ts` → returns `1` (line 238).
- `grep -c "patchQuestion" app/src/services/question.service.ts` → returns `5` (unchanged from baseline — patchQuestion implementation is byte-identical to pre-Plan-05).
- New event types (`QUESTION_FLAGGED_PRE_GATE` / `FILTER_BLOCKED` / `MALICIOUS_BLOCKED`) → 0 occurrences (CLAUDE.md "One signal per semantic event" preserved).

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-47-20 (DoS via service-layer path) | Test case 4 enforces malicious branch does NOT invoke chatCompletion / embedText / buildAndSave / classifyAndAnchorIncremental. |
| T-47-21 (Pipeline-inversion regression in question.service.ask) | Test cases 1 + 2 enforce filterQuestion BEFORE chatCompletion AND BEFORE embedText. |
| T-47-22 (Off-topic question silently entering mind map via service-layer path) | Test case 5 enforces off-topic branch sets flagged:true AND skips classifyAndAnchorIncremental. |
| T-47-23 (Spurious flag-transition fire if patchQuestion gets a side-effect hook) | Test case 6 negative-asserts no classifyAndAnchorIncremental call AND no GRAPH_UPDATED emit inside patchQuestion body. |
| T-47-SC (Supply-chain) | Zero new packages installed in this plan. |

## Known Stubs

None. The pre-gate consumes the live three-label filter from Plan 02; the off-topic flag write goes through the existing localStorage + SQLite persistence path; the malicious branch returns a real ServiceResult error consumed by callers.

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond the in-scope `<threat_model>` register.

## Notes for Downstream Plans

- **Plan 06 (D-06 override re-fire)** — patchQuestion remains pure persistence by design. The override re-fire belongs at `AskScreen.handleQuestionOverride` after `patchQuestion({flagged:false})`. Test case 6 of this plan will fail if Plan 06 inadvertently moves the side-effect into patchQuestion.
- **Plan 04 (parallel wave)** — When merged, both `useQuestions-pre-gate.test.mjs` (Plan 04) and `question-service-pre-gate.test.mjs` (Plan 05) run together to guard the inversion across both filterQuestion consumers. Until both worktrees merge, `tsc -b --noEmit` will show errors in `useQuestions.ts` because Plan 02 changed `filterQuestion`'s signature; that is expected and resolves at orchestrator merge time.
- **CHAT consumer of the BLOCKED_MALICIOUS code** — `useQuestions.askStreaming` is the primary consumer through the React hook; any direct callers of `questionService.ask` (currently none in app code that bypass the hook, but potential future test callers) will need to handle the new error code in their switch/match.

## Self-Check: PASSED

**Files referenced:**
- `app/src/services/question.service.ts` — exists (modified).
- `app/src/types/index.ts` — exists (modified).
- `app/tests/services/question-service-pre-gate.test.mjs` — exists (created).
- `.planning/phases/47-filter-redesign-off-topic-malicious-prompt-prevention/47-05-SUMMARY.md` — this file (created).

**Commits referenced:**
- `b82684f7` — present in `git log --oneline`.
- `17f99230` — present in `git log --oneline`.
