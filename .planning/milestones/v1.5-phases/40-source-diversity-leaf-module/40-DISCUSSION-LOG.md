# Phase 40: Source Diversity Leaf Module — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 40-source-diversity-leaf-module
**Areas discussed:** Domain-tier list, Re-ranking algorithm, Domain normalization, API shape + file location

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Domain-tier list | Where ~200 entries come from, tier shape, categories, file layout. | ✓ |
| Re-ranking algorithm | filterForDiversity strategy, fallback semantics, tie-breaks, hard block. | ✓ |
| Domain normalization | Subdomain handling, malformed URL behavior, PSL coverage. | ✓ |
| API shape + file location | services/ vs lib/, singleton vs named exports, surface, helper exports. | ✓ |

**User's choice:** All four areas
**Notes:** Mid-discussion clarification asked twice — once on what "domain" means (web hostname like `nature.com`), once on whether "domain" here means concept domain (mindmap cluster) or web domain. De-conflated explicitly: Phase 40 operates on web hostnames only; never touches mindmap taxonomy.

---

## Domain-Tier List

### Q1 — List source

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-curated by Claude (Recommended) | Claude drafts ~200 entries based on widely-known reputable sources, peer-reviewed academic, established journalism. Reviewable in PR. Local-first. | ✓ |
| Import from public quality-rating source | Ad Fontes / NewsGuard. Licensing concerns; bundle bloat; ratings drift; external dependency. | |
| Use Tavily's per-result score, no bundled list | Tavily's score is per-result-relevance, not domain-quality. Misses goal. | |
| Hybrid (50 gold + everything-else mid) | Smaller list, less coverage, same boundary issues. | |

**User's choice:** Hand-curated by Claude
**Notes:** Aligns with Trellis's local-first ethos; avoids licensing entanglement.

### Q2 — Score shape

| Option | Description | Selected |
|--------|-------------|----------|
| Continuous number [0.0, 1.0] (Recommended) | Smooth ordering; matches ROADMAP success criterion #3. | ✓ |
| Discrete bucket {gold/high/mid/low/blocked} | Easier to author + reason about. Ties within bucket force secondary sort. | |
| Three-tier {trust/neutral/blocked} | Trivial. Collapses meaningful gradations. | |

**User's choice:** Continuous number [0.0, 1.0]
**Notes:** Single number per domain; ties handled separately (D-07).

### Q3 — Editorial line

| Option | Description | Selected |
|--------|-------------|----------|
| Top: peer-reviewed + academic + reputable journalism; Blocked: SEO/AI farms only (Recommended) | Mainstream outlets get same score regardless of partisan lean. | ✓ |
| Strict — only peer-reviewed + AP/Reuters at top | All other outlets at mid-tier. | |
| No editorial filtering — only academic vs everything else | Two tiers; SEO farms still serve. | |

**User's choice:** Expansive editorial line
**Notes:** Trellis takes no editorial position on partisan framing. Quality judged by editorial process and reputation, not viewpoint.

### Q4 — File layout

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in source-diversity leaf (Recommended) | Single file; matches Phase 37 leaf-module discipline. ~6KB; trivial. | ✓ |
| Separate src/data/domain-tiers.ts | Pure-data file. Extra file. | |
| Separate JSON file | Phase 37 leaf-module discipline forbids. Ruled out by prior decision. | |

**User's choice:** Inline in source-diversity leaf

---

## Re-Ranking Algorithm

### Q1 — Re-rank strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Strict bucket split — any unseen beats any seen (Recommended) | Two-pass partition; predictable; easy to test. | ✓ |
| Weighted score — penalize seen by 0.3× | Top-tier seen can still beat low-tier unseen. Magic multiplier. | |
| Hybrid — strict split, but seen top-tier stays in pool 1 | Compromise. More complex. | |

**User's choice:** Strict bucket split

### Q2 — Fallback semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Return highest-quality result anyway (Recommended) | "Best-of-the-bad" interpretation of ROADMAP "lowest-scored blocked domain". Prevents silent zero-posts-for-concept failure. | ✓ |
| Return original Tavily order untouched | Bypass leaf when nothing left. SEO farms could surface. | |
| Return empty array, caller skips concept this cycle | Strict; produces silent zero-posts failure ROADMAP forbids. | |

**User's choice:** Return highest-quality result anyway

### Q3 — Tie-break (initially deferred for clarification)

User's first response: "Can we present multiple sources at a post?" — was a clarifying meta-question, not a tie-break selection.

**Clarification provided:** `filterForDiversity` returns a re-ranked **array** (not single pick); the caller decides how many to take. Phase 41 will take `sources.slice(0, 3)` for multi-snippet essay grounding. Position 0 in the array becomes the post's primary source. Tie-break determines that position 0.

Re-asked:

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve Tavily's original ordering (Recommended) | Stable sort. Free-rides on Tavily's per-query relevance signal. V8 stable since 2018. | ✓ |
| Use Tavily's per-result `score` as explicit secondary key | Same outcome as #1 in practice; more explicit code. | |
| Random tie-break | Adds variety; non-deterministic; harder to test. | |

**User's choice:** Preserve Tavily's original ordering

