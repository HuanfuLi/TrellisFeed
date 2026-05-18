---
phase: 50-retrieval-and-library-foundation
plan: 03
subsystem: services
tags: [collections, library, localStorage, event-bus, leaf-service, idempotent, retrieval]

# Dependency graph
requires:
  - phase: 50-retrieval-and-library-foundation
    provides: 50-01 — Collection type + COLLECTIONS_CHANGED member in AppEvent union
  - phase: 50-retrieval-and-library-foundation
    provides: 50-02 — RED test scaffolds + library.* i18n bundles (en/zh/es/ja)
  - phase: 39-engagement-and-saved
    provides: engagementService leaf-module pattern (structural analog)
  - phase: 31-post-history
    provides: postHistoryService ID-resolution surface
provides:
  - collectionService leaf module (CRUD + ID-only storage + COLLECTIONS_CHANGED emission)
  - Locked public API surface for Waves 2-3 (CollectionPickerSheet, SavedScreen Collections tab, CollectionDrillInScreen)
  - Idempotent mutator + one-event-per-semantic-mutation contract
  - validateName() suffix contract ('nameEmpty' | 'nameTooLong' | 'nameDuplicate') → maps to i18n key library.savePicker.{suffix}
affects: [50-04, 50-05, 50-06, 50-07, 50-08, 50-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf-module discipline copied byte-for-byte from engagement.service.ts (loadState/saveState/freshState/resolvePostsByIds)"
    - "Idempotent mutator with membership check BEFORE push+emit (engagementService.savePost shape)"
    - "ID-only persistence + read-time resolution via postHistoryService (D-03)"
    - "reset() emits NOTHING wholesale-wipe rule (D-08)"
    - "Local ServiceResult shape with string-error i18n key suffixes (50-PATTERNS §ServiceResult)"

key-files:
  created:
    - app/src/services/collection.service.ts
  modified:
    - app/tests/services/collection.service.test.mjs
    - app/tests/events/event-bus.collections-changed.test.mjs

key-decisions:
  - "Local CollectionResult<T> type alias (string-error union) instead of importing the global ServiceResult<ServiceError> shape — plan-locked and lets callers compose t(`library.savePicker.${error}`) directly"
  - "renameCollection on a missing target returns success without emit (defensive against caller races with deleteCollection)"
  - "deleteCollection is idempotent — re-deleting a missing collection returns success without emit"
  - "EB-02 scaffold's speculative postId payload field was dropped — locked AppEvent payload is { kind, collectionId } only; subscribers re-read collectionService for full state per CLAUDE.md §Event bus — unified GRAPH_UPDATED"

patterns-established:
  - "Three threats (T-50-XSS-NAME, T-50-QUOTA, T-50-ORPHAN, T-50-MALFORMED-JSON) all mitigated at the service boundary"
  - "Five COLLECTIONS_CHANGED kinds — create, rename, delete, add-post, remove-post — one signal per semantic mutation, no parallel events"

requirements-completed: [RETRIEVE-02]

# Metrics
duration: 6min
completed: 2026-05-18
---

# Phase 50 Plan 03: collectionService Leaf Module Summary

**Local-first collection CRUD service with ID-only persistence, idempotent mutators, and a single discriminated COLLECTIONS_CHANGED event per semantic mutation — turns 50-02's two RED scaffolds GREEN (18 tests pass).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-18T08:58:56Z
- **Completed:** 2026-05-18T09:04:14Z
- **Tasks:** 1 (TDD GREEN-only — RED scaffolds shipped in 50-02)
- **Files created:** 1
- **Files modified:** 2

## Accomplishments

- New leaf module `app/src/services/collection.service.ts` (308 lines) mirroring `engagement.service.ts` line-for-line in shape — loadState / saveState / freshState / resolvePostsByIds / module-private validateName + genId helpers.
- Idempotent mutators across the board: `addPost`, `removePost`, `deleteCollection` all check membership BEFORE the saveState + emit step. Re-mutations are no-op + no event.
- ONE `COLLECTIONS_CHANGED` event per semantic mutation with five discriminating `kind` values (`create | rename | delete | add-post | remove-post`). `reset()` emits NOTHING (D-08 wholesale-wipe pattern).
- Name validation at the service boundary returns i18n key SUFFIX strings (`'nameEmpty' | 'nameTooLong' | 'nameDuplicate'`) so callers compose `t(\`library.savePicker.${result.error}\`)` directly — keys already shipped in 50-02 locale bundles.
- All four threats mitigated:
  - **T-50-XSS-NAME:** name only trimmed + length-capped; no HTML stripping (render boundary in 50-06 owns XSS via React text nodes).
  - **T-50-QUOTA:** saveState() try/catch silently drops on quota exceeded.
  - **T-50-ORPHAN:** getCollectionPosts() silently drops IDs not in postHistoryService.
  - **T-50-MALFORMED-JSON:** loadState() try/catch + array-shape check returns freshState() on parse failure.
- Circular-dep guard preserved: `grep -c "import.*engagement.service" src/services/collection.service.ts` returns 0. Import direction stays unidirectional: `engagementService → collectionService → postHistoryService`.
- 18 tests GREEN across both scaffold files (15 service + 3 event-bus). Existing `engagement.service.test.mjs` (13 tests) still GREEN — no regression from shared localStorage shim.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement collectionService leaf module (TDD GREEN — RED scaffolds shipped in 50-02)** — `d97fe123` (feat)

_Note: This plan is a GREEN-only TDD step. The RED scaffolds for both test files landed in plan 50-02 with `assert.fail(...)` placeholders. Plan 50-03 ships the implementation AND replaces the placeholders with concrete assertions in a single commit because the locked AppEvent payload shape (`{ kind, collectionId }` only) required a payload-shape correction in EB-02 that has no value without the implementation present._

## Files Created/Modified

- `app/src/services/collection.service.ts` (NEW, 308 lines) — Leaf-module collectionService with CRUD verbs (`createCollection`, `renameCollection`, `deleteCollection`), membership verbs (`addPost`, `removePost`), accessors (`getCollections`, `getCollectionPosts`, `getAllMemberPostIds`, `getPostCollections`), and `reset()`.
- `app/tests/services/collection.service.test.mjs` (MODIFIED) — 15 behavioral assertions replacing `assert.fail(...)` placeholders. Covers CRUD round-trip, name validation (empty/too-long/case-insensitive dedup), idempotence (no double-emit), reset semantics, getAllMemberPostIds union, getPostCollections reverse lookup, T-50-ORPHAN graceful drop.
- `app/tests/events/event-bus.collections-changed.test.mjs` (MODIFIED) — 3 runtime delivery assertions: full payload delivery, add-post variant, unsubscribe stops delivery. Speculative `postId` payload field from the 50-02 scaffold removed — locked AppEvent shape is `{ kind, collectionId }` only.

## Public API Signature (for downstream consumers)

```typescript
// Import shape (copy-paste ready for 50-04 .. 50-09):
import { collectionService } from '../services/collection.service';

// Locked surface:
collectionService.createCollection(name: string)
  : { success: true; data: Collection }
  | { success: false; error: 'nameEmpty' | 'nameTooLong' | 'nameDuplicate' };

collectionService.renameCollection(id: string, name: string)
  : { success: true; data: void }
  | { success: false; error: 'nameEmpty' | 'nameTooLong' | 'nameDuplicate' };

collectionService.deleteCollection(id: string)
  : { success: true; data: void };  // never fails; idempotent on missing id

collectionService.addPost(collectionId: string, postId: string): void;     // idempotent
collectionService.removePost(collectionId: string, postId: string): void;  // idempotent
collectionService.getCollections(): Collection[];                          // insertion order
collectionService.getCollectionPosts(collectionId: string): DailyPost[];   // resolves via postHistoryService
collectionService.getAllMemberPostIds(): Set<string>;                      // union — feeds engagementService.getPinnedIds (D-09)
collectionService.getPostCollections(postId: string): Collection[];        // reverse lookup
collectionService.reset(): void;                                           // emits NOTHING (Clear-All-Data path)
```

Event signature (already in `AppEvent` from 50-01):

```typescript
{
  type: 'COLLECTIONS_CHANGED';
  payload: {
    kind: 'create' | 'rename' | 'delete' | 'add-post' | 'remove-post';
    collectionId: string;
  };
}
```

## Decisions Made

- **Local CollectionResult<T> type alias instead of importing `ServiceResult<ServiceError>`:** the plan and 50-PATTERNS explicitly lock a simpler `{ success: true; data: T } | { success: false; error: NameError }` shape so callers can branch on the literal-union error and compose `t(\`library.savePicker.${error}\`)` directly. The global ServiceResult has a `ServiceError` object (code/message/retryable) that would force consumers to unpack `.error.code` before calling t() — extra friction for no benefit on a pure validation surface.
- **renameCollection on missing target returns success without emit:** treated as a defensive no-op for caller-race scenarios (e.g., user deletes then renames in the same animation frame). No risk of silent data loss because callers re-read `getCollections()` on the next event.
- **deleteCollection is idempotent:** matches the broader "idempotent mutators" rule from CLAUDE.md best practice #6. Re-deleting returns `success: true` without emitting a second `delete` event.
- **EB-02 scaffold's `postId` payload field dropped:** the 50-02 scaffold speculatively asserted `payload.postId === 'p1'` on the `add-post` variant, but the locked AppEvent payload in `types/index.ts:746-752` (shipped by 50-01) is `{ kind, collectionId }` only. Per CLAUDE.md §"Event bus — unified GRAPH_UPDATED" and the explicit `requires` from 50-CONTEXT D-03, subscribers re-read `collectionService.getCollectionPosts(collectionId)` for full membership rather than threading per-event detail. The test was rewritten to assert the actually-locked shape.

## Deviations from Plan

None — plan executed exactly as written.

The single nuance worth recording is the EB-02 test rewrite documented under "Decisions Made" above. This is not a deviation from the plan — the plan's `<interfaces>` block specifies `eventBus.emit({ type: 'COLLECTIONS_CHANGED', payload: { kind, collectionId } })` exactly, and the 50-02 scaffold's `postId` placeholder was always slated for replacement in this plan's "replace `assert.fail(...)` placeholders with concrete assertions" instruction.

## Issues Encountered

- **Initial test for "empty name rejected" asserted `localStorage.getItem(STORAGE_KEY) === null`, which failed** because `beforeEach`'s defensive `collectionService.reset()` writes `{"collections":[]}` to storage. Fixed by asserting `collectionService.getCollections().length === 0` instead — same invariant (no collection actually persisted), more robust against the reset-first test setup.

## Threat Flags

None — all threats covered by 50-PLAN `<threat_model>` are mitigated at the service boundary. No new security-relevant surface introduced beyond what the plan accounted for.

## User Setup Required

None — leaf service has no external configuration requirement.

## Next Phase Readiness

- **Wave 2 (50-04, 50-05):** `getAllMemberPostIds()` is ready for `engagementService.getPinnedIds()` extension (D-09). Threading order intact: `engagementService → collectionService → postHistoryService`.
- **Wave 3 (50-06, 50-07, 50-08):** Locked API surface above is the copy-paste shape for `CollectionPickerSheet`, `SavedScreen` Collections sub-tab, and `CollectionDrillInScreen`.
- **Wave 3 (50-09):** `reset()` is ready to wire into the `SettingsDataScreen` Clear-All-Data sweep alongside `engagementService.reset()`.

## Self-Check: PASSED

- [x] `app/src/services/collection.service.ts` exists (308 lines)
- [x] `app/tests/services/collection.service.test.mjs` modified
- [x] `app/tests/events/event-bus.collections-changed.test.mjs` modified
- [x] Commit `d97fe123` present in git log
- [x] `node --test tests/services/collection.service.test.mjs tests/events/event-bus.collections-changed.test.mjs` → 18 pass, 0 fail
- [x] `grep -c "import.*engagement.service" src/services/collection.service.ts` → 0 (circular dep guard)
- [x] `grep -c "STORAGE_KEY = 'trellis_collections_v1'" src/services/collection.service.ts` → 1
- [x] `grep -c "eventBus.emit" src/services/collection.service.ts` → 5 (one per mutator: create, rename, delete, addPost, removePost)
- [x] reset() emits nothing (grep within reset()) → 0
- [x] `node --test tests/services/engagement.service.test.mjs` → 13 pass (no regression)

---
*Phase: 50-retrieval-and-library-foundation*
*Completed: 2026-05-18*
