---
phase: 01-rebrand-research-shell-hardening
plan: "01"
subsystem: ui
tags: [branding, capacitor, ios, android, i18n, research-consent]
requires:
  - phase: 00
    provides: Pruned research prototype shell and four-locale bundle infrastructure
provides:
  - QuestionTrace display branding across web, Capacitor, iOS, Android, and active locale copy
  - Research-accurate onboarding and privacy disclosure for on-device-first collection with retry
  - Regression protection for display names, preserved bundle identifiers, microphone-permission removal, and English legacy-brand residue
affects: [phase-01-plans, native-uat, participant-onboarding]
tech-stack:
  added: []
  patterns:
    - Display-name changes preserve native application and bundle identifiers
    - English-first locale changes land in all four bundles with parity verification
key-files:
  created:
    - app/tests/phase1/rebrand-surfaces.test.mjs
  modified:
    - app/index.html
    - app/capacitor.config.ts
    - app/ios/App/App/Info.plist
    - app/android/app/src/main/res/values/strings.xml
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
key-decisions:
  - "Use QuestionTrace solely for display branding; preserve com.trellis.app and com.huanfuli.trellis identifiers."
  - "Describe research records as device-first uploads with offline retry, not as local-only data."
requirements-completed: [SHELL-01]
coverage:
  - id: D1
    description: QuestionTrace display configuration across web and native launcher surfaces, with stable identifiers
    requirement: SHELL-01
    verification:
      - kind: unit
        ref: tests/phase1/rebrand-surfaces.test.mjs#native-and-web-display-surfaces-use-QuestionTrace-while-bundle-identifiers-stay-stable
        status: pass
    human_judgment: true
    rationale: Native launcher rendering still requires the plan's manual Capacitor/device UAT after sync.
  - id: D2
    description: Four parity-preserving locale bundles use QuestionTrace and disclose research collection accurately
    requirement: SHELL-01
    verification:
      - kind: unit
        ref: tests/locales/bundle-parity.test.mjs#en-zh-es-ja-bundles-have-identical-flattened-key-sets
        status: pass
      - kind: other
        ref: PowerShell JSON acceptance assertion for onboarding.consent.rowNoServer and settings.about.version
        status: pass
      - kind: unit
        ref: tests/phase1/rebrand-surfaces.test.mjs#English-user-facing-locale-strings-no-longer-name-the-legacy-brand
        status: pass
    human_judgment: false
  - id: D3
    description: Rebrand regression gate prevents display-name rollback and identifier drift
    requirement: SHELL-01
    verification:
      - kind: unit
        ref: tests/phase1/rebrand-surfaces.test.mjs
        status: pass
    human_judgment: false
duration: 7 min
completed: 2026-07-11
status: complete
---

# Phase 01 Plan 01: Rebrand Display and Research Disclosure Summary

**QuestionTrace display branding now spans web, Capacitor, iOS, Android, and all active locale copy, with research-collection disclosure matching device-first uploads and offline retry.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-11T03:20:51Z
- **Completed:** 2026-07-11T03:27:34Z
- **Tasks:** 3 completed
- **Files modified:** 9

## Accomplishments

- Rebranded all shipped display surfaces to `QuestionTrace` while preserving the Android `com.trellis.app` and iOS `com.huanfuli.trellis` identifiers.
- Removed the stale iOS microphone permission declaration left behind by the pruned voice feature.
- Updated English, Chinese, Spanish, and Japanese user-visible copy to name QuestionTrace and accurately explain device-first research record uploads, offline use, and retry.
- Added an automated regression gate for display names, identifier preservation, microphone-permission removal, and English legacy-brand residue.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebrand web + native display surfaces** - `dd00e1d` (feat)
2. **Task 2: Rebrand the four locale bundles and replace local-only privacy copy** - `f594c1f` (feat)
3. **Task 3: Author rebrand-surfaces regression test** - `1848a01` (test, RED before implementation)

