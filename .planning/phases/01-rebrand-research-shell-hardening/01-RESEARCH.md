# Phase 1: Rebrand + research shell hardening - Research

**Researched:** 2026-07-10
**Domain:** Capacitor research shell, local-first interaction logging, and a minimal deployed log-collection service
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

<!-- DATA_A6F4C9D2_START -->
### Research accounts, conditions, and participant surface
- **D-01:** Researchers pre-create neutral, numeric-only accounts. During in-person installation they enter the account assigned after the Zoom pretest; that stable account ID is the `userId` for every record.
- **D-02:** Account-to-condition mapping is fixed before handoff and hidden from participants. Researchers manually balance/assign people after pretests (including speaking amount); the app must not automate stratification or random assignment.
- **D-03:** Each app install is on one participant's own phone and permanently bound to its assigned account. No logout, account switch, condition switch, or participant data-clear action exists.
- **D-04:** Participant-visible routes are limited to feed/posts, post-scoped Ask, Saved, and Settings. Settings shows only the neutral numeric account ID and UI language. It contains no name, group, study explanation, privacy/data controls, or other account details.
- **D-05:** `QuestionTrace` is the mobile system/home-screen application name. In-app pages use neutral functional titles such as Feed, Saved, and Settings rather than repeatedly foregrounding the research brand.
- **D-06:** UI starts in English. Participants can switch the UI immediately to English, Chinese, Spanish, or Japanese without restart; curated content, questions, and answers remain English in all UI languages.

### Behavioral logging and privacy
- **D-07:** Log each required interaction with event type, timestamp, account ID, fixed condition, topic ID, related post/question/recommendation IDs, and applicable reading/video duration. Store submitted question text and answer data as question/answer records, not duplicated as arbitrary event payload.
- **D-08:** Do not collect source URL, feed display position, route/page-context fields, device metadata, keystroke timing, or any other redundant context derivable from identifiers and time order. Continue to exclude every prohibited category in RSD §14.2.
- **D-09:** The logging contract must cover all RSD §14.1 events before personalization is introduced and must support the RQ-01 behavioral measures.

### Researcher-only settings and recovery
- **D-10:** A hidden researcher page is protected by a researcher PIN. The PIN is a gate for the participant UI; it must not expose account/condition changes or destructive controls.
- **D-11:** The hidden page shows only necessary local diagnostics: pending upload count and last successful upload time. It can export the current participant's local records as a recovery backup; it cannot clear records, alter accounts/conditions, or accept API-key input.
- **D-12:** Study-specific client API configuration is injected when building the research installation package. No researcher manually enters a key, and no actual secret may be placed in the repository, planning documents, tests, logs, or user-facing output.

### Online collection and researcher export
- **D-13:** Phase 1 includes a real, simple log-collection backend deployed at a fixed online URL. Records are queued locally first, then uploaded when created; failed uploads retry automatically after connectivity returns until the server acknowledges receipt. Participants may use the app offline.
- **D-14:** The central data page is a minimal, password-protected researcher webpage. It is not participant-facing and has no general user accounts, editing, or complex dashboard. Its management password is server-side only and must never be embedded in the participant app.
- **D-15:** The researcher page provides basic upload-health status and one downloadable archive containing two CSV files: (1) behavioral events, and (2) question/answer records. The mobile hidden-page export remains a per-participant recovery copy, while the webpage export aggregates all accounts.
<!-- DATA_A6F4C9D2_END -->

### the agent's Discretion

<!-- DATA_B70D3E91_START -->
- Choose the simplest maintainable backend, database, upload batching/retry strategy, export mechanism, PIN storage mechanism, and deployment host that satisfy the locked behavior above.
- Define non-secret configuration conventions and test fixtures. Never invent or commit real client keys, PINs, passwords, URLs, or participant data.
- Preserve native bundle identifiers while changing all required display/rebrand surfaces.
<!-- DATA_B70D3E91_END -->

### Deferred Ideas (OUT OF SCOPE)

<!-- DATA_C28F6A54_START -->
- **Protocol document alignment:** revise `Documents/QuestionTrace_Research_Experimental_Design_EN.docx` to replace the current system-performed stratified randomization wording with researcher-led, pretest-informed manual balancing and fixed-account assignment.
<!-- DATA_C28F6A54_END -->
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | In-app rebrand Trellis → QuestionTrace across all user-facing surfaces (display name, `index.html` title, `capacitor.config.ts` appName, iOS/Android display names, Settings/About, onboarding + starter-post copy, all 4 locale bundles). Native bundle identifiers unchanged. No user-facing "Trellis" strings remain. | Rebrand inventory, native display-versus-bundle split, locale parity gate, and scan strategy. |
| SHELL-02 | Storage key rename with no migration — `IDB_NAME 'trellis'` → `'questiontrace'`, live `trellis_*` localStorage keys → `questiontrace_*`; old keys orphaned; tests updated; no migration framework added. | Runtime-state inventory, all storage-owner inventory, and IndexedDB schema/version pattern. |
| SHELL-03 | Condition config scaffolding — a `"control" | "experimental"` value is assignable and readable app-wide, and downstream services can branch on it (RSD §6.5). | Immutable `ResearchIdentity` / `StudyContext` design and bootstrap ordering. |
| SHELL-04 | Remaining dead-code sweep — remove code, exports, and assets orphaned by the Phase 0 prune that the prune pass missed; no unreferenced §15.3-feature remnants in `app/src`; all gates stay green. | Prune-report inventory, call-site sweep instructions, and static negative checks. |
| LOG-01 | Interaction logging infrastructure — `UserInteractionEvent` covering all §14.1 event types (app_open, feed_impression, post_open, post_close, time-on-post, source_click, video_progress if available, question_suggestion_click, question_submit, ai_answer_view, save_post, not_interested, recommendation_reason_view, notification_received/open, session_end). Each event records userId, condition, topicId, timestamp (+ optional postId/questionId/recommendationId/durationMs/payload). Logging exists before personalization (RSD §9.8, §14.1, §23). Excludes all §14.2 do-not-collect categories. | Whitelisted event schema, Q/A-record separation, durable queue/ack protocol, worker API, and privacy tests. |
| RQ-01 | RQ1 re-engagement measurable — logs support sessions, return days, session length, posts opened, questions asked, suggestion clicks, notification open rate, voluntary revisits. | Event-to-measure mapping and required timestamp/duration semantics. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- The app is a QuestionTrace research prototype; §15.3-pruned product features must not return. [VERIFIED: AGENTS.md; docs/research_system_design.md]
- Follow the load-bearing `CLAUDE.md` rules before altering persistence, navigation, headers, feed behavior, question filtering, or the event bus. [VERIFIED: AGENTS.md; CLAUDE.md]
- Implement app changes under `app/src` using TypeScript/React functional components, services with one responsibility, inline styles/CSS variables where surrounding code does, and the established naming conventions. [VERIFIED: AGENTS.md]
- Run app commands from `app/`; the required gates are `npm test`, `npm run lint`, `npm run build`, and `npx cap sync` when native output changes. [VERIFIED: AGENTS.md]
- Add Node `node:test` tests under `app/tests/**/*.test.mjs`; execute persistence assertions through `dbQuery`, mock network calls, and never call live AI services in tests. [VERIFIED: AGENTS.md; CLAUDE.md]
- Ship every visible string across `en`, `zh`, `es`, and `ja` in one change; use EN-first keys and preserve exact key parity. Runtime LLM translation is prohibited. [VERIFIED: CLAUDE.md]
- Do not alter the iOS `com.huanfuli.trellis` or Android `com.trellis.app` identifiers. [VERIFIED: CLAUDE.md; app/ios/App/App.xcodeproj/project.pbxproj; app/android/app/build.gradle]
- Preserve the portal-versus-in-tree Header split, root overflow rules, always-mounted re-read pattern, and the one-event-per-semantic-action rule. [VERIFIED: CLAUDE.md; app/src/App.tsx; app/src/lib/event-bus.ts]

