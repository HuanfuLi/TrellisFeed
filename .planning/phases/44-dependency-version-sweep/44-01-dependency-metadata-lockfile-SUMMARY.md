---
phase: 44-dependency-version-sweep
plan: 01
subsystem: dependencies
tags: [npm, package-lock, capacitor, react, i18next, tailwind, eslint]

requires:
  - phase: 43-engagement-ui
    provides: post-Phase-43 dependency baseline for the v1.5 hygiene sweep
provides:
  - Phase 44 safe in-major dependency declarations
  - Regenerated npm lockfile for the approved target set
  - Dependency sweep evidence with install, audit, and held-back-major records
affects: [phase-44, phase-45, dependency-management, native-sync]

tech-stack:
  added: []
  patterns:
    - npm install is the source of truth for package-lock regeneration
    - held-back majors are documented separately from safe in-major updates

key-files:
  created:
    - .planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md
  modified:
    - app/package.json
    - app/package-lock.json

key-decisions:
  - "Kept Vite 8, TypeScript 6.0, ESLint 10, lucide-react 1.x, framer-motion to motion, @vitejs/plugin-react 6, @types/node 25, and globals 17 held back for future phases."
  - "Recorded unchanged audit baseline: npm audit still reports 5 high and 0 critical vulnerabilities, matching the pre-install lockfile."

patterns-established:
  - "Dependency evidence records exact install command, peer-warning status, audit exit code, and baseline comparison."

requirements-completed: [TECHDEBT-08]

duration: 4min
completed: 2026-05-12
---

# Phase 44 Plan 01: Dependency Metadata Lockfile Summary

**Safe in-major npm dependency sweep with regenerated lockfile and documented major-version hold-backs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-12T08:26:27Z
- **Completed:** 2026-05-12T08:30:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Updated approved Phase 44 package ranges in `app/package.json`.
- Regenerated `app/package-lock.json` through the required `npm install` command.
- Created dependency sweep evidence documenting install output, held-back majors, and audit baseline comparison.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install the approved Phase 44 dependency set** - `a09ce3f6` (chore)
2. **Task 2: Record dependency sweep and audit evidence** - `6d9876a2` (docs)

## Files Created/Modified

- `app/package.json` - Declares the approved Phase 44 safe in-major target ranges.
- `app/package-lock.json` - Regenerated npm graph for the updated dependency set.
- `.planning/phases/44-dependency-version-sweep/44-DEPENDENCY-SWEEP.md` - Records install, audit, updated-package, and held-back-major evidence.

## Decisions Made

- Held back the documented major jumps: Vite 8, TypeScript 6.0, ESLint 10, lucide-react 1.x, framer-motion to motion, @vitejs/plugin-react 6, @types/node 25, and globals 17.
- Treated `npm audit --audit-level=high` exit code 1 as evidence to record, not a blocker for this metadata plan, because the pre-install baseline had the same 5 high / 0 critical vulnerability profile.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm audit --audit-level=high` exits 1 with 10 vulnerabilities: 5 moderate, 5 high, 0 critical. A temp-dir audit against the pre-Phase-44 lockfile from `a09ce3f6^` returned the same count, so `new high/critical vulnerabilities: 0` is documented in `44-DEPENDENCY-SWEEP.md`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 44-02 can run automated validation against the updated dependency graph: tests, lint, build, audit, and Capacitor sync.

## Self-Check: PASSED

- Found all created/modified files listed in this summary.
- Verified task commits `a09ce3f6` and `6d9876a2` exist in git history.

---
*Phase: 44-dependency-version-sweep*
*Completed: 2026-05-12*
