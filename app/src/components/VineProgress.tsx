import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Clock, Check } from 'lucide-react';

interface VineProgressProps {
  mode: 'inline' | 'compact';
  explored: number;
  total: number;
  isComplete: boolean;
  concepts: Array<{ id: string; name: string; explored: boolean }>;
  onConceptTap?: (conceptId: string) => void;
  onHistoryTap?: () => void;
}

function PottedPlant({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Pot */}
      <path d="M-7,2 L-5,10 L5,10 L7,2 Z" fill="#A1887F" />
      <rect x={-8} y={0} width={16} height={3} rx={1} fill="#8D6E63" />
      {/* Plant in pot */}
      <path d="M0,0 C-2,-4 -6,-6 -4,-10 C-2,-8 0,-6 0,-4 C0,-6 2,-8 4,-10 C6,-6 2,-4 0,0" fill={color} />
    </g>
  );
}

function VineLeaf({ x, y, size, flip, color }: { x: number; y: number; size: number; flip: boolean; color: string }) {
  const s = size;
  const scaleY = flip ? -1 : 1;
  return (
    <g transform={`translate(${x}, ${y}) scale(1, ${scaleY})`}>
      <path
        d={`M0,0 C${s * 0.3},-${s * 0.8} ${s * 0.8},-${s} ${s},${-s * 0.4} C${s * 0.6},-${s * 0.2} ${s * 0.3},0 0,0`}
        fill={color}
        opacity={0.85}
      />
      <line x1={0} y1={0} x2={size * 0.7} y2={-size * 0.5} stroke={color} strokeWidth={0.5} opacity={0.5} />
    </g>
  );
}

function VineFlower({ cx, cy, explored, isGold, size }: { cx: number; cy: number; explored: boolean; isGold: boolean; size: number }) {
  if (!explored && !isGold) {
    return <circle cx={cx} cy={cy} r={size * 0.4} fill="var(--muted-foreground)" opacity={0.25} />;
  }
  const petalColor = isGold ? '#E8A838' : '#F48FB1';
  const centerColor = isGold ? '#FFF176' : '#FFE082';
  const petals = 5;
  const petalR = size * 0.45;
  return (
    <g>
      {Array.from({ length: petals }, (_, i) => {
        const angle = (i * 2 * Math.PI) / petals - Math.PI / 2;
        const px = cx + Math.cos(angle) * petalR;
        const py = cy + Math.sin(angle) * petalR;
        return <circle key={i} cx={px} cy={py} r={size * 0.3} fill={petalColor} opacity={0.8} />;
      })}
      <circle cx={cx} cy={cy} r={size * 0.25} fill={centerColor} />
    </g>
  );
}

