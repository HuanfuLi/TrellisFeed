import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Clock } from 'lucide-react';

interface VineProgressProps {
  mode: 'inline' | 'compact';
  concepts: Array<{ id: string; name: string; explored: boolean }>;
  onConceptTap?: (conceptId: string) => void;
  onHistoryTap?: () => void;
}

// Deterministic pseudo-random from seed
function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
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
      <path
        d={`M0,0 Q${size * 0.3},${-size * 0.9} ${size * 0.8},${-size * 0.5} Q${size * 0.5},${-size * 0.15} 0,0`}
        fill={color} opacity={0.8}
      />
      <path d={`M0,0 Q${size * 0.35},${-size * 0.55} ${size * 0.7},${-size * 0.45}`}
        fill="none" stroke={color} strokeWidth={0.6} opacity={0.4} />
    </g>
  );
}

function Tendril({ x, y, flip, size }: { x: number; y: number; flip: boolean; size: number }) {
  const dir = flip ? -1 : 1;
  return (
    <path
      d={`M${x},${y} C${x + dir * size * 0.3},${y - size * 0.6} ${x + dir * size * 0.8},${y - size * 0.3} ${x + dir * size * 0.6},${y - size * 0.9}`}
      fill="none" stroke="var(--primary-40)" strokeWidth={0.8} opacity={0.3} strokeLinecap="round"
    />
  );
}

function VineBud({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="var(--muted-foreground)" opacity={0.18} />
      <circle cx={cx} cy={cy} r={1.5} fill="var(--muted-foreground)" opacity={0.1} />
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
        return <ellipse key={i} cx={px} cy={py} rx={size * 0.32} ry={size * 0.26} fill="#F48FB1" opacity={0.75}
          transform={`rotate(${(angle * 180) / Math.PI + 15}, ${px}, ${py})`} />;
      })}
      <circle cx={cx} cy={cy} r={size * 0.2} fill="#FFE082" />
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
      <path d={`M${cx},${cy - 9} C${cx - 3},${cy - 13} ${cx + 1},${cy - 14} ${cx + 4},${cy - 11}`} fill="#66BB6A" />
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
        return <ellipse key={i} cx={px} cy={py} rx={size * 0.3} ry={size * 0.22} fill="#E8A838" opacity={0.8}
          transform={`rotate(${(angle * 180) / Math.PI}, ${px}, ${py})`} />;
      })}
      <circle cx={cx} cy={cy} r={size * 0.18} fill="#FFF176" />
    </g>
  );
}

