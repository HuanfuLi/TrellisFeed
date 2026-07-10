---
phase: 50-retrieval-and-library-foundation
plan: 02
subsystem: i18n + test-scaffolding
tags: [i18n, locales, wave-0, red-scaffold, validation-gate]
requires:
  - 27-add-i18n-l10n-support (i18next + bundle-parity test infra)
  - 43-engagement-ui (saved namespace shape extended here)
provides:
  - "library.* top-level i18n namespace (en/zh/es/ja parity)"
  - "saved.tabs.collections + saved.empty.{collectionsTitle,collectionsBody} (all 4 locales)"
  - "i18n.d.ts type augmentation comment documents library.* surface"
  - "10 deterministic-RED Wave-0 test scaffolds across services/components/screens/events"
  - "library.collections.notFound canonical EN copy ('Collection not found') — owned by this plan, consumed by 50-08"
affects:
  - "Wave 1+ plans (50-03..50-09) inherit a green-light test gate per task"
tech_stack:
  added: []
  patterns:
    - "node:test assert.fail RED-scaffold (zero skips, deterministic failure messages)"
    - "Source-reading invariant tests anchored on unique i18n-key fingerprints to avoid false-positive matches against pre-existing code"
key_files:
  created:
    - app/tests/services/collection.service.test.mjs
    - app/tests/services/library-search.service.test.mjs
    - app/tests/services/engagement.service.pinned-ids.test.mjs
    - app/tests/services/post-history.purge-collections.test.mjs
    - app/tests/components/CollectionPickerSheet.test.mjs
    - app/tests/components/HighlightedText.test.mjs
    - app/tests/screens/SavedScreen.collections-tab.test.mjs
    - app/tests/screens/SavedScreen.search-scope.test.mjs
    - app/tests/screens/CollectionDrillInScreen.test.mjs
    - app/tests/events/event-bus.collections-changed.test.mjs
  modified:
    - app/src/locales/en.json
    - app/src/locales/zh.json
    - app/src/locales/es.json
    - app/src/locales/ja.json
    - app/src/locales/i18n.d.ts
decisions:
  - "library.collections.notFound key owned by 50-02 (single source of truth across all 4 bundles). 50-08 references but MUST NOT re-add."
  - "i18n.d.ts requires no interface edits — auto-derives from `typeof en`. Updated only the comment block to document the new namespace and saved-extension."
  - "Test scaffolds bind to unique i18n-key fingerprints (e.g., `library.search.placeholder`, `library.collections.notFound`) so source-reading assertions cannot incidentally pass against pre-existing code in SavedScreen.tsx."
  - "All scaffolds use assert.fail (NOT it.skip / describe.skip) per Phase 49 lesson — skip-based RED was previously rejected by the iter-1 checker."
metrics:
  completed: 2026-05-18
  duration_minutes: 25
  tasks_completed: 4
  failing_assertions_introduced: 54
  i18n_keys_added_en: 39
  i18n_total_locale_file_additions: 156  # 39 keys × 4 locales
---

# Phase 50 Plan 02: i18n + Wave-0 Test Scaffolds Summary

One-liner: New `library.*` namespace and 10 deterministic-RED test files land in a single atomic commit chain so Wave 1+ executors inherit a green-light gate per task and the bundle-parity CI gate stays passing.

## Objective

Two CLAUDE.md rules drove this plan being its own dedicated unit:

1. **"Every new string MUST land in en/zh/es/ja in the SAME PR."** Translating ~40 new `library.*` keys before any Wave 1 component code referenced them prevents bundle-parity test failures cascading through the rest of the phase.
2. **Validation Nyquist contract** — RESEARCH §"Wave 0 Gaps" plus VALIDATION Wave 0 Requirements enumerate 10 stubs that must be in RED state before Wave 1 starts so each task has a deterministic `node --test path/to/file.mjs` command to run.

## What Was Built

### Task 1 — Canonical EN bundle (commit bad73e38)

Added new top-level `library` namespace to `app/src/locales/en.json` with four sub-namespaces sourced verbatim from `50-UI-SPEC.md §"Full i18n key inventory"`:

- `library.search.*` — placeholder, clearAria, noMatches (with `{{tab}}` interpolation), clearFilters
- `library.filters.date.*` — label + today / last7 / last30 / allTime
- `library.filters.concept.*` — label, placeholder, emptyTitle, emptyBody
- `library.filters.source.*` — label, placeholder, emptyTitle
- `library.collections.*` — 13 keys incl. ICU plurals (`postCount_one` / `postCount_other`), `notFound`, `toast.{added,addedMultiple,removed,renamed,deleted}`, kebabAria, deleteConfirm with `{{name}}`, removeFromCollection, etc.
- `library.savePicker.*` — title, implicitSaved, createNew, createPlaceholder, done, three name-validation errors (nameEmpty, nameTooLong, nameDuplicate)

