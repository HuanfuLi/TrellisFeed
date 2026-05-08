---
status: complete
phase: 35-fix-the-dynamic-system-prompt-issue
source: [35-01-SUMMARY.md, 35-02-SUMMARY.md, 35-03-SUMMARY.md, 35-04-SUMMARY.md, 35-05-SUMMARY.md]
started: 2026-04-29T13:30:00Z
updated: 2026-04-29T14:18:00Z
retest_round: 2
retest_reason: "Plan 35-05 landed (commits 0372b456 + 98a75aae + ae4398a1) — strict-alternation user-ack inserted between history and assistant context in BOTH passes. Original Test 1 jinja error should be resolved on Qwen via LM Studio. Tests 2 + 3 unblocked."
---

## Current Test

[testing complete — all 3 tests pass on Qwen 3.5 via LM Studio after Plan 35-05 fix]

## Tests

### 1. Single-turn Ask still works (retest after 35-05 strict-alternation fix)
expected: Open the Ask screen on the same Qwen 3.5 + LM Studio setup that hit "No user query found in messages" before. Type any question (e.g., "What is spaced repetition?"). The streamed answer renders normally — no jinja template error, response tokens flow into the chat bubble. LM Studio log should show "Streaming response..." followed by actual completion (NOT [ERROR] line).
result: pass

### 2. Multi-turn Ask coherence (the case Phase 35 targets — retest)
expected: Continue the same chat session from Test 1. Ask a follow-up that references the prior turn (e.g., "How does it differ from active recall?"). The answer should be coherent and reference the prior context — proving the conversation history still flows through the LLM correctly after the new alternation pattern. This is the load-bearing scenario Phase 35 was designed to optimize.
result: pass

### 3. Web search (Pass 2) still produces cited answer (retest)
expected: In the Ask screen, toggle the globe icon ON, then ask a question that benefits from web context (e.g., "What's the latest research on Anthropic's prompt caching?"). The answer streams with `[1][2]` citations and a "Sources:" section at the end listing titles + URLs. This confirms Pass 2 (the search-results re-prompt) still works with the new shape `[system, ...history, user(ack), assistant(context), user(query), assistant(search-ack), user(search-results)]`.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0

## Gaps

[round 1 gap closed by Plan 35-05; awaiting round 2 retest results]

## Round 1 Audit (closed)

### Original Test 1 result (round 1)
- result: issue
- reported: "Broken. first pass response did not fire. LM Studio log: [qwen/qwen3.5-9b] Error rendering prompt with jinja template: 'No user query found in messages.'"
- severity: blocker
- root_cause: Phase 35's `[system, assistant(context), user(query)]` shape violated Qwen's strict-alternation jinja template (CONTEXT.md D-08 risk realized).
- fix: Plan 35-05 (commits 0372b456 + 98a75aae + ae4398a1) — inserted byte-stable user-ack constant between history and assistant context, restoring user→assistant→user alternation.

### Original Tests 2 + 3 (round 1)
- result: blocked (by Test 1 chat being inoperable)
- reason: Could not exercise multi-turn or web-search flows without a working first turn.
- now unblocked since Plan 35-05 restored single-turn capability (per round-2 retest pending).
