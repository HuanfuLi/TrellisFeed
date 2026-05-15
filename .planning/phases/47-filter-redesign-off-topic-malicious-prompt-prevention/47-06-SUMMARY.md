---
phase: 47-filter-redesign-off-topic-malicious-prompt-prevention
plan: 06
subsystem: filter
tags:
  - filter
  - override
  - askscreen
  - d-06
  - filter-05

# Dependency graph
requires:
  - phase: 47-04
    provides: useQuestions pre-LLM filter gate + malicious-block sentinel + classifyAndAnchorIncremental fire-and-forget pattern verbatim at useQuestions.ts:373-375
  - phase: 47-05
    provides: question.service.ask pre-LLM gate + patchQuestion kept verbatim (non-modification) so Plan 06 has a clean call site to wire the override re-fire from AskScreen
provides:
  - AskScreen.handleQuestionOverride fires classifyAndAnchorIncremental after patchQuestion({flagged: false}) so the un-flagged question actually enters the mind map (closes D-06 gap; completes FILTER-05)
  - Source-reading regression guard (6 cases) for the override re-fire wire-up + patchQuestion non-modification invariant
affects:
  - 47-09 (eval set will run against the now-complete override-restoration contract; an overridden question is no longer a structural exclusion from the graph)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Override re-fire pattern: when a Phase 47 pre-gate decision is reversed by user override, re-run the classification pipeline at the call site of the reversal — NOT inside the persistence helper. patchQuestion has 14+ unrelated callers; wrapping it would re-fire classification on every patch."
    - "Source-reading test slice via 'next sibling const' end-marker — pins the slice to a specific named callback (handleDeleteSession) rather than a generic '\\n  const ' which would shift if the file is reorganized."

key-files:
  created:
    - app/tests/screens/AskScreen-override-refire.test.mjs
  modified:
    - app/src/screens/AskScreen.tsx

key-decisions:
  - "Wire the re-fire at AskScreen.handleQuestionOverride (the override decision site), NOT inside questionService.patchQuestion. patchQuestion has 14+ unrelated call sites (graph service, embedding backfill, anchor commits, etc.) — spurious classification fires on every patch would be a correctness regression."
  - "Re-fire is gated on settings.llm.isConfigured (RESEARCH Pitfall 4). A fresh-install user with no API key would otherwise see an unexplained network error toast immediately after a successful override; graceful skip with console.warn keeps the user's success toast as the last surface."
  - "No abort signal passed to classifyAndAnchorIncremental (RESEARCH §'Pattern 4' line 510). User-initiated overrides are synchronous from the user's perspective; LOCALE_CHANGED cancellation is not a meaningful concern at this site."
  - "No eventBus.emit({type: 'GRAPH_UPDATED'}) at the override call site. commitClassificationResult inside canonical-knowledge.service.ts already emits GRAPH_UPDATED at the end of its run (CLAUDE.md 'Event bus — unified GRAPH_UPDATED'); double-emit would race subscribers."
  - "Re-fire uses the verbatim fire-and-forget pattern from useQuestions.ts:373-375 — `void classifyAndAnchorIncremental(...).catch((err: unknown) => console.warn(...))` — keeping a single canonical pattern for fire-and-forget classification across the codebase."

patterns-established:
  - "Pattern: gate-reversal re-fire — pre-gate decisions that exclude state from a downstream pipeline (graph, retrieval, podcast, review) must have an explicit re-fire at the override call site to complete the user-perceived contract ('save anyway' means save anyway, not 'save the flag flip')."

requirements-completed:
  - FILTER-05

# Metrics
duration: ~20min (autonomous tasks); checkpoint pending UAT before plan completion
completed: PENDING (checkpoint:human-verify awaiting user UAT — see Task 3 below)
---

# Phase 47 Plan 06: D-06 Override Re-Fire Summary

**handleQuestionOverride now fires classifyAndAnchorIncremental after the flag flip, completing the FILTER-05 "propagates to durable-knowledge consumers" contract that D-04+D-05 left half-built.**

## Status

**PARTIAL — checkpoint pending.** Tasks 1 and 2 (autonomous) complete; Task 3 is a `checkpoint:human-verify` Phase-47 integration sign-off that requires the operator to manually exercise the malicious-block surface, the override re-fire end-to-end, and i18n parity in 4 locales. SUMMARY will be promoted to final after the checkpoint clears.

