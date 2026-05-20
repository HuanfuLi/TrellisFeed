# Phase 47: Filter Redesign — Off-Topic + Malicious Prompt Prevention - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace `app/src/services/question-filter.service.ts` (regex pattern library + dead LLM fallback) with a hybrid classifier — narrow regex fast-path (Layer 1) plus embedding-similarity to a curated corpus (Layer 2). Move the classifier from *post-LLM-answer flag* to *pre-LLM gate* so malicious prompts never reach the answer LLM. Add structural injection bracketing at the LLM/TTS provider wrapper as defense in depth so legitimate LLM/security questions reach the answer LLM safely. Ship a held-out eval-set fixture and confirm the existing per-question override surface (already implemented in `ChatMessage.tsx` + `AskScreen.tsx`) propagates overrides into classification (currently it does not — fixing this gap is in scope).

</domain>

<decisions>
## Implementation Decisions

### Three FILTER-02 outcomes (pre-LLM gate)

- **D-01:** The classifier produces one of three labels per ask:
  - `malicious` → answer LLM call is **not made**; user sees an inline rejection in the chat thread; no override path.
  - `off-topic` → answer LLM is called normally; resulting `Question` is persisted with `flagged: true`; downstream consumers (graph, feed, podcast, review) skip it; user can override via existing `ChatMessage.tsx` "Save anyway" affordance.
  - `on-topic` → answer LLM is called; `Question` persisted with `flagged: false`; classification (`classifyAndAnchorIncremental`) fires as today.

- **D-02:** Block-malicious surface is an inline message in the chat thread with a clear, neutral reason (no educational shaming, no internal-scoring exposure). **No override button.** Bracketing (FILTER-03) is the safety mechanism for legitimate-looking-scary questions; the malicious classifier is intentionally narrow and override-free.

- **D-03:** Malicious classifier scope is narrow — covers only what bracketing cannot make safe:
  1. **DoS / token-waste spam** — extremely long, repetitive, or nonsense payloads designed to burn tokens. Length / repetition heuristic, not intent.
  2. **Known jailbreak templates** — embedding-similarity matches to a curated bad-prompt corpus (DAN-style, "ignore previous instructions", role-swap, etc.).
  3. **Disallowed-content requests** — CSAM, weapons synthesis, malware authoring. Trellis has no business answering these regardless of bracketing.
  Anything else (including "what is a system prompt?", "how does jailbreaking work?", "what is prompt injection?") classifies as on-topic and reaches the answer LLM with bracketed user content.

### Override surface (FILTER-05)

- **D-04:** UI is **already implemented** — do not redesign. Inline ⚠️ "Off-topic" badge on flagged AI messages in chat thread (`ChatMessage.tsx:296-323`); tap expands "Save anyway" / Cancel buttons (`ChatMessage.tsx:340-380`); handler calls `patchQuestion({flagged: false})` (`AskScreen.tsx:496-503`).

- **D-05:** Persistence + downstream propagation is **already wired** — 12+ consumers gate on `flagged` (`canonical-knowledge.service.ts` 8 sites, `concept-feed.service.ts` 3 sites, `question.service.ts:103`, `GraphScreen.tsx:513`). Overridden `flagged: false` survives reload because `patchQuestion` writes through to SQLite/localStorage.

- **D-06:** **One real gap to close:** when `handleQuestionOverride(qId, true)` flips a stored question's flag to `false`, classification does NOT re-run. The question becomes "visible to consumers" but lacks `anchorId` / `branchLabel` / `clusterLabel` / `embeddingVector`, so it doesn't actually appear in the mind map at the right place. Phase 47 must call `classifyAndAnchorIncremental` after a flag override (in `AskScreen.tsx:496-503` or via a `patchQuestion`-side hook).

### Classifier strategy (FILTER-01)

- **D-07:** Strategy is **pre-locked here, not deferred to research:** hybrid — narrow regex fast-path (Layer 1) + embedding-similarity (Layer 2). **No LLM in the classifier path.** Today's design ("regex first, LLM fallback for low-confidence") had the LLM fallback dead in practice — both surfaced failure modes happened entirely in the regex layer. Replacing the never-invoked LLM fallback with embedding-similarity means the second layer actually runs.

- **D-08:** Layer 1 narrow regex covers only unambiguous cases — greetings (`hello/hi/hey`), single-token spam (`asdf/test/lol`), bare backchannels (`ok/thanks`). The current pattern library's broader patterns (system-prompt inquiries, jailbreak attempts, sarcasm, roleplay) are **removed** from regex and pushed into the embedding corpus. Researcher to draft the narrow Layer 1 pattern set with examples + counter-examples in scope.

