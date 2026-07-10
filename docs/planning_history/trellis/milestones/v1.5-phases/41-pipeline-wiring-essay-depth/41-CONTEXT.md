---
phase: 41-pipeline-wiring-essay-depth
status: ready-for-planning
gathered: 2026-05-09
requirements: [CONTENT-01, CONTENT-03, CONTENT-04]
---

# Phase 41: Pipeline Wiring + Essay Depth — Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire Wave-1 leaf services (Phase 39 engagement + Phase 40 source-diversity) into `concept-feed.service.ts:refillQueue`'s news branch, lengthen the essay path with a `depth: 'deep'` variant, polish citation rendering, and audit abort-signal threading across the PostDetailScreen essay `useEffect`. Closes CONTENT-02 from `◐ Partial` → `✓ Complete` (the wiring) and adds CONTENT-01, CONTENT-03, CONTENT-04 (the essay/UI work).

**Files in scope (4):**
1. `app/src/services/concept-feed.service.ts` — news call sites at `:1093` (creation loop) and `:1296` (pre-fetch loop) consume `sourceDiversityService.getUsedDomains` + `filterForDiversity` + `recordServedDomain`; `loadCache()` day-boundary calls `sourceDiversityService.reset()`. Walker third-arg is **already wired** at `:1212` (Phase 39 landed this).
2. `app/src/services/web-search.service.ts` — `WebSearchOptions` gains `excludeDomains?: string[]`; passed to Tavily payload's `exclude_domains` field.
3. `app/src/services/post-essay.service.ts` — `EssayOptions` gains `depth?: 'standard' | 'deep'`; `generateNewsEssay` (and any other essay generator) consumes `sources.slice(0, 3)` with footnote-aware prompt; `generateEssayMeta` body-slice cap raised 2000→4000; `generateConnectionPost` and `generateDiscoverPost` accept `signal?: AbortSignal` and propagate to `chatStream`.
4. `app/src/screens/PostDetailScreen.tsx` — essay `useEffect`'s 3 async branches all thread the AbortController signal AND have `if (signal.aborted) return` guards; `Markdown.tsx` (or PostDetailScreen's local `<Markdown>` usage) gains ReactMarkdown component overrides for `sup` / `a` / `section` to render footnote chips + custom footnote section.

**Out of scope (deferred to Phase 43):**
- The "Deep dive" **button** in PostDetailScreen — Phase 43 SC-3. Phase 41 ships the API + tests only; the button that calls `generatePostEssay(post, questions, { depth: 'deep' })` is Phase 43's job.
- Long-press contextual menu calling `engagementService.{savePost, likePost, dismissAnchor}` — Phase 43.
- `engagementService.reset()` call in `handleForceNewDay` — Phase 43 SC-6.
- Saved-posts view route — Phase 43 SC-2.

**Out of scope (deferred to Phase 42):**
- Masonry layout, vine-bloom celebration card.

</domain>

<decisions>
## Implementation Decisions

### Plan grouping (D-01)

