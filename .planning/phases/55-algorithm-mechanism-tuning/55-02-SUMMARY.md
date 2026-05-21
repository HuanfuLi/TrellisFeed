---
phase: 55-algorithm-mechanism-tuning
plan: 02
subsystem: infra
tags: [embedding, cache, cosine, question-filter, classification-dedup, react]

# Dependency graph
requires:
  - phase: 55-01
    provides: embed-cache.test.mjs scaffold (Wave-0), guarded RED until exports land
provides:
  - In-memory, session-lived embedding cache in providers/embedding/index.ts (clearEmbedCache + getCachedEmbedding)
  - Single-embed-per-ask pipeline hand-off across filter rawVec, retrieval queryEmbedding, and classify pre-check
  - Cache invalidation on embedding provider/model change in SettingsAIScreen
affects: [55-03, threshold-tuning, question-filter, canonical-knowledge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-closure Map cache keyed on djb2(provider:model:text), wrapping the provider dispatch as a private _embedTextUncached"
    - "Provider+model in the cache key (Pitfall 5) so a model change cannot return a stale-dimensionality vector"

key-files:
  created:
    - .planning/phases/55-algorithm-mechanism-tuning/55-02-SUMMARY.md
  modified:
    - app/src/providers/embedding/index.ts
    - app/src/services/canonical-knowledge.service.ts
    - app/src/screens/settings/SettingsAIScreen.tsx

key-decisions:
  - "Dropped .trim() in canonical-knowledge preCheckAnchorMatch so the classify query embed shares the bare-content cache key with filter rawVec + retrieval embed (question.content === raw content, untrimmed at store time)"
  - "clearEmbedCache fires only when provider OR model changed in saveEmbedding — not on unrelated embedding-config saves (apiKey, baseUrl, dimensions)"

patterns-established:
  - "Session-lived embed cache: filter runs first in askStreaming, so retrieval + classify pre-check become cache hits for the same bare content"
  - "Model-change cache invalidation guarded by prev-vs-next provider/model comparison"

requirements-completed: [TUNE-01]

# Metrics
duration: 12min
completed: 2026-05-21
---

# Phase 55 Plan 02: Embedding Query Cache + Pipeline Hand-off Summary

**In-memory session embed cache (djb2 provider:model:text key) that embeds the bare current-question content at most once per ask across filter, retrieval, and classify pre-check, with model-change invalidation.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-21
- **Completed:** 2026-05-21
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added a session-lived `Map<string, number[]>` cache to `embedText`, keyed on `djb2(provider:model:text)`; renamed the existing provider switch to a private `_embedTextUncached` and wrapped it.
- Exported `clearEmbedCache()` and `getCachedEmbedding(text, config)`; preserved the `cosine` export and the verbatim FILTER-03 / D-13 bracketing-exemption comment (lines 1-11).
- Unified the three bare-content embed sites onto one cache key so a single ask embeds the current question once (D-07): filter `rawVec` (runs first) → retrieval `queryEmbedding` → classify `preCheckAnchorMatch` are now cache hits.
- Wired `clearEmbedCache()` into `SettingsAIScreen.saveEmbedding`, guarded by a provider/model change comparison (D-08 / Pitfall 5).
- `embed-cache.test.mjs` (55-01 scaffold) turned green — all 4 assertions pass; the guarded-skip wrapper now runs the real cache tests.

## Task Commits

1. **Task 1: Add in-memory embed cache + invalidation API** - `016b7582` (feat) [tdd: scaffold was authored RED in 55-01; this is the GREEN implementation turning it green]
2. **Task 2: Wire pipeline hand-off + model-change invalidation** - `1f836db5` (feat)

## Files Created/Modified
- `app/src/providers/embedding/index.ts` - Added `_embedCache` Map, `_djb2CacheKey`, `clearEmbedCache`, `getCachedEmbedding`, private `_embedTextUncached`; `embedText` now checks cache → dispatches on miss → stores. FILTER-03 comment and `cosine` preserved.
- `app/src/services/canonical-knowledge.service.ts` - `preCheckAnchorMatch` embeds bare `question.content` (dropped `.trim()`) so its query vector shares the cache key with filter/retrieval.
- `app/src/screens/settings/SettingsAIScreen.tsx` - Imported `clearEmbedCache`; `saveEmbedding` calls it only when `prev.provider !== current.provider || prev.model !== current.model`.

## Decisions Made
- **Bare-content alignment via `.trim()` removal at the classify site.** The filter (`question-filter.service.ts:173`) and retrieval (`question.service.ts:253`) already embed the raw `content` string with no priorAnswer prefix. The classify pre-check previously embedded `question.content.trim()`. Since `buildAndSave` stores `content` untrimmed (`question.content === content`), dropping `.trim()` makes all three embed an identical string → shared djb2 key. The dual-vector `contextVec` (priorAnswer-prefixed) path was left untouched.
- **Invalidation scoped to provider/model only.** `saveEmbedding` is also invoked on apiKey/baseUrl/dimensions edits; clearing the cache on those is unnecessary and wasteful, so the call is guarded by a provider/model equality check against the previously-saved config.

## Deviations from Plan

None - plan executed exactly as written. Task 2's action explicitly anticipated confirming/adjusting the bare-content sites; the only adjustment was the documented `.trim()` removal at the classify site to genuinely share the cache key.

## Issues Encountered
- `app/node_modules` was absent in the fresh worktree. Per the parallel-execution note, symlinked `app/node_modules` → `/Users/Code/EchoLearn/app/node_modules` (environment fix restoring the identical dependency tree; not a package install, not committed — node_modules is gitignored).

## Verification
- `node --test tests/providers/embed-cache.test.mjs` → 4 pass, 0 fail, 0 skipped.
- `node --test tests/services/filter-classifier.unit.test.mjs` → 25 pass, 0 fail (dual-vector buried-payload defense not regressed; Test 18a/18d intact).
- `./node_modules/.bin/tsc -b --noEmit` → clean.
- Source-grep invariants: cache key includes `${config.provider}:${config.model}`; `clearEmbedCache`/`getCachedEmbedding`/`cosine` exported; FILTER-03 comment present (1 match); `clearEmbedCache` referenced in SettingsAIScreen save path.

## Threat Model Compliance
- T-55-02a (stale-dimensionality vector): mitigated — key includes provider+model; model change clears the cache.
- T-55-02b (filter malicious path via cache): mitigated — bare-content embed never carries a priorAnswer prefix; dual-vector contextVec path untouched, filter test green.
- T-55-02c (session Map disclosure): accepted per D-08 — in-memory, session-lived, no persistent string cache added.

## Next Phase Readiness
- Embedding now deterministic and single-embed-per-ask, making 55-03 threshold tuning cheap and reproducible.
- No blockers.

---
*Phase: 55-algorithm-mechanism-tuning*
*Completed: 2026-05-21*
