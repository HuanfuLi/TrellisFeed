# Phase 50: Retrieval and Library Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 50-Retrieval and Library Foundation
**Areas discussed:** Bookmark vs Save semantics, Collections model (was Tag model), History scope, Search & filter surface, Search matching & ranking

---

## Bookmark vs Save semantics

### Q1: Is 'bookmark' a distinct primitive from Save?

| Option | Description | Selected |
|--------|-------------|----------|
| Bookmark = Save (synonym, one storage) | No new field. UI verb for existing Save action on posts; concepts get the same Save primitive (savedConcepts[]). Simplest. | ✓ |
| Bookmark is concept-only; Save stays post-only | Two semantically different verbs: Save (collect post) vs Bookmark (pin concept). New bookmarkedConcepts[] field; no overlap. | |
| Bookmark is a third pillar across both | Save + Like + Bookmark coexist as distinct fields. Most expressive but third state to teach. | |

**User's choice:** Bookmark = Save (synonym, one storage)
**Notes:** Locked the single-storage model. Bookmark stays internal vocab only; UI label says "Save."

### Q2: Where can the user save (bookmark) a CONCEPT?

| Option | Description | Selected |
|--------|-------------|----------|
| Graph long-press menu only (Phase 49 correction card) | Add 'Save' row to Phase 49's correction card. One canonical save surface. | |
| Graph long-press + PlannerScreen rows | Long-press on graph anchor AND Save icon on PlannerScreen suggested-move rows. | |
| Graph + Planner + PostDetail (concept chip) | All three surfaces. Maximum reachability; risks PostDetail bloat. | |
| (operator wrote) Graph long-press + AnchorDetail kebab | Long-press correction card + the existing `<DetailMenu>` kebab on AnchorDetailScreen (the one that holds Delete). | (initial answer) |
| (operator revised) Skip save-concept entirely | "Actually don't think we need save/bookmark for concept anchors." | ✓ (final) |

**User's choice:** Walked back mid-question — no save/bookmark for concepts at all.
**Notes:** Material spec adjustment. RETRIEVE-02's "tag OR bookmark posts and concepts" collapses to "bookmark posts (existing) + tag posts (new). " Concepts get no new affordance; concept-level retrieval relies on existing `post.sourceQuestionIds[0]` identity joined with collection membership. Area closed after 2 questions instead of 4.

---

## Collections model (originally framed as "Tag model")

### Q1: How are tags created — free-form, LLM-suggested, or pre-defined palette?

| Option | Description | Selected |
|--------|-------------|----------|
| Free-form user-typed strings only | Autocomplete from previously-used; matches iOS Notes. | |
| Free-form + LLM-suggested at tag time | "Suggest tags" button calls LLM for 2-3 candidates. | |
| Pre-defined palette only (curated set) | Fixed set like #important, #review-later. Cleanest but rigid. | |

**User's choice:** Reframed entirely — "What is tag? Why do we need it?" then "'Tag' is misleading. Should be collection or folder in Save. Please refer to YouTube as example. We can add a save to collection feature."
**Notes:** Material spec pivot. Drop "tag" terminology entirely; adopt YouTube-style "Collection" / "Save to playlist" model. Subsequent questions in this area used the new framing.

### Q2: Default Save-tap flow (YouTube comparison)

| Option | Description | Selected |
|--------|-------------|----------|
| Always opens collection picker on Save tap | YouTube-faithful. Sheet appears with collections + 'New collection'. Must pick at least one. Teaches the concept by being unavoidable. | ✓ |
| Tap Save = quick-save; long-press Save = open picker | Lighter for 80% case; second gesture on a single menu row. | |
| Save first, organize later | Tap Save = immediate save; organize via multi-select bulk action later. Risk: users never organize. | |

**User's choice:** Always opens collection picker on Save tap
**Notes:** Locks YouTube-faithful behavior.

### Q3: Default selection in the picker (implicit "Watch later" equivalent)

| Option | Description | Selected |
|--------|-------------|----------|
| Implicit 'Saved' bucket, pre-checked | Pinned top row of sheet; pre-checked; single-tap-save still works. Maps to existing engagementService.saved[]. | ✓ |
| No default — user must explicitly pick or create | Sheet opens empty; forces deliberate organization; adds friction. | |
| Last-used collection pre-checked | LRU heuristic; risks accidental wrong-collection append. | |

