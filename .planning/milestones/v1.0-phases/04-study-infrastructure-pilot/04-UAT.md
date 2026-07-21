---
status: resolved
phase: 04-study-infrastructure-pilot
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md]
started: 2026-07-20T02:44:00Z
updated: 2026-07-20T06:01:44Z
device: Android Emulator Medium_Phone_API_36.1 (API 36.1)
interaction: adb
---

## Current Test

[testing complete]

## Tests

### 1. Recommendation wire contract
expected: The shared v1 contract declares recommendation kind, eight strategies, and bounded metadata without changing existing contract fields.
result: pass
source: automated
coverage_id: 04-01-D1

### 2. Recommendations migration
expected: D1 migration 0004 defines the exact recommendations table, constraints, timestamp boundary, and non-unique session-order index.
result: pass
source: automated
coverage_id: 04-01-D2

### 3. Recommendation validation
expected: Backend parseIngest accepts only bounded recommendation records and rejects extras, identity, invalid values, and ambiguous shapes.
result: pass
source: automated
coverage_id: 04-01-D3

### 4. Recommendation ingest ownership
expected: Authenticated recommendation records ingest idempotently with server-owned identity and cross-account collision rejection.
result: pass
source: automated
coverage_id: 04-02-D1

### 5. Admin recommendation status
expected: The admin status page reports recommendation count and aggregates last receipt across events, Q/A, and recommendations.
result: pass
source: automated
coverage_id: 04-02-D2

### 6. Four-file export
expected: The authenticated export contains exactly four closed-schema, spreadsheet-safe CSV files with earliest-impression served_at values.
result: pass
source: automated
coverage_id: 04-02-D3

### 7. Participant manifest completeness
expected: participants.csv includes every seeded account with exact string user_id and non-multiplying enrollment/activity aggregates.
result: pass
source: automated
coverage_id: 04-02-D4

### 8. Oral-assessment join context
expected: The participant manifest supplies the exact condition/topic/timing join context needed for externally recorded oral assessments.
result: pass
source: automated
coverage_id: 04-02-D5

### 9. Recommendation outbox pipeline
expected: Recommendation records validate against shared bounds, strip local identity, and use the existing delivery, ACK, quarantine, and reconciliation pipeline.
result: pass
source: automated
coverage_id: 04-03-D1

### 10. Consent-gated recommendation projection
expected: Ready recommendation batches project in ledger order through dbQuery into idempotent revision-1 research records only under current affirmative consent.
result: pass
source: automated
coverage_id: 04-03-D2

### 11. Ready-batch capture ordering
expected: Ready-batch capture fires after durable save, boot closes missed windows before outbox reconciliation, and control ranking remains isolated.
result: pass
source: automated
coverage_id: 04-03-D3

### 12. Versioned consent routing
expected: Legacy and stale consent cannot enter participant routes or persist research records, while current-version research consent succeeds independently of AI consent.
result: pass
source: automated
coverage_id: 04-04-D1

### 13. Five-row consent screen on Android
expected: The three-step consent screen renders all five section 14.3 rows and stores versioned affirmative consent without overflow or truncation.
result: pass
source: adb-simulator
coverage_id: 04-04-D2
evidence: API 36.1 screenshots and UI hierarchy confirmed five rows, consent checkbox, and continuation control in en/zh/es/ja.

### 14. Four-locale consent language
expected: English, Simplified Chinese, Spanish, and Japanese display the full logging, Q/A storage, researcher-run external recording, anonymization, and withdrawal disclosures.
result: pass
source: adb-simulator
coverage_id: 04-04-D3
evidence: All four locales rendered without clipping; every oral-recording row explicitly says the researcher records outside the app.

### 15. Seeded assignment architecture
expected: The seeded-assignment chain is verified from the D1 account through immutable device binding to ranking and logging.
result: pass
source: automated
coverage_id: 04-05-D1

### 16. Locked study design wording
expected: Planning documents state the locked one-topic, researcher-assigned, externally administered oral-assessment design.
result: pass
source: automated
coverage_id: 04-05-D2

### 17. Executable pilot protocol
expected: The pilot protocol contains preflight, per-participant workflow, scoring contract, export audit, UAT template, and exit gate.
result: pass
source: automated
coverage_id: 04-06-D1

### 18. Live deployment and export gate
expected: Live D1 migration, canonical Worker deployment, authenticated admin smoke, clean pre-pilot tables, and four-file export evidence are recorded.
result: pass
source: operator-evidence
coverage_id: 04-06-D2
evidence: 04-06-SUMMARY.md records migration 0004, canonical Worker deployment, authenticated export, removal of 83 pre-pilot events, and graph-pool cutover.

