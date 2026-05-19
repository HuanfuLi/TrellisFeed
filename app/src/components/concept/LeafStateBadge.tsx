// Phase 51-01: small leaf-state pill for AnchorDetailScreen.
//
// Renders a colored pill with a dot + i18n label for each of the 7 LeafStates.
// Kept presentational and stateless — color/label decisions live in this file,
// no module-level config-table sibling per operator's "thin enrichment" framing.
//
// Tile feeds use a different (binary amber dot) signal — see InfoFlow.tsx
// getBadgeLeafState. This component is the rich, anchor-detail-only variant.
//
// Style follows project convention: inline styles + CSS variables (no Tailwind),
// pill borderRadius 100px, fontWeight 600.

import { useTranslation } from 'react-i18next';
import type { LeafState } from '../../services/trellis-state.service';

interface LeafStateBadgeProps {
  leafState: LeafState | null | undefined;
  size?: 'sm' | 'md';
}

interface StateVisual {
  dotColor: string;
  bgColor: string;
  textColor: string;
  i18nKey: string;
}

function visualFor(state: LeafState): StateVisual {
  switch (state) {
    case 'bud':
      // Fresh / new — same mint family as Trellis bud icon, soft tint.
      return {
        dotColor: '#9be7c4',
        bgColor: 'rgba(155, 231, 196, 0.18)',
        textColor: 'var(--foreground)',
        i18nKey: 'graph.anchor.leafState.bud',
      };
    case 'green':
      return {
        dotColor: '#22c55e',
        bgColor: 'rgba(34, 197, 94, 0.16)',
        textColor: 'var(--foreground)',
        i18nKey: 'graph.anchor.leafState.green',
      };
    case 'dying':
      return {
        dotColor: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.18)',
        textColor: 'var(--foreground)',
        i18nKey: 'graph.anchor.leafState.dying',
      };
    case 'falling':
      return {
        dotColor: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.18)',
        textColor: 'var(--foreground)',
        i18nKey: 'graph.anchor.leafState.falling',
      };
    case 'dead':
      return {
        dotColor: 'var(--muted-foreground)',
        bgColor: 'var(--surface-variant)',
        textColor: 'var(--muted-foreground)',
        i18nKey: 'graph.anchor.leafState.dead',
      };
    case 'blossom':
      return {
        dotColor: '#a855f7',
        bgColor: 'rgba(168, 85, 247, 0.18)',
        textColor: 'var(--foreground)',
        i18nKey: 'graph.anchor.leafState.blossom',
      };
    case 'fruit':
      return {
        dotColor: '#eab308',
        bgColor: 'rgba(234, 179, 8, 0.20)',
        textColor: 'var(--foreground)',
        i18nKey: 'graph.anchor.leafState.fruit',
      };
  }
}

export function LeafStateBadge({ leafState, size = 'md' }: LeafStateBadgeProps) {
  const { t } = useTranslation();
  if (!leafState) return null;
  const v = visualFor(leafState);
  const padding = size === 'sm' ? '3px 10px' : '4px 12px';
  const fontSize = size === 'sm' ? '0.7rem' : '0.75rem';
  const dotSize = size === 'sm' ? '6px' : '8px';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding,
        borderRadius: '100px',
        backgroundColor: v.bgColor,
        color: v.textColor,
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: v.dotColor,
          display: 'inline-block',
        }}
      />
      {t(v.i18nKey as 'graph.anchor.leafState.bud')}
    </span>
  );
}
