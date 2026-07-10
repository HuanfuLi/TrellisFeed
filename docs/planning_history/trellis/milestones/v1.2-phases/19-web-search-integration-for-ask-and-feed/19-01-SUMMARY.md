---
phase: 19-web-search-integration-for-ask-and-feed
plan: 01
subsystem: services
tags: [tavily, web-search, citations, capacitor-http]

requires: []
provides:
  - "Tavily API wrapper (webSearch function) with CapacitorHttp/fetch branching"
  - "Citation extraction utility (extractCitations) for parsing numbered source references"
  - "Extended types: WebSearchResult, WebSearchResponse, SourceCitation"
  - "News post types: 'news' PresentationStyle, 'news' sourceType, newsMeta on DailyPost"
  - "AppSettings.webSearch.tavilyApiKey configuration"
affects: [19-02, 19-03, 19-04]

tech-stack:
  added: [tavily-api]
  patterns: [capacitor-http-fetch-branching, citation-extraction-regex, test-module-mocking-loader]

key-files:
  created:
    - app/src/services/web-search.service.ts
    - app/tests/services/web-search.test.mjs
    - app/tests/services/_capacitor-mock-hooks.mjs
    - app/tests/services/_capacitor-mock-loader.mjs
    - app/tests/services/_capacitor-mock.mjs
  modified:
    - app/src/types/index.ts
    - app/src/services/settings.service.ts

key-decisions:
  - "Tavily API chosen as web search provider (per D-05 in CONTEXT.md)"
  - "CapacitorHttp on native, fetch on web (matching llm/index.ts localPost pattern)"
  - "Custom Node.js module loader for Capacitor mock in tests (tsx + register hooks)"
  - "Citation regex parses markdown link format [N] [Title](URL) from Sources/References sections"

patterns-established:
  - "Capacitor mock loader: reusable _capacitor-mock-loader.mjs + _capacitor-mock-hooks.mjs for any test needing @capacitor/core"
  - "NOT_CONFIGURED error pattern: return early with retryable:false when API key missing"

requirements-completed: [WEB-04]

duration: 6min
completed: 2026-04-05
---

# Phase 19 Plan 01: Web Search Service Foundation Summary

**Tavily API wrapper with CapacitorHttp/fetch branching, citation extraction regex parser, and extended types for news posts**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T04:29:34Z
- **Completed:** 2026-04-05T04:35:56Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 7

## Accomplishments
- Created web-search.service.ts with Tavily API integration supporting general and news search modes
- Implemented extractCitations pure function that parses numbered markdown link references from LLM output
- Extended types/index.ts with WebSearchResult, WebSearchResponse, SourceCitation interfaces and 'news' variants
- Added webSearch configuration (tavilyApiKey) to AppSettings and settings.service.ts defaults
- Built reusable Capacitor mock loader infrastructure for Node.js test environment

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests** - `c3f48bed` (test)
2. **Task 1 (GREEN): Implement service, types, settings** - `63c408f3` (feat)

## Files Created/Modified
- `app/src/services/web-search.service.ts` - Tavily API wrapper with webSearch() and extractCitations()
- `app/src/types/index.ts` - WebSearchResult, WebSearchResponse, SourceCitation, news types, newsMeta, webSearch settings
- `app/src/services/settings.service.ts` - Default webSearch.tavilyApiKey config
- `app/tests/services/web-search.test.mjs` - 8 tests: 6 citation extraction + 2 NOT_CONFIGURED guard
- `app/tests/services/_capacitor-mock-loader.mjs` - Node.js module register entry point
- `app/tests/services/_capacitor-mock-hooks.mjs` - Resolution hooks redirecting @capacitor/core
- `app/tests/services/_capacitor-mock.mjs` - Mock Capacitor and CapacitorHttp exports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node.js test runner cannot import TypeScript with @capacitor/core**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Node.js `--experimental-strip-types` cannot resolve @capacitor/core or extensionless .ts imports
- **Fix:** Created custom module loader infrastructure using `node:module` register API + tsx runner
- **Files created:** _capacitor-mock-loader.mjs, _capacitor-mock-hooks.mjs, _capacitor-mock.mjs
- **Commit:** 63c408f3

## Known Stubs

None - all functionality is fully wired.

## Self-Check: PASSED
