# Phase 29: Final polishment — Research

**Researched:** 2026-04-16
**Domain:** TypeScript / React / AbortController / Node 25 module resolution / UAT walkthrough protocol
**Confidence:** HIGH (all findings sourced from direct code reads of the files in question)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 4 separate plans: 29-01 (TD-01), 29-02 (TD-02+TD-03), 29-03 (tsc+Node25), 29-04 (UAT)
- **D-02:** Parallel execution — no strict ordering between plans; UAT runs on current `main`
- **D-03:** Inline-fix whatever walkthrough turns up; no size cap
- **D-04:** tsc scope = narrow + same-file siblings only (4 target files)
- **D-05:** Node 25 fix = add `.ts`/`.js` extensions to failing tests' intra-src import graphs
- **D-06:** PostDetailScreen abort triggers = LOCALE_CHANGED + unmount + timeout via `composeSignal`
- **D-07:** classifyAndAnchorIncremental = mid-step cancel; signal into every `chatCompletion` call
- **D-08:** Discard partial state on abort — no `patchPostEssayInCache` on abort; classify already safe
- **D-09:** Single `29-UAT-LOG.md` in phase directory
- **D-10:** Each walkthrough-surfaced fix = one separate git commit with `fix(29-04): …` message
- **D-11:** Done when all 4 plan VERIFICATIONs pass + all UAT items resolved + walkthrough-surfaced fixes resolved
- **D-12:** Fix TD-01 at both call sites: `plannerAutoGen.service.ts:115` and `concept-feed.service.ts:759`
- **D-13:** No new helper / no caching / no refactor — 2-line change per call site
- **D-14:** Timeout value = existing LLM provider `timeoutMs` from settings (not a new constant)
- **D-15:** Thread signal: `PostDetailScreen` → `post-essay.service.ts:generatePostEssay`/`generateEssayMeta` → `chatStream`/`chatCompletion`
- **D-16:** Shared `AbortController` for `streamingBody` + post-stream `generateEssayMeta` (one per essay effect)
- **D-17:** Optional `signal?: AbortSignal` on `classifyAndAnchorIncremental` and `runStepWithRetry` — default `undefined`; `classifyAndAnchor` signature UNCHANGED
- **D-18:** `useQuestions.ts:273` reuses existing `abortController.signal`; `question.service.ts:262` accepts optional signal from callers
- **D-19:** Do NOT introduce Node loader config or `tsconfig moduleResolution` workaround
- **D-20:** Regression gate: all 43 Phase 27 tests still pass + 5 previously-failing tests now pass + 4 target files compile clean
- **D-21:** After UAT, flip archived VERIFICATION.md `status` → `passed` + add `re_verification` block pointing to `29-UAT-LOG.md`
- **D-22:** Operator executes walkthrough, Claude records in `29-UAT-LOG.md` in real time
- **D-23:** UAT skip list: Phase 22 items 4+5 (animated tap-to-jump — reverted); Phase 21 items 3+4 (REVIEW-03/04 — descoped)

### Claude's Discretion

- Plan subagent spawning pattern for 29-04 (checkpoint-heavy single wave vs two-part)
- Error message copy for aborted post essay (no toast required by default; adding `t('posts.detail.streamAborted')` allowed if useful, with all 4 bundles updated)
- 29-03 file ordering (tsc first vs Node 25 first)

### Deferred Ideas (OUT OF SCOPE)

- 23-05 DEDUP plan (symmetric labelKey + NEW→existing coercion)
- Broader tsc/Node 25 cleanup beyond 4 target files and their same-file sibling errors
- Node loader config / tsconfig `moduleResolution` tweak
- Per-phase UAT log files
- `useAbortOnLocaleChange` custom hook extraction
- UAT screenshots (optional; if captured, `.planning/phases/29-final-polishment/uat-screenshots/`)

</user_constraints>

---

## Summary

Phase 29 closes all v1.3 milestone-audit tech debt across four bounded plans. Plans 29-01 and 29-02 are pure code changes (2-line fix + full AbortController plumbing respectively). Plan 29-03 fixes pre-existing tsc type errors in 4 files and adds `.ts` extensions to the import chains of 5 failing Node 25 tests. Plan 29-04 is an operator-driven UAT walkthrough against 21 items (after applying the D-23 skip list), recording results in a flat log and updating archived VERIFICATION.md frontmatter upon completion.

**Primary recommendation:** Execute 29-01 and 29-02 first (pure code, testable immediately), then 29-03 (structural cleanup), then 29-04 (operator walkthrough runs independently on current `main`). All four can be parallelized per D-02.

---

## Plan 29-01 Deep Dive — TD-01: Curiosity-Signal Wiring

### Current state (confirmed by code read)

**`app/src/services/plannerAutoGen.service.ts:115`:**
```typescript
// CURRENT — line 114-115
const signals = trajectoryAnalyzerService.aggregateSignals(forceRefresh);
const hints = defaultStrategy.computeHints(signals);
```
`plannerService` is imported at line 16 but only used for `plannerService.getAll()` (line 85) and `plannerService.createChunk()` (line 173). `getRecentSignals()` is never called in this file.

**`app/src/services/concept-feed.service.ts:759`:**
```typescript
// CURRENT — in applyStrategyBias() at lines 758-770
function applyStrategyBias(posts: DailyPost[]): DailyPost[] {
  try {
    const signals = trajectoryAnalyzerService.aggregateSignals();
    const hints = defaultStrategy.computeHints(signals);   // <-- line 759: no checkInSignals
    ...
  }
}
```
**NOTE:** `concept-feed.service.ts` ALREADY calls `plannerService.getRecentSignals()` at line 251 (used for `PlannerSignals` feed context), so `plannerService` is imported AND `getRecentSignals()` is available in scope — no new import needed. The fix in this file is strictly the `computeHints` call inside `applyStrategyBias`.

### `computeHints` signature (confirmed)

`app/src/services/orchestration-strategy.service.ts:35`:
```typescript
computeHints(signals: TrajectorySignal, checkInSignals?: CheckInSignals): StrategyHints
```
`checkInSignals?.curiosity ?? []` — if `checkInSignals` is `undefined`, `curiosityTopics` defaults to `[]`. No null-deref risk when omitted. The optional param is fully safe.

### `plannerService.getRecentSignals()` signature (confirmed)

`app/src/services/planner.service.ts:600`:
```typescript
getRecentSignals(maxAge: number = 7 * 24 * 60 * 60 * 1000): CheckInSignals
```
Pure synchronous localStorage read. Returns `{ confidence, confusion, connections, curiosity, revisitIntent }`. No async, no LLM call.