// Build an organic vine path with asymmetric curves and slight vertical drift
function buildOrganicStem(startX: number, endX: number, baseY: number, amplitude: number): {
  path: string;
  yAt: (x: number) => number;
} {
  if (endX <= startX) return { path: '', yAt: () => baseY };
  const len = endX - startX;
  const segments = Math.max(Math.round(len / 30), 3);
  const segLen = len / segments;

  const points: Array<{ x: number; y: number }> = [{ x: startX, y: baseY }];
  for (let i = 1; i <= segments; i++) {
    const x = startX + i * segLen;
    const drift = (seededRand(i * 13 + 7) - 0.5) * amplitude * 1.8;
    const y = baseY + drift * (i % 2 === 0 ? 1 : -1);
    points.push({ x, y });
  }

  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < segments; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const bulge = amplitude * (0.6 + seededRand(i * 31 + 5) * 0.8);
    const side = seededRand(i * 17 + 3) > 0.5 ? 1 : -1;
    const skew = 0.25 + seededRand(i * 23 + 11) * 0.2;
    const cx1 = p0.x + dx * skew + side * bulge * 0.4;
    const cy1 = p0.y + dy * skew - bulge * 0.6;
    const cx2 = p0.x + dx * (1 - skew) - side * bulge * 0.3;
    const cy2 = p0.y + dy * (1 - skew) + bulge * 0.4;
    d += ` C${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }

  const yAt = (x: number): number => {
    if (x <= startX) return baseY;
    if (x >= endX) return points[points.length - 1].y;
    const segIdx = Math.min(Math.floor(((x - startX) / len) * segments), segments - 1);
    const p0 = points[segIdx];
    const p1 = points[segIdx + 1];
    const t = (x - p0.x) / (p1.x - p0.x);
    return p0.y + (p1.y - p0.y) * t;
  };

  return { path: d, yAt };
}

// Tapering: split path into segments with decreasing stroke width
function TaperingPath({ d, baseWidth, tipWidth, color, opacity, segments }: {
  d: string; baseWidth: number; tipWidth: number; color: string; opacity: number; segments: number;
}) {
  const widths: number[] = [];
  for (let i = 0; i < segments; i++) {
    widths.push(baseWidth - (baseWidth - tipWidth) * (i / (segments - 1 || 1)));
  }
  const dashLen = 100 / segments;
  return (
    <g>
      {widths.map((w, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={w} opacity={opacity}
          strokeLinecap="round"
          strokeDasharray={`${dashLen}% ${100 - dashLen}%`}
          strokeDashoffset={`${-i * dashLen}%`}
          pathLength={100}
        />
      ))}
    </g>
  );
}

function VineProgressImpl({
  mode,
  concepts,
  onConceptTap,
  onHistoryTap,
}: VineProgressProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Measure the SVG's rendered width so the viewBox matches and the vine fills
  // the full container. Without this, the fixed `viewBox="0 0 300 ..."` plus
  // `preserveAspectRatio="xMidYMid meet"` left empty space on the right half of
  // the card on phones wider than ~330px (operator-reported 2026-04-19).
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(300);

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

  useEffect(() => {
    const el = svgWrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setMeasuredWidth(w);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleExpand = useCallback(() => setExpanded(prev => !prev), []);

  const conceptTotal = concepts.length;
  const conceptExplored = concepts.filter(c => c.explored).length;

  if (conceptTotal === 0) return null;

  const isInline = mode === 'inline';
  const svgHeight = isInline ? 58 : 46;
  const stemY = svgHeight * 0.55;
  const potX = 18;
  const stemStart = potX + 14;
  const rightPad = 4;
  const svgWidth = measuredWidth;
  const availableWidth = svgWidth - stemStart - rightPad;
  const vineComplete = conceptTotal > 0 && conceptExplored >= conceptTotal;

  // Vine spans the FULL available width regardless of concept count. Earlier
  // implementation placed the last flower at N/(N+1) of width, so a 1-anchor user
  // saw a half-card stem (operator-reported 2026-04-19). The fix anchors stemEndFull
  // to the right edge and spreads flowers evenly across the vine length, with
  // small padding at either end so they don't sit flush against the pot or the edge.
  const stemEndFull = stemStart + availableWidth;
  const flowerEdgePad = Math.min(16, availableWidth * 0.05);
  const flowerSpan = Math.max(0, availableWidth - 2 * flowerEdgePad);
  const flowerPositions = conceptTotal === 1
    ? [stemStart + availableWidth / 2]
    : concepts.map((_, i) => stemStart + flowerEdgePad + (i / (conceptTotal - 1)) * flowerSpan);

  const stemEndX = vineComplete ? stemEndFull : stemStart + (conceptExplored / conceptTotal) * availableWidth;

  const vineColor = vineComplete ? '#66BB6A' : '#4CAF50';
  const stemColor = vineComplete ? '#E8A838' : '#6A9F4D';
  const stemWave = isInline ? 4 : 3;

  const ghost = buildOrganicStem(stemStart, stemEndFull, stemY, stemWave);
  const grown = stemEndX > stemStart ? buildOrganicStem(stemStart, stemEndX, stemY, stemWave) : null;

  const leafSpacing = isInline ? 12 : 16;
  const grownLen = stemEndX - stemStart;
  const leafCount = Math.max(Math.floor(grownLen / leafSpacing), 0);
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const frac = (i + 1) / (leafCount + 1);
    const x = stemStart + frac * grownLen;
    const y = grown ? grown.yAt(x) : stemY;
    const flip = i % 2 === 1;
    const leafSize = isInline ? (5 + (((i * 7 + 3) % 5) / 5) * 4) : (4 + (((i * 7 + 3) % 5) / 5) * 3);
    return { x, y, flip, size: leafSize, key: i };
  });

  const tendrils = leaves.filter((_, i) => i % 3 === 1).map((l, i) => ({
    x: l.x, y: l.y, flip: i % 2 === 0, size: isInline ? 8 : 6, key: `t-${i}`,
  }));

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
      }
    : {
        background: 'var(--surface)',
        padding: '8px 16px',
        position: 'relative',
      };

  return (
    <>
    {expanded && !isInline && (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(false);
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 89,
          background: 'rgba(0, 0, 0, 0.15)',
        }}
      />
    )}
    <div ref={containerRef} style={{ ...containerStyle, ...(expanded && !isInline ? { zIndex: 90, position: 'relative' as const } : {}) }}>
      <div
        role="progressbar"
        aria-valuenow={conceptExplored}
        aria-valuemin={0}
        aria-valuemax={conceptTotal}
        aria-label={ariaLabel}
        onClick={toggleExpand}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <div ref={svgWrapperRef} style={{ flex: 1, minWidth: 0, lineHeight: 0 }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          style={{ display: 'block' }}
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          <PottedPlant x={potX} y={stemY} color={vineColor} />

          {/* Ghost stem — organic tapered path */}
          {ghost.path && (
            <TaperingPath d={ghost.path} baseWidth={3} tipWidth={1.2} color="var(--muted-foreground)" opacity={0.1} segments={4} />
          )}

          {/* Grown vine — organic tapered stem */}
          {grown && grown.path && (
            <>
              {/* Shadow layer */}
              <path d={grown.path} fill="none" stroke={stemColor} strokeWidth={6} opacity={0.08} strokeLinecap="round" />
              {/* Main tapering stem */}
              <TaperingPath d={grown.path} baseWidth={5} tipWidth={2.5} color={stemColor} opacity={0.85} segments={5} />
            </>
          )}

          {/* Tendrils — small spiral curls */}
          {tendrils.map(tr => (
            <Tendril key={tr.key} x={tr.x} y={tr.y} flip={tr.flip} size={tr.size} />
          ))}

          {/* Leaves along grown stem */}
          {leaves.map(l => (
            <VineLeaf key={l.key} x={l.x} y={l.y} size={l.size} flip={l.flip} color={vineColor} />
          ))}

          {/* Concept markers at flower positions */}
          {concepts.map((concept, i) => {
            const fx = flowerPositions[i];
            const fy = ghost.yAt(fx);
            if (vineComplete) {
              return i % 2 === 0
                ? <VineFruit key={concept.id} cx={fx} cy={fy - 10} />
                : <GoldFlower key={concept.id} cx={fx} cy={fy} size={flowerSize} />;
            }
            if (concept.explored) {
              return <VineFlower key={concept.id} cx={fx} cy={fy} size={flowerSize} />;
            }
            return <VineBud key={concept.id} cx={fx} cy={fy} />;
          })}
        </svg>
        </div>

        {/* Right-side icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {isInline && onHistoryTap && (
            <button
              onClick={(e) => { e.stopPropagation(); onHistoryTap(); }}
              aria-label={t('home.history.iconLabel')}
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

      {/* Concept checklist */}
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
    </>
  );
}

// D-23 (Phase 33 Plan 06): memoize VineProgress to skip re-render when
// concepts array contents are unchanged. Custom comparator stringifies
// (id, explored) pairs since the array reference is rebuilt by parent
// on every event-bus emission even when nothing changed.
function vineProgressPropsEqual(prev: VineProgressProps, next: VineProgressProps): boolean {
  if (prev.mode !== next.mode) return false;
  if (prev.onConceptTap !== next.onConceptTap) return false;
  if (prev.onHistoryTap !== next.onHistoryTap) return false;
  const prevKey = prev.concepts.map(c => c.id + (c.explored ? '1' : '0')).join('|');
  const nextKey = next.concepts.map(c => c.id + (c.explored ? '1' : '0')).join('|');
  return prevKey === nextKey;
}

export const VineProgress = React.memo(VineProgressImpl, vineProgressPropsEqual);
