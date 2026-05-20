---
phase: 48-graph-command-service-and-trust-invariants
plan: 02
subsystem: services
tags: [graph-command, journal, mutex, blocker-2, blocker-4, warning-3, warning-4, typescript]

requires:
  - phase: 48
    plan: 01
    provides: "graphEditJournal singleton + GraphEditLogEntry type + GRAPH_UPDATED payload extension"
provides:
  - "graphCommandService boundary with rename + move + delete fully implemented; merge/detach/prune/undo stubs returning NOT_IMPLEMENTED for Plans 48-03/04"
  - "Per-process createPromiseMutex serialization of all commands at the boundary (R10 risk 9)"
  - "ErrorCode union extended with STORAGE_ERROR (Blocker #2) + NOT_IMPLEMENTED (Plan 48-03/04 stubs)"
  - "Test mocks: _actions-mock-question.delete returns ServiceResult<void>; _setDeleteFail + _setEmbedFail + _setEmbeddingConfigured toggles for graceful-degradation testing"
affects: [48-03, 48-04, 49]

tech-stack:
  added: []
  patterns:
    - "Read-fresh-inside-mutex (Pattern 1 / R10 risk 1) — every command reads questionService.getAll inside the _mutex.run body so stale snapshots never overwrite concurrent work"
    - "Single-write-path discipline (R1 / T-48-05) — all writes go through questionService.patchQuestion / questionService.delete; no direct localStorage writes from the service"
    - "Atomic patch with optional vector merge (Blocker #4) — rename builds one Partial<Question> patch; embeddingVector is INCLUDED only when re-embed succeeds; OMITTED otherwise so spread-merge preserves the old vector"
    - "Source-reading negative invariants — tests grep the service source to enforce the D-16 normalize bypass + Blocker #4 'never-undefined' invariant + Warning #4 typed-emit + T-48-05 no-direct-writes guard"

key-files:
  created:
    - app/src/services/graph-command.service.ts
    - app/tests/services/graph-command-service.rename.test.mjs
    - app/tests/services/graph-command-service.move.test.mjs
    - app/tests/services/graph-command-service.delete.test.mjs
  modified:
    - app/src/types/index.ts
    - app/tests/services/_actions-mock-settings.mjs
    - app/tests/services/_actions-mock-embedding.mjs
    - app/tests/services/_actions-mock-question.mjs
    - app/package.json

key-decisions:
  - "Read-fresh discipline inside the per-process mutex — every command body reads questionService.getAll AFTER acquiring the mutex so two concurrent calls against the same id observe each other's mutations"
  - "Per Blocker #4 fix (revision 1): never overwrite a vector with undefined — rename omits embeddingVector from the patch object on graceful-degradation paths so questionService.patchQuestion's spread-merge preserves the old vector untouched"
  - "Anchor-delete cascade rule (Claude's discretion per D-15) = re-parent children to anchor.parentId (the cluster); single level only per R10 risk 7 (cluster-delete's grandchildren are NOT touched)"
  - "Warning #4 — accept intentional double-emit on delete/merge: questionService.delete already emits an untyped GRAPH_UPDATED at question.service.ts:569; the command boundary emits a SECOND typed event with payload.kind so Phase 49 UI can dispatch on the kind. CLAUDE.md confirms subscribers are idempotent."
  - "ErrorCode union extension lives in types/index.ts (shared) rather than a graph-command-local enum so the codes can be referenced by Phase 49 toast logic + Plans 48-03/04 tests without circular imports"
  - "test:main excludes graph-command-service.*.test.mjs alongside the trellis-* tests — they need the actions-mock-loader register hook to stub question.service / settings.service / providers"

requirements-completed: [GRAPH-01, GRAPH-02, GRAPH-03]

metrics:
  duration_min: 19
  tasks: 3
  files_created: 4
  files_modified: 5
  commits: 6
  tests_added: 42
  tests_passing: 42

completed: 2026-05-17
---

# Phase 48-02: Graph Command Service — rename + move + delete Summary

**`graphCommandService` boundary now exists with `rename`, `move`, `delete` fully implemented (plus `merge` / `detach` / `prune` / `undo` stubs returning `NOT_IMPLEMENTED` for Plans 48-03/04). Per-process mutex serializes commands; read-fresh-inside-mutex prevents stale snapshots; every successful command writes EXACTLY one `GraphEditLogEntry` and emits EXACTLY one typed `GRAPH_UPDATED` from the command boundary (delete + merge intentionally double-emit per CLAUDE.md). Blocker #4 graceful-degradation guarantees `embeddingVector` is NEVER silently set to undefined.**

