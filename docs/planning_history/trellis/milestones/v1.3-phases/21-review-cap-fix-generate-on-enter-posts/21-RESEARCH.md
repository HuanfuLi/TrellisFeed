# Phase 21: Review Cap Fix & Generate-on-Enter Posts - Research

**Researched:** 2026-04-05
**Domain:** Flashcard review service + Post generation pipeline + Streaming UI patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Part A — Review Cap Fix:**
- Remove `.slice(0, limit)` from `review.service.ts:getTodayReviewItems()` — return ALL due cards
- `getTodayReviewCount()` reflects true due count (flows to Home/Planner badges automatically)
- Rename setting label from "Daily Limit" / "Max cards per day" to "Daily Goal"
- Raise default from 20 to 50
- Add daily goal progress bar in ReviewScreen (e.g., "12/20 reviewed today")
- Planner system already sees all knowledge nodes — no changes needed there
- Trajectory analyzer already accesses flashcardService directly — no changes needed

**Part B — Post Generation Rework:**
- Card-face-only batch generation: Strip `bodyMarkdown` from the batch LLM call. Request only: title, teaserHook, teaserPreview, keywords, contextLabel, sourceType, narrativeMode, sourceQuestionIds
- On-enter streaming LLM call in PostDetailScreen: Stream `bodyMarkdown`, `whyCare`, `takeaway`, `quickAskPrompts` into pre-built UI shell
- Pre-built UI shell (CRITICAL): Render complete detail page layout BEFORE any LLM content arrives — heading container, essay body container, follow-up section all pre-built. Streaming must NEVER damage layout.
- Caching: Once essay is generated, cache to localStorage/DB so re-visits are instant
- Video posts: Transcript fetch stays in background (zero quota cost). LLM summary deferred to on-enter streaming call. Params: transcript text + video title + description
- News posts: Web search stays in background. LLM summary deferred to on-enter streaming call. Params: web search results + concept context
- Text-art posts: Get new detail page with vivid, story-focused or conversation-focused essay generated on-enter
- Error handling: Show error state with retry button if on-enter LLM call fails
- Connection/Discover posts: Already generate on-enter via streaming — no changes needed

### Claude's Discretion
- Exact streaming UI implementation (skeleton, progressive reveal, etc.)
- Essay generation prompt design for on-enter calls
- Cache eviction strategy for generated essays
- How to pass post context (concept/QA, heading) to the on-enter LLM call
- Whether to use a single service function or post-type-specific functions for on-enter generation

### Deferred Ideas (OUT OF SCOPE)
- Backend API for pre-generating posts (future consideration for even faster feeds)
- Remote token usage tracking for generate-on-enter calls
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVIEW-01 | `getTodayReviewItems()` returns all due cards (remove `.slice(0, limit)`) | review.service.ts line 32 — single `.slice()` call to delete |
| REVIEW-02 | Review count badges on Home/Planner show true due count | Automatic — HomeScreen and PlannerScreen both use `reviewCount` from `useReview`, which calls `getTodayReviewItems()` |
| REVIEW-03 | Daily goal progress bar in ReviewScreen ("12/20 reviewed today") | ProgressBar component already imported and used in ReviewScreen; need to add daily-goal denominator alongside existing session progress |
| REVIEW-04 | Rename setting from "Daily Limit / Max cards per day" to "Daily Goal" | SettingsScreen.tsx lines 979-980, type field `dailyLimit` unchanged (only label changes) |
| REVIEW-05 | Raise default from 20 to 50 | `settings.service.ts` defaultSettings.review.dailyLimit |
| POST-01 | Strip `bodyMarkdown` from batch feed generation LLM call | Affects `buildGenerationPrompt()` and `extractPosts()` in concept-feed.service.ts; also must update `isValidDailyPost()` validator |
| POST-02 | On-enter streaming LLM call — generates bodyMarkdown, whyCare, takeaway, quickAskPrompts | New function using `chatStream` from providers/llm/index.ts; called in PostDetailScreen useEffect |
| POST-03 | Pre-built UI shell renders before LLM streaming begins | PostDetailScreen restructure: split loading state from content rendering |
| POST-04 | Cache generated essay to localStorage on completion | Post already lives in `echolearn_daily_posts` cache — patch it in place after generation |
| POST-05 | Video posts — defer LLM summary to on-enter streaming call | youtube.service.ts currently generates summary at `generateVideoPosts()` time; defer to on-enter with transcript available |
| POST-06 | News posts — defer LLM summary to on-enter streaming call | news.service.ts currently generates bodyMarkdown at `generateNewsPosts()` time |
| POST-07 | Text-art posts get a vivid detail page essay generated on-enter | New post type routing in PostDetailScreen |
| POST-08 | Error state with retry button if on-enter LLM call fails | Pattern already exists for connection/discover posts in PostDetailScreen |
</phase_requirements>

