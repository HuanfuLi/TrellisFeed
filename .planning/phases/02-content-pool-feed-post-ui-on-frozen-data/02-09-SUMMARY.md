---
phase: 02-content-pool-feed-post-ui-on-frozen-data
plan: 09
subsystem: frozen-content-cutover-native-acceptance
tags: [frozen-pool, deterministic-packaging, capacitor, android-uat, offline, cutover]
requires:
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    plan: 04
    provides: immutable operator-approved 77-post pool
  - phase: 02-content-pool-feed-post-ui-on-frozen-data
    plan: 08
    provides: condition-neutral post-bounded Ask and canonical research transport
provides:
  - Deterministic participant packaging of pilot-v1-20260717 with no pipeline/runtime acquisition boundary
  - Atomic retirement of the generated-feed, queue, style, carousel, essay, and image-generation shell
  - Android API 36.1 clean-install/offline/Ask/event/locale UAT with explicit physical-device waiver
affects: [03-graph-memory-recommendation-engine, 04-study-infrastructure]
tech-stack:
  added: ["@capacitor/network@8.0.1"]
  patterns: [static frozen projection, native-aware offline fallback, fail-closed prompt-injection pre-gate, elapsed video milestones]
key-files:
  created: [app/scripts/package-content-pool.mjs, app/src/generated/content-pool-v1/index.ts, app/tests/native/phase-2-content-pool-uat.md]
  modified: [app/src/data/content-pool-bundle.ts, app/src/App.tsx, app/src/components/OriginalContent.tsx, app/src/services/question-filter.service.ts, docs/research_system_design.md]
key-decisions:
  - "The verified frozenFeedService facade is the only Phase 3 ranking insertion boundary; generated content, queue, and presentation subsystems are not retained as compatibility seams."
  - "Android WebView connectivity uses the Capacitor Network signal for offline video fallback because navigator.onLine is not authoritative on native hosts."
  - "Frozen videos without duration emit bounded elapsed-time progress milestones so observability does not depend on mutable provider metadata."
  - "Physical Android and iOS UAT are explicitly waived by the research owner after the complete Android API 36.1 emulator matrix passed; this does not assert iOS runtime execution."
patterns-established:
  - "Release boundary: verify immutable source manifest -> generate static projection/public assets -> build/sync native assets -> checksum and UAT the exact artifact."
  - "Native fallback: selected remote YouTube embed online; reviewed frozen digest and explicit transcript notice offline or unavailable."
requirements-completed: [CONT-01, CONT-02, CONT-03, FEED-01, FEED-02, ASK-01]
coverage:
  - id: D1
    description: The immutable 77-post pool is deterministically packaged as the only participant primary-content source.
    verification:
      - kind: integration
        ref: "app/tests/phase2/frozen-cutover.test.mjs + npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: The generated-feed/queue/style/essay/image shell is absent and all live callers use the frozen facade.
    verification:
      - kind: integration
        ref: "app/tests/phase2/frozen-cutover.test.mjs#forbidden generated-shell inventory"
        status: pass
    human_judgment: false
  - id: D3
    description: Canonical docs, D-01 through D-12, AI safety gates, app, backend, lint, and build match the frozen release boundary.
    verification:
      - kind: other
        ref: "pipeline 77/77; Phoenix 7/7; Promptfoo 16/16; app 508/508; backend 30/30; lint/build pass"
        status: pass
    human_judgment: false
  - id: D4
    description: Clean-install offline content, video fallback/progress, both-condition Ask, event privacy, gestures, restart, and four locales pass native acceptance.
    verification:
      - kind: manual_procedural
        ref: "app/tests/native/phase-2-content-pool-uat.md#N-01-N-12 Android API 36.1"
        status: pass
    human_judgment: false
duration: 2h35m
completed: 2026-07-18
status: complete
---

# Phase 02 Plan 09: Frozen Runtime Cutover and Native Acceptance Summary

**The approved 77-post pool is now the sole participant content source, the generated feed shell is removed, and Android API 36.1 passes the complete native acceptance matrix.**

## Performance

- **Duration:** 2h 35m
- **Started:** 2026-07-17T21:42:44-04:00
- **Completed:** 2026-07-18T00:17:33-04:00
- **Tasks:** 3
- **Files modified:** 124

## Accomplishments

- Added deterministic manifest-verified packaging for `pilot-v1-20260717`, producing static runtime/public projections while excluding pipeline, review, cache, and credential files.
- Atomically deleted the generated feed, derived queue, style/carousel, on-open essay/image, and obsolete session surfaces after moving every live reader to the frozen facade.
- Aligned canonical documentation and passed pipeline, Phoenix, Promptfoo, app, backend, lint, production build, Capacitor sync, APK build, and Android N-01 through N-12 acceptance.

## Task Commits

