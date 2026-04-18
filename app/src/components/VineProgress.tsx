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

function PottedPlant({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d="M-8,2 L-6,12 L6,12 L8,2 Z" fill="#A1887F" />
      <rect x={-9} y={-1} width={18} height={4} rx={1.5} fill="#8D6E63" />
      <path d="M0,-1 C-3,-6 -7,-8 -5,-13 C-3,-10 0,-8 0,-5 C0,-8 3,-10 5,-13 C7,-8 3,-6 0,-1" fill={color} />
      <line x1={0} y1={-1} x2={0} y2={-5} stroke={color} strokeWidth={1} opacity={0.6} />
    </g>
  );
}

function VineLeaf({ x, y, size, flip, color }: { x: number; y: number; size: number; flip: boolean; color: string }) {
  const scaleY = flip ? -1 : 1;
  return (
    <g transform={`translate(${x}, ${y}) scale(1, ${scaleY})`}>
      <ellipse cx={size * 0.5} cy={-size * 0.45} rx={size * 0.5} ry={size * 0.35} fill={color} opacity={0.8} />
      <line x1={0} y1={0} x2={size * 0.5} y2={-size * 0.45} stroke={color} strokeWidth={0.8} opacity={0.5} />
    </g>
  );
}

function VineBud({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="var(--muted-foreground)" opacity={0.2} />
      <circle cx={cx} cy={cy} r={1.8} fill="var(--muted-foreground)" opacity={0.12} />
    </g>
  );
}

