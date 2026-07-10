# Phase 50: Retrieval and Library Foundation — Research

**Researched:** 2026-05-18
**Domain:** Local-first search, fuzzy matching, collections/library UI, localStorage persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** "Bookmark" = Save synonym, no new field. UI label stays "Save."
- **D-02:** Save/Bookmark is posts only — no concept-anchor affordance.
- **D-03:** Drop "tag." Use "Collection" (YouTube-playlist model). New `collectionService` leaf module. `CollectionsState = { collections: { id, name, postIds[], createdAt, updatedAt }[] }`.
- **D-04:** Save tap always opens collection-picker sheet (no quick-save path).
- **D-05:** Picker pre-checks implicit "Saved" bucket (maps to `engagementService.saved[]`, no new storage).
- **D-06:** Collection management: inline `+ New collection` row in picker + new "Collections" 4th sub-tab in `/saved`.
- **D-07:** Collection drill-in = compact list mirroring Saved tab. Header kebab for rename/delete. Long-press post in collection = LongPressMenu + "Remove from collection" row.
- **D-08:** History search corpus = posts only (Phase 51 handles cross-artifact).
- **D-09:** Collection membership pins post against 7-day purge. Extend `engagementService.getPinnedIds()` to union `saved ∪ liked ∪ any-collection-member`.
- **D-10:** Search bar in `/saved` header, pinned. Filter chips appear inline on search focus or when search has text. Tabs stay above search.
- **D-11:** Search scopes to active tab.
- **D-12:** Date chips only: Today / Last 7 days / Last 30 days / All time. No calendar picker.
- **D-13:** Fuse.js for fuzzy match (new dep).
- **D-14:** Sort = relevance when search non-empty; date-desc when empty. No user Sort toggle.
- **D-15:** Highlight matched substrings in title + 120-char body snippet.
- **D-16:** Zero-results state: "No matches in {activeTab}" + "Clear filters" text button.

### Claude's Discretion

- Storage key: `trellis_collections_v1` (mirrors `trellis_engagement_v1`).
- Leaf-module pattern: no JSON imports, no `lib/date.ts`, no `react-i18next` in service.
- Collection name validation: non-empty, ≤50 chars, trim, case-insensitive dedup.
- Search debounce ~200ms.
- Force-New-Day: collections persist (only Clear-All-Data resets via `collectionService.reset()`).
- New event: `COLLECTIONS_CHANGED { kind: 'create' | 'rename' | 'delete' | 'add-post' | 'remove-post', collectionId }`.
- i18n new namespaces: `library.search.*`, `library.filters.*`, `library.collections.*`.
- Fuse.js version pinning and per-field weight values are researcher concerns (resolved below).

### Deferred Ideas (OUT OF SCOPE)

- LLM-suggested collection names.
- Calendar / custom date-range picker.
- Save-first-organize-later bulk workflow.
- 6th bottom-nav tab "Library."
- Tabs-as-chips unified list.
- Embedding-rerank search pass.
- User-facing Sort toggle.
- Cross-tab "found N in History" hint on empty results.
- "Ask Trellis" fallback on empty state.
- Save/bookmark concept anchors.
- Expand search corpus to Q&A / podcasts / reviews.
- Inline filter expansion alternatives.
- Multi-select bulk reorganize in collection drill-in.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RETRIEVE-01 | User can search Saved, Liked, and History items by title, body, concept, source, and date; reopen original post. | Fuse.js multi-field config (D-13/D-14/D-15), SavedScreen extension (D-10/D-11/D-12), purge-pin semantics (D-09) |
| RETRIEVE-02 | User can tag or bookmark posts with local-first metadata that persists across days and supports filtering. | collectionService leaf module (D-03/D-04/D-05/D-06/D-07/D-09), COLLECTIONS_CHANGED event, i18n bundles |
</phase_requirements>

---

## Summary

Phase 50 adds two collaborating features to the existing `/saved` (Library) screen: a Fuse.js-powered fuzzy search surface and a YouTube-playlist-style Collections system for organizing saved posts. Both features are entirely local-first, backed by localStorage with no backend.

The largest change is to `SavedScreen.tsx`, which gains a pinned search bar, focus-conditional filter chips, a 4th "Collections" tab, and per-tab Fuse.js index management. A new `collectionService` leaf module, mirroring `engagementService` exactly, owns the collection CRUD lifecycle. `LongPressMenu.tsx` changes from a direct-toggle Save to a sheet-opener, lifting a collection picker sheet to the host screen. `engagementService.getPinnedIds()` extends to union collection memberships, which flows automatically into `postHistoryService.purgeExpired()` at zero further change.

Fuse.js 7.3.0 (8.3 KB gzip, full build; confirmed `[VERIFIED: npm registry]`) operates entirely in-memory. With 7-day rolling history (max ~224 posts at 32/day × 7 days), index creation is under 3ms and search under 17ms — well within mobile WebView budget. The index is rebuilt per-tab on tab switch or corpus mutation (triggered by `ENGAGEMENT_CHANGED` / `COLLECTIONS_CHANGED` events). Fuse.js supports `.add(doc)` and `.remove(predicate)` for incremental updates, but given our ≤250-post corpus, a full rebuild per corpus mutation event is simpler and equally fast.