### Before/After — plannerAutoGen.service.ts

```typescript
// BEFORE (line 114-115)
const signals = trajectoryAnalyzerService.aggregateSignals(forceRefresh);
const hints = defaultStrategy.computeHints(signals);

// AFTER (line 114-116, 2-line change per D-13)
const signals = trajectoryAnalyzerService.aggregateSignals(forceRefresh);
const checkInSignals = plannerService.getRecentSignals();
const hints = defaultStrategy.computeHints(signals, checkInSignals);
```
No import change needed — `plannerService` is already imported at line 16.

### Before/After — concept-feed.service.ts

```typescript
// BEFORE (inside applyStrategyBias, ~line 758-760)
const signals = trajectoryAnalyzerService.aggregateSignals();
const hints = defaultStrategy.computeHints(signals);

// AFTER
const signals = trajectoryAnalyzerService.aggregateSignals();
const checkInSignals = plannerService.getRecentSignals();
const hints = defaultStrategy.computeHints(signals, checkInSignals);
```
No import change needed — `plannerService` is already imported at line 6.

### Test strategy for 29-01

**Existing test file:** `app/tests/services/orchestration-strategy.test.mjs` (8 tests, all passing).

**What to add:** A single new test verifying that when `checkInSignals.curiosity` is non-empty, `hints.curiosityTopics` contains those entries. This is already testable with pure data (no mocks needed):

```javascript
// New test to add to orchestration-strategy.test.mjs
test('computeHints populates curiosityTopics from checkInSignals', () => {
  const signals = { /* minimal valid TrajectorySignal */ };
  const checkInSignals = { curiosity: ['quantum computing', 'neural nets'], confidence: [], confusion: [], connections: [], revisitIntent: [] };
  const hints = defaultStrategy.computeHints(signals, checkInSignals);
  assert.deepEqual(hints.curiosityTopics, ['quantum computing', 'neural nets']);
});
```

**Static-grep plumbing test** (mirrors Phase 27 D-22 style): assert that both call sites in the source files pass `checkInSignals` to `computeHints`.

### Acceptance criteria for 29-01

1. `plannerAutoGen.service.ts:generateAndStoreSuggestions` calls `plannerService.getRecentSignals()` and passes the result to `computeHints`.
2. `concept-feed.service.ts:applyStrategyBias` calls `plannerService.getRecentSignals()` and passes the result to `computeHints`.
3. All existing 8 orchestration-strategy tests still pass.
4. New test for `curiosityTopics` population passes.
5. `tsc -b --noEmit` on both modified files: no new errors.
6. `vite build` stays green.

---

## Plan 29-02 Deep Dive — TD-02 + TD-03: AbortSignal Plumbing

### House pattern reference (Phase 27 D-22)

**Canonical: `app/src/state/useQuestions.ts:120-123`**
```typescript
// ONE controller per askStreaming call — declared BEFORE try block
const abortController = new AbortController();
const unsubLocale = eventBus.subscribe('LOCALE_CHANGED', () => {
  abortController.abort(new DOMException('Locale changed', 'AbortError'));
});
```
Key invariants from `useQuestions-locale-abort.test.mjs`:
- AbortController declared before `try`
- `unsubLocale` called in `finally` (not `return ()`)
- Same `abortController.signal` passed to BOTH streaming passes (Pass 1 + Pass 2)
- At least 3 `aborted`-check guards (loop entry, pre-buildAndSave, catch)
- `composeSignal` used inside the provider, NOT in the caller

**Cleanup order (confirmed from useQuestions.ts):** `finally { unsubLocale(); }` — event-bus unsubscribe happens in `finally`, AFTER abort (which fires via the subscription callback). The `AbortController` itself does not need explicit teardown.

### `composeSignal` helper (confirmed)

`app/src/providers/llm/index.ts:35-46`:
```typescript
function composeSignal(callerSignal: AbortSignal | undefined, ms: number): AbortSignal
```
- Composes caller signal + timeout signal
- Uses `AbortSignal.any` if available (Chromium 116+ / Safari 17.4+ / Node 20+), manual forwarder fallback
- Already threaded into all 7 fetch call sites in the LLM provider
- `callerSignal` is the raw `AbortController.signal` from the caller; provider composes it internally

For D-14: `settingsService.getSync().llm.timeoutMs` — check if this field exists. If not, use the provider's internal `COMPLETION_TIMEOUT_MS = 60_000`. The `CompletionOptions` object is how callers pass the signal:
```typescript
{ serviceName: 'posts', signal: abortController.signal }
```

### TD-02: PostDetailScreen current state (confirmed)

**`app/src/screens/PostDetailScreen.tsx:166-258`** (on-enter essay effect):
- Line 172: `let aborted = false;` — local boolean, NOT an AbortController
- Line 257: `return () => { aborted = true; };` — cleanup only sets the boolean on unmount
- Line 192, 202, 207: `if (aborted) return;` guards mid-stream iteration
- Line 216: `const meta = await generateEssayMeta(post, accumulated);` — NOT guarded by abort
- Line 235: `patchPostEssayInCache(post.id, essay);` — called after successful completion
- Line 250: `if (!aborted) { setOnEnterError(...) }` — error path
- Lines 185-211: Three different streaming paths: `generateConnectionPost`, `generateDiscoverPost`, `generatePostEssay` — all three need signal threading
- **No LOCALE_CHANGED subscription.** No timeout signal.

**`app/src/services/post-essay.service.ts`** (confirmed):
- `generatePostEssay(post, questions): AsyncGenerator<string>` — no signal param (line 23)
- `generateEssayMeta(post, bodyMarkdown): Promise<...>` — no signal param (line 39)
- `generateStandardEssay` at line 84: `yield* chatStream([...], settings.llm, { serviceName: 'posts' })` — NO signal
- `generateVideoEssay` at line 113: same pattern
- `generateNewsEssay` at line 134: same pattern
- `generateTextArtEssay` at line 157: same pattern
- `generateEssayMeta` at line 42: `await chatCompletion([...], settings.llm, { serviceName: 'posts' })` — NO signal

**`conceptFeedService.generateConnectionPost`** and **`generateDiscoverPost`** — these also yield via `chatStream`. They need signal threading too if D-06 is to cover all three branches in the essay effect. Check if D-15 scope covers these (the CONTEXT.md says `post-essay.service.ts:generatePostEssay / generateEssayMeta` explicitly, but the connection/discover paths also stream in the same effect). **Planner judgment needed:** connection/discover paths should get the same signal for consistency, but D-15 only names `post-essay.service.ts`. At minimum the `generatePostEssay` branch (line 206) and `generateEssayMeta` (line 216) must receive the signal per D-15/D-16.

