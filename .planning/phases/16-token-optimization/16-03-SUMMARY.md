---
phase: 16-token-optimization
plan: 03
subsystem: monitoring
tags: [token-usage, llm, settings, analytics, react, typescript]

# Dependency graph
requires:
  - phase: 16-token-optimization/16-02
    provides: tokenUsageReporter singleton and ServiceAggregate interface for per-service recording
provides:
  - All 15 LLM call sites tagged with serviceName labels for per-service tracking
  - Token Usage section in Settings > Developer with per-service table, totals row, Refresh and Clear buttons
affects: [16-token-optimization, settings-screen, all-llm-services]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "serviceName: 'xxx' options passed to chatCompletion/chatStream for usage attribution"
    - "tokenUsageReporter.getByService() called at component init via useState lazy initializer"

key-files:
  created: []
  modified:
    - app/src/state/useQuestions.ts
    - app/src/services/question.service.ts
    - app/src/services/question-filter.service.ts
    - app/src/services/canonical-knowledge.service.ts
    - app/src/services/concept-feed.service.ts
    - app/src/services/planner.service.ts
    - app/src/services/podcast.service.ts
    - app/src/services/flashcard.service.ts
    - app/src/services/post-context-qa.service.ts
    - app/src/screens/AskScreen.tsx
    - app/src/screens/SettingsScreen.tsx

key-decisions:
  - "serviceName tags: ask (useQuestions chatStream, question.service chatCompletion, post-context-qa chatStream), filter (question-filter), classification (canonical-knowledge x2, preserving maxTokens:8192), posts (concept-feed x4), planner (planner.service x2), podcast (podcast.service), flashcards (flashcard.service), title (AskScreen generateSessionTitle)"
  - "Token Usage section uses useState lazy initializer so data loads once at mount; Refresh button explicit re-pull pattern"
  - "tokenUsageReporter.clear() sets local state to {} immediately for instant UI feedback without re-reading localStorage"

patterns-established:
  - "Pass { serviceName: 'xxx' } as options to chatCompletion/chatStream — merge with existing options objects rather than replace"
  - "Token usage UI: useState lazy init + explicit Refresh button pattern (no useEffect polling)"

requirements-completed: [D-06, D-07]

# Metrics
duration: 20min
completed: 2026-04-02
---

# Phase 16 Plan 03: Token Usage Call-Site Tagging & Settings UI Summary

**15 LLM call sites tagged with serviceName labels across 10 files, plus per-service token usage breakdown table in Settings > Developer with Refresh and Clear buttons**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-02T22:10:00Z
- **Completed:** 2026-04-02T22:20:21Z
- **Tasks:** 2 of 2
- **Files modified:** 11

## Accomplishments

- Tagged all 15 LLM call sites with serviceName: ask (x3), filter (x1), classification (x2), posts (x4), planner (x2), podcast (x1), flashcards (x1), title (x1)
- Preserved all existing maxTokens values per D-06 (notably maxTokens: 8192 on canonical-knowledge reorganization call)
- Added Token Usage section to SettingsScreen.tsx with full per-service breakdown table (Service/Prompt/Completion/Total/Calls columns), sorted by totalTokens descending, with aggregation Totals row
- Added Refresh and Clear buttons wired to tokenUsageReporter

## Task Commits

1. **Task 1: Tag all LLM call sites with serviceName** - `269c4156` (feat)
2. **Task 2: Add Token Usage section to Settings > Developer** - `741808a0` (feat)

## Files Created/Modified

- `app/src/state/useQuestions.ts` - chatStream tagged serviceName: 'ask'
- `app/src/services/question.service.ts` - chatCompletion tagged serviceName: 'ask'
- `app/src/services/question-filter.service.ts` - chatCompletion tagged serviceName: 'filter'
- `app/src/services/canonical-knowledge.service.ts` - classifyAndAnchor call tagged 'classification', reorganization tagged 'classification' with maxTokens:8192 preserved
- `app/src/services/concept-feed.service.ts` - 4 calls (2x chatCompletion, 2x chatStream) tagged serviceName: 'posts'
- `app/src/services/planner.service.ts` - 2x chatCompletion tagged serviceName: 'planner'
- `app/src/services/podcast.service.ts` - chatCompletion tagged serviceName: 'podcast'
- `app/src/services/flashcard.service.ts` - chatCompletion tagged serviceName: 'flashcards'
- `app/src/services/post-context-qa.service.ts` - chatStream tagged serviceName: 'ask'
- `app/src/screens/AskScreen.tsx` - generateSessionTitle chatCompletion tagged serviceName: 'title'
- `app/src/screens/SettingsScreen.tsx` - Added Token Usage section with table, Refresh/Clear buttons, tokenUsage state, and handlers

## Decisions Made

- serviceName tags chosen per semantic function: 'ask' for all user-facing Q&A streaming/completion paths (3 sites), 'classification' for both canonical knowledge calls, 'posts' for all feed generation calls, 'planner'/'podcast'/'flashcards'/'filter'/'title' for their respective services
- Token Usage state initialized via useState lazy initializer (not useEffect) — loads once at mount, explicit Refresh button for re-pull pattern
- handleClearTokenUsage sets local state to `{}` immediately after tokenUsageReporter.clear() for instant UI feedback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - all data flows are wired. tokenUsageReporter.getByService() returns live localStorage data.

## Next Phase Readiness

- Token usage monitoring pipeline is complete: infrastructure (Plan 02) + call-site tagging (Plan 03) + UI visualization (Plan 03)
- Phase 16 objectives for D-06 and D-07 fulfilled
- No blockers

---
*Phase: 16-token-optimization*
*Completed: 2026-04-02*
