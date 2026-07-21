---
phase: 01-rebrand-research-shell-hardening
plan: 06
subsystem: research-upload
tags: [indexeddb, offline, at-least-once, single-flight, capacitor, event-bus]

requires:
  - phase: 01-02
    provides: "Durable research_upload_queue and research_metadata stores through the database seam."
  - phase: 01-04
    provides: "Validated public research endpoint configuration and privacy-bounded research record types."
provides:
  - "Persist-before-send upload envelopes with ACK-only deletion and response-loss-safe retries."
  - "Oldest-first single-flight batches bounded to 100 records and 256 KiB."
  - "Durable pending/last-success upload health with UPLOAD_STATUS_CHANGED broadcasts."
  - "Automatic retry registration for enqueue, browser online, and Capacitor app resume."
affects: [01-07, 01-09, interaction-logging, researcher-diagnostics]

tech-stack:
  added: []
  patterns: ["durable outbox", "single-flight flush", "ACK intersection", "event-bus re-read"]

key-files:
  created:
    - app/src/services/upload-queue.service.ts
    - app/src/services/research-metadata.service.ts
    - app/tests/services/upload-queue.service.test.mjs
  modified: []

key-decisions:
  - "Queue rows use the record id as the idempotency key; a newer Q/A revision replaces an unsent older revision under the same key."
  - "ACK deletion verifies that the current durable envelope exactly matches the sent envelope, so an in-flight ACK cannot delete a newer replacement."
  - "Q/A condition remains in the durable local envelope but is omitted only from the wire payload because the deployed collector derives it authoritatively from study_accounts."

patterns-established:
  - "Network state schedules retries only; durable rows are removed exclusively after a valid 2xx acknowledgedIds response."
  - "Upload-health mutations persist first, then broadcast UPLOAD_STATUS_CHANGED for always-mounted consumers to re-read."

requirements-completed: [LOG-01]

coverage:
  - id: D1
    description: "Every upload is persisted before fetch and retained across reject, abort, HTTP 500, and lost-response paths."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "app/tests/services/upload-queue.service.test.mjs#enqueue persists an envelope before attempting upload and retains it on rejection"
        status: pass
    human_judgment: false
  - id: D2
    description: "Flushes are single-flight, oldest-first, bounded, and delete only exact server-acknowledged envelopes."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "app/tests/services/upload-queue.service.test.mjs#concurrent flush calls are single-flighted and issue one POST"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pending/last-success health is durable and online/resume signals trigger retries without asserting delivery."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "app/tests/services/upload-queue.service.test.mjs#successful ACK durably updates upload health and broadcasts the new status"
        status: pass
    human_judgment: false

duration: 5m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 06: Durable Upload Queue and Research Metadata Summary

**Participant records now enter a durable outbox before any network attempt, retry until an exact server ACK, and expose persistent upload health to the researcher diagnostics layer.**

## Performance

- **Duration:** 5m
- **Started:** 2026-07-11T05:29:47Z
- **Completed:** 2026-07-11T05:34:14Z
- **Tasks:** 1 TDD task
- **Files modified:** 3

## Accomplishments

- Added persist-before-send envelopes and a serialized `POST /v1/ingest` flush that selects at most 100 oldest records while keeping the UTF-8 request body at or below 256 KiB.
- Kept every row through offline, abort, 5xx, malformed-response, and lost-response paths; only IDs acknowledged for the current batch are eligible for deletion.
- Protected newer Q/A revisions from stale in-flight ACKs by comparing the durable replacement with the exact sent envelope before deletion.
- Added durable upload health (`pending`, `lastSuccessfulUploadAt`) and `UPLOAD_STATUS_CHANGED` broadcasts, plus browser-online and Capacitor-resume retry registration.

## Task Commits

1. **RED: Durable upload queue behavioral suite** — `d5e4063` (test)
2. **GREEN: Queue, single-flight flush, metadata, and retry triggers** — `2a068af` (feat)
3. **Collector contract alignment for Q/A records** — `fadd18f` (fix)

## Files Created/Modified

