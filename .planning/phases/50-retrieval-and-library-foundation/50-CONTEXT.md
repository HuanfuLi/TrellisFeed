# Phase 50: Retrieval and Library Foundation - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Local-first retrieval surface for posts. Two requirements:

- **RETRIEVE-01** — User can search Saved, Liked, and History items by title, body, concept, source, and date, then reopen the original post.
- **RETRIEVE-02** — User can tag or bookmark posts with local-first metadata that persists across days and supports filtering.

**Per operator clarification during discussion:**
- "Bookmark" = the existing Save primitive (no new field). Save/Bookmark stays **post-only** — concept anchors get no new save/bookmark affordance.
- "Tag" terminology is dropped. Replaced with **"Collection"** (YouTube-playlist analogy). Saved posts can belong to one or more user-defined collections. Collections themselves are the local-first metadata layer RETRIEVE-02 demands; concept-level filtering happens via the existing `post.sourceQuestionIds[0]` identity, not via tags on concepts.
- The search/filter surface extends the existing `/saved` (Library) screen rather than promoting a new bottom-nav tab.

**Out of scope for Phase 50 (by operator decision or roadmap split):**
- Concept dashboard joining Q&As/posts/podcasts/reviews — **Phase 51 (RETRIEVE-03/04)**.
- LLM/TTS payload sanitization for collections — **Phase 53 (PRIVACY-01)**. Collections never leave localStorage in Phase 50.
- Save / bookmark on concept anchors — removed from scope after operator walked back during discussion.
- Advanced tag query language, saved searches — **RETRIEVE-F01** (post-v1.6).
- Cross-device sync of collections/saves — **RETRIEVE-F02** (post-v1.6).
- Embedding-rerank for search — deferred (Fuse.js fuzzy match only).
- Calendar date-range picker, custom Sort toggle — deferred.

</domain>

<decisions>
## Implementation Decisions

### Bookmark vs Save semantics

- **D-01:** "Bookmark" is a synonym for Save, not a new primitive. No `bookmarked[]` field on `engagementService`. The UI label stays "Save" everywhere — "bookmark" is internal vocab only.
- **D-02:** Save/Bookmark is **posts only**. No save/bookmark affordance on concept anchors (graph nodes, AnchorDetailScreen, PlannerScreen rows). Operator framing during discussion: concept-level retrieval is covered by existing concept identity (`post.sourceQuestionIds[0]`) joined with collection membership; a separate "saved concepts" list would duplicate without adding intent.

### Collections (replaces the "tag" concept from REQUIREMENTS.md)

- **D-03:** Drop "tag." Use **"Collection"** — YouTube-style playlist analogy. New `collectionService` leaf module mirroring `engagementService` shape:
  ```
  CollectionsState = {
    collections: { id: string; name: string; postIds: string[]; createdAt: number; updatedAt: number }[]
  }
  ```
  Posts only. A post can belong to multiple collections.

- **D-04:** Save tap **always opens a collection-picker sheet** (no quick-save path). YouTube-faithful — teaches the collection concept by being unavoidable.

- **D-05:** The picker pre-checks an implicit **"Saved"** bucket pinned to the top of the sheet. This implicit bucket maps to the existing `engagementService.saved[]` — no new storage. Tapping Done without changing anything still saves to global Saved (single-tap-save preserved). User can uncheck Saved and pick a custom collection only, or check both.

- **D-06:** Collection management lives in two places:
  1. **Inline `+ New collection`** row at the bottom of the picker sheet (create at save time, YouTube-faithful).
  2. **New "Collections" sub-tab** in `/saved` alongside Saved | Liked | History — fourth tab. Lists collections as chip/row entries; long-press a collection = rename/delete/reorder.

- **D-07:** Collection drill-in view = **compact list mirroring the existing Saved tab layout**. Header kebab for rename/delete/reorder. Long-press a post inside collection = existing `LongPressMenu` with one new row: **"Remove from collection"** (alongside Save/Like/Dismiss).

### History scope

- **D-08:** History (search/Library) corpus is **post-only** in Phase 50. Q&A sessions stay reachable via AskScreen's history drawer; podcasts via `/podcast`; review cards via `/review`. Phase 51's concept dashboard owns the cross-artifact join.

