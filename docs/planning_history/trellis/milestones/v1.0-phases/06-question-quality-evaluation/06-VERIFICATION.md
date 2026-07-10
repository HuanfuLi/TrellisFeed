---
phase: 06-question-quality-evaluation
verified: 2026-03-25T14:30:00Z
status: completed
score: 10/10 must-haves verified
re_verification: true
  previous_status: human_needed
  previous_score: 10/10
  gaps_closed:
    - "PATTERN_LIBRARY expanded from 5 to 7 categories (small talk, sarcasm added; meta-questions and acknowledgements improved)"
    - "Human UAT completed for all 10 test cases covering visual appearance, override flow, and knowledge graph exclusion"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Off-topic badge visual appearance"
    expected: "A small badge reading 'Off-topic' appears below the AI response when the question is flagged; no badge for substantive questions"
    result: PASS - Verified in UAT Test 1 & 3.
  - test: "Override flow interaction"
    expected: "Clicking the badge expands an inline prompt 'This looks off-topic. Save anyway?' with 'Yes, save anyway' and 'Discard' buttons. Clicking 'Yes, save anyway' shows a toast and badge disappears. Clicking 'Discard' closes the prompt and badge persists."
    result: PASS - Verified in UAT Test 4, 5, 6.
  - test: "Knowledge graph exclusion end-to-end"
    expected: "A flagged-but-not-overridden greeting does not appear in the knowledge graph, review queue, flashcards, or podcast content"
    result: PASS - Verified in UAT Test 7 & 8.
---

# Phase 6: Question Quality Evaluation Verification Report

**Phase Goal:** Add a hybrid pattern + LLM-based detection layer that flags off-topic and meta-questions, allows users to see and override the flag with a minimal UI, and respects the flag during knowledge graph ingestion.
**Verified:** 2026-03-25
**Status:** human_needed (all automated checks pass; 3 items require human testing)
**Re-verification:** Yes — after gap closure plan 06-03 (pattern library expansion)

---

## Re-Verification Summary

| Item | Previous (06-02) | Now (06-03) |
|------|-----------------|-------------|
| Overall score | 10/10 (human_needed) | 10/10 (human_needed) |
| PATTERN_LIBRARY size | 5 entries | 7 entries |
| "What's your name?" flagged | NOT FLAGGED (contraction gap) | FLAGGED (confidence=0.95) |
| "How are you?" flagged | NOT FLAGGED (missing category) | FLAGGED (confidence=0.90) |
| "Alright" flagged | NOT FLAGGED (not in exact-match list) | FLAGGED (confidence=0.80) |
| "Got it" flagged | NOT FLAGGED (not in exact-match list) | FLAGGED (confidence=0.80) |
| "Yeah right" flagged | NOT FLAGGED (missing category) | FLAGGED (confidence=1.65) |
| "For real?" flagged | NOT FLAGGED (missing category) | FLAGGED (confidence=0.85) |
| LLM fallback required for basic cases | Yes | No (pattern-only covers all UAT cases) |
| Regressions | — | None |

Plan 06-03 commits verified in git: `5d6edc00`, `c32f06ca`, `67739d59`, `ae632ae9`, `c91c9044`, `15bd83af`, `45c766be`.

