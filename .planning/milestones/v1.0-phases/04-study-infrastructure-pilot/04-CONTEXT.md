# Phase 4: Study infrastructure + pilot - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the working two-condition prototype into a runnable, IRB-ready study instrument and validate it with an internal pilot. Deliverables map to STUDY-01…05 + RQ-03:

- **STUDY-01** — Onboarding hardening: consent covering all §14.3 items (incl. externally-recorded audio), LLM setup, no topic picker.
- **STUDY-02** — Condition assignment: researcher-set, persisted, drives ranker + logging (already satisfied by existing architecture — verify, don't rebuild).
- **STUDY-03** — Researcher data export completed: events + questions + AI answers + **recommendations** + a **participants manifest**, §14.2-excluded, analyzable. **This is where the real code work concentrates.**
- **STUDY-04 / RQ-03** — Oral-test support: out-of-band capture; the app only guarantees a clean linking key in the export.
- **STUDY-05** — Internal pilot: pilot-ready instrument + written protocol/checklist; issues fixed; IRB-ready.

**Single most important decision this phase:** the study reduces to **ONE topic** for the whole instrument (not three). This ripples through STUDY-01/02 and eliminates most of STUDY-04's app build.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative design & scope
- `docs/research_system_design.md` §6.5 — conditions (control vs experimental; the isolated variable)
- `docs/research_system_design.md` §13 (esp. §13.2–13.6) — oral explanation assessment, scoring dimensions, normalization, blind scoring process
- `docs/research_system_design.md` §14 (§14.1 required logs, §14.2 do-not-collect, §14.3 consent language)
- `docs/research_system_design.md` §16 Phase 6/7, §20 (open questions — item 2 topics, 3 language, 8 personalized suggestions, 11 IRB), §21 success criteria
- `docs/SCOPE.md` — locked in/out-of-scope contract + framing rules
- `.planning/REQUIREMENTS.md` — STUDY-01…05, RQ-03 definitions (to be updated per D-15)
- `.planning/ROADMAP.md` — Phase 4 goal + success criteria (to be updated per D-15)

### Export / backend (STUDY-03 — main code work)
- `research-backend/src/worker.ts` — routes: `/v1/install/resolve`, `/v1/ingest`, `/admin`, `/admin/export.zip`; ingest handlers for events + canonical Q/A
- `research-backend/src/export.ts` — `EVENT_COLUMNS`, `QUESTION_ANSWER_COLUMNS`, `buildExportZip` (add recommendations + participants here)
- `research-backend/migrations/*.sql` — D1 schema (`study_accounts`, `behavioral_events`, `question_answer_records`, `research_installations`); new `recommendations` table migration needed
- `shared/research-wire-contract.v1.json` + `app/src/services/research-wire-contract.ts` — allowlisted upload contract (add `recommendations` kind; preserves §14.2 exclusion by construction)
- `app/src/services/upload-queue.service.ts` — durable upload queue to route recommendation uploads through

### Condition / onboarding / study context
- `app/src/services/study-context.service.ts` — immutable `bindOnce`, condition/topic validation (STUDY-02 already satisfied here)
- `app/src/screens/ResearchSetupScreen.tsx` — researcher-led one-time bind via `/install/resolve`
- `app/src/screens/OnboardingScreen.tsx` — welcome → language → consent (expand consent per D-04)
- `app/src/services/research-consent.service.ts` — `hasAffirmativeResearchConsent` gate
- `app/src/screens/ResearchDiagnosticsScreen.tsx` + `app/src/services/research-export.service.ts` — PIN-gated diagnostics + local recovery export (context for the export decision; NOT the chosen path for recommendations)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Server-authoritative immutable binding** (`study-context.service.ts` `bindOnce` + `/install/resolve`): already delivers STUDY-02 (researcher-set condition+topic, un-switchable). Phase 4 verifies rather than builds this.
- **Backend export ZIP pipeline** (`research-backend/src/export.ts` `buildExportZip` + `toCsv` + `escapeCsvCell`): extend with two new CSVs (`recommendations.csv`, `participants.csv`) rather than a new mechanism.
- **Allowlisted wire contract** (`research-wire-contract.ts` `EVENT_FIELDS`, `EVENT_TYPES`): the structural §14.2 privacy guard — add a `recommendations` record shape the same way, keeping the allowlist as the exclusion mechanism.
- **Durable upload queue** (`upload-queue.service.ts`): recommendation uploads ride the existing retry/outbox path; no new transport.
- **Onboarding step machine** (`OnboardingScreen.tsx` `Step = 'welcome' | 'language' | 'consent'`): extend the consent step's content; no topic step is added (D-03).

### Established Patterns
- **Condition isolation is load-bearing** (DEC-control-no-question-history): export must not leak question-history-derived fields into control rows beyond what already ships; recommendations export must preserve condition labeling.
- **`ServiceResult<T>` + event bus + IndexedDB-through-`dbQuery`**: any new on-device read (e.g., gathering recommendation batches to upload) must read through the `dbQuery` seam, not the in-memory mirror (false-green risk per CLAUDE.md).
- **Frozen-pool immutability**: single-topic decision does NOT permit editing `data/content_pool_v1`; pool scaling is a new version via the offline pipeline (deferred).

### Integration Points
- **Recommendations → export:** on-device recommendation batches (Phase 3 IndexedDB `recommendation_batches`/recommendations) → new wire-contract kind → `upload-queue` → new `/v1/ingest` branch + D1 table → `export.zip`.
- **Participants manifest:** D1 `study_accounts` (+ activity timestamps derived from events) → `participants.csv`.
- **Oral audio join:** external audio files named by `userId` join to `participants.csv` (no app code beyond the manifest).
- **Consent → §14.3:** expanded consent copy lands in all 4 locale bundles (i18n EN-first workflow) since it is user-facing.

</code_context>

<specifics>
## Specific Ideas

- Operator's driving rationale for one topic: "better manage constraints, reuse pilot study materials, and save some energy collecting more resources." Phase 4 should stay minimal — the operator is explicitly optimizing for low build cost, so prefer verifying/extending existing infrastructure over new subsystems.

</specifics>

<deferred>
## Deferred Ideas

- **Scale the single topic pool from ~77 toward 200–400 posts** via `tools/content_pipeline` for the main study — offline pipeline work, a new frozen content-pool version, out of Phase 4 code scope.
- **Multi-topic support** (three-topic study, participant topic choice, topic-stratified randomization) — explicitly dropped for this instrument (D-01); could return only as a future milestone if the study design changes.
- **In-app audio capture / auto-transcription** — considered and rejected (D-06) on build-cost + privacy grounds; not a future Phase 4 item unless the oral-test protocol changes.

None of the above belong in Phase 4.

</deferred>

---

*Phase: 4-study-infrastructure-pilot*
*Context gathered: 2026-07-18*
