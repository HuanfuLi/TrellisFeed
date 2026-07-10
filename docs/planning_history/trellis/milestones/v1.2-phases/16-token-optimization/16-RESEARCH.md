# Phase 16: Token Optimization - Research

**Researched:** 2026-04-01
**Domain:** LLM provider API response formats, session history wiring, token usage monitoring design
**Confidence:** HIGH

## Summary

Phase 16 has two distinct work streams. The first is a structural change to the Question Answering flow: replace the "3 recent global Q&As stuffed into system prompt" hack with an append-only `SessionMessage[]` array passed directly to `chatStream()`. This enables provider-side prefix KV-caching (OpenAI, Claude, and Gemini all support it automatically when the prefix of the messages array is stable), producing cheaper and faster responses with no code change on the provider side. The messages array already exists in `sessionRef.current.messages` inside `generateAiReply()` in `AskScreen.tsx` — it just needs to be threaded down through `askStreaming()` in `useQuestions.ts` to the `chatStream()` call. The non-streaming fallback `ask()` in `question.service.ts` receives the same treatment.

The second stream is a token usage monitoring module. All three supported providers (OpenAI, Claude, Gemini) return a `usage` object in their JSON responses that contains `prompt_tokens`/`input_tokens` and `completion_tokens`/`output_tokens`. The central routing layer (`chatCompletion` and `chatStream` in `app/src/providers/llm/index.ts`) is the correct interception point: it is the only place all 14 LLM call sites converge. Return types need to change from bare `string` / `AsyncGenerator<string>` to carry usage metadata alongside content. A `TokenUsageReporter` interface with a `LocalTokenUsageReporter` implementation (localStorage) keeps the design remote-ready per D-09.

**Primary recommendation:** Thread session history through `askStreaming` first (D-01 to D-04), then add the usage extraction layer to `chatCompletion`/`chatStream` (D-07 to D-09) with a new `tokenUsageService` following the `ServiceResult<T>` and `mockSettingsService` patterns already established in the project.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Restructure `askStreaming` (in `useQuestions.ts`) and `ask` (in `question.service.ts`) to send the full session chat history as an append-only message array instead of a single user message. Format: `[system, user1, assistant1, user2, assistant2, ..., userN]`.
- **D-02:** Remove the "3 recent global Q&As stuffed into system prompt" hack — the real session history replaces it. The knowledge graph candidate context in the system prompt stays.
- **D-03:** Session message history is already available via `sessionService` and `AskScreen` state — wire it through to the LLM call. No new storage needed.
- **D-04:** This enables provider-side KV-cache (OpenAI, Claude, Gemini all support prefix caching) — cached input tokens are 50-90% cheaper and faster. Also improves answer quality since the LLM sees real conversation flow.
- **D-05:** All 13 existing system prompts are fine as-is. No trimming needed. Only the Question Answering flow changes structurally (D-01 through D-04).
- **D-06:** Leave `maxTokens` defaults as-is (4096 everywhere, 8192 for reorganization). maxTokens is a ceiling — providers charge for tokens actually generated, not the cap.
- **D-07:** Add a token usage tracker in Settings > Developer section. Per-service breakdown (Ask, Posts, Planner, Classification, Podcast, Flashcards, etc.).
- **D-08:** Parse `usage.prompt_tokens` and `usage.completion_tokens` from API responses. Do not use client-side estimation.
- **D-09:** Design the monitoring module as a pluggable service: `TokenUsageReporter` interface with a `LocalTokenUsageReporter` implementation. Local storage for now; remote-ready interface.

### Claude's Discretion
- Token usage storage format (localStorage key structure, aggregation granularity)
- How to surface per-service breakdown in the Developer UI (table, chart, etc.)
- How to extract usage data from each provider's response format (implementation detail)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Standard Stack

### Core (all existing — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 + TypeScript | in use | Component + type system | Project stack |
| `app/src/providers/llm/index.ts` | in repo | Central LLM routing layer | All 14 call sites converge here |
| `app/src/services/mock/settings.mock.ts` | in repo | localStorage persistence pattern | Established project pattern for settings/state |
| `app/src/lib/event-bus.ts` | in repo | Pub/sub cross-component comms | Already used for LLM_CONFIG_CHANGED, SESSION_UPDATED |

