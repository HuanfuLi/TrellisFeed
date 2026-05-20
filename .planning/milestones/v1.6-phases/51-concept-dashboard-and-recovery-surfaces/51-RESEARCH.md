# Phase 51 Research: Concept Dashboard and Recovery Surfaces

**Phase:** 51
**Requirements:** RETRIEVE-03, RETRIEVE-04
**Researcher:** Claude Opus 4.6
**Date:** 2026-05-18

---

## R1. Scope and Success Criteria Recap

**RETRIEVE-03:** User can open a concept dashboard from concept-linked surfaces. Dashboard joins Q&As, posts, saved/liked/history items, review cards, podcast mentions, tags, and weak/due signals in one bounded view. User can jump from dashboard to original post, Q&A, review action, podcast mention, or tag-filtered retrieval result.

**RETRIEVE-04:** Dashboard and retrieval surfaces prioritize search, filters, dashboard navigation, and review actions instead of endless scrolling.

**Confidence:** HIGH [VERIFIED: codebase grep of REQUIREMENTS.md + ROADMAP.md]

---

## R2. Existing Concept Detail Screens — What Already Exists

### R2a. AnchorDetailScreen (`app/src/screens/AnchorDetailScreen.tsx`)

Currently displays for `/anchor/:id`:
- Header with back + delete menu
- Hierarchy breadcrumb: Root > Branch > Cluster (cluster is clickable)
- Title + stats row (Q&A count, flashcard count)
- Two CTA buttons: "Flashcards" → `/review` with anchorReview state; "Learn as Post" → `/posts/{postId}`
- Summary entries parsed from `anchor.nodeSummary` (split by `[qa-id]` markers)
- Q&A children cards (tap → `/ask/{id}`)

**What's missing for RETRIEVE-03:**
- Posts linked to this concept (via `DailyPost.sourceQuestionIds`)
- Saved/liked/history items filtered by concept
- Podcast mentions (via `DailyPodcast.questionIds` → parent anchor lookup)
- Collection membership (posts in collections that reference this concept)
- Weak/due leaf state signal (available via `computeLeafState()` but not rendered)
- Tags/collections associated with concept's posts

**Confidence:** HIGH [VERIFIED: full file read of AnchorDetailScreen.tsx]

### R2b. ClusterDetailScreen (`app/src/screens/ClusterDetailScreen.tsx`)

Currently displays for `/cluster/:id`:
- Same header/breadcrumb pattern as AnchorDetailScreen
- Stats: concept count, Q&A count, flashcard count (aggregated across child anchors)
- Child anchors listed as ConceptCard tiles (tap → `/anchor/{id}`)
- Grouped knowledge summary by anchor name

**Phase 51 relevance:** ClusterDetailScreen is a higher-level aggregation that lists child concepts. Phase 51's concept dashboard is anchor-level, not cluster-level. ClusterDetailScreen can link DOWN to concept dashboards.

**Confidence:** HIGH [VERIFIED: full file read]

### R2c. Route Already Exists

`/anchor/:id` already registered in `App.tsx` (line 309). No new route needed — Phase 51 extends AnchorDetailScreen in place.

**Confidence:** HIGH [VERIFIED: App.tsx route table]

---

## R3. Data Join Paths — How to Aggregate by Concept

Phase 51's core challenge: join 6 artifact types to one anchor ID.

### R3a. Concept → Q&As
- `questionService.getAll().filter(q => q.parentId === anchorId && !q.isAnchorNode && !q.isClusterNode)`
- Already implemented in AnchorDetailScreen. [VERIFIED: codebase]

### R3b. Concept → Posts
- `DailyPost.sourceQuestionIds: string[]` contains Q&A node IDs (not anchor IDs directly)
- Join path: get Q&A children IDs for anchor → filter posts where `sourceQuestionIds` intersects
- `postHistoryService.getPosts()` returns all posts; filter client-side
- `DailyPost.sourceQuestionTitles: string[]` contains anchor display names (for text matching fallback)
- **Confidence:** HIGH [VERIFIED: DailyPost type in types/index.ts]

