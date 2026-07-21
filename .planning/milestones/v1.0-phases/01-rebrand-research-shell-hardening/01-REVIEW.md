---
status: issues_found
phase: 01-rebrand-research-shell-hardening
depth: standard
files_reviewed: 51
findings:
  critical: 3
  warning: 8
  info: 0
  total: 11
---

# Phase 01 Code Review

## Summary

Phase 01 establishes useful privacy-bounded record types, server-owned condition resolution, durable local stores, idempotent D1 writes, and protected aggregate export. However, the current production path is not study-ready: the Capacitor client cannot call the deployed Worker because the Worker has no CORS/preflight support, participant routes and logging bypass consent, and the public collector has no client authorization. The offline queue also has several liveness and durability gaps that can leave records pending indefinitely or orphaned outside the upload queue.

The review covered the 51 existing files in the explicit Phase 01 scope. Deleted artifacts were assessed through the ten plan summaries and the dead-code regression contract. The six known BottomSheet/ChatInput/post-history source-contract failures are treated as pre-existing baseline failures and are not attributed to Phase 01; no reviewed Phase 01 change was found to expand their impact.

## Findings

### CR-01 — Participant use and research logging bypass the consent flow

- **Severity:** Critical
- **Location:** `app/src/screens/ResearchSetupScreen.tsx:55`; `app/src/screens/ResearchSetupScreen.tsx:61`; `app/src/App.tsx:202`; `app/src/App.tsx:213`; `app/src/App.tsx:281`; `app/src/App.tsx:296`; `app/src/screens/OnboardingScreen.tsx:41`
- **Evidence:** Successful account binding navigates directly to `/home`. `ParticipantRouteGate` checks only whether an identity is bound; the onboarding check exists only in `HomeRedirect`, which runs for `/` but not `/home`, `/posts/:id`, `/saved`, or `/settings`. `startResearchSession()` records `app_open` as soon as identity hydration/binding succeeds, before `onboardingCompleted` or consent is checked. Onboarding also exposes “skip” handlers that set `onboardingCompleted: true` with `aiConsentGiven: false`.
- **Impact:** A freshly bound participant can enter the app and generate/upload research records without ever seeing or accepting the consent disclosure. This is both a privacy/ethics failure and a protocol-validity failure; the presence of an unused onboarding screen does not protect the collection path.
- **Actionable fix:** Put a consent-aware gate around every participant route, navigate successful setup to `/onboarding` (or `/`), and start interaction logging only after persisted consent is true. Remove the consent-bypassing skip path unless the protocol supplies a separately persisted, researcher-verified external-consent state. Add a routing/integration test proving direct `/home`, `/posts/:id`, `/saved`, and `/settings` access redirects before consent and that no research row is written before acceptance.

### CR-02 — The deployed Worker cannot be called from the Capacitor/WebView client

- **Severity:** Critical
- **Location:** `research-backend/src/worker.ts:5`; `research-backend/src/worker.ts:232`; `research-backend/src/worker.ts:244`; `research-backend/src/worker.ts:249`
- **Evidence:** The Worker emits no `Access-Control-Allow-Origin` headers and has no `OPTIONS` route. Both mobile calls are cross-origin JSON `POST`s, which cause a browser/WebView CORS preflight. The router returns method-not-allowed/not-found for that preflight. The successful live smoke tests used curl, which does not enforce browser CORS.
- **Impact:** On an actual participant phone, `/v1/install/resolve` cannot complete and `/v1/ingest` cannot upload. The live deployment can appear healthy through curl while the app’s end-to-end collection loop is unusable.
- **Actionable fix:** Add explicit preflight handling and CORS response headers for the exact Capacitor origins used by the signed builds (and the approved development origin), including `POST`, `OPTIONS`, `Content-Type`, and the chosen authorization header. Do not use CORS as authentication. Add Worker tests for allowed/disallowed origins and `OPTIONS`, plus a browser/Capacitor integration smoke test rather than curl-only verification.

### CR-03 — Anyone on the internet can enumerate assignments and forge study data

- **Severity:** Critical
- **Location:** `research-backend/src/worker.ts:66`; `research-backend/src/worker.ts:136`; `research-backend/src/worker.ts:140`; `research-backend/src/worker.ts:244`; `research-backend/src/worker.ts:249`; `research-backend/migrations/0001_init.sql:1`
- **Evidence:** `/v1/install/resolve` and `/v1/ingest` have no authentication or per-install credential. Knowing or guessing a numeric account ID is sufficient to obtain its condition/topic assignment and submit arbitrary allowlisted records. The Worker verifies only that the numeric account exists; the admin password protects only `/admin*`. A higher-revision Q/A record is also permitted to update an existing ID without proving that the submitter owns that record.
- **Impact:** Condition blinding can be broken and behavioral/Q&A data can be fabricated or overwritten, invalidating the experiment. CORS restrictions would not mitigate scripts, curl, or direct HTTP clients.
- **Actionable fix:** Protect installation resolution with an operator/build enrollment credential and issue an opaque per-install upload token bound server-side to one account. Require and verify that token on every ingest request, derive `userId` from the token rather than trusting the body, and constrain Q/A conflict updates to the original owner. Store only hashed/revocable token material in D1/Worker secrets. Add negative tests for missing/wrong/cross-account tokens and collision attempts.

