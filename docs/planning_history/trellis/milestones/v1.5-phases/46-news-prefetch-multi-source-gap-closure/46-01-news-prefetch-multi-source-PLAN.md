---
phase: 46-news-prefetch-multi-source-gap-closure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/services/news-source-metadata.ts
  - app/src/services/concept-feed.service.ts
  - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
  - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VERIFY.md
  - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
  - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-01-news-prefetch-multi-source-SUMMARY.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
autonomous: true
requirements: [CONTENT-03]
gap_closure: true
must_haves:
  truths:
    - "Queued news posts generated from refillQueue prefetch can carry 2-3 Tavily sources into newsMeta.sources."
    - "Direct no-prefetch news generation still uses the same top-source selection helper that applies filterForDiversity and slice(0, 3)."
    - "generateNewsEssay continues to consume sources.slice(0, 3), with no prompt rewrite."
    - "CONTENT-03 can be marked complete after targeted regression, build, lint, and test evidence is recorded."
  artifacts:
    - path: "app/src/services/news-source-metadata.ts"
      provides: "Testable production helpers for selecting top Tavily sources and mapping stable newsMeta source indexes"
      exports: ["selectNewsTopSources", "mapNewsSourcesToNewsMeta"]
    - path: "app/src/services/concept-feed.service.ts"
      provides: "PreFetchCache.news array cache and cached-news topSources wiring through news-source-metadata helpers"
      contains: "news: Map<string, WebSearchResult[]>"
    - path: "app/tests/services/concept-feed-source-diversity-wiring.test.mjs"
      provides: "Regression proving queued-news prefetch stores topSources and cached generation maps them into newsMeta.sources"
      contains: "queued-news prefetch preserves multiple sources"
    - path: ".planning/phases/46-news-prefetch-multi-source-gap-closure/46-VERIFY.md"
      provides: "Final command evidence for Phase 46"
    - path: ".planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md"
      provides: "Nyquist sign-off flipped to validated/compliant"
  key_links:
    - from: "app/src/services/concept-feed.service.ts refillQueue prefetch loop"
      to: "app/src/services/news-source-metadata.ts selectNewsTopSources"
      via: "topSources = selectNewsTopSources(results.data.results, usedDomains)"
      pattern: "selectNewsTopSources\\(results\\.data\\.results, usedDomains\\)"
    - from: "app/src/services/concept-feed.service.ts generatePostBatch cached news branch"
      to: "newsMeta.sources"
      via: "topSources = cached.slice(0, 3) then sources: mapNewsSourcesToNewsMeta(topSources)"
      pattern: "topSources = cached\\.slice\\(0, 3\\)[\\s\\S]*sources: mapNewsSourcesToNewsMeta\\(topSources\\)"
    - from: "app/src/services/concept-feed.service.ts refillQueue prefetch loop"
      to: "PreFetchCache.news"
      via: "preFetched.news.set(a.conceptId, topSources)"
      pattern: "preFetched\\.news\\.set\\(a\\.conceptId, topSources\\)"
    - from: "app/src/services/post-essay.service.ts generateNewsEssay"
      to: "DailyPost.newsMeta.sources"
      via: "sources.slice(0, 3)"
      pattern: "sources\\s*\\.slice\\(0, 3\\)"
---

<objective>
Close the Phase 46 CONTENT-03 milestone-audit gap by carrying the filtered top 2-3 Tavily results through queued-news prefetch into `newsMeta.sources`.

Purpose: Normal queued news posts must receive the same multi-snippet grounding as the direct no-prefetch news generation path.
Output: One scoped service fix, one targeted regression update, and final Phase 46 verification/close-out artifacts.
</objective>

<execution_context>
@/Users/Code/EchoLearn/.codex/get-shit-done/workflows/execute-plan.md
@/Users/Code/EchoLearn/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/v1.5-MILESTONE-AUDIT.md
@.planning/phases/46-news-prefetch-multi-source-gap-closure/46-CONTEXT.md
@.planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
@CLAUDE.md
@AGENTS.md
@app/src/services/concept-feed.service.ts
@app/src/services/post-essay.service.ts
@app/tests/services/concept-feed-source-diversity-wiring.test.mjs
@app/package.json

<interfaces>
Current implementation seams extracted before planning:

New helper contract to introduce in `app/src/services/news-source-metadata.ts`:
```typescript
export function selectNewsTopSources(
  results: WebSearchResult[],
  usedDomains: Set<string>,
): WebSearchResult[];

export function mapNewsSourcesToNewsMeta(
  topSources: WebSearchResult[],
): NonNullable<DailyPost['newsMeta']>['sources'];
```

