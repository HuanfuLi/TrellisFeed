---
phase: 40-source-diversity-leaf-module
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/services/source-diversity.service.ts
  - app/tests/services/source-diversity.service.test.mjs
  - app/tests/services/source-diversity-anti-wire.test.mjs
autonomous: true
requirements:
  - CONTENT-02
must_haves:
  truths:
    - "filterForDiversity(results, usedDomains) returns a re-ranked list that prefers unseen domains, with a best-of-the-bad fallback that returns the highest-scoring single result when both passes are empty (no silent zero-posts-for-concept failure)"
    - "recordServedDomain(anchorId, domain) updates a session-scoped Map<anchorId, Set<domain>> synchronously; reset() clears the map (called by Phase 41 on day boundary)"
    - "scoreSource(domain) returns a number in [0, 1] from the bundled ~200-entry domain-tier const; runs in O(1) via Map<string, number> lookup"
    - "Domain lookup is fully synchronous (no await, no network) — verifiable via source-reading test that asserts no async / fetch / chatStream / chatCompletion in the leaf module"
  artifacts:
    - path: "app/src/services/source-diversity.service.ts"
      provides: "Source diversity leaf module (5-function singleton + extractDomain + normalizeHost + DOMAIN_TIERS + MULTI_SEGMENT_TLDS + UNKNOWN_DOMAIN_SCORE)"
      contains: "export const sourceDiversityService"
    - path: "app/tests/services/source-diversity.service.test.mjs"
      provides: "Behavioral test suite — 15 cases covering filterForDiversity (Pass A/B + D-06 fallback + D-10 malformed exclusion + stable sort), scoreSource (top/unknown/blocked), extractDomain (subdomain collapse + multi-segment TLD + malformed), recordServedDomain/getUsedDomains round-trip, reset()"
    - path: "app/tests/services/source-diversity-anti-wire.test.mjs"
      provides: "Source-reading invariant test — 4 assertions: no `async ` keyword, no `fetch(`, no `chatStream(` / `chatCompletion(`, plus counterweight that filterForDiversity IS present in the scanned source"
  key_links:
    - from: "app/src/services/source-diversity.service.ts"
      to: "app/src/types/index.ts"
      via: "import type { WebSearchResult } from '../types/index.ts'"
      pattern: "import\\s+type\\s+\\{\\s*WebSearchResult\\s*\\}\\s+from\\s+['\"]\\.\\./types/index\\.ts['\"]"
    - from: "app/tests/services/source-diversity.service.test.mjs"
      to: "app/src/services/source-diversity.service.ts"
      via: "dynamic import of the .ts source"
      pattern: "await\\s+import\\(['\"]\\.\\./\\.\\./src/services/source-diversity\\.service\\.ts['\"]"
    - from: "app/tests/services/source-diversity-anti-wire.test.mjs"
      to: "app/src/services/source-diversity.service.ts"
      via: "readFileSync of the source file (single-file scan, no walk)"
      pattern: "readFileSync\\([^)]*source-diversity\\.service\\.ts"
---

<objective>
Land the foundation source-diversity leaf module — a pure-logic singleton that owns per-anchor web-domain rotation state (session-scoped Map), the bundled ~200-entry domain quality table, URL normalization (PSL slice for multi-segment TLDs), and a two-pass re-ranking algorithm with a best-of-the-bad fallback. Phase 40 ships the leaf + its tests ONLY; Phase 41 wires the leaf into `concept-feed.service.ts`'s news branch (NOT this phase's job).

Purpose: Provides the API surface (`filterForDiversity`, `recordServedDomain`, `getUsedDomains`, `scoreSource`, `reset`, `extractDomain`) that Phase 41 will pass into Tavily's `exclude_domains` field and use to re-rank already-fetched result arrays. Closes CONTENT-02 from REQUIREMENTS.md. No I/O, no events, no UI.

Output: A standalone leaf service (`app/src/services/source-diversity.service.ts`) modeled on `engagement.service.ts` (Phase 39 peer template) MINUS localStorage and MINUS event emission; a behavioral test suite (15 cases) and a single-file source-reading anti-wire test (4 assertions).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/40-source-diversity-leaf-module/40-CONTEXT.md
@.planning/phases/40-source-diversity-leaf-module/40-RESEARCH.md
@.planning/phases/40-source-diversity-leaf-module/40-VALIDATION.md
@CLAUDE.md
@app/src/services/engagement.service.ts
@app/tests/services/engagement.service.test.mjs
@app/tests/services/engagement-anti-wire.test.mjs
@app/src/types/index.ts

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->
<!-- Executor should use these directly — no codebase exploration needed. -->

From app/src/types/index.ts (lines 498-503 — the input type for filterForDiversity):

```typescript
export interface WebSearchResult {
  title: string;
  url: string;
  content: string;  // clean text snippet from Tavily
  score: number;    // relevance 0-1 (Tavily's relevance, NOT Phase 40's quality score)
}
```

Source-diversity service public API (the contract this plan ships — Phase 41 will consume):

```typescript
export const sourceDiversityService: {
  filterForDiversity(results: WebSearchResult[], usedDomains: Set<string>): WebSearchResult[];
  recordServedDomain(anchorId: string, domain: string): void;
  getUsedDomains(anchorId: string): Set<string>;
  scoreSource(domain: string): number;            // returns [0, 1]
  reset(): void;                                  // wipes session Map; emits NOTHING
};

// Exported internals (D-15 — for tests + Phase 41 may import extractDomain):
export function extractDomain(url: string): string | undefined;
export function normalizeHost(hostname: string): string;
export const MULTI_SEGMENT_TLDS: ReadonlySet<string>;
export const DOMAIN_TIERS: Readonly<Record<string, number>>;
export const UNKNOWN_DOMAIN_SCORE: number;        // 0.5
```

Internal state (D-13/D-14 — session-scoped, no localStorage):

```typescript
const usedByAnchor = new Map<string, Set<string>>();
```

Lost on cold-boot — by design (acts like an "in this session, don't repeat" hint, not multi-day commitment).

Re-ranking algorithm (D-05 — strict bucket split):
1. Pass A: results whose extracted domain is NOT in `usedDomains`, sorted by `scoreSource(domain)` desc.
2. Pass B: results whose extracted domain IS in `usedDomains`, sorted by `scoreSource(domain)` desc.
3. Return `[...passA, ...passB]`. Any unseen result beats any seen result.

Fallback (D-06 — best-of-the-bad — load-bearing UX choice):
- Fires ONLY when both Pass A AND Pass B contributed zero entries (i.e., every input had a malformed URL — `extractDomain` returned undefined for all).
- Implementation: if `ranked.length === 0 && results.length > 0`, take `results.sort((a, b) => scoreSource(extractDomain(b.url) ?? '') - scoreSource(extractDomain(a.url) ?? ''))[0]` and return as a single-element array.
- Code comment at fallback site MUST reference D-06 + ROADMAP success criterion #1.
- IMPORTANT: Valid-but-seen results still surface via Pass B. Fallback is NOT triggered when Pass A is empty but Pass B is non-empty.

Domain normalization (D-09 + D-11 — PSL slice for multi-segment TLDs):

```typescript
const MULTI_SEGMENT_TLDS = new Set([
  'co.uk', 'co.jp', 'com.au', 'co.nz', 'org.uk',
  'ac.uk', 'edu.au', 'gov.uk', 'co.kr', 'com.br',
  'gob.mx', 'ac.nz',  // RESEARCH § 2 additions: covers MX gov + NZ academic
]);

function normalizeHost(hostname: string): string {
  const parts = hostname.split('.');
  const twoSuffix = parts.slice(-2).join('.');
  if (MULTI_SEGMENT_TLDS.has(twoSuffix)) {
    return parts.slice(-3).join('.');
  }
  return twoSuffix;
}
```

Examples: `science.nature.com` → `nature.com`; `www.bbc.co.uk` → `bbc.co.uk`; `m.wikipedia.org` → `wikipedia.org`.

URL extraction (D-10 — defensive try/catch around new URL):

```typescript
export function extractDomain(url: string): string | undefined {
  try {
    const { hostname } = new URL(url);
    return normalizeHost(hostname);
  } catch {
    return undefined;
  }
}
```

Score lookup (D-04 — inline const, O(1) via Map):

```typescript
// Module-level Map initialized once at import time (NOT lazy)
const _tierMap = new Map<string, number>(Object.entries(DOMAIN_TIERS));

export function scoreSource(domain: string): number {
  return _tierMap.get(domain) ?? UNKNOWN_DOMAIN_SCORE;
}
```

