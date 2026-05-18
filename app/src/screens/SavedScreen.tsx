// SavedScreen — Library (Saved | Liked | History | Collections).
//
// Phase 43 plan 43-04 shipped Saved | Liked. 2026-05-12 consolidation added a
// History tab and absorbed the standalone PostHistoryScreen. Phase 50 plan
// 50-09 extends to a 4-tab strip — adding Collections — and introduces the
// sticky search bar with focus-conditional filter chips (Concept · Source ·
// Date), Fuse-backed per-tab search, highlighted result rows with 120-char
// body snippets, the no-match empty state, and a forward-compat
// CollectionPickerSheet host. Also hosts an inline rename / delete sheet for
// long-press on collection rows.
//
// Sub-screen rendered via <Outlet> overlay at zIndex 50 in App.tsx. NOT mounted
// inside SwipeTabContainer; the Header portals to document.body (Phase 32.1
// pattern — see Header.tsx insideSwipeTab discrimination).
//
// Data sources:
//   - Saved tab        → engagementService.getSavedPosts()
//   - Liked tab        → engagementService.getLikedPosts()
//   - History tab      → postHistoryService.getPostsByDay() — day-grouped Map
//   - Collections tab  → collectionService.getCollections()
//
// Tab state is local useState (operator-locked at SV-04 — owned by the screen,
// NOT a route param). Tap toggle, no swipe gesture. Phase 50 D-15: URL stays
// `/saved` regardless of active tab.
//
// Re-sync: subscribes to ENGAGEMENT_CHANGED so when the user un-saves /
// un-likes from a parallel surface (LongPressMenu, PostDetailScreen heart) the
// visible list refreshes in-place. Sibling COLLECTIONS_CHANGED subscription
// keeps the Collections tab + collection pin-set fresh after picker mutations,
// drill-in renames, deletions, and Remove-from-collection. SavedScreen is NOT
// always-mounted (sub-screen via Outlet) so useEffect cleanup unsubscribes
// automatically on unmount (RESEARCH §Pitfall 7).
//
// Phase 50 search wiring (load-bearing — see CLAUDE.md §ChatInput rule + 50-09
// must_haves):
//   - Search input has BOTH `flex: 1` AND `minWidth: 0` inline. Without
//     `minWidth: 0`, Android WebView refuses to shrink the input below
//     intrinsic content width and the Clear-X button overflows off-screen.
//   - Fuse index is built inside `useMemo` keyed on [activeTab, savedPosts,
//     likedPosts, historyGroups] (RESEARCH §Pitfall 3). NEVER inside render
//     body or onChange handler.
//   - onChange debounces via `clearTimeout` + `setTimeout` ~200ms (CONTEXT.md
//     Claude's Discretion). Input echo is instant via `inputDraft`; Fuse
//     re-search waits 200ms idle.
//   - Switching tabs clears query + ALL 3 filter chips (RESEARCH §Pitfall 8).
//   - Query is capped at 200 chars at the service boundary (library-search
//     service `capQuery`); SavedScreen does NOT cap upstream.
//   - Result row title rendered via HighlightedText with Fuse match indices;
//     body snippet rendered via extractSnippet + rebaseIndices +
//     HighlightedText. NEVER dangerouslySetInnerHTML (T-50-XSS-HL).
//
// Phase 32.1 invariant: no transform / will-change / filter / contain /
// perspective on Header ancestors. Outer container uses minHeight: '100%' +
// flex column ONLY. Sticky search bar uses `position: sticky` which does NOT
// create a containing block.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bookmark,
  Heart,
  Clock,
  AlertCircle,
  Search,
  X,
  Folder,
  ChevronRight,
} from 'lucide-react';
import Fuse, { type FuseResult, type FuseResultMatch } from 'fuse.js';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { BottomSheet } from '../components/ui/BottomSheet';
import HighlightedText from '../components/ui/HighlightedText';
import { CollectionPickerSheet } from '../components/CollectionPickerSheet';
import { FilterPickerSheet, type FilterPickerOption } from '../components/FilterPickerSheet';
import { engagementService } from '../services/engagement.service';
import { postHistoryService } from '../services/post-history.service';
import { collectionService } from '../services/collection.service';
import { questionService } from '../services/question.service';
import {
  FUSE_OPTIONS,
  capQuery,
  dateFilter,
  extractSnippet,
  rebaseIndices,
  type DateFilterPreset,
} from '../services/library-search.service';
import { eventBus } from '../lib/event-bus';
import { today } from '../lib/date';
import { toast } from '../lib/toast';
import type { DailyPost, Collection } from '../types';