## Summary

Phase 1 should establish one immutable `ResearchIdentity` (`userId`, `condition`, `topicId`) before rendering participant routes, then make the logging service read that identity itself rather than accepting caller-supplied condition data. The current app already has the correct extension seams: `db.service.ts` supplies the durable IndexedDB/Node fallback seam and `App.tsx` gates first render on hydration; `event-bus.ts` supplies reactive re-reads for always-mounted Capacitor screens. [VERIFIED: app/src/services/db.service.ts; app/src/App.tsx; app/src/lib/event-bus.ts]

Use a small Cloudflare Worker with a D1 database as the collection boundary: one public, validated batch-ingest endpoint; one password-protected researcher page; and no participant-facing account system. D1 is available to Workers through an environment binding and supports bound prepared statements and batched transactional statements. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] This is the smallest single-host deployment that can accept records, retain them, show receipt health, and generate the required two-file archive. [ASSUMED]

The client must persist every event or Q/A revision locally before attempting upload. It retries a serialized bounded batch on record creation, browser `online`, and native-app resume; a failed fetch leaves rows intact, while an acknowledgment removes only the acknowledged queue envelope IDs. The browser online signal is only a retry trigger, not proof that the worker can be reached. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine] Server inserts must therefore be idempotent by immutable event ID and monotonic Q/A revision. [ASSUMED]

**Primary recommendation:** Create a `research-backend/` Cloudflare Worker + D1 service, and add client-side `study-context`, `interaction-log`, and `upload-queue` services backed by new stores in the existing IndexedDB seam. [ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rebrand display strings and native names | Browser / Client | Native shell | The web title, locales, app configuration, Android resources, and iOS display name are source-owned; bundle IDs are an explicit exception. [VERIFIED: app/index.html; app/capacitor.config.ts; app/android/app/src/main/res/values/strings.xml; app/ios/App/App/Info.plist] |
| Immutable account, condition, and topic context | Browser / Client | API / Backend | The device needs synchronous app-wide context offline, while the backend owns the pre-created account-to-condition source of truth. [ASSUMED] |
| Event/Q&A persistence and recovery export | Browser / Client | Database / Storage | Events must survive offline/restart before a request is attempted; IndexedDB is the existing durable local seam. [VERIFIED: app/src/services/db.service.ts] |
| Upload acknowledgement and idempotency | API / Backend | Database / Storage | Only the server can declare a record accepted; D1 primary keys/revisions make retried requests safe. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] [ASSUMED] |
| Aggregate CSV archive and receipt-health page | API / Backend | Database / Storage | The protected researcher page must aggregate all accounts without exposing records to participant clients. [ASSUMED] |
| Hidden PIN diagnostics page | Browser / Client | — | It is explicitly a local participant-UI gate with diagnostics and recovery export only, not a remote authorization mechanism. [VERIFIED: .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md] |

## Standard Stack

### Core

