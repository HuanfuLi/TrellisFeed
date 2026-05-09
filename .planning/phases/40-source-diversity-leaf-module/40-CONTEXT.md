---
phase: 40-source-diversity-leaf-module
status: ready-for-planning
gathered: 2026-05-09
requirements: [CONTENT-02]
---

# Phase 40: Source Diversity Leaf Module — Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Foundation leaf module for per-anchor web-domain rotation. Three pure-logic functions plus a reader and a reset, bundled with a hand-curated ~200-entry domain quality table. Operates exclusively on **web domains** (URL hostnames like `nature.com`, `wikipedia.org`) — NOT on Trellis's mindmap "concept domain / cluster" taxonomy. The leaf has zero involvement with anchor classification, the knowledge graph, or any cross-system semantics beyond using `anchorId` as an opaque Map key.

**Phase 40 ships the leaf + its tests. The integration into `refillQueue`'s news branch lives in Phase 41 (success criterion #2 there).** Mirrors Phase 39's foundation-only shape (engagement service shipped in Phase 39; UI wiring deferred to Phase 43).

**Out of scope for Phase 40 (Phase 41 owns):**
- Widening Tavily call sites' `maxResults` from 1 to ~5
- Passing `exclude_domains` from `getUsedDomains(anchorId)` into the Tavily request body
- Calling `recordServedDomain` after a result is committed to a post
- Calling `reset()` on day boundary (date-mismatch detection lives in `concept-feed.service.ts:loadCache()` already)

</domain>

<decisions>
## Implementation Decisions

### Domain-Tier List (the bundled quality table)

- **D-01:** **Hand-curated by Claude during planning.** Approximately 200 entries covering peer-reviewed academic publishers, .edu/.gov domains, established journalism, well-known general-interest sites, and a tail of known SEO/AI-content farms. Reviewable in the PR. Zero external dependency — preserves Trellis's local-first ethos.
- **D-02:** **Continuous score `[0.0, 1.0]`.** Direct float per domain. Matches ROADMAP success criterion #3 verbatim. Authored by hand at planning time; future tuning is a single-file edit.
- **D-03:** **Editorial line — expansive at the top, narrow at the floor.**
  - Top tier (≥0.85): peer-reviewed (`nature.com`, `science.org`, `cell.com`, `nejm.org`, `pnas.org`, `ieee.org`, `acm.org`), .edu/.gov/.org research domains (`nih.gov`, `nasa.gov`, MIT, Stanford, etc.), established journalism (`nytimes.com`, `wsj.com`, `bbc.com`, `reuters.com`, `apnews.com`, `theguardian.com`, `washingtonpost.com`, `economist.com`, etc.).
  - Mid tier (0.4–0.7): general-interest / aggregator / encyclopedic sites (Wikipedia at ~0.7 — high-mid given quality variance; established trade/industry pubs; well-edited blogs from named experts).
  - Low tier (0.1–0.3): unedited blogs / aggregator-of-aggregator sites; Medium personal posts; Substack newsletters with no editorial layer.
  - Blocked (0.0): known content farms, AI-generated content sites, SEO aggregators, scraper sites that re-publish without attribution.
  - **Mainstream outlets all get the same score regardless of partisan lean.** Trellis takes no editorial position on left/right framing — quality is judged by editorial process, fact-check standards, and reputation, not viewpoint.
- **D-04:** **Inline in `source-diversity.service.ts`.** Single TypeScript const at the bottom of the file: `const DOMAIN_TIERS: Readonly<Record<string, number>> = { 'nature.com': 0.95, ... }`. ~6KB; trivial. Matches Phase 37 leaf-module discipline (no JSON imports, no separate data file).

### Re-Ranking Algorithm (`filterForDiversity`)

- **D-05:** **Strict bucket split.** Two-pass filter:
  1. Pass A — results whose extracted domain is NOT in `usedDomains`, sorted by `scoreSource(domain)` desc.
  2. Pass B — results whose extracted domain IS in `usedDomains`, sorted by `scoreSource(domain)` desc.
  Return `[...passA, ...passB]`. Any unseen result beats any seen result. Predictable; easy to test; matches user's mental model of "show me something new."
