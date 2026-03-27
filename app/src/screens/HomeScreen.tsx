import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckSquare, Headphones } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { InlineInfoFlow, type InfoFlowItem } from '../components/InfoFlow';
import { PullUpHint } from '../components/PullUpHint';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { infiniteScrollService } from '../services/infiniteScroll.service';
import type { BlindboxItem, DailyPost, Question } from '../types';
import { useQuestions } from '../state/useQuestions';
import { useReview } from '../state/useReview';
import { usePodcast } from '../state/usePodcast';
import { plannerService } from '../services/planner.service';
import { mockSettingsService } from '../services/mock/settings.mock';
import { conceptFeedService } from '../services/concept-feed.service';
import { eventBus } from '../lib/event-bus';
import { today, getGreeting } from '../lib/date';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';

const MILESTONE_POOL: BlindboxItem[] = [
  { id: 'm-0', type: 'milestone', emoji: '🔥', headline: 'Momentum looks like curiosity', body: 'The more often you open ideas from different angles, the easier it becomes to stay in motion without forcing yourself.' },
  { id: 'm-1', type: 'trivia',    emoji: '🧠', headline: 'Did you know?',         body: 'The brain keeps details that feel reusable. Retrieval, surprise, and connection all make an idea feel worth keeping.' },
  { id: 'm-2', type: 'milestone', emoji: '⚡', headline: 'Your feed is learning you', body: 'Recent questions create the spark, older questions add depth, and the space between them is where insight usually shows up.' },
  { id: 'm-3', type: 'trivia',    emoji: '💡', headline: 'Memory likes contrast', body: 'When a familiar idea meets a new angle, your brain has to reconcile them, and that tension often makes both easier to remember.' },
  { id: 'm-4', type: 'milestone', emoji: '🌱', headline: 'Knowledge compounds!', body: 'Every connection you keep is another route back into the same concept later. That is why understanding starts to feel faster over time.' },
];

