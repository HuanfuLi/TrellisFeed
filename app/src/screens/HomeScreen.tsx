import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, CheckSquare, Headphones, Sparkles } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { InlineInfoFlow, type InfoFlowItem } from '../components/InfoFlow';
import { ConceptProgressCard } from '../components/ConceptProgressCard';
import { Confetti } from '../components/Confetti';
import { PullUpHint, PULL_THRESHOLD } from '../components/PullUpHint';
import { infiniteScrollService } from '../services/infiniteScroll.service';
import type { DailyPost, Question } from '../types';
import { useQuestions } from '../state/useQuestions';
import { useReview } from '../state/useReview';
import { usePodcast } from '../state/usePodcast';
import { plannerService } from '../services/planner.service';
import { plannerAutoGenService } from '../services/plannerAutoGen.service';
import { settingsService } from '../services/settings.service';
import { conceptFeedService } from '../services/concept-feed.service';
import { dailyReadService, getConceptQuota } from '../services/daily-read.service';
import { trellisCreditsService } from '../services/trellis-credits.service';
import { eventBus } from '../lib/event-bus';
import { today, getGreeting } from '../lib/date';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';


export function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { questions, isLoading: questionsLoading } = useQuestions();
  const { reviewCount } = useReview();
  const { getPodcastForDate } = usePodcast();
  const [dailyPosts, setDailyPosts] = useState<DailyPost[]>(() => conceptFeedService.getCachedDailyPosts());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const isLoadingMoreRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable ref so the onLoadMore callback can access latest questions
  // without re-creating the callback (which would reset scroll listeners).
  const questionsRef = useRef<Question[]>(questions);
  questionsRef.current = questions;

  const todayDate = today();
  const todayPodcast = getPodcastForDate(todayDate);

  useEffect(() => {
    // Don't fetch posts until questions have finished loading — running with
    // an empty-but-loading questions array would wipe the cache and flash the feed.
    if (questionsLoading) return;

    const refreshPlannerSummary = () => {
      setSuggestedMoveCount(plannerAutoGenService.getMoves().length + plannerService.getSuggestedChunks().length);
    };

    const refreshFeed = () => {
      let cancelled = false;
      void conceptFeedService.getDailyPosts(questions).then((posts) => {
        if (!cancelled) setDailyPosts(posts);
      }).catch((err) => console.warn('[HomeScreen] feed refresh failed:', err));
      return () => { cancelled = true; };
    };

    let cancelled = false;
    void conceptFeedService.getDailyPosts(questions).then((posts) => {
      if (!cancelled) setDailyPosts(posts);
    }).catch((err) => console.warn('[HomeScreen] feed generation failed:', err));
    refreshPlannerSummary();

    const unsubPlanner = eventBus.subscribe('PLANNER_UPDATED', (event) => {
      refreshPlannerSummary();
      if (event.payload.reason !== 'chunk') {
        conceptFeedService.clearCache();
        refreshFeed();
      }
    });

    const unsubPostDeleted = eventBus.subscribe('POST_DELETED', (event) => {
      setDailyPosts((prev) => prev.filter((p) => p.id !== event.payload.id));
    });

    const unsubNews = eventBus.subscribe('NEWS_POSTS_READY', () => {
      if (!cancelled) refreshFeed();
    });

    const delayedRefreshTimer = setTimeout(() => {
      if (!cancelled) refreshFeed();
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(delayedRefreshTimer);
      unsubPlanner();
      unsubPostDeleted();
      unsubNews();
    };
  }, [questions, questionsLoading]);

  // Re-sync feed from cache when navigating back to /home
  useEffect(() => {
    if (location.pathname === '/home') {
      setDailyPosts(conceptFeedService.getCachedDailyPosts());
    }
  }, [location.pathname]);

  // Load handler — called on intentional pull-and-release gesture.
  // Generates posts AND their images before adding to the feed so cards
  // appear fully ready (no skeleton → image pop-in).
  const handleLoad = useCallback(async () => {
    if (isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const newPosts = await infiniteScrollService.loadNextBatch(questionsRef.current, 6);
      if (newPosts.length > 0) {
        // Pre-generate images for all new posts before showing them
        const { inferImageStyle, buildImagePrompt } = await import('../services/postFormatting.service');
        const { imageGenerationService } = await import('../services/imageGeneration.service');
        await Promise.allSettled(
          newPosts.map((post) => {
            const style = inferImageStyle(post);
            const prompt = buildImagePrompt(post);
            return imageGenerationService.generateImage(post.id, prompt, style);
          }),
        );
        setDailyPosts((prev) => [...prev, ...newPosts]);
      } else {
        toast(t('home.toast.noMorePosts'), 'info');
      }
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps -- questionsRef + isLoadingMoreRef are refs

  // Stable ref so the touch effect can always call the latest handleLoad
  const handleLoadRef = useRef(handleLoad);
  handleLoadRef.current = handleLoad;

  // Initialize infiniteScrollService on mount; reset on unmount
  useEffect(() => {
    infiniteScrollService.initialize();
    return () => { infiniteScrollService.reset(); };
  }, []);

  // Pull-to-load gesture: track overscroll at the bottom via touch events.
  // Non-passive touchmove so we can preventDefault() to own the gesture
  // and prevent the browser's native rubber-band while pulling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartY = 0;
    let tracking = false;
    let currentPull = 0;

    const onTouchStart = (e: TouchEvent) => {
      // Only arm the gesture when already at the absolute bottom
      const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (dist > 4) return; // not at bottom (4px tolerance for subpixel)
      if (isLoadingMoreRef.current) return;
      touchStartY = e.touches[0].clientY;
      tracking = true;
      currentPull = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      // Claim the gesture immediately — must be before any early-return so the
      // browser never gets a chance to rubber-band the page on the first event.
      e.preventDefault();
      const dy = touchStartY - e.touches[0].clientY; // positive = pull up
      if (dy < -10) {
        // Clear intentional downward swipe — cancel the pull gesture
        tracking = false;
        if (currentPull > 0) {
          currentPull = 0;
          setPullDistance(0);
        }
        return;
      }
      if (dy <= 0) return; // Tiny jitter at gesture start — stay armed, wait for real movement
      currentPull = dy;
      setPullDistance(dy);
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      const pd = currentPull;
      tracking = false;
      currentPull = 0;
      setPullDistance(0); // triggers CSS snap-back transition in PullUpHint
      if (pd >= PULL_THRESHOLD) {
        void handleLoadRef.current();
      }
    };

    // ── Mouse drag (PC testing) ─────────────────────────────────────────────
    let mouseStartY = 0;
    let mouseTracking = false;
    let currentMousePull = 0;

    const onMouseDown = (e: MouseEvent) => {
      const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
      // Desktop wheel scrolling is discrete — user may stop at dist 30–80px when
      // the PullUpHint is visible. Use a generous threshold so the gesture still arms.
      if (dist > 120) return;
      if (isLoadingMoreRef.current) return;
      mouseStartY = e.clientY;
      mouseTracking = true;
      currentMousePull = 0;
      e.preventDefault(); // prevent text selection during drag
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseTracking) return;
      const dy = mouseStartY - e.clientY;
      if (dy < -10) {
        mouseTracking = false;
        currentMousePull = 0;
        setPullDistance(0);
        return;
      }
      if (dy <= 0) return;
      currentMousePull = dy;
      setPullDistance(dy);
    };

    const onMouseUp = () => {
      if (!mouseTracking) return;
      const pd = currentMousePull;
      mouseTracking = false;
      currentMousePull = 0;
      setPullDistance(0);
      if (pd >= PULL_THRESHOLD) {
        void handleLoadRef.current();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('mousedown', onMouseDown);
    // mousemove/mouseup on window so releasing outside the element still works
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- containerRef and refs are stable after mount

  // Build the Home curiosity feed from daily posts + LLM-generated connection cards.
  const infoFlowItems = useMemo<InfoFlowItem[]>(() => {
    const items: InfoFlowItem[] = [];
    const connectionCards = conceptFeedService.getConnectionCards();
    const byId = new Map<string, Question>(questions.map((q) => [q.id, q]));
    const addedConns = new Set<string>();

    dailyPosts.forEach((post, idx) => {
      items.push({ kind: 'concept', post });

      // After every 2nd concept post, inject a connection card if available.
      if ((idx + 1) % 2 === 0) {
        const card = connectionCards[Math.floor(idx / 2) % connectionCards.length];
        if (card) {
          const key = card.sourceId < card.targetId
            ? `${card.sourceId}:${card.targetId}`
            : `${card.targetId}:${card.sourceId}`;
          const qA = byId.get(card.sourceId);
          const qB = byId.get(card.targetId);
          if (qA && qB && !addedConns.has(key)) {
            addedConns.add(key);
            items.push({
              kind: 'connection',
              questionA: qA,
              questionB: qB,
              conceptNounA: card.conceptNounA,
              conceptNounB: card.conceptNounB,
              bridgeInsight: card.bridgeInsight,
              cosineSimilarity: card.score,
              connectionPostId: card.connectionPostId,
            });
          }
        }
      }
    });

    // Inject remaining connection cards not yet shown
    for (const card of connectionCards) {
      const key = card.sourceId < card.targetId
        ? `${card.sourceId}:${card.targetId}`
        : `${card.targetId}:${card.sourceId}`;
      if (!addedConns.has(key)) {
        const qA = byId.get(card.sourceId);
        const qB = byId.get(card.targetId);
        if (qA && qB) {
          addedConns.add(key);
          items.push({
            kind: 'connection',
            questionA: qA,
            questionB: qB,
            conceptNounA: card.conceptNounA,
            conceptNounB: card.conceptNounB,
            bridgeInsight: card.bridgeInsight,
            cosineSimilarity: card.score,
            connectionPostId: card.connectionPostId,
          });
        }
      }
    }

    return items;
  }, [dailyPosts, questions]);

  const handleOpenConnection = (idA: string, idB: string) => {
    const cards = conceptFeedService.getConnectionCards();
    const card = cards.find((c) =>
      (c.sourceId === idA && c.targetId === idB) || (c.sourceId === idB && c.targetId === idA),
    );
    const qA = questions.find((q) => q.id === idA);
    const qB = questions.find((q) => q.id === idB);
    if (!qA || !qB) return;

    // Always navigate to PostDetailScreen. If the essay was previously generated its
    // cached post ID is used; otherwise we navigate to the canonical conn-* ID and let
    // PostDetailScreen stream the essay using the connectionMeta passed via state.
    const postId = card?.connectionPostId ?? `conn-${idA}-${idB}`;
    navigate(`/posts/${postId}`, {
      state: {
        connectionMeta: {
          questionA: qA,
          questionB: qB,
          conceptNounA: card?.conceptNounA ?? qA.title ?? qA.content,
          conceptNounB: card?.conceptNounB ?? qB.title ?? qB.content,
        },
      },
    });
  };

  const [suggestedMoveCount, setSuggestedMoveCount] = useState(0);

  // --- Concept exploration progress (Phase 30, D-04/D-07) ---
  const questionsById = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const quotaAnchorIds = useMemo(() => getConceptQuota(dailyPosts, questionsById), [dailyPosts, questionsById]);
  const conceptQuota = quotaAnchorIds.size;

  const [exploredAnchors, setExploredAnchors] = useState<string[]>(() => dailyReadService.getExploredAnchors());
  const exploredCount = useMemo(() => exploredAnchors.filter(id => quotaAnchorIds.has(id)).length, [exploredAnchors, quotaAnchorIds]);
  const isComplete = conceptQuota > 0 && exploredCount >= conceptQuota;

  const [showConfetti, setShowConfetti] = useState(false);
  const creditAwardedRef = useRef(dailyReadService.isCreditAwarded());

  // Subscribe to CONCEPT_EXPLORED events from PostDetailScreen
  useEffect(() => {
    const unsub = eventBus.subscribe('CONCEPT_EXPLORED', () => {
      setExploredAnchors(dailyReadService.getExploredAnchors());
    });
    return unsub;
  }, []);

  // Celebration: gold bar + confetti + toast + credit on completion
  useEffect(() => {
    if (isComplete && conceptQuota > 0 && !creditAwardedRef.current) {
      creditAwardedRef.current = true;
      dailyReadService.markCreditAwarded();
      trellisCreditsService.add(1);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
      toast(t('home.feed.creditToast'), 'success');
    }
  }, [isComplete, conceptQuota, t]);

  return (
    <>
      <Confetti active={showConfetti} />
      <Header title={getGreeting()} />
      <div
        ref={containerRef}
        data-home-scroll
        style={{
          overflowY: 'auto',
          height: '100dvh',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
        }}
      >
      {/* Phase 28 D-27 — paddingBottom migrated to var(--bottom-nav-safe) for
           consistent bottom-nav clearance across all screens. paddingTop absorbs
           HEADER_HEIGHT + 8px; safe-area-top is already applied by the wrapper. */}
      <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto' }}>

        {/* Bento Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* Flashcard Card */}
          <button
            onClick={() => navigate('/review')}
            className="active-squish"
            style={{ textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-review-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                height: '100%',
              }}
              onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <BookOpen size={28} color="var(--bento-card-text)" style={{ marginBottom: '12px' }} />
              <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>{t('home.bento.flashcardTitle')}</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{reviewCount}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>{t('home.bento.flashcardDue')}</p>
              </div>
            </Card>
          </button>

          {/* Planner Card */}
          <button
            onClick={() => navigate('/planner')}
            className="active-squish"
            style={{ textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-tasks-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                height: '100%',
              }}
              onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <CheckSquare size={28} color="var(--bento-card-text)" style={{ marginBottom: '12px' }} />
              <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>{t('home.bento.plannerTitle')}</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{suggestedMoveCount}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>{suggestedMoveCount === 1 ? t('home.bento.suggestionCountOne') : t('home.bento.suggestionCountOther')}</p>
              </div>
            </Card>
          </button>

          {/* Podcast Card — full width */}
          <button
            onClick={() => navigate('/podcast')}
            className="active-squish"
            style={{ gridColumn: '1 / -1', textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-podcast-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
              onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Headphones size={28} color="var(--bento-card-text)" style={{ marginBottom: '8px' }} />
                  <h4 style={{ color: 'var(--bento-card-text)', marginBottom: '4px' }}>{t('home.bento.podcastTitle')}</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>
                    {todayPodcast
                      ? todayPodcast.status === 'ready'
                        ? t('home.bento.podcastReady', { minutes: Math.round((todayPodcast.duration ?? 0) / 60) })
                        : todayPodcast.status === 'generating'
                          ? t('home.bento.podcastGenerating', { progress: todayPodcast.progress ?? 0 })
                          : t('home.bento.podcastFailed')
                      : t('home.bento.podcastNotGenerated')}
                  </p>
                </div>
                <Badge color={todayPodcast?.status === 'ready' ? 'green' : 'gray'}>
                  {todayPodcast?.status ?? t('home.bento.podcastStatusPending')}
                </Badge>
              </div>
            </Card>
          </button>

        </div>

        {/* Concept Progress Card — OUTSIDE grid so position:sticky works */}
        {conceptQuota > 0 && (
          <ConceptProgressCard explored={exploredCount} total={conceptQuota} isComplete={isComplete} />
        )}

        {/* Empty state when feed has posts but no concept posts (D-17) */}
        {conceptQuota === 0 && dailyPosts.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '160px',
            textAlign: 'center',
            marginTop: '16px',
          }}>
            <Sparkles size={32} color="var(--muted-foreground)" style={{ opacity: 0.5, marginBottom: '12px' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '4px' }}>
              {t('home.feed.emptyTitle')}
            </p>
            <p style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--muted-foreground)' }}>
              {t('home.feed.emptyBody')}
            </p>
          </div>
        )}

        {/* Inline Info Flow */}
        <InlineInfoFlow
          items={infoFlowItems}
          onOpenConnection={handleOpenConnection}
          showConnectionScores={settingsService.getSync().embeddingDebug.showScores}
          onOpenPost={(postId, post) => {
            navigate(`/posts/${postId}`, { state: { post } });
          }}
        />

        {/* Pull-up affordance — always reserves 80px, shows hint when at bottom */}
        <PullUpHint isLoading={isLoadingMore} pullDistance={pullDistance} />

      </div>
      </div>

    </>
  );
}