**No new npm packages required.** All needed primitives (localStorage, fetch, TypeScript interfaces, eventBus) already exist.

---

## Architecture Patterns

### Recommended Project Structure Additions

```
app/src/
├── services/
│   └── token-usage.service.ts   — TokenUsageReporter interface + LocalTokenUsageReporter
├── providers/llm/
│   └── index.ts                 — Extend chatCompletion/chatStream return types to include UsageMetadata
├── state/
│   └── useQuestions.ts          — Thread session history into askStreaming()
└── screens/
    └── SettingsScreen.tsx       — Add Developer section with token usage table
```

### Pattern 1: Append-Only Session History for Q&A

**What:** Replace the inline `messages` array constructed in `askStreaming()` with the full `SessionMessage[]` from the active session, converted to LLM `ChatMessage[]` format, plus the current user message appended at the end.

**When to use:** Any LLM call that participates in a multi-turn conversation (currently: `askStreaming` in `useQuestions.ts` and `ask` in `question.service.ts`).

**Current code in `useQuestions.ts` (lines 88-110):**
```typescript
// CURRENT — remove this:
const store = questionService.getAll();
const recentContext = store.slice(0, 3);
const contextLines = recentContext.map((q) => `Q: ${q.content}\nA: ${q.summary}`).join('\n');

const systemPrompt = [
  'You are a knowledgeable learning assistant. ...',
  recentContext.length > 0 ? `Recent questions for context:\n${contextLines}` : '',
  `Knowledge graph candidate context:\n${formatCandidateContextPack(candidatePack)}`,
].filter(Boolean).join('\n');

const stream = chatStream(
  [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ],
  llmConfig,
);
```

**Target pattern (D-01 + D-02):**
```typescript
// NEW — caller (AskScreen.generateAiReply) passes sessionHistory: SessionMessage[]
// askStreaming signature becomes:
askStreaming(
  content: string,
  onToken: (accumulated: string) => void,
  sessionContext?: QuestionFilterContext,
  sessionHistory?: SessionMessage[]   // new param
): Promise<Question | null>

// Inside askStreaming:
const systemPrompt = [
  'You are a knowledgeable learning assistant. Answer questions clearly and thoroughly.',
  'Do not generate harmful, illegal, sexually explicit, or deceptive content.',
  `Knowledge graph candidate context:\n${formatCandidateContextPack(candidatePack)}`,
].filter(Boolean).join('\n');

// Build append-only message array from session history
const historyMessages: ChatMessage[] = (sessionHistory ?? []).map((m) => ({
  role: m.type === 'user' ? 'user' : 'assistant',
  content: m.content,
}));

const messages: ChatMessage[] = [
  { role: 'system', content: systemPrompt },
  ...historyMessages,
  { role: 'user', content },
];

const stream = chatStream(messages, llmConfig);
```

**AskScreen wiring:** In `generateAiReply`, pass `sessionRef.current.messages` (which already excludes the streaming placeholder) as `sessionHistory`. This is already available — no new state needed.

### Pattern 2: Usage Metadata Extraction from Provider Responses

**What:** Extend `chatCompletion` return type from `Promise<string>` to `Promise<CompletionResult>` where `CompletionResult = { content: string; usage?: UsageMetadata }`. Similarly extend `chatStream` to yield tokens but return usage in the final value. Tag each call with a `serviceName` label passed via `CompletionOptions`.

**Provider response formats (verified from codebase):**

```typescript
// OpenAI (line 96, llm/index.ts):
const data = await response.json() as { choices: { message: { content: string } }[] };
// Add: data.usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }

// Claude (line 148, llm/index.ts):
const data = await response.json();
return data.content[0].text;
// Add: data.usage: { input_tokens: number; output_tokens: number }

// Gemini (line 212, llm/index.ts):
const data = await response.json();
return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
// Add: data.usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number }
```

**Normalized interface:**
```typescript
export interface UsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResult {
  content: string;
  usage?: UsageMetadata;
}

export interface CompletionOptions {
  maxTokens?: number;
  serviceName?: string;   // 'ask' | 'posts' | 'planner' | 'classification' | 'podcast' | 'flashcards' | 'filter' | 'title'
}
```