- **D-06:** **Fallback returns the highest-quality result anyway** when both passes are empty after blocked-floor filtering. Implementation: if filtered list is empty, take `results.sort((a, b) => scoreSource(domainOf(b.url)) - scoreSource(domainOf(a.url)))[0]` and return as a single-element array. Prevents the silent zero-posts-for-concept failure ROADMAP success criterion #1 forbids. ROADMAP's phrase "lowest-scored blocked domain" is interpreted as **"best-of-the-bad" (least blocked, not most blocked)**.
- **D-07:** **Stable sort preserves Tavily's original ordering for ties.** When two unseen results tie on `scoreSource`, the one Tavily returned first wins position 0 in the re-ranked array. Free-rides on Tavily's per-query relevance signal. V8 stable-sort guaranteed since 2018.
- **D-08:** **0.0-scored results CAN surface via the fallback** when nothing else is available. Consistent with D-06. The user-visible cost of an occasional weak source is preferable to silently dropping the concept this cycle.

### Domain Normalization (URL → comparable hostname)

- **D-09:** **Collapse all subdomains to the registrable root.** `science.nature.com` → `nature.com`; `www.bbc.com` → `bbc.com`; `m.wikipedia.org` → `wikipedia.org`; `science.howstuffworks.com` → `howstuffworks.com`. Three Nature subdomains count as one already-seen Nature source for diversity purposes.
- **D-10:** **Malformed URL → treat as quality 0, exclude from re-ranked array.** Wrap `new URL(...)` in try/catch. On failure, the result silently drops out of the re-ranked array (or surfaces only via the D-06 fallback if everything else is also bad). Defensive; one bad URL must never crash a refill cycle.
- **D-11:** **Hand-roll a tiny ~10-entry Public Suffix List slice.** Bundled const inside `source-diversity.service.ts`:
  ```ts
  const MULTI_SEGMENT_TLDS = new Set(['co.uk', 'co.jp', 'com.au', 'co.nz', 'org.uk', 'ac.uk', 'edu.au', 'gov.uk', 'co.kr', 'com.br']);
  ```
  Logic: if `hostname.split('.').slice(-2).join('.')` matches a known multi-segment TLD, registrable root = last 3 segments; otherwise last 2 segments. Handles ~99% of real cases. Zero new dependency. NOT bundling `tldts`. Adding obscure ccTLDs is a one-line edit when needed.

### API Shape

- **D-12:** **File location:** `app/src/services/source-diversity.service.ts`. Matches Phase 39's `engagement.service.ts` and adjacent `concept-feed.service.ts`, `web-search.service.ts`, `post-history.service.ts`. The leaf has internal state (the session Map) — fits `services/` convention.
- **D-13:** **Singleton object export:** `export const sourceDiversityService = { filterForDiversity, recordServedDomain, getUsedDomains, scoreSource, reset }`. Matches `engagementService`, `daily-read.service.ts`, `post-history.service.ts`, `settingsService` patterns. One import line at call sites.
- **D-14:** **API surface = 5 functions:**
  1. `filterForDiversity(results: WebSearchResult[], usedDomains: Set<string>): WebSearchResult[]`
  2. `recordServedDomain(anchorId: string, domain: string): void`
  3. `getUsedDomains(anchorId: string): Set<string>` — reader required for Phase 41's `refillQueue` to derive Tavily's `exclude_domains` and to pass `usedDomains` into `filterForDiversity`.
  4. `scoreSource(domain: string): number` — `[0, 1]`, O(1) Map lookup.
  5. `reset(): void` — clears the session-scoped `Map<anchorId, Set<domain>>`. Called by consumer (Phase 41) on day boundary; **not event-driven** (per CLAUDE.md "one signal per semantic event" — `reset()` is wholesale wipe, not a per-id change).
- **D-15:** **Internal helpers exported explicitly for tests:** `extractDomain(url: string): string | undefined`, `normalizeHost(hostname: string): string`, plus `MULTI_SEGMENT_TLDS` and `DOMAIN_TIERS` consts. Same pattern as `engagement.service.ts` exposing internal state-shape via storage-key tests. Cleaner unit tests; faster regression localization.