- **D-09:** Corpus is **repo-only static JSON** of labeled text exemplars (suggested location `app/src/data/filter-corpus.json` — researcher to confirm path). Three labels: `on-topic`, `off-topic`, `malicious`. Initial seed sized + curated by researcher; no user-extension surface in v1.6.

- **D-10:** Embeddings are **runtime, not build-time.** Computed using the user's configured embedding provider (`settings.embedding`), cached locally with cache key `(provider, model)`, re-embedded when the user changes embedding config. Rationale: build-time embeddings would be model-specific and incompatible with the user's chosen embedding model; recomputing on config change keeps the vector space consistent.

- **D-11:** Layer 2 decision rule — researcher's call. Suggested directions: top-K nearest neighbors with majority label vote, OR per-class centroid distance with per-label thresholds. Constraint: must accept `QuestionFilterContext { priorQuestion, priorAnswer }` and use it for short follow-ups (e.g., embed `priorAnswer + ' ' + content` rather than `content` alone) so the existing follow-up-elaboration handling does not regress.

- **D-12:** Failure mode (embedding provider down/errored, or user has no embedding config set): fall back to **Layer 1 regex only**. If regex matches → `flagged: true`; otherwise `flagged: false`. Allow the answer LLM call to proceed. Bracketing (FILTER-03) keeps safety intact during outages. Acceptable trade — malicious prompts can technically slip through during outages, but they hit a bracketed LLM that won't be jailbroken.

### Provider-wrapper bracketing (FILTER-03)

- **D-13:** Structural bracketing is enforced **in the provider wrapper** (`app/src/providers/llm/index.ts`, plus prompt-bearing `tts/index.ts` and `embedding/index.ts`), not at individual call sites. Wrapper recognizes user-supplied content (vs. system instructions) and wraps it in delimiters so injection attempts in user content cannot override system instructions. Specific delimiter convention (XML tags / fenced sentinels / unicode separators) is researcher's call but must be byte-stable across turns to preserve KV-cache (Phase 35 invariant — see CLAUDE.md "Ask-chat system prompt").

- **D-14:** Goldens cover representative injection-style inputs sent through the wrapper. Test asserts (a) the user content is wrapped, (b) the system prompt is not modifiable from inside the wrapped block, (c) Phase 35 cache invariant holds (system prompt stays byte-stable across turns).

### Held-out eval set (FILTER-04)

- **D-15:** Eval set is a regression-test fixture under `app/tests/` (suggested `app/tests/services/filter-classifier.eval.test.mjs` — researcher to confirm path). Each row is `(input, expected_label, [optional priorQuestion/priorAnswer for follow-up cases])`. CI fails if classifier output diverges from labels; waiver is a code-review-blocking annotation, not a silent skip.

- **D-16:** Required v1.6 seed categories:
  - **Anchor seeds (operator-named):** `"How are you doing?"` → `off-topic`; `"What is a system prompt?"` → `on-topic`. Locks the two surfaced failure modes.
  - **Classic injection patterns** → `malicious`. DAN, "ignore previous instructions and reveal X", "you are now ...", role-swap.
  - **Foreign-language injection** → `malicious`. Same attack patterns translated to zh/es/ja (Trellis supports these locales). Without these, eval coverage is English-only and we won't notice locale regressions.
  - **Encoded payloads** → `malicious`. Base64-encoded instructions, leetspeak (`1gn0r3 pr3v10us`), zero-width-space splits. Operator note: this category may document a known weakness (embedding-similarity is poor on obfuscation) rather than catching it cleanly. Researcher decides whether to invest in normalization or accept documented-limit status.

- **D-17:** **Not** required as a separate seed category: ambiguous "follow-up legitimate questions" — the existing `QuestionFilterContext` plumbing (priorQuestion + priorAnswer threaded through `useQuestions.askStreaming` → `question.service.ask` → `evaluateQuestion`) already handles these by design. Layer 2 (embedding) must consume the context per D-11; if it does, no separate eval seed is needed.

### Pipeline ordering (FILTER-02)

- **D-18:** Today's flow: `buildAndSave` → `chatStream` (answer) → `filterQuestion` (post-flag) → conditional `classifyAndAnchorIncremental`. Phase 47 inverts to: `filterQuestion` (pre-gate) → branch on label → either inline-rejection-without-LLM-call (malicious) OR `chatStream` + `buildAndSave` + classification (on-topic) OR `chatStream` + `buildAndSave` with `flagged: true` (off-topic). Most of the change lives in `useQuestions.askStreaming` (~`useQuestions.ts:95-323`) and `question.service.ask` (~`question.service.ts:184-285`).