## Performance

- **Duration:** ~19 min (6 commits across 19 min elapsed)
- **Started:** 2026-05-18T01:45:04Z
- **Completed:** 2026-05-18T02:04:14Z
- **Tasks:** 3 (per-plan tasks; each task = 1 RED commit + 1 GREEN commit)
- **Files created:** 4 (service + 3 per-verb test files)
- **Files modified:** 5 (types extension + 3 mock extensions + package.json)

## Accomplishments

- `graphCommandService` singleton with all 7 verb methods declared (3 implemented in this plan, 4 stubbed for Plans 48-03/04)
- Per-process `createPromiseMutex` serializes commands at the boundary; concurrent rename/move/delete calls run sequentially with read-fresh-inside-mutex so they observe each other's mutations
- **rename(id, newTitle):**
  - D-16 bypass — operator's literal title stored verbatim (no `normalizeAnchorName` import)
  - Hard validation only — empty / whitespace-only / 100-char cap / NOT_FOUND
  - R10 risk 11 no-op guard — same-title (post-trim) returns success with NO journal write and NO emit
  - **Blocker #4 three-path graceful degradation** — embedding-unconfigured / embed-failure / embed-success all preserve the post-state vector invariant (never silently undefined)
  - Atomic single-`patchQuestion` call when re-embed succeeds (no two-step clear-then-fill)