### Carried-Forward Decisions (Locked by Prior Phases — NOT Re-Discussed)

- **Leaf-module discipline (Phase 37):** No JSON imports; no `lib/date.ts` import; no `react-i18next`; no module-init cross-service imports; `.ts` extension on all relative imports. Phase 27 / Phase 35 / Phase 39 source-reading invariant test pattern reused.
- **Sync-only invariant (built into ROADMAP success criterion #4):** No `await`, `fetch`, `chatStream`, `chatCompletion`, or any I/O inside the leaf. Enforced via source-reading test (same shape as `tests/services/engagement-anti-wire.test.mjs`).
- **Atomic per-file commits + paired source+test (Phase 37 D-03).**
- **Tavily query stays English (CLAUDE.md i18n rule):** No locale-aware filtering tied to query language. The leaf operates on raw URLs from Tavily — no locale awareness.
- **Session-scoped Map, no localStorage:** Pure in-memory `Map<string, Set<string>>` per ROADMAP. Lost on cold-boot — acceptable for v1.5 (acts like an "in this session, don't repeat" hint, not a multi-day commitment).
- **One signal per semantic event (CLAUDE.md):** `reset()` is called by consumer; no `DOMAIN_RESET` event introduced.
- **STORAGE_KEY pattern (`trellis_*`):** N/A — no persisted storage in this leaf.
- **Phase 40 must be parallel-safe with Phase 39 (already shipped):** Phase 40 has no shared mutable state with `engagement.service.ts`. Confirmed: Phase 40 imports nothing from engagement; engagement imports nothing from source-diversity.

### Claude's Discretion

- The exact ~200-entry tier list (specific domains and their scores) will be authored at planning/implementation time. Operator can override any specific score in the PR.
- The exact ~10-entry MULTI_SEGMENT_TLDS slice — Claude picks initial coverage; operator can extend.
- Test file names: `tests/services/source-diversity.service.test.mjs` (behavioral) + `tests/services/source-diversity-anti-wire.test.mjs` (source-reading invariant). Planner can collapse if preferred.
- Whether the `extractDomain` helper accepts `undefined` / non-string inputs gracefully (defensive) or trusts callers (per Phase 37 leaf-module discipline of trusting internal callers). Leaning defensive given URL strings come from external Tavily results.
- Choice of comparison primitive for `usedDomains` — `Set<string>` (locked by D-13/D-14) vs `ReadonlySet<string>` in the `filterForDiversity` signature (cosmetic; Set is mutated by recordServedDomain but read-only at filterForDiversity boundary).

### Folded Todos

None. Three pending todos exist in `.planning/todos/pending/`; none relevant to Phase 40 scope (double-column feed → Phase 42; cosine similarity → unrelated subsystem; auto-gen podcast → already addressed via memory `project_serverless_no_background_tasks.md`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 40 specs

- `.planning/ROADMAP.md` lines 1112–1121 — Phase 40 entry: goal, depends-on, requirements, 4 success criteria, plans-TBD.
- `.planning/REQUIREMENTS.md` lines 24, 77 — CONTENT-02 definition + traceability row.

### Load-bearing CLAUDE.md sections

- `CLAUDE.md` "Concept Feed Generation Pipeline (load-bearing)" — Phase 40's leaf consumed by Phase 41 inside `refillQueue`'s news branch.
- `CLAUDE.md` "i18n Workflow" §"What NOT to translate" — Tavily web-search queries stay English; Phase 40 receives raw URLs without locale awareness.
- `CLAUDE.md` "Best practices learned in Phase 32.1" rules 1, 2, 6 (one signal per semantic event), 8 — apply to leaf design.

### Prior-phase precedents (Phase 40 mirrors these patterns)

- **Leaf-module discipline:**
  - `app/src/lib/i18n-leaf.ts` — Phase 37's canonical leaf-module shim. Three named exports, no JSON, no `lib/date.ts`.
  - `app/src/lib/refill-mutex.ts` — Phase 36's stateful leaf (mutex with internal Promise reference). Confirms `lib/` precedent for stateful leaves; Phase 40 picks `services/` per D-12.
  - `app/src/services/engagement.service.ts` (Phase 39) — singleton-object export pattern (`export const engagementService = { … }`), localStorage-backed, stable across days. Phase 40 mirrors API shape; Phase 40 differs by being session-scoped Map (no localStorage).
- **Source-reading invariant tests:**
  - `app/tests/services/leaf-imports.test.mjs` (Phase 37) — 4 assertions, regex-based, scans services/lib/providers files for forbidden import patterns.
  - `app/tests/services/engagement-anti-wire.test.mjs` (Phase 39) — 800-char-window co-emit scan + counterweight assertion. Closest precedent for Phase 40's "no await/fetch/chatStream/chatCompletion in leaf" test.
  - `.planning/phases/27-add-i18n-l10n-support/27-VALIDATION.md` — original source-reading invariant pattern from i18n phase.
- **Web search infrastructure:**
  - `app/src/services/web-search.service.ts` — Tavily wrapper. `WebSearchOptions` shape: `{ topic, maxResults, includeImages }`. Returns `WebSearchResult[]` with `{title, url, content, score}`. Phase 40 receives this `WebSearchResult[]` shape into `filterForDiversity`.
  - `app/src/services/concept-feed.service.ts:1083–1129` (news creation) and `:1293–1312` (news pre-fetch) — the two Tavily call sites Phase 41 will modify to consume Phase 40's leaf.
- **Phase 39 SUMMARY (leaf+walker pattern):**
  - `.planning/phases/39-engagement-service-walker-extension/39-01-engagement-service-SUMMARY.md` — atomic-commit ordering, Task 8 self-check pattern, source-reading-window fragility lesson (image-gen-key-gate's 6000-char window). Apply preventively in Phase 40 — keep test-window-sensitive code blocks compact.

### External resources (no specs to read for v1.5)

- Tavily API docs (`https://docs.tavily.com/api-reference/endpoint/search`) — informational only; the leaf does NOT call Tavily directly. Phase 41 will pass `exclude_domains` per Tavily's spec.
- Public Suffix List (`https://publicsuffix.org/`) — informational reference for D-11's hand-rolled slice; NOT bundled.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `WebSearchResult` type from `app/src/types/index.ts` — `{title, url, content, score}`. Phase 40's `filterForDiversity` takes `WebSearchResult[]` and returns `WebSearchResult[]`.
- `ServiceResult<T>` shape — Phase 40's leaf does NOT return `ServiceResult` (pure-logic functions, never fail in a network sense). Functions return their natural types directly.
- `Map<K, V>` and `Set<K>` — built-in. The session bookkeeping Map is `Map<string, Set<string>>` (anchorId → set of registrable-root domains).

### Established Patterns

- **Singleton service export** (`engagementService`, `dailyReadService`, `postHistoryService`, `settingsService`) — D-13 follows this.
- **Internal state in module closure** (`lib/refill-mutex.ts`'s `inflight: Promise | null`; `engagement.service.ts`'s `loadState()` lazy cache) — Phase 40 uses a top-level `const usedByAnchor = new Map<string, Set<string>>()`.
- **Inline const tables** (`STYLE_WEIGHTS` in `style-assignment.ts`; `STARTER_POSTS` in starter-posts) — D-04 follows this.
- **Source-reading invariant tests** (Phase 27, 35, 37, 39) — Phase 40 adds one for the sync-only contract.

### Integration Points

- **Phase 41 will import:** `import { sourceDiversityService } from './source-diversity.service'` inside `concept-feed.service.ts`. Two new call sites (one inside the news pre-fetch loop, one inside the news creation loop). Plus a `reset()` call hook in date-mismatch detection (likely `loadCache()` at `concept-feed.service.ts`).
- **Tavily payload shape change (Phase 41 — NOT Phase 40):** `web-search.service.ts:webSearch()`'s `WebSearchOptions` will gain `excludeDomains?: string[]`; the body sent to Tavily will pass it through to Tavily's `exclude_domains` field. Phase 40 must NOT modify `web-search.service.ts`.
- **Day boundary trigger:** `concept-feed.service.ts:loadCache()` already detects `cached.date !== today()`. Phase 41 will add `sourceDiversityService.reset()` at that detection site. Phase 40 ships `reset()` ready-to-be-called.

</code_context>

<specifics>
## Specific Ideas

- **The "best-of-the-bad" fallback (D-06)** is the load-bearing UX choice — operator explicitly affirmed this prevents the silent zero-posts-for-concept failure that ROADMAP success criterion #1 forbids. Wording in implementation should reflect this: code comment at the fallback site should reference D-06 + ROADMAP success criterion #1, similar to how Phase 36 GAP-B's `Math.max(count * 2, len)` math has a load-bearing comment block.
- **The PSL slice (D-11) starts at ~10 entries.** Operator noted: it's easy to add more later. Implementation comment should make this explicit: `// MULTI_SEGMENT_TLDS — covers ~99% of real Tavily URLs. Add more as data shows.`
- **"Concept domain" vs "web domain" naming friction** surfaced during discuss-phase — operator initially confused the two. Code naming convention: variables named `domain` always mean web hostname inside this leaf; never concept/cluster. Comments at the public API should disambiguate where ambiguity might arise (e.g., the `recordServedDomain(anchorId, domain)` doc comment should note "domain = web hostname like 'nature.com', NOT mindmap cluster").

</specifics>

<deferred>
## Deferred Ideas

### Out of Phase 40 scope

- **Widening Tavily `maxResults` from 1 to ~5** — Phase 41 (its success criterion #2). Phase 40's `filterForDiversity` is meaningless until the caller fetches more than 1 result; that wiring is explicitly Phase 41's job.
- **Calling `recordServedDomain` after each post creation** — Phase 41 wiring. Phase 40 ships the function, ready-to-be-called.
- **Triggering `reset()` on day boundary** — Phase 41 adds the call site at `concept-feed.service.ts:loadCache()`'s date-mismatch branch. Phase 40 ships `reset()`, ready-to-be-called.
- **Multi-snippet essay grounding** (`sources.slice(0, 3)` instead of `sources[0]`) — Phase 41 success criterion #4. Phase 40's leaf returns a re-ranked array of arbitrary length; Phase 41 decides how many to take.
- **Citation rendering polish** (sup/a/section ReactMarkdown overrides) — Phase 41 success criterion #5.

### Outside v1.5 entirely

- **Cross-device source-history sync** — local-first scope; needs backend; out of v1.5.
- **User-overridable per-domain quality scores** ("I think wikipedia.org should be 0.9 not 0.7") — not in current ROADMAP; defer to a future user-customization phase if signal warrants.
- **Domain trust scores informed by user engagement signals** (e.g., "user dismissed 3 posts from medium.com → demote") — speculative; would require Phase 39's engagement service to feed into Phase 40's scoreSource. Not in v1.5; defer to v1.6 if v1.5 ships.
- **Tier-aware fallback** (e.g., "if all results are blocked, return the highest-tier blocked one") — D-06's "best-of-the-bad" already implicitly does this since `scoreSource` ordering picks the highest-scored available result. Stated here for completeness.
- **Non-English-language source bias** (e.g., user in JP gets `.jp` sources weighted higher) — speculative; intersects with i18n locale handling and would need user opt-in. Out of v1.5; defer.
- **Replacing the hand-rolled PSL slice with `tldts`** — bundle-size cost (30KB) and Phase 37 leaf-module discipline both argue against. Revisit if hand-rolled coverage proves inadequate in production.

### Reviewed Todos (not folded)

None reviewed for folding — the 3 pending todos in `.planning/todos/pending/` are unrelated to Phase 40 scope:
- `2026-05-07-double-column-feed-to-further-mimic-rednote-bilibili-info-flow.md` → Phase 42 (masonry layout)
- `2026-05-07-fix-cosine-similarity-threshold-cache-miss.md` → unrelated subsystem (embedding pre-check, Phase 33)
- `2026-05-09-inspect-auto-gen-podcast-working-or-not-and-debug.md` → already addressed (architectural limitation captured in `~/.claude/projects/-Users-Code-EchoLearn/memory/project_serverless_no_background_tasks.md`)

</deferred>

---

*Phase: 40-source-diversity-leaf-module*
*Context gathered: 2026-05-09*
