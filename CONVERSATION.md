# EchoLearn Bug Report: Architecture & Feature Implementation Failures

After deeply reviewing the design documentation (specifically `semantic-connection-cards/design.md` and `planner-learning-chunks/design.md`) and conducting a re-audit of the codebase, the following critical implementation gaps, logic errors, and standard bugs were identified.

## 1. Architectural & Feature Implementation Failures

### 1.1. Missing Jaccard Pre-filter Before Cosine Similarity
**Location:** `app/src/services/graph.service.ts` -> `getSemanticCandidates()`
**Description:** 
The `semantic-connection-cards/design.md` spec explicitly dictates: *"When embeddings are available, still use Jaccard as a first-pass pre-filter (threshold: any overlap > 0) before computing cosine similarity."* 
Currently, the codebase completely skips this required pre-filter. It immediately loops through all questions with vectors and computes pure cosine similarity over all $O(N^2)$ pairs without checking if the Jaccard keyword overlap is > 0. This is a direct failure to implement the documented safety valve logic, which was explicitly designed to filter out low-confidence pairs before they reach the expensive cosine and LLM evaluation stages. (This issue may have been misidentified previously as "dead code," but it is an active implementation gap against the documented architecture).

### 1.2. Unawaited Embedding Side-Effects Leading to Silent Feature Degradation
**Location:** `app/src/services/question.service.ts` -> `buildAndSave()`
**Description:** 
Embeddings are fetched using `embedText()` and the vector is patched onto the question. While the spec intends for this to be a "fire-and-forget" call so as to not block the UI, catching and swallowing all errors silently (`.catch(() => { /* silent */ })`) completely masks genuine provider network errors, missing dimension constraints, or malformed API responses. If text embeddings fail continuously, the application gracefully but invisibly degrades to the legacy keyword-based Jaccard fallback for connection cards. There is no telemetry, toast, or fallback warning, making it extremely difficult to identify when the primary semantic architecture is failing in production.

## 2. Standard Codebase Bugs

### 2.1. Test Suite Failure (ESM Module Resolution)
**Location:** `app/src/services/graph.service.ts`
**Description:** 
Running the test suite (`npm run test`) fails immediately with `ERR_MODULE_NOT_FOUND`. Node's ESM resolution for testing requires explicit `.ts` extensions for local imports. However, `graph.service.ts` uses extensionless imports:
```typescript
import { questionService } from './question.service';
import { dbExecute, dbQuery } from './db.service';
```
This causes `tests/concept-feed.test.mjs` (which transitively imports `graph.service.ts` via `concept-feed.service.ts`) to crash during execution.

### 2.2. ESLint Validation Errors
**Location:** Multiple files
**Description:** 
Running `npx eslint .` yields multiple validation errors that prevent a clean build:
- **`app/src/services/concept-feed.service.ts`**: The destructured variables `_generatedAt` and `_origin` are assigned but never used (around line 552).
- **`app/src/services/question.service.ts`**: `addDays` is imported from `../lib/date` but never used (line 2).
- **`app/src/vite-env.d.ts`**: Contains an unexpected `any` type which violates the `@typescript-eslint/no-explicit-any` rule.

### 2.3. Overlapping Planner vs. Calendar Legacy State
**Location:** `app/src/services/mock/planner.mock.ts` vs `app/src/services/planner.service.ts`
**Description:** 
The transition specified in `planner-learning-chunks/design.md` dictates replacing the Calendar surface with the Planner workspace. However, the codebase currently maintains overlapping logic. `planner.mock.ts` continues to manage the legacy `TimeBlock` and `TodoItem` logic (relying on the `echolearn_schedule_v1` local storage key), while the new `planner.service.ts` manages the new domain objects (`PlannerChunk`, `PlannerThread`, etc.). Lingering dependencies on the old schedule logic create a risk of data fragmentation if UI components inadvertently trigger legacy block logic instead of the newly specified learning chunks.