**Plan metadata:** this documentation commit.

## Files Created/Modified

- `app/index.html`, `app/capacitor.config.ts` - Web and Capacitor display names now use QuestionTrace without changing `appId`.
- `app/ios/App/App/Info.plist`, `app/android/app/src/main/res/values/strings.xml` - Native launcher labels now use QuestionTrace; the iOS microphone declaration is removed.
- `app/src/locales/{en,zh,es,ja}.json` - Four parity-preserving bundles use QuestionTrace and research-accurate privacy/consent copy.
- `app/tests/phase1/rebrand-surfaces.test.mjs` - Source-level regression checks for display names, identifiers, and English legacy-brand display values.

## Decisions Made

- Native package identifiers remain unchanged because they are signing and installed-data identifiers, not participant-facing display names.
- Privacy and onboarding copy now states that interaction and question/answer records persist locally first, upload to the research collector, and retry after offline use.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Execution order] Ran Task 3's regression test before display edits.**
- **Found during:** Task 3 (Author rebrand-surfaces regression test)
- **Issue:** The plan marks Task 3 `tdd="true"` but places it after the implementation tasks, which cannot produce a valid RED phase.
- **Fix:** Added and ran the regression test first; it failed against the old branding, then became green after Tasks 1 and 2.
- **Files modified:** `app/tests/phase1/rebrand-surfaces.test.mjs`
- **Verification:** RED run failed on legacy display strings; final targeted suite passed 5/5.
- **Committed in:** `1848a01`

**2. [Rule 1 - Plan/code mismatch] Rebranded actual debug display values outside the planned allowlist path.**
- **Found during:** Task 2 (Rebrand the four locale bundles and replace local-only privacy copy)
- **Issue:** The plan's stale-value note names `settings.developer.trellisDevMode*`, but this codebase stores the visible values under `settings.fields` and `settings.toast`; the required scan allowlists only `settings.developer`.
- **Fix:** Rebranded those visible values to QuestionTrace while preserving their keys for the later dead-namespace sweep.
- **Files modified:** `app/src/locales/{en,zh,es,ja}.json`
- **Verification:** `rebrand-surfaces.test.mjs` reports no remaining English legacy-brand display value.
- **Committed in:** `f594c1f`

**3. [Rule 3 - Environment blocker] Installed locked Node dependencies before executing locale tests.**
- **Found during:** Task 2 verification
- **Issue:** `node_modules` was absent, so `missing-key.test.mjs` could not import `i18next`.
- **Fix:** Ran `npm ci`; no tracked dependency files changed.
- **Files modified:** None
- **Verification:** Bundle parity, missing-key, and rebrand-surface tests pass.
- **Committed in:** Not applicable (environment-only)

---

**Total deviations:** 3 auto-fixed (1 execution-order, 1 plan/code mismatch, 1 environment blocker).
**Impact on plan:** All changes remain within the plan's listed files and strengthen its stated TDD, rebrand, and disclosure requirements.

## Issues Encountered

- The repository's `npm test` script uses POSIX command substitution and needs `npm_config_script_shell` set to Git Bash on this Windows host. With that environment setting, the full suite executes but has four unrelated failures in `BottomSheet.test.mjs`, two ChatInput guard suites, and `post-history-fallback.test.mjs`; none of their source or test files were modified by this plan. The plan-specific 5-test suite passes.
- `npm run lint` passes with 0 errors and 26 pre-existing warnings. `npm run build` passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1's remaining plans can rely on QuestionTrace display branding and four-bundle parity.
- Native manual UAT remains: run `npx cap sync`, inspect generated native diffs, and confirm each launcher label displays QuestionTrace without identifier changes.

## Self-Check: PASSED

All task acceptance criteria and targeted regression/localization checks pass. The full-suite failures are confined to pre-existing, out-of-scope files and are recorded above.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