**Primary recommendation:** Implement collectionService first (D-03..D-06, D-09 pin extension), then add Fuse.js search to SavedScreen (D-10..D-16), then update LongPressMenu to open the collection picker (D-04/D-05). This ordering means each wave has independently testable behavior.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Collection CRUD (create/rename/delete/membership) | localStorage service (`collectionService`) | Event bus (COLLECTIONS_CHANGED) | All state is local-first; service owns persistence, bus notifies consumers |
| Save → picker flow | LongPressMenu (host: HomeScreen state) | CollectionPickerSheet (new component, portaled via BottomSheet) | LongPressMenu already hosts the sheet via HomeScreen-lifted state |
| Post→collection membership resolution | collectionService.getCollectionPosts() | postHistoryService.getPosts() (at read time) | ID-only storage pattern mirroring engagementService |
| Purge pin extension | engagementService.getPinnedIds() | collectionService.getAllMemberPostIds() | One call site in purgeExpired(); no purge-side changes needed |
| Fuzzy search index | SavedScreen (per-tab useMemo) | Fuse.js (in-memory, no worker) | Corpus ≤250 posts; index rebuild < 3ms; worker overhead not justified |
| Search result rendering | SavedScreen SearchResultRow variant | HighlightedText inline helper | Tab-scoped; new row variant with snippet + highlighted spans |
| Filter chips (concept/source/date) | SavedScreen (focus-conditional) | Picker sheets for Concept/Source filters | Inline-only on focus, no persistent chip row when idle |
| Collections tab + drill-in | SavedScreen (4th tab) + CollectionDrillInScreen or inline sub-view | LongPressMenu (Remove from collection row) | Drill-in likely a new sub-screen pushed over /saved via navigation |
| i18n strings | en/zh/es/ja locale bundles | bundle-parity.test.mjs (CI gate) | All 4 locales in same PR per Phase 27 rule |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fuse.js | 7.3.0 | In-browser fuzzy search with multi-field weights and match highlighting | Locked decision D-13; 8.3 KB gzip (full build); zero dependencies; TypeScript-native; 10.3M weekly downloads; project since 2013 |

### Supporting (no new packages)

All other capabilities use existing project dependencies:

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Bookmark, Search, X, FolderOpen icons for picker + filter chips | Icon set already in use project-wide |
| react-router-dom v7 | existing | Navigate to collection drill-in route (or sub-screen overlay) | Existing routing pattern |
| framer-motion | existing | Optional entrance animations if needed (collection row enter) | Use only if matching existing stagger pattern |
| i18next / react-i18next | existing | Screen-level i18n (NOT in leaf service modules) | Phase 27 rule |

### Installation

```bash
# From app/ directory
npm install fuse.js@7.3.0
```

