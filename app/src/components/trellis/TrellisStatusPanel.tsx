// Simplified status panel (v2): 3 counters in order Dying | Fruit | Dead, with the
// center Fruit column styled as the primary Harvest action. Tapping Fruit harvests
// directly (no bottom sheet) — cherry particles fly to the header counter and a
// confetti burst fires on completion. Dying / Dead columns are non-interactive
// displays; their actions live in the Suggested Moves list below.
//
// Removed in v2: bottom sheets, dying/dead sheet rows, prune animation on sheet
// items, navigate hook. Prune is still reachable from Suggested Moves rows.

import { useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { Cherry, Leaf, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Confetti } from '../Confetti';
import { clearBlossomDate } from '../../services/trellis-blossom-dates.service';
import { trellisCreditsService } from '../../services/trellis-credits.service';
import { eventBus } from '../../lib/event-bus';
import type { TrellisAnchorNode } from '../../services/trellis-state.service';

interface TrellisStatusPanelProps {
  nodes: TrellisAnchorNode[];
  onCreditsChange: (total: number) => void;
  counterRef: RefObject<HTMLSpanElement | null>;
}

interface FlyParticle {
  id: number;
  dx: number;
  dy: number;
}

const FRUIT_COLOR = '#E8A838';
const DYING_COLOR = '#D4A017';
const DEAD_COLOR = '#9E9E9E';

export function TrellisStatusPanel({ nodes, onCreditsChange, counterRef }: TrellisStatusPanelProps) {
  const { t } = useTranslation();
  const [flyParticles, setFlyParticles] = useState<FlyParticle[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fruitRef = useRef<HTMLButtonElement>(null);

  const fruitNodes = nodes.filter((n) => n.leafState === 'fruit');
  const dyingNodes = nodes.filter((n) => n.leafState === 'dying' || n.leafState === 'falling');
  const deadNodes = nodes.filter((n) => n.leafState === 'dead');

  const handleHarvest = () => {
    const count = fruitNodes.length;
    if (count === 0) return;

    fruitNodes.forEach((n) => clearBlossomDate(n.anchor.id));
    const newTotal = trellisCreditsService.add(count);
    onCreditsChange(newTotal);
    eventBus.emit({ type: 'HARVEST_COMPLETED', payload: { count } });

    const fruitEl = fruitRef.current;
    const counterEl = counterRef.current;
    if (fruitEl && counterEl) {
      const fruitRect = fruitEl.getBoundingClientRect();
      const fruitCenterX = fruitRect.left + fruitRect.width / 2;
      const fruitCenterY = fruitRect.top + fruitRect.height / 2;
      const counterRect = counterEl.getBoundingClientRect();
      const counterCenterX = counterRect.left + counterRect.width / 2;
      const counterCenterY = counterRect.top + counterRect.height / 2;
      const dx = counterCenterX - fruitCenterX;
      const dy = counterCenterY - fruitCenterY;
      const particleCount = Math.min(count, 8);
      const particles: FlyParticle[] = Array.from({ length: particleCount }, (_, i) => ({
        id: Date.now() + i,
        dx,
        dy,
      }));
      setFlyParticles(particles);
      window.setTimeout(() => setFlyParticles([]), 1100);
    }

    window.setTimeout(() => setShowConfetti(true), 1200);
    window.setTimeout(() => setShowConfetti(false), 1200 + 3500);
  };

  const columnBase: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--surface-variant)',
    border: '1px solid var(--border)',
  };

  const countTextStyle: CSSProperties = {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--foreground)',
    lineHeight: 1,
  };

  const labelTextStyle: CSSProperties = {
    fontSize: '0.7rem',
    color: 'var(--muted-foreground)',
    marginLeft: '2px',
  };

  const fruitButtonStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-xl)',
    border: 'none',
    backgroundColor: fruitNodes.length > 0 ? FRUIT_COLOR : 'var(--surface-variant)',
    color: fruitNodes.length > 0 ? 'white' : 'var(--muted-foreground)',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: fruitNodes.length > 0 ? 'pointer' : 'default',
    boxShadow: fruitNodes.length > 0 ? '0 2px 10px rgba(232,168,56,0.35)' : 'none',
    animation: fruitNodes.length > 0 ? 'status-glow 3s ease-in-out infinite' : undefined,
  };

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes status-glow {
          0%, 100% { box-shadow: 0 2px 8px rgba(232,168,56,0.3); }
          50%      { box-shadow: 0 2px 18px rgba(232,168,56,0.55); }
        }
        @keyframes fruit-fly {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate(var(--fly-dx), var(--fly-dy)) scale(0.4); opacity: 0; }
        }
      `}</style>

      <div
        ref={panelRef}
        style={{
          display: 'flex',
          gap: '12px',
          padding: '6px 0',
          alignItems: 'stretch',
        }}
      >
        {/* Dying — display only */}
        <div style={columnBase}>
          <Leaf size={18} color={DYING_COLOR} />
          <span style={countTextStyle}>{dyingNodes.length}</span>
          <span style={labelTextStyle}>{t('planner.trellis.dying')}</span>
        </div>

        {/* Fruit — primary harvest action */}
        <button
          ref={fruitRef}
          onClick={handleHarvest}
          disabled={fruitNodes.length === 0}
          className={fruitNodes.length > 0 ? 'active-squish' : undefined}
          style={fruitButtonStyle}
          aria-label={t('planner.trellis.harvestAria', { count: fruitNodes.length })}
        >
          <Cherry size={18} />
          <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{fruitNodes.length}</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9 }}>
            {fruitNodes.length > 0 ? t('planner.trellis.harvest') : t('planner.trellis.fruits')}
          </span>
        </button>

        {/* Dead — display only */}
        <div style={columnBase}>
          <XCircle size={18} color={DEAD_COLOR} />
          <span style={countTextStyle}>{deadNodes.length}</span>
          <span style={labelTextStyle}>{t('planner.trellis.dead')}</span>
        </div>
      </div>

      {/* Fly-to-counter particles */}
      {flyParticles.length > 0 && fruitRef.current && (
        <div
          style={{
            position: 'fixed',
            top: fruitRef.current.getBoundingClientRect().top + fruitRef.current.getBoundingClientRect().height / 2,
            left: fruitRef.current.getBoundingClientRect().left + fruitRef.current.getBoundingClientRect().width / 2,
            pointerEvents: 'none',
            zIndex: 8000,
          }}
        >
          {flyParticles.map((p, i) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: FRUIT_COLOR,
                transform: 'translate(-50%, -50%)',
                animation: 'fruit-fly 1s ease-in forwards',
                animationDelay: `${i * 0.06}s`,
                ['--fly-dx' as string]: `${p.dx}px`,
                ['--fly-dy' as string]: `${p.dy}px`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}

      <Confetti active={showConfetti} />
    </div>
  );
}
