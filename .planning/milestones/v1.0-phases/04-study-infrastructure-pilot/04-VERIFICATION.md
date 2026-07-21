---
phase: 04-study-infrastructure-pilot
verified: 2026-07-20T06:01:44Z
status: human_needed
score: 11/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Run the internal pilot: 3-5 seeded study accounts complete onboarding, browse the feed, ask questions, and complete pre/post oral tests end-to-end via docs/pilot_protocol.md"
    expected: "All 3-5 participants complete the per-participant checklist; release-blocker issues (if any) are logged, fixed, and retested; exit gate in pilot_protocol.md §6 is satisfied"
    why_human: "Requires real human participants and operator-controlled deployment; STUDY-05/SC4 explicitly cannot be satisfied by code (D-13)"
---

# Phase 4: Study infrastructure + pilot Verification Report

**Phase Goal:** The prototype is a runnable, IRB-ready study instrument validated by an internal pilot.
**Verified:** 2026-07-20T06:01:44Z
**Status:** human_needed
**Re-verification:** Yes — canonical CORS deploy and fresh API 36 enrollment/ingest evidence added

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Wire contract additive; version `research-ingest-v1` unchanged; recommendation kind/8-strategy/limits metadata added | VERIFIED | `shared/research-wire-contract.v1.json` line 2 `"version": "research-ingest-v1"` unchanged; `recommendation` block added lines 16-34 with exactly 8 strategies; migration-schema test asserts strategy parity — `research-backend/test/migration-schema.test.mjs` passes (2/2) |
| 2 | Migration 0004 creates `recommendations` table with 18 specified columns + non-unique session-order index | VERIFIED | `research-backend/migrations/0004_recommendations.sql` — all 18 columns present (id, user_id, condition, topic_id, session_id, batch_id, batch_seq, batch_position, post_id, generated_at, strategy, score, reason_text, contributing_question_ids, contributing_concept_ids, contributing_post_ids, component_scores, received_at); `CREATE INDEX ... recommendations_session_order ON recommendations(user_id, session_id, batch_seq, batch_position)` is non-unique; CHECK constraints on condition/strategy/batch_seq/batch_position confirmed |
| 3 | `hasAffirmativeResearchConsent` is version-gated; legacy `aiConsentGiven`-only install never satisfies it | VERIFIED | `app/src/services/research-consent.service.ts` lines 7-16 — three-way conjunction `onboardingCompleted === true && researchConsentGiven === true && researchConsentVersion === RESEARCH_CONSENT_VERSION`; `aiConsentGiven` not read at all |
| 4 | Five §14.3 disclosure keys present in all 4 locale bundles with identical key sets | VERIFIED | Direct `require()` of en/zh/es/ja `onboarding.consent` objects — all four show identical key arrays: title, intro, itemLogging, itemQaStorage, itemOralRecording, itemAnonymization, itemWithdrawal, consent, continue; `bundle-parity.test.mjs`/`missing-key.test.mjs` pass as part of full app suite |
| 5 | Worker binds recommendation identity only from bearer-token account; cross-account collision returns 409 | VERIFIED | `research-backend/src/worker.ts` `bindRecommendationInsert` (line 231) binds `account.userId/account.condition/account.topicId`, never `record.*`; `handleIngest` recommendation branch (line 279-285) does pre-insert owner lookup and returns `{error:'Record conflict.'}` 409 on mismatch |
| 6 | `buildExportZip` emits exactly four CSVs: behavioral-events.csv, question-answer-records.csv, recommendations.csv, participants.csv | VERIFIED | `research-backend/src/export.ts` lines 91-101 — exactly these four `strToU8(toCsv(...))` entries; `test/export.test.mjs` (part of 45/45 backend suite) asserts exact 4-entry ZIP |
| 7 | `participants.csv` includes zero-activity accounts (LEFT JOIN, no row multiplication) | VERIFIED | `research-backend/src/worker.ts` `handleAdminExport` pre-aggregates installation and event subqueries before LEFT JOIN onto `study_accounts` per 04-02-PLAN.md Task 2 action; export test suite (5/5) covers zero-activity and token-rotation non-multiplication cases |
| 8 | `recommendation-research.service` is consent-gated, dbQuery-only, idempotent | VERIFIED | `app/src/services/recommendation-research.service.ts` — `projectRecommendationResearchRecords()` returns 0 immediately when `!hasAffirmativeResearchConsent()` (line 61); reads/writes exclusively via `dbQuery`/`dbExecute` (no in-memory mirror read); idempotency via `SELECT * FROM research_records WHERE id = ?` existence check (line 70-74) before insert |
| 9 | No module under `app/src/services/ranking/` imports the projection service; Phase 3 control-isolation tests unmodified/green | VERIFIED | `grep -rn "recommendation-research" app/src/services/ranking/` returns no matches; `node --test tests/services/recommendation.service.test.mjs` passes 3/3 suites including the control-isolation/throwing-spy cases |
| 10 | `docs/pilot_protocol.md` exists with six sections, eight rubric dimensions, exact export headers | VERIFIED | File exists (19.6KB, committed at `517533f`); six `## ` sections present (Preflight, Per-Participant Run, External Scoring Sheet Contract, Export Audit, UAT Evidence Template, Issue Log & Exit Gate); all 12 anchor tokens present (POOL_INVALID, wrangler d1 migrations apply, wrangler deploy, participants.csv, pre_verbal, pre_domain, post_domain, GeneralBaselineWordCount, blind, study_accounts, recommendations.csv, server_rejected) |
| 11 | Live backend and Android transport are operational: migration/export gates pass, exact-origin Worker deploy is live, and fresh-device ingest reaches D1 | VERIFIED (operator + ADB evidence) | `04-06-SUMMARY.md` records migration 0004, canonical deployment, authenticated admin/export smoke, removal of 83 test events, and graph-pool cutover. Plan 04-07 redeployed `question-trace-research-collector` version `55b154c5-8dd2-4f25-8045-673ceb9fa406` with the exact non-secret origin binding; both `https://localhost` public preflights returned 204 and near-matches returned 403. Fresh API 36 ADB UAT bound account 1001, completed consent, opened a post, survived relaunch, and produced 19 remote behavioral events after a zero-row baseline. |
| 12 | Internal pilot (3-5 users) runs end-to-end; issues fixed; system IRB-ready per D-14 | HUMAN_NEEDED | App+docs+deployment side of IRB-readiness is complete and verified above. The actual 3-5-person run has not occurred — `STUDY-05` remains pending; per D-13 this is explicitly participant/operator work outside code-phase execution. |

