# Phase 41: Pipeline Wiring + Essay Depth — Research

**Researched:** 2026-05-09
**Domain:** Service-integration wiring (concept-feed news branch + Tavily payload + post-essay generators + ReactMarkdown citation rendering + AbortSignal threading audit)
**Confidence:** HIGH

## Summary

Phase 41 is a **pure-wiring + small-API-extension phase** with two parallel-safe plans:

- **Plan 41-01** wires Phase 40's `sourceDiversityService` into the two news call sites in `concept-feed.service.ts` (creation loop at `:1083`, pre-fetch loop at `:1293`) and adds an `excludeDomains?: string[]` field to `WebSearchOptions` in `web-search.service.ts` so it threads into Tavily's `exclude_domains` field. SC-1 (walker dismissed-id integration test) lands here too — the walker is already wired by Phase 39 so this is test-only.

- **Plan 41-02** adds `EssayOptions.depth?: 'standard' | 'deep'` + a `bodyMarkdownDeep?: string` cache field on `DailyPost`/`PostSnapshot`, lengthens `generateNewsEssay` to consume `sources.slice(0, 3)` with footnote prompt, raises `generateEssayMeta` body slice 2000→4000, and audits the 3 async branches in `PostDetailScreen`'s essay `useEffect` so each receives `{ signal: abortController.signal }` AND has an `if (signal.aborted) return` guard before the call. Adds ReactMarkdown `components` overrides for `sup`/`a`/`section` to style remark-gfm footnote output.

Two critical externalities verified this round: **(a) Tavily's `exclude_domains` field is documented snake_case, defaults to empty array, max 150 entries** — so the existing `body` builder in `web-search.service.ts:40-47` cleanly takes the new option; **(b) `rehype-sanitize`'s `defaultSchema` (GitHub schema) ALREADY allows the exact tag/attribute set remark-gfm emits for footnotes** (`section[className=footnotes]`, `sup`, `data-footnote-ref`/`data-footnote-backref`/`aria-describedby` on `a`) — but Markdown.tsx's current `attributes.sup: ['dataCite', 'style']` line OVERRIDES (does not extend) the default `sup` allowlist, so footnote-emitted `<sup>` markup will pass tags through but lose attributes. Plan 41-02 must spread the default `sup` attributes the same way `span`/`div` already do.

**Primary recommendation:** Execute Plans 41-01 and 41-02 in parallel within Wave 2. Both target disjoint files, both follow the established Phase 39/40 atomic-per-task commit + paired source-reading test cadence (~5-7 commits each, ~10-14 total). Use the GitHub default-schema discovery to inform Plan 41-02's sanitize change — it's a one-line spread fix, not a new schema branch.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** **Two plans, parallel-safe.**
  - **Plan 41-01:** refillQueue news-branch wiring + `web-search.service.ts` `excludeDomains` option. Covers SC-1 (integration test for dismissedIds; walker already wired) + SC-2 (Tavily exclude_domains, filterForDiversity rerank, recordServedDomain commit, reset day-boundary).
  - **Plan 41-02:** Essay-depth + multi-snippet grounding + meta cap raise + abort-threading audit + citation rendering. Covers SC-3 (`depth: 'deep'` 350-600w), SC-4 (`sources.slice(0, 3)` grounding), SC-5 (ReactMarkdown sup/a/section overrides + LLM footnote prompt), SC-6 (body-slice cap 2000→4000), SC-7 (signal threading on `generateConnectionPost` + `generateDiscoverPost`).
  - **Why:** The two plans touch disjoint file sets. No shared mutable code path. Parallel-safe. Each plan ~5-7 atomic commits matching Phase 39/40 cadence.

- **D-02:** **`maxResults: 3` at the news call sites.** Update both `concept-feed.service.ts:1093` and `:1296` from `{ maxResults: 1 }` → `{ maxResults: 3 }`. Default in `web-search.service.ts:43` (5) is unchanged. Conservative — minimum value for `filterForDiversity`'s two-pass split to be meaningful; matches `sources.slice(0, 3)` cap so no fetched result is wasted.

- **D-03:** **Parallel cache via new `bodyMarkdownDeep?: string` field on `DailyPost` (extending `PostSnapshot`).** Standard `bodyMarkdown` continues to hold the 150-250w teaser; `bodyMarkdownDeep` holds the 350-600w variant when generated. `patchPostEssayInCache` extends to merge depth-keyed fields. Schema additive (back-compat — old cached essays stay valid). Phase 43 owns the toggle button; Phase 41 ships the API + field.

- **D-04:** **LLM emits markdown footnote syntax (`[^N]` markers + `[^N]: …` section); ReactMarkdown component overrides style sup/a/section.** `remark-gfm` (already in plugin chain at `Markdown.tsx:36`) parses `[^N]` syntax into `<sup><a data-footnote-ref>` + `<section data-footnotes class="footnotes">`. `<sup>` already in sanitize allowlist at `Markdown.tsx:14`. Phase 41 instructs the LLM to emit the syntax + styles the parsed output via `<ReactMarkdown components={...}>`.

### Claude's Discretion

- **Multi-snippet separator format:** preserve existing `'\n\n'` join from `post-essay.service.ts:139-144`; iterate over `sources.slice(0, 3)` instead of `sources` (was previously 1-element).
- **Word-count assertion strategy for SC-3:** dual approach — source-reading test asserts the prompt contains the word-count instruction strings; behavioral test mocks `chatStream` with canned responses of known length and asserts EssayOptions plumbing chooses the right prompt.
- **Abort-signal API shape:** add a trailing `options?: { signal?: AbortSignal }` param to `generateConnectionPost` + `generateDiscoverPost` — mirrors `generatePostEssay`'s shape; preserves call-site compatibility.
- **Test file naming:** `tests/services/concept-feed-source-diversity-wiring.test.mjs`, `tests/services/post-essay-depth.test.mjs`, `tests/screens/PostDetailScreen-abort-threading.test.mjs`, `tests/components/Markdown-citation-overrides.test.mjs`. Planner can collapse if preferred.
- **Whether to add a deferred `sourceDiversityService.reset()` regression test** confirming `loadCache()`'s date-mismatch branch fires `reset()` exactly once per day rollover. Recommendation: include in Plan 41-01.

### Deferred Ideas (OUT OF SCOPE)

**Phase 43 owns:**
- "Deep dive" button UI in PostDetailScreen
- Long-press contextual menu (Like / Save / Not interested)
- Saved-posts view route/screen
- `engagementService.reset()` in Force-New-Day handler
- "N connections in your graph" micro-label
- HomeScreen `ANCHOR_DISMISSED` re-sync effect

**Phase 42 owns:**
- Pinterest-style 2-column masonry layout
- Vine-bloom celebration card

**Outside v1.5 entirely:**
- Mid-stream cancel of in-flight standard essay when user requests deep
- Per-post deep-variant analytics / token cost tracking
- UI surfacing of source-diversity scores ("verified peer-reviewed source" badges)
- Server-side citation lookup (hover footnote → fetch full paragraph)
- Citation accuracy validation (LLM `[^N]` may hallucinate)
- Multi-language footnote prompts (Tavily query stays English; footnote section labels remain English)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CONTENT-01** | User can request "Deep dive" essay variant (350-600w) from PostDetailScreen; standard 150-250w teaser remains default | API surface: `EssayOptions.depth?: 'standard' \| 'deep'` (`post-essay.service.ts:11-13`); generators conditionally swap word-count band in their system prompt; `bodyMarkdownDeep?: string` cache field added to `DailyPost`. Phase 41 ships the API; Phase 43 ships the button. |
| **CONTENT-03** | Essay prompts include 2-3 Tavily snippets (multi-snippet grounding) instead of `sources[0].snippet` only | `generateNewsEssay` (`post-essay.service.ts:133-160`) currently iterates over `post.newsMeta.sources` but only one source is fetched (`maxResults: 1` at `:1093` + `:1296`). Phase 41 widens the fetch to `maxResults: 3` (D-02), the news creation path stores the chosen result in `newsMeta.sources` (existing structure already supports an array), and the generator's `sources.slice(0, 3)` consumption follows naturally. |
| **CONTENT-04** | Citations in markdown render via ReactMarkdown `sup`/`a`/`section` component overrides for clean footnote presentation | `remark-gfm` at `Markdown.tsx:36` already parses `[^N]` footnote syntax. Default `rehype-sanitize` schema (GitHub) already allows `sup`, `section[className="footnotes"]`, `data-footnote-ref`/`data-footnote-backref`/`aria-describedby` on `a`. Phase 41 adds (a) LLM prompt instruction to emit footnote syntax, (b) `components={{ sup, a, section }}` overrides on `<ReactMarkdown>` for chip + footnote-section styling, (c) restores default `sup` attribute allowlist (currently overridden at `Markdown.tsx:17`). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The following directives have the same authority as locked decisions and constrain Phase 41 plans:

