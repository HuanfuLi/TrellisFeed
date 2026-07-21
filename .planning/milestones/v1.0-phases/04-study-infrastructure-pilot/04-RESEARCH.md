# Phase 4: Study infrastructure + pilot - Research

**Researched:** 2026-07-18
**Domain:** Privacy-bounded study export, consent hardening, immutable assignment verification, and pilot operations
**Confidence:** HIGH for repository architecture; MEDIUM for operator-controlled deployment/pilot readiness

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Topic & condition assignment (STUDY-01 / STUDY-02)
- **D-01:** **One study topic for the whole instrument** (pilot AND eventual main study), using the existing frozen `content_pool_v1` topic. All three-topic support is out of scope. Rationale: constraint management, reuse of pilot materials, and lower content-collection cost. **⚠ DEVIATION** from design doc §6.3 / §18-Decision-5 ("three topics") — but that is a *proposed*, non-locked decision, and §20 lists final topics as an open question, so this is a legitimate lock here.
- **D-02:** **Condition (control/experimental) is set explicitly by the researcher** per seeded D1 `study_accounts` row — deterministic, no randomization. With one topic, "topic-stratified randomization" collapses to a single stratum. **This is ALREADY how the system works**: `/v1/install/resolve` returns the researcher-seeded `{condition, topicId}`, and `studyContextService.bindOnce` locks it immutably on-device. **⚠ DEVIATION** from STUDY-02 wording ("topic-stratified randomization") → researcher-assigned. Verify + document; do not build a randomizer.
- **D-03:** **No topic-selection screen.** Onboarding stays `welcome → language → consent`; the server binds the single topic silently. The participant makes no topic choice.

### Onboarding & consent (STUDY-01)
- **D-04:** **Expand the consent step to cover all §14.3 items**: in-app interaction logging; AI questions stored for research; **audio responses in pre/post tests are recorded and transcribed** (mandatory even though recording is external); data anonymized; withdrawal per protocol. Current onboarding consent is a single `aiConsentGiven` boolean — insufficient for STUDY-01.
- **D-05:** **LLM keys remain study-build-provided** — participants only consent; no participant API-key entry step. (Confirms existing `OnboardingScreen` behavior.)

### Oral-test capture (STUDY-04 / RQ-03)
- **D-06:** **Fully out-of-band.** The researcher administers pre/post oral tests and records externally (phone/Zoom), naming files by `userId`. **No in-app microphone, audio storage, or recording plugin.** Rules out the Capacitor voice-recorder path and any audio egress. Transcription + human blind scoring (§13.6) happen offline.
- **D-07:** **No in-app oral-test surface at all** — no instruction screens, no prompt rendering. The app's only STUDY-04 contribution is that the export carries a clean per-participant linking key (see D-09).
- **D-08:** **Oral-test prompts live in an external researcher protocol doc** (and design doc §13.2/§13.3), not in the app or repo render path.

### Researcher export (STUDY-03)
- **D-09:** **Extend the backend** to close the recommendations gap: add a `recommendations` wire-contract kind → new D1 table → `recommendations.csv` in `/admin/export.zip`. Recommendation content (reasonText, strategy, contributing trace IDs, served batch order) currently lives ONLY in on-device IndexedDB and reaches no export path. Backend-authoritative = single joinable dataset, auto-uploaded, survives device loss.
- **D-10:** **Add a `participants.csv` manifest** to the export (userId, condition, topicId, enrollment + activity timestamps) — the join key for externally-recorded oral audio (D-06/07) and per-participant analysis/normalization (§13.5).
- **D-11:** **Keep the export as CSV-per-table in a ZIP** (matches existing `behavioral-events.csv` + `question-answer-records.csv`; §14.2 exclusions already enforced by the wire-contract field allowlist).

