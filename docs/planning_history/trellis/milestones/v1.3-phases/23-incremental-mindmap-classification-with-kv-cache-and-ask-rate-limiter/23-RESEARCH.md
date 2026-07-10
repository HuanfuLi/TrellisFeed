# Phase 23: Incremental Mindmap Classification with KV Cache and Ask Rate Limiter - Research

**Researched:** 2026-04-09
**Domain:** LLM conversation threading for KV cache, multi-step classification pipeline, monthly rate limiter
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 3-step sequential LLM pipeline: branch → cluster → anchor. Each step appends to prior context (same message array grows each step).
- **D-02:** Index-based selection — numbered list of candidates; LLM responds with index number or `{"index":"NEW","name":"..."}` for new creations.
- **D-03:** Each step returns selection + name only (for NEW). No briefAnswer, keyword, or placementReason in pipeline responses.
- **D-04:** System prompt is stable/generic ("You are a knowledge classifier..."). All variable content (question text, candidate lists) goes in user messages.
- **D-05:** Append-only conversation threading — step 2 sees full step-1 exchange as prefix, step 3 sees steps 1+2. Maximizes KV cache reuse.
- **D-06:** Short-circuit — if any step returns NEW, skip remaining steps and create all downstream nodes in code.
- **D-07:** No partial commits — collect all 3 decisions before creating or attaching any nodes. Only mutate state after full pipeline completes.
- **D-08:** When a pipeline step fails (LLM error, invalid JSON, timeout, invalid index), retry the failed step once with the same context.
- **D-09:** If retry also fails, fall back to existing single-call `classifyAndAnchor`. Old code is kept as fallback path.
- **D-10:** Invalid LLM responses (out-of-bounds index, non-numeric response, malformed JSON) are treated as step failures triggering retry.
- **D-11:** Monthly quota model — counter tracks total `askStreaming` requests per calendar month. Resets on 1st. Stored as `{count, yearMonth}` in localStorage.
- **D-12:** Only counts user Q&A streaming requests (`askStreaming` in `useQuestions`). Does NOT count system LLM calls.
- **D-13:** Off by default — 0 means unlimited.
- **D-14:** Setting appears in combined "Usage" section in Settings (renaming existing "Token Usage" section). Shows current month's count, limit, reset date.
- **D-15:** Inline banner in Ask screen only at 80%+ of limit or when limit is hit.
- **D-16:** Hard block when limit is hit — send button disabled, banner shows "Monthly limit reached — resets on [date]".
- **D-17:** Old single-call `classifyAndAnchor` kept as fallback, not removed.
- **D-18:** Existing unanchored/legacy nodes left as-is. No auto-classification on upgrade.
- **D-19:** Re-organize button keeps its separate full-reorg LLM call (`_doReorganize`). Incremental pipeline is only for new single-question classification.

### Claude's Discretion
- Implementation details of the prompt template (exact wording, JSON schema enforcement)
- localStorage key naming for rate limit counter
- Exact threshold for "near limit" banner (80% suggested but Claude can adjust)
- How to structure the new pipeline function alongside the old classifyAndAnchor

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

This phase has two independent workstreams that share no code: (1) replace `classifyAndAnchor` with a 3-step incremental pipeline that threads conversation context for KV cache reuse, and (2) add a monthly request counter that gates `askStreaming` calls in `useQuestions`.

The pipeline workstream requires a new function `classifyAndAnchorIncremental` in `canonical-knowledge.service.ts` that runs 3 sequential `chatCompletion` calls, growing a shared message array between steps. If any step fails after one retry, the function falls back to the existing `classifyAndAnchor`. No changes to callers or the node-creation logic at the bottom of `classifyAndAnchor` — the decisions feed the same cluster/anchor creation code.

The rate limiter workstream requires: (a) a small `ask-rate-limiter.service.ts` that reads/writes `{count, yearMonth}` from localStorage, (b) a guard at the top of `askStreaming` in `useQuestions`, (c) an inline banner in `AskScreen`, (d) a new `askMonthlyLimit` field in `AppSettings`/`preferences`, and (e) a UI row in the existing "Token Usage" section (renamed "Usage") in `SettingsScreen`.

