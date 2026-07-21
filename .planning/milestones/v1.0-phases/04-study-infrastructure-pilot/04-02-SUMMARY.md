---
phase: 04-study-infrastructure-pilot
plan: 02
subsystem: api
tags: [cloudflare-worker, d1, csv, zip, recommendation-ingest, participant-export, node-test]

requires:
  - phase: 04-study-infrastructure-pilot/04-01
    provides: additive recommendation wire contract, constrained D1 table, and strict backend parser
provides:
  - authenticated recommendation ingest with bearer-account identity and collision protection
  - recommendation-aware admin status counts and receipt aggregation
  - four-file authenticated CSV ZIP with derived recommendation serving times
  - participant manifest preserving zero-activity accounts and exact string join keys
affects: [04-03, 04-06, research-export, oral-assessment-join, pilot-operations]

tech-stack:
  added: []
  patterns:
    - server-authoritative identity binding at the D1 insert boundary
    - immutable insert-or-ignore records guarded by explicit owner lookup
    - pre-aggregated many-side SQL joins for one-row-per-account manifests
    - closed CSV column lists routed through shared spreadsheet-safe escaping

key-files:
  created: []
  modified:
    - research-backend/src/worker.ts
    - research-backend/src/export.ts
    - research-backend/src/admin.ts
    - research-backend/test/ingest.test.mjs
    - research-backend/test/export.test.mjs
    - research-backend/test/admin-auth.test.mjs

key-decisions:
  - "Bind recommendation user, condition, and topic exclusively from the authenticated installation account; wire records never supply identity."
  - "Derive served_at from the earliest canonical feed_impression instead of storing a second serving timestamp."
  - "Build participants from seeded study_accounts with separately pre-aggregated installation and event joins so inactive accounts remain visible without row multiplication."
  - "Keep export schemas closed and reuse toCsv/escapeCsvCell for every new field."

patterns-established:
  - "Recommendation retries re-ACK the stable ID while INSERT OR IGNORE preserves the original same-account row."
  - "Cross-account recommendation ID ownership is checked before batch writes and returns 409 without an ACK."
  - "Admin export SQL explicitly selects only the declared recommendation and participant CSV columns."

requirements-completed: [STUDY-03, STUDY-04, RQ-03]

coverage:
  - id: D1
    description: "Authenticated recommendation records ingest idempotently with server-owned identity and cross-account collision rejection."
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "research-backend/test/ingest.test.mjs#token-owned recommendations and cross-account recommendation identifiers"
        status: pass
    human_judgment: false
  - id: D2
    description: "The admin status page reports recommendation count and aggregates last receipt across events, Q/A, and recommendations."
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "research-backend/test/ingest.test.mjs#admin status includes recommendation count and recommendation receipt time"
        status: pass
    human_judgment: false
  - id: D3
    description: "The authenticated export contains exactly four closed-schema, spreadsheet-safe CSV files with earliest-impression served_at values."
    requirement: STUDY-03
    verification:
      - kind: integration
        ref: "research-backend/test/export.test.mjs#buildExportZip produces exactly four aggregate CSV files with closed headers and escaped values"
        status: pass
      - kind: integration
        ref: "research-backend/test/export.test.mjs#admin export derives first impression and one participant row per seeded account"
        status: pass
    human_judgment: false
  - id: D4
    description: "participants.csv includes every seeded account with exact string user_id and non-multiplying enrollment/activity aggregates."
    requirement: STUDY-04
    verification:
      - kind: integration
        ref: "research-backend/test/export.test.mjs#admin export derives first impression and one participant row per seeded account"
        status: pass
    human_judgment: false
  - id: D5
    description: "The participant manifest supplies the exact condition/topic/timing join context needed for externally recorded oral assessments."
    requirement: RQ-03
    verification:
      - kind: integration
        ref: "research-backend/test/export.test.mjs#leading-zero and zero-activity participant rows"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 2: Recommendation Ingest and Four-File Export Summary