**For `chatStream`:** The streaming APIs return usage in the final SSE chunk. OpenAI sends a `[DONE]` event; before that, the last data chunk contains `usage` when `stream_options: { include_usage: true }` is passed. Claude sends a `message_delta` event with `usage.output_tokens` and a `message_stop`. Gemini sends `usageMetadata` in the final streaming chunk.

The cleanest approach for streaming: accumulate usage from the final chunk inside `parseSseStream` / provider-specific stream functions, and make `chatStream` return `AsyncGenerator<string, UsageMetadata | undefined>` (generators support typed return values). Callers that don't need usage can ignore the return value of the generator (existing callers continue to work unchanged).

### Pattern 3: TokenUsageReporter Interface (D-09)

**What:** A pluggable abstraction so the local implementation can be swapped for a remote reporter.

```typescript
// app/src/services/token-usage.service.ts

export interface TokenUsageRecord {
  id: string;
  serviceName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  provider: string;       // 'openai' | 'claude' | 'gemini' | 'local' | 'lmstudio'
  timestamp: number;
}

export interface TokenUsageReporter {
  record(entry: Omit<TokenUsageRecord, 'id' | 'timestamp'>): void;
  getAll(): TokenUsageRecord[];
  getByService(): Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; callCount: number }>;
  clear(): void;
}

// LocalTokenUsageReporter uses localStorage key: 'echolearn_token_usage'
// Keeps last N records (e.g. 500) — older records evicted on overflow
export class LocalTokenUsageReporter implements TokenUsageReporter { ... }

// Singleton export (can be swapped at module level in future):
export const tokenUsageReporter: TokenUsageReporter = new LocalTokenUsageReporter();
```

**Wiring into `chatCompletion`:** After parsing provider response, call `tokenUsageReporter.record(...)` if `options?.serviceName` was provided and usage data is present. This is a fire-and-forget side effect — it does not change the function's return value for any callers that don't need `CompletionResult`.

**Call site tagging strategy:** Each of the 14 LLM call sites passes a `serviceName` in `options`. The table below maps them:

| Call site | serviceName |
|-----------|-------------|
| `useQuestions.ts` askStreaming | `'ask'` |
| `question.service.ts` ask | `'ask'` |
| `question-filter.service.ts` isOffTopicByLLM | `'filter'` |
| `canonical-knowledge.service.ts` classifyAndAnchor | `'classification'` |
| `canonical-knowledge.service.ts` reorganization | `'classification'` |
| `concept-feed.service.ts` daily posts | `'posts'` |
| `concept-feed.service.ts` more posts | `'posts'` |
| `concept-feed.service.ts` connection streaming | `'posts'` |
| `concept-feed.service.ts` discover streaming | `'posts'` |
| `planner.service.ts` signal extraction | `'planner'` |
| `planner.service.ts` discover title | `'planner'` |
| `podcast.service.ts` script | `'podcast'` |
| `flashcard.service.ts` extraction | `'flashcards'` |
| `post-context-qa.service.ts` streaming | `'ask'` |
| `AskScreen.tsx` generateSessionTitle | `'title'` |

### Pattern 4: Developer Section in SettingsScreen

**What:** A new `SectionHeader` + per-service usage table at the bottom of `SettingsScreen.tsx`, following the existing `SectionHeader` / `SettingRow` component pattern.

**Recommended UI:** A simple table (not a chart) for clarity and performance. Columns: Service | Prompt Tokens | Completion Tokens | Total | Calls. Plus a "Clear" button. A running lifetime total at the top. This matches the dense information style of the existing Developer/Embedding Debug sections.

```typescript
// Read directly from tokenUsageReporter (no separate state needed unless live refresh desired)
const breakdown = tokenUsageReporter.getByService();
```

**Where to add in SettingsScreen:** After the existing "Debug" section (Embedding Debug). The section already has `<SectionHeader icon={...} title="Developer" />` patterns — replicate for "Token Usage".

### Anti-Patterns to Avoid