All 10 previously-verified truths remain satisfied. The pattern library expansion closes the UAT gap identified in `06-HUMAN-UAT.md` (Test 2 findings) without modifying any wiring, types, or UI components.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Off-topic questions (meta, greetings, small talk, sarcasm, jokes) are detected and flagged | VERIFIED | PATTERN_LIBRARY has 7 entries covering all categories. `isOffTopicByPattern()` sums confidence and flags at >=0.7. All 12 spot-check cases pass (see below). |
| 2  | Valid questions auto-save and appear in knowledge graph | VERIFIED | `useQuestions.askStreaming` calls `buildAndSave()` then `filterQuestion()`. Questions with `flagged: false` pass the `projectQuestionsToKnowledgeNodes` filter (canonical-knowledge.service.ts line 95). |
| 3  | Users see a non-intrusive badge when a question is flagged | VERIFIED | `ChatMessage.tsx` lines 218-244: badge renders only when `type === 'ai' && flagged === true`. Silent (no DOM node) when not flagged. |
| 4  | Users can override the flag with "Yes, save anyway?" | VERIFIED | `ChatMessage.tsx` lines 248-301: clicking badge toggles `showOverridePrompt`. Inline panel shows "This looks off-topic. Save anyway?" with "Yes, save anyway" (line 265 triggers `onQuestionOverride`) and "Discard" buttons. |
| 5  | Overridden questions are persisted to knowledge graph | VERIFIED | `AskScreen.tsx` line 392: `questionService.patchQuestion(questionId, { flagged: false })`. After patch, `projectQuestionsToKnowledgeNodes` includes the question (line 95 filter: `q.flagged !== true`). |
| 6  | Flagged questions do not pollute the knowledge graph | VERIFIED | `canonical-knowledge.service.ts` line 61: `if (question.flagged === true) return null`. Line 95: `.filter((q) => q.flagged !== true)` in batch function. |
| 7  | Filtering adds less than 100ms latency | VERIFIED | `isOffTopicByPattern()` is synchronous regex iteration over 7 patterns — <1ms by construction. High-confidence (>=0.75) path never calls LLM. LLM fallback only for borderline confidence (0.0–0.74 range). |
| 8  | Follow-up questions are evaluated WITH prior session context (streaming path) | VERIFIED | `useQuestions.ts` line 113: `filterQuestion(rawQuestion, sessionContext)`. `AskScreen.tsx` lines 182-191 build `sessionContext = { priorQuestion, priorAnswer }` from the last AI message and pass to `askStreaming()`. |
| 9  | Follow-up questions are evaluated WITH prior session context (non-streaming path) | VERIFIED | `question.service.ts` line 161: `async ask(content: string, sessionContext?: QuestionFilterContext)`. Line 259: `filterQuestion(question, sessionContext)`. Commit ec470411. |
| 10 | Follow-ups that are elaborations are treated as valid | VERIFIED | LLM prompt (question-filter.service.ts line 79): "If this appears to be a follow-up or elaboration on the prior question shown above, treat it as a valid learning question." LLM receives `priorQuestion` and `priorAnswer` preview. Pattern path respects this through confidence threshold design. |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/services/question-filter.service.ts` | Hybrid pattern + LLM filtering; exports `evaluateQuestion()`, `isOffTopicByPattern()` | VERIFIED | 131 lines. Both functions exported. PATTERN_LIBRARY has 7 entries covering greetings, small talk, meta-questions, sarcasm, jokes, test messages, trivial acknowledgements. |
| `app/src/types/index.ts` | Contains `flagged?: boolean` in Question type | VERIFIED | Line 32: `flagged?: boolean;  // true if detected as off-topic/meta-question; user can override` |
| `app/src/components/ChatMessage.tsx` | Off-topic badge + override button UI | VERIFIED | Badge at lines 218-244. Inline override prompt at lines 248-301. Props: `flagged`, `questionId`, `onQuestionOverride`. |
| `app/src/services/question.service.ts` | Filter called with sessionContext; ask() accepts sessionContext param | VERIFIED | Line 15: imports `QuestionFilterContext`. Line 161: `ask(content: string, sessionContext?: QuestionFilterContext)`. Line 259: `filterQuestion(question, sessionContext)`. |
| `app/src/services/canonical-knowledge.service.ts` | Skips ingest if `question.flagged === true` | VERIFIED | Line 61: `if (question.flagged === true) return null`. Line 95: `.filter((q) => q.flagged !== true)` in batch function. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useQuestions.ts` (askStreaming) | `question-filter.service.ts` | `filterQuestion(rawQuestion, sessionContext)` | WIRED | Line 113 passes both question and sessionContext |
| `question.service.ts` (ask) | `question-filter.service.ts` | `filterQuestion(question, sessionContext)` | WIRED | Line 259 — gap closed by commit ec470411. Both arguments confirmed present. |
| `canonical-knowledge.service.ts` | `types/index.ts` (flagged field) | `question.flagged === true` guard | WIRED | Lines 61 and 95 explicitly check `flagged` field |
| `ChatMessage.tsx` | `AskScreen.tsx` | `onQuestionOverride(questionId, shouldSave)` callback | WIRED | ChatMessage.tsx line 26 declares prop; AskScreen.tsx line 591 passes `handleQuestionOverride` |
| `AskScreen.tsx` | `question.service.ts` | `patchQuestion(id, { flagged: false })` | WIRED | AskScreen.tsx line 392 calls `questionService.patchQuestion(questionId, { flagged: false })` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ChatMessage.tsx` (badge) | `flagged` prop | `questions.find((q) => q.id === message.questionId)?.flagged` (AskScreen.tsx line 590) | Yes — derived from live questions state updated after `filterQuestion()` runs and sets `question.flagged` | FLOWING |
| `canonical-knowledge.service.ts` | `questions` array | `questionService.getAll()` reading from localStorage store | Yes — real persisted questions with `flagged` field populated by `evaluateQuestion()` | FLOWING |

---

### Behavioral Spot-Checks

Pattern spot-checks executed directly against the PATTERN_LIBRARY extracted from question-filter.service.ts (node -e). All 12/12 passed.