### R3c. Concept → Saved/Liked Items
- `engagementService.getSavedPosts()` / `getLikedPosts()` return resolved `DailyPost[]`
- Filter by R3b join (sourceQuestionIds intersection)
- **Confidence:** HIGH [VERIFIED: engagement.service.ts]

### R3d. Concept → Review Cards (Flashcards)
- `flashcardService.getAll()` returns `FlashCard[]` with `nodeId?: string` (Q&A node ID)
- Join: filter flashcards where `nodeId` is in anchor's Q&A children set
- FlashCard also carries `rootLabel`, `branchLabel`, `clusterLabel` for hierarchy display
- Already implemented in AnchorDetailScreen (flashcard count). Phase 51 extends to show individual cards + review status.
- **Confidence:** HIGH [VERIFIED: FlashCard type + flashcard.service.ts]

### R3e. Concept → Podcast Mentions
- `DailyPodcast.questionIds: string[]` contains Q&A node IDs
- Join: filter podcasts where `questionIds` intersects anchor's Q&A children
- `podcastService` (not yet fully inventoried but getPodcasts/getAll returns DailyPodcast[])
- **Confidence:** HIGH [VERIFIED: DailyPodcast type]

### R3f. Concept → Collections
- `collectionService.getCollections()` returns `Collection[]` with `postIds: string[]`
- Join: for each collection, resolve posts via `collectionService.getCollectionPosts(id)`, filter by R3b concept-post join
- Alternatively: reverse-lookup — get concept's posts (R3b), then `collectionService.getPostCollections(postId)` for each
- **Confidence:** HIGH [VERIFIED: collection.service.ts]

### R3g. Concept → Weak/Due Signals
- `computeLeafState(anchor, qaChildren, blossomSinceDate?, fcMap?)` from `trellis-state.service.ts`
- Returns `LeafState`: `'bud' | 'green' | 'dying' | 'falling' | 'dead' | 'blossom' | 'fruit'`
- Already computed in `useTrellisData` hook; can be called directly for a single anchor
- **Confidence:** HIGH [VERIFIED: trellis-state.service.ts]

---

## R4. Design Decision: Extend AnchorDetailScreen vs. New Screen

**Option A: Extend AnchorDetailScreen in-place**
- Pros: No new route; existing navigation from graph/planner/cluster already works; less code
- Cons: AnchorDetailScreen is currently ~200 lines; adding 6 sections could bloat it; risk of regression on existing Q&A display

**Option B: New ConceptDashboardScreen replacing AnchorDetailScreen**
- Pros: Clean separation; old screen preserved for rollback
- Cons: Must update all `navigate('/anchor/:id')` call sites (or reuse same route with new component)

**Option C: Extend AnchorDetailScreen with collapsible sections**
- Pros: Incremental; keeps existing top section; adds collapsible "Posts", "Reviews", "Podcasts", "Collections" sections below
- Cons: Single long scroll — but RETRIEVE-04 says "bounded and recovery-oriented"

**Recommendation:** Option C — extend AnchorDetailScreen with collapsible/tabbed sections. The screen already has the header, breadcrumb, and Q&A section. Add a tab bar or section headers below the existing content for Posts, Reviews, Podcasts. This matches the "bounded view" requirement (RETRIEVE-04) while reusing the existing route and navigation.

