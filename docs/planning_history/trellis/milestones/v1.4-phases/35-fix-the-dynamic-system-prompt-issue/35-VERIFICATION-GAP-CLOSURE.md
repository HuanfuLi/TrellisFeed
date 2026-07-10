---
phase: 35-fix-the-dynamic-system-prompt-issue
verified: 2026-04-29T14:05:00Z
status: passed
score: 9/9 gap-closure must-haves verified
mode: gap_closure_verification
gap_source: 35-UAT.md Test 1 (severity: blocker)
plan: 35-05
notes: |
  Operator must still re-run UAT Tests 1, 2, 3 against Qwen 3.5 via LM Studio's
  OpenAI-compatible proxy on a real device. That empirical retest is observer-
  action follow-up, NOT part of this automated verification gate. Structural
  remediation is complete; empirical close-out remains pending operator action.
---

# Phase 35 Gap-Closure Verification Report

**Phase Goal (gap scope):** Restore single-turn Ask functionality on Qwen 3.5 via LM Studio's OpenAI-compatible proxy by inserting a constant byte-stable synthetic user-ack message between `...historyMessages` and the assistant context message in BOTH Pass 1 and Pass 2 of `useQuestions.askStreaming`. Preserve KV-cache prefix coverage. Extend the invariant test. Document the strict-alternation rationale in CLAUDE.md.

**Verified:** 2026-04-29
**Status:** passed
**Mode:** Gap-closure re-verification (single plan 35-05; the prior 4 plans were already verified during the phase-close run on 2026-04-29).

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                              | Status     | Evidence                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `USER_ACK_BEFORE_GRAPH_CONTEXT` constant declared exactly once                                                                     | VERIFIED   | `grep -cE "const USER_ACK_BEFORE_GRAPH_CONTEXT =" app/src/state/useQuestions.ts` returns `1` (line 165)                                                                                                                                        |
| 2   | Constant referenced as `role: 'user'` in BOTH Pass 1 and Pass 2                                                                    | VERIFIED   | `grep -cE "content: USER_ACK_BEFORE_GRAPH_CONTEXT"` = `2`; `grep -cE "role: 'user', content: USER_ACK_BEFORE_GRAPH_CONTEXT"` = `2`                                                                                                             |
| 3   | Both passes have order: `...historyMessages → user(USER_ACK) → assistant(assistantContextMessage) → user(content)`                | VERIFIED   | Pass 1 lines 190-194 + Pass 2 lines 251-255 confirmed visually; sixth invariant test asserts ordering offsets in both passes                                                                                                                  |
| 4   | New 6th invariant test passes; total 6/6 green                                                                                     | VERIFIED   | `node --test tests/state/useQuestions-system-prompt-stability.test.mjs` → `tests 6 / suites 1 / pass 6 / fail 0`                                                                                                                              |
| 5   | Existing 5 invariants still green (no regression on Phase 35 prior assertions)                                                     | VERIFIED   | Same test run: prior 5 tests all show ✔, including the original `formatCandidateContextPack NOT in role:'system'` invariant (Phase 35 plan-01 KV-cache contract preserved)                                                                    |
| 6   | CLAUDE.md Phase 35 section gained a strict-alternation paragraph                                                                   | VERIFIED   | `grep -cE "Qwen\|strict.alternation\|user.assistant.alternation" CLAUDE.md` = `1` (paragraph at line 280); `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" CLAUDE.md` = `2` (paragraph + Rules item 3); `grep -c "No user query found in messages"` = `1`  |
| 7   | No regression in cross-phase invariant tests                                                                                       | VERIFIED   | `useQuestions-locale-abort` 5/5; `classification-dedup` 8/8; `ChatInput.flex-shrink` 1/1; `root-horizontal-clip` 3/3                                                                                                                          |
| 8   | TypeScript clean                                                                                                                    | VERIFIED   | `npx tsc -b --noEmit` exit code 0                                                                                                                                                                                                              |
| 9   | Phase 35 KV-cache contract preserved (`formatCandidateContextPack` NOT inside any `role: 'system'` content)                         | VERIFIED   | grep confirms `formatCandidateContextPack` appears only at import (line 7), two comments (lines 141, 172), and the `assistantContextMessage` template literal (line 175). No proximity to either `role: 'system'` site (lines 190, 251). Test 1 of the invariant suite still green. |

**Score:** 9/9 truths verified.

### Required Artifacts

