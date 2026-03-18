import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, BookOpen, CheckSquare, Headphones, Mic, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ImmersiveInfoFlow, InfoFlowPreview, type InfoFlowItem } from '../components/InfoFlow';
import { useQuestions } from '../state/useQuestions';
import { useReview } from '../state/useReview';
import { usePodcast } from '../state/usePodcast';
import { mockCalendarService } from '../services/mock/calendar.mock';
import { mockSettingsService } from '../services/mock/settings.mock';
import { graphService } from '../services/graph.service';
import { transcribeAudio } from '../providers/stt';
import { eventBus } from '../lib/event-bus';
import { today, getGreeting, formatDateLabel } from '../lib/date';
import { toast } from '../lib/toast';

export function HomeScreen() {
  const navigate = useNavigate();
  const { getByDate, questions } = useQuestions();
  const { reviewCount, items: reviewItems, submitReview, isLoading: isReviewLoading } = useReview();
  const { getPodcastForDate } = usePodcast();

  const t = today();
  const todayQuestions = getByDate(t);
  const todayPodcast = getPodcastForDate(t);

  // Build the Info Flow feed: interleave concept cards with connection cards
  const infoFlowItems = useMemo<InfoFlowItem[]>(() => {
    const items: InfoFlowItem[] = [];
    const connCandidates = questions.filter((q) => q.relatedQuestionIds.length > 0);
    const added = new Set<string>();

    reviewItems.forEach((card, idx) => {
      items.push({ kind: 'concept', card });

      // After every 2nd concept card, inject a connection card if available
      if ((idx + 1) % 2 === 0) {
        const base = connCandidates[Math.floor(idx / 2) % connCandidates.length];
        if (base) {
          const targetId = base.relatedQuestionIds[0];
          const target = questions.find((q) => q.id === targetId);
          const connKey = `${base.id}-${targetId}`;
          if (target && !added.has(connKey)) {
            added.add(connKey);
            items.push({ kind: 'connection', questionA: base, questionB: target });
          }
        }
      }
    });

    // Also add any connection cards not yet shown
    for (const q of connCandidates) {
      for (const relId of q.relatedQuestionIds) {
        const key = `${q.id}-${relId}`;
        const rev = `${relId}-${q.id}`;
        if (!added.has(key) && !added.has(rev)) {
          const related = questions.find((r) => r.id === relId);
          if (related) {
            added.add(key);
            items.push({ kind: 'connection', questionA: q, questionB: related });
          }
        }
      }
    }

    return items.slice(0, 20);
  }, [reviewItems, questions]);

  const [flowOpen, setFlowOpen] = useState(false);
  // Bug #8: snapshot items when opening so rating a card doesn't mutate the live prop,
  // which would rebuild the IntersectionObserver and reset activeIndex mid-flow
  const [flowItems, setFlowItems] = useState(infoFlowItems);

  const handleOpenFlow = () => {
    setFlowItems(infoFlowItems);
    setFlowOpen(true);
  };

  const handleAhaConnection = (idA: string, idB: string) => {
    void graphService.reinforceEdge(idA, idB);
    toast('Aha! Connection strengthened.', 'success');
  };

  const [pendingTodos, setPendingTodos] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const refresh = async () => {
      const result = await mockCalendarService.getDaySchedule(today());
      if (result.success && result.data) {
        setPendingTodos(
          result.data.blocks.flatMap((b) => b.todos).filter((td) => td.status === 'pending').length,
        );
      }
    };
    void refresh();
    const unsub1 = eventBus.subscribe('TODO_STATUS_CHANGED', () => void refresh());
    const unsub2 = eventBus.subscribe('TODO_CREATED', () => void refresh());
    return () => { unsub1(); unsub2(); };
  }, []);

  // Cleanup recorder if component unmounts mid-recording
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const settings = mockSettingsService.getSync();
          const text = await transcribeAudio(blob, settings.llm);
          navigate('/ask', { state: { prompt: text?.trim() || '' } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          toast(
            msg.includes('API key') || msg.includes('No API')
              ? 'STT requires an OpenAI API key — check Settings.'
              : 'Transcription failed. Check your API settings.',
            'error',
          );
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      toast('Microphone access denied.', 'error');
    }
  };

  const stopRecording = () => {
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

          {/* Today's Summary — full width */}
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '24px',
              background: 'var(--summary-bg)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <Brain size={32} color="var(--summary-text)" />
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '2.5rem', fontWeight: 600, color: 'var(--summary-text)', lineHeight: 1 }}>{todayQuestions.length}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--summary-text-muted)' }}>questions today</p>
              </div>
            </div>
            <h3 style={{ color: 'var(--summary-text)', marginBottom: '12px' }}>Today's Summary</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--summary-stat-bg)', borderRadius: '16px', backdropFilter: 'blur(8px)' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--summary-text)' }}>{reviewCount}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--summary-text-muted)' }}>Due for review</p>
              </div>
              <div style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--summary-stat-bg)', borderRadius: '16px', backdropFilter: 'blur(8px)' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--summary-text)' }}>{pendingTodos}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--summary-text-muted)' }}>Tasks pending</p>
              </div>
            </div>
          </div>

          {/* Flashcard Card */}
          <button
            onClick={() => navigate('/review')}
            style={{ textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-review-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                height: '100%',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <BookOpen size={28} color="var(--bento-card-text)" style={{ marginBottom: '12px' }} />
              <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>Flashcard</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{reviewCount}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>due</p>
              </div>
            </Card>
          </button>

          {/* Tasks Card */}
          <button
            onClick={() => navigate('/calendar')}
            style={{ textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-tasks-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                height: '100%',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <CheckSquare size={28} color="var(--bento-card-text)" style={{ marginBottom: '12px' }} />
              <h4 style={{ marginBottom: '8px', color: 'var(--bento-card-text)' }}>Tasks</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <p style={{ fontSize: '1.875rem', fontWeight: 600, color: 'var(--bento-card-text)' }}>{pendingTodos}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--bento-card-text-muted)' }}>pending</p>
              </div>
            </Card>
          </button>

          {/* Podcast Card — full width */}
          <button
            onClick={() => navigate('/podcast')}
            style={{ gridColumn: '1 / -1', textAlign: 'left', background: 'none', padding: 0 }}
          >
            <Card
              style={{
                backgroundColor: 'var(--bento-podcast-bg)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
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

          {/* Info Flow preview — full width; hidden during initial load (Bug #4) */}
          {!isReviewLoading && (
            <div style={{ gridColumn: '1 / -1' }}>
              <InfoFlowPreview items={infoFlowItems} onOpen={handleOpenFlow} />
            </div>
          )}

        </div>
      </div>

      {/* Immersive Info Flow overlay */}
      {flowOpen && (
        <ImmersiveInfoFlow
          items={flowItems}
          onRateConcept={async (id, rating) => { await submitReview(id, rating); }}
          onAhaConnection={handleAhaConnection}
          onClose={() => setFlowOpen(false)}
        />
      )}

      {/* Prompt bubble — shown while recording or transcribing */}
      {fabActive && (
        <div
          style={{
            position: 'fixed',
            bottom: '172px',
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
          bottom: '96px',
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
