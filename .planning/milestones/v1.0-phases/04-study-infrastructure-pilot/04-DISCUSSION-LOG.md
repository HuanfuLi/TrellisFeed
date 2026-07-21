# Phase 4: Study infrastructure + pilot - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 4-study-infrastructure-pilot
**Areas discussed:** Topic choice + assignment, Oral-test capture, Researcher export, Pilot topic scope

---

## Topic choice + assignment

The operator opened by proposing a reduction from three topics to one ("better manage constraints, reuse pilot study materials, and save some energy collecting more resources"). This reframed the whole area.

### Single-topic scope

| Option | Description | Selected |
|--------|-------------|----------|
| Whole instrument | One topic for pilot + main study; existing frozen content_pool_v1, expandable via offline pipeline; removes all 3-topic support | ✓ |
| Pilot only | Keep multi-topic support in code for a later 3-topic main study | |

**User's choice:** Whole instrument.
**Notes:** "Three topics" is only a *proposed* (non-locked) design decision (§6.3/§18-Decision-5); §20 lists final topics as open — so this lock is legitimate. Recorded as a deliberate design deviation.

### Condition assignment (with one topic, stratification collapses)

| Option | Description | Selected |
|--------|-------------|----------|
| Server balanced/blocked | Server alternates/block-randomizes condition per account | |
| Researcher sets explicitly | Researcher assigns condition per seeded D1 study_accounts row, deterministic | ✓ |
| Simple random per account | Server draws random condition, no balancing | |

**User's choice:** Researcher sets explicitly.
**Notes:** This is already how `/install/resolve` + immutable `bindOnce` behave — Phase 4 verifies, not rebuilds. Deviation from STUDY-02 wording ("topic-stratified randomization").

### Onboarding topic screen

| Option | Description | Selected |
|--------|-------------|----------|
| Drop it entirely | Onboarding stays welcome > language > consent; server binds single topic silently | ✓ |
| Keep a 1-topic intro | Lightweight intro-to-topic screen with a Begin button | |

**User's choice:** Drop it entirely.

---

## Oral-test capture

### Capture mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| App records audio in-app | Capacitor voice-recorder + on-device storage + export; transcription offline | |
| Researcher runs it out-of-band | Researcher records externally (phone/Zoom), files by userId; app stores no audio | ✓ |
| App records + auto-transcribe | In-app recording + external STT service | |

**User's choice:** Researcher runs it out-of-band.
**Notes:** No in-app mic, no audio storage, no audio egress. Transcription + human blind scoring (§13.6) offline.

### App's role

| Option | Description | Selected |
|--------|-------------|----------|
| Static instruction screens | Two participant-facing orientation screens | |
| Researcher-triggered prompt screen | PIN-gated screen showing §13.2/§13.3 prompts for the researcher | |
| Nothing in-app | App's only STUDY-04 contribution is a clean linking key in the export | ✓ |

**User's choice:** Nothing in-app.
**Notes:** §14.3 consent must still cover external audio recording.

### Prompt source of truth

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher protocol doc | Prompts live externally, not in the app | ✓ |
| Versioned in-repo | Prompts stored as a versioned repo config/doc | |

**User's choice:** Researcher protocol doc.

---

## Researcher export

### Recommendations into the dataset

| Option | Description | Selected |
|--------|-------------|----------|
| Extend backend ingest+export | New recommendations wire kind → D1 table → recommendations.csv in /admin/export.zip | ✓ |
| In-app per-device dump | Export recommendations from IndexedDB per device | |
| Both | Backend upload + in-app recovery fallback | |

**User's choice:** Extend backend ingest+export.
**Notes:** Recommendation content currently lives only in on-device IndexedDB and reaches no export path — a genuine STUDY-03 gap.

### Participant manifest

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add participants.csv | Per-participant row (userId, condition, topicId, enrollment + activity timestamps) as oral-audio join key | ✓ |
| No, userId per row is enough | Skip a dedicated manifest | |

**User's choice:** Yes, add participants.csv.

### Format

| Option | Description | Selected |
|--------|-------------|----------|
| Keep CSV ZIP | Matches existing behavioral-events.csv + question-answer-records.csv | ✓ |
| JSON export | NDJSON per table | |

**User's choice:** Keep CSV ZIP.

---

## Pilot topic scope

### Pilot content pool

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, use existing ~77 posts | Run the pilot on content_pool_v1 as-is (exceeds ~50-post pilot minimum) | ✓ |
| Scale the pool first | Grow toward 200–400 before piloting | |

**User's choice:** Yes, use existing ~77 posts.
**Notes:** Scaling the single topic toward 200–400 is a later offline tools/content_pipeline task, out of Phase 4 code.

### Pilot deliverable

| Option | Description | Selected |
|--------|-------------|----------|
| Instrument + protocol/checklist | Pilot-ready app + written protocol; actual 3–5 person run is operator activity | ✓ |
| Instrument + self dry-run only | Complete on internal verification + a self dry-run | |

**User's choice:** Instrument + protocol/checklist.

### IRB-ready scope

| Option | Description | Selected |
|--------|-------------|----------|
| App + docs support IRB | Consent §14.3, §14.2 exclusions, export + data-handling docs; submission out of scope | ✓ |
| Also draft IRB/consent text in-repo | Author IRB consent-form + protocol text as in-repo deliverables | |

**User's choice:** App + docs support IRB.

---

## Claude's Discretion

- Exact consent-screen copy/layout and `participants.csv` column set beyond the required join fields.
- Pilot protocol/checklist document format.

## Deferred Ideas

- Scale the single topic pool from ~77 toward 200–400 posts via `tools/content_pipeline` (offline, new frozen version).
- Multi-topic support (three topics, participant choice, stratified randomization) — dropped for this instrument.
- In-app audio capture / auto-transcription — considered and rejected on build-cost + privacy grounds.