| Artifact                                                                                          | Expected                                                                                                                                                                                                                       | Status     | Details                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/src/state/useQuestions.ts`                                                                   | Constant `USER_ACK_BEFORE_GRAPH_CONTEXT = 'Here is the knowledge graph context for this turn:'` declared once near `assistantContextMessage`; threaded into Pass 1 and Pass 2 between `...historyMessages` and assistant ctx | VERIFIED   | Constant at line 165; Pass 1 array lines 188-198 (insertion at line 192); Pass 2 array lines 249-267 (insertion at line 253). 9-line rationale comment block lines 156-164.                          |
| `app/tests/state/useQuestions-system-prompt-stability.test.mjs`                                   | Sixth `it()` block asserting constant declared exactly once + ordering invariant in BOTH passes; existing 5 it() blocks unchanged                                                                                              | VERIFIED   | New it() block lines 137-184; uses regex/offset-comparison pattern matching the existing 5 invariants. `grep -cE "^\s*it\(" ...test.mjs` = `6`; `grep "Phase 35 UAT-1 strict-alternation fix"` = `1` |
| `CLAUDE.md`                                                                                       | New paragraph appended to existing Phase 35 `### Why this exists` subsection; Rules item 3 updated to mention the new constant; rest of file unchanged                                                                          | VERIFIED   | Strict-alternation paragraph at line 280 (between existing line 278 and `### Rules` heading at line 282); Rules item 3 at line 286 now references both `assistantContextMessage` AND `USER_ACK_BEFORE_GRAPH_CONTEXT`. H2 heading order preserved (Phase 35 at 257 still precedes Phase 32.1 best-practices at 293). |

### Key Link Verification

| From                                                              | To                                                                                                                  | Via                                          | Status | Details                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useQuestions.ts` Pass 1 chatStream array                         | `useQuestions.ts` Pass 2 chatStream array                                                                            | shared closure constant `USER_ACK_BEFORE_GRAPH_CONTEXT` | WIRED  | Single declaration at line 165; referenced at line 192 (Pass 1) and line 253 (Pass 2) — same closure value, byte-identical head shape across both passes preserves Pass1→Pass2 prefix-cache continuity.                          |
| Source-reading test 6th it() block                                 | `useQuestions.ts USER_ACK_BEFORE_GRAPH_CONTEXT` declaration + ordering                                              | regex source-read assertion                  | WIRED  | Test reads source via `fs.readFileSync` at line 28, then asserts `const\s+USER_ACK_BEFORE_GRAPH_CONTEXT\s*=` regex match count = 1, plus regex-based offset comparisons for both passes. Test currently green (6/6).             |
| CLAUDE.md `### Why this exists`                                    | Qwen LM Studio jinja-template incident                                                                              | strict-alternation paragraph at line 280     | WIRED  | New paragraph names Qwen 3.5 + LM Studio + jinja error verbatim, explains why the user-ack constant exists, and notes the cache prefix now covers `[system, ...history, user(ack)]` (still byte-stable).                          |

### Data-Flow Trace (Level 4)

Not applicable — gap closure modifies a runtime LLM prompt construction (no rendered UI data flow). The "data flow" here is the chatStream call payload, which Phase 35 plan-01's invariant test already verified. The 6th invariant locks the new shape.

### Behavioral Spot-Checks

| Behavior                                                                                                   | Command                                                                                                | Result                                       | Status |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------ |
| Constant declaration count = 1                                                                             | `grep -cE "const USER_ACK_BEFORE_GRAPH_CONTEXT =" app/src/state/useQuestions.ts`                       | `1`                                          | PASS   |
| Constant reference count = 2 (Pass 1 + Pass 2)                                                              | `grep -cE "content: USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts`                       | `2`                                          | PASS   |
| User-role threading count = 2                                                                               | `grep -cE "role: 'user', content: USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts`         | `2`                                          | PASS   |
| System role still appears exactly twice (no accidental duplication)                                          | `grep -cE "role: 'system'" app/src/state/useQuestions.ts`                                              | `2`                                          | PASS   |
| Existing assistant-context still threaded in both passes                                                     | `grep -cE "role: 'assistant', content: assistantContextMessage" app/src/state/useQuestions.ts`         | `2`                                          | PASS   |
| Literal value of constant verified                                                                           | `grep -c "Here is the knowledge graph context for this turn:" app/src/state/useQuestions.ts`           | `1`                                          | PASS   |
| Invariant test suite full green                                                                              | `node --test tests/state/useQuestions-system-prompt-stability.test.mjs`                                | tests 6 / pass 6 / fail 0                    | PASS   |
| Locale-abort regression (Phase 27/D-22)                                                                      | `node --test tests/state/useQuestions-locale-abort.test.mjs`                                           | tests 5 / pass 5 / fail 0                    | PASS   |
| Classification-dedup regression (Phase 33 UAT-4)                                                             | `node --test tests/services/classification-dedup.test.mjs`                                             | tests 8 / pass 8 / fail 0                    | PASS   |
| ChatInput flex-shrink (Phase 33 UAT-4)                                                                       | `node --test tests/components/ChatInput.flex-shrink.test.mjs`                                          | tests 1 / pass 1 / fail 0                    | PASS   |
| Root horizontal/vertical overflow clip (Phase 33 UAT-4)                                                      | `node --test tests/layout/root-horizontal-clip.test.mjs`                                               | tests 3 / pass 3 / fail 0                    | PASS   |
| TypeScript build clean                                                                                       | `npx tsc -b --noEmit && echo $?`                                                                       | exit 0                                       | PASS   |

