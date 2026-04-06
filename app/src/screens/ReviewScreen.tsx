import { useState, useEffect, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { parseMoveNavigationState } from '../lib/moveNavigator';
import { ArrowLeft, Pin, BookOpen, Trash2, Check, X, GitBranch } from 'lucide-react';
import { Flashcard } from '../components/Flashcard';
import { Confetti } from '../components/Confetti';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useReview } from '../state/useReview';
import { toast } from '../lib/toast';
import type { DailyReviewMap, FlashCard, StructuralSignalType } from '../types';
import { buildDailyReviewMap, recordStructuralSignalPatch } from '../services/canonical-knowledge.service';
import { questionService } from '../services/question.service';
import { graphService } from '../services/graph.service';

// ─── Library view ─────────────────────────────────────────────────────────────

const LibraryCard = memo(function LibraryCard({
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
    width: '44px',
    height: '44px',
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
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  border: '1.5px solid var(--danger)',
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
});

function ReviewMiniMap({ map }: { map: DailyReviewMap }) {
  const visibleRoots = useMemo(() => map.roots
    .map((root) => ({
      ...root,
      branches: root.branches
        .map((branch) => ({
          ...branch,
          clusters: branch.clusters
            .map((cluster) => ({
              ...cluster,
              leaves: cluster.leaves.filter((leaf) => leaf.state !== 'hidden'),
            }))
            .filter((cluster) => cluster.leaves.length > 0),
        }))
        .filter((branch) => branch.clusters.length > 0),
    }))
    .filter((root) => root.branches.length > 0), [map]);

  return (
    <div
      style={{
        marginTop: '18px',
        marginInline: '16px',
        padding: '16px 14px',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--card)',
        boxShadow: 'var(--shadow-1)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitBranch size={16} color="var(--primary-40)" />
          <p style={{ fontWeight: 700, fontSize: '0.92rem' }}>Today&apos;s Review Map</p>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
          {map.revealedCount} / {map.totalDue} revealed
        </span>
      </div>

      {visibleRoots.length === 0 ? (
        <p style={{ fontSize: '0.84rem', lineHeight: 1.55, color: 'var(--muted-foreground)' }}>
          Your mini map starts empty, then grows as each card becomes part of today&apos;s review path.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleRoots.map((root) => (
            <div key={root.id} style={{ paddingLeft: '4px' }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)' }}>{root.label}</p>
              {root.branches.map((branch) => (
                <div key={branch.id} style={{ marginTop: '6px', paddingLeft: '14px', borderLeft: '2px solid var(--surface-variant)' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-40)' }}>{branch.label}</p>
                  {branch.clusters.map((cluster) => (
                    <div key={cluster.id} style={{ marginTop: '6px', paddingLeft: '12px' }}>
                      <p style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', marginBottom: '4px' }}>{cluster.label}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {cluster.leaves.map((leaf) => (
                          <div
                            key={leaf.nodeId}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '12px',
                              backgroundColor: leaf.state === 'active'
                                ? 'color-mix(in srgb, var(--primary-40) 16%, var(--surface))'
                                : 'var(--surface-variant)',
                              border: `1px solid ${leaf.state === 'active' ? 'var(--primary-40)' : 'transparent'}`,
                              fontSize: '0.78rem',
                              color: 'var(--foreground)',
                            }}
                          >
                            {leaf.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ReviewScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, allCards, isLoading, submitReview, skipReview, togglePin, deleteCard } = useReview();

  // Extract move navigation context (when navigated from a suggested move)
  const moveState = parseMoveNavigationState(location.state);
  const linkedResource = moveState?.linkedResource;

  // Anchor review: when navigated from AnchorDetailScreen, filter to that anchor's Q&As
  const anchorReview = (location.state as { anchorReview?: { anchorId: string; qaIds: string[]; title: string } } | null)?.anchorReview;
  const anchorFilteredItems = anchorReview
    ? allCards.filter((card) => anchorReview.qaIds.some((qaId) => card.nodeId === qaId))
    : null;

  // Cluster review: when navigated from ClusterDetailScreen, filter to all Q&As across child anchors
  const clusterReview = (location.state as { clusterReview?: { clusterId: string; qaIds: string[]; title: string } } | null)?.clusterReview;
  const clusterFilteredItems = clusterReview
    ? allCards.filter((card) => clusterReview.qaIds.some((qaId) => card.nodeId === qaId))
    : null;

  // When coming from a move with conceptId, filter cards to show only that concept
  const moveFilteredItems = linkedResource?.type === 'review' && linkedResource.id
    ? items.filter((card) => card.nodeId === linkedResource.id)
    : null;

  // Priority: anchor review > cluster review > move review > all items
  const filteredItems = anchorFilteredItems ?? clusterFilteredItems ?? moveFilteredItems;

  // Use filtered items for review session if navigated from move and there are matches
  const reviewItems = filteredItems && filteredItems.length > 0 ? filteredItems : items;

  const [reviewed, setReviewed] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [done, setDone] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [revealedNodeIds, setRevealedNodeIds] = useState<string[]>([]);
  const [sessionCards, setSessionCards] = useState<FlashCard[]>([]);

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

  useEffect(() => {
    if (reviewItems.length > 0 && sessionCards.length === 0 && reviewed === 0) {
      setSessionCards(reviewItems);
    }
  }, [reviewItems, reviewed, sessionCards.length]);

  const total = reviewItems.length + reviewed;
  const progress = total > 0 ? (reviewed / total) * 100 : 0;
  const currentItem = reviewItems[0];
  const reviewMap = buildDailyReviewMap(
    sessionCards.length > 0 ? sessionCards : reviewItems,
    questionService.getAll(),
    revealedNodeIds,
    currentItem?.nodeId,
  );

  const handleSignal = (signal: StructuralSignalType) => {
    if (!currentItem?.nodeId) return;
    const question = questionService.getAll().find((candidate) => candidate.id === currentItem.nodeId);
    if (!question) return;
    questionService.patchQuestion(question.id, recordStructuralSignalPatch(question, signal));
    toast(
      signal === 'sameIdea'
        ? 'Saved: this card feels like the same idea.'
        : signal === 'connect'
          ? 'Saved: this card should stay connected.'
          : 'Saved: this feels like a deeper refinement.',
      'success',
    );
  };

  const handleRate = async (rating: number) => {
    if (!currentItem) return;
    await submitReview(currentItem.id, rating as 1 | 2 | 3 | 4 | 5);
    if (currentItem.nodeId) {
      setRevealedNodeIds((prev) => (prev.includes(currentItem.nodeId!) ? prev : [...prev, currentItem.nodeId!]));
      // Reinforce graph edges between this node and its related questions
      const question = questionService.getAll().find((q) => q.id === currentItem.nodeId);
      if (question) {
        for (const relatedId of question.relatedQuestionIds) {
          void graphService.reinforceEdge(question.id, relatedId);
        }
      }
    }
    setTotalRatings((prev) => prev + rating);
    const nextReviewed = reviewed + 1;
    setReviewed(nextReviewed);
    if (nextReviewed >= total || reviewItems.length <= 1) {
      setDone(true);
    }
  };

  const handleSkip = async () => {
    if (!currentItem) return;
    await skipReview(currentItem.id);
    if (currentItem.nodeId) {
      setRevealedNodeIds((prev) => (prev.includes(currentItem.nodeId!) ? prev : [...prev, currentItem.nodeId!]));
    }
    if (reviewItems.length <= 1) {
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
            style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
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
  if (done || reviewItems.length === 0) {
    const avgRating = reviewed > 0 ? (totalRatings / reviewed).toFixed(1) : '—';
    return (
      <div style={{ padding: '24px 16px 96px', maxWidth: '448px', margin: '0 auto' }}>
        <Confetti active={showConfetti} />
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center', marginBottom: '24px' }}
        >
          <ArrowLeft size={20} />
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

        </div>

        {/* All Flashcards button */}
        {allCards.length > 0 && (
          <button
            onClick={() => setShowLibrary(true)}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 'var(--radius-xl)',
              backgroundColor: 'var(--primary-40)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.9375rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <BookOpen size={18} />
            All Flashcards
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
        {/* Move breadcrumb — shown when navigated from a suggested move */}
        {moveState && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
            marginBottom: '8px',
            paddingLeft: '4px',
          }}>
            Suggested move: {moveState.move.title}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', padding: '12px', marginLeft: '-12px', color: 'var(--primary-40)', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
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

      {currentItem.placementReason && (
        <div style={{ padding: '0 16px' }}>
          <p style={{ fontSize: '0.8rem', lineHeight: 1.55, color: 'var(--muted-foreground)' }}>
            {currentItem.placementReason}
          </p>
        </div>
      )}

      <ReviewMiniMap map={reviewMap} />

      <div style={{ padding: '0 16px', marginTop: '14px' }}>
        <p style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Shape the map
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'sameIdea', label: 'Same idea' },
            { id: 'connect', label: 'Keep connected' },
            { id: 'refine', label: 'Feels deeper' },
          ].map((action) => (
            <button
              key={action.id}
              onClick={() => handleSignal(action.id as StructuralSignalType)}
              style={{
                padding: '8px 12px',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface-variant)',
                color: 'var(--foreground)',
                fontSize: '0.8rem',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--muted-foreground)', marginTop: '10px' }}>
          Review is also how you co-create the mindmap. As you rate cards and nudge these relationships, the graph learns how your knowledge fits together.
        </p>
      </div>

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
