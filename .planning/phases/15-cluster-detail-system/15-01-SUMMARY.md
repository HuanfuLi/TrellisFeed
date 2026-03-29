---
phase: 15-cluster-detail-system
plan: 01
subsystem: canonical-knowledge-service
tags: [cluster-nodes, question-type, classification, knowledge-graph]
dependency_graph:
  requires: [14-04]
  provides: [cluster-entity-creation, cluster-node-id-linkage, cluster-qaccount-aggregate, projection-guard, reflection-tree-cluster-entity]
  affects: [canonical-knowledge.service.ts, types/index.ts, buildAnchorReflectionTree consumers]
tech_stack:
  added: []
  patterns: [question-entity-flag-pattern, clusterNodeId-linkage-pattern, cluster-aggregate-update]
key_files:
  created: []
  modified:
    - app/src/types/index.ts
    - app/src/services/canonical-knowledge.service.ts
decisions:
  - Cluster nodes stored as Question entities with isClusterNode=true (mirrors isAnchorNode pattern)
  - clusterNodeId added to anchor and Q&A nodes pointing to parent cluster entity ID
  - Cluster entity creation occurs before anchor creation in classifyAndAnchor
  - freshQuestions variable used after cluster creation so anchor resolution sees new cluster
  - Cluster qaCount aggregated from all child anchors (filter by clusterNodeId === clusterEntityId)
  - projectQuestionToKnowledgeNode returns null for isClusterNode entities
  - buildAnchorReflectionTree skips isClusterNode in both anchor and Q&A loops
  - clusterEntities map keyed by branchLabel::clusterLabel for O(1) lookup in return mapping
metrics:
  duration: ~15 minutes
  completed_date: 2026-03-29
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 15 Plan 01: Cluster Node Storage Foundation Summary

**One-liner:** Cluster entities stored as Question objects with isClusterNode flag, linked to anchors and Q&As via clusterNodeId, with aggregated qaCount and reflection tree integration.

## What Was Built

Added cluster node storage as Question entities and integrated cluster creation into the classifyAndAnchor pipeline. This establishes the data foundation for all downstream cluster features: cluster entities are stored in localStorage, linked to anchors and Q&As, with aggregated qaCount. buildAnchorReflectionTree now returns clusterEntity references so the mindmap and detail pages can use real cluster entity IDs.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Extend Question type with cluster fields | bbb0a846 | app/src/types/index.ts |
| 2 | Add cluster creation, aggregate update, projection guard, reflection tree extension | 1b96fcfd | app/src/services/canonical-knowledge.service.ts |

## Changes by File

### app/src/types/index.ts
- Added `isClusterNode?: boolean` to Question interface (after shortSummary)
- Added `clusterNodeId?: string` to Question interface (after isClusterNode)

### app/src/services/canonical-knowledge.service.ts
- **projectQuestionToKnowledgeNode**: Added guard `if (question.isClusterNode === true) return null` after the isAnchorNode guard — prevents cluster entities from leaking into review queues and CandidateContextPack
- **classifyAndAnchor**: Added `freshQuestions` local variable that starts as `allQuestions` and is refreshed after cluster creation
- **classifyAndAnchor**: Added cluster resolution block before anchor creation — looks up existing cluster by branchLabel+clusterLabel match, or creates new Question entity with isClusterNode=true
- **classifyAndAnchor**: Patches existing anchors (resolved by anchorId or by name) with clusterNodeId if missing
- **classifyAndAnchor**: New anchor creation includes `clusterNodeId: clusterEntityId`
- **classifyAndAnchor**: Q&A patch call includes `clusterNodeId: clusterEntityId`
- **classifyAndAnchor**: After anchor update, aggregates cluster qaCount from all child anchors where `isAnchorNode === true && clusterNodeId === clusterEntityId`
- **buildAnchorReflectionTree**: Return type extended with `clusterEntity: Question | undefined` per cluster group
- **buildAnchorReflectionTree**: Both initial loops now skip `isClusterNode === true` nodes
- **buildAnchorReflectionTree**: Builds `clusterEntities` Map keyed by `branchLabel::clusterLabel` and includes lookup in return mapping

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — no stub data or placeholder values introduced.

## Self-Check: PASSED

- `app/src/types/index.ts` — modified, isClusterNode and clusterNodeId fields present
- `app/src/services/canonical-knowledge.service.ts` — modified, all 5 change groups present
- Commits bbb0a846 and 1b96fcfd exist in git log
- TypeScript compilation: zero errors (`npx tsc --noEmit` in app/ directory — no output)