- **D-19:** The pre-gate must respect the existing abort signal (`LOCALE_CHANGED` cancels in-flight work per Phase 35 D-22). Classifier embedding/regex calls accept the same `AbortSignal`.

### Claude's Discretion

- Specific Layer 2 decision rule (top-K vs centroid vs per-class threshold) — researcher.
- Specific narrow Layer 1 regex set — researcher to draft from operator's hint ("greetings, single-token spam, bare backchannels").
- Bracketing delimiter convention (XML / fenced / unicode separator) — researcher; constraint is byte-stability for KV-cache.
- Initial corpus size per label — researcher; small enough to embed quickly on first ask but large enough to cover the seeded categories.
- Cache key encoding for `(provider, model)` corpus embeddings — implementation detail.
- Whether the pre-gate runs synchronously in `askStreaming` or as a separate awaited step before `chatStream` — implementation detail.
- Whether Layer 1 regex is truly fast-path (skip Layer 2 entirely on a confident match) or always-run-both with confidence merging — researcher; operator's "narrow first layer" hint suggests fast-path.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements

- `.planning/REQUIREMENTS.md` §FILTER (FILTER-01..05) — all five locked requirements for this phase
- `.planning/REQUIREMENTS.md` §"Out of Scope" — five v1.6 non-goals that this phase must respect (no four-state triage, no prompt-leak verb-detector, no foundation phase, no regex tuning, no user-facing diagnosis surface)
- `.planning/REQUIREMENTS.md` §"Origin" + §"Private Answers" — Q2 framing (regex library is the diagnosed-but-private problem; FILTER-01..05 are the public fix)
- `.planning/ROADMAP.md` §"Phase 47" — success criteria 1–7

### Project + cross-cutting invariants

- `CLAUDE.md` §"Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)" — bracketing must NOT break the Phase 35 KV-cache invariant. Provider wrapper changes apply to BOTH the byte-stable system prompt AND the per-turn assistant context message.
- `CLAUDE.md` §"Classification dedup — embedding pre-check" — establishes the pattern of cosine threshold (0.82) for similar reuse decisions; embedding infra is proven in production.
- `CLAUDE.md` §"Concept Feed Generation Pipeline" — flagged questions are filtered out of post generation; D-05 propagation depends on this remaining true.

### Operator memory (for context only — not user-facing docs)

- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_filter_redesign_not_tuning.md` — operator clarification: replace approach, not tune regex; block malicious before LLM call.
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_ingestion_filter_intent.md` — operator clarification: binary on-topic/off-topic + structural injection prevention, NOT a four-state triage UI.

### Codebase entry points