**User's choice:** Implicit 'Saved' bucket, pre-checked
**Notes:** Clean mapping — the existing engagementService.saved[] IS the implicit bucket. No new storage for the default case.

### Q4: Collection management surface + visibility in Library

| Option | Description | Selected |
|--------|-------------|----------|
| Inline create + Collections sub-tab in Library | + New collection at bottom of picker sheet; 4th tab Collections alongside Saved | Liked | History; long-press chip = rename/delete. | ✓ |
| Inline create + dedicated /collections route | Separate screen for management; more room; extra route to learn. | |
| Inline create only — collections surface as filter chips | Chip row above list, no tab; compact for few collections; cluttered past ~8. | |

**User's choice:** Inline create + Collections sub-tab in Library
**Notes:** Minimal nav addition; one extra sub-tab on the existing /saved screen.

### Q5: Collection drill-in view

| Option | Description | Selected |
|--------|-------------|----------|
| Compact list of saved posts in that collection + edit affordance | Mirrors Saved/Liked tab layout. Header kebab for rename/delete/reorder. Long-press post = LongPressMenu with 'Remove from collection'. | ✓ |
| Multi-select grid for bulk reorganize | Checkboxes + bulk actions. Better for power-organize; new pattern. | |
| Same as Saved tab but filtered | Read-only filtered view; management lives in the Collections sub-tab. | |

**User's choice:** Compact list + edit affordance
**Notes:** Mirrors existing patterns; minimum new UI.

---

## History scope

### Q1: What does the History (Library) corpus include?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay post-only (current scope) | History = 7-day rolling post history. Phase 51 dashboard joins Q&As/podcasts/reviews. | ✓ |
| Expand to include past Q&A sessions (chat history) | Add Q&A sessions to search corpus. AskScreen drawer stays as primary entry. | |
| Expand to all artifacts (posts + Q&As + podcasts + reviews) | Library becomes unified retrieval surface. Risks duplicating Phase 51. | |

**User's choice:** Stay post-only (current scope)
**Notes:** Cleanest scope; defers cross-artifact join to Phase 51 where the concept dashboard owns it.

### Q2: Collection membership and history-retention pinning

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — any collection membership pins the post | Extend getPinnedIds() to union saved ∪ liked ∪ any-collection-member. Matches user intent. | ✓ |
| No — only saved/liked pin; collections rely on saved being checked | Trust the operator; simpler pin logic. | |
| Make retention default 'keep all' for posts in any saved/liked/collection | Sidestep purge concerns; localStorage growth risk. | |

**User's choice:** Yes — any collection membership pins the post
**Notes:** Extends the existing `engagementService.getPinnedIds()` set.

---

## Search & filter surface

### Q1: Where does the search UI live?

| Option | Description | Selected |
|--------|-------------|----------|
| Search bar in /saved (Library) header; filter chips below | Extends existing screen; natural fit. | ✓ |
| Dedicated /library route, /saved becomes a redirect | Cleaner mental model; bigger rename. | |
| Add a Library tab to bottom nav (6 tabs) | First-class promotion; SwipeTabContainer extension needed; 6 tabs dense. | |

**User's choice:** Search bar in /saved header; filter chips below
**Notes:** No bottom-nav change; existing /saved becomes the retrieval surface.

### Q2: Search scope across tabs

| Option | Description | Selected |
|--------|-------------|----------|
| Search scopes to active tab | Spotify-style; predictable; tabs act as primary filter. | ✓ |
| Search always covers full corpus; group results by tab | Best for 'I don't remember where I put it'; busier visual. | |
| Tabs become filter chips; one unified list view | Most flexible; biggest UX change. | |

**User's choice:** Search scopes to active tab
**Notes:** Switching tabs re-runs the search in the new scope.

### Q3: Secondary filter chips placement

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal chip row below search bar; chip opens picker on tap | Compact; scales; iOS Mail-like. | |
| 'Filter' button opens single full-screen filter sheet | Cleaner header; extra tap. | |
| Inline filter expansion on search-bar focus | Chip row appears only when search bar focused/active. Saves space. | ✓ |

