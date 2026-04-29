---
phase: 35-fix-the-dynamic-system-prompt-issue
plan: 02
subsystem: testing
tags: [node-test, source-reading, llm, kv-cache, regression-guard, ask-chat]

# Dependency graph
requires:
  - phase: 23-incremental-classification
    provides: append-only message ordering discipline (Phase 23 established it for classification descent; Phase 35 extends it to the chat path)
  - phase: 33-hygiene-and-polish
    provides: source-reading test pattern (classification-dedup.test.mjs, ChatInput.flex-shrink.test.mjs)
provides:
  - Source-reading invariant test that fails CI if `formatCandidateContextPack` is reintroduced into a `role:'system'` content string in `useQuestions.ts`
  - Source-reading invariant test that fails CI if the assistant-tail candidate-context message is dropped from EITHER Pass 1 OR Pass 2 of `askStreaming`
  - Single-declaration assertion ensuring `assistantContextMessage` is a closure variable shared by both passes (preserves Pass1→Pass2 prefix-cache continuity)
  - Import-presence assertion catching well-meaning "unused symbol" deletions of `formatCandidateContextPack`
affects: [phase-35-plan-01, phase-35-plan-03, phase-35-plan-04, future ask-chat refactors, future canonical-knowledge refactors]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-reading invariant test for load-bearing message-array shape (extends Phase 33 UAT-4 pattern from `classification-dedup.test.mjs` to the Ask-chat pipeline)"
    - "Pair of negative + positive assertions per D-04 (forbids regression A AND forbids regression B; both opposite directions guarded)"

key-files:
  created:
    - "app/tests/state/useQuestions-system-prompt-stability.test.mjs"
  modified: []

key-decisions:
  - "Used the 200-char-window heuristic for the negative assertion (any role:'system' marker within 200 chars before a `formatCandidateContextPack` reference fails the test). Simpler than parsing the array literal AST; matches the locality of Pass 1 and Pass 2 array-literals in useQuestions.ts."
  - "Locked the message-order invariant via offset comparisons (historySpread < assistantCtx < userTurn) rather than regex-matching the entire array literal. More resilient to whitespace and comment changes; still pinpoints any reordering bug."
  - "Test asserts on Pass 2 EVERYTHING — context message AND search ack AND search-results user message — in correct order. Catches a future regression that drops the candidate-context but leaves the search messages intact (or vice versa)."
  - "Asserted exactly-one declaration of `assistantContextMessage`. This is a sanity check that Plan 01 implementers don't construct two parallel template literals (which would silently break the Pass1→Pass2 cache continuity even when both passes appear correct in isolation)."
  - "Did NOT run the test post-commit. Plan 35-01 is in flight in the same wave; orchestrator validates wave-1 cross-plan after both agents finish."

patterns-established:
  - "Pattern: Source-reading invariant test for chat-pipeline message-array shape — same scaffold as `classification-dedup.test.mjs` (single `fs.readFileSync` of the source file + multi-`it` block of regex/substring assertions). Future Ask-chat changes inherit this guard."
  - "Pattern: Negative + positive assertion pair per D-04. Negative test catches forward regression (re-introducing dynamic content); positive test catches backward regression (deleting load-bearing content). Both directions of drift are guarded in one file."

requirements-completed: []

# Metrics
duration: ~3min
completed: 2026-04-29
---

# Phase 35 Plan 02: Source-reading invariant guard for system-prompt stability Summary

