---
phase: 01-rebrand-research-shell-hardening
plan: 11
subsystem: research-auth-collection
tags: [consent, cors, installation-token, cloudflare-workers, d1, csv-security]

requires:
  - phase: 01-03
    provides: "D1 collector schema and public ingest baseline."
  - phase: 01-04
    provides: "Immutable numeric research identity and setup gate."
  - phase: 01-05
    provides: "Protected researcher status and two-CSV export."
  - phase: 01-07
    provides: "Durable interaction record authoring."
  - phase: 01-09
    provides: "Minimal participant surface and hidden diagnostics."
provides:
  - "Affirmative-consent route and zero-write gates before participant access or research logging."
  - "Authenticated one-install enrollment with hashed, revocable D1 tokens and server-derived study identity."
  - "Exact-origin browser/WebView CORS, identity-free ingest, collision protection, and CSV formula neutralization."
  - "Sanitized live-deployment evidence with temporary remote data verified removed."
affects: [phase-1-plan-12, upload-queue, interaction-logging, research-backend, phase-1-plan-13]

tech-stack:
  added: []
  patterns: [affirmative-consent defense-in-depth, one-time opaque install token, server-derived identity, exact-origin cors, sanitized deployment evidence]

key-files:
  created:
    - shared/research-wire-contract.v1.json
    - app/src/services/research-consent.service.ts
    - research-backend/migrations/0002_install_tokens.sql
    - research-backend/test/cors-auth.test.mjs
    - .planning/phases/01-rebrand-research-shell-hardening/01-DEPLOYMENT-SMOKE.md
  modified:
    - app/src/App.tsx
    - app/src/screens/ResearchSetupScreen.tsx
    - app/src/screens/OnboardingScreen.tsx
    - app/src/services/research-config.ts
    - app/src/services/study-context.service.ts
    - app/src/services/interaction-log.service.ts
    - research-backend/src/worker.ts
    - research-backend/src/validation.ts
    - research-backend/src/export.ts

key-decisions:
  - "Numeric account IDs are enrollment inputs only; a separately provisioned build credential and one-install token protect resolution and ingest."
  - "The server derives account, condition, and topic from the token and rejects identity fields in the request body."
  - "Only exact approved origins receive CORS grants; CORS never substitutes for authentication."
  - "Local research-build credentials live in git-ignored app/.env.local and are never recorded in planning evidence."

patterns-established:
  - "Participant access and every logging write independently require persisted affirmative consent."
  - "Live smoke evidence records only sanitized outcomes and proves temporary remote rows return to zero."

requirements-completed: [SHELL-03, LOG-01, RQ-01]

coverage:
  - id: D1
    description: "Participant routes and research writes remain blocked until affirmative consent."
    requirement: SHELL-03
    verification:
      - kind: integration
        ref: "app/tests/phase1/consent-gate.test.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Authenticated enrollment returns one installation token and ingest derives study identity server-side."
    requirement: LOG-01
    verification:
      - kind: integration
        ref: "research-backend/test/cors-auth.test.mjs and sanitized live deployment smoke"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exact-origin CORS, negative authentication paths, CSV safety, and cleanup are enforced."
    requirement: LOG-01
    verification:
      - kind: e2e
        ref: ".planning/phases/01-rebrand-research-shell-hardening/01-DEPLOYMENT-SMOKE.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Signed native WebView collection path on the participant device."
    requirement: RQ-01
    verification: []
    human_judgment: true
    rationale: "Requires the final signed-device installation and is intentionally retained for the Phase 01 closing checkpoint in Plan 13."

duration: 1h 45m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 11: Consent and Collection Trust Boundary Summary

**QuestionTrace now gates participant access and logging on affirmative consent, enrolls each installation with an authenticated opaque token, derives study identity on the server, and supports exact-origin browser/WebView collection without exposing study assignment on the wire.**

## Performance

- **Duration:** 1h 45m including live deployment recovery
- **Completed:** 2026-07-11
- **Tasks:** 4
- **Automated backend result:** 29/29 passed

## Accomplishments

- Added a defense-in-depth consent policy: participant routing redirects to onboarding until consent is persisted, and interaction logging refuses pre-consent writes.
- Replaced public numeric-account resolution and identity-bearing ingest with authenticated enrollment, hashed/revocable per-install tokens, server-derived identity, and cross-account collision checks.
- Added exact-origin CORS/OPTIONS handling, identity-free wire contracts, CSV formula neutralization after whitespace/control prefixes, and regression coverage.
- Applied the token migration and verified the deployed browser path end to end; temporary account, installation, event, and Q/A rows were all removed and queried back as zero.

## Task Commits

