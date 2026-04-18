import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Clock } from 'lucide-react';

interface VineProgressProps {
  mode: 'inline' | 'compact';
  explored: number;
  total: number;
  isComplete: boolean;
  concepts: Array<{ id: string; name: string; explored: boolean }>;
  onConceptTap?: (conceptId: string) => void;
  onHistoryTap?: () => void;
}

// Small leaf path at a given x position along the stem
function Leaf({ x, y, flip, opacity }: { x: number; y: number; flip?: boolean; opacity: number }) {
  const scaleX = flip ? -1 : 1;
  return (
    <path
      d={`M0,0 C2,-6 6,-10 8,-12 C6,-8 4,-4 0,0`}
      transform={`translate(${x}, ${y}) scale(${scaleX}, 1)`}
      fill="var(--primary-40)"
      opacity={opacity}
    />
  );
}

// Flower circle at a concept milestone position
function Flower({ cx, cy, explored, isGold }: { cx: number; cy: number; explored: boolean; isGold: boolean }) {
  const fill = isGold ? '#E8A838' : explored ? 'var(--primary-40)' : 'var(--muted-foreground)';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      opacity={explored ? 1 : 0.4}
      style={isGold ? {
        animation: 'vine-bloom 600ms ease-in-out infinite alternate',
      } : undefined}
    />
  );
}

// Fruit icon (small golden circle with stem)
function Fruit({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <line x1={cx} y1={cy - 6} x2={cx} y2={cy - 9} stroke="#8B6914" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#E8A838" />
      <circle cx={cx - 1.5} cy={cy - 1.5} r={1.5} fill="#F0C060" opacity={0.6} />
    </g>
  );
}

export function VineProgress({
  mode,
  explored,
  total,
  isComplete,
  concepts,
  onConceptTap,
  onHistoryTap,
}: VineProgressProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hidden state (D-07): return null when no concepts due
  if (total === 0) return null;

  // Click-away collapse
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!expanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [expanded]);

  const svgHeight = mode === 'inline' ? 48 : 36;
  const stemY = svgHeight / 2;
  const potWidth = 24;
  const rightPad = 24; // space for chevron
  // Available width for vine stem — will be set via SVG viewBox stretching
  const svgWidth = 300; // nominal; will be scaled by container
  const availableWidth = svgWidth - potWidth - rightPad;
  const stemLength = total > 0 ? (explored / total) * availableWidth : 0;
  const stemColor = isComplete ? '#E8A838' : 'var(--primary-40)';

  // Compute flower positions evenly distributed along the full vine path
  const flowerPositions = concepts.map((_, i) => {
    const segment = availableWidth / Math.max(concepts.length, 1);
    return potWidth + segment * (i + 0.5);
  });

  // Generate leaves along the grown stem
  const leafCount = Math.max(Math.floor(stemLength / 20), 0);
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const x = potWidth + ((i + 1) / (leafCount + 1)) * stemLength;
    const flip = i % 2 === 1;
    const yOff = flip ? stemY + 2 : stemY - 2;
    return { x, y: yOff, flip, key: i };
  });

  const toggleExpand = useCallback(() => setExpanded(prev => !prev), []);

  const ariaLabel = isComplete
    ? t('home.feed.vineComplete')
    : t('home.feed.vineProgress', { explored, total });

  const containerStyle: React.CSSProperties = mode === 'inline'
    ? {
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-1)',
        padding: '16px',
        position: 'relative',
      }
    : {
        background: 'var(--card)',
        boxShadow: 'var(--shadow-1)',
        padding: '12px 16px',
        position: 'relative',
      };

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* History icon — inline mode only (D-37) */}
      {mode === 'inline' && onHistoryTap && (
        <button
          onClick={onHistoryTap}
          aria-label={t('home.history.iconLabel')}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Clock size={20} color="var(--muted-foreground)" />
        </button>
      )}

      {/* Vine SVG — tappable to toggle checklist */}
      <div
        role="progressbar"
        aria-valuenow={explored}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={ariaLabel}
        onClick={toggleExpand}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          style={{ flex: 1 }}
          aria-hidden="true"
        >
          {/* Potted plant — left anchor */}
          <rect x={4} y={stemY + 2} width={14} height={12} rx={2} fill="var(--muted-foreground)" opacity={0.5} />
          <polygon points={`5,${stemY + 2} 11,${stemY - 10} 17,${stemY + 2}`} fill={isComplete ? '#E8A838' : 'var(--primary-40)'} opacity={0.8} />

          {/* Full vine path (ghosted) */}
          <line
            x1={potWidth}
            y1={stemY}
            x2={potWidth + availableWidth}
            y2={stemY}
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            opacity={0.15}
            strokeLinecap="round"
          />

          {/* Grown vine stem */}
          {stemLength > 0 && (
            <line
              x1={potWidth}
              y1={stemY}
              x2={potWidth + stemLength}
              y2={stemY}
              stroke={stemColor}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )}

          {/* Leaves along grown stem */}
          {leaves.map(l => (
            <Leaf key={l.key} x={l.x} y={l.y} flip={l.flip} opacity={0.6} />
          ))}

          {/* Flowers at concept positions */}
          {concepts.map((concept, i) => (
            <Flower
              key={concept.id}
              cx={flowerPositions[i]}
              cy={stemY}
              explored={concept.explored}
              isGold={isComplete}
            />
          ))}

          {/* Fruit icons when complete */}
          {isComplete && concepts.filter(c => c.explored).slice(0, 3).map((_, i) => (
            <Fruit
              key={`fruit-${i}`}
              cx={potWidth + availableWidth * ((i + 1) / 4)}
              cy={stemY - 14}
            />
          ))}

          <style>{`
            @keyframes vine-bloom {
              from { transform: scale(1); }
              to { transform: scale(1.3); }
            }
          `}</style>
        </svg>

        {/* Chevron expand indicator */}
        <ChevronDown
          size={16}
          color="var(--muted-foreground)"
          style={{
            transform: `rotate(${expanded ? 180 : 0}deg)`,
            transition: 'transform 200ms ease-out',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Concept checklist (expanded state, D-03/D-04) */}
      <div
        style={{
          maxHeight: expanded ? '216px' : '0',
          overflow: 'hidden',
          transition: 'max-height 200ms ease-out',
        }}
      >
        <div
          role="list"
          style={{
            marginTop: '8px',
            overflowY: 'auto',
            maxHeight: '216px',
          }}
        >
          {concepts.map(concept => (
            <div
              key={concept.id}
              role="listitem"
              aria-disabled={concept.explored || undefined}
              onClick={concept.explored ? undefined : () => onConceptTap?.(concept.id)}
              style={{
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '8px',
                paddingRight: '8px',
                cursor: concept.explored ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                textDecoration: concept.explored ? 'line-through' : 'none',
                color: concept.explored ? 'var(--muted-foreground)' : 'var(--foreground)',
              }}
            >
              {concept.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