**Primary recommendation:** Implement as two sequential waves — pipeline first (Wave 1: service + helper), rate limiter second (Wave 2: service + settings type + UI). The pipeline can be tested in isolation; the rate limiter has no dependency on the pipeline.

---

## Standard Stack

### Core (no new libraries needed)
| Component | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| `chatCompletion` | existing | All 3 pipeline LLM calls | Already supports `serviceName` for token tracking |
| `localStorage` | browser API | Rate limit counter storage | Matches app-wide pattern (`echolearn_*` keys) |
| React `useState` | 19 | Banner visibility in AskScreen | Derived from rate limiter read at render |

**Installation:** None required — no new npm packages.

---

## Architecture Patterns

### Recommended File Changes
```
app/src/services/
├── canonical-knowledge.service.ts   — add classifyAndAnchorIncremental(), keep classifyAndAnchor() as fallback
└── ask-rate-limiter.service.ts      — NEW: monthly counter read/write, increment, check
app/src/types/index.ts               — add askMonthlyLimit to AppPreferences (or new top-level key)
app/src/state/useQuestions.ts        — add rate limit guard + increment at askStreaming entry
app/src/screens/AskScreen.tsx        — add inline banner below ChatInput
app/src/screens/SettingsScreen.tsx   — rename "Token Usage" → "Usage", add limit input row
app/src/services/settings.service.ts — add askMonthlyLimit: 0 to defaultSettings
```

### Pattern 1: Append-Only Conversation Threading (KV Cache)

**What:** Each pipeline step appends its user prompt to the growing message array, then pushes the LLM's assistant response. Step N's request starts with the identical prefix of all prior steps, so the KV cache entry from step N-1 is a valid prefix hit.

**When to use:** Any multi-step sequential LLM workflow where each step's context is a strict superset of the prior step.

**Example structure:**
```typescript
// Source: design decision D-05
const messages: ChatMessage[] = [
  { role: 'system', content: STABLE_SYSTEM_PROMPT },
  { role: 'user', content: questionText },
];

// Step 1: branch
const step1UserMsg = buildStepPrompt('branch', branchCandidates);
messages.push({ role: 'user', content: step1UserMsg });
const step1Raw = await chatCompletion(messages, llmConfig, { serviceName: 'classification' });
messages.push({ role: 'assistant', content: step1Raw });
const step1 = parseStepResponse(step1Raw, branchCandidates.length);

// Step 2: cluster (only if step1 was not NEW)
if (step1.isNew) { /* short-circuit */ } else {
  const step2UserMsg = buildStepPrompt('cluster', clusterCandidates);
  messages.push({ role: 'user', content: step2UserMsg });
  const step2Raw = await chatCompletion(messages, llmConfig, { serviceName: 'classification' });
  messages.push({ role: 'assistant', content: step2Raw });
  // ...
}
```

**Why KV cache is hit:** The system prompt + question text prefix is identical across all 3 calls. Steps 2 and 3 have a longer exact-match prefix (system + question + step1 exchange + step2 prompt) than the prefix from step 1 alone, but step 1's prefix is always a subset — providers cache prompt prefixes and reuse them.

**Critical rule:** The system prompt text must be string-identical across all calls. Any dynamic content (question text, branch names) must go into user messages, never the system prompt.

### Pattern 2: Index-Based Step Response Parsing

**What:** LLM receives a numbered candidate list and returns either a bare integer (select existing) or `{"index":"NEW","name":"<label>"}` (create new).

**Parsing logic:**
```typescript
interface StepDecision {
  isNew: boolean;
  selectedIndex?: number;   // 0-based, for existing
  newName?: string;         // for new nodes
}

function parseStepResponse(raw: string, candidateCount: number): StepDecision {
  const trimmed = raw.trim();
  // Try JSON path first (covers NEW and any JSON integer)
  try {
    const parsed = JSON.parse(trimmed) as { index?: unknown; name?: string };
    if (parsed.index === 'NEW' && parsed.name) {
      return { isNew: true, newName: parsed.name.trim() };
    }
    if (typeof parsed.index === 'number' && parsed.index >= 0 && parsed.index < candidateCount) {
      return { isNew: false, selectedIndex: parsed.index };
    }
  } catch { /* not JSON, try numeric */ }
  // Bare integer path
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 0 && num < candidateCount) {
    return { isNew: false, selectedIndex: num };
  }
  // Invalid — triggers retry (D-10)
  throw new Error(`Invalid step response: "${trimmed}"`);
}
```