**Alternative considered:** A tab bar within AnchorDetailScreen (similar to SavedScreen's 4 tabs) would satisfy RETRIEVE-04's "prioritize search, filters, dashboard navigation" better than a long scroll. Sections: Overview (current content + leaf state) | Posts | Reviews | Podcasts.

**Confidence:** MEDIUM [ASSUMED — design choice, not verified with operator]

---

## R5. Navigation Entry Points — Where Users Open the Dashboard

Users can currently reach `/anchor/:id` from:
1. **GraphScreen** — tap a concept node in MindElixir (Phase 49)
2. **ClusterDetailScreen** — tap a child anchor in the anchors list
3. **PlannerScreen** — tap a Suggested Moves row (dying/dead concept)
4. **PostDetailScreen** — (currently NO link to parent concept)
5. **ReviewScreen** — (currently NO link to parent concept from flashcard)
6. **PodcastScreen** — concept list for today's podcast (tap navigates, but path unclear)

**New entry points Phase 51 should add:**
- **PostDetailScreen:** Add concept badge tap → navigate to `/anchor/{anchorId}`. Currently `sourceQuestionTitles` are static text. Need to resolve title → anchorId.
- **SavedScreen:** Concept filter chip already shows anchor titles (Phase 50 D-12). Could make chip tap navigate to concept dashboard instead of just filtering.
- **ReviewScreen:** Add "View Concept" link on flashcard detail or library card.

**Confidence:** HIGH [VERIFIED: navigation call sites via codebase grep]

---

## R6. Existing UI Patterns to Reuse

### R6a. Tab Bar Pattern (SavedScreen)
SavedScreen uses `'saved' | 'liked' | 'history' | 'collections'` tabs with inline rendering per tab. Same pattern can give AnchorDetailScreen sectioned content.
[VERIFIED: SavedScreen.tsx]

### R6b. BottomSheet Pattern
`BottomSheet.tsx` — portal overlay, slide-up, 75vh max, drag handle. Used by CollectionPickerSheet and FilterPickerSheet.
[VERIFIED: BottomSheet.tsx]

### R6c. Card Pattern
AnchorDetailScreen and ClusterDetailScreen use Card components with hover scale/shadow. InfoFlow.ConceptCard for feed-style tiles.
[VERIFIED: AnchorDetailScreen.tsx, ClusterDetailScreen.tsx]

### R6d. HighlightedText (Phase 50)
`HighlightedText.tsx` — renders Fuse match indices as highlighted spans. Can be reused if dashboard has search.
[VERIFIED: Phase 50 plans]

### R6e. Header Portal Pattern
Sub-screens use `<Header backTo={...} title={...} />` which auto-portals to document.body outside SwipeTabContext.
[VERIFIED: Header.tsx, CLAUDE.md]

### R6f. FilterPickerSheet (Phase 50)
Single-select filter picker with empty-state branch. Can be reused for dashboard section filtering.
[VERIFIED: FilterPickerSheet.tsx]

---

## R7. Event Subscriptions for Real-Time Dashboard Updates

The dashboard must stay current without refresh (Capacitor mobile = no refresh, per memory `feedback_no_refresh_assumption.md`).

| Event | Dashboard Section Affected | Action |
|---|---|---|
| `GRAPH_UPDATED` | All (anchor may be renamed/moved/deleted) | Re-read anchor + Q&A children |
| `REVIEW_COMPLETED` | Reviews section, leaf state | Re-read flashcards + recompute leaf state |
| `ENGAGEMENT_CHANGED` | Posts (saved/liked badges) | Re-read engagement state for concept's posts |
| `COLLECTIONS_CHANGED` | Collections section | Re-read collection membership for concept's posts |
| `CONCEPT_EXPLORED` | Leaf state (exploration tracking) | Update exploration badge |
| `FLASHCARDS_CREATED` | Reviews section | Re-read flashcard count |
| `PODCAST_GENERATION_COMPLETED` | Podcasts section | Re-read podcast list |

**Confidence:** HIGH [VERIFIED: event types in types/index.ts]

---

## R8. DailyPost → Concept Resolution

The key join: given an anchor ID, find all posts about that concept.

```
anchorId → qaChildIds = questions.filter(q.parentId === anchorId).map(q.id)
posts = postHistoryService.getPosts().filter(p =>
  p.sourceQuestionIds.some(sqId => qaChildIds.has(sqId))
)
```

**Edge case:** `sourceQuestionIds` contains Q&A IDs, not anchor IDs. A post about "Spaced Repetition" will have the Q&A node ID, not the anchor ID. The join MUST go through Q&A children.

**Performance:** `postHistoryService.getPosts()` returns all posts (could be 100s over weeks). The filter is O(posts × qaChildren). For typical usage (10-50 anchors, 1-5 QAs each, 100-500 posts), this is negligible. No index needed.

**Confidence:** HIGH [VERIFIED: DailyPost.sourceQuestionIds type + questionService.getAll patterns]

---

## R9. Podcast → Concept Resolution

```
anchorId → qaChildIds (same as R8)
podcasts = podcastService.getAll().filter(p =>
  p.questionIds.some(qId => qaChildIds.has(qId))
)
```

`DailyPodcast.questionIds` contains Q&A IDs used in generation. Same join pattern as R8.

**Confidence:** HIGH [VERIFIED: DailyPodcast type]

---

## R10. RETRIEVE-04: Bounded and Recovery-Oriented

The requirement explicitly says: "prioritize search, filters, dashboards, and review actions rather than another infinite recommendation feed."

Design implications:
1. **No infinite scroll** — each section shows a bounded count (e.g., 5 recent posts, 5 due flashcards) with "View all" links
2. **Action-oriented CTAs** — "Review due cards", "Listen to podcast", "Open post" rather than passive browsing
3. **Filters over scroll** — if many posts/cards exist for a concept, provide filter/sort rather than loading all
4. **Review actions prominent** — leaf state badge + "Review Now" button if concept is dying/falling/dead

**Confidence:** HIGH [VERIFIED: REQUIREMENTS.md RETRIEVE-04 text]

---

## R11. Leaf State Visualization

`computeLeafState()` returns one of 7 states. Dashboard should show this prominently.

| State | Meaning | Dashboard Action |
|---|---|---|
| `bud` | New, no reviews | "Start reviewing" CTA |
| `green` | Healthy, on schedule | No action needed |
| `dying` | 1-6 days overdue | "Review now" CTA (orange) |
| `falling` | 7-13 days overdue | "Review now" CTA (red) |
| `dead` | 14+ days overdue or ease < 1.5 | "Re-plant" CTA |
| `blossom` | All reviewed + high ease | Celebration indicator |
| `fruit` | Sustained blossom (7+ days) | Harvest indicator |

The Planner's trellis visualization already maps these to colors/icons. Dashboard can reuse the same visual language.

**Confidence:** HIGH [VERIFIED: trellis-state.service.ts computeLeafState]

---

## R12. i18n Requirements

New keys needed under a `conceptDashboard.*` namespace (or extend `graph.anchor.*`):

Estimated new keys: ~20-30 for section headers, CTAs, empty states, filter labels.

Existing reusable keys:
- `graph.anchor.qaCount`, `graph.anchor.flashcardCount`, `graph.anchor.flashcardsButton`, `graph.anchor.learnAsPostButton`
- `review.library.*` for review card display
- `podcast.player.*` for podcast mention display
- `common.back`, `common.cancel`, `common.done`

**Workflow:** EN-first, then Sonnet subagent for zh/es/ja. Same PR. `bundle-parity.test.mjs` enforces.

**Confidence:** HIGH [VERIFIED: en.json namespace structure + CLAUDE.md i18n workflow]

---

## R13. Files Inventory

### Existing Files to Modify

| File | Changes | Reason |
|---|---|---|
| `app/src/screens/AnchorDetailScreen.tsx` | Major extension — add tabbed sections, data joins, event subscriptions | Core dashboard screen |
| `app/src/locales/en.json` | Add `conceptDashboard.*` or extend `graph.anchor.*` keys | i18n |
| `app/src/locales/{zh,es,ja}.json` | Translated keys | i18n parity |

### Potentially New Files

| File | Purpose |
|---|---|
| `app/src/hooks/useConceptDashboard.ts` | Data aggregation hook: joins Q&As, posts, flashcards, podcasts, collections, leaf state for one anchor |
| `app/src/components/concept/ConceptPostsSection.tsx` | Bounded post list for concept dashboard |
| `app/src/components/concept/ConceptReviewSection.tsx` | Flashcard summary + review CTA for concept |
| `app/src/components/concept/ConceptPodcastSection.tsx` | Podcast mentions list for concept |
| `tests/screens/AnchorDetailScreen.dashboard.test.mjs` | Dashboard integration tests |
| `tests/hooks/useConceptDashboard.test.mjs` | Data aggregation tests |

### Existing Files Read-Only (consumed, not modified)

| File | What's Consumed |
|---|---|
| `app/src/services/question.service.ts` | `getAll()`, `getById()` |
| `app/src/services/engagement.service.ts` | `getSavedPosts()`, `getLikedPosts()`, `isSaved()`, `isLiked()` |
| `app/src/services/collection.service.ts` | `getCollections()`, `getCollectionPosts()`, `getPostCollections()` |
| `app/src/services/flashcard.service.ts` | `getAll()` |
| `app/src/services/podcast.service.ts` | `getAll()` or equivalent |
| `app/src/services/post-history.service.ts` | `getPosts()` |
| `app/src/services/trellis-state.service.ts` | `computeLeafState()` |
| `app/src/services/dailyRead.service.ts` | `isExplored()` |
| `app/src/lib/event-bus.ts` | `eventBus.subscribe()` |

---

## R14. Testing Strategy

### Unit Tests
- `useConceptDashboard` hook: verify all 6 join paths return correct data for a given anchor
- Edge cases: anchor with 0 Q&As, anchor with Q&As but no posts, anchor with posts but no saved items

### Integration Tests
- AnchorDetailScreen renders all sections with mock data
- Event subscription: REVIEW_COMPLETED triggers re-render of review section
- Navigation: tap post → PostDetailScreen; tap flashcard → ReviewScreen; tap podcast → PodcastScreen

### Validation Tests
- RETRIEVE-03: dashboard shows Q&As + posts + saved + flashcards + podcasts + tags + leaf state
- RETRIEVE-04: no infinite scroll; bounded sections; action CTAs present

**Estimated test count:** ~15-25 new tests
**Estimated suite impact:** ~2-4s additional

**Confidence:** MEDIUM [ASSUMED — test counts estimated from Phase 49/50 patterns]

---

## R15. Phase 50 Decisions That Carry Forward

| Decision | Constraint on Phase 51 |
|---|---|
| D-01: Bookmark = Save (no new primitive) | No bookmark concept on dashboard; "Saved" is the only persistence signal |
| D-02: Save is posts-only, not concept-anchors | Dashboard cannot show "save this concept" — only save individual posts. If operator wants concept-level save, must be discussed |
| D-03: Collections are YouTube-playlist-style | Dashboard shows "In N collections" per post, not concept-level collections |
| D-08: History corpus is post-only | Dashboard's history section shows posts, not raw Q&A history |
| D-13: Fuse.js for search | If dashboard needs search, reuse `library-search.service.ts` pattern |

**Critical constraint:** D-02 says save/bookmark is posts-only. RETRIEVE-03 says dashboard shows "tags" — but Phase 50 replaced "tags" with "collections" (D-03). Collections are post-level. The dashboard shows which of the concept's posts are in collections, not concept-level tagging.

**Confidence:** HIGH [VERIFIED: 50-CONTEXT.md decisions]

---

## R16. Open Questions for Discussion Phase

### Q1. Extend AnchorDetailScreen or Replace?
Should Phase 51 extend the existing AnchorDetailScreen with additional sections/tabs, or create a new ConceptDashboardScreen and update the `/anchor/:id` route? Extension is lower-risk but may bloat the file.

**Recommendation:** Extend with an internal tab bar (Overview | Posts | Reviews | Podcasts). Keeps the route stable.

### Q2. Concept-Level Save/Bookmark?
Phase 50 D-02 scoped save to posts-only. RETRIEVE-03 mentions "tags" in the dashboard. Should Phase 51 introduce concept-level bookmarking, or is "view which posts are saved/in-collections" sufficient?

**Recommendation:** Posts-only is sufficient for v1.6. Concept-level save is RETRIEVE-F01 territory.

### Q3. Entry Points from PostDetailScreen and ReviewScreen?
Currently no navigation from PostDetailScreen or ReviewScreen back to the concept dashboard. Should Phase 51 add concept badge taps (PostDetailScreen) and "View Concept" links (ReviewScreen)?

**Recommendation:** Yes — PostDetailScreen concept badges should become tappable. ReviewScreen can add a subtle link. These are the "concept-linked surfaces" RETRIEVE-03 requires.

### Q4. Dashboard Search?
RETRIEVE-04 says "prioritize search." Does the concept dashboard itself need a search bar (searching within the concept's artifacts), or is the SavedScreen search sufficient?

**Recommendation:** No search within the dashboard. Each section is bounded (5-10 items). SavedScreen handles cross-concept search. Dashboard handles single-concept aggregation.

---

## R17. Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| AnchorDetailScreen bloat (>500 lines) | HIGH | Extract sections into components; hook handles data joins |
| Performance: joining 6 data sources on mount | LOW | All services are localStorage-backed sync reads; <10ms total |
| Stale data on navigation back | MEDIUM | Event subscriptions + pathname-based re-read (CLAUDE.md pattern) |
| Regression on existing AnchorDetailScreen behavior | MEDIUM | Existing Q&A section preserved as "Overview" tab; tests for backward compat |
| i18n key count growth | LOW | ~20-30 keys; well within bundle-parity.test tolerance |

---

## R18. Dependency on Phase 50 Gap Closures

Phase 50 has 4 outstanding gap-closure plans (50-10 through 50-13). These fix:
- G1+G3: CollectionPickerSheet no-refresh subscription + Saved pre-checked default
- G4: Fuse threshold tuning
- G2+G6+G7: SavedScreen chip blur-race + tab-preserves-query + chip padding
- G5: FilterPickerSheet overscroll-behavior

**Impact on Phase 51:** None of these block concept dashboard work. The collection/search services are functional; gaps are UX polish. Phase 51 can proceed in parallel or after gap closure.

**Confidence:** HIGH [VERIFIED: gap plans 50-10..50-13 descriptions]

---

## R19. Summary of Recommendations

1. **Extend AnchorDetailScreen** with internal tab bar (Overview | Posts | Reviews | Podcasts) rather than creating a new screen
2. **Extract data aggregation** into a `useConceptDashboard(anchorId)` hook that joins all 6 artifact types
3. **Extract section components** (`ConceptPostsSection`, `ConceptReviewSection`, `ConceptPodcastSection`) to keep AnchorDetailScreen manageable
4. **Add entry points** from PostDetailScreen (concept badge tap) and ReviewScreen (view concept link)
5. **Bounded sections** — each shows max 5 items with "View all" navigation (to SavedScreen filtered, ReviewScreen filtered, PodcastScreen)
6. **Leaf state badge** — prominent visual at top of dashboard showing concept health
7. **Event subscriptions** for real-time updates (7 event types listed in R7)
8. **No concept-level save** — stay within Phase 50 D-02 scope (posts-only)
9. **No dashboard-level search** — SavedScreen handles cross-concept search
10. **i18n** — extend `graph.anchor.*` namespace or create `conceptDashboard.*`
