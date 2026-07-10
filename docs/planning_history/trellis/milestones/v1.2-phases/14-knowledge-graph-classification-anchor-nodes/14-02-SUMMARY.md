---
phase: 14-knowledge-graph-classification-anchor-nodes
plan: 02
subsystem: api
tags: [typescript, llm, knowledge-graph, classification, anchor-nodes, second-call]

# Dependency graph
requires:
  - phase: 14-01
    provides: ClassificationResult type, isAnchorNode/qaCount/shortSummary on Question, two-call split schema
provides:
  - classifyAndAnchor function wired into ask() flow
  - buildTreeContext helper for second call prompt
  - Anchor node creation with isAnchorNode=true and clean concept names
  - Q&A nodes attached to anchors via parentId with nodeSummary append-only log
  - qaCount increment on anchor for each Q&A attachment
affects:
  - 14-03 (mindmap rendering — anchors now exist with isAnchorNode=true, Q&As have parentId)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Second LLM call fires fire-and-forget after filterQuestion confirms flagged !== true
    - Tree context passed to second call (branches + clusters + existing anchors) — no candidate feedback loop
    - Lazy import of questionService inside classifyAndAnchor to avoid circular dependency
    - Anchor creation writes directly to localStorage (same echolearn_questions key) as a pragmatic approach
    - Keyword fallback on JSON parse failure or network error

key-files:
  created: []
  modified:
    - app/src/services/canonical-knowledge.service.ts
    - app/src/services/question.service.ts

key-decisions:
  - "buildTreeContext uses buildReflectionTree output (already filters anchors via isAnchorNode guard) so tree context shows only Q&A nodes; anchors listed separately per cluster"
  - "classifyAndAnchor lazy-imports questionService via dynamic import() to prevent circular module dependency"
  - "Anchor creation writes directly to localStorage rather than through questionService.buildAndSave (avoiding re-entrant ask() logic)"
  - "classifyAndAnchor call uses loadStore() at call time (not the stale freshStore variable) for most current snapshot"
  - "Fire-and-forget pattern preserves ask() response latency — labels applied asynchronously after Q&A is returned to user"

patterns-established:
  - "Second classification call: isolated from candidate scoring feedback loop, receives only tree structure"
  - "Anchor-first creation: check by anchorId → check by name+cluster → create new"

requirements-completed: [GRAPH-01, GRAPH-02, GRAPH-04, GRAPH-05]

# Metrics
duration: 10min
completed: 2026-03-29
---

# Phase 14 Plan 02: Second Classification Call & Anchor Creation Summary

**Second LLM classification call implemented: creates concept anchor nodes with isAnchorNode=true, attaches Q&As via parentId, appends shortSummary to anchor nodeSummary, and increments qaCount — all fire-and-forget after filterQuestion confirms Q&A is eligible for the mindmap**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-29T19:10:00Z
- **Completed:** 2026-03-29T19:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `buildTreeContext` helper extracts current branch/cluster/anchor tree into a prompt-ready string for the second call
- `classifyAndAnchor` async function: second LLM call with system prompt containing branchLabel/clusterLabel/anchorName instructions and NO "Likely branches" feedback loop
- Anchor node resolution: by anchorId (verified) → by name+cluster match → create new with isAnchorNode=true
- New anchor saved directly to localStorage (echolearn_questions key) to avoid circular module dependency
- Q&A patched with rootLabel/branchLabel/clusterLabel/placementReason/parentId after second call resolves
- Anchor updated: qaCount incremented, nodeSummary appended with [qa-id] shortSummary entry
- Graceful fallback on network failure or JSON parse error (keyword-derived labels at display time)
- `classifyAndAnchor` imported into question.service.ts and wired after `persistToSQLite(flagged)` block
- Gate: second call only fires when `flagged.flagged !== true`
- TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create classifyAndAnchor function with second LLM call and anchor creation logic** - `9cba90a6` (feat)
2. **Task 2: Wire classifyAndAnchor into ask() flow after filterQuestion gate** - `1a413fb6` (feat)

## Files Created/Modified
- `app/src/services/canonical-knowledge.service.ts` - Added buildTreeContext helper and classifyAndAnchor async function (+187 lines)
- `app/src/services/question.service.ts` - Added classifyAndAnchor import and fire-and-forget call in ask() (+11 lines)

## Decisions Made
- Used dynamic `import('./question.service.ts')` inside `classifyAndAnchor` to avoid circular dependency (canonical-knowledge is imported by question.service, so a static import in canonical-knowledge of question.service would create a cycle)
- Anchor localStorage write uses the same `ANCHOR_STORAGE_KEY = 'echolearn_questions'` constant to match questionService's storage key
- `loadStore()` called fresh at classifyAndAnchor invocation time (not `freshStore` from the enclosing ask() scope) to ensure the most current snapshot is passed
- `buildTreeContext` anchors are listed separately per cluster (not mixed into the branch/cluster line) to clearly distinguish concept anchors from topic groupings in the prompt

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Self-Check

Files exist:
- `app/src/services/canonical-knowledge.service.ts` - FOUND (modified)
- `app/src/services/question.service.ts` - FOUND (modified)

Commits exist:
- `9cba90a6` - Task 1 commit - FOUND
- `1a413fb6` - Task 2 commit - FOUND

TypeScript: zero errors confirmed.

## Self-Check: PASSED

## Next Phase Readiness
- Plan 03 (mindmap rendering) can now consume `isAnchorNode=true` anchors and `parentId` on Q&A nodes
- `buildMindElixirData` in GraphScreen.tsx should filter out Q&A nodes with `parentId` pointing to an anchor (show anchors as leaf nodes instead)
- Legacy Q&A nodes (no anchor, no parentId) continue to render as-is until a migration pass (Phase 15+)

---
*Phase: 14-knowledge-graph-classification-anchor-nodes*
*Completed: 2026-03-29*
