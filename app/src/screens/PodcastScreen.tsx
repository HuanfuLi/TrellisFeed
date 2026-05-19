import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Play, Pause, Radio, RefreshCw, RotateCcw, RotateCw, ChevronRight, Trash2, Check, X, List, BookOpen } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { ConceptCard } from '../components/ConceptCard';
import { usePodcast } from '../state/usePodcast';
import { today, formatDateLabel, isToday } from '../lib/date';
import { toast } from '../lib/toast';
import { questionService } from '../services/question.service';
import { podcastService } from '../services/podcast.service';
import { parseMoveNavigationState } from '../lib/moveNavigator';
import { eventBus } from '../lib/event-bus';
import type { DailyPodcast, Question } from '../types';

export function PodcastScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
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

  // Phase 51-01: optional concept filter from AnchorDetailScreen Appears-in
  // footer. When set, the All Podcasts list is narrowed to entries whose
  // questionIds intersect the supplied qaIds. A small banner above the list
  // shows the concept name + a Clear button.
  const [conceptFilter, setConceptFilter] = useState<{ qaIds: Set<string>; title: string } | null>(null);
  useEffect(() => {
    const state = location.state as { conceptFilterQaIds?: string[]; conceptTitle?: string } | null;
    if (state?.conceptFilterQaIds && state?.conceptTitle) {
      setConceptFilter({ qaIds: new Set(state.conceptFilterQaIds), title: state.conceptTitle });
      // Auto-open the All Podcasts view so the filter has an immediate
      // visible effect — otherwise the user lands on today's player and
      // doesn't see the filtered list until they tap History.
      setShowAllPodcasts(true);
    }
    // Don't blanket-clear here — moveState (Planner concept-insertion) also
    // lives on location.state and is read by an unrelated effect below.
    // Only strip the conceptFilter* fields and preserve the rest.
    if (state && (state.conceptFilterQaIds || state.conceptTitle)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { conceptFilterQaIds: _qa, conceptTitle: _ct, ...rest } = state;
      navigate(location.pathname, { replace: true, state: Object.keys(rest).length > 0 ? rest : null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 51-01: filtered podcast list. Identity-stable when conceptFilter
  // is null so the existing podcasts.map paths keep their referential
  // equality on identical re-renders.
  const visiblePodcasts = useMemo(() => {
    if (!conceptFilter) return podcasts;
    return podcasts.filter((p) => p.questionIds.some((id) => conceptFilter.qaIds.has(id)));
  }, [podcasts, conceptFilter]);

  const todayPodcast = getPodcastForDate(today());
  const selected: DailyPodcast | null = selectedId
    ? (podcasts.find((p) => p.id === selectedId) ?? null)
    : (todayPodcast ?? podcasts[0] ?? null);

  // Load concepts for Knowledge Today — always live SM-2 due list + Planner additions
  const loadConcepts = useCallback(async () => {
    setConceptsLoading(true);
    const todayDate = today();

    // Always start from the live SM-2 due list
    const dueResult = await questionService.getDueForReview(todayDate);
    const dueConcepts = dueResult.data ?? [];
    const dueIds = new Set(dueConcepts.map((q) => q.id));

    // Merge any Planner-added concepts that aren't already in the SM-2 list
    const plannerIds = podcastService.getTodayConceptIds(todayDate);
    const extraIds = plannerIds.filter((id) => !dueIds.has(id));
    if (extraIds.length > 0) {
      const allQ = questionService.getAll();
      const extraIdSet = new Set(extraIds);
      const extras = allQ.filter((q) => extraIdSet.has(q.id));
      setTodayConcepts([...dueConcepts, ...extras]);
    } else {
      setTodayConcepts(dueConcepts);
    }
    setConceptsLoading(false);
  }, []);

  useEffect(() => {
    void loadConcepts();
    // Re-load when new questions are asked so the list updates dynamically
    const unsub = eventBus.subscribe('QUESTION_ASKED', () => { void loadConcepts(); });
    return unsub;
  }, [loadConcepts]);

  // Handle incoming concept insertion from Planner
  useEffect(() => {
    if (insertHandled || !moveState?.move || moveState.move.moveType !== 'podcast') return;

    const conceptId = moveState.linkedResource?.id;
    if (!conceptId) return;

    // Check if already in today's podcast
    const existing = podcastService.getTodayConceptIds(today());
    if (existing.includes(conceptId)) {
      toast(t('podcast.toast.conceptAlreadyIn'), 'info');
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
  }, [moveState, insertHandled, t]);

  const handleConfirmInsert = () => {
    if (!insertConcept) return;
    const added = podcastService.addConceptToPodcast(today(), insertConcept.id);
    if (added) {
      void loadConcepts();
      toast(t('podcast.toast.conceptAddedToPodcast'), 'success');
    } else {
      // No podcast — add directly to the live list; it'll be included at generation
      setTodayConcepts((prev) =>
        prev.some((c) => c.id === insertConcept.id) ? prev : [...prev, insertConcept],
      );
      toast(t('podcast.toast.conceptAddedToList'), 'success');
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
      toast(t('podcast.toast.audioUnavailable'), 'error');
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
            style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1 }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {isToday(selected.date) ? t('podcast.player.todayLabel') : formatDateLabel(selected.date)}
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 48px', maxWidth: '448px', width: '100%', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '16px' }}>{t('podcast.player.scriptHeading')}</h3>
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
      <div style={{ paddingTop: '24px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(24px + var(--safe-area-bottom))', maxWidth: '448px', margin: '0 auto' }}>
        <button
          onClick={() => setShowAllPodcasts(false)}
          style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', marginBottom: '24px' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ marginBottom: '16px' }}>{t('podcast.allPodcasts')}</h2>

        {/* Phase 51-01: concept-filter banner with Clear button. Renders
            when conceptFilter is active. Tapping Clear resets the filter
            and re-shows the full list — back-button or navigation away
            also discards it (state lives on the component, not the URL). */}
        {conceptFilter && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'var(--surface-variant)',
            borderRadius: 'var(--radius-xl)',
            marginBottom: '12px',
            fontSize: '0.85rem',
          }}>
            <span>{t('podcast.filteredBy', { concept: conceptFilter.title })}</span>
            <button
              type="button"
              onClick={() => setConceptFilter(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-40)',
                cursor: 'pointer',
                fontWeight: 600,
                padding: '4px 8px',
              }}
            >
              {t('common.clear')}
            </button>
          </div>
        )}

        {isLoading ? (
          <p style={{ color: 'var(--muted-foreground)' }}>{t('podcast.loading')}</p>
        ) : visiblePodcasts.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>{t('podcast.emptyList')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {visiblePodcasts.map((pod) => (
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
                      {isToday(pod.date) ? t('podcast.player.todayLabel') : formatDateLabel(pod.date)}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                      {t('podcast.player.conceptsDuration', { count: pod.questionIds.length, duration: formatDuration(pod.duration) })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <Badge color={statusColor(pod.status)}>{pod.status}</Badge>
                    {confirmDeletePodcastId === pod.id ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeletePodcastId(null); }}
                          title={t('podcast.player.cancelDelete')}
                          style={{
                            width: '44px', height: '44px', borderRadius: '50%',
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
                          title={t('podcast.player.confirmDelete')}
                          style={{
                            width: '44px', height: '44px', borderRadius: '50%',
                            backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)',
                            border: '1.5px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <Check size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeletePodcastId(pod.id); }}
                        title={t('podcast.player.deleteTitle')}
                        style={{
                          width: '44px', height: '44px', borderRadius: '50%',
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
    <div style={{ paddingTop: '24px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'calc(24px + var(--safe-area-bottom))', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={() => setShowAllPodcasts(true)}
          title={t('podcast.historyTitle')}
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
          {t('podcast.historyButton')}
        </button>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '2px' }}>{t('podcast.title')}</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>{t('podcast.subtitle')}</p>
      </div>

      {/* Concept insertion banner from Planner */}
      {insertConcept && (
        <Card style={{
          marginBottom: '16px',
          border: '2px solid var(--primary-40)',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary-40) 8%, var(--surface)), var(--surface))',
        }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary-40)', marginBottom: '8px' }}>
            {t('podcast.insertBanner.label')}
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
              {t('podcast.insertBanner.addToReview')}
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
              {t('podcast.insertBanner.skip')}
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
                {isToday(selected.date) ? t('podcast.player.todayLabel') : formatDateLabel(selected.date)}
              </p>
              <h3 style={{ marginBottom: '4px' }}>{t('podcast.player.dailyRecap')}</h3>
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
              title={t('podcast.player.rewindTitle')}
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
              title={t('podcast.player.forwardTitle')}
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
                onClick={() => generatePodcast(selected.date, todayConcepts.map((c) => c.id))}
                style={{ gap: '6px' } as React.CSSProperties}
              >
                <RefreshCw size={14} /> {t('podcast.player.regenerateAudio')}
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
                  {t('podcast.player.scriptPreview')}
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
      {(!todayPodcast || todayPodcast.status === 'pending' || todayPodcast.status === 'failed') && (
        <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
          <Radio size={32} color="var(--primary-40)" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ marginBottom: '8px' }}>
            {todayPodcast?.status === 'failed' ? t('podcast.generateCard.failedTitle') : t('podcast.generateCard.noneTitle')}
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
            {todayPodcast?.status === 'failed'
              ? (todayPodcast.error ?? t('podcast.generateCard.failedDescription'))
              : t('podcast.generateCard.noneDescription')}
          </p>
          {isGenerating ? (
            <div>
              <ProgressBar value={generationProgress} style={{ marginBottom: '8px' } as React.CSSProperties} />
              <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>{t('podcast.generateCard.progressText', { progress: generationProgress })}</p>
            </div>
          ) : (
            <Button onClick={() => generatePodcast(today(), todayConcepts.map((c) => c.id))} fullWidth>
              {todayPodcast?.status === 'failed' ? t('podcast.generateCard.retryButton') : t('podcast.generateCard.generateButton')}
            </Button>
          )}
        </Card>
      )}

      {todayPodcast?.status === 'generating' && (
        <Card style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '8px' }}>{t('podcast.generateCard.generatingTitle')}</h4>
          <ProgressBar value={todayPodcast.progress ?? generationProgress} />
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '8px' }}>
            {t('podcast.generateCard.progressSuffix', { progress: todayPodcast.progress ?? generationProgress })}
          </p>
        </Card>
      )}

      {/* Knowledge Today — concepts in today's podcast review */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={16} color="var(--primary-40)" />
          <h4 style={{ margin: 0 }}>{t('podcast.knowledgeToday.heading')}</h4>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
          {todayConcepts.length === 1 ? t('podcast.knowledgeToday.countOne', { count: todayConcepts.length }) : t('podcast.knowledgeToday.countOther', { count: todayConcepts.length })}
        </span>
      </div>

      {conceptsLoading ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>{t('podcast.loadingConcepts')}</p>
      ) : todayConcepts.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '6px' }}>📚</p>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{t('podcast.emptyConcepts.title')}</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
            {t('podcast.emptyConcepts.body')}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {todayConcepts.map((concept) => {
            const ef = concept.reviewSchedule?.easeFactor ?? 2.5;
            const isWeak = ef < 2.0 && (concept.reviewSchedule?.reviewCount ?? 0) > 0;
            return (
              <ConceptCard
                key={concept.id}
                question={concept}
                onClick={() => navigate(`/ask/${concept.id}`)}
                badge={isWeak ? { label: t('podcast.knowledgeToday.weakBadge'), color: 'var(--danger)' } : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
