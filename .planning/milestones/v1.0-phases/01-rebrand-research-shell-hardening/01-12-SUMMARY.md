---
phase: 01-rebrand-research-shell-hardening
plan: 12
subsystem: research-upload-durability
tags: [indexeddb, outbox, quarantine, bearer-auth, reconciliation, capacitor]

requires:
  - phase: 01-11
    provides: "Authenticated per-install ingest, identity-free wire contract, and exact-origin CORS boundary."
provides:
  - "Shared v1 client/Worker validation limits with identity-free bearer-authenticated upload bodies."
  - "Self-draining bounded outbox with poison isolation, visible quarantine, and enqueue-in-flight coverage."
  - "Revision-aware delivery ledger plus boot/online/native-resume reconciliation across crash windows."
affects: [phase-1-plan-13, research-diagnostics, local-recovery-export, mobile-lifecycle]

tech-stack:
  added: []
  patterns: [versioned shared wire contract, durable quarantine, receipt-before-delete, source-of-truth reconciliation, serialized dirty-generation drain]

key-files:
  created:
    - app/src/services/research-wire-contract.ts
  modified:
    - app/src/App.tsx
    - app/src/services/db.service.ts
    - app/src/services/research-export.service.ts
    - app/src/services/upload-queue.service.ts
    - research-backend/src/validation.ts
    - app/tests/services/upload-queue.service.test.mjs

key-decisions:
  - "Durable research records remain the source of truth; cross-store atomicity is recovered deterministically instead of being falsely modeled with IndexedDB BEGIN/COMMIT no-ops."
  - "A server ACK is persisted as a revision-aware delivery receipt before exact-envelope queue deletion."
  - "Permanent singleton validation failures enter a non-sensitive local quarantine, while authentication, configuration, network, malformed-ACK, and server failures retain the active queue and stop."

patterns-established:
  - "Receipt-before-delete: acknowledge an exact revision durably before destructive outbox cleanup."
  - "Dirty-generation drain: re-read durable work after every progress transition and before resolving the shared flush."
  - "Terminal quarantine remains included in pending diagnostics and local recovery export."

requirements-completed: [LOG-01, RQ-01, SHELL-02]

coverage:
  - id: D1
    description: "Versioned identity-free authenticated wire validation and recoverable poison-row quarantine."
    requirement: LOG-01
    verification:
      - kind: integration
        ref: "app/tests/services/upload-queue.service.test.mjs#client and Worker consume the same committed v1 wire limits"
        status: pass
      - kind: integration
        ref: "app/tests/services/upload-queue.service.test.mjs#malformed and individually oversized queue heads are quarantined while later rows upload"
        status: pass
      - kind: integration
        ref: "app/tests/phase1/participant-surface.test.mjs#local recovery export contains only durable records for the bound participant"
        status: pass
    human_judgment: false
  - id: D2
    description: "One serialized trigger drains arbitrary bounded backlogs and captures partial ACK, concurrent enqueue, and newer Q/A revisions."
    requirement: LOG-01
    verification:
      - kind: integration
        ref: "app/tests/services/upload-queue.service.test.mjs#one flush drains every bounded batch in a 250-record backlog"
        status: pass
      - kind: integration
        ref: "app/tests/services/upload-queue.service.test.mjs#enqueue during an in-flight request is included before the shared flush resolves"
        status: pass
      - kind: integration
        ref: "app/tests/services/upload-queue.service.test.mjs#an ACK for an older revision cannot delete rev 2 and the shared drain uploads rev 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "Revision-aware delivery receipts, deterministic reconciliation, and production boot/online/native-resume retry wiring."
    requirement: RQ-01
    verification:
      - kind: integration
        ref: "app/tests/services/interaction-log.service.test.mjs#a record persisted before enqueue failure is recovered by outbox reconciliation"
        status: pass
      - kind: integration
        ref: "app/tests/services/upload-queue.service.test.mjs#ACK receipt failure retains the active envelope for safe duplicate retry"
        status: pass
      - kind: integration
        ref: "app/tests/services/upload-queue.service.test.mjs#reconciliation is idempotent revision-aware and does not resurrect quarantined rows"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-07-11
status: complete
---

# Phase 01 Plan 12: Durable Self-Draining Outbox Summary