| Library / platform | Version | Purpose | Why standard |
|--------------------|---------|---------|--------------|
| Existing React + TypeScript + Vite app | React 19.2.6, TypeScript 5.9.3, Vite 7.3.1 | Participant app, type contracts, build-time public configuration | Already the application stack. [VERIFIED: app/package.json] |
| Existing `db.service.ts` IndexedDB seam | local implementation | Durable local research records, upload envelopes, and metadata | It provides the required `dbQuery` test seam and a LocalStorage fallback for Node tests. [VERIFIED: app/src/services/db.service.ts; AGENTS.md] |
| Cloudflare Worker + D1 | managed platform | Fixed log URL, bounded batch ingestion, protected status/export endpoint, SQLite-style tables | A Worker receives D1 via `env`; bound prepared statements and `batch()` support the required writes. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] |
| `wrangler` | 4.110.0; published 2026-07-09 | Local Worker/D1 development, migrations, and deployment | Cloudflare documents Wrangler as its Workers CLI. [CITED: https://developers.cloudflare.com/workers/wrangler/install-and-update/] `wrangler` [WARNING: flagged as suspicious — verify before using.] |

### Supporting

| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| `fflate` | 0.8.3; published 2026-05-16 | ZIP the two server-generated CSV byte streams | Backend-only `GET /admin/export.zip`; `zipSync`/`zip` support multiple archive entries. [CITED: https://github.com/101arrowz/fflate] [VERIFIED: npm registry] |
| Web Crypto `SubtleCrypto.digest` | browser platform | Compare a build-injected researcher-PIN hash without persisting the raw PIN | Use only for the local UI gate; it does not turn a client-side PIN into server authentication. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Worker + D1 | Supabase/Postgres | A full authentication/RLS/admin stack can be strong, but adds a second client/auth model that the locked minimal researcher page does not need. [ASSUMED] |
| Worker + D1 | Hosted Node server + SQLite/Postgres | Gives conventional server control but introduces VM/container patching and database operations for a deliberately small study collector. [ASSUMED] |
| `fflate` ZIP generation | Hand-built ZIP format | ZIP headers, offsets, CRCs, and multi-file archives are not appropriate bespoke code for this phase. [ASSUMED] |

**Installation:**

```bash
cd research-backend
npm install fflate@0.8.3
npm install --save-dev wrangler@4.110.0
```

**Version verification:** `npm view` confirmed `fflate` 0.8.3 (2026-05-16) and `wrangler` 4.110.0 (2026-07-09) on npm; neither returned a `postinstall` script. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `fflate` | npm | Since 2020 | 51,577,538/week | `github.com/101arrowz/fflate` | OK | Approved. Official project documents multi-file ZIP APIs and npm registry confirms 0.8.3. [CITED: https://github.com/101arrowz/fflate] [VERIFIED: npm registry] |
| `wrangler` | npm | Since 2012 | 13,915,770/week | `github.com/cloudflare/workers-sdk` | SUS: too-new latest publish | Flagged — use the official Cloudflare package only after a human verifies the release/package lock at installation. [CITED: https://developers.cloudflare.com/workers/wrangler/install-and-update/] [VERIFIED: npm registry] |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `wrangler` — planner must add `checkpoint:human-verify` immediately before installing/pinning it.

## Architecture Patterns

### System Architecture Diagram

```text
Researcher installation (unlinked, PIN-gated route)
  numeric account ID ──► resolve fixed account mapping ──► immutable ResearchIdentity
                                                           │
Participant app bootstrap ─────────────────────────────────┤
  await existing hydration + research hydration             ▼
  (no participant account/condition controls)        app-wide StudyContext
                                                           │
Participant interaction ─► interactionLog.record(...) ─────┤
  app/feed/post/Q&A/save/dismiss                             │ snapshots userId,
                                                              │ condition, topicId
                                                              ▼
                                           IndexedDB research_records
                                           + upload_queue + metadata
                                                              │
                      record-created / online / app-resume ──┤
                                                              ▼
                                      serialized POST /v1/ingest batch
                                                              │
                                                2xx acknowledged IDs only
                                                              ▼
 Cloudflare Worker ─► strict event/Q&A validation ─► D1 INSERT OR IGNORE / revision upsert
       │                                                   │
       │ Basic-auth-protected /admin                       ▼
       └──────────────────► health table + export.zip ◄ behavioral_events + question_answer_records
                                                  │
                               fflate ZIP: behavioral-events.csv + question-answer-records.csv
```

The client side owns offline durability and never blocks a participant action on network success. The backend owns receipt acknowledgment, account-map enforcement, aggregate visibility, and archive generation. [ASSUMED] The existing hydration gate in `App.tsx` makes research-context hydration before participant-route render the correct integration point. [VERIFIED: app/src/App.tsx]

### Recommended Project Structure

```text
app/
├── src/
│   ├── services/
│   │   ├── study-context.service.ts       # immutable userId/condition/topicId binding
│   │   ├── interaction-log.service.ts     # allowed event/Q&A record constructors
│   │   ├── upload-queue.service.ts        # durable queue, serialized flush, ack deletion
│   │   ├── research-export.service.ts     # local recovery JSON Blob
│   │   └── research-config.ts             # validates non-secret VITE_ config
│   ├── screens/
│   │   └── ResearchDiagnosticsScreen.tsx  # unlinked, PIN-gated, non-destructive
│   └── types/
│       └── research.ts                    # StudyCondition, records, discriminated events
└── tests/
    ├── services/                           # context/logging/queue persistence tests
    └── screens/                            # route and diagnostics-surface tests

research-backend/
├── src/worker.ts                           # only fetch handler: ingest + admin routes
├── src/validation.ts                       # pure request/schema/privacy validation
├── src/export.ts                           # CSV escaping + fflate ZIP assembly
├── migrations/0001_init.sql                # D1 schema, never real accounts
├── test/                                   # node:test pure/unit tests with fake D1
├── wrangler.jsonc                          # binding names only, never values/secrets
├── package.json
└── .dev.vars.example                       # names/placeholders only, git-safe
```

Keep the deployed collector separate from `app/` so a Worker deployment cannot accidentally inherit Capacitor/browser bundles or user-facing app dependencies. [ASSUMED] Continue to put reusable mobile persistence under `app/src/services`, matching the project structure. [VERIFIED: AGENTS.md; app/src/services]

### Pattern 1: Immutable Study Context, Not Mutable Settings

**What:** Persist a `ResearchIdentity` once during researcher-led installation; expose a read-only service to all screens/services. `interactionLog` obtains identity internally so a UI call cannot accidentally write the wrong condition. [ASSUMED]

**When to use:** Before any participant route, event write, Q/A record, or upload flush. The app must redirect to a neutral setup-required screen while identity is absent; after binding, there is no public mutator, logout, clear-data action, or condition control. [VERIFIED: .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md]

```typescript
// Source: app/src/services/settings.service.ts and app/src/services/db.service.ts patterns
export type StudyCondition = 'control' | 'experimental';

export interface ResearchIdentity {
  userId: string;          // neutral numeric account ID
  condition: StudyCondition;
  topicId: string;         // mandatory, opaque study topic ID
  boundAt: string;
}

export const studyContextService = {
  getRequired(): ResearchIdentity {
    const identity = readHydratedResearchIdentity();
    if (!identity) throw new Error('Research identity is not bound');
    return identity;
  },
  // bindOnce is reachable only from the PIN-gated installation flow.
  // It rejects when a different identity already exists.
};
```

The account-resolution endpoint must look up the account server-side and return its fixed condition/topic mapping; the ingest worker must re-derive condition/topic from that map rather than trust the client values. [ASSUMED]

### Pattern 2: Whitelisted Event and Q/A Records

**What:** Use a discriminated event union and a separate revisioned `QuestionAnswerRecord`. Do not expose the RSD schema's open-ended `payload?: Record<string, unknown>` to callers because D-08 forbids arbitrary/redundant collection. [VERIFIED: docs/research_system_design.md; .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md]

**When to use:** Every existing event call site and every new feed/recommendation/notification affordance. The logger must reject unknown event names and forbidden fields at runtime before persistence and again in the Worker. [ASSUMED]

```typescript
// Source: RSD §9.8 / §14.1; Phase 1 privacy decisions D-07 and D-08
type InteractionEventType =
  | 'app_open' | 'feed_impression' | 'post_open' | 'post_close'
  | 'source_click' | 'video_play' | 'video_progress'
  | 'question_suggestion_click' | 'question_submit' | 'ai_answer_view'
  | 'save_post' | 'not_interested' | 'recommendation_reason_view'
  | 'notification_received' | 'notification_open' | 'session_end';

interface UserInteractionEvent {
  id: string;
  userId: string;
  condition: StudyCondition;
  topicId: string;
  timestamp: string;
  eventType: InteractionEventType;
  postId?: string;
  questionId?: string;
  recommendationId?: string;
  durationMs?: number;
  // No URL, feed position, route, device, keystroke, or arbitrary payload field.
}

interface QuestionAnswerRecord {
  id: string;
  revision: number; // 1 = submitted, 2 = answer attached, monotonically increasing
  userId: string;
  condition: StudyCondition;
  topicId: string;
  postId: string;
  questionId: string;
  questionText: string;
  questionSource: 'typed' | 'suggested_question';
  submittedAt: string;
  answerText?: string;
  answerViewedAt?: string;
}
```

`post_close.durationMs` is the canonical time-on-post measure; do not create a second, redundant `time_on_post` event when the RSD's canonical event union already provides `post_close` plus `durationMs`. [VERIFIED: docs/research_system_design.md]

### Pattern 3: Durable At-Least-Once Upload with Idempotent ACK

**What:** First write the complete immutable event or Q/A revision to `research_records`, then enqueue a copy with a stable envelope ID. A single-flighted flush sends at most 100 envelopes or 256 KiB, and deletes only the `acknowledgedIds` returned by the server. [ASSUMED]

**When to use:** Immediately after a durable write, after the browser `online` event, and after Capacitor returns active. Exponential backoff with jitter prevents repeated rapid failures, but the next process/resume/online event always schedules another attempt. [ASSUMED]

```typescript
// Source: MDN online event documentation; app/src/services/db.service.ts SQL subset
async function flushPendingUploads(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    const batch = await uploadQueueService.getOldestBoundedBatch(100, 256 * 1024);
    if (batch.length === 0) return;

    const response = await fetch(`${researchConfig.apiBaseUrl}/v1/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ records: batch }),
    });
    if (!response.ok) throw new Error(`upload failed: ${response.status}`);

    const { acknowledgedIds } = await response.json() as { acknowledgedIds: string[] };
    await uploadQueueService.deleteOnlyAcknowledged(acknowledgedIds);
    await researchMetadataService.setLastSuccessfulUploadAt(new Date().toISOString());
  })().finally(() => { flushInFlight = null; });
  return flushInFlight;
}

