# Phase 2: Content pool + feed/post UI on frozen data - Research

**Researched:** 2026-07-11
**Domain:** Offline content curation, immutable frozen-pool packaging, IndexedDB import, real-content feed/post UI, and post-scoped Q&A
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

<!-- DATA_8F2C4A7D_START -->
### Pilot topic & sources
- **D-01:** The pilot pool topic is **AI agents & future work** (RSD §6.3 candidate #1 — the design doc's running example for suggested questions, prompts, and orchestration strategies).
- **D-02:** Source mix is **text-heavy + some video**: roughly 70% articles/blog/Substack/newsletter/news-explainer content, 30% YouTube — enough video to exercise embeds and `video_progress` logging without doubling the extraction surface.
- **D-03:** Content skews **mostly evergreen** (explainers, concept pieces, viewpoint essays that stay valid for months; few dated news items) so the frozen pool survives the pilot→main-study gap without recollection.
- **D-04:** Collect **~100–150 raw candidates** (2–3× the ~50 approval target) — enough slack for dedupe/quality rejection while keeping review effort bounded.

### Original content display
- **D-05:** Originals are **embedded in-app**: YouTube via embedded player; articles rendered in-app from extracted text stored in the frozen pool. The original source link is always displayed (and `source_click` logged). No click-out-only posts.
- **D-06:** The frozen pool stores **full extracted article text** (not excerpts) — offline-safe reading and best Ask grounding; source attribution always displayed. Acceptable exposure for a small non-public research instrument.
- **D-07:** **Frozen approved content is canonical.** Articles store full text. Videos store the fixed public YouTube URL/ID and approved derived digest, never transcript/audio/video; unavailable/offline playback falls back to the digest/summary and source link. No mid-study pool edits.
- **D-08:** The pool **ships bundled inside the app build** (pool JSON + thumbnails), imported into IndexedDB on first launch. Fully offline from install; `contentPoolVersion` is pinned to the installed build — consistent with the Phase 1 in-person install protocol.

### Curation & review workflow
- **D-09:** Raw collection is a **curated URL list + fetcher script**: articles are fetched/extracted; videos retain validated public YouTube URL/ID and metadata for Gemini's official video-understanding input. No transcript/audio/video download and no scraping-API collector.
- **D-10:** AI preprocessing uses pinned `gemini-3.1-flash-lite` for YouTube URLs and the configured structured provider for articles; the initially preferred 2.5 Flash-Lite was rejected by the API as unavailable to new users. The generated wrapper/digest is reviewed and frozen; concurrency-1 resume supports spreading preparation across daily free-tier quotas.
- **D-11:** Review is **two-gate**: (1) **Codex (AI) reviews factual reliability and hook/summary faithfulness** as a first gate inside the pipeline; (2) **the operator is the second and final gate**, confirming each post is good to read. Human approval remains the gate of record per RSD §8.7 — nothing enters the frozen pool without operator sign-off.
- **D-12:** The human-review gate is a **tiny local-only review web page** (never deployed) that renders each candidate — hook, summary, tags, suggested questions, original text, Codex gate-1 verdict — with approve/reject/edit controls writing review JSON.
<!-- DATA_8F2C4A7D_END -->

### the agent's Discretion

<!-- DATA_5B9E1D3C_START -->
- Feed ordering before Phase 3 rankers exist (e.g., curated order, seeded shuffle, spread rules) — must be non-personal and identical logic for both conditions.
- How the old AI-post generation pipeline (concept-feed/post-queue/style-assignment shell) is retired vs kept dormant for Phase 3 reuse — respect the CLAUDE.md three-list invariants while it lives; don't break Phase 3's ranker insertion point.
- Ask panel grounding mechanics (how much post text enters the prompt), suggested-question presentation, saved/not-interested control wiring, thumbnail/typography details.
- Pipeline internals: dedupe mechanics, quality-scoring thresholds, exact Codex gate-1 invocation, freeze/export tooling, fetcher libraries.
- Fallbacks and error states not covered by D-07.
<!-- DATA_5B9E1D3C_END -->

### Deferred Ideas (OUT OF SCOPE)

<!-- DATA_C73A0E94_START -->
- Second and third study topics + their pools — Phase 2 scales the pipeline but only freezes the pilot topic; remaining topics land before the main study (Phase 4 window).
- Personalized suggested questions for the experimental condition (RSD §7.5) — Phase 3, alongside the rankers.
- Recommendation reasons / exploration-path chips — Phase 3 (§7.7).
- Notification cadence and study-task pages — Phase 4.
<!-- DATA_C73A0E94_END -->
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | Domain schemas — Topic, Post, Concept, Claim, SuggestedQuestion (+ UserQuestion, AIAnswer, Recommendation, UserConceptState) match RSD §9 field-for-field. | Exact domain-type ownership, auxiliary source-asset separation, JSON Schema validation, and schema-drift tests. |
| CONT-02 | Content curation pipeline in `tools/content_pipeline/` — collectors, AI preprocessing (summary, concept tags, claims, stance, difficulty, suggested questions), dedupe, quality scoring, human-review gate, exporters. Ingests 400–800 raw candidates per topic → human-approved posts (RSD §8, §17.1). | Resumable stage architecture that processes the locked 100–150-item pilot and scales to the final 400–800-candidate workflow without changing contracts. |
| CONT-03 | Frozen pool export to `data/content_pool_v1/` — one pilot topic (~50 approved posts) before scaling to 200–400; versioned (`contentPoolVersion`) and immutable once frozen (RSD §8.8). | Staging-to-freeze export, checksum manifest, overwrite refusal, runtime projection, pinned first-launch import, and mismatch behavior. |
| FEED-01 | Feed card + post detail rendering the frozen pool, replacing the temporary AI-generated feed shell entirely — feed card (§7.2), post detail with AI wrapper (hook, summary, concept tags) + original source embed/link (§7.3, §7.4). No live search or arbitrary content fetch in the participant app. | Atomic cutover behind a new feed facade, real-content components, bundled article text/video digest, fixed-URL YouTube playback/Ask exceptions, and old-shell removal map. |
| FEED-02 | Pre-generated suggested questions on post detail carrying type, target concepts/claims, and generic flag per the SuggestedQuestion schema (§7.5, §9.5). | Exact suggested-question lookup/render/click flow and schema-backed persistence tests. |
| ASK-01 | Post-scoped Ask (both conditions) — contextual AI Q&A scoped to the current post (no global chat), identical quality for control and experimental; UserQuestion + AIAnswer persisted (§6.6, §7.6). | Condition-neutral Q&A coordinator, existing security filter/provider chokepoints, canonical entity persistence, upload projection, and parity tests. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Treat `docs/research_system_design.md` as the canonical implementation guide and `docs/SCOPE.md` as the fixed scope boundary; never resurrect §15.3-pruned features. [VERIFIED: AGENTS.md; docs/research_system_design.md; docs/SCOPE.md]
- Read and preserve the load-bearing `CLAUDE.md` rules for the feed pipeline, data layer, question filter, navigation shell, headers, event bus, gestures, and four-locale parity. [VERIFIED: AGENTS.md; CLAUDE.md]
- Keep app work in `app/src`, using React functional components, one-responsibility services, project naming conventions, and surrounding inline-style/CSS-variable patterns. [VERIFIED: AGENTS.md]
- Run app commands from `app/`; production gates are tests, lint, and build, with `npx cap sync` plus device UAT when native packaged assets change. [VERIFIED: AGENTS.md; CLAUDE.md]
- Use Node's `node:test` + `assert/strict`; prefer executed behavior over source-reading assertions, verify durability through `dbQuery`, mock all network/AI calls, and never hit live AI services in tests. [VERIFIED: AGENTS.md; CLAUDE.md]
- Preserve the user's dirty worktree, keep changes focused, and align documentation/roadmap artifacts when behavior ships. OpenSpec and Trellis planning history are not live state. [VERIFIED: AGENTS.md]

## Summary

Phase 2 should be planned as two systems joined by one frozen contract: an operator-only, offline Node pipeline that creates an immutable research artifact, and a participant runtime that can only read the approved artifact. The pipeline owns acquisition, extraction, preprocessing, dedupe, quality checks, Codex gate 1, operator gate 2, and freeze/export. The app owns build-bundled import, IndexedDB indexes, non-personal feed delivery, source rendering, suggested questions, and post-scoped Q&A. No collector, live search, remote thumbnail, article fetch, preprocessing call, or mutable review state belongs in the participant bundle. [VERIFIED: 02-CONTEXT.md D-05–D-12; docs/research_system_design.md §8; docs/SCOPE.md]

The current app cannot be incrementally “repointed” by swapping only a data call. `HomeScreen`, `MasonryFeed`/`InfoFlow`, `PostDetailScreen`, `concept-feed.service`, `post-queue.service`, `post-history.service`, `engagement.service`, and `session.service` all encode the generated `DailyPost`/question-anchor model. The safe cutover is: introduce exact RSD domain types and a frozen-pool repository; add a small feed facade that emits `Post` IDs; convert Home/PostDetail/Saved/engagement/Q&A consumers; then remove the transitional generator, queue, styles, starter/connection/suggestion posts, on-open essay/image generation, and their obsolete tests in one call-site-audited wave. [VERIFIED: app/src/screens/HomeScreen.tsx; app/src/screens/PostDetailScreen.tsx; app/src/components/InfoFlow.tsx; app/src/components/MasonryFeed.tsx; app/src/services/concept-feed.service.ts; app/src/services/post-queue.service.ts]

The Q&A cutover is equally important. Today the UI writes a `ChatSession` and a Phase 1 `QuestionAnswerRecord`; it does not persist RSD `UserQuestion` and `AIAnswer` entities, does not pass the persisted thread into answer generation, and bypasses the load-bearing question filter. Phase 2 should make a post-Q&A repository the canonical source, retain `QuestionAnswerRecord` only as a derived upload/export DTO, route every submitted turn through `evaluateQuestion` and the existing provider chokepoint, and build the same prompt/model path for both conditions. [VERIFIED: app/src/screens/PostDetailScreen.tsx:451; app/src/services/session.service.ts; app/src/services/post-context-qa.service.ts; app/src/services/interaction-log.service.ts; CLAUDE.md question-filter rules]

**Primary recommendation:** freeze a checksum-addressed `data/content_pool_v1/`, import its approved runtime projection before participant routes render, serve a deterministic manifest order through a Phase-3-replaceable feed facade, and make RSD `UserQuestion`/`AIAnswer` stores—not UI sessions—the source of truth for Ask. [VERIFIED: 02-CONTEXT.md; docs/research_system_design.md §8.8, §9, §17.3]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Curated URL acquisition and source extraction | Offline Tooling | Local Filesystem | Collection is operator-run before freezing and must never be imported by participant code. [VERIFIED: 02-CONTEXT.md D-09; docs/SCOPE.md] |
| AI preprocessing, dedupe, quality checks, Codex review | Offline Tooling | External LLM/CLI | These stages transform untrusted source material into review candidates; their outputs are not approved content until the human gate. [VERIFIED: 02-CONTEXT.md D-10–D-11] |
| Human review page and review decisions | Local Browser/Tool | Local Filesystem | A loopback-only page presents candidates and writes revisioned review JSON; it is never deployed. [VERIFIED: 02-CONTEXT.md D-12] |
| Immutable freeze, checksums, and runtime bundle projection | Offline Tooling | CDN / Static Build Assets | The exporter is the only writer of `content_pool_v1`; Vite/Capacitor only package its approved projection. [VERIFIED: 02-CONTEXT.md D-08; docs/research_system_design.md §8.8] |
| First-launch import and content indexes | Database / Storage | Browser / Client | IndexedDB durably owns installed pool rows; an in-memory repository supplies synchronous UI reads after awaited hydration. [VERIFIED: app/src/services/db.service.ts; app/src/App.tsx] |
| Baseline feed ordering and batching | Browser / Client | Database / Storage | Phase 2 uses manifest order and local seen/dismissed IDs only; Phase 3 replaces the facade with rankers. [VERIFIED: 02-CONTEXT.md discretion; .planning/ROADMAP.md Phase 3] |
| Feed card, article reader, video/digest fallback, suggested questions | Browser / Client | Static Build Assets / YouTube | UI renders approved local data; the selected YouTube embed streams externally, with frozen digest/summary fallback. [VERIFIED: 02-CONTEXT.md D-05–D-08] |
| Post-scoped Ask | Browser / Client | External LLM API | The client supplies approved post context and thread history through the existing provider chokepoint; no app backend performs answer generation. [VERIFIED: app/src/providers/llm/index.ts; app/src/services/post-context-qa.service.ts] |
| UserQuestion/AIAnswer durability and research upload | Database / Storage | API / Backend | Canonical entities persist locally first; a derived revisioned DTO uses the Phase 1 at-least-once upload/export path. [VERIFIED: app/src/services/interaction-log.service.ts; app/src/services/upload-queue.service.ts; research-backend/src/worker.ts] |

## Current Codebase Findings

### Load-bearing seams to retain

- `db.service.ts` is the single IndexedDB/Node-fallback seam. New object stores require an `IDB_VERSION` bump; adding DDL names without increasing the current version `2` will not create stores in an existing installation. [VERIFIED: app/src/services/db.service.ts]
- `App.tsx` already gates participant rendering on awaited hydration. Replace old feed/queue hydration with content-pool and post-Q&A hydration here; do not import the pool asynchronously after Home mounts. [VERIFIED: app/src/App.tsx:248]
- `Header.tsx` must keep its in-tree top-level versus body-portal sub-screen split. PostDetail remains an Outlet sub-screen and must not gain a transformed/filter/contained header ancestor. [VERIFIED: CLAUDE.md; app/src/components/ui/Header.tsx]
- PostDetail's 70%-scroll, 30-second-dwell, and follow-up-submit detectors are the canonical `CONCEPT_EXPLORED` emit site. Extend that event payload for frozen `postId`/`conceptIds`; do not add a parallel exploration event. [VERIFIED: CLAUDE.md; app/src/screens/PostDetailScreen.tsx:140]
- `question-filter.service.ts` implements the security-critical raw-only malicious argmax and contextual benign split. Post-scoped Ask currently does not call it; Phase 2 must integrate it without altering the raw/context separation. [VERIFIED: CLAUDE.md; app/src/services/question-filter.service.ts; app/src/services/post-context-qa.service.ts]
- `providers/llm/index.ts` centrally applies locale directives and structural user-content bracketing to both completion and stream calls. New Q&A and preprocessing code must not duplicate or bypass the participant-side chokepoint. [VERIFIED: app/src/providers/llm/index.ts; app/tests/providers/llm-bracketing.test.mjs]
- `interaction-log.service.ts`, `upload-queue.service.ts`, and the Worker already enforce field allowlists, local-first persistence, bounded batches, server-owned condition/topic, monotonic Q/A revisions, and two-CSV export. Phase 2 must evolve this contract instead of creating a second uploader. [VERIFIED: app/src/services/interaction-log.service.ts; app/src/services/upload-queue.service.ts; research-backend/src/validation.ts; research-backend/src/export.ts]

### Transitional code to replace

| Current owner | Current coupling | Phase 2 disposition |
|---------------|------------------|---------------------|
| `DailyPost`, `PostSnapshot`, presentation styles | Generated essay fields, anchor question IDs, AI origin, text-art/image/suggestion variants | Replace UI/runtime use with exact RSD `Post`; retain no compatibility fields on `Post`. [VERIFIED: app/src/types/index.ts] |
| `concept-feed.service.ts` | Generates/caches starter, concept, connection, discover, and suggestion posts | Remove after all readers switch; do not preserve it as the Phase 3 insertion point. [VERIFIED: app/src/services/concept-feed.service.ts; docs/SCOPE.md] |
| `post-queue.service.ts` + `infiniteScroll.service.ts` | Three-list cyclic AI generation queue and day rollover | Replace with a small ordered-ID feed facade; preserve old invariants until the atomic switch, then delete dead callers/tests. [VERIFIED: CLAUDE.md; app/src/services/post-queue.service.ts] |
| `InfoFlow`/`MasonryFeed` concept tiles | AI images/text-art and `sourceQuestionIds[0]` as concept/anchor identity | Replace leaf cards with real-content `FeedCard`; the two-column shell may be reused only if it fits RSD metadata and accessibility. [VERIFIED: app/src/components/InfoFlow.tsx; app/src/components/MasonryFeed.tsx] |
| `PostDetailScreen` essay generation | On-open generated body, deep-dive variant, generated image carousel, question-anchor resolution | Remove generation/deep-dive/image paths; render stored original asset plus wrapper, source, concepts, suggestions, and Q&A. [VERIFIED: app/src/screens/PostDetailScreen.tsx] |
| `post-history.service.ts` | Durable full `DailyPost` snapshots | Store viewed post IDs/timestamps; resolve immutable content through the pool repository. [VERIFIED: app/src/services/post-history.service.ts] |
| `engagement.service.ts` | Saved/liked post IDs and dismissed anchor IDs | Resolve saved IDs through the pool; change not-interested to post IDs so one action does not hide every post sharing a concept. [VERIFIED: app/src/services/engagement.service.ts; RSD §7.3] |
| `session.service.ts` | Duplicated post-thread UI messages and generated-post origin context | Retire for post Q&A or reduce to a derived view; canonical persistence moves to UserQuestion/AIAnswer. [VERIFIED: app/src/services/session.service.ts] |

## Standard Stack

### Core

| Library / platform | Version | Purpose | Why standard here |
|--------------------|---------|---------|-------------------|
| Existing React / TypeScript / Vite / Capacitor | React 19.2.6; TypeScript 5.9.3; Vite 7.3.1; Capacitor 8.3.3 | Participant UI, build, and native packaging | Already installed and build-verified; no framework migration is needed. [VERIFIED: app/package.json; `npm run build` 2026-07-11] |
| Existing IndexedDB seam | local `db.service.ts`, DB version 2 before Phase 2 | Pool, engagement, viewed-post, question, and answer persistence | Preserves the required `dbQuery` test boundary and boot hydration pattern. [VERIFIED: app/src/services/db.service.ts; AGENTS.md] |
| Node.js built-ins | Node 22.19.0 | Pipeline CLI, fetch, filesystem, HTTP loopback server, SHA-256, tests | Available on the target machine and sufficient for orchestration without a general pipeline framework. [VERIFIED: environment probe 2026-07-11] |
| `@mozilla/readability` | 0.6.0; published 2025-03-03 | Extract article body/title/byline/text | Mozilla documents Node use with a DOM implementation and source URL resolution. [CITED: https://github.com/mozilla/readability] [VERIFIED: npm registry] |
| `jsdom` | 29.1.1; published 2026-04-30 | Safe, script-disabled DOM for Readability | Official project supports Node DOM parsing; installed Node satisfies its engine range. [CITED: https://github.com/jsdom/jsdom] [VERIFIED: npm registry] |
| `ajv` | 8.20.0; published 2026-04-24 | Strict JSON Schema validation for every stage and frozen export | Strict schemas catch unknown/missing fields before content reaches review or the app. [CITED: https://ajv.js.org/strict-mode] [VERIFIED: npm registry] |
| `yt-dlp` | 2026.06.09 official release | Extract YouTube info JSON, thumbnails, manual/automatic subtitles without video download | Official CLI exposes `--skip-download`, subtitle, auto-subtitle, and metadata options. [CITED: https://github.com/yt-dlp/yt-dlp/blob/master/README.md] |

### Supporting

| Library / tool | Version | Purpose | When to use |
|----------------|---------|---------|-------------|
| `fake-indexeddb` | 6.2.5; published 2025-11-07 | Execute IndexedDB upgrade/import/idempotency tests in Node | Dev-only app dependency; replaces source-reading persistence assertions. [CITED: https://www.npmjs.com/package/fake-indexeddb] [VERIFIED: npm registry] |
| Existing `rehype-sanitize` path | 6.0.0 | Sanitize Markdown/HTML already rendered by `Markdown.tsx` | Continue for AI answers/summaries; render original article blocks as React text nodes, not `innerHTML`. [VERIFIED: app/src/components/Markdown.tsx; app/package.json] |
| `codex` CLI | 0.144.1 | Locked AI review gate 1 | Invoke read-only against candidate JSON/source text and require schema-valid verdict output. [VERIFIED: environment probe; 02-CONTEXT.md D-11] |
| Claude Code / configured top-tier API | Claude Code 2.1.206 installed; API/model credentials unverified | Preprocessing model option | Keep provider/model explicit and record the exact value in the manifest; never hardcode a “latest” alias. [VERIFIED: environment probe; 02-CONTEXT.md D-10] |
| Node `crypto` | platform built-in | Stable IDs and SHA-256 file manifest | Avoids a hashing dependency and records byte-level freeze integrity. [VERIFIED: Node 22 runtime] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Readability + jsdom | Site-specific scrapers | Per-site selectors are brittle and expand the collection surface; keep optional source adapters only for explicit extraction failures. [CITED: https://github.com/mozilla/readability] |
| Plain safe content blocks | Persist sanitized article HTML | HTML preserves more structure but creates a second sanitizer/CSP contract in the participant runtime. The locked requirement is full extracted text, so text blocks are safer. [VERIFIED: 02-CONTEXT.md D-06; app/src/components/Markdown.tsx] |
| Raw HTTPS/CLI adapter for preprocessing | `@anthropic-ai/sdk` | The official SDK was evaluated but its newest publish was flagged `SUS: too-new` by the repository legitimacy seam; no SDK is required for one offline structured-output call path. [VERIFIED: package-legitimacy probe 2026-07-11] |
| Manifest-curated order | Runtime seeded shuffle | Shuffle is non-personal but makes feed reproductions harder; a frozen order can be source/concept/format-spread during export and is easiest to audit before Phase 3. [VERIFIED: 02-CONTEXT.md discretion; RSD §8.8] |
| New feed framework | Small `feedService` facade | Phase 2 needs ordered batching, seen/dismissed filtering, and a later ranker seam—not another queue/generation subsystem. [VERIFIED: .planning/ROADMAP.md Phases 2–3] |

**Installation:**

```bash
cd tools/content_pipeline
npm install @mozilla/readability@0.6.0 jsdom@29.1.1 ajv@8.20.0

cd ../../app
npm install --save-dev fake-indexeddb@6.2.5
```

Install the pinned official `yt-dlp` binary separately and verify its published checksum before running video collection; do not auto-download it from a pipeline script. [CITED: https://github.com/yt-dlp/yt-dlp/releases]

## Package Legitimacy Audit

| Package | Registry | Published / activity | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|-----------|-------------|---------|-------------|
| `@mozilla/readability` | npm | Current 0.6.0 published 2025-03-03 | 2,364,716/week at probe | `github.com/mozilla/readability` | OK | Approved; official Mozilla docs confirm the package and no postinstall script exists. [VERIFIED: npm registry; legitimacy seam] |
| `jsdom` | npm | Current 29.1.1 published 2026-04-30 | 76,379,475/week at probe | `github.com/jsdom/jsdom` | OK | Approved; official repo confirmed and no postinstall script exists. [VERIFIED: npm registry; legitimacy seam] |
| `ajv` | npm | Current 8.20.0 published 2026-04-24 | 320,546,358/week at probe | `github.com/ajv-validator/ajv` | OK | Approved; official docs confirmed and no postinstall script exists. [VERIFIED: npm registry; legitimacy seam] |
| `fake-indexeddb` | npm | Current 6.2.5 published 2025-11-07 | 3,886,688/week at probe | `github.com/dumbmatter/fakeIndexedDB` | OK | Approved dev-only dependency; no postinstall script exists. [VERIFIED: npm registry; legitimacy seam] |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** none among selected packages. `@anthropic-ai/sdk` was evaluated but not selected, so no install checkpoint is needed. [VERIFIED: package-legitimacy probe]

## Architecture Patterns

### Recommended system boundary

```text
Operator workstation (network allowed)                 Participant app runtime
┌───────────────────────────────────────────┐          ┌──────────────────────────┐
│ URL seeds                                │          │ bundled pool manifest    │
│   → collect/extract/transcribe           │          │   → validate/checksum    │
│   → normalize/deduplicate                │ freeze   │   → versioned IDB import │
│   → mechanical quality checks            ├─────────►│   → content repository   │
│   → read-only Codex relevance gate       │ bundle   │   → fixed feed facade    │
│   → human accept/reject review           │          │   → feed/post/Q&A UI     │
│   → immutable export + checksums         │          │                          │
└───────────────────────────────────────────┘          └──────────────────────────┘
      Untrusted source data stays here                    No live content fetch
```

[VERIFIED: locked context D-01 through D-05, RSD §§6 and 9] Treat these as two systems joined only by a versioned, immutable artifact. Pipeline conveniences, credentials, raw source captures, rejection notes, and model prompts must not enter the participant bundle.

### Recommended project structure

```text
tools/content_pipeline/
  src/{collect,extract,normalize,dedupe,quality,codex-gate,review,freeze}/
  schemas/                         # source/intermediate/review schemas
  test/fixtures/                   # malicious, malformed, duplicate fixtures

data/content_pool_v1/
  manifest.json                    # versions, order, checksums, counts
  posts.json                       # exact participant Post records
  concepts.json
  claims.json
  suggested_questions.json
  source_files/                    # full article text or reviewed video digest by postId

app/src/
  domain/content.types.ts          # exact RSD §9 participant types
  services/content-pool.repository.ts
  services/frozen-feed.service.ts  # sole Phase 3 insertion point
  services/post-qa.service.ts
  screens/{Home,PostDetail}.tsx
```

[VERIFIED: AGENTS.md planned paths; RSD §9; current app organization] Exact filenames may follow nearby conventions, but the ownership boundary should remain explicit: pipeline types may be richer than participant domain types, and conversion happens once at freeze/export.

### Pattern 1: exact domain records plus separate source assets

[VERIFIED: RSD §9] Define `Post`, `Concept`, `Claim`, `SuggestedQuestion`, `UserQuestion`, `AIAnswer`, `UserInteractionEvent`, and related enums field-for-field. Do not add extracted article HTML, transcript blocks, thumbnails, collector state, or review metadata to `Post`. Represent approved auxiliary material in a separate `OriginalContentAsset`-style runtime record keyed by `postId`; keep pipeline-only details outside the bundle.

### Pattern 2: validate, stage, then expose

[VERIFIED: current IndexedDB adapter behavior] Parse and schema-validate the complete frozen bundle in memory before writes. Mark the import version as `importing`, clear/retry that version idempotently, write its records, verify counts/checksums, then mark it `ready`. The current SQL compatibility layer's `BEGIN`/`COMMIT` operations are no-ops over IndexedDB, so a transaction-shaped call sequence is not an atomicity guarantee.

### Pattern 3: one feed facade

[VERIFIED: current generated-feed coupling; locked context D-04 and D-08] Route Home, PostDetail, Saved references, navigation targets, and later Phase 3 selection through one frozen-feed facade. During cutover, preserve the old three-list queue invariants until every callsite has switched; then remove the generator stack atomically instead of bypassing one list at a time.

The Phase 2 facade should return the manifest's deterministic `feedOrderPostIds`, with source/concept/format spread established offline. Both study conditions receive the same order and records. Phase 3 can later replace the selection implementation without changing feed and post components.

### Pattern 4: canonical post-scoped Q&A

[VERIFIED: RSD §9; locked context D-06 through D-08] A submission creates a canonical `UserQuestion`; its result creates a canonical `AIAnswer`, both scoped to the current post and participant. Suggested-question clicks set `source: "suggested"` and `suggestedQuestionId`; typed questions set `source: "user"`. Thread context is loaded only from prior same-post canonical records.

Keep the Phase 1 `QuestionAnswerRecord` only as a derived, revisioned upload/export projection if the two-CSV research backend still requires it. Do not let `ChatSession` remain the source of truth.

### Anti-patterns to reject during planning

- [VERIFIED: scope and prune report] Reintroducing starter collections, social/community features, semantic search, gamification, personalized ranking, graph UI, or deleted Trellis product flows.
- [VERIFIED: locked context D-05] Fetching article bodies, search results, thumbnails, transcripts, or arbitrary preprocessing output in participant runtime. The only media input is the open frozen post's exact YouTube URL sent to Gemini after filtering.
- [VERIFIED: RSD §9] Expanding canonical domain records to absorb pipeline convenience fields.
- [VERIFIED: current persistence implementation] Claiming cross-store transactional import through the SQL shim.
- [VERIFIED: current security-critical filter] Calling the answer model before malicious-input rejection, persisting malicious raw input, or moving provider calls outside the existing centralized bracketing.
- [VERIFIED: locked context D-08] Branching answer prompt, model, feed order, or content by study condition in Phase 2.

## Component Responsibilities

| Component | Owns | Must not own |
|-----------|------|--------------|
| Offline collector | Bounded HTTP acquisition, redirects, MIME/size/time checks, raw capture | Participant runtime behavior or acceptance decisions |
| Extractors | Article readability extraction; validated YouTube URL/ID metadata | Executable HTML, transcript/media download, arbitrary embeds, final approval |
| Normalizer/deduper | Canonical URLs, stable hashes, exact and near-duplicate groups | Subjective educational judgment |
| Mechanical quality gate | Required fields, length/language/readability/source checks | Automatic final acceptance |
| Codex gate | Read-only rubric verdict over delimited untrusted content | Filesystem writes, shell execution, network collection, final acceptance |
| Human review UI | Accept/reject decisions, reason capture, local progress | Internet exposure, participant bundle generation without validation |
| Freezer | Exact RSD projection, versions, counts, checksums, immutable promotion | Overwriting an existing pool version |
| Pool importer | Whole-bundle validation, versioned/idempotent IDB installation | Live fetch or partial pool exposure |
| Content repository | Typed reads of ready version records and source assets | Ordering policy or AI calls |
| Frozen feed facade | Manifest order and stable feed/post projections | Condition-specific ranking or generated posts |
| Post Q&A service | Filter, grounding selection, same-post thread, canonical persistence | Feed mutation, cross-post context, condition-specific answers |
| Feed/Post UI | Card/detail rendering, suggestions, transcript/source affordances | Data acquisition, schema conversion, prompt construction |

[VERIFIED: locked context, RSD, and current code seams] This ownership map minimizes the number of places that understand both pipeline and runtime representations. The freezer is the only conversion boundary; the feed facade is the only ordering boundary; the Q&A service is the only answer boundary.

## Frozen Pool Contract

### Participant schema

[VERIFIED: CONT-01 and RSD §9] Make a single checked-in TypeScript definition set and matching JSON Schemas the contract. The build and pipeline tests must compare fixtures against required keys, enums, nullability, and cross-record references. Avoid parallel hand-maintained “almost the same” types in pipeline and app packages; derive or explicitly map to the participant schema at export.

The runtime bundle needs at least:

- exact canonical arrays for posts, concepts, claims, and suggested questions;
- approved auxiliary article text/blocks or video URL/ID + derived digest records keyed by `postId`;
- a manifest containing `contentPoolVersion`, schema version, prompt version, collector/extractor versions, model identifiers, record counts, per-file SHA-256 checksums, `feedOrderPostIds`, and review summary;
- no raw captures, rejected candidates, review notes, credentials, or hidden model reasoning.

[RECOMMENDATION: derived from D-03/D-04 and CONT-03] Treat manifest order as part of the frozen experimental input. Compute source, concept, and format spread before freeze; reject missing or duplicate post IDs and records not reachable from the manifest.

### Immutable/versioned packaging

[RECOMMENDATION: derived from CONT-03] Build into a fresh staging directory, validate every output and reference, calculate checksums only after serialization is final, then atomically rename staging to `data/content_pool_vN`. Refuse if the destination exists. Corrections create `vN+1`; never edit a frozen directory in place.

Use deterministic serialization where practical so equivalent inputs produce equivalent hashes. Stable identifiers should be derived from normalized URL and/or normalized approved content with SHA-256, not model scores or array position. Record the exact tool and prompt versions so a pool can be audited even when upstream pages change.

### Offline pipeline sequence

1. Ingest the operator's URL seed list and assign a run ID.
2. Collect under strict protocol, destination, redirect, MIME, size, and timeout policies.
3. Extract articles with Readability in a resource-disabled jsdom; validate YouTube URL/ID and let Gemini read the public video through its official URL media input.
4. Normalize text and URLs; calculate content hashes.
5. Group exact and conservative near duplicates.
6. Apply mechanical completeness and quality rules.
7. Send delimited text to a read-only Codex rubric gate and require schema-valid JSON.
8. Present all surviving candidates to the loopback-only human review UI; final accept/reject belongs to the operator.
9. Project accepted candidates to exact runtime types, generate suggestions and the deterministic order, validate, checksum, and freeze.
10. Produce an audit summary without shipping sensitive or rejected material.

[VERIFIED: locked context D-01 through D-03] The supplied pilot list is expected to contain roughly 100–150 URLs for about 50 final posts, while contracts should not impose a low ceiling that prevents the RSD target of 400–800 candidates and 200–400 final posts.

### Runtime import and acquisition rules

[VERIFIED: D-05 and current app storage] Import must complete before participant routing renders the feed. A ready marker binds the active pool version to its verified checksums. Missing, malformed, partially imported, or unexpected versions fail closed with an operator-visible diagnostic; do not silently merge versions or fall back to generated posts.

The participant runtime performs no remote article, thumbnail, transcript, or search fetch. Network use remains limited to a user-triggered Ask request (including Gemini reading only the open frozen video's exact URL), research-data upload, an explicit original-source link, and selected YouTube playback. The frozen reviewed digest/summary remains visible when playback or live understanding is unavailable.

[VERIFIED: current fallback backend] The localStorage fallback is not a credible store for a full pool and currently can hide quota pressure. Tests must cover real IndexedDB behavior; if the app is forced onto the fallback or import quota fails, show a clear diagnostic rather than presenting a partial feed.

## Feed and Post UI Integration

[VERIFIED: FEED-01, FEED-02, D-04, D-09 through D-12] Replace the temporary generated shell fully. Feed cards show authentic source identity, concise curated preview, concept labels, and format cues without essays, quizzes, or fabricated engagement. Tapping anywhere on a card except a nested explicit control opens the post. Post detail presents the approved source content, concepts/claims, original-source affordance, visible suggested questions, and the persistent Ask composer.

Suggested questions are frozen records, not generated on open. Usually provide one or two post-specific prompts, with a consistent generic fallback when none qualifies. A suggestion populates/submits through the same validation and Q&A path as typed input and is logged distinctly.

For YouTube posts, use the official IFrame API with `enablejsapi=1`, `playsinline=1`, and a valid `origin` where the hosting context permits it. Handle player errors 100, 101/150, and 153 explicitly and show the frozen digest/summary fallback. Log coarse playback progress using the known `durationMs`; do not turn Phase 2 into a media analytics subsystem. [CITED: https://developers.google.com/youtube/iframe_api_reference] [CITED: https://developers.google.com/youtube/player_parameters]

## Persisted Post-Scoped Q&A

### Required request path

```text
typed or suggested input
  → existing raw-input malicious gate
  ├─ malicious: deterministic refusal; no model call; no raw persistence
  ├─ off-topic: deterministic gentle redirect; canonical scoped record if policy permits
  └─ on-topic:
       load Post + Concepts + Claims + approved source asset
       load prior same-post UserQuestion/AIAnswer pairs
       select safe relevant source blocks within budget
       call one condition-neutral provider path
       persist UserQuestion + AIAnswer
       derive upload/export DTO
```

[VERIFIED: current question filter and provider call sites] Preserve the central provider-call bracketing and the raw-only malicious gate. The existing post-context path currently bypasses `evaluateQuestion`, and the answer generator ignores persisted thread state; both are correctness and security gaps Phase 2 must close.

[VERIFIED: current type/comment mismatch] The current post-context service selects a fast model even though the local contract says Ask uses the main model. Choose one approved model configuration during planning, put it behind the shared Q&A service, and record its exact identifier in answer/export metadata. Do not vary it by condition.

### Grounding and context budget

[RECOMMENDATION: derived from ASK-01 and D-05] Ground every approved answer in the frozen post wrapper, concepts, and claims. Rank sanitized article blocks locally. For video, Gemini first receives the exact frozen YouTube URL plus wrapper/digest; any live failure retries without media from the frozen digest. The selection and retry algorithm is identical for both conditions.

Never pass raw HTML, scripts, hidden metadata, collector logs, or cross-post content to the answer model. Mark source content as untrusted reference material in the prompt and tell the model not to follow instructions found inside it. Prompt injection defenses must address both user input and frozen web content. [CITED: https://genai.owasp.org/llmrisk/llm01-prompt-injection/]

### Persistence and upload projection

[VERIFIED: current app and Phase 1 backend] The UI currently writes both `ChatSession` and a combined `QuestionAnswerRecord`; the backend accepts two CSV-shaped research tables. Phase 2 should introduce canonical `UserQuestion` and `AIAnswer` stores and query them through `dbQuery`. Keep sessions only as a derived view or retire them after callsites migrate.

The derived revisioned upload record must preserve at least canonical IDs, participant/study identity, `postId`, source, `suggestedQuestionId`, timestamps, model identifier, filter outcome, and upload revision/status as allowed by the locked privacy contract. Update client validation, Worker migration/schema, CSV export, and tests together. Both study conditions execute this same path; condition is data for identity/analysis, never a branch controlling the answer.

## Don't Hand-Roll

- Use `@mozilla/readability` for article extraction instead of inventing readability heuristics. Run it inside jsdom with script and external resource loading disabled, and retain only sanitized text/structured blocks. [CITED: https://github.com/mozilla/readability]
- Use jsdom's supported parsing APIs instead of regular expressions for HTML. Never execute source page scripts. [CITED: https://github.com/jsdom/jsdom]
- Use Ajv strict mode for pipeline and frozen-bundle JSON validation instead of scattered ad hoc property checks. [CITED: https://ajv.js.org/strict-mode.html]
- Use the platform cryptographic SHA-256 implementation for content/checksum IDs; do not design custom hashing or signatures.
- Use the official pinned `yt-dlp` binary for operator-side transcript/media metadata acquisition where permitted; do not build a YouTube scraper. [CITED: https://github.com/yt-dlp/yt-dlp]
- Use IndexedDB and `fake-indexeddb` for executable persistence tests instead of trusting an in-memory mirror or source-reading tests. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB] [CITED: https://www.npmjs.com/package/fake-indexeddb]
- Use the official YouTube IFrame API for selected playback; do not emulate the player protocol. [CITED: https://developers.google.com/youtube/iframe_api_reference]

## Common Pitfalls

### Partial generator cutover

[VERIFIED: CLAUDE.md load-bearing feed invariant and current source] Home, queue services, history, detail, and generation helpers share three synchronized lists. Replacing only the visible feed leaves background generation and stale persistence active. Plan a compile-checked callsite inventory, switch consumers to the facade, then delete generator modules and their obsolete tests in the same bounded wave.

### Schema drift hidden by TypeScript compatibility

[VERIFIED: RSD §9] Extra fields, optionalized required fields, or alternate enum spellings can compile while violating study exports. Validate serialized fixtures and exact key sets, not only assignability. Cross-check all IDs and manifest reachability.

### Treating IndexedDB writes as SQL transactions

[VERIFIED: current adapter] The compatibility layer does not make a multi-store import atomic. A crash can leave partial records. Import states, a version namespace, idempotent cleanup, and a final ready marker are required.

### Rendering extraction output as trusted HTML

[CITED: https://owasp.org/www-community/attacks/xss/] Readability output originates from hostile pages. Prefer plain text and locally constructed React elements. If rich markup becomes essential, it requires a separately reviewed sanitizer policy; it should not be smuggled into this phase as `dangerouslySetInnerHTML`.

### Allowing model judgment to become acceptance

[VERIFIED: D-02] Relevance and quality scoring are advisory. A model can be manipulated by source text and cannot replace the mandatory human gate. Reject any plan in which a score threshold directly freezes a candidate.

### Quiet participant-runtime network regressions

[VERIFIED: D-05] Browser image tags, embed previews, URL metadata helpers, and fallback transcript fetches can create accidental live acquisition. Add negative network tests and a manual airplane/offline UAT; allow only the explicitly enumerated user actions.

### Condition contamination

[VERIFIED: D-08] It is easy to reuse condition-aware hooks and accidentally alter feed order, suggestions, prompts, or model choice. Restrict the condition to identity/logging in Phase 2 and add parity tests that execute the same post/question under both values.

### Windows-only green assumptions

[VERIFIED: local validation baseline] The current `npm test` script uses POSIX `find` command substitution and fails on Windows even though direct `node --test` runs. Fix the script in Wave 0 and separately schedule native iOS verification on macOS; a web build on Windows cannot validate the final WKWebView/YouTube behavior.

## Code Examples

### Versioned import state, not pretend SQL atomicity

```ts
type PoolInstallState =
  | { version: string; status: 'importing' }
  | { version: string; status: 'ready'; manifestSha256: string };

export async function installFrozenPool(raw: unknown): Promise<void> {
  const bundle = validateCompleteBundle(raw); // throws before any write
  await clearPoolVersion(bundle.manifest.contentPoolVersion);
  await putInstallState({
    version: bundle.manifest.contentPoolVersion,
    status: 'importing',
  });
  await writeVersionedRecords(bundle);
  await verifyInstalledCounts(bundle.manifest);
  await putInstallState({
    version: bundle.manifest.contentPoolVersion,
    status: 'ready',
    manifestSha256: bundle.manifestSha256,
  });
}
```

[RECOMMENDATION: current adapter limitations] Startup must only expose the version whose state is `ready`; an interrupted `importing` version is cleaned and retried.

### Condition-neutral Q&A contract

```ts
interface AskPostQuestionInput {
  participantId: string;
  studyCondition: StudyCondition; // recorded, never used to branch the answer
  postId: string;
  text: string;
  source: 'user' | 'suggested';
  suggestedQuestionId?: string;
}

async function askPostQuestion(input: AskPostQuestionInput) {
  const evaluation = evaluateQuestion(input.text);
  if (evaluation.kind === 'malicious') return maliciousRefusal();

  const context = await loadFrozenPostContext(input.postId);
  const thread = await loadCanonicalPostThread(input.participantId, input.postId);
  return persistCanonicalExchange(input, evaluation, context, thread);
}
```

[VERIFIED: D-06 through D-08] Do not pass `studyCondition` into grounding, prompt, or model-selection helpers.

### Read-only model-gate envelope

```json
{
  "candidateId": "sha256:…",
  "rubricVersion": "content-relevance-v1",
  "decision": "advance_for_human_review",
  "reasonCodes": ["relevant", "self_contained", "age_appropriate"]
}
```

[RECOMMENDATION: prompt-injection threat model] The operator process should provide a randomly generated delimiter around candidate text, require schema-valid JSON, deny filesystem mutation/network tools, and treat every verdict as advisory.

## State of the Art

| Area | Current, supported approach | Planning implication |
|------|-----------------------------|----------------------|
| Static Vite assets | Imported assets or `public/` files are copied/bundled; large versioned data can be served as packaged static assets. [CITED: https://vite.dev/guide/assets.html] | Decide whether the manifest is imported or loaded from a packaged relative URL, but never from a remote content service. |
| Structured validation | Ajv strict mode catches ignored/ambiguous schema constructs. [CITED: https://ajv.js.org/strict-mode.html] | Compile schemas in pipeline/runtime tests and fail freeze/import on any warning-worthy ambiguity. |
| Article extraction | Readability provides maintained extraction while jsdom supplies a server-side DOM. [CITED: https://github.com/mozilla/readability] [CITED: https://github.com/jsdom/jsdom] | Keep extraction offline and isolate untrusted documents; render approved plain structures in React. |
| YouTube playback | IFrame API exposes state, duration, and documented error codes including origin/referrer-related 153. [CITED: https://developers.google.com/youtube/iframe_api_reference] | Build transcript-first graceful degradation and verify real WebView referrer/origin behavior. |
| IndexedDB testing | `fake-indexeddb` implements IndexedDB APIs for Node tests. [CITED: https://www.npmjs.com/package/fake-indexeddb] | Exercise repository/import logic through the real adapter seam, then retain browser/device UAT for quota and upgrade behavior. |
| Model output control | Provider structured-output features can constrain response shape but do not make untrusted content safe. [CITED: https://platform.claude.com/docs/en/build-with-claude/structured-outputs] | Still validate locally, sandbox tools, delimiter-wrap content, and require human acceptance. |

## Assumptions Log

All factual claims in this artifact are tagged as repository-verified or supported by a cited primary/official source. Architectural choices labeled `RECOMMENDATION` are conclusions drawn from locked constraints rather than claims about existing implementation. No untagged external assumption is required to plan the phase.

## Open Questions

1. **`UserInteractionEvent.payload` contract conflict.** RSD §9 includes an optional arbitrary payload, while Phase 1 locked D-08 and the current privacy-focused type intentionally omit arbitrary payload data. Recommendation: preserve the privacy omission and formally align the requirement/RSD before implementation rather than silently reintroducing the field. This requires an owner decision.
2. **Phase 1 final baseline.** Phase 1 is still represented by dirty/in-progress work. The planner must re-audit its final schema, upload DTO, migration, and test baseline immediately before execution; settle the six existing app-test failures and cross-platform test script without attributing them to Phase 2.
3. **Operator inputs and model checkpoint.** The exact top-tier preprocessing model/API credential, the actual 100–150 URL seed list, and human review capacity are external checkpoints. Keep these configurable and record the resolved model/tool values in the manifest; do not block the architecture on one vendor SDK.
4. **Native YouTube behavior.** Error 153, origin/referrer handling, selected playback, transcript fallback, and offline behavior need explicit Android and iOS device UAT. Final iOS verification requires a macOS/Xcode operator checkpoint.

## Environment Availability

| Capability | Observed state | Planning impact |
|------------|----------------|-----------------|
| Node.js / npm | Node 22.19.0; npm 11.16.0 available [VERIFIED: local probe] | Suitable for app and pipeline packages. |
| Python | 3.13.11 available [VERIFIED: local probe] | Optional operator scripting only; do not create a second runtime stack without need. |
| Git | 2.49.0 available [VERIFIED: local probe] | Supports staged-directory promotion and audit workflow. |
| ffmpeg | 8.1 available [VERIFIED: local probe] | Available if operator-side media inspection needs it; participant app must not depend on it. |
| Codex CLI | 0.144.1 available [VERIFIED: local probe] | Can implement the required read-only relevance gate. |
| Claude Code / `agy` | 2.1.206 / 1.1.1 available [VERIFIED: local probe] | Not required for runtime; may assist operator workflow only if the contract stays provider-neutral. |
| `yt-dlp` | Not installed [VERIFIED: local probe] | Wave 0/operator checkpoint: install pinned official binary and verify checksum, or supply transcripts manually. |
| Top-tier model credential | Not verified [VERIFIED: environment inspection intentionally avoided secret output] | Explicit human checkpoint before live preprocessing; tests use mocked provider calls. |
| URL seed list / reviewers | External input, not present as a frozen pool [VERIFIED: repository state] | Pipeline can be built/tested with fixtures; final pool freeze requires operator material and approvals. |
| macOS/Xcode/iOS device | Not available in current Windows environment [VERIFIED: local platform] | Schedule final native iOS verification outside this workstation. |

## Validation Architecture

### Existing baseline

[VERIFIED: executed local validation before composition] App tests use Node's built-in `node:test` with `assert/strict`; there is no separate runner configuration. Direct `node --test` discovered 836 tests: 830 passed and six pre-existing tests failed (BottomSheet co-location, ChatInput flex shrink, ChatInput pointerdown, bare autofocus, `patchPostEssay` durable stores, and `postHistoryService`). `npm run build` passed. Lint completed with zero errors and 26 warnings. The research backend suite passed 19/19.

[VERIFIED: app/package.json and Windows execution] `npm test` itself is presently non-portable because it shells through POSIX `find`. Wave 0 should replace that command with a cross-platform `node --test` invocation and rebaseline after Phase 1 lands. Do not weaken or delete the six failing assertions simply to obtain green status.

### Test layers

| Layer | What it proves | Tool/seam |
|-------|----------------|-----------|
| Pipeline unit | URL normalization, extraction conversion, hashing, dedupe, quality rules, schema failures | `node:test`; local hostile/malformed fixtures; mocked HTTP/process/model |
| Pipeline integration | Stage resume, model verdict validation, mandatory human decision, freeze refusal/immutability, checksums | Temporary directories and stubbed adapters; no live services |
| Runtime persistence | Upgrade, full validation before write, interrupted import cleanup, ready marker, version mismatch, quota/fallback diagnostics | `fake-indexeddb` through `dbQuery`/repository seam |
| Domain contract | Exact keys/enums/nullability and cross-record referential integrity | TypeScript build plus Ajv fixture tests |
| Feed/post services | Deterministic order, record projection, missing-ID failures, source-asset reads, no remote acquisition | Executable service tests with frozen fixture |
| UI | Authentic card/detail content, whole-card navigation, suggestion visibility/click, transcript/player fallback | Component/screen tests plus browser/device UAT |
| Q&A | all filter branches, no model/persistence on malicious input, same-post thread, grounding budget/retry, canonical writes, condition parity | Mock provider; assertions through `dbQuery`, not memory mirrors |
| Backend/export | Revised DTO validation, migration, idempotent revision upload, CSV fields including suggestion/model/canonical IDs | Worker/backend suite with migration fixtures |
| Native | packaged pool, cold-start import, offline feed/detail, YouTube selected playback/errors, persistence across restart | Android and iOS device checklist |

### Requirement-to-test map

| Requirement | Automated evidence | Manual evidence |
|-------------|--------------------|-----------------|
| CONT-01 | Exact-schema fixtures, forbidden-extra-field checks, `tsc`, cross-reference validation | Inspect one article and one video record against RSD §9 |
| CONT-02 | Mocked stage integration; exact/near dedupe fixtures; invalid model JSON; proof no verdict auto-accepts | Operator completes accept/reject review and audit summary |
| CONT-03 | Freeze refuses overwrite; deterministic checksums; tamper failure; versioned/idempotent import with interrupted-run recovery | Clean-install and upgrade install on device |
| FEED-01 | Feed facade order/projection; screen interaction tests; network-spy negative assertions | Browse several authentic posts offline on target layouts |
| FEED-02 | Suggested-question schema/target validation; generic fallback; click source/ID persistence | Confirm prompt readability and tap behavior on device |
| ASK-01 | malicious/off-topic/on-topic paths; same-post hydration; grounding; canonical persistence; condition-parity test; revised backend export | Ask follow-ups in both conditions and verify restart persistence |

### Wave 0 test work

Create executable tests before or alongside implementation for:

- `tools/content_pipeline/test/{schema,dedupe,quality,codex-gate,freeze}.test.mjs`;
- `app/tests/services/{content-pool.import,frozen-feed,post-qa}.test.mjs`;
- feed/PostDetail screen tests covering suggestions and navigation;
- backend migration/validation/export coverage for revised Q&A fields;
- a native UAT checklist with explicit offline and YouTube cases.

Add `fake-indexeddb` as a dev dependency and correct the cross-platform app test script in the first implementation wave. Prefer tests that execute code paths. Source-reading assertions are acceptable only for narrow negative configuration guarantees that cannot be exercised otherwise.

### Commands

```bash
# Fast Phase 2 service loop, from app/
node --test tests/services/content-pool.import.test.mjs \
  tests/services/frozen-feed.service.test.mjs \
  tests/services/post-qa.service.test.mjs

# Full app gate after Wave 0 repairs the script
npm test
npm run lint
npm run build

# Research backend gate
cd ../research-backend
npm test

# Offline pipeline gate
cd ../tools/content_pipeline
npm test
```

[RECOMMENDATION: proportionate verification] Mock every network/model call in automated tests. A final pool run is an operator acceptance activity, not a deterministic CI dependency.

## Security Domain

### ASVS-oriented controls

| ASVS area | Phase 2 exposure | Required control |
|-----------|------------------|------------------|
| V2 Authentication | No new participant authentication; operator tools may use API credentials | Credentials only in environment/OS secret storage; never manifest, logs, fixtures, bundle, or client build. [VERIFIED: scope] |
| V3 Session Management | Local review UI session | Bind to loopback; high-entropy per-run token; short lifetime; no durable cookie/session; same-origin checks. [CITED: https://github.com/OWASP/ASVS] |
| V4 Access Control | Collector, review mutations, Codex gate | Review mutation requires token and CSRF/origin validation; Codex subprocess is read-only and least-privileged; participant repository is read-only for frozen content. [CITED: https://github.com/OWASP/ASVS] |
| V5 Validation, Sanitization, Encoding | URLs, redirects, HTML, transcripts, model JSON, frozen JSON, questions | Allowlisted schemes; resolve and revalidate every redirect; block private/link-local destinations; size/time/MIME bounds; Ajv strict schemas; render text through React; raw malicious gate before model/persistence. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| V6 Stored Cryptography | Pool integrity and credentials | Platform SHA-256 for manifest checksums; HTTPS for allowed calls; no custom crypto; checksums detect corruption and are not an authenticity substitute. [VERIFIED: architecture recommendation] |

### Threat model and mitigations

| Threat | Boundary | Mitigation and required test |
|--------|----------|------------------------------|
| SSRF / DNS rebinding | URL seed → collector | Public HTTP(S) only, destination-IP checks before connect and after redirects, redirect cap, time/byte limits; fixtures for loopback, private, link-local, alternate IP syntax. [CITED: OWASP SSRF cheat sheet above] |
| Stored XSS / active HTML | web page → extraction → UI | Disable scripts/resources in jsdom, retain approved text/structured data, React-escape rendering, no raw HTML; hostile fixture with scripts/event handlers. [CITED: https://owasp.org/www-community/attacks/xss/] |
| Prompt injection | source/question → Codex or answer model | Random delimiters, explicit untrusted-data instruction, tool-less/read-only model gate, strict output schema, human acceptance, raw malicious question gate; adversarial fixtures. [CITED: https://genai.owasp.org/llmrisk/llm01-prompt-injection/] |
| Malformed bundle / path traversal | frozen artifact → runtime/filesystem | Fixed filenames, no artifact-provided paths, Ajv validation, checksum/count/reference verification, staging directory constrained below intended root; tamper/path fixtures. |
| Secret leakage | operator environment → logs/bundle/client | Redaction, environment-only keys, bundle allowlist, scan outputs/build for known secret patterns; failure-log tests. |
| Review CSRF / LAN exposure | browser → review server | Loopback bind, random token, origin/CSRF checks, body limits, no wildcard CORS; negative request tests. |
| Partial/corrupt DB import | bundle → IndexedDB | Whole-bundle prevalidation, version namespace, importing/ready states, idempotent cleanup, fail-closed UI; forced-interruption tests. |
| YouTube origin/referrer failure | WebView → iframe | Explicit supported parameters, transcript fallback, documented error handling, real native UAT; no silent remote fallback fetch. |
| Condition leakage | identity → feed/Q&A behavior | No condition parameter below logging boundary; parity tests compare order, prompt construction, model config, and grounding. |
| Supply-chain compromise | packages/binaries → operator/app build | Pin reviewed dependencies, lockfile review, official repositories, checksum external binary, no pipeline auto-download; rerun legitimacy audit on upgrades. |

[VERIFIED: current question filter contract] Malicious question handling is a security boundary: no LLM call and no raw-input persistence. Preserve it as a dedicated testable branch rather than treating it as ordinary off-topic moderation.

## Sources

### Primary repository sources — HIGH confidence

- `AGENTS.md` — repository scope, planned structure, testing and mutation rules. [VERIFIED]
- `CLAUDE.md` — load-bearing feed pipeline, data, question-filter, navigation-shell, and header invariants. [VERIFIED]
- `.codex/agents/gsd-phase-researcher.toml` and `.codex/agents/gsd-phase-researcher.md` — artifact contract, provenance tags, validation/security requirements. [VERIFIED]
- `.planning/phases/02-content-pool-feed-post-ui-on-frozen-data/02-CONTEXT.md` — locked D-01 through D-12 decisions, discretion, and deferrals. [VERIFIED]
- `.planning/{REQUIREMENTS,STATE,ROADMAP}.md` — phase requirements, sequencing, and current milestone state. [VERIFIED]
- `docs/research_system_design.md`, especially §9 — canonical research data model and target architecture. [VERIFIED]
- `docs/SCOPE.md` and `docs/prune_report.md` — prototype boundaries and features that must not return. [VERIFIED]
- Current `app/src`, `app/tests`, `app/package.json`, and research-backend source/tests — existing seams and measured baseline. [VERIFIED]

### Official external sources — MEDIUM-to-HIGH confidence

- Vite, Static Asset Handling: https://vite.dev/guide/assets.html [CITED]
- MDN, Using IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB [CITED]
- Mozilla Readability official repository: https://github.com/mozilla/readability [CITED]
- jsdom official repository: https://github.com/jsdom/jsdom [CITED]
- Ajv strict mode documentation: https://ajv.js.org/strict-mode.html [CITED]
- `fake-indexeddb` package documentation: https://www.npmjs.com/package/fake-indexeddb [CITED]
- yt-dlp official repository and releases: https://github.com/yt-dlp/yt-dlp and https://github.com/yt-dlp/yt-dlp/releases [CITED]
- YouTube IFrame Player API and parameters: https://developers.google.com/youtube/iframe_api_reference and https://developers.google.com/youtube/player_parameters [CITED]
- Anthropic structured outputs documentation: https://platform.claude.com/docs/en/build-with-claude/structured-outputs [CITED]
- OWASP ASVS: https://github.com/OWASP/ASVS [CITED]
- OWASP LLM Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/ [CITED]
- OWASP SSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html [CITED]
- OWASP XSS overview: https://owasp.org/www-community/attacks/xss/ [CITED]

### Tertiary sources

None. No community post or search-result summary is used as implementation authority.

## Metadata

**Research confidence:** HIGH for codebase architecture, locked scope, schema obligations, cutover risks, and validation gaps; MEDIUM for final content-pipeline operations until the model credential, URL seed list, review capacity, and native device behavior are verified.

**Key planning conclusion:** split Phase 2 into an offline pipeline/freeze track and a participant runtime cutover track, join them through one exact immutable contract, then converge on a single integrated pool and native UAT gate. Within the runtime track, migrate canonical content and Q&A persistence before deleting the generated-feed shell; deletion is complete only after every feed/detail/navigation callsite uses the frozen facade.

**Suggested plan shape:**

1. Wave 0 — repair/rebaseline validation, settle Phase 1 interfaces, pin dependencies/tools, add schemas and hostile fixtures.
2. Contract foundation — exact RSD types, JSON Schemas, manifest/source-asset design, canonical Q&A stores, IndexedDB upgrade/import protocol.
3. Offline pipeline — collection/extraction, normalization/dedupe, mechanical and Codex gates, secure human review, immutable freezer.
4. Runtime data cutover — packaged artifact loading, validation/import, repository and deterministic feed facade.
5. UI/Q&A cutover — feed cards, PostDetail, suggestions, transcript/player behavior, filtered grounded canonical Q&A, revised upload/export.
6. Removal and convergence — delete generator pipeline and obsolete tests, freeze the operator-approved pool, run full automated/offline/native gates.

**Research date:** 2026-07-11

**Phase:** 2 — Content pool + feed/post UI on frozen data

**Requirements covered:** CONT-01, CONT-02, CONT-03, FEED-01, FEED-02, ASK-01
