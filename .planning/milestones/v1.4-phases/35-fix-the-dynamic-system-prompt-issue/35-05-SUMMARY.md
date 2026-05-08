---
phase: 35-fix-the-dynamic-system-prompt-issue
plan: 05
subsystem: state
tags: [llm, kv-cache, useQuestions, chat, ask, gap-closure, qwen, lm-studio, strict-alternation, regression-guard]
gap_closure: true
gap_source: .planning/phases/35-fix-the-dynamic-system-prompt-issue/35-UAT.md (Test 1 blocker)

# Dependency graph
requires:
  - phase: 35-fix-the-dynamic-system-prompt-issue/plan-01
    provides: byte-stable system prompt + tail assistantContextMessage shared by Pass 1/2 (the live shape this gap closure layers atop without altering the cache-prefix invariant)
  - phase: 35-fix-the-dynamic-system-prompt-issue/plan-02
    provides: source-reading invariant test scaffold (5 it() blocks); plan 05 appends a 6th
  - phase: 35-fix-the-dynamic-system-prompt-issue/plan-03
    provides: CLAUDE.md `## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)` section; plan 05 appends a paragraph + edits Rules item 3
provides:
  - "useQuestions.askStreaming Pass 1 + Pass 2 emit `[system, ...history, user(USER_ACK_BEFORE_GRAPH_CONTEXT), assistant(assistantContextMessage), user(content)]` — chat templates that strictly require user→assistant alternation (Qwen 3.5 via LM Studio) now render the prompt"
  - "Single shared closure constant USER_ACK_BEFORE_GRAPH_CONTEXT referenced once in Pass 1 and once in Pass 2 — Pass1→Pass2 prefix-cache continuity preserved"
  - "Sixth source-reading invariant locks the user-ack ordering in BOTH passes; existing 5 invariants unchanged"
  - "Strict-alternation rationale documented in CLAUDE.md so a future agent does not silently re-collapse the user-ack out of the message array"
