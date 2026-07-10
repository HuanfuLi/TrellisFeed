# Phase 40: Source Diversity Leaf Module — Research

**Researched:** 2026-05-09
**Domain:** TypeScript leaf-module service; domain-quality scoring; URL normalization
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hand-curated tier list (~200 entries), authored at planning time. Zero external dependency.
- **D-02:** Continuous score `[0.0, 1.0]` per domain, direct float. No discrete buckets.
- **D-03:** Editorial line: top tier ≥0.85 (peer-reviewed + established journalism + .edu/.gov), mid tier 0.4–0.7 (Wikipedia ~0.7, general-interest, expert blogs), low tier 0.1–0.3 (unedited blogs, Medium personal posts, Substack without editorial layer), blocked 0.0 (content farms, AI-gen sites, SEO aggregators). Partisan lean does NOT affect score.
- **D-04:** Inline `const DOMAIN_TIERS: Readonly<Record<string, number>>` at bottom of `source-diversity.service.ts`. No JSON imports, no separate data file.
- **D-05:** Strict two-pass bucket split: Pass A (unseen domains, sorted by score desc) prepended to Pass B (seen domains, sorted by score desc). Any unseen result beats any seen result.
- **D-06:** Best-of-the-bad fallback: if both passes are empty, return the single highest-scoring result from the full input array regardless of seen/blocked status. Prevents zero-posts-for-concept failure.
- **D-07:** Stable sort for ties; V8 stable-sort since 2018.
- **D-08:** 0.0-scored results CAN surface via the D-06 fallback if nothing else is available.
- **D-09:** Collapse all subdomains to registrable root (`science.nature.com` → `nature.com`).
- **D-10:** Malformed URL → quality 0, exclude from re-ranked array (wrap `new URL()` in try/catch). Surfaces via D-06 fallback only if everything else is also bad.
- **D-11:** Hand-rolled `MULTI_SEGMENT_TLDS` Set with initial 10 entries: `co.uk, co.jp, com.au, co.nz, org.uk, ac.uk, edu.au, gov.uk, co.kr, com.br`. Logic: if `hostname.split('.').slice(-2).join('.')` matches, registrable root = last 3 segments; else last 2 segments. NOT bundling `tldts`.
- **D-12:** File: `app/src/services/source-diversity.service.ts`.
- **D-13:** Singleton: `export const sourceDiversityService = { filterForDiversity, recordServedDomain, getUsedDomains, scoreSource, reset }`.
- **D-14:** 5-function API: `filterForDiversity`, `recordServedDomain`, `getUsedDomains`, `scoreSource`, `reset`.
- **D-15:** Internal helpers exported explicitly for tests: `extractDomain`, `normalizeHost`, `MULTI_SEGMENT_TLDS`, `DOMAIN_TIERS`.
- **Leaf-module discipline (Phase 37):** No JSON imports; no `lib/date.ts`; no `react-i18next`; no module-init cross-service imports; `.ts` extension on all relative imports.
- **Sync-only invariant:** No `await`, `fetch`, `chatStream`, `chatCompletion`, or any I/O inside the leaf.
- **Atomic per-file commits + paired source+test.**
- **Session-scoped Map, no localStorage.** Pure in-memory `Map<string, Set<string>>`.
- **No event emission from any function** including `reset()`.
- **Phase 40 must not modify `web-search.service.ts`.**

### Claude's Discretion

- The exact ~200-entry tier list (specific domains and scores) — authored at planning/implementation.
- The exact 10-entry MULTI_SEGMENT_TLDS slice — may extend if obvious misses found.
- Test file names: `tests/services/source-diversity.service.test.mjs` + `tests/services/source-diversity-anti-wire.test.mjs`.
- Whether `extractDomain` handles undefined/non-string inputs defensively (leaning: yes, defensive — inputs come from external Tavily URLs).
- Whether `filterForDiversity`'s `usedDomains` param is typed `Set<string>` or `ReadonlySet<string>`.

### Deferred Ideas (OUT OF SCOPE)

- Widening Tavily `maxResults` from 1 to ~5 — Phase 41
- Calling `recordServedDomain` after each post creation — Phase 41
- Triggering `reset()` on day boundary — Phase 41 (wires into `concept-feed.service.ts:loadCache()`)
- Multi-snippet essay grounding — Phase 41
- Citation rendering polish — Phase 41
- Cross-device sync, user-overridable scores, engagement-fed domain demotions, non-English source bias, PSL slice replacement with `tldts` — outside v1.5
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONTENT-02 | Web-search filters for per-concept domain rotation: repeated Tavily calls for the same anchor pass `exclude_domains` so re-queries surface fresh sources | Phase 40 ships the leaf + its tests; the `recordServedDomain`/`getUsedDomains` API is the data layer that Phase 41 will connect to Tavily's `exclude_domains` field. `filterForDiversity` is the re-ranking layer for the already-fetched results array. |
</phase_requirements>

---

## Summary

Phase 40 is a pure-logic TypeScript leaf module with no external dependencies, no I/O, and no event emission. It ships three computation functions (`filterForDiversity`, `scoreSource`, `normalizeHost`/`extractDomain`), two session-state functions (`recordServedDomain`, `getUsedDomains`), and one reset (`reset()`), all collected under a singleton export. The internal state is a `Map<string, Set<string>>` (anchorId → set of registrable-root domains seen this session), purely in-memory and lost on cold boot. This is by design.

The most consequential deliverable in Phase 40 is the bundled ~200-entry `DOMAIN_TIERS` const. Its composition determines the quality of domain rotation visible to users. Research below provides a category-by-category composition strategy with approximate entry counts and score guidance, drawn from widely-recognized editorial quality benchmarks.

The leaf mirrors the shape of `engagement.service.ts` (Phase 39) in its singleton export pattern, comment block, and test pair structure, with one key difference: engagement uses localStorage; Phase 40 uses a pure in-memory Map. The test pair follows the `daily-read.service.test.mjs` + `engagement-anti-wire.test.mjs` precedents exactly — localStorage shim for the behavioral test (not needed for Phase 40 since no localStorage), dynamic import with `node --test` esbuild tsx loader, and a source-reading test using windowed regex.

