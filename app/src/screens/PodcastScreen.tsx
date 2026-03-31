import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Radio, RefreshCw, RotateCcw, RotateCw, ChevronRight, Trash2, Check, X, List, BookOpen } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { usePodcast } from '../state/usePodcast';
import { today, formatDateLabel, isToday } from '../lib/date';
import { toast } from '../lib/toast';
import { questionService } from '../services/question.service';
import { podcastService } from '../services/podcast.service';
import { parseMoveNavigationState } from '../lib/moveNavigator';
import type { DailyPodcast, Question } from '../types';

export function PodcastScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    podcasts,
    isLoading,
    isGenerating,
    generationProgress,
    getPodcastForDate,
    generatePodcast,
    deletePodcast,
    getAudioPath,
  } = usePodcast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showScript, setShowScript] = useState(false);
  const [showAllPodcasts, setShowAllPodcasts] = useState(false);
  const [confirmDeletePodcastId, setConfirmDeletePodcastId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Knowledge Today — concepts in today's podcast
  const [todayConcepts, setTodayConcepts] = useState<Question[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(true);

  // Concept insertion from Planner
  const moveState = parseMoveNavigationState(location.state);
  const [insertConcept, setInsertConcept] = useState<Question | null>(null);
  const [insertHandled, setInsertHandled] = useState(false);

  const todayPodcast = getPodcastForDate(today());
  const selected: DailyPodcast | null = selectedId
    ? (podcasts.find((p) => p.id === selectedId) ?? null)
    : (todayPodcast ?? podcasts[0] ?? null);

  // Load concepts for Knowledge Today
  useEffect(() => {
    let cancelled = false;
    async function loadConcepts() {
      setConceptsLoading(true);
      const todayDate = today();
      const podConceptIds = podcastService.getTodayConceptIds(todayDate);

      if (podConceptIds.length > 0) {
        // Load questions matching podcast's questionIds
        const allQ = questionService.getAll();
        const idSet = new Set(podConceptIds);
        setTodayConcepts(allQ.filter((q) => idSet.has(q.id)));
      } else {
        // No podcast yet — show what would be included (due for review)
        const dueResult = await questionService.getDueForReview(todayDate);
        if (!cancelled) setTodayConcepts(dueResult.data ?? []);
      }
      if (!cancelled) setConceptsLoading(false);
    }
    loadConcepts();
    return () => { cancelled = true; };
  }, [todayPodcast?.questionIds?.length]);

  // Handle incoming concept insertion from Planner
  useEffect(() => {
    if (insertHandled || !moveState?.move || moveState.move.moveType !== 'podcast') return;

    const conceptId = moveState.linkedResource?.id;
    if (!conceptId) return;

    // Check if already in today's podcast
    const existing = podcastService.getTodayConceptIds(today());
    if (existing.includes(conceptId)) {
      toast('This concept is already in today\'s podcast.', 'info');
      setInsertHandled(true);
      return;
    }

    // Load the concept for display
    const allQ = questionService.getAll();
    const concept = allQ.find((q) => q.id === conceptId);
    if (concept) {
      setInsertConcept(concept);
    }
    setInsertHandled(true);
  }, [moveState, insertHandled]);

  const handleConfirmInsert = () => {
    if (!insertConcept) return;
    const added = podcastService.addConceptToPodcast(today(), insertConcept.id);
    if (added) {
      setTodayConcepts((prev) => [...prev, insertConcept]);
      toast('Concept added to today\'s podcast. Regenerate to update the script.', 'success');
    } else {
      // No podcast exists yet — generate one first, then it will include this concept
      toast('No podcast exists yet. Generate today\'s podcast first.', 'info');
    }
    setInsertConcept(null);
  };

  const handleRejectInsert = () => {
    setInsertConcept(null);
  };

  // Wire audio element when selected podcast changes
  useEffect(() => {
    if (!selected || selected.status !== 'ready') return;

    const blobUrl = getAudioPath(selected.id);
    if (!blobUrl) return;

    const audio = new Audio(blobUrl);
    audioRef.current = audio;
    setPlaybackProgress(0);

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
    };
    audio.onerror = () => {
      toast('Audio unavailable — try regenerating.', 'error');
      setIsPlaying(false);
      audioRef.current = null;
    };

    return () => {
      audio.pause();
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audioRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.status, getAudioPath]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying((prev) => !prev);
      return;
    }
    if (isPlaying) {
      audio.pause();
    } else {
      if (playbackProgress >= 100) {
        audio.currentTime = 0;
        setPlaybackProgress(0);
      }
      void audio.play();
    }
    setIsPlaying((prev) => !prev);
  }, [isPlaying, playbackProgress]);

  const handleSeek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
      setPlaybackProgress((audio.currentTime / audio.duration) * 100);
    } else if (selected?.duration) {
      const totalSeconds = selected.duration;
      setPlaybackProgress((prev) => {
        const currentSecond = (prev / 100) * totalSeconds;
        const newSecond = Math.max(0, Math.min(totalSeconds, currentSecond + seconds));
        return (newSecond / totalSeconds) * 100;
      });
    }
  }, [selected?.duration]);

  // Simulated playback timer (when no audio element)
  useEffect(() => {
    if (audioRef.current || !isPlaying || !selected?.duration) return;
    const duration = selected.duration;
    const interval = setInterval(() => {
      setPlaybackProgress((prev) => {
        if (prev >= 100) {
          setIsPlaying(false);
          return 0;
        }
        return prev + (100 / duration) * 0.5;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, selected, selected?.duration]);

  const hasAudio = selected ? !!getAudioPath(selected.id) : false;

  const statusColor = (status: DailyPodcast['status']) => {
    if (status === 'ready') return 'green';
    if (status === 'generating') return 'yellow';
    if (status === 'failed') return 'red';
    return 'gray';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Full-screen script overlay ───────────────────────────────────────────
  if (showScript && selected?.script) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid var(--surface-variant)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setShowScript(false)}
            style={{ color: 'var(--primary-40)', background: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
          >
            <ArrowLeft size={20} /> Back
          </button>
          <div style={{ flex: 1 }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {isToday(selected.date) ? 'Today' : formatDateLabel(selected.date)}
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 48px', maxWidth: '448px', width: '100%', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '16px' }}>Script</h3>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.85, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>
            {selected.script}
          </p>
        </div>
      </div>
    );
  }

  // ── All Podcasts sub-view ───────────────────────────────────────────────
  if (showAllPodcasts) {
    return (
      <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
        <button
          onClick={() => setShowAllPodcasts(false)}
          style={{ color: 'var(--primary-40)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, marginBottom: '24px', cursor: 'pointer' }}
        >
          <ArrowLeft size={20} /> Back
        </button>
        <h2 style={{ marginBottom: '16px' }}>All Podcasts</h2>

        {isLoading ? (
          <p style={{ color: 'var(--muted-foreground)' }}>Loading...</p>
        ) : podcasts.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>No podcasts yet. Generate your first one!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {podcasts.map((pod) => (
              <Card
                key={pod.id}
                onClick={() => {
                  if (pod.status === 'ready') {
                    setSelectedId(pod.id);
                    setShowAllPodcasts(false);
                  }
                }}
                style={{
                  cursor: pod.status === 'ready' ? 'pointer' : 'default',
                  border: selected?.id === pod.id ? '2px solid var(--primary-40)' : '2px solid transparent',
                  transition: 'transform 0.2s',
                }}
                onPointerEnter={(e) => { if (pod.status === 'ready') e.currentTarget.style.transform = 'scale(1.01)'; }}
                onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 500, marginBottom: '2px' }}>
                      {isToday(pod.date) ? 'Today' : formatDateLabel(pod.date)}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                      {pod.questionIds.length} concepts · {formatDuration(pod.duration)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <Badge color={statusColor(pod.status)}>{pod.status}</Badge>
                    {confirmDeletePodcastId === pod.id ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeletePodcastId(null); }}
                          title="Cancel delete"
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: 'transparent', color: 'var(--muted-foreground)',
                            border: '1.5px solid var(--surface-variant)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <X size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeletePodcastId(null);
                            if (selectedId === pod.id) setSelectedId(null);
                            void deletePodcast(pod.id);
                          }}
                          title="Confirm delete"
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: 'rgba(220,38,38,0.12)', color: 'rgb(220,38,38)',
                            border: '1.5px solid rgba(220,38,38,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <Check size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeletePodcastId(pod.id); }}
                        title="Delete podcast"
                        style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          backgroundColor: 'transparent', color: 'var(--muted-foreground)',
                          border: '1.5px solid var(--surface-variant)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                {pod.status === 'generating' && (
                  <div style={{ marginTop: '8px' }}>
                    <ProgressBar value={pod.progress ?? 0} height={4} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main view ───────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={() => {
            // If arrived from planner with concept insertion, go back to planner
            if (moveState?.fromScreen === 'planner') {
              navigate('/planner');
            } else {
              navigate(-1);
            }
          }}
          style={{ color: 'var(--primary-40)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, cursor: 'pointer' }}
        >
          <ArrowLeft size={20} /> Back
        </button>
        <button
          onClick={() => setShowAllPodcasts(true)}
          title="All Podcasts"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '100px',
            backgroundColor: 'var(--surface-variant)',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
            fontSize: '0.78rem', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <List size={14} />
          History
        </button>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '2px' }}>Podcasts</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Your daily learning summaries</p>
      </div>

      {/* Concept insertion banner from Planner */}
      {insertConcept && (
        <Card style={{
          marginBottom: '16px',
          border: '2px solid var(--primary-40)',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary-40) 8%, var(--surface)), var(--surface))',
        }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary-40)', marginBottom: '8px' }}>
            Add to podcast?
          </p>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>
            {insertConcept.title ?? insertConcept.content.slice(0, 60)}
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: '14px' }}>
            {insertConcept.summary?.slice(0, 120)}{(insertConcept.summary?.length ?? 0) > 120 ? '...' : ''}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleConfirmInsert}
              className="active-squish"
              style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius)',
                backgroundColor: 'var(--primary-40)', color: 'white',
                fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer',
              }}
            >
              Add to review list
            </button>
            <button
              onClick={handleRejectInsert}
              className="active-squish"
              style={{
                padding: '10px 16px', borderRadius: 'var(--radius)',
                backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
                fontWeight: 600, fontSize: '0.875rem',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >
              Skip
            </button>
          </div>
        </Card>
      )}

      {/* Selected Podcast Player */}
      {selected && selected.status === 'ready' && (
        <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, var(--primary-90), var(--secondary-container))' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                {isToday(selected.date) ? 'Today' : formatDateLabel(selected.date)}
              </p>
              <h3 style={{ marginBottom: '4px' }}>Daily Recap</h3>
              {selected.duration && (
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{formatDuration(selected.duration)}</p>
              )}
            </div>
            <Radio size={32} color="var(--primary-40)" />
          </div>

          <ProgressBar value={playbackProgress} style={{ marginBottom: '16px' } as React.CSSProperties} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
            <button
              onClick={() => handleSeek(-10)}
              title="Rewind 10 seconds"
              style={{
                width: '44px', height: '44px', borderRadius: '50%',
                backgroundColor: 'transparent', color: 'var(--foreground)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '1px', border: 'none', cursor: 'pointer',
              }}
            >
              <RotateCcw size={20} />
              <span style={{ fontSize: '0.6rem', fontWeight: 600, lineHeight: 1 }}>10</span>
            </button>

            <button
              onClick={handlePlayPause}
              style={{
                width: '56px', height: '56px', borderRadius: '50%',
                backgroundColor: 'var(--primary-40)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-2)',
              }}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            <button
              onClick={() => handleSeek(10)}
              title="Forward 10 seconds"
              style={{
                width: '44px', height: '44px', borderRadius: '50%',
                backgroundColor: 'transparent', color: 'var(--foreground)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '1px', border: 'none', cursor: 'pointer',
              }}
            >
              <RotateCw size={20} />
              <span style={{ fontSize: '0.6rem', fontWeight: 600, lineHeight: 1 }}>10</span>
            </button>
          </div>

          {!hasAudio && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => generatePodcast(selected.date)}
                style={{ gap: '6px' } as React.CSSProperties}
              >
                <RefreshCw size={14} /> Regenerate audio
              </Button>
            </div>
          )}

          {selected.script && (
            <button
              onClick={() => setShowScript(true)}
              style={{
                marginTop: '16px', padding: '12px',
                backgroundColor: 'var(--script-preview-bg)',
                borderRadius: '12px', width: '100%', textAlign: 'left',
                cursor: 'pointer', border: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Script Preview
                </p>
                <ChevronRight size={14} color="var(--muted-foreground)" />
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--foreground)', lineHeight: 1.6 }}>
                {selected.script.slice(0, 200)}{selected.script.length > 200 ? '...' : ''}
              </p>
            </button>
          )}
        </Card>
      )}

      {/* Generate Today's Podcast */}
      {!todayPodcast && (
        <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
          <Radio size={32} color="var(--primary-40)" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ marginBottom: '8px' }}>No podcast for today</h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
            Generate a podcast reviewing your due concepts.
          </p>
          {isGenerating ? (
            <div>
              <ProgressBar value={generationProgress} style={{ marginBottom: '8px' } as React.CSSProperties} />
              <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Generating... {generationProgress}%</p>
            </div>
          ) : (
            <Button onClick={() => generatePodcast(today())} fullWidth>
              Generate Today's Podcast
            </Button>
          )}
        </Card>
      )}

      {todayPodcast?.status === 'generating' && (
        <Card style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '8px' }}>Generating today's podcast...</h4>
          <ProgressBar value={todayPodcast.progress ?? generationProgress} />
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '8px' }}>
            {todayPodcast.progress ?? generationProgress}% complete
          </p>
        </Card>
      )}

      {/* Knowledge Today — concepts in today's podcast review */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={16} color="var(--primary-40)" />
          <h4 style={{ margin: 0 }}>Knowledge Today</h4>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
          {todayConcepts.length} concept{todayConcepts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {conceptsLoading ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Loading concepts...</p>
      ) : todayConcepts.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '6px' }}>📚</p>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>No concepts due today</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
            Keep reviewing flashcards — concepts will appear here when due.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {todayConcepts.map((concept) => {
            const ef = concept.reviewSchedule?.easeFactor ?? 2.5;
            const isWeak = ef < 2.0 && (concept.reviewSchedule?.reviewCount ?? 0) > 0;
            return (
              <Card
                key={concept.id}
                style={{
                  padding: '12px 16px',
                  borderLeft: isWeak ? '3px solid #ef4444' : '3px solid var(--primary-40)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.35, marginBottom: '3px' }}>
                      {concept.title ?? concept.content.slice(0, 60)}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                      {concept.summary?.slice(0, 100)}{(concept.summary?.length ?? 0) > 100 ? '...' : ''}
                    </p>
                  </div>
                  {isWeak && (
                    <span style={{
                      flexShrink: 0, fontSize: '0.65rem', fontWeight: 700,
                      color: '#ef4444', backgroundColor: 'color-mix(in srgb, #ef4444 12%, transparent)',
                      padding: '2px 8px', borderRadius: '100px', letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}>Weak</span>
                  )}
                </div>
                {concept.keywords.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                    {concept.keywords.slice(0, 3).map((kw) => (
                      <span
                        key={kw}
                        style={{
                          fontSize: '0.68rem', color: 'var(--muted-foreground)',
                          backgroundColor: 'var(--surface-variant)',
                          padding: '2px 8px', borderRadius: '100px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
