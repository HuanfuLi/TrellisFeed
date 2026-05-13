---
phase: 41-pipeline-wiring-essay-depth
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/services/concept-feed.service.ts
  - app/src/services/web-search.service.ts
  - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
  - app/tests/services/web-search-exclude-domains.test.mjs
  - app/tests/services/source-diversity-day-boundary-reset.test.mjs
autonomous: true
requirements: [CONTENT-02, CONTENT-03]
must_haves:
  truths:
    - "After dismissAnchor('X') populates engagementService dismissed set, walkDerivedList(N, exploredIds, dismissedIds) returns conceptIds that exclude 'X'"
    - "News creation loop at concept-feed.service.ts:~1093 calls sourceDiversityService.getUsedDomains(a.conceptId) BEFORE webSearch and passes [...usedDomains] as excludeDomains"
    - "News pre-fetch loop at concept-feed.service.ts:~1296 does the same getUsedDomains → excludeDomains threading"
    - "Both news loops widen Tavily maxResults from 1 to 3 (D-02)"
    - "Both news loops call sourceDiversityService.filterForDiversity on the results array and take filtered[0] (or store filtered.slice(0,3) into newsMeta.sources for the creation loop per Pitfall 2)"
    - "Both news loops call sourceDiversityService.recordServedDomain(a.conceptId, extractDomain(chosen.url)) AFTER the post commits, guarded by a truthy domain check"
    - "WebSearchOptions interface in web-search.service.ts gains excludeDomains?: string[]"
    - "Tavily request body in webSearch() conditionally sets exclude_domains when options?.excludeDomains?.length is truthy"
    - "loadCache()'s date-mismatch branch at concept-feed.service.ts:186 calls sourceDiversityService.reset() before returning null (Pitfall 3 Option A)"
  artifacts:
    - path: "app/src/services/concept-feed.service.ts"
      provides: "Source-diversity wiring at both news call sites + day-boundary reset"
      contains: "sourceDiversityService.getUsedDomains"
    - path: "app/src/services/web-search.service.ts"
      provides: "WebSearchOptions.excludeDomains threaded into Tavily exclude_domains body field"
      contains: "exclude_domains: options.excludeDomains"
    - path: "app/tests/services/concept-feed-source-diversity-wiring.test.mjs"
      provides: "SC-1 walker integration test + SC-2(a) source-reading wiring assertions + SC-2(b) behavioral rerank test"
    - path: "app/tests/services/web-search-exclude-domains.test.mjs"
      provides: "SC-2(c) Tavily body excludeDomains threading behavioral test"
    - path: "app/tests/services/source-diversity-day-boundary-reset.test.mjs"
      provides: "SC-2(d) day-boundary reset behavioral test (idempotent — outcome-based per Pitfall 8)"
  key_links:
    - from: "app/src/services/concept-feed.service.ts:~1093 (news creation loop)"
      to: "sourceDiversityService.getUsedDomains + filterForDiversity + recordServedDomain"
      via: "import { sourceDiversityService, extractDomain } from './source-diversity.service.ts'"
      pattern: "sourceDiversityService\\.(getUsedDomains|filterForDiversity|recordServedDomain)"
    - from: "app/src/services/concept-feed.service.ts:~1296 (news pre-fetch loop)"
      to: "sourceDiversityService.getUsedDomains + filterForDiversity + recordServedDomain"
      via: "same import"
      pattern: "sourceDiversityService\\.(getUsedDomains|filterForDiversity|recordServedDomain)"
    - from: "app/src/services/concept-feed.service.ts:loadCache() date-mismatch branch"
      to: "sourceDiversityService.reset()"
      via: "called inside if (parsed.date !== today()) return null"
      pattern: "sourceDiversityService\\.reset\\(\\)"
    - from: "app/src/services/web-search.service.ts:webSearch body builder"
      to: "Tavily request body.exclude_domains"
      via: "conditional set when options?.excludeDomains?.length"
      pattern: "exclude_domains: options.excludeDomains"
    - from: "app/src/services/concept-feed.service.ts:1212 (walker call — Phase 39 already wired)"
      to: "engagementService.getDismissedAnchorIds() → walkDerivedList third arg"
      via: "new Set(engagementService.getDismissedAnchorIds())"
      pattern: "walkDerivedList\\(.*dismissedIds"
---

<objective>
Wire Phase 40's `sourceDiversityService` into `concept-feed.service.ts`'s two news call sites (creation loop at ~:1093 and pre-fetch loop at ~:1296), add `excludeDomains?: string[]` to `WebSearchOptions` so Tavily receives `exclude_domains` body field, install `sourceDiversityService.reset()` at the day-boundary in `loadCache()`, and add the SC-1 integration test asserting the already-wired walker dismissedIds path skips dismissed concepts. Closes CONTENT-02 from `◐ Partial` → `✓ Complete` and lands the multi-snippet `newsMeta.sources` shape that CONTENT-03 (Plan 41-02) consumes via `sources.slice(0, 3)`.

Purpose: Per-anchor domain rotation surfaces fresh sources on repeat fetches. Without it, Tavily returns the same top-ranked domain every refill cycle, so users keep reading articles from the same site for the same concept. Combined with Phase 39's already-wired `dismissedIds` walker arg, this is the user-visible payoff of Wave 1's leaf services.

Output: 2 service files modified + 3 new test files. ~5-6 atomic commits. Wave 1 plan; Plan 41-02 follows in Wave 2 (both touch concept-feed.service.ts at non-overlapping line regions; sequencing avoids parallel-write corruption).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md
@.planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md
@.planning/phases/41-pipeline-wiring-essay-depth/41-VALIDATION.md
@.planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md
@.planning/phases/39-engagement-service-walker-extension/39-01-engagement-service-SUMMARY.md
@CLAUDE.md