type Tab = 'saved' | 'liked' | 'history' | 'collections';

// ─── SavedRow ────────────────────────────────────────────────────────────────
// Search-result variant: when `searchMatch` is provided, the title renders via
// HighlightedText with match indices, and a 120-char body snippet line appears
// below contextLabel when there is a body match.

interface SavedRowProps {
  post: DailyPost;
  indexInList: number;
  onOpen: () => void;
  searchMatch?: readonly FuseResultMatch[];
}

function SavedRow({ post, indexInList, onOpen, searchMatch }: SavedRowProps) {
  const [pressed, setPressed] = useState(false);

  const thumb = post.videoMeta?.thumbnailUrl ?? post.newsMeta?.imageUrl ?? null;
  const emoji = post.presentationStyle === 'text-art' ? '✎' : '📄';

  // Extract per-field match indices (Fuse returns matches by key).
  const titleMatch = searchMatch?.find((m) => m.key === 'title');
  const bodyMatch = searchMatch?.find((m) => m.key === 'bodyMarkdown');

  // Build the body snippet (120 chars centered on the first match) + rebase
  // the Fuse indices into the snippet window so HighlightedText paints the
  // right runs.
  let snippetText = '';
  let snippetIndices: [number, number][] = [];
  if (bodyMatch && bodyMatch.indices.length > 0 && post.bodyMarkdown) {
    const firstStart = bodyMatch.indices[0][0];
    const { text, offset } = extractSnippet(post.bodyMarkdown, firstStart, 120);
    snippetText = text;
    snippetIndices = rebaseIndices(bodyMatch.indices, offset, text.length);
  }

  return (
    <button
      onClick={onOpen}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: pressed ? 'var(--surface-variant)' : 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-1)',
        padding: '12px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'background 150ms ease',
        opacity: 0,
        animation: `saved-card-in 300ms ease ${indexInList * 40}ms forwards`,
      }}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '8px',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '8px',
            background: 'var(--surface-variant)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}
        >
          {emoji}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.4,
          }}
        >
          {titleMatch ? (
            <HighlightedText text={post.title} indices={titleMatch.indices} />
          ) : (
            post.title
          )}
        </div>
        {post.contextLabel && (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              marginTop: '3px',
            }}
          >
            {post.contextLabel}
          </div>
        )}
        {snippetText && (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              marginTop: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
            }}
          >
            <HighlightedText text={snippetText} indices={snippetIndices} />
          </div>
        )}
      </div>
    </button>
  );
}

// ─── EmptyState (existing tab empties, unchanged shape) ──────────────────────

