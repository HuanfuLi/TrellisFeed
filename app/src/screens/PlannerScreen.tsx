import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Bookmark, Check, Trash2, Lightbulb, Link2, RefreshCw, Sparkles,
  BookOpen, Mic, Loader2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { usePlanner } from '../state/usePlanner';
import { usePlannerAutoGen } from '../state/usePlannerAutoGen';
import { useDailyRefresh } from '../state/useDailyRefresh';
import { useReview } from '../state/useReview';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { MoveCard } from '../components/MoveCard';
import { Capacitor } from '@capacitor/core';
import type { PlannerChunk, ChunkStatus, PlannerThread, LearningCheckIn } from '../types';

// ── Chunk type display helpers ─────────────────────────────────────────────

const CHUNK_TYPE_CONFIG: Record<PlannerChunk['type'], { icon: React.ReactNode; color: string; label: string }> = {
  retrieve: { icon: <RefreshCw size={14} />, color: 'var(--node-mint)', label: 'Retrieve' },
  repair: { icon: <Lightbulb size={14} />, color: 'var(--node-salmon)', label: 'Repair' },
  connect: { icon: <Link2 size={14} />, color: 'var(--node-lilac)', label: 'Connect' },
  create: { icon: <Sparkles size={14} />, color: 'var(--node-peach)', label: 'Create' },
};

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', marginTop: '24px' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
      {count !== undefined && count > 0 && (
        <Badge color="gray">{count}</Badge>
      )}
    </div>
  );
}

function EmptySectionHint({ text }: { text: string }) {
  return (
    <Card style={{ padding: '14px 16px', marginBottom: '10px', backgroundColor: 'var(--surface-variant)' }}>
      <p style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{text}</p>
    </Card>
  );
}

// ── Chunk card ─────────────────────────────────────────────────────────────