- **move(id, newParentId):**
  - Anchor move (→ new cluster) and QA move (→ new anchor) handled separately
  - Validation: self-parent, missing target/parent (NOT_FOUND), descendant subtree (BFS cycle prevention)
  - R10 risk 12 no-op guard — same parent returns success with NO journal write and NO emit
  - Side effects (recomputed deterministically on undo per R2; not stored in journal):
    - OLD parent: qaCount decrement (clamped at 0); if anchor, `[id] ...` line stripped from nodeSummary
    - NEW parent: qaCount increment; if anchor, `[id] <shortSummary | content.slice(0,80)>` appended to nodeSummary (Warning #3 — fallback to content slice when shortSummary missing)
- **delete(id):**
  - **Blocker #2 fix** — `questionService.delete` return-value (`Promise<ServiceResult<void>>`) is INSPECTED before journal + command-boundary emit. On failure: returns `STORAGE_ERROR` (retryable), NO journal entry, NO typed emit
  - Single-level cascade per R10 risk 7:
    - Anchor delete: children re-parent to anchor's cluster (parentId/clusterNodeId/branchLabel/clusterLabel)
    - Cluster delete: child anchors re-parent to root (all placement cleared); QAs of those anchors UNTOUCHED
    - Leaf QA: no cascade, empty `cascadedChildIds`
  - **Warning #4** — accepted intentional double-emit: questionService.delete emits untyped + command boundary emits typed `{ kind: 'delete' }`; LAST event observed has the kind discriminator; CLAUDE.md confirms subscribers are idempotent
  - Journal: FULL `deletedRecord` per D-04 + `reparentedChildren` IDs + OLD placement (per R10 risk 3 — children stay in store, not full snapshots)
- `ErrorCode` type union extended with `STORAGE_ERROR` (Blocker #2) and `NOT_IMPLEMENTED` (Plan 48-03/04 stubs)
- Test mocks extended: `_actions-mock-question.delete` now returns `ServiceResult<void>` matching real signature; `_setDeleteFail`, `_setEmbedFail`, `_setEmbeddingConfigured` toggles enable Blocker #2 + Blocker #4 testing

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| 1 | RED | `f40b123a` | test: failing rename tests + extended mocks |
| 1 | GREEN | `67a6f613` | feat: skeleton + rename + Blocker #4 graceful-degradation |
| 2 | RED | `02536f11` | test: failing move tests |
| 2 | GREEN | `ae9375b2` | feat: move(id, newParentId) anchor + QA + side effects |
| 3 | RED | `127d51d0` | test: failing delete tests + Blocker #2 mock extension |
| 3 | GREEN | `39e1bd92` | feat: delete with cascade + Blocker #2 + Warning #4 |

## Files Created/Modified

- `app/src/services/graph-command.service.ts` — 326 lines; singleton with `rename` (fully implemented, including Blocker #4 graceful degradation), `move` (anchor + QA with side effects), `delete` (cascade + Blocker #2 + Warning #4 double-emit), and 4 stubs (`merge`, `detach`, `prune`, `undo`) returning NOT_IMPLEMENTED
- `app/src/types/index.ts` — `ErrorCode` union extended with `STORAGE_ERROR` (Blocker #2) and `NOT_IMPLEMENTED` (stubs)
- `app/tests/services/graph-command-service.rename.test.mjs` — 19 tests (6 source-reading invariants + 13 behavioral)
- `app/tests/services/graph-command-service.move.test.mjs` — 12 tests (2 source-reading + 10 behavioral)
- `app/tests/services/graph-command-service.delete.test.mjs` — 11 tests (4 source-reading + 7 behavioral including Blocker #2 abort-before-journal + Warning #4 double-emit)
- `app/tests/services/_actions-mock-question.mjs` — `delete` now returns `Promise<ServiceResult<void>>` + emits QUESTION_DELETED + untyped GRAPH_UPDATED; added `_setDeleteFail` toggle
- `app/tests/services/_actions-mock-settings.mjs` — added `getSync()` returning mutable embedding config; added `_setEmbeddingConfigured` toggle
- `app/tests/services/_actions-mock-embedding.mjs` — added `_setEmbedFail` toggle (throw from inside `embedText`)
- `app/package.json` — `test:actions` extended with all 3 graph-command-service test files; `test:main` exclude-list extended so they don't double-run without the mock loader

## Decisions Made

- **Read-fresh discipline inside the mutex** — every command body reads `questionService.getAll` AFTER acquiring the mutex so two concurrent calls against the same id observe each other's mutations. The mutex serializes; the read-fresh inside ensures sequential consistency.
- **Per Blocker #4 fix (revision 1): never overwrite a vector with undefined.** rename builds one `Partial<Question>` patch; `embeddingVector` is INCLUDED only when re-embed succeeds; OMITTED otherwise so `questionService.patchQuestion`'s spread-merge (`{ ...store[idx], ...patch }`) preserves the old vector untouched. Three code paths (isConfigured=false / embed-fail / embed-success) all maintain the post-state invariant.
- **Anchor-delete cascade rule (Claude's discretion per D-15)** = re-parent children to anchor.parentId (the cluster). Single level only per R10 risk 7 — cluster-delete's grandchildren (the QAs hanging off the deleted cluster's anchors) are NOT touched. Less destructive than full cascade; preserves GRAPH-03 source-Q&A-content intent.
- **Warning #4 — accept intentional double-emit on delete.** questionService.delete at `question.service.ts:569` emits an untyped GRAPH_UPDATED; the command boundary emits a SECOND typed event with `payload.kind`. CLAUDE.md §"Event bus — unified GRAPH_UPDATED" confirms subscribers are idempotent — re-reading the store twice is harmless. The LAST event observed has the kind discriminator so subscribers that filter on kind work correctly.
- **ErrorCode union extension lives in `types/index.ts`** (shared) rather than a graph-command-local enum so the codes can be referenced by Phase 49 toast logic + Plans 48-03/04 tests without circular imports. `STORAGE_ERROR` and `NOT_IMPLEMENTED` join the existing union (alphabetically late in the list, scoped via inline phase-48 comment).
- **`test:main` excludes `graph-command-service.*.test.mjs`** alongside the trellis-* tests — they need the actions-mock-loader register hook to stub `question.service` / `settings.service` / `providers/embedding`. Running them under plain `node --test` would import the real services and fail with the i18n JSON-import-attribute chain.

## Deviations from Plan

None — plan executed exactly as written. TDD discipline preserved (per-task RED + GREEN commits). All Blocker #2 / #4 / Warning #3 / #4 fixes from plan-checker revision-round-1 are closed:

- **Blocker #2** — `questionService.delete` ServiceResult success is checked before journal append (test at `graph-command-service.delete.test.mjs:179` proves the abort-before-journal path)
- **Blocker #4** — three-path graceful-degradation test (`graph-command-service.rename.test.mjs:215` for isConfigured=false; `:239` for embed-failure; `:271` for atomic success; `:305` for the cross-cutting never-undefined invariant)
- **Warning #3** — `shortSummary?: string` exists on Question type at `types/index.ts:36`; move uses the `target.shortSummary ?? target.content.slice(0, 80)` fallback (test at `graph-command-service.move.test.mjs:256`)
- **Warning #4** — typed emit from command boundary with payload.kind discriminator (test at `graph-command-service.delete.test.mjs:243` asserts LAST event has `kind === 'delete'`)

## Issues Encountered

- **Tests don't compose with test:main exclude-list defaults.** First full-suite run after Task 3 surfaced 23 failures — turned out `test:main`'s glob picked up the new `graph-command-service.*.test.mjs` files which need the `--import ./tests/services/_actions-mock-loader.mjs` register hook. Fixed inline (Rule 3 — blocking issue caused by current task's changes) by extending the exclude-list in package.json. Full suite then returned to the documented 4 pre-existing failures.
- **Pre-existing failures persist (unchanged from 48-01).** 4 tests in 3 files fail (concept-feed import error, trellis-state worst-child-wins, trellis-replant 2× hardcoded dates). All documented in `deferred-items.md`; verified non-causation by inspection. Not fixed in Phase 48 per scope boundary.

## Threat Surface Scan

No new threat surface introduced. All commands route through the existing single-write path (`questionService.patchQuestion` / `questionService.delete`); no direct localStorage writes from this service (`grep -c "localStorage.setItem" app/src/services/graph-command.service.ts` returns 0). Threat register dispositions T-48-05 (no second writer), T-48-06 (audit trail via journal), T-48-08 (snapshot size — child IDs + 4 string fields per child), T-48-14 (acceptable partial state on failed delete) addressed.

## Next Phase Readiness

- **Plan 48-03** (merge/detach/prune) can now extend `graph-command.service.ts` — the file structure, mutex, journal append site, and emit-from-boundary pattern are all locked. The 3 stubs are in place with the same `_mutex.run` shape; Plan 48-03 just replaces the body.
- **Plan 48-04** (undo) likewise can plug into the existing journal API (`graphEditJournal.popNewest()`) + the `_mutex.run` pattern. The inverse-verb-with-swapped-snapshots strategy (per RESEARCH §R Summary point 6) maps onto rename/move/delete journal entry shapes already shipped here.
- **Phase 49 UI** can dispatch on `payload.kind` (rename / move / delete now; merge / detach / prune / undo to follow) emitted from every command boundary.
- **`graphCommandService.delete` is a partial replacement for `questionService.delete` callers** — Plan 48-03's prune-consolidation decision (D-14 / R6) will route the existing `trellisActionsService.prune` and `unpruneQuestion` through this service so journal entries cover those paths.

## Self-Check: PASSED

- ✅ All 42 Plan 48-02 tests pass (`cd app && node --import ./tests/services/_actions-mock-loader.mjs --test tests/services/graph-command-service.rename.test.mjs tests/services/graph-command-service.move.test.mjs tests/services/graph-command-service.delete.test.mjs`): 19 rename + 12 move + 11 delete = 42/42.
- ✅ TypeScript compiles cleanly (`npx tsc -b --noEmit` returns 0).
- ✅ Full suite: 981/983 test:main + 56/58 test:actions = **1037/1041 pass** — the 4 failing tests are pre-existing (concept-feed import error, trellis-state worst-child-wins, trellis-replant 2× hardcoded dates), all documented in `deferred-items.md` with stash-verified non-causation.
- ✅ Atomic commits with conventional-commit format (`test(48-02)` / `feat(48-02)` prefixes; per-task RED + GREEN).
- ✅ All `must_haves.truths` from plan frontmatter satisfied:
  - rename validates + bypasses normalizeAnchorName + atomic title+vector patch on success / preserves vector on degradation ✓
  - move updates 4 placement fields + writes one journal entry + emits one GRAPH_UPDATED ✓
  - delete hard-deletes + cascades (anchor→cluster, cluster→root) + records full pre-image + reparented-children diff ✓
  - Every successful command writes EXACTLY ONE GraphEditLogEntry; LAST GRAPH_UPDATED has payload.kind matching the cmd ✓
  - questionService.delete failure aborts BEFORE journal/emit (Blocker #2) ✓
  - embeddingVector is NEVER undefined post-rename when it was defined pre-rename (Blocker #4) ✓
- ✅ All `key_links` patterns present (verified via grep):
  - `questionService\.(patchQuestion|delete|getAll)` ✓
  - `graphEditJournal\.append` ✓
  - `eventBus\.emit\(\{\s*type:\s*'GRAPH_UPDATED'` ✓
- ✅ All acceptance-criteria grep gates pass (T1: 1/7/0/4/2/2/0; T2: 3/9; T3: 1/1/4/0; package.json: 1).

---
*Phase: 48-graph-command-service-and-trust-invariants*
*Completed: 2026-05-17*