### 19. Fresh Android seeded-account binding and upload
expected: A fresh Android WebView installation binds seeded account 1001 through the canonical Worker, enters onboarding, and can upload research records without CORS errors.
result: pass
previous_result: issue
reported: "ADB submitted seeded account 1001 on API 36.1. The UI reported that the account could not be prepared. Fresh logcat showed the Worker preflight omitted Access-Control-Allow-Origin for https://localhost. After a debug-only local fetch stub allowed the remaining UI checks, /v1/ingest failed with the same CORS error."
severity: blocker
resolution: "Passed after canonical Worker version 55b154c5-8dd2-4f25-8045-673ceb9fa406 restored the exact RESEARCH_ALLOWED_ORIGINS binding and live preflights proved https://localhost was allowed on both public endpoints. A freshly installed and cleared API 36 app then bound account 1001 through the real ResearchSetupScreen, completed versioned consent, opened a real feed post, persisted the binding across relaunch, and uploaded behavioral records without a stub or AI call."
evidence: |
  Retest window: 2026-07-20T05:55:11.648Z onward; ADB-only on emulator-5554,
  Android SDK 36 (Medium_Phone_API_36.1), with no emulator-window interaction.
  APK: com.trellis.app versionCode 1/versionName 1.0, compile/target SDK 36,
  SHA-256 2ebd83d0e8f0313538fef2620943681d2bd08778850a42e0236eee0ac8d38a30,
  assembled 2026-07-20T05:54:46Z.
  Fresh-state proof: adb install -r succeeded, then pm clear com.trellis.app returned Success.
  UI hierarchy before submit showed Research setup, Account ID value 1001, and Confirm account.
  After the 2026-07-20T05:56:36.124Z submit, the hierarchy showed Welcome to QuestionTrace
  with no "This account could not be prepared" text. The current five-disclosure consent screen
  was accepted, and Home rendered the 77-post pilot-graph-20260718 feed.
  ADB opened "The AI Labor Debate: Three Competing Views on the Future of Work" at
  2026-07-20T05:58:13.989Z. After force-stop and monkey relaunch at 05:59:06.265Z,
  the hierarchy still contained Account ID 1001 plus Home/Post content and did not return to setup.
  Sanitized logcat showed both Capacitor launches loading https://localhost, app start/resume,
  and the QuestionTrace database backend; the targeted CORS/network-error scan returned 0 matches.
  Read-only remote D1 query for user_id 1001 returned 19 behavioral_events (delta +19 from
  the pre-smoke baseline of 0), received 2026-07-20T05:57:50.509Z through 05:59:17.790Z:
  16 feed_impression, 2 post_open, and 1 app_open. Wrangler reported changes=0/rows_written=0.

## Summary

total: 19
passed: 19
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "A fresh Android WebView installation can bind a seeded account and upload research records through the canonical Worker."
  status: resolved
  reason: "ADB UAT observed CORS preflight failures for both /v1/install/resolve and /v1/ingest because the live response omitted Access-Control-Allow-Origin for https://localhost."
  resolution: "Canonical Worker version 55b154c5-8dd2-4f25-8045-673ceb9fa406 restored the exact origin binding; live preflights passed, and the ADB-only fresh-device retest bound account 1001 and produced a +19 remote behavioral-event delta in the retest window."
  severity: blocker
  test: 19
  root_cause: "The Phase 4 consolidation redeployed canonical Worker version 17 with the committed default wrangler.jsonc, which omitted the required non-secret vars.RESEARCH_ALLOWED_ORIGINS binding. The Worker correctly fails closed to an empty allowlist. Unit tests inject the variable directly, and the deploy smoke used origin-less admin/export requests, so neither gate detected the removed production binding."
  artifacts:
    - path: "research-backend/wrangler.jsonc"
      issue: "Canonical deployment config omits vars.RESEARCH_ALLOWED_ORIGINS."
    - path: "research-backend/wrangler.deploy.local.jsonc"
      issue: "Ignored local config contains the required origin list but is not used by plain wrangler deploy."
    - path: "research-backend/test/cors-auth.test.mjs"
      issue: "Tests inject the origin variable and do not validate deployment configuration."
    - path: "docs/pilot_protocol.md"
      issue: "Post-deploy smoke checks origin-less admin/export paths but not real WebView preflights."
  missing:
    - "Declare the exact non-secret approved origin allowlist in the tracked canonical Wrangler config."
    - "Add a deployment-config contract test and post-deploy real-origin OPTIONS checks for both public endpoints."
    - "Redeploy the canonical Worker and rerun fresh Android enrollment plus ingest through ADB without a fetch stub."
  resolved_by: ["04-07"]
  debug_session: ".planning/debug/resolved/phase4-android-webview-cors.md"