window.addEventListener('online', () => void flushPendingUploads());
```

The `online` event fires when browser network state becomes online but is not proof a particular server is reachable, so response success—not `navigator.onLine`—is the success criterion. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event] A local timeout/fetch failure, aborted request, HTTP 5xx, or lost response after server commit must retain the envelope and retry; duplicate receipt is a successful acknowledgement. [ASSUMED]

### Pattern 4: Minimal Worker Boundary

**What:** Implement a dependency-light fetch handler with exactly four public routes: `POST /v1/install/resolve`, `POST /v1/ingest`, `GET /admin`, and `GET /admin/export.zip`. Status is rendered from the same server-side query as `/admin`; it is not an editable dashboard. [ASSUMED]

**When to use:** The Worker is the only deployed collection service. `POST /v1/ingest` accepts only bounded JSON with allowed field names, validates account IDs against `study_accounts`, and performs parameterized D1 writes. `/admin*` requires the server-only management password over HTTPS. [ASSUMED]

```typescript
// Source: Cloudflare D1 prepared-statement and batch documentation
const insertEvent = env.DB.prepare(
  `INSERT OR IGNORE INTO behavioral_events
   (id, user_id, condition, topic_id, timestamp, event_type, post_id, question_id,
    recommendation_id, duration_ms, received_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

await env.DB.batch(validEvents.map((event) => insertEvent.bind(
  event.id, event.userId, event.condition, event.topicId, event.timestamp,
  event.eventType, event.postId ?? null, event.questionId ?? null,
  event.recommendationId ?? null, event.durationMs ?? null, receivedAt,
)));
// Reply with every newly inserted or already-present immutable event ID.
```

D1 documents `prepare().bind()` for dynamic values and `batch()` for multiple statements, with transaction behavior for the batch. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/]

### Pattern 5: Build-Time Public Configuration and Server-Only Secrets

**What:** Validate a non-secret `researchConfig` module at startup. The research build injects only a fixed API base URL, an opaque topic/configuration identifier, and an optional client-side PIN digest. Keep the management password, D1 credentials/bindings, and any provider credentials in Worker secrets or external deployment configuration. [ASSUMED]

**When to use:** App research builds and Worker deploys. Commit only `.env.example` / `.dev.vars.example` placeholders such as `https://example.invalid`; never commit values, participant mappings, PINs, passwords, or tokens. [VERIFIED: .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md]

