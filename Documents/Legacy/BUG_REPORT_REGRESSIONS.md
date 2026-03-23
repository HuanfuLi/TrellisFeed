# Comprehensive Bug Report: EchoLearn Regression & Spec Audit (March 23, 2026)

## 1. Persistence & Data Integrity

### [FIXED IN CURRENT DIRTY STATE] Planner Data Missing SQLite Write-Through
*   **Location:** `app/src/services/db.service.ts`
*   **Status:** The current uncommitted changes successfully added `planner_chunks`, `planner_threads`, and `planner_checkins` to the SQLite migration DDL. This critical regression from the base branch is resolved in the workspace but needs to be committed.

### [HIGH] Broken Semantic Fallback in Candidate Generation
*   **Location:** `app/src/services/graph.service.ts` -> `getSemanticCandidates()`
*   **Symptom:** If questions have embeddings but no pairs meet the `threshold`, the function returns an empty array `[]` instead of falling back to keyword Jaccard pairs.
*   **Spec Violation:** The `semantic-connection-cards` spec requires a fallback to Jaccard when vectors are absent **or** similarity is below the threshold.
*   **Impact:** Users see an empty "Info Flow" connection card section if their embeddings don't perfectly align, even if keywords do.

## 2. UI/UX & Specification Violations

### [HIGH] Connection Cards: UI Architectural Violation
*   **Location:** `app/src/screens/ConnectionPostScreen.tsx`
*   **Symptom:** Tapping a connection card opens a bespoke screen instead of the standard `PostDetailScreen`.
*   **Spec Violation:** "On tap, navigate to `PostDetailScreen` and stream an LLM-generated comparison essay... the essay screen should also feature the standard Feed Post Q&A section."
*   **Impact:** Connection posts currently lack the "Ask this post" follow-up Q&A capability, which is a core requirement for all post types in EchoLearn.

### [MEDIUM] Review Map: Missing Hierarchy for Extracted Cards
*   **Location:** `app/src/services/flashcard.service.ts` -> `processSession()`
*   **Symptom:** Flashcards extracted from chat sessions do not have `nodeId`, `rootLabel`, `branchLabel`, or `clusterLabel` assigned.
*   **Impact:** The `ReviewMiniMap` in `ReviewScreen.tsx` filters out any card without a `nodeId`. Consequently, most user-generated flashcards from conversations never appear on the Mind Map.

## 3. Semantic Similarity System Audit (Semantic Connection Cards Spec)

### [MEDIUM] Search/Ask Flow: Context Relevance Delay
*   **Location:** `app/src/services/question.service.ts` -> `buildAndSave()`
*   **Symptom:** Embedding generation is implemented as a fire-and-forget side effect *after* the initial save.
*   **Spec Deviation:** While efficient, the initial "Ask" result for a new question still uses keyword Jaccard context for the LLM because the vector isn't persisted until *after* the first response is generated. Semantic similarity only kicks in for subsequent interactions with that question.

### [MEDIUM] Embedding-based `findRelated` Search
*   **Location:** `app/src/services/question.service.ts` -> `findRelated()`
*   **Symptom:** The core `findRelated` helper (used to gather context for the LLM) was not updated to use the new `cosine` similarity logic. It still relies on keyword frequency.
*   **Spec Violation:** "Update `findRelated()`... to return pairs ranked by cosine similarity when both questions have embedding vectors."

## 4. Summary of Spec Discrepancies

| Spec Requirement | Current Status | Verdict |
| :--- | :--- | :--- |
| SQLite for Chunks/Threads | Added to DDL (Uncommitted) | **PASSED (DIRTY)** |
| Connection Post Q&A | Missing (Bespoke Screen) | **FAIL** |
| Connection Post in `PostDetailScreen` | Implemented as `ConnectionPostScreen` | **FAIL** |
| Embedding-based `findRelated` | Missing from "Ask" Flow | **FAIL** |
| Semantic Fallback Logic | Broken in `graphService` | **FAIL** |
| Hierarchy on all Review cards | Missing for chat-extracted cards | **FAIL** |