Plus extended existing `saved` namespace:
- `saved.tabs.collections` = `"Collections"`
- `saved.empty.collectionsTitle` = `"No collections yet"`
- `saved.empty.collectionsBody` = `"Save a post to create your first collection"`

The `library.collections.notFound` key is **owned by this plan** (EN value: `"Collection not found"`). It is consumed by `CollectionDrillInScreen` (plan 50-08) but 50-08 must NOT re-add it — single source of truth.

### Task 2 — zh / es / ja parity translations (commit a71d029e)

Same key structure introduced into `zh.json`, `es.json`, `ja.json` with locale-appropriate translations following CLAUDE.md §i18n "What NOT to translate":

- `{{name}}`, `{{count}}`, `{{collection}}`, `{{tab}}` placeholders preserved verbatim
- "Trellis" not translated (proper noun)
- ICU plural key suffixes `_one`/`_other` preserved (Japanese uses one form for both values — standard i18n convention)
- `library.collections.notFound` per-locale: zh `"未找到收藏夹"`, es `"Colección no encontrada"`, ja `"コレクションが見つかりません"`

`bundle-parity.test.mjs` passes for all four locales (2 tests pass / 0 fail).

### Task 3 — i18n.d.ts type augmentation comment (commit 20ae8b74)

The existing augmentation derives types from `typeof en` so adding keys to en.json automatically propagates into the typed `t()` surface — **no interface edits needed**. Updated only the documentation comment block to reference the new `library.*` namespace (distinguishing from the unrelated nested `review.library.*` flashcard namespace) and the `saved.tabs.collections` + `saved.empty.collections{Title,Body}` extensions, so future devs understand the structure.

### Task 4 — 10 RED test scaffolds (commit 784f630c)

Each file is a real failing test (`assert.fail(...)` referencing the plan that will turn it green) — not `describe.skip` / `it.skip`. Pattern: localStorage shim + dynamic-import for service tests; readFileSync + source-grep for component / screen tests; bare event-bus runtime for the event test.

| File | Behaviors | Turned GREEN by |
|------|-----------|-----------------|
| `app/tests/services/collection.service.test.mjs` | createCollection CRUD + persistence + name validation (empty/>50/case-insensitive dedup); addPost/removePost idempotence + COLLECTIONS_CHANGED emission; renameCollection emit kind:'rename'; deleteCollection emit kind:'delete'; getAllMemberPostIds union; reset() emits NOTHING (anti-wire) | **plan 50-03** |
| `app/tests/services/library-search.service.test.mjs` | Fuse index ≤250 posts; title match; body match at pos≥200 (ignoreLocation:true — RESEARCH Pitfall 1); relevance sort; date filter (today/last7/last30/all); query 200-char cap (T-50-QUERY-DOS); multi-field index over concept+source | **plan 50-04** |
| `app/tests/services/engagement.service.pinned-ids.test.mjs` | getPinnedIds() returns union saved ∪ liked ∪ collectionService.getAllMemberPostIds() (CONTEXT D-09) | **plan 50-05** |
| `app/tests/services/post-history.purge-collections.test.mjs` | Collection-pinned post survives purgeExpired beyond retentionDays; unpinned post is purged; getPinnedIds() called once per invocation (perf guard) | **plan 50-05** |
| `app/tests/components/CollectionPickerSheet.test.mjs` | `<BottomSheet compact>`; implicit Saved row uses engagementService.isSaved; collection writes go through collectionService.addPost/removePost (anti-wire); COLLECTIONS_CHANGED surfaced; **no dangerouslySetInnerHTML** (T-50-XSS-NAME) | **plan 50-06** |
| `app/tests/components/HighlightedText.test.mjs` | Default React component export; wraps matched runs in `<mark>` JSX; uses `.slice` / `.substring` (offset-based, not regex.replace splice); **no dangerouslySetInnerHTML** (T-50-XSS-HL) | **plan 50-06** |
| `app/tests/screens/SavedScreen.collections-tab.test.mjs` | Tab union includes `'collections'` literal; references `saved.tabs.collections`; subscribes to COLLECTIONS_CHANGED via eventBus.subscribe | **plan 50-09** |
| `app/tests/screens/SavedScreen.search-scope.test.mjs` | Search bar references `library.search.placeholder` (fingerprint) + `minWidth:0` + `flex:1` (CLAUDE.md ChatInput rule); `new Fuse(` inside useMemo (Pitfall 3); `ignoreLocation: true` (Pitfall 1); `query` state + `fuse.search(query)`; clearTimeout + setTimeout debounce | **plan 50-09** |
| `app/tests/screens/CollectionDrillInScreen.test.mjs` | Default component export; imports Header with `backTo="/saved"`; subscribes to COLLECTIONS_CHANGED; navigates to /saved on open-collection delete; renders SavedRow; references `library.collections.notFound` | **plan 50-08** |
| `app/tests/events/event-bus.collections-changed.test.mjs` | Runtime: emit COLLECTIONS_CHANGED → subscriber receives full payload (kind: 'create' / 'add-post'); unsubscribe stops further deliveries | **plan 50-03** |

