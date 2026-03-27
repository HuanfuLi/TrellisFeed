/**
 * MoveCard component
 *
 * Displays an auto-generated Planner suggestion with:
 *  - Move type icon + label
 *  - Concept title
 *  - Relevance score as a visual bar + badge
 *  - Brief reason text
 *  - Time estimate (if available)
 *  - Accept and dismiss actions
 */

import { BookOpen, Zap, Link2, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlannedMove, PlannedMoveType } from '../types';
import { Card } from './ui/Card';
import { navigateToMove } from '../lib/moveNavigator';

// ── Move type display config ───────────────────────────────────────────────

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
  deepdive: {
    icon: <Zap size={14} />,
    label: 'Deep Dive',
    color: 'var(--node-sky)',
  },
  connection: {
    icon: <Link2 size={14} />,
    label: 'Connection',
    color: 'var(--node-lilac)',
  },
  podcast: {
    icon: <Mic size={14} />,
    label: 'Podcast',
    color: 'var(--node-peach)',
  },
};

// ── Score bar component ────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
    }}>
      <div style={{
        flex: 1, height: '4px', borderRadius: '999px',
        backgroundColor: 'var(--surface-variant)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${score}%`,
          backgroundColor: color,
          borderRadius: '999px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{
        fontSize: '0.7rem', fontWeight: 600,
        color: 'var(--muted-foreground)', minWidth: '28px', textAlign: 'right',
      }}>
        {score}
      </span>
    </div>
  );
}

// ── Time format helper ─────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const mins = Math.round(ms / 60000);
  return `~${mins} min`;
}

// ── MoveCard ───────────────────────────────────────────────────────────────

interface MoveCardProps {
  move: PlannedMove;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate?: (success: boolean) => void;
}

export function MoveCard({ move, onAccept, onDismiss, onNavigate }: MoveCardProps) {
  const config = MOVE_TYPE_CONFIG[move.moveType];
  const navigate = useNavigate();

  const handleAddClick = () => {
    // Call existing onAccept for planner state update
    onAccept(move.id);

    // Attempt navigation after state is queued
    // Use setTimeout to allow state update to flush first
    setTimeout(() => {
      void navigateToMove(move, navigate, {
        fromScreen: 'planner',
        replace: false,
      }).then((success) => {
        onNavigate?.(success);
      });
    }, 50);
  };

  return (
    <Card style={{
      borderLeft: `3px solid ${config.color}`,
      padding: '14px 16px',
      marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
            <span style={{ color: config.color, display: 'flex' }}>{config.icon}</span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--muted-foreground)',
            }}>
              {config.label}
            </span>
            {move.targetTime && (
              <span style={{
                fontSize: '0.67rem', color: 'var(--muted-foreground)',
                marginLeft: '2px',
              }}>
                {formatTime(move.targetTime)}
              </span>
            )}
          </div>

          {/* Title */}
          <p style={{
            fontSize: '0.92rem', lineHeight: 1.45, color: 'var(--foreground)',
            fontWeight: 500, marginBottom: '5px',
          }}>
            {move.title}
          </p>

          {/* Reason */}
          <p style={{
            fontSize: '0.8rem', color: 'var(--muted-foreground)',
            lineHeight: 1.4, marginBottom: '8px',
          }}>
            {move.reason}
          </p>

          {/* Relevance score bar */}
          <ScoreBar score={move.relevanceScore} color={config.color} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={handleAddClick}
            title="Add to Planner"
            className="active-squish"
            style={{
              padding: '5px 10px', borderRadius: '10px', fontSize: '0.75rem',
              fontWeight: 600, backgroundColor: config.color, color: 'white',
              border: 'none', whiteSpace: 'nowrap',
            }}
          >
            Add
          </button>
          <button
            onClick={() => onDismiss(move.id)}
            title="Dismiss"
            className="active-squish"
            style={{
              padding: '5px 10px', borderRadius: '10px', fontSize: '0.75rem',
              fontWeight: 500, backgroundColor: 'var(--surface-variant)',
              color: 'var(--muted-foreground)', border: '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </Card>
  );
}