function VineFlower({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const petals = 5;
  const petalR = size * 0.5;
  return (
    <g>
      {Array.from({ length: petals }, (_, i) => {
        const angle = (i * 2 * Math.PI) / petals - Math.PI / 2;
        const px = cx + Math.cos(angle) * petalR;
        const py = cy + Math.sin(angle) * petalR;
        return <ellipse key={i} cx={px} cy={py} rx={size * 0.32} ry={size * 0.28} fill="#F48FB1" opacity={0.75}
          transform={`rotate(${(angle * 180) / Math.PI}, ${px}, ${py})`} />;
      })}
      <circle cx={cx} cy={cy} r={size * 0.22} fill="#FFE082" />
    </g>
  );
}

function VineFruit({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <line x1={cx} y1={cy - 5} x2={cx + 1} y2={cy - 9} stroke="#6D4C41" strokeWidth={1.5} strokeLinecap="round" />
      <ellipse cx={cx} cy={cy} rx={5.5} ry={7} fill="#E8A838" />
      <ellipse cx={cx - 1.5} cy={cy - 2} rx={2} ry={2.5} fill="#F0C060" opacity={0.4} />
      <ellipse cx={cx + 2} cy={cy + 2} rx={1.2} ry={1.5} fill="#D4931A" opacity={0.3} />
      <path d={`M${cx},${cy - 9} C${cx - 3},${cy - 13} ${cx + 1},${cy - 14} ${cx + 4},${cy - 11}`} fill="#66BB6A" strokeWidth={0} />
    </g>
  );
}

function GoldFlower({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const petals = 6;
  const petalR = size * 0.5;
  return (
    <g>
      {Array.from({ length: petals }, (_, i) => {
        const angle = (i * 2 * Math.PI) / petals - Math.PI / 2;
        const px = cx + Math.cos(angle) * petalR;
        const py = cy + Math.sin(angle) * petalR;
        return <ellipse key={i} cx={px} cy={py} rx={size * 0.3} ry={size * 0.25} fill="#E8A838" opacity={0.8}
          transform={`rotate(${(angle * 180) / Math.PI}, ${px}, ${py})`} />;
      })}
      <circle cx={cx} cy={cy} r={size * 0.2} fill="#FFF176" />
    </g>
  );
}

function buildWavyStemPath(startX: number, endX: number, baseY: number, amplitude: number): string {
  if (endX <= startX) return '';
  const len = endX - startX;
  const segments = Math.max(Math.round(len / 40), 2);
  const segLen = len / segments;
  let d = `M${startX},${baseY}`;
  for (let i = 0; i < segments; i++) {
    const x0 = startX + i * segLen;
    const x1 = startX + (i + 1) * segLen;
    const cpY = baseY + (i % 2 === 0 ? -amplitude : amplitude);
    const cx1 = x0 + segLen * 0.4;
    const cx2 = x1 - segLen * 0.4;
    d += ` C${cx1},${cpY} ${cx2},${cpY} ${x1},${baseY}`;
  }
  return d;
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

  const isInline = mode === 'inline';
  const svgHeight = isInline ? 56 : 44;
  const stemY = svgHeight * 0.58;
  const potX = 18;
  const stemStart = potX + 14;
  const rightPad = 4;
  const svgWidth = 300;
  const availableWidth = svgWidth - stemStart - rightPad;
  const vineComplete = conceptTotal > 0 && conceptExplored >= conceptTotal;

  const flowerPositions = concepts.map((_, i) => {
    const segment = availableWidth / (concepts.length + 1);
    return stemStart + segment * (i + 1);
  });

  const lastFlowerX = flowerPositions[flowerPositions.length - 1] ?? stemStart;
  const stemEndX = vineComplete ? lastFlowerX + 8 : stemStart + (conceptExplored / conceptTotal) * (lastFlowerX - stemStart + 8);

  const vineColor = vineComplete ? '#66BB6A' : '#4CAF50';
  const stemColor = vineComplete ? '#E8A838' : '#6A9F4D';
  const stemWave = isInline ? 3 : 2;

  const ghostPath = buildWavyStemPath(stemStart, lastFlowerX + 8, stemY, stemWave);
  const grownPath = stemEndX > stemStart ? buildWavyStemPath(stemStart, stemEndX, stemY, stemWave) : '';

  const leafSpacing = isInline ? 14 : 18;
  const grownLen = stemEndX - stemStart;
  const leafCount = Math.max(Math.floor(grownLen / leafSpacing), 0);
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const t = (i + 1) / (leafCount + 1);
    const x = stemStart + t * grownLen;
    const flip = i % 2 === 1;
    const leafSize = isInline ? (5 + (((i * 7 + 3) % 5) / 5) * 3) : (4 + (((i * 7 + 3) % 5) / 5) * 2);
    return { x, y: stemY, flip, size: leafSize, key: i };
  });

  const toggleExpand = useCallback(() => setExpanded(prev => !prev), []);

  const ariaLabel = vineComplete
    ? t('home.feed.vineComplete')
    : t('home.feed.vineProgress', { explored: conceptExplored, total: conceptTotal });

  const uncoveredConcepts = concepts.filter(c => !c.explored);
  const flowerSize = isInline ? 8 : 6;

  const containerStyle: React.CSSProperties = isInline
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

          {/* Ghost stem — wavy path to last flower */}
          {ghostPath && (
            <path d={ghostPath} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} opacity={0.1} strokeLinecap="round" />
          )}

          {/* Grown vine — thicker wavy stem */}
          {grownPath && (
            <path d={grownPath} fill="none" stroke={stemColor} strokeWidth={4} strokeLinecap="round" />
          )}

          {/* Leaves along grown stem */}
          {leaves.map(l => (
            <VineLeaf key={l.key} x={l.x} y={l.y} size={l.size} flip={l.flip} color={vineColor} />
          ))}

          {/* Concept markers at flower positions */}
          {concepts.map((concept, i) => {
            const fx = flowerPositions[i];
            if (vineComplete) {
              return i % 2 === 0
                ? <VineFruit key={concept.id} cx={fx} cy={stemY - 10} />
                : <GoldFlower key={concept.id} cx={fx} cy={stemY} size={flowerSize} />;
            }
            if (concept.explored) {
              return <VineFlower key={concept.id} cx={fx} cy={stemY} size={flowerSize} />;
            }
            return <VineBud key={concept.id} cx={fx} cy={stemY} />;
          })}
        </svg>

        {/* Right-side icons: history + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {isInline && onHistoryTap && (
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
