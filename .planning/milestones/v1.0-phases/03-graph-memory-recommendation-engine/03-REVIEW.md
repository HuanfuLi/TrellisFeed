---
phase: 03-graph-memory-recommendation-engine
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 75
files_reviewed_list:
  - .gitattributes
  - app/content-pool.package.json
  - app/public/content-pool-v1/global_edges.json
  - app/public/content-pool-v1/manifest.json
  - app/public/content-pool-v1/ranking_features.json
  - app/public/content-pool-v1/sources.json
  - app/scripts/content-pool-package-contract.mjs
  - app/scripts/package-content-pool.mjs
  - app/src/App.tsx
  - app/src/components/FeedCard.tsx
  - app/src/components/MasonryFeed.tsx
  - app/src/data/content-pool-bundle.ts
  - app/src/domain/graph.types.ts
  - app/src/generated/content-pool-v1/global_edges.json
  - app/src/generated/content-pool-v1/index.ts
  - app/src/generated/content-pool-v1/manifest.json
  - app/src/generated/content-pool-v1/ranking_features.json
  - app/src/generated/content-pool-v1/sources.json
  - app/src/locales/en.json
  - app/src/locales/es.json
  - app/src/locales/ja.json
  - app/src/locales/zh.json
  - app/src/screens/HomeScreen.tsx
  - app/src/services/content-pool.repository.ts
  - app/src/services/content-pool-boot.service.ts
  - app/src/services/db.service.ts
  - app/src/services/global-graph.repository.ts
  - app/src/services/graph-memory.service.ts
  - app/src/services/interaction-log.service.ts
  - app/src/services/post-qa.service.ts
  - app/src/services/question-extraction.service.ts
  - app/src/services/ranking/control-ranker.ts
  - app/src/services/ranking/diversity-reranker.ts
  - app/src/services/ranking/experimental-ranker.ts
  - app/src/services/recommendation.repository.ts
  - app/src/services/recommendation.service.ts
  - app/src/services/recommendation-config.ts
  - app/src/services/research-wire-contract.ts
  - app/src/types/index.ts
  - app/src/types/research.ts
  - app/tests/components/FeedCard.test.mjs
  - app/tests/fixtures/content-pool/minimal-valid-pool.json
  - app/tests/fixtures/fresh-graph-pool-run.mjs
  - app/tests/phase2/frozen-cutover.test.mjs
  - app/tests/phase3/fresh-graph-pool-cutover.test.mjs
  - app/tests/screens/HomeScreen.frozen-feed.test.mjs
  - app/tests/screens/HomeScreen.recommendation-feed.test.mjs
  - app/tests/screens/PostDetailScreen.frozen-content.test.mjs
  - app/tests/services/content-pool.import.test.mjs
  - app/tests/services/content-pool.repository.test.mjs
  - app/tests/services/content-pool-boot.service.test.mjs
  - app/tests/services/diversity-reranker.test.mjs
  - app/tests/services/global-graph.repository.test.mjs
  - app/tests/services/graph-memory.service.test.mjs
  - app/tests/services/interaction-log.service.test.mjs
  - app/tests/services/question-extraction.service.test.mjs
  - app/tests/services/ranking-components.test.mjs
  - app/tests/services/recommendation.service.test.mjs
  - app/tests/services/storage-namespace.test.mjs
  - data/content_pool_graph_20260718/manifest.json
  - research-backend/migrations/0003_question_extraction_fields.sql
  - research-backend/src/export.ts
  - research-backend/src/validation.ts
  - research-backend/src/worker.ts
  - tools/content_pipeline/schemas/frozen-pool.schema.json
  - tools/content_pipeline/schemas/global-edge.schema.json
  - tools/content_pipeline/schemas/ranking-features.schema.json
  - tools/content_pipeline/schemas/source.schema.json
  - tools/content_pipeline/src/freeze/build.ts
  - tools/content_pipeline/src/freeze/runtime-artifacts.ts
  - tools/content_pipeline/src/freeze/verify.ts
  - tools/content_pipeline/src/graph/build.ts
  - tools/content_pipeline/test/freeze-graph-artifacts.test.mjs
  - tools/content_pipeline/test/graph-build.test.mjs
  - tools/content_pipeline/test/schema.test.mjs
findings:
  critical: 0
  warning: 6
  info: 1
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-19  
**Depth:** standard  
**Files Reviewed:** 75  
**Status:** issues_found

## Summary