From `app/src/services/concept-feed.service.ts`:
```typescript
interface PreFetchCache {
  youtube: Map<string, YouTubeSearchResult[]>;
  news: Map<string, WebSearchResult[]>; // after this plan, keyed by conceptId
}

const cached = preFetched?.news.get(a.conceptId);
let result: WebSearchResult | undefined;
let topSources: WebSearchResult[] = [];
if (cached?.length) {
  result = cached[0];
  topSources = cached.slice(0, 3);
} else {
  const usedDomains = sourceDiversityService.getUsedDomains(a.conceptId);
  const searchResult = await webSearch(
    conceptName + ' latest research findings',
    { maxResults: 3, excludeDomains: [...usedDomains] },
  );
  if (searchResult.success && searchResult.data?.results.length) {
    topSources = selectNewsTopSources(searchResult.data.results, usedDomains);
    result = topSources[0];
  }
}

newsMeta: {
  sources: mapNewsSourcesToNewsMeta(topSources),
  fetchedAt: Date.now(),
}

const topSources = selectNewsTopSources(results.data.results, usedDomains);
const chosen = topSources[0];
preFetched.news.set(a.conceptId, topSources);
```

From `app/src/services/post-essay.service.ts`:
```typescript
const sources = post.newsMeta?.sources ?? [];
const sourceText = sources
  .slice(0, 3)
  .map(s => {
    const head = `[${s.index}] ${s.title} - ${s.url}`;
    return s.snippet ? `${head}\n${s.snippet}` : head;
  })
  .join('\n\n');
```
</interfaces>