- **Estimating tokens client-side:** tiktoken or character-count estimation is not needed — all three providers return actual usage. D-08 explicitly locks this.
- **Adding usage tracking to the mock/local LLM providers:** `local` and `lmstudio` providers may not return `usage` in their responses. Guard with a null-check — do not throw if `usage` is absent.
- **Changing all 14 call sites to receive `CompletionResult` instead of `string`:** This would require widespread refactoring. Instead, keep `chatCompletion` returning `string` for all existing callers, and record usage as a side effect inside the provider layer. Only `chatCompletion` and `chatStream` need to know about `tokenUsageReporter`.
- **Breaking the `chatStream` AsyncGenerator contract:** Existing callers use `for await (const token of stream)`. Changing the return type of the generator is backward-compatible (callers that ignore the return value continue to work), but the `parseSseStream` helper must collect usage from the final SSE chunk without breaking the yield loop.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Client-side tokenizer (tiktoken) | Provider `usage` field in API response | Exact, free, already returned by all three providers |
| Persistent storage | Custom IndexedDB layer | localStorage (same as `mockSettingsService`) | Consistent with all other project storage; no new dependency |
| Per-service aggregation | Complex query engine | Simple `reduce` over `TokenUsageRecord[]` | Volume is tiny (< 500 records); no DB query needed |
| KV-cache activation | Any client-side logic | Pass stable prefix in messages array | Caching is automatic server-side — just keep the prefix stable |

