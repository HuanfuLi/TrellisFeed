import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, FileQuestion } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MasonryFeed } from '../components/MasonryFeed';
import { ScrollToTopFAB } from '../components/ScrollToTopFAB';
import type { Post, Recommendation } from '../domain/content.types';
import type { RecommendationBatch } from '../domain/graph.types';
import { getGreeting } from '../lib/date';
import { eventBus } from '../lib/event-bus';
import { frozenFeedService } from '../services/frozen-feed.service';
import { interactionLog } from '../services/interaction-log.service';
import { recommendationService } from '../services/recommendation.service';
import type { ServiceResult } from '../types';

/** Resolve vertical intent before claiming a WKWebView touch sequence. */
const DIRECTION_SLOP = 4;
const PULL_THRESHOLD = 72;

export interface RecommendationFeedItem {
  recommendation: Readonly<Recommendation>;
  post: Readonly<Post>;
  conceptLabels: readonly string[];
}

interface RecommendationFeedServiceReader {
  beginSession(sessionId?: string): Promise<ServiceResult<RecommendationBatch>>;
  nextBatch(sessionId: string): Promise<ServiceResult<RecommendationBatch>>;
  currentSessionItems(sessionId: string): Promise<ServiceResult<Recommendation[]>>;
}

interface FrozenPostReader {
  getPostById(postId: string): Readonly<Post> | null;
  getConcepts(postId: string): ReadonlyArray<{ label: string }>;
}

interface LoadRecommendationFeedInput {
  sessionId: string | null;
  append: boolean;
  recommendationService: RecommendationFeedServiceReader;
  frozenFeedService: FrozenPostReader;
}

interface LoadedRecommendationFeed {
  sessionId: string;
  items: RecommendationFeedItem[];
}

type ImpressionRecorder = (
  eventType: 'feed_impression',
  fields: Pick<Recommendation, 'postId'> & { recommendationId: string },
) => Promise<unknown>;

interface RecommendationFeedView {
  status: 'loading' | 'ready';
  items: RecommendationFeedItem[];
}

const emptyFeed = (status: RecommendationFeedView['status'] = 'loading'): RecommendationFeedView => ({
  status,
  items: [],
});

export async function loadRecommendationFeed({
  sessionId,
  append,
  recommendationService: service,
  frozenFeedService: feed,
}: LoadRecommendationFeedInput): Promise<LoadedRecommendationFeed> {
  const batchResult = append && sessionId
    ? await service.nextBatch(sessionId)
    : await service.beginSession(sessionId ?? undefined);
  if (!batchResult.success || !batchResult.data) {
    throw new Error(batchResult.error?.message ?? 'Recommendation batch is unavailable.');
  }

  const activeSessionId = batchResult.data.sessionId;
  const itemsResult = await service.currentSessionItems(activeSessionId);
  if (!itemsResult.success || !itemsResult.data) {
    throw new Error(itemsResult.error?.message ?? 'Recommendation items are unavailable.');
  }

  const items = itemsResult.data.map((recommendation) => {
    const post = feed.getPostById(recommendation.postId);
    if (!post) throw new Error(`Recommended post is unavailable: ${recommendation.postId}`);
    return {
      recommendation,
      post,
      conceptLabels: feed.getConcepts(post.id).map((concept) => concept.label),
    };
  });
  return { sessionId: activeSessionId, items };
}

export async function recordRecommendationImpressions(
  items: readonly Pick<RecommendationFeedItem, 'recommendation'>[],
  seenRecommendationIds: Set<string>,
  record: ImpressionRecorder,
): Promise<void> {
  const pending = items.filter(({ recommendation }) => {
    if (seenRecommendationIds.has(recommendation.id)) return false;
    seenRecommendationIds.add(recommendation.id);
    return true;
  });
  await Promise.all(pending.map(({ recommendation }) => record('feed_impression', {
    postId: recommendation.postId,
    recommendationId: recommendation.id,
  })));
}

export function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const loadInFlightRef = useRef(false);
  const seenRecommendationIdsRef = useRef(new Set<string>());
  const [feed, setFeed] = useState<RecommendationFeedView>(emptyFeed);

  const readRecommendationFeed = useCallback(async (append = false) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    try {
      const loaded = await loadRecommendationFeed({
        sessionId: sessionIdRef.current,
        append,
        recommendationService,
        frozenFeedService,
      });
      sessionIdRef.current = loaded.sessionId;
      setFeed({ status: 'ready', items: loaded.items });
    } catch {
      setFeed(emptyFeed('ready'));
    } finally {
      loadInFlightRef.current = false;
    }
  }, []);

  // Home is an always-mounted swipe slot: explicitly re-read on every return.
  useEffect(() => {
    if (location.pathname !== '/home') return;
    if (!sessionIdRef.current) setFeed(emptyFeed('loading'));
    void readRecommendationFeed();
  }, [location.pathname, readRecommendationFeed]);

  useEffect(() => {
    if (location.pathname !== '/home' || feed.status !== 'ready') return;
    void recordRecommendationImpressions(
      feed.items,
      seenRecommendationIdsRef.current,
      interactionLog.record,
    ).catch(() => { /* observational */ });
  }, [feed.items, feed.status, location.pathname]);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe('ENGAGEMENT_CHANGED', () => {
      if (location.pathname === '/home') void readRecommendationFeed();
    });
    return unsubscribe;
  }, [location.pathname, readRecommendationFeed]);

  // Retain the proven direction-slop shape. Pulling at the bottom only re-reads
  // the next persisted recommendation batch; it never starts remote acquisition.
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
      if (tracking && claimed && currentPull >= PULL_THRESHOLD) void readRecommendationFeed(true);
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
  }, [readRecommendationFeed]);

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

          {feed.status === 'loading' ? (
            <section aria-busy="true" style={{ minHeight: '240px' }} />
          ) : feed.items.length === 0 ? (
            <section style={{ minHeight: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', textAlign: 'center', borderRadius: 'var(--radius-xl)', background: 'var(--secondary)' }}>
              <FileQuestion aria-hidden="true" size={32} color="var(--muted-foreground)" />
              <h2 style={{ margin: 0, fontSize: '20px', lineHeight: 1.2, fontWeight: 600 }}>{t('home.feed.emptyTitle')}</h2>
              <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{t('home.feed.emptyBody')}</p>
            </section>
          ) : (
            <MasonryFeed items={feed.items} onOpenPost={(postId) => navigate(`/posts/${postId}`)} />
          )}
        </main>
      </div>
      <ScrollToTopFAB scrollRef={containerRef} />
    </>
  );
}
