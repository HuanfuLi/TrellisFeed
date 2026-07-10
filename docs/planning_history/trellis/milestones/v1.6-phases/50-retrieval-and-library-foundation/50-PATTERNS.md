# Phase 50: Retrieval and Library Foundation — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/services/collection.service.ts` | service | CRUD + event-emitter | `app/src/services/engagement.service.ts` | exact |
| `app/src/services/engagement.service.ts` | service (modify) | CRUD + event-emitter | self | — |
| `app/src/services/post-history.service.ts` | service (verify only) | CRUD | self | — |
| `app/src/types/index.ts` | types (modify) | — | self | — |
| `app/src/lib/event-bus.ts` | no-op — already typed via AppEvent union | — | self | — |
| `app/src/components/CollectionPickerSheet.tsx` | component | UI-pure + CRUD | `app/src/components/LongPressMenu.tsx` | exact (BottomSheet compact + row pattern) |
| `app/src/components/FilterPickerSheet.tsx` | component | UI-pure + read-only | `app/src/components/LongPressMenu.tsx` | exact (BottomSheet compact + row pattern) |
| `app/src/components/ui/HighlightedText.tsx` | component | UI-pure (transform) | none — new primitive | no analog |
| `app/src/screens/SavedScreen.tsx` | screen (modify) | CRUD + event-subscriber | self | — |
| `app/src/screens/CollectionDrillInScreen.tsx` | screen | read-only + event-subscriber | `app/src/screens/AnchorDetailScreen.tsx` | role-match |
| `app/src/components/LongPressMenu.tsx` | component (modify) | UI-pure + CRUD | self | — |
| `app/src/App.tsx` | config (modify) | route | self | — |
| `app/src/locales/en.json` | locale | — | self | — |
| `app/src/locales/zh.json` | locale | — | self | — |
| `app/src/locales/es.json` | locale | — | self | — |
| `app/src/locales/ja.json` | locale | — | self | — |
| `app/tests/services/collection.service.test.mjs` | test | — | `app/tests/services/engagement.service.test.mjs` | exact |
| `app/tests/components/CollectionPickerSheet.test.mjs` | test | — | `app/tests/components/LongPressMenu.test.mjs` | exact (source-reading pattern) |

---

## Pattern Assignments

### `app/src/services/collection.service.ts` (service, CRUD + event-emitter)

**Analog:** `app/src/services/engagement.service.ts`

**Imports pattern** (lines 1-5 of analog):
```typescript
import type { DailyPost } from '../types/index.ts';
import { eventBus } from '../lib/event-bus.ts';
import { postHistoryService } from './post-history.service.ts';
// NOTE: collectionService MUST NOT import engagementService (circular dep risk).
// Import direction: engagementService → collectionService → postHistoryService.
```

**Storage key pattern** (lines 30-65 of analog):
```typescript
const STORAGE_KEY = 'trellis_collections_v1';  // matches trellis_engagement_v1 pattern

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

function freshState(): CollectionsState {
  return { collections: [] };
}

function loadState(): CollectionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return freshState();
    return { collections: Array.isArray(parsed.collections) ? parsed.collections : [] };
  } catch {
    return freshState();
  }
}

function saveState(state: CollectionsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded — silently drop
  }
}
```

**Idempotent mutator + event emit pattern** (lines 87-102 of analog — copy exactly):
```typescript
// Pattern: check membership before mutate + emit; no double-emit
savePost(postId: string): void {
  const state = loadState();
  if (state.saved.includes(postId)) return;  // idempotent guard
  state.saved.push(postId);
  saveState(state);
  eventBus.emit({ type: 'ENGAGEMENT_CHANGED', payload: { kind: 'save', id: postId } });
},
// Adapt for collection: emit COLLECTIONS_CHANGED with kind + collectionId
```