export function HomeScreen() {
  const navigate = useNavigate();
  const { questions, isLoading: questionsLoading } = useQuestions();
  const { reviewCount } = useReview();
  const { getPodcastForDate } = usePodcast();
  const [dailyPosts, setDailyPosts] = useState<DailyPost[]>(() => conceptFeedService.getCachedDailyPosts());
  const [isAtBottom, setIsAtBottom] = useState(false);

  // Stable ref so the onLoadMore callback can access latest questions
  // without re-creating the callback (which would reset scroll listeners).
  const questionsRef = useRef<Question[]>(questions);
  questionsRef.current = questions;

  const t = today();
  const todayPodcast = getPodcastForDate(t);

  useEffect(() => {
    // Don't fetch posts until questions have finished loading — running with
    // an empty-but-loading questions array would wipe the cache and flash the feed.
    if (questionsLoading) return;

    const refreshPlannerSummary = () => {
      setActiveChunkCount(plannerService.getActiveChunks().length);
      setThreadCount(plannerService.getSavedThreads().length);
    };

    const refreshFeed = () => {
      let cancelled = false;
      void conceptFeedService.getDailyPosts(questions).then((posts) => {
        if (!cancelled) setDailyPosts(posts);
      });
      return () => { cancelled = true; };
    };

    let cancelled = false;
    void conceptFeedService.getDailyPosts(questions).then((posts) => {
      if (!cancelled) setDailyPosts(posts);
    });
    refreshPlannerSummary();

    const unsubPlanner = eventBus.subscribe('PLANNER_UPDATED', (event) => {
      refreshPlannerSummary();
      // Only invalidate the feed for thread/checkin changes — those meaningfully
      // affect the planner fingerprint used in feed generation. Chunk status
      // toggles (e.g. checking off an item) do not warrant a full LLM re-fetch.
      if (event.payload.reason !== 'chunk') {
        conceptFeedService.clearCache();
        refreshFeed();
      }
    });

    return () => {
      cancelled = true;
      unsubPlanner();
    };
  }, [questions, questionsLoading]);

  // Infinite scroll load handler — uses questionsRef for stable callback
  const handleLoadMore = useCallback(async () => {
    try {
      const newPosts = await infiniteScrollService.loadNextBatch(questionsRef.current, 10);
      if (newPosts.length > 0) {
        setDailyPosts((prev) => [...prev, ...newPosts]);
      } else {
        toast('No more posts to generate right now', 'info');
      }
    } catch {
      console.error('[HomeScreen] Infinite scroll load failed');
      // User can retry by scrolling to bottom again
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- questionsRef is stable

  const { containerRef, isLoading: isLoadingMore, setCanLoadMore } = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    threshold: 0,
    debounceMs: 300,
  });

  // Initialize infiniteScrollService on mount; reset on unmount
  useEffect(() => {
    infiniteScrollService.initialize();
    return () => { infiniteScrollService.reset(); };
  }, []);

  // Track scroll position for PullUpHint visibility
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
      setIsAtBottom(dist <= 1);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

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

    // Inject milestone cards every 5 regular cards
    const withMilestones: InfoFlowItem[] = [];
    let milestoneIdx = 0;
    items.forEach((item, idx) => {
      if (idx > 0 && idx % 5 === 0) {
        withMilestones.push({ kind: 'milestone', item: MILESTONE_POOL[milestoneIdx % MILESTONE_POOL.length] });
        milestoneIdx++;
      }
      withMilestones.push(item);
    });

    return withMilestones;
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

  const [activeChunkCount, setActiveChunkCount] = useState(0);
  const [threadCount, setThreadCount] = useState(0);

  // Suppress unused variable warning for setCanLoadMore (used if we want to
  // disable pagination when all posts exhausted)
  void setCanLoadMore;

  return (
    <>
      <Header title={getGreeting()} />
      <div
        ref={containerRef}
        style={{
          overflowY: 'auto',
          height: '100dvh',
          WebkitOverflowScrolling: 'touch',
        }}
      >
      <div style={{ padding: `${HEADER_HEIGHT + 8}px 16px 0`, maxWidth: '448px', margin: '0 auto' }}>

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
              <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>Flashcard</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{reviewCount}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>due</p>
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
              <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>Planner</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{activeChunkCount}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>{activeChunkCount === 1 ? 'active chunk' : 'active chunks'}</p>
              </div>
              {threadCount > 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--bento-card-text-muted)', marginTop: '2px' }}>
                  {threadCount} thread{threadCount !== 1 ? 's' : ''}
                </p>
              )}
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
                  <h4 style={{ color: 'var(--bento-card-text)', marginBottom: '4px' }}>Today's Podcast</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>
                    {todayPodcast
                      ? todayPodcast.status === 'ready'
                        ? `Ready · ${Math.round((todayPodcast.duration ?? 0) / 60)} min`
                        : todayPodcast.status === 'generating'
                          ? `Generating... ${todayPodcast.progress ?? 0}%`
                          : 'Generation failed'
                      : 'Not yet generated'}
                  </p>
                </div>
                <Badge color={todayPodcast?.status === 'ready' ? 'green' : 'gray'}>
                  {todayPodcast?.status ?? 'pending'}
                </Badge>
              </div>
            </Card>
          </button>

          {/* Inline Info Flow — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <InlineInfoFlow
              items={infoFlowItems}
              onOpenConnection={handleOpenConnection}
              showConnectionScores={mockSettingsService.getSync().embeddingDebug.showScores}
              onOpenPost={(postId, post) => {
                navigate(`/posts/${postId}`, { state: { post } });
              }}
            />
          </div>

        </div>

        {/* Pull-up affordance — always reserves 80px, shows hint when at bottom */}
        <PullUpHint isAtBottom={isAtBottom} isLoading={isLoadingMore} />

      </div>
      </div>

    </>
  );
}