The gap closure fixes the original UAT blocker: the selected immutable pool has exactly nine hashed
runtime artifacts, source/generated/public bytes match, the app boot barrier waits for both durable
pool import and global graph hydration, graph failure persists no recommendation rows, and the
control path neither loads personal stores nor calls the reason LLM. The previous `video_progress`
unit mismatch and unavailable-reason-config batch wedge are also fixed in the current tree.

No critical issue was found in the successful production path. Six warning-level lifecycle,
data-integrity, and defense-in-depth issues remain. The most important is that concurrent graph loads
mutate one singleton in place and can leave it unloaded; this is reachable through React StrictMode's
development effect replay. Recommendation persistence also lacks atomicity and can leave orphaned
rows or unrecoverable first-session `building` ledgers after a transient failure.

Verification performed during this review:

- `node scripts/package-content-pool.mjs --check` passed for `pilot-graph-20260718`.
- 24 targeted app/package/boot/recommendation tests passed.
- 27 targeted freeze/graph/schema tests passed.
- All ten runtime files were byte-identical across the immutable source, generated projection, and
  public projection; all nine artifact hashes matched the manifest.

## Critical Issues

None.

## Warnings

### WR-01: Concurrent global-graph loads race, return contradictory results, and leave the singleton unloaded

**Files:** `app/src/services/global-graph.repository.ts:42-87`,
`app/src/services/content-pool-boot.service.ts:34-49`, `app/src/App.tsx:274-280,319-356`

**Issue:** `GlobalGraphRepository.load()` immediately calls `reset()`, then awaits several database
queries before incrementally mutating shared maps. It has no in-flight promise or generation guard.
Two concurrent calls therefore both reset the same instance and then populate the same indexes. The
second population sees duplicate sources and enters the catch path, whose `reset()` clears the indexes
that the successful call just installed.

This is reachable in the repository's standard development shell: `main.tsx` wraps `App` in
`StrictMode`, which replays effects in development, while `ContentPoolBootService.hydrate()` does not
coalesce calls. A direct production-pool reproduction during review returned
`[{ success: true }, { success: false }]`, after which `rankingFeatures()` threw because the repository
was no longer loaded. Existing boot tests exercise only sequential success/failure/retry calls.

**Suggested fix:** Make `load()` single-flight and build all indexes in local variables before one
atomic assignment. Clear the cached promise only after a failed attempt so explicit retry remains
possible. Add a `Promise.all([repository.load(), repository.load()])` regression and a boot-service
concurrency test asserting both callers observe the same result and the final repository is usable.

### WR-02: Ready recommendation rows and their batch ledger are not persisted atomically

**Files:** `app/src/services/recommendation.repository.ts:35-65`,
`app/src/services/recommendation.service.ts:358-381`

**Issue:** `saveBatch()` writes every recommendation through a separate `dbExecute`, then writes the
batch ledger through another `dbExecute`. If any later write fails, earlier recommendation rows remain
without a ready batch. A retry creates new recommendation IDs, so those partial rows are never adopted
or deleted. The method returns a generic retryable failure but performs no compensation. This violates
the repository's own batch-ledger integrity check and is particularly relevant on IndexedDB, where
each call is a separate transaction.

The current fresh-pool regression proves the all-success and pre-recommendation graph-failure cases;
it does not inject failure after recommendation N or on the final batch write.

**Suggested fix:** Add a database batch/transaction seam implemented equivalently by IndexedDB and
LocalStorage backends and commit recommendation rows plus the ready ledger in one transaction. If
that is not practical, write under a staging batch ID and delete all staged rows on failure. Add
failure-injection tests for a middle recommendation and for the final ledger write, asserting zero
orphan rows.

### WR-03: Home loses the generated session ID when the first batch fails, stranding its `building` ledger

**Files:** `app/src/screens/HomeScreen.tsx:116-134`,
`app/src/services/recommendation.service.ts:284-293,326-378`

**Issue:** Home passes `undefined` until `beginSession()` succeeds and only then copies
`batchResult.data.sessionId` into `sessionIdRef`. `beginSession()` generates the default session ID
inside the service, and `buildBatch()` persists a `building` ledger before several fallible reads,
ranking operations, and the ready write. If one of those operations fails, Home catches the error but
never learns the generated ID. Its next retry generates a different session, so the existing recovery
logic can never find the first session's `building` batch. Repeated transient failures accumulate
stranded ledgers.

