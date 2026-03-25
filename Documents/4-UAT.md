# UAT: Planner & Learning Chunks

## Overview
Phase 4 replaces the Calendar surface with a hybrid Planner workspace centered on learning continuity through chunks, threads, and check-ins.

## Test Results

| Test Case | Description | Result | Notes |
|-----------|-------------|--------|-------|
| 1. Navigation | Bottom nav label 'Calendar' changed to 'Planner' | PASS | Route updated to /planner |
| 2. Hybrid Layout | Planner screen shows Sections: Check-In, Continue, Suggested, Threads | PASS | Layout matches design.md |
| 3. Learning Check-In | User can type freeform thoughts and get signals | PASS | submitCheckIn processes signals into threads/chunks |
| 4. Chunk Lifecycle | Chunks support Start, Save, Done, Delete actions | PASS | UI buttons correctly trigger service actions |
| 5. Home Integration | Home Bento shows active chunks and threads count | PASS | Counts are reactive via eventBus |
| 6. Feed Ranking | Home feed consumes check-in signals for relevance | PASS | Prompt includes plannerSignals |

## Identified Gaps & Regressions

### 1. Architectural Violations
- **Missing Jaccard Pre-filter:** `graph.service.ts` computes cosine similarity for all pairs without first checking keyword overlap, violating `semantic-connection-cards/design.md`.

### 2. Implementation Bugs
- **Silent Embedding Failures:** Errors in `embedText` are swallowed silently in `question.service.ts`, leading to invisible feature degradation.
- **ESM Module Resolution:** extensionless imports in services break the test suite in Node environment.

### 3. Linting/Cleanup Errors
- Unused variables in `concept-feed.service.ts` (`_generatedAt`, `_origin`).
- Unused import in `question.service.ts` (`addDays`).
- Invalid ESLint comment in `PostDetailScreen.tsx`.
- Unexpected `any` type in `vite-env.d.ts`.
- Legacy `planner.mock.ts` still exists with overlapping logic.

## Diagnosis
The implementation of the Planner feature itself is functionally correct and feature-complete according to `tasks.md`. However, it inherited or introduced several architectural and technical debt issues in the surrounding services (`graph`, `question`, `concept-feed`).

## Fix Plan
1. Fix ESM module resolution by adding `.ts` extensions to imports in all services.
2. Implement Jaccard pre-filter in `graph.service.ts`.
3. Add basic error logging/toast for embedding failures in `question.service.ts`.
4. Clean up unused imports/variables and fix lint errors.
5. Remove `planner.mock.ts` and ensure all references are gone.