**Why index-based:** The most compact possible response. Minimizes output tokens and parse complexity. Handles edge cases (LLM sends `3` vs `{"index":3}`) with a dual parse path.

### Pattern 3: Single Prompt Template (Parameterized)

**What:** One function generates the user-turn prompt for all 3 levels, parameterized by level name and candidate list.

```typescript
function buildStepPrompt(level: 'branch' | 'cluster' | 'anchor', candidates: string[]): string {
  const numbered = candidates.map((c, i) => `${i}. ${c}`).join('\n');
  return [
    `Select the best ${level} for this question, or create a new one if none fits.`,
    '',
    `Existing ${level}s:`,
    numbered,
    '',
    `Respond with the index number (0-${candidates.length - 1}) to select an existing ${level},`,
    `or {"index":"NEW","name":"<${level} name>"} to create a new one.`,
  ].join('\n');
}
```

**Why single template:** Easier to maintain, and ensures all 3 levels use structurally identical prompts so the LLM behavior is predictable.

### Pattern 4: Retry-Then-Fallback Error Handling

```typescript
async function runStepWithRetry(
  messages: ChatMessage[],
  candidates: string[],
  llmConfig: LLMConfig,
): Promise<StepDecision> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await chatCompletion(messages, llmConfig, { serviceName: 'classification' });
      messages.push({ role: 'assistant', content: raw });
      return parseStepResponse(raw, candidates.length);
    } catch (err) {
      // On attempt 0, remove the failed assistant response (if any was pushed) and retry
      if (attempt === 0) {
        // Pop the failed assistant message so retry gets clean context
        if (messages[messages.length - 1]?.role === 'assistant') messages.pop();
        continue;
      }
      throw err; // attempt 1 failed — caller will trigger fallback
    }
  }
  throw new Error('unreachable');
}
```

**Critical:** When a step fails and the assistant message was pushed, it must be popped before retrying. Otherwise the retry sees a corrupt conversation (assistant message with garbled content followed by a repeated user prompt).

### Pattern 5: Rate Limiter Service

**What:** A standalone service with no React dependencies.

```typescript
// ask-rate-limiter.service.ts
const STORAGE_KEY = 'echolearn_ask_rate_limit';

interface RateLimitStore {
  count: number;
  yearMonth: string; // 'YYYY-MM'
}

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7); // '2026-04'
}

export function getRateLimitStatus(limit: number): { count: number; canAsk: boolean; nearLimit: boolean; resetDate: string } {
  if (limit <= 0) return { count: 0, canAsk: true, nearLimit: false, resetDate: '' };
  const store = load();
  const pct = store.count / limit;
  return {
    count: store.count,
    canAsk: store.count < limit,
    nearLimit: pct >= 0.8,
    resetDate: getResetDate(),
  };
}

export function incrementAskCount(): void {
  const store = load();
  store.count++;
  save(store);
}
```

**Important:** `incrementAskCount` is called AFTER a successful `askStreaming` completion — not before. This way a failed/aborted request doesn't consume a slot.

### Pattern 6: Rate Limit Guard in useQuestions

The guard goes at the entry of `askStreaming`, after the existing `aiConsentGiven` and `isConfigured` guards:

```typescript
// In useQuestions.ts askStreaming:
const settings = settingsService.getSync();
const monthlyLimit = settings.preferences.askMonthlyLimit ?? 0;
const rateLimitStatus = getRateLimitStatus(monthlyLimit);

if (!rateLimitStatus.canAsk) {
  const msg = `Monthly question limit reached (${monthlyLimit}). Resets on ${rateLimitStatus.resetDate}.`;
  onToken(msg);
  setError({ code: 'RATE_LIMITED', message: msg, retryable: false });
  setIsAsking(false);
  return null;
}
```

### Pattern 7: Inline Banner in AskScreen

