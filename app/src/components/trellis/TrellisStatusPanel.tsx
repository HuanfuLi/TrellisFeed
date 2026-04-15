// Per CONTEXT D-07/D-08/D-10: 3-column status panel showing fruit/dying/dead counts
// derived from TrellisAnchorNode.leafState. Fruit column glows when count > 0 (D-05).
// Tapping a column opens a bottom sheet listing affected nodes (D-09). Fruit sheet
// exposes Harvest All which clears blossom dates, accumulates credits, emits
// HARVEST_COMPLETED, flies fruit particles to the header counter, and fires confetti
// (D-02, D-03, D-06). Inline styles only — project convention.
//
// Plan 26-03 additions:
// - Dying sheet items expose Heal + Prune actions (D-11, D-15)
// - Dead sheet items expose Re-plant + Prune actions (D-13, D-15)
// - Prune animation: scissors rotate → node card falls + fades (D-17)
// - Pruned section below the 3-column panel with Restore / Delete forever (D-16, D-18)

import { useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cherry,
  Leaf,
  XCircle,
  Heart,
  Scissors,
  Sprout,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Confetti } from '../Confetti';
import { clearBlossomDate } from '../../services/trellis-blossom-dates.service';
import { trellisCreditsService } from '../../services/trellis-credits.service';
import { trellisActionsService } from '../../services/trellis-actions.service';
import { questionService } from '../../services/question.service';
import { eventBus } from '../../lib/event-bus';
import { toast } from '../../lib/toast';
import type { TrellisAnchorNode } from '../../services/trellis-state.service';
import type { Question } from '../../types';

interface TrellisStatusPanelProps {
  nodes: TrellisAnchorNode[];
  onCreditsChange: (total: number) => void;
  counterRef: RefObject<HTMLSpanElement | null>;
}

type SheetKey = 'fruit' | 'dying' | 'dead' | null;

interface FlyParticle {
  id: number;
  dx: number;
  dy: number;
}

const FRUIT_COLOR = '#E8A838';
const DYING_COLOR = '#D4A017';
const DEAD_COLOR = '#9E9E9E';
const HEAL_COLOR = 'var(--node-mint, #8BC9A8)';
const REPLANT_COLOR = '#4FB3A0';

function anchorLabel(node: TrellisAnchorNode): string {
  const q = node.anchor;
  return q.title ?? q.content ?? 'anchor';
}

