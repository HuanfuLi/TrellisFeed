# Phase 2: Content Pool + Feed/Post UI on Frozen Data — Pattern Map

**Mapped:** 2026-07-11  
**Scope:** likely Phase 2 source, data, test, and removal surfaces inferred from `02-CONTEXT.md`, `02-RESEARCH.md`, RSD §9, and the live codebase

## Cutover Shape

Phase 2 joins two deliberately separate systems through one immutable artifact:

```text
operator-only pipeline -> validated/frozen content_pool_v1 -> boot import -> content repository
                                                                   |-> frozen feed facade -> Home/Saved/PostDetail
                                                                   `-> post Q&A -> canonical UserQuestion/AIAnswer -> existing upload seam
```

The freezer is the only pipeline-to-participant conversion boundary. `frozen-feed.service.ts` is the only ordering boundary and the Phase 3 ranker insertion point. `post-qa.service.ts` is the only answer boundary. No participant-runtime module may collect, fetch, extract, preprocess, or repair content.

## File Classification

| Likely file/surface | Change | Role and data flow | Closest live analog | Pattern to reuse |
|---|---|---|---|---|
| `app/src/domain/content.types.ts` | NEW | Exact participant domain contract | `app/src/types/research.ts` | Plain exported unions/interfaces; exact RSD §9 keys/enums; no pipeline/review/source-body convenience fields in `Post` |
| `tools/content_pipeline/schemas/*.json` | NEW | Strict schemas for stages and frozen projection | `app/src/data/filter-corpus.json` plus fixture-driven tests | Checked-in data contracts; strict validation and forbidden extras; cross-record validation belongs above individual schemas |
| `tools/content_pipeline/src/collect/*` | NEW | URL seeds -> bounded raw captures | no strong live analog | Operator-only adapters; allowlisted HTTP(S), redirect/IP/MIME/size/time bounds; injectable fetch/process seams |
| `tools/content_pipeline/src/{extract,normalize,dedupe,quality}/*` | NEW | raw capture -> normalized candidates -> duplicate groups -> mechanical verdicts | pure helpers in `app/src/services/feed-spread.ts` and `app/src/lib/text-normalization.ts` | Small deterministic leaf modules, explicit inputs/outputs, no module-global mutable state |
| `tools/content_pipeline/src/codex-gate/*` | NEW | candidate -> advisory schema-valid gate verdict | provider structured-result parsers; no exact runtime analog | Random delimiter around untrusted text, read-only/tool-less execution, reason codes, never final acceptance |
| `tools/content_pipeline/src/review/*` | NEW | candidates + AI verdict -> operator edits/accept/reject JSON | `ResearchSetupScreen` form/service split (role match only) | Loopback-only server, per-run token/origin/CSRF checks; persist review decisions separately from candidates |
| `tools/content_pipeline/src/freeze/*` | NEW | accepted reviews -> exact runtime records/assets -> checksummed immutable directory | no exact analog | Fresh staging dir, validate all references, serialize, hash, atomic promote, refuse existing destination |
| `tools/content_pipeline/test/{schema,dedupe,quality,codex-gate,freeze}.test.mjs` | NEW | Executable pipeline contract | `app/tests/services/filter-classifier.eval.test.mjs`, `refill-mutex.test.mjs` | `node:test` + `assert/strict`; temp dirs and injected/mocked I/O; hostile fixtures; no live model/network |
| `data/content_pool_v1/{manifest,posts,concepts,claims,suggested_questions}.json` | NEW/frozen | Participant bundle | no exact analog | Manifest owns `contentPoolVersion`, deterministic `feedOrderPostIds`, counts, filenames, hashes; records are approved/frozen only |
| `data/content_pool_v1/source_files/*` | NEW/frozen | Full article text or reviewed video digest keyed by `postId` | no exact analog | Fixed filenames/keys, never artifact-provided filesystem paths; no transcript/audio/video copy |
| `app/src/services/db.service.ts` | MODIFY | Add versioned pool, source-asset, user-question, and AI-answer stores | existing `SHARED_DDL` -> `TABLE_NAMES` -> dual backends | Add DDL entries, bump `IDB_VERSION` (currently 2), preserve identical SQL subset in both backends, include stores in clear-all |
| `app/src/services/content-pool.repository.ts` | NEW | Packaged bundle -> validate/stage/import -> synchronous ready-version reads | `post-history.service.ts` hydration/mirror pattern; `study-context.service.ts` metadata pattern | Awaited boot hydration; `dbQuery`/`dbExecute` only; validate whole bundle before writes; `importing`/`ready` metadata; idempotent retry |
| `app/src/services/frozen-feed.service.ts` | NEW | manifest ordered IDs -> feed records and by-ID detail reads | public facade shape of `conceptFeedService`; `engagementService` ID resolution | Return deterministic identical order for both conditions; repository resolves immutable records; no question history or generation |
| `app/src/services/post-qa.service.ts` | NEW | submit -> filter -> same-post grounding/thread -> provider -> canonical writes -> derived upload records | `question.service.ask`, `post-context-qa.service`, `interaction-log.service` | Malicious pre-gate before provider/persistence; `ServiceResult<T>`; local-first canonical writes; identical prompt/model path across conditions |
| `app/src/types/research.ts` | MODIFY | Upload/export DTO alignment | existing `QuestionAnswerRecord` and privacy-bounded events | Keep `UserInteractionEvent` free of arbitrary payload; evolve Q&A DTO as a derived projection, not canonical UI storage |
| `app/src/services/interaction-log.service.ts` | MODIFY | Canonical Q&A -> revisioned upload/event records | `recordQuestionSubmit`/`recordAnswerViewed` | Strict allowed keys, identity from `studyContextService`, persist then enqueue, monotonic revisions, one event per semantic action |
| `app/src/services/upload-queue.service.ts` | MODIFY | Revised Q&A DTO -> bounded at-least-once upload | existing queue implementation | Preserve 100-record/256 KiB bounds, revision identity, retry triggers, server-owned condition/topic behavior |
| `research-backend/{migrations,src/validation.ts,src/export.ts,src/worker.ts}` | MODIFY | Accept/idempotently revise/export canonical Q&A projection | current research ingest pipeline | Schema allowlists, monotonic revision handling, derived CSV columns, no second endpoint/uploader |
| `app/src/components/FeedCard.tsx` | NEW | `Post` + related labels -> authentic content card | leaf card inside `InfoFlow.tsx` / `Card.tsx` | Functional component, whole-card navigation, inline CSS variables, source/read-time/concept metadata; no generation effect |
| `app/src/components/SuggestedQuestionList.tsx` | NEW | suggested IDs -> buttons -> submit callback | `SuggestionCard.tsx` and button patterns in `PostDetailScreen` | Present approved text, preserve suggested-question ID/source, 44px targets, no personalized generation |
| `app/src/components/OriginalContent.tsx` (or equivalent) | NEW | source asset -> article blocks or YouTube/digest fallback | `Markdown.tsx` for safe derived prose; existing `PostCarousel` only as layout precedent | Article text as React text nodes; YouTube selected embed only; digest/summary fallback; source link always present/logged |
| `app/src/components/MasonryFeed.tsx` / `InfoFlow.tsx` | REWRITE or DELETE/REPLACE | Feed layout -> `FeedCard` records | existing two-column height-balanced shell | Reuse shell only if metadata/accessibility fit; delete concept/connection/milestone/style/image branches rather than adapting RSD `Post` to them |
| `app/src/screens/HomeScreen.tsx` | REWRITE | frozen feed facade -> visible cards -> `/posts/:id` | its own route re-read and interaction logging patterns | Always-mounted `/home` route effect must re-read; retain direction-slop gesture rule if gesture remains; log impressions without condition branching |
| `app/src/screens/PostDetailScreen.tsx` | REWRITE | by-ID record/assets/suggestions/thread -> reading + Ask | its own Header, post open/close, exploration detectors | Preserve Header usage and A/B/C exploration ownership; remove on-open essay/deep-dive/image generation and anchor-derived content identity |
| `app/src/screens/SavedScreen.tsx` | MODIFY | saved post IDs -> repository records | current screen + engagement getters | Resolve immutable content through pool repository, not post-history snapshots |
| `app/src/services/engagement.service.ts` | MODIFY | saved/not-interested post IDs | current ID-only state + event emission | Retain idempotent mutation and one-event semantics; resolve through pool repo; dismiss by `postId`, not anchor ID |
| `app/src/services/post-history.service.ts` | REPLACE/REDUCE | viewed post IDs/timestamps only | current IDB mirror/hydration | Do not duplicate immutable full posts; repository owns content; if retained, store observation metadata only |
| `app/src/App.tsx` | MODIFY | gate first participant render on pool/Q&A hydration | `hydrateAllFromSQLite()` | Add pool and canonical Q&A hydration to awaited boot barrier; remove generator/queue hydration only at atomic cutover |
| `app/src/locales/{en,zh,es,ja}.json` | MODIFY | UI strings | existing four-bundle workflow | English canonical, all four bundles in same change; content itself stays English |
| `app/tests/services/{content-pool.import,frozen-feed,post-qa}.test.mjs` | NEW | Runtime contracts | `anchor-persistence`, interaction-log, study-context tests | Execute through `dbQuery`; use `fake-indexeddb`; test interruption/version mismatch/tamper, deterministic parity, malicious zero-call/zero-write |
| feed/PostDetail component and screen tests | NEW/REPLACE | UI behavior | current component loaders and screen tests | Test whole-card navigation, real metadata, suggestions, digest fallback, source logging, same behavior in both conditions |
| `app/tests/native/phase-2-content-pool-uat.md` (or equivalent) | NEW | Device acceptance | `app/tests/e2e/phase8.manual-uat.md` | Android+iOS clean install/restart/offline/package checks and real YouTube origin/referrer/error fallback |

## Concrete Pattern Assignments

### Exact domain contract: `content.types.ts`

Copy the minimal style of `types/research.ts`, but use RSD §9 field-for-field for `Topic`, `Post`, `Concept`, `Claim`, `SuggestedQuestion`, `UserQuestion`, and `AIAnswer`. Keep `OriginalContentAsset` and manifest types separate because full article text or video URL/ID + digest and checksums are not fields of RSD `Post`.

Important reconciliation: RSD uses `UserQuestion.source: "typed" | "suggested_question"`; the research text's illustrative `"user" | "suggested"` sketch is non-canonical. Follow RSD and the existing Phase 1 DTO. A suggestion submission also carries `suggestedQuestionId`.

### IndexedDB contract: `db.service.ts`

Reuse the existing store declaration mechanism exactly:

```ts
const SHARED_DDL = [
  // existing stores...
  `CREATE TABLE IF NOT EXISTS content_pool_posts (id TEXT PRIMARY KEY, version TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS content_pool_assets (id TEXT PRIMARY KEY, version TEXT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS user_questions (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_answers (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
];
```

The exact table split is planner discretion, but every table name must be in `SHARED_DDL`, `IDB_VERSION` must increase, `clearAllTables()` must clear it, and both `LocalStorageBackend` and `IndexedDBBackend` must understand every SQL statement used. The shim's `BEGIN`/`COMMIT` are no-ops; use a version status row (`importing` -> `ready`) as the exposure barrier rather than claiming a cross-store transaction.

### Boot hydration and synchronous UI reads

`App.tsx:hydrateAllFromSQLite()` is the canonical first-render barrier. `contentPoolRepository.hydrate()` must finish before `setHydrated(true)`. Mirror the repository pattern of `postHistoryService`: async DB hydration plus synchronous getters for render, but validate records at the import boundary and expose only the version marked `ready`.

For Home specifically, retain the canonical always-mounted-screen rule:

```ts
useEffect(() => {
  if (location.pathname !== '/home') return;
  setPosts(frozenFeedService.getFeed());
}, [location.pathname]);
```

An initializer alone is insufficient because Home remains mounted inside `SwipeTabContainer`.

### One feed facade

Do not make Home, Saved, or PostDetail read raw stores. A minimal Phase 2 shape should resemble:

```ts
export const frozenFeedService = {
  getFeed(): Post[],
  getPostById(id: string): Post | null,
  getSuggestedQuestions(postId: string): SuggestedQuestion[],
  getOriginalContent(postId: string): OriginalContentAsset | null,
};
```

The manifest's `feedOrderPostIds` is the Phase 2 order. No method accepts `StudyCondition` or question history. Phase 3 changes selection behind this boundary.

### Canonical Q&A orchestration

`question.service.ask()` supplies the required ordering precedent: filter before model and before persistence. `post-context-qa.service.ts` supplies the existing provider/model resolver and streaming chokepoint, while `interaction-log.service.ts` supplies persist-then-enqueue semantics. Combine those responsibilities behind one service; do not call them ad hoc from the screen.

```ts
async function askPostQuestion(input: AskPostQuestionInput): Promise<ServiceResult<PostAnswer>> {
  const evaluation = await evaluateQuestion(input.text, samePostFilterContext);
  if (evaluation.label === 'malicious') return blockedWithoutPersistingRawInput();
  const post = frozenFeedService.getPostById(input.postId);
  const thread = await repository.getThread(input.userId, input.postId);
  // persist UserQuestion, call centralized chatStream/chatCompletion,
  // persist AIAnswer, derive/revise upload DTO
}
```

Preserve the security-critical filter algorithm unchanged: malicious is RAW-vector argmax with its validated/clamped floor; context never enters that comparison. The benign off/on split uses contextual vectors. Off-topic input follows the existing gentle-redirect mechanism; malicious input causes no model call and no raw-input persistence. The provider call must go through `providers/llm/index.ts` so locale injection and structural user-content bracketing remain centralized.

Thread hydration must select canonical prior `UserQuestion`/`AIAnswer` pairs for the same `userId` and `postId` only. `studyCondition` may be recorded at the logging/upload boundary but must not reach prompt, grounding, feed, model selection, or answer behavior. Both conditions get Ask.

### Interaction and upload evolution

Retain the existing service signatures and invariants where possible:

- `interactionLog.record(eventType, allowedFields)` obtains identity itself.
- Persist locally before `enqueueUpload`.
- One semantic action emits one allowlisted event.
- Q&A revisions are monotonic/idempotent; backend ingest remains at-least-once safe.
- Keep arbitrary `payload` omitted from `UserInteractionEvent` despite RSD §9.8: Phase 1 intentionally narrowed the record for privacy. Resolve the documentation conflict explicitly rather than silently adding it.

Canonical `UserQuestion` and `AIAnswer` must not be squeezed into `QuestionAnswerRecord`. That record remains a derived transport/export representation until the backend migration replaces it cleanly.

### Feed and detail UI

`FeedCard` should reuse the repository's established UI grammar: functional React component, inline styles, CSS variables such as `--surface`, `--surface-variant`, `--muted-foreground`, `--radius-xl`, and `--shadow-1`, plus 44px action targets. It should accept a domain `Post`, not `DailyPost` or a generated-presentation union.

`PostDetailScreen` remains an Outlet sub-screen and must continue using `Header`. Do not add `transform`, `will-change`, `filter`, `contain`, `perspective`, or a competing scroll root around it. The `Header` component's context split is structural: in-tree inside swipe tabs, body portal outside them.

Keep PostDetail's three `CONCEPT_EXPLORED` detectors in that screen: 70%-scroll sentinel, 30-second dwell, and successful Q&A follow-up submit. Extend the existing event payload if frozen `postId`/`conceptIds` are needed; do not invent a parallel exploration event. The interaction log separately records `post_open`, `post_close`, `source_click`, video events, suggestion click, submit, and answer view.

Articles render packaged full text using React text nodes/approved block structures, never `dangerouslySetInnerHTML`. YouTube may use the selected embed; offline/unavailable/error paths show the reviewed digest/summary and a notice. Always show the original source link and log its click.

### Generator retirement boundary

Until every caller is switched, preserve the load-bearing three-list pipeline exactly: daily anchors -> append-only derived list -> cyclic queue; retain refill mutex, empty-cold-start event semantics, walker guard, and queue constants. Then remove it atomically. Do not leave a half-live queue or bypass one list.

Likely deletion/large-removal surfaces after call-site audit:

- `concept-feed.service.ts`, `post-queue.service.ts`, `infiniteScroll.service.ts`, `style-assignment.ts`, `feed-spread.ts`, generator/image/post-essay formatting paths that exist only for AI posts;
- generated `DailyPost`/`PostSnapshot`/presentation-style types;
- `InfoFlow` concept/connection/milestone branches, `SuggestionCard` as a generated post, image/text-art card logic;
- PostDetail on-open generation, deep-dive regeneration, AI image carousel, anchor-title resolution, and generated-post sessions;
- obsolete generator/queue/style/starter/connection/suggestion tests.

Run `rg` for every deleted symbol before removal. Do not preserve the generated subsystem as the Phase 3 ranker seam; `frozen-feed.service.ts` replaces it.

## Shared Constraints the Planner Must Put in Tasks

1. **Scope:** no live participant fetch, AI-generated primary posts, global chat, graph UI, collections, semantic search, social features, gamification, podcast, flashcards/SRS, or personalized Phase 3 ranking.
2. **Persistence:** heavy stores only through `dbQuery`/`dbExecute`; no retired localStorage keys; tests assert durable rows through the seam. New object stores require an IndexedDB version bump and fallback parity.
3. **Data integrity:** validate the entire bundle, hashes, counts, enums, and references before exposure. Frozen versions are never overwritten or edited.
4. **Condition isolation:** Phase 2 feed order, suggestions, prompt, grounding, provider/model, and answer behavior are identical for control and experimental conditions. Question history cannot influence control feed behavior.
5. **Security:** raw malicious filter gate precedes model and persistence; untrusted source/model text is schema-validated and delimiter-bracketed; operator pipeline credentials never enter logs, fixtures, artifact, or client bundle.
6. **Navigation/header:** keep the two-slot Home/Settings shell, `/posts/:id` Outlet route, commit-on-release edge back-swipe, portal-vs-in-tree Header split, and root/body overflow invariants.
7. **Events:** extend existing semantic events; do not fork `CONCEPT_EXPLORED` or emit duplicate engagement/research events. Capacitor state changes must trigger event-driven rereads where applicable.
8. **i18n:** all visible chrome in `en/zh/es/ja`; frozen English content stays English under all UI locales.
9. **Tests:** `node:test` + `assert/strict`; mock all network/model calls; prefer executable paths; use `fake-indexeddb`; retain device UAT for quota, packaged assets, offline behavior, and YouTube WebView behavior.
10. **Baseline:** repair the Windows-nonportable test command and rebaseline Phase 1 failures without weakening them; app gates remain `npm test`, `npm run lint`, `npm run build`, then Capacitor sync/device checks for bundled assets.

## Strongest Existing Test Analogs

| New evidence | Reuse |
|---|---|
| Import durability/interruption | `app/tests/services/anchor-persistence.test.mjs` for `dbQuery` assertions; `storage-migration.test.mjs` for hydration/migration shape |
| Condition parity | `study-context.service.test.mjs` plus dependency injection around feed/Q&A; compare calls/results under both identities |
| Q&A persistence/upload | `interaction-log.service.test.mjs`, `upload-queue.service.test.mjs`, backend `ingest.test.mjs`/`export.test.mjs` |
| Malicious zero-call/zero-write | `question-service-pre-gate.test.mjs` and golden filter fixtures; strengthen with executable mocks rather than source text |
| Always-mounted Home reread | existing `HomeScreen.*-resync` tests and `HomeScreen.empty-questions-no-error.test.mjs` pattern |
| Header/navigation regression | `tests/layout/root-horizontal-clip.test.mjs`, `SwipeTabContainer.resize-guard.test.mjs`, Header portal tests |
| Pipeline deterministic stages | `refill-mutex.test.mjs` leaf import style and `filter-classifier.eval.test.mjs` data-driven fixture loop |

## No Strong Live Analog

The repository has no existing secure collector, offline article/YouTube extractor, human review server, immutable checksum freezer, versioned multi-store importer, or real-content card. These are first-of-kind. Their contracts come from `02-RESEARCH.md`, RSD §§8–9/17, and the locked D-01–D-12 decisions; planners should not force them into generated-feed abstractions merely to obtain an analog.

## Planner Hand-off

Plan in two tracks joined by the frozen contract: (1) pipeline/review/freeze and (2) runtime schema/import/repository. Converge only after an approved artifact exists, then cut UI/Q&A/backend consumers over and retire the generated subsystem in a final call-site-audited wave. External checkpoints are the actual URL seed list, model credential/checkpoint, operator approval of ~50 posts, and Android/iOS device UAT; fixtures and mocked adapters should allow all engineering work before those checkpoints.