**Version verification:** `npm view fuse.js version` returns `7.3.0` as of 2026-05-18. [VERIFIED: npm registry]

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| fuse.js | npm | ~12 yrs (2013-11-29) | 10.3M/wk | github.com/krisk/Fuse | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**postinstall script check:** `npm view fuse.js scripts` shows no `postinstall` entry — only `prepare: 'husky install'` (devDependency hook, not installed in consumers). [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
User long-presses feed tile (HomeScreen)
        │
        ▼
LongPressMenu (compact BottomSheet, host: HomeScreen)
  Row 2: "Save to collection..."
        │  (replaces direct engagementService.savePost toggle)
        ▼
CollectionPickerSheet (portaled BottomSheet via createPortal)
  ┌─ Implicit "Saved" row [pre-checked] ── engagementService.savePost/removeSaved
  ├─ Custom collection rows [checkboxes] ── collectionService.addPost/removePost
  ├─ + New collection [inline input] ───── collectionService.createCollection
  └─ Done button ───────────────────────── closes sheet, emits COLLECTIONS_CHANGED
        │
        ▼
eventBus.emit COLLECTIONS_CHANGED
        │
        ├──► SavedScreen (subscribes) → refreshes active tab data + rebuilds Fuse index
        └──► CollectionDrillInScreen (subscribes if open) → refreshes post list

User opens /saved → SavedScreen
  ┌─ Tabs: [Saved] [Liked] [History] [Collections]
  │
  ├─ [Search bar pinned below header]
  │        │ (focus/text)
  │        ▼
  │   Filter chips appear (Concept | Source | Date)
  │        │
  │        ▼
  │   Fuse.js search (index built from active tab's corpus)
  │   → SearchResultRow (title highlight + 120-char body snippet)
  │
  ├─ [Collections tab] → list of user collections (chip/card rows)
  │        │ (tap)           │ (long-press)
  │        ▼                 ▼
  │  CollectionDrillIn   rename/delete/reorder sheet
  │  (post list, header kebab)
  │
  └─ [Any tab row tap] → navigate /posts/:id (existing pattern)

engagementService.getPinnedIds()
  = saved[] ∪ liked[] ∪ collectionService.getAllMemberPostIds()
        │
        ▼
postHistoryService.purgeExpired()
  (no change at call site — pin set expanded by extension above)
```

### Recommended Project Structure

```
src/
├── services/
│   └── collection.service.ts      # NEW — leaf module, trellis_collections_v1
├── components/
│   ├── CollectionPickerSheet.tsx  # NEW — portaled BottomSheet, checkbox list
│   └── ui/
│       └── HighlightedText.tsx    # NEW — span-wraps match indices from Fuse
├── screens/
│   ├── SavedScreen.tsx            # MODIFY — 4th tab, search bar, filter chips
│   └── CollectionDrillInScreen.tsx # NEW — post list for one collection
```

---

## Pattern 1: collectionService (leaf module blueprint)

**What:** localStorage-backed service, ID-only storage, event-emitting, mirroring `engagementService` structure exactly.

**When to use:** All collection CRUD operations.

```typescript
// Source: engagementService (app/src/services/engagement.service.ts) — SAME SHAPE
// ASSUMED: exact API names below; verify against final implementation

const STORAGE_KEY = 'trellis_collections_v1';

interface Collection {
  id: string;
  name: string;
  postIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface CollectionsState {
  collections: Collection[];
}

// loadState / saveState: identical pattern to engagementService
// freshState(): CollectionsState => ({ collections: [] })

export const collectionService = {
  createCollection(name: string): ServiceResult<Collection> { /* ... */ },
  renameCollection(id: string, name: string): ServiceResult<void> { /* ... */ },
  deleteCollection(id: string): ServiceResult<void> { /* ... */ },
  addPost(collectionId: string, postId: string): void { /* idempotent */ },
  removePost(collectionId: string, postId: string): void { /* idempotent */ },
  getCollections(): Collection[] { /* ... */ },
  getCollectionPosts(collectionId: string): DailyPost[] { /* resolve via postHistoryService */ },
  getAllMemberPostIds(): Set<string> { /* union of all postIds across all collections */ },
  getPostCollections(postId: string): Collection[] { /* which collections contain this post */ },
  reset(): void { /* Clear-All-Data path only — emits NOTHING */ },
};
```

**Event-emission rules** (mirror D-05 / D-06 from engagementService):
- `createCollection` / `renameCollection` / `deleteCollection` / `addPost` / `removePost`: emit exactly ONE `COLLECTIONS_CHANGED` with the appropriate `kind`.
- `reset()`: emits NOTHING.
- All mutators are idempotent (check membership before push+emit).

**Name validation** (Claude's Discretion):
- Non-empty after trim.
- ≤50 characters.
- Case-insensitive dedup: reject if `name.toLowerCase()` matches any existing collection.
- Return `ServiceResult<Collection>` with `{ success: false, error: 'Collection name already exists' }` on collision.

---

## Pattern 2: getPinnedIds() extension

**What:** Extend `engagementService.getPinnedIds()` to include collection members. Call site in `purgeExpired()` is unchanged.

**When to use:** Anywhere `getPinnedIds()` is called — currently only `post-history.service.ts:purgeExpired()`.

```typescript
// Modified in app/src/services/engagement.service.ts
// Source: engagement.service.ts:194 — current implementation

getPinnedIds(): Set<string> {
  const s = loadState();
  // D-09: union saved ∪ liked ∪ any-collection-member
  // Import collectionService lazily (or accept as parameter to avoid circular dep)
  const collectionMembers = collectionService.getAllMemberPostIds();
  return new Set<string>([...s.saved, ...s.liked, ...collectionMembers]);
},
```

**Circular dependency risk:** `engagementService` currently imports `postHistoryService`. Adding `collectionService` creates a potential import cycle if `collectionService` imports `engagementService`. Design: `collectionService` MUST NOT import `engagementService` (it only imports `postHistoryService` for snapshot resolution). The import graph is: `collectionService → postHistoryService` and `engagementService → postHistoryService + collectionService`. This is safe (no cycle). [ASSUMED — verify by inspection during implementation]

---

## Pattern 3: Fuse.js multi-field search configuration

**What:** Build a per-tab Fuse index from the active tab's post list, search on input (debounced 200ms), return results with match indices for highlighting.

**When to use:** Every time the search bar is non-empty in SavedScreen.

```typescript
// Source: Fuse.js README (github.com/krisk/Fuse) — VERIFIED

import Fuse from 'fuse.js';
import type { DailyPost } from '../types';

// Recommended options for post-search on mobile (title > body > source weights)
const FUSE_OPTIONS: Fuse.IFuseOptions<DailyPost> = {
  // Weight: title (0.6) > body (0.3) > source/concept (0.1)
  // Weights are relative; Fuse normalizes them internally.
  keys: [
    { name: 'title',                  weight: 0.6 },
    { name: 'bodyMarkdown',           weight: 0.3 },
    { name: 'sourceQuestionTitles',   weight: 0.1 },  // concept (array of strings)
    { name: 'contextLabel',           weight: 0.1 },  // source label
  ],
  threshold: 0.35,      // lower = stricter match (0.0=perfect, 1.0=anything)
  ignoreLocation: true, // CRITICAL for body text — match can appear anywhere
  includeMatches: true, // returns match indices for highlighting
  includeScore: true,   // enables relevance sort (D-14)
  minMatchCharLength: 2,
  shouldSort: true,     // relevance order when searching (D-14)
};

// Build index from corpus (< 3ms for ≤250 items per benchmark)
function buildIndex(posts: DailyPost[]): Fuse<DailyPost> {
  return new Fuse(posts, FUSE_OPTIONS);
}

// Incremental update (for adding a post without full rebuild):
// fuseIndex.add(newPost);   // supported in Fuse v7
// fuseIndex.remove(doc => doc.id === removedId);

// For our scale (≤250 posts, rebuild < 3ms), a full rebuild on ENGAGEMENT_CHANGED
// / COLLECTIONS_CHANGED is simpler and equivalent. Use .add() only if profiling
// shows rebuild overhead.
```

**Weight rationale:** `title > body > source` matches D-14. Weights 0.6/0.3/0.1 give a 6:3:1 ratio. `sourceQuestionTitles` and `contextLabel` share the 0.1 slot (Fuse accepts duplicate weight values across keys). [ASSUMED: exact ratio — adjust empirically if body match recall is too low]

**ignoreLocation critical:** Without `ignoreLocation: true`, Fuse uses its default `distance: 100` which only matches patterns appearing within ~60 characters of position 0. Body text with a match at position 200 would not return. This is the most common misconfiguration pitfall. [VERIFIED: Fuse.js README, scoring theory section]

---

## Pattern 4: Match highlighting with HighlightedText

**What:** Use `result.matches[0].indices` (array of `[start, end]` pairs) to wrap matched character runs in a `<mark>`-like span.

**When to use:** SearchResultRow title and body snippet rendering.

```typescript
// Source: Fuse.js README (includeMatches: true returns indices) — VERIFIED
// HighlightedText component — NEW (no existing equivalent in codebase)

function applyHighlight(text: string, indices: readonly [number, number][]): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of indices) {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark key={start} style={{ background: 'var(--primary-40)', color: '#fff', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(start, end + 1)}
      </mark>
    );
    cursor = end + 1;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

// 120-char body snippet centered on first match
function extractSnippet(body: string, firstMatchStart: number, maxChars = 120): { text: string; offset: number } {
  const half = Math.floor(maxChars / 2);
  const rawStart = Math.max(0, firstMatchStart - half);
  const rawEnd = Math.min(body.length, rawStart + maxChars);
  // Adjust indices for snippet offset when highlighting
  return { text: body.slice(rawStart, rawEnd), offset: rawStart };
}
```

**No existing equivalent:** There is no `<HighlightedText>` component in the codebase. The closest pattern is `text-normalization.ts` (HTML entity stripping, not highlighting). Build `HighlightedText.tsx` as a new utility component.

---

## Pattern 5: CollectionPickerSheet

**What:** A portaled `BottomSheet` with a checkbox list (Implicit Saved row pinned top, custom collections below), an inline `+ New collection` text-input row, and a Done button.

**When to use:** Opened by LongPressMenu's Save row.

```typescript
// Source: BottomSheet.tsx — compact prop exists, createPortal to document.body
// BottomSheet compact: minHeight='auto', maxHeight='50vh'

// State lifted to HomeScreen (same pattern as existing LongPressMenu):
const [pickerOpen, setPickerOpen] = useState(false);
const [pickerPostId, setPickerPostId] = useState<string | null>(null);

// CollectionPickerSheet props:
interface CollectionPickerSheetProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
}

// Inside sheet:
// Row 0 (pinned): Implicit "Saved" — checkbox pre-checked if engagementService.isSaved(postId)
// Rows 1..N: collectionService.getCollections() — checkbox checked if collectionService.getPostCollections(postId).includes(c)
// Row N+1: "+ New collection" — inline TextInput, confirm creates and adds
// Done button: closes sheet
```

**BottomSheet `compact` prop:** Already supports `compact` (minHeight: auto, maxHeight: 50vh). The collection picker with 3-6 rows plus inline create fits well. For longer collection lists, `maxHeight: 50vh` with `overflowY: auto` (already in BottomSheet's inner div) handles scroll. [VERIFIED: BottomSheet.tsx source]

**No-action Done behavior (D-05):** If user taps Done without unchecking "Saved," the Implicit Saved row's check-state triggers `engagementService.savePost(postId)` if not already saved. If already saved and user didn't uncheck, it's a no-op. This preserves the single-tap-save contract.

---

## Pattern 6: SavedScreen extension — search bar + filter chips

**What:** Pinned search input below the header, focus-conditional filter chip row (Concept / Source / Date), per-tab Fuse index, result cards with snippet + highlights.

```typescript
// Source: SavedScreen.tsx analysis — current structure
// Tab type extension:
type Tab = 'saved' | 'liked' | 'history' | 'collections';  // was 3-wide

// Search state:
const [query, setQuery] = useState('');
const [searchFocused, setSearchFocused] = useState(false);
const [filterConcept, setFilterConcept] = useState<string | null>(null);
const [filterSource, setFilterSource] = useState<string | null>(null);
const [filterDate, setFilterDate] = useState<'today' | 'last7' | 'last30' | 'all'>('all');

// Fuse index rebuilt on tab change or corpus mutation
const fuseIndex = useMemo(() => {
  const corpus = getCorpusForTab(activeTab); // saved/liked/history posts or []
  return buildIndex(corpus);
}, [activeTab, savedPosts, likedPosts, historyFlat, /* engagementVersion, collectionsVersion */]);

// Search runs debounced; filter chains on top:
const results = useMemo(() => {
  let items = query.trim().length >= 2
    ? fuseIndex.search(query).map(r => r.item)
    : getCorpusForTab(activeTab);
  if (filterConcept) items = items.filter(p => p.sourceQuestionTitles?.includes(filterConcept));
  if (filterSource) items = items.filter(p => p.contextLabel === filterSource);
  if (filterDate !== 'all') items = items.filter(p => dateFilter(p.generatedAt, filterDate));
  return items;
}, [query, fuseIndex, filterConcept, filterSource, filterDate, activeTab]);
```

**Chips show/hide:** `(searchFocused || query.length > 0)` — this is the D-11 trigger condition. Implemented as conditional render, no animation required (but a simple `opacity` transition is acceptable).

**ENGAGEMENT_CHANGED + COLLECTIONS_CHANGED subscription:** SavedScreen already subscribes to `ENGAGEMENT_CHANGED` via a `useEffect`. Extend the same `refresh()` callback to also re-read collections, and subscribe to `COLLECTIONS_CHANGED` in a parallel `useEffect`. SavedScreen is NOT always-mounted (sub-screen via Outlet), so cleanup unsubscribes on unmount automatically — no dual-effect location-pathname guard needed here. [VERIFIED: SavedScreen.tsx comment line 27-29]

---

## Pattern 7: LongPressMenu Save row → picker opener

**What:** Current Save row in `LongPressMenu.tsx` calls `engagementService.savePost/removeSavedPost` directly. Replace with a callback that opens the CollectionPickerSheet at the host level.

**Change scope:** LongPressMenu receives a new optional prop `onOpenCollectionPicker?: (postId: string) => void`. When provided, the Save row calls it instead of the direct toggle. HomeScreen wires this to `setPickerPostId + setPickerOpen`.

```typescript
// In LongPressMenu.tsx — MINIMAL change to existing API
interface LongPressMenuProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  anchorId: string | null;
  onOpenCollectionPicker?: (postId: string) => void; // NEW
}

const handleSave = () => {
  if (onOpenCollectionPicker && postId) {
    onOpenCollectionPicker(postId);  // opens picker instead of direct toggle
    onClose();                       // close long-press menu first
  } else {
    // fallback: direct toggle (for surfaces not yet wired to picker)
    if (isSaved) { engagementService.removeSavedPost(postId); ... }
    else { engagementService.savePost(postId); ... }
    onClose();
  }
};
```

**Save invocation sites — complete inventory:**

| File | Current behavior | Phase 50 change |
|------|-----------------|-----------------|
| `LongPressMenu.tsx` | Direct `engagementService.savePost/removeSavedPost` | Open picker via `onOpenCollectionPicker` callback |
| `PostDetailScreen.tsx` | No save/bookmark UI found (grep confirmed) | No change needed |
| `InfoFlow.tsx` | No save call found (grep confirmed) | No change needed |

Only ONE save call site exists: `LongPressMenu.tsx`. [VERIFIED: grep of codebase]

---

## Pattern 8: Date filter implementation

```typescript
// Pure date math — no lib/date.ts import (leaf service discipline)
// Used in SavedScreen (screen-level — can use Date directly)
function dateFilter(generatedAt: number, filter: 'today' | 'last7' | 'last30'): boolean {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (filter === 'today') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return generatedAt >= todayStart.getTime();
  }
  if (filter === 'last7') return generatedAt >= now - 7 * dayMs;
  if (filter === 'last30') return generatedAt >= now - 30 * dayMs;
  return true; // 'all'
}
```

**Preset date chips (D-12):** Today / Last 7 days / Last 30 days / All time. Implementation: radio-style single-select chip row (only one active at a time). "All time" is the default (no date filter). Tap active chip again → deselects (returns to "All time").

---

## Pattern 9: CollectionDrillInScreen

**What:** Full-screen sub-screen (rendered via Outlet like SavedScreen) showing posts in one collection. Header has back arrow + collection name + kebab for rename/delete.

```typescript
// Source: SavedScreen.tsx post-list pattern — reuse SavedRow component verbatim
// Navigation: navigate(`/collections/${collectionId}`) from Collections sub-tab row tap
// Route registration: /collections/:id → CollectionDrillInScreen

