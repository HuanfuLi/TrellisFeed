---
phase: 35-fix-the-dynamic-system-prompt-issue
verified: 2026-04-29T13:00:45Z
status: passed
score: 7/7 must-haves verified
re_verification: false
gaps: []
---

# Phase 35: fix the dynamic-system-prompt issue — Verification Report (Phase Close)

**Phase Goal:** Move the per-turn `formatCandidateContextPack(candidatePack)` interpolation out of the `useQuestions.ts:askStreaming` system prompt into a tail-position assistant message so the provider's KV-cache prefix covers the full conversation history (system + append-only history) instead of breaking at the dynamic-content byte. Adds source-reading invariant test, CLAUDE.md load-bearing-rule section, and project-wide `chatStream`/`chatCompletion` audit confirming all other call sites are intentionally one-shot.

**Verified:** 2026-04-29T13:00:45Z
**Status:** passed
**Re-verification:** No — initial verification

**Filename note:** This file is `35-VERIFICATION-PHASE-CLOSE.md` (NOT `35-VERIFICATION.md`). Plan 04 already authored `35-VERIFICATION.md` as the project-wide chatStream/chatCompletion audit artifact (the audit IS one of the must-haves verified here). To avoid colliding with that load-bearing audit table — and to keep both artifacts independently inspectable — this verifier wrote the phase-close report to a separate file. Both files live in the same phase directory.

---

## Goal Achievement

### Observable Truths (must-haves)

| #   | Truth                                                                                            | Status     | Evidence                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | System prompt is byte-stable (identity + safety + WEB_SEARCH_TOOL_PROMPT only)                    | ✓ VERIFIED | `app/src/state/useQuestions.ts:146-152` — `systemPrompt` is a 3-element array: identity directive (line 147), safety directive (line 148), `WEB_SEARCH_TOOL_PROMPT` (line 149). Joined `.filter(Boolean).join('\n')`. Zero references to `candidatePack` / `formatCandidateContextPack`. |
| 2   | Pass 1 + Pass 2 share the same tail-assistant context message                                    | ✓ VERIFIED | `useQuestions.ts:179` (Pass 1) and `:239` (Pass 2) both contain `{ role: 'assistant', content: assistantContextMessage }`. Both placed AFTER `...historyMessages` (lines 178, 238) and BEFORE `{ role: 'user', content }` (lines 180, 240).                                              |
| 3   | Same `assistantContextMessage` closure variable used in both passes                              | ✓ VERIFIED | Single declaration at `useQuestions.ts:162`. Two consumption sites (Pass 1 line 179, Pass 2 line 239). Single closure value computed once per `askStreaming` call from `formatCandidateContextPack(candidatePack)`. Pass1→Pass2 prefix-cache continuity preserved.                       |
| 4   | Source-reading invariant test exists and passes                                                  | ✓ VERIFIED | `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (137 lines). 5 `it()` blocks, all green: `tests 5 / pass 5 / fail 0 / duration_ms 58.564`. Hotfix commit `22a5162e` relaxed the user-turn regex to handle `{ role: 'user', content }` shorthand — now pattern-resilient. |
| 5   | CLAUDE.md (project root) has the new load-bearing section                                        | ✓ VERIFIED | `/Users/Code/EchoLearn/CLAUDE.md:257` heading `## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)`. Sits between Classification dedup (line 236) and Best practices learned in Phase 32.1 (line 291) — exactly the position D-06 specified.                  |
| 6   | Project-wide audit complete                                                                      | ✓ VERIFIED | `35-VERIFICATION.md` (Plan 04 audit, 158 lines). 26 chatStream/chatCompletion sites enumerated across 14 files. All 9 named files from D-05 covered (rows 1-23). Phase 23 append-only descent re-verified intact. New finding: legacy `question.service.ts:230` documented as deferred.  |
| 7   | No regressions in prior-phase invariant tests                                                    | ✓ VERIFIED | All 6 prior-phase invariant test files pass: `tests 25 / pass 25 / fail 0 / duration_ms 129.795`. Locale-abort, classification-dedup, ChatInput flex-shrink, root horizontal clip, SwipeTabContainer resize-guard, post-essay.service all green.                                         |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                                                            | Expected                                                                       | Status     | Details                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/src/state/useQuestions.ts`                                                                     | Refactored `askStreaming` with static system prompt + tail assistant context  | ✓ VERIFIED | Modified (commit `5f27f26a`). 348 lines total. systemPrompt at line 146-152 (3-element static), assistantContextMessage at line 162, both passes wired correctly.                              |
| `app/tests/state/useQuestions-system-prompt-stability.test.mjs`                                     | Source-reading invariant test (5 it blocks)                                    | ✓ VERIFIED | Created (commit `bfffc8e4`). 137 lines. All 5 it() blocks pass under `node --test`. Hotfix `22a5162e` healed the regex regression for `{ role: 'user', content }` shorthand.                   |
| `CLAUDE.md` (project root)                                                                          | New H2 section "Ask-chat system prompt — byte-stable across turns"             | ✓ VERIFIED | Modified (commit `9321b1dd`). 34 lines added at line 257. Contains opening rule paragraph + TypeScript code block + `### Why this exists` + `### Rules` (6 numbered items).                    |
| `.planning/phases/35-fix-the-dynamic-system-prompt-issue/35-VERIFICATION.md`                        | Project-wide audit table + must-haves rollup                                   | ✓ VERIFIED | Created (commit `8136cbf2`). 158 lines. 26-row audit table + Phase 23 descent subsidiary table + must-haves rollup + confirmed non-goals + closure section.                                    |

