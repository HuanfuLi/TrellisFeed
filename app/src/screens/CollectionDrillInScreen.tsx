// CollectionDrillInScreen — Phase 50 Plan 50-08 (UI-SPEC §Surface 6).
//
// Per-collection post list at the sub-route `/collections/:id`. Rendered via
// <Outlet> overlay (zIndex 50) in App.tsx — NOT inside SwipeTabContainer.
// Header portals to document.body via the Phase 32.1 portal-vs-in-tree pattern
// (Header.tsx insideSwipeTab discrimination — see CLAUDE.md §"Header
// positioning"). Operator mental model: drill-in is a child of SavedScreen,
// so backTo="/saved".
//
// Data sources:
//   - collection = collectionService.getCollections().find(c => c.id === id)
//   - posts = collectionService.getCollectionPosts(id)  (orphans silently
//     dropped at read time via postHistoryService resolution; see
//     collection.service.ts T-50-ORPHAN comment)
//
// Event wiring:
//   - Subscribes to COLLECTIONS_CHANGED with discriminating payload.kind.
//     On any matching collectionId, refreshes collection+posts in place.
//     When the collection is gone after the event (kind === 'delete'), the
//     subscriber navigates('/saved') so the user lands back in the parent
//     archive screen. The COLLECTIONS_CHANGED emission discipline is enforced
//     by collection.service.ts — one event per semantic mutation
//     (CLAUDE.md §"Event bus — unified GRAPH_UPDATED").
//
// Threat mitigations:
//   - T-50-XSS-NAME: collection.name renders as React text node children only
//     (Header title prop, sheet copy, toast {{name}} interpolation). The
//     React HTML-injection escape hatch is NOT used in this file — source-
//     reading test enforces this via a JSX-attribute-form regex.
//   - T-50-ORPHAN: getCollectionPosts() drops missing IDs (graceful
//     degradation). When collection.postIds.length > 0 but resolved
//     posts.length === 0 we still render the empty-state block — same UX as
//     a genuinely empty collection.
//   - T-50-HEADER-PORTAL: outer container is `display: flex; flexDirection:
//     column; minHeight: '100%'` ONLY. NO transform / will-change / filter /
//     contain / perspective styles — source-reading test asserts this.
//   - T-50-DOUBLE-DELETE: deleteCollection is idempotent on the service side.
//     Worst case rapid double-tap fires two toasts (accepted risk).
//
// Visual contract per UI-SPEC §Surface 6:
//   Header  (back arrow | collection name | kebab MoreVertical 22)
//   Subtitle row "{count} posts"
//   SavedRow list (52×52 thumb + title 14/500 + contextLabel 12/500/muted)
//   Empty state → "This collection is empty" / "Add posts from the Save sheet"
//   Not-found state → "Collection not found" + back arrow
//
// Long-press on a post row:
//   Opens LongPressMenu with collectionContext={ collectionId, collectionName }
//   AND onOpenCollectionPicker → CollectionPickerSheet (host-level). The
//   collectionContext prop renders the "Remove from collection" row inside
//   LongPressMenu (UI-SPEC §Surface 9).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MoreVertical, Folder } from 'lucide-react';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { BottomSheet } from '../components/ui/BottomSheet';
import { LongPressMenu } from '../components/LongPressMenu';
import { CollectionPickerSheet } from '../components/CollectionPickerSheet';
import { collectionService } from '../services/collection.service';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';
import { useLongPress } from '../hooks/useLongPress';
import type { DailyPost, Collection } from '../types';

// ─── SavedRow analog (inline, mirrors SavedScreen.tsx:50-148) ────────────────
// Per plan 50-08 §action: "duplicate the SavedScreen.tsx:50-148 SavedRow OR
// refactor SavedRow to a shared file in a follow-up; for Phase 50 simplicity,
// copy the row component INLINE inside CollectionDrillInScreen". The local
// copy adds an `onLongPress` callback so tap → navigate, long-press → open
// LongPressMenu (the feature this drill-in exists for).

interface SavedRowProps {
  post: DailyPost;
  indexInList: number;
  onOpen: () => void;
  onLongPress: () => void;
}