// Long-press a post in this screen → existing LongPressMenu with new "Remove from collection" row
// The "Remove from collection" row calls collectionService.removePost(collectionId, postId)
// and emits COLLECTIONS_CHANGED { kind: 'remove-post', collectionId }
```

**Header pattern:** Follows Phase 32.1 portal rule — CollectionDrillInScreen is a sub-screen via Outlet → Header portals to `document.body`. No `transform`/`will-change` on ancestors. [VERIFIED: CLAUDE.md + SavedScreen.tsx pattern]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search with typo tolerance | Custom Levenshtein impl | Fuse.js 7.3.0 | Bitap algorithm handles multi-field, weighted, with match index output. Rolling your own for "spaced repition" → "Spaced Repetition" matching takes 3x the code and misses edge cases |
| Match index to highlighted spans | Custom regex highlight | Fuse.js `includeMatches: true` indices | Fuse returns character-level `[start, end]` pairs; regex on the same query string breaks for special chars and multi-byte chars |
| Collection ID generation | `Math.random()`, Date.now() alone | `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` | Same pattern as `GraphEditLogEntry.id` — low-collision, readable in localStorage inspection |
| localStorage overflow recovery | Complex eviction | `try/catch` silent drop | Same pattern as `engagementService` and `postHistoryService` — quota is rarely hit in practice at this scale |

**Key insight:** Fuse.js is the only new package. Everything else reuses existing leaf-service, event-bus, and portal-sheet patterns that are already battle-tested in the codebase.

---

## Common Pitfalls

### Pitfall 1: ignoreLocation not set → body text never matches

**What goes wrong:** Fuse.js with default `ignoreLocation: false` and `distance: 100` only matches if the query appears within ~60 characters of position 0. A user searching "attention mechanism" in a post where the phrase appears at character 400 returns no result.

**Why it happens:** The Bitap algorithm is location-sensitive by default. D-14 requires matching "title, body, concept, source" — body text needs full-string search.

**How to avoid:** Always set `ignoreLocation: true` in the Fuse options object. Tests should assert a search against a string where the match is past character 200.

**Warning signs:** Search works on titles but misses body content; relevance scores are unexpectedly low for body matches.

---

### Pitfall 2: Circular import — collectionService ↔ engagementService

**What goes wrong:** `engagementService.getPinnedIds()` imports `collectionService`; if `collectionService` imports `engagementService` (even indirectly), Node.js / Vite resolves a partial module and `collectionService` is `undefined` at call time.

**Why it happens:** Leaf services both import `postHistoryService`. A developer might add a convenience method that inadvertently crosses the boundary.

**How to avoid:** `collectionService` imports ONLY `postHistoryService` (for snapshot resolution) and `eventBus`. `engagementService` imports `collectionService`. Draw the import arrow one-way.

**Warning signs:** `collectionService is not defined` or `cannot read properties of undefined` at runtime or in tests.

---

### Pitfall 3: Fuse index built in render body (not useMemo)

**What goes wrong:** Every keystroke triggers a full Fuse instantiation (new Fuse(posts, opts)) including index construction. At 250 posts × 3 keys, each `new Fuse()` call costs ~3ms — 16 calls/second = 48ms/second of JS time, causing perceptible jank.

**Why it happens:** Developer puts `const fuse = new Fuse(corpus, opts)` at top of render function or inside the search `onChange` handler.

**How to avoid:** Build the Fuse index in a `useMemo` that depends on `[activeTab, corpusVersion]` — not on `[query]`. The query only changes what `.search(query)` is called with, not the index structure.

**Warning signs:** Profiler shows repeated `Fuse` constructor calls; typing in search bar stutters.

---

### Pitfall 4: LongPressMenu Save row closes sheet before picker opens

**What goes wrong:** `onClose()` called before `setPickerOpen(true)` unmounts the LongPressMenu BottomSheet and its portal before the CollectionPickerSheet portal has mounted. React batches state updates in event handlers (React 19) so this may be fine, but sequencing matters if `onClose()` triggers an animation that removes the overlay.

**Why it happens:** Event handlers close the current sheet and try to open a new one in the same synchronous call.

**How to avoid:** Call `onOpenCollectionPicker(postId)` first (sets picker state), then `onClose()`. Both are state setters batched in one React render cycle. The LongPressMenu BottomSheet transitions out while CollectionPickerSheet transitions in.

**Warning signs:** Collection picker flash-appears then disappears; screen goes blank between sheets.

---

### Pitfall 5: i18n bundle parity gate blocks merge

**What goes wrong:** Developer adds strings to `en.json` but ships without zh/es/ja equivalents. `tests/locales/bundle-parity.test.mjs` fails in CI.

**Why it happens:** Phase 27 rule requires ALL 4 locales in the same PR. New `library.search.*`, `library.filters.*`, `library.collections.*`, and `library.savePicker.*` namespaces are each new top-level additions.

**How to avoid:** Run the Sonnet translate subagent (`app/scripts/translate-locales.md`) three times (once per non-EN locale) before creating the PR. Verify with `node --test tests/locales/bundle-parity.test.mjs`.

**Warning signs:** CI red on bundle-parity; `tsc -b --noEmit` errors on missing translation keys.

---

### Pitfall 6: Orphaned postIds in collections after Clear-All-Data

**What goes wrong:** `handleClearAllData` in `SettingsDataScreen.tsx` clears all `trellis_*` localStorage keys. `trellis_post_history` is wiped. Collections (`trellis_collections_v1`) survive if only `trellis_post_history` is removed but `trellis_collections_v1` is kept. At next load, `collectionService.getCollectionPosts()` resolves postIds via `postHistoryService.getPosts()` which returns `[]` — orphaned IDs are silently dropped (same as `engagementService` D-04 graceful degradation pattern).

**Why it happens:** Clear-All-Data is a prefix-key sweep, not a semantic reset. The current code `keys.filter(k => k.startsWith('trellis_') && k !== 'trellis_settings')` already catches `trellis_collections_v1` in the sweep.

**How to avoid:** Verify `trellis_collections_v1` IS included in the `trellis_*` sweep, OR explicitly add `collectionService.reset()` to `handleClearAllData` for belt-and-suspenders. The prefix sweep alone is sufficient. [VERIFIED: SettingsDataScreen.tsx:54-56 — sweep removes all `trellis_*` except `trellis_settings`]

---

### Pitfall 7: COLLECTIONS_CHANGED not added to AppEvent union

**What goes wrong:** TypeScript compiler rejects `eventBus.emit({ type: 'COLLECTIONS_CHANGED', payload: { kind: 'create', collectionId: id } })` because `COLLECTIONS_CHANGED` is not in the `AppEvent` union in `types/index.ts`.

**Why it happens:** The event bus is typed via the `AppEvent` union. New event types require adding a member to the union before any call site can compile.

**How to avoid:** Add `| { type: 'COLLECTIONS_CHANGED'; payload: { kind: 'create' | 'rename' | 'delete' | 'add-post' | 'remove-post'; collectionId: string } }` to the `AppEvent` union in `app/src/types/index.ts` in Wave 0, before any service or screen code uses it.

---

### Pitfall 8: Tab state not reset when Collections sub-tab drill-in is navigated back

**What goes wrong:** User taps a collection row → navigates to `/collections/:id`. When navigating back to `/saved`, `activeTab` is still `'collections'` and the drill-in row that was tapped is no longer visible, potentially leaving stale state.

**Why it happens:** `activeTab` is `useState` local to `SavedScreen`; it persists for the lifetime of the screen's mount (which may be long since it's a sub-screen overlay).

**How to avoid:** Reset search state (`setQuery('')`, clear filter chips) when `activeTab` changes. Use `useEffect([activeTab])` to clear `query` and `filterConcept/Source/Date` on tab switch — standard UX for tab-scoped search.

---

## i18n New Strings

**Proposed namespaces and keys** (EN canonical values shown — 4-locale parity required):

```json
// library.search.*
"library": {
  "search": {
    "placeholder": "Search...",
    "clearAria": "Clear search",
    "noMatches": "No matches in {{tab}}",
    "clearFilters": "Clear filters"
  },
  "filters": {
    "concept": "Concept",
    "source": "Source",
    "date": "Date",
    "today": "Today",
    "last7": "Last 7 days",
    "last30": "Last 30 days",
    "allTime": "All time",
    "clear": "Clear"
  },
  "collections": {
    "tabTitle": "Collections",
    "emptyTitle": "No collections yet",
    "emptyBody": "Save a post to create your first collection",
    "renamePrompt": "Rename collection",
    "deleteConfirm": "Delete \"{{name}}\"? Posts will remain in Saved.",
    "removeFromCollection": "Remove from collection",
    "postCount": "{{count}} post",
    "postCount_other": "{{count}} posts"
  },
  "savePicker": {
    "title": "Save to...",
    "implicitSaved": "Saved",
    "createNew": "+ New collection",
    "createPlaceholder": "Collection name",
    "done": "Done",
    "nameTooLong": "Name must be 50 characters or fewer",
    "nameEmpty": "Collection name cannot be empty",
    "nameDuplicate": "A collection with this name already exists"
  }
}
```

**Also extend `saved.tabs`:**
```json
"saved": {
  "tabs": {
    "saved": "Saved",
    "liked": "Liked",
    "history": "History",
    "collections": "Collections"   // NEW
  },
  "empty": {
    // existing keys unchanged, add:
    "collectionsTitle": "No collections yet",
    "collectionsBody": "Save a post and add it to a collection"
  }
}
```

**Total new keys:** ~25 keys across 4 locales (100 locale-file additions). [ASSUMED: exact count — adjust after finalizing the full UI copy]

---

## Code Examples

### Fuse.js multi-field search with match extraction

```typescript
// Source: Fuse.js README — github.com/krisk/Fuse [VERIFIED]

