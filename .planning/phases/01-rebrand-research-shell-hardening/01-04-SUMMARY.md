---
phase: 01-rebrand-research-shell-hardening
plan: 04
subsystem: research-identity
tags: [react, typescript, indexeddb, study-condition, install-gate]

requires:
  - phase: 01-02
    provides: "QuestionTrace database namespace and durable research_metadata store."
provides:
  - "Immutable, durable ResearchIdentity bound once from a researcher-resolved account assignment."
  - "Privacy-bounded research record types and validated non-secret client build configuration."
  - "Researcher setup route and hydration gate that blocks all participant routes until identity binding."
affects: [phase-1-interaction-logging, upload-queue, researcher-diagnostics, condition-aware-feed]

tech-stack:
  added: []
  patterns: ["bind-once durable identity", "server-resolved installation assignment", "hydration-before-route-gate"]

key-files:
  created:
    - app/src/types/research.ts
    - app/src/services/research-config.ts
    - app/src/services/study-context.service.ts
    - app/src/screens/ResearchSetupScreen.tsx
    - app/src/screens/ResearchDiagnosticsScreen.tsx
    - app/tests/services/study-context.service.test.mjs
  modified:
    - app/src/types/index.ts
    - app/src/App.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json

key-decisions:
  - "The client receives condition and topic only through the install-resolve response; the setup UI never exposes either choice."
  - "Study identity is frozen in a synchronous mirror after one durable metadata write; matching rebinds are no-ops and any differing rebind is rejected."
  - "Every VITE_ value used by research config is explicitly public: collection base URL plus optional SHA-256 PIN digest only."

patterns-established:
  - "Services that require participant context read studyContextService.getRequired() after App hydration instead of accepting a mutable condition argument."
  - "Participant route trees are wrapped by ParticipantRouteGate so direct deep links cannot bypass researcher installation binding."

requirements-completed: [SHELL-03]

coverage:
  - id: D1
    description: "Privacy-bounded research identity, event, and question/answer contracts with public-only build configuration."
    requirement: SHELL-03
    verification:
      - kind: other
        ref: "cd app && npx tsc -b --noEmit"
        status: pass
    human_judgment: true
    rationale: "A research installation still needs a real build-time public endpoint injected; no actual study URL or credential may be committed or exercised locally."
  - id: D2
    description: "Durable bind-once study context with conflict rejection and identity-bound event emission."
    requirement: SHELL-03
    verification:
      - kind: unit
        ref: "app/tests/services/study-context.service.test.mjs#study context binds one durable identity and rejects a conflicting re-bind"
        status: pass
    human_judgment: false
  - id: D3
    description: "Researcher account-install route and identity hydration gate for all participant routes."
    requirement: SHELL-03
    verification:
      - kind: other
        ref: "cd app && npx tsc -b --noEmit && npm run lint && npm run build"
        status: pass
    human_judgment: true
    rationale: "A fresh-install and deep-link flow needs device/browser UAT with a deliberately configured resolve endpoint."

duration: 9m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 04: Immutable Study Context and Installation Gate Summary

**A researcher-resolved numeric account now creates one durable condition/topic identity, and no participant route renders until that identity has hydrated.**

## Performance

- **Duration:** 9m
- **Started:** 2026-07-11T04:12:07Z
- **Completed:** 2026-07-11T04:20:36Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added the complete privacy-bounded research schemas: immutable identity, 16 allowed interaction types, separate revisioned question/answer records, and the two research lifecycle events.
- Added public-only research build configuration and a durable `studyContextService` that reads `research_metadata`, synchronously exposes the hydrated identity, emits its one semantic bind event, and rejects a conflicting re-bind.
- Added the researcher account-binding flow, an unlinked diagnostics stub route, and a participant-route hydration gate; removed the four retired settings sub-routes from the active router.

## Task Commits

Each task was committed atomically:

1. **Task 1: Research types + non-secret research-config + event-union additions** — `2312d52` (feat)
2. **Task 2: Immutable study-context service (bind-once, hydrate, read-only)** — `afd7475` (test, RED) → `31e8db0` (feat, GREEN)
3. **Task 3: Researcher setup screen, diagnostics stub, and App.tsx hydration gate** — `3e7576a` (feat)

## Files Created/Modified

- `app/src/types/research.ts` and `app/src/types/index.ts` — research contracts and the new bind/upload event-union entries.
- `app/src/services/research-config.ts` — validation for only a public collector base URL and optional PIN SHA-256 digest.
- `app/src/services/study-context.service.ts` — immutable durable identity mirror backed by `research_metadata`.
- `app/src/screens/ResearchSetupScreen.tsx` — neutral numeric account entry and server-resolved binding; `ResearchDiagnosticsScreen.tsx` — route placeholder for the later PIN-gated diagnostics implementation.
- `app/src/App.tsx` — awaited study-context hydration, direct-link participant gate, researcher routes, and removal of old settings sub-route registrations.
- `app/tests/services/study-context.service.test.mjs` — behavioral persistence, fresh-mirror hydration, conflict-rejection, and no-mutable-surface coverage.
- `app/src/locales/{en,zh,es,ja}.json` — locale-parity copy for the added researcher routes.

## Decisions Made

- Kept the account identifier as a string of digits, preserving leading zeroes while enforcing the neutral numeric-account contract.
- Validated and froze identity data before caching it, so a reader cannot mutate the service's synchronous state after binding.
- Added locale-parity copy for the new researcher screens, as required for every user-visible app string even though these routes are researcher-led.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Localized the newly visible researcher routes**
- **Found during:** Task 3 (Researcher setup screen, diagnostics stub, and App.tsx hydration gate)
- **Issue:** The task's file list omitted locale bundles, but repository policy requires every visible string to land in all four locale bundles.
- **Fix:** Added the setup and diagnostics-placeholder keys to English, Chinese, Spanish, and Japanese bundles.
- **Files modified:** `app/src/locales/en.json`, `zh.json`, `es.json`, `ja.json`
- **Verification:** `node --test tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` passed.
- **Committed in:** `3e7576a` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical localization requirement).
**Impact on plan:** Required for locale parity; no expansion of participant capabilities or research controls.

## TDD Gate Compliance

- **RED:** `afd7475` added a behavioral test against a deliberately non-persisting service scaffold; it failed because `bindOnce` had not written the metadata row.
- **GREEN:** `31e8db0` implemented the durable bind-once service; the test passed through the `dbQuery` seam.

## Issues Encountered

- `npm test` is not PowerShell-compatible because its script uses Unix `$(find ...)` substitution. An equivalent PowerShell-expanded full Node run executed 839 tests: 833 passed and six unrelated, pre-existing source-contract tests failed (BottomSheet overscroll proximity, ChatInput guards, BottomSheet consumer grep portability, and post-history function-body contracts). The new study-context test passed in that run.
- `npm run lint` passed with 26 pre-existing warnings and no errors. `npm run build` passed.

## User Setup Required

None - this local plan created no cloud resource or real study configuration. A research build must later inject only its public collector base URL (and optional PIN digest); no actual URL, account, PIN, password, or API key was created or committed.

## Next Phase Readiness

- Interaction logging and upload-queue work can obtain mandatory `userId`, `condition`, and `topicId` through `studyContextService.getRequired()`.
- The researcher setup flow is ready to use the existing `/v1/install/resolve` contract once deployment is explicitly authorized and a public build endpoint is supplied.
- Plan 09 can replace the diagnostics stub with its PIN gate and non-destructive recovery export without adding account/condition controls.

## Self-Check: PASSED

- Confirmed all plan artifacts exist and all participant routes route through the hydrated identity gate.
- Confirmed `RESEARCH_IDENTITY_BOUND`, `UPLOAD_STATUS_CHANGED`, and the exact public configuration variables are present.
- Passed focused study-context tests, TypeScript, locale-parity tests, lint (warnings only), and production build.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