## Performance (autonomous tasks)

- **Duration:** ~20 min (Tasks 1+2 only)
- **Started:** 2026-05-15T~current
- **Tasks autonomous:** 2 of 3 (Task 3 is checkpoint:human-verify)
- **Files modified:** 1 (`app/src/screens/AskScreen.tsx`)
- **Files created:** 1 (`app/tests/screens/AskScreen-override-refire.test.mjs`)

## Accomplishments

- **D-06 gap closure:** `AskScreen.handleQuestionOverride` now fires `classifyAndAnchorIncremental(question, allQuestions, llmConfig)` after the existing `patchQuestion({flagged: false})` + success toast. The un-flagged question now genuinely enters the mind map, not just the question store.
- **FILTER-05 contract completed:** "user can override the off-topic flag on any individual exchange; the override persists across reloads AND propagates to durable-knowledge consumers (graph, retrieval, podcast, review)" — the "propagates" half is now structurally true.
- **6-case source-reading guard:** future maintainers cannot remove the re-fire, drop the `void` prefix, drop `.catch`, drop the `isConfigured` guard, add an `await`, add a duplicate `eventBus.emit('GRAPH_UPDATED')`, or move the re-fire into `patchQuestion` without breaking at least one assertion in `tests/screens/AskScreen-override-refire.test.mjs`.

## Task Commits