export function TrellisStatusPanel({ nodes, onCreditsChange, counterRef }: TrellisStatusPanelProps) {
  const navigate = useNavigate();
  const [activeSheet, setActiveSheet] = useState<SheetKey>(null);
  const [flyParticles, setFlyParticles] = useState<FlyParticle[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prunedNodes, setPrunedNodes] = useState<Question[]>(() => questionService.getPrunedQuestions());
  const [showPruned, setShowPruned] = useState(false);
  const [pruningId, setPruningId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fruitNodes = nodes.filter((n) => n.leafState === 'fruit');
  const dyingNodes = nodes.filter((n) => n.leafState === 'yellow' || n.leafState === 'falling');
  const deadNodes = nodes.filter((n) => n.leafState === 'fallen');

  const refreshPrunedNodes = () => setPrunedNodes(questionService.getPrunedQuestions());

  const handleHarvest = () => {
    const count = fruitNodes.length;
    if (count === 0) return;

    fruitNodes.forEach((n) => clearBlossomDate(n.anchor.id));
    const newTotal = trellisCreditsService.add(count);
    onCreditsChange(newTotal);
    eventBus.emit({ type: 'HARVEST_COMPLETED', payload: { count } });
    setActiveSheet(null);

    const panelEl = panelRef.current;
    const counterEl = counterRef.current;
    if (panelEl && counterEl) {
      const panelRect = panelEl.getBoundingClientRect();
      const panelCenterX = panelRect.left + panelRect.width / 2;
      const panelCenterY = panelRect.top + panelRect.height / 2;
      const counterRect = counterEl.getBoundingClientRect();
      const counterCenterX = counterRect.left + counterRect.width / 2;
      const counterCenterY = counterRect.top + counterRect.height / 2;
      const dx = counterCenterX - panelCenterX;
      const dy = counterCenterY - panelCenterY;
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

  const handleHeal = (node: TrellisAnchorNode) => {
    const name = anchorLabel(node);
    const qaIds = node.qaChildren.map((q) => q.id);
    const result = trellisActionsService.heal(node.anchor.id, name, qaIds);
    setActiveSheet(null);
    navigate(result.navigateTo, { state: result.state });
  };

  const handleReplant = async (node: TrellisAnchorNode) => {
    const qaIds = node.qaChildren.map((q) => q.id);
    const result = await trellisActionsService.replant(node.anchor.id, node.anchor, qaIds);
    toast('Schedule reset - review to revive', 'success');
    setActiveSheet(null);
    navigate(result.navigateTo, { state: result.state });
  };

  const handlePrune = (node: TrellisAnchorNode) => {
    const id = node.anchor.id;
    setPruningId(id);
    // Let the CSS animation play (scissors cut ~0.5s, leaf fall starts at 0.5s, ends at 1.0s)
    // before flipping the flagged field and refreshing state.
    window.setTimeout(() => {
      trellisActionsService.prune(id);
      refreshPrunedNodes();
      setPruningId(null);
      toast('Pruned - moved to archive', 'success');
      // Close sheet so the user sees the pruned badge update in the panel area
      setActiveSheet(null);
    }, 1000);
  };

  const handleUnprune = (q: Question) => {
    trellisActionsService.unpruneQuestion(q.id);
    refreshPrunedNodes();
    toast('Restored to trellis', 'success');
  };

  const handleHardDelete = async (q: Question) => {
    await trellisActionsService.hardDelete(q.id);
    refreshPrunedNodes();
    toast('Permanently deleted', 'success');
  };

  const columnBase: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-xl)',
    backgroundColor: 'var(--surface-variant)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
  };

  const fruitGlow: CSSProperties =
    fruitNodes.length > 0
      ? {
          boxShadow: '0 0 12px rgba(232,168,56,0.35)',
          animation: 'status-glow 3s ease-in-out infinite',
        }
      : {};

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

  const actionBtnBase: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'white',
  };

  const renderActionableItem = (
    node: TrellisAnchorNode,
    leadIcon: React.ReactNode,
    leadColor: string,
    primaryAction: { label: string; icon: React.ReactNode; color: string; onClick: () => void },
  ) => {
    const isPruning = pruningId === node.anchor.id;
    return (
      <div
        key={node.anchor.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--surface-variant)',
          border: '1px solid var(--border)',
          marginBottom: '8px',
          animation: isPruning ? 'prune-fall 0.5s ease-in 0.5s forwards' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: leadColor, display: 'flex', flexShrink: 0 }}>{leadIcon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.88rem',
                fontWeight: 500,
                color: 'var(--foreground)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {anchorLabel(node)}
            </p>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '0.72rem',
                color: 'var(--muted-foreground)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {node.branchLabel}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="active-squish"
            onClick={primaryAction.onClick}
            disabled={isPruning}
            style={{ ...actionBtnBase, backgroundColor: primaryAction.color, flex: 1 }}
          >
            {primaryAction.icon}
            {primaryAction.label}
          </button>
          <button
            className="active-squish"
            onClick={() => handlePrune(node)}
            disabled={isPruning}
            aria-label="Prune"
            style={{
              ...actionBtnBase,
              backgroundColor: 'var(--surface)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              padding: '8px 10px',
            }}
          >
            <Scissors
              size={16}
              style={{
                animation: isPruning ? 'prune-cut 0.5s ease-in-out forwards' : undefined,
                transformOrigin: 'center',
                display: 'inline-block',
              }}
            />
            Prune
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes status-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(232,168,56,0.25); }
          50%      { box-shadow: 0 0 16px rgba(232,168,56,0.45); }
        }
        @keyframes fruit-fly {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate(var(--fly-dx), var(--fly-dy)) scale(0.4); opacity: 0; }
        }
        @keyframes prune-cut {
          0%, 100% { transform: rotate(0) scale(1); }
          15%      { transform: rotate(-35deg) scale(1.15); }
          30%      { transform: rotate(0) scale(1); }
          45%      { transform: rotate(-35deg) scale(1.15); }
          60%      { transform: rotate(0) scale(1); }
          75%      { transform: rotate(-20deg) scale(1.1); }
        }
        @keyframes prune-fall {
          0%   { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(60px); opacity: 0; }
        }
      `}</style>

      <div
        ref={panelRef}
        style={{
          display: 'flex',
          gap: '12px',
          padding: '12px 16px',
        }}
      >
        {/* Fruits */}
        <div
          onClick={() => setActiveSheet('fruit')}
          style={{ ...columnBase, ...fruitGlow }}
        >
          <Cherry size={18} color={FRUIT_COLOR} />
          <span style={countTextStyle}>{fruitNodes.length}</span>
          <span style={labelTextStyle}>Fruits</span>
        </div>

        {/* Dying */}
        <div onClick={() => setActiveSheet('dying')} style={columnBase}>
          <Leaf size={18} color={DYING_COLOR} />
          <span style={countTextStyle}>{dyingNodes.length}</span>
          <span style={labelTextStyle}>Dying</span>
        </div>

        {/* Dead */}
        <div onClick={() => setActiveSheet('dead')} style={columnBase}>
          <XCircle size={18} color={DEAD_COLOR} />
          <span style={countTextStyle}>{deadNodes.length}</span>
          <span style={labelTextStyle}>Dead</span>
        </div>
      </div>

      {/* Pruned section link (D-16) */}
      {prunedNodes.length > 0 && (
        <div style={{ padding: '0 16px 12px' }}>
          <button
            onClick={() => setShowPruned((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '10px',
              backgroundColor: 'transparent',
              border: '1px dashed var(--border)',
              color: 'var(--muted-foreground)',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            <Scissors size={12} />
            Pruned ({prunedNodes.length})
            <span style={{ marginLeft: '2px' }}>{showPruned ? '▾' : '▸'}</span>
          </button>
          {showPruned && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {prunedNodes.map((q) => (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surface-variant)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.82rem',
                      color: 'var(--muted-foreground)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {q.title ?? q.content ?? 'anchor'}
                  </span>
                  <button
                    onClick={() => handleUnprune(q)}
                    aria-label="Restore"
                    title="Restore to trellis"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={12} />
                    Restore
                  </button>
                  <button
                    onClick={() => { void handleHardDelete(q); }}
                    aria-label="Delete forever"
                    title="Delete forever"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: '#B44',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fruit bottom sheet */}
      <BottomSheet
        open={activeSheet === 'fruit'}
        onClose={() => setActiveSheet(null)}
        title="Ripe Fruits"
      >
        {fruitNodes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: 0 }}>
            Nothing ripe right now. Keep reviewing your strongest anchors to grow fruit.
          </p>
        ) : (
          <>
            <button
              onClick={handleHarvest}
              className="active-squish"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: FRUIT_COLOR,
                color: 'white',
                border: 'none',
                fontSize: '0.92rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '16px',
              }}
            >
              <Cherry size={16} />
              Harvest All ({fruitNodes.length})
            </button>
            {fruitNodes.map((n) => (
              <div
                key={n.anchor.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-xl)',
                  backgroundColor: 'var(--surface-variant)',
                  border: '1px solid var(--border)',
                  marginBottom: '8px',
                }}
              >
                <span style={{ color: FRUIT_COLOR, display: 'flex', flexShrink: 0 }}>
                  <Cherry size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      color: 'var(--foreground)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {anchorLabel(n)}
                  </p>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: '0.72rem',
                      color: 'var(--muted-foreground)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {n.branchLabel}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </BottomSheet>

      {/* Dying bottom sheet (D-11, D-15: Heal + Prune) */}
      <BottomSheet
        open={activeSheet === 'dying'}
        onClose={() => setActiveSheet(null)}
        title="Dying Anchors"
      >
        {dyingNodes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: 0 }}>
            No anchors are dying — your trellis is healthy.
          </p>
        ) : (
          dyingNodes.map((n) =>
            renderActionableItem(
              n,
              <Leaf size={16} />,
              DYING_COLOR,
              {
                label: 'Heal',
                icon: <Heart size={14} />,
                color: HEAL_COLOR,
                onClick: () => handleHeal(n),
              },
            ),
          )
        )}
      </BottomSheet>

      {/* Dead bottom sheet (D-13, D-15: Re-plant + Prune) */}
      <BottomSheet
        open={activeSheet === 'dead'}
        onClose={() => setActiveSheet(null)}
        title="Dead Anchors"
      >
        {deadNodes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: 0 }}>
            Nothing has died yet. Keep reviewing to keep your trellis alive.
          </p>
        ) : (
          deadNodes.map((n) =>
            renderActionableItem(
              n,
              <XCircle size={16} />,
              DEAD_COLOR,
              {
                label: 'Re-plant',
                icon: <Sprout size={14} />,
                color: REPLANT_COLOR,
                onClick: () => { void handleReplant(n); },
              },
            ),
          )
        )}
      </BottomSheet>

      {/* Fly-to-counter particles */}
      {flyParticles.length > 0 && panelRef.current && (
        <div
          style={{
            position: 'fixed',
            top: panelRef.current.getBoundingClientRect().top + panelRef.current.getBoundingClientRect().height / 2,
            left: panelRef.current.getBoundingClientRect().left + panelRef.current.getBoundingClientRect().width / 2,
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
