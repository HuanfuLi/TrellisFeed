# Phase 35: fix the dynamic-system-prompt issue - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

**Goal:** Move the per-turn `formatCandidateContextPack(candidatePack)` interpolation **out of the system role** in `useQuestions.askStreaming`, so the system prompt becomes byte-stable across chat turns and the provider's KV-cache prefix covers the full conversation history (not just the static head before the dynamic interpolation).

**In scope:**
- `app/src/state/useQuestions.ts` Pass 1 (line ~160) and Pass 2 (line ~219) `chatStream` arrays — restructure to keep the system message static and inject candidate-context as a tail-position assistant message before the new user turn.
- One new source-reading invariant test enforcing the structural guarantee.
- A new load-bearing-rule section in `app/CLAUDE.md` documenting the "static system prompt for Ask chat" rule (alongside the existing KV-cache-related sections).
- A documented project-wide `chatStream` / `chatCompletion` audit in `35-VERIFICATION.md` confirming all other call sites are intentionally one-shot (no multi-turn prefix to protect).

**Out of scope:**
- Any change to other system-prompt call sites (`concept-feed`, `planner`, `podcast`, `post-essay`, `post-context-qa`, `flashcard`, `canonical-knowledge` non-descent paths). All confirmed one-shot or already append-only via Phase 23.
- Append-only history invariant guard at `AskScreen.tsx` level (the edit-message flow is intentional cache-break per spec). Could be future work; explicit non-goal here.
- Schema changes to `SessionMessage`, `ChatSession`, or `ChatMessage`. Pure refactor.
- User-visible behavior changes. Answer quality and chat history rendering should be unchanged.