### Key Link Verification

| From                                                                                  | To                                                                                  | Via                                                                       | Status     | Details                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useQuestions.ts` Pass 1 array (line 175)                                             | `useQuestions.ts` Pass 2 array (line 235)                                           | shared `assistantContextMessage` closure variable (line 162)              | ✓ WIRED    | Single `const assistantContextMessage =` at line 162; referenced at line 179 (Pass 1) and line 239 (Pass 2). grep confirms: 1 declaration, 2 references.                                       |
| `useQuestions.ts` system role (lines 177, 237)                                        | `applyLocaleDirective` in `providers/llm/locale-directive.ts`                       | first message in array is `role: 'system'` so locale merge target intact   | ✓ WIRED    | Both Pass 1 and Pass 2 chatStream arrays START with `{ role: 'system', content: systemPrompt }`. `applyLocaleDirective` continues to merge `Respond in {locale}.` into that first message.    |
| CLAUDE.md (Phase 35 section, line 257)                                                | `app/src/state/useQuestions.ts`                                                     | explicit code path reference in opening paragraph + Rule 1                | ✓ WIRED    | Section opens with reference to `app/src/state/useQuestions.ts:askStreaming`. Rule 1 names `useQuestions.ts:askStreaming` as the file being guarded.                                          |
| CLAUDE.md (Phase 35 section, line 257)                                                | `app/tests/state/useQuestions-system-prompt-stability.test.mjs`                     | `tests/state/useQuestions-system-prompt-stability.test.mjs enforces...`   | ✓ WIRED    | Rule 1 references `tests/state/useQuestions-system-prompt-stability.test.mjs` by filename, names it as the source-reading negative-assertion enforcer.                                       |

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable               | Source                                                                                                                  | Produces Real Data | Status      |
| --------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------- |
| `useQuestions.ts` askStreaming    | `assistantContextMessage`   | `formatCandidateContextPack(candidatePack)` at line 162; `candidatePack` from `buildCandidateContextPack(content, store)` at line 138 | ✓ Yes              | ✓ FLOWING   |
| `useQuestions.ts` askStreaming    | `historyMessages`           | `(sessionHistory ?? []).map(...)` at line 165-169; `sessionHistory` is the 4th param from `AskScreen.tsx:289`           | ✓ Yes              | ✓ FLOWING   |
| `useQuestions.ts` askStreaming    | `systemPrompt`              | Static array at line 146-152; bytes stable across turns by construction                                                 | ✓ Yes (byte-stable) | ✓ FLOWING   |

All three data inputs into the chatStream array flow correctly. The static system prompt is intentionally byte-stable (no per-turn variation), the history messages flow from the parent `AskScreen`, and the assistant context message is freshly computed per turn from the live `candidatePack`. The behavior of `formatCandidateContextPack` is unchanged from pre-refactor — only its message-array position moved.

### Behavioral Spot-Checks

| Behavior                                                                              | Command                                                                                                                                                                                                                                                                                                                  | Result                                              | Status |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------ |
| Phase 35 invariant test passes                                                        | `cd app && node --test tests/state/useQuestions-system-prompt-stability.test.mjs`                                                                                                                                                                                                                                       | tests 5 / pass 5 / fail 0 / duration_ms 58.564     | ✓ PASS |
| Phase 27 D-22 abort plumbing test passes (verifies signal threading into BOTH passes) | `cd app && node --test tests/state/useQuestions-locale-abort.test.mjs`                                                                                                                                                                                                                                                  | included in 6-test bundle: tests 25 / pass 25 / fail 0 | ✓ PASS |
| Six prior-phase invariant tests bundle clean (no regressions)                         | `cd app && node --test tests/state/useQuestions-locale-abort.test.mjs tests/services/classification-dedup.test.mjs tests/components/ChatInput.flex-shrink.test.mjs tests/layout/root-horizontal-clip.test.mjs tests/components/SwipeTabContainer.resize-guard.test.mjs tests/services/post-essay.service.test.mjs` | tests 25 / pass 25 / fail 0 / duration_ms 129.795 | ✓ PASS |
| TypeScript clean                                                                      | `cd app && npx tsc -b --noEmit`                                                                                                                                                                                                                                                                                          | exit 0, no output                                   | ✓ PASS |
| systemPrompt const has 3 elements only                                                 | `grep -nE "role: 'system'\|role: 'assistant', content: assistantContextMessage\|const assistantContextMessage\|formatCandidateContextPack" app/src/state/useQuestions.ts`                                                                                                                                                  | 1 import, 2 comments, 1 var assignment, 2 system roles, 2 assistant-tail refs (no `formatCandidateContextPack` inside any role:'system' content) | ✓ PASS |

All five behavioral spot-checks pass. The structural source-reading test gives durable regression protection without requiring a paid-API run.

### Requirements Coverage

Phase 35 has `phase_req_ids: null` — no roadmap REQ-IDs map to this phase. All four plan frontmatters use `requirements: []`. This is correct per the phase's structural-quality scope decision (it's a refactor of a load-bearing pattern, not a feature delivering a roadmap requirement). No requirements coverage table needed.

### Anti-Patterns Found

None. The refactor is a single-file mechanical move (~20 lines net), the test follows the established source-reading pattern, the CLAUDE.md addition mirrors adjacent load-bearing sections, and the audit doc is templated cleanly. No TODO / FIXME / placeholder content; no empty implementations; no hardcoded stubs.

A grep for `formatCandidateContextPack` in `useQuestions.ts` confirms exactly 4 occurrences:
- Line 7: import
- Line 141: comment ("// The per-turn formatCandidateContextPack(candidatePack) interpolation lives in")
- Line 159: comment ("// case still emits this message — formatCandidateContextPack returns the")
- Line 162: live use inside `assistantContextMessage` template literal

None of these occurrences fall within 200 chars of a `role: 'system'` marker — the negative invariant test enforces this and passes.

### Human Verification Required

None expected for this phase. Phase 35 is structural — the contract is observable via source-reading + invariant test. The empirical Anthropic `cache_read_input_tokens > 0` observation is documented as deferred-but-optional in `35-VERIFICATION.md` Empirical KV-cache section; per Plan 04 the structural source-reading test is sufficient regression protection without the empirical run.

### Gaps Summary

No gaps. All 7 must-haves verified statically:

1. ✓ System prompt is byte-stable (3-element static array at `useQuestions.ts:146-152`)
2. ✓ Pass 1 + Pass 2 share the same tail-assistant context message at the same array position
3. ✓ Same `assistantContextMessage` closure variable referenced from both passes (1 declaration, 2 uses)
4. ✓ Source-reading invariant test exists and passes (5/5 it blocks green)
5. ✓ CLAUDE.md has the new load-bearing section, positioned correctly
6. ✓ Project-wide audit complete (`35-VERIFICATION.md`, 26 sites enumerated, Phase 23 descent re-verified)
7. ✓ No regressions in prior-phase invariant tests (6 files / 25 tests / 25 passing / 0 failing)

The healed test regression (commit `22a5162e` regex hotfix) is a closed item, not an outstanding gap. The empirical cache-hit observation is a deferred-but-optional NICE-TO-HAVE that does not block phase close-out per Plan 04 Empirical-verification section.

### Plan-by-Plan Completion Status

| Plan | Title                                                                                                  | Commit       | Files                                                                                                                              | Status      |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 01   | Refactor askStreaming to byte-stable system prompt + tail assistant context message                    | `5f27f26a`   | `app/src/state/useQuestions.ts`                                                                                                    | ✓ COMPLETE  |
| 02   | Source-reading invariant guard for system-prompt stability                                             | `bfffc8e4` (+ hotfix `22a5162e`) | `app/tests/state/useQuestions-system-prompt-stability.test.mjs`                                                                    | ✓ COMPLETE  |
| 03   | Add CLAUDE.md load-bearing-rule section for Ask-chat system-prompt byte-stability                       | `9321b1dd`   | `CLAUDE.md`                                                                                                                        | ✓ COMPLETE  |
| 04   | Project-wide chatStream/chatCompletion audit + Phase 35 verification rollup                             | `8136cbf2`   | `.planning/phases/35-fix-the-dynamic-system-prompt-issue/35-VERIFICATION.md`                                                       | ✓ COMPLETE  |

Documentation-in-three-places (Phase 32.1 lesson #8) is fully landed:
1. ✓ Code-site inline comment block at `useQuestions.ts:140-145` and `:154-161` (Plan 01)
2. ✓ Source-reading test at `tests/state/useQuestions-system-prompt-stability.test.mjs` (Plan 02)
3. ✓ CLAUDE.md load-bearing section at line 257 (Plan 03)

The triple guard structurally prevents the two opposite regressions (re-introducing dynamic content into the system prompt OR deleting the assistant-tail context message thinking it's dead code).

---

*Phase: 35-fix-the-dynamic-system-prompt-issue*
*Verified: 2026-04-29T13:00:45Z*
*Verifier: Claude (gsd-verifier)*