**Key insight:** Provider-side KV-caching requires zero provider-side configuration for OpenAI (automatic for prompts > 1024 tokens), Claude (automatic for prompts > 1024 tokens with Anthropic's prompt caching feature), and Gemini (context caching is automatic for repeated prefixes in their API). The only client-side requirement is that the prefix (system prompt + prior history) is identical across turns — which the append-only array approach guarantees.

---

## Common Pitfalls

### Pitfall 1: Stale `sessionHistory` in `askStreaming`

**What goes wrong:** `AskScreen.generateAiReply` reads `sessionRef.current.messages` at the start of the function (line 175), but `handleSend` already appended the user message to the session (lines 271-277) before calling `generateAiReply`. So `sessionRef.current.messages` at the point `askStreaming` is called already contains the new user message. If this is passed as `sessionHistory` and then `content` is also appended as the final user message, the user's message appears twice.

**How to avoid:** Pass `sessionRef.current.messages` **excluding the last message** (the just-appended user message) as `sessionHistory`. The user message is already passed as `content`. Or equivalently, pass all messages and skip appending `content` as a separate user message — but the former is cleaner.

**Warning signs:** LLM returns confused responses or the first user message is echoed back.

### Pitfall 2: OpenAI Streaming — `usage` Not in Default Chunks

**What goes wrong:** By default, OpenAI streaming does NOT include `usage` in the SSE stream. It only appears if `stream_options: { include_usage: true }` is added to the request body. Without this flag, the streaming path captures no usage data.

**How to avoid:** Add `stream_options: { include_usage: true }` to the `openAIStream` request body. The final chunk before `[DONE]` will then contain a `usage` field instead of a delta. The `parseSseStream` extractor will yield an empty string for this chunk (since `choices[0].delta.content` is null/undefined in the usage chunk) — handle gracefully with a null-check already present (`?? ''`).

**Warning signs:** `usage` is always `undefined` for OpenAI streaming calls.

### Pitfall 3: Claude SSE Usage Event Type

**What goes wrong:** Claude's streaming format has multiple event types. Usage data arrives in a `message_delta` event (`{ type: 'message_delta', usage: { output_tokens: N } }`) and also in `message_start` (`{ type: 'message_start', message: { usage: { input_tokens: N } } }`). The current `parseSseStream` extractor only looks for `content_block_delta`. If you only look at `message_delta`, you get output tokens but miss input tokens.

**How to avoid:** Either accumulate from both `message_start` (input tokens) and `message_delta` (output tokens) in the Claude stream handler, or use `claudeCompletion` response body for usage (which has full `usage.input_tokens` and `usage.output_tokens` in the non-streaming response). For streaming, use a Claude-specific SSE accumulator in `claudeStream` rather than relying on `parseSseStream`.

**Warning signs:** Input token counts are always 0 for Claude streaming.

### Pitfall 4: Session History Causes Double-Context on Non-Session Calls

**What goes wrong:** The non-streaming `ask()` in `question.service.ts` is called directly (not from `AskScreen`) in some paths, and it does not have access to `sessionHistory`. Passing `undefined` as `sessionHistory` must gracefully fall back to the old single-message behavior.

**How to avoid:** Make `sessionHistory` optional in `askStreaming`. When `undefined`, behavior is identical to today — no history, just system + user message. The non-streaming `ask()` always passes `undefined` (it operates outside session context by design).

### Pitfall 5: localStorage Quota with Token Records

**What goes wrong:** Recording every single LLM call token count in localStorage could accumulate unboundedly. With 14 call sites and heavy use, 500+ records could add 50-100KB to localStorage.

**How to avoid:** Cap the record array at a fixed size (e.g. 500 records). When the cap is reached, evict the oldest records (FIFO). Alternatively, only store aggregated per-service totals rather than per-call records — but per-call records are needed for the "daily breakdown" use case.

**Recommended approach:** Store up to 500 records; expose `getByService()` that aggregates in memory. A "Clear all" button in the UI resets the store.

---

## Code Examples

### Usage Field Shapes (verified from provider API docs and codebase response parsing)

```typescript
// OpenAI non-streaming response (line 96 of llm/index.ts):
// data.usage = { prompt_tokens: number, completion_tokens: number, total_tokens: number }
function normalizeOpenAIUsage(data: { usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }): UsageMetadata | undefined {
  if (!data.usage) return undefined;
  return { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens };
}

// Claude non-streaming response (line 148 of llm/index.ts):
// data.usage = { input_tokens: number, output_tokens: number }
function normalizeClaudeUsage(data: { usage?: { input_tokens: number; output_tokens: number } }): UsageMetadata | undefined {
  if (!data.usage) return undefined;
  return { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens, totalTokens: data.usage.input_tokens + data.usage.output_tokens };
}

// Gemini non-streaming response (line 212 of llm/index.ts):
// data.usageMetadata = { promptTokenCount: number, candidatesTokenCount: number, totalTokenCount: number }
function normalizeGeminiUsage(data: { usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number } }): UsageMetadata | undefined {
  if (!data.usageMetadata) return undefined;
  return { promptTokens: data.usageMetadata.promptTokenCount, completionTokens: data.usageMetadata.candidatesTokenCount, totalTokens: data.usageMetadata.totalTokenCount };
}
```

### `chatCompletion` with side-effect recording (non-breaking)

```typescript
// chatCompletion remains: Promise<string> — no change to callers
export async function chatCompletion(messages: ChatMessage[], config: LLMConfig, options?: CompletionOptions): Promise<string> {
  const maxTokens = options?.maxTokens ?? 4096;
  let content: string;
  let usage: UsageMetadata | undefined;

  switch (config.provider) {
    case 'claude':   ({ content, usage } = await claudeCompletion(messages, config, maxTokens)); break;
    case 'gemini':   ({ content, usage } = await geminiCompletion(messages, config, maxTokens)); break;
    default:         ({ content, usage } = await openAICompletion(messages, config, maxTokens)); break;
  }

  if (usage && options?.serviceName) {
    tokenUsageReporter.record({ serviceName: options.serviceName, ...usage, provider: config.provider });
  }
  return content;
}
```

### Session History Conversion

```typescript
// Convert SessionMessage[] from AskScreen to ChatMessage[] for the LLM
function sessionHistoryToMessages(history: SessionMessage[]): ChatMessage[] {
  return history.map((m) => ({
    role: m.type === 'user' ? 'user' : 'assistant',
    content: m.content,
  } as ChatMessage));
}
```

### LocalTokenUsageReporter (outline)

```typescript
const STORAGE_KEY = 'echolearn_token_usage';
const MAX_RECORDS = 500;

export class LocalTokenUsageReporter implements TokenUsageReporter {
  record(entry: Omit<TokenUsageRecord, 'id' | 'timestamp'>): void {
    const records = this.loadAll();
    const newRecord: TokenUsageRecord = {
      id: `tu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...entry,
    };
    const updated = [newRecord, ...records].slice(0, MAX_RECORDS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* QuotaExceededError — silent */ }
  }

  getAll(): TokenUsageRecord[] { return this.loadAll(); }

  getByService(): Record<string, ServiceAggregate> {
    return this.loadAll().reduce<Record<string, ServiceAggregate>>((acc, r) => {
      const key = r.serviceName;
      if (!acc[key]) acc[key] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
      acc[key].promptTokens += r.promptTokens;
      acc[key].completionTokens += r.completionTokens;
      acc[key].totalTokens += r.totalTokens;
      acc[key].callCount += 1;
      return acc;
    }, {});
  }

  clear(): void { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }

  private loadAll(): TokenUsageRecord[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as TokenUsageRecord[]; }
    catch { return []; }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inject 3 recent Q&As into system prompt text | Pass full session as message array | Phase 16 | Enables KV-cache, cleans up system prompt |
