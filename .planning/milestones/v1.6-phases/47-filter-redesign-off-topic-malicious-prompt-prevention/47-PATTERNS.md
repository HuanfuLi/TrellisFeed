# Phase 47: Filter Redesign — Off-Topic + Malicious Prompt Prevention - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 18 (8 NEW source/data, 10 NEW tests, 7 MODIFY) — 25 in scope
**Analogs found:** 18 / 18 (every file has at least one strong in-tree analog)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/src/data/filter-corpus.json` | data fixture (static JSON) | build-time-load → runtime-embed | *(no precedent — see "No Analog")* | first-of-kind |
| `app/src/services/filter-corpus.service.ts` | service (corpus loader + cache) | file-load → cache → embedding store | `app/src/services/refill-mutex.ts` (leaf-module pattern) + `canonical-knowledge.service.ts:691-744` (embedding lookup pattern) | role-match |
| `app/src/services/question-filter.service.ts` (REWRITE) | service (hybrid classifier orchestrator) | request-response (sync regex + async embedding) | `app/src/services/canonical-knowledge.service.ts:1007-1035` (`classifyAndAnchorIncremental` pre-check pattern) | exact (role + flow) |
| `app/src/providers/llm/user-content-bracketing.ts` | provider helper (message-list rewriter) | transform | `app/src/providers/llm/locale-directive.ts` (`applyLocaleDirective`) | exact (role + flow) |
| `app/src/providers/llm/index.ts` (MODIFY) | provider wrapper composition | transform | self (lines 61-72 — composition site) | exact |
| `app/src/state/useQuestions.ts:270-323` (MODIFY) | state hook (pipeline orchestrator) | event-driven streaming | self (existing askStreaming structure) | exact |
| `app/src/services/question.service.ts:184-285` (MODIFY) | service (`ask` orchestrator) | request-response | self (mirror of useQuestions inversion) | exact |
| `app/src/screens/AskScreen.tsx:496-503` (MODIFY) | screen (override handler) | user-action → side-effect | `app/src/state/useQuestions.ts:316` (fire-and-forget classifyAndAnchorIncremental pattern) | role-match |
| `app/src/components/ChatMessage.tsx` (MINIMAL ADD) | component (render branch) | render | self (lines 296-381 — existing flagged-badge render block) | exact |
| `app/src/locales/en.json` + `zh/es/ja.json` (MODIFY) | i18n bundle | data | self (existing `chatMessage.*` namespace at line 747) | exact |
| `app/tests/services/filter-classifier.unit.test.mjs` | test (unit + source-reading) | verification | `app/tests/services/classification-dedup.test.mjs` | exact |
| `app/tests/services/filter-classifier.eval.test.mjs` | test (data-driven fixture runner) | verification | `app/tests/locales/bundle-parity.test.mjs` (JSON-fixture loop pattern) | role-match |
| `app/tests/services/filter-corpus.eval.json` | test fixture (labeled rows) | data | `app/src/locales/en.json` shape (no specific test-fixture analog) | role-match |
| `app/tests/services/filter-cache.test.mjs` | test (leaf-module unit) | verification | `app/tests/services/refill-mutex.test.mjs` | exact |
| `app/tests/providers/llm-bracketing.test.mjs` | test (provider helper unit + golden) | verification | `app/tests/providers/llm-locale-injection.test.mjs` | exact |
| `app/tests/providers/tts-bracketing-exempt.test.mjs` | test (negative-invariant source-reading) | verification | `app/tests/components/InfoFlow.video-tap-emit.test.mjs` (negative-invariant pattern) | exact |
| `app/tests/state/useQuestions-pre-gate.test.mjs` | test (source-reading pipeline guard) | verification | `app/tests/state/useQuestions-system-prompt-stability.test.mjs` | exact |
| `app/tests/services/question-service-pre-gate.test.mjs` | test (source-reading pipeline guard) | verification | `app/tests/state/useQuestions-system-prompt-stability.test.mjs` | role-match |
| `app/tests/screens/AskScreen-override-refire.test.mjs` | test (source-reading screen guard) | verification | `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` | exact |

## Pattern Assignments

### `app/src/services/filter-corpus.service.ts` (service, file-load → cache → embedding store)

**Analog A:** `app/src/services/refill-mutex.ts` (leaf-module discipline — JSON-import-attribute-safe under `node --test`)

**Why this analog:** RESEARCH.md §"Common Pitfalls" Pitfall 6 + §"Validation Architecture" require the cache + corpus loader to be importable under `node --test` without triggering the `ERR_IMPORT_ATTRIBUTE_MISSING` chain through `locales/index.ts → en.json`. `refill-mutex.ts` is the codebase-canonical example of "leaf module with zero transitive deps so tests can import it directly."

**Leaf-module convention** (`refill-mutex.ts:1-12`):
```typescript
// Promise-based mutex helper (Phase 36-12 leaf extraction).
//
// This is a LEAF module: it has zero transitive deps on settings.service /
// llm-provider / locales bundles, so node --test can import it directly
// without hitting Node ESM's ERR_IMPORT_ATTRIBUTE_MISSING on en.json.
// (concept-feed.service.ts re-uses this helper so the runtime mutex path
// shares its semantics — this file gives tests a clean import surface.)
//
// See CLAUDE.md i18n section "Phase 27 locale tests avoid the JSON-import-
// attribute failure chain by importing i18next directly; follow the same
// pattern for any new pure-logic helpers."
```
Apply this header to `filter-corpus.service.ts` verbatim with the project name swapped. Do NOT import `settings.service.ts` at module top — accept `EmbeddingConfig` as a function parameter (mirrors `embedText(text, config)` shape in `providers/embedding/index.ts:100`).

**Analog B:** `canonical-knowledge.service.ts:691-744` (`preCheckAnchorMatch` — embedding + cosine + threshold against an existing array of vectors)

**Why this analog:** This is the production-proven pattern for "embed query, scan an array of `{label, vector}` entries, take max-cosine, compare to threshold." Phase 47 Layer 2 is structurally the same loop with two thresholds (one per negative label) instead of one.

**Core embedding-scan pattern** (`canonical-knowledge.service.ts:691-744`):
```typescript
export async function preCheckAnchorMatch(
  question: Question,
  allQuestions: Question[],
): Promise<{ match: Question; similarity: number } | null> {
  const { settingsService } = await import('./settings.service.ts');
  const embCfg = settingsService.getSync().embedding;
  if (!embCfg.isConfigured) return null;

  const anchors = allQuestions.filter(q => q.isAnchorNode === true);
  if (anchors.length === 0) return null;

  // Resolve the query vector. Prefer the question's own embedding if already
  // populated (fire-and-forget from question.service.ts might have completed);
  // otherwise compute it inline so the pre-check works on the FIRST classification
  // after the question is saved.
  let queryVec = question.embeddingVector;
  if (!queryVec || queryVec.length === 0) {
    try {
      queryVec = await embedText(question.content.trim(), embCfg);
    } catch (err) {
      console.warn('[Trellis] pre-check query embedding failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }
  // ... opportunistic backfill ...

  // Scan anchors for the top cosine match.
  let best: { match: Question; similarity: number } | null = null;
  for (const a of anchors) {
    if (!a.embeddingVector || a.embeddingVector.length === 0) continue;
    const sim = cosine(queryVec, a.embeddingVector);
    if (sim >= ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD && (!best || sim > best.similarity)) {
      best = { match: a, similarity: sim };
    }
  }
  // ...
  return best;
}
```

**What's the same:** `cosine()` import, threshold constant, in-memory linear scan, graceful catch-and-return-null on embedding failure, dev-mode debug log of `bestMatch.score`.

**What's new:** Two thresholds (`OFF_TOPIC_SIMILARITY_THRESHOLD = 0.75`, `MALICIOUS_SIMILARITY_THRESHOLD = 0.82`) — track BOTH best-malicious AND best-off-topic in the same pass; corpus loaded from `app/src/data/filter-corpus.json` rather than from the question store; localStorage-backed `(provider, model)`-keyed cache for the corpus vectors (RESEARCH.md §"Corpus Cache" lines 642-714).

**Cache-key invalidation pattern** — adapt `concept-feed.service.ts` `loadCache`/`saveCache` discipline (date-mismatch invalidation; see CLAUDE.md "New-day rehydration") for `(provider, model)`-mismatch invalidation. Storage key constant: `STORAGE_KEY = 'trellis_filter_corpus_emb_v1'` matches the `trellis_*` prefix convention from `post-queue.service.ts` (`STORAGE_KEY_YESTERDAY = 'trellis_post_queue_yesterday'`).

---

### `app/src/services/question-filter.service.ts` (REWRITE — service, request-response)

**Analog:** `app/src/services/canonical-knowledge.service.ts:1007-1035` (`classifyAndAnchorIncremental`'s pre-check + LLM-skip branch structure)

**Why this analog:** Same shape — "run a cheap pre-check, branch on outcome, optionally fall through to a heavier path." Phase 47's pre-gate is "regex pre-check (Layer 1), branch on hit (off-topic), optionally fall through to embedding (Layer 2)." Same control-flow.

**Branch-and-skip pattern** (`canonical-knowledge.service.ts:1013-1035`):
```typescript
try {
  // 0. Embedding-based anchor pre-check (Phase 33 UAT-4 fix). If the new
  // question's concept matches an existing anchor above the similarity
  // threshold, reuse it and adopt its branch/cluster labels — skip the
  // LLM tree descent entirely. See the load-bearing comment at the top
  // of this file for rationale.
  if (!signal?.aborted) {
    const preCheck = await preCheckAnchorMatch(question, allQuestions);
    if (preCheck) {
      const existing = preCheck.match;
      const reusedResult: ClassificationResult = { /* ... */ };
      await commitClassificationResult(question, reusedResult, allQuestions);
      return;
    }
  }
  // ... fall through to LLM tree descent ...
}
```

**What to keep from existing `question-filter.service.ts`:**
- `QuestionFilterContext { priorQuestion, priorAnswer }` exported type at lines 45-48 (RESEARCH.md §"Reusable Assets" — already plumbed end-to-end; do NOT change shape).
- `evaluateQuestion` exported function name (used at `useQuestions.ts:9` and `question.service.ts:15` as `filterQuestion`). Changing the name would force two import-site edits.

**What to delete from existing `question-filter.service.ts`:**
- `PATTERN_LIBRARY` array (lines 14-41) — replaced by narrow Layer 1 set per RESEARCH.md §"Pattern 1".
- `isOffTopicByPattern` function (lines 56-64) — replaced by `layer1Regex`.
- `isOffTopicByLLM` function (lines 71-99) — dead in practice (D-07); deleted.
- The `chatCompletion` import at line 2 — no LLM in classifier path (D-07).

**What's new:**
- Three-label return shape: `{ label: 'on-topic' | 'off-topic' | 'malicious'; bestMatch?: ... }` — current shape is `Question` with `flagged` mutated; new callers branch on `label`.
- `signal: AbortSignal` parameter (D-19) — accept and check `signal.aborted` before/after each `await`.
- Layer 2 calls `loadCorpusEmbeddings(embConfig)` from `filter-corpus.service.ts`.

**AbortSignal threading pattern** — copy from `canonical-knowledge.service.ts:1011-1019`:
```typescript
async function classifyAndAnchorIncremental(
  question: Question,
  allQuestions: Question[],
  llmConfig: LLMConfig,
  signal?: AbortSignal,
): Promise<void> {
  try {
    if (!signal?.aborted) {
      const preCheck = await preCheckAnchorMatch(question, allQuestions);
      // ...
```

---

### `app/src/providers/llm/user-content-bracketing.ts` (provider helper, transform)

**Analog:** `app/src/providers/llm/locale-directive.ts` (`applyLocaleDirective`)

**Why this analog:** Identical role (message-list-in, message-list-out, idempotent rewriter that runs inside `chatCompletion` and `chatStream`). Composition contract is documented in the same file's header comments. RESEARCH.md §"Pattern 3" makes this analog explicit: bracketing is the SECOND such helper layered into the same composition site.

**Full helper shape** (`locale-directive.ts:1-49`):
```typescript
// ─── Locale injection (D-12) ─────────────────────────────────────────────────
// Central pre-flight rewrite: every outbound LLM request gets a "Respond in
// {localeName}." directive. Idempotent. Zero per-call-site changes required.
//
// IMPORTANT (D-07): This module is the ONLY code path that reads i18n locale
// for an LLM request. Do NOT add a `locale` param to CompletionOptions or any
// call site. Do NOT call chatCompletion/chatStream for translation — dev-time
// Sonnet subagent owns all UI translation (see CLAUDE.md i18n Workflow).
import { getCurrentLocale } from '../../lib/i18n-leaf.ts';
import type { SupportedLocale } from '../../types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const LOCALE_NAMES: Record<SupportedLocale, string> = { /* ... */ };

export function applyLocaleDirective(messages: ChatMessage[]): ChatMessage[] {
  const lng = getCurrentLocale() as SupportedLocale;
  const locale: SupportedLocale = lng in LOCALE_NAMES ? lng : 'en';
  const directive = `Respond in ${LOCALE_NAMES[locale]}.`;

  const systemIdx = messages.findIndex((m) => m.role === 'system');
  if (systemIdx === -1) {
    return [{ role: 'system', content: directive }, ...messages];
  }
  const existing = messages[systemIdx];
  // Idempotent: don't re-inject if this exact directive is already present.
  if (existing.content.includes(directive)) return messages;
  const merged: ChatMessage = {
    ...existing,
    content: `${existing.content.trimEnd()}\n\n${directive}`,
  };
  return [...messages.slice(0, systemIdx), merged, ...messages.slice(systemIdx + 1)];
}
```

**What's the same:**
- Header-comment shape: D-13 reference + central-rewrite framing + IMPORTANT block listing what NOT to do.
- `ChatMessage` interface re-declared locally (don't reach into `providers/llm/index.ts` — `locale-directive.ts` does it the same way to stay leaf).
- Idempotency check before mutation (`if (existing.content.includes(directive)) return messages`).
- Slice-based immutable rewrite (`return [...messages.slice(0, idx), modified, ...messages.slice(idx + 1)]`).
- Single exported function, no class, no module state.

**What's new:**
- Targets the LAST `role: 'user'` (not the first `role: 'system'`). Backward iteration: `for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') { lastUserIdx = i; break; }`.
- Allowlist exclusions for the Phase 35 user-ack message and web-search Pass-2 results-injection (RESEARCH.md §"Pattern 3" lines 442-448; CLAUDE.md "Ask-chat system prompt" — `USER_ACK_BEFORE_GRAPH_CONTEXT = 'Here is the knowledge graph context for this turn:'`).
- Adversarial-tag escape: `safeContent = target.content.replaceAll('</user_content>', '</user&zwj;_content>').replaceAll('<user_content>', '<user&zwj;_content>')`.

**Constants duplication discipline** — RESEARCH.md §"Pattern 3" line 470-475 says the `USER_ACK_BEFORE_GRAPH_CONTEXT` literal must be duplicated here (NOT imported from `useQuestions.ts`) to keep this file leaf. Mirrors the `LOCALE_VOICE_FALLBACK` duplication in `tts/index.ts:11-16` ("duplicated across providers (llm/tts) to keep each provider JSON-free so `node --test` on Node 25 can import them without JSON-import-attribute errors"). Test enforces the two literals stay in sync.

---

### `app/src/providers/llm/index.ts` (MODIFY — wrapper composition)

**Analog:** Self (lines 61-78 — current `chatCompletion` and `chatStream` already compose `applyLocaleDirective`)

**Composition site to extend** (`providers/llm/index.ts:61-78`):
```typescript
export async function chatCompletion(messages: ChatMessage[], config: LLMConfig, options?: CompletionOptions): Promise<string> {
  const msgs = applyLocaleDirective(messages); // D-12 — central locale injection
  const maxTokens = options?.maxTokens ?? 4096;
  switch (config.provider) {
    case 'claude':   return claudeCompletion(msgs, config, maxTokens, options);
    case 'gemini':   return geminiCompletion(msgs, config, maxTokens, options);
    default:         return openAICompletion(msgs, config, maxTokens, options); // openai | local | lmstudio
  }
}

export async function* chatStream(messages: ChatMessage[], config: LLMConfig, options?: CompletionOptions): AsyncGenerator<string> {
  const msgs = applyLocaleDirective(messages); // D-12 — central locale injection
  switch (config.provider) {
    case 'claude':  yield* claudeStream(msgs, config, options);  break;
    case 'gemini':  yield* geminiStream(msgs, config, options);  break;
    default:        yield* openAIStream(msgs, config, options);  break; // openai | local | lmstudio
  }
}
```

**What's the same:** The `const msgs = applyLocaleDirective(messages);` line and its trailing `// D-12 — central locale injection` comment stay byte-stable (Phase 35 invariant).

**What's new:** A single second line per function:
```typescript
const msgs = applyLocaleDirective(messages); // D-12 — central locale injection
const bracketed = applyUserContentBracketing(msgs); // D-13 — structural injection bracketing
// ... pass `bracketed` to the provider switch instead of `msgs`
```
Order is `applyLocaleDirective → applyUserContentBracketing` per RESEARCH.md §"Composition order in chatCompletion/chatStream" (locale touches `role:'system'`; bracketing touches `role:'user'` — disjoint so commutative, but locale-first matches the documentation comment).

Add an `import { applyUserContentBracketing } from './user-content-bracketing.ts';` next to the existing `applyLocaleDirective` import at line 4. Re-export it next to the existing `applyLocaleDirective` re-export at line 8 so tests can import via the central provider entry point.

---

### `app/src/state/useQuestions.ts:270-323` (MODIFY — pipeline inversion)

**Analog:** Self (lines 90-323 — existing `askStreaming` structure stays, ordering inverts)

**Current post-flag pattern to remove** (`useQuestions.ts:296-319`):
```typescript
// Persist and get structured question
const rawQuestion = questionService.buildAndSave(content, accumulated, store);
incrementAskCount();

// Evaluate for off-topic/meta status (with session context for follow-up handling)
const question = await filterQuestion(rawQuestion, sessionContext);

// Persist the flagged status back to store if it changed
if (question.flagged !== rawQuestion.flagged) {
  questionService.patchQuestion(question.id, { flagged: question.flagged });
  // Re-broadcast with the correct flagged status so other useQuestions instances
  // (e.g. HomeScreen) replace their copy before feed re-generation runs.
  eventBus.emit({ type: 'QUESTION_ASKED', payload: question });
}

// ── Second classification call (Phase 14) ──────────────────────────────
// Fire ONLY when Q&A enters the mindmap (not flagged).
if (question.flagged !== true) {
  void classifyAndAnchorIncremental(question, questionService.getAll(), llmConfig, abortController.signal).catch((err: unknown) => {
    console.warn('[Trellis] classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
  });
}
```

**Pre-gate insertion site** — RIGHT AFTER the existing `abortController` setup at line 134, BEFORE the `try {` block at line 136. RESEARCH.md §"Pipeline Inversion Sketch" sketches the new shape (lines 749-784).

**Existing fire-and-forget classification pattern** (`useQuestions.ts:316-319`) stays for the on-topic branch — copy verbatim:
```typescript
void classifyAndAnchorIncremental(question, questionService.getAll(), llmConfig, abortController.signal).catch((err: unknown) => {
  console.warn('[Trellis] classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
});
```

**Existing abort-guard pattern** (`useQuestions.ts:208-212`) — copy for the new pre-gate:
```typescript
if (abortController.signal.aborted) {
  toast(i18n.t('ask.localeChangedDiscarded'));
  setIsAsking(false);
  return null; // do NOT call buildAndSave with partial Pass-1 output
}
```

**What's new:** Three-branch handling after `filterQuestion(content, sessionContext, abortController.signal)` returns `{ label, bestMatch? }`:
- `malicious`: `onToken(i18n.t('chatMessage.maliciousBlocked.body'))`, `setIsAsking(false)`, `return null`.
- `off-topic`: proceed through `chatStream` → `buildAndSave` → `patchQuestion({flagged: true})` → `eventBus.emit({type: 'QUESTION_ASKED', payload: question})`. SKIP classification.
- `on-topic`: existing flow unchanged (`buildAndSave` → fire-and-forget classifyAndAnchorIncremental).

---

### `app/src/services/question.service.ts:184-285` (MODIFY — mirror inversion)

**Analog:** Self (lines 184-298 — existing `ask` structure)

**Current post-flag site** (`question.service.ts:266-288`):
```typescript
const question = this.buildAndSave(content, answer, store, { /* ... */ });

// Evaluate question for off-topic/meta status
const flagged = await filterQuestion(question, sessionContext);

// Persist the flagged status back to store and SQLite
const freshStore = loadStore({ includeFlagged: true });
const idx = freshStore.findIndex((q) => q.id === question.id);
if (idx !== -1) {
  freshStore[idx] = flagged;
  saveStore(freshStore);
  persistToSQLite(flagged);
}

// ── Second classification call (Phase 14) ──────────────────────────────
// Fire ONLY when Q&A enters the mindmap (not flagged).
if (flagged.flagged !== true) {
  void classifyAndAnchorIncremental(flagged, loadStore({ includeFlagged: true }), llmConfig, signal).catch((err: unknown) => {
    console.warn('[Trellis] classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
  });
}
```

**Pre-gate insertion site** — RIGHT AFTER the early-return for `!llmConfig.isConfigured` at line 197, BEFORE the embedding precompute at line 199 (so a `malicious` label avoids both the embedding precompute AND the `chatCompletion` JSON-mode call).

**Three-branch shape** for the new code:
- `malicious`: Return `{ success: false, error: { code: 'BLOCKED_MALICIOUS', message: i18n.t('chatMessage.maliciousBlocked.body'), retryable: false } }` (existing `ServiceResult<T>` error shape from `useQuestions.ts:104-106`).
- `off-topic`: After `buildAndSave`, call `patchQuestion({flagged: true})` directly instead of running `filterQuestion` again.
- `on-topic`: Existing flow.

The fire-and-forget classification stays at `question.service.ts:285-287`, gated on `label === 'on-topic'` instead of `flagged !== true`.

**Important non-modification:** RESEARCH.md §"D-06 Gap Closure" line 521-525 — do NOT add a flag-transition hook to `patchQuestion` itself. The user-action site (`AskScreen.handleQuestionOverride`) is the ONE trigger boundary. `patchQuestion` is used by 14+ call sites (graph service, trellis-actions, flashcard, review, classification itself); a side-effect there fires spuriously.

---

### `app/src/screens/AskScreen.tsx:496-503` (MODIFY — D-06 closure)

**Analog A:** Self (existing `handleQuestionOverride` at lines 496-503)

**Existing override handler** (`AskScreen.tsx:496-503`):
```typescript
const handleQuestionOverride = useCallback((questionId: string, shouldSave: boolean) => {
  if (shouldSave) {
    // Remove the flag so the question becomes eligible for knowledge graph ingestion
    questionService.patchQuestion(questionId, { flagged: false });
    toast(i18n.t('ask.questionSaved'), 'success');
  }
  // If not saving, keep as-is (flagged=true) — question won't ingest to knowledge graph
}, []);
```

**Analog B:** `useQuestions.ts:316-319` (fire-and-forget classification with `.catch` warn)

**Pattern to copy** (`useQuestions.ts:316-319`):
```typescript
void classifyAndAnchorIncremental(question, questionService.getAll(), llmConfig, abortController.signal).catch((err: unknown) => {
  console.warn('[Trellis] classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
});
```

**What's new:** After `patchQuestion({flagged: false})` and `toast(...)`, read the freshly-patched question, gate on `settings.llm.isConfigured`, fire-and-forget `classifyAndAnchorIncremental`. NO abort signal here (RESEARCH.md §"Pattern 4" line 510 — user-initiated override is synchronous from the user's perspective; `LOCALE_CHANGED` cancellation isn't a concern). Full code shape provided in RESEARCH.md §"Pattern 4: Override Re-Fire" lines 494-518.

**Why no `eventBus.emit` here:** `commitClassificationResult` inside `canonical-knowledge.service.ts` already emits `GRAPH_UPDATED` at the end of its run (CLAUDE.md "Event bus — unified GRAPH_UPDATED"). Subscribers (`useQuestions`, `PrunedSection`, `useTrellisData`, `GraphScreen`) re-read from store automatically. Adding an extra `emit` here would double-fire.

---

### `app/src/components/ChatMessage.tsx` (MINIMAL ADD — render branch)

**Analog:** Self (lines 296-381 — existing `flagged` render block with off-topic badge + override prompt)

**Existing flagged-render pattern** (`ChatMessage.tsx:296-381`):
```typescript
{type === 'ai' && flagged && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
    {/* Off-topic badge — click to show override prompt */}
    <button
      onClick={() => setShowOverridePrompt(!showOverridePrompt)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 10px', borderRadius: '12px',
        backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
        cursor: 'pointer', fontSize: '0.75rem',
        color: 'var(--muted-foreground)', fontWeight: '500',
        width: 'fit-content',
      }}
    >
      <span>⚠️</span>
      <span>{t('chatMessage.offTopic')}</span>
    </button>
    {/* ... override confirmation row ... */}
  </div>
)}
```

**What's the same:** Inline-style discipline (CSS variables, NOT Tailwind), `t('chatMessage.*')` namespace, ⚠️ emoji prefix for the badge.

**What's new:** A SECOND conditional render branch for the `malicious-block` sentinel — neutral message, NO override button (D-02). Placement: a peer block at the same indentation level as the `flagged` block. Suggested condition: `type === 'ai' && maliciousBlocked` (new prop) OR encode as a new `kind: 'malicious-block'` discriminated union on `SessionMessage` (RESEARCH.md §"Code Examples" line 1066-1067 leaves the choice to planner).

**Render-only contract:** This component does NOT call `classifyAndAnchorIncremental` or any service. It renders `t('chatMessage.maliciousBlocked.body')` and stops. No override affordance.

---

### `app/src/locales/en.json` + `zh/es/ja.json` (MODIFY — add `chatMessage.maliciousBlocked.*`)

**Analog:** Self — existing `chatMessage` namespace at line 747:
```json
"chatMessage": {
  "sources": "Sources",
  "cancel": "Cancel",
  "send": "Send",
  "editPrompt": "Edit Prompt",
  "regenerate": "Regenerate",
  "delete": "Delete",
  "offTopic": "Off-topic",
  "offTopicPrompt": "This looks off-topic. Save anyway?",
  "saveAnyway": "Yes, save anyway",
  "discard": "Discard",
  "relatedKnowledge": "🔗 Related Knowledge:"
}
```

**What's new:** Sub-namespace `chatMessage.maliciousBlocked.*` with at minimum `body`. RESEARCH.md §"Open Questions" #3 recommends Option B copy:
```json
"maliciousBlocked": {
  "body": "This message looks like a prompt-injection attempt. If this is a real learning question about LLM security, please rephrase."
}
```

**Workflow:** Per CLAUDE.md "i18n Workflow", add the canonical EN value first. Run the Sonnet subagent at `app/scripts/translate-locales.md` three times (zh/es/ja). Human-review per CLAUDE.md guidance: keep "LLM" untranslated; preserve any interpolation placeholders verbatim. All four bundles land in the SAME PR. `bundle-parity.test.mjs` (already exists, see `app/tests/locales/bundle-parity.test.mjs:17-26`) blocks merges where key sets diverge.

---

### `app/tests/services/filter-classifier.unit.test.mjs` (NEW — unit test)

**Analog:** `app/tests/services/classification-dedup.test.mjs`

**Why this analog:** Same test type (source-reading invariant + structural assertions on a service that does embedding + threshold work). Same fs-based source loading, same `describe`/`it` discipline.

**Test scaffold pattern** (`classification-dedup.test.mjs:1-31`):
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/services/canonical-knowledge.service.ts', import.meta.url),
  'utf-8',
);

describe('classification dedup invariants', () => {
  it('preCheckAnchorMatch is exported with a conservative similarity threshold constant', () => {
    assert.ok(
      source.includes('export async function preCheckAnchorMatch'),
      'canonical-knowledge.service.ts must export preCheckAnchorMatch — embedding-based anchor match before tree descent',
    );

    // Threshold must be declared and conservative (≥ 0.75). Using 0.5 would false-positive.
    const thresholdMatch = source.match(/ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD\s*=\s*([\d.]+)/);
    assert.ok(thresholdMatch, 'ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD must be defined as a module constant');
    const threshold = parseFloat(thresholdMatch[1]);
    assert.ok(
      threshold >= 0.75 && threshold <= 0.95,
      `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD must be conservative — got ${threshold}, expected in [0.75, 0.95].`,
    );
  });
});
```

**What to copy:**
- File-read header.
- Threshold-band assertion shape (Layer 2 thresholds from RESEARCH.md §"Layer 2 Decision Rule" must stay in `[0.72, 0.88]` band).
- Exported-symbol assertion (`export async function evaluateQuestion`, `export function layer1Regex`, `export async function layer2Embedding`).

**What's new:** Behavioral tests for `layer1Regex(content)` against the narrow regex set (RESEARCH.md §"Layer 1 Narrow Regex Set" table) — both positives ("hello", "ok", "asdf") and negatives ("Hello world programming", "What is a thank-you note?"). For Layer 2, stub `embedText` via the `_actions-mock-embedding.mjs` extension (deterministic-vector mock) and assert label-and-score on a small fake corpus.

---

### `app/tests/services/filter-classifier.eval.test.mjs` (NEW — JSON-fixture runner)

**Analog A:** `app/tests/locales/bundle-parity.test.mjs` (loop-over-JSON-fixture pattern)

**Loop-over-JSON pattern** (`bundle-parity.test.mjs:1-26`):
```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(resolve(here, '../../src/locales', f), 'utf8'));

function flatten(o, p = '') { /* ... */ }

test('en/zh/es/ja bundles have identical flattened key sets', () => {
  const en = new Set(flatten(read('en.json')));
  for (const locale of ['zh', 'es', 'ja']) {
    const b = new Set(flatten(read(`${locale}.json`)));
    // ... assertions ...
  }
});
```

**Analog B:** `_actions-mock-embedding.mjs` — extend it for a deterministic-vector mock so eval results are stable per-row.

**Existing mock** (`_actions-mock-embedding.mjs`):
```javascript
/** No-op stub for providers/embedding */
export async function embedText() { return []; }
export function cosine() { return 0; }
```

**What's new:** Replace the no-op mock body with a deterministic hash-to-vector projection (~64 dims) so test runs are reproducible. RESEARCH.md §"Eval Set Fixture Format + CI Integration" lines 962-985 sketches the runner shape:
```javascript
const fixture = JSON.parse(readFileSync(new URL('./filter-corpus.eval.json', import.meta.url), 'utf-8'));
for (const row of fixture.rows) {
  test(`eval ${row.id}: "${row.input.slice(0, 40)}…" → ${row.expected}`, async () => {
    const result = await evaluateQuestion(row.input, row.context);
    assert.equal(result.label, row.expected, `${row.id} (${row.rationale}) — got ${result.label}, expected ${row.expected}`);
  });
}
```

`waived` and `waived_known_limit` field handling (RESEARCH.md §"Encoded Payloads — Documented Limit" lines 1000-1003).

---

### `app/tests/services/filter-cache.test.mjs` (NEW — leaf-module unit test)

**Analog:** `app/tests/services/refill-mutex.test.mjs`

**Why this analog:** Tests a leaf module (`filter-corpus.service.ts` mirrors `refill-mutex.ts` discipline — no transitive deps, importable under `node --test`). Same test structure: behavioral semantics tests (1-3) + source-reading wiring tests (test 4 in refill-mutex).

**Behavioral test scaffold** (`refill-mutex.test.mjs:31-55`):
```javascript
const { createPromiseMutex } = await import('../../src/services/refill-mutex.ts');

describe('createPromiseMutex (Phase 36-12)', () => {
  it('single body executes when 3 callers race', async () => {
    const mutex = createPromiseMutex();
    let bodyCallCount = 0;
    const fn = async () => {
      bodyCallCount++;
      await new Promise((resolve) => setImmediate(resolve));
    };

    await Promise.all([mutex.run(fn), mutex.run(fn), mutex.run(fn)]);
    assert.equal(bodyCallCount, 1, `body must execute exactly once for 3 races; got ${bodyCallCount}`);
  });
});
```

**Source-reading wiring scaffold** (`refill-mutex.test.mjs:128-173`) — pattern for verifying that `question-filter.service.ts` calls `loadCorpusEmbeddings(embConfig)` from the cache module.

**What's new:** Cache-invalidation test (RESEARCH.md §"Pitfall 2"):
- Seed the cache via `loadCorpusEmbeddings({provider: 'openai', model: 'text-embedding-3-small'})` (using deterministic-vector mock).
- Re-call with `{provider: 'google', model: 'text-embedding-004'}` — assert `embedText` was invoked again (cache miss).
- Re-call with original config — assert no new `embedText` invocations (cache hit).

---

### `app/tests/providers/llm-bracketing.test.mjs` (NEW — provider helper unit + golden)

**Analog:** `app/tests/providers/llm-locale-injection.test.mjs`

**Test setup pattern** (`llm-locale-injection.test.mjs:1-31`):
```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';
import { bindI18nLeaf } from '../../src/lib/i18n-leaf.ts';

await i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: {} },
    zh: { translation: {} },
    es: { translation: {} },
    ja: { translation: {} },
  },
});

