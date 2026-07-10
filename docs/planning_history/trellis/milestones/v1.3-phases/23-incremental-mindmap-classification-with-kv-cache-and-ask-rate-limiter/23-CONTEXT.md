# Phase 23: Incremental Mindmap Classification with KV Cache and Ask Rate Limiter - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the single-call `classifyAndAnchor` LLM classification with an incremental 3-step pipeline (branch → cluster → anchor) that leverages KV cache for cost efficiency at scale. Add a configurable monthly rate limiter for user Q&A streaming requests on the Ask screen, displayed in a combined "Usage" section in Settings.

</domain>

<decisions>
## Implementation Decisions

### Pipeline Conversation Design
- **D-01:** 3-step sequential LLM pipeline: branch selection → cluster selection → anchor selection. Each step builds on prior context via append-only conversation (same message array grows with each step).
- **D-02:** Index-based selection — present candidates as a numbered list; LLM responds with an index number or `{"index":"NEW","name":"..."}` for new creations. Most compact response format.
- **D-03:** Each step returns selection + name only (for NEW). No briefAnswer, keyword, or placementReason in pipeline responses. Labels are derived from the selected/created node's existing data.
- **D-04:** System prompt is stable and generic ("You are a knowledge classifier..."). All variable content (question text, candidate lists) goes in user messages to maximize KV cache hits across calls.
- **D-05:** Append-only conversation threading — step 2 sees the full step-1 exchange as prefix, step 3 sees steps 1+2. Maximizes KV cache reuse since the prefix is identical between steps.
- **D-06:** Short-circuit — if any step returns NEW, skip remaining steps and create all downstream nodes in code (1 call for new branch, 2 calls for new cluster under existing branch, 3 calls for existing anchor).
- **D-07:** No partial commits — collect all 3 decisions (branch, cluster, anchor) before creating or attaching any nodes. Only mutate state after the full pipeline completes.

### Fallback & Error Strategy
- **D-08:** When a pipeline step fails (LLM error, invalid JSON, timeout, invalid index), retry the failed step once with the same context.
- **D-09:** If retry also fails, fall back to the existing single-call `classifyAndAnchor` function. Old code is kept specifically as a fallback path.
- **D-10:** Invalid LLM responses (out-of-bounds index, non-numeric response, malformed JSON) are treated as step failures, triggering the retry mechanism.

### Rate Limiter Scope & UX
- **D-11:** Monthly quota model — counter tracks total `askStreaming` requests per calendar month. Resets on the 1st of each month. Stored as `{count, yearMonth}` in localStorage.
- **D-12:** Only counts user Q&A streaming requests (`askStreaming` in `useQuestions`). Does NOT count system LLM calls (classifyAndAnchor, post generation, podcast generation, news summarization, etc.).
- **D-13:** Off by default — 0 means unlimited. Users opt-in by setting a positive integer in Settings.
- **D-14:** Setting appears in a combined "Usage" section in Settings (merging with the existing "Token Usage" section, renamed to "Usage"). Shows current month's count, the limit, and reset date.
- **D-15:** Inline banner in Ask screen appears only when usage reaches 80%+ of the limit or when the limit is hit. Does not show during normal usage below threshold.
- **D-16:** Hard block when limit is hit — send button is disabled, banner shows "Monthly limit reached — resets on [date]". Users must wait for reset or increase the limit in Settings.

### Migration & Cleanup
- **D-17:** Old single-call `classifyAndAnchor` is kept as fallback code path, not removed. Used when the pipeline fails after retry.
- **D-18:** Existing unanchored/legacy nodes are left as-is. No auto-classification on upgrade. Users can click Re-organize to classify everything.
- **D-19:** The Re-organize button keeps its separate full-reorg LLM call (`_doReorganize`). The incremental pipeline is only for new single-question classification.

### Claude's Discretion
- Implementation details of the prompt template (exact wording, JSON schema enforcement)
- localStorage key naming for rate limit counter
- Exact threshold for "near limit" banner (80% suggested but Claude can adjust)
- How to structure the new pipeline function alongside the old classifyAndAnchor

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Classification System
- `app/src/services/canonical-knowledge.service.ts` — Current classifyAndAnchor implementation (lines 418-650), buildTreeContext, buildAnchorReflectionTree, reorganizeMindmap
- `app/src/types/index.ts` — AppEvent types (QUESTION_ANCHORED), ClassificationResult type, AppSettings/LLMConfig

### LLM Provider
- `app/src/providers/llm/index.ts` — chatCompletion function used for classification calls, CompletionOptions interface

### Ask Flow
- `app/src/state/useQuestions.ts` — askStreaming function (line 80+), where classifyAndAnchor is called fire-and-forget (line 226)
- `app/src/services/question.service.ts` — buildAndSave, ask() method with its own classifyAndAnchor call (line 262)

### Settings & UI
- `app/src/screens/SettingsScreen.tsx` — Where rate limit setting will be added (existing Token Usage section to be renamed)
- `app/src/services/mock/settings.mock.ts` — Settings persistence in localStorage
- `app/src/components/ChatInput.tsx` — Where send button disable logic will be added

### Graph Screen (consumer)
- `app/src/screens/GraphScreen.tsx` — Subscribes to QUESTION_ANCHORED event (line 804), calls reload()

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `chatCompletion()` in `providers/llm/index.ts` — used for all non-streaming LLM calls, supports `serviceName` option for token tracking
- `eventBus` in `lib/event-bus.ts` — pub/sub for `QUESTION_ANCHORED` and other events
- `questionService.patchQuestion()` — patches individual question fields in localStorage
- `questionService.getAll()` — reads all questions from localStorage (fresh read each call)
- `toast()` in `lib/toast.ts` — user-facing notifications

### Established Patterns
- Fire-and-forget async classification after Q&A is saved (void classifyAndAnchor(...).catch(...))
- Services return `ServiceResult<T> = { success, data?, error? }`
- Settings stored via `mockSettingsService` with localStorage persistence
- CSS variables for styling (`--primary-40`, `--surface`, `--muted-foreground`)

### Integration Points
- `classifyAndAnchor` is called from two places: `useQuestions.askStreaming` (line 226) and `questionService.ask` (line 262)
- Rate limiter needs to intercept at `askStreaming` entry point in `useQuestions.ts`
- Settings UI integrates into existing SettingsScreen sections

</code_context>

<specifics>
## Specific Ideas

- User wants a PROBLEM_SOLVING_ROADMAP.md for capturing difficult design questions and solutions encountered during implementation
- Pipeline response format: index number for existing selection, `{"index":"NEW","name":"..."}` for new creation
- The single prompt template should be parameterized by level name ("branch"/"cluster"/"anchor") and candidate list

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter*
*Context gathered: 2026-04-09*