function SavedRow({ post, indexInList, onOpen, onLongPress }: SavedRowProps) {
  const [pressed, setPressed] = useState(false);
  const { didLongPress, bind } = useLongPress(480, onLongPress);

  const thumb = post.videoMeta?.thumbnailUrl ?? post.newsMeta?.imageUrl ?? null;
  const emoji = post.presentationStyle === 'text-art' ? '✎' : '📄';

  // Compose bind onto our own pointer handlers so the pressed-state visual
  // stays in sync AND the long-press timer participates per useLongPress
  // contract (RESEARCH §useLongPress + LongPressMenu.tsx host pattern).
  const handlePointerDown = (e: React.PointerEvent) => {
    setPressed(true);
    bind.onPointerDown(e);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    setPressed(false);
    bind.onPointerUp(e);
  };
  const handlePointerLeave = (e: React.PointerEvent) => {
    setPressed(false);
    bind.onPointerLeave(e);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    bind.onPointerMove(e);
  };

  const handleClick = () => {
    // Suppress the navigate-tap when a long-press just fired (useLongPress
    // didLongPress ref convention — see hook docstring).
    if (didLongPress.current) return;
    onOpen();
  };

  return (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
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
          {post.title}
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
      </div>
    </button>
  );
}

// ─── Empty state block (UI-SPEC §Surface 6 + Copywriting table) ─────────────

