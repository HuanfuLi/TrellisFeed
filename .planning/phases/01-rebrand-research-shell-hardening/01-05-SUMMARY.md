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
  - "Operator-verified fixed HTTPS deployment backed by the migrated D1 database and a server-side admin secret."
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
    description: "A fixed HTTPS Worker deployment with a real D1 binding, server-side password, and researcher smoke test using a temporary private account fixture."
    verification:
      - kind: human
        ref: "Operator deployment checkpoint: migration, protected admin routes, two-file export, account resolution, ingest acknowledgement, and server-owned context were verified against the live Worker."
        status: pass
    human_judgment: true
    rationale: "The operator completed the Cloudflare-authenticated deployment and live smoke test without committing the fixed URL, D1 identifier, credentials, or temporary account fixture. Real study-account provisioning remains a study-operations step."

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
- **Tasks:** 2 local implementation tasks and 1 Cloudflare deployment checkpoint completed
- **Files modified:** 7 implementation files

## Accomplishments

- Added exact-version `fflate@0.8.3` and a stable, injection-safe CSV/ZIP builder that always emits `behavioral-events.csv` and `question-answer-records.csv`.
- Added `GET /admin` and `GET /admin/export.zip`, both protected by HTTP Basic authentication against `RESEARCH_ADMIN_PASSWORD`, a Worker-only secret.
- Kept the researcher surface read-only and health-only: counts plus latest receipt time, escaped dynamic output, `no-store` responses, attachment export, and no participant Q/A content.
- Deployed the Worker against the migrated D1 database and completed the live authorization, archive, account-resolution, ingest-acknowledgement, and server-owned context smoke tests.

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

- npm reported existing deferred install-script approvals for transitive Wrangler tooling packages during local implementation. The operator subsequently approved the required Wrangler use and completed the Cloudflare deployment checkpoint successfully.

## User Setup Required

**Deployment setup is complete.** See [01-USER-SETUP.md](./01-USER-SETUP.md) for the remaining study-operations steps: privately batch-provision the real numeric research accounts and inject the already-deployed Worker URL when building the participant app package.

## Verification

- `cd research-backend && node --test test/export.test.mjs` — passed (3 tests).
- `cd research-backend && node --test test/admin-auth.test.mjs` — passed (5 tests).
- `cd research-backend && npm test` — passed (19 tests).
- `git diff --check 5491ad4^..HEAD` — passed with no whitespace errors.
- Live D1 migration and Worker deployment — completed by the authenticated operator.
- Live unauthenticated checks — `/admin` and `/admin/export.zip` both returned HTTP 401.
- Live authenticated checks — the health-only status page loaded and the ZIP contained exactly `behavioral-events.csv` and `question-answer-records.csv`.
- Live ingest closure — a temporary numeric account resolved successfully, an `app_open` record was acknowledged, and server-owned condition/topic values were enforced; the temporary account and test event were then removed.

## Next Phase Readiness

- The protected researcher backend is deployed and its collection/export path has passed the live smoke test.
- Before participant builds are produced, the research team must privately batch-provision the real numeric account-to-condition/topic mappings and inject the fixed Worker URL as `VITE_RESEARCH_API_BASE_URL` at package build time.

## Self-Check: PASSED

- Confirmed both archive filenames, CSV formula escaping, correct auth-before-read behavior, aggregate-only health fields, read-only admin methods, and no-store export headers through executable tests.
- Confirmed the live deployment and end-to-end smoke test without recording an actual password, URL, D1 identifier, account mapping, client key, or researcher PIN in the repository.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