The banner renders conditionally between the message list and `ChatInput`, using `rateLimitStatus` read at render time:

```typescript
// AskScreen reads status and passes isLimitHit to ChatInput disabled prop
const rateLimitBanner = rateLimitStatus.nearLimit && (
  <div style={{ /* warning or error styles */ }}>
    {rateLimitStatus.canAsk
      ? `Approaching monthly limit (${rateLimitStatus.count}/${monthlyLimit}). Resets on ${rateLimitStatus.resetDate}.`
      : `Monthly limit reached. Resets on ${rateLimitStatus.resetDate}.`}
  </div>
);
```

**ChatInput receives** `disabled={!!streaming || editingMessageId !== null || !rateLimitStatus.canAsk}`.

### Anti-Patterns to Avoid

- **Putting question text in the system prompt:** Destroys KV cache reuse — each question produces a unique system prompt, so no caching occurs. All variable content (question text, candidate lists) must go in user-turn messages.
- **Pushing assistant message before parsing:** If you push the assistant message to the array and then parsing fails, the corrupt response stays in context for the retry. Pop it on parse failure.
- **Incrementing rate counter before the call succeeds:** Pre-increment means aborted/failed requests eat quota. Increment only on confirmed save of the question.
- **Calling getRateLimitStatus in a useEffect on mount only:** The banner must reflect real-time state. Read it synchronously from localStorage at render (like `settingsService.getSync()`) or after each `askStreaming` returns.
- **Using `askMonthlyLimit` in `AppSettings.llm` or `AppSettings.embedding`:** It logically belongs in `AppSettings.preferences` as an integer field or as a new top-level `usage` key. Using an existing sub-object avoids structural schema drift.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-provider LLM call | Custom fetch | `chatCompletion()` from `providers/llm` | Already handles Claude/OpenAI/Gemini/local, timeouts, token reporting |
| Settings persistence | Custom localStorage writer | `settingsService.set()` + `getSync()` | deepMerge handles partial stored data; `getSync()` is used everywhere |
| Toast notifications | Custom alert/div | `toast()` from `lib/toast` | Already wired to `<ToastContainer>` in root |
| TypeScript branded types | Custom type guards | Extend `AppSettings.preferences` with `askMonthlyLimit?: number` | Consistent with existing optional fields pattern |

**Key insight:** `chatCompletion` already handles all provider routing, timeout signals, and token usage recording. The pipeline is purely about message array construction and sequential calls — zero provider plumbing needed.

---

## Common Pitfalls

### Pitfall 1: KV Cache Invalidation from Dynamic System Prompt
**What goes wrong:** If any dynamic content (even whitespace or a timestamp) is inserted into the system prompt, every call has a unique prefix and the provider's KV cache never hits.
**Why it happens:** Easy to add "helpful" context like `treeContext` or `buildTreeContext()` output to the system prompt.
**How to avoid:** Lock the system prompt as a constant string. In Phase 23's pipeline, `buildTreeContext()` output is NOT passed to the system prompt — instead, the candidates for each level are rendered as numbered lists in the step's user message.
**Warning signs:** Token costs don't decrease as the graph grows; each classification costs the same as the first.

### Pitfall 2: Message Array Mutation Across Retries
**What goes wrong:** On a failed step, if the assistant message was pushed before parsing failed, the retry sees a message array with a bad assistant response + the user prompt repeated. The LLM gets confused by the malformed conversation.
**Why it happens:** Pushing the assistant response immediately after `chatCompletion` returns, before parsing.
**How to avoid:** Parse first; only push to messages array after parse succeeds. On catch: pop any assistant message that was pushed, then retry with clean context.
**Warning signs:** Step 2 or 3 consistently returns nonsense even with a valid LLM connection.

### Pitfall 3: Short-Circuit Creates Nodes in Code Without Labels
**What goes wrong:** When step 1 returns NEW (new branch), the code must create a branch node, a cluster node, AND an anchor node — all with code-generated names. The anchor node's `branchLabel` and `clusterLabel` must match the newly generated branch/cluster names so the graph renders correctly.
**Why it happens:** The cluster was never selected by LLM; its `branchLabel` must be set to the just-created branch's name.
**How to avoid:** When creating downstream nodes after a NEW decision, always propagate the parent-level names downward: `anchorNode.branchLabel = newBranchName`, `anchorNode.clusterLabel = newClusterName`.
**Warning signs:** Anchor nodes appear under "General concepts" / "Open questions" fallback branch in the mindmap instead of the newly created branch.

