---
phase: 04-study-infrastructure-pilot
plan: 03
subsystem: research-data
tags: [indexeddb, research-outbox, recommendations, wire-contract, consent, node-test]

requires:
  - phase: 04-study-infrastructure-pilot/04-01
    provides: additive recommendation contract metadata and backend validation bounds
  - phase: 04-study-infrastructure-pilot/04-04
    provides: current-version affirmative research-consent gate
provides:
  - identity-stripped recommendation wire validation and existing-outbox delivery support
  - consent-gated crash-recoverable ready-batch projection into durable research records
  - post-persistence capture and boot reconciliation hooks that remain downstream of ranking
affects: [04-06, study-export, recommendation-pilot, research-ingest]

tech-stack:
  added: []
  patterns:
    - explicit-field projection from persisted recommendation ledgers into the canonical research outbox
    - post-commit lazy capture with boot-time idempotent convergence
    - client/backend validation parity through the shared JSON contract

key-files:
  created:
    - app/src/services/recommendation-research.service.ts
    - app/tests/services/recommendation-research.service.test.mjs
  modified:
    - app/src/types/research.ts
    - app/src/types/index.ts
    - app/src/services/research-wire-contract.ts
    - app/src/services/upload-queue.service.ts
    - app/src/services/recommendation.service.ts
    - app/src/App.tsx
    - app/tests/services/upload-queue.service.test.mjs

key-decisions:
  - "Recommendation projection is strictly downstream of a successful ready-batch save and never imported by ranking modules."
  - "Durable research rows use the four-placeholder dbExecute form shared by interaction logging so IndexedDB and LocalStorageBackend remain behaviorally identical."
  - "Recommendation records omit a data-level revision; the canonical research row and outbox receipt supply revision 1."

patterns-established:
  - "Projection explicitly picks recommendation fields and adds batch/session/order metadata without spreading batch state."
  - "Boot projects first, then reconciles the shared outbox, then flushes."

requirements-completed: [STUDY-03]

coverage:
  - id: D1
    description: "Recommendation records validate against shared bounds, strip local identity, and use the existing delivery, ACK, quarantine, and reconciliation pipeline."
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "app/tests/services/upload-queue.service.test.mjs#recommendation wire, delivery, quarantine, and reconciliation cases"
        status: pass
      - kind: other
        ref: "app: node --test tests/services/upload-queue.service.test.mjs (28 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ready recommendation batches project in ledger order through dbQuery into idempotent revision-1 research records only under current affirmative consent."
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "app/tests/services/recommendation-research.service.test.mjs#projection, crash recovery, consent, and control cases"
        status: pass
      - kind: other
        ref: "app: node --test tests/services/recommendation-research.service.test.mjs (7 tests after hook coverage)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ready-batch capture fires after durable save, boot closes missed windows before outbox reconciliation, and control ranking remains isolated."
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "app/tests/services/recommendation-research.service.test.mjs#ready-batch hook ordering and rejection isolation"
        status: pass
      - kind: integration
        ref: "app/tests/services/recommendation.service.test.mjs#control batches never load personal stores"
        status: pass
      - kind: other
        ref: "grep -rn recommendation-research app/src/services/ranking/ (no matches)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 3: Recommendation Research Projection Summary

**Ready recommendation batches now converge through a consent-gated IndexedDB projection into the existing identity-stripped research outbox, with post-save capture and boot repair that cannot feed back into ranking.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-19T04:08:17Z
- **Completed:** 2026-07-19T04:20:18Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added the recommendation research type and contract-owned client validator, including finite numeric, positive-order, contributor-array, component-score, extra-key, and identity-stripping checks.
- Reused the canonical outbox end to end for recommendation enqueue, bounded upload, durable ACK receipts, poison-row quarantine, and reconciliation.
- Added an explicit-field, consent-gated projector that preserves ready-batch order, excludes status/diversity state, tolerates missing item rows, and converges idempotently after crashes.
- Wired projection after successful ready-batch persistence and before boot outbox reconciliation while retaining the unchanged control-ranker throwing-spy tests.

## Task Commits

Each task was committed atomically; both TDD tasks have separate RED and GREEN commits:

1. **Task 1 RED: Recommendation wire/outbox behavior** - `644a4e5` (test)
2. **Task 1 GREEN: Recommendation wire/outbox support** - `c90e57e` (feat)
3. **Task 2 RED: Durable recommendation projection behavior** - `9735646` (test)
4. **Task 2 GREEN: Recommendation research projector** - `9c309f8` (feat)
5. **Task 3: Post-save and boot capture hooks** - `7f0d9cd` (feat)

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `app/src/services/recommendation-research.service.ts` - projects ready batch/item rows through `dbQuery`, persists revision-1 research records, enqueues without a second transport, and triggers best-effort flush after capture.
- `app/tests/services/recommendation-research.service.test.mjs` - proves order, crash recovery, idempotency, missing-row convergence, consent gating, control privacy, durable hook ordering, and error isolation.
- `app/src/types/research.ts` - defines the exact `RecommendationResearchRecord` shape.
- `app/src/types/index.ts` - re-exports the new research record type.
- `app/src/services/research-wire-contract.ts` - adds the recommendation allowlist and shared-contract validation branch.
- `app/src/services/upload-queue.service.ts` - widens the existing outbox union to recommendations without changing transport behavior.
- `app/tests/services/upload-queue.service.test.mjs` - covers recommendation validation, identity stripping, delivery/ACK, 422 quarantine, and reconciliation.
- `app/src/services/recommendation.service.ts` - invokes lazy capture only after a successful ready-batch save and isolates failures.
- `app/src/App.tsx` - projects recommendation rows before boot outbox reconciliation.

## Decisions Made

- Kept the projection one-way and downstream-only: ranking and ranking-support modules have no import edge to the exporter.
- Used explicit recommendation field picks so legacy or batch-only state cannot leak into durable data or onto the wire.
- Kept the record itself revisionless so the unchanged outbox helper naturally assigns revision 1 from the canonical `research_records` row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used bound values for every research-record column**
- **Found during:** Task 2 GREEN verification
- **Issue:** The plan's SQL literal form (`VALUES (?, 'recommendation', 1, ?)`) is not parsed equivalently by `LocalStorageBackend`; it misbound the JSON payload into `kind`, violating the load-bearing backend parity rule.
- **Fix:** Used the established interaction-log statement with four placeholders and `[id, 'recommendation', 1, data]` parameters.
- **Files modified:** `app/src/services/recommendation-research.service.ts`
- **Verification:** All five Task 2 projection cases passed through `dbQuery`; the full 605-test app suite also passed.
- **Committed in:** `9c309f8`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug).
**Impact on plan:** The adjustment preserves the requested data shape while making the real and fallback DB backends behave identically; no scope expansion.

## Issues Encountered

- The first Task 2 GREEN run exposed the SQL-literal fallback mismatch; the four-placeholder fix resolved it without changing the projection contract.
- ESLint reports seven pre-existing warnings outside this plan and zero errors.

## Known Stubs

- `app/src/App.tsx:407` - pre-existing neutral loading placeholder shown only while IndexedDB hydration resolves; it is intentional boot UI and does not affect recommendation projection.

## TDD Gate Compliance

- Task 1 RED commit `644a4e5` failed the new recommendation wire/delivery/quarantine cases before GREEN commit `c90e57e`.
- Task 2 RED commit `9735646` failed because the new projection service was absent before GREEN commit `9c309f8`.

## Verification

- Task 1 mandatory command: 28/28 tests passed.
- Task 2 mandatory command: 5/5 projection tests passed before hook additions.
- Task 3 mandatory command: 21/21 targeted tests passed, including unchanged control-isolation tests.
- Full app suite: 605 tests passed, 0 failed.
- `npx tsc -b --noEmit`: passed.
- `npm run lint`: passed with 0 errors and 7 pre-existing warnings.
- Ranking import grep: no `recommendation-research` matches under `app/src/services/ranking/`.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- The client half of STUDY-03 now emits the recommendation kind supported by Plans 04-01 and 04-02.
- Plan 04-06 can exercise backend-first deployment, recommendation upload, four-file export, and pilot reconciliation without a second client transport.
- No blockers remain for this plan.

## Self-Check: PASSED

- Summary status is `complete`; both created files and all nine planned code/test paths exist.
- Commits `644a4e5`, `c90e57e`, `9735646`, `9c309f8`, and `7f0d9cd` exist in RED-before-GREEN/task order.
- The commit range touches only the nine paths declared by the plan; there are no staged changes.
- The summary is uncommitted as required by `commit_docs: false`; `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified by this executor.

---
*Phase: 04-study-infrastructure-pilot*
*Completed: 2026-07-19*