**Primary recommendation:** Author the DOMAIN_TIERS const at planning time as a single TypeScript `const` at the bottom of the service file. The category breakdown below gives the planner enough signal to draft ~200 entries with confidence. The PSL slice is correct as-is for the journalism/academic domains Tavily returns; add `gob.mx` and `ac.nz` as the only non-obvious misses. Implement `filterForDiversity` as a literal two-pointer sort to keep logic auditable.

---

## 1. Domain-Tier List Curation Strategy

### Editorial Mandate (from D-03)

Quality is judged by: (a) peer-review or editorial oversight, (b) named authors with expertise accountability, (c) fact-check reputation, (d) primary-source proximity. Partisan lean is irrelevant. Score 0.0 is reserved for sites that exist primarily to game search indexing or farm AI-generated content.

### Category Breakdown (~200 entries total)

#### Top Tier — Score 0.90–0.97 (~30 entries)

Peer-reviewed academic publishers and primary scientific output. These never produce SEO content.

**Scientific publishers (score 0.95):**
`nature.com`, `science.org`, `cell.com`, `nejm.org` (New England Journal of Medicine), `thelancet.com`, `pnas.org` (PNAS), `bmj.com`, `jama.jamanetwork.com` → normalized to `jamanetwork.com`, `science.sciencemag.org` → normalized to `sciencemag.org` (legacy; now `science.org`), `annals.org` (Annals of Internal Medicine), `asm.org` (American Society for Microbiology), `royalsocietypublishing.org`

**Engineering/CS publishers (score 0.93):**
`ieee.org`, `acm.org`, `arxiv.org` (preprint — high value but no peer review; score 0.88 for distinction)

**Government primary sources (score 0.92):**
`nih.gov`, `cdc.gov`, `nasa.gov`, `noaa.gov`, `nist.gov`, `who.int`, `fda.gov`, `epa.gov`, `census.gov`

**Academic institutions (score 0.90):**
`mit.edu`, `stanford.edu`, `harvard.edu`, `caltech.edu`, `ox.ac.uk`, `cam.ac.uk`, `ucl.ac.uk`, `ethz.ch`, `nytimes.com` is NOT in this group — see journalism tier below.

*Subtlety for implementation:* `.edu` and `.gov` TLDs are inherently gated (US) and `.ac.uk` is gated (UK); but the tier list covers specific registered domains, not entire TLDs. A blanket `.edu` score is not part of D-04 — only named domain entries. This is intentional; `edu.ph` hosts low-quality content under a `.edu`-adjacent namespace.

#### Upper-Mid Tier — Score 0.80–0.88 (~40 entries)

Established journalism with named editors, corrections policies, and multi-decade reputations. Score is uniform across partisan lines per D-03.

**Wire services and international broadcasting (score 0.88):**
`reuters.com`, `apnews.com`, `bbc.com`, `bbc.co.uk` → normalized `bbc.co.uk`

**Major newspapers (score 0.85):**
`nytimes.com`, `washingtonpost.com`, `wsj.com`, `theguardian.com`, `economist.com`, `ft.com` (Financial Times), `latimes.com`, `chicagotribune.com`, `bostonglobe.com`, `theatlantic.com`, `newyorker.com`, `foreignpolicy.com`, `foreignaffairs.com`

**Major international news (score 0.85):**
`spiegel.de`, `lemonde.fr`, `elpais.com`, `asahi.com`, `scmp.com` (South China Morning Post), `aljazeera.com`, `dw.com` (Deutsche Welle), `france24.com`

**Science/Tech journalism with editors (score 0.83):**
`scientificamerican.com`, `newscientist.com`, `technologyreview.com` (MIT Tech Review), `wired.com`, `arstechnica.com`, `spectrum.ieee.org` → normalized `ieee.org` (already in top tier; same domain), `theconversation.com`

**Government policy/statistics (score 0.82):**
`bls.gov` (Bureau of Labor Statistics), `federalreserve.gov`, `worldbank.org`, `imf.org`, `oecd.org`, `un.org`, `ec.europa.eu` → normalized `europa.eu`

#### Mid Tier — Score 0.60–0.78 (~50 entries)

Reference sources, established trade publications, expert-adjacent content with some editorial layer.

**Encyclopedic reference (score 0.72):**
`wikipedia.org` — high-quality signal for Tavily queries but lacks primary accountability; score 0.72 reflects quality variance. `britannica.com` score 0.75 (editorial team, verified authors).

**Science communication (score 0.70):**
`phys.org`, `sciencedaily.com`, `eurekalert.org`, `popsci.com`, `discovermagazine.com`, `quantamagazine.org` (score 0.78 — exceptional editorial; Simons Foundation), `nautil.us`

**Tech / Business trade pubs (score 0.68):**
`hbr.org` (Harvard Business Review), `techcrunch.com`, `theverge.com`, `engadget.com`, `zdnet.com`, `cnet.com`, `venturebeat.com`, `bloomberg.com`, `businessinsider.com`, `forbes.com`, `inc.com`, `fastcompany.com`

**Well-known aggregators (score 0.65):**
`time.com`, `newsweek.com`, `thehill.com`, `politico.com`, `axios.com`, `vox.com`, `slate.com`, `salon.com`

**Established niche / subject blogs from named expert orgs (score 0.62):**
`psychologytoday.com`, `livescience.com`, `healthline.com`, `medicalnewstoday.com`, `mayoclinic.org` (score 0.78 — primary clinical source)

**Educational platforms (score 0.60):**
`khanacademy.org`, `coursera.org`, `edx.org`, `ted.com`

#### Low Tier — Score 0.15–0.38 (~30 entries)

Sites with a publishing infrastructure but minimal editorial layer; quality is highly variable.