Vite exposes every `VITE_*` value to client bundles, so these variables must never contain secrets or API keys. [CITED: https://vite.dev/guide/env-and-mode] Cloudflare documents Worker secrets as encrypted bindings and advises secrets rather than plaintext variables for sensitive values. [CITED: https://developers.cloudflare.com/workers/configuration/secrets/]

### Anti-Patterns to Avoid

- **A settings boolean for condition:** it permits participant mutation and lets a logger forget to attach context. Use a hydrated immutable identity service. [ASSUMED]
- **A direct `fetch` at each UI handler:** it loses records on offline/response-loss paths. Log locally, enqueue, then flush through one service. [ASSUMED]
- **A generic analytics payload:** it bypasses the locked privacy exclusions. Model allowed IDs/durations explicitly and reject every other key. [VERIFIED: CONTEXT D-07–D-09]
- **A researcher dashboard with write actions:** it exceeds D-11/D-14. Status and two-file archive are read-only. [VERIFIED: CONTEXT D-11; CONTEXT D-14–D-15]
- **Changing bundle identifiers during the display-name rename:** it orphans native data/signing identity. Preserve the legacy iOS/Android identifier values. [VERIFIED: CLAUDE.md]

## Code Examples

### Add local research stores through the existing DB schema

```typescript
// Source: app/src/services/db.service.ts; MDN IndexedDB versioning guidance
const SHARED_DDL = [
  // existing tables ...
  `CREATE TABLE IF NOT EXISTS research_records (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    revision INTEGER NOT NULL,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_upload_queue (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS research_metadata (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`,
];

// Increase only when changing object-store schema; onupgradeneeded creates
// missing stores for the new `questiontrace` database.
const IDB_VERSION = 2;
```

The existing DDL-derived object-store pattern keeps the real IndexedDB and Node LocalStorage fallback in parity; use only its supported statement subset. [VERIFIED: app/src/services/db.service.ts] Increasing the database version invokes the schema-upgrade handler where stores are created. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB]

### Generate the required aggregate archive in the backend

```typescript
// Source: https://github.com/101arrowz/fflate
import { strToU8, zipSync } from 'fflate';

const bytes = zipSync({
  'behavioral-events.csv': strToU8(eventsCsv),
  'question-answer-records.csv': strToU8(questionAnswersCsv),
});

return new Response(bytes, {
  headers: {
    'content-type': 'application/zip',
    'content-disposition': 'attachment; filename="questiontrace-research-export.zip"',
    'cache-control': 'no-store',
  },
});
```

`fflate` documents `zipSync` for archives containing named file entries. [CITED: https://github.com/101arrowz/fflate]

## Component Responsibilities

| Component | Owns | Must not own |
|-----------|------|--------------|
| `study-context.service.ts` | Hydration, one-time binding, immutable identity read | UI display, event construction, request retries |
| `interaction-log.service.ts` | Event allowlist, privacy rejection, Q/A revision construction, local record write | Condition selection, remote-only persistence |
| `upload-queue.service.ts` | Queue envelopes, serialized bounded flush, ack deletion, retry schedule | Inventing event fields or mutating Q/A data |
| `research-export.service.ts` | Per-device recovery serialization from durable local records | Deleting/repairing records or central aggregation |
| `ResearchDiagnosticsScreen` | PIN-gated diagnostics/recovery action | Account/condition edits, clear/reset/configuration controls |
| Worker `validation.ts` | Bounded schema validation, server-side account-map resolution, privacy field rejection | Client PIN verification or participant UI |
| Worker `export.ts` | Safe CSV cells and two-entry ZIP response | App logging or account administration |

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Offline log durability | An in-memory array, `sendBeacon`-only path, or localStorage blob | Existing IndexedDB `dbQuery`/`dbExecute` seam with durable record and queue rows | A participant may be offline or the app may stop between action and request. [VERIFIED: app/src/services/db.service.ts] |
| ZIP archive format | Custom ZIP headers/CRC/central-directory logic | `fflate` in the Worker | It supplies tested multi-file ZIP creation. [CITED: https://github.com/101arrowz/fflate] |
| D1 SQL construction | String interpolation of participant data | `prepare().bind()` and `batch()` | Bound statements are the documented D1 pattern. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] |
| Secret delivery | `VITE_*` API keys, management passwords, or app-embedded server secrets | Worker secrets plus non-secret Vite config | Vite bundles `VITE_*` values into client source; Worker secrets are the appropriate server binding. [CITED: https://vite.dev/guide/env-and-mode] [CITED: https://developers.cloudflare.com/workers/configuration/secrets/] |
| PIN cryptography | A custom cipher or raw PIN stored in localStorage | Build-injected SHA-256 digest checked using Web Crypto, with a clear UI-gate-only limitation | Web Crypto exposes standard digest algorithms in secure contexts. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest] |

## Runtime State Inventory (Rename/Rebrand Required)

### 1. Stored data

- The primary current IndexedDB database is named `trellis`; its Node/fallback localStorage prefix is `trellis_db_`. The image cache has a separate IndexedDB database, `trellis_images`. [VERIFIED: app/src/services/db.service.ts; app/src/services/imageGeneration.service.ts]
- Active browser-storage owners include `trellis_settings`, `trellis_daily_read`, `trellis_active_session`, `trellis_filter_corpus_emb_v1`, `trellis_reorg_snapshot`, `trellis_connection_posts` (sessionStorage), `trellis_dev_mode`, and image-cache metadata currently named `img-cache-meta`. [VERIFIED: app/src/services/settings.service.ts; app/src/services/daily-read.service.ts; app/src/services/session.service.ts; app/src/services/filter-corpus.service.ts; app/src/services/canonical-knowledge.service.ts; app/src/services/concept-feed.service.ts; app/src/screens/settings/SettingsDataScreen.tsx; app/src/services/imageGeneration.service.ts]
- **Required change:** rename every retained app-owned browser key/database to the `questiontrace_*` namespace, including currently generic image metadata/cache keys, and create the new research record/queue/metadata stores under the new primary DB. [ASSUMED]
- **Migration classification:** code edit only. The locked decision intentionally leaves `trellis` IndexedDB databases and `trellis_*` / predecessor keys unread, unmodified, and un-migrated. Remove the current `migrateLegacyKeys()` boot call and the old-key cleanup path because both continue to name/touch old namespaces. [VERIFIED: app/src/main.tsx; app/src/services/legacy-migration.service.ts; app/src/services/db.service.ts] [ASSUMED]
- Existing physical data under the old namespace must not be copied to the new namespace; old installs start a fresh research shell. [VERIFIED: .planning/REQUIREMENTS.md; CLAUDE.md]

### 2. Live service configuration

- No committed Worker, D1, host URL, deployment configuration, or `.env*` file exists today; the current app only has direct client-side AI-provider configuration. [VERIFIED: repository file inventory; app/src/services/settings.service.ts]
- **Required change:** deploy one Worker at a fixed study URL and configure its D1 binding plus researcher management password outside Git. Build the app with only public configuration (for example, `VITE_RESEARCH_API_BASE_URL`), never a token/password/API key. [CITED: https://vite.dev/guide/env-and-mode] [CITED: https://developers.cloudflare.com/workers/configuration/secrets/]
- **Migration classification:** external service provisioning, not data migration. The actual URL, Worker secret values, and real account-map records are deployment inputs and must not appear in the repository, tests, or this document. [VERIFIED: .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md]

### 3. OS-registered state

- The iOS display name is `Trellis` in `Info.plist`; Android display strings and Capacitor `appName` are also `Trellis`. The iOS microphone usage text still references recording, although voice functionality was pruned. [VERIFIED: app/ios/App/App/Info.plist; app/android/app/src/main/res/values/strings.xml; app/capacitor.config.ts; docs/prune_report.md]
- The iOS bundle identifier is `com.huanfuli.trellis`; Android `namespace` and `applicationId` are `com.trellis.app`. These are deliberately retained. [VERIFIED: app/ios/App/App.xcodeproj/project.pbxproj; app/android/app/build.gradle; CLAUDE.md]
- The local Windows probe found no `Trellis`/`QuestionTrace` scheduled task or Windows service, and no PM2 installation. [VERIFIED: 2026-07-10 local `Get-ScheduledTask`, `Get-Service`, and `Get-Command pm2` probe]
- **Required change:** edit only display-name resources and remove the stale microphone permission description; preserve identifiers/package paths/custom URL scheme. Run Capacitor sync and inspect native diffs. [ASSUMED]
- **Migration classification:** code/native-resource edit only; no OS registration migration is needed on this workstation. Device-installed builds may retain old visible labels until a freshly synced/reinstalled build is used. [ASSUMED]

### 4. Secrets and environment variables

- The local environment has no variable name containing `trellis` or `questiontrace`; no committed environment file was found. Values were intentionally not inspected. [VERIFIED: 2026-07-10 local environment-name and repository-filename probe]
- Vite exposes `VITE_*` values in client source, so no Vite variable may contain the researcher password, raw PIN, account seed, LLM key, or upload secret. [CITED: https://vite.dev/guide/env-and-mode]
- **Required change:** add Git-ignored example/config conventions only. Configure `RESEARCH_ADMIN_PASSWORD` and other true server secrets as Worker secrets; use a non-secret API URL and optional PIN digest in the research app build. [CITED: https://developers.cloudflare.com/workers/configuration/secrets/] [ASSUMED]
- **Migration classification:** external deployment configuration only; do not rename/guess uncommitted credentials.

### 5. Build artifacts and installed packages

- No `app/dist`, native build, or Worker artifact directory was present in the workspace probe. [VERIFIED: 2026-07-10 local directory probe]
- `wrangler` is not installed globally; Node 22.19.0, npm 11.16.0, Docker 28.3.3, and SQLite 3.51.0 are available. [VERIFIED: 2026-07-10 local command probe]
- **Required change:** install/pin the Worker toolchain in the separate backend package, generate a fresh mobile build after native display-name edits, and do not re-tag or rename a previously installed mobile application by changing its bundle identifier. [VERIFIED: CLAUDE.md] [ASSUMED]
- **Migration classification:** fresh artifact generation only. No installed-package or image-tag migration is required.

## Rebrand and Prune Sweep Plan

1. Make a classified inventory before changing text: (a) user-visible runtime strings, (b) storage identifiers, (c) required legacy native identifiers, (d) historical/docs/test residue, and (e) pruned-feature code. Only (a), (b), and native display names are rebrand targets; only legacy native identifiers are intentional retained `trellis` values. [VERIFIED: CLAUDE.md; .planning/REQUIREMENTS.md]
2. Replace visible title/onboarding/starter-post/feedback/about strings across all four locale value bundles together, then run existing bundle-parity and missing-key tests. [VERIFIED: app/tests/locales/bundle-parity.test.mjs; CLAUDE.md]
3. Replace or delete every active storage key owner rather than doing a blind string replacement; generic `img-cache-*` keys must also become `questiontrace_*` if retained, because the requirement is namespace-wide. [VERIFIED: app/src/services/imageGeneration.service.ts; .planning/REQUIREMENTS.md] [ASSUMED]
4. Remove the old EchoLearn→Trellis migration service/call and retire any boot routine that touches orphaned `trellis_*` values. A new namespace must not make old data appear through a fallback. [VERIFIED: app/src/main.tsx; app/src/services/legacy-migration.service.ts; app/src/services/db.service.ts]
5. Sweep from imports/call sites, not filenames alone. The prune report identifies residual reorganization/mind-map code, dev controls, unused locale namespaces, old CSS, historical mock helpers, and the `profile-trellis.mjs` script as remaining cleanup candidates. [VERIFIED: docs/prune_report.md; app/src/services/canonical-knowledge.service.ts; app/scripts/profile-trellis.mjs]
6. Preserve `canonical-knowledge.service`, `GRAPH_UPDATED`, anchor/cluster data fields, daily-read lazy skipping, and `ChatInput`; they are explicitly retained research-shell infrastructure, not dead graph/flashcard features. [VERIFIED: docs/prune_report.md; CLAUDE.md]

### Confirmed Phase-1 Sweep Candidates

| Candidate | Evidence | Planner action |
|-----------|----------|----------------|
| `SettingsAIScreen`, `SettingsContentScreen`, `SettingsFeaturesScreen`, `SettingsDataScreen` and their routes | Current Settings exposes AI/provider/content/dev/data controls, while D-04 permits only account ID and language. [VERIFIED: app/src/App.tsx; app/src/screens/SettingsScreen.tsx] | Remove routes/screens/imports and simplify Settings; do not leave direct deep-link access. |
| `reorganizeMindmap`, reorg snapshot, reorg events/locales | The graph/mind-map UI was pruned; implementation residue remains in the canonical service and locale bundles. [VERIFIED: docs/prune_report.md; app/src/services/canonical-knowledge.service.ts; app/src/types/index.ts] | Perform an import/call-site scan, delete only unreferenced reorganization APIs/state/tests/strings, preserve canonical anchoring. |
| `creditAwarded` daily-read state and methods | The methods are referenced by their unit test only; the underlying explored-anchor behavior remains needed. [VERIFIED: app/src/services/daily-read.service.ts; app/tests/services/daily-read.service.test.mjs] | Delete gamification-only field/method/tests without changing `exploredAnchors`. |
| `profile-trellis.mjs`, `_actions-*`/`_trellis-*` mock helpers, stale source-reading tests | Prune report calls these inert residue; the profiler still imports removed trellis services. [VERIFIED: docs/prune_report.md; app/scripts/profile-trellis.mjs; app/tests/services] | Delete unreferenced scripts/helpers and update test discovery; verify no live test imports them. |
| Voice microphone description | Voice recording was removed yet iOS still presents an old use description. [VERIFIED: docs/prune_report.md; app/ios/App/App/Info.plist] | Remove the permission string unless another live native capability proves it is needed. |

## Event Contract and RQ-01 Coverage

| Required behavior | Event / record | Current or future integration point | Measure enabled |
|-------------------|----------------|-------------------------------------|-----------------|
| Launch / return | `app_open` | After identity hydration; one per foreground session | Sessions, return days |
| End of active session | `session_end` with duration | `pagehide` plus Capacitor inactive/background lifecycle | Session length |
| Feed batch becomes visible | `feed_impression` | Home feed render/batch boundary; no display position | Exposure/re-engagement without forbidden ranking context |
| View / leave a post | `post_open`, `post_close` with duration | `PostDetailScreen` resolved post and unmount/route cleanup | Posts opened, time on post, voluntary revisits |
| Source/video interaction | `source_click`; `video_play`/`video_progress` only if a player exists | Current shell has no live video pipeline; define logger contract now and instrument later player components | Source/video engagement where available |
| Suggested and typed Q&A | `question_suggestion_click`, `question_submit`; revisioned Q/A record | Split `PostDetailScreen.handleAsk` by source; store text only in Q/A record | Questions asked, suggestion clicks |
| Answer actually viewed | `ai_answer_view`; Q/A revision stores `answerViewedAt` | Observe final answer render once, rather than every stream token | Answer engagement |
| Save / dismiss | `save_post`, `not_interested` | Existing engagement-service call sites | Engagement and future control-compatible signals |
| Recommendation/notification interactions | `recommendation_reason_view`, `notification_received`, `notification_open` | Contract-only until those affordances exist; no fake events | Future reason/notification measures |

The RSD requires app open, feed/post/Q&A/save/dismiss/reason/notification/session behavior while forbidding screen recording, outside-app use, precise geolocation, contacts, other apps, clipboard, raw keystroke timing, and unnecessary private data. [VERIFIED: docs/research_system_design.md] Do not add `sourceUrl`, feed position, route/page context, device metadata, or arbitrary payload data. [VERIFIED: .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md]

## Common Pitfalls

- **Treating `navigator.onLine` as upload success:** it is only a connection heuristic and a reachable LAN/firewall can still block the Worker. Retry after it fires, but delete rows only after the response ACK. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine]
- **Deleting on request dispatch:** a server may commit a record and the response may be lost. Stable IDs plus `INSERT OR IGNORE` make retry safe; deleting before ACK loses data. [ASSUMED]
- **Using one Q/A ID for a mutable answer without revision:** a delayed/retried question-submit envelope can overwrite an answer. Make revision monotonic and let the Worker accept only a newer revision. [ASSUMED]
- **Putting a secret in `VITE_*`:** Vite bundles it into the participant app. The app can only receive public configuration. [CITED: https://vite.dev/guide/env-and-mode]
- **Calling the hidden PIN a security boundary:** client code and an injected hash can be extracted. It is a participant-UI gate only; the Worker admin password is the real server-side authorization control. [ASSUMED]
- **Letting arbitrary `payload` through because TypeScript says it is a record:** runtime JSON can carry prohibited URLs, device fields, or private content. Enforce a per-event allowlist client and server side. [ASSUMED]
- **Writing a new SQL shape unsupported by the fallback:** `LocalStorageBackend` and `IndexedDBBackend` intentionally share a tiny subset. Sort batches in JavaScript and use `SELECT *`, `INSERT OR REPLACE`, and primary-key `DELETE` only. [VERIFIED: app/src/services/db.service.ts; CLAUDE.md]
- **Changing an IndexedDB schema without its version:** object stores are only created/changed in `onupgradeneeded`; add the research stores through the existing versioned schema. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB]
- **Breaking Capacitor’s no-refresh state model:** research identity, pending count, and last upload state need event-bus-driven re-reads; Settings/Home are always mounted. [VERIFIED: CLAUDE.md; app/src/App.tsx]
- **Collapsing post exploration and logging into a new semantic event:** retain `CONCEPT_EXPLORED` for feed semantics and add logging as an observer/side effect; do not fork exploration behavior. [VERIFIED: CLAUDE.md; app/src/screens/PostDetailScreen.tsx]
- **Static cleanup that removes live shell infrastructure:** `GRAPH_UPDATED`, canonical anchoring, ChatInput, and daily-read lazy skip survive the product prune. [VERIFIED: docs/prune_report.md; CLAUDE.md]
- **CSV injection or HTML injection from question text:** escape CSV formula-leading values (`=`, `+`, `-`, `@`) and use escaped/text-only rendering in the admin page. [ASSUMED]

## State of the Art

| Old Approach | Current Phase-1 Approach | When Changed | Impact |
|--------------|--------------------------|--------------|--------|
| EchoLearn keys are migrated forward to `trellis_*` at boot | Do not migrate to `questiontrace_*`; old names are orphaned | Phase 1 locked decision | Remove migration/read/cleanup code that keeps old storage live. [VERIFIED: app/src/main.tsx; app/src/services/legacy-migration.service.ts; .planning/REQUIREMENTS.md] |
| Local-first app says no server receives data | Local-first durable records upload to a fixed research collector and remain recoverable offline | Phase 1 locked decision | Replace contradictory consent/privacy strings and do not reintroduce user-facing data controls. [VERIFIED: app/src/locales/en.json; .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md] |
| Generic event payload permits expansion | Narrow, validated event fields plus separate Q/A records | Phase 1 privacy decision | Prevent prohibited data from reaching local recovery/export/server paths. [VERIFIED: docs/research_system_design.md; .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md] |
| Browser online state is used as a simple signal | Online state schedules a retry, while HTTP ACK controls deletion | Current browser platform guidance | Makes the queue safe under captive portals and response-loss ambiguity. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event] |

**Deprecated/outdated:**

- `migrateLegacyKeys()` is incompatible with the no-migration requirement and should not remain on the research build boot path. [VERIFIED: app/src/main.tsx; .planning/REQUIREMENTS.md]
- Participant-accessible AI/data/dev settings, data clear/reset, graph reorganization, and gamification residue are outside the locked participant shell or pruned scope. [VERIFIED: .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md; docs/prune_report.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A single Cloudflare Worker + D1 is the simplest maintainable deployed collector for this study. | Summary / Standard Stack | A different approved hosting platform may be required; Worker project structure and deployment tasks would change. |
| A2 | The account-map table can be pre-provisioned privately and the Worker can resolve/validate account identity without a participant-facing account system. | Architecture Patterns | The researcher installation flow and ingest authorization model would need redesign. |
| A3 | A client-side SHA-256 PIN digest is adequate only as the requested local UI gate, while Worker Basic authentication is the server authorization boundary. | Security Domain | If the PIN must resist a participant with bundle access, a stronger operator-authenticated setup flow is needed. |
| A4 | A required opaque Phase-1 `topicId` can be supplied from study configuration before final topic-selection UI exists. | Open Questions / Study Context | No valid event can meet the required `topicId` field until the operator defines a temporary/study topic policy. |
| A5 | The current participant Q&A setup can be reconciled with D-04/D-12 without adding a general-purpose LLM backend. | Open Questions | If research deployments must remove user API-key setup while retaining live Q&A, a server-side constrained LLM proxy becomes a scope/credential decision. |
| A6 | CSV formula escaping and page output escaping are sufficient export-surface hardening for this minimal internal page. | Security Domain | Institutional or legal requirements may require an additional retention/access-control review. |

## Open Questions

1. **What exact opaque `topicId` should Phase-1 shell events carry before Phase 4 topic selection is implemented?**
   - What we know: `topicId` is mandatory on every logged event/record, while final study topics remain an identified project concern. [VERIFIED: .planning/REQUIREMENTS.md; .planning/STATE.md]
   - What's unclear: whether accounts are already associated with a pretest topic or whether a documented shell sentinel is permitted by the study protocol.
   - Recommendation: require a non-empty `topicId` in the private account-map provisioning input and use a clearly documented fixture value only in tests. Do not invent a production value in source. [ASSUMED]

2. **How will live post-scoped Q&A be credentialed in a participant installation after Settings is reduced?**
   - What we know: current post Q&A requires configured client provider settings, current onboarding exposes provider/API-key setup, D-04 reduces Settings to account ID/language, and Vite cannot safely conceal a client API key. [VERIFIED: app/src/services/post-context-qa.service.ts; app/src/screens/OnboardingScreen.tsx; .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md] [CITED: https://vite.dev/guide/env-and-mode]
   - What's unclear: whether participants continue to provide their own key during a researcher-led installation, a pre-existing secured proxy exists, or a narrow server-side Q&A proxy is authorized for this phase.
   - Recommendation: make this a planning checkpoint before removing the current onboarding step. Do not bundle an LLM key; keep this Phase 1 collector focused unless the operator explicitly authorizes the proxy scope. [ASSUMED]

3. **What is the authorized production host account/domain and private account-provisioning procedure?**
   - What we know: the phase requires one fixed deployed URL and a server-side password, but no current Worker configuration or deployment credentials are available in the repository/workstation. [VERIFIED: .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md; 2026-07-10 repository and command probes]
   - What's unclear: Cloudflare account ownership, final fixed URL, real D1 database binding, password provisioning, and how real numeric account mappings are injected without Git/history exposure.
   - Recommendation: plan a human deployment checkpoint using private host configuration and an out-of-repository operational runbook; tests use fixtures only. [ASSUMED]

4. **Is the researcher PIN intended only to conceal diagnostics from a participant, or to authenticate a researcher against an adversarial participant?**
   - What we know: D-10 explicitly calls it a gate for participant UI, while D-14 separately requires a server-only management password. [VERIFIED: .planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md]
   - What's unclear: the threat level expected for a PIN carried by a participant app bundle.
   - Recommendation: implement a non-destructive local gate now and document its limitation; escalate only if the study requires adversarial resistance. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | App and Worker tests/build | ✓ | 22.19.0 | — |
| npm | App/backend package install | ✓ | 11.16.0 | — |
| Git | Focused research/implementation commits | ✓ | 2.49.0.windows.1 | — |
| Docker | Optional local Worker/D1 exploration | ✓ | 28.3.3 | Native Wrangler local D1 when installed |
| SQLite CLI | Optional migration/query inspection | ✓ | 3.51.0 | D1 through Wrangler |
| Wrangler | Worker local dev, D1 migration, deploy | ✗ | — | Add approved/pinned `wrangler` dev dependency after human verification |
| Cloudflare account + D1 binding + deploy credentials | Fixed online collector and admin page | ✗ / not accessible | — | No deployment fallback; human-provided project credentials required |

**Missing dependencies with no fallback:**

- A Cloudflare account/project, D1 binding, server secrets, and deployment authority are required to fulfill D-13/D-14 with a real fixed online URL. [ASSUMED]

**Missing dependencies with fallback:**

- Global Wrangler is absent; use the backend package's locally pinned CLI after its required human verification checkpoint. [VERIFIED: 2026-07-10 local command probe; package legitimacy audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` with `assert/strict` |
| Config file | None; `app/package.json` runs `node --test $(find tests -name '*.test.mjs')` |
| Quick run command | `cd app && node --test tests/services/study-context.service.test.mjs tests/services/interaction-log.service.test.mjs tests/services/upload-queue.service.test.mjs` |
| Full suite command | `cd app && npm test && npm run lint && npm run build` |

The current project has locale parity tests and a persistence test seam, but some existing persistence tests are source-reading; new behavior must execute through `dbQuery` rather than assert implementation text. [VERIFIED: app/tests/locales/bundle-parity.test.mjs; app/tests/services/storage-migration.test.mjs; AGENTS.md; CLAUDE.md]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | All active user-visible app/native display surfaces use QuestionTrace; native bundle IDs remain exact | locale + source/native config regression plus `npx cap sync` inspection | `cd app && node --test tests/locales/bundle-parity.test.mjs tests/phase1/rebrand-surfaces.test.mjs` | ❌ Wave 0 |
| SHELL-02 | New DB/local/session keys use `questiontrace_*`; old keys are neither migrated nor read | behavioral persistence through `dbQuery` plus namespace scan | `cd app && node --test tests/services/storage-namespace.test.mjs` | ❌ Wave 0 |
| SHELL-03 | Bound identity exposes `control`/`experimental` app-wide and cannot be changed by participant flows | unit + hydration/event-bus test | `cd app && node --test tests/services/study-context.service.test.mjs` | ❌ Wave 0 |
| SHELL-04 | No live `app/src` dependency/export for pruned features remains | import/call-site negative regression plus TypeScript/lint | `cd app && node --test tests/phase1/pruned-residue.test.mjs && npm run lint` | ❌ Wave 0 |
| LOG-01 | Every allowed event is locally durable, prohibited fields are rejected, and queued records survive failures/duplicates until ACK | unit/integration with mocked `fetch` and `dbQuery` assertions | `cd app && node --test tests/services/interaction-log.service.test.mjs tests/services/upload-queue.service.test.mjs` | ❌ Wave 0 |
| RQ-01 | Event timeline provides sessions, returns, durations, opens, Q&A, suggestion, notification, and revisit measurements | unit fixture/export mapping test | `cd app && node --test tests/services/rq1-log-coverage.test.mjs` | ❌ Wave 0 |
| D-13–D-15 scope | Worker validates/acks, deduplicates, hides admin/export behind password, and produces two named CSV archive entries | backend unit + local Worker smoke | `cd research-backend && npm test` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** relevant focused Node tests plus `npm run lint` for app changes. [VERIFIED: AGENTS.md]
- **Per wave merge:** `cd app && npm test && npm run lint && npm run build`; `cd research-backend && npm test`. [ASSUMED]
- **Phase gate:** all automated gates green, `npx cap sync` succeeds after display-name changes, and manual browser/native UAT verifies IndexedDB persistence, offline queue recovery, app resume retry, protected admin page, archive contents, and no participant account/data controls. [VERIFIED: AGENTS.md; CLAUDE.md] [ASSUMED]

### Wave 0 Gaps

- [ ] `app/tests/services/study-context.service.test.mjs` — bind-once/condition/topic hydration, no public mutation path.
- [ ] `app/tests/services/interaction-log.service.test.mjs` — full event allowlist, required identity fields, privacy-field rejection, Q/A text separated from event records.
- [ ] `app/tests/services/upload-queue.service.test.mjs` — persist-before-fetch, retry retention, lost-response duplicate ACK, partial ACK, bounded batch, last-success metadata.
- [ ] `app/tests/services/rq1-log-coverage.test.mjs` — fixture timeline derives every RQ-01 measure without forbidden data.
- [ ] `app/tests/phase1/rebrand-surfaces.test.mjs` and `pruned-residue.test.mjs` — justified static assertions for native/config strings and forbidden source residue.
- [ ] `research-backend/test/*.test.mjs` — parser/validator, fake-D1 idempotency/revision behavior, Basic-auth route guard, CSV escaping, and two-file ZIP contents.
- [ ] A manual UAT checklist for Capacitor iOS/Android: install/bind once, go offline, produce records, kill/resume, regain network, verify queue drains and researcher export works.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Server-side management password for `/admin*`; no participant-facing researcher account system. [VERIFIED: CONTEXT D-14] |
| V3 Session Management | Yes, limited | HTTP Basic credentials are sent only to the HTTPS admin origin; participant uploads carry no server secret/cookie. [ASSUMED] |
| V4 Access Control | Yes | Keep researcher diagnostics unlinked/PIN-gated locally; Worker validates management auth before status/export and has no edit routes. [VERIFIED: CONTEXT D-10–D-15] |
| V5 Input Validation | Yes | Maximum request size/count, strict event/Q&A schemas, account whitelist, field allowlists, prepared D1 statements, and CSV/HTML output escaping. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] [ASSUMED] |
| V6 Cryptography | Yes | Worker secrets for real server values; browser Web Crypto SHA-256 only for the local PIN gate; never custom encryption. [CITED: https://developers.cloudflare.com/workers/configuration/secrets/] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User text injects SQL | Tampering | Parameter binding only; never interpolate a question/answer/account ID into SQL. [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/] |
| Request replay/lost response | Tampering / Repudiation | Stable event IDs, queue-envelope IDs, `INSERT OR IGNORE`, Q/A revision compare, ACK-only deletion. [ASSUMED] |
| Client submits another condition/topic | Tampering | Worker resolves condition/topic from the pre-created server account mapping and rejects unknown account IDs. [ASSUMED] |
| Secret shipped in app bundle | Information disclosure | Permit only non-secret Vite configuration; Worker secrets stay server-side. [CITED: https://vite.dev/guide/env-and-mode] [CITED: https://developers.cloudflare.com/workers/configuration/secrets/] |
| PIN bypass by inspecting client bundle | Elevation of privilege | Treat local PIN as convenience/privacy gate; do not grant it server access or account mutation powers. [ASSUMED] |
| CSV formula execution | Tampering / Information disclosure | Escape formula-leading cells and serve as attachment; test `=`, `+`, `-`, `@` inputs. [ASSUMED] |
| Research page renders question text as HTML | Tampering | Escape output/use text nodes, set `Content-Type: text/html; charset=utf-8`, and never inject raw record text into HTML. [ASSUMED] |
| Excessive/malformed public ingest | Denial of service | Bounded body/record count, strict content type, schema rejection, and no expensive work before validation. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- `app/src/services/db.service.ts`, `app/src/App.tsx`, `app/src/services/settings.service.ts`, `app/src/screens/PostDetailScreen.tsx` — existing persistence/hydration/UI integration seams. [VERIFIED: codebase inspection]
- `.planning/phases/01-rebrand-research-shell-hardening/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `CLAUDE.md`, `AGENTS.md`, `docs/research_system_design.md`, and `docs/prune_report.md` — locked scope, research constraints, logging/privacy contract, and retained/pruned boundaries. [VERIFIED: repository authority documents]

### Secondary (MEDIUM confidence)

- [Cloudflare D1 Worker Binding API](https://developers.cloudflare.com/d1/worker-api/d1-database/) — environment binding, prepared statements, batches, and transactional behavior.
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/) — server-only secret binding/configuration.
- [Vite environment variables](https://vite.dev/guide/env-and-mode) — `VITE_*` client exposure and secret prohibition.
- [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) — version upgrades and object-store schema changes.
- [MDN: `online` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event) and [Navigator `onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) — retry-trigger limitation.
- [MDN: `SubtleCrypto.digest`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) — browser SHA-256 primitive.
- [fflate project documentation](https://github.com/101arrowz/fflate) — multi-file ZIP generation.

### Tertiary (LOW confidence)

- Architecture choices marked `[ASSUMED]`: hosting suitability, account-map resolution details, PIN threat boundary, batch cap, and export hardening policy require execution-time/operator confirmation.

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM — the existing app seams and official Worker/D1/Vite documentation were verified; the hosting choice is an implementation recommendation. [VERIFIED: codebase inspection] [CITED: https://developers.cloudflare.com/d1/worker-api/d1-database/]
- Architecture: MEDIUM — durable queue and account-map patterns are technically specified, but actual host/account setup and the pre-Phase-4 topic policy are unresolved. [ASSUMED]
- Pitfalls: MEDIUM — storage/event-bus/native invariants are codebase verified and browser retry/secret constraints are officially documented; server threat controls are recommendations. [VERIFIED: CLAUDE.md] [CITED: https://vite.dev/guide/env-and-mode]

**Research date:** 2026-07-10
**Valid until:** 2026-07-17 for npm/Cloudflare tooling versions; 2026-08-09 for repository architecture findings.