# Source files that this plan modifies (executor MUST read before editing)
@app/src/services/concept-feed.service.ts
@app/src/services/web-search.service.ts
@app/src/services/source-diversity.service.ts
@app/src/services/engagement.service.ts
@app/src/services/post-queue.service.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from Phase 40 SUMMARY + live source. -->
<!-- Use these directly — no codebase exploration needed. -->

From app/src/services/source-diversity.service.ts (Phase 40 leaf — DO NOT MODIFY):
```typescript
export const sourceDiversityService = {
  filterForDiversity(results: WebSearchResult[], usedDomains: Set<string>): WebSearchResult[],
  recordServedDomain(anchorId: string, domain: string): void,
  getUsedDomains(anchorId: string): Set<string>,
  scoreSource(domain: string): number,
  reset(): void,
};

// Exported helpers (D-15):
export function extractDomain(url: string): string | undefined;
export function normalizeHost(hostname: string): string;
export const MULTI_SEGMENT_TLDS: ReadonlySet<string>;
export const DOMAIN_TIERS: Readonly<Record<string, number>>;
export const UNKNOWN_DOMAIN_SCORE: number;  // 0.5
```

From app/src/services/engagement.service.ts (Phase 39 leaf — DO NOT MODIFY):
```typescript
export const engagementService = {
  // ... save/like APIs ...
  dismissAnchor(anchorId: string): void,    // emits ANCHOR_DISMISSED
  undismissAnchor(anchorId: string): void,  // emits ENGAGEMENT_CHANGED { kind: 'undismiss' }
  isDismissed(anchorId: string): boolean,
  getDismissedAnchorIds(): string[],
  reset(): void,
};
```

From app/src/services/post-queue.service.ts (Phase 39 — DO NOT MODIFY):
```typescript
walkDerivedList(count: number, exploredIds: Set<string>, dismissedIds: Set<string>): string[]
// Required positional 3rd arg per Phase 39 D-07. Walker lazy-skips both sets.
// Phase 36 GAP-B math: maxSteps = Math.max(count * 2, len) — load-bearing.
```

From app/src/services/web-search.service.ts (CURRENT shape — Plan 41-01 EXTENDS this):
```typescript
interface WebSearchOptions {
  topic?: 'general' | 'news';
  maxResults?: number;
  includeImages?: boolean;
  // Plan 41-01 ADDS: excludeDomains?: string[];
}

export async function webSearch(query: string, options?: WebSearchOptions): Promise<ServiceResult<WebSearchResponse>>
```

From app/src/services/concept-feed.service.ts (existing wiring — Phase 39 lines 1211-1212):
```typescript
const dismissedIds = new Set(engagementService.getDismissedAnchorIds());
const conceptIds = postQueueService.walkDerivedList(16, exploredIds, dismissedIds);
// ALREADY WIRED — Plan 41-01 SC-1 only ADDS the integration test, NOT a new wire.
```