### Pitfall 4: Circular Import in classifyAndAnchorIncremental
**What goes wrong:** `canonical-knowledge.service.ts` already uses `import('./question.service.ts')` as a dynamic import (lazy) to avoid circular dependency. If `classifyAndAnchorIncremental` also uses `questionService`, it must use the same lazy import pattern.
**Why it happens:** The service file is imported from `useQuestions.ts`, which creates a potential cycle through `question.service.ts`.
**How to avoid:** Keep the existing lazy import pattern: `const { questionService } = await import('./question.service.ts')`.
**Warning signs:** "Circular dependency detected" warnings in Vite dev console on startup.

### Pitfall 5: Rate Limiter Reads Stale Month
**What goes wrong:** If the app has been open past midnight on the 1st of a new month, the cached `yearMonth` string in the loaded store is stale. The user keeps getting blocked even though a new month started.
**Why it happens:** The month check only happens when `load()` is called — if the UI never re-renders, the stored string never gets compared.
**How to avoid:** In `getRateLimitStatus` and `incrementAskCount`, always compare `store.yearMonth` to `currentYearMonth()`. If they differ, reset `count = 0` and write back before returning.
**Warning signs:** Users report still being blocked on the 1st or 2nd of a new month.

### Pitfall 6: Step Response Parsing Misses LLM Verbosity
**What goes wrong:** Some LLMs (especially GPT-4) add explanatory text before or after the JSON. Parsing only `raw.trim()` fails.
**Why it happens:** The model adds "I'll select option 2 because..." despite instructions to respond only with an index.
**How to avoid:** Before strict parse, try extracting a JSON object with `raw.match(/\{[\s\S]*?\}/)` and also `parseInt(raw.match(/\d+/)?.[0], 10)`. Treat found integer in range as valid selection. This is the same pattern already in `classifyAndAnchor`'s JSON extraction.
**Warning signs:** High retry rate on step 2/3 from particular LLM models.

### Pitfall 7: Candidate Index Is 0-Based vs 1-Based Mismatch
**What goes wrong:** If the prompt displays "1. Psychology\n2. Computer Science\n..." (1-based) but parsing expects 0-based index, selecting "1" maps to index 0 which is "Psychology" — but if the model selects "2" for "Computer Science", it maps to index 1 correctly. However if the prompt uses 0-based and the LLM responds with 1 for "the first item", an off-by-one occurs.
**Why it happens:** Natural language tendency of LLMs to use 1-based counting.
**How to avoid:** Use 0-based numbering in the prompt consistently (0, 1, 2...) and document this in the prompt itself ("Respond with the index shown (starting from 0)"). Validate that `selectedIndex >= 0 && selectedIndex < candidates.length`.

---

## Code Examples

### Full Pipeline Skeleton

```typescript
// Source: design decisions D-01 through D-07
export async function classifyAndAnchorIncremental(
  question: Question,
  allQuestions: Question[],
  llmConfig: LLMConfig,
): Promise<void> {
  const { questionService } = await import('./question.service.ts');

  // Build candidate lists for each level from allQuestions
  const branches = extractUniqueBranches(allQuestions);       // string[]
  const messages: ChatMessage[] = [
    { role: 'system', content: PIPELINE_SYSTEM_PROMPT },
    { role: 'user', content: question.content },
  ];

  // --- Step 1: Branch ---
  messages.push({ role: 'user', content: buildStepPrompt('branch', branches) });
  let step1: StepDecision;
  try {
    step1 = await runStepWithRetry([...messages], branches, llmConfig);
    messages.push({ role: 'assistant', content: /* step1 raw */ });
  } catch {
    return classifyAndAnchor(question, allQuestions, llmConfig); // fallback (D-09)
  }

  let branchName: string;
  if (step1.isNew) {
    branchName = step1.newName!;
    // Short-circuit: create branch + cluster + anchor in code (D-06)
    await createAllNodesInCode(question, branchName, questionService);
    return;
  }
  branchName = branches[step1.selectedIndex!];

  // --- Step 2: Cluster ---
  const clusters = extractClustersUnderBranch(allQuestions, branchName);
  messages.push({ role: 'user', content: buildStepPrompt('cluster', clusters) });
  let step2: StepDecision;
  try {
    step2 = await runStepWithRetry([...messages], clusters, llmConfig);
    messages.push({ role: 'assistant', content: /* step2 raw */ });
  } catch {
    return classifyAndAnchor(question, allQuestions, llmConfig);
  }

  // ... (step 3 follows same pattern)

  // --- Commit all decisions (D-07) ---
  await commitDecisions(question, { branchName, clusterName, anchorDecision }, allQuestions, questionService);
}
```

