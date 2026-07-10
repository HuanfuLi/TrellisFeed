---
phase: 23-incremental-mindmap-classification-with-kv-cache-and-ask-rate-limiter
plan: 01
subsystem: classification-pipeline
tags: [pipeline, kv-cache, llm, classification, incremental]
dependency_graph:
  requires: []
  provides: [classifyAndAnchorIncremental, parseStepResponse, buildStepPrompt, extractUniqueBranches, extractClustersUnderBranch, extractAnchorsUnderCluster, commitClassificationResult]
  affects: [canonical-knowledge.service.ts]
tech_stack:
  added: []
  patterns: [append-only-messages, short-circuit-on-new, retry-then-fallback, shared-commit-helper]
key_files:
  created:
    - app/tests/canonical-knowledge-pipeline.test.mjs
  modified:
    - app/src/services/canonical-knowledge.service.ts
decisions:
  - Extracted commitClassificationResult as shared helper for both classifyAndAnchor and classifyAndAnchorIncremental
  - PipelineMessage interface defined locally (ChatMessage not exported from llm/index.ts)
  - 0-based indexing throughout pipeline prompts and parsing
  - parseStepResponse rejects negative indices via regex lookahead
  - Outer try-catch in classifyAndAnchorIncremental falls back to classifyAndAnchor as last resort
metrics:
  duration: 341s
  completed: "2026-04-09T22:44:11Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 23 Plan 01: Incremental Classification Pipeline Summary

3-step branch->cluster->anchor LLM pipeline with append-only messages for KV cache hits, short-circuit on NEW, retry-then-fallback to legacy classifyAndAnchor

## Tasks Completed

### Task 1: Pipeline helper functions + unit tests (TDD)
- **Commit:** 5221a7ff
- Added PIPELINE_SYSTEM_PROMPT constant (stable string, no dynamic content)
- Added StepDecision interface
- Added parseStepResponse: JSON parsing, embedded JSON extraction, bare integer extraction with negative rejection
- Added buildStepPrompt: numbered candidate lists for branch/cluster/anchor levels, empty-list handling
- Added extractUniqueBranches, extractClustersUnderBranch, extractAnchorsUnderCluster
- 15 unit tests covering valid indices, NEW JSON, out-of-bounds, negatives, verbosity extraction, vague label exclusion

### Task 2: classifyAndAnchorIncremental function with retry-then-fallback
- **Commit:** 94c9b37e
- Extracted commitClassificationResult helper (164 lines of node-creation logic) shared by both classification paths
- Added runStepWithRetry: single retry on parse failure, throws on second failure
- Added classifyAndAnchorIncremental: 3-step sequential pipeline
  - Step 1: branch selection from extractUniqueBranches candidates
  - Step 2: cluster selection from extractClustersUnderBranch candidates
  - Step 3: anchor selection from extractAnchorsUnderCluster candidates
- Short-circuit on NEW at any step (D-06)
- Fallback to classifyAndAnchor on any step failure (D-09)
- No partial commits: all decisions collected before commitClassificationResult call (D-07)
- Append-only message array for KV cache optimization (D-04, D-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Negative index parsing**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** parseStepResponse("-1", 5) was extracting "1" via /\d+/ regex match
- **Fix:** Changed regex to /(?:^|[^-])\b(\d+)\b/ to reject digits preceded by minus sign
- **Files modified:** app/src/services/canonical-knowledge.service.ts
- **Commit:** 5221a7ff

**2. [Rule 3 - Blocking] node_modules missing in worktree**
- **Found during:** Task 1 test execution
- **Issue:** Worktree had no node_modules, causing import resolution failures
- **Fix:** Created symlink from worktree node_modules to main repo node_modules
- **Files modified:** None (symlink only)

## Verification

- All 15 pipeline helper tests pass (npx tsx --test)
- TypeScript compiles clean (npx tsc --noEmit)
- classifyAndAnchorIncremental is exported and callable
- classifyAndAnchor still exists as fallback
- commitClassificationResult called by both paths (lines 833, 908)

## Known Stubs

None. All functions are fully implemented with real logic.

## Self-Check: PASSED
