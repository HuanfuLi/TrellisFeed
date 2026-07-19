# QuestionTrace Pilot Protocol

Operator checklist for the 3–5-person internal pilot of the post-centered graph-memory feed orchestration research instrument. Complete this protocol before claiming the pilot or STUDY-05 complete. Store evidence in the approved private study workspace; do not add participant recordings, transcripts, credentials, or secret values to the repository.

## 1. Preflight

Record the pilot identifiers before enrollment:

| Item | Operator entry |
|---|---|
| Pilot date range | |
| App version/build | |
| Backend version | |
| New frozen pool version | |
| Single frozen topic ID | |
| Operator initials | |

### 1.1 Re-freeze the pool offline

The packaged `pilot-v1-20260717` manifest predates the typed Phase 3 exporter. The app intentionally fails with `POOL_INVALID` until the operator re-freezes the pool offline and regenerates the packaged projection.

- [ ] Run the approved offline content-pool freeze workflow with the typed Phase 3 exporter.
- [ ] Confirm the new manifest carries `sources.json`, `global_edges.json`, and `ranking_features.json`.
- [ ] Confirm the regenerated bundle is a **new pool version**. Never edit `data/content_pool_v1` in place; all corrections create another version through the offline pipeline (D-12).
- [ ] Regenerate the app's packaged projection from the new frozen version.
- [ ] Run `cd app && npm run build` and record a passing result.
- [ ] Record the new pool version and build evidence in the UAT evidence table in Section 5.

### 1.2 Roll out the backend before the client

Migration `research-backend/migrations/0004_recommendations.sql` and the Worker deployment must reach the live backend before any pilot device receives a client build that emits recommendation records. A new client against an old backend permanently quarantines the unknown record kind as `server_rejected`.

- [ ] From `research-backend`, have the authorized operator apply the migration to the live D1 database bound as `DB` in `wrangler.jsonc`:

  ```text
  cd research-backend && npx wrangler d1 migrations apply <database> --remote
  ```

  The operator supplies the live database name; do not replace the placeholder in this document with a credential or private configuration value.

- [ ] Confirm migration `0004_recommendations.sql` is listed as applied.
- [ ] Deploy the Worker:

  ```text
  npx wrangler deploy
  ```

- [ ] Open the authenticated `/admin` page and confirm it shows a recommendations count row. A count of zero is acceptable before pilot traffic.
- [ ] Download authenticated `/admin/export.zip` and confirm it contains exactly the four CSV files named in Section 4.
- [ ] Only after every backend smoke check passes, authorize installation of the recommendation-projection client build on pilot devices.

### 1.3 Enroll and seed accounts

- [ ] Seed 3–5 numeric `study_accounts` rows.
- [ ] Assign every account to the one frozen pilot topic.
- [ ] Give every account an explicit planned `control` or `experimental` assignment.
- [ ] Record the planned allocation in an operator-only allocation record, outside participant-facing and rater-facing materials.
- [ ] Confirm the allocation includes both conditions and does not reveal condition to participants.
- [ ] Prepare one exact numeric `userId` for each participant; retain its exact string representation for all joins.

### 1.4 Approvals and restricted configuration

- [ ] Obtain study-owner approval of the final consent and withdrawal language.
- [ ] Obtain study-owner approval of the general verbal baseline, domain baseline, and post-domain oral prompts.
- [ ] Confirm oral prompts are administered from this external protocol workflow only. Do not add in-app audio capture, oral-test screens, prompt rendering, microphone plugins, or audio storage.
- [ ] Configure the enrollment credential, admin password, install tokens, and Cloudflare credentials privately.
- [ ] Confirm no secret or credential value appears in this checklist, the issue log, screenshots, evidence filenames, commit messages, or the repository.

## 2. Per-Participant Run

Use this numbered checklist once per participant. Oral administration, recording, transcription, and scoring are external to the app.

Participant run record:

| Item | Operator entry |
|---|---|
| Exact `userId` | |
| Run dates | |
| App/backend/pool versions | |
| Locale | |
| Checklist operator | |

### 2.1 External oral-assessment prompt sheet

The researcher reads these prompts outside the app. The study owner must approve the exact wording before the first run; if approval requires a change, update this protocol before use and use the same approved version for every participant. Never render these prompts in the participant app.

**Pretest A — general verbal baseline (`pre_verbal`)**

> Please describe a movie, video, book, game, or article you recently enjoyed. What was it about, and why did you find it interesting?

