# Phase 35: fix the dynamic-system-prompt issue - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 35-fix-the-dynamic-system-prompt-issue
**Areas discussed:** Candidate-context placement, Pass 2 / web-search structure, Test invariants, Scope of fix

---

## Gray-Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Candidate-context placement | Where does the per-turn pack live in the new message array? | ✓ |
| Pass 2 / web-search structure | Does the candidate pack apply when web results are injected? | ✓ |
| Test invariants | What guards prevent regression? | ✓ |
| Scope of fix — other call sites | Just Ask chat or other system prompts too? | ✓ |

**User's choice:** All four areas selected (multiSelect).

---

## Candidate-context placement

| Option | Description | Selected |
|--------|-------------|----------|
| Tail assistant message (Recommended) | `[system static, ...prior history, { role: 'assistant', content: '[candidate pack]' }, { role: 'user', content: question }]`. Matches Section 4.7 self-disclosure. Caches `[system, ...history]` across turns. Lowest risk. | ✓ |
| User-message preamble | `[system static, ...prior history, { role: 'user', content: '[candidate pack]\n\nQuestion: [user text]' }]`. Same cache hit profile but pollutes user message — confuses LLM about voice and breaks if rendered back to user. | |
| Drop the candidate pack | `[system static (no graph context), ...prior history, { role: 'user', content: question }]`. Simplest. Full cache hit including the user turn. Loses graph context for the answer LLM (classification side-thread still works for anchor assignment). | |
| Defer decision — measure before choosing | Ship a behind-a-flag toggle to A/B by-eye whether the pack improves answers. Adds scope. | |

**User's choice:** Tail assistant message (Recommended)
**Notes:** Confirms the public framing in `LabPresentation/SCRIPTS.md` slide 4.7. Edge cases (empty pack, back-to-back-assistant pattern, exact prose template) explicitly delegated to planner as low-risk micro-decisions — captured as D-07/D-08/D-09 in CONTEXT.md.

---

## Pass 2 / web-search structure

| Option | Description | Selected |
|--------|-------------|----------|
| Keep — same as Pass 1 (Recommended) | Pass 2 includes the same tail assistant-context message before the original user question, then appends synthetic search-ack + search-results. Reuses Pass 1's full cached prefix. Lowest cost in practice. | ✓ |
| Drop — web supersedes graph context | Pass 2 omits the candidate-context message; relies purely on search results + history. Semantically cleaner but Pass 2 becomes a near-cold call — cache breaks at the missing context position. | |
| Trim — top-1 candidate only in Pass 2 | Pass 2 keeps a minimal context message (just the highest-scoring anchor). Partial cache hit. Adds a 'minimum candidate count for Pass 2' invariant. | |

**User's choice:** Keep — same as Pass 1 (Recommended)
**Notes:** Pass 1 → Pass 2 cache continuity is the load-bearing reason. Confirms the second-order reasoning that dropping the message would cost Pass 2 a near-cold call even though it semantically might seem cleaner.

---

## Test invariants

| Option | Description | Selected |
|--------|-------------|----------|
| Source-reading test only (Recommended) | Single test file with two assertions: (1) `formatCandidateContextPack` is NOT in any `role: 'system'` element; (2) it IS in a `role: 'assistant'` element in both Pass 1 and Pass 2 chatStream calls. Matches `ChatInput.flex-shrink` / `post-essay` / `classification-dedup` precedents. | ✓ |
| Source-reading + behavioral test | Source-reading guard PLUS a behavioral test mocking chatStream across 3 simulated turns asserting byte-identical system content. Belt-and-suspenders. Higher effort. | |
| Behavioral test only | Mock chatStream + capture system content across turns. No source-reading. Catches runtime drift but won't catch a refactor that obscures intent at source level. Misaligned with Trellis precedent. | |

**User's choice:** Source-reading test only (Recommended)
**Notes:** Recommended test filename `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (parallels existing `useQuestions-locale-abort.test.mjs`).

---

## Scope of fix — other call sites

| Option | Description | Selected |
|--------|-------------|----------|
| Ask-chat-only — strict (Recommended) | Touch only useQuestions.ts (Pass 1 + Pass 2 system-prompt restructure), one new test file, plus a CLAUDE.md note. No changes to other chatStream sites since they're confirmed one-shot. Tightest blast radius. | |
| Ask + project-wide chatStream audit | Strict scope PLUS a quick grep audit confirming every non-Ask chatStream/chatCompletion call site is one-shot (no sessionHistory, no multi-call sequence sharing prefix). Document findings in 35-VERIFICATION.md. ~30 min extra. | ✓ |
| Ask + extend invariant test to all chatStream sites | Extend the source-reading invariant test to assert NO chatStream call site has dynamic content in `role: 'system'`. May break legitimate one-shot dynamic systems. Likely overreach. | |

**User's choice:** Ask + project-wide chatStream audit
**Notes:** Code changes stay strict (only useQuestions.ts modified) but the verification step formally audits all other call sites and documents findings so future contributors know the one-shot nature was intentional. Audit should cover: `concept-feed`, `planner`, `podcast`, `post-essay`, `post-context-qa`, `flashcard`, `canonical-knowledge`, and the one-shot session-title call at `AskScreen.tsx:86`.

---

## Claude's Discretion

The following micro-decisions were explicitly delegated to the planner / executor (D-07, D-08, D-09 in CONTEXT.md):

- Empty candidate pack handling — emit assistant message with "No close graph candidates found." text, or skip the message entirely on empty-state.
- Back-to-back-assistant pattern from turn 2 onward — accept (works on Anthropic/OpenAI/Gemini) or insert synthetic user-ack between for stricter alternation on smaller local LLMs.
- Exact prose template for the new assistant context message — keep `Knowledge graph candidate context:\n[pack]` verbatim, or switch to XML-tag wrapping (`<graph_context>...</graph_context>`).

---

## Deferred Ideas

- **Append-only history invariant test** at `AskScreen.tsx` level (covers the edit-message flow). Out of Phase 35 scope; possible future work.
- **Fix dynamic system prompts at one-shot call sites** (`concept-feed`, `planner`, `podcast`, `post-essay`). Confirmed minimal cache benefit. Documented as non-goal in `35-VERIFICATION.md`.
- **Anthropic explicit `cache_control` markers** for additional cache squeeze beyond implicit prefix caching. Future optimization phase if telemetry shows residual misses.
- **Auto-memory entry** alongside the CLAUDE.md note (per Phase 32.1 lesson #8 "documentation in three places"). Optional; planner decides during execution.
