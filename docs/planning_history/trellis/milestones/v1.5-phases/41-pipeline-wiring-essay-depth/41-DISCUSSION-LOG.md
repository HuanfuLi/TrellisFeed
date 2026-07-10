# Phase 41: Pipeline Wiring + Essay Depth — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 41-pipeline-wiring-essay-depth
**Areas discussed:** Plan grouping, Tavily maxResults widening, Deep-dive caching strategy, Citation prompting + rendering shape

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Plan grouping | How to split Phase 41's work — single plan with 7-9 atomic commits, or 2-3 plans by file-touch surface to enable parallel execution. | ✓ |
| Tavily maxResults widening | How many results to ask Tavily for in the news branch — current is 1 (filterForDiversity is meaningless), needs ≥2 to actually rerank. Options: 3 / 5 / 10. | ✓ |
| Deep-dive caching strategy | When user requests deep, do we re-stream every time, replace the cached standard body with deep, or store both standard + deep separately? | ✓ |
| Citation prompting + rendering shape | How does the LLM signal footnote markers in essay output? Markdown footnote syntax `[^1]` requires the prompt to instruct it explicitly + remark-gfm in the rehype chain. | ✓ |

**User's choice:** All four areas
**Notes:** Operator selected the multi-select recommendation — wanted to surface every gray area before letting Claude's discretion handle the secondary mechanics. Rejected the "I'm ready for context" early-exit option from the discuss-areas summary.

---

## Plan Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Two plans, parallel-safe (Recommended) | 41-01 (refillQueue wiring + web-search options) and 41-02 (essay-depth + grounding + meta cap + abort audit + citation rendering). Independent file surfaces; can execute in parallel. Each plan ~5-7 atomic commits. | ✓ |
| Single plan | All 7 success criteria in one plan, 12-15 atomic commits, fully sequential. Matches Phase 39's actual cadence. Simpler metadata; no parallel speedup; bigger blast radius if one task fails. | |
| Four plans (one per file) | 41-01 concept-feed wiring, 41-02 web-search options, 41-03 post-essay depth+grounding, 41-04 PostDetailScreen rendering+abort. Smallest blast radius; most metadata overhead; awkward dependency chain. | |

**User's choice:** Two plans, parallel-safe
**Notes:** Maps cleanly to Phase 39's "1 plan per coupled subsystem" lesson at Phase 41 scale. The two plans touch disjoint file sets; can execute in one wave with two executors.

---

## Tavily maxResults Widening

| Option | Description | Selected |
|--------|-------------|----------|
| 5 (Recommended) | Matches webSearch's default at line 43 (`max_results: options?.maxResults ?? 5`). Gives filterForDiversity 5 candidates to rerank. sources.slice(0, 3) caps the LLM token impact regardless. Standard Tavily basic-search response size. | |
| 3 | Conservative — minimum to make rerank meaningful (need ≥2 for unseen-vs-seen split). Smaller LLM token surface per call. Fewer fallback options if filterForDiversity returns empty. | ✓ |
| 10 | Maximum headroom — lots of fallback options when many domains are already-seen. Risks double-counting Tavily basic-search's typical degradation past ~5. Larger sources array passed to filterForDiversity. | |

**User's choice:** 3
**Notes:** Operator chose conservative over recommended. Matches `sources.slice(0, 3)` invariant — every fetched result is consumed by the LLM, no token waste. Easy bump to 5 in a single-line edit if rerank quality proves weak.

---

## Deep-Dive Caching Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel cache (Recommended) | EssayContent gains a parallel `bodyMarkdownDeep?: string` field. Standard body stays in `bodyMarkdown`; deep body in `bodyMarkdownDeep`. User can toggle without re-streaming. Each variant generated at most once per post. Costs storage but pays each LLM call only once. | ✓ |
| Replace standard with deep | Once user goes deep, `bodyMarkdown` is overwritten with the deep variant. One-way ratchet. Saves storage; matches single-cache-key invariant; loses ability to show standard again without re-streaming. Phase 43 button becomes a one-shot 'expand' rather than a toggle. | |
| No caching for deep — always re-stream | Deep variant generated fresh on every request. Standard cache unchanged. Simplest schema (no new fields). Costs an LLM call per Deep dive press. Acceptable if deep dives are rare; expensive if users press repeatedly. | |
| Cache-key extends with depth | Cache key becomes `postId:depth`; two parallel cache entries. Cleaner separation than parallel field but heavier cache plumbing change. | |

