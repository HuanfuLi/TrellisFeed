---
status: complete
phase: 16-token-optimization
source: [16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md]
started: 2026-04-02T22:30:00Z
updated: 2026-04-02T22:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Session history in Ask screen
expected: Open AskScreen, start a new session. Ask a question, get a response, then ask a follow-up. The AI should reference its previous answer — demonstrating it has real conversation context.
result: issue
reported: "The AI answers both the current and previous question simultaneously. Stale sessionRef timing issue — priorMessages was missing the last AI response, causing two consecutive user messages."
severity: blocker
fix: "31ddb9b9 — pass currentMessages directly from handleSend/handleEditSubmit/handleRegenerateResponse instead of reading stale sessionRef"
retest: pass

### 2. No global Q&A leak in system prompt
expected: Ask a question in a brand-new session (no prior messages). The AI should answer based only on the question itself and knowledge graph context — NOT reference unrelated prior questions from other sessions.
result: pass

### 3. Token Usage section visible in Settings
expected: Navigate to Settings. Scroll to the Developer section. A "Token Usage" section should be visible with a table showing columns: Service, Prompt, Completion, Total, Calls. Initially may show empty or zero if no LLM calls have been made yet.
result: pass

### 4. Token usage records after asking questions
expected: Ask 1-2 questions in the Ask screen. Then navigate to Settings > Developer > Token Usage and tap Refresh. The table should show at least entries for "ask" and "classification" services with non-zero token counts.
result: pass

### 5. Clear token usage data
expected: In Settings > Developer > Token Usage, tap the Clear button. The table should immediately clear to show no data / all zeros. Tapping Refresh should still show empty (data was deleted from localStorage).
result: pass

### 6. App compiles and loads without errors
expected: The app loads normally on the home screen without console errors or crashes. All existing features (feed, planner, review, podcast, settings) remain functional.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
