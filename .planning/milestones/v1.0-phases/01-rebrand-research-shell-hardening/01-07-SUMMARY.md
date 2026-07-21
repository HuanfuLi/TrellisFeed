---
phase: 01-rebrand-research-shell-hardening
plan: 07
subsystem: research-logging
tags: [typescript, indexeddb, privacy, event-allowlist, question-answer, tdd]

requires:
  - phase: 01-04
    provides: "Immutable studyContextService identity and privacy-bounded research record types."
  - phase: 01-06
    provides: "Durable at-least-once upload queue with a testable enqueue seam."
provides:
  - "A 16-event interaction logger that snapshots bound study identity internally."
  - "Runtime per-event field allowlists that reject arbitrary and prohibited context before persistence."
  - "Separate revisioned question/answer records whose text never enters behavioral events."
  - "Persist-first research_records writes followed by one enqueue per event or Q/A revision."
affects: [01-08, interaction-instrumentation, rq1-analysis, local-recovery-export]

tech-stack:
  added: []
  patterns: ["internal identity snapshot", "runtime field allowlist", "revisioned Q/A record", "persist-before-enqueue"]

key-files:
  created:
    - app/src/services/interaction-log.service.ts
    - app/tests/services/interaction-log.service.test.mjs
  modified: []

key-decisions:
  - "Event context is validated by event-specific runtime allowlists; TypeScript types are not treated as a privacy boundary."
  - "post_close.durationMs is the canonical time-on-post signal; time_on_post is intentionally not an event type."
  - "A typed question emits question_submit, while selecting a curated question emits question_suggestion_click; both keep text only in the Q/A record."

patterns-established:
  - "Research call sites provide only semantic IDs/duration; interactionLog obtains userId, condition, topicId, timestamp, and record ID itself."
  - "Each authored record is durable in research_records before it is handed to the upload queue."

requirements-completed: [LOG-01]

coverage:
  - id: D1
    description: "All 16 RSD §9.8 event types are accepted with event-specific fields and immutable bound identity."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "app/tests/services/interaction-log.service.test.mjs#accepts exactly the 16 event types with their event-specific optional fields"
        status: pass
    human_judgment: false
  - id: D2
    description: "Prohibited, arbitrary, and caller-supplied identity context is rejected before any durable write or enqueue."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "app/tests/services/interaction-log.service.test.mjs#rejects prohibited and arbitrary context before any persistence or enqueue"
        status: pass
    human_judgment: false
  - id: D3
    description: "Question and answer text remains in a separately revisioned Q/A record, while behavioral events contain IDs only."
    requirement: LOG-01
    verification:
      - kind: unit
        ref: "app/tests/services/interaction-log.service.test.mjs#stores question and answer text only in a revisioned Q/A record"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every event and Q/A revision is persisted through the database seam and enqueued exactly once."
    requirement: LOG-01
    verification:
      - kind: integration
        ref: "app/tests/services/interaction-log.service.test.mjs#record snapshots immutable study identity rather than accepting caller identity"
        status: pass
    human_judgment: false

duration: 7m
completed: 2026-07-11
status: complete
---

# Phase 1 Plan 07: Privacy-Bounded Interaction Logging Summary

**QuestionTrace now authors the complete 16-event research contract with internally snapshotted identity, strict runtime privacy boundaries, and separately revisioned Q/A text records.**

## Performance

- **Duration:** 7m
- **Started:** 2026-07-11T05:35:00Z
- **Completed:** 2026-07-11T05:42:08Z
- **Tasks:** 1 TDD task
- **Files modified:** 2

## Accomplishments

- Added `interactionLog.record` with all 16 RSD §9.8 event types, event-specific optional-field allowlists, internally sourced identity, generated IDs, and canonical timestamps.
- Rejected caller condition, unknown event names, arbitrary payloads, URLs, feed positions, routes, device fields, keystroke timing, invalid IDs, and invalid duration values before persistence.
- Added revision-1 question submission and revision-2 answer attachment records; behavioral events contain only related IDs and never duplicate question or answer text.
- Persisted every event/Q&A revision to `research_records` before passing it exactly once to the upload queue.

## Task Commits

1. **RED: Interaction logging contract suite** — `2ba1e28` (test)
2. **GREEN: Privacy-bounded interaction log service** — `2b50f6e` (feat)

## Files Created/Modified

- `app/src/services/interaction-log.service.ts` — event/Q&A validation, immutable identity snapshotting, durable authoring, and queue handoff.
- `app/tests/services/interaction-log.service.test.mjs` — executable coverage of all event types, privacy rejection, durability, enqueue counts, and Q/A revisioning.

## Decisions Made

- The service exposes no identity or condition argument. It reads the already-bound identity from `studyContextService.getRequired()` at record creation time and copies the immutable values into the record.
- Event fields are narrower than the global `{postId, questionId, recommendationId, durationMs}` union: each event type receives only the subset needed for its semantic event.
- `post_close.durationMs` remains the sole time-on-post representation. The service rejects `time_on_post` as an unknown event rather than creating redundant context.
- Suggested-question selection and typed submission remain distinct behavioral signals, while both use the same privacy-bounded Q/A record shape.

## Deviations from Plan

None — the plan was executed as written.

## TDD Gate Compliance

- **RED:** `2ba1e28` added the complete behavioral suite; it failed because `interaction-log.service.ts` did not yet exist.
- **GREEN:** `2b50f6e` added the minimal service implementation; all seven plan tests passed.
- **REFACTOR:** No separate refactor commit was necessary after the implementation and contract review.

## Issues Encountered

- The repository `npm test` command is not PowerShell-compatible because it embeds Unix `$(find ...)`. The equivalent PowerShell-expanded run executed 859 tests: 853 passed and six unrelated pre-existing source-contract assertions failed (BottomSheet proximity, two ChatInput guards, a grep-dependent BottomSheet scan, and two post-history source assertions). The complete interaction-log suite passed in that run.
- Whole-worktree `git diff --check` reports unrelated pre-existing `.codex` whitespace changes. Both plan files pass scoped whitespace checks.

## User Setup Required

None. Tests inject an in-memory enqueue spy and never resolve or call the deployed collector.

## Verification

- `cd app && node --test tests/services/interaction-log.service.test.mjs` — passed (7 tests).
- Combined interaction-log, study-context, and upload-queue suites — passed (21 tests).
- `cd app && npx tsc -b --pretty false` — passed.
- `cd app && npm run lint` — passed with 26 pre-existing warnings and zero errors.
- `cd app && npm run build` — passed.
- PowerShell-expanded full suite — 853 passed; six documented unrelated pre-existing failures.
- No live collector request was made.

## Next Phase Readiness

- Plan 08 can instrument UI/lifecycle call sites exclusively through `interactionLog`; callers never need access to condition or generic analytics payloads.
- The local recovery export and eventual RQ-01 fixtures can distinguish event rows from Q/A rows using the durable `kind` and `revision` columns.

## Self-Check: PASSED

- Confirmed both required source/test artifacts exist and contain no live URL, account, key, PIN, or participant data.
- Confirmed RED and GREEN commits are present in order.
- Confirmed the service rejects all requested prohibited fields before durable writes and enqueues.

---
*Phase: 01-rebrand-research-shell-hardening*
*Completed: 2026-07-11*