### TD-02: After state (how to implement)

```typescript
// PostDetailScreen.tsx — on-enter essay effect, AFTER

useEffect(() => {
  if (!post) return;
  if (post.bodyMarkdown && post.bodyMarkdown.trim() !== '') return;
  if (post.sourceType === 'short') return;

  // D-06: ONE controller for both streamingBody + generateEssayMeta (D-16)
  const abortController = new AbortController();
  const unsubLocale = eventBus.subscribe('LOCALE_CHANGED', () => {
    abortController.abort(new DOMException('Locale changed', 'AbortError'));
  });

  setIsStreamingOnEnter(true);
  setOnEnterError(null);
  setStreamingBody('');
  setOnEnterMeta(null);

  void (async () => {
    let accumulated = '';
    try {
      // ... existing branch logic for connection/discover/standard ...
      // Each branch passes { signal: abortController.signal } to the streaming calls
      
      for await (const chunk of generatePostEssay(post, questionsRef.current, { signal: abortController.signal })) {
        if (abortController.signal.aborted) return;
        accumulated += chunk;
        setStreamingBody(accumulated);
      }

      if (abortController.signal.aborted) return; // D-08: discard — no persist

      // generateEssayMeta shares same signal (D-16)
      const meta = await generateEssayMeta(post, accumulated, { signal: abortController.signal });
      if (abortController.signal.aborted) return; // D-08

      const essay: EssayContent = { bodyMarkdown: accumulated, ...meta };
      // patchPostEssayInCache only reached if not aborted (D-08 satisfied)
      patchPostEssayInCache(post.id, essay);
      // ... rest of save logic ...
    } catch (err) {
      if (abortController.signal.aborted) return; // clean cancel — no error toast
      if (!abortController.signal.aborted) {
        setOnEnterError(err instanceof Error ? err.message : i18n.t('posts.detail.generationFailedFallback'));
      }
    } finally {
      if (!abortController.signal.aborted) setIsStreamingOnEnter(false);
      else setIsStreamingOnEnter(false); // always clear streaming indicator
      unsubLocale(); // D-06: cleanup subscription regardless of path
    }
  })();

  return () => {
    abortController.abort(); // unmount trigger (D-06)
    // unsubLocale already cleaned up in finally, but if effect cleanup runs
    // before the async IIFE completes, unsubLocale() may be called twice —
    // event-bus subscribe() returns a callable that is idempotent on second call.
  };
}, [post?.id, post?.bodyMarkdown]);
```

**IMPORTANT:** The `finally { unsubLocale(); }` and the cleanup `return () => { abortController.abort(); }` can both run. The event-bus `subscribe()` returns an unsubscribe function — verify it is idempotent (safe to call twice). If not, use a flag.

**D-14 timeout:** Read `settingsService.getSync().llm.timeoutMs` inside the effect. If `undefined`, fall back to `60_000`. Pass as `{ signal: abortController.signal }` — the `composeSignal` helper in the LLM provider already adds the timeout signal internally. The caller only needs to supply the abort signal; the provider composes the timeout.

### Signature changes for post-essay.service.ts

```typescript
// BEFORE
export async function* generatePostEssay(post: DailyPost, questions: Question[]): AsyncGenerator<string>
export async function generateEssayMeta(post: DailyPost, bodyMarkdown: string): Promise<...>

// AFTER
export interface EssayOptions { signal?: AbortSignal; }

export async function* generatePostEssay(post: DailyPost, questions: Question[], options?: EssayOptions): AsyncGenerator<string>
export async function generateEssayMeta(post: DailyPost, bodyMarkdown: string, options?: EssayOptions): Promise<...>
```

Each internal dispatch function (`generateStandardEssay`, `generateVideoEssay`, `generateNewsEssay`, `generateTextArtEssay`) gains optional `options?: EssayOptions` param and passes `{ serviceName: '...', signal: options?.signal }` to `chatStream` / `chatCompletion`.

### TD-03: classifyAndAnchorIncremental current state (confirmed)

**`app/src/services/canonical-knowledge.service.ts:720-840`:**

`runStepWithRetry` at line 720:
```typescript
async function runStepWithRetry(
  messages: PipelineMessage[],
  candidateCount: number,
  llmConfig: LLMConfig,
): Promise<{ decision: StepDecision; rawResponse: string }>
```
Each attempt calls:
```typescript
const raw = await chatCompletion(messages, llmConfig, { serviceName: 'classification', maxTokens: 100 });
```
No signal.

`classifyAndAnchorIncremental` at line 742:
```typescript
export async function classifyAndAnchorIncremental(
  question: Question,
  allQuestions: Question[],
  llmConfig: LLMConfig,
): Promise<void>
```
Three `runStepWithRetry` calls at lines 767, 790, 810.

**`classifyAndAnchor` at line 848** — D-17: signature MUST NOT CHANGE.

### TD-03: Signature changes

```typescript
// runStepWithRetry — add optional signal param
async function runStepWithRetry(
  messages: PipelineMessage[],
  candidateCount: number,
  llmConfig: LLMConfig,
  signal?: AbortSignal,  // NEW — optional per D-17
): Promise<{ decision: StepDecision; rawResponse: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await chatCompletion(
        messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        llmConfig,
        { serviceName: 'classification', maxTokens: 100, signal },  // NEW: pass signal
      );
      ...
    }
  }
}

// classifyAndAnchorIncremental — add optional signal param
export async function classifyAndAnchorIncremental(
  question: Question,
  allQuestions: Question[],
  llmConfig: LLMConfig,
  signal?: AbortSignal,  // NEW — optional per D-17
): Promise<void> {
  // ... pass signal to every runStepWithRetry call ...
  step1 = await runStepWithRetry(messages, branches.length, llmConfig, signal);
  step2 = await runStepWithRetry(messages, clusters.length, llmConfig, signal);
  step3 = await runStepWithRetry(messages, anchors.length, llmConfig, signal);
}
```

### TD-03: Call sites (D-18)

**`app/src/state/useQuestions.ts:273`** — existing `abortController.signal` already in scope:
```typescript
// BEFORE
void classifyAndAnchorIncremental(question, questionService.getAll(), llmConfig).catch(...)

// AFTER
void classifyAndAnchorIncremental(question, questionService.getAll(), llmConfig, abortController.signal).catch(...)
```

