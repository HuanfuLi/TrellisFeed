import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, CheckSquare, Headphones, Sparkles, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { InlineInfoFlow, type InfoFlowItem } from '../components/InfoFlow';
import { VineProgress } from '../components/VineProgress';
import { Confetti } from '../components/Confetti';
import { ScrollToTopFAB } from '../components/ScrollToTopFAB';
import { PullUpHint, PULL_THRESHOLD } from '../components/PullUpHint';
import { infiniteScrollService } from '../services/infiniteScroll.service';
import { postQueueService } from '../services/post-queue.service';
import { postHistoryService } from '../services/post-history.service';
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



export function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { questions, isLoading: questionsLoading } = useQuestions();
  const { reviewCount } = useReview();
  const { getPodcastForDate } = usePodcast();
  const [dailyPosts, setDailyPosts] = useState<DailyPost[]>(() => {
    // Warm start (D-30): If today's cache is empty, show yesterday's remaining queue
    const cached = conceptFeedService.getCachedDailyPosts();
    if (cached.length > 0) return cached;
    postQueueService.loadQueue();
    const yesterday = postQueueService.getYesterdayQueue();
    if (yesterday.length > 0) return yesterday.slice(0, 8);
    // D-32 fallback: show last 4 from history
    return postHistoryService.getPosts().slice(0, 4);
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(false);
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
    setIsGenerating(true);
    setGenerationError(false);
    void conceptFeedService.getDailyPosts(questions).then((posts) => {
      if (!cancelled) {
        setDailyPosts(posts);
        setIsGenerating(false);
        if (posts.length === 0 && questions.length > 0) {
          setGenerationError(true);
        }
      }
    }).catch((err) => {
      console.warn('[HomeScreen] feed generation failed:', err);
      if (!cancelled) {
        setIsGenerating(false);
        setGenerationError(true);
      }
    });
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
        conceptFeedService.appendToCache(newPosts);
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

  // Initialize infiniteScrollService on mount; reset on unmount; purge old history
  useEffect(() => {
    infiniteScrollService.initialize();
    postHistoryService.purgeExpired();
    return () => { infiniteScrollService.reset(); };
  }, []);

  // Retry generation after error
  const retryGeneration = useCallback(() => {
    setIsGenerating(true);
    setGenerationError(false);
    void conceptFeedService.getDailyPosts(questionsRef.current).then((posts) => {
      setDailyPosts(posts);
      setIsGenerating(false);
      if (posts.length === 0 && questionsRef.current.length > 0) {
        setGenerationError(true);
      }
    }).catch((err) => {
      console.warn('[HomeScreen] feed retry failed:', err);
      setIsGenerating(false);
      setGenerationError(true);
    });
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

  // Build the Home curiosity feed from daily posts + connection cards (D-44: no fixed interleaving).
  const infoFlowItems = useMemo<InfoFlowItem[]>(() => {
    const items: InfoFlowItem[] = dailyPosts.map(post => ({ kind: 'concept' as const, post }));

    // Collect unique connection card items
    const connectionCards = conceptFeedService.getConnectionCards();
    const byId = new Map<string, Question>(questions.map((q) => [q.id, q]));
    const addedConns = new Set<string>();
    const connItems: InfoFlowItem[] = [];

    for (const card of connectionCards) {
      const key = card.sourceId < card.targetId
        ? `${card.sourceId}:${card.targetId}`
        : `${card.targetId}:${card.sourceId}`;
      if (addedConns.has(key)) continue;
      const qA = byId.get(card.sourceId);
      const qB = byId.get(card.targetId);
      if (!qA || !qB) continue;
      addedConns.add(key);
      connItems.push({
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

    // Distribute connection cards evenly among concept posts
    if (connItems.length > 0 && items.length > 0) {
      const interval = Math.max(2, Math.floor(items.length / (connItems.length + 1)));
      for (let ci = connItems.length - 1; ci >= 0; ci--) {
        const insertAt = Math.min((ci + 1) * interval, items.length);
        items.splice(insertAt, 0, connItems[ci]);
      }
    } else {
      items.push(...connItems);
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

  // --- Concept exploration progress (Phase 31, D-12: SM-2 due concepts) ---
  const questionsById = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const quotaAnchorIds = useMemo(() => getConceptQuota([], questionsById), [questions, questionsById]);
  const conceptQuota = quotaAnchorIds.size;

  const [exploredAnchors, setExploredAnchors] = useState<string[]>(() => dailyReadService.getExploredAnchors());
  const exploredCount = useMemo(() => exploredAnchors.filter(id => quotaAnchorIds.has(id)).length, [exploredAnchors, quotaAnchorIds]);
  const isComplete = conceptQuota > 0 && exploredCount >= conceptQuota;

  // Build concepts list for VineProgress checklist
  const conceptList = useMemo(() => {
    const exploredSet = new Set(exploredAnchors);
    const seen = new Set<string>();
    return Array.from(quotaAnchorIds)
      .map(anchorId => {
        const q = questionsById.get(anchorId);
        let name = q?.title?.trim() || q?.content?.slice(0, 50)?.trim() || '';
        if (!name) {
          const child = questions.find(cq => cq.parentId === anchorId);
          name = child?.title?.trim() || child?.content?.slice(0, 50)?.trim() || '';
        }
        if (!name) name = anchorId.replace(/^anchor-/, '').slice(0, 20);
        if (seen.has(name)) return null;
        seen.add(name);
        return { id: anchorId, name, explored: exploredSet.has(anchorId) };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [quotaAnchorIds, exploredAnchors, questionsById, questions]);

  // Scroll to the first post matching a concept (D-04)
  const handleConceptTap = useCallback((conceptId: string) => {
    const postElement = document.querySelector(`[data-concept-id="${conceptId}"]`);
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const [showConfetti, setShowConfetti] = useState(false);
  const creditAwardedRef = useRef(dailyReadService.isCreditAwarded());

  // Subscribe to CONCEPT_EXPLORED events from PostDetailScreen
  useEffect(() => {
    const unsub = eventBus.subscribe('CONCEPT_EXPLORED', () => {
      setExploredAnchors(dailyReadService.getExploredAnchors());
    });
    return unsub;
  }, []);

  // Track when the inline card scrolls behind the Header
  const [cardHidden, setCardHidden] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || conceptQuota === 0) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (container.scrollTop === 0) {
          setCardHidden(false);
        } else {
          const card = container.querySelector('[data-concept-progress-card]');
          if (card) {
            const rect = card.getBoundingClientRect();
            setCardHidden(rect.bottom <= 0);
          }
        }
        ticking = false;
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [conceptQuota]);

  // Celebration: gold bar + confetti + toast + credit on completion
  useEffect(() => {
    if (isComplete && conceptQuota > 0 && !creditAwardedRef.current) {
      creditAwardedRef.current = true;
      dailyReadService.markCreditAwarded();
      trellisCreditsService.add(1);
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3500);
      toast(t('home.feed.creditToast'), 'success');
      return () => clearTimeout(timer);
    }
  }, [isComplete, conceptQuota, t]);

  const showCompactBar = cardHidden && conceptQuota > 0;

  return (
    <>
      <Confetti active={showConfetti} />
      {/* Compact progress bar — slides in as header when inline card scrolls away */}
      <div
        aria-hidden={!showCompactBar}
        style={{
          position: 'fixed',
          top: 'var(--safe-area-top)',
          left: 0,
          right: 0,
          zIndex: 190,
          backgroundColor: isComplete ? 'color-mix(in srgb, #E8A838 8%, var(--surface))' : 'var(--surface)',
          boxShadow: showCompactBar ? 'var(--shadow-1)' : 'none',
          opacity: showCompactBar ? 1 : 0,
          transform: showCompactBar ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'opacity 300ms ease, transform 300ms ease, box-shadow 300ms ease',
          pointerEvents: showCompactBar ? 'auto' : 'none',
          visibility: showCompactBar ? 'visible' : 'hidden',
          transitionProperty: 'opacity, transform, box-shadow, visibility',
          transitionDelay: showCompactBar ? '0ms' : '0ms, 0ms, 0ms, 300ms',
        }}
      >
        <VineProgress
          mode="compact"
          explored={exploredCount}
          total={conceptQuota}
          isComplete={isComplete}
          concepts={conceptList}
          onConceptTap={handleConceptTap}
        />
      </div>
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
      <div style={{ paddingTop: '16px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto' }}>

        {/* Inline greeting — scrolls away naturally */}
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '16px' }}>
          {getGreeting()}
        </h1>

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
          <div data-concept-progress-card style={{ marginTop: '16px', marginBottom: '16px' }}>
            <VineProgress
              mode="inline"
              explored={exploredCount}
              total={conceptQuota}
              isComplete={isComplete}
              concepts={conceptList}
              onConceptTap={handleConceptTap}
              onHistoryTap={() => navigate('/history')}
            />
          </div>
        )}

        {/* Empty state when feed has posts but no concept posts (D-17) */}
        {conceptQuota === 0 && dailyPosts.length > 0 && questions.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100px',
            textAlign: 'center',
            marginTop: '16px',
            padding: '16px',
            background: 'var(--card)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-1)',
          }}>
            <Sparkles size={32} color="var(--muted-foreground)" style={{ opacity: 0.5, marginBottom: '12px' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '4px' }}>
              {t('home.feed.emptyTitle')}
            </p>
            <p style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: 1.5, maxWidth: '280px' }}>
              {t('home.feed.emptyBody')}
            </p>
          </div>
        )}

        {/* Botanical loading state — queue empty, generation in progress */}
        {dailyPosts.length === 0 && isGenerating && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px', gap: '16px', marginTop: '16px',
          }}>
            <svg width="64" height="64" viewBox="0 0 64 64" style={{
              stroke: 'var(--primary-40)', strokeWidth: 2, fill: 'none',
              animation: 'vineLoadingPulse 1.5s ease-in-out infinite',
            }}>
              <rect x="20" y="44" width="24" height="16" rx="2" />
              <line x1="32" y1="44" x2="32" y2="24" />
              <ellipse cx="24" cy="22" rx="8" ry="6" />
              <ellipse cx="40" cy="22" rx="8" ry="6" />
            </svg>
            <span style={{
              fontSize: '14px', fontWeight: 400,
              color: 'var(--muted-foreground)', textAlign: 'center',
            }}>
              {t('home.feed.loadingTitle')}
            </span>
            <a
              href="mailto:huanfuli4408@gmail.com?subject=EchoLearn%20Feed%20Feedback"
              style={{
                fontSize: '12px', fontWeight: 400,
                color: 'var(--primary-40)', textDecoration: 'underline',
                marginTop: '16px',
              }}
            >
              {t('home.feed.feedbackPrompt')}
            </a>
          </div>
        )}

        {/* Generation error state */}
        {dailyPosts.length === 0 && generationError && !isGenerating && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px', gap: '4px', marginTop: '16px',
          }}>
            <AlertCircle size={32} style={{ color: 'var(--muted-foreground)', marginBottom: '8px' }} />
            <span style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>
              {t('home.feed.generationErrorTitle')}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
              {t('home.feed.generationErrorBody')}
            </span>
            <button
              onClick={retryGeneration}
              style={{
                fontSize: '14px', fontWeight: 600,
                color: 'var(--primary-40)',
                background: 'none', border: 'none', cursor: 'pointer',
                marginTop: '12px',
              }}
            >
              {t('home.feed.generationErrorRetry')}
            </button>
            <a
              href="mailto:huanfuli4408@gmail.com?subject=EchoLearn%20Feed%20Feedback"
              style={{
                fontSize: '12px', color: 'var(--primary-40)',
                textDecoration: 'underline', marginTop: '16px',
              }}
            >
              {t('home.feed.feedbackPrompt')}
            </a>
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

      {/* Scroll-to-top FAB (D-40) */}
      <ScrollToTopFAB scrollRef={containerRef} />

      {/* Botanical loading pulse animation */}
      <style>{`
        @keyframes vineLoadingPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