function EmptyState({
  tab,
  t,
}: {
  tab: Tab;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const Icon =
    tab === 'saved'
      ? Bookmark
      : tab === 'liked'
        ? Heart
        : tab === 'collections'
          ? Folder
          : Clock;
  const titleKey =
    tab === 'saved'
      ? 'saved.empty.savedTitle'
      : tab === 'liked'
        ? 'saved.empty.likedTitle'
        : tab === 'collections'
          ? 'library.collections.emptyTitle'
          : 'home.history.emptyTitle';
  const bodyKey =
    tab === 'saved'
      ? 'saved.empty.savedBody'
      : tab === 'liked'
        ? 'saved.empty.likedBody'
        : tab === 'collections'
          ? 'library.collections.emptyBody'
          : 'home.history.emptyBody';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        gap: '8px',
      }}
    >
      <Icon size={40} color="var(--muted-foreground)" />
      <p
        style={{
          fontSize: '15px',
          fontWeight: 700,
          color: 'var(--muted-foreground)',
          margin: 0,
        }}
      >
        {/* The cast is a typed-key narrowing — these keys all exist in en.json. */}
        {t(titleKey as 'saved.empty.savedTitle')}
      </p>
      <p
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--muted-foreground)',
          margin: 0,
          textAlign: 'center',
          maxWidth: '280px',
        }}
      >
        {t(bodyKey as 'saved.empty.savedBody')}
      </p>
    </div>
  );
}

// ─── TabButton ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="saved-tab-button"
      style={{
        flex: 1,
        padding: '12px 0',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--primary-40)' : 'var(--muted-foreground)',
        borderBottom: active ? '2px solid var(--primary-40)' : '2px solid transparent',
        marginBottom: '-1px',
        minHeight: '44px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {children}
    </button>
  );
}

// ─── FilterChip (inline helper — NOT extracted to ui/ per UI-SPEC) ───────────

interface FilterChipProps {
  label: string;
  active: boolean;
  onTap: () => void;
  onClear: () => void;
}