**Suggested fix:** Generate and retain the session ID in Home before the first awaited call (or return
the ID in a typed failure result), then reuse it for every retry. Alternatively give the repository a
terminal failed/cleanup operation and invoke it whenever `buildBatch()` exits after the building write.
Add a test that fails immediately after saving `building`, retries through the Home-facing path, and
asserts one ledger transitions to `ready` with no additional session.

### WR-04: Root-level symlinked pool selections are accepted despite the immutable-selection contract

**Files:** `app/scripts/content-pool-package-contract.mjs:96-112`,
`app/tests/phase2/frozen-cutover.test.mjs:76-128`

**Issue:** `resolveSelectedPoolRoot()` calls `realpathSync()` before `lstatSync()`. The returned
canonical path is no longer the selected directory entry, so the subsequent `lstatSync` cannot detect
that `content-pool.package.json` selected a symlink/junction. A review reproduction created a junction
inside `data/`; `lstatSync(link).isSymbolicLink()` was true, but `resolveSelectedPoolRoot()` accepted it
and returned the target. Containment still blocks targets outside `data/`, and nested entries are
checked later, but an in-data alias can be retargeted without changing the tracked selection file,
undermining the claim that the selected immutable directory itself is reviewable.

**Suggested fix:** Resolve the lexical candidate, verify it is inside the lexical data root, reject
`lstatSync(candidate).isSymbolicLink()` before canonicalization, and reject symlinked intermediate path
components. Then canonicalize and repeat containment. Add in-data and escaping symlink/junction tests.

### WR-05: The standard packager verifies graph hashes but not graph semantics

**Files:** `app/scripts/content-pool-package-contract.mjs:159-186`,
`app/src/services/content-pool.repository.ts:117-139,304-312`,
`app/tests/phase2/frozen-cutover.test.mjs:76-128`

**Issue:** `loadRuntimeCollections()` validates the three graph artifacts only as `sources` array,
`globalEdges` array, and a ranking object with `posts`. Its reference validator covers topics, posts,
concepts, claims, suggestions, and source assets, but not graph-edge endpoint kinds/topic ownership,
ranking one-to-one/source ownership, or embedding-vector coherence. Those checks exist in the offline
verifier and app import, so the participant app fails closed at boot, but `npm run build` can still
package and ship a self-hashed yet semantically invalid selected graph pool. This moves an operator
selection error from build time to an installed-device recovery screen.

**Suggested fix:** Share or replicate the graph semantic validator in the package contract and run it
before deleting/writing outputs. Extend the package test with a graph artifact whose artifact and
bundle hashes are recomputed but whose edge endpoint or ranking source is invalid; packaging must fail.

### WR-06: Backend ownership checks remain vulnerable to a check-then-write race

**File:** `research-backend/src/worker.ts:260-299`

**Issue:** Every ingest record first runs a separate owner `SELECT`; only after all checks finish does
the worker execute the insert/upsert batch. Two concurrent authenticated requests using the same
client-generated record ID under different users can both observe no row, pass the check, and race to
`INSERT OR IGNORE`/`ON CONFLICT`. The loser is silently treated as accepted instead of receiving the
intended 409. For question-answer upserts, a carefully timed higher revision can also change ownership
because the upsert assigns `user_id = excluded.user_id`.

**Suggested fix:** Put the ownership predicate in each write statement and inspect affected-row
results, or perform the assertion and write in one D1 transaction. Ensure the QA conflict update has
`WHERE existing.user_id = excluded.user_id AND existing.question_id = excluded.question_id` in
addition to its revision condition. Add a concurrent cross-user conflict test.

## Info

### IN-01: Offline verification rejects only top-level symlinks

**File:** `tools/content_pipeline/src/freeze/verify.ts:120-156`

**Issue:** The verifier calls `lstat` only for immediate children of the pool root. Its later recursive
`walk()` treats any non-directory entry as a file and `readFile()` follows it, so a symlink under
`source_files/` or `review_logs/` can be included and hashed instead of rejected. The freezer itself
creates those directories and files in fresh staging, and the app packager's recursive walk rejects
nested symlinks, so the checked-in production pool is not affected; the standalone `--verify-only`
claim is simply weaker than its top-level check suggests.

**Suggested fix:** In the recursive verifier walk, use `lstat` (or `Dirent.isSymbolicLink()`) for every
entry and fail on any symlink before reading content. Add a nested source-file symlink fixture.

---

_Reviewed: 2026-07-19_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
