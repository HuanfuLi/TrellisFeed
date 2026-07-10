---
phase: 35-fix-the-dynamic-system-prompt-issue
plan: 04
subsystem: docs
tags: [verification, audit, llm, kv-cache, chatStream, chatCompletion, append-only]

# Dependency graph
requires:
  - phase: 35-fix-the-dynamic-system-prompt-issue
    provides: "Plan 01 (useQuestions refactor — already landed in Wave 1) — verified statically by source-read"
  - phase: 23 (incremental classification + ask rate limiter)
    provides: "Append-only message-array discipline for multi-step LLM pipelines (verified intact in canonical-knowledge.service.ts)"
provides:
  - "Project-wide audit of every chatStream/chatCompletion call site (26 sites across 14 files)"
  - "One-shot vs append-only classification with file:line citations for each site"
  - "Phase 35 must-haves verification rollup table (4/8 verified statically; 4/8 pending close-out regression sweep)"
  - "Confirmed non-goals section listing the 5 deferred items (4 from CONTEXT.md + 1 NEW finding from this audit)"
  - "Surfaced new deferred item: question.service.ts:230 legacy non-streaming ask path is multi-turn-shaped but unreachable from any screen"
affects:
  - "Phase 35 close-out (must-haves table is the flip-checklist)"
  - "Future contributors evaluating any non-useQuestions chatStream call site (audit row tells them why it was left alone)"
  - "Future hygiene phase considering deletion of question.service.ts legacy ask path (audit row 20)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audit-table verification doc with file:line citations + acceptance-criteria-driven structure"
    - "Per-site one-shot vs append-only classification format for LLM call-site reviews"

key-files:
  created:
    - .planning/phases/35-fix-the-dynamic-system-prompt-issue/35-VERIFICATION.md
  modified: []

key-decisions:
  - "Audit grep yields 26 effective call sites across 14 files (28 raw matches minus 2 function declarations in providers/llm/index.ts) — well above the CONTEXT.md D-05 floor of 8."
  - "Phase 23 append-only classification descent in canonical-knowledge.service.ts:1041-1170 is fully intact — Phase 35 needs no changes there."
  - "useQuestions.ts Pass 1 (line 175) and Pass 2 (line 235) both reference assistantContextMessage (declared once at line 162) — Plan 01 refactor verified by source-read."
  - "Surfaced new finding NOT in CONTEXT.md D-05: question.service.ts:230 legacy non-streaming ask is multi-turn-shaped but unreachable from any screen (AskScreen comment line 15 + grep on screens/ both confirm). Documented as deferred non-goal."
  - "Empirical KV-cache verification (cache_read_input_tokens > 0 on Anthropic) marked NOT-RUN as acceptable — structural source-reading test in Plan 02 gives sufficient regression protection."

patterns-established:
  - "Verification doc structure: Scope confirmation → Project-wide audit table (with grep enumeration source) → Subsidiary multi-step audit (Phase 23 descent) → Must-haves rollup → Empirical-verification section → Cross-cutting confirmation → Confirmed non-goals → Closure"
  - "Audit table includes 'Phase 35 action' column distinguishing REFACTORED LANDED vs NO CHANGE vs PENDING — flip-ready for close-out"

requirements-completed: []

# Metrics
duration: ~12min
completed: 2026-04-29
---

# Phase 35 Plan 04: Project-wide chatStream Audit + Phase 35 Verification Rollup Summary

**26-row audit of every chatStream/chatCompletion call site across 14 files, plus a verifiable must-haves table that flips to ☑ during phase close-out — confirms only useQuestions.askStreaming carries multi-turn KV-cache prefix benefit, all other sites are intentionally one-shot.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-29T~14:30Z (agent spawn time)
- **Completed:** 2026-04-29 (commit `8136cbf2`)
- **Tasks:** 1 (single auto task per plan)
- **Files modified:** 1 (created `35-VERIFICATION.md`)

## Accomplishments

