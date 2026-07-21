---
phase: 01-rebrand-research-shell-hardening
plan: 08
subsystem: research-logging
tags: [react, typescript, lifecycle, interaction-logging, rq1, privacy]

requires:
  - phase: 01-07
    provides: "Privacy-bounded interactionLog authoring with durable event and Q/A persistence."
provides:
  - "Live participant lifecycle, feed, post, source, Q/A, save, and dismiss logging observers."
  - "Post-close and session-end duration signals for time-on-post and session-length analysis."
  - "An executable RQ-01 fixture proving every re-engagement measure from allowlisted fields."
affects: [research-export, rq1-analysis, device-uat, personalization-baseline]

tech-stack:
  added: []
  patterns: [observer-only instrumentation, lifecycle duration guards, identifier-only source logging, fixture-derived research measures]

key-files:
  created:
    - app/tests/services/rq1-log-coverage.test.mjs
  modified:
    - app/src/App.tsx
    - app/src/screens/HomeScreen.tsx
    - app/src/screens/PostDetailScreen.tsx
    - app/src/services/engagement.service.ts

key-decisions:
  - "Research logging remains a best-effort observer: failures never block participant navigation, engagement, or Q/A behavior."
  - "External post-link clicks emit source_click with postId only; the clicked URL is inspected only to identify an HTTP(S) link and is never recorded."
  - "Existing CONCEPT_EXPLORED signals remain the sole exploration semantics; logging adds no parallel event-bus type."

patterns-established:
  - "Foreground sessions use one guarded start timestamp and emit one app_open/session_end pair per active interval."
  - "Question and answer text travels only through revisioned Q/A records; behavioral call sites supply identifiers and durations only."

requirements-completed: [LOG-01, RQ-01]

coverage:
  - id: D1
    description: "App lifecycle, visible feed batches, saves, and dismissals emit privacy-bounded events from their existing participant call sites."
    requirement: LOG-01
    verification:
      - kind: integration
        ref: "app/tests/services/rq1-log-coverage.test.mjs#live participant call sites are connected to the privacy-bounded logger"
        status: pass
      - kind: other
        ref: "npx tsc -b --noEmit && npm run lint && npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Post open/close durations, identifier-only source clicks, suggested/typed questions, and final answer views are observed without forking exploration behavior."
    requirement: LOG-01
    verification:
      - kind: integration
        ref: "app/tests/services/rq1-log-coverage.test.mjs#live participant call sites are connected to the privacy-bounded logger"
        status: pass
      - kind: integration
        ref: "focused PostDetail, interaction-log, engagement, and HomeScreen test run (134 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A multi-session fixture derives sessions, return days, session length, posts opened, time-on-post, questions, suggestion clicks, notification open rate, and voluntary revisits without prohibited context."
    requirement: RQ-01
    verification:
      - kind: unit
        ref: "app/tests/services/rq1-log-coverage.test.mjs#fixture timeline derives every RQ-01 re-engagement measure"
        status: pass
      - kind: unit
        ref: "app/tests/services/rq1-log-coverage.test.mjs#fixture uses only the research allowlist and never requires prohibited context"
        status: pass
    human_judgment: false

duration: 21m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 08: Live Interaction Instrumentation and RQ-01 Coverage Summary

**QuestionTrace now observes real participant lifecycle, feed, post, source, Q/A, save, and dismissal actions while a privacy-bounded fixture proves every RQ-01 measure is derivable.**

## Performance

- **Duration:** 21m
- **Started:** 2026-07-11T05:57:29Z
- **Completed:** 2026-07-11T06:18:37Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Instrumented app foreground sessions, visible feed batches, saves, and dismissals as non-blocking observers with immutable study identity supplied by `interactionLog`.
- Instrumented post open/close duration, HTTP(S) source-link clicks, suggested and typed questions, and final answer views without adding exploration events or leaking text/URLs into event rows.
- Added an executable two-session RQ-01 timeline that derives every required re-engagement measure and rejects all prohibited contextual fields.

## Task Commits

1. **Task 3 RED: Add RQ-01 logging coverage contract** — `24c9ae2` (test)
2. **Task 1: Instrument lifecycle, feed, and engagement** — `4f53a68` (feat)
3. **Task 2: Observe post and Q/A interactions** — `ef2c41c` (feat)
4. **Task 3 GREEN: Verify live logging observers** — `034dddf` (test)
5. **Recovery correction: Observe source-link clicks and cover the call site** — `51b6dc5` (fix)

## Files Created/Modified

- `app/src/App.tsx` — guarded foreground-session start/end observers with duration.
- `app/src/screens/HomeScreen.tsx` — visible feed-batch impressions and dismiss observations at existing boundaries.
- `app/src/screens/PostDetailScreen.tsx` — post dwell, source-link, Q/A submission, and answer-view observations.
- `app/src/services/engagement.service.ts` — save-post observation at the existing idempotent save call site.
- `app/tests/services/rq1-log-coverage.test.mjs` — RQ-01 derivation/privacy contract and live call-site coverage.

## Decisions Made

- Logging calls remain fire-and-forget observers so unavailable local logging or upload infrastructure cannot interrupt a participant action.
- `source_click` is captured at the post article's click-capture boundary only for actual HTTP(S) anchors; only `postId` crosses into `interactionLog`.
- Existing PostDetail lifecycle and `CONCEPT_EXPLORED` detectors were extended in place rather than mirrored with new semantic application events.

## Deviations from Plan

No scope deviation. The interrupted executor had completed and committed most of Task 2 but omitted the required `source_click` call site. Recovery reviewed the two-file working diff, retained the correct observer, verified its privacy boundary, and committed it before plan closeout.

## Issues Encountered

- The repository's `npm test` script embeds Unix `$(find ...)` and is not directly PowerShell-compatible. The equivalent PowerShell-expanded full suite ran 849 tests: 843 passed and six unrelated pre-existing source-contract assertions failed in BottomSheet proximity/autofocus, two ChatInput guards, and two post-history tests. The same failure classes were already documented by Plan 07.
- Whole-repository lint completes with 26 pre-existing warnings and zero errors; this plan introduced no lint error.

## User Setup Required

None. All automated tests use local fixtures and mocks; no request was made to the deployed collector.

## Verification

- `node --test tests/services/rq1-log-coverage.test.mjs ...` focused logging/PostDetail/Home/engagement run — passed, 134 tests.
- `npx tsc -b --noEmit` — passed.
- `npm run lint` — passed with 26 pre-existing warnings and zero errors.
- `npm run build` — passed.
- PowerShell-expanded full suite — 843 passed, six documented unrelated pre-existing failures.
- Manual device UAT from the plan remains appropriate for final end-to-end confirmation through diagnostics/export.
- No live collector request was made.

## Next Phase Readiness

- The complete client event stream is ready for local diagnostics/export and backend ingestion verification.
- RQ-01 analysis can use the established event-to-measure mapping without adding route, device, source URL, feed-position, or generic payload context.
- No Plan 08 blocker remains; final device UAT can validate the integrated participant flow.

## Self-Check: PASSED

- Confirmed all five plan files exist and are represented in the plan commit range.
- Confirmed every required live call site is wired and no `sourceUrl`, route, device, position, payload, or keystroke context is supplied to `interactionLog.record`.
- Confirmed the RQ-01 fixture derives all nine required measures and all focused gates pass.
- Confirmed commits `24c9ae2`, `4f53a68`, `ef2c41c`, `034dddf`, and `51b6dc5` exist in order.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
