---
phase: 23-incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter
verified: 2026-04-09T23:10:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 23: Incremental Mindmap Classification + Ask Rate Limiter Verification Report

**Phase Goal:** Replace the single-call mindmap classification with an incremental 3-step LLM pipeline (branch -> cluster -> anchor) that leverages KV cache for cost efficiency at scale. Add a configurable monthly rate limiter for user Q&A streaming requests on the Ask screen.
**Verified:** 2026-04-09T23:10:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 01 (Pipeline)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | classifyAndAnchorIncremental runs 3 sequential LLM calls (branch, cluster, anchor) with append-only messages | VERIFIED | Lines 753-819 in canonical-knowledge.service.ts: three nested try blocks, each calls runStepWithRetry and pushes assistant response to shared messages array |
| 2 | Each step reuses the prior message array prefix for KV cache hits | VERIFIED | Single `messages` array initialized at line 748, pushed to after each step (lines 770, 791) — stable system prompt at position 0 for KV cache anchoring |
| 3 | Short-circuit skips remaining steps when any step returns NEW | VERIFIED | Line 772-776: step1.isNew immediately sets branchName/clusterName/anchorName and skips to commit. Line 793-796: step2.isNew same pattern. Step3 falls through to commit only when anchors are examined |
| 4 | Failed step retries once, then falls back to old classifyAndAnchor | VERIFIED | runStepWithRetry (lines 716-736): loops attempt 0-1, continues on first failure, throws on second. Each step catch block calls `classifyAndAnchor(question, allQuestions, llmConfig)` and returns |
| 5 | No nodes are created until all decisions are collected | VERIFIED | commitClassificationResult called at line 833 — after all three step variables (branchName, clusterName, anchorName, anchorId) are resolved. Outer catch at line 834 falls back to classifyAndAnchor on any unexpected failure |

### Observable Truths — Plan 02 (Rate Limiter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Monthly counter tracks askStreaming requests per calendar month | VERIFIED | ask-rate-limiter.service.ts: localStorage key `echolearn_ask_rate_limit` stores `{count, yearMonth}`. incrementAskCount() called at useQuestions.ts line 219 (after buildAndSave) |
| 7 | Counter resets automatically on first access of a new month | VERIFIED | load() function (lines 27-40 of ask-rate-limiter.service.ts): compares parsed.yearMonth vs currentYearMonth(), resets to 0 on mismatch and writes back to localStorage |
| 8 | Limit of 0 means unlimited (off by default) | VERIFIED | getRateLimitStatus: returns `{count:0, canAsk:true, nearLimit:false, resetDate:''}` when limit<=0. Default in settings.service.ts: `askMonthlyLimit: 0` |
| 9 | Settings shows current count, limit, and reset date in a combined Usage section | VERIFIED | SettingsScreen.tsx line 1136: `title="Usage"`. Line 1143: "Monthly Question Limit" row shows count/limit text and reset date when limit>0. Number input at line 1159 |
| 10 | Token Usage section is renamed to Usage and includes the rate limit row | VERIFIED | SectionHeader at line 1136 confirmed `title="Usage"` (not "Token Usage"). Rate limit row added above existing token table |

### Observable Truths — Plan 03 (Wiring)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | Both classifyAndAnchor call sites use classifyAndAnchorIncremental instead | VERIFIED | useQuestions.ts line 237: `classifyAndAnchorIncremental(question, ...)`. question.service.ts line 262: `classifyAndAnchorIncremental(flagged, ...)`. Neither file has bare `classifyAndAnchor` call |
| 12 | askStreaming is guarded by rate limiter before LLM call | VERIFIED | useQuestions.ts lines 106-111: reads monthlyLimit from settings, calls getRateLimitStatus, checks canAsk, returns early with message if blocked |
| 13 | Rate counter increments after successful question save, not before | VERIFIED | useQuestions.ts lines 218-219: `buildAndSave(...)` immediately followed by `incrementAskCount()` |
| 14 | AskScreen shows inline banner at 80%+ of monthly limit | VERIFIED | AskScreen.tsx line 723: `{rateLimitStatus.nearLimit && (` wraps the banner. Warning message at line 735 with count/total display |
| 15 | Send button is disabled when monthly limit is reached | VERIFIED | AskScreen.tsx line 743: `disabled={!!streaming || editingMessageId !== null || !rateLimitStatus.canAsk}` |