| No token tracking | Per-service usage monitoring via provider `usage` field | Phase 16 | Visibility into cost and call volume |

**Deprecated/outdated (within this codebase):**
- `recentContext` + `contextLines` injection in `askStreaming` (lines 88-101 of `useQuestions.ts`): replaced by session history array
- Same pattern in `question.service.ts` (lines 190-198): replaced by session history array

---

## Open Questions

1. **Streaming usage capture for OpenAI**
   - What we know: OpenAI streaming requires `stream_options: { include_usage: true }` in the request body; the final chunk before `[DONE]` contains `usage`.
   - What's unclear: Whether local/lmstudio providers support `stream_options.include_usage`. They may ignore it silently, which is fine — usage will just be `undefined`.
   - Recommendation: Add `stream_options: { include_usage: true }` only for non-local OpenAI streaming. Guard with `!isLocal`.

2. **`ask()` in `question.service.ts` session history source**
   - What we know: `ask()` is called outside AskScreen context (e.g. direct invocations). It has no session reference.
   - What's unclear: Whether any current callers pass a session context that could be threaded through.
   - Recommendation: `ask()` signature accepts an optional `sessionHistory?: SessionMessage[]` parameter. All existing callers pass nothing (no change needed). Only `AskScreen` would ever pass it if the non-streaming path is used.

3. **Developer UI placement in SettingsScreen**
   - What we know: The screen already has many sections (LLM, TTS, Embedding, Privacy, Appearance, Podcast, Review, Planner, Data).
   - What's unclear: Whether to put Token Usage at the very bottom as a new section or inside an existing "Developer" / "Debug" section.
   - Recommendation: Add a new `SectionHeader` titled "Token Usage" below the "Embedding Debug" section (which is already developer-facing). Keep it collapsible or always-visible; always-visible is simpler.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes with no external tool dependencies. All required APIs (OpenAI, Claude, Gemini) are already integrated and configured via `LLMConfig`.

---

## Sources

### Primary (HIGH confidence)
- Codebase — `app/src/providers/llm/index.ts` — full provider implementation, response parsing at lines 96, 148, 212
- Codebase — `app/src/state/useQuestions.ts` — `askStreaming()` implementation, session history gap
- Codebase — `app/src/screens/AskScreen.tsx` — `generateAiReply()`, `sessionRef.current.messages` availability
- Codebase — `app/src/services/session.service.ts` — `ChatSession` / `SessionMessage[]` storage
- Codebase — `app/src/services/mock/settings.mock.ts` — localStorage persistence pattern

### Secondary (MEDIUM confidence)
- OpenAI API documentation — `stream_options.include_usage` for streaming usage data
- Anthropic API documentation — `message_start` / `message_delta` SSE events for Claude usage fields
- Google Gemini API documentation — `usageMetadata.promptTokenCount` / `candidatesTokenCount` field names

### Tertiary (LOW confidence)
- KV-cache activation thresholds (1024 tokens for OpenAI/Claude automatic caching) — from general knowledge, not verified against current 2026 docs

---

## Metadata

**Confidence breakdown:**
- Session history wiring: HIGH — code paths are fully traced in repo; change is mechanical
- Provider usage field extraction: HIGH — response parsing code exists in repo; field names confirmed from codebase comments and structure
- Token monitoring architecture: HIGH — follows established `ServiceResult<T>` + `mockSettingsService` + `eventBus` patterns exactly
- Streaming usage capture (OpenAI `stream_options`): MEDIUM — pattern is correct but exact behavior with local/lmstudio providers not verified

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable APIs; provider response formats rarely change)
