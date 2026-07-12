import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, FileQuestion } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MasonryFeed } from '../components/MasonryFeed';
import { ScrollToTopFAB } from '../components/ScrollToTopFAB';
import type { Post } from '../domain/content.types';
import { getGreeting } from '../lib/date';
import { eventBus } from '../lib/event-bus';
import { frozenFeedService } from '../services/frozen-feed.service';
import { interactionLog } from '../services/interaction-log.service';

/** Resolve vertical intent before claiming a WKWebView touch sequence. */
const DIRECTION_SLOP = 4;
const PULL_THRESHOLD = 72;

interface FrozenFeedView {
  posts: Readonly<Post>[];
  conceptLabelsByPostId: Map<string, readonly string[]>;
}

const emptyFeed = (): FrozenFeedView => ({ posts: [], conceptLabelsByPostId: new Map() });

export function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleBatchRef = useRef<string | null>(null);
  const [feed, setFeed] = useState<FrozenFeedView>(emptyFeed);

  const readFrozenFeed = useCallback(() => {
    try {
      const posts = frozenFeedService.getFeed();
      const conceptLabelsByPostId = new Map<string, readonly string[]>();
      for (const post of posts) {
        conceptLabelsByPostId.set(post.id, frozenFeedService.getConcepts(post.id).map((concept) => concept.label));
      }
      setFeed({ posts, conceptLabelsByPostId });
    } catch {
      setFeed(emptyFeed());
    }
  }, []);

  // Home is an always-mounted swipe slot: explicitly re-read on every return.
  useEffect(() => {
    if (location.pathname !== '/home') return;
    readFrozenFeed();
  }, [location.pathname, readFrozenFeed]);

  useEffect(() => {
    if (location.pathname !== '/home') {
      visibleBatchRef.current = null;
      return;
    }
    if (feed.posts.length === 0) return;
    const batchId = feed.posts.map((post) => post.id).join('\u001f');
    if (visibleBatchRef.current === batchId) return;
    visibleBatchRef.current = batchId;
    void interactionLog.record('feed_impression').catch(() => { /* observational */ });
  }, [feed.posts, location.pathname]);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('ENGAGEMENT_CHANGED', () => {
      if (location.pathname === '/home') readFrozenFeed();
    });
    return unsubscribe;
  }, [location.pathname, readFrozenFeed]);

  // Retain the proven direction-slop shape. Pulling at the bottom only re-reads
  // the immutable local pool; it never starts generation or network acquisition.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let startY = 0;
    let tracking = false;
    let claimed = false;
    let currentPull = 0;

    const onTouchStart = (event: TouchEvent) => {
      const distanceFromBottom = element.scrollHeight - (element.scrollTop + element.clientHeight);
      if (distanceFromBottom > 4) return;
      startY = event.touches[0].clientY;
      tracking = true;
      claimed = false;
      currentPull = 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      const dy = startY - event.touches[0].clientY;
      if (!claimed) {
        if (dy < DIRECTION_SLOP) {
          if (dy < -DIRECTION_SLOP) tracking = false;
          return;
        }
        claimed = true;
      }
      event.preventDefault();
      currentPull = Math.max(0, dy);
    };
    const onTouchEnd = () => {
      if (tracking && claimed && currentPull >= PULL_THRESHOLD) readFrozenFeed();
      tracking = false;
      claimed = false;
      currentPull = 0;
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [readFrozenFeed]);

  return (
    <>
      <div ref={containerRef} data-home-scroll style={{ overflowY: 'auto', height: 'calc(100dvh - var(--safe-area-top))', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
        <main style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 16px var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <h1 style={{ margin: 0, fontSize: '28px', lineHeight: 1.2, fontWeight: 600 }}>{getGreeting()}</h1>
            <button type="button" aria-label={t('saved.title')} onClick={() => navigate('/saved')} style={{ minWidth: '44px', minHeight: '44px', display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
              <Bookmark aria-hidden="true" size={22} />
            </button>
          </div>

          {feed.posts.length === 0 ? (
            <section style={{ minHeight: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', textAlign: 'center', borderRadius: 'var(--radius-xl)', background: 'var(--secondary)' }}>
              <FileQuestion aria-hidden="true" size={32} color="var(--muted-foreground)" />
              <h2 style={{ margin: 0, fontSize: '20px', lineHeight: 1.2, fontWeight: 600 }}>{t('home.feed.emptyTitle')}</h2>
              <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{t('home.feed.emptyBody')}</p>
            </section>
          ) : (
            <MasonryFeed posts={feed.posts} conceptLabelsByPostId={feed.conceptLabelsByPostId} onOpenPost={(postId) => navigate(`/posts/${postId}`)} />
          )}
        </main>
      </div>
      <ScrollToTopFAB scrollRef={containerRef} />
    </>
  );
}