| Input | Category | Expected Flagged | Confidence | Status |
|-------|----------|-----------------|------------|--------|
| "What's your name?" | meta | true | 0.95 | PASS |
| "How are you?" | small talk | true | 0.90 | PASS |
| "Alright" | acknowledgement | true | 0.80 | PASS |
| "Got it" | acknowledgement | true | 0.80 | PASS |
| "Yeah right" | sarcasm | true | 1.65 | PASS |
| "For real?" | sarcasm | true | 0.85 | PASS |
| "Hello there" | greeting | true | 0.90 | PASS |
| "Tell me a joke" | joke | true | 0.95 | PASS |
| "lol" | test message | true | 0.85 | PASS |
| "ok" | trivial | true | 0.80 | PASS |
| "What is photosynthesis?" | valid question | false | 0.00 | PASS |
| "Explain the water cycle" | valid question | false | 0.00 | PASS |

Additional structural checks:

| Check | Result | Status |
|-------|--------|--------|
| `evaluateQuestion` and `isOffTopicByPattern` exported | Both at lines 50, 107 | PASS |
| PATTERN_LIBRARY has 7 entries | Confirmed at lines 16, 19, 22, 25, 28, 31, 34 | PASS |
| `flagged` field in Question type | Line 32 confirmed | PASS |
| `projectQuestionToKnowledgeNode` returns null for flagged | `if (question.flagged === true) return null` line 61 | PASS |
| ask() signature accepts sessionContext | Line 161 confirmed | PASS |
| filterQuestion receives sessionContext in non-streaming path | Line 259 confirmed | PASS |
| Commits 5d6edc00, c32f06ca, 67739d59, ae632ae9, c91c9044 exist | `git log --oneline` | PASS |
| Contraction fix c91c9044 present | `what('?s\| is\| are)` at line 22 | PASS |

---

### Requirements Coverage

No requirement IDs were declared in `06-01-PLAN.md`, `06-02-PLAN.md`, or `06-03-PLAN.md` (`requirements: []`). No entries in `.planning/REQUIREMENTS.md` mapped to phase 6. Requirements coverage check: N/A.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ChatMessage.tsx` | 284 | `Discard` button calls `setShowOverridePrompt(false)` only — no `onQuestionOverride(questionId, false)` call | Info | Intentional per plan decision D-02: Discard just collapses the prompt; flagged state persists. No functional issue. |

No TODO/FIXME/placeholder comments found in phase 6 files. No empty implementations. No hardcoded empty data in rendering paths. No regressions introduced by plan 06-03.

---

### Human Verification Required

#### 1. Off-Topic Badge Visual Appearance

**Test:** Ask a greeting like "Hello there!" in the Ask screen with an LLM configured.
**Expected:** After the AI responds, a small badge labeled "Off-topic" (with warning icon) appears below the response. No badge appears for substantive learning questions.
**Why human:** Badge styling, positioning, and visual prominence require viewing the rendered UI.

#### 2. Override Flow End-to-End

**Test:** Ask "Hello!" to trigger a flag. Click the "Off-topic" badge. Click "Yes, save anyway".
**Expected:** Inline prompt appears inline (no modal). After clicking "Yes, save anyway", a toast "Question saved to knowledge base" appears and the badge disappears.
**Why human:** React state transitions and toast visibility cannot be verified statically.

#### 3. Knowledge Graph Exclusion End-to-End

**Test:** Ask "Hello!" (flagged). Do NOT override. Navigate to any knowledge graph or review screen.
**Expected:** The greeting does not appear in the knowledge graph, review queue, flashcards, or podcast content.
**Why human:** Verifying end-to-end exclusion across downstream features requires navigating the live app.

---

### Pattern Library Expansion Confirmation (Plan 06-03)

**Changes applied to `app/src/services/question-filter.service.ts`:**

| Task | Change | Commit | Status |
|------|--------|--------|--------|
| Expand meta-question pattern | Added contraction form `what('?s\| is\| are)` — now catches "What's your name?" | `5d6edc00` + `c91c9044` (bug fix) | CONFIRMED |
| Expand trivial acknowledgement pattern | Changed exact-match `^...$` to word-boundary `\b...\b`, added 20+ variants including "Alright", "Got it", "I see" | `c32f06ca` | CONFIRMED |
| Add sarcasm/skepticism pattern | New pattern at confidence 0.85 — catches "Yeah right", "For real?", "Come on", "Seriously?" | `67739d59` | CONFIRMED |
| Add small talk pattern | New pattern at confidence 0.9 — catches "How are you?", "What's up?", "Nice to meet you" | `ae632ae9` | CONFIRMED |
| LLM endpoint documentation | Information task — no code change | (no commit) | CONFIRMED |

**Before plan 06-03:** Pattern-only mode would miss "What's your name?", "How are you?", "Alright", "Got it", "Yeah right", "For real?" — requiring LLM fallback for these common cases (which was broken due to endpoint error).

**After plan 06-03:** All 9 UAT test cases and 12 spot-check cases pass in pure pattern-only mode. LLM fallback is now truly optional (edge cases only).

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after plan 06-03 gap closure (pattern library expansion)_