**Success signal:** A multi-turn Ask conversation hits provider KV-cache on the conversation prefix (system + history) instead of breaking at the byte where the candidate pack used to start. Verified via the new source-reading test plus a provider-side cache-hit observation during planner research (planner may use Anthropic's prompt-cache `cache_creation_input_tokens` / `cache_read_input_tokens` headers to confirm empirically).
</domain>

<decisions>
## Implementation Decisions

### Message-array structure (Pass 1)

- **D-01:** The per-turn `formatCandidateContextPack(candidatePack)` output moves to a **tail-position assistant message** placed AFTER the prior conversation history and BEFORE the new user turn. New Pass 1 structure:

  ```
  [
    { role: 'system', content: STATIC_SYSTEM_PROMPT },   // identity + safety + WEB_SEARCH_TOOL_PROMPT only
    ...historyMessages,                                   // prior conversation, append-only
    { role: 'assistant', content: '<candidate context>' },// dynamic, per-turn
    { role: 'user', content: question },                  // current turn
  ]
  ```

  Rationale: Section 4.7 self-disclosure framing. Caches `[system, ...history]` across turns. Lowest-risk pattern for major providers. See `LabPresentation/SCRIPTS.md` slide 4.7 for the public framing the project owner committed to.

### Message-array structure (Pass 2 — web search)

- **D-02:** Pass 2 keeps the **same** tail assistant-context message as Pass 1, preserving the Pass 1 → Pass 2 prefix cache continuity (Pass 2 fires moments after Pass 1, so Pass 1's full prefix is still warm in the provider cache when Pass 2 starts). Pass 2 structure:

  ```
  [
    { role: 'system', content: STATIC_SYSTEM_PROMPT },
    ...historyMessages,
    { role: 'assistant', content: '<candidate context>' },// SAME message as Pass 1
    { role: 'user', content: question },                  // SAME as Pass 1
    { role: 'assistant', content: 'I searched the web...' }, // synthetic search-ack (existing)
    { role: 'user', content: 'Web search results: ...' },    // results + reformulated ask (existing)
  ]
  ```

  Rationale: dropping the candidate-context message in Pass 2 would break the cache at the missing-message position and cost Pass 2 a near-cold call. Keeping it costs zero extra real tokens (already in Pass 1's cache).

### Static system prompt content

- **D-03:** The static `systemPrompt` retains **only** the byte-stable directives:
  - Identity directive: `"You are a knowledgeable learning assistant. Answer questions clearly and thoroughly."`
  - Safety directive: `"Do not generate harmful, illegal, sexually explicit, or deceptive content."`
  - `WEB_SEARCH_TOOL_PROMPT` (existing const at `useQuestions.ts:15-28` — already static)

  The `Knowledge graph candidate context:\n${...}` line is removed from the system prompt and re-emitted inside the new tail assistant message.

  `applyLocaleDirective` (`providers/llm/locale-directive.ts:42`) will continue merging `Respond in {locale}.` into the first system message at provider layer. Locale is byte-stable within a session (LOCALE_CHANGED aborts in-flight streams via Phase 27 D-22), so the merged final system prompt remains stable across turns.

### Test invariants

- **D-04:** Single source-reading test file `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (or similar). Two assertions:
  1. **Negative:** the substring `formatCandidateContextPack` does NOT appear inside any string assigned to a `role: 'system'` element in `useQuestions.ts`. (Catches "someone re-introduces dynamic content into the system prompt".)
  2. **Positive:** the substring `formatCandidateContextPack` DOES appear inside a `role: 'assistant'` element in BOTH `chatStream` calls (Pass 1 + Pass 2). (Catches "someone drops the graph context entirely thinking it's dead code".)

  Pattern matches:
  - `app/tests/components/ChatInput.flex-shrink.test.mjs` (asserts `minWidth: 0` literal exists in source)
  - `app/tests/services/post-essay.service.test.mjs` (asserts `bodyMarkdown: ''` invariant in news creation)
  - `app/tests/services/classification-dedup.test.mjs` (asserts pre-check ordering in source)

### Scope of changes

- **D-05:** Code scope is strict: only `useQuestions.ts` is modified. Audit all other `chatStream` / `chatCompletion` call sites and document findings in `35-VERIFICATION.md` so future contributors know the one-shot nature was an intentional non-goal of Phase 35:
  - `concept-feed.service.ts` — multiple chatStream/chatCompletion sites, all `[system, user]` one-shot
  - `planner.service.ts` — `[system, user]` one-shot
  - `podcast.service.ts` — `[system, user]` one-shot
  - `post-essay.service.ts` — one-shot streaming essay generation
  - `post-context-qa.service.ts` — one-shot
  - `flashcard.service.ts` — one-shot extraction
  - `canonical-knowledge.service.ts` — multi-step classification descent (Phase 23: already append-only — verify pattern intact)
  - `AskScreen.tsx:86` — one-shot session-title generation

### CLAUDE.md addition

- **D-06:** Add a new load-bearing-rule section to `app/CLAUDE.md` titled something like **"Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)"**. Sit it adjacent to existing sections like "Classification dedup — embedding pre-check (Phase 33 UAT-4 — load-bearing)". Section content:
  - One-paragraph rule: no per-turn dynamic interpolation in `useQuestions.ts` system prompt; candidate context lives in a tail assistant message; the source-reading test enforces this.
  - One-paragraph rationale: KV-cache prefix coverage for the conversation history; without it, every turn pays full attention recompute on the system + history.
  - Don't-bypass list: 2-3 specific anti-patterns to avoid.

### Edge cases delegated to planner (low-risk micro-decisions)

- **D-07:** Planner decides whether to **emit the assistant context message when `pack.candidates.length === 0`**. Today `formatCandidateContextPack` returns `'No close graph candidates found.'` for empty pack; either keep emitting or skip the message entirely on empty-state — both byte-stable per session.

- **D-08:** Planner decides handling of the **back-to-back-assistant pattern from turn 2 onward** (sequence becomes `..., user_prev, assistant_prev_reply, assistant_context, user_new` — two assistants in a row). Major providers (Anthropic / OpenAI / Gemini) handle this fine; smaller local LLMs (some Llama/Qwen chat templates) prefer strict alternation. Planner picks: accept the pattern (lowest token cost) or insert a synthetic user-ack between (provider-safe but adds tokens).

- **D-09:** Planner picks the **exact prose template** for the new assistant context message — recommended starting point is the existing `'Knowledge graph candidate context:\n' + formatCandidateContextPack(candidatePack)` text moved verbatim into the assistant content field, but XML-tag wrapping (`<graph_context>...</graph_context>`) is also acceptable if Phase 35 research finds it improves model adherence.

### Claude's Discretion

Within decisions D-07/D-08/D-09 above, planner may choose any approach consistent with the load-bearing rules in D-01..D-06.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The file Phase 35 modifies
- `app/src/state/useQuestions.ts` lines 15-28 (`WEB_SEARCH_TOOL_PROMPT` const), 138-167 (Pass 1 system construction + chatStream call), 218-235 (Pass 2 chatStream call), 149 (the canonical `// Convert SessionMessage[] to ChatMessage[] for the LLM (append-only for KV-cache)` comment from Phase 16-01).
- `app/src/screens/AskScreen.tsx:288` — call site that pipes `priorMessages = current.messages.slice(0, -1)` into `askStreaming`. Append-only history is constructed here. Phase 35 does NOT modify this; included for orientation.

### The candidate-pack source (must NOT change behavior)
- `app/src/services/canonical-knowledge.service.ts:222-290` — `buildCandidateContextPack` (line 222) and `formatCandidateContextPack` (line 264). Phase 35 changes WHERE the formatted pack appears in the message array, not what the pack contains.

### Locale layering (must remain intact)
- `app/src/providers/llm/locale-directive.ts` whole file — `applyLocaleDirective` merges `"Respond in {locale}."` into the first system message. Phase 27 D-12 + D-22 establish locale stability within a session. Phase 35's new static system prompt must be the message that this merger targets.

### Trellis-pattern precedent for the new test
- `app/tests/components/ChatInput.flex-shrink.test.mjs` — source-reading test for `minWidth: 0` flex invariant.
- `app/tests/services/post-essay.service.test.mjs` — source-reading test guarding `bodyMarkdown: ''` invariant in news creation.
- `app/tests/services/classification-dedup.test.mjs` — source-reading test asserting pre-check ordering. Closest structural sibling — a multi-assertion source guard for an LLM-pipeline file.

### CLAUDE.md sections this phase aligns with
- `app/CLAUDE.md` "Classification dedup — embedding pre-check (Phase 33 UAT-4 — load-bearing)" — adjacent ruleset; new Phase 35 rule should sit nearby.
- `app/CLAUDE.md` "Concept Feed Generation Pipeline (load-bearing — read before touching `concept-feed.service.ts` or `post-queue.service.ts`)" — example of how Trellis documents load-bearing patterns.
- `app/CLAUDE.md` "Best practices learned in Phase 32.1 (avoid the same mistakes)" — meta-rules that motivate the source-reading-test pattern and the documentation-in-three-places discipline.

### Public framing — why this phase exists
- `LabPresentation/SCRIPTS.md` slide 4.7 (lines ~190-205) — speaker's self-disclosure: "Trellis hits this today: my system prompt embeds a per-turn candidate context pack ... the fix is mechanical — move the dynamic context out of the system role and into a tail-position assistant message". This phase makes good on that disclosure.
- `LabPresentation/CONTEXT.md` "Optimization 3: KV-cache append-only message ordering" — full provenance + the two-cache-facts framing (TTL + dynamic-prompt invalidation).

### Phase 23 (the predecessor)
- Pre-dates GSD planning artifacts (no `.planning/phases/23-*/` directory exists). Reference: `.planning/PROJECT.md` line 52 — "Phase 23 complete (2026-04-09): Incremental Classification Pipeline + Ask Rate Limiter — replaced single-call classification with 3-step branch→cluster→anchor pipeline using append-only messages for KV cache efficiency." Phase 35 extends this discipline to the chat path.

### Provider docs (planner may consult during research phase)
- Anthropic prompt caching docs (5-minute TTL, `cache_control` markers, `cache_creation_input_tokens` / `cache_read_input_tokens` response headers) — useful for empirical verification.
- OpenAI prompt caching (automatic, prefix-keyed, similar TTL).
- Gemini context caching (explicit cache objects).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `applyLocaleDirective` (`providers/llm/locale-directive.ts:35`) — merges locale into first system message. Continues to work unchanged after Phase 35 since the new static system prompt remains the first system-role element.
- Source-reading test infrastructure already in place (Node `node:test` runner, `node:fs` reads of source files, regex/substring assertions). Three precedents to copy from.
- `ChatMessage` type (`providers/llm/index.ts:11`) supports `'system' | 'user' | 'assistant'` roles — no type change needed.
- `WEB_SEARCH_TOOL_PROMPT` (`useQuestions.ts:15-28`) is already a const, already byte-stable across turns. Stays in the new static system prompt unchanged.

### Established Patterns

- **Append-only message ordering for KV-cache** — Phase 23 established this for the classification descent (`canonical-knowledge.service.ts`). Phase 35 is the same discipline applied to the chat path. Same pattern, different file.
- **Source-reading invariant tests** for load-bearing patterns that span multiple files or are easy to break with a small refactor (Phase 32.1 lessons #1, #2).
- **Documentation in three places** for highly load-bearing rules: CLAUDE.md, auto-memory, and inline service-file comment (Phase 32.1 lesson #8). Phase 35 will need at least the CLAUDE.md entry; auto-memory entry optional but recommended; inline comment at `useQuestions.ts:140` natural to add.
- **Two-pass tool-use streaming** (`askStreaming` Pass 1 → web-search → Pass 2) shares an `AbortController` (Phase 27 D-22). Phase 35 doesn't touch the abort layering.

### Integration Points

- `useQuestions.askStreaming` is called from `AskScreen.tsx:289` and `AskScreen.tsx:294`. No call-site changes needed — the `messages` array sent to `chatStream` is private to `askStreaming`'s closure.
- `i18next` global singleton drives `applyLocaleDirective`. Phase 35 does not touch i18n.

### Known Risks for Planning

- Some smaller open-source local LLMs (running via LM Studio's OpenAI-compatible proxy) may have chat templates that strictly require user/assistant alternation. The new tail-assistant-context message creates a `assistant_prev → assistant_context → user_new` sequence from turn 2 onward. Planner should verify this works on at least one local LLM during research, or add a synthetic user-ack mitigation.
- Provider KV-cache benefit is empirically observable on Anthropic (`cache_creation_input_tokens` / `cache_read_input_tokens` in response). Planner should add a manual verification step using a local Trellis instance + a multi-turn chat session pointed at Anthropic to confirm cache hits land where expected.
- The 5-minute provider TTL means short-session perf is fine, but long-idle conversations still pay full re-attention on the next turn. Phase 35 doesn't fix that — it's an inherent provider behavior. Honest framing in the CLAUDE.md note.

</code_context>

<specifics>
## Specific Ideas

- The existing `Knowledge graph candidate context:\n` header is a fine starting point for the new assistant message's content; planner may keep it verbatim or change to XML-tag style.
- Recommended test filename: `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (parallels `app/tests/state/useQuestions-locale-abort.test.mjs` already in the suite).
- Recommended new CLAUDE.md section header: `## Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)`.
- Recommended verification approach: planner research phase should write a small ad-hoc script that hits Anthropic with a 3-turn conversation and asserts `cache_read_input_tokens > 0` on turn 2. Result documented in `35-VERIFICATION.md`.
- This phase has presentation-level visibility — Section 4.7 of `LabPresentation/SCRIPTS.md` publicly disclosed the gap. Successful close-out flips the "I haven't shipped it yet" line in the script to past tense before the talk. Phase artifacts may be filmed as the GSD live-demo subject (per LabPresentation `Demo Risk Mitigation` plan).

</specifics>

<deferred>
## Deferred Ideas

### Append-only history invariant test (deferred)

A behavioral test asserting `priorMessages` passed from `AskScreen.tsx:288` to `askStreaming` is always a strict prefix of `current.messages.slice(0, -1)` at the moment of call. The edit-message flow at `AskScreen.tsx:397-417` intentionally truncates and replaces — this is correct UX. A test would mostly guard against future bugs that accidentally splice mid-history. Out of scope for Phase 35 (which is about the system-prompt stability, not about history-array invariants).

### Fix dynamic system prompts at one-shot call sites (deferred indefinitely)

`concept-feed`, `planner`, `podcast`, `post-essay` interpolate dynamic content into their system prompts. They are all one-shot — KV-cache benefit is negligible. Not worth the test-and-refactor cost. Documented as confirmed-non-goal in `35-VERIFICATION.md`.

### Anthropic `cache_control` explicit markers (potential future enhancement)

Anthropic supports explicit `cache_control: { type: 'ephemeral' }` markers on message blocks to opt into prompt caching. Phase 35's reordering enables implicit prefix caching on all providers; explicit markers could squeeze more out of Anthropic specifically. Not in scope; future optimization phase if telemetry shows residual cache misses.

### Auto-memory entry (optional)

The Phase 32.1 lesson #8 ("documentation in three places") suggests an auto-memory entry alongside the CLAUDE.md note. Optional; planner decides during execution.

</deferred>

---

*Phase: 35-fix-the-dynamic-system-prompt-issue*
*Context gathered: 2026-04-29*