affects: [phase-35 UAT.md (Tests 1/2/3 awaiting operator re-run on real device), Qwen + LM Studio dev path now structurally unblocked, future Ask-chat refactors inherit the user-ack guardrail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strict-alternation user-ack: when KV-cache pre-stable shape is `assistant(ctx) → user(query)` and a downstream chat template enforces user→assistant alternation, prepend a constant byte-stable user message — preserves cache benefit (constant lives AFTER history) while satisfying the template's invariant"
    - "Triple-guard pattern (Phase 32.1 lesson #8): code constant + source-reading invariant test + CLAUDE.md rule. Each guard fails independently if a future refactor drops the user-ack."

key-files:
  created: []
  modified:
    - app/src/state/useQuestions.ts
    - app/tests/state/useQuestions-system-prompt-stability.test.mjs
    - CLAUDE.md

key-decisions:
  - "Constant value `'Here is the knowledge graph context for this turn:'` chosen verbatim from 35-05-PLAN.md `<action>` Step 1. Plain prose, descriptive of the immediately-following assistant message, byte-stable across turns. Test asserts on the constant NAME and POSITION (not literal string content) so the value can drift without breaking the test, but Task 1's grep acceptance pinned the literal — kept verbatim."
  - "Position chosen: BETWEEN `...historyMessages` and `{ role: 'assistant', content: assistantContextMessage }` in BOTH passes (verbatim from 35-05-PLAN.md Steps 2 + 3). Anywhere else either re-breaks Pass1→Pass2 prefix continuity (if before history) or fails to satisfy the template alternation requirement (if after assistantContext)."
  - "Updated Rules item 3 in CLAUDE.md to require BOTH `assistantContextMessage` AND `USER_ACK_BEFORE_GRAPH_CONTEXT` shared closure values (verbatim from 35-05-PLAN.md Task 3 Step 2). Forbids inlining the user-ack as a literal string in either chatStream call so the source-reading test's `content: USER_ACK_BEFORE_GRAPH_CONTEXT` regex catches drift."
  - "D-08's recorded fallback path (35-01-SUMMARY.md `Decisions Made` paragraph: 'we can revisit by adding a single static user-ack message — that change would still preserve byte-stability since the ack would be a constant string') was implemented EXACTLY. No deviation from the pre-recorded remediation plan."
  - "Did NOT modify Plan 04's chatStream/chatCompletion audit (35-VERIFICATION.md or related). The audit's 24/26 one-shot finding remains accurate — every other LLM call site is single-turn with no multi-turn cache-prefix to preserve, so they don't benefit from this gap closure's structural discipline."

patterns-established:
  - "Append-only history → user-ack → tail assistant context → user query: when a multi-turn pipeline needs to inject per-turn structured context (graph candidates, retrieval results, etc.) AND target chat templates with strict alternation, the user-ack message is a constant load-bearing element. Future Ask-chat refactors must preserve this shape."
  - "Per-feature triple-guard for load-bearing shape: when a piece of code shape (a constant declaration in a specific position, a message-array element at a specific index) MUST hold for production correctness AND can be silently broken by a small refactor, document it in three places — code-site comment, source-reading test, CLAUDE.md rule. The first guard catches drift at edit time; the second catches drift at CI time; the third catches drift at human-review time."

requirements-completed: []

# Metrics
duration: 5min 26s
completed: 2026-04-29
---

# Phase 35 Plan 05: Strict-alternation user-ack gap closure for Qwen via LM Studio Summary

**Inserted a constant byte-stable user-ack message (`USER_ACK_BEFORE_GRAPH_CONTEXT`) BETWEEN `...historyMessages` and `{ role: 'assistant', content: assistantContextMessage }` in BOTH Pass 1 and Pass 2 of `useQuestions.askStreaming` so chat templates that strictly require user→assistant alternation (Qwen 3.5 via LM Studio's OpenAI-compatible proxy) accept the turn-1 shape. Extended the source-reading invariant test with a 6th assertion locking the user-ack position; appended a strict-alternation paragraph to CLAUDE.md Phase 35 section. Triple-guard (live code + source-reading test + CLAUDE.md rule) updated in lockstep so the strict-alternation fix can't be silently undone by a future "simplify back to D-08 original" refactor.**

This plan implements verbatim the fallback remediation pre-recorded in `35-01-SUMMARY.md` Decisions Made D-08 paragraph: "If a local-LLM regression surfaces during phase verification, we can revisit by adding a single static user-ack message — that change would still preserve byte-stability since the ack would be a constant string." CONTEXT.md D-08 explicitly named this exact risk; UAT Test 1 surfaced it as a blocker against Qwen via LM Studio (jinja error: `"No user query found in messages"`); 35-05 closes it.

## Performance

- **Duration:** ~5 min 26s
- **Started:** 2026-04-29T13:50:43Z
- **Completed:** 2026-04-29T13:56:09Z (approx)
- **Tasks:** 3 (atomic commits, sequential)
- **Files modified:** 3 (useQuestions.ts, useQuestions-system-prompt-stability.test.mjs, CLAUDE.md)

## Accomplishments

- `const USER_ACK_BEFORE_GRAPH_CONTEXT = 'Here is the knowledge graph context for this turn:'` declared once in `useQuestions.askStreaming`, near `assistantContextMessage`. Single closure constant referenced identically by Pass 1 and Pass 2 — Pass1→Pass2 prefix-cache continuity preserved.
- Pass 1 chatStream array now reads: `[system, ...history, user(USER_ACK), assistant(ctx), user(content)]`.
- Pass 2 chatStream array now reads: `[system, ...history, user(USER_ACK), assistant(ctx), user(content), assistant("I searched the web..."), user("Web search results...")]` — the same head as Pass 1 plus the existing search-flow tail untouched.
- Sixth `it()` block appended to `app/tests/state/useQuestions-system-prompt-stability.test.mjs`. Asserts: (a) `USER_ACK_BEFORE_GRAPH_CONTEXT` declared exactly once; (b) Pass 1 array order is history → userAck → assistantCtx → userTurn; (c) Pass 2 array order matches Pass 1's head shape, then continues with search-flow messages. Test now reports tests 6 / pass 6 / fail 0.
- New paragraph appended to CLAUDE.md `## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)` `### Why this exists` subsection documenting: the strict `user → assistant → user` tail alternation, the constant value verbatim, the Qwen jinja-template prompting incident (with the verbatim error message `"No user query found in messages"`), and that the cache prefix now covers `[system, ...history, user(ack)]` (still byte-stable, still 5-min provider-TTL bounded).
- Rules item 3 in the same CLAUDE.md section updated to require Pass 1 and Pass 2 reuse the SAME `assistantContextMessage` AND `USER_ACK_BEFORE_GRAPH_CONTEXT` closure values, and forbid inlining the user-ack as a literal string in either chatStream call.
- Strict-alternation note also appended to the inline comment block above `systemPrompt` in `useQuestions.ts` (Phase 32.1 lesson #8 — documentation in three places confirmed for this gap closure).

## Task Commits

Each task was committed atomically:

1. **Task 1 — refactor:** `0372b456` `refactor(35-05): insert byte-stable user-ack before assistant context (Qwen strict-alternation fix)` — `app/src/state/useQuestions.ts` (+15 lines, 0 deletions)
2. **Task 2 — test:** `98a75aae` `test(35-05): assert user-ack ordering invariant in Pass 1 + Pass 2` — `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (+49 lines, 0 deletions)
3. **Task 3 — docs:** `ae4398a1` `docs(35-05): document strict-alternation rationale in CLAUDE.md Phase 35 section` — `CLAUDE.md` (+3 lines, -1 line)

## Files Created/Modified

- `app/src/state/useQuestions.ts` — Added `USER_ACK_BEFORE_GRAPH_CONTEXT` constant declaration with 9-line comment block (Phase 35 gap closure UAT-1 — Strict-alternation user-ack); inserted `{ role: 'user', content: USER_ACK_BEFORE_GRAPH_CONTEXT }` in Pass 1 array (between `...historyMessages` and the assistantContextMessage line) and identically in Pass 2 array; appended 2-line strict-alternation note to the existing Phase 35 inline comment block above `systemPrompt`.
- `app/tests/state/useQuestions-system-prompt-stability.test.mjs` — Appended 6th `it()` block at the bottom of the existing `describe('useQuestions system prompt stability (Phase 35)')`. Asserts the constant declaration count + Pass 1 ordering + Pass 2 ordering. Existing 5 it() blocks unchanged.
- `CLAUDE.md` — Inside `## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)` section: appended one paragraph after the existing "Public framing for this fix landed in `LabPresentation/SCRIPTS.md` slide 4.7..." line and before the existing `### Rules` subheading; replaced Rules item 3 with the updated wording referencing `USER_ACK_BEFORE_GRAPH_CONTEXT`. Other 5 Rules items unchanged. H2 ordering preserved (Phase 35 still precedes Phase 32.1 best-practices).

## Decisions Made

- **Constant value chosen verbatim from plan:** `'Here is the knowledge graph context for this turn:'`. Plain prose, descriptive of the immediately-following assistant context message. Byte-stable across turns. Test asserts on the constant NAME and POSITION rather than the literal string value — so the wording can drift without breaking the test (Task 1's grep acceptance criterion pinned it via `'Here is the knowledge graph context for this turn:' appears exactly once`).
- **Position chosen: BETWEEN `...historyMessages` and the assistantContextMessage element in BOTH passes.** Verbatim from plan Steps 2 + 3. Anywhere else either re-breaks the Pass1→Pass2 prefix continuity (if placed before history) or fails to satisfy the strict-alternation requirement (if placed after assistantContext or omitted in either pass).
- **D-08 fallback path executed verbatim.** 35-01-SUMMARY.md "Decisions Made" D-08 paragraph documented this exact remediation as the recorded fallback if a local-LLM regression surfaced. UAT Test 1 surfaced it. 35-05 closes it. No new decisions were required at execution time — the planner had already pre-decided the shape; the executor's job was to land it.
- **Plan 04 audit untouched.** The audit's 24/26 one-shot finding remains accurate. Other LLM call sites (`concept-feed`, `planner`, `podcast`, `post-essay`, `post-context-qa`, `flashcard`, `canonical-knowledge` non-descent paths, `AskScreen.tsx:86` session-title) are single-turn with no multi-turn cache-prefix to preserve, so the strict-alternation discipline is a non-goal there. Rules item 6 of the CLAUDE.md Phase 35 section continues to document this explicitly.
- **Inline comment placement at the load-bearing site.** The new 9-line `USER_ACK_BEFORE_GRAPH_CONTEXT` comment block sits IMMEDIATELY ABOVE its declaration (and IMMEDIATELY BELOW the existing `assistantContextMessage` comment block) so a future agent reading the code finds the rationale at the exact site of the constant — Phase 32.1 lesson #8 third-place guard.

## Deviations from Plan

None — plan executed exactly as written. All four edit steps in Task 1 (constant + Pass 1 insertion + Pass 2 insertion + strict-alternation comment append) landed verbatim. Task 2's 6th it() block was inserted verbatim from plan `<action>`. Task 3's CLAUDE.md paragraph and Rules item 3 replacement were inserted verbatim. Acceptance criteria across all three tasks all satisfied on first run.

## Issues Encountered

None. All commits landed cleanly without pre-commit hook failures. Test suite stayed green throughout.

## Verification Results

Acceptance criteria from `35-05-PLAN.md`:

**Task 1 — useQuestions.ts:**
- [x] `cd app && tsc -b --noEmit` exit 0 — verified (post-task-1 and post-task-3)
- [x] `cd app && node --test tests/state/useQuestions-locale-abort.test.mjs` exits 0 — verified `tests 5 / pass 5 / fail 0`
- [x] `grep -cE "const USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts` returns `1` — verified
- [x] `grep -cE "content: USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts` returns `2` — verified (Pass 1 + Pass 2)
- [x] `grep -cE "role: 'user', content: USER_ACK_BEFORE_GRAPH_CONTEXT" app/src/state/useQuestions.ts` returns `2` — verified
- [x] `grep -cnE "role: 'system'" app/src/state/useQuestions.ts` returns `2` — verified (no accidental duplication of systemPrompt element)
- [x] `grep -cE "role: 'assistant', content: assistantContextMessage" app/src/state/useQuestions.ts` returns `2` — verified (existing assistant-context messages preserved)
- [x] `grep -c "Here is the knowledge graph context for this turn:" app/src/state/useQuestions.ts` returns `1` — verified

**Task 2 — useQuestions-system-prompt-stability.test.mjs:**
- [x] `cd app && node --test tests/state/useQuestions-system-prompt-stability.test.mjs` exits 0 with `tests 6 / pass 6 / fail 0` — verified (6th it() block green; existing 5 still green)
- [x] `grep -cE "describe\\('useQuestions system prompt stability \\(Phase 35\\)'" app/tests/state/useQuestions-system-prompt-stability.test.mjs` returns `1` — verified (single describe preserved)
- [x] `grep -cE "^\\s*it\\(" app/tests/state/useQuestions-system-prompt-stability.test.mjs` returns `6` — verified
- [x] `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" app/tests/state/useQuestions-system-prompt-stability.test.mjs` returns `10` (≥5 required) — verified
- [x] `grep -c "Phase 35 UAT-1 strict-alternation fix" app/tests/state/useQuestions-system-prompt-stability.test.mjs` returns `1` — verified

**Task 3 — CLAUDE.md:**
- [x] `grep -c "USER_ACK_BEFORE_GRAPH_CONTEXT" /Users/Code/EchoLearn/CLAUDE.md` returns `2` (≥2 required) — verified (one in new paragraph, one in updated Rules item 3)
- [x] `grep -c "strict-alternation" /Users/Code/EchoLearn/CLAUDE.md` returns `1` (≥1 required) — verified
- [x] `grep -c "Qwen" /Users/Code/EchoLearn/CLAUDE.md` returns `1` (≥1 required) — verified
- [x] `grep -c "No user query found in messages" /Users/Code/EchoLearn/CLAUDE.md` returns `1` — verified (jinja error verbatim)
- [x] H2 ordering preserved (Phase 35 H2 at line 257; Phase 32.1 best-practices H2 at line 293) — verified
- [x] `### Why this exists` and `### Rules` subsections in Phase 35 section preserved (line 272 and line 282 respectively) — verified
- [x] CLAUDE.md is valid Markdown (`fs.readFileSync` parses; balanced code fences = 6, even) — verified
- [x] Manual review: Rules subsection still has items 1..6 in order, item 3 reads the updated text — verified by reading lines 282-289

**Cross-task / Phase-level:**
- [x] `cd app && npx tsc -b --noEmit` exits 0 — verified
- [x] `cd app && node --test tests/state/` (full state suite) — verified: useQuestions-locale-abort 5/5 + useQuestions-system-prompt-stability 6/6 (no regression)
- [x] `cd app && npm test` baseline preserved: 389 pass / 26 fail. Pre-gap-closure baseline (per 35-01-SUMMARY.md) was 386 pass / 28 fail. Net change: +3 pass / -2 fail. The +3 includes the new 6th it() in this gap closure. The remaining 26 failures are the documented pre-existing `ERR_IMPORT_ATTRIBUTE_MISSING` JSON-import-attribute issues unrelated to this change. NO NEW FAILURES.
- [x] Triple-guard intact: useQuestions.ts has 2 `content: USER_ACK_BEFORE_GRAPH_CONTEXT`; test has 10 references; CLAUDE.md has 2.

## Manual Verification Required (operator UAT re-run on real device)

This gap closure is structurally complete but **empirically incomplete** until the operator retests UAT Tests 1, 2, 3 against Qwen 3.5 via LM Studio on a real device. The three tests SHOULD now flip from `blocker`/`blocked` → `pass`:

- **Test 1 (was BLOCKER):** Open Ask screen, type "What is spaced repetition?". Expected: streamed answer renders normally. Confirm LM Studio log shows `Streaming response...` followed by token output (no jinja `"No user query found in messages"` error).
- **Test 2 (was BLOCKED by Test 1):** Same chat session, follow-up "How does it differ from active recall?". Expected: coherent answer that references the prior turn's content.
- **Test 3 (was BLOCKED by Test 1):** Toggle web-search globe ON. Ask a current-events question. Expected: streamed answer with `[1][2]` citations and a "Sources:" section.

After the operator confirms (or surfaces a new issue), `35-UAT.md` should be updated with the re-test results. If any test still fails on Qwen, treat it as a NEW gap (not a Phase 35 close-out signal).

The orchestrator (`/gsd:execute-phase 35 --gaps-only`) will surface this as a post-execution operator-action item.

## Cross-references

- **Gap source:** `.planning/phases/35-fix-the-dynamic-system-prompt-issue/35-UAT.md` Test 1 (severity: blocker — Qwen jinja-template error). UAT.md "fix_direction" block describes the exact remediation 35-05 implements.
- **D-08 fallback origin:** `35-CONTEXT.md` D-08 explicitly named this risk ("Some smaller open-source local LLMs ... may have chat templates that strictly require user/assistant alternation"). `35-01-SUMMARY.md` `Decisions Made` D-08 paragraph pre-recorded the exact fallback this plan executes.
- **Live refactor 35-05 layers atop:** `35-01-SUMMARY.md` (the Phase 35 plan-01 byte-stable-system-prompt + tail assistant context refactor). 35-05 inserts BETWEEN history and assistantContext without touching the system prompt or the assistant-context message body.
- **Test 35-05 extends:** `35-02-SUMMARY.md` (the Phase 35 plan-02 5-assertion source-reading guard). 35-05 appends a 6th assertion. Existing 5 assertions are unchanged and remain green.
- **Plan 04 audit unaffected:** `35-04-SUMMARY.md` (the project-wide chatStream/chatCompletion audit). The audit's findings remain accurate — other LLM call sites are intentionally one-shot and don't need this fix.

## Self-Check: PASSED

Verified files exist:
- FOUND: `app/src/state/useQuestions.ts` (modified)
- FOUND: `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (modified)
- FOUND: `CLAUDE.md` (modified)
- FOUND: `.planning/phases/35-fix-the-dynamic-system-prompt-issue/35-05-SUMMARY.md` (this file)

Verified commits exist:
- FOUND: `0372b456` (refactor task)
- FOUND: `98a75aae` (test task)
- FOUND: `ae4398a1` (docs task)

Verified automated checks:
- PASSED: `tsc -b --noEmit` exit 0
- PASSED: `node --test tests/state/useQuestions-system-prompt-stability.test.mjs` 6/6 pass
- PASSED: `node --test tests/state/useQuestions-locale-abort.test.mjs` 5/5 pass
- PASSED: `npm test` baseline preserved (389 pass / 26 fail; no new failures)

Verified triple-guard intact:
- FOUND: `useQuestions.ts` source = 2 × `content: USER_ACK_BEFORE_GRAPH_CONTEXT` (Pass 1 + Pass 2)
- FOUND: source-reading test = 10 × `USER_ACK_BEFORE_GRAPH_CONTEXT` references (in the new 6th it() block)
- FOUND: `CLAUDE.md` = 2 × `USER_ACK_BEFORE_GRAPH_CONTEXT` (new paragraph + updated Rules item 3)

---
*Phase: 35-fix-the-dynamic-system-prompt-issue*
*Completed: 2026-04-29*
*Gap closure source: 35-UAT.md Test 1*