`UNKNOWN_DOMAIN_SCORE = 0.5` (RESEARCH § 11 Open Question 1 recommendation — neutral mid-score for unknown domains, NOT 0.0 which is reserved for known-bad).

Phase 39 peer template — what to mirror exactly:
- Block comment header at top of file (phase reference, leaf-module discipline reminders, sync-only invariant note)
- Singleton object export (`export const sourceDiversityService = { ... }`)
- JSDoc on each public method
- `.ts` extension on all relative imports (Plan 37-02 close decision — Node ESM requires it for esbuild tsx loader)

Phase 39 peer template — what to differ:
| Aspect | engagement.service.ts | source-diversity.service.ts |
|--------|------------------------|------------------------------|
| Persistence | localStorage (cross-day) | In-memory Map (session-scoped) |
| State init | `loadState()` lazy parse | `new Map<string, Set<string>>()` at module scope |
| Event emission | Yes (ANCHOR_DISMISSED, ENGAGEMENT_CHANGED) | None |
| External imports | eventBus, postHistoryService | None (only `import type { WebSearchResult }`) |
| STORAGE_KEY | `'trellis_engagement_v1'` | None |

Anti-wire test pattern (D-04 / RESEARCH § 8 Pitfall 4 — preferred approach):
- Single-file source read (NOT multi-file walk like engagement-anti-wire — different invariant shape).
- Assert `!/\basync\s/.test(source)` — proves no `await` can exist (all async calls require `async` function wrapper). RESEARCH § 8 Pitfall 4 explicitly warns AGAINST scanning for `await ` substring (false positive on `// No await — synchronous by design` comments) — the `async` absence assertion is the recommended approach, lifted from RESEARCH § 12.
- Assert `!source.includes('fetch(')` — direct fetch would bypass sync contract.
- Assert `!source.includes('chatStream(')` and `!source.includes('chatCompletion(')` — LLM calls would bypass sync contract.
- Counterweight: assert `source.includes('filterForDiversity')` — proves the scan reaches the live file (catches a rename/delete that would otherwise leave a silently-passing test).

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement source-diversity.service.ts (leaf module + DOMAIN_TIERS + MULTI_SEGMENT_TLDS + 5-function singleton)</name>
  <files>app/src/services/source-diversity.service.ts</files>
  <read_first>
    - app/src/services/engagement.service.ts (full file — Phase 39 peer template; mirror block comment header shape, singleton export shape, JSDoc style, .ts extension on imports; differ on: no localStorage, no events, no eventBus import)
    - app/src/services/daily-read.service.ts (secondary reference — minimal leaf-service shape with reset())
    - app/src/types/index.ts (lines 498-503 — WebSearchResult type, the input shape for filterForDiversity)
    - app/src/services/refill-mutex.ts (Phase 36's stateful leaf — confirms `lib/`/`services/` precedent for stateful leaves; Phase 40 picks `services/` per D-12)
    - .planning/phases/40-source-diversity-leaf-module/40-CONTEXT.md (D-01 through D-15 — all 15 locked decisions)
    - .planning/phases/40-source-diversity-leaf-module/40-RESEARCH.md § 1 (Domain-Tier Curation Strategy — full ~200-entry composition with example domains per tier), § 2 (PSL Slice Validation — adds gob.mx + ac.nz to CONTEXT's initial 10), § 6 (Architecture Patterns — code examples), § 8 (Common Pitfalls — esp. Pitfall 1 subdomain collapse, Pitfall 2 PSL order, Pitfall 3 fallback timing, Pitfall 5 module-level Map init), § 11 (Open Questions — UNKNOWN_DOMAIN_SCORE = 0.5 + bbc.com/bbc.co.uk pair + arxiv.org score)
    - CLAUDE.md §"i18n Workflow" → "What NOT to translate" (Tavily queries stay English; Phase 40 receives raw URLs, no locale awareness)
    - CLAUDE.md §"Best practices learned in Phase 32.1" rules 1, 6 (one signal per semantic event — `reset()` does NOT emit)
  </read_first>
  <behavior>
    - filterForDiversity(results=[ {url:'a.com'} (unseen, score 0.3), {url:'b.com'} (unseen, score 0.9) ], usedDomains=Set()) → returns [b.com, a.com] (Pass A sorted desc)
    - filterForDiversity(results=[ {url:'a.com'} (unseen, score 0.3), {url:'b.com'} (seen, score 0.9) ], usedDomains=Set(['b.com'])) → returns [a.com (Pass A), b.com (Pass B)] — unseen beats seen even when seen is higher quality
    - filterForDiversity with all malformed URLs (e.g., [{url:'not-a-url'}]) → returns [first input element] via D-06 fallback
    - filterForDiversity with empty input → returns []
    - filterForDiversity with one valid + one malformed → returns [valid] (malformed dropped per D-10; D-06 NOT triggered because ranked.length > 0)
    - scoreSource('nature.com') === 0.95 (top tier)
    - scoreSource('wikipedia.org') === 0.72 (mid tier — RESEARCH § 1)
    - scoreSource('ezinearticles.com') === 0.0 (blocked tier)
    - scoreSource('unknown-niche-site-xyz.com') === 0.5 (UNKNOWN_DOMAIN_SCORE)
    - extractDomain('https://science.nature.com/article/abc') === 'nature.com' (subdomain collapse)
    - extractDomain('https://www.bbc.co.uk/news') === 'bbc.co.uk' (multi-segment TLD)
    - extractDomain('https://www.bbc.com/news') === 'bbc.com' (single-segment TLD)
    - extractDomain('not-a-url') === undefined (defensive try/catch)
    - extractDomain('https://m.wikipedia.org/wiki/x') === 'wikipedia.org'
    - normalizeHost('science.nature.com') === 'nature.com'
    - normalizeHost('www.bbc.co.uk') === 'bbc.co.uk' (3-segment registrable root because 'co.uk' is in MULTI_SEGMENT_TLDS)
    - recordServedDomain('anchor-1', 'nature.com') then getUsedDomains('anchor-1') === Set { 'nature.com' }
    - recordServedDomain called twice for same (anchor, domain) → Set still has one entry (Set semantics)
    - getUsedDomains('unknown-anchor') === new Set() (returns fresh empty Set, no throw)
    - reset() after recording two anchors → both getUsedDomains return empty Sets
    - reset() called when Map is empty → no throw, no emission, no side effect
    - File contains NO `async` keyword anywhere; NO `await`; NO `fetch(`; NO `chatStream(`; NO `chatCompletion(`; NO `localStorage`; NO `eventBus`
  </behavior>
  <action>
    Create `app/src/services/source-diversity.service.ts` modeled on `engagement.service.ts` MINUS localStorage and MINUS event emission. Single file, ~250-300 lines (most of which is the DOMAIN_TIERS const).

    Required structure (in this order):

    1. **Block comment header** (~15-20 lines) — mirror `engagement.service.ts` lines 1-25 shape. Content:
       - Phase 40 reference + decision IDs (D-01 through D-15)
       - Purpose: per-anchor web-domain rotation, bundled domain quality table, URL normalization
       - Leaf-module discipline reminders: no JSON imports, no `react-i18next`, no `lib/date.ts`, no module-init cross-service imports, `.ts` extension on all imports
       - Sync-only invariant: no `await`, no `fetch`, no `chatStream`, no `chatCompletion`, no I/O
       - Naming convention note: `domain` always means web hostname, NEVER concept/cluster (CONTEXT.md "Specific Ideas")
       - State scope: session-only, in-memory Map; lost on cold-boot by design

    2. **Imports** — type-only, single line (D-15):
       ```typescript
       import type { WebSearchResult } from '../types/index.ts';
       ```
       That is the ONLY import. Do NOT import eventBus. Do NOT import any other service. Do NOT import lib/date.ts.

    3. **MULTI_SEGMENT_TLDS const** (D-11 + RESEARCH § 2):
       ```typescript
       // MULTI_SEGMENT_TLDS — covers ~99% of real Tavily URLs. Add more as data shows.
       // RESEARCH § 2: gob.mx + ac.nz added beyond CONTEXT's initial 10 (covers MX gov + NZ academic).
       export const MULTI_SEGMENT_TLDS: ReadonlySet<string> = new Set([
         'co.uk', 'co.jp', 'com.au', 'co.nz', 'org.uk',
         'ac.uk', 'edu.au', 'gov.uk', 'co.kr', 'com.br',
         'gob.mx', 'ac.nz',
       ]);
       ```

    4. **UNKNOWN_DOMAIN_SCORE const** (RESEARCH § 11 Open Question 1):
       ```typescript
       // UNKNOWN_DOMAIN_SCORE — neutral mid-score for domains not in DOMAIN_TIERS.
       // 0.5 places unknown domains below established journalism (0.85+) and above
       // known-low sites (0.15-0.38). NOT 0.0 — that's reserved for known-bad.
       // Future tuning is a one-line change.
       export const UNKNOWN_DOMAIN_SCORE = 0.5;
       ```

    5. **normalizeHost helper** (D-09 + D-11 + RESEARCH § 8 Pitfall 2):
       ```typescript
       export function normalizeHost(hostname: string): string {
         const parts = hostname.split('.');
         const twoSuffix = parts.slice(-2).join('.');
         if (MULTI_SEGMENT_TLDS.has(twoSuffix)) {
           return parts.slice(-3).join('.');
         }
         return twoSuffix;
       }
       ```

    6. **extractDomain helper** (D-10 — defensive try/catch):
       ```typescript
       /**
        * Collapse a URL to its registrable-root domain. Returns undefined if the
        * URL is malformed (D-10) — caller filters these out of the re-ranked array.
        */
       export function extractDomain(url: string): string | undefined {
         try {
           const { hostname } = new URL(url);
           return normalizeHost(hostname);
         } catch {
           return undefined;
         }
       }
       ```

    7. **Internal state** (D-13/D-14):
       ```typescript
       // Session-scoped per-anchor served-domain bookkeeping.
       // Map<anchorId, Set<registrable-root-domain>>. Lost on cold-boot — by design.
       const usedByAnchor = new Map<string, Set<string>>();
       ```

    8. **filterForDiversity implementation** (D-05 + D-06 + RESEARCH § 6):
       ```typescript
       /**
        * Re-rank Tavily results to prefer unseen domains (Pass A) over seen domains
        * (Pass B). Within each pass, sort by scoreSource(domain) descending. Stable
        * sort (V8 since 2018) preserves Tavily's original ordering for ties (D-07).
        *
        * D-06 best-of-the-bad fallback: if BOTH passes are empty (every input had
        * a malformed URL — extractDomain returned undefined for all), return the
        * single highest-scoring raw result. Prevents the silent zero-posts-for-
        * concept failure that ROADMAP success criterion #1 forbids.
        *
        * IMPORTANT: Valid-but-seen results still surface via Pass B. The fallback
        * is NOT triggered when Pass A is empty but Pass B has entries.
        *
        * @param results - Tavily WebSearchResult array (un-modified)
        * @param usedDomains - registrable-root domains already served for this anchor
        * @returns re-ranked WebSearchResult array (may be shorter than input if
        *          malformed URLs were dropped per D-10)
        */
       export function filterForDiversity(
         results: WebSearchResult[],
         usedDomains: Set<string>,
       ): WebSearchResult[] {
         // Annotate each result with its registrable-root domain; drop malformed URLs (D-10).
         const scored = results
           .map(r => ({ r, domain: extractDomain(r.url) }))
           .filter((entry): entry is { r: WebSearchResult; domain: string } =>
             entry.domain !== undefined,
           );

         // Pass A: unseen domains, sorted by score desc.
         const unseen = scored
           .filter(({ domain }) => !usedDomains.has(domain))
           .sort((a, b) => scoreSource(b.domain) - scoreSource(a.domain));

         // Pass B: seen domains, sorted by score desc.
         const seen = scored
           .filter(({ domain }) => usedDomains.has(domain))
           .sort((a, b) => scoreSource(b.domain) - scoreSource(a.domain));

         const ranked = [...unseen, ...seen].map(({ r }) => r);

         // Phase 40 D-06: best-of-the-bad fallback — load-bearing per ROADMAP
         // success criterion #1 ("no silent zero-posts-for-concept failure").
         // Fires only when ALL inputs had malformed URLs (extractDomain returned
         // undefined for every entry). Valid-but-seen results surface via Pass B
         // and do NOT trigger this branch.
         if (ranked.length === 0 && results.length > 0) {
           const fallback = [...results].sort(
             (a, b) =>
               scoreSource(extractDomain(b.url) ?? '') -
               scoreSource(extractDomain(a.url) ?? ''),
           );
           return [fallback[0]];
         }

         return ranked;
       }
       ```

    9. **recordServedDomain + getUsedDomains** (D-13/D-14):
       ```typescript
       /**
        * Record a domain served for an anchor. Idempotent (Set semantics).
        * Note: `domain` here means web hostname like 'nature.com', NOT mindmap cluster.
        */
       export function recordServedDomain(anchorId: string, domain: string): void {
         let set = usedByAnchor.get(anchorId);
         if (!set) {
           set = new Set<string>();
           usedByAnchor.set(anchorId, set);
         }
         set.add(domain);
       }

       /**
        * Get the set of registrable-root domains already served for an anchor.
        * Returns a fresh empty Set for unknown anchorIds (no throw).
        * Phase 41 will pass `[...result]` into Tavily's exclude_domains field.
        */
       export function getUsedDomains(anchorId: string): Set<string> {
         return usedByAnchor.get(anchorId) ?? new Set<string>();
       }
       ```

    10. **scoreSource implementation** (D-04 + RESEARCH § 6):
        ```typescript
        /**
         * Returns a quality score in [0, 1] for the given registrable-root domain.
         * Unknown domains return UNKNOWN_DOMAIN_SCORE (0.5) — neutral mid-score.
         * O(1) lookup via module-level Map.
         */
        export function scoreSource(domain: string): number {
          return _tierMap.get(domain) ?? UNKNOWN_DOMAIN_SCORE;
        }
        ```

    11. **reset implementation** (D-14 — wholesale wipe, NO event emission per CLAUDE.md "one signal per semantic event"):
        ```typescript
        /**
         * Clear the entire session Map. Called by Phase 41's loadCache() on
         * date-mismatch detection. Emits NOTHING (D-08 — wholesale wipe is not
         * a per-id change; UI consumers re-read on day boundary).
         */
        export function reset(): void {
          usedByAnchor.clear();
        }
        ```

    12. **Singleton export** (D-13):
        ```typescript
        /**
         * Source diversity leaf service — Phase 40 (D-12/D-13/D-14).
         * Pure-logic singleton; no I/O; no events; session-scoped state.
         */
        export const sourceDiversityService = {
          filterForDiversity,
          recordServedDomain,
          getUsedDomains,
          scoreSource,
          reset,
        };
        ```

    13. **DOMAIN_TIERS const** (D-04 + RESEARCH § 1 — author the full ~180-200 entry table inline at the BOTTOM of the file). Distribution per RESEARCH § 1:
        - **Top tier 0.90-0.97 (~30 entries):** scientific publishers (nature.com 0.95, science.org 0.95, cell.com 0.95, nejm.org 0.95, thelancet.com 0.95, pnas.org 0.95, bmj.com 0.95, jamanetwork.com 0.95, annals.org 0.93, asm.org 0.93, royalsocietypublishing.org 0.93), engineering/CS (ieee.org 0.93, acm.org 0.93, arxiv.org 0.88 — preprint distinction noted in inline comment per RESEARCH § 11 Risk 3), gov primary (nih.gov 0.92, cdc.gov 0.92, nasa.gov 0.92, noaa.gov 0.92, nist.gov 0.92, who.int 0.92, fda.gov 0.92, epa.gov 0.92, census.gov 0.92), academic (mit.edu 0.90, stanford.edu 0.90, harvard.edu 0.90, caltech.edu 0.90, ox.ac.uk 0.90, cam.ac.uk 0.90, ucl.ac.uk 0.90, ethz.ch 0.90).
        - **Upper-mid tier 0.80-0.88 (~40 entries):** wire/intl broadcast (reuters.com 0.88, apnews.com 0.88, bbc.com 0.88, bbc.co.uk 0.88 — RESEARCH § 11 Risk 2 dual-entry), major newspapers (nytimes.com 0.85, washingtonpost.com 0.85, wsj.com 0.85, theguardian.com 0.85, economist.com 0.85, ft.com 0.85, latimes.com 0.85, chicagotribune.com 0.85, bostonglobe.com 0.85, theatlantic.com 0.85, newyorker.com 0.85, foreignpolicy.com 0.85, foreignaffairs.com 0.85), intl news (spiegel.de 0.85, lemonde.fr 0.85, elpais.com 0.85, asahi.com 0.85, scmp.com 0.85, aljazeera.com 0.85, dw.com 0.85, france24.com 0.85), science/tech journalism (scientificamerican.com 0.83, newscientist.com 0.83, technologyreview.com 0.83, wired.com 0.83, arstechnica.com 0.83, theconversation.com 0.83), gov policy/stats (bls.gov 0.82, federalreserve.gov 0.82, worldbank.org 0.82, imf.org 0.82, oecd.org 0.82, un.org 0.82, europa.eu 0.82).
        - **Mid tier 0.60-0.78 (~50 entries):** encyclopedic (wikipedia.org 0.72, britannica.com 0.75), science comm (phys.org 0.70, sciencedaily.com 0.70, eurekalert.org 0.70, popsci.com 0.70, discovermagazine.com 0.70, quantamagazine.org 0.78, nautil.us 0.70, mayoclinic.org 0.78), tech/business (hbr.org 0.68, techcrunch.com 0.68, theverge.com 0.68, engadget.com 0.68, zdnet.com 0.68, cnet.com 0.68, venturebeat.com 0.68, bloomberg.com 0.68, businessinsider.com 0.68, forbes.com 0.68, inc.com 0.68, fastcompany.com 0.68), well-known aggregators (time.com 0.65, newsweek.com 0.65, thehill.com 0.65, politico.com 0.65, axios.com 0.65, vox.com 0.65, slate.com 0.65, salon.com 0.65), niche/expert (psychologytoday.com 0.62, livescience.com 0.62, healthline.com 0.62, medicalnewstoday.com 0.62), educational (khanacademy.org 0.60, coursera.org 0.60, edx.org 0.60, ted.com 0.60).
        - **Low tier 0.15-0.38 (~30 entries):** blog platforms (medium.com 0.30, substack.com 0.25, tumblr.com 0.15, blogspot.com 0.15, wordpress.com 0.20), social/UGC (reddit.com 0.20, quora.com 0.20, stackexchange.com 0.35), news aggregators (msn.com 0.35, yahoo.com 0.35, huffpost.com 0.35, dailymail.co.uk 0.35, nypost.com 0.35, foxnews.com 0.35, breitbart.com 0.35, thefederalist.com 0.35, dailywire.com 0.35 — D-03 explicit: no partisan adjustment), link aggregators (digg.com 0.25, flipboard.com 0.25, pocket.co 0.25).
        - **Blocked tier 0.0 (~30 entries):** AI content farms (articleforge.com 0.0, spinrewriter.com 0.0, ilovewiki.com 0.0, thesun.co.uk 0.0), SEO aggregators (ezinearticles.com 0.0, hubpages.com 0.0, infobarrel.com 0.0, squidoo.com 0.0, suite101.com 0.0, helium.com 0.0, associated-content.com 0.0, buzzle.com 0.0, answerbag.com 0.0), doorway/thin (reference.com 0.0, ask.com 0.0, answers.com 0.0, factmonster.com 0.0, funtrivia.com 0.0).

        Authoring style:
        ```typescript
        /**
         * DOMAIN_TIERS — ~180-200 entry hand-curated quality table (D-01 through D-04).
         *
         * Tier ranges (D-03):
         *   0.90-0.97  Top: peer-reviewed academic, .gov primary, named-author research
         *   0.80-0.88  Upper-mid: established journalism, wire services, intl news
         *   0.60-0.78  Mid: encyclopedic, trade pubs, expert blogs (Wikipedia=0.72)
         *   0.15-0.38  Low: blog platforms, UGC aggregators, niche-quality news
         *   0.0        Blocked: AI content farms, SEO mills, scraper sites
         *
         * Editorial line (D-03): mainstream outlets get the same score regardless
         * of partisan lean. Quality is judged by editorial process, fact-check
         * standards, and reputation — not viewpoint. arxiv.org is 0.88 (preprint —
         * extremely valuable but NOT peer-reviewed; sits between peer-reviewed
         * and journalism per RESEARCH § 11 Risk 3).
         *
         * Both bbc.com (0.88) and bbc.co.uk (0.88) are listed because Tavily
         * returns both depending on query (RESEARCH § 11 Risk 2).
         *
         * Operator can override any entry in PR review. Future tuning is a
         * single-file edit.
         */
        export const DOMAIN_TIERS: Readonly<Record<string, number>> = {
          // Top tier — peer-reviewed academic publishers (0.95)
          'nature.com': 0.95,
          'science.org': 0.95,
          // ... (continue with full ~180-200 entries, grouped by tier with
          // comment dividers; aim for ~180 minimum, ~200 ideal)
          // Blocked tier — content farms / SEO mills (0.0)
          'ezinearticles.com': 0.0,
          // ...
        } as const;

        // Module-level Map initialized once at import time (RESEARCH § 8 Pitfall 5
        // — do NOT lazy-init inside scoreSource; one-time module load is < 1ms).
        const _tierMap = new Map<string, number>(Object.entries(DOMAIN_TIERS));
        ```

        Order matters for readability: place the helper consts (MULTI_SEGMENT_TLDS, UNKNOWN_DOMAIN_SCORE) and helpers (normalizeHost, extractDomain) near the TOP; place DOMAIN_TIERS + _tierMap near the BOTTOM (it's the largest block; reading the API surface first is more useful). The functions `scoreSource`, `filterForDiversity`, etc. need DOMAIN_TIERS lexically available via `_tierMap` — TypeScript hoists `const` declarations during type-checking but NOT at runtime. **Therefore: declare DOMAIN_TIERS + _tierMap BEFORE any function that calls `_tierMap.get` is INVOKED, but they may be DEFINED later in the file as long as they're defined before module-level execution finishes.** In practice: place DOMAIN_TIERS at the bottom; the module loads top-to-bottom; `scoreSource` is only INVOKED after import completes (from external callers + tests). This works. If you prefer maximum safety, place DOMAIN_TIERS + _tierMap immediately before the function declarations that use them. Either ordering is acceptable; document the choice in a brief inline comment.

    14. **DO NOT** add any of:
        - `localStorage` reads or writes
        - `eventBus.emit` or `eventBus.subscribe`
        - `import` from any other service file
        - `import` from `lib/date.ts`
        - `import` from `'../locales'` or `'../locales/index.ts'`
        - JSON imports (`with { type: 'json' }` or otherwise)
        - `async` keyword anywhere (function declarations, arrow functions, methods)
        - `await` keyword anywhere
        - `fetch(` calls
        - `chatStream(` or `chatCompletion(` calls
        - `today()` helper or any date-keyed reset
        - Any cross-service back-edge (Phase 40 imports nothing from engagement, post-history, or anything else)

    15. **Naming convention enforcement** (CONTEXT.md "Specific Ideas"): every variable named `domain` in this file MUST mean web hostname (e.g., 'nature.com'), NEVER concept/cluster/mindmap. Add a one-line comment near `recordServedDomain`'s JSDoc reaffirming this: `// Note: 'domain' here means web hostname like 'nature.com', NOT mindmap cluster.`

    Reference Plan 39-01 Task 2 for shape parity (the engagement service is the canonical Phase 39 peer template per CONTEXT.md "Phase 39 SUMMARY" reference).
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `app/src/services/source-diversity.service.ts`
    - `grep -c "export const sourceDiversityService = {" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export function filterForDiversity" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export function recordServedDomain" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export function getUsedDomains" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export function scoreSource" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export function reset" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export function extractDomain" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export function normalizeHost" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export const MULTI_SEGMENT_TLDS" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export const UNKNOWN_DOMAIN_SCORE" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "export const DOMAIN_TIERS" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "import type { WebSearchResult } from '../types/index.ts'" app/src/services/source-diversity.service.ts` returns 1
    - `grep -E "^import\s" app/src/services/source-diversity.service.ts | wc -l` returns 1 (the type import is the ONLY import line)
    - `grep -c "'gob.mx'" app/src/services/source-diversity.service.ts` returns 1 (RESEARCH § 2 addition)
    - `grep -c "'ac.nz'" app/src/services/source-diversity.service.ts` returns 1 (RESEARCH § 2 addition)
    - `grep -c "UNKNOWN_DOMAIN_SCORE = 0.5" app/src/services/source-diversity.service.ts` returns 1
    - `grep -c "Phase 40 D-06" app/src/services/source-diversity.service.ts` returns ≥1 (load-bearing fallback comment)
    - `grep -c "ROADMAP success criterion #1" app/src/services/source-diversity.service.ts` returns ≥1 (D-06 references it explicitly)
    - `grep -c "'nature.com': 0.95" app/src/services/source-diversity.service.ts` returns 1 (top-tier sentinel)
    - `grep -c "'wikipedia.org': 0.72" app/src/services/source-diversity.service.ts` returns 1 (mid-tier sentinel)
    - `grep -c "'ezinearticles.com': 0.0" app/src/services/source-diversity.service.ts` returns 1 (blocked-tier sentinel)
    - `grep -c "'bbc.com': 0.88" app/src/services/source-diversity.service.ts` returns 1 (RESEARCH § 11 Risk 2 — both bbc entries)
    - `grep -c "'bbc.co.uk': 0.88" app/src/services/source-diversity.service.ts` returns 1
    - DOMAIN_TIERS entry count: `grep -c "': [0-9]" app/src/services/source-diversity.service.ts` returns ≥175 (allow some headroom; aim for 180+)
    - `! grep -q "\\basync\\b" app/src/services/source-diversity.service.ts` (no async keyword anywhere — sync-only invariant)
    - `! grep -q "\\bawait\\b" app/src/services/source-diversity.service.ts` (no await keyword anywhere)
    - `! grep -q "fetch(" app/src/services/source-diversity.service.ts` (no fetch calls)
    - `! grep -q "chatStream\\|chatCompletion" app/src/services/source-diversity.service.ts` (no LLM calls)
    - `! grep -q "localStorage" app/src/services/source-diversity.service.ts` (no localStorage)
    - `! grep -q "eventBus" app/src/services/source-diversity.service.ts` (no event emission)
    - `! grep -q "from '../locales\\|from '../lib/date" app/src/services/source-diversity.service.ts` (leaf-module discipline)
    - `cd app && tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>source-diversity.service.ts exports the full 5-function singleton + 2 helpers + 3 consts; DOMAIN_TIERS contains ~180+ entries spanning all 5 tiers; sync-only invariant holds; no JSON/locales/date imports; project type-checks clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Behavioral test suite for source-diversity.service.ts (15 cases — covers SC-1, SC-2, SC-3)</name>
  <files>app/tests/services/source-diversity.service.test.mjs</files>
  <read_first>
    - app/tests/services/engagement.service.test.mjs (full file — Phase 39 peer template; mirror describe/it/beforeEach + dynamic-import shape; differ on: NO localStorage shim needed since source-diversity uses pure Map)
    - app/tests/services/daily-read.service.test.mjs (secondary reference — minimal leaf-service test shape)
    - app/src/services/source-diversity.service.ts (after Task 1 — the API under test, full surface)
    - .planning/phases/40-source-diversity-leaf-module/40-RESEARCH.md § 9 (validation architecture — explicit list of 15 behavioral cases)
    - .planning/phases/40-source-diversity-leaf-module/40-VALIDATION.md (Wave 0 requirements: 15 cases)
    - .planning/phases/40-source-diversity-leaf-module/40-CONTEXT.md (D-05 strict bucket split, D-06 best-of-bad fallback semantics, D-07 stable sort, D-09 subdomain collapse, D-10 malformed exclusion, D-11 PSL slice)
  </read_first>
  <action>
    Create `app/tests/services/source-diversity.service.test.mjs` mirroring the shape of `engagement.service.test.mjs` MINUS the localStorage polyfill (Phase 40 leaf has no localStorage). Use `node:test` describe/it/beforeEach and `node:assert/strict`.

    Setup pattern (top of file):

    ```javascript
    // Phase 40 — source-diversity.service.ts behavioral test suite.
    // Mirrors engagement.service.test.mjs shape MINUS the localStorage shim
    // (this leaf uses a pure in-memory Map). Covers CONTENT-02 SC-1, SC-2, SC-3.

    import assert from 'node:assert/strict';
    import { describe, it, beforeEach } from 'node:test';

    const {
      sourceDiversityService,
      filterForDiversity,
      recordServedDomain,
      getUsedDomains,
      scoreSource,
      reset,
      extractDomain,
      normalizeHost,
      MULTI_SEGMENT_TLDS,
      DOMAIN_TIERS,
      UNKNOWN_DOMAIN_SCORE,
    } = await import('../../src/services/source-diversity.service.ts');

    // Helper to construct a WebSearchResult fixture (matches src/types/index.ts shape)
    function mkResult(url, score = 0.5, title = 'T', content = 'C') {
      return { title, url, content, score };
    }
    ```

    `beforeEach` calls `reset()` to clear the session Map between tests.

    REQUIRED test cases (one `it(...)` block each — name them clearly):

    1. **`filterForDiversity — unseen domain beats seen domain regardless of score order`** (D-05)
       - Build `results = [ mkResult('https://low.example.com/a'), mkResult('https://nature.com/b') ]`.
       - Call `filterForDiversity(results, new Set(['nature.com']))`.
       - Assert returned length === 2.
       - Assert returned[0].url === 'https://low.example.com/a' (unseen low-quality wins position 0 over seen top-quality).
       - Assert returned[1].url === 'https://nature.com/b'.

    2. **`filterForDiversity — within unseen tier, higher score wins`** (D-05)
       - Build `results = [ mkResult('https://medium.com/x'), mkResult('https://nature.com/y') ]`.
       - Call `filterForDiversity(results, new Set())`.
       - Assert returned[0].url === 'https://nature.com/y' (score 0.95 > 0.30).
       - Assert returned[1].url === 'https://medium.com/x'.

    3. **`filterForDiversity — stable sort preserves Tavily order for ties`** (D-07)
       - Build two results with domains that score the same (e.g., both unknown so both score UNKNOWN_DOMAIN_SCORE=0.5):
         `results = [ mkResult('https://unknown-a.com/1'), mkResult('https://unknown-b.com/2') ]`.
       - Call `filterForDiversity(results, new Set())`.
       - Assert returned[0].url === 'https://unknown-a.com/1' (Tavily-original position 0 preserved).
       - Assert returned[1].url === 'https://unknown-b.com/2'.

    4. **`filterForDiversity — D-06 best-of-bad fallback fires when ALL inputs are malformed URLs`**
       - Build `results = [ mkResult('not-a-url-1'), mkResult('not-a-url-2') ]`.
       - Call `filterForDiversity(results, new Set())`.
       - Assert returned.length === 1 (single-element fallback).
       - Assert returned[0] is one of the input results (the highest-scored — both score UNKNOWN_DOMAIN_SCORE for malformed via `extractDomain(url) ?? ''` returning '', so the first one wins via stable sort).

    5. **`filterForDiversity — D-10 malformed URL is silently excluded when valid results exist (D-06 NOT triggered)`**
       - Build `results = [ mkResult('https://nature.com/a'), mkResult('not-a-url') ]`.
       - Call `filterForDiversity(results, new Set())`.
       - Assert returned.length === 1.
       - Assert returned[0].url === 'https://nature.com/a' (valid result surfaces; malformed dropped).

    6. **`filterForDiversity — empty input returns empty array (D-06 NOT triggered)`**
       - Call `filterForDiversity([], new Set())`.
       - Assert deepEqual returned === [].

    7. **`filterForDiversity — all-seen results still surface via Pass B (D-06 NOT triggered when valid-but-seen)`** (load-bearing UX semantics per CONTEXT.md "Specific Ideas")
       - Build `results = [ mkResult('https://nature.com/a'), mkResult('https://bbc.com/b') ]`.
       - Call `filterForDiversity(results, new Set(['nature.com', 'bbc.com']))`.
       - Assert returned.length === 2 (both surface via Pass B).
       - Assert returned[0].url === 'https://nature.com/a' (higher score 0.95 > 0.88 wins within Pass B).

    8. **`scoreSource — known top-tier domain returns expected score`**
       - Assert `scoreSource('nature.com') === 0.95`.
       - Assert `scoreSource('reuters.com') === 0.88`.

    9. **`scoreSource — unknown domain returns UNKNOWN_DOMAIN_SCORE (0.5)`**
       - Assert `scoreSource('unknown-niche-site-xyz-12345.com') === 0.5`.
       - Assert `scoreSource('unknown-niche-site-xyz-12345.com') === UNKNOWN_DOMAIN_SCORE` (proves the const is exported and equal).

    10. **`scoreSource — blocked domain returns 0.0`**
        - Assert `scoreSource('ezinearticles.com') === 0.0`.
        - Assert `scoreSource('articleforge.com') === 0.0`.

    11. **`extractDomain — collapses subdomain to registrable root`** (D-09)
        - Assert `extractDomain('https://science.nature.com/article/abc') === 'nature.com'`.
        - Assert `extractDomain('https://www.bbc.com/news') === 'bbc.com'`.
        - Assert `extractDomain('https://m.wikipedia.org/wiki/x') === 'wikipedia.org'`.

    12. **`extractDomain — handles multi-segment TLDs via PSL slice`** (D-11)
        - Assert `extractDomain('https://www.bbc.co.uk/news/x') === 'bbc.co.uk'`.
        - Assert `extractDomain('https://news.ox.ac.uk/research') === 'ox.ac.uk'`.
        - Assert `extractDomain('https://gobierno.gob.mx/page') === 'gobierno.gob.mx'` (RESEARCH § 2 addition — gob.mx).

    13. **`extractDomain — malformed URL returns undefined`** (D-10)
        - Assert `extractDomain('not-a-url') === undefined`.
        - Assert `extractDomain('') === undefined`.
        - Assert `extractDomain('://broken') === undefined`.

    14. **`recordServedDomain + getUsedDomains round-trip; reset() clears all`** (D-13/D-14)
        - Call `recordServedDomain('anchor-1', 'nature.com')`.
        - Call `recordServedDomain('anchor-1', 'bbc.com')`.
        - Call `recordServedDomain('anchor-2', 'wikipedia.org')`.
        - Assert `getUsedDomains('anchor-1')` is a Set containing 'nature.com' AND 'bbc.com' (size 2).
        - Assert `getUsedDomains('anchor-2')` is a Set containing 'wikipedia.org' (size 1).
        - Assert `getUsedDomains('unknown-anchor')` is an empty Set (size 0, no throw).
        - Call `reset()`.
        - Assert `getUsedDomains('anchor-1').size === 0` AND `getUsedDomains('anchor-2').size === 0` (both cleared).

    15. **`recordServedDomain is idempotent — duplicate (anchor, domain) is a Set no-op`**
        - Call `recordServedDomain('anchor-1', 'nature.com')` twice.
        - Assert `getUsedDomains('anchor-1').size === 1`.
        - Assert `getUsedDomains('anchor-1').has('nature.com') === true`.

    Use the same describe/it pattern as engagement.service.test.mjs. Each test independently calls `reset()` via the `beforeEach` to ensure session-Map isolation between tests.

    NOTE on Map reference equality: `getUsedDomains` returns either the underlying Set (from `usedByAnchor.get`) or a fresh empty Set (when the anchor is unknown). Tests should NOT assume the returned Set is or isn't a copy. Asserting `.has(x)` and `.size` is safe; asserting `=== someSet` is not.

    NOTE on the singleton vs named exports: assertions can use EITHER `sourceDiversityService.scoreSource('nature.com')` OR the destructured named export `scoreSource('nature.com')`. Prefer the named exports for tests (they're explicitly exported per D-15 for this purpose). The singleton is what Phase 41 will consume.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/source-diversity.service.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `app/tests/services/source-diversity.service.test.mjs`
    - `grep -cE "^\\s*it\\(" app/tests/services/source-diversity.service.test.mjs` returns ≥15 (15 cases minimum)
    - `grep -c "filterForDiversity" app/tests/services/source-diversity.service.test.mjs` returns ≥7 (cases 1-7)
    - `grep -c "scoreSource" app/tests/services/source-diversity.service.test.mjs` returns ≥3 (cases 8-10 + UNKNOWN_DOMAIN_SCORE assertion)
    - `grep -c "extractDomain" app/tests/services/source-diversity.service.test.mjs` returns ≥3 (cases 11-13)
    - `grep -c "recordServedDomain" app/tests/services/source-diversity.service.test.mjs` returns ≥2 (cases 14, 15)
    - `grep -c "getUsedDomains" app/tests/services/source-diversity.service.test.mjs` returns ≥3
    - `grep -c "reset()" app/tests/services/source-diversity.service.test.mjs` returns ≥2 (case 14 + beforeEach)
    - `grep -c "UNKNOWN_DOMAIN_SCORE" app/tests/services/source-diversity.service.test.mjs` returns ≥1 (case 9 — proves const is exported and equal)
    - `grep -c "MULTI_SEGMENT_TLDS\\|gob.mx\\|ac.nz" app/tests/services/source-diversity.service.test.mjs` returns ≥1 (case 12 covers PSL slice including the RESEARCH § 2 additions)
    - `grep -c "await import('../../src/services/source-diversity.service.ts')" app/tests/services/source-diversity.service.test.mjs` returns 1 (.ts extension per Phase 37 + Plan 37-02 close decision)
    - `! grep -q "globalThis.localStorage" app/tests/services/source-diversity.service.test.mjs` (NO localStorage shim — Phase 40 leaf has no localStorage; engagement.service.test.mjs has it but Phase 40 doesn't need it)
    - `cd app && node --test tests/services/source-diversity.service.test.mjs` exits 0 with all tests passing
  </acceptance_criteria>
  <done>All 15 behavioral test cases pass; SC-1 (filterForDiversity bucket split + D-06 fallback) + SC-2 (recordServedDomain/reset round-trip) + SC-3 (scoreSource O(1) lookup with [0,1] range) all locked in; D-09/D-10/D-11 covered via extractDomain cases.</done>
</task>

<task type="auto">
  <name>Task 3: Source-reading anti-wire invariant test for source-diversity.service.ts (covers SC-4)</name>
  <files>app/tests/services/source-diversity-anti-wire.test.mjs</files>
  <read_first>
    - app/tests/services/engagement-anti-wire.test.mjs (full file — Phase 39 source-reading invariant precedent; differ on: Phase 40 is SINGLE-FILE scan, not multi-file walk)
    - app/tests/state/useQuestions-system-prompt-stability.test.mjs (Phase 35 single-file source-reader pattern — closer template than engagement-anti-wire)
    - app/tests/services/leaf-imports.test.mjs (Phase 37 — source-reading invariant for forbidden imports; counterweight assertion pattern)
    - app/src/services/source-diversity.service.ts (after Task 1 — target file; should pass this test by construction)
    - .planning/phases/40-source-diversity-leaf-module/40-RESEARCH.md § 8 Pitfall 4 (preferred approach: assert no `async ` keyword, NOT `await ` substring scan — `await ` appears in JSDoc comments and would false-positive)
    - .planning/phases/40-source-diversity-leaf-module/40-RESEARCH.md § 9 (validation architecture — 4 source-reading assertions explicitly listed)
    - .planning/phases/40-source-diversity-leaf-module/40-CONTEXT.md (locked decisions: sync-only invariant from "Carried-Forward Decisions"; CLAUDE.md Phase 32.1 lessons referenced)
    - .planning/phases/39-engagement-service-walker-extension/39-01-engagement-service-SUMMARY.md (window-fragility lesson: image-gen-key-gate.test.mjs's 6000-char window required source-code trimming. Phase 40 anti-wire deliberately uses NO character window — single-file scan checks entire file; window-fragility-free by design.)
  </read_first>
  <action>
    Create `app/tests/services/source-diversity-anti-wire.test.mjs` — a SINGLE-FILE source-reading invariant test that reads `app/src/services/source-diversity.service.ts` and asserts the sync-only contract.

    This is structurally simpler than `engagement-anti-wire.test.mjs` (which walks all `.ts/.tsx` files). Phase 40's invariant is "no async / fetch / LLM calls in THE LEAF FILE" — single-file scan. Pattern follows `useQuestions-system-prompt-stability.test.mjs` more closely.

    Required structure:

    ```javascript
    // Phase 40 — source-diversity.service.ts source-reading invariant test (SC-4).
    //
    // Single-file scan that asserts the sync-only contract:
    //   - No `async ` keyword anywhere in the leaf (proves no `await` can exist —
    //     all async calls require an `async` function wrapper). RESEARCH § 8
    //     Pitfall 4 explicitly recommends this over `await ` substring scanning,
    //     which false-positives on JSDoc comments mentioning the word.
    //   - No `fetch(` (would bypass sync contract via direct network call).
    //   - No `chatStream(` and no `chatCompletion(` (would bypass sync contract
    //     via LLM round-trip).
    //
    // Counterweight assertion: confirms the scan reaches the live file by asserting
    // `filterForDiversity` IS present in the source. Without this, a future
    // refactor that renames or deletes the leaf would leave the test silently
    // passing on an empty/non-existent source.
    //
    // No character-window proximity scanning — window-fragility-free by design
    // (RESEARCH § 11 Risk 1 lesson from image-gen-key-gate.test.mjs).

    import assert from 'node:assert/strict';
    import test from 'node:test';
    import { readFileSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    import { dirname, resolve } from 'node:path';

    const here = dirname(fileURLToPath(import.meta.url));
    const SOURCE_PATH = resolve(here, '../../src/services/source-diversity.service.ts');
    const source = readFileSync(SOURCE_PATH, 'utf8');
    ```

    Required test cases (each as a `test(...)` block):

    1. **`source-diversity.service.ts contains filterForDiversity (counterweight — proves the scan reaches the target file)`**
       - `assert.ok(source.includes('filterForDiversity'), 'source-diversity.service.ts must export filterForDiversity — without this counterweight, a future delete/rename would silently pass the anti-wire test on an empty file');`

    2. **`source-diversity.service.ts must have no async functions (proves no await can exist — sync-only invariant)`**
       - Use the regex `/\basync\s/` (matches `async function`, `async (`, `async method` patterns).
       - `assert.ok(!/\basync\s/.test(source), 'source-diversity.service.ts must have no async functions — Phase 40 sync-only invariant. RESEARCH § 8 Pitfall 4: scanning for the async keyword is preferred over scanning for await (which false-positives on JSDoc comments).');`

    3. **`source-diversity.service.ts must not call fetch() (sync-only invariant)`**
       - `assert.ok(!source.includes('fetch('), 'source-diversity.service.ts must not call fetch() — Phase 40 leaf is pure-logic, no I/O. Phase 41 owns the Tavily call site (concept-feed.service.ts), not this leaf.');`

    4. **`source-diversity.service.ts must not call chatStream() or chatCompletion() (sync-only invariant)`**
       - `assert.ok(!source.includes('chatStream('), 'source-diversity.service.ts must not call chatStream() — leaf is pure-logic, no LLM calls.');`
       - `assert.ok(!source.includes('chatCompletion('), 'source-diversity.service.ts must not call chatCompletion() — leaf is pure-logic, no LLM calls.');`

    All four assertions can live in 4 separate `test(...)` blocks (one per assertion) OR you can collapse the two LLM-call assertions into one block. RESEARCH § 9 specifies "4 source-reading assertions" — count by assertion, not by test block. A 3-test-block file (counterweight + sync-only + no-IO combined) is acceptable as long as all 4 logical assertions appear.

    NOTE on regex flags: `/\basync\s/` (no `g` flag) is sufficient because `.test(source)` only needs to find one match to fail. Adding `g` is not necessary.

    NOTE on test framework: use `test(...)` (the named export from `node:test`) NOT `it(...)`. This matches `engagement-anti-wire.test.mjs`'s pattern; `it(...)` requires being inside a `describe(...)` block, but for a 3-4-test file the top-level `test(...)` form is cleaner.

    NOTE on the import order: read the source file ONCE at module top via `readFileSync`. All test blocks share the `source` constant. This is what `useQuestions-system-prompt-stability.test.mjs` does.

    DO NOT add a multi-file walk like engagement-anti-wire's `walk(SRC)` function. The Phase 40 invariant is single-file; multi-file walk is an over-approximation that adds noise without value here.

    DO NOT scan for `await ` substring — RESEARCH § 8 Pitfall 4 explicitly warns this false-positives on JSDoc/comments. The `async` absence assertion is the canonical approach.

    Manual sanity-check during execution (NOT a permanent test): temporarily inject `async function probe() { await Promise.resolve(); }` into source-diversity.service.ts, re-run this test, confirm it fails. Revert immediately. Document in Task summary if performed.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/source-diversity-anti-wire.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `app/tests/services/source-diversity-anti-wire.test.mjs`
    - `grep -c "filterForDiversity" app/tests/services/source-diversity-anti-wire.test.mjs` returns ≥1 (counterweight assertion)
    - `grep -c "async" app/tests/services/source-diversity-anti-wire.test.mjs` returns ≥1 (the regex assertion)
    - `grep -c "fetch(" app/tests/services/source-diversity-anti-wire.test.mjs` returns ≥1 (the assertion checks for fetch call)
    - `grep -c "chatStream\\|chatCompletion" app/tests/services/source-diversity-anti-wire.test.mjs` returns ≥2 (one per assertion)
    - `grep -c "readFileSync" app/tests/services/source-diversity-anti-wire.test.mjs` returns ≥1 (proves it reads the file)
    - `grep -c "source-diversity.service.ts" app/tests/services/source-diversity-anti-wire.test.mjs` returns ≥1 (target file path)
    - `! grep -q "walk\\|readdirSync" app/tests/services/source-diversity-anti-wire.test.mjs` (NO multi-file walk — Phase 40 anti-wire is single-file by design, differs from engagement-anti-wire pattern)
    - `cd app && node --test tests/services/source-diversity-anti-wire.test.mjs` exits 0 with all tests passing
  </acceptance_criteria>
  <done>Source-reading static invariant locks SC-4 (sync-only contract); counterweight prevents accidental scan-scope drift; single-file scan deliberately avoids window-fragility (lesson from Phase 39 SUMMARY); test passes against the source-diversity.service.ts shipped in Task 1.</done>
</task>

<task type="auto">
  <name>Task 4: Full-suite green check + close-out test baselines</name>
  <files>(no edits — verification-only task; SUMMARY.md will be written by close-out step downstream)</files>
  <read_first>
    - .planning/STATE.md (test baselines from Plan 39-01 close: test:main 583/2 (583 passing + 2 pre-existing carry-over failures); test:actions 16/16/0; tsc exits 0)
    - app/package.json (test scripts available — `test:main`, `test:actions`)
    - .planning/phases/39-engagement-service-walker-extension/39-01-engagement-service-SUMMARY.md (Task 8 self-check pattern + the two pre-existing carry-over failures: concept-feed.test.mjs ERR_MODULE_NOT_FOUND on extensionless youtube.service import + tests/services/trellis-layout.test.mjs:64 getVineColor date-dependent assertion)
  </read_first>
  <action>
    Run the full project test suite + tsc to confirm Phase 40 introduces zero regressions.

    Steps:

    1. `cd app && tsc -b --noEmit` → must exit 0.

    2. `cd app && npm run test:main` → capture pass/fail counts. Acceptable: equal-or-better than the post-Plan-39-01 baseline of 583 passing + 2 failing. New tests added in Tasks 2 + 3 should ADD to the pass count:
       - source-diversity.service.test.mjs: 15 cases
       - source-diversity-anti-wire.test.mjs: 4 cases (or 3 test blocks containing 4 logical assertions)
       - Expected lower bound: 583 + 15 + 3 = **601 passing minimum** (allow margin for test-block collapsing in anti-wire).

    3. `cd app && npm run test:actions` → must remain at `16/16/0` (Phase 40 doesn't touch actions).

    4. Spot-check the two pre-existing `test:main` failures from Plan 39-01 close (concept-feed.test.mjs ERR_MODULE_NOT_FOUND on extensionless youtube.service import + tests/services/trellis-layout.test.mjs:64 getVineColor date-dependent assertion) — confirm both are STILL the only failures (no new failure introduced).

    5. **Auto-fix scope rule (per Plan 39-01 close decision "walkDerivedList signature change broke refill-queue-integration.test.mjs"):** if a NEW failure appears that is DIRECTLY caused by Phase 40's edits (e.g., a type import in `types/index.ts` triggers a tsc breakage somewhere), fix the root cause before commit. If a new failure is UNRELATED to Phase 40's three files (e.g., flaky timer test in PostDetailScreen), STOP and report — don't auto-fix.

       Phase 40 edits ONLY three files (source-diversity.service.ts + two test files). It introduces NO new types, NO union changes, NO walker-signature changes, NO cross-service imports. The blast radius for breakage is essentially zero. If a new failure appears outside `tests/services/source-diversity*`, it almost certainly was NOT introduced by Phase 40 — investigate before assuming ownership.

    6. Record actual pass/fail numbers in the SUMMARY.md drafted at plan close (not in this PLAN file).
  </action>
  <verify>
    <automated>cd app && tsc -b --noEmit && npm run test:main && npm run test:actions</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && tsc -b --noEmit` exits 0
    - `cd app && npm run test:main` pass count ≥ 601 (post-Plan-39-01 baseline 583 + 15 source-diversity.service cases + 3 anti-wire test blocks; allow ±2 margin for test-block collapsing)
    - `cd app && npm run test:main` fail count ≤ 2 (matches the two pre-existing pre-Phase-40 failures; no new failures)
    - `cd app && npm run test:actions` exits 0 with 16/16/0
    - The two pre-existing failure messages (concept-feed ERR_MODULE_NOT_FOUND + trellis-layout getVineColor date assertion) are the only failures — verifiable by `cd app && npm run test:main 2>&1 | grep -E "fail|FAIL" | head -10`
    - Both new test files appear in the test runner output:
      - `cd app && npm run test:main 2>&1 | grep -c "source-diversity.service.test.mjs"` returns ≥1
      - `cd app && npm run test:main 2>&1 | grep -c "source-diversity-anti-wire.test.mjs"` returns ≥1
  </acceptance_criteria>
  <done>Full suite green minus the two pre-existing carry-over failures; Phase 40 introduces zero regressions; ready for close-out commit + SUMMARY.md.</done>
</task>

</tasks>

<verification>
Run from `app/` directory:

1. `tsc -b --noEmit` — exits 0
2. `node --test tests/services/source-diversity.service.test.mjs` — all 15 cases pass
3. `node --test tests/services/source-diversity-anti-wire.test.mjs` — 4 source-reading assertions pass (3 or 4 test blocks)
4. `npm run test:main` — pass count ≥ 601 (Plan 39-01 baseline 583 + Phase 40 additions); fail count ≤ 2 (pre-existing only)
5. `npm run test:actions` — 16/16/0 (unchanged)

Manual greps that lock the contract surface:

6. `grep -c "export const sourceDiversityService = {" app/src/services/source-diversity.service.ts` returns 1
7. `grep -c "export function filterForDiversity" app/src/services/source-diversity.service.ts` returns 1
8. `grep -c "export function recordServedDomain" app/src/services/source-diversity.service.ts` returns 1
9. `grep -c "export function getUsedDomains" app/src/services/source-diversity.service.ts` returns 1
10. `grep -c "export function scoreSource" app/src/services/source-diversity.service.ts` returns 1
11. `grep -c "export function reset" app/src/services/source-diversity.service.ts` returns 1
12. `grep -c "export function extractDomain" app/src/services/source-diversity.service.ts` returns 1
13. `grep -c "export const DOMAIN_TIERS" app/src/services/source-diversity.service.ts` returns 1
14. `grep -c "export const MULTI_SEGMENT_TLDS" app/src/services/source-diversity.service.ts` returns 1
15. `grep -c "UNKNOWN_DOMAIN_SCORE = 0.5" app/src/services/source-diversity.service.ts` returns 1
16. `! grep -q "\\basync\\b\\|\\bawait\\b\\|fetch(\\|chatStream(\\|chatCompletion(" app/src/services/source-diversity.service.ts` (sync-only invariant)
17. `! grep -q "localStorage\\|eventBus" app/src/services/source-diversity.service.ts` (no persistence, no events)
18. `! grep -q "from '../locales\\|from '../lib/date" app/src/services/source-diversity.service.ts` (leaf-module discipline)
19. `grep -c "'gob.mx'" app/src/services/source-diversity.service.ts` returns 1 (RESEARCH § 2 PSL slice addition)
20. `grep -c "'ac.nz'" app/src/services/source-diversity.service.ts` returns 1 (RESEARCH § 2 PSL slice addition)
</verification>

<success_criteria>
Phase 40 is complete when ALL of the following are true (mirrors ROADMAP success criteria 1-4 verbatim):

1. **Two-pass re-rank with best-of-bad fallback (success criterion #1):**
   - `filterForDiversity(results, usedDomains)` returns a re-ranked list that prefers unseen domains (Pass A) over seen domains (Pass B) (Task 2 case 1)
   - Within each pass, sort by `scoreSource(domain)` desc (Task 2 case 2)
   - Stable sort preserves Tavily's original order for ties (Task 2 case 3)
   - Best-of-bad fallback fires only when all inputs had malformed URLs (Task 2 case 4)
   - Valid-but-seen results surface via Pass B; fallback NOT triggered (Task 2 case 7)
   - Malformed URLs silently dropped when valid results exist (Task 2 case 5)
   - No silent zero-posts-for-concept failure (D-06 + ROADMAP success criterion #1 referenced in code comment)

2. **Session Map round-trip + reset (success criterion #2):**
   - `recordServedDomain(anchorId, domain)` updates the session-scoped Map synchronously (Task 2 case 14)
   - `getUsedDomains(anchorId)` returns the Set; returns empty Set for unknown anchors without throw (Task 2 case 14)
   - `reset()` clears the entire Map (Task 2 case 14)
   - Map is in-memory only — no localStorage persistence (verified by absence of `localStorage` in the source per acceptance criterion grep)

3. **Domain quality lookup (success criterion #3):**
   - `scoreSource(domain)` returns a number in `[0, 1]` (Task 2 cases 8, 9, 10)
   - O(1) via module-level `Map<string, number>` initialized at import time (RESEARCH § 8 Pitfall 5 — NOT lazy-init)
   - Bundled ~180-200 entry table covering 5 tiers (top/upper-mid/mid/low/blocked) (Task 1 acceptance criteria — entry-count grep + tier-sentinel greps)
   - Unknown domains return `UNKNOWN_DOMAIN_SCORE = 0.5` (Task 2 case 9)
   - Blocked tier returns `0.0` (Task 2 case 10)

4. **Sync-only invariant (success criterion #4):**
   - No `async` keyword in the leaf (Task 3 case 2 — proves no `await` can exist)
   - No `fetch(` calls (Task 3 case 3)
   - No `chatStream(` or `chatCompletion(` calls (Task 3 case 4)
   - Counterweight: `filterForDiversity` IS present in the source (Task 3 case 1 — proves scan reaches the live file)

5. **Domain normalization (D-09 + D-11):**
   - Subdomains collapse to registrable root (Task 2 case 11)
   - Multi-segment TLDs handled via PSL slice (Task 2 case 12)
   - Malformed URLs return undefined (Task 2 case 13)
   - PSL slice includes RESEARCH § 2 additions (`gob.mx`, `ac.nz`)

6. **Leaf-module discipline (Phase 37 carried-forward):**
   - No JSON imports (no `with { type: 'json' }`)
   - No `react-i18next` import
   - No `lib/date.ts` import
   - No event emission (no `eventBus` import)
   - `.ts` extension on all relative imports
   - No cross-service imports (only `import type { WebSearchResult } from '../types/index.ts'`)

7. **Test baselines preserved:**
   - tsc exits 0
   - test:main pass ≥ 601; fail ≤ 2 (pre-existing carry-overs only)
   - test:actions 16/16/0
</success_criteria>

<output>
After Plan 40-01 execution completes, create `.planning/phases/40-source-diversity-leaf-module/40-01-source-diversity-service-SUMMARY.md` per the standard SUMMARY template. The summary MUST include:

- Atomic-per-file commit log (4 expected commits — one per task, with hashes)
- Pre/post test baselines (test:main pass/fail/skipped + test:actions pass/fail/skipped + tsc exit)
- Confirmation of all 4 ROADMAP success criteria (mirror this plan's `must_haves.truths`)
- DOMAIN_TIERS entry count (actual number authored vs. ~180-200 target)
- Deviations or decisions captured during execution (e.g., if any DOMAIN_TIERS entries were added/removed beyond the RESEARCH § 1 list, if MULTI_SEGMENT_TLDS was extended further, if anti-wire test framework choice differed from the plan)
- Forward-pointers: Phase 41 owns the wiring at `concept-feed.service.ts`'s news pre-fetch loop (~line 1293) + news creation loop (~line 1083) + day-boundary `reset()` call site at `loadCache()`; Phase 41 will also widen `web-search.service.ts:WebSearchOptions` with `excludeDomains?: string[]` (Phase 40 must NOT touch web-search.service.ts).

Mark requirement CONTENT-02 as **partial** in `.planning/REQUIREMENTS.md` (the leaf ships in Phase 40; the `exclude_domains` Tavily wire ships in Phase 41). Note in the requirement entry: "Phase 40 leaf complete; Phase 41 wires into Tavily."
</output>
</content>