**Pretest B — domain baseline (`pre_domain`)**

> What do you currently understand by “AI agent”? How is it different from a normal chatbot, and what impact do you think it might have?

**Post-test — domain transfer (`post_domain`)**

> Some people argue that AI agents will replace many entry-level white-collar workers because they can complete multi-step tasks. Others argue this will not happen soon because agents still struggle with reliability, accountability, and human oversight. What is the core disagreement between these views? Which side do you find more convincing, and why?

1. **Bind the seeded identity once.**
   - [ ] Assign the participant's exact numeric `userId` from the seeded account list.
   - [ ] Resolve and bind that account once through `ResearchSetupScreen`.
   - [ ] Confirm the participant sees no topic picker, condition disclosure, or API-key entry.
   - [ ] Confirm subsequent launches resume the same bound account without reassignment.

2. **Administer the external pretests before app use.**
   - [ ] Administer Pretest A, the same general verbal baseline prompt used for every participant.
   - [ ] Record and transcribe it externally using the exact basename `<userId>_pre_verbal`.
   - [ ] Administer Pretest B, the topic-specific domain baseline prompt.
   - [ ] Record and transcribe it externally using the exact basename `<userId>_pre_domain`.
   - [ ] Confirm neither filename nor rater-facing metadata contains a condition label.

3. **Complete onboarding and consent.**
   - [ ] Complete welcome → language → consent in the participant's selected locale.
   - [ ] Visually confirm all five §14.3 disclosures render: in-app interactions are logged; questions asked through contextual Q&A are stored for research analysis; pre/post oral responses are recorded and transcribed externally; data will be anonymized; withdrawal follows the study protocol.
   - [ ] Confirm acceptance is explicit and the withdrawal path is available according to the approved study language.

4. **Exercise the research flow.**
   - [ ] Use Home and open Post Detail.
   - [ ] Submit at least one suggested Ask and one typed Ask.
   - [ ] View the contextual answer and use a source link.
   - [ ] Save at least one post and mark at least one post not interested.
   - [ ] Receive and display at least two recommendation batches.
   - [ ] Expand at least one recommendation reason.
   - [ ] Confirm Ask access, filter behavior, prompt/model path, and answer quality are indistinguishable between conditions. The only isolated variable is whether question history drives future graph-memory orchestration (§6.5–§6.6).

5. **Exercise durability across time.**
   - [ ] Create an offline interval containing study activity.
   - [ ] Restart the app before network recovery, then restore connectivity and allow durable upload retry to complete.
   - [ ] End and resume sessions across at least two days.
   - [ ] Confirm the same bound `userId` remains active after restart and resume.

6. **Administer the external post-test.**
   - [ ] After the planned use interval, administer the different-but-related post-domain transfer discussion prompt.
   - [ ] Record and transcribe it externally using the exact basename `<userId>_post_domain`.
   - [ ] Remove condition labels from the rater package before scoring.
   - [ ] Confirm the three expected stages exist for the exact ID: `pre_verbal`, `pre_domain`, and `post_domain`.

7. **Close the participant run.**
   - [ ] Complete the participant row in the UAT evidence table.
   - [ ] Record issues using Section 6 without copying question text, audio, transcripts, or secret values into the log.

## 3. External Scoring Sheet Contract (STUDY-04 / RQ-03)

Create the scoring sheet outside the app and repository. Use one row per `user_id` × `assessment_stage` × blind rater so that each rater's scores remain separately auditable for inter-rater reliability. Behavioral measures may be repeated across rater rows or maintained in a separately joined assessment table, but the following fields must be exportable together.

| Required column | Contract |
|---|---|
| `user_id` | Exact neutral ID from the participant account; import and store as text so leading zeros are preserved. |
| `assessment_stage` | Exactly one of `pre_verbal`, `pre_domain`, or `post_domain`. |
| `recording_filename` | Filename whose basename starts with the exact ID string and stage, such as `<userId>_pre_verbal`; no condition label. |
| `transcript_filename` | Transcript filename using the same exact ID string and stage; no condition label. |
| `speaking_duration` | Speaking duration for the response, with the unit documented consistently. |
| `word_count` | Response word count. |
| `number_of_examples` | Count of examples used. |
| `distinct_claims` | Count of distinct claims. |
| `concept_mentions` | Count of concept mentions. |
| `concept_coverage` | Per-rater score for **concept coverage**. |
| `relationship_understanding` | Per-rater score for **relationship understanding**. |
| `stance_comparison` | Per-rater score for **stance comparison**. |
| `counterargument_awareness` | Per-rater score for **counterargument awareness**. |
| `evidence_example_use` | Per-rater score for **evidence/example use**. |
| `transfer` | Per-rater score for **transfer ability**. |
| `explanatory_clarity` | Per-rater score for **explanatory clarity**. |
| `overall_understanding_depth` | Per-rater score for **overall understanding depth**. |
| `blind_rater_code` | Neutral rater code; retain separately scored rows for inter-rater reliability. |
| `rubric_version` | Approved rubric version applied by the rater. |