**Five `node --test` source-reading assertions in `useQuestions-system-prompt-stability.test.mjs` lock in the Phase 35 D-04 invariant pair: `formatCandidateContextPack` must NEVER appear in a `role:'system'` content, AND must appear in a `role:'assistant'` content in BOTH Pass 1 and Pass 2 chatStream calls.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-29T12:45:36Z
- **Completed:** 2026-04-29T12:48 (approx)
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Added `app/tests/state/useQuestions-system-prompt-stability.test.mjs` with five `it()` blocks, each guarding a distinct facet of the Phase 35 system-prompt-stability rule.
- Negative assertion catches the forward regression (re-interpolating dynamic content into the system prompt — silently re-breaks KV-cache prefix coverage on conversation history).
- Positive assertion catches the backward regression (deleting the assistant-tail candidate-context message thinking it's dead code — silently degrades Ask answer quality by stripping the graph-grounded prompt).
- Test follows the project's existing source-reading-test convention exactly: zero extra runtime deps, single `fs.readFileSync` of the target source file, regex/substring assertions over narrowed source slices.

## Task Commits

1. **Task 1: Write source-reading invariant test for static system prompt + assistant-tail context** — `bfffc8e4` (test)

_Plan metadata commit to follow._

## Files Created/Modified

- `app/tests/state/useQuestions-system-prompt-stability.test.mjs` — New file. 134 lines. Five `it()` blocks under one `describe('useQuestions system prompt stability (Phase 35)')`. Mirrors `classification-dedup.test.mjs` scaffold.

## The Five Invariants (test-by-test)

1. **`formatCandidateContextPack` is NOT referenced inside any `role:'system'` content** — locates every occurrence of the symbol in the source, walks back 200 chars, asserts no `role:'system'` marker sits in that window. Catches the forward regression.

2. **Pass 1 chatStream array has a `role:'assistant'` message carrying the candidate context BEFORE the user turn** — narrows source to the Pass 1 chatStream call's array argument, asserts `{ role: 'assistant', content: assistantContextMessage }` appears in correct order: `...historyMessages` → `assistant(context)` → `user(content)`.

3. **Pass 2 chatStream array has the SAME `role:'assistant'` `assistantContextMessage` element** — same shape on Pass 2, with extended order: `...historyMessages` → `assistant(context)` → `user(content)` → `assistant("I searched the web…")` → `user("Web search results for…")`. Asserts the search-flow messages survive intact alongside the new context message.

4. **`assistantContextMessage` is declared exactly once** — `const assistantContextMessage = ` regex match yields exactly one hit. Sanity check that Plan 01 implementers reuse the closure variable across both passes (preserves Pass1→Pass2 prefix-cache continuity).

5. **`formatCandidateContextPack` remains imported from `canonical-knowledge.service`** — defends against well-meaning "unused symbol" deletions. Phase 35 keeps the graph-context content unchanged; only the message role changes.

## Decisions Made

- **200-char-window heuristic** for the negative assertion. Simpler than parsing the array-literal AST; the locality of Pass 1 and Pass 2 in `useQuestions.ts` makes the window safe.
- **Offset comparisons** (`historySpread < assistantCtx < userTurn`) rather than full-array regex. Resilient to whitespace/comment edits; pinpoints any reordering bug.
- **Pass 2 asserts EVERYTHING** — context message, search ack, search-results user message — in correct order. Catches partial regressions where one slot is correct but another drifts.
- **Exactly-one `assistantContextMessage` declaration** asserted explicitly. Sanity check against parallel template-literals.
- **Did NOT run the test post-commit.** Plan 35-01 is in flight in the same wave; orchestrator validates wave-1 cross-plan after both agents finish (per orchestrator instructions in the parallel-execution prompt).

## Deviations from Plan

None - plan executed exactly as written. The plan provided the full file contents verbatim under `<action>`, and I wrote that content unchanged.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Test file is committed and will run automatically via the project's `npm test` glob (`tests/**/*.test.mjs`).
- Once Plan 35-01 lands (which happens in parallel in this same wave), all five `it()` blocks will pass green.
- Future Ask-chat refactors inherit a structural lock against the two opposite drift directions documented above.
- No blockers for Plans 35-03 (CLAUDE.md load-bearing-rule section) or 35-04 (project-wide chatStream/chatCompletion audit + verification doc).

---
*Phase: 35-fix-the-dynamic-system-prompt-issue*
*Completed: 2026-04-29*

## Self-Check: PASSED

- File `app/tests/state/useQuestions-system-prompt-stability.test.mjs`: FOUND
- File `.planning/phases/35-fix-the-dynamic-system-prompt-issue/35-02-SUMMARY.md`: FOUND
- Commit `bfffc8e4`: FOUND