**User's choice:** Parallel cache
**Notes:** Schema additive (back-compat — old cached essays stay valid; new field is optional). Phase 43's toggle button can swap views without re-streaming. Token cost paid once per variant.

---

## Citation Prompting + Rendering Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt the LLM to emit `[^N]` markers + auto-generated footnote section (Recommended) | Update generateNewsEssay's system prompt to instruct: 'Cite each source claim with `[^1]`, `[^2]`, `[^3]` markers; emit a footnotes section `[^1]: <title>` at end.' remark-gfm parses these into `<sup>` + `<section className="footnotes">`. ReactMarkdown component overrides style them. | ✓ |
| Inline `<sup data-cite='1'>1</sup>` HTML in essay body | Existing pattern at app/src/components/ChatMessage.tsx (`styleCitationTags`). LLM emits raw HTML; rehype-raw passes it through. Markdown override only handles the inline marker; no separate footnote section. | |
| Prompt-based emission BUT also support inline `<sup>` for backward compat | Both render paths work. Defensive but more test surface area. Useful if existing posts in localStorage have the old citation shape. | |

**User's choice:** Prompt the LLM to emit `[^N]` markers + auto-generated footnote section
**Notes:** remark-gfm is already in the plugin chain at `Markdown.tsx:36`; `<sup>` is already in the sanitize allowlist at `:14`. Phase 41 only needs (a) prompt instruction, (b) ReactMarkdown `components` prop. No raw HTML emission, preserves the sanitize boundary. Citation prompt + rendering MUST land together in Plan 41-02.

---

## Wrap-Up

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context (Recommended) | Lock the 4 captured decisions + Phase 41 boundary list and write CONTEXT.md. Claude's discretion handles secondary mechanics during planning/research. | ✓ |
| Discuss the word-count assertion strategy for SC-3 | How to test that depth: 'deep' actually produces 350-600w — mock LLM + count, or source-reading the prompt + trust LLM behavior, or both. | |
| Discuss the abort-signal API shape | Whether generateConnectionPost / generateDiscoverPost accept positional `signal` arg vs an options bag. | |
| Explore something else | Free text. | |

**User's choice:** I'm ready for context

---

## Claude's Discretion (Areas Delegated)

- Multi-snippet separator format (`'\n\n'` vs `'\n---\n'` etc.) — Claude preserves existing `post-essay.service.ts:139-144` shape, iterating over up to 3 sources.
- Word-count assertion strategy for SC-3 — recommended at planning stage: source-reading on the prompt + behavioral mock for plumbing chooses.
- Abort-signal API shape on `generateConnectionPost` / `generateDiscoverPost` — recommended at planning stage: trailing `options?: { signal?: AbortSignal }` parameter (mirrors `generatePostEssay`).
- Test file naming (`tests/services/concept-feed-source-diversity-wiring.test.mjs`, `tests/services/post-essay-depth.test.mjs`, `tests/screens/PostDetailScreen-abort-threading.test.mjs`, `tests/components/Markdown-citation-overrides.test.mjs`) — planner can collapse if preferred.
- Whether `sourceDiversityService.reset()` regression test in Plan 41-01 is implemented as integration test or unit test.
- Whether the Tavily `exclude_domains` payload field is conditional (`if length > 0`) or always set (Tavily ignores empty arrays gracefully).

---

## Deferred Ideas

### Out of Phase 41 scope (Phase 43 owns)

- Deep dive button UI in PostDetailScreen
- Long-press contextual menu (Like / Save / Not interested)
- Saved-posts view route/screen
- `engagementService.reset()` in Force-New-Day handler
- "N connections in your graph" micro-label
- HomeScreen ANCHOR_DISMISSED re-sync effect

### Out of Phase 41 scope (Phase 42 owns)

- Pinterest-style masonry layout (MASONRY-01)
- Vine-bloom celebration card (MASONRY-02)

### Outside v1.5 entirely

- Mid-stream cancel of in-flight standard essay when user requests deep (Phase 43 button concern)
- Per-post deep-variant analytics / token cost tracking
- UI surfacing of source-diversity scores ("verified peer-reviewed source" badge)
- Server-side citation lookup (hover footnote → fetch source paragraph)
- Citation accuracy validation (LLM hallucinated `[^1]` markers)
- Multi-language footnote prompts