- **News post defer-to-streamer invariant (CLAUDE.md "News post pipeline"):** News posts at creation time MUST set `bodyMarkdown: ''` so `PostDetailScreen.tsx:291` (`if (post.bodyMarkdown && post.bodyMarkdown.trim() !== '') return;`) routes to the on-enter streamer (`generateNewsEssay`). Phase 41 SC-3/SC-4/SC-5 land in the streamer, NOT at creation. Don't regress the empty-body invariant.
- **Concept feed pipeline 3-list discipline (CLAUDE.md "Concept Feed Generation Pipeline"):** Phase 41's wiring lives INSIDE `_refillMutex.run(async () => {...})` (`concept-feed.service.ts:1166+`). Mutex try/finally clears in-flight ref on BOTH success AND error — `recordServedDomain` calls in the news loops MUST NOT throw. `extractDomain` is defensive (Phase 40 D-10) and `recordServedDomain` is pure-Map mutation, so this is satisfied; verify by inspection.
- **Phase 35 KV-cache rule does NOT apply to one-shot LLM calls (CLAUDE.md "Other one-shot LLM call sites"):** `generateNewsEssay`, `generateConnectionPost`, `generateDiscoverPost`, `generateEssayMeta`, `generatePostEssay` are all one-shot — no multi-turn history. Phase 41 freely interpolates dynamic content (sources, depth instruction) into their system prompts.
- **One signal per semantic event (CLAUDE.md "Best practices Phase 32.1 rule 6"):** No new event types in Phase 41. Existing `ANCHOR_DISMISSED` (Phase 39) covers the dismissed-anchor wiring; no `DOMAIN_RESET` event is introduced (Phase 40 D-08 / D-14 — `reset()` emits nothing).
- **i18n workflow — never translate at runtime (CLAUDE.md "i18n Workflow" + memory `feedback_i18n_translation.md`):** Tavily query stays English; footnote section labels remain English by default; if essay prompts gain a footnote instruction it stays English in the system prompt and `applyLocaleDirective` handles user-facing locale on the response side. Don't add an `i18n.t(...)` call in any LLM prompt construction.
- **Atomic per-file commits (Phase 37 D-03 norm; Phase 39/40 cadence):** Each task = one file = one commit; paired source+test commits where the test guards the change. Plan 41-01 and 41-02 each expect 5-7 commits.
- **No new service-creation; reuse Phase 39/40 leaf services:** Phase 41 imports `engagementService`, `sourceDiversityService`, `extractDomain` — no new `XService` is introduced.
- **`html, body { overflow: hidden }` + SwipeTabContainer guards (CLAUDE.md "Root overflow clip" + "SwipeTabContainer resize"):** Not directly touched, but the citation chip/footnote render must NOT introduce horizontal overflow at narrow viewports — keep `overflow-wrap: anywhere` or equivalent on the long-URL footnote-link case.

## Standard Stack