**Bearer-authenticated recommendation ingest now feeds a four-file, joinable research export with first-impression serving times and a complete seeded-participant manifest.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-19T03:45:38Z
- **Completed:** 2026-07-19T03:59:32Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added immutable recommendation ingest that binds all identity columns from the bearer-token account, re-ACKs same-account retries, and rejects cross-account ID collisions without overwrite or ACK.
- Extended admin status with recommendation count and a three-table last-received aggregate.
- Expanded the authenticated archive to exactly four closed-schema CSV files, deriving `served_at` from the earliest matching feed impression and escaping every cell through the shared CSV encoder.
- Added a one-row-per-seeded-account participant manifest with earliest enrollment, activity bounds, receipt time, zero-activity coverage, and exact string IDs for external oral-assessment joins.

## Task Commits

Each TDD task was committed as a RED test gate followed by a GREEN implementation gate:

1. **Task 1 RED: Specify recommendation ingest and status behavior** - `93a0cb8` (test)
2. **Task 1 GREEN: Implement server-authoritative recommendation ingest** - `838fbbc` (feat)
3. **Task 2 RED: Specify four-file export behavior** - `1f878fa` (test)
4. **Task 2 GREEN: Implement recommendation and participant exports** - `434e189` (feat)

**Plan metadata:** skipped (`commit_docs: false`); this summary remains uncommitted by operator instruction.

## Files Created/Modified

- `research-backend/src/worker.ts` - binds recommendation inserts, rejects cross-account ownership conflicts, aggregates admin status, and selects recommendation/participant export rows.
- `research-backend/src/export.ts` - declares the two new closed column lists and emits all four CSV members.
- `research-backend/src/admin.ts` - renders the explicit recommendation count row required by its named-field status contract.
- `research-backend/test/ingest.test.mjs` - exercises idempotency, identity authority, conflicts, mixed batches, control traces, and status aggregation.
- `research-backend/test/export.test.mjs` - exercises exact ZIP/header contracts, served-time derivation, CSV safety, zero-activity accounts, token rotation, and leading-zero IDs.
- `research-backend/test/admin-auth.test.mjs` - updates only the authenticated archive file-list expectation to the intentional four-file contract.

## Decisions Made

- Kept recommendation writes immutable: only ID ownership is checked before `INSERT OR IGNORE`; same-account retries cannot replace ranking content.
- Used the research-authoritative event log for first serving time, leaving never-impressed recommendations blank.
- Used `study_accounts` as the participant manifest left side and aggregated each many-side relation before joining.
- Kept control trace arrays as the literal JSON text `[]` and excluded every §14.2 category by closed column construction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the legacy authenticated-export file-list assertion**

- **Found during:** Task 2 full-suite acceptance gate
- **Issue:** `research-backend/test/admin-auth.test.mjs` still asserted the intentionally retired two-file archive, so the correct four-file endpoint caused the mandatory full suite to fail.
- **Fix:** After explicit operator authorization, changed only that test's expected ZIP entry list; all authentication, method, cache, and response-header assertions remain unchanged.
- **Files modified:** `research-backend/test/admin-auth.test.mjs`
- **Verification:** `cd research-backend && npm test` passes all 45 tests.
- **Committed in:** `434e189`

---

**Total deviations:** 1 auto-fixed blocking test-contract update, explicitly authorized by the operator.
**Impact on plan:** No production scope expansion; the changed test now reflects the export contract this plan intentionally ships.

## Issues Encountered

- The stale two-file admin-auth fixture blocked the first full-suite run. Work paused until the operator authorized the narrowly scoped assertion update; no production test-specific behavior was introduced.

## User Setup Required

None - no package installation, external service mutation, credential change, or deployment was performed.

## Next Phase Readiness

- Plan 04-03 can project device recommendation rows into this authenticated ingest contract.
- Plan 04-06 can deploy migration/Worker changes and smoke the exact four-file archive before distributing the client build.
- The participant CSV now supplies the app/backend join key for the external oral-assessment protocol without introducing in-app audio capture.

## Self-Check: PASSED

- All six modified implementation/test files exist and are clean at committed HEAD.
- Commits `93a0cb8`, `838fbbc`, `1f878fa`, and `434e189` exist in RED-before-GREEN order for both TDD tasks.
- Mandatory targeted suites passed: `node --test test/ingest.test.mjs` (8/8) and `node --test test/export.test.mjs` (5/5).
- Final `npm test` passed all 45 backend tests after the GREEN commit.
- No tracked file deletion, generated artifact, stub marker, new dependency, or unplanned threat surface was introduced.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified by this execution and the summary is intentionally uncommitted.

---
*Phase: 04-study-infrastructure-pilot*
*Completed: 2026-07-19*
