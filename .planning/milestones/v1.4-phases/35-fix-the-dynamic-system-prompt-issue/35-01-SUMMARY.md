---
phase: 35-fix-the-dynamic-system-prompt-issue
plan: 01
subsystem: state
tags: [llm, kv-cache, useQuestions, chat, ask, system-prompt, refactor]

# Dependency graph
requires:
  - phase: 23-incremental-classification-pipeline
    provides: append-only message ordering for KV-cache (canonical-knowledge.service.ts), the discipline this phase extends to the chat path
  - phase: 27-add-i18n-l10n-support
    provides: applyLocaleDirective merger into the first system message; D-22 abort-on-LOCALE_CHANGED plumbing shared across Pass 1 + Pass 2
provides:
  - "useQuestions.askStreaming system prompt is byte-stable across chat turns within a session (no per-turn formatCandidateContextPack interpolation in the system role)"
  - "Pass 1 and Pass 2 share an identical [system, ...history, assistant(context), user] head — Pass 2 reuses Pass 1's warm provider KV-cache prefix"
  - "Single closure variable assistantContextMessage referenced by both passes — guarantees Pass 1 and Pass 2 are byte-identical at that position"
affects: [phase-35 plan-02 source-reading invariant test, phase-35 plan-03 CLAUDE.md doc, phase-35 plan-04 chatStream/chatCompletion audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider KV-cache prefix coverage for multi-turn chat: keep system prompt byte-stable, push per-turn dynamic context into a tail assistant message after history"
    - "Single shared closure variable for cross-pass continuity (Pass 1 → Pass 2 prefix preservation)"

key-files:
  created: []
  modified:
    - app/src/state/useQuestions.ts

key-decisions:
  - "D-07 applied: emit the assistant context message even on empty pack (formatCandidateContextPack returns the byte-stable string 'No close graph candidates found.') — keeps one structural shape across turns"
  - "D-08 applied: accept the back-to-back-assistant pattern from turn 2 onward without a synthetic user-ack (major providers tolerate it; lowest token cost)"
  - "D-09 applied: keep the existing 'Knowledge graph candidate context:\\n' + formatCandidateContextPack(pack) prose template verbatim in the assistant message content — no XML wrapping, lowest diff, lowest cognitive cost"

patterns-established:
  - "Tail-position assistant message for per-turn dynamic context (Phase 35 KV-cache pattern): when a pipeline streams across multiple turns, dynamic per-turn data lives AFTER history and BEFORE the new user turn, NOT inside the system role"
  - "Inline comment block at the load-bearing site referencing CLAUDE.md + the source-reading test (Phase 32.1 lesson #8 — documentation in three places)"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-04-29
---

# Phase 35 Plan 01: Refactor askStreaming to byte-stable system prompt + tail assistant context message Summary

**Moved the per-turn `formatCandidateContextPack(candidatePack)` interpolation out of the system role and into a tail-position assistant message in `useQuestions.askStreaming` Pass 1 + Pass 2 — system prompt is now byte-stable across chat turns, restoring provider KV-cache prefix coverage for the full conversation history.**

## Performance

- **Duration:** ~5 min (single-file surgical refactor; ~20 lines net change)
- **Started:** 2026-04-29T12:45:25Z
- **Completed:** 2026-04-29T12:50:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `systemPrompt` in `askStreaming` now consists of exactly three byte-stable elements (identity directive, safety directive, `WEB_SEARCH_TOOL_PROMPT`) — zero references to `candidatePack` / `formatCandidateContextPack`.
- `assistantContextMessage` is a new single closure variable computed once per `askStreaming` call from `formatCandidateContextPack(candidatePack)`, referenced identically by both Pass 1 and Pass 2 chatStream arrays.
- Pass 1 chatStream array shape: `[system(static), ...history, assistant(context), user]`.
- Pass 2 chatStream array shape: `[system(static), ...history, assistant(context), user, assistant(web-search-ack), user(web-search-results)]` — the SAME head as Pass 1, so Pass 1's warm provider cache carries through to Pass 2 unbroken.
- `applyLocaleDirective` continues to merge `Respond in {locale}.` into the first system message — the new static `systemPrompt` remains the first system-role element in both arrays (verified by `useQuestions-locale-abort.test.mjs` still passing).
- Phase 27 D-22 abort plumbing (`abortController`, `LOCALE_CHANGED` subscriber, `signal: abortController.signal` threaded into both `chatStream` calls and `classifyAndAnchorIncremental`) is intact and untouched.
- Inline comment block `// ═══ Phase 35 — System prompt MUST be byte-stable across turns ═══` at line 140 of `useQuestions.ts` documents the rationale at the load-bearing site (Phase 32.1 lesson #8 — documentation in three places: code, CLAUDE.md (Plan 03), source-reading test (Plan 02)).

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor askStreaming to byte-stable system prompt + tail assistant context** — `5f27f26a` (refactor)

## Files Created/Modified

- `app/src/state/useQuestions.ts` — Single-file refactor:
  - Removed the `Knowledge graph candidate context:\n${formatCandidateContextPack(candidatePack)}` line from the `systemPrompt` array (now 3 elements instead of 4).
  - Added `const assistantContextMessage = ...` line below the system prompt definition.
  - Inserted `{ role: 'assistant', content: assistantContextMessage }` between `...historyMessages` and `{ role: 'user', content }` in BOTH the Pass 1 (line ~179) and Pass 2 (line ~239) chatStream call arrays.
  - Added a 6-line inline comment block above `systemPrompt` and an 8-line comment block above `assistantContextMessage` documenting the KV-cache rationale and cross-reference to CLAUDE.md / the source-reading test.

## Decisions Made

- **D-07 (planner discretion):** Emit the assistant context message even when `pack.candidates.length === 0`. `formatCandidateContextPack` returns the byte-stable string `'No close graph candidates found.'` for empty pack; emitting unconditionally keeps one structural shape across turns. Alternative (skip on empty) would break the cache the moment the first anchor lands — net token cost zero across a session.
- **D-08 (planner discretion):** Accept the back-to-back-assistant pattern from turn 2 onward (`..., user_prev, assistant_prev_reply, assistant_context, user_new`) without inserting a synthetic user-ack between the two assistant messages. Major providers (Anthropic / OpenAI / Gemini) tolerate this fine; smaller local LLMs may quirk on it but the project's primary deployment targets are the major providers. Lowest token cost. If a local-LLM regression surfaces during phase verification, we can revisit by adding a single static user-ack message — that change would still preserve byte-stability since the ack would be a constant string.
- **D-09 (planner discretion):** Keep the existing `'Knowledge graph candidate context:\n' + formatCandidateContextPack(candidatePack)` prose template verbatim — no XML tag wrapping. Rationale: lowest diff, lowest cognitive cost, no model-adherence speculation needed; the existing format already worked correctly when it was in the system prompt, so moving it verbatim into an assistant message keeps semantic continuity.

## Deviations from Plan

None — plan executed exactly as written. All three planner-discretion decisions (D-07/D-08/D-09) were applied per the `<behavior>` block in the plan.

## Issues Encountered

None. The refactor was mechanical and the test suite confirmed no behavioral regressions.

## Verification Results

Acceptance criteria from `35-01-PLAN.md` `<acceptance_criteria>`:

- [x] `tsc -b --noEmit` exits 0 (type-clean) — verified: `EXIT=0`
- [x] `node --test app/tests/state/useQuestions-locale-abort.test.mjs` exits 0 — verified: 5/5 tests pass (`tests 5 / pass 5 / fail 0`); abort flow + signal plumbing into both chatStream calls + classifyAndAnchorIncremental all intact
- [x] `formatCandidateContextPack` is referenced inside an `assistant`-role message ONLY, never inside the `systemPrompt` array literal — verified: 1 import + 2 comment occurrences + 1 use inside the `assistantContextMessage` template literal (line 162); zero occurrences inside any string assigned to a `role: 'system'` content
- [x] `grep -nE "role: 'system'" app/src/state/useQuestions.ts` returns exactly 2 occurrences — verified (line 177 = Pass 1; line 237 = Pass 2), both with `content: systemPrompt }` (the static const reference, not a template literal)
- [x] `grep -cE "role: 'assistant', content: assistantContextMessage"` returns 2 — verified (one in Pass 1 array at line 179, one in Pass 2 array at line 239)
- [x] `grep -cE "assistantContextMessage ="` returns 1 — verified (single declaration at line 162; both passes reference the same closure variable)
- [x] Inline comment block `// ═══ Phase 35 — System prompt MUST be byte-stable across turns ═══` is present immediately above the `const systemPrompt = [` line — verified at line 140
- [x] `cd app && npm test` shows the same baseline as before the refactor — verified: pre-refactor 385 pass / 29 fail vs. post-refactor 386 pass / 28 fail (improved by +1/-1; 28 remaining failures are pre-existing `ERR_IMPORT_ATTRIBUTE_MISSING` JSON-import-attribute issues unrelated to this change, documented as the persistent baseline in CLAUDE.md and prior STATE.md entries)

## Manual Verification Note (Anthropic cache headers)

Empirical confirmation that Anthropic's prompt cache hits the conversation prefix (`cache_creation_input_tokens` / `cache_read_input_tokens` in response headers) is **deferred to Phase 35's verification phase**, NOT a Plan 01 acceptance criterion. The structural source-reading invariants enforced here (system prompt byte-stable; both passes share an identical head) are sufficient evidence that the provider's implicit prefix-caching mechanism will engage. The empirical check would require a live Anthropic API call from a multi-turn Trellis chat session and is documented as a Plan 04 / `35-VERIFICATION.md` task.

## Next Phase Readiness

Plan 02 (source-reading invariant guard test) can now proceed against the live refactored file. The test asserts:
- Negative: `formatCandidateContextPack` does NOT appear inside any string assigned to a `role: 'system'` element in `useQuestions.ts`.
- Positive: `formatCandidateContextPack` DOES appear inside a `role: 'assistant'` element in BOTH chatStream calls (Pass 1 + Pass 2).

Plan 03 (CLAUDE.md load-bearing rule section) and Plan 04 (project-wide chatStream/chatCompletion audit + `35-VERIFICATION.md`) are unblocked by this plan.

## Self-Check: PASSED

Verified files exist:
- FOUND: `app/src/state/useQuestions.ts` (modified)
- FOUND: commit `5f27f26a` in `git log --oneline`

Verified acceptance grep invariants:
- FOUND: 2 × `role: 'system'` (lines 177, 237)
- FOUND: 2 × `role: 'assistant', content: assistantContextMessage` (lines 179, 239)
- FOUND: 1 × `assistantContextMessage =` (line 162)
- FOUND: `formatCandidateContextPack` inside assistantContextMessage template literal at line 162 (NOT inside any system-role content)
- FOUND: Inline comment block at line 140

Verified automated checks:
- PASSED: `tsc -b --noEmit` exit 0
- PASSED: `node --test tests/state/useQuestions-locale-abort.test.mjs` 5/5 pass
- PASSED: `npm test` baseline preserved (386 pass / 28 fail, improvement vs. pre-refactor 385/29)

---
*Phase: 35-fix-the-dynamic-system-prompt-issue*
*Completed: 2026-04-29*