All 12 spot-checks pass.

### Requirements Coverage

`requirements: []` in 35-05-PLAN.md frontmatter (gap closure has no new requirement IDs — it remediates a UAT-discovered structural gap from Phase 35 plan-01's D-08 risk). No requirements coverage gaps to assess.

### Anti-Patterns Found

None. Modifications were:

- One named constant + 9-line rationale comment + insertion of one element in two arrays (`useQuestions.ts`)
- One appended `it()` block following the established source-reading pattern (test file)
- One appended paragraph + one Rules item update (CLAUDE.md)

No TODO/FIXME placeholders introduced. No empty implementations. No hardcoded test mocks bleeding into production. No console.log debugging artifacts. The new constant value `'Here is the knowledge graph context for this turn:'` is descriptive prose (not a placeholder string).

### Human Verification Required (post-merge UAT, NOT part of this gate)

The 35-05-PLAN.md `<verification>` section item 6 explicitly defers UAT Tests 1, 2, 3 to operator on-device retest. This verification report addresses the structural/automated gate only. The operator's post-merge UAT actions:

1. **UAT Test 1 retest (was BLOCKER):** Open Ask screen on a build pointed at Qwen 3.5 via LM Studio. Type "What is spaced repetition?". Expect streamed answer renders normally; LM Studio log should show `Streaming response...` followed by token output (no jinja `"No user query found in messages"` error).
2. **UAT Test 2 retest (was BLOCKED by Test 1):** Same chat session, follow-up "How does it differ from active recall?". Expect coherent answer that references prior turn.
3. **UAT Test 3 retest (was BLOCKED by Test 1):** Toggle web-search globe ON, ask a current-events question. Expect streamed answer with `[1][2]` citations and a "Sources:" section.

If any of the three flips back to `issue` post-merge, treat as a NEW gap (not a regression on this verification gate). 35-UAT.md should be updated with the retest outcomes after the operator confirms.

### Gaps Summary

None. All 9 structural must-haves verified; cross-phase invariant suites green; TypeScript clean. The triple-guard (live code constant + source-reading test + CLAUDE.md rule) is intact and mutually reinforcing — a future "simplify back to D-08 original" refactor would fail at all three guard layers independently.

The plan-05 SUMMARY's `npm test` baseline (389 pass / 26 fail with 26 documented `ERR_IMPORT_ATTRIBUTE_MISSING` JSON-import-attribute pre-existing failures) was reported by the executor and is consistent with the prior phase-close baseline. This verification did not re-run the full suite (would be redundant given targeted invariant + TS checks all green), but the targeted regression checks confirm no new breakage in the load-bearing test paths.

---

## Verification Method Notes

- **Mode used:** Gap-closure re-verification, scoped to plan 35-05's three modified files. The four prior plans (35-01 through 35-04) were already verified during the phase-close run on 2026-04-29 (see `35-VERIFICATION.md` and `35-VERIFICATION-PHASE-CLOSE.md`); this report does not re-walk those.
- **Filename choice:** `35-VERIFICATION-GAP-CLOSURE.md` (NEW filename) so it sits alongside, not on top of, the prior verification reports.
- **Trust posture:** Verified what's actually in the codebase via fresh greps + fresh test runs + fresh `tsc` invocation. SUMMARY claims cross-checked against live state — all consistent.

---

_Verified: 2026-04-29_
_Verifier: Claude (gsd-verifier, gap-closure mode)_
_Files verified live:_
- `/Users/Code/EchoLearn/app/src/state/useQuestions.ts`
- `/Users/Code/EchoLearn/app/tests/state/useQuestions-system-prompt-stability.test.mjs`
- `/Users/Code/EchoLearn/CLAUDE.md`