### WR-01 — Offline retry triggers are implemented but never registered in production

- **Severity:** Warning
- **Location:** `app/src/services/upload-queue.service.ts:185`; `app/src/App.tsx:296`
- **Evidence:** `registerRetryTriggers()` installs browser `online` and Capacitor `appStateChange` listeners, but no production file imports or calls it; repository search finds only its unit test. `App` registers its own lifecycle listener for session/theme handling but never activates the upload retry service.
- **Impact:** Connectivity restoration while the app remains open does not automatically retry pending records, contrary to D-13. Delivery depends on a later enqueue/app lifecycle event and may remain pending for the rest of a study session.
- **Actionable fix:** Register retry triggers once in the boot lifecycle after database/context hydration and dispose them on unmount. Add a production-wiring test and a WebView UAT that records offline, restores connectivity without another participant action, and observes the queue drain.

### WR-02 — A flush processes only one bounded batch and misses work queued in flight

- **Severity:** Warning
- **Location:** `app/src/services/upload-queue.service.ts:127`; `app/src/services/upload-queue.service.ts:172`; `app/src/services/upload-queue.service.ts:174`; `app/tests/services/upload-queue.service.test.mjs:94`
- **Evidence:** `runFlush()` selects and sends one batch, then returns even when more rows remain. A concurrent `enqueue()` receives the existing `flushPromise`; once that promise finishes, no follow-up flush is scheduled. The test for 250 records explicitly considers leaving 150 records after a successful flush to be correct.
- **Impact:** A backlog accumulated offline drains at most 100 records per trigger. New or replacement records created during an in-flight request can also remain queued indefinitely if no later trigger occurs, so “automatic补传” is not guaranteed.
- **Actionable fix:** Maintain a dirty/follow-up flag for enqueues during an active flush and continue successful bounded batches until the queue is empty (yielding between requests and stopping on failure). Test a 250-record backlog, enqueue-during-flight, and Q/A-revision replacement through complete automatic drain.

### WR-03 — One invalid or oversized record can permanently block the queue head

- **Severity:** Warning
- **Location:** `app/src/services/interaction-log.service.ts:74`; `app/src/services/interaction-log.service.ts:163`; `app/src/services/interaction-log.service.ts:199`; `app/src/services/upload-queue.service.ts:88`; `app/src/services/upload-queue.service.ts:132`; `app/src/services/upload-queue.service.ts:142`; `research-backend/src/validation.ts:99`; `research-backend/src/validation.ts:139`
- **Evidence:** Client validation requires non-empty strings but imposes none of the backend’s length limits. If the oldest envelope alone exceeds 256 KiB, `selectBoundedBatch()` returns an empty batch forever. If it is under 256 KiB but violates a backend field limit, the Worker returns 4xx; the client treats every non-2xx response as retryable and retains the same head record forever.
- **Impact:** A long typed question, generated answer, or malformed persisted row can prevent that record and every later participant event from reaching the server, while diagnostics only shows a growing pending count.
- **Actionable fix:** Share/version the wire validation limits on the client and server, reject impossible records before queue insertion, and distinguish permanent 4xx validation failures from transient failures. Preserve rejected records in local recovery plus a diagnostic/quarantine state rather than silently deleting them, and continue uploading later valid rows. Add first-record-over-limit and server-400 poison-row tests.

### WR-04 — Durable records and upload envelopes are not committed atomically or reconciled

- **Severity:** Warning
- **Location:** `app/src/services/interaction-log.service.ts:97`; `app/src/services/interaction-log.service.ts:130`; `app/src/services/interaction-log.service.ts:134`; `app/src/services/db.service.ts:218`
- **Evidence:** `storeAndEnqueue()` writes `research_records` and `research_upload_queue` in separate IndexedDB transactions. If the app is suspended/crashes or the second write fails after the first succeeds, the durable record remains outside the queue. No startup reconciliation scans `research_records` for records absent from the outbox.
- **Impact:** The local recovery file can contain records that are never uploaded, creating a silent discrepancy between device and central exports. This violates the claimed persist-before-send collection guarantee even though each individual database call succeeds in tests.
- **Actionable fix:** Add a multi-object-store IndexedDB transaction for record+outbox writes, or implement deterministic boot/resume reconciliation that re-enqueues durable records not known to be acknowledged. Add fault-injection tests for failure/crash between the two writes and verify eventual upload.

### WR-05 — First-install language selection does not default to English

