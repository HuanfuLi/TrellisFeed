import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckSquare, Headphones, Mic, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { InlineInfoFlow, type InfoFlowItem } from '../components/InfoFlow';
import type { BlindboxItem, DailyPost, Question } from '../types';
import { useQuestions } from '../state/useQuestions';
import { useReview } from '../state/useReview';
import { usePodcast } from '../state/usePodcast';
import { plannerService } from '../services/planner.service';
import { mockSettingsService } from '../services/mock/settings.mock';
import { conceptFeedService } from '../services/concept-feed.service';
import { transcribeAudio } from '../providers/stt';
import { eventBus } from '../lib/event-bus';
import { today, getGreeting, formatDateLabel } from '../lib/date';
import { toast } from '../lib/toast';

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
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const t = today();
  const todayPodcast = getPodcastForDate(t);

  useEffect(() => {
    // Don't fetch posts until questions have finished loading — running with
    // an empty-but-loading questions array would wipe the cache and flash the feed.
    if (questionsLoading) return;

    const refreshPlannerSummary = () => {
      setActiveChunkCount(plannerService.getContinueChunks().length);
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

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const morePosts = await conceptFeedService.generateMorePosts(questions);
      if (morePosts.length > 0) {
        setDailyPosts((prev) => [...prev, ...morePosts]);
      } else {
        toast('No more posts to generate right now', 'info');
      }
    } catch {
      toast('Failed to generate more posts', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  };

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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup: stop stream tracks immediately on unmount so the mic is released right away.
  // We stop tracks before calling recorder.stop() because recorder.onstop fires async
  // and the stream would otherwise stay open until that callback completes.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        // Some Android devices don't support the default codec — stop stream and bail
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        toast('Recording not supported on this device.', 'error');
        return;
      }

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Tracks are stopped by the cleanup effect or stopRecording — no need to repeat here
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const settings = mockSettingsService.getSync();
          const text = await transcribeAudio(blob, settings.tts);
          navigate('/ask', { state: { prompt: text?.trim() || '' } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          toast(
            msg.includes('API key') || msg.includes('No API')
              ? 'Add your API key in Text-to-Speech & Speech Recognition settings.'
              : 'Transcription failed. Check your TTS API settings.',
            'error',
          );
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast('Microphone permission denied. Check app settings.', 'error');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        toast('No microphone found on this device.', 'error');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        toast('Microphone is in use by another app.', 'error');
      } else {
        toast('Could not start recording. Try again.', 'error');
      }
    }
  };

  const stopRecording = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const handleFabClick = () => {
    if (isTranscribing) return;
    if (isRecording) stopRecording();
    else void startRecording();
  };

  const fabActive = isRecording || isTranscribing;

  return (
    <>
      <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ marginBottom: '4px' }}>{getGreeting()}</h1>
          <p style={{ color: 'var(--muted-foreground)' }}>{formatDateLabel(t)}</p>
        </div>

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
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>{activeChunkCount === 1 ? 'active' : 'active'}</p>
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
              onLoadMore={() => void handleLoadMore()}
              isLoadingMore={isLoadingMore}
            />
          </div>

        </div>
      </div>

      {/* Prompt bubble — shown while recording or transcribing */}
      {fabActive && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(172px + env(safe-area-inset-bottom, 0px))',
            right: '16px',
            padding: '12px 20px',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: '20px',
            boxShadow: 'var(--shadow-2)',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.95rem',
            color: 'var(--foreground)',
            animation: 'fade-in 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {isTranscribing ? (
            <>
              <Loader2
                size={16}
                style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-40)', flexShrink: 0 }}
              />
              Transcribing…
            </>
          ) : (
            <>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#E53935',
                  flexShrink: 0,
                  animation: 'mic-pulse 1.4s ease-in-out infinite',
                  display: 'inline-block',
                }}
              />
              Start Asking…
            </>
          )}
        </div>
      )}

      {/* Floating Ask FAB */}
      <button
        onClick={handleFabClick}
        disabled={isTranscribing}
        title={isRecording ? 'Tap to stop' : 'Ask a question'}
        style={{
          position: 'fixed',
          bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          right: '24px',
          width: '56px',
          height: '56px',
          backgroundColor: fabActive ? 'var(--primary-30)' : 'var(--primary-40)',
          color: 'white',
          borderRadius: '50%',
          boxShadow: fabActive
            ? '0 0 0 6px rgba(76,175,80,0.2), 0 4px 16px rgba(0,0,0,0.25)'
            : '0 4px 16px rgba(0,0,0,0.25)',
          border: 'none',
          cursor: isTranscribing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
          transform: fabActive ? 'scale(1.18)' : 'scale(1)',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background-color 0.2s, box-shadow 0.25s',
          animation: isRecording ? 'mic-pulse 1.8s ease-in-out infinite' : 'none',
        }}
      >
        {isTranscribing
          ? <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          : <Mic size={24} />
        }
      </button>
    </>
  );
}
