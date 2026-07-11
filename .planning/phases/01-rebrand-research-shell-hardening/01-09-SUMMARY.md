---
phase: 01-rebrand-research-shell-hardening
plan: 09
subsystem: research-ui
tags: [react, typescript, indexeddb, subtlecrypto, localization]

requires:
  - phase: 01-04
    provides: "Immutable numeric research identity, hidden diagnostics route, and validated public PIN digest configuration."
  - phase: 01-06
    provides: "Durable upload-health metadata and UPLOAD_STATUS_CHANGED re-read event."
  - phase: 01-07
    provides: "Per-participant durable research_records used by local recovery export."
provides:
  - "Participant Settings limited to read-only numeric account ID and immediate four-language selection."
  - "PIN-gated, non-destructive local diagnostics with upload health and participant-scoped recovery export."
  - "Participant onboarding without provider or credential entry."
affects: [research-build-packaging, participant-uat, local-data-recovery]

tech-stack:
  added: []
  patterns: ["SubtleCrypto digest UI gate", "event-bus status re-read", "participant-scoped recovery export"]

key-files:
  created:
    - app/src/services/research-export.service.ts
    - app/tests/phase1/participant-surface.test.mjs
  modified:
    - app/src/screens/SettingsScreen.tsx
    - app/src/screens/ResearchDiagnosticsScreen.tsx
    - app/src/screens/OnboardingScreen.tsx
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json

key-decisions:
  - "Researcher diagnostics is a local UI gate only: a configured SHA-256 PIN digest unlocks status and recovery export, but grants no server, destructive, identity, or condition power."
  - "Recovery export parses durable research_records and includes only records whose userId matches the installation's immutable bound identity."
  - "D-12 resolves the credential checkpoint: study credentials are supplied by the research build, so participant onboarding ends after consent and never requests a provider or key."

patterns-established:
  - "Participant-surface tests assert both required controls and forbidden affordances, preventing retired configuration surfaces from returning."
  - "Hidden diagnostics subscribes to UPLOAD_STATUS_CHANGED and re-reads the durable metadata mirror instead of trusting event payload as state."

requirements-completed: [SHELL-04, LOG-01]

coverage:
  - id: D1
    description: "Participant Settings contains only the immutable numeric account ID and immediate English/Chinese/Spanish/Japanese language selection; four inherited settings screens and routes stay absent."
    requirement: SHELL-04
    verification:
      - kind: integration
        ref: "app/tests/phase1/participant-surface.test.mjs#participant settings exposes only numeric account identity and language"
        status: pass
      - kind: other
        ref: "cd app && npx tsc -b --noEmit && npm run lint && npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hidden researcher diagnostics uses a SHA-256 PIN gate, re-reads pending/last-success status, and exports only the current participant's local records without destructive or configuration controls."
    requirement: LOG-01
    verification:
      - kind: integration
        ref: "app/tests/phase1/participant-surface.test.mjs#research diagnostics is PIN-gated and non-destructive"
        status: pass
      - kind: unit
        ref: "app/tests/phase1/participant-surface.test.mjs#local recovery export contains only durable records for the bound participant"
        status: pass
    human_judgment: true
    rationale: "A device UAT must still confirm the configured PIN keyboard flow, localized timestamps, and native download behavior."
  - id: D3
    description: "Participant onboarding completes directly after consent and contains no provider or credential entry."
    requirement: SHELL-04
    verification:
      - kind: integration
        ref: "app/tests/phase1/participant-surface.test.mjs#participant onboarding never asks for a provider or credential"
        status: pass
    human_judgment: false

duration: 8m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 09: Minimal Participant Settings and Research Diagnostics Summary

**Participants now see only their numeric account and language control, while researchers get a PIN-gated, non-destructive upload-health and per-participant recovery surface.**

## Performance

- **Duration:** 8m
- **Started:** 2026-07-11T05:45:23Z
- **Completed:** 2026-07-11T05:52:58Z
- **Tasks:** 3 plus resolved credential checkpoint
- **Files modified:** 16

## Accomplishments

- Reduced participant Settings to a read-only neutral numeric account ID and the four immediate locale choices, deleting the four inherited configuration sub-screens.
- Added a fail-closed SHA-256 PIN gate, upload-health re-read, and current-participant-only JSON recovery export to the hidden diagnostics route.
- Removed participant provider/API-key onboarding under locked D-12 build-supplied credentialing and added regression gates for every prohibited surface.

## Task Commits

1. **RED: Participant surface, diagnostics, and export invariants** — `8ef07e8` (test)
2. **Task 1: Reduce participant Settings and delete inherited sub-screens** — `592d880` (feat)
3. **Task 2: PIN-gated diagnostics and scoped recovery export** — `21b914f` (feat)
4. **Remove obsolete retired-screen contracts** — `e4d32b9` (test)
5. **RED: Forbid participant credential onboarding** — `0ab1775` (test)
6. **Resolved checkpoint: Complete onboarding after consent** — `b30a52f` (feat)