- **Severity:** Warning
- **Location:** `app/src/screens/OnboardingScreen.tsx:29`; `app/src/screens/OnboardingScreen.tsx:37`
- **Evidence:** State initially falls back to English, but an immediate effect calls `detectDeviceLocale()` and replaces the selection with the phone locale. Continuing or skipping persists that detected value. The locked Phase 01 decision is an English default, with language changes initiated by the participant.
- **Impact:** Participants on Chinese/Spanish/Japanese phones receive a non-English default despite the approved protocol, introducing inconsistent initial UI exposure.
- **Actionable fix:** Remove automatic device-locale selection for a fresh study install. Initialize to persisted locale when one exists and otherwise to `en`; retain immediate participant-initiated switching. Add a test with a non-English device locale proving the initial/persisted default remains English.

### WR-06 — Two active participant feedback links still expose the Trellis brand

- **Severity:** Warning
- **Location:** `app/src/screens/HomeScreen.tsx:757`; `app/src/screens/HomeScreen.tsx:795`; `app/tests/phase1/rebrand-surfaces.test.mjs:49`
- **Evidence:** Both live `mailto:` links use `subject=Trellis%20Feedback`. The rebrand regression test scans native surfaces and locale values only, so it misses active JSX attributes.
- **Impact:** Opening feedback from loading/error states exposes the retired product brand in the participant’s mail application, so SHELL-01’s “no user-facing Trellis strings” criterion is not met.
- **Actionable fix:** Rename the mail subject to QuestionTrace (or remove the feedback action if it is outside the participant surface) and extend the rebrand test to scan active TSX/HTML attributes while allowlisting only native identifiers and intentional historical/delete-only values.

### WR-07 — The Phase 0 residue sweep still retains an orphan profiler and retired settings copy

- **Severity:** Warning
- **Location:** `app/src/lib/cold-start-profiler.ts:61`; `app/src/lib/cold-start-profiler.ts:92`; `app/tests/services/storage-namespace.test.mjs:19`; `app/tests/services/storage-namespace.test.mjs:36`; `app/src/locales/en.json:385`; `app/src/locales/en.json:468`; `app/src/locales/en.json:474`; `app/src/locales/en.json:476`; `app/src/locales/en.json:549`
- **Evidence:** Repository search finds no production importer of `cold-start-profiler.ts`; only `storage-namespace.test.mjs` imports it and labels it an active owner, so a source-contract test pins dead code in place. The four locale bundles also retain copy for removed AI/data/developer settings, destructive clear-data controls, live YouTube, and live web search. The residue test checks only a narrow token list and therefore passes.
- **Impact:** SHELL-04’s remaining-dead-code requirement is incomplete, and retired §15.3/configuration surfaces remain easy to accidentally reconnect. The profiler also still emits a `[Trellis]` console label.
- **Actionable fix:** Delete the orphan profiler and its storage test entry, remove unused retired settings/live-fetch keys identically from all four locale bundles after a call-site check, and broaden the residue test around deleted namespaces/import reachability rather than a short symbol list.

### WR-08 — CSV formula neutralization misses tab/whitespace-prefixed formulas

- **Severity:** Warning
- **Location:** `research-backend/src/export.ts:33`; `research-backend/test/export.test.mjs:8`
- **Evidence:** Formula escaping only prefixes cells whose first character is `=`, `+`, `-`, or `@`. Participant text beginning with a tab or other spreadsheet-trimmed control/whitespace before one of those characters is exported unchanged. Tests cover only direct formula-leading strings.
- **Impact:** Opening the aggregate CSV in spreadsheet software can still interpret crafted participant text as a formula, creating a data-export injection risk for researchers.
- **Actionable fix:** Neutralize spreadsheet-dangerous leading control characters (`\t`, `\r`, `\n`) and whitespace-normalized formula prefixes, or prefix all participant-authored text cells with an apostrophe while preserving raw values in a safer format. Add tests for tab/space/control-prefixed formula payloads.

## Verification Performed

- `research-backend`: `npm test` — 19/19 passed.
- `app`: focused Phase 01 research/storage/participant/rebrand/prune suites — 31/31 passed.
- Static cross-file review covered identity/condition ownership, React lifecycle, local persistence and queue races, Worker routing/validation/D1 statements, admin authorization/export, storage namespace, branding, and prune residue.
- Passing tests do not negate CR-01 through CR-03 because the current suites do not execute consent-aware routing, browser CORS preflight, or authenticated public ingestion.

## Recommended Fix Order

1. Fix CR-01 consent gating and pre-consent logging.
2. Design the public-ingest authorization boundary (CR-03), then add CORS/preflight around that authenticated contract (CR-02).
3. Register retries and make the queue self-draining/reconciling (WR-01 through WR-04).
4. Close protocol/UI/rebrand/prune/export gaps (WR-05 through WR-08).
