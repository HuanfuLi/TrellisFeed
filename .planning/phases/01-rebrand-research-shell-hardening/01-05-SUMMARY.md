---
phase: 01-rebrand-research-shell-hardening
plan: 05
subsystem: research-backend
tags: [cloudflare-worker, d1, basic-auth, csv, zip, fflate]

requires:
  - phase: 01-03
    provides: "Validated Worker ingest routes, D1 schema, and an unprovisioned DB binding."
provides:
  - "Password-protected, read-only researcher status and aggregate ZIP export routes."
  - "Formula-safe CSV serialization and exactly two deterministic archive entries."
  - "Local regression coverage for authorization-before-query, escaped HTML, read-only methods, and archive response headers."
affects: [cloudflare-deployment, research-admin-export, phase-1-upload-collection]

tech-stack:
  added: ["fflate@0.8.3"]
  patterns: ["server-secret Basic authentication", "health-only aggregate status", "formula-safe CSV attachment export"]

key-files:
  created:
    - research-backend/src/export.ts
    - research-backend/src/admin.ts
    - research-backend/test/export.test.mjs
    - research-backend/test/admin-auth.test.mjs
  modified:
    - research-backend/package.json
    - research-backend/package-lock.json
    - research-backend/src/worker.ts

key-decisions:
  - "The central page exposes upload-health aggregates only; it does not render participant questions or answers."
  - "Both researcher routes authorize through a Worker secret before performing any D1 query, and accept GET only."
  - "The approved archive dependency is pinned exactly at fflate@0.8.3 so future installs cannot silently change the reviewed package version."

patterns-established:
  - "Every aggregate export must use stable column lists plus formula-safe CSV cell escaping before ZIP creation."
  - "Admin routes authenticate before reads and remain deliberately read-only; export is an attachment with no-store caching."

requirements-completed: [LOG-01]

coverage:
  - id: D1
    description: "Formula-safe CSV serialization and a ZIP with exactly the required behavioral-events and question-answer-records files."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "research-backend/test/export.test.mjs via node --test test/export.test.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Server-secret Basic authorization, health-only status rendering, read-only routes, and protected ZIP response behavior."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "research-backend/test/admin-auth.test.mjs via node --test test/admin-auth.test.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: "A fixed HTTPS Worker deployment with a real D1 binding, server-side password, private account map, and researcher smoke test."
    verification: []
    human_judgment: true
    rationale: "Cloudflare resource provisioning, private credentials, account mappings, and the fixed study URL deliberately require the operator and were not run by this autonomous-false plan."

duration: 5m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 05: Protected Researcher Export Summary

**The research collector now exposes a Worker-secret-protected health page and a formula-safe, two-CSV ZIP export without exposing participant data to the mobile app.**

## Performance

- **Duration:** 5m
- **Started:** 2026-07-11T04:24:12Z
- **Completed:** 2026-07-11T04:29:31Z
- **Tasks:** 2 local implementation tasks completed; 1 Cloudflare deployment checkpoint pending
- **Files modified:** 7 implementation files

## Accomplishments

- Added exact-version `fflate@0.8.3` and a stable, injection-safe CSV/ZIP builder that always emits `behavioral-events.csv` and `question-answer-records.csv`.
- Added `GET /admin` and `GET /admin/export.zip`, both protected by HTTP Basic authentication against `RESEARCH_ADMIN_PASSWORD`, a Worker-only secret.
- Kept the researcher surface read-only and health-only: counts plus latest receipt time, escaped dynamic output, `no-store` responses, attachment export, and no participant Q/A content.

## Task Commits

Each task was committed atomically:

1. **Task 1: CSV escaping + two-entry ZIP export** — `5491ad4` (test, RED) → `2ae3333` (feat, GREEN) → `f070a76` (fix: exact audited dependency pin)
2. **Task 2: Basic-auth admin guard + status page + export route** — `1d11fb8` (test, RED) → `bb4ae21` (feat, GREEN) → `68ab54a`, `3ba5942` (acceptance-coverage tests)

## Files Created/Modified

- `research-backend/src/export.ts` — stable CSV columns, formula escaping, and the two-entry ZIP builder.
- `research-backend/src/admin.ts` — Basic-auth guard, constant-time-ish comparison, safe status HTML, and aggregate-only rendering.
- `research-backend/src/worker.ts` — protected `GET /admin` and `GET /admin/export.zip` route dispatch and aggregate D1 queries.
- `research-backend/test/export.test.mjs` and `test/admin-auth.test.mjs` — archive round-trip, injection, authorization, read-only-route, status, and response-header coverage.
- `research-backend/package.json` and `package-lock.json` — exact audited `fflate@0.8.3` dependency.

## Decisions Made

- The health page intentionally omits participant-authored question/answer text; this is stricter than merely escaping it and keeps the central UI within the approved health-only scope.
- Missing/invalid credentials return HTTP 401 before any D1 statement is prepared, and non-GET admin requests return HTTP 405 without a database query.
- CSV formula prefixing covers values beginning with `=`, `+`, `-`, or `@`; comma, quote, and newline values are RFC-4180-style quoted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Pinned the reviewed ZIP dependency exactly**
- **Found during:** Task 1 (CSV escaping + two-entry ZIP export)
- **Issue:** npm's default range (`^0.8.3`) could later resolve an unreviewed version despite the plan approving a specific audited package version.
- **Fix:** Changed the direct dependency to exact `fflate@0.8.3`; the lockfile already resolved that release.
- **Files modified:** `research-backend/package.json`, `research-backend/package-lock.json`
- **Verification:** `cd research-backend && npm test` passed (19 tests).
- **Committed in:** `f070a76`

---

**Total deviations:** 1 auto-fixed (1 missing critical dependency-pin safeguard).
**Impact on plan:** Improves supply-chain reproducibility without expanding scope or adding external access.

## TDD Gate Compliance

- **Task 1 RED:** `5491ad4` failed because `src/export.ts` did not yet exist; **GREEN:** `2ae3333` passed the formula, quoting, and ZIP round-trip tests.
- **Task 2 RED:** `1d11fb8` failed because `/admin*` had no routes; **GREEN:** `bb4ae21` passed Basic-auth, status, and export tests. Later acceptance tests passed for read-only methods and HTML escaping.

## Issues Encountered

- npm reported existing deferred install-script approvals for transitive Wrangler tooling packages. No such script was approved or run in this plan, and the Node test path does not use Wrangler. This is not a deployment blocker for the local implementation; Cloudflare deployment remains the explicit operator checkpoint below.

## User Setup Required

**External services require manual configuration.** See [01-USER-SETUP.md](./01-USER-SETUP.md) for the private D1 binding, migration, Worker secret, private account provisioning, deployment, and smoke-test steps.

## Verification

- `cd research-backend && node --test test/export.test.mjs` — passed (3 tests).
- `cd research-backend && node --test test/admin-auth.test.mjs` — passed (5 tests).
- `cd research-backend && npm test` — passed (19 tests).
- `git diff --check 5491ad4^..HEAD` — passed with no whitespace errors.

## Next Phase Readiness

- The local backend implementation is ready for the mobile upload queue and the researcher-page deployment checkpoint.
- Deployment is intentionally not complete: no Cloudflare login, D1 creation/migration application, remote account provisioning, Worker secret configuration, deploy, real URL, or app build configuration was performed.

## Self-Check: PASSED

- Confirmed both archive filenames, CSV formula escaping, correct auth-before-read behavior, aggregate-only health fields, read-only admin methods, and no-store export headers through executable tests.
- Confirmed no actual password, URL, account mapping, client key, or researcher PIN was created or committed by this plan.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
