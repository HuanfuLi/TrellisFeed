---
phase: 50-retrieval-and-library-foundation
plan: 05
subsystem: engagement, post-history, library
tags: [d-09, retention, purge-protection, collection-pinning, union-semantics, leaf-services]
requires:
  - app/src/services/collection.service.ts (provides collectionService.getAllMemberPostIds — added by 50-03)
  - app/src/services/post-history.service.ts (consumes engagementService.getPinnedIds — UNCHANGED)
provides:
  - "engagementService.getPinnedIds() now returns saved ∪ liked ∪ collection-member IDs (D-09)"
  - "Collection membership demonstrably pins a 8-day-old post against a 7-day retention cutoff via the existing purge call site (no purge-side change)"
affects:
  - 50-08 (CollectionDrillInScreen) — drill-in view can rely on collection-member posts not being silently purged from postHistoryService
  - 50-09 (Library tab — Saved/Collections drawer/Clear-All-Data) — Clear-All-Data flow continues to call engagementService.reset() + collectionService.reset() together; pin-set narrowing is automatic
tech-stack:
  added: []
  patterns:
    - "Read-time union via single helper — getPinnedIds() recomputes lazily per call (called once per purgeExpired invocation, not per post)"
    - "One-way import direction enforced by source-grep test (collection.service.ts NEVER imports engagement.service.ts)"
key-files:
  created: []
  modified:
    - app/src/services/engagement.service.ts (one import + one-line union extension to getPinnedIds + expanded JSDoc)
    - app/tests/services/engagement.service.pinned-ids.test.mjs (Wave 0 RED scaffold → GREEN behavioral suite, 9 tests)
    - app/tests/services/post-history.purge-collections.test.mjs (Wave 0 RED scaffold → GREEN behavioral suite, 7 tests)
decisions:
  - "Test 'call site unchanged' guard strips // comment lines before grep-counting engagementService.getPinnedIds() in post-history.service.ts — pre-existing JSDoc on line 67 also matches the bare string, so the test counts CODE-only matches to remain stable. Behavioral intent (single code call) is preserved."
metrics:
  duration: "~12 min"
  completed: 2026-05-18
---

# Phase 50 Plan 50-05: engagementService.getPinnedIds collection-aware union (D-09)

Surgical one-line union extension to `engagementService.getPinnedIds()`. After this plan, the method returns the union of `{saved, liked, all-collection-members}` instead of `{saved, liked}`. Because `postHistoryService.purgeExpired()` already calls `engagementService.getPinnedIds()` to compute its retain-set, collection-member posts now automatically survive the 7-day rolling history purge — zero changes on the purge side.

## What changed (exact diff)

### `app/src/services/engagement.service.ts`

1. Added one import after the existing `postHistoryService` import:
   ```ts
   import { collectionService } from './collection.service.ts';
   ```
2. Replaced the body of `getPinnedIds()` with the D-09 union:
   ```ts
   getPinnedIds(): Set<string> {
     const s = loadState();
     const collectionMembers = collectionService.getAllMemberPostIds();
     return new Set<string>([...s.saved, ...s.liked, ...collectionMembers]);
   }
   ```
3. Expanded the JSDoc above `getPinnedIds()` to document the D-09 semantic shift and the one-way import direction.

No other method in the file was touched.

### `app/src/services/post-history.service.ts`

**UNCHANGED.** The `engagementService.getPinnedIds()` call site at line 68 is identical to pre-plan code. The behavior shift is internal to engagementService.

### Test files (Wave 0 RED scaffolds → GREEN)

- `app/tests/services/engagement.service.pinned-ids.test.mjs` — 9 behavioral tests covering the union semantics (saved-only, liked-only, collection-only, multi-collection, dedup, empty, dismissed exclusion, live-state, removal).
- `app/tests/services/post-history.purge-collections.test.mjs` — 7 tests covering positive (collection-pinned old post survives), negative control (unpinned old post is purged), legacy-saved backward-compat, legacy-liked backward-compat, overlap (saved AND in collection), the "call site unchanged" guard, and the circular-dep guard (collection.service.ts does NOT import engagement.service.ts).

## Threat coverage