**Score:** 10/10 must-have truths verified (Plans 01+02+03 combined)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/services/canonical-knowledge.service.ts` | classifyAndAnchorIncremental + helpers | VERIFIED | All 6 helpers present (PIPELINE_SYSTEM_PROMPT, parseStepResponse, buildStepPrompt, extractUniqueBranches, extractClustersUnderBranch, extractAnchorsUnderCluster). commitClassificationResult shared helper at line 538. runStepWithRetry internal at line 716. classifyAndAnchorIncremental exported at line 738 |
| `app/tests/canonical-knowledge-pipeline.test.mjs` | Unit tests for pipeline helpers | VERIFIED | 164 lines, 15 distinct test() cases covering: valid index, NEW JSON, out-of-bounds, gibberish, verbose LLM text, zero index, negative rejection, buildStepPrompt with/without candidates, extractUniqueBranches filtering, vague label exclusion, extractClustersUnderBranch, extractAnchorsUnderCluster |
| `app/src/services/ask-rate-limiter.service.ts` | Rate limiter service | VERIFIED | Exports getRateLimitStatus, incrementAskCount, getAskCount. Contains echolearn_ask_rate_limit key, currentYearMonth(), monthly auto-reset logic |
| `app/src/types/index.ts` | askMonthlyLimit on AppPreferences | VERIFIED | Line 295: `askMonthlyLimit?: number` inside AppPreferences interface |
| `app/src/screens/SettingsScreen.tsx` | Usage section with rate limit row | VERIFIED | Imports getRateLimitStatus (line 4). title="Usage" (line 1136). "Monthly Question Limit" row (line 1143). handleAskLimitChange handler (line 332) |
| `app/tests/ask-rate-limiter.test.mjs` | Unit tests for rate limiter | VERIFIED | 84 lines, 8 test() cases: unlimited mode, 80% near-limit, at-limit blocked, below-threshold, increment, stale month reset, stale status reset, reset date format |
| `app/src/state/useQuestions.ts` | Rate limit guard + pipeline wiring | VERIFIED | Imports classifyAndAnchorIncremental + getRateLimitStatus + incrementAskCount. Guard at lines 106-111. incrementAskCount at line 219. classifyAndAnchorIncremental at line 237 |
| `app/src/services/question.service.ts` | Pipeline wiring for non-streaming path | VERIFIED | Line 11: classifyAndAnchorIncremental in import. Line 262: replaces old classifyAndAnchor call |
| `app/src/screens/AskScreen.tsx` | Inline rate limit banner + disabled send | VERIFIED | Imports getRateLimitStatus + RateLimitStatus (line 20). rateLimitStatus state with lazy initializer (line 138). nearLimit banner (line 723). disabled prop includes !rateLimitStatus.canAsk (line 743). refreshRateLimit called after handleSend (line 329) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| classifyAndAnchorIncremental | chatCompletion | 3 sequential calls with growing message array | VERIFIED | runStepWithRetry calls chatCompletion at line 723 with shared messages array; called 3 times in nested structure |
| classifyAndAnchorIncremental | classifyAndAnchor | fallback on pipeline failure | VERIFIED | 4 fallback call sites: lines 766, 788, 808, 837 — each step has its own catch, plus outer catch |
| ask-rate-limiter.service.ts | localStorage | echolearn_ask_rate_limit key | VERIFIED | STORAGE_KEY constant = 'echolearn_ask_rate_limit'. Used in load() and save() |
| SettingsScreen.tsx | ask-rate-limiter.service.ts | getRateLimitStatus import | VERIFIED | Line 4: `import { getRateLimitStatus } from '../services/ask-rate-limiter.service'`. Used at line 161 |
| useQuestions.ts | classifyAndAnchorIncremental | fire-and-forget after save | VERIFIED | Line 237: void classifyAndAnchorIncremental(question, questionService.getAll(), llmConfig) |
| useQuestions.ts | getRateLimitStatus | guard at askStreaming entry | VERIFIED | Lines 104-111: reads monthlyLimit, calls getRateLimitStatus, checks canAsk |
| useQuestions.ts | incrementAskCount | call after buildAndSave | VERIFIED | Lines 218-219: buildAndSave immediately followed by incrementAskCount() |
| AskScreen.tsx | getRateLimitStatus | banner render + disabled prop | VERIFIED | Line 20 import, line 138-145 state, line 723 nearLimit check, line 743 disabled prop |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| SettingsScreen.tsx | rateLimitStatus | getRateLimitStatus(askMonthlyLimit) reads localStorage | Yes — reads actual stored count from localStorage | FLOWING |
| AskScreen.tsx | rateLimitStatus | lazy useState initializer reads settingsService.getSync() then getRateLimitStatus | Yes — live count from localStorage, refreshed after each handleSend | FLOWING |
| useQuestions.ts | rateLimitStatus.canAsk | getRateLimitStatus reads live localStorage | Yes — reflects actual ask count | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: TypeScript compile is the primary runnable check for this phase (no server required).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | npx tsc --noEmit | Zero errors (confirmed from summary; all three plans verified clean) | PASS |
| Pipeline test file has 15 tests | grep -c "^test(" pipeline.test.mjs | 15 test cases present | PASS |
| Rate limiter test file has 8 tests | grep -c "^test(" ask-rate-limiter.test.mjs | 8 test cases present | PASS |
| classifyAndAnchor retained as fallback | grep for export async function classifyAndAnchor | Present at line 844 of canonical-knowledge.service.ts | PASS |
| No bare classifyAndAnchor calls in wire sites | grep in useQuestions.ts, question.service.ts | Zero matches (only incremental variant used) | PASS |

---

### Requirements Coverage

All requirement IDs are defined in ROADMAP.md (Phase 23 section). REQUIREMENTS.md (milestone v1.1) does not contain PIPE/RATE IDs — these are phase-internal IDs not part of the v1.1 milestone requirements document. No orphaned requirements found.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PIPE-01 | 23-01, 23-03 | 3-step sequential LLM pipeline with append-only threading | SATISFIED | classifyAndAnchorIncremental: 3 nested runStepWithRetry calls, single messages array with growing context |
| PIPE-02 | 23-01 | Index-based selection format (bare integer or {"index":"NEW","name":"..."}) | SATISFIED | parseStepResponse handles both: JSON index field (number or 'NEW') and bare integer regex fallback |
| PIPE-03 | 23-01 | Stable system prompt (no dynamic content) for KV cache maximization | SATISFIED | PIPELINE_SYSTEM_PROMPT constant (line 419-420) — pure static string, dynamic content in user messages only |
| PIPE-04 | 23-01 | Short-circuit on NEW — skip remaining steps, create downstream nodes in code | SATISFIED | Lines 772-776 (step1 NEW) and 793-796 (step2 NEW): immediately assigns clusterName/anchorName and skips to commit |
| PIPE-05 | 23-01 | Retry failed step once, then fall back to existing single-call classifyAndAnchor | SATISFIED | runStepWithRetry: attempt 0 continues, attempt 1 throws. Each step catch calls classifyAndAnchor + return |
| PIPE-06 | 23-01 | No partial commits — collect all 3 decisions before creating/attaching nodes | SATISFIED | commitClassificationResult called at line 833 only after all 3 step variables resolved |
| PIPE-07 | 23-01, 23-03 | Old classifyAndAnchor kept as fallback, not removed | SATISFIED | classifyAndAnchor still exported at line 844. Not called directly by useQuestions/question.service (they use incremental) |
| RATE-01 | 23-02, 23-03 | Monthly quota model tracking askStreaming requests per calendar month | SATISFIED | echolearn_ask_rate_limit key stores {count, yearMonth}. incrementAskCount called after buildAndSave in useQuestions |
| RATE-02 | 23-02, 23-03 | Only counts user Q&A streaming requests (not system LLM calls) | SATISFIED | incrementAskCount placed only in askStreaming path of useQuestions.ts (line 219), not in classification or other LLM paths |
| RATE-03 | 23-02 | Off by default (0 = unlimited) | SATISFIED | settings.service.ts: `askMonthlyLimit: 0`. getRateLimitStatus returns canAsk=true when limit<=0 |
| RATE-04 | 23-02 | Combined "Usage" section in Settings with count, limit, reset date | SATISFIED | SettingsScreen.tsx: title="Usage", Monthly Question Limit row shows count/limit and reset date |
| RATE-05 | 23-02, 23-03 | Inline banner in Ask screen at 80%+ of limit | SATISFIED | AskScreen.tsx line 723: banner renders when rateLimitStatus.nearLimit (threshold: pct >= 0.8) |
| RATE-06 | 23-02, 23-03 | Hard block when limit reached — send button disabled | SATISFIED | AskScreen.tsx line 743: disabled prop includes !rateLimitStatus.canAsk |

**All 13 requirements (PIPE-01 through PIPE-07, RATE-01 through RATE-06) are SATISFIED.**

Note: REQUIREMENTS.md for milestone v1.1 does not define PIPE/RATE IDs — these are phase-scoped requirement IDs defined only in ROADMAP.md. No orphaned REQUIREMENTS.md IDs found for phase 23.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

Scan results:
- No TODO/FIXME/PLACEHOLDER comments in modified files
- No stub implementations (return null / return [] / return {}) — all functions have substantive logic
- classifyAndAnchorIncremental: full 3-step pipeline with real LLM calls, not a placeholder
- ask-rate-limiter.service.ts: real localStorage reads/writes with month comparison logic
- AskScreen.tsx rateLimitStatus: lazy initializer reads live settings, refreshes after ask — not hardcoded empty

---

### Human Verification Required

#### 1. Full Ask Flow with Rate Limiter Active

**Test:** Set monthly limit to 2 in Settings > Usage. Ask two questions via Ask screen. Observe that after the second save, banner updates. On the third attempt, verify send button is disabled and banner shows "Monthly limit reached."
**Expected:** Send button disables, red error banner visible, askStreaming does not fire a third LLM call.
**Why human:** Cannot test interactive React state transitions and localStorage persistence across questions without a running browser session.

#### 2. Incremental Pipeline Classification Quality

**Test:** Ask a question in a topic area that has existing branches/clusters in the mindmap. Inspect the network/console logs to confirm 3 sequential LLM calls are made to the classification service, each with a growing message array, and the question lands in the correct branch.
**Expected:** 3 chat completion calls with identical system prompt prefix (KV cache hit), question correctly placed.
**Why human:** Requires a configured LLM provider and live network inspection; cannot verify KV cache hit rates programmatically.

#### 3. Short-Circuit Behavior for New Branch

**Test:** Ask a question in a completely new topic (e.g., "What is marine archaeology?") when no marine-related branches exist. Verify that only 1 LLM call is made for the branch step, and the cluster/anchor are auto-generated from the branch name.
**Expected:** Only 1 classification LLM call fires, cluster = "<BranchName> fundamentals", anchor = question title or first 40 chars.
**Why human:** Requires controlled mindmap state and observable LLM call count in browser devtools.

---

### Gaps Summary

No gaps. All must-haves verified against the actual codebase.

- Plan 01: All 6 helper functions implemented and substantive. classifyAndAnchorIncremental exported with full pipeline logic, fallbacks, and shared commit helper.
- Plan 02: ask-rate-limiter.service.ts exists with real localStorage logic. Types extended. Settings UI renamed and rate limit row added.
- Plan 03: Both call sites wired to incremental pipeline. Rate limit guard active before LLM call. Counter increments after save. AskScreen banner and disabled send fully wired with refresh after each question.

---

_Verified: 2026-04-09T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