function DrillInEmptyState({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
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
      <Folder size={40} color="var(--muted-foreground)" />
      <p
        style={{
          fontSize: '15px',
          fontWeight: 700,
          color: 'var(--muted-foreground)',
          margin: 0,
        }}
      >
        {t('library.collections.drillInEmptyTitle')}
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
        {t('library.collections.drillInEmptyBody')}
      </p>
    </div>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function CollectionDrillInScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Hooks declared above the not-found guard so hook order is stable across
  // re-renders (Rules of Hooks). The guard short-circuits the RETURN, not the
  // hook call sequence.
  const [collection, setCollection] = useState<Collection | undefined>(() =>
    id ? collectionService.getCollections().find(c => c.id === id) : undefined,
  );
  const [posts, setPosts] = useState<DailyPost[]>(() =>
    id ? collectionService.getCollectionPosts(id) : [],
  );

  // Kebab sheet (Rename / Delete chooser).
  const [kebabOpen, setKebabOpen] = useState(false);

  // Rename sheet.
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(collection?.name ?? '');
  const [renameError, setRenameError] = useState<
    'nameEmpty' | 'nameTooLong' | 'nameDuplicate' | null
  >(null);

  // Delete confirmation sheet.
  const [deleteOpen, setDeleteOpen] = useState(false);

  // LongPressMenu host state.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [menuAnchorId, setMenuAnchorId] = useState<string | null>(null);

  // CollectionPickerSheet host state (so user can also save the post to OTHER
  // collections from drill-in — UI-SPEC §Surface 9 + plan 50-08 §interfaces).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPostId, setPickerPostId] = useState<string | null>(null);

  // COLLECTIONS_CHANGED subscriber — refresh in place; if collection deleted
  // from another path (or our own Delete sheet fires), navigate back to /saved.
  useEffect(() => {
    if (!id) return;
    const unsub = eventBus.subscribe('COLLECTIONS_CHANGED', () => {
      const updated = collectionService.getCollections().find(c => c.id === id);
      if (!updated) {
        navigate('/saved');
        return;
      }
      setCollection(updated);
      setPosts(collectionService.getCollectionPosts(id));
    });
    return unsub;
  }, [id, navigate]);

  // Keep the rename-value seed in sync whenever the underlying collection
  // changes (e.g., name updated from another surface). Cheap; only fires
  // when collection.name actually mutates.
  useEffect(() => {
    if (collection) setRenameValue(collection.name);
  }, [collection?.name]);

  // ─── Not-found guard (mirrors AnchorDetailScreen.tsx:22-42 shape) ─────────
  if (!collection) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('/saved')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px',
            marginLeft: '-12px',
            color: 'var(--primary-40)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </button>
        <p style={{ color: 'var(--muted-foreground)', marginTop: '16px' }}>
          {t('library.collections.notFound')}
        </p>
      </div>
    );
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const openLongPressForPost = (post: DailyPost) => {
    setMenuPostId(post.id);
    setMenuAnchorId(post.sourceQuestionIds[0] ?? null);
    setMenuOpen(true);
  };

  const handleRenameSubmit = () => {
    if (!id) return;
    const result = collectionService.renameCollection(id, renameValue.trim());
    if (!result.success) {
      setRenameError(result.error);
      return;
    }
    const newName = renameValue.trim();
    setRenameError(null);
    setRenameOpen(false);
    toast(t('library.collections.toast.renamed', { name: newName }), 'success');
  };

  const handleDeleteConfirm = () => {
    if (!id) return;
    const name = collection.name;
    setDeleteOpen(false);
    collectionService.deleteCollection(id);
    // The COLLECTIONS_CHANGED subscriber above detects the absence and calls
    // navigate('/saved'). We still surface the toast here so the message
    // composes with the user's last seen name (post-rename safe).
    toast(t('library.collections.toast.deleted', { name }), 'info');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const rowStyle: CSSProperties = {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Header
        backTo="/saved"
        title={collection.name}
        right={
          <button
            type="button"
            onClick={() => setKebabOpen(true)}
            aria-label={t('library.collections.kebabAria')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              color: 'var(--primary-40)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <MoreVertical size={22} />
          </button>
        }
      />

      <style>{`
        @keyframes saved-card-in {
          from { opacity: 0; transform:translateY(8px); }
          to   { opacity: 1; transform:translateY(0); }
        }
      `}</style>

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
        {/* Subtitle row — UI-SPEC §Surface 6 Caption 12/500/muted */}
        <div
          style={{
            padding: '0 0 12px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--muted-foreground)',
          }}
        >
          {t('library.collections.postCount', { count: posts.length })}
        </div>

        {posts.length === 0 ? (
          <DrillInEmptyState t={t} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {posts.map((post, idx) => (
              <SavedRow
                key={post.id}
                post={post}
                indexInList={idx}
                onOpen={() => navigate(`/posts/${post.id}`)}
                onLongPress={() => openLongPressForPost(post)}
              />
            ))}
          </div>
        )}
      </div>

      {/* LongPressMenu — drill-in context adds the Remove-from-collection row. */}
      <LongPressMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        postId={menuPostId}
        anchorId={menuAnchorId}
        onOpenCollectionPicker={(pid) => {
          setPickerPostId(pid);
          setPickerOpen(true);
        }}
        collectionContext={{ collectionId: id!, collectionName: collection.name }}
      />

      {/* CollectionPickerSheet — host so user can save to OTHER collections
          from drill-in. Mounted alongside LongPressMenu (UI-SPEC §Surface 9). */}
      <CollectionPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerPostId(null);
        }}
        postId={pickerPostId}
      />

      {/* Kebab chooser sheet — two rows (Rename / Delete). */}
      <BottomSheet open={kebabOpen} onClose={() => setKebabOpen(false)} compact>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            style={rowStyle}
            onClick={() => {
              setKebabOpen(false);
              setRenameValue(collection.name);
              setRenameError(null);
              setRenameOpen(true);
            }}
          >
            <span>{t('library.collections.rename')}</span>
          </button>
          <button
            type="button"
            style={{ ...rowStyle, color: 'var(--danger)' }}
            onClick={() => {
              setKebabOpen(false);
              setDeleteOpen(true);
            }}
          >
            <span>{t('library.collections.delete')}</span>
          </button>
        </div>
      </BottomSheet>

      {/* Rename sheet — TextInput + Save name button (UI-SPEC §Surface 6). */}
      <BottomSheet
        open={renameOpen}
        onClose={() => {
          setRenameOpen(false);
          setRenameError(null);
        }}
        compact
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3
            style={{
              margin: 0,
              marginBottom: 4,
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
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setRenameOpen(false);
                setRenameError(null);
              }
            }}
            style={{
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

      {/* Delete confirmation sheet — two side-by-side buttons. */}
      <BottomSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        compact
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--foreground)',
              lineHeight: 1.5,
            }}
          >
            {t('library.collections.deleteConfirm', { name: collection.name })}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              style={{
                flex: 1,
                height: 48,
                background: 'var(--surface-variant)',
                color: 'var(--foreground)',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                fontWeight: 700,
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
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                fontWeight: 700,
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
