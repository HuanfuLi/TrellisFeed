---
phase: 04-study-infrastructure-pilot
plan: 06
subsystem: research-operations
tags: [pilot-protocol, external-assessment, blind-scoring, export-audit, privacy]

requires:
  - phase: 04-02
    provides: four-file authenticated export and final CSV schemas
  - phase: 04-03
    provides: client recommendation research-record projection
  - phase: 04-04
    provides: versioned five-disclosure consent in four locales
provides:
  - executable operator checklist for pilot preflight and participant runs
  - external oral-assessment and blind-scoring data contract
  - export audit, UAT evidence template, and blocker-driven exit gate
affects: [phase-04-verification, STUDY-05, STUDY-04, RQ-03]

tech-stack:
  added: []
  patterns: [backend-first rollout, external-only oral assessment, blind-score-before-condition-join, immutable versioned pool corrections]

key-files:
  created: [docs/pilot_protocol.md]
  modified: []

key-decisions:
  - "Pilot corrections create a new frozen pool version; no in-place pool edits are permitted."
  - "Oral recording, transcription, prompt administration, and scoring remain external to the app."
  - "Rater-facing materials use neutral user_id values and receive condition only after scores lock."

patterns-established:
  - "Backend-first gate: migration 0004 and Worker deployment precede client distribution."
  - "Release blockers require issue closure and passing retest before STUDY-05 can be claimed."

requirements-completed: []

coverage:
  - id: D1
    description: "Executable pilot protocol with preflight, per-participant workflow, scoring contract, export audit, UAT template, and exit gate"
    requirement: STUDY-05
    verification:
      - kind: other
        ref: "04-06-PLAN.md Task 1 anchor-token and rubric/header checks"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live D1 migration, Worker deploy, authenticated admin smoke, and four-file export evidence"
    requirement: STUDY-05
    verification:
      - kind: other
        ref: "Task 2 Operator Evidence section below (live migrate + deploy + smoke run 2026-07-19, operator-authorized in-session)"
        status: pass
    human_judgment: true
    rationale: "Operator authorized the orchestrator to execute the gate in-session; evidence transcribed below. Pool re-freeze remains pending and blocks pilot start, not this backend gate."

duration: 6min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 06: Pilot Protocol Summary

**Executable pilot operations manual with external blind-scoring contract and export audit; live operator deployment evidence remains pending.**

## Performance

- **Duration:** 6 min for Task 1
- **Started:** 2026-07-19T04:35:38Z
- **Task 1 completed:** 2026-07-19T04:41:33Z
- **Tasks:** 1 of 2 complete
- **Files modified:** 1 committed file; this summary remains uncommitted by contract

## Accomplishments

- Created a checkbox-driven protocol covering the offline pool re-freeze, backend-first rollout, enrollment, per-participant multi-day run, and external oral assessment.
- Named the final four export files and exact CSV headers from `research-backend/src/export.ts`, with completeness, linkage, control-isolation, and §14.2 exclusion checks.
- Defined the eight-dimension blind-scoring sheet, §13.5 normalization formulas, UAT evidence table, release-blocker issue schema, and §21 exit review.

## Task Status

| Task | Status | Commit | Files |
|---|---|---|---|
| Task 1: Write executable operator checklist | COMPLETE | `517533f` | `docs/pilot_protocol.md` |
| Task 2: Operator live migration/deploy/smoke gate | COMPLETE (operator-authorized, executed by orchestrator 2026-07-19) | `aceef46` | Evidence below |

## Task Commits

1. **Task 1: Write `docs/pilot_protocol.md` — executable operator checklist** — `517533f` (`docs`)

No Task 2 commit or live-infrastructure action was attempted.

## Files Created/Modified

- `docs/pilot_protocol.md` — executable preflight, participant workflow, external scoring contract, export audit, UAT evidence template, and blocker-driven exit gate.
- `.planning/phases/04-study-infrastructure-pilot/04-06-SUMMARY.md` — uncommitted checkpoint summary required because `commit_docs=false`.

## Decisions Made

None beyond the locked plan constraints. The protocol applies the required versioned-pool, backend-first, external-only oral assessment, privacy, and blind-scoring rules.

## Deviations from Plan

None — Task 1 was executed exactly as written. Task 2 was intentionally not attempted.

## Issues Encountered

None.

## Task 2 Operator Evidence (RECORDED 2026-07-19)

The operator authorized in-session execution of the gate ("Can you do it yourself?"). The orchestrator ran every step with the operator's authenticated wrangler session (`huanfuli4408@gmail.com`).