1. **Task 1 RED: consent bypass coverage** — `ba48ec7` (test)
2. **Task 1 GREEN: affirmative consent enforcement** — `aaad3fd` (feat)
3. **Task 2 RED: installation authentication coverage** — `9bd9f5c` (test)
4. **Task 2 GREEN: authenticated installation-owned ingest** — `ac69a98` (feat)
5. **Task 3 RED: CORS and CSV hardening coverage** — `679908c` (test)
6. **Task 3 GREEN: exact-origin CORS and safe CSV export** — `c90afed` (feat)
7. **Deployment deviation: credential interoperability and diagnostic text** — `70c56c1` (fix)

## Files Created/Modified

- `shared/research-wire-contract.v1.json` — versioned route, field, and request-limit contract.
- `app/src/services/research-consent.service.ts` — affirmative-consent predicate and participant-route decision helper.
- `app/src/services/research-config.ts` — validated build configuration with an explicit minimum credential-length diagnostic.
- `app/src/services/study-context.service.ts` — authenticated enrollment and persisted installation token.
- `app/src/services/interaction-log.service.ts` — pre-consent zero-write guard.
- `research-backend/migrations/0002_install_tokens.sql` — hashed/revocable installation-token persistence.
- `research-backend/src/worker.ts` — enrollment authentication, token-owned ingest, exact CORS, and opaque credential handling.
- `research-backend/src/export.ts` — spreadsheet-safe CSV cell neutralization.
- `.planning/phases/01-rebrand-research-shell-hardening/01-DEPLOYMENT-SMOKE.md` — sanitized remote verification evidence.

## Decisions Made

- Enrollment credentials are build/operator provisioning material, while returned installation tokens are unique per installation and stored only as hashes server-side.
- Public requests never supply `userId`, condition, or topic; the backend derives all three from the authenticated installation.
- The development credential is persisted only in the standard git-ignored Vite local environment file so normal local startup remains usable without leaking it into the repository.

## Deviations from Plan

### Auto-fixed Issues

**1. Standard Base64 credential interoperability**
- **Found during:** Task 4 live deployment smoke.
- **Issue:** A securely generated opaque standard-Base64 credential was rejected by the Worker boundary.
- **Fix:** Accepted the intended opaque credential alphabet and added a regression test without embedding real secret material.
- **Files modified:** `research-backend/src/worker.ts`, `research-backend/test/validation.test.mjs`.
- **Verification:** Backend suite 29/29 and live authenticated enrollment passed.
- **Committed in:** `70c56c1`.

**2. Misleading short-credential diagnostic**
- **Found during:** Local browser smoke.
- **Issue:** Values shorter than 16 characters were reported only as missing.
- **Fix:** The client now reports the explicit minimum length.
- **Files modified:** `app/src/services/research-config.ts`.
- **Verification:** TypeScript, lint, build, and targeted app tests passed.
- **Committed in:** `70c56c1`.

**Total deviations:** 2 auto-fixed correctness/diagnostic issues. Both were required to exercise the planned secure enrollment path; no participant feature scope was added.

## Issues Encountered

- PowerShell's text pipeline changed the enrollment-secret byte representation during non-interactive Wrangler input. A Node child process supplied the exact UTF-8 bytes with no BOM or newline, after which the Secret Change version served authenticated enrollment successfully.
- The final executor hit its provider usage limit after completing verification but before writing this summary. GSD safe-resume spot-checks confirmed the code commit and sanitized smoke artifact, so the orchestrator closed out metadata without repeating remote writes.

## Verification

- Backend test suite — 29/29 passed.
- App consent/study-context/interaction-log targeted tests — passed.
- App TypeScript, lint, and production build — passed.
- Approved browser-origin preflight, enrollment, identity-free ingest, wrong-token rejection, disallowed-origin rejection, and unauthenticated admin protection — passed.
- Temporary account, installation, behavioral event, and Q/A cleanup — verified zero remaining rows.
- Signed native WebView validation — deferred to Plan 13's final device checkpoint.

## User Setup Required

None. Local research configuration is already stored in a git-ignored Vite environment file; no secret value is recorded here.

## Next Phase Readiness

- Plan 12 can build authenticated self-draining upload semantics on the installation-token contract.
- Plan 13 retains the final signed-device smoke and zero-failure phase gate.

## Self-Check: PASSED

- Confirmed all seven implementation/test commits exist.
- Confirmed no secret, endpoint, origin, database identifier, account identifier, token, password, or key appears in the smoke evidence or summary.
- Confirmed the temporary browser smoke helper was removed rather than shipped in the participant app.
- Confirmed all temporary remote rows were queried back as zero before closeout.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
