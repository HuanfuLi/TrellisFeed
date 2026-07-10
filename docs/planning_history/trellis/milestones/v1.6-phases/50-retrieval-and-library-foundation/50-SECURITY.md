---
phase: 50
slug: retrieval-and-library-foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-19
updated: 2026-05-19
register_authored_at_plan_time: true
---

# Phase 50 - Security

Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user input -> collection name | User-supplied collection names are validated by `collectionService` and rendered through React text nodes. | Free-text local-only collection metadata |
| localStorage -> service | Collection state is parsed from localStorage and may be malformed by browser inspector or extension tampering. | Local JSON state |
| user input -> search query | Saved/library search passes free-text queries to Fuse.js in memory only. | Search string |
| npm registry -> app bundle | Phase adds Fuse.js as a runtime dependency. | Third-party package code |
| collectionService -> engagementService -> postHistoryService | Collection membership participates in retention pinning without a reverse dependency. | Post IDs |
| Fuse match indices -> JSX | Fuse result indices are converted to highlighted React nodes. | Numeric match offsets and post text |
| UI sheet state -> service writes | Picker, long-press menu, rename/delete sheets, and drill-in screens commit local collection actions. | User interaction state and local mutations |
| Header DOM positioning | Drill-in header must avoid ancestor containing-block regressions. | Fixed header DOM |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-50-XSS-NAME | Tampering / XSS | Collection names in picker, drill-in, collections tab, toasts | mitigate | Validate names at service boundary and render as React text children; no HTML injection prop in app source. | closed | `collection.service.ts:114`, `CollectionPickerSheet.tsx:346`, `CollectionDrillInScreen.tsx:405`, `SavedScreen.tsx:1372`; `rg "dangerouslySetInnerHTML\\s*=" app/src` returned no source matches. |
| T-50-XSS-HL | Tampering / XSS | Highlighted search matches | mitigate | `HighlightedText` slices text by numeric Fuse indices and wraps matched runs in `<mark>` JSX children. | closed | `HighlightedText.tsx:41`, `HighlightedText.tsx:59`, `HighlightedText.tsx:68`, `SavedScreen.tsx:202`, `SavedScreen.tsx:234`. |
| T-50-QUERY-DOS | Denial of Service | Fuse.js search query length | mitigate | Cap all search queries at 200 chars before Fuse receives input. | closed | `library-search.service.ts:54`, `library-search.service.ts:113`, `library-search.service.ts:132`, `SavedScreen.tsx:587`. |
| T-50-QUOTA | Denial of Service | `localStorage.setItem` for collections | accept | Silent localStorage quota drop matches existing local-only precedent; user can recover via clear data. | closed | Accepted risk R-50-QUOTA; `collection.service.ts:84`. |
| T-50-ORPHAN | Spoofing / Stale Data | Collection `postIds` after post-history purge | mitigate | Resolve post IDs through post history at read time and silently drop missing IDs. | closed | `collection.service.ts:92`, `collection.service.ts:275`, `CollectionDrillInScreen.tsx:225`, `SavedScreen.tsx:570`. |
| T-50-MALFORMED-JSON | Tampering | `trellis_collections_v1` localStorage JSON | mitigate | `loadState()` wraps parse and shape checks in try/catch, returning fresh state on failure. | closed | `collection.service.ts:69`, `collection.service.ts:73`, `collection.service.ts:77`, `collection.service.ts:79`. |
| T-50-SUPPLY-CHAIN | Tampering | `fuse.js` package | mitigate | Fuse.js is pinned in app dependencies and lockfile with integrity metadata and no transitive dependencies in its lockfile block. | closed | `package.json:28`, `package-lock.json:5082`. |
| T-50-FUSE-CRASH | Availability | Fuse search throws on malformed input | accept | Service-level try/catch was explicitly accepted by plan 50-04 as unnecessary for local Fuse string search. | closed | Accepted risk R-50-FUSE-CRASH; `library-search.service.ts:128`. |
| T-50-PURGE-REGRESSION | Spoofing / Data Loss | Retention purge pin set | mitigate | `engagementService.getPinnedIds()` includes collection member IDs, and `purgeExpired()` only preserves pinned or fresh posts. Positive and negative controls exist. | closed | `engagement.service.ts:224`, `collection.service.ts:286`, `post-history.service.ts:60`, `post-history.purge-collections.test.mjs:69`, `post-history.purge-collections.test.mjs:85`. |
| T-50-CIRCULAR-DEP | Availability | Collection/engagement module load order | mitigate | Import direction remains one-way: `engagementService` imports `collectionService`; `collectionService` has no `engagement.service` import. | closed | `engagement.service.ts:29`, `engagement.service.ts:220`; `rg "import .*engagement\\.service|from ['\\\"].*engagement\\.service" app/src/services/collection.service.ts` returned no matches. |
| T-50-PICKER-RACE | Race / Lost Update | Collection picker membership toggles | mitigate | Picker snapshots saved/member state on open, keeps draft state local, and writes only from `handleDone()` by diffing original and draft sets. | closed | `CollectionPickerSheet.tsx:114`, `CollectionPickerSheet.tsx:122`, `CollectionPickerSheet.tsx:145`, `CollectionPickerSheet.tsx:230`, `CollectionPickerSheet.tsx:254`. |
| T-50-SHEET-FLASH | Availability / UX | LongPressMenu -> CollectionPickerSheet transition | mitigate | Save row calls `onOpenCollectionPicker(postId)` before `onClose()`. | closed | `LongPressMenu.tsx:106`, `LongPressMenu.tsx:111`, `LongPressMenu.tsx:112`. |
| T-50-REMOVE-DESTRUCTIVE | Information Disclosure / Data Loss | Remove-from-collection row | accept | Remove only clears collection membership, leaves Saved/History intact, and exposes Undo. | closed | Accepted risk R-50-REMOVE-DESTRUCTIVE; `LongPressMenu.tsx:151`, `LongPressMenu.tsx:159`, `LongPressMenu.tsx:217`. |
| T-50-HEADER-PORTAL | Availability / UX | Collection drill-in header positioning | mitigate | Drill-in outer container uses only flex/min-height; shared Header portals to `document.body` outside non-swipe-tab screens. | closed | `CollectionDrillInScreen.tsx:402`, `Header.tsx:39`, `Header.tsx:155`, `CollectionDrillInScreen.test.mjs:146`. |
| T-50-DOUBLE-DELETE | Race / Data Loss | Rapid delete double-tap | accept | `deleteCollection()` is idempotent on missing IDs; second delete no-ops. | closed | Accepted risk R-50-DOUBLE-DELETE; `collection.service.ts:197`, `collection.service.ts:203`. |
| T-50-PERF-INDEX | Availability / UX | Fuse index construction | mitigate | SavedScreen builds the Fuse index inside `useMemo` keyed on active tab and corpus identity. | closed | `SavedScreen.tsx:575`, `SavedScreen.tsx:580`, `SavedScreen.tsx:584`. |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-50-QUOTA | T-50-QUOTA | Collection writes are local-only; silent quota drop matches existing engagement/history service behavior and the user can recover via clear data. | 50-03 plan threat model | 2026-05-19 |
| R-50-FUSE-CRASH | T-50-FUSE-CRASH | Fuse search is local string search; plan 50-04 explicitly accepts no service-level try/catch for malformed input. | 50-04 plan threat model | 2026-05-19 |
| R-50-REMOVE-DESTRUCTIVE | T-50-REMOVE-DESTRUCTIVE | Remove-from-collection is non-destructive because the post remains in Saved/History; Undo covers accidental taps. | 50-07 plan threat model | 2026-05-19 |
| R-50-DOUBLE-DELETE | T-50-DOUBLE-DELETE | Rapid duplicate delete is bounded by an idempotent service no-op; worst case is duplicate toast feedback. | 50-08 plan threat model | 2026-05-19 |

---

## Summary Threat Flags

| Source | Flag | Resolution |
|--------|------|------------|
| 50-03-SUMMARY.md | None; service-boundary threats were reported mitigated. | Covered by register rows T-50-XSS-NAME, T-50-QUOTA, T-50-ORPHAN, T-50-MALFORMED-JSON. |
| 50-04-SUMMARY.md | T-50-PERF-INDEX was research-listed for later SavedScreen profiling. | Mapped to plan 50-09 and verified closed as T-50-PERF-INDEX. |
| 50-09-SUMMARY.md | None; search, highlight, orphan, perf-index, and collection-name routes were reported honored. | Covered by register rows T-50-XSS-HL, T-50-QUERY-DOS, T-50-ORPHAN, T-50-PERF-INDEX, T-50-XSS-NAME. |
| Remaining summaries | No unregistered security-relevant threat flags found. | No action required. |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-19 | 16 | 16 | 0 | Codex / gsd-secure-phase |

## Security Audit 2026-05-19

| Metric | Count |
|--------|-------|
| Threats found | 16 |
| Closed | 16 |
| Open | 0 |
| Accepted risks documented | 4 |
| Unregistered flags | 0 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-19