Do not broaden scope into Tavily ranking/domain scoring, prompt wording, domain-tier changes, queue refactors, or a new news service. Preserve the `bodyMarkdown: ''` news creation invariant from `CLAUDE.md`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add RED regression for queued-news prefetch multi-source cache</name>
  <files>app/tests/services/concept-feed-source-diversity-wiring.test.mjs</files>
  <read_first>
    - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
    - app/src/services/concept-feed.service.ts
    - app/src/services/post-essay.service.ts
    - .planning/v1.5-MILESTONE-AUDIT.md
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-CONTEXT.md
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
    - CLAUDE.md
  </read_first>
  <behavior>
    - Test 1 behavioral: With mocked Tavily results containing at least three distinct URLs/snippets, `selectNewsTopSources(mockedResults, usedDomains)` followed by `mapNewsSourcesToNewsMeta(topSources)` must produce `newsMetaSources.length >= 2`, stable indexes `[1, 2, ...]`, and preserve title/url/snippet values. This is the primary regression, not a source-reading substitute.
    - Test 2 source-reading: `PreFetchCache.news` must be `Map<string, WebSearchResult[]>`, not `Map<string, WebSearchResult>`.
    - Test 3 source-reading: The cached news branch must assign `result = cached[0]`, `topSources = cached.slice(0, 3)`, and `sources: mapNewsSourcesToNewsMeta(topSources)`; it must not contain `topSources = [cached]`.
    - Test 4 source-reading: The refillQueue prefetch loop must call `selectNewsTopSources(results.data.results, usedDomains)`, store `topSources` with `preFetched.news.set(a.conceptId, topSources)`, and never store `chosen`.
    - Test 5 source-reading: The direct no-prefetch branch must call `selectNewsTopSources(searchResult.data.results, usedDomains)`, and `generateNewsEssay` must still consume `sources.slice(0, 3)`.
  </behavior>
  <action>
    Update the existing test file, not a new test file. Add a new `describe('CONTENT-03: queued-news prefetch preserves multiple sources', ...)` block with one behavioral test and supplemental source-reading tests.

    Behavioral regression:
    - Dynamically import `selectNewsTopSources` and `mapNewsSourcesToNewsMeta` from `../../src/services/news-source-metadata.ts`.
    - Use mocked Tavily-style `WebSearchResult` objects, for example three entries with titles `Source A/B/C`, URLs on different domains, and snippets `snippet A/B/C`.
    - Call `const topSources = selectNewsTopSources(mockResults, new Set())`.
    - Call `const newsMetaSources = mapNewsSourcesToNewsMeta(topSources)`.
    - Assert `newsMetaSources.length >= 2`, assert `newsMetaSources.map(s => s.index)` equals `[1, 2, 3]` for three returned sources, and assert the first two entries preserve title/url/snippet from the mocked Tavily results.

    Supplemental source-reading regression:
    - Continue using `readFileSync` on `concept-feed.service.ts` and `post-essay.service.ts`.
    - Replace the old prefetch counterweight that searches for `preFetched.news.set(a.conceptId, chosen)` with the new required cache contract:
    - `preFetched.news.set(a.conceptId, topSources)`
    - `selectNewsTopSources(results.data.results, usedDomains)`
    - `selectNewsTopSources(searchResult.data.results, usedDomains)`
    - `sources: mapNewsSourcesToNewsMeta(topSources)`
    - `const chosen = topSources[0]` is allowed only for title/domain selection; `const chosen = filtered[0]` must be absent.

    Keep the existing Phase 39 walker and non-obsolete Phase 41 source-diversity assertions intact. Task 2 will replace the old direct `filterForDiversity` invocation-count assertion because the production call moves into `news-source-metadata.ts`. This task intentionally creates a RED regression before Task 2 changes production code.
  </action>
  <verify>
    <automated>cd app && (node --test tests/services/concept-feed-source-diversity-wiring.test.mjs; test "$?" -ne 0)</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "queued-news prefetch preserves multiple sources" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 1 match.
    - `rg -n "selectNewsTopSources|mapNewsSourcesToNewsMeta" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 2 matches.
    - `rg -n "newsMetaSources\\.length|map\\(s => s\\.index\\)|\\[1, 2, 3\\]" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 1 match.
    - `rg -n "Map<string, WebSearchResult\\[\\]>" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 1 match.
    - `rg -n "topSources = cached\\.slice\\(0, 3\\)" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 1 match.
    - The RED command exits 0 because the updated test suite currently fails against the old one-source prefetch cache.
  </acceptance_criteria>
  <done>The regression describes the exact CONTENT-03 gap and fails before the production fix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Carry top 2-3 Tavily results through PreFetchCache.news</name>
  <files>app/src/services/news-source-metadata.ts, app/src/services/concept-feed.service.ts, app/tests/services/concept-feed-source-diversity-wiring.test.mjs</files>
  <read_first>
    - app/src/services/concept-feed.service.ts
    - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
    - app/src/services/post-essay.service.ts
    - .planning/v1.5-MILESTONE-AUDIT.md
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-CONTEXT.md
    - CLAUDE.md
  </read_first>
  <behavior>
    - Cached queued-news generation preserves every prefetched Tavily result up to three sources.
    - The first cached source still drives the news title, teaser, and source-diversity domain record.
    - Direct no-prefetch behavior uses the same production helper that filters source diversity and slices the top three results.
    - `bodyMarkdown: ''` remains unchanged so PostDetail continues streaming news bodies on open.
  </behavior>
  <action>
    Create `app/src/services/news-source-metadata.ts` as a small leaf helper module so the behavioral test can exercise real production code without importing the full `concept-feed.service.ts` chain:
    - Import `type { DailyPost, WebSearchResult }` from `../types`.
    - Import `{ sourceDiversityService }` from `./source-diversity.service.ts`.
    - Export `selectNewsTopSources(results: WebSearchResult[], usedDomains: Set<string>): WebSearchResult[]` that returns `sourceDiversityService.filterForDiversity(results, usedDomains).slice(0, 3)`.
    - Export `mapNewsSourcesToNewsMeta(topSources: WebSearchResult[]): NonNullable<DailyPost['newsMeta']>['sources']` that returns `topSources.slice(0, 3).map((r, i) => ({ index: i + 1, title: r.title, url: r.url, snippet: r.content }))`.

    In `app/src/services/concept-feed.service.ts`, make only these scoped edits:

    1. Change `PreFetchCache.news` from `Map<string, WebSearchResult>` to `Map<string, WebSearchResult[]>`.
    2. Import `selectNewsTopSources` and `mapNewsSourcesToNewsMeta` from `./news-source-metadata.ts`.
    3. In `generatePostBatch` news loop, treat `const cached = preFetched?.news.get(a.conceptId)` as an array. Use:
       - `if (cached?.length) {`
       - `result = cached[0];`
       - `topSources = cached.slice(0, 3);`
       - `} else { ...existing direct webSearch path... }`
       In the direct branch, replace the local `filtered`/`slice` pair with `topSources = selectNewsTopSources(searchResult.data.results, usedDomains); result = topSources[0];`.
       In `newsMeta`, replace the inline `topSources.map(...)` with `sources: mapNewsSourcesToNewsMeta(topSources)`.
    4. In the `refillQueue` news prefetch loop, replace `const filtered = ...; const chosen = filtered[0]; preFetched.news.set(a.conceptId, chosen);` with:
       - `const topSources = selectNewsTopSources(results.data.results, usedDomains);`
       - `const chosen = topSources[0];`
       - `if (!chosen) { failedIds.add(a.conceptId); return; }`
       - `preFetched.news.set(a.conceptId, topSources);`
       Keep `const domain = extractDomain(chosen.url); if (domain) sourceDiversityService.recordServedDomain(a.conceptId, domain);` after the cache set.
    5. Update only adjacent comments that now lie about Tavily `maxResults:1`, single chosen result storage, or one-element cached `topSources`. The new comments must say the prefetch loop stores the filtered top 2-3 results and the cached branch maps up to three entries into `newsMeta.sources`.
    6. Update `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` to remove or replace the obsolete Phase 41 assertion that expected exactly two direct `sourceDiversityService.filterForDiversity(...)` calls inside `concept-feed.service.ts`. Preserve the same invariant with three checks instead:
       - Read `app/src/services/news-source-metadata.ts` and assert it calls `sourceDiversityService.filterForDiversity(results, usedDomains).slice(0, 3)` or the exact equivalent split across adjacent statements.
       - Assert `app/src/services/concept-feed.service.ts` calls `selectNewsTopSources(searchResult.data.results, usedDomains)` in the direct no-prefetch path and `selectNewsTopSources(results.data.results, usedDomains)` in the queued-prefetch path.
       - Keep the behavioral regression that proves `newsMetaSources.length >= 2` and stable indexes `[1, 2, ...]` from `mapNewsSourcesToNewsMeta(topSources)`.

    Do not edit `post-essay.service.ts`, Tavily ranking/domain scoring, prompt wording, style assignment, queue sizing, or `bodyMarkdown: ''`.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "export function selectNewsTopSources|export function mapNewsSourcesToNewsMeta" app/src/services/news-source-metadata.ts` returns 2 matches.
    - `rg -n "filterForDiversity\\(results, usedDomains\\)\\.slice\\(0, 3\\)" app/src/services/news-source-metadata.ts` returns exactly 1 match.
    - `rg -n "index: i \\+ 1" app/src/services/news-source-metadata.ts` returns exactly 1 match.
    - `rg -n "filterForDiversity\\(results, usedDomains\\).*slice\\(0, 3\\)|filterForDiversity\\(results, usedDomains\\)" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 1 match proving the test now verifies `news-source-metadata.ts`, not only `concept-feed.service.ts`.
    - `rg -n "expected exactly 2 actual filterForDiversity invocations|callSiteMatches\\.length,\\s*2" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns no matches.
    - `rg -n "selectNewsTopSources\\(searchResult\\.data\\.results, usedDomains\\)|selectNewsTopSources\\(results\\.data\\.results, usedDomains\\)" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 2 matches.
    - `rg -n "newsMetaSources\\.length.*>= 2|newsMetaSources\\.map\\(s => s\\.index\\)|\\[1, 2, 3\\]" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 2 matches.
    - `rg -n "selectNewsTopSources|mapNewsSourcesToNewsMeta" app/src/services/concept-feed.service.ts` returns at least 4 matches.
    - `rg -n "news: Map<string, WebSearchResult\\[\\]>" app/src/services/concept-feed.service.ts` returns exactly 1 match.
    - `rg -n "topSources = cached\\.slice\\(0, 3\\)" app/src/services/concept-feed.service.ts` returns exactly 1 match.
    - `rg -n "topSources = \\[cached\\]" app/src/services/concept-feed.service.ts` returns no matches.
    - `rg -n "const topSources = selectNewsTopSources\\(results\\.data\\.results, usedDomains\\)" app/src/services/concept-feed.service.ts` returns exactly 1 match in the prefetch loop.
    - `rg -n "topSources = selectNewsTopSources\\(searchResult\\.data\\.results, usedDomains\\)" app/src/services/concept-feed.service.ts` returns exactly 1 match in the direct no-prefetch branch.
    - `rg -n "preFetched\\.news\\.set\\(a\\.conceptId, topSources\\)" app/src/services/concept-feed.service.ts` returns exactly 1 match.
    - `rg -n "const chosen = filtered\\[0\\]" app/src/services/concept-feed.service.ts` returns no matches.
    - `rg -n "sources\\.slice\\(0, 3\\)" app/src/services/post-essay.service.ts` still returns at least 1 match.
    - The targeted test command exits 0.
  </acceptance_criteria>
  <done>Queued-news prefetch stores top source arrays, cached generation writes those arrays into `newsMeta.sources`, and the direct path uses the same tested top-source selection helper.</done>
</task>

<task type="auto">
  <name>Task 3: Record final verification and mark CONTENT-03 ready for milestone re-audit</name>
  <files>.planning/phases/46-news-prefetch-multi-source-gap-closure/46-VERIFY.md, .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md, .planning/phases/46-news-prefetch-multi-source-gap-closure/46-01-news-prefetch-multi-source-SUMMARY.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/STATE.md</files>
  <read_first>
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-CONTEXT.md
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
    - .planning/v1.5-MILESTONE-AUDIT.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - app/package.json
  </read_first>
  <action>
    Run and record these commands in a new `46-VERIFY.md` with command, exit code, and short result:
    - `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs`
    - `cd app && npm run build`
    - `cd app && npm run lint`
    - `cd app && npm test`

    If `npm test` exits 0 because `package.json` chains `test:main; test:actions`, still record any known `test:main` baseline lines. Do not fix the known deferred `app/tests/concept-feed.test.mjs` stale `buildFallbackPosts` contract in this phase.

    Update `46-VALIDATION.md` frontmatter to `status: validated`, `nyquist_compliant: true`, and `wave_0_complete: true`. In its verification map, mark `46-FIX-01` and `46-CLOSE-01` as pass. Check all validation sign-off boxes and set approval to `validated 2026-05-13`.

    Update `.planning/REQUIREMENTS.md` so `CONTENT-03` is checked `[x]` and its traceability row says Phase 41+46 / Wave 2+5 / Complete after Phase 46 queued-news prefetch closure.

    Update `.planning/ROADMAP.md` Phase 46 with `Plans: 1/1 plans complete`, mark `46-01-news-prefetch-multi-source-PLAN.md` checked, and set the Progress table row for Phase 46 to `1/1 | Complete | 2026-05-13`.

    Update `.planning/STATE.md` with a concise last-decisions block stating that Phase 46 closed CONTENT-03 by changing `PreFetchCache.news` to top-source arrays, routing both direct and queued-prefetch paths through the tested top-source helper, and adding the queued-prefetch behavioral regression. Keep the next action as rerun `$gsd-audit-milestone 1.5`, then `$gsd-complete-milestone 1.5`.

    Create `.planning/phases/46-news-prefetch-multi-source-gap-closure/46-01-news-prefetch-multi-source-SUMMARY.md` with the changed files, test evidence, and explicit note that Tavily ranking/domain scoring, prompt wording, and broad concept-feed refactors stayed out of scope.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs && npm run build && npm run lint && npm test</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "status: validated" .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md` returns exactly 1 match.
    - `rg -n "nyquist_compliant: true" .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md` returns exactly 1 match.
    - `rg -n "\\[x\\] \\*\\*CONTENT-03\\*\\*" .planning/REQUIREMENTS.md` returns exactly 1 match.
    - `rg -n "46-01-news-prefetch-multi-source-PLAN.md" .planning/ROADMAP.md` returns at least 1 match and the Phase 46 plan list row is checked.
    - `rg -n "PreFetchCache.news.*top-source arrays|top-source arrays.*PreFetchCache.news" .planning/STATE.md .planning/phases/46-news-prefetch-multi-source-gap-closure/46-01-news-prefetch-multi-source-SUMMARY.md` returns at least 1 match.
    - `rg -n "Tavily ranking|prompt wording|concept-feed refactors" .planning/phases/46-news-prefetch-multi-source-gap-closure/46-01-news-prefetch-multi-source-SUMMARY.md` returns at least 1 match.
  </acceptance_criteria>
  <done>Phase 46 verification evidence is durable, CONTENT-03 is ready for milestone re-audit, and the phase close-out docs reflect the narrow scope.</done>
</task>

</tasks>

<verification>
Required automated checks:
- `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs`
- `cd app && npm run build`
- `cd app && npm run lint`
- `cd app && npm test`

Required source checks:
- `PreFetchCache.news` is an array cache.
- The refillQueue prefetch loop stores `topSources`.
- The generatePostBatch cached branch slices cached top sources.
- Both queued-prefetch and direct no-prefetch branches use `selectNewsTopSources`.
- `newsMeta.sources` is built by `mapNewsSourcesToNewsMeta` with stable indexes.
- `generateNewsEssay` still uses `sources.slice(0, 3)`.
</verification>

<success_criteria>
CONTENT-03 is closed when queued-news prefetch preserves the filtered top 2-3 Tavily results into `newsMeta.sources`, the targeted regression passes, full build/lint/test evidence is recorded, and the milestone audit can be rerun without the prior prefetch cache-shape gap.
</success_criteria>

<output>
After completion, create `.planning/phases/46-news-prefetch-multi-source-gap-closure/46-01-news-prefetch-multi-source-SUMMARY.md`.
</output>