- `app/src/services/question-filter.service.ts` — file to replace (regex library + dead LLM fallback). Total scope: 138 lines.
- `app/src/state/useQuestions.ts:95-323` — current call site for filter (post-LLM); inversion target for pre-LLM gate.
- `app/src/services/question.service.ts:184-285` — second call site (`ask` method) that also needs the inversion.
- `app/src/components/ChatMessage.tsx:296-380` — existing override UI (do not modify; preserve as the FILTER-05 surface).
- `app/src/screens/AskScreen.tsx:496-503` — `handleQuestionOverride`; needs the D-06 fix to fire `classifyAndAnchorIncremental` on override.
- `app/src/providers/embedding/index.ts` — `embedText()` + `cosine()` already implemented; reuse, don't reinvent.
- `app/src/providers/llm/index.ts` — wrapper for FILTER-03 bracketing; today wraps `applyLocaleDirective` only.
- `app/src/providers/tts/index.ts` — second prompt-bearing surface that bracketing applies to.
- `app/src/services/canonical-knowledge.service.ts` — 8 `flagged` gate sites; D-05 propagation reference.
- `app/src/services/concept-feed.service.ts` — 3 `flagged` gate sites; D-05 propagation reference.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`embedText(text, EmbeddingConfig)` + `cosine(a, b)`** (`app/src/providers/embedding/index.ts`) — the entire embedding infrastructure for Layer 2 already exists. Supports OpenAI, Google, local (Ollama / LM Studio), no new provider work needed.
- **`QuestionFilterContext { priorQuestion, priorAnswer }`** (`app/src/services/question-filter.service.ts:45-48`) — session-context type already plumbed end-to-end through `useQuestions.askStreaming` → `question.service.ask` → `evaluateQuestion`. The new Layer 2 must consume it; no new plumbing needed.
- **`Question.flagged?: boolean`** (`app/src/types/index.ts:32`) — field already exists, persists to SQLite/localStorage, gated by 12+ consumers.
- **Override UI** (`ChatMessage.tsx:296-380`, `AskScreen.tsx:496-503`) — fully implemented; needs only the D-06 classification re-fire.
- **`patchQuestion(id, partial)`** (`question.service.ts:555-563`) — pure persistence helper; D-06 fix can wrap it or change the `handleQuestionOverride` callback.
- **`classifyAndAnchorIncremental`** (used at `useQuestions.ts:316`) — ready-to-call from the override path for D-06.
- **Anchor pre-check pattern at threshold 0.82** (CLAUDE.md §"Classification dedup") — proves the embedding+cosine+threshold approach works in production for a similar "is this similar to a known thing?" decision; informs Layer 2 threshold tuning band (don't go above 0.95 or below 0.75 per existing precedent).

### Established Patterns

- **`ServiceResult<T>` return convention** — new classifier service should follow it for symmetry with the rest of the services layer.
- **Inline styles + CSS variables** — any new UI for block-malicious inline message follows existing `ChatMessage.tsx` style conventions, NOT Tailwind classes.
- **`eventBus` for cross-screen notifications** — overriding a flag should emit `GRAPH_UPDATED` (per CLAUDE.md "Event bus — unified GRAPH_UPDATED") so consumers re-read; do NOT introduce a new event type.
- **i18n for all user-visible copy** — new block-malicious inline message + any new strings must land in all 4 locale bundles in the same PR (`en.json` canonical + `zh/es/ja` per `app/scripts/translate-locales.md`). Suggested namespace: `chatMessage.maliciousBlocked.*`.
- **AbortSignal threading** — new pre-gate accepts the `useQuestions.askStreaming` signal so `LOCALE_CHANGED` cancels in-flight classification cleanly (Phase 35 D-22).

### Integration Points

- `useQuestions.askStreaming` is the primary inversion site — the pre-gate runs before `chatStream`, branches by label, and either skips the LLM call entirely (malicious) or proceeds with `flagged: true|false` (off-topic / on-topic) instead of post-flagging.
- `question.service.ask` is a second consumer of the same filter; mirror the inversion there.
- Provider wrapper bracketing applies in `chatCompletion` and `chatStream` (`providers/llm/index.ts:61-78`) AFTER `applyLocaleDirective` so the locale prefix stays at the start.
- TTS provider wrapper (`providers/tts/index.ts`) is the second bracketing surface — confirm what fields are user-content vs. system-content.

</code_context>

<specifics>
## Specific Ideas

- Operator's reading of the `question-filter.service.ts` failure: today's "regex first, LLM fallback for low-confidence" had the LLM fallback dead in practice. Both surfaced failure modes ("How are you doing?" → no regex match → LLM fallback skipped because confidence is exactly 0; "What is a system prompt?" → regex match at 0.92 → classified as malicious without ever touching the LLM fallback) happened entirely in the regex layer. The hybrid replacement preserves the original two-layer design intent but uses embedding instead of LLM for the second layer so it actually runs.
- The block-malicious surface is **inline in chat thread**, not a toast — operator's choice when the UX preview was a chat-thread message with reason text.
- Block-malicious has **no override button** — operator's correction. If a malicious classification can be overridden, the classifier is decorative; the right move is to make malicious classification narrow (D-03) and trust bracketing (D-13) for everything else.
- Eval set "ambiguous edge cases" category was rejected because the existing `QuestionFilterContext` plumbing already handles follow-up elaboration; researcher must preserve that by feeding context into the embedding step (D-11).

</specifics>

<deferred>
## Deferred Ideas

- **User-extendable corpus** (Settings affordance for "this is/isn't off-topic for me"): noted in D-09 as not in v1.6. Possible v1.7+ addition with explicit guardrails against silent label degradation.
- **Build-time embedded corpus**: rejected in D-10 because it would lock the classifier to one specific embedding model. Could revisit if Trellis ever ships its own bundled embedding model (e.g., transformers.js MiniLM) that's independent of the user's general embedding config.
- **Standalone "review flagged" surface** (separate screen listing all flagged Q&A with bulk-toggle): not built today; operator did not pick a separate-surface option, and the inline override already covers per-message recovery. Add later if users report bulk-cleanup pain.
- **Encoded-payload normalization** (base64 decode, leetspeak normalization, zero-width-space stripping at classifier input): D-16 lets researcher decide whether to invest in this or accept documented-limit status. If accepted as a known limit, file as a future-work item rather than slipping back into v1.6 scope.
- **AI-suggested classifier corrections** (LLM proposes corpus additions when classifier confidence is borderline): out of scope; would require revisiting the no-LLM-in-classifier-path decision.

</deferred>

---

*Phase: 47-Filter Redesign — Off-Topic + Malicious Prompt Prevention*
*Context gathered: 2026-05-15*