- `app/src/services/upload-queue.service.ts` — durable enqueue, bounded single-flight flush, exact-envelope ACK deletion, and retry trigger lifecycle.
- `app/src/services/research-metadata.service.ts` — durable upload-health mirror and event-bus publication.
- `app/tests/services/upload-queue.service.test.mjs` — 13 focused passing paths through `dbQuery` with mock fetch only.

## Decisions Made

- The record ID is both the durable queue key and the collector idempotency key. For Q/A updates, a pending newer revision supersedes a pending older revision rather than creating ambiguous duplicate ACK keys.
- A partial or malicious ACK can only affect IDs present in the posted batch, and even those rows are deleted only when their current durable contents still equal what was sent.
- Production endpoint resolution is lazy and uses the existing non-secret `researchConfig`; tests inject an invalid public URL and mocked fetch. No live collector request was made.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Prevented stale ACK deletion of a newer Q/A revision**
- **Found during:** GREEN review
- **Issue:** A newer revision can replace the same queue key while an older revision is in flight; deleting by ACK ID alone would drop the replacement.
- **Fix:** Re-read and compare the current durable envelope with the sent envelope before PK deletion; added a regression test.
- **Committed in:** `2a068af`

**2. [Rule 3 - Blocking Integration] Matched the deployed Q/A ingest allowlist**
- **Found during:** integration review against Plan 03/05 backend
- **Issue:** Local `QuestionAnswerRecord` correctly retains fixed condition, while the deployed collector rejects client Q/A `condition` and derives it from the server account map.
- **Fix:** Omit condition only while serializing Q/A onto the wire; preserve it locally and test both sides of the boundary.
- **Committed in:** `fadd18f`

---

**Total deviations:** 2 auto-fixed (1 data-loss race, 1 blocking wire-contract mismatch).
**Impact on plan:** Both fixes strengthen the required durable collection path without expanding participant behavior or changing backend/deployment configuration.

## TDD Gate Compliance

- **RED:** `d5e4063` added the full behavioral suite; it failed because `upload-queue.service.ts` did not exist.
- **GREEN:** `2a068af` implemented the minimal durable queue and metadata services; all focused tests passed.
- **REFACTOR:** No separate refactor was necessary. The later `fadd18f` is a tested integration correction, not structural cleanup.

## Issues Encountered

- The repository `npm test` script uses Unix `$(find ...)` syntax and is not PowerShell-compatible. The equivalent PowerShell-expanded run executed 851 tests: 845 passed and six unrelated pre-existing source-contract tests failed (BottomSheet proximity, two ChatInput guards, BottomSheet consumer autoFocus scan, and two post-history source contracts). The new upload-queue suite passed in the full run.
- `git diff --check` across the entire dirty worktree reports unrelated pre-existing `.codex` whitespace changes. Scoped plan files pass whitespace checks.

## User Setup Required

None for this plan. The already-deployed public collector URL remains a build-time `VITE_RESEARCH_API_BASE_URL` value and was not written to source, tests, planning output, or commits.

## Verification

- `cd app && node --test tests/services/upload-queue.service.test.mjs` — passed (13 tests).
- `cd app && npx tsc -b --noEmit` — passed.
- `cd app && npm run lint` — passed with 26 pre-existing warnings and zero errors.
- `cd app && npm run build` — passed.
- Full PowerShell-expanded Node suite — 845 passed; six documented unrelated pre-existing failures.
- No real `/v1/ingest` call was made; every fetch in the plan suite was mocked.

## Next Phase Readiness

- Plan 07 can persist each validated interaction/Q&A record and call `enqueue`; the queue owns offline durability and eventual upload.
- Plan 09 can hydrate/read upload metadata, subscribe to `UPLOAD_STATUS_CHANGED`, and register retry triggers for diagnostics and app lifecycle coverage.

## Self-Check: PASSED

- Confirmed both required source artifacts and the focused test artifact exist.
- Confirmed RED then GREEN commits are present in order.
- Confirmed no Worker URL, D1 identifier, account, password, key, or PIN appears in the plan files.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
