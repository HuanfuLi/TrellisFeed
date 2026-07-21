---
phase: 01-rebrand-research-shell-hardening
plan: 03
subsystem: api
tags: [cloudflare-workers, d1, wrangler, validation, ingest]

requires: []
provides:
  - "Standalone research-backend Worker package with a pinned local Wrangler toolchain and D1-only binding declaration."
  - "Schema for server-owned research accounts, behavioral events, Q/A revisions, and upload receipts without any provisioned account data."
  - "Validated install resolution and idempotent ingest behavior covered by fake-D1 unit tests."
affects: [phase-1-log-upload-client, researcher-admin-export, authorized-cloudflare-deployment]

tech-stack:
  added: ["wrangler@4.110.0"]
  patterns: ["parameterized D1 writes", "server-derived account condition/topic", "idempotent immutable event acknowledgement"]

key-files:
  created:
    - research-backend/package.json
    - research-backend/wrangler.jsonc
    - research-backend/migrations/0001_init.sql
    - research-backend/src/validation.ts
    - research-backend/src/worker.ts
    - research-backend/test/validation.test.mjs
    - research-backend/test/ingest.test.mjs
  modified: []

key-decisions:
  - "Pin the locally installed Wrangler development dependency to exactly 4.110.0 after explicit user approval, with install scripts disabled."
  - "Keep the Worker configuration limited to the DB binding; no database ID, study URL, secret, PIN, password, or account mapping is committed."
  - "Defer D1 provisioning, real account provisioning, Worker secrets, and deployment until a separate explicit authorization."

patterns-established:
  - "Public ingest accepts only a bounded allowlisted record schema and re-derives condition/topic from the server account map."
  - "Lost-response retries are safe through immutable event IDs and revision-guarded Q/A upserts."

requirements-completed: [LOG-01]

coverage:
  - id: D1
    description: "Strict public install resolution and idempotent research record ingestion with server-owned account assignment."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "research-backend/test/validation.test.mjs and research-backend/test/ingest.test.mjs via npm test"
        status: pass
    human_judgment: false
  - id: D2
    description: "Git-safe standalone Worker package, D1 schema, and pinned local toolchain."
    requirement: LOG-01
    verification:
      - kind: other
        ref: "migration structure check and npx wrangler --version"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real Cloudflare D1 collection endpoint and researcher access configuration."
    verification: []
    human_judgment: true
    rationale: "External resource creation, secrets, account provisioning, and deployment were intentionally deferred pending separate authorization."

duration: 22m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 03: Research Collector Backend Summary

**A standalone Worker backend now validates research logs, resolves server-owned account assignments, and safely acknowledges idempotent retries against a D1 schema.**

## Performance

- **Duration:** 22m
- **Started:** 2026-07-10T23:44:44-04:00
- **Completed:** 2026-07-11T00:06:58-04:00
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added the standalone `research-backend` package with `wrangler@4.110.0` pinned exactly, install scripts disabled, and no browser/Capacitor dependencies.
- Added a non-sensitive Worker configuration, local variable example, ignore rules, and D1 migration for research accounts, behavioral events, Q/A revisions, and upload receipts.
- Preserved the completed strict validation, account resolution, and idempotent ingest implementation with 11 passing fake-D1 unit tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold the research-backend package, D1 schema, and non-secret config** — `dc9a131` (feat)
2. **Task 2: Request validation + install-resolve endpoint (fake-D1 unit tests)** — `3e8dce5`, `a35f72f` (test → feat)
3. **Task 3: Idempotent batch ingest with server ACK (fake-D1 unit tests)** — `fc6c439`, `7515c5d` (test → feat)

## Files Created/Modified

- `research-backend/package.json` and `package-lock.json` — independent ESM test package and pinned Wrangler development toolchain.
- `research-backend/wrangler.jsonc` — Worker entry point with only the `DB` D1 binding declaration.
- `research-backend/.dev.vars.example` and `.gitignore` — local-only placeholder convention and secret/runtime exclusions.
- `research-backend/migrations/0001_init.sql` — four empty D1 tables; real study accounts remain an operator-only out-of-repository step.
- `research-backend/src/validation.ts` and `src/worker.ts` — strict input validation, account resolution, and idempotent D1 ingest handlers.
- `research-backend/test/validation.test.mjs` and `test/ingest.test.mjs` — fake-D1 regression coverage.

## Decisions Made

- Installed exactly `wrangler@4.110.0` only after the user's explicit approval, with `--ignore-scripts` used at install time.
- Retained no live D1 identifier or study endpoint in configuration; the committed binding is just `DB`.
- Kept all cloud-side actions outside this execution: no Cloudflare login, D1 creation, Worker deploy, secret configuration, or real account-map provisioning occurred.

## Deviations from Plan

None - plan implementation and the explicit package-approval gate were followed as specified.

## Issues Encountered

None. The first local test command ran successfully after the standalone package was scaffolded; all 11 tests pass.

## User Setup Required

External deployment is deliberately deferred pending a separate explicit authorization. At that future authorization point, an operator must create and bind the D1 database, provision the actual numeric account map outside the repository, set the server-side researcher password, and deploy the Worker. None of those actions were performed here.

## Verification

- `cd research-backend && npm test` — passed (11 tests).
- D1 migration structure check — passed; all four tables and the required condition constraint exist, with no account inserts.
- `cd research-backend && npx wrangler --version` — passed (`4.110.0`).
- Sensitive-value scan of backend source/config (excluding the package-manager lockfile) — passed; no database ID, real account rows, secret value, or non-placeholder study URL found.

## Next Phase Readiness

- The mobile upload queue can target the already-defined `/v1/install/resolve` and `/v1/ingest` Worker routes once its build-time configuration is supplied.
- The protected researcher page/export and any real Cloudflare provisioning remain unavailable until separately authorized.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