1. **Task 1: Frozen cutover guard and atomic generated-shell retirement** — `11b4480` (test), `31f67b6` (feat)
2. **Task 2: Canonical documentation and release-boundary audit** — `f001ea0` (docs)
3. **Task 3: Native packaging and acceptance** — `6bb9f1b`, `7a94c2d`, `4624f09` (test)
4. **Acceptance fixes found by emulator UAT** — `22bf6c1`, `049827b`, `4047cc2` (fix)
5. **Phase review blockers and convergence** — `cfcd9b1`, `26fb91d` (fix); `02-REVIEW.md` status `clean`

## Files Created/Modified

- `app/scripts/package-content-pool.mjs` and `app/src/generated/content-pool-v1/` — deterministic immutable runtime projection.
- `app/src/data/content-pool-bundle.ts` — static frozen bundle binding used by the runtime repository.
- `app/src/App.tsx` and retired generator modules/tests — frozen facade cutover and removal of obsolete product architecture.
- `app/src/components/OriginalContent.tsx` — native-aware offline reviewed-video fallback and progress for unknown-duration videos.
- `app/src/services/question-filter.service.ts` — deterministic direct prompt-injection rejection before provider or persistence.
- `app/tests/native/phase-2-content-pool-uat.md` — exact artifact, failure/fix/retest evidence, waiver scope, and N-01–N-12 sign-off.
- `CLAUDE.md`, `docs/research_system_design.md`, `docs/SCOPE.md`, and `docs/prune_report.md` — shipped frozen architecture and removal boundary.

## Decisions Made

- Phase 3 must rank the frozen facade output rather than revive any generated-post compatibility layer.
- Native connectivity is authoritative for embedded-video fallback; browser online state remains only a browser fallback.
- Physical-device UAT was waived only after all Android emulator rows passed, and the record explicitly distinguishes waiver from iOS runtime evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Native correctness] Android offline video remained a dead iframe**
- **Found during:** N-05 emulator UAT
- **Fix:** Added the Capacitor Network plugin and localized reviewed-summary/transcript fallback.
- **Verification:** Offline force-stop/reopen displayed the full fallback without an iframe.
- **Committed in:** `22bf6c1`

**2. [Security] Direct prompt injection bypassed the unconfigured embedding path**
- **Found during:** N-08 emulator UAT
- **Fix:** Added a deterministic direct-imperative malicious pre-gate before settings, embedding, provider, persistence, and observation.
- **Verification:** Clean-install retest produced no provider call, Q/A row, upload row, or durable raw text; app suite passed.
- **Committed in:** `049827b`

**3. [Observability] All frozen videos lacked duration and could never emit progress**
- **Found during:** N-10 emulator UAT
- **Fix:** Added bounded elapsed 5/15/30/60-second milestones when duration is unavailable.
- **Verification:** Android WebView persisted two allowlisted `video_progress` records at a 16-second position.
- **Committed in:** `4047cc2`

**4. [Review hardening] Security, Ask lifecycle, consent, persistence, and packaging edge cases**
- **Found during:** Independent Phase 2 code review and two convergence passes
- **Fix:** Expanded normalized prompt-injection grammar with benign exclusions; added token-owned synchronous Ask locking and route cancellation; made engagement hydration retry-safe with serialized writes; gated corpus prewarm on consent; aligned package validation with runtime references; reset video state by post key.
- **Verification:** Review status `clean`; focused adversarial/lifecycle tests passed; full App suite 508/508; final Android API 36.1 targeted regression passed.
- **Committed in:** `cfcd9b1`, `26fb91d`

**Total deviations:** 4 groups of auto-fixed correctness/security gaps. **Impact:** All fixes were required to satisfy existing acceptance contracts; no feature scope was added.

## Issues Encountered

- `gemini-2.5-flash-lite` returned unavailable for a new key; live parity UAT used the currently available `gemini-3.1-flash-lite` without changing the stored provider defaults.
- Windows cannot execute an iOS simulator. The research owner accepted Android simulator evidence and explicitly waived physical Android/iOS UAT; the record does not claim an iOS runtime pass.

## User Setup Required

None for the packaged participant artifact. Local UAT credentials remain in ignored environment files and are not bundled.

## Test Results

- Content pipeline/freeze verification — 77/77, valid immutable manifest.
- Phoenix local-safety — 7/7; Promptfoo offline reference set — 16/16.
- App — 508/508; research backend — 30/30.
- Lint — 0 errors, 7 existing warnings; production build, Capacitor Android sync, and debug APK assembly — pass.
- Android API 36.1 native matrix — N-01 through N-12 pass; physical Android/iOS rows waived by owner.

## Next Phase Readiness

- Phase 2 is independently verified complete (`02-VERIFICATION.md`: `passed`; `02-REVIEW.md`: `clean`). Phase 3 can consume the fixed frozen-feed facade and add the graph-memory/control rankers without touching content acquisition or Ask parity.
- No unresolved HIGH threat or Phase 2 acceptance blocker remains.

## Self-Check: PASSED

- Confirmed the immutable runtime projection, native checklist, cutover guard, and all plan commits exist.
- Re-ran the final app suite, lint, build, native sync/APK, and all simulator rows affected by fixes.

---
*Phase: 02-content-pool-feed-post-ui-on-frozen-data*
*Completed: 2026-07-18*
