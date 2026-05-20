---
phase: 47-filter-redesign-off-topic-malicious-prompt-prevention
verified: 2026-05-17T00:00:00Z
status: passed
score: 7/7 success criteria verified
overrides_applied: 0
---

# Phase 47: Filter Redesign Verification Report

**Phase Goal:** Replace the regex-based off-topic classifier with a fundamentally more robust strategy; block malicious prompts from the LLM request entirely; add structural bracketing as defense in depth so legitimate LLM/security questions reach the answer LLM safely.

**Verified:** 2026-05-17
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Regex-only path in `question-filter.service.ts` replaced; hybrid Layer 1 narrow regex + Layer 2 embedding makes primary decision | VERIFIED | `question-filter.service.ts:129` `layer1Regex()`; `:147` `layer2Embedding()`; `:265-291` `evaluateQuestion()` orchestrates L1→L2 with short-circuit; unit tests 14 cases for L1 + 17 cases for L2 all green |
| 2 | Malicious prompts NOT sent to answer LLM; user sees clear message; no tokens spent | VERIFIED | `useQuestions.ts:161` filterQuestion called pre-stream; `:186` returns `{kind:'malicious-block', content}`; `question.service.ts:213` mirror; pre-gate test case 3 + question-service test 4 both assert `chatStream/chatCompletion/embedText` NOT invoked on malicious branch; `ChatMessage.tsx:303-323` renders neutral inline rejection (no override button per D-02) |
| 3 | Off-topic prompts answered but don't enter durable surfaces | VERIFIED | `useQuestions` test case 5 + `question.service.ask` test 5 assert `patchQuestion({flagged:true})` AND `classifyAndAnchorIncremental` SKIPPED on off-topic branch |
| 4 | Legitimate LLM/security questions reach durable surfaces (no intent-verb inspection) | VERIFIED | `filter-classifier.eval.test.mjs` includes "What is a system prompt?" / "What is prompt injection?" / "How does jailbreaking work?" as on-topic gold-labels; eval suite green; classifier has no verb-based heuristic |
| 5 | User content structurally bracketed at provider wrapper; goldens cover injection | VERIFIED | `user-content-bracketing.ts:56-90` wraps ONLY last `role:'user'` with `<user_content>...</user_content>` + ZWJ escape for adversarial close tags; `providers/llm/index.ts:65-77` composes `applyLocaleDirective` FIRST then `applyUserContentBracketing` SECOND on both chatCompletion + chatStream; `llm-bracketing.test.mjs` green |
| 6 | Held-out eval set with labeled examples per failure mode under version control + in test suite | VERIFIED | `app/src/data/filter-corpus.json` (corpus) + `app/tests/services/filter-corpus.eval.json` (held-out eval); `filter-classifier.eval.test.mjs` runs in suite; includes "How are you doing?" small-talk + "What is a system prompt?" false-positive cases |
| 7 | User can override off-topic flag; persists across reloads; propagates to durable consumers | VERIFIED | `AskScreen.tsx:506-541` `handleQuestionOverride` calls `patchQuestion(id, {flagged:false})` then awaits `classifyAndAnchorIncremental` (D-06 re-fire); `AskScreen-override-refire.test.mjs` green |

**Score:** 7/7 success criteria verified

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| FILTER-01 (replace regex strategy) | SATISFIED | Truth 1 — hybrid L1+L2 implementation |
| FILTER-02 (pre-LLM gate, malicious blocked, off-topic excluded from durable surfaces) | SATISFIED | Truths 2 + 3 — both ingress paths gated; tests confirm |
| FILTER-03 (structural bracketing at provider wrapper) | SATISFIED | Truth 5 — composition order verified, goldens green |
| FILTER-04 (held-out eval in test suite) | SATISFIED | Truth 6 — `filter-corpus.eval.json` + eval test runs |
| FILTER-05 (per-question override propagates) | SATISFIED | Truth 7 — D-06 re-fire verified |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `useQuestions.askStreaming` | `question-filter.service` | `filterQuestion(content, sessionContext, signal)` before chatStream | WIRED |
| `question.service.ask` | `question-filter.service` | `filterQuestion()` before embedding + chatCompletion | WIRED |
| `useQuestions` malicious branch | `ChatMessage` | `SessionMessage.kind: 'malicious-block'` → render branch | WIRED |
| `providers/llm/index.ts` chatStream/chatCompletion | bracketing | `applyLocaleDirective` → `applyUserContentBracketing` (in order) | WIRED |
| `AskScreen.handleQuestionOverride` | classification re-fire | `patchQuestion({flagged:false})` then `classifyAndAnchorIncremental` | WIRED |
| `layer2Embedding` | dual-vector scoring (UAT-5) | malicious→`rawVec`, off-topic+on-topic→`contextVec` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Phase 47 test combo (105 tests across 19 suites) | `node --test tests/services/filter-classifier.{unit,eval}.test.mjs tests/services/filter-cache.test.mjs tests/providers/llm-bracketing.test.mjs tests/state/useQuestions-{pre-gate,system-prompt-stability}.test.mjs tests/services/question-service-pre-gate.test.mjs tests/screens/AskScreen-override-refire.test.mjs` | pass 105 / fail 0 | PASS |
| UAT-5 regression pin (multi-turn jailbreak evasion) | filter-classifier.unit.test.mjs Test 18d | passed | PASS |
| Phase 35 byte-stable system prompt preserved | useQuestions-system-prompt-stability.test.mjs | all 6 cases pass | PASS |
| UAT-5 fix commit on branch | `git log --oneline | grep 122cda59` | `122cda59 fix(47-02): dual-vector scoring closes multi-turn jailbreak evasion` present | PASS |

### Anti-Patterns Found

None. No new debt markers (TODO/FIXME/XXX) introduced in modified files relevant to phase scope. No new event types (CLAUDE.md "one signal per semantic event" preserved; tests confirm). `patchQuestion` left as pure persistence (PATTERNS.md non-modification rule, asserted by test 6 in question-service-pre-gate suite).

### Human Verification

Already cleared by operator on 2026-05-17 per `47-06-SUMMARY.md` outcomes table (all 7 UAT items including UAT-5 multi-turn evasion fix). No outstanding human verification needed.

### Gaps Summary

None. All 7 ROADMAP success criteria verified by code inspection + test execution. UAT-5 regression test (Test 18d) pins the multi-turn evasion fix. Phase 35 KV-cache invariant (byte-stable system prompt) preserved. Goal achieved: regex-only classifier replaced by hybrid, malicious prompts blocked pre-LLM with no token spend, structural bracketing in place, eval set in tree, override path re-fires classification.

---

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_