- **D-09:** **Collection membership pins a post against the 7-day rolling history purge.** Extend `engagementService.getPinnedIds()` to union `saved ∪ liked ∪ any-collection-member`. If a user adds a post to "For thesis" but unchecks the implicit Saved, the post still survives purge. Pinning honors operator intent ("they kept it for a reason").

### Search & filter surface

- **D-10:** Search bar lives in the **`/saved` (Library) screen header**, pinned. Filter chips appear **inline only when the search bar has focus or has text** (saves vertical space when user is just browsing tabs). Tabs (Saved | Liked | History | Collections) stay above the search bar — tabs are NOT collapsed into chips.

- **D-11:** **Search scopes to the active tab.** Typing "attention" on the Saved tab returns matches in Saved only; switching to History re-runs the search in History's corpus. Matches Spotify-style search expectation; predictable.

- **D-12:** Secondary filter chips below the search bar: **Concept** (picker sheet listing anchor titles), **Source** (picker for provider/news/video/etc.), **Date** (preset chips only — **Today / Last 7 days / Last 30 days / All time**). Tap a chip → opens picker; active filter renders as filled chip with picked value. No custom date range picker (deferred).

### Search matching & ranking

- **D-13:** Match via **Fuse.js** (fuzzy, typo-tolerant, in-browser). New dependency. Multi-field with weights: **title > body > source** (researcher to confirm exact weights). No embedding-rerank pass in Phase 50.

- **D-14:** **Sort = Fuse relevance when search bar is non-empty; date-desc when empty.** No user-facing Sort toggle.

- **D-15:** **Highlight matched substrings** in title AND in a snippet of body (first ~120 chars around first match). Wrap matched runs in a styled span using Fuse's match indices. Snippet field is added to the search-result card (snippet shown only when search active — otherwise card layout is unchanged).

- **D-16:** **Zero-results state** = centered "No matches in {activeTab}" line + a text-button **"Clear filters"** link that resets search + filter chips and returns to the unfiltered list. No cross-tab "found in History" hint; no "Ask Trellis" fallback (both deferred — risk of scope creep into Phase 51/53).

### Claude's Discretion

These were not asked explicitly because they follow established conventions:

- Storage key naming (`trellis_collections_v1` — matches Phase 39's `trellis_engagement_v1` pattern).
- Leaf-module pattern for `collectionService`: no JSON imports, no `lib/date.ts`, no `react-i18next` — mirrors `engagement.service.ts` exactly.
- Collection name validation: non-empty, ≤50 chars, trim, case-insensitive dedup. Surfaced via inline error in the picker; matches Phase 48 D-16 "hard validation" stance.
- Search debounce ~200ms before running Fuse pass (avoid per-keystroke re-index).
- Force-New-Day behavior for collections: **persist across days, only Clear-All-Data resets** — by analogy to engagementService Phase 39 D-04 (saves persist across days). `SettingsDataScreen` Clear-All extends to reset `collectionService`.
- New event-bus signal `COLLECTIONS_CHANGED { kind: 'create' | 'rename' | 'delete' | 'add-post' | 'remove-post', collectionId }` following ENGAGEMENT_CHANGED / GRAPH_UPDATED precedent (CLAUDE.md "One signal per semantic event"). SavedScreen + collection drill-in subscribe for in-place resync.
- i18n: every new string lands all 4 locale bundles (en/zh/es/ja) in the same PR per Phase 27 rule. New namespaces: `library.search.*`, `library.filters.*`, `library.collections.*`.
- Fuse.js version pinning, bundle-size budget, and per-field weight values are researcher concerns.
- Tile-simplicity preference (Phase 43 feedback) does NOT apply here — SavedScreen is a dedicated retrieval surface; richer interaction is allowed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §RETRIEVE — RETRIEVE-01 + RETRIEVE-02 source text
- `.planning/ROADMAP.md` §"Phase 50: Retrieval and Library Foundation" — domain + 4 success criteria

### Adjacent phase context (load-bearing)
- `.planning/phases/49-graph-correction-ui/49-CONTEXT.md` — operator's iOS-style gesture mental model; "tile-simplicity does NOT apply to interactive surfaces" rule (relevant for SavedScreen extension)
- `.planning/STATE.md` §"Phase 43 complete" — engagement primitives (saved/liked/dismissed), Phase 39 D-04 pin-against-retention rule, LongPressMenu pattern, ENGAGEMENT_CHANGED resync precedent

### Existing services and components (must read before modifying)
- `app/src/services/engagement.service.ts` — leaf-service pattern; saved/liked/dismissed primitives; `getPinnedIds()` returns saved ∪ liked
- `app/src/services/post-history.service.ts` — 7-day rolling history; `purgeExpired()` honors `getPinnedIds()`
- `app/src/screens/SavedScreen.tsx` — Saved | Liked | History tabs at `/saved`; will gain Collections sub-tab + search bar + filter chips
- `app/src/components/LongPressMenu.tsx` — existing 480ms long-press menu; current save/like/dismiss rows; Save row behavior changes (opens picker sheet instead of toggling)
- `app/src/components/BottomSheet.tsx` — sheet primitive with `compact` prop; reuse for collection picker
- `app/src/screens/AnchorDetailScreen.tsx` — `<DetailMenu>` kebab pattern (referenced but NOT modified in Phase 50 since save-concept was descoped)
- `app/src/lib/event-bus.ts` — event bus contract; new `COLLECTIONS_CHANGED` event registered here

### Conventions and load-bearing rules
- `CLAUDE.md` §"Event bus — unified GRAPH_UPDATED" — one-signal-per-semantic-event rule for `COLLECTIONS_CHANGED`
- `CLAUDE.md` §"i18n Workflow" — every new string in all 4 locale bundles same PR; bundle-parity test enforced
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_tile_simplicity_preference.md` — tile-specific only; SavedScreen retrieval surface is allowed to be richer

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`engagementService` (`app/src/services/engagement.service.ts`)** — leaf-service blueprint for `collectionService`. Copy structure: single localStorage key, in-module `loadState()` / `saveState()`, ID-only storage with snapshot resolution via `postHistoryService`. Extend `getPinnedIds()` to union with collection-member IDs.
- **`postHistoryService.purgeExpired()` (`post-history.service.ts:60-71`)** — already honors `engagementService.getPinnedIds()`. Once D-09 extends pin set to include collection members, no further purge-side change needed.
- **`SavedScreen` tabs UI (`screens/SavedScreen.tsx:48`, type `Tab = 'saved' | 'liked' | 'history'`)** — extend to `'saved' | 'liked' | 'history' | 'collections'`. Empty-state, error-state, day-grouping (for History tab) patterns can be reused per-tab.
- **`LongPressMenu.tsx`** — already wires the long-press → menu sheet. New row "Save to collection..." replaces the current direct-toggle Save behavior. State-read-at-render-time pattern preserved.
- **`BottomSheet.tsx` compact prop** — used by `LongPressMenu`; reuse for collection picker sheet (3-6 rows + inline create input).
- **`useLongPress` hook (`hooks/useLongPress.ts`)** — Phase 43 canonical 480ms pattern; reuse for long-press on Collection chips (rename/delete/reorder).
- **Phase 47 `embedText` cache (`app/src/services/...embedding...`)** — available but NOT used in Phase 50 (Fuse.js only). Reserved for a future hybrid-search phase if dogfooding shows Fuse misses semantic queries.

### Established Patterns

- **Leaf-service pattern** (Phase 39): no JSON imports, no `lib/date.ts`, no `react-i18next` in the service module. `collectionService` MUST follow this — otherwise i18n test suite breaks per Phase 27's `tests/locales/bundle-parity.test.mjs` chain.
- **One signal per semantic event** (Phase 32.1 rule 6): `COLLECTIONS_CHANGED` with a discriminating `kind` payload field (not multiple parallel events). Mirrors `GRAPH_UPDATED { kind }` and `ENGAGEMENT_CHANGED { kind, id }`.
- **Dual-effect canonical pattern** (Phase 36-14 / Phase 43-06): always-mounted screens reading from a service whose state can change while another screen is foreground must add a `[location.pathname]` effect to re-sync on navigation. SavedScreen is a sub-screen (not always-mounted), so this is less critical here — but the Collections sub-tab navigation back from a drill-in view should still resync via `COLLECTIONS_CHANGED`.
- **ID-only storage with snapshot resolution** (Phase 39 D-03): collectionService stores `postIds[]`; resolves to `DailyPost[]` via `postHistoryService.getPosts()` at read time. Mirrors `engagementService.getSavedPosts()`.
- **i18n workflow** (Phase 27): every new string lands en/zh/es/ja bundles in the same PR. New namespaces estimated: `library.search.{placeholder,clear,noMatches}`, `library.filters.{concept,source,date,today,last7,last30,allTime}`, `library.collections.{tabTitle,newCollection,save,saved,renamePrompt,deleteConfirm,removeFromCollection,emptyTitle,emptyBody}`, `library.savePicker.{title,createNew,implicitSaved,done}`.

### Integration Points

- **New `collectionService`** consumed by: collection picker sheet (open from LongPressMenu Save row), SavedScreen Collections sub-tab list, collection drill-in view, `SettingsDataScreen` Clear-All-Data path, `engagementService.getPinnedIds()` join.
- **`engagementService.getPinnedIds()` extension** consumed by: `postHistoryService.purgeExpired()` (unchanged at call site; behavior shift is internal to the unioned set).
- **`SavedScreen.tsx` extension**: type expansion (`Tab` adds `'collections'`), search-bar header, filter-chip row (focus-conditional), Fuse.js index build (per-tab, rebuilt on tab change or corpus mutation via `ENGAGEMENT_CHANGED` / `COLLECTIONS_CHANGED` / postHistoryService events), result-card snippet rendering.
- **`LongPressMenu.tsx` extension**: Save row now opens picker sheet (state lifted to parent screen, sheet rendered at screen level — not inside the menu). Existing Save toggle path removed.
- **New event** `COLLECTIONS_CHANGED` registered in `app/src/lib/event-bus.ts` and emitted by `collectionService` mutators.
- **Settings**: `SettingsDataScreen.tsx` Clear-All-Data handler extended to call `collectionService.reset()` after engagementService and dailyReadService resets.
- **Bundle size**: Fuse.js ~10KB gzip — researcher should confirm against current bundle budget (no specific budget set in `.planning` today).

</code_context>

<specifics>
## Specific Ideas

- **YouTube "Save to playlist" sheet** is the explicit reference for the collection picker UX. Implicit "Saved" pre-checked = YouTube's "Watch later" pre-checked. Single-tap-save still works (tap Save → sheet opens → tap Done) by virtue of the pre-check.
- **iOS-faithful gestures** carry over from Phase 49: tap = inspect/navigate, long-press = action menu. Collection chips in the Collections sub-tab follow this — tap drills in, long-press opens rename/delete/reorder.
- **Preset date chips** (Today / Last 7 days / Last 30 days / All time) over a calendar picker — operator-chosen because it covers the common cases without locale-aware calendar UI work across 4 i18n bundles.

</specifics>

<deferred>
## Deferred Ideas

These were raised or implicit during discussion but pushed out of Phase 50:

- **LLM-suggested collection names** at save time — deferred; user-typed only.
- **Calendar / custom date range picker** — deferred to a future retrieval phase if preset chips prove insufficient.
- **Save first, organize later workflow** (multi-select bulk Move to collection) — rejected in favor of always-pick-at-save (D-04).
- **6th bottom-nav tab "Library"** — deferred; chose to extend `/saved`.
- **Tabs-as-chips unified-list view** — rejected; tabs stay; chips are secondary filters only.
- **Embedding-rerank search pass** (reusing Phase 47's `embedText` cache) — deferred; Phase 50 ships Fuse.js only. Revisit if Fuse misses semantic queries in dogfooding.
- **"Sort" user-facing toggle** — rejected (relevance-when-typing chosen automatically).
- **Cross-tab "found N matches in History" hint** on empty results — deferred; simple "No matches + Clear filters" chosen.
- **"Ask Trellis to explain {query}" deep-link from empty-results state** — deferred (scope creep into Phase 53 engagement-vs-learning guardrails).
- **Save / bookmark concept anchors** (graph long-press + AnchorDetail kebab) — removed from scope after operator walked back. If retrieval feels weak without concept-level saves, reopen as RETRIEVE-F03.
- **Expand search corpus to Q&A sessions / podcasts / review cards** — deferred to Phase 51 (concept dashboard owns the cross-artifact join).
- **Inline filter expansion alternatives** (always-visible chip row, Filter button + sheet) — rejected in favor of focus-conditional chip row.
- **Multi-select bulk reorganize inside collection drill-in** — rejected; compact list + per-post long-press chosen.

None — discussion stayed within phase scope. (Scope creep redirects went into deferred ideas above.)

</deferred>

---

*Phase: 50-Retrieval and Library Foundation*
*Context gathered: 2026-05-18*
