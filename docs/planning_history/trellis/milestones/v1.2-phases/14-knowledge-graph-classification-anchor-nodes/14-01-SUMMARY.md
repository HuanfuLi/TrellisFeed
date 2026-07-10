---
phase: 14-knowledge-graph-classification-anchor-nodes
plan: 01
subsystem: api
tags: [typescript, llm, knowledge-graph, classification, anchor-nodes]

# Dependency graph
requires:
  - phase: 13-planner-redesign
    provides: Planner chunks as source of truth for learning actions
provides:
  - Updated Question type with isAnchorNode, qaCount, shortSummary fields
  - Stripped IngestionDecision type (outcome + targetNodeId only)
  - ClassificationResult interface for second classification call
  - decideIngestionOutcome returning only outcome+targetNodeId (no label fields)
  - First LLM call schema without knowledgeDecision, with shortSummary
  - Anchor nodes excluded from spaced repetition projection pipeline
affects:
  - 14-02 (second classification call — consumes ClassificationResult type)
  - 14-03 (mindmap anchor rendering — consumes isAnchorNode field)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-call split: first LLM call answers only (answer/summary/keywords/storyHook/shortSummary), second call classifies separately
    - Anchor node guard in projectQuestionToKnowledgeNode prevents anchors from entering review/flashcard/podcast pipelines
    - Label-free IngestionDecision: outcome routing done by score, labels come exclusively from second classification call

key-files:
  created: []
  modified:
    - app/src/types/index.ts
    - app/src/services/canonical-knowledge.service.ts
    - app/src/services/question.service.ts

key-decisions:
  - "IngestionDecision stripped to outcome+targetNodeId only — labels come from dedicated second call (Plan 02)"
  - "First LLM call schema now requests shortSummary (<=80 words) instead of knowledgeDecision"
  - "formatCandidateContextPack feedback loop removed from ask() system prompt — was source of vague branch names"
  - "Anchor nodes excluded from projectQuestionsToKnowledgeNodes via isAnchorNode===true guard"
  - "ClassificationResult interface exported with anchorName+anchorId for Plan 02 consumption"

patterns-established:
  - "Two-call separation: answer call (no classification) + classification call (no answer)"
  - "buildCanonicalQuestionPatch no longer writes label fields — labels applied separately after second call"

requirements-completed: [GRAPH-03, GRAPH-04, GRAPH-05]

# Metrics
duration: 15min
completed: 2026-03-29
---

# Phase 14 Plan 01: Type Foundation & Two-Call Split Summary

**Stripped classification from first LLM call, added anchor node type fields (isAnchorNode/qaCount/shortSummary), and removed the feedback loop that caused vague branch/cluster names**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-29T00:00:00Z
- **Completed:** 2026-03-29T00:15:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added `isAnchorNode`, `qaCount`, `shortSummary` to `Question` interface and new `ClassificationResult` type
- `IngestionDecision` stripped to `{ outcome, targetNodeId }` — all label fields removed
- `decideIngestionOutcome` now returns only outcome+targetNodeId; no label inheritance from candidates
- `buildCanonicalQuestionPatch` no longer writes label fields from decision
- `projectQuestionToKnowledgeNode` guards anchor nodes (returns null), excluding them from review/flashcard/podcast
- First LLM call: removed `knowledgeDecision` JSON schema block, removed `formatCandidateContextPack` feedback loop, added `shortSummary` field
- `buildAndSave` meta type: removed `knowledgeDecision`, added `shortSummary`; new question object no longer sets label fields from decision

## Task Commits

Each task was committed atomically:

1. **Task 1: Update types — add anchor fields to Question, strip IngestionDecision labels** - `b5696e00` (feat)
2. **Task 2: Strip labels from decideIngestionOutcome and buildCanonicalQuestionPatch** - `ba1f65c5` (feat)
3. **Task 3: Strip knowledgeDecision from first LLM call, add shortSummary, clean buildAndSave** - `c65fc7ff` (feat)

## Files Created/Modified
- `app/src/types/index.ts` - Added isAnchorNode/qaCount/shortSummary to Question; stripped IngestionDecision; added ClassificationResult
- `app/src/services/canonical-knowledge.service.ts` - Stripped label returns from decideIngestionOutcome; removed label writes from buildCanonicalQuestionPatch; added isAnchorNode guard in projectQuestionToKnowledgeNode
- `app/src/services/question.service.ts` - Removed knowledgeDecision from first LLM call; removed formatCandidateContextPack from system prompt; added shortSummary to parsed response; cleaned buildAndSave meta type and new question object

## Decisions Made
- Removed `candidatePack` variable from `ask()` entirely — it was only used to build the feedback loop prompt string (not for decideIngestionOutcome which builds its own pack internally)
- Used `_decision` parameter name in `buildCanonicalQuestionPatch` since decision is kept for potential future use but no fields are read from it currently
- `buildCanonicalQuestionPatch` still accepts `decision: IngestionDecision` parameter for API compatibility with callers, but only uses it for outcome routing (not labels)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Plan 02 can now implement the dedicated second classification call using `ClassificationResult` type
- `isAnchorNode` field is ready on `Question` for anchor node creation in Plan 02
- `shortSummary` is stored on Q&A nodes, ready for anchor `nodeSummary` append logic in Plan 02
- Questions saved after this plan have undefined label fields — Plan 02 will patch them after second call resolves

---
*Phase: 14-knowledge-graph-classification-anchor-nodes*
*Completed: 2026-03-29*