import Fuse from 'fuse.js';

const fuse = new Fuse(posts, {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'bodyMarkdown', weight: 0.3 },
    { name: 'sourceQuestionTitles', weight: 0.1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  includeMatches: true,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
});

const results = fuse.search('spaced rep');
// results[0] shape:
// { item: DailyPost, score: 0.04, matches: [{ key: 'title', value: 'Spaced Repetition', indices: [[0, 5]] }] }
```

### collectionService storage key pattern

```typescript
// Source: engagement.service.ts — VERIFIED identical pattern
const STORAGE_KEY = 'trellis_collections_v1';
function freshState(): CollectionsState { return { collections: [] }; }
function loadState(): CollectionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return freshState();
    return { collections: Array.isArray(parsed.collections) ? parsed.collections : [] };
  } catch { return freshState(); }
}
function saveState(state: CollectionsState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* quota exceeded — silently drop */ }
}
```

### COLLECTIONS_CHANGED event type (types/index.ts addition)

```typescript
// Source: AppEvent union pattern — VERIFIED (types/index.ts:692+)
| {
    type: 'COLLECTIONS_CHANGED';
    payload: {
      kind: 'create' | 'rename' | 'delete' | 'add-post' | 'remove-post';
      collectionId: string;
    };
  }
```

### SavedScreen COLLECTIONS_CHANGED subscription

```typescript
// Source: SavedScreen.tsx:269 existing ENGAGEMENT_CHANGED subscription — VERIFIED
useEffect(() => {
  const unsub = eventBus.subscribe('COLLECTIONS_CHANGED', () => {
    setCollections(collectionService.getCollections());
    // also refresh saved posts if membership changed (affects purge pin set)
    setSavedPosts(engagementService.getSavedPosts());
  });
  return unsub;
}, []);
```

---

## Fuse.js Scale Analysis (for this codebase)

**Maximum realistic corpus:** 7-day rolling history at 32 posts/day × 7 = 224 posts. Saved and Liked tabs are subsets of history. Collections tab does not use Fuse (it lists collection titles, not posts).

**Per Fuse.js benchmark (3 keys, modern CPU):**
- 1,000 items: index creation ~3ms, search ~17ms
- 224 items: index creation < 3ms, search < 5ms estimated

**Mobile WebView headroom:** Chrome on Android (M1-era mid-range device) targets 16ms frame budget. Even on 2019-era hardware, a <5ms Fuse search leaves ample headroom. No Web Worker needed. [VERIFIED: Fuse.js performance page]

**Fuse.js `.add()` API:** Supported in v7: `fuse.add(newDoc)`. For our corpus size and mutation frequency (posts added once per swipe), a full rebuild on every `ENGAGEMENT_CHANGED` event is acceptable. Use `.add()` only if profiling shows rebuild overhead. [VERIFIED: Fuse.js README]

**Bundle impact:** Fuse.js full build = 8.3 KB gzip (confirmed via bundlephobia). D-13 explicitly accepted this. No separate code splitting needed; the search feature is used on SavedScreen which is lazily loaded already (sub-screen via Outlet). [VERIFIED: bundlephobia.com query]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single "Saved" bucket, direct toggle on long-press | YouTube-playlist collection model, picker always opens on Save tap | Phase 50 | Adds collection organization; teaches the model by being unavoidable |
| No search in Library screen | Fuse.js fuzzy search scoped to active tab | Phase 50 | Fuzzy, typo-tolerant; covers title + body + concept |
| Purge pin: saved ∪ liked | Purge pin: saved ∪ liked ∪ collection-members | Phase 50 | Posts in a named collection survive 7-day rollover |
| 3 SavedScreen tabs | 4 SavedScreen tabs (+ Collections) | Phase 50 | Collections first-class citizen in Library |

**Deprecated/outdated:**
- `LongPressMenu.tsx` direct-toggle Save behavior: replaced by collection-picker-opener in Phase 50.

---

## Validation Architecture (Nyquist)

`nyquist_validation: true` per `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` with esbuild tsx loader |
| Config file | `app/tests/services/_actions-mock-loader.mjs` (for service tests needing mocks) |
| Quick run command | `node --test tests/services/collection.service.test.mjs` |
| Full suite command | `npm test` (from `app/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RETRIEVE-01 | Fuse search returns title match | unit | `node --test tests/services/search-index.test.mjs` | ❌ Wave 0 |
| RETRIEVE-01 | Fuse search returns body match (ignoreLocation) | unit | same file | ❌ Wave 0 |
| RETRIEVE-01 | Date filter math (Today / Last 7 / Last 30) | unit | `node --test tests/services/search-filters.test.mjs` | ❌ Wave 0 |
| RETRIEVE-01 | Relevance sort: title-match ranks above body-match | unit | same as search-index | ❌ Wave 0 |
| RETRIEVE-01 | SavedScreen tab → search-scope linkage | source-reading | `node --test tests/screens/SavedScreen.search-scope.test.mjs` | ❌ Wave 0 |
| RETRIEVE-02 | collectionService CRUD round-trip (create/rename/delete) | unit | `node --test tests/services/collection.service.test.mjs` | ❌ Wave 0 |
| RETRIEVE-02 | collectionService name validation (empty, too-long, dedup) | unit | same file | ❌ Wave 0 |
| RETRIEVE-02 | addPost/removePost idempotent, emits COLLECTIONS_CHANGED | unit | same file | ❌ Wave 0 |
| RETRIEVE-02 | reset() clears all, emits NOTHING | unit | same file | ❌ Wave 0 |
| RETRIEVE-02 | getPinnedIds() includes collection members (D-09) | unit | `node --test tests/services/engagement-pinned-ids-extension.test.mjs` | ❌ Wave 0 |
| RETRIEVE-02 | Collection picker: single-tap-save (Done with Saved pre-checked) | source-reading | `node --test tests/components/CollectionPickerSheet.test.mjs` | ❌ Wave 0 |
| RETRIEVE-02 | COLLECTIONS_CHANGED event registered in AppEvent union | source-reading | `tsc -b --noEmit` | existing |
| RETRIEVE-02 | 4 locale bundles have all new library.* keys | unit | `node --test tests/locales/bundle-parity.test.mjs` | existing |