### Core (verified against installed versions in `app/package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-markdown` | **10.1.0** (`^10.1.0`) | Markdown → React tree with `components` prop overrides | Phase 41 D-04's rendering pipeline. Already in use at `Markdown.tsx:1`. |
| `remark-gfm` | **4.0.1** (`^4.0.1`) | GFM extensions including `[^N]` footnote markers + section emission | Already in plugin chain at `Markdown.tsx:36`. Footnote support is GFM-specific (CommonMark does NOT support footnotes natively). |
| `remark-math` | `^6.0.0` | LaTeX math markers (unchanged) | Existing |
| `rehype-katex` | `^7.0.1` | LaTeX render (unchanged) | Existing |
| `rehype-raw` | (existing) | Raw HTML pass-through (load-bearing for ChatMessage's inline `<sup data-cite>` chips) | Existing — Phase 41 does NOT add new raw HTML; markdown footnotes are sanitize-friendly without rehype-raw |
| `rehype-sanitize` | `^6.0.0` | Output sanitization with extended GitHub schema | `defaultSchema` already allows footnote tags/attributes. Phase 41 fixes a small `sup` attribute regression at `Markdown.tsx:17`. |

**Version verification (npm registry, 2026-05-09):**
- `npm view react-markdown version` → **10.1.0** (latest), published 2025-03-07. Installed range `^10.1.0` is current.
- `npm view remark-gfm version` → **4.0.1** (latest). Installed range `^4.0.1` is current.

No version bumps needed for Phase 41. Phase 44 owns dependency sweeps.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/core` (CapacitorHttp) | (existing) | Native HTTP fetch path in `web-search.service.ts:60-65` | Tavily call uses CapacitorHttp on native; existing — Phase 41 only adds `exclude_domains` to the `body` object, no transport change |
| Phase 40 `sourceDiversityService` | (in-tree) | 5-function singleton + `extractDomain` helper | Imported into `concept-feed.service.ts` for Plan 41-01 |
| Phase 39 `engagementService` | (in-tree) | `getDismissedAnchorIds()` | Already imported at `concept-feed.service.ts:1211`; Phase 41 adds an integration test |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Markdown `[^N]` footnote syntax | Inline `<sup data-cite='N'>N</sup>` raw HTML (existing `ChatMessage.styleCitationTags` pattern at `:33-43`) | Rejected by D-04. The chat pattern works for chats but lacks an automatic `<section>` block; relies on `rehype-raw` escape hatch. Markdown footnote keeps the sanitize boundary clean. |
| `bodyMarkdownDeep` parallel cache | Replace `bodyMarkdown` on deep request | Rejected by D-03 — losing the 150-250w teaser is a one-way ratchet; bad UX for repeat readers. |
| `bodyMarkdownDeep` parallel cache | Cache-key extends with depth (`trellis_daily_posts_deep`) | Rejected by D-03 — heavier plumbing change for the same end state. Field-level cache is simpler. |
| `maxResults: 3` | `maxResults: 5` (Tavily docs recommend ≤10 for relevance) | Rejected by D-02 — `sources.slice(0, 3)` would discard 2 of 5; tokens wasted. If diversity weak in production, single-line bump to 5. |
| Custom abort-signal helper | Reuse existing `AbortController` per-`useEffect` pattern | Rejected — pattern already established at `PostDetailScreen.tsx:293` (D-06 + D-15 + D-16). SC-7 expands D-15's scope. |

**Installation:**
```bash
# No new packages. Phase 41 reuses installed versions.
```

## Architecture Patterns

### Recommended Project Structure

Phase 41 introduces NO new directories. All edits land in existing files:

```
app/src/
├── services/
│   ├── concept-feed.service.ts       # 4 wiring sites (Plan 41-01)
│   │   ├─ :1083-1131 news creation loop
│   │   ├─ :1212 walker call (already wired Phase 39 — integration test only)
│   │   ├─ :1280-1313 news pre-fetch loop
│   │   └─ :167-202 loadCache() date-mismatch branch
│   ├── web-search.service.ts         # WebSearchOptions + Tavily payload (Plan 41-01)
│   ├── post-essay.service.ts         # EssayOptions.depth + 4 generators + meta cap (Plan 41-02)
│   ├── source-diversity.service.ts   # IMPORTED (Phase 40 leaf — no edits)
│   └── engagement.service.ts         # IMPORTED (Phase 39 leaf — no edits)
├── screens/
│   └── PostDetailScreen.tsx          # 3 async branches abort audit (Plan 41-02)
├── components/
│   └── Markdown.tsx                  # components={{sup, a, section}} + sanitize fix (Plan 41-02)
├── types/
│   └── index.ts                      # PostSnapshot.bodyMarkdownDeep + EssayContent.bodyMarkdownDeep (Plan 41-02)
└── tests/
    ├── services/
    │   ├── concept-feed-source-diversity-wiring.test.mjs   # NEW (Plan 41-01) source-reading + integration
    │   ├── web-search-exclude-domains.test.mjs             # NEW (Plan 41-01)
    │   ├── source-diversity-day-boundary-reset.test.mjs    # NEW (Plan 41-01)
    │   └── post-essay-depth.test.mjs                       # NEW (Plan 41-02)
    ├── screens/
    │   └── PostDetailScreen-abort-threading.test.mjs       # NEW (Plan 41-02)
    └── components/
        └── Markdown-citation-overrides.test.mjs            # NEW (Plan 41-02)
```

### Pattern 1: Tavily Payload Optional Fields (Plan 41-01)

**What:** Add `exclude_domains` to the request body conditionally based on `options?.excludeDomains`.

**When to use:** Any new Tavily option that should be omitted when the array is empty.

**Example (Plan 41-01):**
```typescript
// Source: web-search.service.ts:39-50 + verified Tavily docs
// https://docs.tavily.com/api-reference/endpoint/search

const url = 'https://api.tavily.com/search';
const body: Record<string, unknown> = {
  query,
  topic: options?.topic ?? 'general',
  max_results: options?.maxResults ?? 5,
  search_depth: 'basic',
  include_answer: false,
  include_raw_content: false,
};
if (options?.includeImages) {
  body.include_images = true;
}
// NEW (Phase 41): exclude_domains is optional; default empty array per Tavily docs.
// Conditional set keeps the wire payload minimal when no exclusions are needed.
if (options?.excludeDomains?.length) {
  body.exclude_domains = options.excludeDomains;
}
```

**Note:** Tavily docs specify `exclude_domains` defaults to `[]` and accepts up to 150 entries. Empty-array behavior is documented as a no-op. Setting it always vs. conditionally is a payload-cleanliness preference; both work.

### Pattern 2: `getUsedDomains` → `filterForDiversity` → `recordServedDomain` triple (Plan 41-01)

**What:** The per-anchor domain rotation pattern at the news call sites.

**When to use:** Both `concept-feed.service.ts:1093` (creation loop) and `:1296` (pre-fetch loop).

**Example (Plan 41-01 — pre-fetch loop):**
```typescript
// Source: Phase 40 SUMMARY § "Phase 41 wiring sites"
// app/src/services/concept-feed.service.ts:1293-1313

// 1. Read used domains BEFORE the Tavily call.
const usedDomains = sourceDiversityService.getUsedDomains(a.conceptId);

// 2. Pass to Tavily as exclude_domains AND raise maxResults from 1 → 3.
const results = await webSearch(
  conceptName + ' latest research findings',
  { maxResults: 3, excludeDomains: [...usedDomains] },
);

if (!results.success || !results.data?.results.length) {
  // ...existing failure handling unchanged
} else {
  // 3. Re-rank to prefer unseen domains. Phase 40 best-of-the-bad
  //    fallback handles the all-malformed-URLs edge case automatically.
  const filtered = sourceDiversityService.filterForDiversity(
    results.data.results,
    usedDomains,
  );
  const chosen = filtered[0];
  preFetched.news.set(a.conceptId, chosen);
  // 4. Record AFTER committing. extractDomain returns undefined for malformed URLs;
  //    short-circuit guard avoids recording 'undefined' as a serviced domain.
  const domain = extractDomain(chosen.url);
  if (domain) sourceDiversityService.recordServedDomain(a.conceptId, domain);
}
```

The same pattern lands at the creation loop with the chosen result driving `posts.push(...)` instead of `preFetched.news.set(...)`.

### Pattern 3: ReactMarkdown `components` Prop with Default-Schema Footnotes (Plan 41-02)

**What:** Style remark-gfm's footnote output without expanding the sanitize allowlist.

**When to use:** Any markdown renderer wanting to surface `[^N]` footnotes as styled chips.

**Example (Plan 41-02):**
```typescript
// Source: react-markdown v10 docs + remarkjs/discussions/1270
// https://github.com/remarkjs/react-markdown
// https://github.com/orgs/remarkjs/discussions/1270
// remark-gfm v4 footnote output:
//   <sup><a href="#user-content-fn-1" id="user-content-fnref-1"
//          data-footnote-ref aria-describedby="footnote-label">1</a></sup>
//   <section data-footnotes class="footnotes">
//     <h2 class="sr-only" id="footnote-label">Footnotes</h2>
//     <ol>
//       <li id="user-content-fn-1">
//         ...definition text...
//         <a href="#user-content-fnref-1" data-footnote-backref
//            class="data-footnote-backref" aria-label="Back to content">↩</a>
//       </li>
//     </ol>
//   </section>

import type { Components } from 'react-markdown';

const citationChip: Components['sup'] = ({ children, ...rest }) => (
  <sup
    {...rest}
    style={{
      fontSize: '0.7em',
      padding: '1px 4px',
      borderRadius: '4px',
      background: 'var(--surface-variant)',
      color: 'var(--muted-foreground)',
      margin: '0 1px',
      verticalAlign: 'super',
    }}
  >
    {children}
  </sup>
);

const footnoteLink: Components['a'] = ({ children, href, ...rest }) => {
  // Discriminate by data attribute, NOT by href prefix — survives DOM-clobber prefix changes.
  // remark-gfm passes data-footnote-ref / data-footnote-backref attributes; React converts
  // to camelCase props. Use bracket notation since TypeScript doesn't know these props.
  const isFootnoteRef = (rest as Record<string, unknown>)['data-footnote-ref'];
  const isFootnoteBackref = (rest as Record<string, unknown>)['data-footnote-backref'];
  if (isFootnoteRef || isFootnoteBackref) {
    return (
      <a
        {...rest}
        href={href}
        style={{ color: 'var(--primary-40)', textDecoration: 'none' }}
      >
        {children}
      </a>
    );
  }
  return <a {...rest} href={href}>{children}</a>;
};

const footnoteSection: Components['section'] = ({ children, className, ...rest }) => {
  if (className?.includes('footnotes')) {
    return (
      <section
        {...rest}
        className={className}
        style={{
          marginTop: '24px',
          paddingTop: '12px',
          borderTop: '1px solid var(--surface-variant)',
          fontSize: '0.85em',
          color: 'var(--muted-foreground)',
        }}
      >
        {children}
      </section>
    );
  }
  return <section {...rest} className={className}>{children}</section>;
};

// Wired in Markdown.tsx:
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
  components={{
    sup: citationChip,
    a: footnoteLink,
    section: footnoteSection,
  }}
>
  {normalizeMarkdownText(children)}
</ReactMarkdown>
```

**Critical sanitize fix (Markdown.tsx:17):** The current `sup: ['dataCite', 'style']` REPLACES the default schema's `sup` attributes (which is permissive enough — sup itself takes few attributes). After Phase 41, when remark-gfm emits `<sup>` containing `<a data-footnote-ref aria-describedby="footnote-label">`, the sup tag is allowed but its inner `<a>` would only retain attributes that hast-util-sanitize's GitHub schema explicitly grants. The default schema DOES grant `dataFootnoteRef`, `dataFootnoteBackref`, `ariaDescribedBy`, `ariaLabel`, `href` on `<a>` — so the inner anchor survives. **However** the `attributes.sup: ['dataCite', 'style']` line should change to `sup: [...(defaultSchema.attributes?.['sup'] ?? []), 'dataCite', 'style']` (mirror the existing `span`/`div` extend pattern at `:19-20`) to be safe against future sanitize-schema changes that might add allowed `<sup>` attributes.

### Pattern 4: Depth-Conditional Generator Prompts (Plan 41-02)

**What:** A single `EssayOptions.depth` knob switches the system prompt's word-count band.

**When to use:** Each of the 4 essay generators (`generateStandardEssay`, `generateVideoEssay`, `generateNewsEssay`, `generateTextArtEssay`).

**Example:**
```typescript
// Source: post-essay.service.ts:81-101 (current generateStandardEssay)
// Phase 41 D-03 + D-04 + CONTEXT § Architecture Patterns

const depth = options?.depth ?? 'standard';
const wordCountInstruction = depth === 'deep'
  ? 'Write a substantial, in-depth essay (350-600 words) in markdown.'
  : 'Write a vivid, engaging essay (200-350 words) in markdown.';  // existing

const systemContent = [
  'You are a world-class educational writer.',
  wordCountInstruction,
  'Use examples, analogies, and surprising insights.',
  'Do NOT include any JSON or metadata — output the essay text only.',
].join(' ');

yield* chatStream(
  [
    { role: 'system', content: systemContent },
    { role: 'user', content: `Write an essay titled "${post.title}" with this hook: "${post.teaser.hook}"\n\nContext from the learner's knowledge:\n${contextBlock}` },
  ],
  settings.llm,
  { serviceName: 'posts', signal: options?.signal },
);
```

For `generateNewsEssay` specifically, the system prompt also gains the footnote instruction:

```typescript
// generateNewsEssay (depth-aware + multi-snippet + footnote prompt)
const sources = post.newsMeta?.sources ?? [];
const sourceText = sources
  .slice(0, 3)  // SC-4 — multi-snippet grounding
  .map(s => {
    const head = `[${s.index}] ${s.title} — ${s.url}`;
    return s.snippet ? `${head}\n${s.snippet}` : head;
  })
  .join('\n\n');

const wordCountInstruction = depth === 'deep'
  ? 'Create a substantial educational news summary (350-600 words)'
  : 'Create a short educational news summary (150-250 words)';

const systemContent = [
  'You are a learning digest writer.',
  wordCountInstruction + ' from the following web search results.',
  'Write it as a clear, engaging markdown essay.',
  'Cite each factual claim with [^1], [^2], [^3] markers tied to the source list above.',
  'Emit a footnotes section at the end as `[^1]: <title>` for each cited source.',
  'Output the essay text only — no JSON.',
].join(' ');
```

### Pattern 5: Abort-Signal-Before-Async Guard (Plan 41-02 SC-7)

**What:** Each async branch in `PostDetailScreen.tsx`'s essay `useEffect` MUST have `if (signal.aborted) return` BEFORE the call AND `{ signal: abortController.signal }` IN the call.

**Why:** Currently the guard is INSIDE the `for await` loop (after the first chunk arrives). SC-7 audit moves the guard BEFORE the call so an unmount during the prompt-construction window also bails out cleanly.

**Example (Plan 41-02):**
```typescript
// Source: PostDetailScreen.tsx:312-339 (current 3-branch dispatch)
// Phase 41 SC-7 audit — D-08 abort-chain extension

if (post.sourceType === 'connection' && connectionMeta) {
  if (abortController.signal.aborted) return;  // NEW — D-08 SC-7
  for await (const chunk of conceptFeedService.generateConnectionPost(
    connectionMeta.questionA,
    connectionMeta.questionB,
    connectionMeta.conceptNounA,
    connectionMeta.conceptNounB,
    { signal: abortController.signal },  // NEW — Plan 41-02 generator-API extension
  )) {
    if (abortController.signal.aborted) return;
    accumulated += chunk;
    setStreamingBody(accumulated);
  }
} else if (discoverMeta && post.id.includes('-post-')) {
  if (abortController.signal.aborted) return;  // NEW
  for await (const chunk of conceptFeedService.generateDiscoverPost(
    discoverMeta.concept,
    discoverMeta.title,
    { signal: abortController.signal },  // NEW
  )) {
    if (abortController.signal.aborted) return;
    accumulated += chunk;
    setStreamingBody(accumulated);
  }
} else {
  if (abortController.signal.aborted) return;  // NEW (currently missing pre-guard)
  for await (const chunk of generatePostEssay(post, questionsRef.current, { signal: abortController.signal })) {
    if (abortController.signal.aborted) return;
    accumulated += chunk;
    setStreamingBody(accumulated);
  }
}
```

The generator-side change in `concept-feed.service.ts:1785` and `:1914`:

```typescript
// Source: concept-feed.service.ts:1785-1822 + 1914-1940
// Add trailing options bag — preserves call-site compatibility (Claude's Discretion).

async *generateConnectionPost(
  questionA: Question,
  questionB: Question,
  conceptNounA: string,
  conceptNounB: string,
  options?: { signal?: AbortSignal },  // NEW
): AsyncGenerator<string> {
  // ...existing prompt construction unchanged...
  yield* chatStream(
    [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    settings.llm,
    { serviceName: 'posts', signal: options?.signal },  // signal threaded
  );
},

async *generateDiscoverPost(
  concept: string,
  title: string,
  options?: { signal?: AbortSignal },  // NEW
): AsyncGenerator<string> {
  // ...
  yield* chatStream(
    [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    settings.llm,
    { serviceName: 'posts', signal: options?.signal },
  );
},
```

`chatStream`/`chatCompletion` already accept `signal` in `CompletionOptions` (`providers/llm/index.ts:53-58`); each provider impl threads via `composeSignal(options?.signal, STREAM_TIMEOUT_MS)` (e.g. `:190, :252, :314`). End-to-end abort plumbing is fully wired down to fetch boundary; no provider-layer changes needed.

### Anti-Patterns to Avoid

- **Don't replace `bodyMarkdown` with deep variant.** D-03 says additive `bodyMarkdownDeep`. One-way ratchet kills the teaser UX.
- **Don't add `recordServedDomain` BEFORE confirming the post commits.** Recording an unused domain pollutes the per-anchor used set and reduces diversity for future calls. Pattern: record AFTER `posts.push(...)` / `preFetched.news.set(...)` succeed.
- **Don't physically splice from `derivedList` when a concept is dismissed.** Walker uses `cyclePosition` index; physical splice corrupts the cycle. Walker already lazy-skips both `exploredIds` AND `dismissedIds` (`post-queue.service.ts:walkDerivedList`). Phase 41 SC-1 just adds the integration test.
- **Don't introduce a second emit of `ANCHOR_DISMISSED` or any new event for diversity-record commits.** Phase 40 D-08 and D-14 forbid emission from `recordServedDomain` and `reset()`. Diversity is a passive bookkeeping signal; UI consumers re-read on date-boundary or per-render.
- **Don't add `await applyLocaleDirective(...)` to news/essay prompts.** `chatStream` already calls it at `providers/llm/index.ts:71-78` for every turn. Re-applying double-stamps `Respond in {locale}.`
- **Don't widen `WebSearchOptions` to accept `includeDomains` in Phase 41.** Phase 41 ships `excludeDomains` only. Future reverse-direction (whitelist top-tier sources) is out of scope; would need separate design.
- **Don't hand-roll a footnote parser.** `remark-gfm` already handles `[^N]` syntax — full support since v3, present in v4.0.1.
- **Don't add `rehype-raw` reliance for footnote rendering.** Markdown footnote syntax is sanitize-friendly; the existing `rehype-raw` is for `ChatMessage`'s inline raw-HTML chips and is unrelated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Footnote `[^N]` → `<sup>` parsing | Custom regex over LLM output | `remark-gfm` (already installed) | GFM spec edge cases (escaping `^`, multi-line footnote bodies, ordering, back-references, ID-collision prefixes) are handled. DOM-clobber prevention via `user-content-` ID prefix is built in. |
| Sanitize allowlist for footnote tags | Custom schema entries for `<section className="footnotes">`, `data-footnote-ref` etc. | `defaultSchema` from `rehype-sanitize` | The GitHub default schema (`hast-util-sanitize/lib/schema.js`) ALREADY allows section[className=footnotes], sup, data-footnote-ref/backref/aria-* on `a`. Adding custom rules risks subtle drift. |
| Domain-rotation Set/Map per anchor | Hand-rolled `Map<string, Set<string>>` in `concept-feed.service.ts` | `sourceDiversityService` (Phase 40 leaf) | Already shipped, tested (16 behavioral + 4 anti-wire), with PSL-aware `extractDomain` for multi-segment TLDs (`.co.uk`, `.gob.mx`, etc.) and best-of-the-bad fallback. |
| Dismissed-anchor walker skip | Pre-filter `derivedList` array | `walkDerivedList(count, exploredIds, dismissedIds)` (Phase 39) | Lazy-skip preserves `cyclePosition`. Pre-filtering corrupts the walker's index. |
| AbortController + LOCALE_CHANGED mid-stream cancel | Two AbortControllers per useEffect | One AbortController + `eventBus.subscribe('LOCALE_CHANGED', ...)` calling `.abort()` | Existing pattern at `PostDetailScreen.tsx:293-296` (D-06). Cleanup is idempotent via `unsubLocale()`. |
| Provider-layer abort wiring for chatStream/chatCompletion | New abort plumbing per provider | `composeSignal(callerSignal, TIMEOUT_MS)` already threaded through OpenAI/Claude/Gemini paths | Verified at `providers/llm/index.ts:35-45, 146, 159-160, 190, 221, 252, 292, 314`. End-to-end fetch-level abort works with `{ signal: abortController.signal }` passed via `CompletionOptions`. |
| Test DOM rendering for ReactMarkdown overrides | Add jsdom or RTL to test infra | Source-reading assertion that the overrides exist in `Markdown.tsx` — defer DOM render verification to operator UAT | Project's test infra is `node --test` + esbuild tsx loader; no DOM. Adding jsdom is a Phase 44/45-class scope expansion. Source-reading lock is the established Phase 27/35/37/39/40 pattern. |

**Key insight:** Phase 41 is a wiring phase — every "what to use" answer is "the thing Phase 39 / 40 / 32.1 already shipped." Avoid the temptation to introduce parallel mechanisms.

## Common Pitfalls

### Pitfall 1: Tavily `exclude_domains` empty-array shape

**What goes wrong:** Passing `exclude_domains: []` works (Tavily ignores empty arrays per docs default), but passing `exclude_domains: undefined` may also work depending on JSON serialization (`undefined` → omitted).
**Why it happens:** TypeScript's optional-chaining defaults `options?.excludeDomains?.length` to falsy on undefined OR empty array.
**How to avoid:** Use the conditional set pattern at the body builder (only set `body.exclude_domains` when array has length). Avoids spurious wire payload.
**Warning signs:** Tavily returning identical results across consecutive calls for the same anchor when `recordServedDomain` should have populated `usedDomains`. Diagnose by logging the request body before fetch.

### Pitfall 2: `sources.slice(0, 3)` when only 1 source exists

**What goes wrong:** Pre-Phase-41, `maxResults: 1` meant `newsMeta.sources` always had length 1. After Phase 41, `maxResults: 3` should populate 3 sources — but only IF the news creation/pre-fetch loop is updated to store the FULL `filtered` array, not `filtered[0]`.
**Why it happens:** The current creation loop at `:1099-1128` does `posts.push({ ...newsMeta: { sources: [{ index: 1, title: result.title, url: result.url, snippet: result.content }] } })` — single result wrapped in array. Phase 41 must change this to use `filtered.slice(0, 3).map((r, i) => ({ index: i + 1, title: r.title, url: r.url, snippet: r.content }))`.
**How to avoid:** Plan 41-01 task list MUST include the `newsMeta.sources` shape change at BOTH news call sites, not just the Tavily call shape.
**Warning signs:** `generateNewsEssay`'s `sources.slice(0, 3)` returns 1 entry despite `maxResults: 3`. Diagnose by inspecting `post.newsMeta.sources.length` in PostDetailScreen.

### Pitfall 3: `sourceDiversityService.reset()` placement at day boundary

**What goes wrong:** CONTEXT.md and Phase 40 SUMMARY say "call `sourceDiversityService.reset()` from `loadCache()`'s date-mismatch branch." But `loadCache()` is a READ function that returns null on mismatch (`concept-feed.service.ts:186`). Placing `reset()` inside the read function violates command-query separation AND will fire on every `loadCache()` invocation across stale-cache scenarios.
**Why it happens:** The `loadCache()` function name + read-only contract is misleading; the day-boundary side effects ACTUALLY live elsewhere (e.g. `dailyReadService.loadState()` at `daily-read.service.ts:34` self-resets via `if (parsed.date !== today()) return freshState()`).
**How to avoid:** Two options for Plan 41-01:
  - **(A)** Add `sourceDiversityService.reset()` to the `if (parsed.date !== today()) return null;` branch at `concept-feed.service.ts:186` (matches CONTEXT.md literally — fires multiple times per day until a `saveCache(today)` writes a fresh entry; idempotent since `reset()` is `usedByAnchor.clear()`).
  - **(B)** Mirror `dailyReadService`'s self-reset pattern: add a one-shot day-boundary detection at module load + on every `getDailyPosts()` entry that compares the cached date to `today()`. More invasive.
  - Recommendation: **(A)** — idempotent + matches CONTEXT.md verbatim + zero new state. The "fires multiple times per stale day" is harmless since `reset()` on an already-empty Map is a no-op.
**Warning signs:** A user reading 30 posts of the same domain after midnight because `usedByAnchor` carried forward from yesterday. Diagnose with regression test (Plan 41-01 last task).

### Pitfall 4: `<sup>` attribute allowlist regression after footnote landing

**What goes wrong:** `Markdown.tsx:17` currently sets `sup: ['dataCite', 'style']` — REPLACING (not extending) the default schema's `sup` attribute list. After Phase 41 lands footnote rendering, if the LLM emits `<sup>` with attributes the default schema would have allowed (none today, but future schema updates may add `data-footnotes` or similar), they'd be silently stripped.
**Why it happens:** The original commit added the chat citation chip pattern in isolation. Phase 41's footnote rendering didn't exist then.
**How to avoid:** Plan 41-02 changes line 17 to `sup: [...(defaultSchema.attributes?.['sup'] ?? []), 'dataCite', 'style']` mirroring the established `span`/`div` pattern at `:19-20`. Tests assert the spread.
**Warning signs:** Footnote chips render but lose styling on certain attribute combinations. Hard to detect; surface via `Markdown-citation-overrides.test.mjs` source-reading test.

### Pitfall 5: Word-count assertion in CI without live LLM

**What goes wrong:** SC-3 says "verified by token/word-count assertion in test." Naively interpreted as a behavioral test calling a real LLM — impossible in CI (no API key, non-deterministic output).
**Why it happens:** ROADMAP language conflates the success criterion (the LLM produces 350-600w on `depth: 'deep'`) with the test approach (asserting that's the case).
**How to avoid:** Dual-test strategy (per Claude's Discretion in CONTEXT.md):
  - **(a)** Source-reading test: `post-essay-depth.test.mjs` reads `post-essay.service.ts` and asserts each generator's source contains both `'350-600 words'` AND `'150-250 words'` (or analogous `'200-350'`/`'200-400'`/`'80-120'` band strings) AND a `depth === 'deep'` discriminator.
  - **(b)** Behavioral test: mock `chatStream` (or use the existing test-double pattern from `state/useQuestions-system-prompt-stability.test.mjs`) to capture the constructed message array, then assert the system content contains the expected word-count instruction for the requested depth.
**Warning signs:** Tests pass but production essays consistently under-word. Mitigation: log word counts in the LLM client during development and tune the prompt instruction (e.g., "exactly 400-600 words" vs "approximately").

### Pitfall 6: `connectionPost` / `discoverPost` signal threading via positional vs. options bag

**What goes wrong:** Adding `signal?: AbortSignal` as a positional 5th/3rd argument breaks any existing test that calls these generators with the current signature.
**Why it happens:** Test files often `import { conceptFeedService } from '...'` and call generators by position.
**How to avoid:** Per Claude's Discretion — use a trailing options bag `options?: { signal?: AbortSignal }`. Existing positional calls remain valid (no arg in last position = `options` undefined = signal undefined = pre-Phase-41 behavior). Plan 41-02 task list should include grep audit of `generateConnectionPost`/`generateDiscoverPost` call sites to confirm none rely on a 5th/3rd positional.
**Warning signs:** Test failures with "expected X arguments, got Y" or `cannot read property 'signal' of undefined`.

### Pitfall 7: The walker integration test for SC-1 needs the right scope

**What goes wrong:** SC-1 says "After dismissing concept X, the next refillQueue cycle does not enqueue any post for concept X." Naively this looks like an end-to-end test calling `refillQueue(...)`. But `refillQueue` has many dependencies (settings, mutex, LLM, Tavily, YouTube). A full integration test is fragile and slow.
**Why it happens:** Conflating SC-1's user-visible outcome with the unit-of-test boundary.
**How to avoid:** The SC-1 integration test should target `walkDerivedList` directly (the load-bearing seam), with a populated `dismissedIds` Set, and assert the returned conceptIds exclude the dismissed ones. Mirror the pattern in existing `derived-list.test.mjs` Phase 39 dismiss-skip cases. Optional second assertion: source-reading that `concept-feed.service.ts:1212` actually passes `engagementService.getDismissedAnchorIds()` as the third arg (already true post-Phase-39 — counterweight against future regression).
**Warning signs:** Integration test trying to mock 8+ dependencies. If you find yourself stubbing settings + Tavily + YouTube + post-history + dailyRead, you're at the wrong boundary.

### Pitfall 8: Missing `reset()` regression test fires too eagerly

**What goes wrong:** Adding `sourceDiversityService.reset()` inside `loadCache()` (Pitfall 3 option A) means it fires on every `loadCache()` invocation across stale-cache scenarios. A test asserting "reset fires exactly once per day rollover" will fail because in test setup, `loadCache()` is called multiple times (for the same stale day) and `reset()` runs each time.
**Why it happens:** Set semantics on Map.clear() are idempotent, but if the test is "exactly once" semantics, it's wrong-shaped.
**How to avoid:** Test the OUTCOME, not the count. Test: `recordServedDomain('a', 'nature.com')` → simulate date rollover → `loadCache()` (returns null due to mismatch) → `getUsedDomains('a')` returns empty Set. The test passes regardless of whether `reset()` fired 1 time or 5 times.
**Warning signs:** Test assertion `mock.callCount === 1` when the function is idempotent and may legitimately be called more.

### Pitfall 9: `bodyMarkdownDeep` field on PostSnapshot but generators write to EssayContent

**What goes wrong:** `EssayContent` (`post-essay.service.ts:15-20`) is the generator's in-flight return shape. `PostSnapshot.bodyMarkdown` is the persisted post field. The new `bodyMarkdownDeep` field needs to live on BOTH so the generator can return it AND the cache can store it.
**Why it happens:** Two parallel type definitions for what is conceptually one essay.
**How to avoid:** Plan 41-02 task list adds `bodyMarkdownDeep?: string` to:
  - `EssayContent` interface (`post-essay.service.ts:15-20`)
  - `PostSnapshot` interface (`types/index.ts:481-496`) — inherited by `DailyPost` at `:528`
  - `patchPostEssayInCache` body MUST honor the merge (`post-essay.service.ts:192-213`) — passing `{ bodyMarkdownDeep }` in essay must NOT overwrite the existing `bodyMarkdown`. Current `posts[idx] = { ...posts[idx], ...essay }` already does the right thing as long as essay omits `bodyMarkdown` when only deep was generated.
**Warning signs:** Toggle to deep replaces standard, or vice versa, in cache.

## Runtime State Inventory

> Phase 41 is NOT a rename/refactor/migration phase — but it touches localStorage cache shape (`bodyMarkdownDeep` field added) and the in-memory `usedByAnchor` Map. Quick audit anyway:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | localStorage `trellis_daily_posts`, `trellis_video_cache`, `trellis_news_posts` (all read by `patchPostEssayInCache`). New `bodyMarkdownDeep?` field is OPTIONAL — old cached DailyPosts (without the field) remain valid (Pitfall 9 + D-03 back-compat). | None — pure-additive schema; no migration. |
| Live service config | None — Phase 41 doesn't touch external service config. | None |
| OS-registered state | None | None |
| Secrets/env vars | None new. Existing Tavily key (`settings.webSearch.tavilyApiKey`) and LLM provider keys unchanged. `exclude_domains` is a request-body field, not a key. | None |
| Build artifacts | None — source edits only; existing build pipeline unchanged. | None |

**In-memory state introduced by Phase 41 wiring:**
- `usedByAnchor: Map<anchorId, Set<domain>>` already exists in `source-diversity.service.ts:107` (Phase 40). Phase 41 starts populating it. State is session-only (lost on cold boot, by design — D-13/D-14).
- No new event types. No new localStorage keys. No new secrets.

## Common Pitfalls Summary (carried forward from leaf phases)

The following anti-patterns from CLAUDE.md "Phase 32.1 best practices" apply directly:

1. **Search for dead code BEFORE assuming "two parallel paths."** Phase 41 has 4 essay generators (`generateStandardEssay`, `generateVideoEssay`, `generateNewsEssay`, `generateTextArtEssay`). Before adding the depth knob to all 4, verify each is actually called from `generatePostEssay`'s dispatch (`post-essay.service.ts:27-37`). Yes — confirmed all 4 are reachable; depth must land on all.
2. **Tests must guard the LIVE code path.** Source-reading tests scan the file at the path the production app loads. Don't write a test against an aspirational shim path.
3. **One signal per semantic event.** Phase 41 introduces ZERO new event types. The `recordServedDomain` commit and `reset()` are silent (Phase 40 D-08).
4. **Hardcoded fallbacks vs. defer-to-streamer.** News creation MUST keep `bodyMarkdown: ''` (CLAUDE.md "News post pipeline"). Multi-snippet grounding lands in the on-enter streamer, NOT in the creation block.
5. **When the operator says "I've explained this 5+ times," document in three places.** Phase 41 is wiring; if a future maintainer breaks the diversity-record-after-commit ordering, capture the lesson in: (a) inline comment at the wiring site, (b) `concept-feed-source-diversity-wiring.test.mjs` source-reading assertion message, (c) CLAUDE.md's "Concept Feed Generation Pipeline" section addendum.

## Code Examples

Verified patterns from official sources:

### Tavily exclude_domains in request body

```typescript
// Source: https://docs.tavily.com/api-reference/endpoint/search
// (verified via WebFetch 2026-05-09)
//
// Tavily Search REST API:
//   POST https://api.tavily.com/search
//   exclude_domains: Array<string>, max 150 entries, default []
//   include_domains: Array<string>, max 300 entries, default []
//   max_results: integer, default 5, range [0, 20]

const body = {
  query: 'spaced repetition latest research findings',
  topic: 'general',
  max_results: 3,
  search_depth: 'basic',
  include_answer: false,
  include_raw_content: false,
  exclude_domains: ['nature.com', 'sciencedirect.com'],  // already-served domains
};
```

### react-markdown components prop with footnote-aware overrides

```typescript
// Source: https://github.com/orgs/remarkjs/discussions/1270
// (verified via WebFetch 2026-05-09)

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  sup: ({ children, ...props }) => <sup className="cite-chip" {...props}>{children}</sup>,
  a: ({ href, children, ...rest }) => {
    const isFnRef = (rest as Record<string, unknown>)['data-footnote-ref'];
    const isFnBackref = (rest as Record<string, unknown>)['data-footnote-backref'];
    if (isFnRef || isFnBackref) {
      return <a href={href} className="footnote-link" {...rest}>{children}</a>;
    }
    return <a href={href} {...rest}>{children}</a>;
  },
  section: ({ className, children, ...props }) => {
    if (className?.includes('footnotes')) {
      return <section className={`${className} footnote-section`} {...props}>{children}</section>;
    }
    return <section className={className} {...props}>{children}</section>;
  },
};

<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
  {markdown}
</ReactMarkdown>
```

### remark-gfm footnote markdown → HTML output shape

```markdown
<!-- Source markdown -->
Spaced repetition outperforms massed practice [^1]. Learners retain
30% more after 30 days [^2].

[^1]: Cepeda et al. 2006 — Distributed practice in verbal recall tasks.
[^2]: Karpicke & Roediger 2008 — The critical importance of retrieval.
```

```html
<!-- remark-gfm v4 + react-markdown v10 output shape -->
<!-- Source: https://github.com/remarkjs/remark-gfm + WebFetch 2026-05-09 -->

<p>
  Spaced repetition outperforms massed practice
  <sup>
    <a href="#user-content-fn-1" id="user-content-fnref-1"
       data-footnote-ref aria-describedby="footnote-label">1</a>
  </sup>.
  Learners retain 30% more after 30 days
  <sup>
    <a href="#user-content-fn-2" id="user-content-fnref-2"
       data-footnote-ref aria-describedby="footnote-label">2</a>
  </sup>.
</p>

<section data-footnotes class="footnotes">
  <h2 class="sr-only" id="footnote-label">Footnotes</h2>
  <ol>
    <li id="user-content-fn-1">
      <p>
        Cepeda et al. 2006 — Distributed practice in verbal recall tasks.
        <a href="#user-content-fnref-1" data-footnote-backref
           class="data-footnote-backref" aria-label="Back to content">↩</a>
      </p>
    </li>
    <li id="user-content-fn-2">
      <p>
        Karpicke & Roediger 2008 — The critical importance of retrieval.
        <a href="#user-content-fnref-2" data-footnote-backref
           class="data-footnote-backref" aria-label="Back to content">↩</a>
      </p>
    </li>
  </ol>
</section>
```

### AbortController + signal threading end-to-end

```typescript
// Source: providers/llm/index.ts:53-78, 146, 159-160 (verified by direct read)
//
// chatCompletion / chatStream BOTH accept signal in CompletionOptions:
export interface CompletionOptions {
  maxTokens?: number;
  serviceName?: string;
  jsonMode?: boolean;
  signal?: AbortSignal;  // D-22 — caller-supplied abort signal
}

// Each provider impl uses composeSignal(options?.signal, TIMEOUT_MS) to
// merge caller-abort with timeout-abort. AbortSignal.any when available.

// PostDetailScreen.tsx pattern (Phase 41 SC-7):
const abortController = new AbortController();
const unsubLocale = eventBus.subscribe('LOCALE_CHANGED', () => {
  abortController.abort(new DOMException('Locale changed', 'AbortError'));
});

if (abortController.signal.aborted) return;  // pre-call guard (NEW)
for await (const chunk of generatePostEssay(post, questions, {
  signal: abortController.signal,
})) {
  if (abortController.signal.aborted) return;  // mid-stream guard (existing)
  accumulated += chunk;
}

return () => {
  abortController.abort();  // unmount → fetch boundary cancellation
  unsubLocale();
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `maxResults: 1` + `sources[0].snippet` only | `maxResults: 3` + `sources.slice(0, 3)` join | Phase 41 (this) | Multi-snippet grounding; LLM has 2-3× more context to summarize accurately |
| Hand-rolled inline `<sup data-cite>` chips via `rehype-raw` | Markdown footnote `[^N]` syntax + ReactMarkdown component overrides | Phase 41 (this) | Sanitize boundary clean; auto footnote section; back-references; ARIA support |
| Single `bodyMarkdown` (150-250w) | `bodyMarkdown` (150-250w) + optional `bodyMarkdownDeep` (350-600w) | Phase 41 (this) | Per-post toggle for depth; both cached separately; back-compat additive |
| Walker `walkDerivedList(count, exploredIds)` | Walker `walkDerivedList(count, exploredIds, dismissedIds)` | Phase 39 (already shipped) | Phase 41 only adds the integration test |
| `generateConnectionPost(...positional)` no signal | `generateConnectionPost(..., options?: { signal })` trailing bag | Phase 41 (this) | Unmount-cancel coverage extended to all 3 essay branches |

**Deprecated/outdated:**
- Inline `<sup data-cite='N'>` raw HTML in essay rendering: deprecated in favor of markdown footnote syntax for posts (Phase 41 D-04). Existing `ChatMessage.styleCitationTags` pattern remains for chat (out of scope here).

## Open Questions

1. **Should `maxResults: 3` be raised to 5 in production based on SC-2 diversity outcome?**
   - What we know: D-02 chose 3 conservatively; Tavily docs recommend ≤10; basic-search quality stays high through 5.
   - What's unclear: Whether, in real Trellis use, 3 is enough for `filterForDiversity` to consistently produce variety (vs. 5 producing more rotations per anchor over a session).
   - Recommendation: Ship 3; instrument no-op (just log `usedDomains.size` per anchor in dev mode). If post-launch operator sees same domains repeating, single-line bump.

2. **Should the LLM footnote prompt instruction be language-agnostic given i18n's "no runtime LLM translation" rule?**
   - What we know: System prompts stay English (CLAUDE.md i18n rule). `applyLocaleDirective` adds `Respond in {locale}.` to first system message.
   - What's unclear: Whether the LLM, told to "Cite each factual claim with `[^1]`, `[^2]`, `[^3]` markers" in English, will correctly emit those markers AND a `[^1]: <title>` definitions block in the user-locale response (e.g., Japanese essay body with English `[^1]: Cepeda et al. 2006 — ...`).
   - Recommendation: Acceptable. Footnote markers `[^N]` are syntax, not natural language — LLMs reliably copy them. Definition titles likely retain source-language (English from Tavily). If users complain, revisit in a future content-localization phase.

3. **Should `EssayContent.bodyMarkdownDeep` also be returned by `generatePostEssay` for the depth: 'deep' path?**
   - What we know: `generatePostEssay` is `AsyncGenerator<string>` — yields chunks, not an `EssayContent` object. The caller (PostDetailScreen) accumulates chunks then patches into cache.
   - What's unclear: Whether the patch-into-cache code path needs to know "this was a deep request" to write to `bodyMarkdownDeep` instead of `bodyMarkdown`.
   - Recommendation: Yes. Plan 41-02 task list MUST include the `patchPostEssayInCache` extension to take a depth parameter (or a richer essay shape with both fields). Cleanest API: accept `{ depth, content }` and patch the right field. Phase 43's button passes `depth: 'deep'`.

4. **Does `signal: abortController.signal` need to thread through `generateEssayMeta`'s `chatCompletion` call, given it's already done at `:58`?**
   - What we know: `generateEssayMeta` already accepts `signal` via `EssayOptions` (`:43`) and threads to `chatCompletion` (`:58`). PostDetailScreen passes the controller signal at `:345`.
   - What's unclear: Whether SC-7's "every new async call" wording also implies an audit (not change) of this existing thread.
   - Recommendation: Audit-only. The thread is correct. Plan 41-02's source-reading test should ASSERT the existing thread (counterweight against regression).

## Environment Availability

> No external dependencies introduced by Phase 41. Existing dependencies verified:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `react-markdown` (npm) | Markdown.tsx component overrides | ✓ | 10.1.0 (matches package.json `^10.1.0`) | — |
| `remark-gfm` (npm) | Footnote `[^N]` parsing | ✓ | 4.0.1 (matches package.json `^4.0.1`) | — |
| `rehype-sanitize` (npm) | Default GitHub schema (allows footnote tags) | ✓ | 6.0.0 (matches package.json `^6.0.0`) | — |
| Tavily API account | `webSearch` Tavily call | (user-provided) | API v1 | News posts skipped silently if `tavilyApiKey` missing (existing behavior) |
| Node 20+ runtime for tests | `node --test` esbuild tsx loader | ✓ | (project standard) | — |
| TypeScript 5.9 | tsc -b --noEmit | ✓ | (project standard) | — |
| AbortController + AbortSignal | Native (browser + Node 20+) | ✓ | — | `composeSignal` already polyfills `AbortSignal.any` fallback (`providers/llm/index.ts:35-45`) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Skip condition note:** Phase 41 changes are pure code/config; no new external services. The Tavily account requirement is a USER setup (existing for v1.4+) not a phase prerequisite.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` + esbuild tsx loader |
| Config file | `app/package.json` `"test": "npm run test:main; npm run test:actions"` |
| Quick run command | `node --test app/tests/services/post-essay-depth.test.mjs` |
| Full suite command | `cd app && npm test` |

No jsdom or React Testing Library — established source-reading + behavioral test pattern from Phase 27/35/37/39/40.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **SC-1** | After dismissing concept X, refillQueue does not enqueue post for X | unit (walker boundary) | `node --test app/tests/services/concept-feed-source-diversity-wiring.test.mjs` | ❌ Wave 0 |
| **SC-2 (a)** | News-branch Tavily call passes `usedDomains` | source-reading | (same file as SC-1) | ❌ Wave 0 |
| **SC-2 (b)** | Consecutive calls return different top domains when ≥2 high-quality domains exist | behavioral (mock webSearch + filterForDiversity assertion) | (same file as SC-1) | ❌ Wave 0 |
| **SC-2 (c)** | `WebSearchOptions.excludeDomains` threads to Tavily `exclude_domains` body field | behavioral (mock fetch / capture body) | `node --test app/tests/services/web-search-exclude-domains.test.mjs` | ❌ Wave 0 |
| **SC-2 (d)** | Day-boundary `loadCache()` mismatch fires `sourceDiversityService.reset()` | behavioral | `node --test app/tests/services/source-diversity-day-boundary-reset.test.mjs` | ❌ Wave 0 |
| **SC-3** | `EssayOptions.depth: 'deep'` produces 350-600w; standard 150-250w | source-reading + behavioral mock | `node --test app/tests/services/post-essay-depth.test.mjs` | ❌ Wave 0 |
| **SC-4** | News essay prompt receives `sources.slice(0, 3)` joined | source-reading | (same file as SC-3) | ❌ Wave 0 |
| **SC-5 (a)** | LLM news prompt contains footnote instruction string | source-reading | (same file as SC-3) | ❌ Wave 0 |
| **SC-5 (b)** | Markdown.tsx has `components={{ sup, a, section }}` overrides | source-reading | `node --test app/tests/components/Markdown-citation-overrides.test.mjs` | ❌ Wave 0 |
| **SC-5 (c)** | `Markdown.tsx`'s sanitize schema spreads default `sup` attributes (regression guard for Pitfall 4) | source-reading | (same file as SC-5 (b)) | ❌ Wave 0 |
| **SC-6** | `generateEssayMeta` body slice cap is 4000 chars | source-reading | (same file as SC-3) | ❌ Wave 0 |
| **SC-7 (a)** | All 3 async branches in PostDetailScreen essay useEffect have pre-call `if (signal.aborted) return` | source-reading | `node --test app/tests/screens/PostDetailScreen-abort-threading.test.mjs` | ❌ Wave 0 |
| **SC-7 (b)** | All 3 async branches pass `{ signal: abortController.signal }` to the generator | source-reading | (same file as SC-7 (a)) | ❌ Wave 0 |
| **SC-7 (c)** | `generateConnectionPost` and `generateDiscoverPost` accept and thread `signal` to `chatStream` | source-reading | (same file as SC-7 (a)) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test app/tests/services/post-essay-depth.test.mjs` (or the file the task commit introduced/modified) — < 5s
- **Per wave merge:** `cd app && npm test` (full main + actions suites) — ~30s
- **Phase gate:** Full suite green + tsc -b --noEmit exits 0 before `/gsd:verify-work`. Test baseline target: ≥ pre-Phase-41 pass count + new test cases (~12-16 new assertions across 5 new test files).

### Wave 0 Gaps

The following test files do NOT exist and Wave 0 / Plan 41-01 / Plan 41-02 must create them:

- [ ] `app/tests/services/concept-feed-source-diversity-wiring.test.mjs` — Plan 41-01 (covers SC-1 + SC-2 (a) + SC-2 (b))
- [ ] `app/tests/services/web-search-exclude-domains.test.mjs` — Plan 41-01 (covers SC-2 (c))
- [ ] `app/tests/services/source-diversity-day-boundary-reset.test.mjs` — Plan 41-01 (covers SC-2 (d))
- [ ] `app/tests/services/post-essay-depth.test.mjs` — Plan 41-02 (covers SC-3 + SC-4 + SC-5 (a) + SC-6)
- [ ] `app/tests/screens/PostDetailScreen-abort-threading.test.mjs` — Plan 41-02 (covers SC-7 (a) + SC-7 (b) + SC-7 (c))
- [ ] `app/tests/components/Markdown-citation-overrides.test.mjs` — Plan 41-02 (covers SC-5 (b) + SC-5 (c))

Framework install: not needed — `node --test` is built into Node 20+; esbuild tsx loader already configured.

Existing test infrastructure (no DOM, no jsdom, source-reading + behavioral mocks) is sufficient for all 7 success criteria. Operator UAT covers the visual-render aspect of SC-5 (manual: open a news post, see chips + footnote section).

## Sources

### Primary (HIGH confidence)

- `app/src/services/concept-feed.service.ts` (direct read 2026-05-09) — news call sites at `:1083-1131` and `:1280-1313`, walker at `:1212`, `loadCache` at `:167-202`
- `app/src/services/web-search.service.ts` (direct read) — `WebSearchOptions` at `:13-17`, body builder at `:39-50`
- `app/src/services/post-essay.service.ts` (direct read) — `EssayOptions` at `:11-13`, generators at `:81-183`, `generateEssayMeta` at `:43-79`, `patchPostEssayInCache` at `:192-213`
- `app/src/screens/PostDetailScreen.tsx` (direct read) — essay useEffect at `:282-390`, 3 async branches at `:312-339`
- `app/src/components/Markdown.tsx` (direct read) — sanitize schema at `:12-22`, plugin chain at `:36`
- `app/src/services/source-diversity.service.ts` (direct read) — public 5-function API + `extractDomain` helper
- `app/src/services/engagement.service.ts` (direct read) — `getDismissedAnchorIds()` API
- `app/src/providers/llm/index.ts` (direct read) — `CompletionOptions.signal` at `:53-58`, `composeSignal` at `:35-45`, all 6 provider impls thread signal correctly (verified via grep)
- `app/src/types/index.ts` (direct read) — `PostSnapshot` at `:481-496`, `DailyPost` at `:528-544`
- `app/package.json` (direct read) — react-markdown 10.1.0, remark-gfm 4.0.1, rehype-sanitize 6.0.0
- `npm view react-markdown version` (registry verification 2026-05-09) — confirms 10.1.0 latest, published 2025-03-07
- `npm view remark-gfm version` — confirms 4.0.1 latest
- `https://docs.tavily.com/api-reference/endpoint/search` (WebFetch 2026-05-09) — `exclude_domains` snake_case, default `[]`, max 150; `max_results` default 5, range 0-20
- `https://github.com/syntax-tree/hast-util-sanitize/blob/main/lib/schema.js` (WebFetch 2026-05-09) — confirmed `section`, `sup` in tagNames; `a` allows `dataFootnoteRef`, `dataFootnoteBackref`, `ariaDescribedBy`, `ariaLabel`, `href`; `section` allows `dataFootnotes` + `[className, 'footnotes']` literal-value match
- `https://github.com/remarkjs/remark-gfm` (WebFetch 2026-05-09) — confirmed footnote HTML output shape including `data-footnote-ref` / `data-footnote-backref` / `data-footnotes` attributes
- `https://github.com/orgs/remarkjs/discussions/1270` (WebFetch 2026-05-09) — canonical pattern for customizing react-markdown footnote rendering via `components` prop overrides on `sup`/`a`/`section`
- `.planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md` (direct read) — Phase 41 contract section with exact wiring sites enumerated
- `CLAUDE.md` (direct read) — Concept Feed Pipeline, News post pipeline, Phase 35 KV-cache rule footnote, i18n workflow, Phase 32.1 best practices

### Secondary (MEDIUM confidence)

- `https://help.tavily.com/articles/7879881576-optimizing-your-query-parameters` (WebFetch 2026-05-09) — recommends `max_results ≤ 10` for relevance; doesn't quantify quality cliff
- `https://help.tavily.com/articles/9712346824-controlling-search-results-with-include-and-exclude-domains` (WebSearch result, not directly fetched) — corroborates exclude_domains snake_case behavior
- WebSearch (Brave / built-in) results on react-markdown v10 components prop — corroborate node + ExtraProps + className signatures, no contradictions

### Tertiary (LOW confidence)

- WebSearch result claiming `rehype-sanitize` "removes classes because classes are a security vector" — true generally but the GitHub default schema explicitly allows `[className, 'footnotes']` for `section` (verified directly), so this claim doesn't apply to footnote rendering. Documented to flag the over-broad assertion.
- React-markdown changelog v9 → v10 specifics — could not WebFetch GitHub changelog page; npm registry shows v10.1.0 published 2025-03-07. No regressions observed in installed app's behavior; assume API stability for `components` prop.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all versions verified against npm registry (2026-05-09); installed versions match latest
- Architecture patterns: **HIGH** — Tavily docs + remark-gfm/react-markdown docs + hast-util-sanitize source code all directly verified
- Pitfalls: **HIGH** — Pitfalls 1-9 derived from direct file reads; Pitfall 3 (loadCache placement) is the most subtle and has the recommendation explicit
- Sanitize schema interaction (Pitfall 4): **HIGH** — verified via direct WebFetch of hast-util-sanitize/lib/schema.js
- Word-count test strategy (Pitfall 5): **MEDIUM** — recommends dual approach but project lacks an existing chat-stream mock; planner may need to bring one in or punt to source-reading-only
- Day-boundary reset placement (Pitfall 3): **MEDIUM** — CONTEXT.md says "loadCache's date-mismatch branch"; that branch is read-only today. Idempotent placement works but planner should explicitly choose Option A vs B and document.
- Word-count behavioral assertion in CI: **LOW-MEDIUM** — no live LLM in CI; source-reading covers the prompt instruction but does not verify LLM compliance. Operator UAT is the real gate.

**Research date:** 2026-05-09
**Valid until:** 2026-06-08 (30 days for stable React/markdown ecosystem; revisit if Tavily API or react-markdown ships a major)

---

*Phase: 41-pipeline-wiring-essay-depth*
*Research completed: 2026-05-09*