**User's choice:** Inline filter expansion on search-bar focus
**Notes:** Saves vertical space when user is just browsing tabs.

### Q4: Date filter UI shape

| Option | Description | Selected |
|--------|-------------|----------|
| Preset chips only (Today / Last 7 days / Last 30 days / All time) | Fastest; no calendar component; locale-light. | ✓ |
| Preset chips + 'Custom range' opens date-range picker | Most flexible; new component + 4-locale formatting work. | |
| Single 'Since' picker only | Simpler than range; covers 'around mid-April' case. | |

**User's choice:** Preset chips only
**Notes:** Avoids building a date-range picker across 4 i18n bundles.

---

## Search matching & ranking

### Q1: Match algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Plain substring (case-insensitive, multi-field) | Zero deps; predictable; misses semantic queries. | |
| Fuzzy match (Fuse.js, typo-tolerant) | ~10KB gzip; field weights; typo-tolerant. | ✓ |
| Hybrid: substring + embedding rerank when provider configured | Best results; one embedText call per query; most code. | |

**User's choice:** Fuzzy match (Fuse.js)
**Notes:** New dependency. No embedding-rerank in Phase 50 — reserved for a future phase if Fuse misses semantic queries in dogfooding.

### Q2: Default sort order

| Option | Description | Selected |
|--------|-------------|----------|
| Relevance (Fuse score) when searching; date-desc when not | Standard search UX. | ✓ |
| Always date-desc regardless of search | Predictable; worse for needle-in-haystack. | |
| Relevance always, with Sort toggle (Relevance / Newest) | User-controlled; more UI surface. | |

**User's choice:** Relevance when searching; date-desc when not
**Notes:** No user-facing Sort toggle.

### Q3: Match highlighting in result cards

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — highlight matched substrings in title and body snippet | First ~120 chars around first match; uses Fuse match indices. | ✓ |
| Highlight title only; keep body off the card | Minimal change; less informative for fuzzy matches. | |
| No highlights — cards render unchanged | Simplest; user wonders why a card ranks. | |

**User's choice:** Highlight title + body snippet
**Notes:** Snippet field added to search-result card; rendered only when search active.

### Q4: Empty/zero-results state

| Option | Description | Selected |
|--------|-------------|----------|
| Simple 'No matches' + 'Clear filters' link | Minimal; matches existing /saved empty patterns. | ✓ |
| Empty + 'Try Ask Trellis' fallback CTA | Bridges retrieval failure to generative; scope creep risk. | |
| Empty + 'Search other tabs' suggestion | Cross-tab pre-check; more helpful; light cost. | |

**User's choice:** Simple 'No matches' + 'Clear filters' link
**Notes:** Minimal scope; "Ask Trellis" deep-link deferred.

---

## Claude's Discretion

- Storage key naming for collections (`trellis_collections_v1`).
- Leaf-module pattern for `collectionService` (mirror `engagement.service.ts`).
- Collection name validation (non-empty, ≤50 chars, trim, case-insensitive dedup).
- Search debounce (~200ms).
- Force-New-Day behavior for collections: persist across days, only Clear-All-Data resets — by analogy to Phase 39 D-04.
- New event `COLLECTIONS_CHANGED { kind, collectionId }` on event-bus.
- i18n key namespaces: `library.search.*`, `library.filters.*`, `library.collections.*`, `library.savePicker.*` (all 4 locale bundles in same PR).
- Fuse.js exact version pinning, per-field weight values, bundle-size confirmation — researcher concerns.

## Deferred Ideas

- LLM-suggested collection names at save time.
- Calendar / custom date-range picker.
- Save-first / organize-later bulk workflow.
- 6th bottom-nav Library tab.
- Tabs-as-chips unified-list view.
- Embedding-rerank search pass (reuse Phase 47 cache).
- User-facing Sort toggle.
- Cross-tab "found N in History" hint on empty results.
- "Ask Trellis to explain {query}" deep-link from empty-results state.
- Save/bookmark on concept anchors (operator walked back during Q2).
- Q&A / podcast / review expansion of search corpus (Phase 51 dashboard owns it).
- Always-visible filter chip row, "Filter" button + sheet variants.
- Multi-select bulk reorganize inside collection drill-in.