function ChunkCard({
  chunk,
  onStatusChange,
  onDelete,
}: {
  chunk: PlannerChunk;
  onStatusChange: (id: string, status: ChunkStatus) => void;
  onDelete: (id: string) => void;
}) {
  const config = CHUNK_TYPE_CONFIG[chunk.type];
  const isActive = chunk.status === 'in_progress';

  return (
    <Card style={{
      borderLeft: `3px solid ${config.color}`,
      padding: '14px 16px',
      marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ color: config.color, display: 'flex' }}>{config.icon}</span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--muted-foreground)',
            }}>
              {config.label}
            </span>
          </div>
          <p style={{ fontSize: '0.92rem', lineHeight: 1.5, color: 'var(--foreground)' }}>{chunk.goal}</p>
          {chunk.description && (
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginTop: '4px', lineHeight: 1.45 }}>
              {chunk.description}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {chunk.status === 'suggested' && (
            <>
              <button
                onClick={() => onStatusChange(chunk.id, 'in_progress')}
                title="Start"
                className="active-squish"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: 'var(--primary-40)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Play size={13} />
              </button>
              <button
                onClick={() => onStatusChange(chunk.id, 'saved_for_later')}
                title="Save for later"
                className="active-squish"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Bookmark size={13} />
              </button>
              <button
                onClick={() => onDelete(chunk.id)}
                title="Dismiss"
                className="active-squish"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {isActive && (
            <>
              <button
                onClick={() => onStatusChange(chunk.id, 'done')}
                title="Mark done"
                className="active-squish"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: 'var(--primary-40)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => onDelete(chunk.id)}
                title="Remove"
                className="active-squish"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {chunk.status === 'saved_for_later' && (
            <>
              <button
                onClick={() => onStatusChange(chunk.id, 'in_progress')}
                title="Start"
                className="active-squish"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: 'var(--primary-40)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Play size={13} />
              </button>
              <button
                onClick={() => onDelete(chunk.id)}
                title="Remove"
                className="active-squish"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Thread card ─────────────────────────────────────────────────────────────

function ThreadCard({
  thread,
  onToggleSaved,
  onDelete,
}: {
  thread: PlannerThread;
  onToggleSaved: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card style={{ padding: '14px 16px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.92rem', fontWeight: 500, lineHeight: 1.45, color: 'var(--foreground)' }}>
            {thread.title}
          </p>
          {thread.description && (
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginTop: '4px', lineHeight: 1.4 }}>
              {thread.description}
            </p>
          )}
          {thread.keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {thread.keywords.slice(0, 4).map((kw) => (
                <span key={kw} style={{
                  fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                }}>
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={() => onToggleSaved(thread.id)}
            title={thread.saved ? 'Unsave' : 'Save'}
            className="active-squish"
            style={{
              width: '30px', height: '30px', borderRadius: '50%',
              backgroundColor: thread.saved ? 'var(--primary-40)' : 'var(--surface-variant)',
              color: thread.saved ? 'white' : 'var(--muted-foreground)',
              border: thread.saved ? 'none' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Bookmark size={13} fill={thread.saved ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => onDelete(thread.id)}
            title="Remove thread"
            className="active-squish"
            style={{
              width: '30px', height: '30px', borderRadius: '50%',
              backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Check-in outcome display ───────────────────────────────────────────────

function CheckInOutcome({ checkIn }: { checkIn: LearningCheckIn }) {
  const { signals, affectedThreadIds, generatedChunkIds } = checkIn;
  const hasOutcome = affectedThreadIds.length > 0 || generatedChunkIds.length > 0;

  return (
    <div style={{
      padding: '12px 14px', borderRadius: '14px',
      backgroundColor: 'var(--surface-variant)', border: '1px solid var(--border)',
      marginBottom: '8px',
    }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--foreground)', lineHeight: 1.5, marginBottom: hasOutcome ? '8px' : 0 }}>
        {checkIn.content}
      </p>
      {hasOutcome && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {affectedThreadIds.length > 0 && (
            <span style={{
              fontSize: '0.72rem', padding: '3px 8px', borderRadius: '999px',
              backgroundColor: 'color-mix(in srgb, var(--primary-40) 15%, transparent)',
              color: 'var(--primary-40)',
            }}>
              {affectedThreadIds.length} thread{affectedThreadIds.length > 1 ? 's' : ''} updated
            </span>
          )}
          {generatedChunkIds.length > 0 && (
            <span style={{
              fontSize: '0.72rem', padding: '3px 8px', borderRadius: '999px',
              backgroundColor: 'color-mix(in srgb, var(--node-mint) 25%, transparent)',
              color: 'var(--foreground)',
            }}>
              {generatedChunkIds.length} suggestion{generatedChunkIds.length > 1 ? 's' : ''} added
            </span>
          )}
          {signals.confidence.length > 0 && (
            <span style={{
              fontSize: '0.72rem', padding: '3px 8px', borderRadius: '999px',
              backgroundColor: 'color-mix(in srgb, var(--node-mint) 25%, transparent)',
              color: 'var(--foreground)',
            }}>
              Confidence noted
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export function PlannerScreen() {
  const navigate = useNavigate();
  const {
    continueChunks, suggestedChunks, savedChunks, savedThreads, recentCheckIns,
    isLoading,
    updateChunkStatus, deleteChunk, toggleThreadSaved, deleteThread, submitCheckIn,
  } = usePlanner();
  const { moves: autoMoves, isRefreshing, accept: acceptMove, dismiss: dismissMove, skipAll, refresh: refreshMoves } = usePlannerAutoGen();
  useDailyRefresh(); // Mount to activate PODCAST_GENERATION_COMPLETED → refresh subscription
  const { reviewCount } = useReview();
  const [showAutoMoves, setShowAutoMoves] = useState(true);
  const totalSuggestions = autoMoves.length + suggestedChunks.length;

  const [checkInInput, setCheckInInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSavedChunks, setShowSavedChunks] = useState(false);
  const [showCheckInHistory, setShowCheckInHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Optional: speech-to-text support (reuse existing STT if on native)
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // refresh() is now auto-called by usePlanner on mount + PLANNER_UPDATED events

  const handleSubmitCheckIn = async () => {
    const content = checkInInput.trim();
    if (!content || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await submitCheckIn(content);
      setCheckInInput('');
      const outcomes: string[] = [];
      if (result.affectedThreadIds.length > 0) outcomes.push(`${result.affectedThreadIds.length} thread(s)`);
      if (result.generatedChunkIds.length > 0) outcomes.push(`${result.generatedChunkIds.length} suggestion(s)`);
      toast(outcomes.length > 0 ? `Check-in processed: ${outcomes.join(', ')}` : 'Check-in saved', 'success');
    } catch {
      toast('Failed to process check-in', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRecording = async () => {
    if (!Capacitor.isNativePlatform() && !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (audioChunksRef.current.length > 0) {
          try {
            const { transcribeAudio } = await import('../providers/stt');
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const { mockSettingsService } = await import('../services/mock/settings.mock');
            const text = await transcribeAudio(blob, mockSettingsService.getSync().tts);
            setCheckInInput((prev) => (prev ? prev + ' ' : '') + text);
          } catch {
            toast('Transcription failed', 'error');
          }
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast('Microphone access denied', 'error');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSkipAll = () => {
    skipAll();
    suggestedChunks.forEach(chunk => deleteChunk(chunk.id));
    toast('Suggestions cleared');
  };

  return (
    <div style={{ padding: `${HEADER_HEIGHT + 8}px 16px 96px`, maxWidth: '448px', margin: '0 auto' }}>
      <Header title="Planner" />

      {/* Review Banner */}
      {reviewCount > 0 && (
        <button
          onClick={() => navigate('/review')}
          className="active-squish"
          style={{
            width: '100%', textAlign: 'left', marginBottom: '16px',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, var(--primary-90), var(--secondary-container))',
            borderRadius: '16px', border: '1px solid var(--primary-80)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={18} color="var(--primary-40)" />
            <span style={{ fontWeight: 500, color: 'var(--primary-30)', fontSize: '0.9rem' }}>Review due</span>
          </div>
          <Badge color="green">{reviewCount} cards</Badge>
        </button>
      )}

      {/* ── Learning Check-In ─────────────────────────────────────────── */}
      <Card style={{ padding: '16px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Sparkles size={16} color="var(--primary-40)" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)' }}>Learning Check-In</span>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: '10px' }}>
          What felt clear, fuzzy, or interesting? The system will organize your thoughts into threads and suggestions.
        </p>
        <textarea
          ref={textareaRef}
          value={checkInInput}
          onChange={(e) => setCheckInInput(e.target.value)}
          rows={3}
          placeholder="e.g. I finally get how closures work, but I'm still fuzzy on how they interact with async/await..."
          disabled={isSubmitting}
          style={{
            width: '100%', resize: 'vertical', minHeight: '72px',
            borderRadius: '12px', border: '1.5px solid var(--border)',
            backgroundColor: 'var(--surface-variant)', color: 'var(--foreground)',
            padding: '10px 12px', fontSize: '0.88rem', lineHeight: 1.45,
          }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            onClick={() => isRecording ? handleStopRecording() : void handleStartRecording()}
            title={isRecording ? 'Stop recording' : 'Voice input'}
            className="active-squish"
            style={{
              width: '38px', height: '38px', borderRadius: '12px',
              backgroundColor: isRecording ? '#E53935' : 'var(--surface-variant)',
              color: isRecording ? 'white' : 'var(--muted-foreground)',
              border: isRecording ? 'none' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            {isRecording ? <X size={16} /> : <Mic size={16} />}
          </button>
          <button
            onClick={() => void handleSubmitCheckIn()}
            disabled={!checkInInput.trim() || isSubmitting}
            className="active-squish"
            style={{
              flex: 1, padding: '9px 16px', borderRadius: '12px',
              border: 'none', backgroundColor: 'var(--primary-40)', color: 'white',
              fontSize: '0.88rem', fontWeight: 500,
              cursor: !checkInInput.trim() || isSubmitting ? 'not-allowed' : 'pointer',
              opacity: !checkInInput.trim() || isSubmitting ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            {isSubmitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {isSubmitting ? 'Processing...' : 'Check In'}
          </button>
        </div>
      </Card>

      {/* Recent check-in history */}
      {recentCheckIns.length > 0 && (
        <button
          onClick={() => setShowCheckInHistory(!showCheckInHistory)}
          style={{
            background: 'none', padding: '6px 0', display: 'flex', alignItems: 'center',
            gap: '4px', color: 'var(--muted-foreground)', fontSize: '0.78rem', marginBottom: '4px',
          }}
        >
          Recent check-ins ({recentCheckIns.length})
          {showCheckInHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}
      {showCheckInHistory && recentCheckIns.map((ci) => (
        <CheckInOutcome key={ci.id} checkIn={ci} />
      ))}

      {/* ── Suggested Moves (unified) ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Suggested Moves</h2>
          {totalSuggestions > 0 && <Badge color="gray">{totalSuggestions}</Badge>}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => void refreshMoves()}
            disabled={isRefreshing}
            title="Refresh suggestions"
            className="active-squish"
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isRefreshing ? 0.5 : 1,
            }}
          >
            {isRefreshing
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={13} />}
          </button>
          <button
            onClick={() => setShowAutoMoves(!showAutoMoves)}
            style={{
              background: 'none', display: 'flex', alignItems: 'center',
              gap: '3px', color: 'var(--muted-foreground)', fontSize: '0.78rem',
              padding: '4px',
            }}
          >
            {showAutoMoves ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {showAutoMoves && (
        totalSuggestions === 0 ? (
          <EmptySectionHint text="No suggestions right now — tap refresh to check for new moves." />
        ) : (
          <>
            {autoMoves.map((move) => (
              <MoveCard
                key={move.id}
                move={move}
                onAccept={acceptMove}
                onDismiss={dismissMove}
                onNavigate={(success) => {
                  if (!success) {
                    toast('Navigation failed — check move configuration', 'error');
                  }
                }}
              />
            ))}
            {suggestedChunks.map((chunk) => (
              <ChunkCard key={chunk.id} chunk={chunk} onStatusChange={updateChunkStatus} onDelete={deleteChunk} />
            ))}
            {autoMoves.length > 0 && (
              <button
                onClick={handleSkipAll}
                style={{
                  background: 'none', padding: '6px 0 4px', display: 'flex',
                  alignItems: 'center', gap: '4px', color: 'var(--muted-foreground)',
                  fontSize: '0.78rem', marginBottom: '4px',
                }}
              >
                Skip all suggestions
              </button>
            )}
          </>
        )
      )}

      {/* Empty planner state with suggestion CTA */}
      {continueChunks.length === 0 && totalSuggestions > 0 && (
        <Card style={{ padding: '14px 16px', marginBottom: '16px', backgroundColor: 'color-mix(in srgb, var(--primary-40) 8%, var(--surface))' }}>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--foreground)', marginBottom: '6px' }}>
            No planned moves yet. We've suggested some ideas above.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
            Try one of these suggestions to get started!
          </p>
        </Card>
      )}

      {/* ── Continue ──────────────────────────────────────────────────── */}
      <SectionHeader title="Continue" count={continueChunks.length} />
      {continueChunks.length > 0 ? continueChunks.map((chunk) => (
        <ChunkCard key={chunk.id} chunk={chunk} onStatusChange={updateChunkStatus} onDelete={deleteChunk} />
      )) : (
        <EmptySectionHint text="Chunks you start will stay here so you can pick them back up without pressure." />
      )}

      {/* ── Saved Threads ─────────────────────────────────────────────── */}
      <SectionHeader title="Saved Threads" count={savedThreads.length} />
      {savedThreads.length > 0 ? savedThreads.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} onToggleSaved={toggleThreadSaved} onDelete={deleteThread} />
      )) : (
        <EmptySectionHint text="Open topics and unresolved comparisons will collect here once your check-ins surface them." />
      )}

      {/* ── Saved for Later ───────────────────────────────────────────── */}
      {savedChunks.length > 0 && (
        <>
          <button
            onClick={() => setShowSavedChunks(!showSavedChunks)}
            style={{
              background: 'none', padding: '6px 0', display: 'flex', alignItems: 'center',
              gap: '4px', color: 'var(--muted-foreground)', fontSize: '0.82rem',
              marginTop: '20px',
            }}
          >
            Saved for later ({savedChunks.length})
            {showSavedChunks ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showSavedChunks && savedChunks.map((chunk) => (
            <ChunkCard key={chunk.id} chunk={chunk} onStatusChange={updateChunkStatus} onDelete={deleteChunk} />
          ))}
        </>
      )}

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px 0', color: 'var(--muted-foreground)' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Processing...
        </div>
      )}
    </div>
  );
}
