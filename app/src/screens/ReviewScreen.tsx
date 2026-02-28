import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pin, BookOpen, Trash2, Check, X } from 'lucide-react';
import { Flashcard } from '../components/Flashcard';
import { Confetti } from '../components/Confetti';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { useReview } from '../state/useReview';
import { toast } from '../lib/toast';
import type { FlashCard } from '../types';

// ─── Library view ─────────────────────────────────────────────────────────────

function LibraryCard({
  card,
  onTogglePin,
  onDelete,
}: {
  card: FlashCard;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const btnBase: React.CSSProperties = {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-1)',
        overflow: 'hidden',
        border: card.pinned ? '2px solid var(--primary-40)' : '2px solid transparent',
      }}
    >
      {/* Q row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '16px 16px 12px',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '0.7rem',
              color: 'var(--muted-foreground)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '6px',
            }}
          >
            Q
          </p>
          <p style={{ fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.45 }}>{card.front}</p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
          {/* Pin button — always visible */}
          <button
            onClick={() => onTogglePin(card.id)}
            title={card.pinned ? 'Unpin' : 'Pin — review every day'}
            style={{
              ...btnBase,
              backgroundColor: card.pinned ? 'var(--primary-40)' : 'transparent',
              color: card.pinned ? 'white' : 'var(--muted-foreground)',
              border: `1.5px solid ${card.pinned ? 'var(--primary-40)' : 'var(--surface-variant)'}`,
            }}
          >
            <Pin size={14} fill={card.pinned ? 'currentColor' : 'none'} />
          </button>

          {/* Delete / confirm state */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete card"
              style={{
                ...btnBase,
                backgroundColor: 'transparent',
                color: 'var(--muted-foreground)',
                border: '1.5px solid var(--surface-variant)',
              }}
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                title="Cancel"
                style={{
                  ...btnBase,
                  backgroundColor: 'transparent',
                  color: 'var(--muted-foreground)',
                  border: '1.5px solid var(--surface-variant)',
                }}
              >
                <X size={14} />
              </button>
              <button
                onClick={() => onDelete(card.id)}
                title="Confirm delete"
                style={{
                  ...btnBase,
                  backgroundColor: '#E53935',
                  color: 'white',
                  border: '1.5px solid #E53935',
                }}
              >
                <Check size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: 'var(--surface-variant)', margin: '0 16px' }} />

      {/* A row */}
      <div style={{ padding: '12px 16px 16px' }}>
        <p
          style={{
            fontSize: '0.7rem',
            color: 'var(--muted-foreground)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '6px',
          }}
        >
          A
        </p>
        <p style={{ fontSize: '0.9375rem', color: 'var(--foreground)', lineHeight: 1.55 }}>{card.back}</p>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ReviewScreen() {
  const navigate = useNavigate();
  const { items, allCards, isLoading, submitReview, skipReview, togglePin, deleteCard } = useReview();

  const [reviewed, setReviewed] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [done, setDone] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Trigger confetti + toast when the user completes their review session
  useEffect(() => {
    if (done && reviewed > 0) {
      setShowConfetti(true);
      toast('All reviews done for today! 🎉', 'success');
    }
  }, [done, reviewed]);

  useEffect(() => {
    if (!showConfetti) return;
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, [showConfetti]);

  const total = items.length + reviewed;
  const progress = total > 0 ? (reviewed / total) * 100 : 0;
  const currentItem = items[0];

  const handleRate = async (rating: number) => {
    if (!currentItem) return;
    await submitReview(currentItem.id, rating as 1 | 2 | 3 | 4 | 5);
    setTotalRatings((prev) => prev + rating);
    const nextReviewed = reviewed + 1;
    setReviewed(nextReviewed);
    if (nextReviewed >= total || items.length <= 1) {
      setDone(true);
    }
  };

  const handleSkip = async () => {
    if (!currentItem) return;
    await skipReview(currentItem.id);
    if (items.length <= 1) {
      setDone(true);
    }
  };

  // ── Library view ────────────────────────────────────────────────────────────
  if (showLibrary) {
    // Sort: pinned first, then by createdAt desc
    const sorted = [...allCards].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return b.createdAt - a.createdAt;
    });

    const pinnedCount = sorted.filter((c) => c.pinned).length;

    return (
      <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button
            onClick={() => setShowLibrary(false)}
            style={{ color: 'var(--primary-40)', background: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
          >
            <ArrowLeft size={20} /> All Done
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
            <BookOpen size={16} />
            {allCards.length} card{allCards.length !== 1 ? 's' : ''}
            {pinnedCount > 0 && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  marginLeft: '6px',
                  color: 'var(--primary-40)',
                  fontSize: '0.8rem',
                }}
              >
                <Pin size={12} fill="currentColor" />
                {pinnedCount}
              </span>
            )}
          </div>
        </div>

        <h2 style={{ marginBottom: '6px' }}>All Flashcards</h2>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '24px' }}>
          {pinnedCount > 0
            ? `${pinnedCount} pinned · added to review every day`
            : 'Pin cards to add them to your daily review queue.'}
        </p>

        {allCards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted-foreground)' }}>
            <p>No flashcards yet. Start a conversation to generate some!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pinnedCount > 0 && (
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--primary-40)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Pin size={11} fill="currentColor" /> Pinned
              </p>
            )}
            {sorted.map((card, idx) => {
              const prevPinned = idx > 0 ? (sorted[idx - 1].pinned ?? false) : true;
              const curPinned = card.pinned ?? false;
              return (
                <div key={card.id}>
                  {/* Section divider between pinned and unpinned */}
                  {!curPinned && prevPinned && pinnedCount > 0 && (
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--muted-foreground)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '4px',
                        marginTop: '8px',
                      }}
                    >
                      All Cards
                    </p>
                  )}
                  <LibraryCard card={card} onTogglePin={togglePin} onDelete={deleteCard} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: '448px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted-foreground)' }}>Loading review items...</p>
      </div>
    );
  }

  // ── All Done ────────────────────────────────────────────────────────────────
  if (done || items.length === 0) {
    const avgRating = reviewed > 0 ? (totalRatings / reviewed).toFixed(1) : '—';
    return (
      <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
        <Confetti active={showConfetti} />
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--primary-40)', background: 'none', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
        >
          <ArrowLeft size={20} /> Back
        </button>

        {/* Summary card */}
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            backgroundColor: 'var(--card)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-2)',
            marginBottom: '16px',
          }}
        >
          <p style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</p>
          <h2 style={{ marginBottom: '8px' }}>All Done!</h2>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '24px' }}>
            {reviewed > 0
              ? `Great work! You reviewed ${reviewed} card${reviewed !== 1 ? 's' : ''} today.`
              : 'No cards due today — come back tomorrow!'}
          </p>

          {reviewed > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '32px' }}>
              <div>
                <p style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--primary-40)' }}>{reviewed}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Reviewed</p>
              </div>
              <div>
                <p style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--primary-40)' }}>{avgRating}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Avg rating</p>
              </div>
            </div>
          )}

          <Button onClick={() => navigate(-1)} fullWidth>Back</Button>
        </div>

        {/* All Flashcards button */}
        {allCards.length > 0 && (
          <button
            onClick={() => setShowLibrary(true)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--surface-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: 'var(--foreground)',
              fontWeight: 500,
              fontSize: '0.9375rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <BookOpen size={18} color="var(--primary-40)" />
            All Flashcards
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: 'var(--primary-40)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {allCards.length}
            </span>
          </button>
        )}
      </div>
    );
  }

  // ── Active review session ────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 0 96px', maxWidth: '448px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ color: 'var(--primary-40)', background: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
          >
            <ArrowLeft size={20} /> Back
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {reviewed} / {total} reviewed
          </span>
        </div>
        <ProgressBar value={progress} />
      </div>

      {/* Flashcard with pin button */}
      <Flashcard
        front={currentItem.front}
        back={currentItem.back}
        onRate={handleRate}
        pinned={currentItem.pinned}
        onTogglePin={() => togglePin(currentItem.id)}
      />

      {/* Skip */}
      <div style={{ textAlign: 'center', marginTop: '16px', padding: '0 16px' }}>
        <button
          onClick={handleSkip}
          style={{ color: 'var(--muted-foreground)', background: 'none', fontSize: '0.875rem' }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