## Files Created/Modified

- `app/src/screens/SettingsScreen.tsx` — renders only the bound numeric identity and language selector.
- `app/src/screens/ResearchDiagnosticsScreen.tsx` — local PIN gate, upload health, and recovery download.
- `app/src/services/research-export.service.ts` — filters durable local records against the immutable bound user ID and returns a JSON Blob.
- `app/src/screens/OnboardingScreen.tsx` — removes participant provider/key configuration and completes after consent.
- `app/tests/phase1/participant-surface.test.mjs` — locks deleted screens, minimal Settings, credential-free onboarding, diagnostics restrictions, and export isolation.
- `app/src/locales/{en,zh,es,ja}.json` — locale-parity strings for account and researcher diagnostics.

## Decisions Made

- Used a digest comparison with no raw PIN persistence. This is deliberately only a concealment gate because the page exposes no privileged server or destructive action.
- Exported parsed record payloads rather than database rows, while filtering every record by the immutable bound `userId`; malformed and cross-participant rows are excluded.
- Treated Context D-12 as the checkpoint answer and removed participant credential setup without committing any real URL, D1 identifier, account, password, key, PIN, or digest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retired obsolete source-contract tests with their deleted screens**
- **Found during:** Full-suite verification
- **Issue:** Three inherited tests required the now-forbidden AI/Data settings screens to exist, causing new failures after the mandated deletion.
- **Fix:** Deleted only the three tests dedicated to those retired screens; unrelated service behavior tests remain.
- **Files modified:** `app/tests/screens/SettingsAIScreen.provider-key-persistence.test.mjs`, `SettingsDataScreen.force-new-day-engagement-reset.test.mjs`, `SettingsDataScreen.force-new-day.test.mjs`
- **Verification:** Full PowerShell-expanded Node suite returned to its documented six unrelated baseline failures (845 tests, 839 pass, 6 fail).
- **Committed in:** `e4d32b9`

**2. [Locked checkpoint resolution] Removed participant credential onboarding**
- **Found during:** Credential checkpoint application in Task 1
- **Issue:** Existing onboarding still asked participants to choose a provider and enter a key, contradicting locked D-12 and the reduced participant surface.
- **Fix:** Consent now completes onboarding directly; no participant provider/key state, input, or settings write remains.
- **Files modified:** `app/src/screens/OnboardingScreen.tsx`, `app/tests/phase1/participant-surface.test.mjs`
- **Verification:** Focused participant-surface test, TypeScript, lint, and build passed.
- **Committed in:** `0ab1775` (RED) → `b30a52f` (GREEN)

---

**Total deviations:** 2 (1 blocking stale-test cleanup, 1 pre-authorized checkpoint resolution).
**Impact on plan:** Both changes enforce the locked minimal participant surface; no new participant capability or secret material was added.

## TDD Gate Compliance

- **RED:** `8ef07e8` failed on all four absent invariants: inherited screens existed, Settings was expansive, diagnostics was a stub, and export service was absent.
- **GREEN:** `592d880` and `21b914f` implemented the minimal Settings and diagnostics/export behaviors; all focused tests passed.
- **Additional RED/GREEN:** `0ab1775` failed against the inherited provider/key onboarding, then `b30a52f` removed that surface and passed.

## Issues Encountered

- The repository `npm test` script remains incompatible with PowerShell because it uses Unix command substitution. The equivalent expanded Node run executed 845 tests: 839 passed and six unrelated pre-existing source-contract failures remain (BottomSheet overscroll placement, two ChatInput guards, BottomSheet consumer autoFocus scan, and two post-history contracts).
- Lint passes with 26 pre-existing warnings and zero errors. Production build passes with existing chunk-size and mixed dynamic/static import warnings.

## User Setup Required

The research build still needs its non-repository configuration injected according to the existing Phase 1 setup guide. No real collector URL, D1 ID, account, password, study key, PIN, or digest was added here.

## Verification

- `node --test tests/phase1/participant-surface.test.mjs tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` — 8 passed.
- `npx tsc -b --noEmit` — passed.
- `npm run lint` — passed with 26 pre-existing warnings, zero errors.
- `npm run build` — passed.
- PowerShell-expanded full Node suite — 839 passed; six documented unrelated pre-existing failures.
- Scoped `git diff --check` and secret-pattern scan — passed.

## Next Phase Readiness

- The participant shell and researcher local recovery surface are ready for device UAT with a privately supplied build PIN digest.
- Phase-level verification should confirm native JSON download behavior and the final study build's externally supplied credential configuration.

## Self-Check: PASSED

- Confirmed all required artifacts exist and all four inherited sub-screen files are absent.
- Confirmed Settings and onboarding expose no participant credential, theme, reset, data, condition, or account-edit control.
- Confirmed no real external URL, D1 identifier, account, password, key, PIN, or digest appears in plan changes.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
