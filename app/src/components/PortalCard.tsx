/**
 * PortalCard component
 *
 * Displays a topic portal card with:
 *  - Topic name and description
 *  - Three tappable content type indicators (Flashcards / Posts / Questions)
 *  - Primary CTA button using moveNavigator
 *  - Skip action
 *
 * Replaces flat MoveCard / ChunkCard suggestions in PlannerScreen.
 * Phase 20: Orchestration Strategy & Diagnostic Dialogue
 */

import { BookOpen, FileText, HelpCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlannedMove, PlannedMoveType } from '../types';
import { navigateToMove } from '../lib/moveNavigator';
import { flashcardService } from '../services/flashcard.service';
import { questionService } from '../services/question.service';

// ── Move type display config (reused from MoveCard) ─────────────────────────

const MOVE_TYPE_CONFIG: Record<PlannedMoveType, {
  icon: React.ReactNode;
  label: string;
  color: string;
}> = {
  review: {
    icon: <BookOpen size={14} />,
    label: 'Review',
    color: 'var(--node-mint)',
  },
  read: {
    icon: <FileText size={14} />,
    label: 'Read',
    color: 'var(--node-sky)',
  },
  compare: {
    icon: <HelpCircle size={14} />,
    label: 'Compare',
    color: 'var(--node-lilac)',
  },
  podcast: {
    icon: <ChevronRight size={14} />,
    label: 'Podcast',
    color: 'var(--node-peach)',
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface PortalCardData {
  conceptId: string;
  title: string;
  description: string;
  relatedPosts: number;
  relatedFlashcards: number;
  relatedQuestions: number;
  primaryAction: PlannedMoveType;
  move: PlannedMove;
}

interface PortalCardProps {
  data: PortalCardData;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate: (move: PlannedMove) => void;
}

// ── buildPortalData helper ───────────────────────────────────────────────────

/**
 * Aggregates content counts for a given concept from flashcards, questions,
 * and daily posts (localStorage). Returns a PortalCardData object without
 * move or primaryAction set (caller must attach these).
 */
export function buildPortalData(
  conceptId: string,
  title: string,
  reason: string,
): Omit<PortalCardData, 'move' | 'primaryAction'> {
  // Count flashcards linked to this concept
  const relatedFlashcards = flashcardService.getAll().filter(
    (c) => c.nodeId === conceptId,
  ).length;

  // Count questions that match this concept directly or via relatedQuestionIds
  const relatedQuestions = questionService.getAll().filter(
    (q) => q.id === conceptId || (q.relatedQuestionIds && q.relatedQuestionIds.includes(conceptId)),
  ).length;

  // Count daily posts from localStorage (avoid importing conceptFeedService to prevent circular deps)
  let relatedPosts = 0;
  try {
    const raw = localStorage.getItem('echolearn_daily_posts');
    if (raw) {
      const posts = JSON.parse(raw) as Array<{ sourceQuestionIds?: string[] }>;
      relatedPosts = posts.filter(
        (p) => p.sourceQuestionIds && p.sourceQuestionIds.includes(conceptId),
      ).length;
    }
  } catch {
    relatedPosts = 0;
  }

  return {
    conceptId,
    title,
    description: reason,
    relatedPosts,
    relatedFlashcards,
    relatedQuestions,
  };
}

// ── PortalCard component ─────────────────────────────────────────────────────

export function PortalCard({ data, onAccept, onDismiss, onNavigate }: PortalCardProps) {
  const navigate = useNavigate();
  const config = MOVE_TYPE_CONFIG[data.primaryAction] ?? MOVE_TYPE_CONFIG.review;

  const handlePrimaryCTA = () => {
    void navigateToMove(data.move, navigate, {
      fromScreen: 'planner',
      replace: false,
    }).then((success) => {
      onNavigate(data.move);
      if (!success) {
        // Fallback: accept the move into planner
        onAccept(data.move.id);
      }
    });
  };

  const handleFlashcardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/review', { state: { nodeId: data.conceptId, fromScreen: 'planner' } });
  };

  const handlePostClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to closest post for this concept
    try {
      const raw = localStorage.getItem('echolearn_daily_posts');
      if (raw) {
        const posts = JSON.parse(raw) as Array<{ id: string; sourceQuestionIds?: string[] }>;
        const match = posts.find((p) => p.sourceQuestionIds?.includes(data.conceptId));
        if (match) {
          navigate(`/posts/${match.id}`);
          return;
        }
      }
    } catch { /* fallback below */ }
    navigate('/home');
  };

  const handleQuestionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/ask/${data.conceptId}`);
  };

  return (
    <div
      style={{
        borderLeft: `4px solid ${config.color}`,
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-1)',
        background: 'var(--surface)',
        padding: '16px',
        marginBottom: '10px',
      }}
    >
      {/* Top row: icon + title + type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ color: config.color, display: 'flex' }}>{config.icon}</span>
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--muted-foreground)',
        }}>
          {config.label}
        </span>
      </div>

      {/* Title */}
      <p style={{
        fontSize: '0.92rem', lineHeight: 1.45, color: 'var(--foreground)',
        fontWeight: 500, marginBottom: '4px',
      }}>
        {data.title}
      </p>

      {/* Description */}
      <p style={{
        fontSize: '0.8rem', color: 'var(--muted-foreground)',
        lineHeight: 1.4, marginBottom: '12px',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {data.description}
      </p>

      {/* Content type indicators */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <button
          onClick={handleFlashcardClick}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: '8px',
            backgroundColor: data.relatedFlashcards > 0
              ? 'color-mix(in srgb, var(--node-mint) 15%, transparent)'
              : 'var(--surface-variant)',
            border: 'none', cursor: 'pointer',
            color: 'var(--foreground)', fontSize: '0.75rem',
          }}
        >
          <BookOpen size={14} color="var(--node-mint)" />
          <span style={{ fontWeight: 500 }}>{data.relatedFlashcards}</span>
        </button>

        <button
          onClick={handlePostClick}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: '8px',
            backgroundColor: data.relatedPosts > 0
              ? 'color-mix(in srgb, var(--node-sky) 15%, transparent)'
              : 'var(--surface-variant)',
            border: 'none', cursor: 'pointer',
            color: 'var(--foreground)', fontSize: '0.75rem',
          }}
        >
          <FileText size={14} color="var(--node-sky)" />
          <span style={{ fontWeight: 500 }}>{data.relatedPosts}</span>
        </button>

        <button
          onClick={handleQuestionClick}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: '8px',
            backgroundColor: data.relatedQuestions > 0
              ? 'color-mix(in srgb, var(--node-lilac) 15%, transparent)'
              : 'var(--surface-variant)',
            border: 'none', cursor: 'pointer',
            color: 'var(--foreground)', fontSize: '0.75rem',
          }}
        >
          <HelpCircle size={14} color="var(--node-lilac)" />
          <span style={{ fontWeight: 500 }}>{data.relatedQuestions}</span>
        </button>
      </div>

      {/* Bottom row: CTA + Skip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handlePrimaryCTA}
          className="active-squish"
          style={{
            flex: 1, padding: '9px 16px', borderRadius: '12px',
            border: 'none', backgroundColor: 'var(--primary-40)', color: 'white',
            fontSize: '0.82rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            cursor: 'pointer',
          }}
        >
          {config.label}
          <ChevronRight size={14} />
        </button>
        <button
          onClick={() => onDismiss(data.move.id)}
          className="active-squish"
          style={{
            padding: '9px 16px', borderRadius: '12px',
            backgroundColor: 'var(--surface-variant)',
            color: 'var(--muted-foreground)', border: '1px solid var(--border)',
            fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
