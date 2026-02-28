import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Radio, RefreshCw, RotateCcw, RotateCw, ChevronRight, Trash2, Check, X } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { usePodcast } from '../state/usePodcast';
import { today, formatDateLabel, isToday } from '../lib/date';
import type { DailyPodcast } from '../types';

export function PodcastScreen() {
  const navigate = useNavigate();
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
  const [confirmDeletePodcastId, setConfirmDeletePodcastId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const todayPodcast = getPodcastForDate(today());
  const selected: DailyPodcast | null = selectedId
    ? (podcasts.find((p) => p.id === selectedId) ?? null)
    : (todayPodcast ?? podcasts[0] ?? null);

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

    return () => {
      audio.pause();
      audio.ontimeupdate = null;
      audio.onended = null;
      audioRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.status, getAudioPath]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      // No real audio — simulate with timer (fallback when no TTS configured)
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
      // Simulated mode: adjust progress percentage directly
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
        {/* Header */}
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

        {/* Scrollable script body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 48px', maxWidth: '448px', width: '100%', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '16px' }}>Script</h3>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.85, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>
            {selected.script}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--primary-40)', background: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ marginBottom: '2px' }}>Podcasts</h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Your daily learning summaries</p>
        </div>
      </div>

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
            {/* −10s */}
            <button
              onClick={() => handleSeek(-10)}
              title="Rewind 10 seconds"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                color: 'var(--foreground)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={20} />
              <span style={{ fontSize: '0.6rem', fontWeight: 600, lineHeight: 1 }}>10</span>
            </button>

            {/* Play / Pause */}
            <button
              onClick={handlePlayPause}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-40)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-2)',
              }}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            {/* +10s */}
            <button
              onClick={() => handleSeek(10)}
              title="Forward 10 seconds"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                color: 'var(--foreground)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <RotateCw size={20} />
              <span style={{ fontSize: '0.6rem', fontWeight: 600, lineHeight: 1 }}>10</span>
            </button>
          </div>

          {/* Regenerate audio button if audio was lost on reload */}
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
                marginTop: '16px',
                padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.6)',
                borderRadius: '12px',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Script Preview
                </p>
                <ChevronRight size={14} color="var(--muted-foreground)" />
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--foreground)', lineHeight: 1.6 }}>
                {selected.script.slice(0, 200)}{selected.script.length > 200 ? '…' : ''}
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
            Generate a podcast summarizing your recent learning sessions.
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

      {/* Podcast List */}
      <h4 style={{ marginBottom: '12px' }}>All Podcasts</h4>
      {isLoading ? (
        <p style={{ color: 'var(--muted-foreground)' }}>Loading...</p>
      ) : podcasts.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>No podcasts yet. Generate your first one!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {podcasts.map((pod) => (
            <Card
              key={pod.id}
              onClick={() => pod.status === 'ready' && setSelectedId(pod.id)}
              style={{
                cursor: pod.status === 'ready' ? 'pointer' : 'default',
                border: selected?.id === pod.id ? '2px solid var(--primary-40)' : '2px solid transparent',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => { if (pod.status === 'ready') e.currentTarget.style.transform = 'scale(1.01)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, marginBottom: '2px' }}>
                    {isToday(pod.date) ? 'Today' : formatDateLabel(pod.date)}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                    {pod.questionIds.length} questions · {formatDuration(pod.duration)}
                  </p>
                </div>

                {/* Status badge + delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <Badge color={statusColor(pod.status)}>{pod.status}</Badge>

                  {/* Delete — two-step confirm */}
                  {confirmDeletePodcastId === pod.id ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeletePodcastId(null); }}
                        title="Cancel delete"
                        style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          backgroundColor: 'transparent',
                          color: 'var(--muted-foreground)',
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
                          backgroundColor: 'rgba(220,38,38,0.12)',
                          color: 'rgb(220,38,38)',
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
                        backgroundColor: 'transparent',
                        color: 'var(--muted-foreground)',
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
