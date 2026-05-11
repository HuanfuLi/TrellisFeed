// SavedScreen — Phase 43 plan 43-04 (SV-01..SV-04).
//
// Sub-screen rendered via <Outlet> overlay at zIndex 50 in App.tsx. NOT mounted
// inside SwipeTabContainer; the Header portals to document.body (Phase 32.1
// pattern — see Header.tsx insideSwipeTab discrimination).
//
// Two-tab archive of engagement state:
//   - Saved tab → engagementService.getSavedPosts()
//   - Liked tab → engagementService.getLikedPosts()
//
// Tab state is local useState (operator-locked at SV-04 — Saved | Liked tabs
// owned by the screen, NOT a route param). Tap toggle, no swipe gesture in v1.
//
// Re-sync: subscribes to ENGAGEMENT_CHANGED so when the user un-saves / un-likes
// from a parallel surface (LongPressMenu in MasonryFeed, PostDetailScreen heart),
// the visible list refreshes in-place. SavedScreen is NOT always-mounted so the
// useEffect cleanup unsubscribes automatically on unmount (Pitfall 7).
//
// List layout mirrors PostHistoryScreen.tsx HistoryPostCard verbatim per SV-03:
// 52×52 thumbnail + title (lineClamp 2) + contextLabel meta line + tap-to-/posts/:id.
// Entrance keyframes inlined via <style> tag (saved-card-in) — same shape as
// PostHistoryScreen's history-card-in.
//
// Phase 32.1 invariant: no transform / will-change / filter / contain / perspective
// on Header ancestors. Outer container uses minHeight: '100%' + flex column ONLY.

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, Heart } from 'lucide-react';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { engagementService } from '../services/engagement.service';
import { eventBus } from '../lib/event-bus';
import type { DailyPost } from '../types';

type Tab = 'saved' | 'liked';

function SavedRow({
  post,
  indexInList,
  onOpen,
}: {
  post: DailyPost;
  indexInList: number;
  onOpen: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  const thumb = post.videoMeta?.thumbnailUrl ?? post.newsMeta?.imageUrl ?? null;
  const emoji = post.presentationStyle === 'text-art' ? '✎' : '📄';

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

function EmptyState({
  tab,
  t,
}: {
  tab: Tab;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const Icon = tab === 'saved' ? Bookmark : Heart;
  const titleKey = tab === 'saved' ? 'saved.empty.savedTitle' : 'saved.empty.likedTitle';
  const bodyKey = tab === 'saved' ? 'saved.empty.savedBody' : 'saved.empty.likedBody';
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
        {t(titleKey)}
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
        {t(bodyKey)}
      </p>
    </div>
  );
}

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

  const refresh = useCallback(() => {
    setSavedPosts(engagementService.getSavedPosts());
    setLikedPosts(engagementService.getLikedPosts());
  }, []);

  // ENGAGEMENT_CHANGED subscription — keeps list in-sync when user un-saves /
  // un-likes from a parallel surface (LongPressMenu, PostDetailScreen heart).
  // SavedScreen is NOT always-mounted (sub-screen via Outlet), so cleanup
  // unsubscribes automatically on unmount — Pitfall 7 satisfied.
  useEffect(() => {
    const unsub = eventBus.subscribe('ENGAGEMENT_CHANGED', () => refresh());
    return unsub;
  }, [refresh]);

  const list = activeTab === 'saved' ? savedPosts : likedPosts;
  const isEmpty = list.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Header backTo="/home" title={t('saved.title')} />

      <style>{`
        @keyframes saved-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
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
        {/* Tab bar (Saved | Liked) — SV-04 */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            marginBottom: '16px',
          }}
        >
          <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>
            {t('saved.tabs.saved')}
          </TabButton>
          <TabButton active={activeTab === 'liked'} onClick={() => setActiveTab('liked')}>
            {t('saved.tabs.liked')}
          </TabButton>
        </div>

        {/* List or empty state */}
        {isEmpty ? (
          <EmptyState tab={activeTab} t={t} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {list.map((post, idx) => (
              <SavedRow
                key={post.id}
                post={post}
                indexInList={idx}
                onOpen={() => navigate(`/posts/${post.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