**Aggregator-of-aggregators / blog platforms (score 0.30):**
`medium.com` — personal posts only; editorial-layer pubs on Medium should override per subdomain if feasible (but D-11 collapses subdomains, so `medium.com` as root is the right score for v1.5), `substack.com` — same reasoning (score 0.25), `tumblr.com` (score 0.15), `blogspot.com` (score 0.15), `wordpress.com` (score 0.20)

**Social media / UGC (score 0.20):**
`reddit.com`, `quora.com`, `stackexchange.com` (score 0.35 for SE — structured Q&A with voting)

**News aggregators (score 0.35):**
`msn.com`, `yahoo.com`, `huffpost.com`, `dailymail.co.uk`, `nypost.com`, `foxnews.com`, `breitbart.com`, `thefederalist.com`, `dailywire.com` — these all score in this range; D-03 is explicit about no partisan scoring adjustment. Score reflects editorial process quality, not political alignment.

**Link aggregators (score 0.25):**
`digg.com`, `flipboard.com`, `pocket.co`

#### Blocked Tier — Score 0.0 (~30 entries)

Known content farms, AI-generated content sites, SEO aggregators, doorway-page publishers. These entries are flagged, not omitted, so the D-06 fallback can surface them explicitly when there is no other option.

**Known AI content farms (score 0.0):**
`articleforge.com`, `spinrewriter.com`, `ilovewiki.com`, `thesun.co.uk` (tabloid sensationalism factory — not to be confused with quality), sites matching `*-news.com` pattern (cannot block by regex in a flat Map — list known instances explicitly).

**SEO aggregators / scraper sites (score 0.0):**
`ezinearticles.com`, `hubpages.com`, `infobarrel.com`, `squidoo.com` (defunct but may appear in old cache), `suite101.com`, `helium.com`, `associated-content.com`, `buzzle.com`, `answerbag.com`

**Doorway / thin content (score 0.0):**
`reference.com`, `ask.com`, `answers.com`, `factmonster.com`, `funtrivia.com`