- Project-wide grep enumeration of all `chatStream(` / `chatCompletion(` call sites — 28 raw matches across 14 files, 26 effective call sites after subtracting the 2 function-declaration lines in `providers/llm/index.ts`.
- Each call site classified as one of {multi-turn / append-only (IN SCOPE), one-shot, append-only continuation} with file:line citation and a one-line cost-benefit rationale for the Phase 35 action.
- Subsidiary audit confirmed Phase 23's append-only classification descent in `canonical-knowledge.service.ts:1041-1170` is fully intact (init + branch + new-branch-combined + cluster + anchor steps all push onto a single shared `messages` array; system message at index 0 is `PIPELINE_SYSTEM_PROMPT` const).
- Phase 35 must-haves rollup: 4/8 must-haves verified statically from source on 2026-04-29; 4/8 pending the close-out regression sweep + Plan 03 CLAUDE.md landing. Status table is now flip-ready.
- New finding: `question.service.ts:230` legacy non-streaming `ask` path is multi-turn-shaped but unreachable from any screen (AskScreen.tsx:15 has explicit "uses askStreaming exclusively" comment; grep confirms zero screen call sites). Documented as deferred non-goal — candidate for deletion in a future hygiene phase.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enumerate every chatStream/chatCompletion call site and write 35-VERIFICATION.md** — `8136cbf2` (docs)

## Files Created/Modified

- `.planning/phases/35-fix-the-dynamic-system-prompt-issue/35-VERIFICATION.md` (created, 157 lines) — Audit table + Phase 35 must-haves verification rollup + confirmed non-goals + classification-descent subsidiary audit.

## Decisions Made

- Classified `concept-feed.service.ts:937` (daily post batch generation) as **one-shot** despite having dynamic `buildGenerationPrompt(...)` interpolation — because the interpolation goes into the USER message, not the system message, and the call is one-shot per refill cycle anyway. This matches CONTEXT.md `<deferred>` rationale: dynamic system content at one-shot sites doesn't break any cache because there's no cache to break.
- Classified `question-filter.service.ts:81` as **one-shot** even though `contextInstructions` is interpolated into the system prompt (prior-question/answer hint when present). Per-call dynamism is by design — it isn't a multi-turn conversation, just a parameterized one-shot classifier.
- Marked the empirical KV-cache verification (cache_read_input_tokens > 0 on Anthropic) as `NOT-RUN` and explicitly documented why that's acceptable: the structural source-reading test in Plan 02 gives sufficient regression protection without requiring a paid-API run in production traffic.
- Set status to `in-progress` (not `verified`) because Plans 02 + 03 haven't fully landed yet; the doc flips to `verified` during Phase 35 close-out as a follow-up edit.

## Deviations from Plan

None — plan executed exactly as written. The audit grep found MORE sites than the CONTEXT.md D-05 floor of 8 (26 effective sites total), which the plan's acceptance criterion explicitly welcomed ("at least 8" — extras welcome). All 9 named files from D-05 are present in the audit table.

## Issues Encountered

None. The plan was unusually well-specified — the literal VERIFICATION.md template embedded in the plan body (lines 130-212) made authoring straightforward. The grep enumeration ran cleanly on first attempt and the 26-site enumeration mapped cleanly to the CONTEXT.md D-05 named-eight (rows 1-3 + 4-19 + 20-26).

## User Setup Required

None.

## Next Phase Readiness

- **Phase 35 close-out** is now unblocked from this plan's perspective. The must-haves rollup table at `35-VERIFICATION.md` can be flipped row-by-row as Plans 02 + 03 land and the regression sweep runs.
- Plan 02 (test file at `app/tests/state/useQuestions-system-prompt-stability.test.mjs`) already exists per `ls -la` confirmation; needs to be re-run on green CI to flip must-have row 5.
- Plan 03 (CLAUDE.md "Ask-chat system prompt — byte-stable across turns" section) hasn't landed yet; current `grep -c` returns 0 in the root CLAUDE.md. Plan 03 lands the section.
- TypeScript clean check (must-have row 7) and full test baseline preserved (must-have row 8) need re-running during the close-out regression sweep.

## Self-Check: PASSED

- ✓ `35-VERIFICATION.md` exists at expected path (157 lines)
- ✓ `35-04-SUMMARY.md` exists at expected path
- ✓ Commit `8136cbf2` exists in git log on branch `gsd/phase-33-hygiene-and-polish`
- ✓ All 8 acceptance-criteria grep checks pass (file exists, audit heading, ≥8 file:line citations, anchor row, must-haves heading, ≥9 service names, 0 placeholders, trailing metadata)

---
*Phase: 35-fix-the-dynamic-system-prompt-issue*
*Completed: 2026-04-29*
