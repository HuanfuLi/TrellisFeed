---
phase: 52-podcast-quality-defaults-and-learner-controls
plan: 04
subsystem: ui
tags: [podcast, react, view-model, leaf-module, audio, state-derivation]

# Dependency graph
requires:
  - phase: 52-podcast-quality-defaults-and-learner-controls (plans 01-03)
    provides: computeOptionsHash leaf, PodcastOptions chips, options-aware generatePodcast + cache-skip
provides:
  - podcast-view-model.ts pure leaf (deriveSelectedPodcast, isPlayerVisible, isEmptyStateVisible, isDirty, computeCurrentHashForSelected)
  - PodcastScreen player/empty gates derived from one source (mutual exclusion)
  - deterministic select-on-generate binding via PODCAST_GENERATION_COMPLETED
  - isDirty reconciliation over service-resolved selected.questionIds
affects: [phase-52 plan-05 (chip card relocation), podcast playback, podcast UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract screen selection + render-gate logic into a pure leaf module so the LIVE path is unit-testable (CLAUDE.md best-practice #2)"
    - "Reactive re-read on PODCAST_GENERATION_COMPLETED (CLAUDE.md no-refresh) instead of relying on remount"

key-files:
  created:
    - app/src/services/podcast-view-model.ts
    - app/tests/services/podcast-view-model.test.mjs
  modified:
    - app/src/screens/PodcastScreen.tsx
    - app/src/services/podcast.service.ts

key-decisions:
  - "deriveSelectedPodcast has NO podcasts[0] fallback — the main player only shows TODAY's podcast; old podcasts are reached via the History sub-view (explicit selectedId)."
  - "Player + empty-state gates derive from the same single source (selected / todayPodcast) so they are structurally mutually exclusive — fixes the dual-render GAP-3."
  - "PodcastScreen.currentHash now hashes over selected.questionIds (the service-resolved list) instead of the screen's divergent todayConceptIds, reconciling with the service optionsHash and killing the phantom permanent-dirty Regenerate CTA (GAP-4)."
  - "select-on-generate reuses the existing PODCAST_GENERATION_COMPLETED signal — no new event type (CLAUDE.md one-signal-per-event)."
  - "Imported computeOptionsHash from './podcast-prompt.ts' WITH the .ts extension (tsconfig allowImportingTsExtensions:true) so the Node 26 native TS test runner resolves the value import."

patterns-established:
  - "Leaf view-model: a screen's pure derivation logic lives in a side-effect-free module with type-only ../types imports, testable under node --test."

requirements-completed: [PODCAST-03]

# Metrics
duration: ~25min
completed: 2026-05-19
---

# Phase 52 Plan 04: Podcast Playback + Dual-Render Fix Summary

**Extracted PodcastScreen selection + render-gate logic into a pure `podcast-view-model.ts` leaf module that removes the stale `podcasts[0]` fallback, makes the player and "No podcast for today" empty state mutually exclusive (GAP-3), binds the player to the freshly generated today podcast via select-on-generate, and reconciles the dirty-hash over `selected.questionIds` to kill the phantom Regenerate CTA (GAP-4).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-05-19
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Closed GAP-4 (blocker): a freshly generated podcast now plays — `PODCAST_GENERATION_COMPLETED` sets `selectedId` to today's id so the audio-wiring effect re-runs with `selected.id === the new id`, and `getAudioPath(selected.id)` returns the fresh blob (play no longer hits the `!audio` early-return). The isDirty loop is reconciled so no phantom permanent Regenerate CTA appears.
- Closed GAP-3 (major): `isPlayerVisible` and `isEmptyStateVisible` derive from a single source, so the player and empty state can never both render. The main player only shows TODAY's podcast; old podcasts are reached via History.
- Added behavioral regression coverage on the LIVE path (extracted pure helpers), replacing the prior source-read-only false-confidence test: 19/19 view-model tests including the explicit mutual-exclusion and fresh-play assertions.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing behavioral tests** - `a7db5b93` (test)
2. **Task 1 (GREEN): podcast-view-model leaf module** - `0adf7959` (feat)
3. **Task 2: rewire PodcastScreen to view-model + select-on-generate** - `5a2fde9c` (fix)
4. **Task 3: document service questionIds/optionsHash hash-loop invariant** - `c21e2d02` (docs)

_TDD Task 1 produced a test (RED) commit then a feat (GREEN) commit. No refactor commit needed._

## Files Created/Modified
- `app/src/services/podcast-view-model.ts` (created) - Pure leaf: deriveSelectedPodcast (no podcasts[0]), isPlayerVisible, isEmptyStateVisible, isDirty, computeCurrentHashForSelected.
- `app/tests/services/podcast-view-model.test.mjs` (created) - 19 behavioral tests covering mutual exclusion, fresh-play binding, isDirty reconciliation.
- `app/src/screens/PodcastScreen.tsx` (modified) - Consumes the leaf module; deterministic select-on-generate; currentHash over selected.questionIds.
- `app/src/services/podcast.service.ts` (modified) - Documenting comment on the questionIds/optionsHash hash-loop invariant (no behavioral change).

## Decisions Made
- See `key-decisions` frontmatter. The load-bearing one: removing the `podcasts[0]` fallback is the single root-cause fix for BOTH UAT gaps — the stale fallback was simultaneously the dual-render trigger (GAP-3) and the wrong-blob bind (GAP-4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used `.ts` extension on the intra-leaf value import**
- **Found during:** Task 1 (GREEN — running view-model tests)
- **Issue:** `import { computeOptionsHash } from './podcast-prompt'` (extensionless) failed with `ERR_MODULE_NOT_FOUND` under the Node 26 native TS test runner, which requires explicit extensions for value imports.
- **Fix:** Changed to `from './podcast-prompt.ts'`. `tsconfig.app.json` already sets `allowImportingTsExtensions: true` (bundler mode), so this is valid for both Vite and `tsc -b --noEmit`.
- **Files modified:** app/src/services/podcast-view-model.ts
- **Verification:** 19/19 view-model tests pass; `tsc -b --noEmit` clean.
- **Committed in:** `0adf7959`

**2. [Rule 3 - Blocking] Symlinked worktree `node_modules` for type-checking**
- **Found during:** Task 1 verification (tsc)
- **Issue:** The worktree had no installed `node_modules`, so the local `tsc` binary was unavailable and `npx tsc` resolved to an unrelated package.
- **Fix:** Created a symlink `app/node_modules -> /Users/Code/EchoLearn/app/node_modules` (the main repo's installed deps). The symlink is gitignored (`git check-ignore app/node_modules` confirms) and was NOT committed. Pure-logic `node --test` runs need no deps (Node 26 strips types natively).
- **Files modified:** None tracked (symlink only, gitignored).
- **Verification:** `npx tsc -b --noEmit` exits clean.
- **Committed in:** N/A (not a tracked change).

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking environment issues)
**Impact on plan:** Both were tooling/environment blockers, not logic changes. No scope creep; all three planned tasks executed as written.

## Issues Encountered
- **Pre-existing test failures (out of scope):** `npm test` shows 7 failures in `tests/services/review-overdue.test.mjs`, `tests/services/trellis-state.test.mjs`, and `tests/services/trellis-replant.test.mjs`. These are date-sensitive SM-2 / trellis assertions that drift with the wall-clock date (2026-05-19) and are unrelated to this plan — only 4 podcast files changed since the worktree base, and none of the failing test files import podcast code. Logged to `deferred-items.md`. Per the SCOPE BOUNDARY rule, these were NOT fixed.

## Test Status (podcast-relevant — all green)
- `tests/services/podcast-view-model.test.mjs`: 19/19 pass
- `tests/services/podcast-options.test.mjs`: 9/9 pass
- `tests/screens/PodcastScreen.options.test.mjs` + `PodcastScreen.routeFilter.test.mjs`: 24/24 pass
- `tsc -b --noEmit`: clean

## TDD Gate Compliance
Task 1 followed the RED→GREEN cycle: `a7db5b93` (test, RED — module absent) → `0adf7959` (feat, GREEN — all 19 pass). Gate sequence intact.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GAP-3 and GAP-4 closed at the logic level; ready for device UAT re-verification.
- Plan 52-05 (chip card relocation / GAP-2) can proceed — the chip Card gate was intentionally left in place (now reading from the same helpers) per the plan, for 52-05 to move/collapse.

---
*Phase: 52-podcast-quality-defaults-and-learner-controls*
*Completed: 2026-05-19*

## Self-Check: PASSED
- app/src/services/podcast-view-model.ts — FOUND
- app/tests/services/podcast-view-model.test.mjs — FOUND
- 52-04-SUMMARY.md — FOUND
- Commits a7db5b93, 0adf7959, 5a2fde9c, c21e2d02 — all FOUND