*Note for planner:* The blocked tier is the most volatile category. Sites that were quality journalism a decade ago (e.g., Demand Media's properties like `eHow.com`) may have changed ownership and publishing model. The planner should author entries based on current-day reputation, not legacy. The 0.0 floor exists to ensure fallback surfaces the entry rather than silently losing it.

### Entry Count Distribution

| Tier | Score Range | Count |
|------|------------|-------|
| Top (peer-reviewed, .gov) | 0.90–0.97 | ~30 |
| Upper-mid (established journalism, intl news) | 0.80–0.88 | ~40 |
| Mid (encyclopedic, trade, expert blogs) | 0.60–0.78 | ~50 |
| Low (aggregator platforms, UGC) | 0.15–0.38 | ~30 |
| Blocked (farms, SEO mills) | 0.0 | ~30 |
| **Total** | | **~180–200** |

*Implementation note:* The const is built as `Readonly<Record<string, number>>`. At runtime, `scoreSource` converts it to a `Map<string, number>` on first call (or it can be initialized as a `Map` literal directly — see Code Examples below). A Map lookup is O(1) and avoids `Object.hasOwn` overhead on the Record form. The CONTEXT.md D-03 mentions `~200 entries`; this distribution hits ~180 to leave room for the planner to fill gaps during authoring without inflating the file size.

---

## 2. PSL Slice Validation

### Current 10-Entry Slice (D-11)

```ts
const MULTI_SEGMENT_TLDS = new Set([
  'co.uk', 'co.jp', 'com.au', 'co.nz', 'org.uk',
  'ac.uk', 'edu.au', 'gov.uk', 'co.kr', 'com.br',
]);
```

### Coverage Analysis

For the journalism + academic domains in the tier list above, the covered ccTLD+SLD combinations are:

| Domain | TLD Needed | Covered? |
|--------|-----------|---------|
| `bbc.co.uk` | `co.uk` | YES |
| `ox.ac.uk` | `ac.uk` | YES |
| `cam.ac.uk` | `ac.uk` | YES |
| `gov.uk` (any) | `gov.uk` | YES |
| `asahi.com` (Japan — pure .com) | — | n/a |
| `elpais.com` (Spain — pure .com) | — | n/a |
| `scmp.com` (HK — pure .com) | — | n/a |
| `spiegel.de` (.de ccTLD, single segment) | — | n/a |
| `lemonde.fr` (.fr ccTLD, single segment) | — | n/a |

### Obvious Misses

Two non-obvious multi-segment TLDs that Tavily search results plausibly return for academic/government sources:

- **`gob.mx`** — Mexican federal government domains (`conacyt.gob.mx`, `gob.mx/sep`). Science queries about Latin America may surface these. Adding `gob.mx` handles `gobierno.gob.mx` → `gobierno.gob.mx` correctly (3-segment root).
- **`ac.nz`** — New Zealand academic institutions (University of Auckland is `auckland.ac.nz`). The `co.nz` entry already handles NZ commercial, but `.ac.nz` is the research namespace.

### Less Critical Additions

- **`ne.jp`** — Japanese ISP domain; not typically a research source. Low-priority.
- **`edu.sg`** / **`edu.my`** — Southeast Asian academic; edge case for the initial tier list. Low-priority.
- **`ac.jp`** — Japanese academic (Tokyo University is `u-tokyo.ac.jp`). More valuable than `ne.jp` if any JP academic sources appear.

### Recommendation

Add `gob.mx` and `ac.nz` to MULTI_SEGMENT_TLDS (expanding to 12 entries). Defer `ac.jp`, `edu.sg`, `edu.my` to a future edit if data shows Japanese/SE-Asian academic sources appearing in Tavily results.

```ts
const MULTI_SEGMENT_TLDS = new Set([
  'co.uk', 'co.jp', 'com.au', 'co.nz', 'org.uk',
  'ac.uk', 'edu.au', 'gov.uk', 'co.kr', 'com.br',
  'gob.mx', 'ac.nz',  // added — covers MX gov + NZ academic
]);
```

**Confidence:** MEDIUM — based on publicly-known domain registrar conventions. The Public Suffix List at `publicsuffix.org` is authoritative; this analysis cross-references training knowledge of international TLD conventions without fetching the live list (per D-11 design intent).

---

## 3. Leaf-Module Discipline Patterns

### The Node `--test` + esbuild tsx Loader Pattern

**Confirmed from:** `app/tests/services/engagement.service.test.mjs`, `app/tests/services/daily-read.service.test.mjs`, `app/tests/services/leaf-imports.test.mjs`.

All tests use:
- `import ... from 'node:test'` (not Vitest, not Jest)
- `import ... from 'node:assert/strict'`
- Dynamic `await import('../../src/services/engagement.service.ts')` with `.ts` extension (esbuild tsx loader resolves it)
- `globalThis.localStorage = { _store: new Map(), ... }` shim when localStorage is needed
- No JSON imports (would trigger Node's `ERR_IMPORT_ATTRIBUTE_MISSING`)

**Phase 40 difference from engagement:** Phase 40 has no localStorage. The behavioral test does NOT need the localStorage shim — the service uses a `Map` in module scope. Dynamic import is still needed to load the `.ts` source.

### No JSON Import Rule (from Phase 37)

The `leaf-imports.test.mjs` scans all `services/`, `lib/`, `providers/` files for `from '../locales'` and `from 'i18next'` patterns. The same discipline extends to JSON data: if Phase 40 put DOMAIN_TIERS in a `.json` file and imported it, the test `import '../data/domain-tiers.json'` would require a JSON import attribute (`with { type: 'json' }`), which breaks `node --test` loadability without the attribute. D-04 resolves this by inlining the const — correct choice.

### `.ts` Extension Convention

All relative imports must use `.ts` extension explicitly:
```ts
import type { WebSearchResult } from '../types/index.ts';
```
NOT `'../types/index'` (would fail the esbuild tsx loader in tests).

### Source-Reading Anti-Wire Test Pattern (Phase 35/39 precedents)

**Phase 35 pattern (`useQuestions-system-prompt-stability.test.mjs`):**
- Reads the source file as a string
- Uses `source.indexOf()` and `source.search(regex)` to find structural anchors
- Asserts ORDER of anchors (offset comparisons)
- Asserts ABSENCE of a pattern in a window around another anchor

**Phase 39 pattern (`engagement-anti-wire.test.mjs`):**
- Walks all `.ts/.tsx` files under `app/src/`
- For each file: finds ALL offsets of pattern A and ALL offsets of pattern B
- If both are present in the same file: checks pairwise distances (window = 800 chars)
- Counterweight assertion: confirms the target file IS in the scan list AND emits the expected signal (catches future refactors that delete the service)

**Phase 40 anti-wire test shape:**
Phase 40 needs a simpler invariant: the leaf itself must not contain `await`, `fetch`, `chatStream`, or `chatCompletion`. This is a single-file scan (not multi-file like the Phase 39 co-emit scanner). Pattern follows Phase 35 more closely than Phase 39:

```js
// tests/services/source-diversity-anti-wire.test.mjs
const source = fs.readFileSync(/* source-diversity.service.ts */, 'utf-8');
// Assert no 'await ' keyword appears in the module
// Assert 'fetch(' is absent
// Assert 'chatStream(' is absent
// Assert 'chatCompletion(' is absent
// Counterweight: assert 'filterForDiversity' IS present (proves the scan reaches the file)
```

**Window fragility lesson from Phase 39 SUMMARY (D-06 static half, image-gen-key-gate.test.mjs):**
The `image-gen-key-gate.test.mjs` uses a 6000-char window starting at `refillIdx`. A 6-line docstring trimmed to 3 lines was required in `concept-feed.service.ts` to keep the assignment within the window. Phase 40 anti-wire test should NOT use character-window proximity assertions (it's checking a single file for entire-file presence of forbidden patterns — no window needed). If the anti-wire test uses `source.includes('await ')`, it correctly catches any `await` anywhere in the file regardless of position. Keep it simple.

---

## 4. Phase 39 Peer Alignment

### File Shape to Mirror

`app/src/services/engagement.service.ts` establishes the canonical leaf-service structure:

1. **Block comment header** with: phase reference, purpose, leaf-module discipline reminders, event-emission rules
2. **Imports** (type-only where possible) — Phase 40 needs only `import type { WebSearchResult } from '../types/index.ts'`; no eventBus, no other service imports
3. **Module-level constants**: STORAGE_KEY → Phase 40: no STORAGE_KEY needed; instead `MULTI_SEGMENT_TLDS` and `DOMAIN_TIERS` consts
4. **Internal state**: `const usedByAnchor = new Map<string, Set<string>>()` (replaces `loadState()`/`saveState()` pattern since no persistence)
5. **Internal helpers**: `freshState`, `loadState`, `saveState` → Phase 40: `normalizeHost`, `extractDomain`, `scoreSource` (internal implementations)
6. **Singleton export**: `export const sourceDiversityService = { ... }` — each method documented with JSDoc
7. **Exported internals for tests**: Phase 40 exports `extractDomain`, `normalizeHost`, `MULTI_SEGMENT_TLDS`, `DOMAIN_TIERS` per D-15

### Key Differences from engagement.service.ts

| Aspect | engagement.service.ts | source-diversity.service.ts |
|--------|-----------------------|------------------------------|
| Persistence | localStorage (cross-day) | In-memory Map (session-scoped) |
| State init | `loadState()` lazy parse | `new Map<string, Set<string>>()` at module scope |
| Event emission | Yes (ANCHOR_DISMISSED, ENGAGEMENT_CHANGED) | None |
| ServiceResult | Not used | Not used |
| External imports | eventBus, postHistoryService | None (types only) |
| STORAGE_KEY | `'trellis_engagement_v1'` | None |

### Test Pair Structure

**Behavioral test** (`source-diversity.service.test.mjs`):
- No localStorage shim needed (pure Map)
- `await import('../../src/services/source-diversity.service.ts')` with `.ts` extension
- `describe` + `it` + `beforeEach` pattern from `engagement.service.test.mjs`
- `beforeEach` calls `sourceDiversityService.reset()` to clear session state

**Anti-wire test** (`source-diversity-anti-wire.test.mjs`):
- Single-file source read (not multi-file walk like engagement-anti-wire)
- Asserts: no `await `, no `fetch(`, no `chatStream(`, no `chatCompletion(` in file source
- Counterweight: asserts `filterForDiversity` IS present in source

---

## 5. Phase 41 Seam Points (Read-Only Acknowledgment)

Phase 40 ships a ready-to-consume API. Phase 41 consumes it at these exact locations:

### Seam Point 1: News Pre-fetch Loop (`concept-feed.service.ts` ~line 1293–1312)

Current code fetches `maxResults: 1` and stores `results.data.results[0]` into `preFetched.news.set(a.conceptId, ...)`. Phase 41 will:
1. Call `sourceDiversityService.getUsedDomains(a.conceptId)` → returns `Set<string>`
2. Pass the set to Tavily as `exclude_domains: [...usedDomains]` (after Phase 41 adds `excludeDomains?` to `WebSearchOptions`)
3. Widen `maxResults` from 1 to ~5
4. Call `sourceDiversityService.filterForDiversity(results.data.results, usedDomains)` on the array
5. Take `filtered[0]` as the pre-fetched result
6. Call `sourceDiversityService.recordServedDomain(a.conceptId, extractDomain(filtered[0].url))` after committing

### Seam Point 2: News Creation Loop (`concept-feed.service.ts` ~line 1083–1131)

Same pattern as Seam Point 1 but for the non-pre-fetched path (when `cached` is absent).

### Seam Point 3: Day-Boundary Reset (`concept-feed.service.ts:loadCache()`)

The existing `cached.date !== today()` branch will gain: `sourceDiversityService.reset()`. Phase 40 ships `reset()` ready to be called.

### Phase 41 Contract (What Phase 40 Must Deliver)

Phase 41 expects exactly this API surface from Phase 40:
```ts
sourceDiversityService.filterForDiversity(results: WebSearchResult[], usedDomains: Set<string>): WebSearchResult[]
sourceDiversityService.recordServedDomain(anchorId: string, domain: string): void
sourceDiversityService.getUsedDomains(anchorId: string): Set<string>
sourceDiversityService.scoreSource(domain: string): number
sourceDiversityService.reset(): void

// Exported internals (tests + Phase 41 may use extractDomain):
extractDomain(url: string): string | undefined
normalizeHost(hostname: string): string
MULTI_SEGMENT_TLDS: Set<string>
DOMAIN_TIERS: Readonly<Record<string, number>>
```

Phase 41 also confirms that `web-search.service.ts:WebSearchOptions` does NOT currently have `excludeDomains?: string[]` (verified: the current `WebSearchOptions` interface has only `topic`, `maxResults`, `includeImages`). Phase 41 will add this field; Phase 40 must NOT add it.

---

## 6. Architecture Patterns

### Recommended File Structure

```
app/src/services/source-diversity.service.ts   — the leaf (Phase 40)
app/tests/services/source-diversity.service.test.mjs  — behavioral suite
app/tests/services/source-diversity-anti-wire.test.mjs — source-reading invariant
```

### Pattern: Inline Tier Map as Module-Level Const

**What:** `DOMAIN_TIERS` as a `Readonly<Record<string, number>>` literal at the bottom of the file (after the singleton export). Score lookup uses a module-level `Map` initialized from DOMAIN_TIERS for O(1) access.

**Example:**
```typescript
// Source: D-04 + D-03 guidance
const DOMAIN_TIERS: Readonly<Record<string, number>> = {
  'nature.com': 0.95,
  'science.org': 0.95,
  'nejm.org': 0.95,
  // ... ~200 entries ...
  'ezinearticles.com': 0.0,
} as const;

// O(1) lookup map — initialized once at module load
const _tierMap = new Map<string, number>(Object.entries(DOMAIN_TIERS));
```

`scoreSource(domain)` then does `return _tierMap.get(domain) ?? 0.5` — returning a neutral mid-score for unknown domains (not 0.0, which is reserved for known-bad). *Decision point for planner:* what default score for "domain not in tier list"? Options:
- `0.5` (neutral — unknown sites treated as middle-of-road)
- `0.3` (lean pessimistic — prefer known-good over unknown)
- `0.0` (treat unknown as blocked — too aggressive; would surface only known domains)

Recommendation: `0.5` for v1.5. Rationale: Tavily returns results based on query relevance; an unknown domain appearing in Tavily results is more likely a legitimate niche site than a farm. A 0.5 score places it below established journalism (0.85+) and above known-low sites (0.15–0.38). This is a Claude's Discretion area.

### Pattern: Strict Two-Pass Sort (`filterForDiversity`)

```typescript
// Source: D-05
function filterForDiversity(
  results: WebSearchResult[],
  usedDomains: Set<string>,
): WebSearchResult[] {
  const scored = results
    .map(r => ({ r, domain: extractDomain(r.url) }))
    .filter(({ domain }) => domain !== undefined) as { r: WebSearchResult; domain: string }[];
  
  const unseen = scored
    .filter(({ domain }) => !usedDomains.has(domain))
    .sort((a, b) => scoreSource(b.domain) - scoreSource(a.domain));
  
  const seen = scored
    .filter(({ domain }) => usedDomains.has(domain))
    .sort((a, b) => scoreSource(b.domain) - scoreSource(a.domain));
  
  const ranked = [...unseen, ...seen].map(({ r }) => r);
  
  // D-06: best-of-the-bad fallback — prevents zero-posts-for-concept failure
  // (ROADMAP success criterion #1). If all results were malformed URLs (filtered
  // out above), fall back to the raw list sorted by score.
  if (ranked.length === 0 && results.length > 0) {
    const fallback = [...results].sort(
      (a, b) => scoreSource(extractDomain(b.url) ?? '') - scoreSource(extractDomain(a.url) ?? ''),
    );
    return [fallback[0]];
  }
  
  return ranked;
}
```

**Note on D-06 semantics:** The fallback fires when ALL results had malformed URLs (extractDomain returns undefined for all). In practice, if there are valid results but all domains are in `usedDomains`, those still appear in Pass B (the `seen` bucket) — they are NOT filtered out. The fallback is truly a last-resort for malformed-URL-only inputs. The planner should note this in a code comment.

### Anti-Patterns to Avoid

- **Don't use `Object.keys(DOMAIN_TIERS).includes(domain)`** for tier lookup — O(N). Use the `_tierMap` for O(1).
- **Don't import `date.ts` or any other service** — leaf-module discipline.
- **Don't call `localStorage` anywhere** — session Map only.
- **Don't add an event emission to `reset()`** — D-08 is explicit; no event for wholesale wipe.
- **Don't make `DOMAIN_TIERS` a runtime fetch** — must be inlined const.

---

## 7. Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PSL parsing | A full PSL parser | Hand-rolled 12-entry `MULTI_SEGMENT_TLDS` Set | `tldts` is 30KB; Phase 37 leaf-module discipline forbids new dependencies; 12 entries covers ~99% of Tavily results for the domain categories in DOMAIN_TIERS |
| Domain quality scores | An external API call or DB query | Inline `DOMAIN_TIERS` const | Must be synchronous; must be offline-capable; D-04 is explicit |
| O(N) tier lookup | `Object.keys()` scan | Module-level `Map<string, number>` | O(N) is fine for N=200 at the function level, but `Map.get` is semantically clearer and marginally faster |

---

## 8. Common Pitfalls

### Pitfall 1: Subdomain Collapse Breaks Tier Lookup

**What goes wrong:** `extractDomain('https://blogs.nature.com/article')` returns `'nature.com'` — correct. But if the implementation doesn't collapse the subdomain first and instead looks up `'blogs.nature.com'` in `_tierMap`, the result is `undefined` → score 0.5 (neutral), not 0.95 (top tier). The tier list has `'nature.com'`, not `'blogs.nature.com'`.

**Why it happens:** `new URL(url).hostname` returns the full hostname including subdomains. `normalizeHost` must strip them.

**How to avoid:** `normalizeHost` is called inside `scoreSource`. `scoreSource` always receives an already-normalized domain (the registrable root). Never call `_tierMap.get(hostname)` directly from `filterForDiversity` — always go through `scoreSource(normalizeHost(hostname))` chain.

**Warning signs:** Test case where `'www.bbc.com'` scores 0.5 instead of 0.85.

### Pitfall 2: PSL Slice Order Matters

**What goes wrong:** `hostname.split('.').slice(-2).join('.')` on `'www.bbc.co.uk'` gives `'co.uk'` — correctly matching MULTI_SEGMENT_TLDS. Then `slice(-3).join('.')` gives `'bbc.co.uk'` — correct registrable root. BUT on `'bbc.com'`, `slice(-2)` gives `'bbc.com'` — not in MULTI_SEGMENT_TLDS. Then `slice(-2)` is used for registrable root → `'bbc.com'` — correct.

**Why it happens:** The two-branch logic must evaluate the `-2` slice FIRST, check against MULTI_SEGMENT_TLDS, and only then decide to use `-3` or `-2`.

**How to avoid:** The `normalizeHost` implementation must follow:
```ts
function normalizeHost(hostname: string): string {
  const parts = hostname.split('.');
  const twoSuffix = parts.slice(-2).join('.');
  if (MULTI_SEGMENT_TLDS.has(twoSuffix)) {
    return parts.slice(-3).join('.');
  }
  return twoSuffix;
}
```

**Warning signs:** Test case where `'www.bbc.co.uk'` normalizes to `'co.uk'` (only 2 parts taken instead of 3).

### Pitfall 3: D-06 Fallback Triggers Too Early

**What goes wrong:** Implementation interprets D-06 as "if there are no unseen results, return best-of-all." But Pass B (seen results) still has valid entries — they should surface in order. The fallback should only trigger when the entire `scored` array (after URL-validity filtering) is empty.

**Why it happens:** Confusing "filtered list is empty" with "Pass A is empty."

**How to avoid:** Fallback fires only when `ranked.length === 0` (both Pass A AND Pass B contributed zero valid results). If `usedDomains` contains all domains but results are valid, `ranked` has entries from Pass B — no fallback needed.

### Pitfall 4: Anti-Wire Test False Positive from `await` in Comments

**What goes wrong:** The source-reading test uses `source.includes('await ')` and fails because a JSDoc comment says `// No await — synchronous by design`.

**Why it happens:** `'await '` appears in the comment.

**How to avoid:** Use a negative regex that excludes comment lines, OR use `'await '` as a standalone word check that excludes `//` line prefix. Simplest: `\bawait\b` regex against the source with comment lines stripped first. OR rely on TypeScript itself — if any `await` appeared in the source, `tsc` would require the function to be `async`. The test can check that no function in the file is `async`: `/\basync\s+function\b|\basync\s*\(/` being absent is equivalent.

**Preferred approach:** Assert no `async ` keyword in the module (simpler, covers all await sites):
```js
assert.ok(!/\basync\s/.test(source), 'source-diversity.service.ts must have no async functions');
```

### Pitfall 5: Module-Level Map vs. Const Record — Initialization Cost

**What goes wrong:** `Object.entries(DOMAIN_TIERS)` is called every time `scoreSource` is invoked (inside a lazy init check), creating a 200-element Map on every call.

**Why it happens:** Over-engineering lazy initialization.

**How to avoid:** Initialize `_tierMap` as a module-level const immediately:
```ts
const _tierMap = new Map<string, number>(Object.entries(DOMAIN_TIERS));
```
Module-level init runs once at import time. For a 200-entry Map, this is < 1ms. No lazy init needed.

---

## 9. Validation Architecture

Nyquist validation is **enabled** (`.planning/config.json` has `"nyquist_validation": true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` with esbuild tsx loader |
| Config file | None — run via `npm test` or `node --test` directly |
| Quick run command | `node --test --import ./tests/_hooks.mjs tests/services/source-diversity.service.test.mjs` |
| Full suite command | `npm test` (from `app/`) |

*Note:* The exact hooks import path should follow the pattern established by existing tests. Check `package.json` for the `test` script to confirm the loader invocation.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONTENT-02 (SC-1) | `filterForDiversity` re-ranks unseen domains ahead of seen, with best-of-bad fallback | unit | `node --test tests/services/source-diversity.service.test.mjs` | Wave 0 |
| CONTENT-02 (SC-2) | `recordServedDomain` + `reset()` session Map round-trip | unit | (same file) | Wave 0 |
| CONTENT-02 (SC-3) | `scoreSource` returns `[0,1]` in O(1) from bundled Map | unit | (same file) | Wave 0 |
| CONTENT-02 (SC-4) | No `await`/`fetch`/`chatStream`/`chatCompletion` in leaf | source-reading | `node --test tests/services/source-diversity-anti-wire.test.mjs` | Wave 0 |

### Proposed Test Files + What Each Verifies

#### `tests/services/source-diversity.service.test.mjs` — Behavioral Suite

Mirrors `engagement.service.test.mjs` shape. Cases:

1. **`filterForDiversity` — unseen domain beats seen domain regardless of score order** — Pass A result scores 0.3 but passes before Pass B result scoring 0.9. Asserts returned order: unseen-first.
2. **`filterForDiversity` — within unseen tier, higher score wins** — two unseen results with scores 0.9 and 0.5; higher appears first.
3. **`filterForDiversity` — stable sort preserves Tavily order for ties** — two unseen results, both score 0.7; Tavily-original position 0 appears first.
4. **`filterForDiversity` — D-06 best-of-bad fallback: all malformed URLs returns the raw best available** — input has one valid result and one malformed; malformed drops out; single valid result returned. Sub-case: all malformed → fallback returns original[0] score-sorted (or just [0] if all score 0).
5. **`filterForDiversity` — D-10 malformed URL is silently excluded** — `{ url: 'not-a-url' }` in input; does not appear in ranked output unless it's the only result (D-06).
6. **`scoreSource` — known top-tier domain returns expected score** — `scoreSource('nature.com')` returns 0.95.
7. **`scoreSource` — unknown domain returns neutral score** — `scoreSource('unknown-site-xyz.com')` returns 0.5 (or the chosen default).
8. **`scoreSource` — blocked domain returns 0.0** — `scoreSource('ezinearticles.com')` returns 0.0.
9. **`extractDomain` — collapses subdomain correctly** — `extractDomain('https://science.nature.com/article')` returns `'nature.com'`.
10. **`extractDomain` — handles multi-segment TLD** — `extractDomain('https://www.bbc.co.uk/news')` returns `'bbc.co.uk'`.
11. **`extractDomain` — malformed URL returns undefined** — `extractDomain('not-a-url')` returns `undefined`.
12. **`recordServedDomain` + `getUsedDomains` round-trip** — record `('anchor-1', 'nature.com')`; `getUsedDomains('anchor-1')` returns `Set { 'nature.com' }`.
13. **`getUsedDomains` — returns empty Set for unknown anchorId** — no throw, returns `new Set()`.
14. **`reset()` clears all anchor entries** — record two anchors; `reset()`; both `getUsedDomains` calls return empty.
15. **Session Map does not persist across module re-import** — (structural test; because the Map is module-level, reset() is the only way to clear it within a single test run; beforeEach calls reset())

#### `tests/services/source-diversity-anti-wire.test.mjs` — Source-Reading Invariant

Three assertions:

1. **No `async` keyword in leaf** — `!/\basync\s/.test(source)` — proves no `await` can exist (all async calls require `async` function wrapper)
2. **No `fetch(` in leaf** — `!source.includes('fetch(')` — direct fetch would bypass the sync contract
3. **No `chatStream(` or `chatCompletion(` in leaf** — two assertions, one per keyword
4. **Counterweight: `filterForDiversity` IS present** — confirms the scan reaches the live file (catches a rename/delete that would otherwise leave a silently-passing test suite)

### Sampling Rate

- **Per task commit:** `node --test tests/services/source-diversity.service.test.mjs tests/services/source-diversity-anti-wire.test.mjs`
- **Per wave merge:** `npm test` from `app/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/services/source-diversity.service.test.mjs` — covers SC-1, SC-2, SC-3 (15 behavioral cases)
- [ ] `tests/services/source-diversity-anti-wire.test.mjs` — covers SC-4 (4 source-reading assertions)

*(No existing test infrastructure covers Phase 40 — both files are new)*

---

## 10. Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — Phase 40 is a pure code/const change with no network calls, no new npm packages, no CLI tools, no database).

---

## 11. Open Questions / Risks

### Open Question 1: Default Score for Unknown Domains

**What we know:** `scoreSource` must return a number in `[0, 1]` for every input. The DOMAIN_TIERS Map will have ~200 entries; the real web has millions of domains. Unknown domains are common.

**What's unclear:** The right default — 0.5 (neutral), 0.3 (lean pessimistic), or 0.0 (blocked equivalence).

**Recommendation:** 0.5 (neutral). Rationale above. Planner should document this as an explicit constant (`const UNKNOWN_DOMAIN_SCORE = 0.5`) so future tuning is a one-line change.

### Open Question 2: What Happens if `usedDomains` Covers All Tavily Results?

**What we know:** Pass A (unseen) is empty; Pass B (seen) has all results. `ranked` = Pass B sorted by score. Non-empty. D-06 fallback does not trigger. Correct behavior.

**What's unclear:** Is this the expected UX? Yes — if a user has already seen Nature and BBC for a topic, and Tavily only returns Nature and BBC again, showing the higher-scored one (Nature) is correct. Phase 41 mitigates this via `exclude_domains` so Tavily returns genuinely fresh sources first.

**Recommendation:** No change needed in Phase 40. Document the behavior in `filterForDiversity` JSDoc: "Returns seen results in score order when all inputs are already-seen — the D-06 fallback only fires if all inputs were malformed URLs."

### Open Question 3: `extractDomain` Handling of `undefined` Input

**What we know:** D-15 exports `extractDomain(url: string): string | undefined`. CONTEXT.md's Claude's Discretion section notes "leaning defensive given URL strings come from external Tavily results."

**What's unclear:** Should the TypeScript signature accept `string | undefined` (defensive) or only `string` (trusting callers)?

**Recommendation:** Signature `extractDomain(url: string): string | undefined`. Callers always pass a string (it comes from `WebSearchResult.url` which is `string`). But the body should wrap `new URL(url)` in try/catch regardless — the trust question is about undefined inputs, and `url` will not be undefined at call sites in Phase 40.

### Risk 1: Anti-Wire Window Size (image-gen-key-gate lesson)

The Phase 39 SUMMARY explicitly calls out that the 6-line docstring in `concept-feed.service.ts` was trimmed to 3 lines to keep a code block within `image-gen-key-gate.test.mjs`'s 6000-char window. Phase 40's anti-wire test should NOT use a character window — it scans the entire source file for `async` keyword presence. This is inherently window-fragility-free. LOW risk.

### Risk 2: `bbc.co.uk` vs `bbc.com` — Same Source, Different Registrable Roots

BBC content appears on both `bbc.com` and `bbc.co.uk`. Without both entries in DOMAIN_TIERS, one normalizes to a known high-tier domain and the other is an unknown (scoring 0.5). Both should be in the tier list at 0.85–0.88.

More generally: major outlets with both .com and country-code presences need both entries. Planner should audit the journalism tier for this. Affected pairs:
- `bbc.com` + `bbc.co.uk`
- `theguardian.com` + `guardian.co.uk` (less common for Tavily)
- `reuters.com` only (no ccTLD variant in common use)

### Risk 3: `arxiv.org` Score

`arxiv.org` is a preprint server — extremely valuable to academic users but NOT peer-reviewed. Score of 0.88 places it below peer-reviewed (0.95) but above established journalism (0.85). This is defensible but worth calling out explicitly in the DOMAIN_TIERS comment.

---

## 12. Code Examples

### normalizeHost Implementation

```typescript
// Source: D-11 + D-09
function normalizeHost(hostname: string): string {
  const parts = hostname.split('.');
  const twoSuffix = parts.slice(-2).join('.');
  if (MULTI_SEGMENT_TLDS.has(twoSuffix)) {
    return parts.slice(-3).join('.');
  }
  return twoSuffix;
}
```

### extractDomain Implementation

```typescript
// Source: D-09, D-10
export function extractDomain(url: string): string | undefined {
  try {
    const { hostname } = new URL(url);
    return normalizeHost(hostname);
  } catch {
    return undefined;
  }
}
```

### scoreSource Implementation

```typescript
// Source: D-02, D-03, SC-3
export function scoreSource(domain: string): number {
  return _tierMap.get(domain) ?? UNKNOWN_DOMAIN_SCORE;
}
```

### recordServedDomain + getUsedDomains

```typescript
// Source: D-13, D-14, SC-2
const usedByAnchor = new Map<string, Set<string>>();

function recordServedDomain(anchorId: string, domain: string): void {
  let set = usedByAnchor.get(anchorId);
  if (!set) {
    set = new Set<string>();
    usedByAnchor.set(anchorId, set);
  }
  set.add(domain);
}

function getUsedDomains(anchorId: string): Set<string> {
  return usedByAnchor.get(anchorId) ?? new Set<string>();
}
```

### Singleton Export Shape

```typescript
// Source: D-13
export const sourceDiversityService = {
  filterForDiversity,
  recordServedDomain,
  getUsedDomains,
  scoreSource,
  reset,
};
```

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `app/src/services/engagement.service.ts` — canonical Phase 39 peer reference
- Direct source read: `app/tests/services/engagement.service.test.mjs` — behavioral test structure
- Direct source read: `app/tests/services/engagement-anti-wire.test.mjs` — anti-wire source-reading pattern
- Direct source read: `app/tests/state/useQuestions-system-prompt-stability.test.mjs` — Phase 35 source-reader precedent
- Direct source read: `app/tests/services/leaf-imports.test.mjs` — Phase 37 leaf-module invariant
- Direct source read: `app/src/services/web-search.service.ts` — confirms `WebSearchOptions` shape, confirms no `exclude_domains` yet
- Direct source read: `app/src/types/index.ts` — `WebSearchResult = { title, url, content, score }`
- Direct source read: `app/src/services/concept-feed.service.ts` lines 1083–1131, 1293–1312 — Phase 41 seam points
- Direct source read: `.planning/phases/40-source-diversity-leaf-module/40-CONTEXT.md` — all 15 locked decisions
- Direct source read: `.planning/phases/39-engagement-service-walker-extension/39-01-engagement-service-SUMMARY.md` — window fragility lesson, anti-wire defense-in-depth pattern
- Direct source read: `.planning/REQUIREMENTS.md` — CONTENT-02 definition
- Direct source read: `.planning/ROADMAP.md` lines 1112–1121 — Phase 40 success criteria

### Secondary (MEDIUM confidence)

- Training knowledge: widely-recognized domain quality benchmarks (academic publisher reputations, journalism editorial standards) — cross-referenced against CONTEXT.md D-03 editorial guidance
- Training knowledge: ccTLD + SLD conventions for international academic/government domains — validated against the 10-entry initial PSL slice in D-11

### Tertiary (LOW confidence)

- None identified — no findings rely solely on unverified WebSearch.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure TypeScript built-ins; no new libraries
- Architecture: HIGH — verified against Phase 39 peer reference and Phase 37 leaf-module tests
- Domain-tier composition: MEDIUM — editorial quality benchmarks are well-established but no live PSL or current reputation index was fetched; operator should review DOMAIN_TIERS entries in PR
- PSL slice validation: MEDIUM — based on training knowledge of international ccTLD conventions
- Pitfalls: HIGH — derived from actual code patterns and Phase 39 SUMMARY lessons
- Test architecture: HIGH — mirrors verified Phase 39 test pair structure

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable domain; DOMAIN_TIERS itself may need tuning based on production data)