### Pilot & IRB-readiness (STUDY-05)
- **D-12:** **Pilot runs on the existing ~77-post frozen pool as-is** (exceeds the design's ~50-post pilot minimum). Scaling the single topic toward 200–400 posts for the main study is a later offline `tools/content_pipeline` task — out of Phase 4 code scope.
- **D-13:** **Phase 4 delivers a pilot-ready instrument + a written pilot protocol/checklist** (enrollment, condition seeding, oral-test administration, export, issue log). The actual 3–5 person run is an operator activity that feeds fixes back; a code phase cannot recruit humans.
- **D-14:** **"IRB-ready" = app + docs support IRB** (consent covers §14.3, §14.2 exclusions enforced, export + data-handling documented, protocol doc exists). Actual IRB submission is the operator's, out of scope.

### Docs that need wording updates (consequence of D-01/D-02/D-06)
- **D-15:** Update to match the one-topic + researcher-assigned + out-of-band decisions: `.planning/REQUIREMENTS.md` (STUDY-01 "one of three topics" → one; STUDY-02 "topic-stratified randomization" → researcher-assigned; STUDY-04 capture is out-of-band), `.planning/ROADMAP.md` Phase 4 success criterion #1, and `.planning/PROJECT.md` proposed-decisions ("three topics" → one). Planner should sequence these doc edits alongside the code.

### Claude's Discretion
- Exact consent-screen copy/layout and the `participants.csv` column set (beyond the required join fields) are left to research + planning, provided D-04 §14.3 coverage and D-10 join-key are met.
- Pilot protocol/checklist document format (D-13).

### Deferred Ideas (OUT OF SCOPE)

- **Scale the single topic pool from ~77 toward 200–400 posts** via `tools/content_pipeline` for the main study — offline pipeline work, a new frozen content-pool version, out of Phase 4 code scope.
- **Multi-topic support** (three-topic study, participant topic choice, topic-stratified randomization) — explicitly dropped for this instrument (D-01); could return only as a future milestone if the study design changes.
- **In-app audio capture / auto-transcription** — considered and rejected (D-06) on build-cost + privacy grounds; not a future Phase 4 item unless the oral-test protocol changes.

None of the above belong in Phase 4.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STUDY-01 | Stale requirement: welcome, language, consent, LLM setup, and participant topic selection. | Apply D-01/D-03/D-05: retain `welcome → language → consent`, silently use the server-bound single topic, keep study-build LLM configuration, and separate versioned research consent from the existing AI-provider consent flag. The visible copy must enumerate every §14.3 disclosure in all four locale bundles. [VERIFIED: `04-CONTEXT.md` D-01/D-03–D-05; `OnboardingScreen.tsx`; RSD §14.3] |
| STUDY-02 | Stale requirement: topic-stratified randomization persisted into ranker/logging condition. | Apply D-02: verify seeded `study_accounts → /v1/install/resolve → bindOnce → recommendationService/interactionLog`; do not add a randomizer. [VERIFIED: `worker.ts`; `study-context.service.ts`; `recommendation.service.ts`; `interaction-log.service.ts`] |
| STUDY-03 | Export events, questions, answers, and recommendations while excluding §14.2 categories. | Add a recommendation research-record projection, wire validator, authenticated ingest branch, D1 table, `recommendations.csv`, and `participants.csv`; reuse the durable outbox and existing ZIP/CSV functions. [VERIFIED: D-09–D-11; current code paths inspected below] |
| STUDY-04 | Stale requirement: app captures/transcribes pre/post oral tests. | Apply D-06–D-08: no app capture or oral UI. The app/backend deliverable is the exact participant join key in `participants.csv`; administration, recording, transcription, and blind scoring remain external protocol work. [VERIFIED: `04-CONTEXT.md`; RSD §13.2–§13.6] |
| RQ-03 | Measure richer oral explanations and normalized improvement. | Join external transcript/rubric rows to `participants.csv.user_id`; keep condition hidden during §13.6 scoring, then join for analysis. The app export need not contain audio or rubric columns. [VERIFIED: RSD §3 RQ3, §13.4–§13.6; D-06–D-10] |
| STUDY-05 | Run a 3–5-user internal pilot, validate the instrument, fix issues, and become IRB-ready. | Deliver a protocol/checklist, then use explicit operator checkpoints for pool re-freeze, backend migration/deploy, account seeding, external oral testing, export audit, issue logging, fixes, and rerun. [VERIFIED: D-12–D-14; RSD §16 Phase 7, §21] |
</phase_requirements>

## Summary

Phase 4 should be planned as an extension of the existing collection system, not a new study subsystem. The main implementation is a crash-recoverable projection from the two Phase 3 IndexedDB stores (`recommendation_batches` and `recommendations`) into the existing `research_records → research_upload_queue → /v1/ingest` path, followed by a new D1 table and two additional CSV members in the authenticated ZIP. `participants.csv` is generated directly from server-authoritative study accounts, installation enrollment time, and event activity time; it is not uploaded by the client. [VERIFIED: `recommendation.repository.ts`; `upload-queue.service.ts`; `worker.ts`; D-09–D-11]

Onboarding remains exactly three steps. The consent surface must explicitly disclose the five §14.3 items, including externally recorded/transcribed oral responses, and should store research consent separately from `aiConsentGiven` so an AI-provider flag is not treated as study consent. No topic screen, API-key entry, oral-test screen, microphone dependency, or runtime translation belongs in this phase. [VERIFIED: D-03–D-08; `OnboardingScreen.tsx`; `research-consent.service.ts`; `CLAUDE.md` i18n workflow]

STUDY-02 is verification work: the Worker returns only the seeded D1 condition/topic, `bindOnce` persists the identity through `dbQuery` and rejects changes, `recommendationService` branches on that identity, and `interactionLog` snapshots it into records. STUDY-04/RQ-03 likewise adds no capture feature: the export's `user_id` is the join key for external recordings/transcripts/rubrics. STUDY-05 needs a human checkpoint; automated completion cannot substitute for the operator's 3–5-user run and issue-fix loop. [VERIFIED: targeted tests; D-02/D-06–D-08/D-13]

**Primary recommendation:** Plan four dependent work groups: (1) lock/test the additive recommendation and participant export contract; (2) implement backend migration/ingest/export and deploy it before the client; (3) implement client recommendation projection plus versioned consent/i18n and verify assignment; (4) execute the operator pool/deploy/pilot checklist, fix the issue log, and rerun all gates. [VERIFIED: dependency analysis and current outbox failure behavior]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Consent disclosure and affirmative gate | Browser / Client | Local preference storage | The participant reads and accepts build-time localized copy before routes, logging, or LLM prewarm are enabled. [VERIFIED: `OnboardingScreen.tsx`; `research-consent.service.ts`; `App.tsx`] |
| Researcher condition/topic assignment | Database / Storage (D1) | API + Browser / Client binding | D1 owns the assignment, the Worker resolves it, and the client binds it once without an edit/clear path. [VERIFIED: `0001_init.sql`; `worker.ts`; `study-context.service.ts`] |
| Recommendation research projection | Browser / Client service | IndexedDB | The device alone has recommendation and batch rows, so it must flatten ready batches through `dbQuery` into durable research records. [VERIFIED: `recommendation.repository.ts`; D-09] |
| Durable delivery | Browser / Client outbox | API / Backend | Existing persistence-first enqueue, retry, quarantine, ACK receipt, and reconciliation behavior should carry the new record kind. [VERIFIED: `upload-queue.service.ts`; targeted 30-test run] |
| Recommendation ingest | API / Backend | D1 | The authenticated Worker re-derives identity and writes an idempotent, cross-account-safe row. [VERIFIED: current event/Q&A pattern in `worker.ts`] |
| ZIP/CSV export | API / Backend | D1 | `/admin/export.zip` already owns authenticated aggregate export and spreadsheet-safe CSV encoding. [VERIFIED: `export.ts`; `worker.ts`; `admin.ts`] |
| Participant manifest | API / Backend | D1 | Server-authoritative accounts/installations/events contain the join and timing facts; no client manifest upload is needed. [VERIFIED: migrations; D-10] |
| Oral assessment | External researcher protocol | Backend export join key | Recording, transcription, and scoring are deliberately out of band; only `user_id` crosses into the app export. [VERIFIED: D-06–D-08; RSD §13] |
| Pilot execution and issue closure | Operator / Research process | App + Backend + docs | Human enrollment, external oral tests, device use, export inspection, and issue triage cannot be automated away. [VERIFIED: D-13; RSD §16 Phase 7] |

## Project Constraints (from AGENTS.md)

- Treat `docs/research_system_design.md` as the canonical implementation guide, `docs/SCOPE.md` as the fixed scope contract, and never reintroduce §15.3 product features. [VERIFIED: `AGENTS.md`]
- Preserve CLAUDE.md load-bearing rules: heavy data uses IndexedDB through `dbQuery`/`dbExecute`; frozen content is immutable; Ask is identical in both conditions; control never reads question history; UI translation is build-time only. [VERIFIED: `CLAUDE.md`]
- Use TypeScript/React functional components, focused services, existing inline CSS-variable UI style, and the established naming/layout conventions. [VERIFIED: `AGENTS.md`]
- Use Node `node:test` with `assert/strict`, execute real code paths where practical, mock network/AI, and verify persistence through `dbQuery` instead of in-memory mirrors. [VERIFIED: `AGENTS.md`; `CLAUDE.md` false-green warning]
- Run app commands from `app/`: `npm test`, `npm run lint`, and `npm run build`; include screenshots for consent UI changes in the later PR evidence. [VERIFIED: `AGENTS.md`]
- Keep live `.planning/` docs aligned with behavior; inherited `openspec/` and Trellis planning history are not live state. [VERIFIED: `AGENTS.md`]
- Project skill discovery found GSD workflow command skills but no implementation skill that changes the repository conventions for this research task. [VERIFIED: `.codex/skills/` inventory]

## Standard Stack

### Core

| Library / seam | Version | Purpose | Why Standard Here |
|----------------|---------|---------|-------------------|
| TypeScript | 5.9.3 | Recommendation upload type, consent preference fields, client validation | Already installed; the current event/Q&A contract is typed here. [VERIFIED: `app/package.json`] |
| React | 19.2.6 | Expand the existing consent step only | The step machine and CSS-variable presentation already exist; no new UI framework is needed. [VERIFIED: `app/package.json`; `OnboardingScreen.tsx`] |
| IndexedDB through `dbQuery`/`dbExecute` | internal seam, DB v7 | Read recommendation/batch rows and persist research/outbox records | This is the load-bearing durable store and has a testable Node fallback. [VERIFIED: `db.service.ts`; orchestrator Phase 3 update] |
| Existing upload queue | internal seam | Persistence-first batching, retry, ACK, quarantine, reconciliation | It already provides the delivery guarantees required by D-09. [VERIFIED: `upload-queue.service.ts`; targeted tests] |
| Cloudflare Worker + D1 | Wrangler 4.110.0 | Authenticated ingest, assignment, server-authoritative data, export | This is the deployed research-backend architecture; extend its existing branches and prepared statements. [VERIFIED: `research-backend/package.json`; environment probe] |
| fflate | 0.8.3 | ZIP creation | `buildExportZip` already uses it for the two existing CSVs. [VERIFIED: `research-backend/package.json`; `export.ts`] |
| i18next / react-i18next | 26.1.0 / 17.0.7 | Four-locale consent copy | Existing EN-first bundle workflow and parity gate are mandatory. [VERIFIED: `app/package.json`; `CLAUDE.md`] |

### Supporting

| Library / seam | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Node test runner | Node 22.19.0 | App/backend contract, persistence, export, and consent tests | Per task and per wave; relevant targeted suites complete in under one second locally. [VERIFIED: environment and targeted runs] |
| `escapeCsvCell` / `toCsv` | internal | RFC-4180-style quoting and formula neutralization | Every new CSV must reuse these helpers. [VERIFIED: `export.ts`; `export.test.mjs`] |
| Web Crypto | platform API | Install-token generation/hash and credential comparisons | Keep existing auth behavior unchanged; do not add custom crypto. [VERIFIED: `worker.ts`] |
| Existing settings service | internal localStorage preference seam | Small boot-critical consent/version/timestamp preferences | CLAUDE permits settings preferences in localStorage; recommendation/batch data remains in IndexedDB. [VERIFIED: `settings.service.ts`; `CLAUDE.md`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing outbox | A second recommendation uploader | Duplicates retry/auth/receipt logic and creates inconsistent delivery semantics. Reject. [VERIFIED: D-09; `upload-queue.service.ts`] |
| Backend ZIP extension | Local recovery JSON as primary export | Local recovery is per-device, PIN-gated, and vulnerable to device loss; D-09 chooses backend authority. Reject. [VERIFIED: `research-export.service.ts`; `ResearchDiagnosticsScreen.tsx`] |
| Seeded assignment | Client randomizer/topic selector | Contradicts D-01–D-03 and weakens server authority. Reject. [VERIFIED: `04-CONTEXT.md`] |
| External oral protocol | Capacitor recorder/transcriber | Explicitly forbidden by D-06–D-08 and would add audio egress/privacy surface. Reject. [VERIFIED: `04-CONTEXT.md`] |
| Build-time locale bundles | Runtime LLM translation | Prohibited and non-deterministic for consent language. Reject. [VERIFIED: `CLAUDE.md`] |
| Operator pool re-freeze | Runtime compatibility workaround | Violates immutable frozen-pool and no-live-pipeline boundaries. Reject. [VERIFIED: D-12; `CLAUDE.md`] |

**Installation:** none. Phase 4 needs no new npm package. [VERIFIED: architecture above]

**Version verification:** Versions were read from repository manifests and the local runtime; registry/package-legitimacy checks are unnecessary because the plan adds no package. [VERIFIED: `app/package.json`; `research-backend/package.json`; environment probe]

## Package Legitimacy Audit

Not applicable. No external package should be installed for consent, export, assignment, oral testing, or pilot work. [VERIFIED: locked decisions and existing stack]

## Architecture Patterns

### System Architecture Diagram

~~~text
RESEARCHER ENROLLMENT
seed D1 study_accounts(user_id, condition, one topic_id)
        |
        v
POST /v1/install/resolve --enrollment credential-->
server returns condition/topicId/installToken
        |
        v
studyContextService.bindOnce --> IndexedDB research_metadata
        |                              |
        +--> recommendationService ----+--> control OR experimental ranker
        '--> interactionLog -----------+--> server-derived condition/topic logging

CONSENT
welcome --> language --> five-item consent disclosure
                         |
                         v
versioned research consent + separate AI consent preference
                         |
                         +--> participant route/logging gate
                         '--> condition-neutral Ask/prewarm gate

RECOMMENDATION EXPORT
IndexedDB recommendation_batches + recommendations
        |
        v  (ready batches only; dbQuery; stable flattening)
recommendation research_records --> existing upload queue/retry/ACK
        |
        v
POST /v1/ingest --install token--> Worker allowlist + server identity
        |
        v
D1 recommendations
        |
        +--> join first feed_impression as served_at
        '--> recommendations.csv

D1 study_accounts + first installation + event timestamp aggregates
        '--> participants.csv

authenticated /admin/export.zip
        |-- behavioral-events.csv
        |-- question-answer-records.csv
        |-- recommendations.csv
        '-- participants.csv
                     |
external audio/transcript/rubric files keyed by exact user_id
                     '--> blind scoring first, condition join afterward
~~~

[VERIFIED: current seams; D-02/D-04/D-06–D-11]

### Recommended Project Structure

~~~text
app/src/
├── screens/OnboardingScreen.tsx                 # five-item consent UI; still 3 steps
├── services/research-consent.service.ts          # versioned research-consent gate
├── services/recommendation-research.service.ts   # NEW: dbQuery flatten/reconcile/capture
├── services/research-wire-contract.ts            # recommendation kind + allowlist
├── services/upload-queue.service.ts               # union/revision handling for new kind
├── types/research.ts                              # RecommendationResearchRecord
└── locales/{en,zh,es,ja}.json                     # same-change consent copy

research-backend/
├── migrations/0004_recommendations.sql            # NEW D1 table/indexes
├── src/validation.ts                              # exact recommendation kind validation
├── src/worker.ts                                  # ingest, status, export selects
├── src/export.ts                                  # columns + four-file ZIP
└── test/{validation,ingest,export}.test.mjs        # executable contract coverage

shared/research-wire-contract.v1.json               # shared kind/limits/strategies metadata
docs/pilot_protocol.md                              # NEW operator protocol/checklist
.planning/{REQUIREMENTS,ROADMAP,PROJECT}.md          # D-15 wording corrections
~~~

[VERIFIED: existing repository organization; D-15]

### Pattern 1: Flatten Ready Batches Into Immutable Research Records

`Recommendation` contains the RSD §9.9 item fields, while `RecommendationBatch` contains `sessionId`, `seq`, ordered `recommendationIds`, status, and creation time. No current recommendation field is named `servedAt`; Home logs a `feed_impression` with `recommendationId` when the item is first rendered. [VERIFIED: `content.types.ts`; `graph.types.ts`; `recommendation.repository.ts`; `HomeScreen.tsx`]

Use this exact wire-level recommendation shape:

| Field | Source | Rule |
|-------|--------|------|
| `kind` | constant | Exactly `recommendation`. [VERIFIED: D-09] |
| `id` | `Recommendation.id` | Stable outbox/D1 id; max existing ID limit. [VERIFIED: current IDs] |
| `batchId`, `sessionId` | batch | Non-empty bounded IDs. [VERIFIED: `RecommendationBatch`] |
| `batchSeq` | batch `seq` | Positive safe integer. [VERIFIED: `RecommendationBatch`] |
| `batchPosition` | index in `recommendationIds` | Export as 1-based positive integer; this is the served batch order. [VERIFIED: D-09 plus ordered array] |
| `postId` | recommendation | Non-empty bounded post ID. [VERIFIED: RSD §9.9] |
| `generatedAt` | recommendation | ISO-parseable timestamp. [VERIFIED: RSD §9.9] |
| `strategy` | recommendation | Exact eight-value strategy allowlist. [VERIFIED: `content.types.ts`] |
| `score` | recommendation | Finite number; reject `NaN`/infinities. [VERIFIED: RSD §9.9] |
| `reasonText` | recommendation | Required, non-empty, bounded text. [VERIFIED: D-09; RSD §9.9] |
| `contributingQuestionIds`, `contributingConceptIds`, `contributingPostIds` | recommendation | Optional bounded string arrays; control rows remain absent/empty. [VERIFIED: RSD §9.9; current control construction] |
| `componentScores` | recommendation | Optional object with bounded known string keys and finite numeric values; serialize as JSON in D1/CSV. [VERIFIED: RSD §9.9] |
| `userId`, `condition`, `topicId` | never accepted from wire | Strip client identity and re-derive from the bearer installation account. [VERIFIED: current wire/Worker pattern] |
| `servedAt` | not sent | Derive in export as the earliest matching `feed_impression.timestamp`; leave blank if never impressed. [VERIFIED: current Home event path] |

The device projection must query both stores through `dbQuery`, ignore `building` batches, preserve array order, write each projected row to `research_records` with kind `recommendation`, then enqueue it. Run it immediately after a ready batch is committed and again during boot reconciliation so a crash between batch persistence and research-record persistence converges. [VERIFIED: CLAUDE false-green rule; existing outbox reconciliation pattern]

Do not upload `diversityCounters` or batch `status`: the former is internal mutable serving state and neither is required by D-09. Do include batch/session/order fields because item rows alone cannot reconstruct exposure order. [VERIFIED: D-09; `RecommendationBatch` shape]

### Pattern 2: Additive Authenticated Worker Ingest

The backend path should mirror immutable events:

1. `parseIngest` recognizes an explicit `kind === 'recommendation'`, rejects every non-allowlisted key, validates strings/timestamps/finite numbers/arrays/object bounds, and rejects ambiguous event/Q&A/recommendation shapes. [VERIFIED: current `validation.ts` pattern]
2. `handleIngest` authenticates first, checks an existing recommendation ID cannot belong to a different account, then binds a parameterized `INSERT OR IGNORE`. [VERIFIED: current event conflict pattern]
3. The Worker writes `user_id`, `condition`, and `topic_id` only from `requireInstallAuth`, never from the payload. [VERIFIED: current server-authoritative identity]
4. ACK returns the same stable recommendation ID so existing receipt/deletion logic works. [VERIFIED: `upload-queue.service.ts`; `worker.ts`]

Recommended D1/CSV columns:

~~~text
id,user_id,condition,topic_id,session_id,batch_id,batch_seq,batch_position,
post_id,generated_at,served_at,strategy,score,reason_text,
contributing_question_ids,contributing_concept_ids,contributing_post_ids,
component_scores,received_at
~~~

The migration should materialize the same fields except `served_at`, with `id` as the primary key, condition/strategy checks, positive `batch_seq`/`batch_position` checks, JSON-text contributor/component columns, and a non-unique `(user_id, session_id, batch_seq, batch_position)` analysis index. Do not add a unique batch-position constraint unless the Worker also checks and reports that conflict; `INSERT OR IGNORE` must never ACK a row discarded by an unrelated uniqueness rule. [VERIFIED: current idempotent insert/ACK pattern]

`served_at` is export-derived, not a stored D1 recommendation column. Array/object columns remain JSON text, matching current Q/A export conventions. [VERIFIED: `QUESTION_ANSWER_COLUMNS`; current event join key]

### Pattern 3: Server-Generated Participant Manifest

Use all seeded accounts as the left side so accounts with zero activity remain visible. Define this minimal column set:

~~~text
user_id,condition,topic_id,enrolled_at,first_activity_at,last_activity_at,last_received_at
~~~

- `user_id`, `condition`, `topic_id`: `study_accounts`. [VERIFIED: `0001_init.sql`]
- `enrolled_at`: earliest `research_installations.created_at`, the first observable successful install resolution. The current account table has no provisioning timestamp. [VERIFIED: `0001_init.sql`; `0002_install_tokens.sql`; `worker.ts`]
- `first_activity_at` / `last_activity_at`: min/max participant event `timestamp`. [VERIFIED: `behavioral_events` schema; D-10]
- `last_received_at`: max event `received_at`, useful for distinguishing participant activity time from delayed upload arrival. [VERIFIED: `behavioral_events` schema]

Use pre-aggregated subqueries before joining accounts, installations, and events; a direct three-table join multiplies rows when an account has multiple installations and events. [VERIFIED: schema cardinalities]

`user_id` must remain an exact string in CSV and in external filenames, including any leading zero. The pilot protocol should prohibit numeric coercion during spreadsheet import and require the same exact ID in audio/transcript/rubric filenames. [VERIFIED: numeric-string validation permits leading zeros; D-06/D-10]

### Pattern 4: Separate Research Consent From AI Consent

The current gate equates `onboardingCompleted && aiConsentGiven` with research consent, and the current checkbox discloses interaction/Q&A upload but not external audio/transcription, anonymization, or withdrawal. [VERIFIED: `research-consent.service.ts`; current locale bundles; RSD §14.3]

Keep the existing three-step state machine, but make the consent page visibly enumerate:

1. interactions inside QuestionTrace are logged;
2. questions asked to AI and answers are stored/uploaded for research;
3. pre/post oral responses are recorded externally and transcribed;
4. study data is anonymized/pseudonymized according to the protocol;
5. withdrawal follows the study protocol.

[VERIFIED: D-04; RSD §14.3]

Add small preference fields such as `researchConsentGiven`, `researchConsentVersion`, and `researchConsentGivenAt`; require the current version in `hasAffirmativeResearchConsent`. Keep `aiConsentGiven` as the separate provider/LLM gate. Do not infer new research consent from a legacy `aiConsentGiven: true`; an installation without the current consent version returns to onboarding. This is the minimal engineering pattern that makes the D-04 separation explicit and prevents stale copy from remaining accepted. [VERIFIED: D-04; existing settings/gate architecture]

The final protocol-specific withdrawal wording/contact must be supplied or approved by the study owner; the implementation must not invent an IRB determination. [VERIFIED: D-14; RSD §20 item 11]

### Pattern 5: Backend-First Additive Rollout

Deploy the D1 migration and Worker support before distributing an app that emits recommendation records. Today a 400/409/413/422 singleton is permanently quarantined as `server_rejected`; an old backend would reject the new kind and the client would quarantine it. [VERIFIED: `sendBatch` in `upload-queue.service.ts`]

Required rollout order:

1. apply `0004_recommendations.sql`;
2. deploy Worker validation/ingest/export;
3. smoke ingest/export with fixtures;
4. ship the client projection/consent build;
5. verify pending/quarantine counts and all four ZIP members.

[VERIFIED: current failure semantics and D-09]

## End-to-End Export Change Map

| Layer | Current state | Required Phase 4 change | Verification |
|-------|---------------|-------------------------|--------------|
| Device source | `recommendations` + `recommendation_batches` only | `dbQuery` ready batches and ordered item rows; boot reconciliation | Seed through repository, restart service, assert projected rows via `dbQuery`. [VERIFIED: repository] |
| Local canonical research store | Only `event` / `qa` rows | Add `recommendation` rows with stable IDs/revision 1 | Query `research_records`; assert exact kind/data and idempotency. [VERIFIED: interaction-log pattern] |
| Wire type | Event/Q&A union; identity stripped | Add `RecommendationResearchRecord` and explicit recommendation kind | Client validator rejects extras/identity/invalid numbers. [VERIFIED: wire pattern] |
| Shared contract | v1 routes/limits/forbidden identity | Add shared recommendation kind/strategy metadata without new route | Client/backend contract parity test. [VERIFIED: shared JSON] |
| Outbox | Event/Q&A union | Extend unions/revision parsing; reuse batch/retry/quarantine/receipt code | Existing upload suite plus recommendation row/reconciliation cases. [VERIFIED: outbox] |
| Worker validation | Infers event vs Q/A | Recognize/reject exact recommendation kind | `validation.test.mjs`. [VERIFIED: existing test pattern] |
| Worker ingest | Event insert, Q/A revision upsert | Cross-account-safe immutable recommendation insert | `ingest.test.mjs` fake D1. [VERIFIED: existing pattern] |
| D1 | No recommendations table | New migration/table/indexes | Migration test/local D1 application. [VERIFIED: migration inventory] |
| Admin status | Counts events/Q&A | Add recommendation count and include it in last-received aggregate | Worker/admin test. [VERIFIED: `handleAdminStatus`] |
| Export builder | Exactly two CSVs | Add recommendation/participant columns and exactly four ZIP entries | Extend `export.test.mjs`. [VERIFIED: current test] |
| Participant manifest | Missing | Server query from accounts/installations/event aggregates | Export/Worker test with active and zero-activity accounts. [VERIFIED: D-10] |

## STUDY-02 Verification, Not Build

The existing chain already satisfies the locked assignment behavior:

- `resolveAccount` accepts a numeric study ID and selects only `condition, topic_id` from `study_accounts`; `/v1/install/resolve` requires the enrollment credential, rotates the prior install, stores only a token hash, and returns the D1 assignment. [VERIFIED: `worker.ts`; `validation.test.mjs`]
- `ResearchSetupScreen` sends only `userId`, validates the response, creates `boundAt`, and calls `bindOnce`; it has no topic or condition input. [VERIFIED: `ResearchSetupScreen.tsx`]
- `bindOnce` reads/writes `research_metadata` through the DB seam, permits only an identical repeat, rejects any identity/token change, and exposes no setter/logout/clear method. [VERIFIED: `study-context.service.ts`; executable study-context test]
- `recommendationService` reads `studyContext.getRequired()` and branches to control or experimental materialization; the control branch never loads personal dependencies. [VERIFIED: `recommendation.service.ts`; existing control-isolation tests]
- `interactionLog.record` copies condition/topic/user from `studyContextService.getRequired()` and rejects caller identity fields; the Worker independently re-derives identity from the install token. [VERIFIED: `interaction-log.service.ts`; app/backend tests]

The planner should add/retain one traceability test command that runs those four existing suites together and a manual seeded-account smoke check. It should not schedule a new assignment service, randomizer, topic picker, or mutable condition control. [VERIFIED: D-01–D-03]

## STUDY-04 / RQ-03 Boundary and Analysis Contract

The only app/backend deliverable for oral assessment is a clean `participants.csv.user_id` join key with condition/topic and timing context. Audio recording, transcription, prompts, rubric entry, and rater workflow remain external. [VERIFIED: D-06–D-10]

The external protocol/scoring sheet—not `/admin/export.zip`—must retain one row per participant/assessment with enough fields to compute §13.4/§13.5 measures:

| Group | External fields required |
|-------|--------------------------|
| Join/stage | exact `user_id`; `assessment_stage` = `pre_verbal`, `pre_domain`, or `post_domain`; recording/transcript filename [VERIFIED: D-06/D-10; RSD §13.2–§13.3] |
| Behavioral | speaking duration, word count, number of examples, distinct claims, concept mentions [VERIFIED: RSD §13.4] |
| Rubric | concept coverage, relationship understanding, stance comparison, counterargument awareness, evidence/example use, transfer, explanatory clarity, overall understanding depth [VERIFIED: RSD §13.4] |
| Scoring audit | blind rater code and per-rater scores sufficient to report inter-rater reliability [VERIFIED: RSD §13.6] |

The analysis then computes `DomainResponseWordCount / GeneralBaselineWordCount`, `PostDomainRubricScore - PreDomainRubricScore`, and `PostWordCount / GeneralBaselineWordCount`. Condition labels are joined only after blind scoring. [VERIFIED: RSD §13.5–§13.6]

Do not add these oral-score columns to the app wire contract: the app never observes them, and doing so would blur the locked out-of-band boundary. [VERIFIED: D-06–D-08]

## Pilot Protocol / Checklist Requirements

Recommend one repository document, `docs/pilot_protocol.md`, organized as an executable operator checklist plus issue table. [VERIFIED: D-13 discretion]

### Preflight

- Confirm the operator has re-frozen `pilot-v1-20260717` with `sources.json`, `global_edges.json`, and `ranking_features.json`, regenerated the packaged projection, and made `npm run build` pass. The current manifest still lists the old `post_concept_edges.json`/`post_claim_edges.json` artifacts and omits all three required Phase 3 artifacts, so the current app intentionally fails with `POOL_INVALID`. This is a hard external precondition, not Phase 4 compatibility code. [VERIFIED: current manifest; `content-pool-bundle.ts`; orchestrator update]
- Apply the recommendation migration and deploy the backend before the client build; configure real secrets/origins privately and never record them in the checklist. [VERIFIED: backend-first pattern; `.dev.vars.example`]
- Seed 3–5 numeric `study_accounts` with the one frozen topic and an explicit planned control/experimental allocation; record the allocation outside participant-facing materials. [VERIFIED: D-01/D-02/D-13]
- Confirm the study owner approved final consent/withdrawal language and external oral prompts. [VERIFIED: D-04/D-08/D-14]

### Per-participant run

- Assign exact `userId`; resolve/bind once; verify no topic picker and no condition disclosure/edit path. [VERIFIED: D-02/D-03]
- Administer and externally record Pretest A and Pretest B; name files with the exact `userId` and stage. [VERIFIED: D-06/D-08; RSD §13.2]
- Complete welcome/language/consent; verify all five disclosures and no participant API-key entry. [VERIFIED: D-04/D-05]
- Exercise Home, Post Detail, suggested and typed Ask, AI answer, source click, save/not-interested, more than one recommendation batch, and recommendation-reason expansion in both conditions. Ask behavior/quality must remain identical. [VERIFIED: RSD §6.5–§6.6, §14.1, §21]
- End/resume sessions and include an offline interval to exercise durable upload retry. [VERIFIED: existing outbox design; RSD §21 multi-day use]
- Administer and externally record the post-test, transcribe, remove condition labels, and score blind. [VERIFIED: RSD §13.3/§13.6]

### Export audit

- Download authenticated ZIP and verify exactly four files, parseable headers, exact participant IDs, both conditions, one topic, and no unexpected columns. [VERIFIED: D-09–D-11]
- Reconcile counts/IDs: every displayed recommendation has a recommendation row; `served_at` matches first `feed_impression`; question/answer revisions are latest; reason-view events link to recommendations. [VERIFIED: existing IDs and proposed joins]
- Confirm §14.2 exclusions by schema/allowlist review: no screen/audio blobs, out-of-app telemetry, geolocation, contacts, other-app names, clipboard, raw keystroke timing, or arbitrary private/device payload fields. [VERIFIED: RSD §14.2; wire allowlist]
- Join external files/scores to `participants.csv.user_id`; verify all three oral stages and normalization denominators are present before analysis. [VERIFIED: RSD §13.2–§13.5]

### Issue loop and exit gate

- Log: issue ID, participant ID only when necessary, condition, app/backend/pool version, steps, expected/actual, severity, privacy/experimental-validity flag, owner, fix reference, retest result. Do not place question text, audio, secrets, or unnecessary participant data in the issue log. [VERIFIED: §14.2 minimization and D-13]
- Triage any missing export row, cross-account record, control trace contributor, Ask asymmetry, consent omission, pool error, or failed join as a release blocker. [VERIFIED: locked invariants and Phase 4 success criteria]
- Fix surfaced issues, rerun targeted/full suites, repeat affected pilot steps, and record closure. The phase cannot claim STUDY-05 complete before the operator confirms a 3–5-user end-to-end run and issue closure. [VERIFIED: D-13; RSD §16 Phase 7]
- Final §21 review: natural multi-day use, fair comparable conditions, interpretable reasons, complete analyzable logs, reliably scorable oral data, and defensible post-level learner traces. [CITED: `docs/research_system_design.md` §21]

## Privacy Allowlist Audit (§14.2)

| Prohibited category | Why the Phase 4 contract still excludes it |
|---------------------|---------------------------------------------|
| Phone screen recordings | No media/blob/path field exists; no screen capture work is planned. [VERIFIED: RSD §14.2; wire shapes] |
| App usage outside QuestionTrace | Only the 16 named in-app events are accepted. [VERIFIED: client/backend `EVENT_TYPES`] |
| Precise geolocation | No location field is accepted in event, Q/A, or recommendation records. [VERIFIED: exact field sets] |
| Contacts | No contact field or permission/plugin exists in the planned path. [VERIFIED: exact field sets; D-06 no plugin] |
| Other app names | No arbitrary payload/device/app-list field is accepted. [VERIFIED: validators/tests] |
| Clipboard | No clipboard field or event exists. [VERIFIED: exact event/record types] |
| Raw keystroke timing | Questions store final submitted text/timestamps only; no key events/timing fields are accepted. [VERIFIED: Q/A schema and allowlist] |
| Unnecessary private data | Positive field allowlists reject arbitrary payloads; recommendation rows contain study IDs, ranking output, and trace IDs only. [VERIFIED: validators] |

The allowlist controls fields, not the semantic content a participant voluntarily types into `questionText`. The consent/data-handling protocol must address that required research text without adding semantic surveillance or a hidden scrubber that changes the canonical question record. [VERIFIED: STUDY-03 requires user questions; RSD §14.3]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recommendation delivery | New network client/retry queue | Existing upload outbox | Already handles batching, offline retry, ACKs, receipts, quarantine, and reconciliation. [VERIFIED: `upload-queue.service.ts`] |
| Research export | New dashboard/export format | Existing authenticated CSV-in-ZIP builder | D-11 locks the format and helpers already prevent CSV formula injection. [VERIFIED: `export.ts`] |
| Condition assignment | Randomizer or client condition setter | Seeded `study_accounts` + resolve + `bindOnce` | D-02 locks deterministic researcher assignment. [VERIFIED: D-02] |
| Oral capture | Recorder, audio store, transcription API | External protocol/tools | Explicitly forbidden in-app. [VERIFIED: D-06–D-08] |
| Consent translation | Runtime LLM translation | Four build-time locale bundles | Runtime translation is prohibited and consent must be stable. [VERIFIED: `CLAUDE.md`] |
| Pool compatibility | Legacy importer/fallback graph | Operator re-freeze with current exporter | Frozen pool is immutable and the old projection is intentionally invalid. [VERIFIED: current manifest and hard precondition] |
| CSV escaping | Per-file custom quoting | `escapeCsvCell` + `toCsv` | Existing tests cover commas/quotes/newlines/formula prefixes. [VERIFIED: backend tests] |
| Identity fields | Client-supplied user/condition/topic | Install-token-owned D1 account join | Prevents tampering and condition drift. [VERIFIED: current Worker] |

## Common Pitfalls

### Pitfall 1: Treating `generatedAt` as `servedAt`

**What goes wrong:** A built recommendation may never be displayed, so generation time is not exposure time. **Avoidance:** export both `generated_at` and derived first-impression `served_at`; allow blank `served_at`. **Warning sign:** every row has identical generation/served times without an event join. [VERIFIED: current batch generation and Home impression timing]

### Pitfall 2: Losing Batch Order During Flattening

**What goes wrong:** Querying recommendation rows alone cannot reconstruct session, batch sequence, or position. **Avoidance:** flatten from ready batch ledgers and enumerate `recommendationIds` before reading items. **Warning sign:** CSV has `post_id`/score but no `session_id`, `batch_seq`, or `batch_position`. [VERIFIED: split store shapes]

### Pitfall 3: Source-Reading False Greens for IndexedDB

**What goes wrong:** Tests prove a function name exists but not that records survive through the real DB seam. **Avoidance:** seed/save, project, reload, and assert via `dbQuery`; include boot reconciliation after an injected crash window. **Warning sign:** tests inspect source or in-memory arrays only. [VERIFIED: `CLAUDE.md` false-green warning]

### Pitfall 4: Shipping the Client Before the Backend

**What goes wrong:** Old validation returns a permanent 4xx and recommendation envelopes are quarantined. **Avoidance:** migration/Worker first, then client; test pending/quarantine counts. **Warning sign:** pilot diagnostics show recommendation records under `server_rejected`. [VERIFIED: outbox failure semantics]

### Pitfall 5: Reusing `aiConsentGiven` as Research Consent

**What goes wrong:** Old installs bypass expanded disclosures because the existing boolean is already true. **Avoidance:** require a distinct current research-consent version; do not migrate the AI flag into it. **Warning sign:** an upgraded install reaches Home without seeing external-audio/anonymization/withdrawal copy. [VERIFIED: current gate; D-04]

### Pitfall 6: Direct-Joining Accounts, Installs, and Events

**What goes wrong:** Multiple installations multiply event rows and corrupt future counts. **Avoidance:** aggregate each many-side in a subquery, then left join to `study_accounts`. **Warning sign:** participant counts vary after token rotation. [VERIFIED: schema cardinality]

### Pitfall 7: Revealing Condition During Blind Scoring

**What goes wrong:** Joining `participants.csv` before scoring defeats §13.6 blinding. **Avoidance:** score files by neutral `user_id`, then join condition after scores are locked. **Warning sign:** rater sheet contains `condition`. [VERIFIED: RSD §13.6]

### Pitfall 8: Smuggling Internal/Personal State Into Control

**What goes wrong:** Export work is wired upstream into ranking or control rows gain question-derived contributors/diversity state. **Avoidance:** projection is read-only after persisted output; exclude diversity counters; assert control wire/CSV contributor fields are empty and existing control throwing-spy tests remain green. **Warning sign:** control recommendation row contains a contributing question ID or exporter code is imported by rankers. [VERIFIED: DEC-control-no-question-history; current control construction]

### Pitfall 9: Claiming Pilot Completion From Automated Tests

**What goes wrong:** Code is marked IRB-ready without a refrozen runnable pool, deployed collector, external oral flow, 3–5 people, or issue closure. **Avoidance:** explicit operator checkpoints and evidence. **Warning sign:** STUDY-05 is checked off before an issue log/export sample exists. [VERIFIED: D-12–D-14]

### Pitfall 10: Expanding Phase 4 Into Stale Scope

**What goes wrong:** Planner follows stale requirements/roadmap wording and adds three topics, randomization, audio UI, or participant keys. **Avoidance:** D-01–D-15 supersede those lines and D-15 updates them. **Warning sign:** any new topic/microphone/API-key step or pool fallback. [VERIFIED: `04-CONTEXT.md`]

## Code Examples

### Recommendation Research Projection

~~~typescript
// Source pattern: recommendation.repository.ts + dbQuery requirement.
const batches = await dbQuery<RecommendationBatchRow>('SELECT * FROM recommendation_batches');
for (const batchRow of batches) {
  const batch = JSON.parse(batchRow.data) as RecommendationBatch;
  if (batch.status !== 'ready') continue;

  for (const [index, recommendationId] of batch.recommendationIds.entries()) {
    const rows = await dbQuery<RecommendationRow>(
      'SELECT * FROM recommendations WHERE id = ?',
      [recommendationId],
    );
    if (rows.length !== 1) continue; // retain/retry through reconciliation policy
    const recommendation = JSON.parse(rows[0].data) as Recommendation;
    const record = {
      kind: 'recommendation' as const,
      ...recommendation,
      batchId: batch.id,
      sessionId: batch.sessionId,
      batchSeq: batch.seq,
      batchPosition: index + 1,
    };
    // Persist to research_records before enqueue, matching interactionLog.
  }
}
~~~

[VERIFIED: existing types/repository; recommended flattening]

### Participants Manifest Query Shape

~~~sql
SELECT
  a.user_id,
  a.condition,
  a.topic_id,
  i.enrolled_at,
  e.first_activity_at,
  e.last_activity_at,
  e.last_received_at
FROM study_accounts a
LEFT JOIN (
  SELECT user_id, MIN(created_at) AS enrolled_at
  FROM research_installations
  GROUP BY user_id
) i ON i.user_id = a.user_id
LEFT JOIN (
  SELECT user_id,
         MIN(timestamp) AS first_activity_at,
         MAX(timestamp) AS last_activity_at,
         MAX(received_at) AS last_received_at
  FROM behavioral_events
  GROUP BY user_id
) e ON e.user_id = a.user_id
ORDER BY a.user_id ASC;
~~~

[VERIFIED: current D1 schema; D-10]

### Recommendation Served-Time Join

~~~sql
SELECT r.*,
       s.served_at
FROM recommendations r
LEFT JOIN (
  SELECT recommendation_id, MIN(timestamp) AS served_at
  FROM behavioral_events
  WHERE event_type = 'feed_impression' AND recommendation_id IS NOT NULL
  GROUP BY recommendation_id
) s ON s.recommendation_id = r.id
ORDER BY r.received_at ASC, r.id ASC;
~~~

[VERIFIED: current event schema and Home impression path]

## State of the Art in This Repository

| Before Phase 4 | Phase 4 target | Impact |
|----------------|----------------|--------|
| Two-file ZIP (events, Q/A) | Four-file ZIP including recommendations and participants | Complete joinable backend-authoritative dataset. [VERIFIED: D-09–D-11] |
| Recommendation item/batch facts only in IndexedDB | Crash-recoverable projection through existing outbox into D1 | Device loss no longer loses the only recommendation record. [VERIFIED: D-09] |
| Research consent inferred from AI consent | Current-version research consent plus separate AI consent | Expanded §14.3 acceptance is explicit. [VERIFIED: D-04] |
| Stale three-topic/randomization/audio wording | One topic, researcher assignment, out-of-band oral workflow | Planning/docs match locked reality. [VERIFIED: D-01/D-02/D-06/D-15] |
| Current packaged pool lacks Phase 3 graph artifacts | Operator-refrozen pool required before pilot | No Phase 4 code workaround. [VERIFIED: manifest and orchestrator update] |

**Deprecated/outdated:** the Phase 4 wording in `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/PROJECT.md` is explicitly scheduled for D-15 correction; it must not drive implementation. [VERIFIED: D-15]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Recommendations are prescriptive choices within the discretion granted by `04-CONTEXT.md`; unresolved operator facts are listed as open questions/checkpoints rather than asserted. | — | — |

## Open Questions (RESOLVED)

> All three questions are resolved by plan content (plan-checker audit 2026-07-18):
> Q1 → `04-06-PLAN.md` Preflight (d): study-owner copy-approval checkpoint before the pilot build.
> Q2 → `04-02-PLAN.md`: `enrolled_at` = earliest `research_installations.created_at`; definition documented in the protocol/data dictionary.
> Q3 → `04-06-PLAN.md` Task 2: blocking operator checkpoint (live D1 migration apply + deploy + authenticated four-file export smoke).

1. **What exact withdrawal wording/contact does the approved study protocol require?**
   - What we know: the screen must disclose withdrawal according to protocol; actual IRB/ethics approval is operator-owned. [VERIFIED: D-04/D-14; RSD §20 item 11]
   - What's unclear: no final protocol-specific contact/process text exists in the inspected canonical files.
   - Recommendation: planner adds a study-owner copy-approval checkpoint before the pilot build, without blocking backend implementation.

2. **Is earliest successful install resolution the intended `enrolled_at` definition?**
   - What we know: `study_accounts` has no creation timestamp; `research_installations.created_at` is the earliest server timestamp produced by enrollment. [VERIFIED: migrations/Worker]
   - What's unclear: the operator may mean private account-provisioning time instead.
   - Recommendation: use earliest install resolution unless the operator requires a new provisioning timestamp; document the definition in the protocol/data dictionary.

3. **Are the live D1 deployment, secrets, origins, and admin export reachable?**
   - What we know: repository config/examples and local Wrangler exist; this run did not inspect real secrets or mutate/deploy external state. [VERIFIED: local environment]
   - What's unclear: current remote migration/deployment state.
   - Recommendation: make this a backend-first operator checkpoint with a fixture ingest and authenticated four-file export smoke test.

## Environment Availability

| Dependency | Required By | Available | Version / State | Fallback |
|------------|-------------|-----------|-----------------|----------|
| Node.js | App/backend tests | ✓ | 22.19.0 [VERIFIED: environment probe] | — |
| npm | Test/build commands | ✓ | 11.16.0 [VERIFIED: environment probe] | — |
| Local Wrangler | Worker/D1 migration/deploy tooling | ✓ | 4.110.0 [VERIFIED: environment probe] | — |
| Refrozen typed pilot pool | Any runnable Phase 3/4 app pilot | ✗ | Current `pilot-v1-20260717` manifest is old/untyped [VERIFIED: manifest] | None; operator re-freeze is mandatory and outside Phase 4 code. |
| Live D1 deployment/credentials | End-to-end STUDY-03/STUDY-05 | Not verified | Repository config only [VERIFIED: `wrangler.jsonc`] | Local fake-D1 tests do not replace pilot deployment. |
| 3–5 pilot participants + external recorder/transcription workflow | STUDY-04/STUDY-05 | Operator-controlled | Not verifiable from repository [VERIFIED: D-06/D-13] | No in-app fallback permitted. |

**Missing dependencies with no fallback:** the typed pool re-freeze is a hard pilot precondition; the live collector and human pilot resources require operator confirmation. [VERIFIED: orchestrator update; D-06/D-13]

## Validation Architecture

`workflow.nyquist_validation` is absent, so validation is enabled. [VERIFIED: `.planning/config.json`]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node `node:test` + `assert/strict` on Node 22.19.0 [VERIFIED: package scripts/environment] |
| App config | `app/scripts/run-tests.mjs`; tests under `app/tests/**/*.test.mjs` [VERIFIED: `app/package.json`; AGENTS.md] |
| Backend config | No framework config; `node --test test/*.test.mjs` [VERIFIED: `research-backend/package.json`] |
| Quick app command | `node --test tests/services/study-context.service.test.mjs tests/services/upload-queue.service.test.mjs tests/phase1/consent-gate.test.mjs tests/locales/bundle-parity.test.mjs` |
| Quick backend command | `node --test test/validation.test.mjs test/ingest.test.mjs test/export.test.mjs` |
| Full suite commands | `cd app && npm test`; `cd research-backend && npm test` |

Targeted baseline evidence on 2026-07-18: 30 app tests and 20 backend tests passed. The trusted Phase 3 closeout baseline is 588 app + 30 backend + 82 pipeline tests green, with in-app Phase 3 UAT still pending. [VERIFIED: targeted run; orchestrator Phase 3 update]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STUDY-01 | Current-version research consent gates routes/logging; all five disclosures render; no topic/API-key step; four locales match | service + UI invariant + locale | `node --test tests/phase4/onboarding-consent.test.mjs tests/locales/bundle-parity.test.mjs tests/locales/missing-key.test.mjs` | ❌ Wave 0 for phase4 file; locale files exist |
| STUDY-02 | Seeded assignment resolves, persists immutably, drives ranker and logging | backend + DB/service integration | `node --test tests/services/study-context.service.test.mjs tests/services/interaction-log.service.test.mjs tests/services/recommendation.service.test.mjs` plus backend `node --test test/validation.test.mjs` | ✅ existing suites; extend traceability if needed |
| STUDY-03 | Recommendation survives DB projection/outbox/ingest/D1/export; ZIP has four exact CSVs; privacy allowlists reject extras | DB integration + backend integration | `node --test tests/services/recommendation-research.service.test.mjs tests/services/upload-queue.service.test.mjs` and backend quick command | ❌ recommendation research file; existing upload/backend files extend |
| STUDY-04 | `participants.csv.user_id` joins external stages; no app audio/oral surface | export integration + manual protocol | backend `node --test test/export.test.mjs`; app invariant in onboarding/route test | Existing export file extends; manual external flow |
| RQ-03 | Export supports blind external scoring join and protocol specifies §13.4/§13.5 fields/formulas | export integration + protocol review | backend `node --test test/export.test.mjs` | Existing file extends; scoring remains manual/offline |
| STUDY-05 | 3–5 users complete end-to-end flow, issues fixed, final export/pool/deploy checks pass | manual UAT + regression | Full app/backend suites and `npm run lint && npm run build` after re-freeze | Manual-only operator checkpoint |

### Required Executable Assertions

1. Save a ready batch/recommendations through the repository, project through the new service, and assert `research_records` plus outbox rows via `dbQuery`. [VERIFIED: CLAUDE persistence rule]
2. Inject a crash after batch save but before research-record enqueue; boot reconciliation produces one idempotent record per recommendation and drains it. [VERIFIED: existing outbox crash-window pattern]
3. Client and server reject recommendation extras, identity fields, invalid strategy/timestamp/position, non-finite score/component values, oversized text/arrays, and ambiguous shapes. [VERIFIED: existing allowlist model]
4. Cross-account duplicate recommendation IDs return 409 without overwrite/ACK; same-account retry is idempotent. [VERIFIED: event/Q&A ingest precedent]
5. Export ZIP contains exactly four files, exact ordered headers, JSON array/object cells, spreadsheet-safe reason text, and blank `served_at` for never-impressed items. [VERIFIED: existing export test pattern]
6. Participant query includes active and zero-activity seeded accounts, earliest installation, first/last activity, last receipt, and no multiplication after token rotation. [VERIFIED: D-10 and schema]
7. Control projected/wire/CSV rows have no contributing question/concept/post IDs; control ranker throwing-personal-loader test stays green. Ask tests remain condition-neutral. [VERIFIED: hard invariants]
8. Research consent false/old version prevents research persistence and participant routes; current version enables them while `aiConsentGiven` separately gates LLM use. [VERIFIED: D-04 and current gates]

### Sampling Rate

- **Per task commit:** relevant app or backend single-file command, always under 30 seconds locally. [VERIFIED: targeted runs]
- **Per wave merge:** app `npm test`; backend `npm test`; locale parity/missing-key after consent copy. [VERIFIED: project commands]
- **Phase code gate:** app `npm test`, `npm run lint`; backend `npm test`; no unexpected schema fields; docs wording aligned. [VERIFIED: AGENTS.md]
- **Pilot gate:** only after operator re-freeze, app `npm run build` (which runs packaging), backend migration/deploy smoke, physical-device onboarding/condition/export run, 3–5-user checklist, issue closure, and rerun of affected tests. [VERIFIED: D-12/D-13; build script]

### Wave 0 Gaps

- [ ] `app/tests/services/recommendation-research.service.test.mjs` — real `dbQuery` projection, order, crash reconciliation, control privacy, wire shape.
- [ ] `app/tests/phase4/onboarding-consent.test.mjs` — research-consent version/gate plus five-item/no-topic/no-key UI contract; prefer executable service assertions and keep only thin source invariants for JSX.
- [ ] Extend `app/tests/services/upload-queue.service.test.mjs` — recommendation kind delivery, receipt/reconcile, poison-row behavior.
- [ ] Extend `research-backend/test/validation.test.mjs` — exact recommendation allowlist/numeric bounds/identity rejection.
- [ ] Extend `research-backend/test/ingest.test.mjs` — immutable insert, retry, cross-account collision, server identity.
- [ ] Extend `research-backend/test/export.test.mjs` — exact four-file ZIP, recommendation columns/served join, participant manifest including zero-activity account.
- [ ] Add a migration/schema assertion for the recommendations D1 table and indexes.
- [ ] Manual UAT evidence template in `docs/pilot_protocol.md` — pool/deploy preflight, 3–5 users, oral workflow, export audit, issue closure.

## Security Domain

Security enforcement is enabled because `security_enforcement` is absent from config. [VERIFIED: `.planning/config.json`; researcher role]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Reuse enrollment credential, per-install bearer token, and admin Basic-auth boundary; recommendations never bypass `requireInstallAuth`. [VERIFIED: `worker.ts`; `admin.ts`] |
| V3 Session Management | Yes | Keep token rotation/revocation, SHA-256 token hashes in D1, and never display/export/log raw install tokens. [VERIFIED: `0002_install_tokens.sql`; `study-context.service.ts`] |
| V4 Access Control | Yes | Server re-derives participant identity; admin export remains password-protected/no-store; cross-account IDs conflict. [VERIFIED: current Worker patterns] |
| V5 Validation / Encoding | Yes | Exact field/type/value allowlists, request count/byte caps, prepared D1 statements, JSON serialization, and shared CSV escaping. [VERIFIED: `validation.ts`; `export.ts`] |
| V6 Cryptography | No new crypto | Reuse Web Crypto token generation/hash/comparison; do not add algorithms or expose secrets. [VERIFIED: `worker.ts`] |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Client forges condition/topic | Tampering | Strip identity from wire and bind from authenticated D1 account. [VERIFIED: current architecture] |
| Cross-account recommendation ID collision | Tampering | Pre-insert owner lookup and 409 without ACK/overwrite. [VERIFIED: event/Q&A precedent] |
| Arbitrary private/device payload | Information disclosure | Positive allowlists on client and server; no generic payload field. [VERIFIED: validators] |
| CSV formula injection through question/reason text | Tampering | Reuse `escapeCsvCell`; test whitespace/control-prefixed formula strings. [VERIFIED: export tests] |
| Raw install/enrollment/admin secret leaks | Information disclosure | Hash install tokens in D1; keep raw token only in protected local metadata; exclude secrets from export/log/protocol. [VERIFIED: current code] |
| Old backend rejects new kind permanently | Availability | Backend-first migration/deploy and smoke before client distribution. [VERIFIED: outbox quarantine semantics] |
| Control export path becomes ranking input | Experiment contamination | One-way post-persistence projection; no exporter import/read in rankers; retain throwing-spy control test. [VERIFIED: DEC-control-no-question-history] |
| External oral filenames reveal condition | Information disclosure / scoring bias | Neutral exact `user_id` filenames; condition joins only after blinded scoring. [VERIFIED: D-06; RSD §13.6] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/04-study-infrastructure-pilot/04-CONTEXT.md` — locked D-01–D-15, discretion, deferred scope, canonical paths.
- `docs/research_system_design.md` §3 RQ3, §6.5–§6.6, §9.9, §13, §14, §16 Phase 6/7, §20–§22 — study design, oral measures, privacy, success, framing.
- `docs/SCOPE.md`, `CLAUDE.md`, `AGENTS.md` — scope, load-bearing persistence/condition/i18n/testing rules.
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md` — requirements, completed Phase 3 state, stale Phase 4 wording targeted by D-15.
- `research-backend/src/{worker,validation,export,admin}.ts`, all `research-backend/migrations/*.sql`, and backend tests — actual assignment/ingest/export/auth/D1 shapes.
- `shared/research-wire-contract.v1.json`, `app/src/services/{research-wire-contract,upload-queue,interaction-log,study-context,research-consent,recommendation,recommendation.repository,research-export}.ts` — actual device-to-backend seams.
- `app/src/screens/{ResearchSetupScreen,OnboardingScreen,ResearchDiagnosticsScreen,HomeScreen}.tsx`, app types/locales/tests — current UI, recommendation impression, consent, identity, and i18n behavior.
- `data/content_pool_v1/manifest.json` and `app/src/data/content-pool-bundle.ts` — verified old pool artifact mismatch and re-freeze precondition.
- Targeted local test runs on 2026-07-18 — 30 app and 20 backend tests passed.

### Secondary (MEDIUM confidence)

- None; no external web research was needed because this phase is governed by locked internal design and live code.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — exact installed versions and internal seams were inspected locally.
- Export architecture: HIGH — every device/wire/Worker/D1/ZIP layer and its tests were read.
- Consent/assignment boundaries: HIGH — locked decisions and live route/service code agree, except the known stale docs scheduled by D-15.
- Oral analysis contract: HIGH — directly specified by RSD §13 and locked out-of-band decisions.
- Pilot/deployment readiness: MEDIUM — repository state and hard pool dependency are verified, but live D1/secrets, external recorder workflow, and human participants are operator-controlled.

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 for repository architecture; re-check immediately after any wire-contract, D1 migration, consent-protocol, or pool re-freeze change.