### Q4 — Hard block

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fallback can return 0.0 results (Recommended) | Consistent with Q2. Better to show weak source than silently drop concept. | ✓ |
| No — 0.0 is hard floor; fallback returns [] | Caller skips concept this cycle. Silent zero-posts failure. | |
| Configurable via param | Extra surface area; YAGNI for v1.5. | |

**User's choice:** Yes — fallback can return 0.0 results

---

## Domain Normalization

### Q1 — Subdomain handling

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse all subdomains to registrable root (Recommended) | `science.nature.com` → `nature.com`. 3 Nature subdomains count as 1 source. Needs PSL data. | ✓ |
| Strip only `www.` and `m.` prefixes; keep other subdomains distinct | Zero PSL dependency. Subdomain duplicates read as different sources. | |
| Use raw URL.hostname verbatim | Trivially defeats diversity. | |

**User's choice:** Collapse to registrable root

### Q2 — Bad URL handling

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as quality 0 and exclude (Recommended) | Defensive; try/catch new URL. One bad URL never crashes refill cycle. | ✓ |
| Throw on bad URL — caller handles | Strict. Extra noise at call sites. | |
| Pass through with raw URL string | Defeats normalization. | |

**User's choice:** Treat as quality 0 and exclude

### Q3 — PSL strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-roll a tiny ~10-entry PSL slice (Recommended) | co.uk/co.jp/com.au/co.nz/org.uk/ac.uk/edu.au/gov.uk/co.kr/com.br. Zero new dependency. ~25 lines total. | ✓ |
| Bundle `tldts` library (~30KB) | Full PSL coverage. New runtime dependency; bundle bloat. | |
| Skip PSL entirely — always use last 2 segments | bbc.co.uk → co.uk (wrong). Don't. | |

**User's choice:** Hand-roll PSL slice

---

## API Shape + File Location

### Q1 — File location

| Option | Description | Selected |
|--------|-------------|----------|
| `app/src/services/source-diversity.service.ts` (Recommended) | Matches Phase 39 engagement.service.ts. Colocated with concept-feed/web-search/post-history services. | ✓ |
| `app/src/lib/source-diversity.ts` | Matches Phase 37 i18n-leaf.ts. Cross-folder import from concept-feed.service.ts. | |

**User's choice:** services/ folder

### Q2 — Export style

| Option | Description | Selected |
|--------|-------------|----------|
| Singleton object: `sourceDiversityService.{...}` (Recommended) | Matches engagementService, dailyReadService, postHistoryService, settingsService. One import line. | ✓ |
| Named exports: `export function filterForDiversity(...)`, etc. | Matches lib/i18n-leaf.ts. Tree-shakeable. Breaks `*Service` convention. | |

**User's choice:** Singleton object

### Q3 — API surface beyond ROADMAP-named 3

| Option | Description | Selected |
|--------|-------------|----------|
| Add `getUsedDomains(anchorId): Set<string>` reader (Recommended) | Phase 41's refillQueue needs to READ the per-anchor seen set. Without reader, caller can't access leaf-bookkept data. | ✓ |
| Just the 3 ROADMAP-named functions | Caller maintains usedDomains externally. Duplicates state. | |
| Add reader + per-anchor clear (`forgetAnchor`) | Speculative; YAGNI for v1.5. | |

**User's choice:** Add `getUsedDomains` reader

### Q4 — Helper export policy

| Option | Description | Selected |
|--------|-------------|----------|
| Export internal helpers explicitly for tests (Recommended) | extractDomain, normalizeHost, MULTI_SEGMENT_TLDS, DOMAIN_TIERS. Cleaner unit tests. | ✓ |
| Keep helpers module-private | Smaller public API. Harder to localize regressions. | |

**User's choice:** Export internal helpers

---

## Wrap-Up

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context (Recommended) | 15 captured decisions cover the leaf-module surface; nothing material left. | ✓ |
| Explore more gray areas | Possibilities listed: non-English source bias, recordServedDomain debounce, dedup duplicate URLs in single Tavily call. | |

**User's choice:** Ready for context

---

## Claude's Discretion (Areas Delegated)

- Exact ~200-entry tier list (specific domains and their scores) — Claude authors at planning/implementation time; operator override in PR.
- Exact ~10-entry MULTI_SEGMENT_TLDS slice initial coverage.
- Test file names: `source-diversity.service.test.mjs` + `source-diversity-anti-wire.test.mjs` (planner can collapse).
- Defensive vs trust-callers in `extractDomain` accepting non-string inputs (leaning defensive).
- `Set<string>` vs `ReadonlySet<string>` in `filterForDiversity` signature (cosmetic).

---

## Deferred Ideas

- Widening Tavily `maxResults` from 1 to ~5 → Phase 41
- Calling `recordServedDomain` after each post creation → Phase 41
- Triggering `reset()` on day boundary → Phase 41
- Multi-snippet essay grounding (`sources.slice(0, 3)`) → Phase 41 success criterion #4
- Citation rendering polish (sup/a/section ReactMarkdown overrides) → Phase 41 success criterion #5
- Cross-device source-history sync → out of v1.5 (no backend)
- User-overridable per-domain quality scores → speculative; future phase if signal warrants
- Engagement-signal-informed scoring → speculative; v1.6 candidate
- Non-English-language source bias → speculative; needs user opt-in; out of v1.5
- Replacing hand-rolled PSL with `tldts` → revisit if coverage proves inadequate