**ID generation pattern** (Claude's Discretion from CONTEXT.md):
```typescript
// Use collision-resistant ID combining timestamp + random suffix — matches GraphEditLogEntry.id
const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
```

**reset() pattern** (lines 207-209 of analog — emits NOTHING):
```typescript
reset(): void {
  saveState(freshState());
  // MUST NOT emit — wholesale wipe path (Clear-All-Data)
},
```

**ID-only storage with snapshot resolution** (lines 67-81 of analog):
```typescript
function resolvePostsByIds(ids: string[]): DailyPost[] {
  const all = postHistoryService.getPosts();
  const byId = new Map<string, DailyPost>();
  for (const p of all) byId.set(p.id, p);
  const out: DailyPost[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p) out.push(p);
  }
  return out;
}
```

**Name validation rule** (Claude's Discretion):
```typescript
// Non-empty after trim, ≤50 chars, case-insensitive dedup
function validateName(name: string, existingCollections: Collection[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'nameEmpty';   // returns i18n key suffix
  if (trimmed.length > 50) return 'nameTooLong';
  if (existingCollections.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return 'nameDuplicate';
  return null;
}
// createCollection returns ServiceResult<Collection> — { success: false, error: 'nameTooLong' } on failure
```

**Full service export shape:**
```typescript
export const collectionService = {
  createCollection(name: string): ServiceResult<Collection>,
  renameCollection(id: string, name: string): ServiceResult<void>,
  deleteCollection(id: string): ServiceResult<void>,
  addPost(collectionId: string, postId: string): void,       // idempotent
  removePost(collectionId: string, postId: string): void,    // idempotent
  getCollections(): Collection[],
  getCollectionPosts(collectionId: string): DailyPost[],     // resolves via postHistoryService
  getAllMemberPostIds(): Set<string>,                         // union of all postIds
  getPostCollections(postId: string): Collection[],          // reverse lookup
  reset(): void,                                             // emits NOTHING
};
```

**File-level comment rule:** Copy the leaf-module discipline block from `engagement.service.ts` lines 1-25 and adapt it. The key invariants to document: no JSON imports, no react-i18next, no lib/date.ts. One signal per semantic action (COLLECTIONS_CHANGED). reset() emits nothing.

---

### `app/src/services/engagement.service.ts` — `getPinnedIds()` extension (modify)

**Change:** Lines 193-197 of the existing file. Add `collectionService.getAllMemberPostIds()` to the union.

**Current pattern** (lines 194-197):
```typescript
getPinnedIds(): Set<string> {
  const s = loadState();
  return new Set<string>([...s.saved, ...s.liked]);
},
```

**New pattern:**
```typescript
// Add import at top of file (after existing imports):
import { collectionService } from './collection.service.ts';

// Extend getPinnedIds() — D-09:
getPinnedIds(): Set<string> {
  const s = loadState();
  const collectionMembers = collectionService.getAllMemberPostIds();
  return new Set<string>([...s.saved, ...s.liked, ...collectionMembers]);
},
```

**Circular dep check:** `collectionService` must NOT import `engagementService`. The import graph is unidirectional: `engagementService → collectionService → postHistoryService`.

---

### `app/src/types/index.ts` — `COLLECTIONS_CHANGED` AppEvent union member (modify)

**Pattern:** `AppEvent` union at line 692. Copy the `GRAPH_UPDATED` member shape (lines 737-745) as the model for an optional payload with a discriminated `kind` field. `COLLECTIONS_CHANGED` is simpler — payload is always provided.

**Existing `ENGAGEMENT_CHANGED` shape to mirror** (line 722):
```typescript
| { type: 'ENGAGEMENT_CHANGED'; payload: { kind: 'save' | 'unsave' | 'like' | 'unlike' | 'undismiss'; id: string } }
```

**New union member to add (insert after line 722 or at end of union):**
```typescript
| {
    type: 'COLLECTIONS_CHANGED';
    payload: {
      kind: 'create' | 'rename' | 'delete' | 'add-post' | 'remove-post';
      collectionId: string;
    };
  }
```

**Also add `Collection` type** (insert in the domain types section near the top — before or after `DailyPost`):
```typescript
export interface Collection {
  id: string;
  name: string;
  postIds: string[];
  createdAt: number;
  updatedAt: number;
}
```

---

### `app/src/components/CollectionPickerSheet.tsx` (component, UI-pure + CRUD)

**Analog:** `app/src/components/LongPressMenu.tsx` (exact pattern: BottomSheet compact, rowStyle, state read at render time from services)

**Imports pattern** (lines 1-6 of analog):
```typescript
import { useTranslation } from 'react-i18next';
import { Bookmark, Folder, FolderPlus, Check } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { engagementService } from '../services/engagement.service';
import { collectionService } from '../services/collection.service';
import { toast } from '../lib/toast';
```

**Props interface pattern** (analog lines 7-12, extend with new fields):
```typescript
interface CollectionPickerSheetProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
}
```

**Defensive guard pattern** (analog lines 48-54 — same pattern, same rule: host can open without a postId):
```typescript
if (!postId) {
  return (
    <BottomSheet open={false} onClose={onClose} compact>
      <></>
    </BottomSheet>
  );
}
```

**State read at render time** (analog lines 56-57 — read service state synchronously):
```typescript
// Read current membership state synchronously (no subscription needed — sheet opens fresh)
const isSaved = engagementService.isSaved(postId);
const collections = collectionService.getCollections();
const postCollectionIds = new Set(collectionService.getPostCollections(postId).map(c => c.id));
```

**BottomSheet compact sheet with title** (analog lines 106-107):
```typescript
return (
  <BottomSheet open={open} onClose={handleDone} compact>
    {/* title row: t('library.savePicker.title') at 18px/700 */}
    {/* implicit Saved row: Bookmark icon, pre-checked if isSaved */}
    {/* 1px var(--border) divider */}
    {/* custom collection rows: Folder icon, checkbox per collection */}
    {/* 1px var(--border) divider */}
    {/* + New collection row: FolderPlus icon, morphs to TextInput on tap */}
    {/* Done button: full-width, var(--primary-40) background */}
  </BottomSheet>
);
```

**rowStyle** (analog lines 87-103 — copy exactly, same min-height 56px):
```typescript
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  minHeight: '56px',
  padding: '0 16px',
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '15px',
  fontWeight: 500,
  color: 'var(--foreground)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};
```

**Behavioral contract on Done** (CONTEXT D-04/D-05):
- If implicit Saved row is checked AND post not yet saved: call `engagementService.savePost(postId)` → toast saved.
- If implicit Saved row is unchecked AND post was saved: call `engagementService.removeSavedPost(postId)`.
- For each custom collection: if check-state changed, call `collectionService.addPost` or `removePost`.
- All mutations happen at Done time, not per-checkbox toggle.
- Call `onOpenCollectionPicker → onClose()` sequence: set picker state first, then close LongPressMenu (React 19 batches both in one render cycle — no flash).

**Toast after Done** (analog toast pattern at lines 63-67):
```typescript
toast(t('library.collections.toast.added', { collection: name }), 'success');
// or for remove: toast(t('library.collections.toast.removed', { collection: name }), 'info');
// No toast when nothing changed (idempotent close)
```

---

### `app/src/components/FilterPickerSheet.tsx` (component, UI-pure + read-only)

**Analog:** `app/src/components/LongPressMenu.tsx` (same BottomSheet compact + row pattern; single-select variant)

**Props interface:**
```typescript
interface FilterPickerSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;                              // e.g., t('library.filters.concept.placeholder')
  options: { label: string; value: string }[]; // data from caller
  selected: string | null;
  onSelect: (value: string | null) => void;
  emptyTitle?: string;
  emptyBody?: string;
}
```

**Single-select row pattern** (no checkbox — leading Check icon for active row):
```typescript
// Row tap → onSelect(option.value) + onClose()
// No Done button; single tap commits
<button type="button" style={rowStyle} onClick={() => { onSelect(option.value); onClose(); }}>
  <Check size={18} color={selected === option.value ? 'var(--primary-40)' : 'transparent'} />
  <span>{option.label}</span>
</button>
```

**Date picker variant** (4 fixed rows — Today / Last 7 days / Last 30 days / All time):
- Default active: "All time" (pre-checked with Check icon).
- Same single-tap-commits pattern.

**Concept picker data source:** `questionService.getAnchors()` mapped to `{ label: anchor.title, value: anchor.id }`.
**Source picker data source:** deduped `contextLabel` values from the active tab's corpus.

---

### `app/src/components/ui/HighlightedText.tsx` (component, UI-pure transform)

**Analog:** None — new primitive. No existing highlight component in codebase.

**Pattern from RESEARCH.md Pattern 4** (verified against Fuse.js docs):
```typescript
// HighlightedText.tsx — wraps Fuse match indices in <mark> spans.
// indices: readonly [number, number][] from result.matches[n].indices
// text: the raw string (title or body snippet)

function HighlightedText({ text, indices }: { text: string; indices?: readonly [number, number][] }) {
  if (!indices || indices.length === 0) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of indices) {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark
        key={start}
        style={{
          background: 'var(--primary-40)',
          color: '#fff',
          borderRadius: 2,
          padding: '0 4px',  // var(--space-xs) = 4px per UI-SPEC
        }}
      >
        {text.slice(start, end + 1)}
      </mark>
    );
    cursor = end + 1;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export default HighlightedText;
```

**Snippet extraction helper** (place in same file or in SavedScreen.tsx directly):
```typescript
export function extractSnippet(
  body: string,
  firstMatchStart: number,
  maxChars = 120,
): { text: string; offset: number } {
  const half = Math.floor(maxChars / 2);
  const rawStart = Math.max(0, firstMatchStart - half);
  const rawEnd = Math.min(body.length, rawStart + maxChars);
  const text = body.slice(rawStart, rawEnd);
  const prefix = rawStart > 0 ? '…' : '';
  const suffix = rawEnd < body.length ? '…' : '';
  return { text: prefix + text + suffix, offset: rawStart };
}
// Indices passed to HighlightedText for snippet must be re-based: subtract offset from each [start, end].
```

---

### `app/src/screens/SavedScreen.tsx` — extension (modify)

**Read before modifying:** `app/src/screens/SavedScreen.tsx` lines 1-430 (full file, 430 lines).

**Tab type extension** (line 48):
```typescript
// Current:
type Tab = 'saved' | 'liked' | 'history';
// New:
type Tab = 'saved' | 'liked' | 'history' | 'collections';
```

**New state additions** (after existing state at lines 243-252):
```typescript
// Search state
const [query, setQuery] = useState('');
const [searchFocused, setSearchFocused] = useState(false);
const [filterConcept, setFilterConcept] = useState<string | null>(null);
const [filterSource, setFilterSource] = useState<string | null>(null);
const [filterDate, setFilterDate] = useState<'today' | 'last7' | 'last30' | 'all'>('all');

// Collections state
const [collections, setCollections] = useState<Collection[]>(() => collectionService.getCollections());
```

**Existing event subscription pattern** (lines 269-272 — copy shape, extend refresh):
```typescript
// Existing:
useEffect(() => {
  const unsub = eventBus.subscribe('ENGAGEMENT_CHANGED', () => refresh());
  return unsub;
}, [refresh]);

// New sibling effect (do NOT merge into one effect — separate concerns):
useEffect(() => {
  const unsub = eventBus.subscribe('COLLECTIONS_CHANGED', () => {
    setCollections(collectionService.getCollections());
    // also refresh saved posts in case pin-set changed
    setSavedPosts(engagementService.getSavedPosts());
  });
  return unsub;
}, []);
```

**Tab reset on tab change** (new useEffect, per RESEARCH Pitfall 8):
```typescript
useEffect(() => {
  setQuery('');
  setFilterConcept(null);
  setFilterSource(null);
  setFilterDate('all');
}, [activeTab]);
```

**Fuse index pattern** (useMemo — NOT in render body, per RESEARCH Pitfall 3):
```typescript
const fuseIndex = useMemo(() => {
  const corpus =
    activeTab === 'saved' ? savedPosts
    : activeTab === 'liked' ? likedPosts
    : activeTab === 'history' ? [...historyGroups.values()].flat()
    : [];  // collections tab has no Fuse search (lists collection titles)
  return buildIndex(corpus);  // new Fuse(corpus, FUSE_OPTIONS)
}, [activeTab, savedPosts, likedPosts, historyGroups]);
// buildIndex and FUSE_OPTIONS live in a sibling module or at top of file
```

**Fuse search options** (constant at module top — ignoreLocation is CRITICAL per RESEARCH Pitfall 1):
```typescript
const FUSE_OPTIONS: Fuse.IFuseOptions<DailyPost> = {
  keys: [
    { name: 'title',               weight: 0.6 },
    { name: 'bodyMarkdown',        weight: 0.3 },
    { name: 'sourceQuestionTitles', weight: 0.1 },
    { name: 'contextLabel',        weight: 0.1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,   // CRITICAL — body text match may appear at pos 400+
  includeMatches: true,   // returns indices for HighlightedText
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};
```

**Search bar anatomy** (inline in screen — not extracted to component per UI-SPEC):
- `position: sticky; top: calc(var(--safe-area-top) + 56px); z-index: 5` wrapper.
- Inner input: `flex: 1; minWidth: 0` — minWidth: 0 is LOAD-BEARING per ChatInput rule (CLAUDE.md §ChatInput flex shrink).
- Clear-X button: visible only when `query.length > 0`.
- Filter chip row: mounted when `searchFocused || query.length > 0`.

**4th tab button** (extend TabButton row at lines 336-344):
```typescript
<TabButton active={activeTab === 'collections'} onClick={() => setActiveTab('collections')}>
  {t('saved.tabs.collections')}
</TabButton>
```

**SavedRow extended variant for search results:**
```typescript
// When query.trim().length >= 2, wrap title in <HighlightedText> and show body snippet.
// The existing SavedRow props interface gets an optional `searchMatch` prop:
interface SavedRowProps {
  post: DailyPost;
  indexInList: number;
  onOpen: () => void;
  searchMatch?: Fuse.FuseResultMatch[]; // from result.matches
}
// Body snippet only renders when searchMatch has a 'bodyMarkdown' key match.
```

**Empty/no-match state** (mirroring EmptyState component at lines 150-202, new branch):
```typescript
// Add to EmptyState component: new 'no-match' tab value
// Or render inline in the main content area when results.length === 0 && query.trim().length >= 2:
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', gap: '12px' }}>
  <Search size={40} color="var(--muted-foreground)" />
  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--muted-foreground)', margin: 0 }}>
    {t('library.search.noMatches', { tab: t(`saved.tabs.${activeTab}`) })}
  </p>
  <button onClick={clearFilters} style={{ background: 'var(--surface-variant)', color: 'var(--primary-40)', border: 'none', padding: '10px 24px', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 700, minHeight: '44px' }}>
    {t('library.search.clearFilters')}
  </button>
</div>
```

**Collections sub-tab collection row** (mirroring SavedRow at lines 65-148):
```typescript
// Tap → navigate(`/collections/${collection.id}`)
// Long-press (useLongPress hook, 480ms) → open rename/delete sheet
// Icon: Folder size={22} color="var(--primary-40)"
// Post-count: Caption 12/500 / var(--muted-foreground)
// Chevron: ChevronRight size={18} color="var(--muted-foreground)"
```

---

### `app/src/screens/CollectionDrillInScreen.tsx` (screen, read-only + event-subscriber)

**Analog:** `app/src/screens/AnchorDetailScreen.tsx` (sub-screen via Outlet, Header portals to body, useParams for ID)

**Imports pattern** (analog lines 1-12):
```typescript
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreVertical } from 'lucide-react';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { BottomSheet } from '../components/ui/BottomSheet';
import { collectionService } from '../services/collection.service';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';
import { useLongPress } from '../hooks/useLongPress';
// Import SavedRow from SavedScreen if exported, or duplicate the pattern
```

**Route param + not-found guard** (analog lines 14-43):
```typescript
export function CollectionDrillInScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [collection, setCollection] = useState(() => id ? collectionService.getCollections().find(c => c.id === id) : undefined);
  const [posts, setPosts] = useState(() => id ? collectionService.getCollectionPosts(id) : []);

  if (!collection) {
    // same guard pattern as AnchorDetailScreen lines 22-42
    return (/* error/not-found render */);
  }
  // ...
}
```

**COLLECTIONS_CHANGED subscription for in-place resync:**
```typescript
useEffect(() => {
  const unsub = eventBus.subscribe('COLLECTIONS_CHANGED', (e) => {
    if (e.payload.collectionId === id) {
      const updated = collectionService.getCollections().find(c => c.id === id);
      if (!updated) {
        navigate('/saved');  // collection deleted — exit drill-in
        return;
      }
      setCollection(updated);
      setPosts(collectionService.getCollectionPosts(id!));
    }
  });
  return unsub;
}, [id, navigate]);
```

**Header with right-slot kebab** (analog Header usage at line 11):
```typescript
<Header
  backTo="/saved"
  title={collection.name}
  right={
    <button
      onClick={() => setKebabOpen(true)}
      aria-label={t('library.collections.kebabAria')}
      style={{ background: 'none', border: 'none', padding: '8px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
    >
      <MoreVertical size={22} />
    </button>
  }
/>
```

**Content scroll container** (matching SavedScreen.tsx lines 314-326 pattern):
```typescript
<div
  style={{
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    paddingTop: `${HEADER_HEIGHT + 16}px`,
    paddingBottom: 'var(--bottom-nav-safe)',
    maxWidth: '448px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  }}
>
```

**LongPressMenu with new `collectionContext` prop** (for Remove from collection row):
```typescript
<LongPressMenu
  open={menuOpen}
  onClose={() => setMenuOpen(false)}
  postId={menuPostId}
  anchorId={menuAnchorId}
  collectionContext={{ collectionId: id!, collectionName: collection.name }}
  onOpenCollectionPicker={(pid) => { setPickerPostId(pid); setPickerOpen(true); }}
/>
```

**Rename + Delete confirmation sheets** (using BottomSheet compact — same as LongPressMenu):
- Rename: single TextInput pre-filled, full-width "Save name" button (var(--primary-40) bg).
- Delete: two buttons side-by-side — "Keep collection" (var(--surface-variant)) and "Delete" (var(--danger)).
- Delete on confirm: `collectionService.deleteCollection(id)` → `navigate('/saved')` → toast.

**Post list with entrance animation** (matching SavedScreen.tsx lines 384-390):
```typescript
// Reuse `saved-card-in` keyframe (declare via <style> tag as in SavedScreen)
// 40ms stagger per row on indexInList
```

---

### `app/src/components/LongPressMenu.tsx` — Save row behavior change (modify)

**Read before modifying:** `app/src/components/LongPressMenu.tsx` lines 1-141 (full file, 141 lines).

**Props interface extension** (add after line 12):
```typescript
interface LongPressMenuProps {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  anchorId: string | null;
  onOpenCollectionPicker?: (postId: string) => void;  // NEW — D-04
  collectionContext?: { collectionId: string; collectionName: string };  // NEW — drill-in context
}
```

**handleSave replacement** (lines 59-68 of analog):
```typescript
const handleSave = () => {
  if (onOpenCollectionPicker && postId) {
    // D-04: always open picker; close menu first (React 19 batches both)
    onOpenCollectionPicker(postId);
    onClose();
  } else {
    // Fallback: direct toggle for surfaces not yet wired to picker
    if (isSaved) {
      engagementService.removeSavedPost(postId);
      toast(t('engagement.toast.unsaved'), 'info');
    } else {
      engagementService.savePost(postId);
      toast(t('engagement.toast.saved'), 'success');
    }
    onClose();
  }
};
```

**New "Remove from collection" row** (insert between Save row and Not Interested row — only when `collectionContext` is provided):
```typescript
{collectionContext && (
  <button type="button" style={rowStyle} onClick={handleRemoveFromCollection}>
    <FolderMinus size={22} color="var(--foreground)" fill="none" />
    <span>{t('library.collections.removeFromCollection')}</span>
  </button>
)}
```

**handleRemoveFromCollection:**
```typescript
const handleRemoveFromCollection = () => {
  if (!postId || !collectionContext) return;
  collectionService.removePost(collectionContext.collectionId, postId);
  toast(
    t('library.collections.toast.removed', { collection: collectionContext.collectionName }),
    'info',
    { action: { label: t('common.undo'), onAction: () => {
      collectionService.addPost(collectionContext.collectionId, postId);
      eventBus.emit({ type: 'COLLECTIONS_CHANGED', payload: { kind: 'add-post', collectionId: collectionContext.collectionId } });
    }}}
  );
  onClose();
};
```

**Visual invariant:** Save row visual is UNCHANGED (Bookmark icon fill/outline still reflects `engagementService.isSaved(postId)`). Only the on-tap behavior changes.

---

### `app/src/App.tsx` — route registration (modify)

**Existing route pattern** (lines 308-309 of analog):
```typescript
{ path: 'anchor/:id', element: <PageTransition><AnchorDetailScreen /></PageTransition> },
{ path: 'cluster/:id', element: <PageTransition><ClusterDetailScreen /></PageTransition> },
```

**New route to add** (insert adjacent to above, same nesting level):
```typescript
{ path: 'collections/:id', element: <PageTransition><CollectionDrillInScreen /></PageTransition> },
```

**Import to add** (following existing import style at lines 24-25):
```typescript
import { CollectionDrillInScreen } from './screens/CollectionDrillInScreen';
```

---

### `app/src/locales/en.json` — new `library.*` namespace (modify)

**Read before modifying:** Check current structure at line 184 (`"library"` key already exists) and `"saved"` at line 729.

**New top-level `library` block** (full key inventory from UI-SPEC §Copywriting Contract):
```json
"library": {
  "search": {
    "placeholder": "Search...",
    "clearAria": "Clear search",
    "noMatches": "No matches in {{tab}}",
    "clearFilters": "Clear filters"
  },
  "filters": {
    "date": { "label": "Date", "today": "Today", "last7": "Last 7 days", "last30": "Last 30 days", "allTime": "All time" },
    "concept": { "label": "Concept", "placeholder": "Filter by concept", "emptyTitle": "No concepts yet", "emptyBody": "Save more posts to build your concept list" },
    "source": { "label": "Source", "placeholder": "Filter by source", "emptyTitle": "No sources tracked yet" }
  },
  "collections": {
    "tabTitle": "Collections",
    "emptyTitle": "No collections yet",
    "emptyBody": "Save a post to create your first collection",
    "drillInEmptyTitle": "This collection is empty",
    "drillInEmptyBody": "Add posts from the Save sheet",
    "rename": "Rename",
    "saveName": "Save name",
    "delete": "Delete",
    "keepCollection": "Keep collection",
    "kebabAria": "Collection options",
    "deleteConfirm": "Delete \"{{name}}\"? Posts will remain in Saved.",
    "removeFromCollection": "Remove from collection",
    "postCount_one": "{{count}} post",
    "postCount_other": "{{count}} posts",
    "toast": {
      "added": "Added to {{collection}}",
      "addedMultiple": "Added to {{count}} collections",
      "removed": "Removed from {{collection}}",
      "renamed": "Renamed to \"{{name}}\"",
      "deleted": "Deleted \"{{name}}\""
    }
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

**Extend existing `saved.tabs`** (at line 731):
```json
"saved": {
  "tabs": {
    "saved": "Saved",
    "liked": "Liked",
    "history": "History",
    "collections": "Collections"
  }
}
```

**i18n workflow rule:** Run the Sonnet translate subagent (`app/scripts/translate-locales.md`) three times for zh/es/ja BEFORE the PR. Keep `{{name}}`, `{{count}}`, `{{collection}}`, `{{tab}}` placeholders verbatim. Use ICU plural suffixes (`_one` / `_other`) for `postCount`. `bundle-parity.test.mjs` will block merge if any locale is missing keys.

---

### `app/tests/services/collection.service.test.mjs` (test)

**Analog:** `app/tests/services/engagement.service.test.mjs` (exact pattern)

**Test file structure** (lines 1-46 of analog):
```javascript
// Phase 50 — collection.service.ts behavioral test suite.
// Mirrors engagement.service.test.mjs shape (localStorage shim + dynamic imports).

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill for Node
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { collectionService } = await import('../../src/services/collection.service.ts');
const { eventBus } = await import('../../src/lib/event-bus.ts');

const STORAGE_KEY = 'trellis_collections_v1';

let collectionsChangedEvents = [];
const unsubs = [];

function captureAll() {
  collectionsChangedEvents = [];
  while (unsubs.length) { try { unsubs.pop()?.(); } catch { /* noop */ } }
  unsubs.push(eventBus.subscribe('COLLECTIONS_CHANGED', (e) => collectionsChangedEvents.push(e)));
}

describe('collectionService — Phase 50', () => {
  beforeEach(() => { localStorage.clear(); captureAll(); });
  // ...test cases...
});
```

**Required test cases** (from RESEARCH §Validation Architecture):
1. `createCollection` CRUD round-trip — persists to `trellis_collections_v1`, emits `COLLECTIONS_CHANGED { kind: 'create' }`.
2. Name validation: empty → error; >50 chars → error; case-insensitive duplicate → error.
3. `addPost` / `removePost` idempotent — no double-emit.
4. `getAllMemberPostIds()` returns correct union across collections.
5. `reset()` clears all, emits NOTHING.
6. `renameCollection` / `deleteCollection` emit correct `kind`.

---

### `app/tests/components/CollectionPickerSheet.test.mjs` (test)

**Analog:** `app/tests/components/LongPressMenu.test.mjs` (source-reading pattern)

**Test file structure** (analog lines 1-25):
```javascript
// Source-reading invariant tests — no React DOM rendering.
// Pattern: readFileSync + regex assertions.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

function readSrc(rel) {
  return readFileSync(path.join(appRoot, rel), 'utf8');
}
```

**Required test cases:**
1. Renders `<BottomSheet compact>` (matches LP-01 pattern).
2. Implicit "Saved" row is pre-checked via `engagementService.isSaved(postId)` — assert pattern exists in source.
3. Done button calls commit logic (not direct toggle — assert `onOpenCollectionPicker` prop exists in LongPressMenu source).
4. `collectionService.addPost` and `removePost` are referenced in picker (not engagementService direct toggle).
5. `COLLECTIONS_CHANGED` is emitted after mutations (not before).

---

## Shared Patterns

### localStorage Leaf-Service Pattern
**Source:** `app/src/services/engagement.service.ts` lines 30-65
**Apply to:** `collection.service.ts`

Key rules (from CLAUDE.md leaf-module discipline):
- No `import ... from 'react-i18next'`
- No `import ... from '../lib/date.ts'`
- No JSON imports
- `loadState()` / `saveState()` are module-private functions
- `freshState()` returns the zero-value state shape
- `try/catch` with silent drop for quota errors in `saveState()`
- `try/catch` with `return freshState()` for parse errors in `loadState()`

### Event Bus Pattern
**Source:** `app/src/lib/event-bus.ts` + `app/src/types/index.ts` lines 692-745
**Apply to:** `collection.service.ts` (emit), `SavedScreen.tsx` (subscribe), `CollectionDrillInScreen.tsx` (subscribe)

```typescript
// Emit:
eventBus.emit({ type: 'COLLECTIONS_CHANGED', payload: { kind: 'create', collectionId: id } });

// Subscribe (in useEffect with cleanup):
useEffect(() => {
  const unsub = eventBus.subscribe('COLLECTIONS_CHANGED', (e) => { /* handler */ });
  return unsub;  // cleanup on unmount
}, []);
```

### BottomSheet Compact Sheet
**Source:** `app/src/components/ui/BottomSheet.tsx` lines 23-29 (props) + `app/src/components/LongPressMenu.tsx` lines 106-107
**Apply to:** `CollectionPickerSheet.tsx`, `FilterPickerSheet.tsx`, rename/delete sheets in `CollectionDrillInScreen.tsx`

```typescript
// BottomSheet compact prop: minHeight: 'auto', maxHeight: '50vh', overflowY: auto
// Always portaled to document.body via createPortal (escapes slot containing block)
// paddingBottom: 'calc(24px + 80px + var(--safe-area-bottom))' — DO NOT override
<BottomSheet open={open} onClose={onClose} compact>
  {children}
</BottomSheet>
```

### Toast with Undo Action
**Source:** `app/src/lib/toast.ts` (Phase 49-03 extension)
**Apply to:** `CollectionDrillInScreen.tsx` "Remove from collection" action

```typescript
toast(
  t('library.collections.toast.removed', { collection: name }),
  'info',
  { action: { label: t('common.undo'), onAction: () => { /* re-add */ } } }
);
```

### useLongPress Hook (480ms)
**Source:** `app/src/hooks/useLongPress.ts`
**Apply to:** Collection row long-press in SavedScreen Collections sub-tab

```typescript
const { didLongPress, bind } = useLongPress(480, () => setRenameDeleteOpen(true));
// In onClick: if (didLongPress.current) return; // suppress tap when long-press fired
```

### Inline Styles + CSS Variables
**Source:** `app/src/screens/SavedScreen.tsx` (entire file — key vars used)
**Apply to:** All new components and screens

Key vars: `var(--primary-40)`, `var(--surface)`, `var(--surface-variant)`, `var(--card)`, `var(--foreground)`, `var(--muted-foreground)`, `var(--border)`, `var(--radius)`, `var(--radius-pill)`, `var(--shadow-1)`, `var(--shadow-3)`, `var(--danger)`, `var(--bottom-nav-safe)`, `var(--safe-area-top)`, `var(--safe-area-bottom)`

NO Tailwind classes. All styles via `style={{...}}` with CSS variable references.

### Header Portal Rule (sub-screens)
**Source:** CLAUDE.md §"Header positioning" + `app/src/components/ui/Header.tsx`
**Apply to:** `CollectionDrillInScreen.tsx`

```typescript
// CollectionDrillInScreen is a sub-screen via Outlet → Header portals to document.body automatically.
// No transform / will-change / filter / contain / perspective on any ancestor of Header.
// Use HEADER_HEIGHT constant for paddingTop on the scroll container.
<Header backTo="/saved" title={collection.name} right={<KebabButton />} />
```

### Sub-Screen Scroll Container
**Source:** `app/src/screens/SavedScreen.tsx` lines 314-326
**Apply to:** `CollectionDrillInScreen.tsx`

```typescript
<div
  style={{
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    paddingTop: `${HEADER_HEIGHT + 16}px`,
    paddingBottom: 'var(--bottom-nav-safe)',
    maxWidth: '448px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  }}
>
```

### ServiceResult<T> Return Type
**Source:** Established project convention (CLAUDE.md §"Style Conventions")
**Apply to:** `collectionService.createCollection()`, `collectionService.renameCollection()`, `collectionService.deleteCollection()`

```typescript
// ServiceResult<T> = { success: true; data: T } | { success: false; error: string }
// The `error` string value is the i18n key suffix (e.g., 'nameTooLong') so callers can call t(`library.savePicker.${error}`)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/src/components/ui/HighlightedText.tsx` | component | UI-pure (transform) | No existing text-highlight component in codebase; new primitive. Closest structural analog is inline JSX in `ChatMessage.tsx` but no reusable pattern to extract from. |

---

## Critical Load-Bearing Rules (copy into plan read_first lists)

1. **minWidth: 0 on all flex inputs** (CLAUDE.md §ChatInput flex shrink) — the search bar's `<input>` MUST have `minWidth: 0` alongside `flex: 1`. Tests enforce this on ChatInput; apply the same discipline here.

2. **Fuse index in useMemo, NOT in render body** (RESEARCH Pitfall 3) — `new Fuse(corpus, opts)` inside a `useMemo` keyed on corpus identity. Never inside the search `onChange` handler.

3. **ignoreLocation: true is non-negotiable** (RESEARCH Pitfall 1) — without it, body text matches at position > 60 char are silently missed.

4. **collectionService MUST NOT import engagementService** (RESEARCH Pitfall 2) — circular dep breaks boot. Import direction: `engagementService → collectionService → postHistoryService`.

5. **COLLECTIONS_CHANGED must be in AppEvent union before any emit site compiles** (RESEARCH Pitfall 7) — add to `types/index.ts` in Wave 0 before writing any service or component code.

6. **All 4 locale bundles in same PR** (CLAUDE.md §i18n Workflow) — bundle-parity.test.mjs blocks merge.

7. **reset() emits NOTHING** (engagement.service.ts D-08 comment at line 199) — copy exact pattern to collectionService.reset().

8. **Tab state reset on tab switch** (RESEARCH Pitfall 8) — useEffect([activeTab]) must clear query + filters when active tab changes.

9. **LongPressMenu Save row: onOpenCollectionPicker first, then onClose** (RESEARCH Pitfall 4) — wrong order causes sheet flash/disappear. Call picker state setter BEFORE calling onClose.

10. **No transform/will-change/filter/contain on CollectionDrillInScreen ancestors** (CLAUDE.md §Header positioning rule 1) — sub-screen Header portals to body; any containing-block creator on an ancestor breaks it.

---

## Metadata

**Analog search scope:** `app/src/services/`, `app/src/components/`, `app/src/screens/`, `app/src/hooks/`, `app/src/lib/`, `app/src/types/`, `app/tests/`
**Files scanned:** 18 source files (read in full or targeted sections)
**Pattern extraction date:** 2026-05-18
