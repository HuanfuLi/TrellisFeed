/**
 * PortalCard component
 *
 * Displays a topic portal card with:
 *  - Topic name and description
 *  - Primary CTA button using moveNavigator
 *  - Skip action
 *
 * Phase 20: Orchestration Strategy & Diagnostic Dialogue
 */

import { BookOpen, FileText, HelpCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlannedMove, PlannedMoveType } from '../types';
import { navigateToMove } from '../lib/moveNavigator';

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

export function buildPortalData(
  conceptId: string,
  title: string,
  reason: string,
): Omit<PortalCardData, 'move' | 'primaryAction'> {
  return {
    conceptId,
    title,
    description: reason,
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
      {/* Top row: icon + type badge */}
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