### Sampling Rate

- **Per task commit:** `node --test tests/services/collection.service.test.mjs`
- **Per wave merge:** `npm test` from `app/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/services/collection.service.test.mjs` — covers RETRIEVE-02 (CRUD, idempotence, events, reset)
- [ ] `tests/services/search-index.test.mjs` — covers RETRIEVE-01 Fuse matching (title, body with ignoreLocation, relevance order)
- [ ] `tests/services/search-filters.test.mjs` — covers RETRIEVE-01 date filter math
- [ ] `tests/services/engagement-pinned-ids-extension.test.mjs` — covers D-09 pin union semantics
- [ ] `tests/screens/SavedScreen.search-scope.test.mjs` — source-reading: search bar scopes to active tab
- [ ] `tests/components/CollectionPickerSheet.test.mjs` — source-reading: implicit Saved pre-check, Done without uncheck still saves

---

## Security Domain

`security_enforcement` not explicitly `false` — included per protocol.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (local-first, no auth) |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a (single-user local) |
| V5 Input Validation | yes | Collection name: non-empty, ≤50 chars, trim, dedup. Search query: no execution path — passed only to Fuse.js in-memory, not to LLM or external service. |
| V6 Cryptography | no | n/a (no secrets stored in collections) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Collection name stored in localStorage, rendered in UI | Information Disclosure | Standard HTML encoding (React escapes by default). Length cap prevents storage exhaustion. |
| Search query sent to LLM (accidental regression) | Tampering | D-08 and D-16 explicitly bound the search corpus to local posts. RETRIEVE-01 is Fuse.js only — no LLM call in the search path. Verify no `chatCompletion` call in the search codepath. |
| Collection postIds referencing non-existent posts | Spoofing | Silently dropped by `collectionService.getCollectionPosts()` at read time (same as engagementService D-04 graceful degradation). |

