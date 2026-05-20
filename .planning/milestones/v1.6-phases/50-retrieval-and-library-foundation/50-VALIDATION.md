---
phase: 50
slug: retrieval-and-library-foundation
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
updated: 2026-05-19
---

# Phase 50 - Validation Strategy

Per-phase validation contract for retrieval and library foundation work.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` |
| Config file | `app/package.json` test scripts; source-reading and service tests under `app/tests/**/*.test.mjs` |
| Quick run command | `cd app && node --test tests/services/collection.service.test.mjs tests/services/library-search.service.test.mjs` |
| Phase 50 run command | `cd app && node --test tests/services/collection.service.test.mjs tests/events/event-bus.collections-changed.test.mjs tests/types.collection.test.mjs tests/services/library-search.service.test.mjs tests/services/engagement.service.pinned-ids.test.mjs tests/services/post-history.purge-collections.test.mjs tests/components/HighlightedText.test.mjs tests/components/CollectionPickerSheet.test.mjs tests/components/CollectionPickerSheet.no-refresh.test.mjs tests/components/FilterPickerSheet.test.mjs tests/components/LongPressMenu.test.mjs tests/screens/CollectionDrillInScreen.test.mjs tests/screens/SavedScreen.test.mjs tests/screens/SavedScreen.collections-tab.test.mjs tests/screens/SavedScreen.search-scope.test.mjs tests/screens/SavedScreen.chip-blur-race.test.mjs tests/screens/SavedScreen.tab-preserves-query.test.mjs tests/components/BottomSheet.test.mjs tests/components/bottom-sheet-no-bare-autofocus.test.mjs tests/hooks/useLongPress.test.mjs` |
| Full suite command | `cd app && npm test` |
| Estimated runtime | <1s for phase slice; full suite varies |

---

## Sampling Rate

- After every task commit: run the per-file test added or touched by that task.
- After every plan wave: run the affected phase slice plus `cd app && npm test` when unrelated failures are not already known.
- Before `$gsd-verify-work`: run the phase-50 slice and document any full-suite failures outside phase scope.
- Max feedback latency: <10s for per-file checks; <60s for the phase-50 slice.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------|-------------------|-------------|--------|
| 50-01 | 50-01 | 1 | RETRIEVE-02 | T-50-XSS-NAME | type/source | `cd app && node --test tests/types.collection.test.mjs tests/events/event-bus.collections-changed.test.mjs` | yes | green |
| 50-02 | 50-02 | 0 | RETRIEVE-01 / RETRIEVE-02 | T-50-XSS-NAME / T-50-XSS-HL / T-50-QUERY-DOS | wave-0 scaffold | Covered by downstream green rows 50-03 through 50-09 | yes | green |
| 50-03 | 50-03 | 1 | RETRIEVE-02 | T-50-XSS-NAME / T-50-QUOTA / T-50-ORPHAN / T-50-MALFORMED-JSON | unit | `cd app && node --test tests/services/collection.service.test.mjs tests/events/event-bus.collections-changed.test.mjs` | yes | green |
| 50-04 | 50-04 | 1 | RETRIEVE-01 | T-50-QUERY-DOS / T-50-SUPPLY-CHAIN | unit | `cd app && node --test tests/services/library-search.service.test.mjs` | yes | green |
| 50-05 | 50-05 | 2 | RETRIEVE-02 | T-50-PURGE-REGRESSION / T-50-CIRCULAR-DEP | unit/integration | `cd app && node --test tests/services/engagement.service.pinned-ids.test.mjs tests/services/post-history.purge-collections.test.mjs` | yes | green |
| 50-06 | 50-06 | 2 | RETRIEVE-01 / RETRIEVE-02 | T-50-XSS-NAME / T-50-XSS-HL / T-50-PICKER-RACE | component/source | `cd app && node --test tests/components/HighlightedText.test.mjs tests/components/CollectionPickerSheet.test.mjs tests/components/FilterPickerSheet.test.mjs` | yes | green |
| 50-07 | 50-07 | 3 | RETRIEVE-02 | T-50-SHEET-FLASH / T-50-REMOVE-DESTRUCTIVE | component/source | `cd app && node --test tests/components/LongPressMenu.test.mjs` | yes | green |
| 50-08 | 50-08 | 3 | RETRIEVE-02 | T-50-XSS-NAME / T-50-ORPHAN / T-50-HEADER-PORTAL / T-50-DOUBLE-DELETE | screen/source | `cd app && node --test tests/screens/CollectionDrillInScreen.test.mjs tests/components/LongPressMenu.test.mjs tests/services/collection.service.test.mjs` | yes | green |
| 50-09 | 50-09 | 3 | RETRIEVE-01 / RETRIEVE-02 | T-50-XSS-HL / T-50-QUERY-DOS / T-50-ORPHAN / T-50-PERF-INDEX | screen/source | `cd app && node --test tests/screens/SavedScreen.test.mjs tests/screens/SavedScreen.collections-tab.test.mjs tests/screens/SavedScreen.search-scope.test.mjs` | yes | green |
| 50-10 | 50-10 | gap | RETRIEVE-02 | T-50-PICKER-RACE | component/source | `cd app && node --test tests/components/CollectionPickerSheet.no-refresh.test.mjs tests/components/CollectionPickerSheet.test.mjs` | yes | green |
| 50-11 | 50-11 | gap | RETRIEVE-01 | T-50-QUERY-DOS | unit | `cd app && node --test tests/services/library-search.service.test.mjs` | yes | green |
| 50-12 | 50-12 | gap | RETRIEVE-01 | - | screen/source | `cd app && node --test tests/screens/SavedScreen.chip-blur-race.test.mjs tests/screens/SavedScreen.tab-preserves-query.test.mjs tests/screens/SavedScreen.search-scope.test.mjs tests/screens/SavedScreen.collections-tab.test.mjs` | yes | green |
| 50-13 | 50-13 | gap | RETRIEVE-01 | - | component/source | `cd app && node --test tests/components/BottomSheet.test.mjs` | yes | green |

---

## Wave 0 Requirements

- [x] `app/tests/services/collection.service.test.mjs` - collectionService CRUD, validation, persistence, orphan handling
- [x] `app/tests/services/engagement.service.pinned-ids.test.mjs` - saved / liked / collection pin union
- [x] `app/tests/services/post-history.purge-collections.test.mjs` - collection membership pins posts against purge
- [x] `app/tests/services/library-search.service.test.mjs` - Fuse index, relevance, date filter, query cap, G4 regression coverage
- [x] `app/tests/screens/SavedScreen.collections-tab.test.mjs` - Collections tab and event subscription
- [x] `app/tests/screens/SavedScreen.search-scope.test.mjs` - active-tab scoped search and memoized Fuse index
- [x] `app/tests/components/CollectionPickerSheet.test.mjs` - picker shell, pre-check, create, XSS, commit-on-Done
- [x] `app/tests/components/HighlightedText.test.mjs` - `<mark>` rendering without HTML injection
- [x] `app/tests/components/FilterPickerSheet.test.mjs` - compact picker behavior and no raw HTML
- [x] `app/tests/events/event-bus.collections-changed.test.mjs` - COLLECTIONS_CHANGED payload variants
- [x] `app/tests/types.collection.test.mjs` - Collection type and event union source contract
- [x] `app/tests/locales/bundle-parity.test.mjs` - existing locale parity guard for new keys

---

## Manual-Only Verifications

Automated coverage is complete for Nyquist purposes. These remain manual because they require mobile gesture, animation, or device scroll behavior that Node source tests cannot observe reliably.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collection picker animation | RETRIEVE-02 | React 19 batching and 60fps sheet transition timing need device/browser observation. | Long-press a feed tile, tap Save to..., confirm CollectionPickerSheet slides up with Saved pre-checked and no blank frame. |
| Collections tab drill-in | RETRIEVE-02 | Route transition and portaled Header rendering are visual. | Open `/saved`, switch to Collections, tap a collection, confirm `/collections/:id` opens with the collection name in the Header. |
| Search body highlight | RETRIEVE-01 | Visual contrast and snippet placement need eye-check. | Search for a body term past char 60, confirm the snippet centers on the match and `<mark>` highlight is visible. |
| Filter chip tap with focused search | RETRIEVE-01 | Pointer/mouse preventDefault timing varies across browser and Capacitor WebView. | Focus the search bar with empty query, tap Concept/Source/Date, confirm the picker opens without the chip row collapsing first. |
| Remove-from-collection Undo | RETRIEVE-02 | Long-press timing and toast action UX need interaction. | In collection drill-in, long-press a post, tap Remove from collection, confirm post disappears, tap Undo, confirm it returns. |
| FilterPickerSheet scroll boundary | RETRIEVE-01 | Overscroll containment is a runtime mobile WebView behavior, not implemented by Node/JSDOM. | Open a populated picker sheet on device, flick-scroll past top and bottom, confirm hard stop and no content bleed beyond rounded mask. |

---

## Validation Audit 2026-05-19

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |
| Manual-only | 6 |

### Gaps Resolved

| Gap | Resolution | File |
|-----|------------|------|
| LongPressMenu source tests expected exact `savePost(postId)` / `likePost(postId)` strings after G14 added snapshot persistence. | Relaxed assertions to require direct engagement calls while allowing an optional snapshot argument. | `app/tests/components/LongPressMenu.test.mjs` |
| SavedScreen chip blur-race test expected stale `6px 12px` padding after re-UAT changed G7 to `10px 14px`. | Updated assertion and test name to match the G7 vertical-padding follow-up. | `app/tests/screens/SavedScreen.chip-blur-race.test.mjs` |

### Verification Run

| Command | Result |
|---------|--------|
| `cd app && node --test tests/components/LongPressMenu.test.mjs` | 13 pass / 0 fail |
| Phase 50 validation slice listed in Test Infrastructure | 164 pass / 0 fail |
| `cd app && npm test` | Fails outside this validation change: existing LongPressMenu failures fixed here; remaining failures observed in trellis-state / trellis-replant date expectations during this session. |

---

## Validation Sign-Off

- [x] All tasks have automated verification or completed Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all phase MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s for the phase-50 validation slice
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Manual-only device checks documented separately from automated coverage

**Approval:** verified 2026-05-19