function VineFruit({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <line x1={cx} y1={cy - 7} x2={cx} y2={cy - 11} stroke="#6D4C41" strokeWidth={1.2} strokeLinecap="round" />
      <ellipse cx={cx} cy={cy - 3} rx={5} ry={6} fill="#E8A838" />
      <ellipse cx={cx - 1} cy={cy - 5} rx={1.5} ry={2} fill="#F0C060" opacity={0.5} />
      <path d={`M${cx - 1},${cy - 11} C${cx - 3},${cy - 14} ${cx + 1},${cy - 15} ${cx + 3},${cy - 12}`} fill="#66BB6A" opacity={0.7} />
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

  const conceptTotal = concepts.length;
  const conceptExplored = concepts.filter(c => c.explored).length;

  if (conceptTotal === 0) return null;

  const svgHeight = mode === 'inline' ? 52 : 40;
  const stemY = svgHeight * 0.6;
  const potX = 16;
  const rightPad = 8;
  const svgWidth = 300;
  const availableWidth = svgWidth - potX - 12 - rightPad;
  const progress = conceptTotal > 0 ? conceptExplored / conceptTotal : 0;
  const stemLength = progress * availableWidth;
  const vineComplete = conceptTotal > 0 && conceptExplored >= conceptTotal;

  const vineColor = vineComplete ? '#66BB6A' : 'var(--primary-40)';
  const stemColor = vineComplete ? '#E8A838' : '#4CAF50';

  const flowerPositions = concepts.map((_, i) => {
    const segment = availableWidth / Math.max(concepts.length, 1);
    return potX + 12 + segment * (i + 0.5);
  });

  const leafCount = Math.max(Math.floor(stemLength / 18), 0);
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const x = potX + 12 + ((i + 1) / (leafCount + 1)) * stemLength;
    const flip = i % 2 === 1;
    const leafSize = 5 + (((i * 7 + 3) % 5) / 5) * 3;
    return { x, y: stemY, flip, size: leafSize, key: i };
  });

  const toggleExpand = useCallback(() => setExpanded(prev => !prev), []);

  const ariaLabel = vineComplete
    ? t('home.feed.vineComplete')
    : t('home.feed.vineProgress', { explored: conceptExplored, total: conceptTotal });

  const uncoveredConcepts = concepts.filter(c => !c.explored);

  const containerStyle: React.CSSProperties = mode === 'inline'
    ? {
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-1)',
        padding: '12px 16px',
        position: 'relative',
        marginTop: '16px',
        marginBottom: '16px',
      }
    : {
        background: 'var(--surface)',
        padding: '8px 16px',
        position: 'relative',
      };

  return (
    <div ref={containerRef} style={containerStyle}>
      <div
        role="progressbar"
        aria-valuenow={conceptExplored}
        aria-valuemin={0}
        aria-valuemax={conceptTotal}
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
          preserveAspectRatio="xMidYMid meet"
        >
          <PottedPlant x={potX} y={stemY} color={vineColor} />

          {/* Ghost stem — full path */}
          <path
            d={`M${potX + 12},${stemY} Q${potX + 12 + availableWidth * 0.3},${stemY - 4} ${potX + 12 + availableWidth * 0.5},${stemY} T${potX + 12 + availableWidth},${stemY}`}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            opacity={0.12}
            strokeLinecap="round"
          />

          {/* Grown vine — organic curve */}
          {stemLength > 0 && (
            <path
              d={`M${potX + 12},${stemY} Q${potX + 12 + stemLength * 0.3},${stemY - 3} ${potX + 12 + stemLength * 0.5},${stemY} T${potX + 12 + stemLength},${stemY}`}
              fill="none"
              stroke={stemColor}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          )}

          {/* Leaves along grown stem */}
          {leaves.map(l => (
            <VineLeaf key={l.key} x={l.x} y={l.y} size={l.size} flip={l.flip} color={vineColor} />
          ))}

          {/* Flowers at concept positions */}
          {concepts.map((concept, i) => (
            <VineFlower
              key={concept.id}
              cx={flowerPositions[i]}
              cy={stemY}
              explored={concept.explored}
              isGold={vineComplete}
              size={mode === 'inline' ? 8 : 6}
            />
          ))}

          {/* Fruit when complete */}
          {vineComplete && flowerPositions.filter((_, i) => i < 3).map((fx, i) => (
            <VineFruit key={`fruit-${i}`} cx={fx} cy={stemY - 14} />
          ))}
        </svg>

        {/* Right-side icons: history + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {mode === 'inline' && onHistoryTap && (
            <button
              onClick={(e) => { e.stopPropagation(); onHistoryTap(); }}
              aria-label={t('home.history.iconLabel')}
              role="button"
              tabIndex={0}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={16} color="var(--muted-foreground)" />
            </button>
          )}
          <ChevronDown
            size={14}
            color="var(--muted-foreground)"
            style={{
              transform: `rotate(${expanded ? 180 : 0}deg)`,
              transition: 'transform 200ms ease-out',
            }}
          />
        </div>
      </div>

      {/* Concept checklist — shows uncovered concepts only (D-09) */}
      <div
        role="list"
        style={{
          maxHeight: expanded ? '200px' : '0',
          overflowY: expanded ? 'auto' : 'hidden',
          transition: 'max-height 200ms ease-out',
          borderTop: expanded ? '1px solid var(--border)' : 'none',
          marginTop: expanded ? '8px' : '0',
          paddingTop: expanded ? '4px' : '0',
        }}
      >
          {uncoveredConcepts.length === 0 && (
            <div style={{
              padding: '8px',
              fontSize: '13px',
              color: 'var(--muted-foreground)',
              textAlign: 'center',
            }}>
              {t('home.feed.allExplored')}
            </div>
          )}
          {uncoveredConcepts.map(concept => (
            <div
              key={concept.id}
              role="listitem"
              onClick={() => onConceptTap?.(concept.id)}
              style={{
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingLeft: '8px',
                paddingRight: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--foreground)',
                borderRadius: '6px',
              }}
            >
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-40)',
                flexShrink: 0,
              }} />
              {concept.name}
            </div>
          ))}
      </div>
    </div>
  );
}