**`app/src/services/question.service.ts:262`** — fire-and-forget classification call inside `filterQuestion` path. The caller context is a service method with no AbortController in scope. Per D-18, `question.service.ts` should accept an optional signal from its callers:
```typescript
// question.service.ts filterQuestion-using method signature change
// Find the enclosing method at line ~240 and add optional signal param
// Then pass it to classifyAndAnchorIncremental at line 263
void classifyAndAnchorIncremental(flagged, loadStore({ includeFlagged: true }), llmConfig, signal).catch(...)
```
The callers of this `question.service.ts` method must also pass the signal — trace the call chain upward to find where to thread from.

**IMPORTANT for planner:** Read lines 220-270 of `question.service.ts` to confirm the exact method name and param list before modifying. The code at line 262 is inside a method that may be called from outside — its signature change must be backward-compatible (optional param).

### Cleanup ordering (confirmed)

From `useQuestions.ts` pattern:
1. `LOCALE_CHANGED` event fires → `abortController.abort()` called synchronously
2. In-flight `chatStream`/`chatCompletion` fetch aborts within ~100ms (signal propagated by `composeSignal`)
3. `finally { unsubLocale(); }` — cleans up the subscription

For PostDetailScreen:
1. Same pattern but effect cleanup `return () => { abortController.abort(); }` handles unmount
2. The LOCALE_CHANGED subscriber calls `abortController.abort()` for locale-switch abort
3. `finally { unsubLocale(); }` inside the async IIFE handles cleanup
4. Double-abort is safe (AbortController ignores subsequent `abort()` calls)
5. `unsubLocale()` called twice (from `finally` + potentially from cleanup) — verify idempotence

### Test strategy for 29-02

**Template:** `app/tests/state/useQuestions-locale-abort.test.mjs` — mix of static-grep plumbing proofs + one behavioral stubbed-async-iterator test.

**For PostDetailScreen (TD-02):**
New test file: `app/tests/screens/post-detail-abort.test.mjs`

Static-grep tests (4 assertions):
1. `PostDetailScreen.tsx` contains `new AbortController()`
2. `PostDetailScreen.tsx` subscribes to `LOCALE_CHANGED` and calls `abortController.abort`
3. `PostDetailScreen.tsx` passes `signal:` to `generatePostEssay` call
4. `PostDetailScreen.tsx` passes `signal:` to `generateEssayMeta` call
5. `post-essay.service.ts` accepts `options?.signal` parameter on `generatePostEssay`
6. `post-essay.service.ts` passes `signal` to `chatStream` in all 4 generator functions

Behavioral test — mock `chatStream` never-resolves + fire `LOCALE_CHANGED`:
```javascript
test('PostDetailScreen aborts essay stream on LOCALE_CHANGED', async () => {
  // Static-only: verify abort guard is at correct position
  // (no DOM available — use static-grep to assert return-on-aborted pattern)
});
```

**For classifyAndAnchorIncremental (TD-03):**
New test in `app/tests/canonical-knowledge-pipeline.test.mjs` (or new file):

Static-grep tests:
1. `runStepWithRetry` accepts `signal?: AbortSignal` param
2. All 3 `runStepWithRetry` call sites in `classifyAndAnchorIncremental` pass the signal
3. `chatCompletion` call inside `runStepWithRetry` includes `signal` in options

Behavioral test:
```javascript
test('runStepWithRetry propagates AbortError from aborted signal', async () => {
  const ac = new AbortController();
  ac.abort(new DOMException('test abort', 'AbortError'));
  // mock chatCompletion to check that signal.aborted → throw
  // verify that AbortError propagates out of runStepWithRetry
});
```

### Acceptance criteria for 29-02

1. `PostDetailScreen.tsx` creates `AbortController` before IIFE, subscribes to `LOCALE_CHANGED`, and cleans up in `finally`.
2. `generatePostEssay`, `generateEssayMeta` each accept `options?: { signal?: AbortSignal }`.
3. All 4 internal generators in `post-essay.service.ts` pass `signal` to `chatStream`/`chatCompletion`.
4. On abort (LOCALE_CHANGED or unmount), `patchPostEssayInCache` is NOT called (D-08).
5. `classifyAndAnchorIncremental` accepts optional `signal?: AbortSignal`.
6. `runStepWithRetry` passes `signal` to `chatCompletion`.
7. `useQuestions.ts:273` passes `abortController.signal` to `classifyAndAnchorIncremental`.
8. `question.service.ts` call site threads signal through (optional param, backward-compatible).
9. Static-grep tests for all plumbing assertions pass.
10. No regression in existing `useQuestions-locale-abort.test.mjs` (4 tests).

---

## Plan 29-03 Deep Dive — tsc + Node 25 Cleanup

### tsc errors (confirmed from deferred-items.md)

**File 1: `app/src/screens/GraphScreen.tsx`**
- Line 6: `'ArrowLeft' is declared but its value is never read` (TS6133)
  - Fix: Remove `ArrowLeft` from line 7 import: `import { RefreshCw, GitBranch, X, ChevronRight, FoldVertical, UnfoldVertical } from 'lucide-react';`
- Line 476: `"GRAPH_UPDATED"` not assignable to `AppEvent` union (TS2345)
  - Root cause: `GRAPH_UPDATED` is emitted at `canonical-knowledge.service.ts:710` and subscribed at `GraphScreen.tsx:480`, but `GRAPH_UPDATED` is NOT in the `AppEvent` union in `types/index.ts`.
  - Fix A: Add `| { type: 'GRAPH_UPDATED' }` to the `AppEvent` union in `types/index.ts` (line ~678)
  - Fix B: Add the same member anywhere `canonical-knowledge.service.ts` emits it (line 710)
  - These are same-file siblings of the original error target — D-04 allows fixing them.

**File 2: `app/src/services/canonical-knowledge.service.ts`**
- Line 710: `"GRAPH_UPDATED"` not assignable to `AppEvent` (TS2322) — same root cause as above; fixed by adding `GRAPH_UPDATED` to the `AppEvent` union.
- Line 1355: `"COVERAGE_ERROR"` not assignable to `ErrorCode` (TS2322)
  - Root cause: `ErrorCode` union in `types/index.ts:618-633` does not contain `'COVERAGE_ERROR'`
  - Fix: Add `| 'COVERAGE_ERROR'` to the `ErrorCode` union in `types/index.ts` (line ~633)