Scoring and join rules:

- [ ] Import `user_id` as text and preserve its exact string, including leading zeros.
- [ ] Use the exact ID string in every recording and transcript filename.
- [ ] Give raters only neutral `user_id`, stage, recording/transcript, and rubric materials. Do not place condition labels on any rater-facing material.
- [ ] Transcribe audio, remove condition labels, and have human raters score blind.
- [ ] Keep every rater's eight rubric-dimension scores independently recoverable and report inter-rater reliability. LLM assistance may supplement but must not be the only scoring source.
- [ ] Lock the scoring data before joining condition or topic fields.
- [ ] Join `condition` from `participants.csv` strictly after scores are locked.
- [ ] Confirm each participant has all three stages and the denominators needed for normalization.

Use the §13.5 formulas exactly:

```text
DomainElaborationRatio = DomainResponseWordCount / GeneralBaselineWordCount
PostImprovement = PostDomainRubricScore - PreDomainRubricScore
NormalizedPostWordCount = PostWordCount / GeneralBaselineWordCount
```

Do not compute a normalized value when its required response or denominator is absent; treat that as a failed join or incomplete assessment and resolve it before analysis.

## 4. Export Audit

Audit the authenticated backend export only after upload retry has settled.

### 4.1 ZIP membership and exact headers

- [ ] Download authenticated `/admin/export.zip`.
- [ ] Confirm the archive contains exactly these four files and no others:
  - `behavioral-events.csv`
  - `question-answer-records.csv`
  - `recommendations.csv`
  - `participants.csv`
- [ ] Confirm each CSV parses and its first row matches the following header exactly, including order:

`behavioral-events.csv`

```text
id,user_id,condition,topic_id,timestamp,event_type,post_id,question_id,recommendation_id,duration_ms,received_at
```

`question-answer-records.csv`

```text
id,revision,user_id,condition,topic_id,post_id,question_id,answer_id,question_text,question_source,suggested_question_id,question_created_at,answer_text,answer_created_at,model_name,cited_post_ids,cited_source_urls,concept_ids,claim_ids,extracted_concept_ids,extracted_claim_ids,question_type,unresolved,received_at
```

`recommendations.csv`

```text
id,user_id,condition,topic_id,session_id,batch_id,batch_seq,batch_position,post_id,generated_at,served_at,strategy,score,reason_text,contributing_question_ids,contributing_concept_ids,contributing_post_ids,component_scores,received_at
```

`participants.csv`

```text
user_id,condition,topic_id,enrolled_at,first_activity_at,last_activity_at,last_received_at
```

### 4.2 Completeness and linkage

- [ ] Confirm every recommendation displayed on a pilot device has one row in `recommendations.csv` with the expected user, session, batch sequence, position, and post.
- [ ] Confirm each recommendation's `served_at` matches its first `feed_impression` event rather than its generation time.
- [ ] Confirm `question-answer-records.csv` contains the latest revision for each Q/A record.
- [ ] Confirm each recommendation-reason-view event links to a valid recommendation through `recommendation_id`.
- [ ] Confirm both `control` and `experimental` rows are present.
- [ ] Confirm only the single frozen pilot topic is present.
- [ ] Confirm `participants.csv` contains every seeded `study_accounts` account, including any account with zero activity.
- [ ] Confirm the exact `participants.csv.user_id` values join to all three external oral-assessment stages after blind scores have been locked.
- [ ] Confirm control recommendation rows do not carry contributing question, concept, or post trace IDs.

### 4.3 §14.2 exclusion review

Review headers and representative values. Confirm no exported column or free-form payload carries:

- [ ] Phone screen recordings, screen-capture paths, or screen data.
- [ ] Audio, transcripts, recording blobs, or recording paths.
- [ ] Usage outside the study app.
- [ ] Precise geolocation.
- [ ] Contacts.
- [ ] Other-app names.
- [ ] Clipboard contents.
- [ ] Raw keystroke timing.
- [ ] Arbitrary free-form device or private payloads not necessary for the study.

## 5. UAT Evidence Template

Use one copy of this table per pilot. Evidence references point to the approved private study workspace; do not paste secret values, audio, transcripts, question text, or unnecessary participant data into this document or the issue tracker.

| Manual verification | Scope / sample | Evidence reference (screenshot, file, or row count) | Pass / fail | Operator / date | Notes or issue ID |
|---|---|---|---|---|---|
| Pool re-freeze and packaged build | New version includes all three typed graph artifacts; `npm run build` green | | | | |
| Device onboarding and five-item consent | Fresh install in English | | | | |
| Device onboarding and five-item consent | Fresh install in Simplified Chinese | | | | |
| Device onboarding and five-item consent | Fresh install in Spanish | | | | |
| Device onboarding and five-item consent | Fresh install in Japanese | | | | |
| Seeded-account bind smoke | Numeric `study_accounts` identity resolves once; no picker/disclosure/key entry | | | | |
| Live migration and deploy smoke | Migration 0004 applied; deployed `/admin` count; four-file ZIP | | | | |
| Per-participant checklist completion | One row per exact `userId`, 3–5 total, across at least two days | | | | |
| External oral-test capture and join | Three neutral-ID stages per participant; blind scores locked before condition join | | | | |
| Export audit result | Exact headers, row/link checks, both conditions, one topic, all accounts, §14.2 exclusions | | | | |

## 6. Issue Log & Exit Gate

### 6.1 Issue log

Use an operator-only issue log with this minimum schema:

| Issue ID | Participant ID (only when necessary) | Condition | App version | Backend version | Pool version | Steps | Expected | Actual | Severity | Privacy / experimental-validity flag | Owner | Fix reference | Retest result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | | |

Issue-log rules:

- [ ] Use a participant ID only when it is necessary to reproduce or audit the issue.
- [ ] Do not enter question text, answer text, audio, transcripts, secret values, credentials, install tokens, or Cloudflare configuration in the log.
- [ ] Link fixes by repository reference or approved private evidence reference, not by copying sensitive data.
- [ ] Retest every fix against the affected app/backend/pool version and record the result.
- [ ] If a pool correction is required, create and validate a new frozen pool version; never patch an existing frozen version in place.

### 6.2 Release blockers

Any single item below blocks pilot release and the IRB-ready claim until fixed and retested:

- [ ] No displayed recommendation is missing its export row.
- [ ] No record is associated with the wrong account or crosses accounts.
- [ ] No control recommendation row carries contributing trace IDs.
- [ ] No Ask access, behavior, filtering, model/prompt path, or answer-quality asymmetry exists between conditions.
- [ ] No required consent disclosure is missing in any supported locale.
- [ ] No pool import or `POOL_INVALID` error remains.
- [ ] No external assessment fails its exact `user_id` join.

If any statement cannot be checked, open a release-blocker issue; do not interpret an unchecked box as a pass.

### 6.3 Exit gate

Do not mark STUDY-05 complete until every item is checked:

- [ ] Three to five users completed the end-to-end protocol, including external pre/post assessment, at least two recommendation batches, durable offline retry, restart, and multi-day resume.
- [ ] Every release blocker and privacy/experimental-validity issue is closed with a passing retest.
- [ ] Affected automated suites were rerun and are green; record the commands and results in Section 5 evidence.
- [ ] Export and external scoring joins are complete and analyzable for every pilot participant.
- [ ] §21 review: participants could use the instrument naturally for several days.
- [ ] §21 review: the content was interesting enough for voluntary return.
- [ ] §21 review: both conditions were fair and comparable.
- [ ] §21 review: the graph-memory condition produced interpretable recommendation reasons.
- [ ] §21 review: logs were complete and analyzable.
- [ ] §21 review: oral assessment data was reliably scorable, including inter-rater reliability.
- [ ] §21 review: the evidence supports a defensible claim that post-level questions are useful learner traces for future feed orchestration.
- [ ] Study owner reviewed the completed evidence and issue log.

Completion of the app and documentation makes the instrument capable of supporting IRB preparation; actual IRB submission and approval remain operator responsibilities. A protocol document or automated test result alone is not evidence that the 3–5-user pilot has run.