**Score:** 11/12 truths verified (1 routed to human verification — the pilot run itself, which the phase's own locked decisions (D-13) define as operator work a code phase cannot perform)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/research-wire-contract.v1.json` | recommendation metadata block, additive | VERIFIED | version unchanged, block added, existing keys byte-identical |
| `research-backend/migrations/0004_recommendations.sql` | recommendations table + index | VERIFIED | 18 columns, CHECK constraints, non-unique index |
| `research-backend/src/validation.ts` | `parseRecommendation` + dispatch | VERIFIED | tested via 45/45 backend suite incl. validation.test.mjs |
| `research-backend/test/migration-schema.test.mjs` | schema assertion test | VERIFIED | 2/2 pass |
| `research-backend/src/worker.ts` | ingest branch, admin status, export selects | VERIFIED | `bindRecommendationInsert`, recommendation branch, 409 conflict logic present |
| `research-backend/src/export.ts` | `RECOMMENDATION_COLUMNS`, `PARTICIPANT_COLUMNS`, 4-entry zip | VERIFIED | present with exact column orders |
| `app/src/services/recommendation-research.service.ts` | projection + capture | VERIFIED | consent-gated, dbQuery-only, idempotent, explicit field picks (no spread) |
| `app/src/types/research.ts` | `RecommendationResearchRecord` | VERIFIED | referenced/imported by recommendation-research.service.ts and upload-queue.service.ts |
| `app/src/services/research-consent.service.ts` | `RESEARCH_CONSENT_VERSION` + gate | VERIFIED | version-gated three-way conjunction |
| `app/src/screens/OnboardingScreen.tsx` | five-item consent step, 3-step flow | VERIFIED | `Step = 'welcome' | 'language' | 'consent'`; no apiKey/topic-picker/microphone tokens found |
| `docs/pilot_protocol.md` | full operator protocol | VERIFIED | 6 sections, all anchor tokens, 8 rubric dimensions confirmed present |
| `research-backend/wrangler.jsonc` | canonical exact-origin Worker binding | VERIFIED | Config-derived regression pins the four approved origins; credentials remain Worker secrets |
| `research-backend/test/deployment-config.test.mjs` | deployment-config/public-preflight regression | VERIFIED | Exercises both public paths for approved, near-match, and absent-binding cases |
| `.planning/debug/resolved/phase4-android-webview-cors.md` | resolved device-boundary diagnosis | VERIFIED | Contains preserved root cause plus live Worker, ADB, logcat, relaunch, and remote-row evidence |
| `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `PROJECT.md` (D-15) | wording aligned to locked decisions | VERIFIED | "one of three topics" / "topic-stratified randomization" absent; STUDY-01/02/04 lines match D-01/D-02/D-06; checkboxes remain unchecked (verifier-owned, correctly untouched) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `shared/research-wire-contract.v1.json` | `research-backend/src/validation.ts` + `app/src/services/research-wire-contract.ts` | both import the same JSON; additive only | VERIFIED | version string identical in both consumers; both compile/pass tests |
| `handleIngest` → `requireInstallAuth` account | `bindRecommendationInsert` identity columns | server-authoritative identity | VERIFIED | `account.userId/condition/topicId` bound, wire `record.*` identity fields never read (allowlist excludes them at validation too) |
| `handleAdminExport` | `behavioral_events` feed_impression rows | served_at LEFT JOIN keyed by recommendation_id | VERIFIED | export.test.mjs asserts served_at blank vs earliest-impression cases pass |
| `recommendation.service` `buildBatch` ready-save | `recommendation-research.service` capture hook | error-isolated lazy import, fires after `saved.success` | VERIFIED | `void this.dependencies.captureResearch().catch(() => {})` pattern confirmed by 04-03-SUMMARY hook tests (21/21) and full suite |
| `App.tsx` boot | `projectRecommendationResearchRecords()` before `reconcileResearchOutbox()` | consent-gated boot block ordering | VERIFIED | ordering per plan action item; consent-gate regression tests (`tests/phase1/consent-gate.test.mjs`) still pass |
| `participants.csv.user_id` | external audio/transcript/rubric filenames | STUDY-04/RQ-03 join key | VERIFIED (design); NOT YET EXERCISED (no real participants) | join key mechanism exists and is documented in pilot_protocol.md §3; actual join will only be exercisable once the pilot runs |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STUDY-01 | 04-04 | Onboarding hardening: §14.3 consent, no topic picker, study-provided LLM | SATISFIED | 5-item consent, 3-step flow, 4-locale parity confirmed above |
| STUDY-02 | 04-05 | Condition assignment: researcher-set, persisted, drives ranker+logging | SATISFIED (verification-only, per D-02) | 04-05-SUMMARY.md 5-row traceability table backed by 22+28 passing tests; re-confirmed here via recommendation.service.test.mjs green |
| STUDY-03 | 04-01, 04-02, 04-03, 04-07 | Researcher export: events+questions+answers+recommendations+participants, §14.2-excluded | SATISFIED | Full chain verified end-to-end: contract → migration → validation → real API 36 client ingest → remote D1 row evidence → export → client projection |
| STUDY-04 | 04-02, 04-06 | Oral-test support: clean linking key in export, out-of-band capture | SATISFIED (app/export contribution); external administration is HUMAN_NEEDED | `participants.csv` join key exists and verified; actual oral-test administration is pilot-run-dependent |
| RQ-03 | 04-06 | Oral-explanation quality measurable from export + external scoring | SATISFIED (doc/contract level) | `pilot_protocol.md` §3 defines exact fields, 8 rubric dimensions, and §13.5 formulas verbatim |
| STUDY-05 | 04-06, 04-07 | Internal pilot (3-5 users), issues fixed, IRB-ready | HUMAN_NEEDED | Instrument, packaged graph pool, protocol, live Worker, and fresh-device transport are verified; the genuine 3-5-person run remains pending |

No orphaned requirements found — all Phase-4-mapped requirement IDs in REQUIREMENTS.md appear in at least one plan's `requirements` frontmatter field.

### Anti-Patterns Found

None. Scanned all 16 phase-modified source/doc files (shared contract, migration, validation.ts, worker.ts, export.ts, admin.ts, research.ts, index.ts, research-wire-contract.ts, upload-queue.service.ts, recommendation-research.service.ts, recommendation.service.ts, App.tsx, research-consent.service.ts, OnboardingScreen.tsx, pilot_protocol.md) for `TBD|FIXME|XXX` — zero matches. No stub markers, no hardcoded-empty stubs, no placeholder JSX found in the reviewed core artifacts.

### Behavioral Spot-Checks / Test Suite Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full app suite | `cd app && npm test` | 611 passed, 0 failed, 0 skipped | PASS |
| Full backend suite | `cd research-backend && npm test` | 45 passed, 0 failed | PASS |
| Production app build | `cd app && npm run build` | packaged 77 posts from `pilot-graph-20260718`; TypeScript and Vite build exited 0 | PASS |
| Frozen-pool package check | `cd app && node scripts/package-content-pool.mjs --check` | 77 posts from `pilot-graph-20260718` verified | PASS |
| Capacitor/Android build | `cd app && npx cap sync android`; `cd android && .\gradlew.bat assembleDebug` | sync passed; rerun assembled `com.trellis.app` for compile/target SDK 36, SHA-256 `2ebd83d0...d38a30` | PASS |
| Fresh-device enrollment/ingest | ADB-only API 36 install/clear/enroll/consent/post/relaunch + read-only remote D1 query | account 1001 persisted; 19 events received in the retest window; zero targeted CORS/network-error logcat matches | PASS |
| Migration schema assertions | `cd research-backend && node --test test/migration-schema.test.mjs` | 2/2 pass | PASS |
| Ranking isolation grep | `grep -rn "recommendation-research" app/src/services/ranking/` | no matches | PASS |
| Control-isolation regression | `node --test tests/services/recommendation.service.test.mjs` | 3/3 suites pass | PASS |
| Debt-marker scan | grep TBD/FIXME/XXX across 16 phase files | 0 matches | PASS |
| Pool cutover state check | package/build the configured production pool | `pilot-graph-20260718` packaged, integrity-checked, and included in the passing Android build | PASS |

### Gaps Summary

No code, content-pool, database-hygiene, CORS, or fresh-device transport gap remains. Re-verification confirms the configured `pilot-graph-20260718` pool packages and builds, the earlier 83 test events were removed on 2026-07-19, the canonical Worker now enforces the exact four-origin contract, and the ADB-only API 36 smoke binds and uploads through the live boundary.

One genuine human item remains:

1. **Pilot run (STUDY-05 / SC4)** — the 3–5-person end-to-end run has not happened. This is participant/operator work by design; a code phase cannot recruit or run human participants. `pilot_protocol.md` provides the executable instrument, and its infrastructure preconditions are now verified.

This remaining item alone keeps `status: human_needed` and the score at 11/12.

### Human Verification Required

See the single frontmatter `human_verification` item above: the genuine 3–5-person pilot.

---

_Re-verified: 2026-07-20T06:01:44Z_
_Verifier: Claude (gsd-verifier)_
