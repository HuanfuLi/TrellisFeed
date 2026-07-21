---
phase: 03-graph-memory-recommendation-engine
plan: 05
subsystem: graph-memory
tags: [question-extraction, durable-outbox, frozen-allowlist, rq-02, research-wire, indexeddb]

requires:
  - phase: 03-02
    provides: frozen concept and claim records plus extraction_jobs persistence
  - phase: 03-03
    provides: idempotent graphMemoryService question contributions and asks_about edges
provides:
  - durable asynchronous question extraction with strict same-topic frozen-ID validation
  - non-blocking condition-identical Ask integration and boot-time extraction resume
  - revisioned RQ-02 extraction fields across local records, wire validation, D1 storage, and CSV export
affects: [03-06, recommendation-service, graph-memory-ranking, research-export]

tech-stack:
  added: []
  patterns: [durable outbox, frozen-ID allowlist, idempotent retry projection, closed wire contract]

key-files:
  created:
    - app/src/services/question-extraction.service.ts
    - app/tests/services/question-extraction.service.test.mjs
    - research-backend/migrations/0003_question_extraction_fields.sql
  modified:
    - app/src/services/post-qa.service.ts
    - app/src/App.tsx
    - app/src/services/graph-memory.service.ts
    - app/src/services/interaction-log.service.ts
    - app/src/services/research-wire-contract.ts
    - app/src/types/research.ts
    - app/tests/services/interaction-log.service.test.mjs
    - research-backend/src/validation.ts
    - research-backend/src/worker.ts
    - research-backend/src/export.ts

key-decisions:
  - "Extraction accepts IDs only from the single ready frozen pool and current topic; label or alias fallback succeeds only for one unique frozen match."
  - "A canonical extraction persisted before a downstream retry is revalidated and reused, preventing a second LLM response from drifting graph contributions."
  - "RQ-02 adds exactly extractedConceptIds, extractedClaimIds, questionType, and unresolved across the closed client/backend contract."

patterns-established:
  - "Background question work persists first, never blocks Ask, and resumes from extraction_jobs on boot."
  - "Successful asynchronous graph mutations emit one GRAPH_UPDATED signal with kind extraction after durable projection."

requirements-completed: [GRAPH-03, RQ-02]

coverage:
  - id: D1
    description: "Durable injection-resistant extraction restricted to same-topic frozen concept and claim IDs"
    requirement: GRAPH-03
    verification:
      - kind: integration
        ref: "app/tests/services/question-extraction.service.test.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Extraction is isolated from Ask latency/failure and identical across study conditions"
    requirement: GRAPH-03
    verification:
      - kind: integration
        ref: "node --test tests/services/question-extraction.service.test.mjs tests/services/post-qa.condition-parity.test.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Four RQ-02 extraction fields persist as revision 2 and reach backend CSV export"
    requirement: RQ-02
    verification:
      - kind: integration
        ref: "app/tests/services/interaction-log.service.test.mjs#extraction re-projection persists revision 2"
        status: pass
      - kind: integration
        ref: "research-backend/test/ingest.test.mjs and export.test.mjs"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 05: Durable Question Extraction and RQ-02 Projection Summary

**Strict frozen-ID question extraction with restart-safe retries, condition-neutral Ask wiring, graph-memory updates, and four-field revisioned research export.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-18T07:23:00Z
- **Completed:** 2026-07-18T07:45:36Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added a durable `extraction_jobs` processor that uses the section 17.2 tasks, JSON mode, untrusted-input bracketing, strict parsing, and same-topic frozen concept/claim allowlists.
- Preserved identical Ask behavior in both conditions: canonical questions begin with empty extraction state, enqueue errors cannot fail answers, and pending jobs plus graph repair resume after hydration.
- Applied validated extraction to question contributions and `asks_about` edges, emitted one `GRAPH_UPDATED` event with `kind: 'extraction'`, and never routed through anchor creation.
- Re-projected completed extraction as a higher-revision Q&A record and carried exactly four optional RQ-02 fields through client validation, backend validation, D1 columns, and CSV export.

## Task Commits

Each task was committed atomically:

1. **Task 1: Durable section 17.2 extraction outbox and allowlist** - `6e0c19e` (feat)
2. **Task 2: Non-blocking Ask integration and boot resume** - `c683c36` (feat)
3. **Task 3: Revisioned RQ-02 wire, backend, and export path** - `9507d7b` (feat)

**Plan metadata:** skipped (`commit_docs` disabled; planning files remain uncommitted)

## Files Created/Modified

- `app/src/services/question-extraction.service.ts` - Durable extraction jobs, prompt construction, strict output parsing, allowlist resolution, retries, graph application, and revised Q&A projection.
- `app/tests/services/question-extraction.service.test.mjs` - Durability, allowlist, injection, ambiguity, retry, restart, event, and Ask-isolation tests through `dbQuery`.
- `app/src/services/post-qa.service.ts` - Empty initial extraction state and caught fire-and-forget enqueue after canonical persistence.
- `app/src/App.tsx` - Post-hydration extraction resume and graph repair triggers.
- `app/src/services/graph-memory.service.ts` - Removed the duplicate interaction-kind event from extraction application.
- `app/src/services/interaction-log.service.ts` - Exact extraction-field projection and `recordQuestionAnswer` revision alias.
- `app/src/types/research.ts` / `app/src/services/research-wire-contract.ts` - Four optional closed-contract RQ-02 fields.
- `app/tests/services/interaction-log.service.test.mjs` - Durable revision-2 projection and wire-validation assertion.
- `research-backend/migrations/0003_question_extraction_fields.sql` - Four D1 columns for extraction analysis.
- `research-backend/src/validation.ts` / `worker.ts` / `export.ts` - Closed validation, persistence bindings, admin select, and CSV columns.
- `research-backend/test/validation.test.mjs` / `ingest.test.mjs` / `export.test.mjs` - Backend acceptance, storage, and export coverage.

