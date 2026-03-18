import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import type { FlashCard, Question } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InfoFlowItem =
  | { kind: 'concept'; card: FlashCard }
  | { kind: 'connection'; questionA: Question; questionB: Question };

// ─── Rating labels ────────────────────────────────────────────────────────────

const RATING_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Blackout', color: '#E53935' },
  2: { label: 'Wrong',    color: '#FB8C00' },
  3: { label: 'Hard',     color: '#FDD835' },
  4: { label: 'Good',     color: '#7CB342' },
  5: { label: 'Perfect',  color: '#43A047' },
};

// ─── Concept Card (Type A) ────────────────────────────────────────────────────

interface ConceptCardProps {
  card: FlashCard;
  onRate: (id: string, rating: 1 | 2 | 3 | 4 | 5) => void;
  /** true = this card is snapped to the viewport */
  isActive: boolean;
}

function ConceptCard({ card, onRate, isActive }: ConceptCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState(false);
  const [ratedValue, setRatedValue] = useState<number | null>(null);

  // Reset state if the same component is reused for a different card
  useEffect(() => {
    setFlipped(false);
    setRated(false);
    setRatedValue(null);
  }, [card.id]);

  const handleRate = (rating: 1 | 2 | 3 | 4 | 5) => {
    setRatedValue(rating);
    setRated(true);
    onRate(card.id, rating);
  };

  return (
    <div className="flow-card-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 20px', boxSizing: 'border-box' }}>
      {/* Badge */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--primary-40)',
          background: 'color-mix(in srgb, var(--primary-40) 12%, transparent)',
          padding: '4px 12px', borderRadius: '100px',
        }}>
          Active Recall
        </span>
      </div>

      {/* Flip area */}
      <div
        onClick={() => !rated && setFlipped((f) => !f)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '14px',
          padding: '28px 20px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: flipped
            ? 'color-mix(in srgb, var(--primary-40) 8%, var(--surface-variant))'
            : 'var(--surface-variant)',
          border: '1px solid var(--border)',
          cursor: rated ? 'default' : 'pointer',
          transition: 'background-color 0.3s',
          textAlign: 'center',
          animation: isActive ? 'card-slide-in 0.35s ease' : 'none',
        }}
      >
        {!flipped ? (
          <>
            <p style={{ fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--foreground)' }}>
              {card.front}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-40)', animation: 'glow-pulse 2s ease-in-out infinite', display: 'inline-block', flexShrink: 0 }} />
              Tap to reveal answer
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
              Answer
            </p>
            <p style={{ fontSize: '1rem', color: 'var(--foreground)', lineHeight: 1.6 }}>
              {card.back}
            </p>
          </>
        )}
      </div>

      {/* Rating row — visible after flip, before rating */}
      {flipped && !rated && (
        <div style={{ marginTop: '18px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {([1, 2, 3, 4, 5] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleRate(r)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: '14px',
                  border: 'none',
                  backgroundColor: RATING_META[r].color + '22',
                  color: RATING_META[r].color,
                  fontWeight: 800,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, background-color 0.15s',
                  animation: 'card-slide-in 0.25s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = RATING_META[r].color + '44';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = RATING_META[r].color + '22';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={RATING_META[r].label}
              >
                {r}
              </button>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
            1 = Blackout · 3 = Hard · 5 = Perfect
          </p>
        </div>
      )}

      {/* Rated confirmation */}
      {rated && ratedValue !== null && (
        <div
          style={{
            marginTop: '18px',
            padding: '12px',
            borderRadius: '14px',
            backgroundColor: RATING_META[ratedValue].color + '18',
            textAlign: 'center',
            animation: 'card-slide-in 0.2s ease',
          }}
        >
          <p style={{ color: RATING_META[ratedValue].color, fontWeight: 700, fontSize: '0.9rem' }}>
            Rated {ratedValue} — {RATING_META[ratedValue].label}
          </p>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginTop: '2px' }}>
            Swipe up for next
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Connection Card (Type B) ─────────────────────────────────────────────────

interface ConnectionCardProps {
  questionA: Question;
  questionB: Question;
  onAha: (idA: string, idB: string) => void;
}

function ConnectionCard({ questionA, questionB, onAha }: ConnectionCardProps) {
  const [ahaBurst, setAhaBurst] = useState(false);
  const [ahaCount, setAhaCount] = useState(0);
  const lastTapRef = useRef(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (!ahaBurst) {
        setAhaBurst(true);
        setAhaCount((c) => c + 1);
        onAha(questionA.id, questionB.id);
        setTimeout(() => setAhaBurst(false), 2000);
      }
    }
    lastTapRef.current = now;
  }, [ahaBurst, onAha, questionA.id, questionB.id]);

  const sharedKeywords = questionA.keywords.filter((k) => questionB.keywords.includes(k));

  return (
    <div
      onClick={handleTap}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        boxSizing: 'border-box',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Badge */}
      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--node-sky)',
          background: 'color-mix(in srgb, var(--node-sky) 20%, transparent)',
          padding: '4px 12px', borderRadius: '100px',
        }}>
          Connection
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Double-tap for Aha!</span>
        {ahaCount > 0 && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700,
            color: 'var(--primary-40)',
            animation: 'fade-in 0.2s ease',
          }}>
            ×{ahaCount}
          </span>
        )}
      </div>

      {/* Aha! burst overlay */}
      {ahaBurst && (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 20,
            animation: 'aha-pop 2s ease forwards',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            animation: 'glow-ring 2s ease forwards',
          }}>
            <span style={{ fontSize: '3.5rem', filter: 'drop-shadow(0 0 16px rgba(76,175,80,0.8))' }}>🧠</span>
            <span style={{
              fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-40)',
              textShadow: '0 0 12px rgba(76,175,80,0.6)',
              letterSpacing: '0.05em',
            }}>
              AHA!
            </span>
          </div>
        </div>
      )}

      {/* Node A */}
      <div
        style={{
          flex: 1,
          padding: '20px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--node-peach)',
          marginBottom: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: ahaBurst ? '0 0 24px 6px rgba(255,120,80,0.45)' : 'none',
          transition: 'box-shadow 0.4s',
        }}
      >
        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', opacity: 0.75, marginBottom: '6px', letterSpacing: '0.08em' }}>
          CONCEPT A
        </p>
        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'white', lineHeight: 1.4 }}>
          {questionA.title ?? questionA.content}
        </p>
      </div>

      {/* Connector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 24px 10px', color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span>relates to</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      {/* Node B */}
      <div
        style={{
          flex: 1,
          padding: '20px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--node-sky)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: ahaBurst ? '0 0 24px 6px rgba(80,160,255,0.45)' : 'none',
          transition: 'box-shadow 0.4s',
        }}
      >
        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', opacity: 0.75, marginBottom: '6px', letterSpacing: '0.08em' }}>
          CONCEPT B
        </p>
        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'white', lineHeight: 1.4 }}>
          {questionB.title ?? questionB.content}
        </p>
      </div>

      {/* Shared keywords */}
      {sharedKeywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {sharedKeywords.map((k) => (
            <span key={k} style={{
              fontSize: '0.7rem', padding: '2px 10px', borderRadius: '100px',
              background: 'var(--surface-variant)', color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
            }}>
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Immersive Info Flow (fullscreen scroll-snap overlay) ─────────────────────

interface ImmersiveInfoFlowProps {
  items: InfoFlowItem[];
  onRateConcept: (id: string, rating: 1 | 2 | 3 | 4 | 5) => void;
  onAhaConnection: (idA: string, idB: string) => void;
  onClose: () => void;
}

export function ImmersiveInfoFlow({ items, onRateConcept, onAhaConnection, onClose }: ImmersiveInfoFlowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Track which card is visible via IntersectionObserver
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll('[data-flow-card]'));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = cards.indexOf(entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.6 },
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '16px',
        animation: 'slide-up 0.35s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)' }}>
          <X size={24} />
        </button>
        <span style={{ fontSize: '2.5rem' }}>🎉</span>
        <p style={{ fontWeight: 700, fontSize: '1.2rem' }}>All caught up!</p>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', textAlign: 'center', padding: '0 32px' }}>
          Ask more questions to populate your review feed.
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: '8px', padding: '12px 32px', borderRadius: '100px',
            backgroundColor: 'var(--primary-40)', color: 'white',
            fontWeight: 600, border: 'none', cursor: 'pointer',
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'var(--surface)',
        animation: 'slide-up 0.35s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      {/* Header bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'linear-gradient(to bottom, var(--surface) 60%, transparent)',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', gap: '4px', pointerEvents: 'none' }}>
          {items.map((_, i) => (
            <div
              key={i}
              style={{
                height: '3px',
                width: i < activeIndex ? '16px' : i === activeIndex ? '24px' : '8px',
                borderRadius: '100px',
                backgroundColor: i <= activeIndex ? 'var(--primary-40)' : 'var(--border)',
                transition: 'width 0.3s, background-color 0.3s',
                opacity: Math.max(0.3, 1 - Math.abs(i - activeIndex) * 0.15),
              }}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            pointerEvents: 'all',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: 'var(--surface-variant)',
            border: '1px solid var(--border)',
            cursor: 'pointer', color: 'var(--foreground)',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Scroll-snap container */}
      <div
        ref={scrollRef}
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item, idx) => {
          const isConcept = item.kind === 'concept';
          return (
            <div
              key={idx}
              data-flow-card=""
              style={{
                height: '100svh',
                scrollSnapAlign: 'start',
                // Prevent skipping un-rated concept cards
                scrollSnapStop: isConcept ? 'always' : 'normal',
                display: 'flex',
                flexDirection: 'column',
                padding: '64px 16px 24px',
                boxSizing: 'border-box',
                maxWidth: '480px',
                margin: '0 auto',
                width: '100%',
              }}
            >
              <div style={{
                flex: 1,
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: idx === activeIndex ? 'var(--shadow-3)' : 'var(--shadow-1)',
                overflow: 'hidden',
                transition: 'box-shadow 0.3s',
                position: 'relative',
              }}>
                {isConcept ? (
                  <ConceptCard
                    card={(item as { kind: 'concept'; card: FlashCard }).card}
                    onRate={onRateConcept}
                    isActive={idx === activeIndex}
                  />
                ) : (
                  <ConnectionCard
                    questionA={(item as { kind: 'connection'; questionA: Question; questionB: Question }).questionA}
                    questionB={(item as { kind: 'connection'; questionA: Question; questionB: Question }).questionB}
                    onAha={onAhaConnection}
                  />
                )}
              </div>

              {/* Swipe hint on last card */}
              {idx === items.length - 1 && (
                <div style={{ textAlign: 'center', padding: '16px 0 0', color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>
                  You've reached the end of today's flow
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Preview widget shown on HomeScreen ──────────────────────────────────────

interface InfoFlowPreviewProps {
  items: InfoFlowItem[];
  onOpen: () => void;
}

export function InfoFlowPreview({ items, onOpen }: InfoFlowPreviewProps) {
  const conceptCount = items.filter((i) => i.kind === 'concept').length;
  const connectionCount = items.filter((i) => i.kind === 'connection').length;

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%', textAlign: 'left', background: 'none', padding: 0,
        border: 'none', cursor: 'pointer',
      }}
    >
      <div style={{
        borderRadius: 'var(--radius-xl)',
        border: '1.5px solid var(--border)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-1)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.01)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-1)';
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, var(--primary-80), var(--primary-40))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'white', opacity: 0.8, textTransform: 'uppercase', marginBottom: '2px' }}>
              Today's Flow
            </p>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
              {items.length > 0 ? `${items.length} cards ready` : 'All caught up!'}
            </p>
          </div>
          {items.length > 0 && (
            <div style={{
              padding: '8px 20px', borderRadius: '100px',
              backgroundColor: 'white', color: 'var(--primary-40)',
              fontWeight: 700, fontSize: '0.875rem',
            }}>
              Start
            </div>
          )}
        </div>

        {/* Stats row */}
        {items.length > 0 && (
          <div style={{
            padding: '12px 20px',
            backgroundColor: 'var(--surface-variant)',
            display: 'flex', gap: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-40)', animation: 'glow-pulse 2s ease-in-out infinite', display: 'inline-block' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--foreground)', fontWeight: 600 }}>{conceptCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>to review</span>
            </div>
            {connectionCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--node-sky)', display: 'inline-block' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--foreground)', fontWeight: 600 }}>{connectionCount}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>connections</span>
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