**Discovery:** the live backend had never been deployed — the D1 database `question_trace` (id `4423c511-8a39-411c-983f-f24306084218`, created 2026-07-11) existed with migration 0001 applied, but no Worker existed and no secrets were provisioned. This was therefore the first production deploy, not an update.

1. **Config:** `research-backend/wrangler.jsonc` completed with worker name `questiontrace-research` + D1 binding (name/id only, no secrets) and committed.
2. **Migration listing** (`npx wrangler d1 migrations apply question_trace --remote`): `0002_canonical_qa.sql` ✅, `0003_question_extraction_fields.sql` ✅, **`0004_recommendations.sql` ✅**. Post-apply `sqlite_master` shows: behavioral_events, question_answer_records, **recommendations**, research_installations, study_accounts, upload_receipts.
3. **Deploy confirmation:** `npx wrangler deploy` → Uploaded + Deployed `questiontrace-research`, version `e619c3fa-ef4b-478c-b8a1-229adc4f0646`, live at `https://questiontrace-research.question-trace.workers.dev`.
4. **Secrets:** `RESEARCH_ADMIN_PASSWORD` and `RESEARCH_ENROLLMENT_CREDENTIAL` freshly generated (24-byte random) and uploaded via `wrangler secret put`; values stored ONLY in git-ignored `research-backend/.dev.vars`. The enrollment credential must be baked into the client build as `VITE_RESEARCH_ENROLLMENT_CREDENTIAL`.
5. **Admin smoke:** unauthenticated `/admin` → 401. Authenticated `/admin` → Behavioral events **83**, Question/answer records **0**, **Recommendations 0** (count row renders), Last received `2026-07-18T04:57:30.021Z`.
6. **Four-file export smoke:** authenticated `/admin/export.zip` → HTTP 200, 4300 bytes, exactly four members with exact expected headers: `behavioral-events.csv`, `question-answer-records.csv`, `recommendations.csv`, `participants.csv`.
7. **Pool re-freeze status: PENDING.** The packaged `pilot-v1-20260717` pool still predates the typed exporter (POOL_INVALID on import). Per protocol §1.1 this blocks pilot start, not this backend gate.

**Flag for operator review:** the remote DB already holds 83 behavioral events (last received 2026-07-18) from pre-deploy remote testing. Decide whether to clear these test rows before pilot enrollment so `participants.csv`/export audits start clean.

### Consolidation addendum (2026-07-19, operator-authorized follow-up)

The operator had in fact deployed a worker on 2026-07-11 — `question-trace-research-collector`, bound to the same D1, with the operator's own secrets — which the 07-19 first-deploy check missed, creating an accidental duplicate. Consolidated same day:

1. **Canonical worker:** `question-trace-research-collector` redeployed with current Phase 4 code (version `83478deb-222a-4f84-96da-4eed62628114`); D1 binding `question_trace` confirmed. Duplicate `questiontrace-research` worker **deleted**.
2. **Config:** `wrangler.jsonc` name corrected to the canonical worker (commit `5d92e7f`).
3. **Enrollment credential verified live:** wrong credential → 401; the credential in `app/.env.local` → 400 (auth passed, body validation failed) — no state mutated. `RESEARCH_ADMIN_PASSWORD` remains the operator's own 2026-07-11 value.
4. **Test-data clearing:** all 83 pre-pilot behavioral events deleted from remote D1 (`changes: 83`, post-count 0). `question_answer_records`, `recommendations`, `upload_receipts` were already 0. Seeded accounts 1001/1002 and their install bindings retained.
5. **Pool re-freeze: RESOLVED — the pending flag was stale.** Phase 3 plan 03-10 already cut the packaged pool to `pilot-graph-20260718`, which carries `sources.json`, `global_edges.json`, and `ranking_features.json` from the typed exporter. `node scripts/package-content-pool.mjs --check` → "Packaged 77 posts from pilot-graph-20260718 (verified)"; `npm run build` green 2026-07-19.

<!-- Intentionally empty. The orchestrator must present the blocking checkpoint and transcribe operator-supplied migration, deploy, four-file export, and pool re-freeze evidence here. -->

## Next Phase Readiness

- Task 1 is ready for operator use.
- Plan 04-06 and Phase 4 are not complete. Task 2 remains a blocking operator checkpoint.
- STUDY-05 must not be marked complete until the later 3–5-user end-to-end run and issue closure are verified through the protocol.

## Self-Check: PASSED

- Found committed `docs/pilot_protocol.md`.
- Found Task 1 commit `517533f`.
- Found this uncommitted checkpoint summary with Task 2 marked pending.

---
*Phase: 04-study-infrastructure-pilot*
*Updated: 2026-07-19*
