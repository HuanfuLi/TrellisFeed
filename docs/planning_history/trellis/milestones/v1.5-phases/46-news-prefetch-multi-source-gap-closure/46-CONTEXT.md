---
phase: 46
slug: news-prefetch-multi-source-gap-closure
type: milestone-gap-closure
source_audit: .planning/v1.5-MILESTONE-AUDIT.md
requirements:
  - CONTENT-03
created: 2026-05-13
---

# Phase 46 Context: News Prefetch Multi-Source Gap Closure

## Audit Gap

The v1.5 milestone audit found `CONTENT-03` only partially satisfied.

Direct news generation stores `filtered.slice(0, 3)` and `generateNewsEssay()` consumes `sources.slice(0, 3)`, but the active `refillQueue` prefetch path stores only the single chosen Tavily result in `preFetched.news`. Normal queued news posts therefore can still produce `newsMeta.sources` with one source.

## Required Closure

- Make `PreFetchCache.news` carry the filtered top 2-3 Tavily results for each concept.
- Preserve stable source indexing when cached sources become `newsMeta.sources`.
- Keep the direct no-prefetch news generation path behavior unchanged.
- Add a regression test proving queued-news prefetch preserves multiple sources into `newsMeta.sources`.

## Out of Scope

- Changing Tavily ranking or domain scoring.
- Changing `generateNewsEssay()` prompt wording beyond what is necessary to preserve the existing multi-snippet contract.
- Broad refactors of `concept-feed.service.ts`.