- **D-01:** **Two plans, parallel-safe.**
  - **Plan 41-01:** refillQueue news-branch wiring + `web-search.service.ts` `excludeDomains` option. Covers SC-1 (integration test for dismissedIds; walker is already wired) + SC-2 (Tavily exclude_domains, filterForDiversity rerank, recordServedDomain commit, reset day-boundary).
  - **Plan 41-02:** Essay-depth + multi-snippet grounding + meta cap raise + abort-threading audit + citation rendering. Covers SC-3 (`depth: 'deep'` 350-600w), SC-4 (`sources.slice(0, 3)` grounding), SC-5 (ReactMarkdown sup/a/section overrides + LLM footnote prompt), SC-6 (body-slice cap 2000→4000), SC-7 (signal threading on `generateConnectionPost` + `generateDiscoverPost`).
  - **Why:** The two plans touch disjoint file sets (Plan 41-01: concept-feed + web-search + tests; Plan 41-02: post-essay + PostDetailScreen + Markdown overrides + tests). No shared mutable code path. Parallel-safe — can execute in one wave with two executors. Each plan ~5-7 atomic commits matching Phase 39/40 cadence. Rejected alternatives: single plan (no parallel speedup; bigger blast radius); four plans (file-level granularity creates an awkward dependency chain — 41-02 web-search-options must land before 41-01's tests can pass).

### Tavily news maxResults widening (D-02)

- **D-02:** **`maxResults: 3` at the news call sites.** Update both `concept-feed.service.ts:1093` (`{ maxResults: 1 }` → `{ maxResults: 3 }`) and `:1296` (same edit). The webSearch function's default at `web-search.service.ts:43` already returns 5 when `maxResults` is unspecified, but the news call sites override; Phase 41 raises that override to 3.
  - **Why:** Conservative — minimum value for `filterForDiversity`'s two-pass split to be meaningful (need ≥2 to have a "unseen vs seen" distinction; 3 leaves headroom for the D-06 fallback when 2 are already-seen). Tavily charges per call (not per result), so 3 vs 5 vs 10 has zero API-cost impact — but more results = more snippet text fed to the LLM via SC-4's `sources.slice(0, 3)`. With `maxResults: 3` and slice(0, 3), every result fetched is consumed by the essay, no waste. If a future audit shows weak diversity (e.g., users complain "same source twice"), bump to 5 in a single-line edit. Rejected: 5 (more LLM tokens for no rerank benefit at 3-source slice cap); 10 (Tavily basic-search degrades past ~5; mostly thin-quality results).

### Deep-dive caching strategy (D-03)

- **D-03:** **Parallel cache via new `bodyMarkdownDeep?: string` field on `EssayContent`.**
  - Schema: `EssayContent = { bodyMarkdown, bodyMarkdownDeep?, whyCare, takeaway, quickAskPrompts }`. `bodyMarkdown` continues to hold the 150-250w standard variant (default). `bodyMarkdownDeep` holds the 350-600w deep variant when generated.
  - `patchPostEssayInCache(postId, essay)` extends to merge depth-keyed fields — passing `{ bodyMarkdownDeep }` only updates that field; standard cache stays intact.
  - Phase 43's "Deep dive" button toggles render between `post.bodyMarkdown` and `post.bodyMarkdownDeep`; if deep is missing, button triggers a fresh `generatePostEssay(post, questions, { depth: 'deep' })` stream and patches the field on completion.
  - **Why:** Each variant is generated at most once per post; toggle is free after both exist. Token cost paid once per variant, not per press. Schema additive (back-compat — old cached essays stay valid; new field is optional). Rejected: replace standard with deep (one-way ratchet — losing standard means losing the fast teaser; bad UX); no caching for deep (every press costs an LLM call — expensive for repeat readers); cache-key extends with depth (heavier plumbing change for the same end state).
  - **Implementation note:** When `EssayOptions.depth` is undefined or `'standard'`, generators write to `bodyMarkdown` (current behavior). When `'deep'`, generators write to `bodyMarkdownDeep`. The PostDetailScreen `useEffect` decides which field to patch based on which depth was requested.

### Citation prompting + rendering shape (D-04)

- **D-04:** **LLM emits markdown footnote syntax (`[^N]` markers + `[^N]: …` section); ReactMarkdown component overrides style sup/a/section.**
  - **Prompt change:** `generateNewsEssay`'s system prompt gains an explicit instruction: "Cite each factual claim with `[^1]`, `[^2]`, `[^3]` markers tied to the source list above. Emit a footnotes section at the end as `[^1]: <title>` for each cited source." The user-content block continues to include the indexed source list (already at `post-essay.service.ts:139-144`).
  - **Rendering change:** `Markdown.tsx` gains a `components` prop on `<ReactMarkdown>` with overrides for `sup` (superscript chip with subtle background + smaller font + click target), `a` (footnote return-link styling when `href` starts with `#fn-`), and `section` (custom container for `className="footnotes"` from remark-gfm). The `<sup>` tag is **already in the sanitize allowlist** at `Markdown.tsx:14`.
  - **Why:** `remark-gfm` is already in the plugin chain at `Markdown.tsx:36`, parses `[^N]` syntax into `<sup>` + `<section>` automatically. Phase 41 only needs to (a) instruct the LLM to emit the syntax, (b) style the parsed output. Single-source-of-truth rendering: same chip style applies to news essays AND any other essay branch that opts to cite. No raw HTML emission, no rehype-raw escape hatch (preserves the sanitize boundary). Rejected: inline `<sup data-cite='1'>` raw HTML (existing chat pattern at `ChatMessage.tsx:styleCitationTags` — works for chat but lacks auto-section + relies on rehype-raw); dual-path (more test surface, no clear back-compat need since posts don't accumulate old citation shapes).
  - **Test surface:** Visual + DOM-snapshot test asserts the rendered output of a footnote-bearing markdown string contains `<sup>` chips + `<section className="footnotes">`. Source-reading test asserts `generateNewsEssay`'s system prompt contains the footnote instruction string.

### Carried-Forward Decisions (Locked by Prior Phases — NOT Re-Discussed)

- **Walker dismissedIds is already wired (Phase 39):** `concept-feed.service.ts:1212` already calls `walkDerivedList(16, exploredIds, dismissedIds)` with `dismissedIds = new Set(engagementService.getDismissedAnchorIds())`. Phase 41 SC-1 only needs the **integration test** asserting end-to-end behavior (dismiss anchor X via `engagementService.dismissAnchor('X')`, run a refill cycle, assert no post for X is enqueued).
- **Source-diversity API contract (Phase 40 D-12..D-15):** Singleton `sourceDiversityService` with 5 functions; `extractDomain(url)` exported for Phase 41's `recordServedDomain(anchorId, extractDomain(url))` pattern.
- **Best-of-the-bad fallback (Phase 40 D-06):** Phase 41 just calls `filterForDiversity` and uses the returned array verbatim; no fallback logic at the call site.
- **`reset()` is wholesale wipe, not event-driven (Phase 40 D-14):** Phase 41 calls `sourceDiversityService.reset()` directly inside `loadCache()`'s date-mismatch branch alongside the existing reset hooks; no `DOMAIN_RESET` event introduced.
- **Phase 43 owns `engagementService.reset()` in Force-New-Day** — Phase 41 does NOT touch the dev affordance.
- **Phase 43 owns the "Deep dive" button UI** — Phase 41 ships only the `EssayOptions.depth` API + tests.
- **Atomic per-file commits (Phase 37 D-03):** Each task = one file = one commit; paired source+test commits where the test guards the change.
- **Source-reading invariant test pattern (Phase 27/35/37/39/40):** Phase 41 adds source-reading assertions for: (a) news call sites pass `excludeDomains` from `getUsedDomains`, (b) `generateNewsEssay` consumes `sources.slice(0, 3)` not `sources[0]`, (c) `generateNewsEssay` system prompt contains the footnote instruction, (d) all 3 async branches in `PostDetailScreen.tsx`'s essay `useEffect` thread `signal` AND have `if (aborted) return` guards.
- **Tavily query stays English (CLAUDE.md i18n rule):** Multi-snippet grounding doesn't change query language. The news prompt may include locale directive via `applyLocaleDirective` (existing) for the *response*, but the Tavily query is unchanged English.
- **One signal per semantic event (CLAUDE.md):** No new event types introduced in Phase 41 (the existing leaf-service events from 39/40 already cover the wiring).
- **Leaf-module discipline (Phase 37) does NOT apply to Phase 41:** Phase 41 wires application code that imports leaf services — call sites are NOT themselves leaves. `concept-feed.service.ts` and `post-essay.service.ts` already pull i18n + LLM provider transitively; Phase 41 does not change that chain.
- **5-minute Anthropic KV-cache prefix preservation (Phase 35) does NOT apply:** `generateNewsEssay` and `generatePostEssay` are one-shot calls (no multi-turn history); the byte-stable system prompt rule is Ask-chat-only per CLAUDE.md "Other one-shot LLM call sites" footnote.

### Claude's Discretion

- **Multi-snippet separator format:** `sources.slice(0, 3).map(s => …).join(…)` joiner — `'\n\n'`, `'\n---\n'`, etc. The existing format at `post-essay.service.ts:139-144` uses `'\n\n'` for the source-blob join AND `${head}\n${snippet}` for per-source layout — Phase 41 will preserve that shape, just iterate over up to 3 sources instead of all.
- **Word-count assertion strategy for SC-3:** Whether to use a mock LLM that returns N words, or rely on source-reading the prompt to assert "350-600 words" string is present, or both. Recommendation (planner-stage): both — source-reading test asserts the prompt contains the word-count instruction; behavioral test mocks chatStream to return strings of known lengths and asserts the EssayOptions plumbing chooses the right prompt.
- **Abort-signal API shape:** `generateConnectionPost(...)` and `generateDiscoverPost(...)` currently accept positional args without an options bag. Adding `{ signal?: AbortSignal }` as the last positional arg vs. converting to an options bag — planner-stage call. Recommendation: add a trailing `options?: { signal?: AbortSignal }` parameter to mirror `generatePostEssay`'s shape; preserves call-site compatibility.
- **Test file naming:** `tests/services/concept-feed-source-diversity-wiring.test.mjs`, `tests/services/post-essay-depth.test.mjs`, `tests/screens/PostDetailScreen-abort-threading.test.mjs`, `tests/components/Markdown-citation-overrides.test.mjs`. Planner can collapse if preferred.
- **Whether to add a deferred `sourceDiversityService.reset()` regression test** — confirm `loadCache()`'s date-mismatch branch fires `reset()` exactly once per day rollover (Phase 40's `reset()` is exposed; Phase 41 wires it). Recommendation: include in Plan 41-01.

### Folded Todos

None. Three pending todos exist in `.planning/todos/pending/` (double-column feed → Phase 42; cosine similarity → Phase 33 follow-up; auto-gen podcast → captured as architectural limitation in `~/.claude/projects/-Users-Code-EchoLearn/memory/project_serverless_no_background_tasks.md`); none relevant to Phase 41 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 41 specs

- `.planning/ROADMAP.md` lines 1124–1136 — Phase 41 entry: goal, depends-on, requirements, 7 success criteria.
- `.planning/REQUIREMENTS.md` lines 23, 25, 26 — CONTENT-01, CONTENT-03, CONTENT-04 acceptance language.
- `.planning/REQUIREMENTS.md` line 24, 77 — CONTENT-02 (closes from `◐ Partial` → `✓ Complete` via Phase 41 wiring).

### Wave-1 leaf services consumed by Phase 41

- `app/src/services/source-diversity.service.ts` — Phase 40 leaf. 5-function singleton (`filterForDiversity`, `recordServedDomain`, `getUsedDomains`, `scoreSource`, `reset`); exported helpers (`extractDomain`, `normalizeHost`, `MULTI_SEGMENT_TLDS`, `DOMAIN_TIERS`, `UNKNOWN_DOMAIN_SCORE`).
- `app/src/services/engagement.service.ts` — Phase 39 leaf. `getDismissedAnchorIds()` reader consumed by Phase 41's integration test for SC-1.
- `.planning/phases/40-source-diversity-leaf-module/40-CONTEXT.md` — Phase 40 decisions (D-06 best-of-the-bad fallback semantics; D-12..D-15 API contract).
- `.planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md` — Phase 41 contract section (lines 156–195 — exact 5-function signatures + Phase 41 wiring sites enumerated).
- `.planning/phases/39-engagement-service-walker-extension/39-CONTEXT.md` — Phase 39 decisions (D-04 pinning, D-05 events, D-07 walker, D-08 reset).
- `.planning/phases/39-engagement-service-walker-extension/39-01-engagement-service-SUMMARY.md` — Phase 39 wiring already done at `concept-feed.service.ts:1212`.

### Load-bearing CLAUDE.md sections

- `CLAUDE.md` "Concept Feed Generation Pipeline (load-bearing)" — refillQueue mutex + walker semantics; do NOT regress Phase 36-12 mutex pattern when wiring source-diversity inside the same `_refillMutex.run(...)` body.
- `CLAUDE.md` "News post pipeline — defer body to on-open streaming (Phase 32.1)" — `bodyMarkdown: ''` invariant for news posts at creation; Phase 41's wiring must NOT regress this. The on-enter streamer (`generateNewsEssay`) is where SC-3/SC-4/SC-5 land.
- `CLAUDE.md` "Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)" footnote rule 6 — confirms Phase 41's one-shot LLM call sites can interpolate dynamic content into system prompts (no Phase 35 discipline needed).
- `CLAUDE.md` "Best practices learned in Phase 32.1" rules 1, 2, 6, 8 — apply throughout Phase 41 wiring.
- `CLAUDE.md` "i18n Workflow" §"What NOT to translate" — Tavily web-search queries stay English; SC-4's multi-snippet grounding does not change query language.

### Source-of-truth files for code change

- `app/src/services/concept-feed.service.ts:1083–1131` (news creation loop), `:1212` (walker call — already wired by Phase 39), `:1280–1313` (news pre-fetch loop), `loadCache()` (day-boundary reset site — line approximate, search for `cached.date !== today()`).
- `app/src/services/web-search.service.ts:13–17` (`WebSearchOptions` interface), `:21–80` (`webSearch` body — Tavily payload construction).
- `app/src/services/post-essay.service.ts:11–13` (`EssayOptions` interface), `:43–79` (`generateEssayMeta` — body-slice cap raise at `:54`), `:81–101` (`generateStandardEssay` — depth wiring), `:104–131` (`generateVideoEssay` — depth wiring), `:133–160` (`generateNewsEssay` — depth + multi-snippet + footnote prompt), `:162–~190` (`generateTextArtEssay` — depth wiring).
- `app/src/screens/PostDetailScreen.tsx:282–390` (essay `useEffect` — 3 async branches + AbortController + 3 abort-guard checks; SC-7 audit site).
- `app/src/components/Markdown.tsx:1–37` — current plugin chain (remark-gfm + remark-math + rehype-raw + rehype-sanitize + rehype-katex); `<sup>` tag already allowlisted at `:14`. Phase 41 adds `components={{ sup, a, section }}` props.
- `app/src/types/index.ts` — `EssayContent` interface (Phase 41 adds `bodyMarkdownDeep?: string`); `WebSearchResult` interface (unchanged).

### Pattern precedents

- `app/src/components/ChatMessage.tsx:styleCitationTags` — existing inline `<sup data-cite='N'>N</sup>` chip pattern in chat. Phase 41 does NOT copy this pattern (D-04 chose markdown footnote syntax over inline raw HTML), but the chip CSS is reusable as a starting point for the `sup` component override.
- `app/src/services/post-essay.service.ts:43–79` — existing single-AbortController-per-useEffect pattern (D-06 + D-15 + D-16). Phase 41 expands D-15's scope from "generatePostEssay branch only" to "all 3 async branches."
- Phase 39/40 source-reading invariant tests (`engagement-anti-wire.test.mjs`, `source-diversity-anti-wire.test.mjs`) — pattern for Phase 41's source-reading assertions.

### External resources (no specs to read for v1.5)

- Tavily API docs (`https://docs.tavily.com/api-reference/endpoint/search`) — `exclude_domains` field accepts string array.
- remark-gfm footnote syntax (`https://github.com/remarkjs/remark-gfm`) — informational reference for D-04's `[^N]` parsing.
- ReactMarkdown `components` prop (`https://github.com/remarkjs/react-markdown`) — informational reference for D-04's override mechanism.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`sourceDiversityService.{filterForDiversity, recordServedDomain, getUsedDomains, scoreSource, reset}` + `extractDomain` (Phase 40)** — Phase 41's primary import. One-line `import { sourceDiversityService, extractDomain } from './source-diversity.service.ts'` at top of `concept-feed.service.ts`.
- **`engagementService.getDismissedAnchorIds()` (Phase 39)** — already imported at `concept-feed.service.ts:1211` (the line above the walker call). Phase 41's SC-1 integration test exercises the existing wire.
- **`remark-gfm` + `<sup>` allowlist (already configured)** — `Markdown.tsx:36` (plugin) + `:14` (sanitize). Phase 41 only needs the `components` prop addition.
- **`AbortController` + `eventBus.subscribe('LOCALE_CHANGED', …)` mid-stream cancel pattern** — `PostDetailScreen.tsx:293–296`. Phase 41 SC-7 audit extends this pattern to `generateConnectionPost` and `generateDiscoverPost` branches.
- **`patchPostEssayInCache(postId, essay)`** — existing per-post cache patch. Phase 41 D-03 extends the merge to honor `bodyMarkdownDeep`.
- **`EssayOptions { signal?: AbortSignal }` (Phase 35)** — Phase 41 adds `depth?: 'standard' | 'deep'` field beside it.

### Established Patterns

- **Singleton service import + one-line state read** (`engagementService.getDismissedAnchorIds()` at `:1211`; Phase 41 mirrors with `sourceDiversityService.getUsedDomains(a.conceptId)`).
- **News post creation: `bodyMarkdown: ''` invariant** (`concept-feed.service.ts:1109` — load-bearing per CLAUDE.md "News post pipeline" section). Phase 41 SC-4 changes the on-enter streamer (`generateNewsEssay`), NOT the creation site.
- **Atomic per-file commits + paired source+test** (Phase 37 D-03 norm; Phase 39/40 cadence). Phase 41 expects 5-7 commits per plan (~10-14 total).
- **Source-reading invariant tests** for the cross-cutting wiring assertions (4 net-new test files, mirrors Phase 39/40 anti-wire pattern).
- **Tavily payload `exclude_domains` array** — empty array vs absence: pass `exclude_domains: [...usedDomains]` ALWAYS (even when empty array — Tavily ignores empty arrays gracefully); avoid conditional payload-shape branching.
- **`webSearch` returns `ServiceResult<WebSearchResponse>`** — Phase 41's call sites already handle `searchResult.success` / `searchResult.data?.results`. New `excludeDomains` option is passive (passed through; no return-shape change).

### Integration Points

- **`concept-feed.service.ts:1083–1131` (news creation loop):**
  - Before line 1093: read `usedDomains = sourceDiversityService.getUsedDomains(a.conceptId)`.
  - Line 1093 edit: `webSearch(conceptName + ' latest research findings', { maxResults: 3, excludeDomains: [...usedDomains] })`.
  - After `searchResult.success && searchResult.data?.results.length`: call `filterForDiversity(searchResult.data.results, usedDomains)`; take `[0]` as the chosen result.
  - After committing the post (line ~1098+): `sourceDiversityService.recordServedDomain(a.conceptId, extractDomain(result.url) ?? '')` (with `?? ''` short-circuit guard if extractDomain returns undefined).
- **`concept-feed.service.ts:1280–1313` (news pre-fetch loop):**
  - Same triple of edits: `getUsedDomains` → widen `maxResults` + `excludeDomains` → `filterForDiversity` on results array → `recordServedDomain` after `preFetched.news.set(a.conceptId, …)`.
- **`concept-feed.service.ts:loadCache()` day-boundary branch** (search for `cached.date !== today()`):
  - Add `sourceDiversityService.reset()` call inside the date-mismatch branch alongside the existing date-rollover side effects (Phase 36-09 STORAGE_KEY split + Phase 36-13 dailyReadService.reset placement).
- **`web-search.service.ts:13` (`WebSearchOptions`):**
  - Add `excludeDomains?: string[]` field.
- **`web-search.service.ts:40–47` (Tavily body construction):**
  - Add `if (options?.excludeDomains?.length) body.exclude_domains = options.excludeDomains;` (or always set to `options?.excludeDomains ?? []` — picking conditional to keep payload minimal when no exclusions).
- **`post-essay.service.ts:54` (`generateEssayMeta` body slice):**
  - `bodyMarkdown.slice(0, 2000)` → `bodyMarkdown.slice(0, 4000)`. Single-line edit. SC-6.
- **`post-essay.service.ts:11–13` (`EssayOptions`):**
  - Add `depth?: 'standard' | 'deep'`.
- **`post-essay.service.ts:81–~190` (4 essay generators):**
  - Each generator's prompt extends with depth-conditional word-count instruction. Default to `'standard'` (existing 150-250w / 200-350w / 200-400w bands per generator). When `'deep'`, use the 350-600w prompt.
  - `generateNewsEssay` additionally consumes `sources.slice(0, 3)` (was `sources` — but only 1 result was fetched before, so effectively `sources[0]`). Footnote prompt instruction added per D-04.
- **`post-essay.service.ts` `generateConnectionPost` + `generateDiscoverPost` (in `concept-feed.service.ts`):**
  - Add `signal?: AbortSignal` to options bag; propagate to internal `chatStream` calls. SC-7.
- **`PostDetailScreen.tsx:312–339` (3 async branches in essay useEffect):**
  - Branch 1 (`connection`, lines 313–323): pass `{ signal: abortController.signal }` to `conceptFeedService.generateConnectionPost(...)`.
  - Branch 2 (`discover`, lines 324–332): pass `{ signal: abortController.signal }` to `conceptFeedService.generateDiscoverPost(...)`.
  - Branch 3 (`generatePostEssay`, lines 333–339): already correctly threaded.
  - All 3 branches must have `if (abortController.signal.aborted) return;` BEFORE the async call (currently the guard is INSIDE the for-await loop; SC-7 requires it before).
- **`Markdown.tsx`:**
  - Add `components={{ sup: CitationChip, a: FootnoteLink, section: FootnoteSection }}` prop on `<ReactMarkdown>`.
  - Inline 3 component definitions (or extract to `Markdown.citations.tsx` if the planner prefers).
- **`types/index.ts` `EssayContent`:**
  - Add `bodyMarkdownDeep?: string` field.

### Phase 36-12 mutex preservation

The 4 wiring edits inside `concept-feed.service.ts` all happen INSIDE `_refillMutex.run(async () => { … })` (lines 1166+). The mutex's try/finally clears the in-flight Promise reference in BOTH success AND error paths — Phase 41's added `sourceDiversityService.recordServedDomain` calls MUST NOT throw (Phase 40 D-10 confirms `extractDomain` is defensive; `recordServedDomain` is pure-Map mutation — no throw paths). Verify via inspection.

</code_context>

<specifics>
## Specific Ideas

- **Plan grouping at 2 plans is the right scale.** Plan 41-01 is "wire two leaf services into 2 call sites + day-boundary reset"; Plan 41-02 is "essay-depth API + grounding + meta cap + abort threading + citation rendering." The seam between them is `EssayContent.bodyMarkdownDeep?` (Plan 41-02 ships the type addition; Plan 41-01 doesn't touch the type) — clean boundary. Parallel-safe in execution.
- **Conservative `maxResults: 3`** matches the operator's "minimum to be meaningful" instinct. The combination of `maxResults: 3` + `sources.slice(0, 3)` means every fetched result is consumed by the LLM — no token waste. The leaf's D-06 "best-of-the-bad" fallback handles the edge case where 2 of 3 are already-seen.
- **`bodyMarkdownDeep?: string` is back-compat additive.** Old cached essays (from before Phase 41) have no `bodyMarkdownDeep` field — they render as standard until the user requests deep, which then patches the new field. No migration needed. The PostDetailScreen render decision (`post.bodyMarkdownDeep ?? post.bodyMarkdown` based on the depth toggle state) is Phase 43's button concern; Phase 41 only ships the field + the generators that populate it.
- **Citation prompt + rendering MUST land together** in Plan 41-02. If the prompt change ships without the override, the LLM emits `[^1]` markers that render as plain `<sup>1</sup>` (no chip styling). If the override ships without the prompt, it's a no-op (no `<sup>` tags to style). Atomic per-file commits but the same plan ensures they release as a unit.
- **Walker SC-1 is already wired** — Phase 39 landed `walkDerivedList(16, exploredIds, dismissedIds)` at `concept-feed.service.ts:1212`. Phase 41 SC-1 only needs the integration test asserting the end-to-end flow (call `engagementService.dismissAnchor('X')`, run `refillQueue`, assert no post for X is enqueued). This is a fast addition to Plan 41-01 (~30 LOC test file). Reduces Phase 41's "wiring" scope by one task.
- **Operator chose all 4 gray areas to discuss** — solid alignment with the recommended path on each (Two plans / 3 / Parallel cache / Markdown footnote syntax). Pattern: prefer parallel-safe execution + conservative API token budget + back-compat additive schema + standard-tooling rendering pipeline.

</specifics>

<deferred>
## Deferred Ideas

### Out of Phase 41 scope (Phase 43 owns)

- **"Deep dive" button UI** in PostDetailScreen — Phase 43 SC-3. Phase 41 ships the API + tests only.
- **Long-press contextual menu** with Like / Save / Not interested — Phase 43 SC-1.
- **Saved-posts view** route/screen — Phase 43 SC-2.
- **`engagementService.reset()` in Force-New-Day handler** — Phase 43 SC-6.
- **"N connections in your graph" micro-label** computed from candidatePack — Phase 43 SC-4.
- **HomeScreen ANCHOR_DISMISSED re-sync effect** — Phase 43 SC-5.

### Out of Phase 41 scope (Phase 42 owns)

- **Pinterest-style 2-column masonry layout** — Phase 42 MASONRY-01.
- **Vine-bloom celebration card** replacing the empty-state toast — Phase 42 MASONRY-02.

### Outside v1.5 entirely

- **Mid-stream cancel of an in-flight standard essay when user requests deep** — UX concern owned by Phase 43's button. Phase 41 only ships the cache field + generator routing.
- **Per-post deep-variant analytics / token cost tracking** — out of v1.5; would intersect with the future `tokenUsage.service.ts` rewrite.
- **UI surfacing of source-diversity scores** ("verified peer-reviewed source" badge, source-quality icon on tile) — Phase 40 leaf is internal mechanism; UI exposure deferred to a future content-curation phase if signal warrants.
- **Server-side citation lookup** (e.g., hover footnote → fetch full paragraph context from the source URL) — out of local-first scope; would require backend or per-tile network call.
- **Citation accuracy validation** (LLM-generated `[^1]` markers may hallucinate or mis-attribute) — out of v1.5 scope; would need an additional verification pass against the original snippet text.
- **Multi-language footnote prompts** — Tavily query stays English (CLAUDE.md rule); footnote section labels remain English by default. Localization deferred until v1.6 if signal warrants.

### Reviewed Todos (not folded)

None reviewed for folding — the 3 pending todos in `.planning/todos/pending/` are unrelated to Phase 41 scope:
- `2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md` → Phase 42 (masonry layout)
- `2026-05-07-fix-cosine-similarity-threshold-cache-miss.md` → unrelated subsystem (embedding pre-check, Phase 33 follow-up)
- `2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug.md` → already addressed (architectural limitation captured in `~/.claude/projects/-Users-Code-EchoLearn/memory/project_serverless_no_background_tasks.md`)

</deferred>

---

*Phase: 41-pipeline-wiring-essay-depth*
*Context gathered: 2026-05-09*