1. **Task 1 RED (test):** `42c7bc37` — `test(47-06): add failing source-reading test for D-06 override re-fire` — 6 assertions; 3 fail (the wire-up isn't yet there), 3 pass as negative invariants
2. **Task 1 GREEN (impl):** `067cde0a` — `feat(47-06): wire D-06 override re-fire in handleQuestionOverride` — adds re-fire block inside the existing `if (shouldSave)` branch; imports `classifyAndAnchorIncremental`; all 6 assertions now pass; `tsc -b --noEmit` clean
3. **Task 2** — deliverable (the test file) was created in the RED phase of Task 1 and committed there; no separate commit
4. **Task 3** — checkpoint:human-verify; awaiting operator UAT before final plan-metadata commit

## Files Created/Modified

- `app/src/screens/AskScreen.tsx` — added `classifyAndAnchorIncremental` import; appended D-06 re-fire block (33 lines) inside `handleQuestionOverride`'s `if (shouldSave)` branch
- `app/tests/screens/AskScreen-override-refire.test.mjs` — new source-reading test with 6 `it` cases mirroring the slice-by-anchor pattern from `HomeScreen.exploredAnchors-resync.test.mjs`

## Diff Stat

```
app/src/screens/AskScreen.tsx              | +34 -1 (1 import + 33 lines inside if-shouldSave)
app/tests/screens/AskScreen-override-refire.test.mjs | +121 (new file)
```

## Source-reading test cases (Task 2 deliverable)

| # | Case | Type |
|---|------|------|
| 1 | `handleQuestionOverride` references `classifyAndAnchorIncremental(` | positive |
| 2 | The call uses `void` prefix + `.catch(` (fire-and-forget) | positive |
| 3 | The slice contains `(settings.llm.isConfigured\|isConfigured)` (guard present) | positive |
| 4 | The slice does NOT use `await classifyAndAnchorIncremental` | negative |
| 5 | The slice does NOT `eventBus.emit({type: 'GRAPH_UPDATED'...)` | negative |
| 6 | `patchQuestion` method body in `question.service.ts` does NOT reference `classifyAndAnchorIncremental` | negative (cross-file) |

All 6 cases PASS post-Task-1.

## Decisions Made

See `key-decisions` in frontmatter. Plan-driven; no deviations.

## Deviations from Plan

None — plan executed exactly as written. The 4 load-bearing invariants in the prompt (D-06 re-fire wired at AskScreen, not patchQuestion; isConfigured-gated; fire-and-forget no-await with .catch; no abort signal; no new eventBus.emit; ChatMessage override UI untouched) all hold.

## Issues Encountered

None during autonomous execution. One environment note: this worktree had no local `app/node_modules`; I symlinked `app/node_modules → /Users/Code/EchoLearn/app/node_modules` to run `node_modules/.bin/tsc -b --noEmit`. The symlink is git-ignored (`app/.gitignore:10:node_modules`). No source code or commits affected.

## Checkpoint Pending (Task 3)

Task 3 is `checkpoint:human-verify gate="blocking"` — Phase 47 final integration sign-off. The operator must:

1. Run `cd app && npm test` — full suite green
2. Run the Phase 47 quick-run combo (`filter-classifier.unit`, `filter-classifier.eval`, `filter-cache`, `llm-bracketing`, `tts-bracketing-exempt`, `useQuestions-pre-gate`, `useQuestions-system-prompt-stability`, `question-service-pre-gate`, `AskScreen-override-refire`, `bundle-parity`) — combined runtime ~5-10 s
3. Manual UAT — anchor seed 1: "How are you doing?" → answered conversationally; flagged badge appears; does NOT enter mind map; "Save anyway" → DOES enter mind map (D-06 closure verified end-to-end)
4. Manual UAT — anchor seed 2: "What is a system prompt?" → answered substantively; NO badge; enters mind map directly
5. Manual UAT — malicious surface: jailbreak template → inline malicious-block message; NO LLM call; NO question persists; NO override buttons (D-01 + D-02)
6. Manual UAT — locale switching mid-flight cancels cleanly (Phase 35 D-22 + D-19)
7. Manual UAT — malicious-block surface renders in zh, es, ja (Plan 01 bundle parity)

Resume signal: operator types "approved" or describes the failing check.

## D-01..D-19 + FILTER-01..05 coverage (full Phase 47)

| Decision / Requirement | Plan(s) | Status |
|---|---|---|
| FILTER-01 (filter true off-topic) | 47-01, 47-02, 47-04, 47-05 | DONE |
| FILTER-02 (allow legit LLM questions) | 47-01, 47-02 (hybrid + corpus) | DONE |
| FILTER-03 (block malicious before LLM) | 47-01, 47-04, 47-05 | DONE |
| FILTER-04 (provider bracketing) | 47-03 | DONE |
| FILTER-05 (override propagates to graph) | 47-04 + **47-06 (this plan)** | DONE (pending checkpoint UAT) |
| D-01 (three-label malicious/off-topic/on-topic) | 47-02, 47-04, 47-05 | DONE |
| D-02 (no override on malicious) | 47-04 (sentinel) + 47-06 (no surface) | DONE |
| D-03 (off-topic surfaced as warning badge, not block) | 47-04 (kind=undefined for off-topic) | DONE |
| D-04 (existing override UI unchanged) | 47-04 + 47-06 (negative-asserted) | DONE |
| D-05 (override persists across reloads) | 47-04 + 47-05 (patchQuestion path) | DONE |
| D-06 (override re-fires classification) | **47-06 (this plan — closes the gap)** | DONE |
| D-07..D-12 (filter implementation details) | 47-01, 47-02 | DONE |
| D-13..D-17 (provider bracketing) | 47-03 | DONE |
| D-18 (pre-LLM gate inversion) | 47-04, 47-05 | DONE |
| D-19 (abort signal threading) | 47-04, 47-05 | DONE |

## Next Phase Readiness

After Task 3 sign-off, Phase 47 is complete and Phase 48 can proceed.

Blockers / concerns: none from this plan. The operator's checkpoint UAT is the gate; failures there route back to triage (regression fix vs. follow-up plan).

## Self-Check

`## Self-Check: PASSED`

- File `app/src/screens/AskScreen.tsx` modified: FOUND
- File `app/tests/screens/AskScreen-override-refire.test.mjs` created: FOUND
- File `app/src/services/question.service.ts` UNCHANGED in this plan: VERIFIED via `git diff` (no entries in the plan's commit range for that file)
- Commit `42c7bc37` (test RED): FOUND
- Commit `067cde0a` (feat GREEN): FOUND
- Tests: 6/6 pass (`node --test tests/screens/AskScreen-override-refire.test.mjs`)
- Typecheck: clean (`node_modules/.bin/tsc -b --noEmit` — no `error TS` lines)

---
*Phase: 47-filter-redesign-off-topic-malicious-prompt-prevention*
*Completed: PENDING (Task 3 checkpoint:human-verify)*