bindI18nLeaf(i18next.t.bind(i18next), () => i18next.language);

const { applyLocaleDirective } = await import('../../src/providers/llm/locale-directive.ts');
```

**Idempotency test pattern** (`llm-locale-injection.test.mjs:60-66`):
```javascript
test('is idempotent (no double-inject)', async () => {
  await i18next.changeLanguage('es');
  const once = applyLocaleDirective([{ role: 'user', content: 'hi' }]);
  const twice = applyLocaleDirective(once);
  assert.equal(twice.length, once.length);
  assert.deepEqual(twice, once);
});
```

**What's the same:** i18next setup is unnecessary for bracketing (no locale dependency) — strip the `i18next.init` block. Keep the dynamic-import-after-setup discipline. Keep the idempotency test shape.

**What's new:** Test cases per RESEARCH.md §"Pattern: bracketing test golden" (lines 1097-1140):
- Negative: does NOT mutate `role:'system'` content.
- Positive: wraps the LAST `role:'user'` only (history user messages stay byte-stable).
- Adversarial-tag escape: literal `</user_content>` inside content is escaped.
- Allowlist exclusion: skips Phase 35 user-ack message.
- Allowlist exclusion: skips web-search Pass-2 results-injection.

Plus source-reading assertions on `providers/llm/index.ts`:
- `applyUserContentBracketing` is called inside `chatCompletion` AND `chatStream` AFTER `applyLocaleDirective` (mirrors `useQuestions-system-prompt-stability.test.mjs:60-87` ordering pattern).

---

### `app/tests/providers/tts-bracketing-exempt.test.mjs` (NEW — negative-invariant source-reading)

**Analog:** `app/tests/components/InfoFlow.video-tap-emit.test.mjs`

**Why this analog:** Pure negative-invariant source-reading test. Asserts a module does NOT contain certain strings. Phase 47's TTS-exemption tests must assert that `providers/tts/index.ts` does NOT import or reference `applyUserContentBracketing` (RESEARCH.md §"TTS wrapper bracketing" lines 845-851 documented exemption).

**Negative-invariant pattern** (`InfoFlow.video-tap-emit.test.mjs:30-51`):
```javascript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFOFLOW_PATH = resolve(__dirname, '../../src/components/InfoFlow.tsx');
const source = readFileSync(INFOFLOW_PATH, 'utf-8');