---

## Summary

Phase 21 has two independent parts. Part A (Review Cap) is a precise surgical change: delete one `.slice()` call, raise one default integer, rename two UI strings, and add a progress indicator in ReviewScreen. The ripple effect is zero — `reviewCount` from `useReview()` already flows through unchanged to HomeScreen and PlannerScreen badges.

Part B (Generate-on-Enter Posts) is the architecturally significant change. The current system generates `bodyMarkdown`, `whyCare`, `takeaway`, and `quickAskPrompts` inside the batch LLM call at feed-load time. This phase defers those fields to on-enter streaming, triggered when a user opens PostDetailScreen. The critical constraint is UI-first rendering: the detail page shell must be fully built before streaming begins, so incomplete LLM responses never cause layout shifts. The existing connection/discover streaming pattern in PostDetailScreen is the proven template for this.

The `isValidDailyPost()` validator in concept-feed.service.ts currently requires `bodyMarkdown`, `whyCare`, and `takeaway` to be non-empty strings — this guard must be relaxed when batch generation stops producing these fields. Video and news posts require their own on-enter generation paths using pre-cached transcripts and web search results respectively.

**Primary recommendation:** Implement Part A as a single-wave change (no structural risk). Implement Part B in three waves: (1) concept-feed + type changes to make bodyMarkdown optional, (2) PostDetailScreen on-enter streaming + caching + pre-built shell, (3) video/news/text-art specific paths.

---

## Standard Stack

No new libraries required. All tools are already in the codebase.

### Core (already present)
| Tool | Version | Purpose | Where Used |
|------|---------|---------|------------|
| `chatStream` | in-house | Async generator streaming LLM calls | providers/llm/index.ts — already used for connection/discover posts |
| `chatCompletion` | in-house | Non-streaming LLM completion | providers/llm/index.ts |
| `ProgressBar` | ui component | Progress display | Already imported in ReviewScreen |
| `localStorage` | native | Essay cache persistence | All services use this pattern |
| `node:test` | built-in | Test runner | `npm test` — runs `tests/**/*.test.mjs` |

### No Installation Required
This phase requires no `npm install`. All dependencies exist.

---

## Architecture Patterns

### Part A: Review Cap Removal

**What changes:**

`app/src/services/review.service.ts` line 32:
```typescript
// BEFORE
return { success: true, data: due.slice(0, limit) };

// AFTER
return { success: true, data: due };
// (remove the limit variable read entirely)
```

`app/src/services/settings.service.ts` — raise default:
```typescript
review: {
  dailyLimit: 50,   // was 20
  ...
}
```

`app/src/screens/SettingsScreen.tsx` — label-only rename (lines ~979-980):
```typescript
// BEFORE
<SettingRow label="Daily Limit" description="Max cards per day">

// AFTER
<SettingRow label="Daily Goal" description="Target cards per day">
```

**Daily goal progress in ReviewScreen:**

ReviewScreen already tracks `reviewed` (count of cards rated this session) and `total` (items.length + reviewed). The daily goal from settings is separate: it represents a target, not a cap.

Pattern: show "X reviewed today / Y goal" where X = total cards submitted via `submitReview` across all sessions today (requires a lightweight count), and Y = `settings.review.dailyLimit` (now the goal).

The simplest approach: count `reviewed` (session-scoped) and compare against goal. If the user reviews in multiple sessions, only the current session count is visible. For true "reviewed today" tracking, a counter stored in localStorage keyed to today's date is needed — a small addition to review.service.ts.

### Part B: Generate-on-Enter Posts