---

## Open Questions (RESOLVED)

1. **Collection drill-in navigation pattern**
   - What we know: The spec says "compact list mirroring the existing Saved tab layout" with a header kebab. All other sub-screens navigate via react-router-dom with `/anchor/:id` etc. pattern.
   - What's unclear: Should the drill-in be a new route `/collections/:id` (new route entry in App.tsx) or an inline conditional render within SavedScreen (replace tab content area)? The former requires a new route; the latter avoids a new route but means the back-button behavior is a state toggle, not browser history pop.
   - Recommendation: Use a new route `/collections/:id` (matches existing `/anchor/:id`, `/cluster/:id` sub-screen pattern). Phase 49 research confirms the sub-screen-via-Outlet pattern is well-established.
   - RESOLVED: /collections/:id route implemented in plan 50-08.

2. **Tab count overflow on narrow screens**
   - What we know: TabButton uses `flex: 1` which distributes space equally. At 4 tabs each `flex: 1` on 375px viewport, each tab is ~94px wide. `minHeight: 44px` is set. Text is 14px. "Collections" is the longest label.
   - What's unclear: Does "Collections" fit in 94px at 14px without truncation on a 320px device? Japanese translation could be longer.
   - Recommendation: Set font-size to 13px for tabs when tab count is 4, or truncate with ellipsis. The planner should flag this for the UI phase.
   - RESOLVED: 13px font-size media query at <360px implemented in plan 50-09.