Tavily API contract (verified RESEARCH § Code Examples):
```
POST https://api.tavily.com/search
body: {
  query: string,
  topic: 'general' | 'news',
  max_results: integer (default 5, range [0, 20]),
  search_depth: 'basic' | 'advanced',
  include_answer: boolean,
  include_raw_content: boolean,
  exclude_domains?: string[],  // default [], max 150 entries — Plan 41-01 ADDS this
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add excludeDomains to WebSearchOptions and thread into Tavily body</name>
  <files>app/src/services/web-search.service.ts, app/tests/services/web-search-exclude-domains.test.mjs</files>
  <read_first>
    - app/src/services/web-search.service.ts (lines 13-50 — the WebSearchOptions interface and webSearch body builder)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pattern 1 + § Pitfall 1 + § Code Examples (Tavily exclude_domains)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md § Integration Points (web-search.service.ts:13 + :40-47 sites)
    - app/tests/services/web-search.test.mjs (if exists — for behavioral mock pattern using fetch capture; otherwise mirror tests/services/source-diversity.service.test.mjs structure)
  </read_first>
  <behavior>
    - Test 1: WebSearchOptions has excludeDomains?: string[] field accepted by webSearch (TypeScript-level — assert via source-reading regex on interface body)
    - Test 2: When called with { excludeDomains: ['nature.com', 'sciencedirect.com'] }, the captured fetch body contains exclude_domains: ['nature.com', 'sciencedirect.com']
    - Test 3: When called WITHOUT excludeDomains (or with empty array), the fetch body does NOT contain exclude_domains key (conditional set per Pitfall 1)
    - Test 4: Other body fields (query, topic, max_results, search_depth) are unchanged across both cases (regression guard)
  </behavior>
  <action>
    1. Edit `app/src/services/web-search.service.ts` lines 13-17 — extend `WebSearchOptions` interface with `excludeDomains?: string[];` as the 4th optional field. Final shape:
       ```typescript
       interface WebSearchOptions {
         topic?: 'general' | 'news';
         maxResults?: number;
         includeImages?: boolean;
         excludeDomains?: string[];  // Phase 41 D-02 — per-anchor domain rotation via Tavily exclude_domains
       }
       ```
    2. Edit lines 39-50 (the body builder block) — after the existing `if (options?.includeImages)` block, ADD this conditional set BEFORE the closing of the body construction (before the `const headers = ...` line):
       ```typescript
       // Phase 41 D-02 + Pitfall 1 — only set exclude_domains when array has length;
       // empty/undefined ⇒ omit from wire payload to keep request minimal.
       if (options?.excludeDomains?.length) {
         body.exclude_domains = options.excludeDomains;
       }
       ```
    3. CREATE `app/tests/services/web-search-exclude-domains.test.mjs`. Mirror the behavioral mock pattern (no jsdom, no React Testing Library — node:test + esbuild tsx loader). Use `globalThis.fetch` swap to capture the request body. Pseudo-shape:
       ```javascript
       import { test } from 'node:test';
       import assert from 'node:assert/strict';
       // Read source for source-reading assertions:
       import { readFileSync } from 'node:fs';
       const SRC = readFileSync(new URL('../../src/services/web-search.service.ts', import.meta.url), 'utf8');

       test('WebSearchOptions interface includes excludeDomains?: string[]', () => {
         assert.match(SRC, /excludeDomains\?:\s*string\[\]/);
       });

       test('webSearch body builder conditionally sets exclude_domains', () => {
         assert.match(SRC, /if \(options\?\.excludeDomains\?\.length\)/);
         assert.match(SRC, /body\.exclude_domains = options\.excludeDomains/);
       });

       // Behavioral test — capture fetch body. Use the existing project test pattern
       // (settingsService mock, dynamic import of web-search.service.ts after fetch swap).
       // Assert: with { excludeDomains: ['nature.com'] }, captured body has exclude_domains: ['nature.com'].
       // Assert: without excludeDomains, captured body has NO exclude_domains key.
       ```
       Use the existing settings-service mock and CapacitorHttp/fetch capture pattern from any neighboring test under app/tests/services/ that exercises web-search-like fetch behavior. If no neighbor exists, source-reading tests for items 1-2 are sufficient — but PREFER capturing fetch body for the behavioral half to lock the wire payload.
    4. Run `node --test app/tests/services/web-search-exclude-domains.test.mjs` — must exit 0 with all assertions green.
    5. Run `cd app && tsc -b --noEmit` — must exit 0 (interface extension is back-compat additive).
    6. Commit atomically with `(41-01)` scope. Suggested message: `feat(41-01): add excludeDomains to WebSearchOptions; thread into Tavily exclude_domains body`.
  </action>
  <verify>
    <automated>node --test app/tests/services/web-search-exclude-domains.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "excludeDomains?: string\[\]" app/src/services/web-search.service.ts` returns ≥ 1
    - `grep -c "exclude_domains: options.excludeDomains" app/src/services/web-search.service.ts` returns 1
    - `grep -c "if (options?.excludeDomains?.length)" app/src/services/web-search.service.ts` returns 1
    - `node --test app/tests/services/web-search-exclude-domains.test.mjs` exits 0
    - `cd app && tsc -b --noEmit` exits 0
    - File `app/tests/services/web-search-exclude-domains.test.mjs` exists and contains source-reading assertion `assert.match(SRC, /excludeDomains\?:\s*string\[\]/)`
    - No other body builder fields modified (regression check via `grep -c "max_results: options?.maxResults" app/src/services/web-search.service.ts` returns 1)
  </acceptance_criteria>
  <done>WebSearchOptions accepts excludeDomains; Tavily request body conditionally includes exclude_domains; behavioral + source-reading tests green; tsc green; one atomic commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire sourceDiversityService into news creation loop + news pre-fetch loop in concept-feed.service.ts</name>
  <files>app/src/services/concept-feed.service.ts</files>
  <read_first>
    - app/src/services/concept-feed.service.ts (lines 1080-1135 news creation loop AND lines 1290-1315 news pre-fetch loop AND line 1212 walker call AND lines 167-202 loadCache)
    - app/src/services/source-diversity.service.ts (top of file — verify exact named exports: sourceDiversityService, extractDomain)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pattern 2 (getUsedDomains → filterForDiversity → recordServedDomain triple) + § Pitfall 2 (newsMeta.sources shape change)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-CONTEXT.md § Integration Points (4 wiring sites)
    - .planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md § Phase 41 contract (lines 156-195 — exact 5-function signatures + Phase 41 wiring sites enumerated)
    - CLAUDE.md § "Concept Feed Generation Pipeline" (mutex preservation — recordServedDomain MUST NOT throw)
    - CLAUDE.md § "News post pipeline — defer body to on-open streaming" (bodyMarkdown: '' invariant — DO NOT regress)
  </read_first>
  <behavior>
    - Test 1: News creation loop calls sourceDiversityService.getUsedDomains(a.conceptId) BEFORE webSearch (source-reading)
    - Test 2: News creation loop passes excludeDomains: [...usedDomains] AND maxResults: 3 to webSearch (source-reading)
    - Test 3: News creation loop calls filterForDiversity(searchResult.data.results, usedDomains) and uses filtered.slice(0,3) for newsMeta.sources (Pitfall 2 — multi-snippet shape)
    - Test 4: News creation loop calls recordServedDomain AFTER posts.push, guarded by truthy domain check
    - Test 5: News pre-fetch loop has the same triple wired (getUsedDomains → excludeDomains+maxResults:3 → filterForDiversity → recordServedDomain after preFetched.news.set)
    - Test 6: bodyMarkdown: '' invariant preserved at the news creation post object (no regression of CLAUDE.md "News post pipeline" rule)
    - Test 7: Walker call at :1212 untouched (Phase 39 already wired — counterweight assertion)
  </behavior>
  <action>
    1. Edit `app/src/services/concept-feed.service.ts`. Add an import near the top of the file (alongside the existing `import { engagementService } from './engagement.service.ts';` at line 13):
       ```typescript
       import { sourceDiversityService, extractDomain } from './source-diversity.service.ts';
       ```
       Use `.ts` extension per project convention (Phase 37 D-02 lesson).

    2. **News creation loop (~lines 1085-1131).** Current shape:
       ```typescript
       const cached = preFetched?.news.get(a.conceptId);
       let result: WebSearchResult | undefined;
       if (cached) {
         result = cached;
       } else {
         const searchResult = await webSearch(conceptName + ' latest research findings', { maxResults: 1 });
         if (searchResult.success && searchResult.data?.results.length) {
           result = searchResult.data.results[0];
         }
       }
       if (result) {
         posts.push({
           // ...
           newsMeta: {
             sources: [{ index: 1, title: result.title, url: result.url, snippet: result.content }],
             fetchedAt: Date.now(),
           },
         });
       }
       ```
       Rewrite to (preserving the cached-branch shortcut AND the bodyMarkdown: '' invariant — DO NOT TOUCH bodyMarkdown line):
       ```typescript
       const cached = preFetched?.news.get(a.conceptId);
       let result: WebSearchResult | undefined;
       let topSources: WebSearchResult[] = [];  // Phase 41 SC-3/SC-4 — stored on newsMeta.sources for multi-snippet grounding
       if (cached) {
         result = cached;
         topSources = [cached];  // pre-fetch loop already filtered + stored single chosen result
       } else {
         // Phase 41 D-02 + Pattern 2 — getUsedDomains → exclude → filterForDiversity → recordServedDomain
         const usedDomains = sourceDiversityService.getUsedDomains(a.conceptId);
         const searchResult = await webSearch(
           conceptName + ' latest research findings',
           { maxResults: 3, excludeDomains: [...usedDomains] },
         );
         if (searchResult.success && searchResult.data?.results.length) {
           const filtered = sourceDiversityService.filterForDiversity(searchResult.data.results, usedDomains);
           result = filtered[0];
           topSources = filtered.slice(0, 3);  // Pitfall 2 — store full top-3 for SC-4 multi-snippet grounding
         }
       }
       if (result) {
         posts.push({
           id: makePostId(date, 'news', a.conceptId),
           date,
           title: result.title || conceptName,
           teaser: { hook: result.title || conceptName, preview: result.content?.slice(0, 170) || '' },
           // bodyMarkdown deferred to on-enter streaming via generateNewsEssay (POST-06).
           // Previously this was set to result.content (the raw Tavily snippet, ~200 chars
           // truncated mid-sentence) which made PostDetailScreen skip the LLM stream entirely
           // and render the snippet as the essay body. Operator caught this regression on
           // 2026-04-19 — bodyMarkdown MUST stay empty so the on-enter streamer takes over.
           bodyMarkdown: '',
           whyCare: '',
           takeaway: '',
           quickAskPrompts: [],
           narrativeMode: 'mechanism-breakdown' as PostNarrativeMode,
           contextLabel: 'News',
           sourceType: 'news',
           sourceQuestionIds: [a.conceptId],
           sourceQuestionTitles: [conceptName],
           keywords: concept?.keywords?.slice(0, 4) ?? [],
           generatedAt: Date.now(),
           origin: 'ai',
           presentationStyle: 'news',
           newsMeta: {
             // Phase 41 SC-4 — multi-snippet grounding. topSources is filtered.slice(0, 3) from
             // sourceDiversityService.filterForDiversity (re-ranked unseen-first per Phase 40 D-06).
             // Old shape was a 1-element array; new shape is up to 3 entries indexed 1..N.
             sources: topSources.map((r, i) => ({ index: i + 1, title: r.title, url: r.url, snippet: r.content })),
             fetchedAt: Date.now(),
           },
         });
         // Phase 41 D-02 — record AFTER commit so the per-anchor used set reflects what
         // we actually shipped to the user. extractDomain returns undefined for malformed URLs;
         // short-circuit guard avoids polluting the used set with 'undefined'.
         const domain = extractDomain(result.url);
         if (domain) sourceDiversityService.recordServedDomain(a.conceptId, domain);
       }
       ```

    3. **News pre-fetch loop (~lines 1290-1315).** Current shape:
       ```typescript
       ...newsAssigns.map(async (a) => {
         try {
           const conceptName = getConceptName(a.conceptId);
           const results = await webSearch(conceptName + ' latest research findings', { maxResults: 1 });
           if (!results.success || !results.data?.results.length) {
             const msg = results.error?.message?.toLowerCase() ?? '';
             if (msg.includes('403') || msg.includes('quota') || msg.includes('unauthorized')) {
               markTavilyQuotaExhausted();
             }
             failedIds.add(a.conceptId);
           } else {
             preFetched.news.set(a.conceptId, results.data.results[0]);
           }
         } catch {
           failedIds.add(a.conceptId);
         }
       }),
       ```
       Rewrite to:
       ```typescript
       ...newsAssigns.map(async (a) => {
         try {
           const conceptName = getConceptName(a.conceptId);
           // Phase 41 D-02 + Pattern 2 — getUsedDomains → exclude → filterForDiversity → recordServedDomain
           const usedDomains = sourceDiversityService.getUsedDomains(a.conceptId);
           const results = await webSearch(
             conceptName + ' latest research findings',
             { maxResults: 3, excludeDomains: [...usedDomains] },
           );
           if (!results.success || !results.data?.results.length) {
             const msg = results.error?.message?.toLowerCase() ?? '';
             if (msg.includes('403') || msg.includes('quota') || msg.includes('unauthorized')) {
               markTavilyQuotaExhausted();
             }
             failedIds.add(a.conceptId);
           } else {
             const filtered = sourceDiversityService.filterForDiversity(results.data.results, usedDomains);
             const chosen = filtered[0];
             preFetched.news.set(a.conceptId, chosen);
             // Phase 41 D-02 — record AFTER commit. extractDomain undefined-guard.
             const domain = extractDomain(chosen.url);
             if (domain) sourceDiversityService.recordServedDomain(a.conceptId, domain);
           }
         } catch {
           failedIds.add(a.conceptId);
         }
       }),
       ```
       NOTE: pre-fetch loop stores ONLY `filtered[0]` (single chosen) into `preFetched.news`. The creation loop's `cached` branch reads this single result. This is intentional — pre-fetch loop runs in a `Promise.all` over many anchors and only the chosen one is needed; the multi-snippet `topSources` array is built in the creation loop from `filtered.slice(0, 3)`. The cached-branch in the creation loop wraps the single cached result as `topSources = [cached]` (1-element array — back-compat with pre-Phase-41 sourceText behavior when only 1 result is available).

    4. **DO NOT modify line 1212** — `walkDerivedList(16, exploredIds, dismissedIds)` is already correctly wired by Phase 39. Leave the existing comment block intact.

    5. **DO NOT modify the bodyMarkdown: '' invariant** at the news creation post object — the existing comment block above `bodyMarkdown: ''` is load-bearing per CLAUDE.md "News post pipeline" section and the Phase 32.1 regression history.

    6. Run `cd app && tsc -b --noEmit` — must exit 0.
    7. Run `cd app && npm test` — pass count MUST be ≥ pre-Plan-41-01 baseline; the 2 pre-existing carry-over failures (concept-feed.test.mjs ERR_MODULE_NOT_FOUND + trellis-layout date assertion) remain unchanged.
    8. Commit atomically with `(41-01)` scope. Suggested message: `feat(41-01): wire sourceDiversityService into news creation + pre-fetch loops; widen Tavily maxResults to 3`.
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit && npm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from './source-diversity.service.ts'" app/src/services/concept-feed.service.ts` returns 1
    - `grep -c "sourceDiversityService.getUsedDomains" app/src/services/concept-feed.service.ts` returns 2 (creation loop + pre-fetch loop)
    - `grep -c "sourceDiversityService.filterForDiversity" app/src/services/concept-feed.service.ts` returns 2
    - `grep -c "sourceDiversityService.recordServedDomain" app/src/services/concept-feed.service.ts` returns 2
    - `grep -c "maxResults: 3, excludeDomains:" app/src/services/concept-feed.service.ts` returns 2
    - `grep -c "bodyMarkdown: ''" app/src/services/concept-feed.service.ts` returns ≥ 1 (invariant preserved)
    - `grep -c "walkDerivedList(16, exploredIds, dismissedIds)" app/src/services/concept-feed.service.ts` returns 1 (Phase 39 wire untouched)
    - `grep -c "topSources.map((r, i) => ({ index: i + 1" app/src/services/concept-feed.service.ts` returns 1 (multi-snippet shape per Pitfall 2)
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && npm test` pass count ≥ pre-Plan-41-01 baseline (only the 2 pre-existing carry-overs may fail)
  </acceptance_criteria>
  <done>News creation + pre-fetch loops both pass usedDomains as excludeDomains, fetch maxResults: 3, re-rank via filterForDiversity, and record via recordServedDomain after commit; multi-snippet newsMeta.sources shape lands; bodyMarkdown:'' invariant preserved; walker wire untouched; tsc + tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add sourceDiversityService.reset() to loadCache day-boundary branch</name>
  <files>app/src/services/concept-feed.service.ts, app/tests/services/source-diversity-day-boundary-reset.test.mjs</files>
  <read_first>
    - app/src/services/concept-feed.service.ts lines 167-202 (loadCache function — find the `if (parsed.date !== today()) return null;` line at ~186)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pitfall 3 (Option A — idempotent placement) AND § Pitfall 8 (test outcome not call-count)
    - app/src/services/source-diversity.service.ts (verify reset() signature — Phase 40 D-14 wholesale wipe, no event emission)
  </read_first>
  <behavior>
    - Test 1: After recordServedDomain('a', 'nature.com'), getUsedDomains('a') returns Set with 'nature.com'
    - Test 2: After simulating date rollover (mutate cached blob to yesterday's date) and calling loadCache(), getUsedDomains('a') returns empty Set (outcome-based per Pitfall 8 — does NOT assert reset() call count)
    - Test 3: Source-reading: loadCache's date-mismatch branch contains sourceDiversityService.reset() before `return null`
    - Test 4: reset() is idempotent — calling loadCache() twice on a stale-date blob still leaves usedDomains empty (no error, no double-clear side effect)
  </behavior>
  <action>
    1. Edit `app/src/services/concept-feed.service.ts` near line 186. Current shape:
       ```typescript
       if (parsed.date !== today()) return null;
       ```
       Wrap this with the reset call BEFORE the early return (Pitfall 3 Option A):
       ```typescript
       if (parsed.date !== today()) {
         // Phase 41 D-02 — wholesale wipe of per-anchor usedByAnchor Map at day boundary.
         // sourceDiversityService.reset() is idempotent (Map.clear()); calling on already-empty
         // Map is a no-op. Fires once per loadCache() invocation across stale-cache scenarios
         // until a fresh saveCache(today) writes a new entry — harmless per Pitfall 8.
         sourceDiversityService.reset();
         return null;
       }
       ```
       The `sourceDiversityService` import was already added in Task 2 — no additional import line needed.

    2. CREATE `app/tests/services/source-diversity-day-boundary-reset.test.mjs`. Outcome-based per Pitfall 8 — assert end state, NOT mock.callCount. Pseudo-shape:
       ```javascript
       import { test } from 'node:test';
       import assert from 'node:assert/strict';
       import { readFileSync } from 'node:fs';
       import { sourceDiversityService } from '../../src/services/source-diversity.service.ts';

       const SRC = readFileSync(new URL('../../src/services/concept-feed.service.ts', import.meta.url), 'utf8');

       test('loadCache date-mismatch branch calls sourceDiversityService.reset()', () => {
         // Source-reading: assert the reset() call sits inside the date-mismatch branch.
         // Window-based — find the `if (parsed.date !== today())` line and confirm
         // sourceDiversityService.reset() appears before `return null` in that block.
         const idx = SRC.indexOf('if (parsed.date !== today())');
         assert.ok(idx >= 0, 'date-mismatch branch found');
         const window = SRC.slice(idx, idx + 600);
         assert.match(window, /sourceDiversityService\.reset\(\)/);
         assert.match(window, /return null/);
         // Order check — reset must come BEFORE return.
         assert.ok(
           window.indexOf('sourceDiversityService.reset()') < window.indexOf('return null'),
           'reset() must precede return null in date-mismatch branch',
         );
       });

       test('reset() is wholesale wipe — getUsedDomains returns empty Set after reset', () => {
         sourceDiversityService.recordServedDomain('test-anchor-a', 'nature.com');
         sourceDiversityService.recordServedDomain('test-anchor-b', 'sciencedirect.com');
         assert.equal(sourceDiversityService.getUsedDomains('test-anchor-a').size, 1);
         assert.equal(sourceDiversityService.getUsedDomains('test-anchor-b').size, 1);

         sourceDiversityService.reset();

         assert.equal(sourceDiversityService.getUsedDomains('test-anchor-a').size, 0);
         assert.equal(sourceDiversityService.getUsedDomains('test-anchor-b').size, 0);
       });

       test('reset() is idempotent — calling twice still results in empty state', () => {
         sourceDiversityService.recordServedDomain('test-anchor-c', 'nytimes.com');
         sourceDiversityService.reset();
         sourceDiversityService.reset();  // second call — must not throw
         assert.equal(sourceDiversityService.getUsedDomains('test-anchor-c').size, 0);
       });
       ```
       NOTE: This test is OUTCOME-based per Pitfall 8 — it never asserts how many times `reset()` is called. It asserts that `usedDomains` is empty after the day-boundary path is taken.

    3. Run `node --test app/tests/services/source-diversity-day-boundary-reset.test.mjs` — must exit 0.
    4. Run `cd app && tsc -b --noEmit` — must exit 0.
    5. Commit atomically with `(41-01)` scope. Suggested message: `feat(41-01): reset sourceDiversityService at loadCache date boundary`.
  </action>
  <verify>
    <automated>node --test app/tests/services/source-diversity-day-boundary-reset.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/services/source-diversity-day-boundary-reset.test.mjs` exists
    - `grep -c "sourceDiversityService.reset()" app/src/services/concept-feed.service.ts` returns ≥ 1
    - In `app/src/services/concept-feed.service.ts`, the line `sourceDiversityService.reset()` appears within ~10 lines AFTER `if (parsed.date !== today())` and BEFORE `return null` in the same branch (verifiable with `awk '/if \(parsed.date !== today\(\)\)/,/return null/' app/src/services/concept-feed.service.ts | grep -c sourceDiversityService.reset` returns ≥ 1)
    - `node --test app/tests/services/source-diversity-day-boundary-reset.test.mjs` exits 0
    - `cd app && tsc -b --noEmit` exits 0
    - Test does NOT assert `mock.callCount === 1` (outcome-based per Pitfall 8) — verifiable via `! grep -q "callCount" app/tests/services/source-diversity-day-boundary-reset.test.mjs`
  </acceptance_criteria>
  <done>Day-boundary reset placed inside loadCache's date-mismatch branch (Pitfall 3 Option A); outcome-based regression test green; wholesale-wipe + idempotence both asserted.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Integration test for SC-1 (walker dismissedIds end-to-end) + SC-2(a)/(b) wiring assertions</name>
  <files>app/tests/services/concept-feed-source-diversity-wiring.test.mjs</files>
  <read_first>
    - app/src/services/concept-feed.service.ts (final state after Tasks 2 + 3 — for source-reading assertions)
    - app/src/services/post-queue.service.ts (walkDerivedList signature — required positional dismissedIds 3rd arg per Phase 39 D-07)
    - app/src/services/engagement.service.ts (dismissAnchor + getDismissedAnchorIds API)
    - app/src/services/source-diversity.service.ts (filterForDiversity + recordServedDomain API)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-RESEARCH.md § Pitfall 7 (target walkDerivedList directly, NOT a mocked refillQueue)
    - .planning/phases/41-pipeline-wiring-essay-depth/41-VALIDATION.md § Per-Task Verification Map (SC-1 + SC-2(a)/(b))
    - app/tests/services/derived-list.test.mjs (Phase 39 dismiss-skip cases — pattern reference for walker testing)
    - app/tests/services/source-diversity.service.test.mjs (Phase 40 behavioral pattern reference)
  </read_first>
  <behavior>
    - Test 1 (SC-1 integration): Populate engagementService.dismissAnchor('concept-X'), build a derivedList containing 'concept-X' and 'concept-Y', call postQueueService.walkDerivedList(N, new Set(), new Set(engagementService.getDismissedAnchorIds())) — assert returned conceptIds excludes 'concept-X' but includes 'concept-Y'
    - Test 2 (SC-2(a) source-reading): Both news call sites in concept-feed.service.ts pass a usedDomains Set obtained from sourceDiversityService.getUsedDomains BEFORE the webSearch call (regex window scan)
    - Test 3 (SC-2(b) behavioral rerank): Construct mock WebSearchResult[] with 3 entries (2 from `nature.com`, 1 from `mit.edu`); call sourceDiversityService.filterForDiversity with usedDomains containing 'nature.com'; assert filtered[0] is the mit.edu entry (unseen-first per Phase 40 D-06)
    - Test 4 (counterweight): concept-feed.service.ts contains the line `walkDerivedList(16, exploredIds, dismissedIds)` (Phase 39 wire intact — guards against regression)
    - Test 5 (counterweight): both news loops contain the recordServedDomain call AFTER the post commits (regex window check — recordServedDomain appears after `posts.push(` in the creation loop and after `preFetched.news.set(` in the pre-fetch loop)
  </behavior>
  <action>
    1. CREATE `app/tests/services/concept-feed-source-diversity-wiring.test.mjs`. Self-contained — no shared fixtures (per VALIDATION.md "Shared fixtures: not needed"). Pseudo-shape:
       ```javascript
       import { test } from 'node:test';
       import assert from 'node:assert/strict';
       import { readFileSync } from 'node:fs';
       import { engagementService } from '../../src/services/engagement.service.ts';
       import { postQueueService } from '../../src/services/post-queue.service.ts';
       import { sourceDiversityService } from '../../src/services/source-diversity.service.ts';

       const SRC = readFileSync(new URL('../../src/services/concept-feed.service.ts', import.meta.url), 'utf8');

       // ─── SC-1 integration ───────────────────────────────────────────────────────
       test('SC-1: walker skips dismissed concept end-to-end via engagementService → walkDerivedList', () => {
         engagementService.reset();  // clean slate
         engagementService.dismissAnchor('concept-X');

         // Build a minimal derivedList. postQueueService internal state setup —
         // mirror Phase 39 derived-list.test.mjs setup pattern (use the public
         // appendToDerivedList API or an equivalent state-injection helper).
         postQueueService.load();  // ensure fresh state
         postQueueService.appendToDerivedList(['concept-X', 'concept-Y', 'concept-Z']);

         const exploredIds = new Set();
         const dismissedIds = new Set(engagementService.getDismissedAnchorIds());

         const result = postQueueService.walkDerivedList(2, exploredIds, dismissedIds);

         assert.ok(!result.includes('concept-X'), 'dismissed concept must NOT appear in walker output');
         assert.ok(result.includes('concept-Y') || result.includes('concept-Z'), 'non-dismissed concepts available');

         // Cleanup
         engagementService.reset();
       });

       // ─── SC-2(a) source-reading ─────────────────────────────────────────────────
       test('SC-2(a): news creation loop reads usedDomains from sourceDiversityService BEFORE webSearch', () => {
         // Find the news creation loop block — bounded by 'webSearch(conceptName + \' latest research findings\''
         const matches = [...SRC.matchAll(/webSearch\(conceptName \+ ' latest research findings'/g)];
         assert.equal(matches.length, 2, 'expected 2 news call sites (creation + pre-fetch loops)');

         for (const m of matches) {
           // Window: 600 chars BEFORE the webSearch call
           const before = SRC.slice(Math.max(0, m.index - 600), m.index);
           assert.match(before, /sourceDiversityService\.getUsedDomains\(/, `getUsedDomains must precede webSearch at offset ${m.index}`);
         }
       });

       test('SC-2(a): both news call sites pass excludeDomains and maxResults: 3', () => {
         // Match all webSearch calls in news loops (excludes pre-validation/title-search loops)
         assert.equal(
           [...SRC.matchAll(/maxResults: 3, excludeDomains: \[\.\.\.usedDomains\]/g)].length,
           2,
           'expected 2 calls with maxResults: 3 + excludeDomains spread',
         );
       });

       // ─── SC-2(a) counterweight: recordServedDomain after commit ────────────────
       test('SC-2(a) counterweight: recordServedDomain appears AFTER posts.push (creation loop) and AFTER preFetched.news.set (pre-fetch loop)', () => {
         // Creation loop: recordServedDomain must appear AFTER the matching posts.push that
         // contains sourceType: 'news'. Approximate via regex window scan.
         const newsPush = SRC.indexOf("sourceType: 'news'");
         const recordIdx = SRC.indexOf('sourceDiversityService.recordServedDomain', newsPush);
         assert.ok(recordIdx > newsPush, 'recordServedDomain must follow news posts.push');

         // Pre-fetch loop: recordServedDomain must appear AFTER preFetched.news.set
         const preFetchSet = SRC.indexOf('preFetched.news.set(a.conceptId, chosen)');
         const preFetchRecord = SRC.indexOf('sourceDiversityService.recordServedDomain', preFetchSet);
         assert.ok(preFetchRecord > preFetchSet, 'recordServedDomain must follow preFetched.news.set in pre-fetch loop');
       });

       // ─── SC-2(b) behavioral rerank ─────────────────────────────────────────────
       test('SC-2(b): filterForDiversity prefers unseen domain in mixed input', () => {
         const mockResults = [
           { title: 'Nature paper 1', url: 'https://nature.com/article-1', content: 'snippet 1', score: 0.9 },
           { title: 'Nature paper 2', url: 'https://nature.com/article-2', content: 'snippet 2', score: 0.85 },
           { title: 'MIT research', url: 'https://mit.edu/research', content: 'snippet 3', score: 0.7 },
         ];
         const usedDomains = new Set(['nature.com']);

         const filtered = sourceDiversityService.filterForDiversity(mockResults, usedDomains);

         assert.ok(filtered.length >= 1, 'filtered must return at least 1 result');
         assert.match(filtered[0].url, /mit\.edu/, 'unseen mit.edu must rank above seen nature.com (Phase 40 D-06)');
       });

       // ─── Counterweight: Phase 39 walker wire intact ────────────────────────────
       test('counterweight: walker call at concept-feed.service.ts:~1212 still passes dismissedIds (Phase 39 wire untouched)', () => {
         assert.match(SRC, /walkDerivedList\(16, exploredIds, dismissedIds\)/);
         assert.match(SRC, /new Set\(engagementService\.getDismissedAnchorIds\(\)\)/);
       });
       ```
       Adjust the engagementService/postQueueService API calls if the actual public surface differs (consult the Phase 39 SUMMARY's "Phase 41 contract" subsection if the names differ; Tests should call the EXISTING public API, not introduce new exports).

    2. Run `node --test app/tests/services/concept-feed-source-diversity-wiring.test.mjs` — must exit 0 with all 6 assertions green.
    3. Run `cd app && npm test` — full suite green; pass count ≥ pre-Plan-41-01 baseline + ~6 (this file's new tests). The 2 pre-existing carry-over failures unchanged.
    4. Commit atomically with `(41-01)` scope. Suggested message: `test(41-01): integration test for walker dismissedIds + source-diversity wiring assertions`.
  </action>
  <verify>
    <automated>node --test app/tests/services/concept-feed-source-diversity-wiring.test.mjs && cd app && npm test</automated>
  </verify>
  <acceptance_criteria>
    - File `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` exists
    - `node --test app/tests/services/concept-feed-source-diversity-wiring.test.mjs` exits 0
    - File contains source-reading assertion: `grep -c "walkDerivedList(16, exploredIds, dismissedIds)" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns ≥ 1
    - File contains behavioral filterForDiversity test: `grep -c "filterForDiversity(mockResults, usedDomains)" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns ≥ 1
    - File contains SC-1 integration test: `grep -c "engagementService.dismissAnchor" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns ≥ 1
    - `cd app && npm test` pass count ≥ pre-Plan-41-01 baseline + new tests; only the 2 pre-existing carry-overs may fail
  </acceptance_criteria>
  <done>SC-1 integration test green (walker skips dismissed concepts end-to-end); SC-2(a) source-reading wiring assertions pass; SC-2(b) behavioral rerank test green; counterweight assertions guard Phase 39 walker wire and after-commit recordServedDomain ordering.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Plan close-out (full suite green check + state updates)</name>
  <files>.planning/STATE.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/phases/41-pipeline-wiring-essay-depth/41-01-refillqueue-source-diversity-wiring-SUMMARY.md</files>
  <read_first>
    - .planning/STATE.md (current position + last decisions section formats)
    - .planning/REQUIREMENTS.md (CONTENT-02 partial → complete promotion)
    - .planning/ROADMAP.md (Phase 41 plan list — mark 41-01 done)
    - .planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md (template for SUMMARY.md frontmatter shape)
  </read_first>
  <action>
    1. Run `cd app && npm test` and `cd app && tsc -b --noEmit` to capture final baseline.
    2. CREATE `.planning/phases/41-pipeline-wiring-essay-depth/41-01-refillqueue-source-diversity-wiring-SUMMARY.md` following the Phase 40 SUMMARY frontmatter shape. Include:
       - tags, dependency graph (requires Phase 39 + Phase 40 leaves), provides, affects, key-files, key-decisions, patterns-established
       - requirements-completed: [CONTENT-02, CONTENT-03 partial — multi-snippet shape lands here; LLM-side consumption lands in 41-02]
       - duration, completed date, commit hashes, deviations, test baselines
    3. Update `.planning/REQUIREMENTS.md`:
       - CONTENT-02: change status from `[~]` / `◐ Partial` to `[x]` (Phase 41 wires Tavily — completion criteria met)
       - Update traceability table row: `CONTENT-02 | Phase 40+41 | Wave 1+2 | ✓ Complete (Phase 40 leaf + Phase 41 wire)`
    4. Update `.planning/ROADMAP.md` Phase 41 plan list — mark `[x] 41-01-refillqueue-source-diversity-wiring-PLAN.md`.
    5. Update `.planning/STATE.md`:
       - Frontmatter: increment completed_plans counter
       - Add a "Last decisions (Plan 41-01 close, 2026-05-09)" section with key in-execution decisions
       - Update Stopped at: "Plan 41-01 complete — Plan 41-02 may proceed (parallel-safe Wave 2)"
    6. Commit atomically with `(41-01)` scope. Suggested message: `docs(41-01): close-out — CONTENT-02 complete, multi-snippet shape ready for 41-02 consumption`.
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit && npm test</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/41-pipeline-wiring-essay-depth/41-01-refillqueue-source-diversity-wiring-SUMMARY.md` exists with valid frontmatter
    - `.planning/REQUIREMENTS.md` shows CONTENT-02 as `[x]` Complete
    - `.planning/ROADMAP.md` Phase 41 plan list has `[x]` for 41-01
    - `.planning/STATE.md` has new "Last decisions (Plan 41-01 close)" section
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && npm test` pass count ≥ pre-Plan-41-01 baseline + ~9-12 new assertions (3 test files: web-search-exclude-domains + concept-feed-source-diversity-wiring + source-diversity-day-boundary-reset)
  </acceptance_criteria>
  <done>SUMMARY.md committed; REQUIREMENTS + ROADMAP + STATE updated; CONTENT-02 promoted from partial to complete; baseline preserved.</done>
</task>

</tasks>

<verification>
After all 5 tasks complete:

1. `cd app && tsc -b --noEmit` exits 0
2. `cd app && npm test` pass count ≥ (pre-Plan-41-01 baseline + 9 new assertions across 3 new test files)
3. The 2 pre-existing carry-over failures from Phase 40 SUMMARY remain unchanged (concept-feed.test.mjs ERR_MODULE_NOT_FOUND + trellis-layout date assertion)
4. `grep -c "sourceDiversityService" app/src/services/concept-feed.service.ts` returns ≥ 5 (2× getUsedDomains + 2× filterForDiversity + 2× recordServedDomain + 1× reset)
5. `grep -c "exclude_domains" app/src/services/web-search.service.ts` returns ≥ 1
6. Each task = one atomic commit with `(41-01)` scope
</verification>

<success_criteria>
- SC-1 (walker skips dismissed concept) — integration test green via Task 4
- SC-2(a) (Tavily call passes usedDomains) — source-reading + behavioral via Tasks 2 + 4
- SC-2(b) (consecutive calls return different top domains) — behavioral test via Task 4
- SC-2(c) (WebSearchOptions.excludeDomains threads to Tavily exclude_domains) — Task 1
- SC-2(d) (loadCache day-boundary fires reset) — Task 3
- CONTENT-02 promoted from `◐ Partial` to `✓ Complete` in REQUIREMENTS.md
- newsMeta.sources shape extended to multi-snippet (filtered.slice(0,3)) — enables Plan 41-02 SC-4 (`sources.slice(0,3)` in generateNewsEssay)
- bodyMarkdown:'' invariant preserved at news creation — CLAUDE.md "News post pipeline" rule held
- Walker wire at concept-feed.service.ts:1212 untouched — Phase 39 D-07 invariant held
- Wave 1 plan; Plan 41-02 sequenced into Wave 2 (file-level overlap on concept-feed.service.ts means parallel writes would corrupt regardless of textual line distance)
</success_criteria>

<output>
After completion, create `.planning/phases/41-pipeline-wiring-essay-depth/41-01-refillqueue-source-diversity-wiring-SUMMARY.md` with:
- Frontmatter (tags, dependency graph, provides, affects, key-files, key-decisions, patterns-established, requirements-completed [CONTENT-02], duration, completed)
- Sections: Performance, Accomplishments, Task Commits, Files Created/Modified, Test Baselines, Decisions Made, Deviations from Plan (auto-fixed issues), Issues Encountered, User Setup Required, Next Phase Readiness, Self-Check
</output>
</output>