#### Step 1: Make bodyMarkdown optional in types and validators

`app/src/types/index.ts` — `PostSnapshot` currently requires bodyMarkdown as a `string`. It must become `string | undefined` or remain string but be allowed to be empty string `''` in the batch path.

Decision: Keep `bodyMarkdown: string` in the type (empty string `''` as sentinel for "not yet generated") to avoid widespread nullable checks in components that already render `<Markdown>{post.bodyMarkdown}</Markdown>`.

`isValidDailyPost()` in concept-feed.service.ts currently gates on `typeof post.bodyMarkdown === 'string'` — this remains valid with empty string. The `extractPosts()` function nullcheck `if (!teaserHook || !teaserPreview || !bodyMarkdown || !title) return null;` must drop the `!bodyMarkdown` condition.

#### Step 2: Strip bodyMarkdown from batch generation prompt

`buildGenerationPrompt()` currently instructs the LLM:
```
'Every post must include: title, teaserHook, teaserPreview, bodyMarkdown, takeaway, quickAskPrompts (3 strings), ...'
```
This becomes:
```
'Every post must include: title, teaserHook, teaserPreview, narrativeMode, contextLabel, sourceType, sourceQuestionIds, keywords.'
'Do NOT include bodyMarkdown, whyCare, takeaway, or quickAskPrompts — these are generated on demand.'
```

#### Step 3: On-enter essay generation service function

New function (or addition to concept-feed.service.ts / new `post-essay.service.ts`):

```typescript
// Recommended: single service function dispatches by sourceType
export async function* generatePostEssay(post: DailyPost, questions: Question[]): AsyncGenerator<string> {
  // Dispatch to correct generator based on post.sourceType
  if (post.sourceType === 'video') yield* generateVideoEssay(post);
  else if (post.sourceType === 'news') yield* generateNewsEssay(post);
  else if (post.presentationStyle === 'text-art') yield* generateTextArtEssay(post, questions);
  else yield* generateStandardEssay(post, questions);
}
```

Context passed to each generator:
- Standard posts: `post.title`, `post.teaser.hook`, `post.sourceQuestionIds` (look up from questions)
- Video posts: `post.videoMeta.transcript` (pre-fetched by background job), `post.videoMeta.title`, `post.videoMeta.description`
- News posts: `post.newsMeta.sources` (pre-fetched by background job as SourceCitation[])
- Text-art posts: `post.title`, `post.teaser.hook`, emphasis on vivid/story/conversation tone

#### Step 4: Pre-built UI shell in PostDetailScreen

Current problematic pattern for connection/discover posts:
- `isGeneratingEssay` shows a loading spinner and REPLACES the full page layout
- This means the page header, pills, and Q&A section don't render until generation completes

Required pattern for generate-on-enter:
- Full page shell renders immediately (back button, heading, essay container, follow-up section)
- Essay container shows skeleton/streaming text as content arrives
- Follow-up Q&A section renders independently (disabled until essay is cached)

```
┌──────────────────────────────┐
│ [← Back]           [menu]   │  ← Always rendered
├──────────────────────────────┤
│ Video/Image (if applicable)  │  ← Already rendered
├──────────────────────────────┤
│ ARTICLE SHELL                │
│   ContextLabel · Mode        │  ← Static from post
│   Title (post.title)         │  ← Static from post
│   ┌────────────────────┐     │
│   │ Streaming content  │     │  ← LLM streams in here
│   │ (empty/skeleton)   │     │
│   └────────────────────┘     │
│   Takeaway (after stream)    │
├──────────────────────────────┤
│ Q&A Follow-up section        │  ← Always rendered, disabled during stream
└──────────────────────────────┘
```

State management in PostDetailScreen:
```typescript
const [essayContent, setEssayContent] = useState<{
  bodyMarkdown: string;
  whyCare: string;
  takeaway: string;
  quickAskPrompts: string[];
} | null>(null);
const [isStreamingEssay, setIsStreamingEssay] = useState(false);
const [essayError, setEssayError] = useState<string | null>(null);
```

**Streaming accumulation pattern** (already used for connection/discover — replicate exactly):
```typescript
let accumulated = '';
for await (const chunk of generatePostEssay(post, questions)) {
  if (abortRef.current) return;
  accumulated += chunk;
  setEssayContent(parsePartialEssay(accumulated));
}
```