3. **postHistoryService import in collectionService — lazy vs eager**
   - What we know: Both `engagementService` and `collectionService` import `postHistoryService` for snapshot resolution. `engagementService` imports `collectionService`. Node.js and Vite handle this with eager binding, not lazy.
   - What's unclear: Whether the test environment's `localStorage` shim setup order matters.
   - Recommendation: Mirror the existing test pattern in `engagement.service.test.mjs` exactly — set up `localStorage` shim before any `await import(...)` call.
   - RESOLVED: mirror engagement.service.test.mjs pattern (plans 50-02 + 50-03).

---

## Environment Availability

Step 2.6: No external dependencies beyond npm packages already audited above. No CLIs, databases, or external services required for this phase. SKIPPED (all capabilities are Node.js + browser localStorage).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fuse.js weight ratio 0.6/0.3/0.1 gives good title>body>source ranking | Pattern 3 | Body matches might over-rank if 0.3 is too high; adjust to 0.5/0.25/0.1 empirically during UAT |
| A2 | Exact collection-picker state lifting lives in HomeScreen (same as LongPressMenu) | Pattern 5 | If PostDetailScreen needs its own picker entry point in a future wave, the pattern needs replication |
| A3 | CollectionDrillIn uses a new route `/collections/:id` (not inline conditional render) | Open Questions #1 | If a new route is rejected by operator, inline conditional needs different back-button handling |
| A4 | engagementService importing collectionService does not create a circular dep (collectionService → postHistoryService only) | Pattern 2 | If collectionService adds engagementService import, circular dep breaks boot; tests would surface this at import time |
| A5 | 25 new i18n string keys is the right estimate | i18n New Strings | Bundle-parity test will catch any discrepancy at CI time |

---

## Sources

### Primary (HIGH confidence)
- `app/src/services/engagement.service.ts` — leaf-service blueprint read directly [VERIFIED]
- `app/src/services/post-history.service.ts` — purgeExpired() call site, getPinnedIds() consumer [VERIFIED]
- `app/src/screens/SavedScreen.tsx` — Tab type, existing subscription, refresh pattern [VERIFIED]
- `app/src/components/LongPressMenu.tsx` — sole Save invocation site, handleSave shape [VERIFIED]
- `app/src/components/ui/BottomSheet.tsx` — compact prop, portal pattern [VERIFIED]
- `app/src/hooks/useLongPress.ts` — 480ms threshold, bind interface [VERIFIED]
- `app/src/lib/event-bus.ts` — subscribe/emit typed API [VERIFIED]
- `app/src/types/index.ts` — AppEvent union, DailyPost type, engagement CHANGED shape [VERIFIED]
- `app/src/locales/en.json` — existing saved/engagement namespaces [VERIFIED]
- `app/src/screens/settings/SettingsDataScreen.tsx` — handleClearAllData prefix sweep [VERIFIED]
- github.com/krisk/Fuse README — Fuse.js v7 API: .add(), weighted keys, ignoreLocation, includeMatches [VERIFIED]
- bundlephobia.com (fuse.js@7.3.0) — 8.3 KB gzip [VERIFIED]
- npm registry (fuse.js) — version 7.3.0, 2026-05-14 release, 10.3M weekly downloads [VERIFIED]
- slopcheck 0.6.1 — fuse.js [OK] on npm ecosystem [VERIFIED]

### Secondary (MEDIUM confidence)
- fusejs.io performance page (via WebFetch) — benchmark data: 1,000 items < 3ms index, < 17ms search [MEDIUM — page source verified]
- Fuse.js GitHub README token-search section — useTokenSearch: true feature note [VERIFIED via raw GitHub]

### Tertiary (LOW confidence)
- bundlephobia data for gzip: 8.3KB — fetched via bundlephobia API, spot-checked against README's "~8 kB" claim [MEDIUM — two sources agree]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — fuse.js verified on npm, slopcheck OK, bundle size confirmed
- Architecture: HIGH — all integration points read from live source files
- Pitfalls: HIGH — derived from reading actual source code + Fuse.js documented behavior
- i18n keys: MEDIUM — count estimated; bundle-parity test will enforce correctness at CI

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable ecosystem; only risk is Fuse.js breaking change above 7.3.0)