Total: 54 failing assertions across 10 files. Verified via `node --test <file>` per file — 0 incidental passes against pre-existing code (false-positive on SS-01 / SS-04 was caught during scaffold and re-bound to unique fingerprints: `library.search.placeholder` for SS-01, `fuse.search(` + `query` state for SS-04).

## Deviations from Plan

None. Plan was executed exactly as written:

- Task 1 verify script (`require('./src/locales/en.json')` + 6 nested-path checks) ran clean, exit 0.
- Task 2 verify (`node --test tests/locales/bundle-parity.test.mjs`) reports `pass 2 / fail 0`.
- Task 3 verify (`grep -c library src/locales/i18n.d.ts`) returns `4` (≥1 expected).
- Task 4 verify (per-file existence) confirms 10 files present.

One scaffold-strengthening change during Task 4 (not a deviation from plan intent, but worth noting): SS-01 and SS-04 in `SavedScreen.search-scope.test.mjs` initially matched pre-existing `flex: 1` / `activeTab === 'saved'` patterns in `SavedScreen.tsx` (unrelated layout/tab-switch code). The plan requires every assertion to be a real failing test — so both were re-anchored to **unique fingerprints** that only the 50-09 search wiring will introduce (`library.search.placeholder` i18n key reference for SS-01; `fuse.search(` + `query` state for SS-04). This keeps the spirit of Phase 49's "no false-positive RED" rule.

## Authentication Gates

None — pure file authoring; no network / auth surface touched.

## Threat Model Coverage

| Threat | File enforcing | Status |
|--------|---------------|--------|
| T-50-XSS-NAME | `CollectionPickerSheet.test.mjs` `CPS-XSS` test | RED scaffold; passes once 50-06 lands the component with no `dangerouslySetInnerHTML` |
| T-50-XSS-HL | `HighlightedText.test.mjs` `HL-XSS` test | RED scaffold; passes once 50-06 lands `<mark>` JSX renderer |
| T-50-QUERY-DOS | `library-search.service.test.mjs` query-length-cap test | RED scaffold; passes once 50-04 enforces 200-char cap before Fuse |

## Files

**Created (10):**
- `app/tests/services/collection.service.test.mjs`
- `app/tests/services/library-search.service.test.mjs`
- `app/tests/services/engagement.service.pinned-ids.test.mjs`
- `app/tests/services/post-history.purge-collections.test.mjs`
- `app/tests/components/CollectionPickerSheet.test.mjs`
- `app/tests/components/HighlightedText.test.mjs`
- `app/tests/screens/SavedScreen.collections-tab.test.mjs`
- `app/tests/screens/SavedScreen.search-scope.test.mjs`
- `app/tests/screens/CollectionDrillInScreen.test.mjs`
- `app/tests/events/event-bus.collections-changed.test.mjs`

**Modified (5):**
- `app/src/locales/en.json` (+67 lines, -2 lines) — `library.*` + `saved` extension
- `app/src/locales/zh.json` (+67 lines, -2 lines) — translations
- `app/src/locales/es.json` (+67 lines, -2 lines) — translations
- `app/src/locales/ja.json` (+67 lines, -2 lines) — translations
- `app/src/locales/i18n.d.ts` (+7 lines, -1 line) — comment documentation

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `bad73e38` | feat(50-02): add library.* namespace + saved.collections to en.json |
| 2 | `a71d029e` | feat(50-02): translate library.* + saved.collections into zh/es/ja |
| 3 | `20ae8b74` | docs(50-02): document library.* namespace in i18n.d.ts type augmentation |
| 4 | `784f630c` | test(50-02): scaffold 10 Wave-0 RED test files for Phase 50 wiring |

## Self-Check: PASSED

All 16 claimed files exist on disk. All 4 task commits (`bad73e38`, `a71d029e`, `20ae8b74`, `784f630c`) are reachable from HEAD. `bundle-parity.test.mjs` passes (2/0). All 10 scaffold files run RED via `node --test` (54 failing assertions / 0 incidental passes / 0 skips).