## Decisions Made

- Candidate resolution reads the single ready frozen version and filters by `UserQuestion.topicId`; unknown, cross-topic, and ambiguous values fail the job attempt without graph writes.
- `unresolved` is written by the first validated extraction and retries reuse that persisted value; no Phase 3 behavior clears it.
- LLM-suggested arbitrary edges are ignored. Only deterministic `asks_about` edges derived from validated concept and claim IDs are written.
- Revision projection preserves already-extracted fields if a stale initial UI projection arrives later, preventing asynchronous extraction data from being cleared.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a duplicate graph event from the existing extraction helper**
- **Found during:** Task 1
- **Issue:** `graphMemoryService.applyQuestionExtraction` emitted `kind: 'interaction'`, while the new service must emit `kind: 'extraction'`, producing two signals for one semantic mutation.
- **Fix:** Kept graph writes in graphMemoryService and made questionExtractionService the sole extraction event owner.
- **Files modified:** `app/src/services/graph-memory.service.ts`, `app/src/services/question-extraction.service.ts`
- **Committed in:** `6e0c19e`

**2. [Rule 3 - Blocking] Corrected new extraction service TypeScript boundaries**
- **Found during:** Task 1 type-check
- **Issue:** The bracketing helper widened message roles and `ServiceResult.error` is optional.
- **Fix:** Added a shared message type and safe error fallback.
- **Files modified:** `app/src/services/question-extraction.service.ts`
- **Committed in:** `6e0c19e`

**3. [Rule 2 - Missing Critical] Persisted the four backend fields instead of validating and discarding them**
- **Found during:** Task 3 backend trace
- **Issue:** The planned validation/export edits were insufficient because D1 uses explicit columns and worker bindings.
- **Fix:** Added exactly four migration columns, upsert bindings, update assignments, and admin export selects.
- **Files modified:** `research-backend/migrations/0003_question_extraction_fields.sql`, `research-backend/src/worker.ts`, backend tests
- **Committed in:** `9507d7b`

**4. [Rule 2 - Missing Critical] Made post-patch extraction retries idempotent**
- **Found during:** Task 3 threat-register review (T-03-15)
- **Issue:** A graph/projection failure after the question patch could invoke the LLM again and select different IDs, leaving stale contributions or edges.
- **Fix:** Pending retries revalidate and reuse persisted extraction fields without another LLM call.
- **Files modified:** `app/src/services/question-extraction.service.ts`, `app/tests/services/question-extraction.service.test.mjs`
- **Committed in:** `9507d7b`

---

**Total deviations:** 4 auto-fixed (1 Rule 1 bug, 2 Rule 2 missing-critical fixes, 1 Rule 3 blocker)
**Impact on plan:** All fixes enforce the stated single-event, end-to-end export, and idempotent-retry invariants without adding wire fields or participant-facing behavior.

## Issues Encountered

- The assignment required one commit per task, so the Task 1 RED test and GREEN implementation were committed together after the missing-module RED gate was demonstrated.
- Expected validation-failure tests log retry warnings; all LLM calls are mocked and no live provider is contacted.

## Verification

- `node --test tests/services/question-extraction.service.test.mjs` - pass (12 assertions after final retry coverage)
- `node --test tests/services/question-extraction.service.test.mjs tests/services/post-qa.condition-parity.test.mjs` - pass
- `node --test tests/services/interaction-log.service.test.mjs` - pass (9 tests)
- `npm test` from `app/` - pass (565 tests)
- `npx tsc -b --noEmit` from `app/` - pass
- `npm test` from `research-backend/` - pass (30 tests)
- Anchor-creation source gate - 0 hits
- Durability gate - 6 `dbQuery` references in extraction tests
- Boot gate - one `resumeOnBoot` and one `repairOnBoot` call in `App.tsx`
- Protected Plan 03-06 files - untouched

## User Setup Required

- Apply `research-backend/migrations/0003_question_extraction_fields.sql` through the repository's normal deployment migration workflow before deploying the revised ingest Worker.

## Next Phase Readiness

- Plan 03-06 can consume canonical extracted concept/claim IDs for experimental ranking while leaving control ranking structurally isolated.
- The packaged real pool and generated projection remain untouched and still require the operator's planned re-freeze.

## Self-Check: PASSED

- All created artifacts exist, including the extraction service, extraction tests, backend migration, and this summary.
- Task commits `6e0c19e`, `c683c36`, and `9507d7b` resolve in git history.
- Summary status is `complete`; GRAPH-03 and RQ-02 are represented in coverage metadata.
- No task files contain goal-blocking stubs, and the only new trust-boundary surface is covered by the plan's threat model.

---
*Phase: 03-graph-memory-recommendation-engine*
*Completed: 2026-07-18*