### Settings Type Extension

```typescript
// Source: types/index.ts — AppPreferences
export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  onboardingCompleted: boolean;
  aiConsentGiven?: boolean;
  askMonthlyLimit?: number;  // 0 = unlimited (default)
}
```

### Rate Limit localStorage Key

Suggested: `'echolearn_ask_rate_limit'` — follows `echolearn_*` namespace convention.

Store shape:
```json
{ "count": 12, "yearMonth": "2026-04" }
```

---

## Integration Points Inventory

These are all the places that must change (or are touched) in this phase:

### Pipeline Changes
| File | Change |
|------|--------|
| `canonical-knowledge.service.ts` | Add `classifyAndAnchorIncremental()`, keep `classifyAndAnchor()` as fallback |
| `useQuestions.ts` (line 226) | Replace `classifyAndAnchor(...)` call with `classifyAndAnchorIncremental(...)` |
| `question.service.ts` (line 262) | Replace `classifyAndAnchor(...)` call with `classifyAndAnchorIncremental(...)` |

Note: `question.service.ts` line 262 also calls `classifyAndAnchor`. This is the second call site from CONTEXT.md canonical refs. Both must be updated.

### Rate Limiter Changes
| File | Change |
|------|--------|
| `ask-rate-limiter.service.ts` | NEW file — counter read/write/increment/reset |
| `types/index.ts` | Add `askMonthlyLimit?: number` to `AppPreferences` |
| `services/settings.service.ts` | Add `askMonthlyLimit: 0` to `defaultSettings.preferences` |
| `useQuestions.ts` | Add rate limit guard + increment at `askStreaming` |
| `AskScreen.tsx` | Add inline banner; pass `disabled` to `ChatInput` when limit hit |
| `SettingsScreen.tsx` | Rename "Token Usage" → "Usage"; add limit input row |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `classifyAndAnchor` call (all labels in one JSON) | 3-step incremental pipeline (branch → cluster → anchor) | Phase 23 | 2-3 KV cache hits per classification instead of 0 |
| No user-facing rate limiting | Monthly quota with hard block + 80% warning banner | Phase 23 | Cost control without per-question friction |
| "Token Usage" section in Settings | Renamed "Usage" section merging token + request count | Phase 23 | Single place to understand and manage LLM consumption |

---

## Open Questions

1. **Candidate extraction: how to handle the case where `allQuestions` has 0 non-fallback branch labels?**
   - What we know: `buildTreeContext()` returns "No existing branches or clusters yet." for empty graphs
   - What's unclear: Should step 1 skip the numbered list and just ask for a branch name when there are 0 candidates? Or present an empty list forcing NEW?
   - Recommendation: If `branches.length === 0`, the step-1 user message should present an empty list with a note "No existing branches yet — create a new one", and the response will always be `{"index":"NEW","name":"..."}`. This is well-defined and requires no special code path.

2. **Rate limit counter: increment on `askStreaming` return or on question save?**
   - What we know: `askStreaming` calls `questionService.buildAndSave()` internally; it returns the saved question
   - What's unclear: Should the increment happen when `buildAndSave` succeeds or when `askStreaming` returns the question?
   - Recommendation: Increment immediately after `buildAndSave` returns (before `filterQuestion` and `classifyAndAnchor`), since a question was actually persisted. Aborted streaming before save does not increment.