**File 3: `app/src/services/review.service.ts`**
- Line 73: `Property 'anchorId' does not exist on type 'Question'` (TS2339)
  - Root cause: `Question` has `parentId` (line 14) but not `anchorId`. The code uses `q?.anchorId ?? q?.parentId` — the `anchorId` part is dead and triggers the error.
  - Fix: Change line 73 to `resolvedAnchorId = q?.parentId;` (drop the `q?.anchorId` reference entirely — it's the fallback value anyway)

**File 4: `app/src/services/trellis-state.service.ts`**
- Line 1: `FlashCard` declared but never used (TS6196)
  - Fix: Remove `FlashCard` from line 1 import: `import type { Question, ReviewSchedule } from '../types/index.ts';`
- Line 94: `ALL_LEAF_STATES` declared but its value is never read (TS6133)
  - Fix: Either remove the const entirely or prefix with `// eslint-disable-next-line` — but since tsc flags it, safest is removal if it's not used anywhere else.
  - Verify: grep for `ALL_LEAF_STATES` in the file — if only defined once and not used, delete.
- Line 140: Conversion cast error — mock `Question` missing `timestamp/date/answer/summary` fields (TS2352)
  - Root cause: the `as Question` cast on line 140 is invalid because the object literal omits required fields (`timestamp`, `date`, `answer`, `summary`).
  - Fix: Add the missing required fields to the mock object OR change `as Question` to `as unknown as Question` (which suppresses but acknowledges the cast). Preferred: add the missing fields to align with the canonical `makeQuestion` pattern used in tests.

**Summary of type changes in `types/index.ts` (same-file siblings):**
- Add `| { type: 'GRAPH_UPDATED' }` to `AppEvent` union (~line 678, after `NEWS_POSTS_READY`)
- Add `| 'COVERAGE_ERROR'` to `ErrorCode` union (~line 633, after `'REVERT_ERROR'`)

### Node 25 ERR_MODULE_NOT_FOUND — failing tests and import chains

Node 25 native TypeScript stripping does NOT resolve extension-less imports. Every intra-`src/` import must have an explicit `.ts` extension.

**Root cause chain:** The LLM provider (`providers/llm/index.ts`) imports `token-usage.service` WITHOUT `.ts`:
```typescript
// line 3 — MISSING .ts
import { tokenUsageReporter, type UsageMetadata } from '../../services/token-usage.service';
```
And `./locale-directive` without `.ts`:
```typescript
// line 4 — MISSING .ts  
import { applyLocaleDirective } from './locale-directive';
```

Any test that transitively imports `providers/llm/index.ts` fails.

**Test 1: `app/tests/canonical-knowledge-pipeline.test.mjs`**
Chain: `canonical-knowledge.service.ts` → `providers/llm/index.ts` → `token-usage.service` (NO .ts), `./locale-directive` (NO .ts)
Fix: Add `.ts` to `providers/llm/index.ts` lines 3 and 4.

**Test 2: `app/tests/canonical-knowledge.test.mjs`**
Same chain.

**Test 3: `app/tests/reorg-json-parser.test.mjs`**
Same chain.

**Test 4: `app/tests/concept-feed.test.mjs`**
Chain: `concept-feed.service.ts` imports (all missing `.ts`):
- `./youtube.service` (line 8)
- `./news.service` (line 9)
- `./web-search.service` (line 10)
- `./orchestration-strategy.service` (line 11)
- `./trajectoryAnalyzer.service` (line 12)
- `./question.service` (line 13)

And `youtube.service.ts` itself imports:
- `'../lib/date'` (line 3 — missing `.ts`)
- `'./settings.service'` (line 4 — missing `.ts`)
- `'../providers/llm/index'` (line 5 — missing `.ts` AND `.ts` extension on the target)

And `news.service.ts` imports:
- `./web-search.service` (missing .ts)
- `./settings.service` (missing .ts)
- `./question.service` (missing .ts)
- `../lib/date` (missing .ts)
- `../lib/event-bus` (missing .ts)

And `trajectoryAnalyzer.service.ts` imports:
- `./question.service` (missing .ts)
- `./flashcard.service` (missing .ts)

And `flashcard.service.ts` imports:
- `../lib/date` (missing .ts)
- `../lib/event-bus` (missing .ts)
- `../lib/toast` (missing .ts)
- `../locales` (missing `/index.ts`)

The `locales/index.ts` imports:
- `'../lib/locale'` (missing .ts)
- `'../services/settings.service'` (missing .ts)

**Test 5: `app/tests/services/web-search.test.mjs`**
Chain: `web-search.service.ts` → `./settings.service` (line 8 — missing `.ts`)

### File-by-file change list for Node 25 fixes

**Files to edit** (add `.ts` to extension-less intra-`src/` imports):

| File | Lines to change | What to add |
|------|----------------|-------------|
| `app/src/providers/llm/index.ts` | line 3: `token-usage.service` → `token-usage.service.ts`; line 4: `./locale-directive` → `./locale-directive.ts` | 2 lines |
| `app/src/services/concept-feed.service.ts` | lines 8-13: add `.ts` to 6 service imports | 6 lines |
| `app/src/services/youtube.service.ts` | lines 3,4,5: `../lib/date` → `.ts`, `settings.service` → `.ts`, `../providers/llm/index` → `/index.ts` | 3 lines |
| `app/src/services/news.service.ts` | lines 11-15: add `.ts` to 5 imports | 5 lines |
| `app/src/services/web-search.service.ts` | line 8: `settings.service` → `settings.service.ts` | 1 line |
| `app/src/services/trajectoryAnalyzer.service.ts` | lines 10-11: `question.service` → `.ts`, `flashcard.service` → `.ts` | 2 lines |
| `app/src/services/flashcard.service.ts` | lines 2-5: `../lib/date` → `.ts`, `../lib/event-bus` → `.ts`, `../lib/toast` → `.ts`, `../locales` → `../locales/index.ts` | 4 lines |
| `app/src/locales/index.ts` | lines 7-8: `'../lib/locale'` → `.ts`, `'../services/settings.service'` → `.ts` | 2 lines |

**NOTE for planner:** Run `node --test app/tests/canonical-knowledge-pipeline.test.mjs` after fixing `providers/llm/index.ts` to see if the canonical-knowledge tests resolve. The concept-feed chain is deeper and requires more files. Fix files in dependency order (deepest-first): `providers/llm/index.ts` → `settings.service.ts` (none needed) → then the services that import from it.

**Also check:** `question.service.ts` extension-less imports — read confirmed it has no extension-less intra-src imports. `orchestration-strategy.service.ts` — confirmed no extension-less intra-src imports.

### tsconfig.json — relevant flags

No `verbatimModuleSyntax` or `moduleResolution: NodeNext` that would conflict with adding extensions. The project already uses explicit `.ts` extensions in many files (e.g., `concept-feed.service.ts` imports `'./settings.service.ts'` at line 5 with `.ts`, but imports `'./youtube.service'` at line 8 without it). The fix is consistent: make all intra-src imports explicit.

### Acceptance criteria for 29-03

1. `node --test app/tests/canonical-knowledge-pipeline.test.mjs` — PASS (was ERR_MODULE_NOT_FOUND)
2. `node --test app/tests/canonical-knowledge.test.mjs` — PASS
3. `node --test app/tests/reorg-json-parser.test.mjs` — PASS
4. `node --test app/tests/concept-feed.test.mjs` — PASS
5. `node --test app/tests/services/web-search.test.mjs` — PASS
6. All 43 existing Phase 27 locale tests still pass: `node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` (2 tests) + all other Phase 27 test files
7. `tsc -b --noEmit` on the 4 target files: no errors in `GraphScreen.tsx`, `canonical-knowledge.service.ts`, `review.service.ts`, `trellis-state.service.ts`
8. No NEW tsc errors introduced in `types/index.ts` by the two union additions
9. `vite build` stays green

---

## Plan 29-04 Deep Dive — UAT Walkthrough

### Consolidated UAT item count (D-23 skip list applied)

**Phase 20 — 4 items (no skips)**
| Item | Test (abbreviated) | Why Human |
|------|--------------------|-----------|
| 20-UAT-1 | Portal card layout: colored border + 3 tappable indicators with counts | Visual layout |
| 20-UAT-2 | Diagnostic chat: multi-turn (submit → follow-up → reply → Done) | Live LLM required |
| 20-UAT-3 | Portal card indicator navigation (flashcard → /review, post → /posts/:id, Q → /ask/:id) | Routing |
| 20-UAT-4 | Portal card primary CTA navigateToMove routing | Navigation runtime |

**Phase 21 — 5 items, but items 3+4 SKIPPED per D-23 (REVIEW-03/04 descoped)**
- Item 1: Feed load time (<3s, card-face-only posts)
- Item 2: On-enter streaming UX (UI shell immediate, essay streams with no layout shift)
- ~~Item 3: Daily goal progress bar~~ SKIP (REVIEW-03 descoped)
- ~~Item 4: Settings label "Daily Goal"~~ SKIP (REVIEW-04 descoped)
- Item 5: Video/news posts stream summaries on-enter

Actually the 21-VERIFICATION.md frontmatter lists 5 items. Items 3 and 4 in D-23 refer to REVIEW-03/04. Looking at the frontmatter: item 3 is "daily goal progress bar updates" (REVIEW-03) and item 4 is "Video/news posts stream" (but wait — item 4 in the frontmatter is REVIEW-03 being N/A). Recount from the frontmatter `human_verification` list:
1. Feed loads <3s
2. Opening a post shows streaming essay with no layout shift
3. Re-visiting a post loads cached essay instantly
4. Daily goal progress bar — **ALREADY marked as descoped in 21-VERIFICATION.md** (`expected: "N/A -- daily goal progress bar was removed..."`)
5. Video/news posts stream summaries on-enter

D-23 says skip "Phase 21 items 3 and 4 for REVIEW-03/REVIEW-04". Item 4 is the daily goal bar (already marked N/A in the VERIFICATION file). Item 3 is cache-hit on re-visit — this does NOT map to REVIEW-03/04. Re-reading: the CONTEXT.md D-23 says "Phase 21 items 3 and 4 for REVIEW-03/REVIEW-04 (daily goal bar + label rename)".

Looking at the 21-VERIFICATION.md frontmatter again:
- Item 1: Feed load time → keep
- Item 2: Streaming UX → keep
- Item 3: Cache hit on re-visit → keep (this is POST behavior, not REVIEW-03)
- Item 4: Daily goal progress bar → SKIP (already marked N/A in VERIFICATION)
- Item 5: Video/news streaming → keep

**D-23 "Phase 21 items 3 and 4"** maps to the `human_verification` list numbering (1-indexed). Item 3 = "Re-visiting a post loads cached essay instantly" and item 4 = "Daily goal progress bar". BUT the CONTEXT says "items 3 and 4 for REVIEW-03/REVIEW-04". Cache hit is POST-04, not REVIEW. This is ambiguous.

**Resolution:** The CONTEXT.md is authoritative. It says skip "REVIEW-03/REVIEW-04 (daily goal bar + label rename)" — these are the REVIEW requirements, not the UAT item numbers. The daily goal bar item is item 4 in the frontmatter; the label rename (REVIEW-04) is implicit in the same descoped group. Item 3 (cache hit) is POST-04, not REVIEW — keep it.

**Phase 21 net: 4 items to test** (items 1, 2, 3, 5 from the frontmatter).

**Phase 22 — 11 items in frontmatter, but 2 have addendum notes; items 4+5 SKIPPED per D-23**
The 22-VERIFICATION.md lists 11 items in frontmatter (the original 9 + 2 that were reverted). Items 4 and 5 in the frontmatter are the animated tab-tap and non-adjacent slide tests — both explicitly struck through in the addendum with "REVERTED 2026-04-15".

Items to test (skipping 4+5):
- Item 1: Bottom nav real-time tracking
- Item 2: Rubber-band edge resistance
- Item 3: Snap-back on short swipe (<20%)
- ~~Item 4: Tab tap slide animation~~ SKIP
- ~~Item 5: Non-adjacent tab tap direct slide~~ SKIP
- Item 6: PostCarousel swipe conflict suppression
- Item 7: MindElixir pan conflict suppression
- Item 8: Keyboard-open swipe suppression
- Item 9: GraphScreen visible on first swipe
- Item 10: Sub-screen swipe disabled
- Item 11: Scroll position preservation

**Phase 22 net: 9 items** (items 1,2,3,6,7,8,9,10,11).

**Phase 26 — 7 items (no skips)**
| Item | Test |
|------|------|
| 26-UAT-1 | Harvest animation: fly-to-counter + confetti |
| 26-UAT-2 | Fruit column glow when count > 0 |
| 26-UAT-3 | Heal flow: dying anchor row tap → podcast add + /review navigation |
| 26-UAT-4 | Re-plant flow: dead anchor row tap → schedule reset + post generation + toast + /review |
| 26-UAT-5 | Prune button: scissors → archive + PrunedSection appearance + stopPropagation |
| 26-UAT-6 | Suggested Moves priority ordering (dead first, dying second, autoGen third) |
| 26-UAT-7 | AutoGen dedup: same anchor not in both trellis rows and autoGen |

**GRAND TOTAL: 4 + 4 + 9 + 7 = 24 items to test** (not 25; the discrepancy is Phase 21 item 4 being already marked N/A and Phase 21 having 4 not 5 active items).

**Note to planner:** Original CONTEXT.md D-11 says "all 25 original UAT items". The 25 comes from 4+5+9+7=25 before any skips. After D-23 skips: Phase 21 -1 (daily goal), Phase 22 -2 (items 4+5) = 25-3 = **22 items**. The math in the additional_context "GRAND TOTAL: 21 items" may differ based on how Phase 21 item 3 (cache hit) is counted. **Use 22 as the working count** and note it in the UAT log header.

### `29-UAT-LOG.md` table schema (D-09)

Location: `.planning/phases/29-final-polishment/29-UAT-LOG.md`

```markdown
# 29 UAT Log

**Phase:** 29-final-polishment
**Operator:** [name]
**Started:** [date]
**Completed:** [date]

| Item ID | Source Phase | Test | Expected | Actual | Pass/Fail | Fix Commit | Date | Notes |
|---------|-------------|------|----------|--------|-----------|-----------|------|-------|
| 20-UAT-1 | 20 | Portal card layout | Cards show topic, colored border, 3 indicators | [actual] | [P/F] | — | [date] | |
| 20-UAT-2 | 20 | Diagnostic chat multi-turn | LLM follow-up appears, 3-turn limit, Done ends | | | | | |
| ... | | | | | | | | |
```

Columns:
- `Item ID`: `{phase}-UAT-{n}` (e.g., `20-UAT-1`)
- `Source Phase`: phase number (20/21/22/26)
- `Test`: brief description (from VERIFICATION.md `test` field)
- `Expected`: from VERIFICATION.md `expected` field
- `Actual`: operator reports what actually happened
- `Pass/Fail`: `PASS` | `FAIL` | `SKIP`
- `Fix Commit`: git SHA if a fix was committed during 29-04; `—` if no fix needed
- `Date`: date item was tested
- `Notes`: any deviation, workaround, or context

### `re_verification` frontmatter template (D-21)

Based on Phase 26's existing schema (`26-VERIFICATION.md` lines 6-18):

```yaml
re_verification:
  previous_status: human_needed
  previous_score: [X/X]
  gaps_closed:
    - "[description of what was verified]"
  gaps_remaining: []
  regressions: []
```

For Phase 20 VERIFICATION.md, after all 4 UAT items pass:
```yaml
---
phase: 20-orchestration-strategy-diagnostic-dialogue
verified: 2026-04-10T00:00:00Z
status: passed          # <-- flip from human_needed
score: 16/16 automated must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 16/16
  gaps_closed:
    - "Portal card layout and content type indicators confirmed"
    - "Diagnostic chat multi-turn flow confirmed"
    - "Portal card indicator navigation routing confirmed"
    - "Portal card primary CTA navigation confirmed"
  gaps_remaining: []
  regressions: []
  log: .planning/phases/29-final-polishment/29-UAT-LOG.md
```

The `log` field should point to the UAT log so there is a traceable evidence chain. Repeat the pattern for phases 21, 22, 26.

---

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` |
| Config file | None — loader via `--loader` or `--import` per test file |
| Quick run (single file) | `node --test app/tests/services/orchestration-strategy.test.mjs` |
| Full suite | `npm test` (from `app/`) |

### Plan 29-01 test map

| Behavior | Test Type | File | Status |
|----------|-----------|------|--------|
| `computeHints` populates `curiosityTopics` from `checkInSignals` | unit | `app/tests/services/orchestration-strategy.test.mjs` | Add 1 test |
| Both call sites pass `checkInSignals` to `computeHints` | static-grep | `app/tests/services/orchestration-strategy.test.mjs` or new | Add 2 assertions |

Sampling:
- Per task commit: `node --test app/tests/services/orchestration-strategy.test.mjs`
- Phase gate: full `npm test`

### Plan 29-02 test map

| Behavior | Test Type | File | Status |
|----------|-----------|------|--------|
| PostDetailScreen creates AbortController + LOCALE_CHANGED subscription | static-grep | `app/tests/screens/post-detail-abort.test.mjs` | NEW file |
| `generatePostEssay` accepts `options?.signal` | static-grep | same | NEW |
| `post-essay.service.ts` passes signal to all 4 `chatStream` calls | static-grep | same | NEW |
| `generateEssayMeta` passes signal to `chatCompletion` | static-grep | same | NEW |
| Abort discards (no `patchPostEssayInCache` on aborted path) | static-grep | same | NEW |
| `classifyAndAnchorIncremental` accepts `signal?` | static-grep | `app/tests/canonical-knowledge-pipeline.test.mjs` | Add tests |
| `runStepWithRetry` passes signal to `chatCompletion` | static-grep | same | Add |
| `useQuestions.ts:273` passes `abortController.signal` to `classifyAndAnchorIncremental` | static-grep | `app/tests/state/useQuestions-locale-abort.test.mjs` | Add assertion |

**Behavioral abort test pattern** (from `useQuestions-locale-abort.test.mjs:53-76`):
```javascript
// Stub a never-resolving async iterator, fire abort, assert partial accumulation stops
test('aborting async iterator halts accumulation', async () => {
  const ac = new AbortController();
  async function* fakeStream() {
    for (let i = 0; i < 10; i++) {
      if (ac.signal.aborted) return;
      await new Promise(r => setTimeout(r, 5));
      yield String(i);
    }
  }
  // ... same pattern as existing test
});
```

Sampling:
- Per task commit: `node --test app/tests/screens/post-detail-abort.test.mjs && node --test app/tests/canonical-knowledge-pipeline.test.mjs`
- Phase gate: full `npm test` + `node --test app/tests/state/useQuestions-locale-abort.test.mjs`

### Plan 29-03 test map

| Behavior | Test Type | Command | Status |
|----------|-----------|---------|--------|
| 5 previously-failing tests now PASS | regression | `node --test app/tests/canonical-knowledge-pipeline.test.mjs && ...` (all 5) | Transition from ERR to PASS |
| 43 Phase 27 tests still pass | regression | `npm test` | Unchanged |
| 4 target files compile clean | tsc | `cd app && npx tsc --noEmit src/screens/GraphScreen.tsx src/services/canonical-knowledge.service.ts src/services/review.service.ts src/services/trellis-state.service.ts` | Clean output |

### Plan 29-04 test map

Plan 29-04 is walkthrough-driven. No unit tests. The `29-UAT-LOG.md` completeness IS the validation artifact. Done when:
- All 22 items have `Pass/Fail` = `PASS` or `SKIP` (with documented reason)
- Each `FAIL` → fix committed → re-tested → flipped to `PASS`
- 4 archived VERIFICATION.md files updated with `status: passed` + `re_verification:` block

### Wave 0 Gaps

| Gap | Covers | Command |
|-----|--------|---------|
| `app/tests/screens/post-detail-abort.test.mjs` | PostDetailScreen AbortController plumbing (TD-02) | `node --test app/tests/screens/post-detail-abort.test.mjs` |

All other test infrastructure already exists.

---

## Pitfalls / Gotchas

### D-17 enforcement: classifyAndAnchor is untouchable

`classifyAndAnchor` (single-call fallback, line 848) MUST retain its current 3-param signature `(question, allQuestions, llmConfig)`. The incremental variant's fallback paths at lines 770, 792, 812 call `classifyAndAnchor(question, allQuestions, llmConfig)` — these must not change. Only `classifyAndAnchorIncremental` and `runStepWithRetry` get the new `signal?` param.

### D-19: No Node loader workaround

Do NOT add `--loader ts-node/esm`, `--loader esbuild-register`, or `--import` hooks to `package.json` test scripts as a workaround for the extension issues. Fix the source files' import strings directly.

### Shared AbortController lifecycle (PostDetailScreen)

The async IIFE pattern means `unsubLocale()` in `finally` can race with the effect cleanup `return () => { abortController.abort(); }`. If the effect cleanup runs (component unmounts) WHILE the IIFE is in the `finally` block:
1. Effect cleanup calls `abortController.abort()` — safe (already aborted or no-op)
2. Effect cleanup does NOT call `unsubLocale()` — cleanup is in the IIFE's `finally`

Safest pattern: call `unsubLocale()` in BOTH the `finally` block AND the effect cleanup return. Since `eventBus.subscribe()` returns an unsubscribe function, verify it is idempotent (safe to call twice). If not, use a `let unsubbed = false` guard.

### PostDetailScreen: three streaming branches

The essay effect has three branches:
1. `generateConnectionPost` (connection posts)
2. `generateDiscoverPost` (discover posts)
3. `generatePostEssay` (standard, video, news, text-art)

D-15 explicitly names branch 3 (`generatePostEssay` / `generateEssayMeta`). Branches 1 and 2 (`conceptFeedService.generateConnectionPost/generateDiscoverPost`) are NOT named in D-15. The planner should add signal threading to branches 1 and 2 as well for consistency (they are in the same effect). If D-15 scope is strictly interpreted, branches 1+2 remain without signal — but the effect cleanup `aborted` boolean still runs, providing unmount-only cancellation. Note this decision in the plan.

### concept-feed.service.ts: `plannerService.getRecentSignals()` already called at line 251

The `concept-feed.service.ts` fix (TD-01) is ONLY inside `applyStrategyBias()` (line 759). Do NOT use the existing `recentSignals` variable from line 251 — it is in a different function scope. The fix adds a NEW `getRecentSignals()` call inside `applyStrategyBias`.

### Node 25 fix: be careful with `plannerAutoGen.service.ts` imports

`plannerAutoGen.service.ts` imports `from './planner.service'` (NO .ts) at line 16. When fixing Node 25 issues for concept-feed tests, this file may not be in the failing chain — but if running the full suite, it may need fixing too. Scope per D-05: only fix imports in the failing tests' transitive chains.

### tsc same-file siblings vs. `types/index.ts`

Adding `GRAPH_UPDATED` to `AppEvent` and `COVERAGE_ERROR` to `ErrorCode` modifies `types/index.ts`, which is NOT one of the 4 target files. However, these additions are REQUIRED to fix the tsc errors in the target files. D-04 allows "same-file siblings" but `types/index.ts` is a shared types file. This is the minimal correct fix — the planner should note this boundary crossing and verify no other callers break.

### UAT item count discrepancy

CONTEXT.md D-11 references "all 25 original UAT items". The 25 counts ALL items before skip list (4+5+9+7=25). After D-23 skips (-1 from Phase 21, -2 from Phase 22) = **22 items to actually test**. The UAT log should have 22 rows (excluding the 3 SKIP rows which can be added as informational rows with `Pass/Fail: SKIP`).

---

## Sources

### Primary (HIGH confidence)
All findings sourced from direct reads of the named files:
- `app/src/services/plannerAutoGen.service.ts` lines 100-140
- `app/src/services/concept-feed.service.ts` lines 748-771
- `app/src/services/orchestration-strategy.service.ts` (full)
- `app/src/services/planner.service.ts` lines 595-615
- `app/src/providers/llm/index.ts` lines 1-78
- `app/src/state/useQuestions.ts` lines 110-290
- `app/src/screens/PostDetailScreen.tsx` lines 160-260
- `app/src/services/post-essay.service.ts` (full, 199 lines)
- `app/src/services/canonical-knowledge.service.ts` lines 710-846
- `app/src/services/question.service.ts` lines 254-280
- `app/src/types/index.ts` lines 1-40, 618-679
- `app/tests/state/useQuestions-locale-abort.test.mjs` (full)
- `.planning/milestones/v1.3-phases/20-*/20-VERIFICATION.md`
- `.planning/milestones/v1.3-phases/21-*/21-VERIFICATION.md`
- `.planning/milestones/v1.3-phases/22-*/22-VERIFICATION.md`
- `.planning/milestones/v1.3-phases/26-*/26-VERIFICATION.md`
- `.planning/milestones/v1.3-phases/27-add-i18n-l10n-support/deferred-items.md`
- `.planning/v1.3-INTEGRATION-CHECK.md`
- `.planning/v1.3-MILESTONE-AUDIT.md`
- `.planning/phases/29-final-polishment/29-CONTEXT.md`

---

## Metadata

**Confidence breakdown:**
- Plan 29-01 (TD-01): HIGH — both call sites confirmed, signatures confirmed, `getRecentSignals()` import already present
- Plan 29-02 (TD-02+TD-03): HIGH — all signatures, current code patterns, and cleanup ordering confirmed from direct reads
- Plan 29-03 (tsc+Node25): HIGH — tsc errors enumerated from deferred-items.md, each root cause traced to types/index.ts; Node 25 chain confirmed by reading import statements in each file in the chain
- Plan 29-04 (UAT): HIGH — all 4 VERIFICATION.md files read, item counts confirmed, skip list applied

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable codebase, 30-day window)

---

## RESEARCH COMPLETE