`parsePartialEssay()` extracts structured fields from the streaming JSON response as it arrives.

#### Step 5: Caching generated essays

After streaming completes, patch the post object in the localStorage cache:

```typescript
function patchPostEssayInCache(postId: string, essay: EssayContent): void {
  const cached = loadCache();
  if (!cached) return;
  cached.posts = cached.posts.map(p =>
    p.id === postId ? { ...p, ...essay } : p
  );
  saveCache(cached);
  // Also patch news/video caches if applicable
}
```

Video posts live in `echolearn_video_cache` (youtube.service.ts). News posts live in `echolearn_news_posts` (news.service.ts). Each needs its own patch function.

On revisit: `getPostById()` returns the cached post; if `bodyMarkdown` is non-empty, skip on-enter generation.

#### Step 6: Video and News deferrals

**Video posts:** `youtube.service.ts` `generateVideoPosts()` currently calls `chatCompletion` with the transcript to produce `bodyMarkdown`. For POST-05, this call is removed from `generateVideoPosts()`. The transcript is still fetched (zero quota cost). `videoMeta.transcript` must remain in the DailyPost object so PostDetailScreen can pass it to the on-enter streaming call.

**News posts:** `news.service.ts` `generateNewsPosts()` currently calls `chatCompletion` to produce bodyMarkdown. For POST-06, this call is removed. The web search results (`newsMeta.sources`) are still fetched and cached. PostDetailScreen reads `newsMeta.sources` and passes them to the on-enter streaming call.

Both services will produce posts with `bodyMarkdown: ''` after this change — the PostDetailScreen detects this and triggers on-enter generation.

### Recommended Project Structure (no changes to folder structure)

All changes are within existing files. One optional new file:
```
src/services/
└── post-essay.service.ts   — On-enter essay generation dispatcher (optional, could stay in concept-feed.service.ts)
```

### Anti-Patterns to Avoid

- **Blocking shell on LLM state:** Never gate the full page render on `isStreamingEssay` — this is the exact bug the CONTEXT calls out as "previous on-demand LLM calls suffered from UI render issues"
- **Re-generating already-cached essays:** Always check `post.bodyMarkdown !== ''` before triggering on-enter generation
- **Patching the wrong cache:** Video posts are in `echolearn_video_cache`, news in `echolearn_news_posts`, AI posts in `echolearn_daily_posts` — patch the right one

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming LLM responses | Custom fetch/SSE handler | `chatStream` from `providers/llm/index.ts` | Already handles all providers, timeouts, abort signals |
| Progress bar UI | Custom div/width animation | `ProgressBar` from `components/ui/ProgressBar` | Already in ReviewScreen, consistent styling |
| Essay cache persistence | New IndexedDB layer | Patch existing localStorage caches via `loadCache()/saveCache()` | Consistent with all other service caches |
| Partial JSON parsing during streaming | Custom parser | Emit complete structured JSON at end of stream; display raw accumulated string during streaming | Connection/discover posts use this pattern — it works |

**Key insight:** The connection/discover post streaming in PostDetailScreen is the reference implementation for on-enter generation. It already handles accumulation, abort, error state with retry, and save-on-complete. The gap is that it currently replaces the full page with a loading state rather than streaming into a pre-built shell.

---

## Runtime State Inventory

This is not a rename/refactor phase. No runtime state audit required.

---

## Common Pitfalls

### Pitfall 1: isValidDailyPost rejects empty-bodyMarkdown posts
**What goes wrong:** After stripping bodyMarkdown from batch generation, posts have `bodyMarkdown: ''`. `isValidDailyPost()` requires `typeof post.bodyMarkdown === 'string'` — empty string passes this check, BUT `extractPosts()` has `if (!bodyMarkdown) return null` which rejects them.
**Why it happens:** The nullguard `!bodyMarkdown` was correct when bodyMarkdown was required. Now it's a sentinel.
**How to avoid:** Remove `!bodyMarkdown` from the nullguard in `extractPosts()`. Keep the `typeof post.bodyMarkdown === 'string'` validator check (empty string is still a string).
**Warning signs:** All batch-generated posts silently disappear from the feed after the change.