3. **`question.service.ts` ask() call to `classifyAndAnchor` (line 262) — is it still reachable?**
   - What we know: `AskScreen` uses `askStreaming` exclusively. The non-streaming `ask()` path is "available as a fallback but not invoked from this screen" (comment at top of AskScreen.tsx).
   - What's unclear: Whether any production path still calls `questionService.ask()` directly.
   - Recommendation: Update both call sites for consistency (D-17 says keep old code as fallback, not that we skip updating callers). Both `useQuestions.askStreaming` line 226 and `question.service.ts` line 262 should call `classifyAndAnchorIncremental`.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are TypeScript/localStorage, no new CLI tools, databases, or services required).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none (invoked via `npm test`) |
| Quick run command | `npm test` (from `/Users/Code/EchoLearn/app`) |
| Full suite command | `npm test` |

Note: The test runner currently fails with a module resolution error (`token-usage.service` not found) due to missing `.ts` extension in the import. This is a pre-existing issue in the test infrastructure, not introduced by Phase 23. New tests for this phase should use the same `.test.mjs` pattern as `canonical-knowledge.test.mjs`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | File |
|--------|----------|-----------|------|
| — | `parseStepResponse` returns correct `StepDecision` for valid index, NEW JSON, out-of-bounds, malformed | unit | `tests/services/canonical-knowledge-pipeline.test.mjs` — Wave 0 gap |
| — | `buildStepPrompt` includes correct level name and numbered candidates | unit | same file |
| — | Short-circuit: step 1 NEW skips steps 2 and 3 (mock chatCompletion) | unit | same file |
| — | Retry: step fails once → retried → succeeds | unit | same file |
| — | Retry: step fails twice → falls back to classifyAndAnchor | unit | same file |
| — | `getRateLimitStatus` returns `canAsk: false` when count >= limit | unit | `tests/services/ask-rate-limiter.test.mjs` — Wave 0 gap |
| — | `getRateLimitStatus` resets count when stored yearMonth != current | unit | same file |
| — | `incrementAskCount` increments and persists | unit | same file |
| — | Rate limit = 0 → unlimited (canAsk always true) | unit | same file |

### Sampling Rate
- **Per task commit:** `npm test` (from app/)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/canonical-knowledge-pipeline.test.mjs` — pipeline unit tests
- [ ] `tests/services/ask-rate-limiter.test.mjs` — rate limiter unit tests
- [ ] Pre-existing test runner module resolution issue should be noted but does not block new test files if they avoid the problematic import chains

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `app/src/services/canonical-knowledge.service.ts` lines 394–655 — current `classifyAndAnchor`, `buildTreeContext`, `buildReflectionTree`
- Direct code inspection: `app/src/providers/llm/index.ts` — `chatCompletion` interface, `ChatMessage` type, provider routing
- Direct code inspection: `app/src/state/useQuestions.ts` lines 80–243 — `askStreaming`, existing classification call site at line 226
- Direct code inspection: `app/src/screens/AskScreen.tsx` — `ChatInput` usage, `disabled` prop pattern
- Direct code inspection: `app/src/screens/SettingsScreen.tsx` lines 1125–1183 — existing "Token Usage" section
- Direct code inspection: `app/src/services/settings.service.ts` — `AppSettings` shape, `defaultSettings`, `getSync()`
- Direct code inspection: `app/src/types/index.ts` — `AppPreferences`, `AppSettings` interfaces
- CONTEXT.md decisions D-01 through D-19 — all locked design decisions

### Secondary (MEDIUM confidence)
- KV cache prefix reuse behavior: standard behavior documented by Anthropic and OpenAI for prompt caching — keeping system prompt stable and identical across calls is the universal recommendation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing code inspected directly; no new libraries
- Architecture: HIGH — all integration points identified by direct code reading, not inference
- Pitfalls: HIGH — derived from actual code patterns observed (lazy import, JSON extraction regex, message array mutation)
- Rate limiter design: HIGH — straightforward localStorage counter following established app patterns

**Research date:** 2026-04-09
**Valid until:** Stable (no external API dependencies; only internal code patterns)
