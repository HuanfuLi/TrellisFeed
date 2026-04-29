---
status: testing
phase: 35-fix-the-dynamic-system-prompt-issue
source: [35-01-SUMMARY.md, 35-02-SUMMARY.md, 35-03-SUMMARY.md, 35-04-SUMMARY.md]
started: 2026-04-29T13:30:00Z
updated: 2026-04-29T13:42:00Z
---

## Current Test

[testing complete — 1 blocker issue + 2 dependent tests blocked by Test 1]

## Tests

### 1. Single-turn Ask still works
expected: Open the Ask screen. Type any question (e.g., "What is spaced repetition?"). The streamed answer renders normally — no errors, no half-messages, no provider-side failure. This is the baseline regression check after the system-prompt restructure.
result: issue
reported: "Broken. first pass response did not fire. LM Studio log: [qwen/qwen3.5-9b] Running chat completion on conversation with 3 messages. [qwen/qwen3.5-9b] Streaming response... [ERROR] [qwen/qwen3.5-9b] Error rendering prompt with jinja template: \"No user query found in messages.\""
severity: blocker
root_cause: |
  Qwen's chat template (and likely other open-source local LLMs running through LM Studio's OpenAI-compatible proxy) cannot tolerate the message sequence `[system, assistant(context), user(query)]` produced by Phase 35 on turn 1. The template scans for a user→assistant→user pattern and rejects conversations where an `assistant` message appears before any `user` message has been emitted. CONTEXT.md D-08 explicitly flagged this risk: "Some smaller open-source local LLMs (running via LM Studio's OpenAI-compatible proxy) may have chat templates that strictly require user/assistant alternation." The planner's D-08 choice ("accept the pattern, major providers tolerate it, lowest token cost") was incorrect for this codebase's primary local-LLM dev path.
fix_direction: |
  Insert a constant byte-stable synthetic user-ack message BEFORE the assistant context message. New shape:
  `[system, ...history, user(USER_ACK_BEFORE_GRAPH_CONTEXT), assistant(assistantContextMessage), user(query)]`.
  The synthetic ack is a single constant string declared as `const USER_ACK_BEFORE_GRAPH_CONTEXT = '...'` near `assistantContextMessage`. KV-cache stays preserved because:
  (a) `[system, ...history]` is still byte-stable across turns (the ack lives AFTER history, not inside the cached prefix);
  (b) the ack itself is a constant byte-stable string;
  (c) Pass 1 and Pass 2 both reference the same constant + closure variables, so Pass1→Pass2 prefix-cache continuity is preserved.
  D-08's recorded fallback in 35-01-SUMMARY.md "Decisions Made" already documents this exact remediation path: "If a local-LLM regression surfaces during phase verification, we can revisit by adding a single static user-ack message — that change would still preserve byte-stability since the ack would be a constant string."

### 2. Multi-turn Ask coherence (the case Phase 35 targets)
expected: Continue the same chat session. Ask a follow-up that references the prior turn (e.g., "How does it differ from active recall?"). The answer should be coherent and reference the prior context — proving the conversation history still flows through the LLM correctly after the message-array restructure. This is the load-bearing scenario Phase 35 was designed to optimize.
result: blocked
blocked_by: prior-phase
reason: "Test 1 chat is broken on the project's primary local-LLM (Qwen via LM Studio); cannot exercise multi-turn behavior until Test 1's blocker is resolved. Will retest after gap-closure plan lands."

### 3. Web search (Pass 2) still produces cited answer
expected: In the Ask screen, toggle the globe icon ON, then ask a question that benefits from web context (e.g., "What's the latest research on Anthropic's prompt caching?"). The answer streams with `[1][2]` citations and a "Sources:" section at the end listing titles + URLs. This confirms Pass 2 (the search-results re-prompt) still wires the same `assistantContextMessage` closure as Pass 1.
result: blocked
blocked_by: prior-phase
reason: "Pass 2 inherits the same broken message shape as Pass 1; cannot exercise web-search flow until Test 1's blocker is resolved. Will retest after gap-closure plan lands."

## Summary

total: 3
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "Single-turn Ask streaming works on the project's primary local-LLM (Qwen via LM Studio's OpenAI-compatible proxy)"
  status: failed
  reason: "User reported: Broken. first pass response did not fire. LM Studio Qwen jinja template error: 'No user query found in messages.' Phase 35's new message shape `[system, assistant(context), user(query)]` violates Qwen's chat-template alternation expectation."
  severity: blocker
  test: 1
  artifacts: ["app/src/state/useQuestions.ts:140-185 (Pass 1 chatStream array)", "app/src/state/useQuestions.ts:230-260 (Pass 2 chatStream array)"]
  missing: ["constant byte-stable user-ack message before the assistant context", "test coverage for Qwen-style strict-alternation templates"]
  diagnosis: "CONTEXT.md D-08 explicitly named this risk; the planner's recorded fallback (insert a constant synthetic user-ack) is the documented remediation path."
  fix_plan: "Insert `const USER_ACK_BEFORE_GRAPH_CONTEXT = '...'` constant; thread it as `{ role: 'user', content: USER_ACK_BEFORE_GRAPH_CONTEXT }` between `...historyMessages` and `{ role: 'assistant', content: assistantContextMessage }` in BOTH Pass 1 and Pass 2. Update the source-reading test to assert this new constant + ordering. Update CLAUDE.md Phase 35 section to document the strict-alternation rationale."