### Pitfall 2: Starter posts have hardcoded bodyMarkdown
**What goes wrong:** `STARTER_POSTS` in concept-feed.service.ts are hardcoded with full bodyMarkdown. They should not go through on-enter generation since they already have content.
**Why it happens:** The on-enter trigger checks `post.bodyMarkdown === ''` — starter posts have non-empty bodyMarkdown so this is safe by default, but worth verifying.
**How to avoid:** Confirm starter posts keep their full `bodyMarkdown` (they are not generated by the batch LLM call — they are static objects).

### Pitfall 3: Daily goal progress counts only the current session
**What goes wrong:** `reviewed` in ReviewScreen is session-scoped (resets on mount). If the user reviews 15 cards, closes the screen, reopens, they see 0/50 instead of 15/50.
**Why it happens:** No cross-session "reviewed today" counter exists.
**How to avoid:** Add a localStorage counter `echolearn_reviewed_today: { date: string; count: number }` incremented in `submitReview()` in review.service.ts. Reset daily.
**Warning signs:** Progress bar always starts at 0 on screen entry even if cards were reviewed earlier.

### Pitfall 4: Video/news caches not patched after essay generation
**What goes wrong:** After generating video/news essay on-enter, the user goes back and re-enters the post. `getPostById()` only searches `echolearn_daily_posts` and the connection store — it does NOT search `echolearn_video_cache` or `echolearn_news_posts`.
**Why it happens:** `getPostById()` in concept-feed.service.ts:
```typescript
getPostById(id: string): DailyPost | null {
  const cached = loadCache();  // only echolearn_daily_posts
  const fromCache = cached?.posts.find(p => p.id === id) ?? null;
  if (fromCache) return fromCache;
  return getConnectionPostFromStore(id);  // only connection posts
}
```
**How to avoid:** Either: (a) extend `getPostById()` to also check video/news caches, OR (b) after generating essay, write the patched post into `echolearn_daily_posts` as well (duplicating it). Option (a) is cleaner.
**Warning signs:** Video/news post detail re-triggers generation on every visit.

### Pitfall 5: Layout shift from `isGeneratingEssay` full-page replacement
**What goes wrong:** Current code for connection/discover posts sets `isGeneratingEssay = true` which renders a DIFFERENT JSX tree (no shell, just a spinner). Copying this pattern for regular posts causes the "broken UI during streaming" problem called out in CONTEXT.md.
**Why it happens:** React renders a completely different component tree when the condition flips.
**How to avoid:** Always render the full shell. Use a separate `isStreamingEssay` flag that only controls what's INSIDE the essay container (skeleton/streaming text), not whether the shell renders at all.

### Pitfall 6: whyCare and takeaway cannot be parsed from mid-stream JSON
**What goes wrong:** If the LLM returns `{ bodyMarkdown: "...", whyCare: "...", takeaway: "...", quickAskPrompts: [...] }` as JSON, parsing mid-stream will fail (partial JSON is invalid).
**Why it happens:** JSON is not streamable until it closes.
**How to avoid:** Two options: (1) Stream the essay as plain text (bodyMarkdown only), then use chatCompletion (non-streaming) for whyCare/takeaway/quickAskPrompts after bodyMarkdown completes. (2) Have the LLM stream sections with delimiters. Option 1 is simpler and consistent with connection/discover which stream plain text bodyMarkdown. whyCare, takeaway, quickAskPrompts can be generated in a second fast non-streaming call after body completes (or defaulted from teaser.preview and teaser.hook as fallback).

---

## Code Examples

### Existing streaming pattern to replicate (connection posts)
```typescript
// Source: app/src/screens/PostDetailScreen.tsx lines 111-149
let accumulated = '';
try {
  for await (const chunk of conceptFeedService.generateConnectionPost(...)) {
    if (generateAbortRef.current) return;
    accumulated += chunk;
    setEssayStreaming(accumulated);
  }
  // on complete: save to cache, update post state
} catch (err) {
  if (!generateAbortRef.current) {
    setEssayError(err instanceof Error ? err.message : 'Generation failed.');
  }
} finally {
  if (!generateAbortRef.current) setIsGeneratingEssay(false);
}
```

