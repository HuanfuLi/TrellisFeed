import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LeafState } from '../../services/trellis-state.service.ts';
import { Card } from '../ui/Card.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';

// Exported for unit test
export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural ?? singular + 's'}`;
}

export function resolveHealthCopy(state: LeafState, overdueCount: number, daysInBlossom: number): string {
  switch (state) {
    case 'green': return 'On track — keep going';
    case 'yellow': return `Due soon — ${pluralize(overdueCount, 'card')} need a quick review`;
    case 'falling': return `Slipping — ${pluralize(overdueCount, 'card')} overdue by a week`;
    case 'fallen': return `Needs attention — ${pluralize(overdueCount, 'card')} long overdue`;
    case 'blossom': return 'Mastered — beautifully done';
    case 'fruit': return `Sustained mastery — ${pluralize(daysInBlossom, 'day')} strong`;
    case 'bud': return 'Newly planted';
  }
}

export const STATE_BADGE_COLOR: Record<LeafState, 'green' | 'yellow' | 'red' | 'gray'> = {
  bud: 'gray',
  green: 'green',
  yellow: 'yellow',
  falling: 'yellow',
  fallen: 'red',
  blossom: 'green',
  fruit: 'green',
};

export interface TrellisTooltipProps {
  anchorId: string;
  anchorName: string;
  state: LeafState;
  qaCount: number;
  reviewedCount: number;
  overdueCount: number;
  daysInBlossom: number;
  x: number; // hero-local coords
  y: number;
  heroWidth: number;
  heroHeight: number;
  onClose: () => void;
}

const TOOLTIP_WIDTH = 240;
const TOOLTIP_HEIGHT_EST = 140;

export function TrellisTooltip(props: TrellisTooltipProps) {
  const { anchorId, anchorName, state, qaCount, reviewedCount, overdueCount, daysInBlossom, x, y, heroWidth, heroHeight, onClose } = props;
  const navigate = useNavigate();

  // Clamp x: center tooltip on leaf, but keep inside hero
  const left = Math.min(Math.max(8, x - TOOLTIP_WIDTH / 2), heroWidth - TOOLTIP_WIDTH - 8);
  // Flip above/below leaf depending on space
  const top = y + TOOLTIP_HEIGHT_EST + 8 > heroHeight ? Math.max(8, y - TOOLTIP_HEIGHT_EST - 8) : y + 12;

  return (
    <Card
      style={{
        position: 'absolute',
        zIndex: 50,
        left, top,
        width: TOOLTIP_WIDTH,
        pointerEvents: 'auto',
      }}
      padding="12px 14px"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.3 }}>{anchorName}</div>
        <button onClick={onClose} aria-label="Close tooltip" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted-foreground)' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ marginTop: 6 }}>
        <Badge color={STATE_BADGE_COLOR[state]}>{resolveHealthCopy(state, overdueCount, daysInBlossom)}</Badge>
      </div>
      <div style={{ fontSize: '0.875rem', marginTop: 6, color: 'var(--muted-foreground)' }}>
        {reviewedCount} / {qaCount} reviewed · {overdueCount} overdue
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Button size="sm" variant="primary" onClick={() => navigate('/review', { state: { anchorReview: { anchorId, anchorName } } })}>Review</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/anchor/${anchorId}`)}>View Q&As</Button>
      </div>
    </Card>
  );
}