function FilterChip({ label, active, onTap, onClear }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '32px',
        padding: '0 12px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        border: active ? '1px solid var(--primary-40)' : '1px solid var(--border)',
        background: active ? 'var(--primary-40)' : 'var(--surface-variant)',
        color: active ? '#fff' : 'var(--foreground)',
        transition: 'background-color 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      <span>{label}</span>
      {active && (
        <span
          role="button"
          aria-label="Clear filter"
          onClick={(e) => {
            // Use stopPropagation so the chip body tap (re-open picker)
            // doesn't fire when the user means to clear.
            e.stopPropagation();
            onClear();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            cursor: 'pointer',
          }}
        >
          <X size={12} />
        </span>
      )}
    </button>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('saved');
  const [savedPosts, setSavedPosts] = useState<DailyPost[]>(() =>
    engagementService.getSavedPosts(),
  );
  const [likedPosts, setLikedPosts] = useState<DailyPost[]>(() =>
    engagementService.getLikedPosts(),
  );
  const [historyGroups, setHistoryGroups] = useState<Map<string, DailyPost[]>>(() => {
    try {
      return postHistoryService.getPostsByDay();
    } catch {
      return new Map();
    }
  });
  const [historyError, setHistoryError] = useState(false);
  const [collections, setCollections] = useState<Collection[]>(() =>
    collectionService.getCollections(),
  );

  // Phase 50 search state. `inputDraft` is bound to <input value> for instant
  // echo; `query` is the debounced value passed to Fuse. The debounceRef holds
  // the pending setTimeout handle so Clear-X and tab-change can flush it.
  const [query, setQuery] = useState('');
  const [inputDraft, setInputDraft] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // Filter state (D-12: Concept / Source / Date).
  const [filterConcept, setFilterConcept] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<DateFilterPreset>('all');

  // Filter picker sheet hosts.
  const [conceptPickerOpen, setConceptPickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Collection picker host (forward-compat for row-level Save flow — 50-09
  // hosts at SavedScreen level so a future row-level Save action can open it).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPostId, setPickerPostId] = useState<string | null>(null);

  // Collections tab long-press rename/delete state.
  const [actionCollection, setActionCollection] = useState<Collection | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [renameSheetOpen, setRenameSheetOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);

  const refresh = useCallback(() => {
    setSavedPosts(engagementService.getSavedPosts());
    setLikedPosts(engagementService.getLikedPosts());
    try {
      setHistoryGroups(postHistoryService.getPostsByDay());
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    }
  }, []);

  // ENGAGEMENT_CHANGED subscription — keeps Saved/Liked/History in-sync when
  // the user un-saves / un-likes from a parallel surface.
  useEffect(() => {
    const unsub = eventBus.subscribe('ENGAGEMENT_CHANGED', () => refresh());
    return unsub;
  }, [refresh]);

  // COLLECTIONS_CHANGED sibling subscription — refreshes the Collections tab
  // AND re-reads saved posts because collection membership extends the
  // pin-set (D-09), so adding to a collection may surface previously-purged
  // posts back into the saved/liked corpus.
  useEffect(() => {
    const unsub = eventBus.subscribe('COLLECTIONS_CHANGED', () => {
      setCollections(collectionService.getCollections());
      setSavedPosts(engagementService.getSavedPosts());
    });
    return unsub;
  }, []);

  // Tab-change reset (RESEARCH §Pitfall 8): clear query + all 3 filter chips
  // when active tab changes. Tab corpora are independent so leftover
  // query/filters from a previous tab would feel broken.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputDraft('');
    setQuery('');
    setFilterConcept(null);
    setFilterSource(null);
    setFilterDate('all');
  }, [activeTab]);

  // Day-heading formatter for the History tab. Mirrors the legacy
  // PostHistoryScreen.tsx formatDayHeading — Today / Yesterday / Mmm d.
  const formatDayHeading = useCallback(
    (dateStr: string): string => {
      const todayStr = today();
      if (dateStr === todayStr) return t('home.history.today');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      if (dateStr === yStr) return t('home.history.yesterday');
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },
    [t],
  );

  // History flat-index — drives the per-row entrance animation stagger so the
  // delay continues monotonically across day groups.
  const historyFlatIndex = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const posts of historyGroups.values())
      for (const p of posts) map.set(p.id, idx++);
    return map;
  }, [historyGroups]);

  // Per-tab corpus — drives the Fuse index AND the unfiltered list view.
  const corpusForTab = useCallback(
    (tab: Tab): DailyPost[] => {
      if (tab === 'saved') return savedPosts;
      if (tab === 'liked') return likedPosts;
      if (tab === 'history')
        return Array.from(historyGroups.values()).flat();
      return []; // collections tab has no Fuse search
    },
    [savedPosts, likedPosts, historyGroups],
  );

  // Fuse index — useMemo keyed on activeTab + corpus identity (RESEARCH
  // §Pitfall 3). NEVER inside render body or onChange handler. The
  // FUSE_OPTIONS import carries `ignoreLocation: true` (RESEARCH §Pitfall 1).
  // The literal `ignoreLocation: true` annotation below is for source-reading
  // test enforcement; it documents the load-bearing knob in this file.
  const fuseIndex = useMemo(() => {
    const corpus = corpusForTab(activeTab);
    // ignoreLocation: true — see FUSE_OPTIONS in library-search.service.ts.
    return new Fuse(corpus, FUSE_OPTIONS);
  }, [activeTab, corpusForTab]);

  // Compute baseResults: trimmed query >=2 → Fuse search; else identity list.
  const trimmed = capQuery(query.trim());
  const baseResults: Array<{ item: DailyPost; matches?: readonly FuseResultMatch[] }> =
    trimmed.length >= 2
      ? (fuseIndex.search(trimmed) as FuseResult<DailyPost>[]).map((r) => ({
          item: r.item,
          matches: r.matches,
        }))
      : corpusForTab(activeTab).map((item) => ({ item }));

  // Apply filter chips (AND across the 3 dimensions). Source matches via
  // contextLabel equality; Concept matches via sourceQuestionTitles inclusion;
  // Date via library-search dateFilter (already mitigates timezone edge cases).
  const filtered = baseResults.filter(({ item }) => {
    if (filterConcept && !(item.sourceQuestionTitles ?? []).includes(filterConcept))
      return false;
    if (filterSource && item.contextLabel !== filterSource) return false;
    if (!dateFilter(item.generatedAt, filterDate)) return false;
    return true;
  });

  const isFlatTab = activeTab === 'saved' || activeTab === 'liked';
  const searchActive = trimmed.length >= 2;
  const anyFilterActive =
    filterConcept !== null || filterSource !== null || filterDate !== 'all';
  const showFilterChips = searchFocused || inputDraft.length > 0 || anyFilterActive;

  // Empty / no-match logic.
  const tabEmpty = (() => {
    if (activeTab === 'saved') return savedPosts.length === 0;
    if (activeTab === 'liked') return likedPosts.length === 0;
    if (activeTab === 'history') return historyGroups.size === 0 && !historyError;
    return collections.length === 0;
  })();
  const noMatch = activeTab !== 'collections' && (searchActive || anyFilterActive) && filtered.length === 0;

  // Filter picker options.
  const conceptOptions = useMemo<FilterPickerOption[]>(() => {
    try {
      const all = questionService.getAll();
      const titles = new Set<string>();
      for (const q of all) {
        if (q.isAnchorNode === true && q.title) titles.add(q.title);
      }
      return Array.from(titles).map((title) => ({ label: title, value: title }));
    } catch {
      return [];
    }
  }, [collections, savedPosts, likedPosts]);

  const sourceOptions = useMemo<FilterPickerOption[]>(() => {
    const labels = new Set<string>();
    for (const p of corpusForTab(activeTab)) {
      if (p.contextLabel) labels.add(p.contextLabel);
    }
    return Array.from(labels).map((label) => ({ label, value: label }));
  }, [corpusForTab, activeTab]);

  const dateOptions: FilterPickerOption[] = [
    { label: t('library.filters.date.today'), value: 'today' },
    { label: t('library.filters.date.last7'), value: 'last7' },
    { label: t('library.filters.date.last30'), value: 'last30' },
    { label: t('library.filters.date.allTime'), value: 'all' },
  ];

  // Collections tab long-press handler.
  const openCollectionAction = useCallback((c: Collection) => {
    setActionCollection(c);
    setActionSheetOpen(true);
  }, []);

  const clearAllFilters = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputDraft('');
    setQuery('');
    setFilterConcept(null);
    setFilterSource(null);
    setFilterDate('all');
  }, []);

  // Rename submit — validates via collectionService.renameCollection.
  const handleRenameSubmit = useCallback(() => {
    if (!actionCollection) return;
    const result = collectionService.renameCollection(actionCollection.id, renameValue);
    if (!result.success) {
      setRenameError(result.error);
      return;
    }
    toast(t('library.collections.toast.renamed', { name: renameValue.trim() }), 'success');
    setRenameSheetOpen(false);
    setRenameValue('');
    setRenameError(null);
    setActionCollection(null);
  }, [actionCollection, renameValue, t]);

  // Delete confirm — collectionService handles idempotency.
  const handleDeleteConfirm = useCallback(() => {
    if (!actionCollection) return;
    const name = actionCollection.name;
    collectionService.deleteCollection(actionCollection.id);
    toast(t('library.collections.toast.deleted', { name }), 'info');
    setDeleteSheetOpen(false);
    setActionCollection(null);
  }, [actionCollection, t]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Header backTo="/home" title={t('saved.title')} />

      <style>{`
        @keyframes saved-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 359px) {
          .saved-tab-button {
            font-size: 13px !important;
          }
        }
      `}</style>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 16px',
          paddingTop: `${HEADER_HEIGHT + 8}px`,
          paddingBottom: 'var(--bottom-nav-safe)',
          maxWidth: '448px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Sticky search bar (UI-SPEC Surface 1). position: sticky does NOT
            create a containing block (Phase 32.1 rule satisfied). */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            background: 'var(--surface)',
            padding: '8px 0 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 16px',
              backgroundColor: 'var(--surface-variant)',
              borderRadius: 'var(--radius-pill)',
              height: '44px',
              border: `1.5px solid ${searchFocused || query.length > 0 ? 'var(--primary-40)' : 'transparent'}`,
              transition: 'border-color 0.2s',
            }}
          >
            <Search
              size={18}
              color={
                searchFocused || query.length > 0
                  ? 'var(--primary-40)'
                  : 'var(--muted-foreground)'
              }
              style={{ flexShrink: 0 }}
            />
            <input
              type="text"
              value={inputDraft}
              onChange={(e) => {
                const value = e.target.value;
                setInputDraft(value);
                // ~200ms debounce per CONTEXT.md Claude's Discretion. Input
                // echo is instant; Fuse re-search waits for 200ms idle so
                // typing doesn't cost a Fuse pass per keystroke.
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => { setQuery(value); }, 200);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('library.search.placeholder')}
              aria-label={t('library.search.placeholder')}
              style={{
                // flex: 1 alongside minWidth: 0 is LOAD-BEARING per
                // CLAUDE.md §ChatInput flex shrink. Without minWidth: 0,
                // Android WebView refuses to shrink below intrinsic width
                // and the Clear-X button overflows.
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                color: 'var(--foreground)',
                fontSize: 14,
                border: 'none',
                outline: 'none',
              }}
            />
            {inputDraft.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  setInputDraft('');
                  setQuery('');
                }}
                aria-label={t('library.search.clearAria')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  margin: '-10px 0',
                  padding: 10,
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Filter chip row (UI-SPEC Surface 2) — focus-conditional. */}
          {showFilterChips && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '8px 0 0',
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              <FilterChip
                label={filterConcept ?? t('library.filters.concept.label')}
                active={!!filterConcept}
                onTap={() => setConceptPickerOpen(true)}
                onClear={() => setFilterConcept(null)}
              />
              <FilterChip
                label={filterSource ?? t('library.filters.source.label')}
                active={!!filterSource}
                onTap={() => setSourcePickerOpen(true)}
                onClear={() => setFilterSource(null)}
              />
              <FilterChip
                label={
                  filterDate === 'all'
                    ? t('library.filters.date.label')
                    : filterDate === 'today'
                      ? t('library.filters.date.today')
                      : filterDate === 'last7'
                        ? t('library.filters.date.last7')
                        : t('library.filters.date.last30')
                }
                active={filterDate !== 'all'}
                onTap={() => setDatePickerOpen(true)}
                onClear={() => setFilterDate('all')}
              />
            </div>
          )}
        </div>

        {/* Tab bar — 4 tabs. */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            marginTop: '16px',
            marginBottom: '16px',
          }}
        >
          <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>
            {t('saved.tabs.saved')}
          </TabButton>
          <TabButton active={activeTab === 'liked'} onClick={() => setActiveTab('liked')}>
            {t('saved.tabs.liked')}
          </TabButton>
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            {t('saved.tabs.history')}
          </TabButton>
          <TabButton
            active={activeTab === 'collections'}
            onClick={() => setActiveTab('collections')}
          >
            {t('saved.tabs.collections')}
          </TabButton>
        </div>

        {/* History error branch (post-history snapshot store unreadable). */}
        {activeTab === 'history' && historyError ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              gap: '8px',
            }}
          >
            <AlertCircle size={32} style={{ color: 'var(--muted-foreground)' }} />
            <span style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>
              {t('home.history.errorTitle')}
            </span>
            <button
              onClick={refresh}
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--primary-40)',
                background: 'var(--surface-variant)',
                border: 'none',
                cursor: 'pointer',
                marginTop: '8px',
                padding: '10px 24px',
                borderRadius: 'var(--radius)',
                minHeight: '44px',
              }}
            >
              {t('home.history.errorRetry')}
            </button>
          </div>
        ) : noMatch ? (
          /* No-match state (UI-SPEC Surface 8) — search active but no
             results in the current tab. */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 16px',
              gap: '12px',
            }}
          >
            <Search size={40} color="var(--muted-foreground)" />
            <p
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--muted-foreground)',
                margin: 0,
              }}
            >
              {t('library.search.noMatches', {
                tab: t(
                  `saved.tabs.${activeTab}` as
                    | 'saved.tabs.saved'
                    | 'saved.tabs.liked'
                    | 'saved.tabs.history'
                    | 'saved.tabs.collections',
                ),
              })}
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                background: 'var(--surface-variant)',
                color: 'var(--primary-40)',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                fontWeight: 700,
                minHeight: '44px',
                cursor: 'pointer',
              }}
            >
              {t('library.search.clearFilters')}
            </button>
          </div>
        ) : tabEmpty && !searchActive && !anyFilterActive ? (
          <EmptyState tab={activeTab} t={t} />
        ) : activeTab === 'collections' ? (
          /* Collections tab — list of collection rows. Tap → drill in.
             Long-press → rename/delete sheet. */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {collections.map((c, idx) => (
              <CollectionRow
                key={c.id}
                collection={c}
                indexInList={idx}
                onTap={() => navigate(`/collections/${c.id}`)}
                onLongPress={() => openCollectionAction(c)}
                t={t}
              />
            ))}
          </div>
        ) : isFlatTab || searchActive || anyFilterActive ? (
          /* Flat list — Saved, Liked, or History flattened when search/filter
             is active (per UI-SPEC: "if filters/query active on History,
             render as flat list"). */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(({ item: post, matches }, idx) => (
              <SavedRow
                key={post.id}
                post={post}
                indexInList={idx}
                onOpen={() => navigate(`/posts/${post.id}`)}
                searchMatch={matches}
              />
            ))}
          </div>
        ) : (
          /* History tab — day-grouped layout (no search/filter active). */
          Array.from(historyGroups.entries()).map(([day, posts]) => (
            <div key={day} style={{ marginBottom: '24px' }}>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--muted-foreground)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: 'var(--background)',
                  padding: '8px 0',
                  zIndex: 1,
                }}
              >
                {formatDayHeading(day)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {posts.map((post) => (
                  <SavedRow
                    key={post.id}
                    post={post}
                    indexInList={historyFlatIndex.get(post.id) ?? 0}
                    onOpen={() => navigate(`/posts/${post.id}`)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filter picker sheets (Concept / Source / Date). */}
      <FilterPickerSheet
        open={conceptPickerOpen}
        onClose={() => setConceptPickerOpen(false)}
        title={t('library.filters.concept.placeholder')}
        options={conceptOptions}
        selected={filterConcept}
        onSelect={(v) => setFilterConcept(v)}
        emptyTitle={t('library.filters.concept.emptyTitle')}
        emptyBody={t('library.filters.concept.emptyBody')}
      />
      <FilterPickerSheet
        open={sourcePickerOpen}
        onClose={() => setSourcePickerOpen(false)}
        title={t('library.filters.source.placeholder')}
        options={sourceOptions}
        selected={filterSource}
        onSelect={(v) => setFilterSource(v)}
        emptyTitle={t('library.filters.source.emptyTitle')}
      />
      <FilterPickerSheet
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        title={t('library.filters.date.label')}
        options={dateOptions}
        selected={filterDate}
        onSelect={(v) => setFilterDate(v as DateFilterPreset)}
      />

      {/* Collection picker sheet — forward-compat host. The primary entry
          remains HomeScreen tile long-press; this host is here so a future
          row-level Save action on SavedScreen can open it without re-wiring. */}
      <CollectionPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerPostId(null);
        }}
        postId={pickerPostId}
      />

      {/* Collections-tab Rename / Delete action sheet (compact BottomSheet
          with two rows). */}
      <BottomSheet
        open={actionSheetOpen}
        onClose={() => {
          setActionSheetOpen(false);
          setActionCollection(null);
        }}
        compact
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setActionSheetOpen(false);
              setRenameValue(actionCollection?.name ?? '');
              setRenameError(null);
              setRenameSheetOpen(true);
            }}
            style={collectionActionRowStyle}
          >
            <span>{t('library.collections.rename')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActionSheetOpen(false);
              setDeleteSheetOpen(true);
            }}
            style={collectionActionRowStyle}
          >
            <span>{t('library.collections.delete')}</span>
          </button>
        </div>
      </BottomSheet>

      {/* Rename sheet — single TextInput + "Save name" button. */}
      <BottomSheet
        open={renameSheetOpen}
        onClose={() => {
          setRenameSheetOpen(false);
          setRenameValue('');
          setRenameError(null);
          setActionCollection(null);
        }}
        compact
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--foreground)',
            }}
          >
            {t('library.collections.rename')}
          </h3>
          <input
            type="text"
            autoFocus
            value={renameValue}
            onChange={(e) => {
              setRenameValue(e.target.value);
              if (renameError) setRenameError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRenameSubmit();
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 44,
              background: 'var(--surface-variant)',
              border: '1.5px solid transparent',
              borderRadius: 'var(--radius)',
              padding: '0 12px',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--foreground)',
              outline: 'none',
            }}
          />
          {renameError && (
            <p
              role="alert"
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--danger)',
              }}
            >
              {t(`library.savePicker.${renameError}` as 'library.savePicker.nameEmpty')}
            </p>
          )}
          <button
            type="button"
            onClick={handleRenameSubmit}
            style={{
              height: 48,
              width: '100%',
              background: 'var(--primary-40)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('library.collections.saveName')}
          </button>
        </div>
      </BottomSheet>

      {/* Delete confirmation sheet — two buttons side-by-side. */}
      <BottomSheet
        open={deleteSheetOpen}
        onClose={() => {
          setDeleteSheetOpen(false);
          setActionCollection(null);
        }}
        compact
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--foreground)',
              lineHeight: 1.4,
            }}
          >
            {t('library.collections.deleteConfirm', {
              name: actionCollection?.name ?? '',
            })}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setDeleteSheetOpen(false);
                setActionCollection(null);
              }}
              style={{
                flex: 1,
                height: 48,
                background: 'var(--surface-variant)',
                color: 'var(--foreground)',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
            >
              {t('library.collections.keepCollection')}
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              style={{
                flex: 1,
                height: 48,
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
            >
              {t('library.collections.delete')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─── CollectionRow ───────────────────────────────────────────────────────────
// Inline component for the Collections tab. Tap → navigate; long-press →
// rename/delete sheet. Mirrors SavedRow's card shape.

const collectionActionRowStyle: React.CSSProperties = {
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
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--foreground)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

interface CollectionRowProps {
  collection: Collection;
  indexInList: number;
  onTap: () => void;
  onLongPress: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function CollectionRow({
  collection,
  indexInList,
  onTap,
  onLongPress,
  t,
}: CollectionRowProps) {
  const [pressed, setPressed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = () => {
    didLongPressRef.current = false;
    cancel();
    setPressed(true);
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      onLongPress();
    }, 480);
  };

  const end = () => {
    setPressed(false);
    cancel();
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (didLongPressRef.current) {
          didLongPressRef.current = false;
          return;
        }
        onTap();
      }}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerMove={cancel}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: pressed ? 'var(--surface-variant)' : 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-1)',
        padding: '16px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        minHeight: '64px',
        transition: 'background 150ms ease',
        opacity: 0,
        animation: `saved-card-in 300ms ease ${indexInList * 40}ms forwards`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <Folder size={22} color="var(--primary-40)" style={{ flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--foreground)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {collection.name}
      </span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--muted-foreground)',
          flexShrink: 0,
        }}
      >
        {t('library.collections.postCount', { count: collection.postIds.length })}
      </span>
      <ChevronRight size={18} color="var(--muted-foreground)" style={{ flexShrink: 0 }} />
    </button>
  );
}