### chatStream usage pattern
```typescript
// Source: app/src/providers/llm/index.ts line 41
export async function* chatStream(
  messages: ChatMessage[],
  config: LLMConfig,
  options?: CompletionOptions
): AsyncGenerator<string>
// Called with: for await (const chunk of chatStream(messages, settings.llm, { serviceName: 'posts' }))
```

### Existing progress bar pattern in ReviewScreen
```typescript
// Source: app/src/screens/ReviewScreen.tsx lines 305-306, 586
const total = reviewItems.length + reviewed;
const progress = total > 0 ? (reviewed / total) * 100 : 0;
// ...
<ProgressBar value={progress} />
// ProgressBar already imported at line 7
```

### localStorage cache patch pattern
```typescript
// Source: concept-feed.service.ts lines 539-548 (_persistStylesToCache)
function _persistStylesToCache(styledPosts: DailyPost[]): void {
  const cachedNow = loadCache();
  if (!cachedNow) return;
  const styleMap = new Map(styledPosts.map(p => [p.id, { ... }]));
  cachedNow.posts = cachedNow.posts.map(p => {
    const info = styleMap.get(p.id);
    if (!info) return p;
    return { ...p, ...info };
  });
  saveCache(cachedNow);
}
```

### Error state with retry (existing pattern)
```typescript
// Source: app/src/screens/PostDetailScreen.tsx lines 356-374
{essayError ? (
  <div style={{ ... }}>
    <p>Generation failed</p>
    <p>{essayError}</p>
    <button onClick={() => { setEssayError(null); navigate(0); }}>
      <RefreshCw size={14} /> Retry
    </button>
  </div>
) : (
  // streaming spinner
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All post content generated in batch | Card-face only in batch, essay on-enter | Phase 21 | Feed load drops from ~10s to ~3s; essay delivery <1s |
| Hard daily cap on review queue | Daily goal (soft target with progress bar) | Phase 21 | All due cards visible; user sees progress vs. goal |

**Deprecated after this phase:**
- `bodyMarkdown`, `whyCare`, `takeaway`, `quickAskPrompts` in batch LLM prompt — these fields become on-enter only for AI posts (starter posts keep hardcoded content)

---

## Open Questions

1. **Should `bodyMarkdown` become optional (`string | undefined`) in `PostSnapshot`?**
   - What we know: Empty string `''` works as a sentinel but requires updating all validators and guards
   - What's unclear: Whether any component other than PostDetailScreen renders `post.bodyMarkdown` directly (InfoFlow renders teasers only, not bodyMarkdown)
   - Recommendation: Use empty string sentinel (no type change). It is the least-invasive option and consistent with how `whyCare` and `takeaway` are already fallback-assigned from `teaserPreview` in `extractPosts()`.

2. **How to handle quickAskPrompts during streaming?**
   - What we know: quickAskPrompts is an array of 3 strings. It cannot be streamed incrementally in JSON format.
   - What's unclear: Whether users expect follow-up prompts immediately or only after the essay completes
   - Recommendation: Generate quickAskPrompts in a second fast non-streaming call after bodyMarkdown streams. OR default to the teaser hook-derived prompts as placeholders. The existing starter posts show that simple fallback prompts work.

3. **"Reviewed today" count persistence across sessions**
   - What we know: ReviewScreen `reviewed` state is session-scoped. The daily goal progress (REVIEW-03) should show cross-session count.
   - Recommendation: Add `echolearn_reviewed_today: { date, count }` to localStorage, incremented in `reviewService.submitReview()`. Simple and consistent with settings pattern.

---

## Environment Availability

Step 2.6: SKIPPED — no external tool dependencies. All changes are to existing TypeScript/React code using already-installed packages.

---

## Validation Architecture

nyquist_validation is enabled (workflow.nyquist_validation: true in .planning/config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | None (no config file — tests discovered via glob) |
| Quick run command | `cd /Users/Code/EchoLearn/app && npm test 2>&1 \| head -50` |
| Full suite command | `cd /Users/Code/EchoLearn/app && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVIEW-01 | `getTodayReviewItems()` returns all due cards without slicing | unit | `npm test -- --test-name-pattern "getTodayReviewItems"` | ❌ Wave 0 |
| REVIEW-02 | `reviewCount` reflects true due count (badge value) | integration | covered by REVIEW-01 (reviewCount derives from getTodayReviewItems) | ❌ Wave 0 |
| REVIEW-03 | Daily goal progress bar shows X/Y | manual | Visual check — ProgressBar value is UI only | manual-only |
| REVIEW-04 | Settings label renamed to "Daily Goal" | manual | Visual check — string constant | manual-only |
| REVIEW-05 | Default dailyLimit is 50 | unit | `npm test -- --test-name-pattern "default.*dailyLimit\|dailyLimit.*default"` | ❌ Wave 0 |
| POST-01 | Batch LLM prompt does not request bodyMarkdown | unit | `npm test -- --test-name-pattern "buildGenerationPrompt"` | ❌ Wave 0 |
| POST-02 | On-enter streaming produces bodyMarkdown | unit | `npm test -- --test-name-pattern "generatePostEssay"` | ❌ Wave 0 |
| POST-03 | UI shell renders before streaming | manual | Visual — component render order is UI concern | manual-only |
| POST-04 | Essay cached after generation, re-visit skips generation | unit | `npm test -- --test-name-pattern "patchPostEssay\|essay.*cache"` | ❌ Wave 0 |
| POST-05 | Video posts trigger on-enter summary, not batch | unit | `npm test -- --test-name-pattern "video.*essay\|generateVideoEssay"` | ❌ Wave 0 |
| POST-06 | News posts trigger on-enter summary, not batch | unit | `npm test -- --test-name-pattern "news.*essay\|generateNewsEssay"` | ❌ Wave 0 |
| POST-07 | Text-art posts open detail with vivid essay | manual | Visual — text-art essay tone | manual-only |
| POST-08 | Error state with retry renders on LLM failure | manual | Visual — error UI | manual-only |