**A bearer-authenticated, identity-free outbox now self-drains bounded backlogs, isolates permanent poison rows, and reconciles every durable revision across app crashes and native resumes.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-11T22:55:39Z
- **Completed:** 2026-07-11T23:06:41Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Unified client and Worker validation around the committed v1 JSON limits, removed identity from request bodies, and confined the installation token to the Authorization header.
- Added an IndexedDB/local fallback quarantine, permanent-4xx singleton isolation, active-plus-quarantine diagnostics, and credential-free recovery export v2.
- Added arbitrary backlog draining, enqueue-in-flight generation tracking, receipt-before-delete delivery bookkeeping, deterministic boot/resume reconciliation, and production retry registration.

## Task Commits

Each task followed RED then GREEN and was committed atomically:

1. **Task 1: Shared v1 contract and poison isolation** — `226d478` (RED), `02f76b4` (GREEN)
2. **Task 2: Self-draining concurrency** — `660c962` (RED), `dcc6811` (GREEN)
3. **Task 3: Delivery ledger and lifecycle reconciliation** — `1c09a63` (RED), `9634dea` (GREEN)

Planning metadata remains uncommitted because `commit_docs` is `false`.

## Files Created/Modified

- `app/src/services/research-wire-contract.ts` — Typed adapter and validator for the shared v1 JSON contract.
- `app/src/services/upload-queue.service.ts` — Authenticated batching, quarantine, serialized drain, delivery receipts, reconciliation, and retry triggers.
- `app/src/services/db.service.ts` — IndexedDB v4 quarantine store plus parity clearing.
- `app/src/services/research-export.service.ts` — Recovery v2 including safe quarantined records without credentials.
- `app/src/App.tsx` — Registers and disposes retry lifecycle after hydration and performs consented initial reconciliation.
- `research-backend/src/validation.ts` — Uses shared field-specific limits consistently with the client.
- `app/tests/services/upload-queue.service.test.mjs` — Backlog, poison, auth, concurrency, ACK, and crash-window fault injection.
- `app/tests/services/interaction-log.service.test.mjs` — Persist-before-enqueue crash recovery.
- `app/tests/services/storage-namespace.test.mjs` — LocalStorage and IndexedDB quarantine parity.
- `app/tests/services/rq1-log-coverage.test.mjs` — Production lifecycle wiring guard.
- `app/tests/phase1/participant-surface.test.mjs` — Credential-free recovery export guard.

## Decisions Made

- Durable `research_records` are authoritative. Reconciliation repairs separate IndexedDB operations instead of claiming unsupported multi-store SQL atomicity.
- Delivery receipts are monotonic by record revision and are written before exact-envelope deletion; an older ACK can never suppress a newer Q/A revision.
- Only permanent singleton validation/conflict failures are quarantined. Authentication, configuration, transport, 5xx, and malformed/zero-progress ACK paths stop and retain active work.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Full app regression remains at the known baseline: 882 tests, 876 passed, 6 failed. All six failures are the pre-existing cases explicitly assigned to Plan 01-13; this plan introduced no additional failures.
- Lint completes with 0 errors and 26 pre-existing warnings outside this plan's scope.

## User Setup Required

None - no additional external configuration is required.

## Test Evidence

- Focused plan suite: 44/44 passed.
- TypeScript: `npx tsc -b --noEmit` passed.
- Lint: `npm run lint` passed with 0 errors (26 existing warnings).
- Production build: `npm run build` passed.
- Worker/backend: 29/29 passed.
- Full app suite: 882 total, 876 passed, 6 known baseline failures; no regression delta.
- Security negative scan found no deployment URL, D1 identifier, local deployment config, or real credential in the Plan 12 diff.

## Next Phase Readiness

- Ready for `01-13-PLAN.md`, which owns the six existing app test failures, English fresh-install default, and remaining shell residue cleanup.
- Manual signed-device offline/process-kill/reconnect UAT remains intentionally deferred to the Plan 13 closeout checkpoint.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*

## Self-Check: PASSED

- All three task acceptance gates passed.
- All high-severity ASVS L1 threats P12-T1 through P12-T6 have automated regression coverage.
- Created artifact `app/src/services/research-wire-contract.ts` exists and all six RED/GREEN commits are present.