| Threat ID | Mitigation |
|-----------|------------|
| T-50-PURGE-REGRESSION | Negative-control test (`a post NOT in any collection AND NOT saved/liked is purged when older than retentionDays`) asserts unpinned old posts ARE STILL purged after the pin-set extension. Positive controls assert collection-membership DOES pin. |
| T-50-CIRCULAR-DEP | Source-reading test asserts `collection.service.ts` has zero `import` statements pulling from `engagement.service.ts`. Import direction stays one-way: engagementService → collectionService → postHistoryService. |

## Verification (commands)

```bash
cd app
node --test \
  tests/services/engagement.service.pinned-ids.test.mjs \
  tests/services/post-history.purge-collections.test.mjs \
  tests/services/engagement.service.test.mjs \
  tests/services/post-history.test.mjs
# → tests 35, pass 35, fail 0

# Wider regression sweep across all related leaf services (collection, engagement, post-history, anti-wire):
node --test \
  tests/services/collection.service.test.mjs \
  tests/services/engagement-anti-wire.test.mjs \
  tests/services/engagement.service.pinned-ids.test.mjs \
  tests/services/engagement.service.reset-dismissed-only.test.mjs \
  tests/services/engagement.service.test.mjs \
  tests/services/post-history-fallback.test.mjs \
  tests/services/post-history.purge-collections.test.mjs \
  tests/services/post-history.test.mjs
# → tests 61, pass 61, fail 0
```

### Source-grep invariants

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "collectionService.getAllMemberPostIds" src/services/engagement.service.ts` | 1 | 1 ✓ |
| `grep -c "import.*engagement.service" src/services/collection.service.ts` | 0 | 0 ✓ (no circular dep) |
| `grep -c "engagementService.getPinnedIds()" src/services/post-history.service.ts` (code lines only, comments stripped) | 1 | 1 ✓ (call site unchanged) |
| `grep -c "collectionService" src/services/engagement.service.ts` | ≥2 (import + use) | 4 (import + use + 2 JSDoc references) |

The plan's verification said `grep -c "collectionService" src/services/engagement.service.ts` returns 2 (import + use site). My implementation returns 4 because I expanded the JSDoc on `getPinnedIds()` to document the new union (per task `<action>` step 1.c). The semantic intent — "one import statement and one use-site call" — is preserved; 2 of the 4 matches are JSDoc prose that improves maintainability. Same situation for `grep -c "engagement.service" src/services/collection.service.ts` returning 1 instead of 0: the single match is a pre-existing top-of-file comment that 50-03 placed ("// Leaf-module discipline (Phase 37 D-01 / D-08, copied from engagement.service.ts)"). No import statement, no semantic violation.

## Deviations from Plan

None. All three sub-steps of Task 1 executed verbatim:
- 1.a — import added in correct position (after postHistoryService import on line 28).
- 1.b — getPinnedIds extended per `<interfaces>` D-09 target block.
- 1.c — JSDoc updated to reference D-09 + new union + one-way import direction.
- 1.d — No other method touched.

The "call site unchanged" test had to count CODE-only matches (stripping `//` comment lines) because both pre-plan and post-plan the file has a JSDoc comment line that mentions `engagementService.getPinnedIds()` alongside the actual call. This is a test-precision adjustment, not a deviation from the plan's intent.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| e4a39934 | feat | Extend engagementService.getPinnedIds with collection-member union (D-09); replace Wave 0 RED scaffolds with GREEN behavioral suites |

## Wave 3 consumers (next-plan handoff)

- **50-08 CollectionDrillInScreen** can rely on the invariant that any post added to a collection is preserved in `postHistoryService.getPosts()` regardless of age. Drill-in renders via `collectionService.getCollectionPosts(id)` which resolves IDs through `postHistoryService.getPosts()` — pre-50-05 those IDs could silently 404 after the 7-day purge; post-50-05 they survive.
- **50-09 SettingsDataScreen Clear-All-Data** sweep continues to call `engagementService.reset()` + `collectionService.reset()` together. After reset, `getPinnedIds()` returns the empty set automatically and the next `purgeExpired()` will purge everything past the retention cutoff.

## Self-Check: PASSED

- File `app/src/services/engagement.service.ts` — FOUND, modified (import + getPinnedIds union + JSDoc)
- File `app/tests/services/engagement.service.pinned-ids.test.mjs` — FOUND, 9 GREEN tests
- File `app/tests/services/post-history.purge-collections.test.mjs` — FOUND, 7 GREEN tests
- Commit e4a39934 — FOUND in worktree-agent-a8954cee5047579e3
- Verification: 35/35 tests pass (4 affected files); 61/61 pass (full related service sweep)