### Sampling Rate
- **Per task commit:** `cd /Users/Code/EchoLearn/app && npm test 2>&1 | tail -20`
- **Per wave merge:** `cd /Users/Code/EchoLearn/app && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/services/review.service.test.mjs` — covers REVIEW-01, REVIEW-05: tests that `getTodayReviewItems()` returns all due cards (no slice), and default dailyLimit is 50
- [ ] `tests/services/post-essay.service.test.mjs` — covers POST-01, POST-02, POST-04: tests that batch prompt omits bodyMarkdown, generatePostEssay returns streaming content, cache patch works

Note: The existing `tests/concept-feed.test.mjs` imports `buildFallbackPosts` which will need updating once `bodyMarkdown` is removed from batch generation. That file's test for `buildFallbackPosts` should be reviewed as part of POST-01 wave.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md was not found at the repository root. No additional project-level constraints to enforce.

Constraints inferred from MEMORY.md and codebase conventions:
- Use **inline styles with CSS variables** (not Tailwind classes) for all new UI
- Return `ServiceResult<T>` from new service functions
- Use `toast()` helper from `src/lib/toast.ts` for user notifications
- ESLint rule `react-hooks/set-state-in-effect` is disabled — async data loading in useEffect is allowed
- Do NOT set `ref.current` during render — use `useEffect` to sync state to refs
- serviceName tagging: new LLM calls must include `{ serviceName: 'posts' }` or an appropriate service name in CompletionOptions

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `app/src/services/review.service.ts`, `app/src/services/concept-feed.service.ts`, `app/src/screens/PostDetailScreen.tsx`, `app/src/screens/ReviewScreen.tsx`, `app/src/services/settings.service.ts`, `app/src/types/index.ts`
- `.planning/phases/21-review-cap-fix-generate-on-enter-posts/21-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — phase history and accumulated decisions
- `app/tests/concept-feed.test.mjs` — test infrastructure pattern

---

## Metadata

**Confidence breakdown:**
- Part A (Review Cap): HIGH — single-file surgical changes, all call sites identified, reviewer count flows clear
- Part B (Post Generation): HIGH — existing streaming pattern is the blueprint; the key risks (isValidDailyPost, cache lookup for video/news, layout shift) are all documented with solutions
- Validation: HIGH — test framework is well-established Node built-ins; existing test files show the pattern

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable architecture)