describe('InfoFlow video card — inline-play removed (Phase 42 UAT-7+8)', () => {
  it('does NOT call dailyReadService.markExplored from feed cards', () => {
    const matches = source.match(/dailyReadService\.markExplored/g) || [];
    assert.equal(
      matches.length,
      0,
      `InfoFlow.tsx must NOT call dailyReadService.markExplored — Phase 42 UAT-7 removed inline-play. ` +
      `Found ${matches.length} occurrence(s). PostDetailScreen's Detector D ... is now the SOLE feed-level video engagement signal.`,
    );
  });
});
```

**What to copy verbatim:** The `readFileSync` + `.match(...)` + `assert.equal(matches.length, 0, ...)` shape with a message that explains WHY this NOT-pattern matters (RESEARCH.md §"TTS wrapper bracketing" — TTS has no instruction-following surface; bracketing would corrupt phonetic output).

**What's new:** Two assertions per RESEARCH.md §"Embedding wrapper bracketing decision" — one for `tts/index.ts`, optionally a second test file or describe-block for `embedding/index.ts`. Both must NOT import `applyUserContentBracketing` from `providers/llm/user-content-bracketing.ts` (vector-corruption + audio-corruption rationale documented in error message).

---

### `app/tests/state/useQuestions-pre-gate.test.mjs` (NEW — pipeline-inversion source-reading)

**Analog:** `app/tests/state/useQuestions-system-prompt-stability.test.mjs`

**Why this analog:** Same file under test, same source-reading discipline, same headers about why source-reading is the correct test type ("behavior under test is observable only at the provider boundary, which we do not stub in CI"). Phase 47's pipeline-inversion test mirrors the Phase 35 byte-stability test's structural assertion pattern.

**Source-reading + ordering-assertion pattern** (`useQuestions-system-prompt-stability.test.mjs:61-87`):
```javascript
it('Pass 1 chatStream array has a role:"assistant" message carrying the candidate context BEFORE the user turn', () => {
  const pass1Idx = source.indexOf('const stream = chatStream(');
  assert.ok(pass1Idx !== -1, 'useQuestions.ts must contain the Pass 1 chatStream call (`const stream = chatStream(`)');
  const pass1ArrayEnd = source.indexOf('llmConfig', pass1Idx);
  assert.ok(pass1ArrayEnd !== -1, 'Pass 1 chatStream call must reach llmConfig argument');
  const pass1Array = source.slice(pass1Idx, pass1ArrayEnd);

  assert.ok(
    /role:\s*['"]assistant['"],\s*content:\s*assistantContextMessage/.test(pass1Array),
    'Pass 1 chatStream array must contain `{ role: "assistant", content: assistantContextMessage }` — the tail-position graph-context message',
  );

  const historySpread = pass1Array.indexOf('...historyMessages');
  const assistantCtx = pass1Array.search(/role:\s*['"]assistant['"],\s*content:\s*assistantContextMessage/);
  const userTurn = pass1Array.search(/role:\s*['"]user['"]\s*,\s*content(?:\s*:\s*content)?\s*[,}]/);
  assert.ok(historySpread !== -1, 'Pass 1 array must spread ...historyMessages');
  assert.ok(userTurn !== -1, 'Pass 1 array must contain the new user turn `{ role: "user", content }`');
  assert.ok(
    historySpread < assistantCtx && assistantCtx < userTurn,
    `Pass 1 array order must be: ...historyMessages → assistant(context) → user(content). Got offsets history=${historySpread}, assistant=${assistantCtx}, user=${userTurn}.`,
  );
});
```

**What's the same:** `indexOf` for anchor literal, `slice` to narrow source window, ordering assertion via offset comparison. This is the codebase-canonical way to assert "X happens BEFORE Y" in source.

**What's new:** Phase 47 ordering invariants:
- `filterQuestion(content` appears BEFORE `const stream = chatStream(` in `askStreaming` (pre-gate inversion).
- The `if (filterResult.label === 'malicious')` branch returns `null` BEFORE any `chatStream(` reference (no LLM call on malicious branch).
- `filterQuestion` is called with `abortController.signal` as third arg (D-19 abort threading).

---

### `app/tests/services/question-service-pre-gate.test.mjs` (NEW — mirror of useQuestions test)

**Analog:** Same as above (`useQuestions-system-prompt-stability.test.mjs`), but pointed at `app/src/services/question.service.ts` instead.

**What's the same:** Identical test scaffold, identical ordering-assertion pattern.

**What's new:** Asserts the same three invariants in `question.service.ask` (lines 184-298): pre-gate before `chatCompletion`, malicious branch returns `ServiceResult` error before `chatCompletion`, abort signal threaded.

---

### `app/tests/screens/AskScreen-override-refire.test.mjs` (NEW — D-06 source-reading)

**Analog:** `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs`

**Why this analog:** Source-reading test against a screen file that the i18n chain prevents from importing under `node --test`. Same file-load + slice-window-by-anchor-pair + regex-assert pattern.

**Slice-by-anchor pattern** (`HomeScreen.exploredAnchors-resync.test.mjs:36-46`):
```javascript
function getVineResyncSlice() {
  const startMarker = 'creditAwardedRef = useRef(';
  const endMarker = "eventBus.subscribe('CONCEPT_EXPLORED'";
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    `Could not locate vine-resync anchor pair (...). startIdx=${startIdx}, endIdx=${endIdx}. The HomeScreen.tsx file structure may have changed; update the markers in this test.`,
  );
  return source.slice(startIdx, endIdx);
}
```

**Multi-line regex assertion pattern** (`HomeScreen.exploredAnchors-resync.test.mjs:49-56`):
```javascript
it('declares an effect (between creditAwardedRef and CONCEPT_EXPLORED) that resyncs setExploredAnchors when location.pathname === "/home"', () => {
  const slice = getVineResyncSlice();
  assert.match(
    slice,
    /useEffect\(\(\)\s*=>\s*\{[\s\S]*?location\.pathname\s*===\s*['"]\/home['"][\s\S]*?setExploredAnchors\(dailyReadService\.getExploredAnchors\(\)\)[\s\S]*?\},\s*\[location\.pathname\]\)/,
    'HomeScreen.tsx must declare a useEffect ... See ... .planning/debug/vine-chip-not-clearing-after-force-new-day.md.',
  );
});
```

**What to copy:**
- Slice the source between `'const handleQuestionOverride = useCallback'` and the next `useCallback` declaration.
- Regex-assert the slice contains `classifyAndAnchorIncremental(` AND `.catch(` (fire-and-forget) AND `settings.llm.isConfigured` (D-06 guard per Pitfall 4).
- Optional: assert NO `await classifyAndAnchorIncremental` (must stay fire-and-forget — the toast fired synchronously means the user expects the button to clear immediately).

---

## Shared Patterns

### Pattern: Leaf-module discipline (JSON-import-attribute-safe)

**Source:** `app/src/services/refill-mutex.ts:1-12` header

**Apply to:** `filter-corpus.service.ts`, `providers/llm/user-content-bracketing.ts`, `question-filter.service.ts` (the rewritten file). Every Phase 47 NEW source file MUST avoid transitive imports of `locales/index.ts` so its tests can `await import('../../src/...')` under `node --test` without `ERR_IMPORT_ATTRIBUTE_MISSING`.

**Concrete requirement:** Do NOT `import { settingsService } from './settings.service.ts'` at module top in any new file. Either accept config as a parameter (preferred) or use `await import('./settings.service.ts')` lazily inside the function body (the same pattern `canonical-knowledge.service.ts:695` uses).

```typescript
// canonical-knowledge.service.ts:695 — lazy-import pattern for breaking dep cycle / leaf discipline
const { settingsService } = await import('./settings.service.ts');
const embCfg = settingsService.getSync().embedding;
```

### Pattern: ServiceResult<T> error shape

**Source:** `app/src/state/useQuestions.ts:104-106` (`{ code, message, retryable }`)

**Apply to:** `question.service.ts:ask` malicious branch error return — use a new `code: 'BLOCKED_MALICIOUS'`, `message` from i18n, `retryable: false`. Mirrors the `code: 'NOT_CONFIGURED'` precedent at `useQuestions.ts:105` and `question.service.ts:191`.

### Pattern: AbortSignal composition + threading

**Source:** `app/src/providers/llm/index.ts:35-46` (`composeSignal`) + `useQuestions.ts:131-134` (`abortController` + `LOCALE_CHANGED` subscriber)

**Apply to:** `filterQuestion` — accept `signal?: AbortSignal` as third parameter (after `content`, `sessionContext`). Inside Layer 2, check `signal?.aborted` before AND after each `await embedText(...)`. Pattern from `canonical-knowledge.service.ts:1019` already demonstrates this for `preCheckAnchorMatch`.

### Pattern: Fire-and-forget classification with `.catch` warn

**Source:** `app/src/state/useQuestions.ts:316-319` and `app/src/services/question.service.ts:285-287`

**Apply to:** `AskScreen.handleQuestionOverride` (D-06 closure):
```typescript
void classifyAndAnchorIncremental(question, questionService.getAll(), settings.llm).catch((err: unknown) => {
  console.warn('[Trellis] override classifyAndAnchorIncremental failed:', err instanceof Error ? err.message : err);
});
```
Same shape, no `signal` arg (RESEARCH.md §"Pattern 4" line 510 — user-initiated override is synchronous).

### Pattern: Event emission (GRAPH_UPDATED via classification path)

**Source:** `app/src/services/canonical-knowledge.service.ts` `commitClassificationResult` already emits `GRAPH_UPDATED`. Subscribers in `useTrellisData.ts`, `useQuestions.ts`, `PrunedSection.tsx`, `GraphScreen.tsx` re-read from store automatically.

**Apply to:** D-06 override re-fire path — do NOT add a new `eventBus.emit` call. The downstream `classifyAndAnchorIncremental → commitClassificationResult` chain already emits. Adding a second emit double-fires.

**Apply to:** Off-topic branch in `useQuestions.askStreaming` (and mirror in `question.service.ask`): KEEP the existing `eventBus.emit({ type: 'QUESTION_ASKED', payload: question })` from `useQuestions.ts:310` — needed so HomeScreen instances replace their pre-flag copy. Do NOT introduce a `QUESTION_FLAGGED_PRE_GATE` event (CLAUDE.md "One signal per semantic event").

### Pattern: i18n discipline

**Source:** CLAUDE.md "i18n Workflow" + `app/src/locales/en.json` namespace structure + `bundle-parity.test.mjs`

**Apply to:** Every Phase 47 user-visible string. Add the canonical EN value first; run `app/scripts/translate-locales.md` Sonnet subagent for zh/es/ja; commit all 4 bundles in the SAME PR. Never call `chatCompletion` for translation. Suggested namespace: `chatMessage.maliciousBlocked.body`.

### Pattern: Inline styles + CSS variables (NOT Tailwind)

**Source:** `app/src/components/ChatMessage.tsx:296-381` existing flagged-render block

**Apply to:** New `chatMessage.maliciousBlocked` render branch in ChatMessage.tsx. Same `var(--surface)`, `var(--border)`, `var(--muted-foreground)` palette. Same `borderRadius: '12px'`, `padding: '6px 10px'`, `fontSize: '0.75rem'` magnitudes for the inline message.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/src/data/filter-corpus.json` | data fixture | static JSON loaded at runtime | No `app/src/data/` directory exists today (verified by `ls /Users/Code/EchoLearn/app/src/data/: No such file or directory`). This is the first repo-only-static-JSON consumed by a service in the codebase. Closest cousins are `app/src/locales/*.json` (loaded via i18next, not direct imports) and `app/src/services/news-source-metadata.ts` (TS-encoded, not JSON). Planner: create the directory; bundle into Vite via standard JSON import (no special config needed — `import corpus from '../data/filter-corpus.json'`). |
| `app/tests/services/filter-corpus.eval.json` | test fixture | data loaded by sibling .test.mjs | No prior `tests/**/*.eval.json` exists. Closest cousins are `app/src/locales/*.json` for SHAPE but not for purpose. Use the shape from RESEARCH.md §"Eval Set Fixture Format" lines 898-953. |

Both files are first-of-kind in the codebase. RESEARCH.md provides their concrete shape; planner can use those examples directly.

## Metadata

**Analog search scope:**
- `app/src/services/` — for service analogs
- `app/src/providers/{llm,tts,embedding}/` — for provider helper analogs
- `app/src/state/` — for hook analogs
- `app/src/screens/` — for screen analogs
- `app/src/components/` — for component analogs
- `app/src/locales/` — for i18n analog
- `app/tests/{services,providers,state,screens,components,locales}/` — for test analogs
- `app/src/lib/event-bus.ts` — for event-bus pattern
- CLAUDE.md "Ask-chat system prompt — byte-stable across turns" + "Classification dedup — embedding pre-check" + "Event bus — unified GRAPH_UPDATED" + "i18n Workflow"

**Files scanned:** 21 (read for pattern extraction)
- `app/src/services/question-filter.service.ts` (file being replaced)
- `app/src/services/canonical-knowledge.service.ts` (pre-check + commit pattern, lines 691-744 + 1007-1035)
- `app/src/services/refill-mutex.ts` (leaf-module pattern, full file)
- `app/src/services/question.service.ts` (ask + patchQuestion, lines 180-300 + 540-563)
- `app/src/providers/llm/locale-directive.ts` (full file — bracketing analog)
- `app/src/providers/llm/index.ts` (composition site, full file)
- `app/src/providers/embedding/index.ts` (embedText + cosine, full file)
- `app/src/providers/tts/index.ts` (full file — exemption rationale + duplication-discipline analog)
- `app/src/state/useQuestions.ts` (askStreaming, lines 90-330)
- `app/src/screens/AskScreen.tsx` (handleQuestionOverride, lines 485-525)
- `app/src/components/ChatMessage.tsx` (flagged render block, lines 280-390)
- `app/src/locales/en.json` (chatMessage namespace, lines 747-770)
- `app/src/lib/event-bus.ts` (full file)
- `app/tests/services/classification-dedup.test.mjs` (full file — source-reading + threshold-band analog)
- `app/tests/services/refill-mutex.test.mjs` (full file — leaf-module test analog)
- `app/tests/services/_actions-mock-embedding.mjs` (deterministic-mock extension target)
- `app/tests/services/_actions-mock-qfilter.mjs` (existing no-op stub)
- `app/tests/providers/llm-locale-injection.test.mjs` (full file — provider helper test analog)
- `app/tests/providers/tts-locale.test.mjs` (lines 1-50 — i18next + dynamic-import setup analog)
- `app/tests/state/useQuestions-system-prompt-stability.test.mjs` (lines 1-120 — source-reading ordering pattern)
- `app/tests/screens/HomeScreen.exploredAnchors-resync.test.mjs` (full file — slice-by-anchor source-reading pattern)
- `app/tests/components/InfoFlow.video-tap-emit.test.mjs` (lines 1-80 — negative-invariant pattern)
- `app/tests/locales/bundle-parity.test.mjs` (full file — JSON-fixture loop pattern)

**Pattern extraction date:** 2026-05-15
