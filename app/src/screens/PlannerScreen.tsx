import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  RefreshCw, Loader2,
  ChevronDown, ChevronUp, Cherry, Sprout, Heart, Scissors,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { usePlannerAutoGen } from '../state/usePlannerAutoGen';
import { useDailyRefresh } from '../state/useDailyRefresh';
import { toast } from '../lib/toast';
import { Header, HEADER_HEIGHT } from '../components/ui/Header';
import { TrellisHero } from '../components/trellis/TrellisHero';
import { TrellisStatusPanel } from '../components/trellis/TrellisStatusPanel';
import { PrunedSection } from '../components/trellis/PrunedSection';
import { useTrellisData } from '../state/useTrellisData';
import { trellisCreditsService } from '../services/trellis-credits.service';
import { trellisActionsService } from '../services/trellis-actions.service';
import { PortalCard, buildPortalData } from '../components/PortalCard';

function EmptySectionHint({ text }: { text: string }) {
  return (
    <Card style={{ padding: 'var(--space-md) var(--space-lg)', marginBottom: '10px', backgroundColor: 'var(--surface-variant)' }}>
      <p style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{text}</p>
    </Card>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export function PlannerScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { moves: autoMoves, isRefreshing, accept: acceptMove, dismiss: dismissMove, skipAll, refresh: refreshMoves } = usePlannerAutoGen();
  useDailyRefresh(); // Mount to activate PODCAST_GENERATION_COMPLETED → refresh subscription
  const { layout } = useTrellisData();
  const [credits, setCredits] = useState<number>(() => trellisCreditsService.getTotal());
  const counterRef = useRef<HTMLSpanElement>(null);
  const [showAutoMoves, setShowAutoMoves] = useState(true);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  // Phase 28 D-12 — track which anchor should pulse on the trellis when the
  // Trellis-derived action moves (per D-19, D-20, D-23).
  // Re-derived every render so layout updates flow through immediately.
  const deadNodes = layout.nodes.filter((n) => n.leafState === 'dead');
  const dyingNodes = layout.nodes.filter((n) => n.leafState === 'dying' || n.leafState === 'falling');

  // D-23: AutoGen dedup — drop any autoGen move whose conceptId matches
  // a dying or dead anchor so the user does not see the same anchor twice.
  const dyingDeadIds = new Set<string>([
    ...deadNodes.map((n) => n.anchor.id),
    ...dyingNodes.map((n) => n.anchor.id),
  ]);
  const filteredAutoMoves = autoMoves.filter((move) => !dyingDeadIds.has(move.conceptId));

  const totalSuggestions = deadNodes.length + dyingNodes.length + filteredAutoMoves.length;
  const TOP_N = 5;
  const trellisCount = deadNodes.length + dyingNodes.length;
  const visibleAutoMoves = showAllSuggestions
    ? filteredAutoMoves
    : filteredAutoMoves.slice(0, Math.max(0, TOP_N - trellisCount));
  const remainingAfterSlice = totalSuggestions - trellisCount - visibleAutoMoves.length;

  const handleSkipAll = () => {
    skipAll();
    toast(t('planner.toast.suggestionsCleared'));
  };

  const handleReplant = (node: typeof deadNodes[number]) => {
    const result = trellisActionsService.replant(
      node.anchor.id,
      node.anchor,
      node.qaChildren.map((q) => q.id),
    );
    navigate(result.navigateTo, { state: result.state });
  };

  const handleHeal = (node: typeof dyingNodes[number]) => {
    const name = node.anchor.title ?? node.anchor.content ?? t('planner.deadFallback');
    const result = trellisActionsService.heal(
      node.anchor.id,
      name,
      node.qaChildren.map((q) => q.id),
    );
    navigate(result.navigateTo, { state: result.state });
  };

  const handlePrune = (anchorId: string) => {
    trellisActionsService.prune(anchorId);
    toast(t('planner.toast.pruned'), 'success');
  };

  return (
    <div style={{ paddingTop: `${HEADER_HEIGHT + 8}px`, paddingLeft: '16px', paddingRight: '16px', paddingBottom: 'var(--bottom-nav-safe)', maxWidth: '448px', margin: '0 auto' }}>
      <Header
        title={t('planner.title')}
        right={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: credits > 0 ? 'rgba(255,200,0,0.15)' : 'var(--surface-variant)',
              border: '1px solid var(--border)',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <Cherry size={14} />
            <span ref={counterRef}>{credits}</span>
          </div>
        }
      />

      <TrellisHero focusedAnchorId={null} />

      {/* Phase 28 D-30 — symmetric section rhythm (var(--section-gap) = 24px)
           between TrellisHero and TrellisStatusPanel, replacing the prior
           asymmetric 16px/8px. */}
      <div style={{ marginTop: 'var(--section-gap)', marginBottom: 'var(--section-gap)' }}>
        <TrellisStatusPanel
          nodes={layout.nodes}
          onCreditsChange={setCredits}
          counterRef={counterRef}
        />
      </div>

      {/* ── Suggested Moves (trellis-first) ───────────────────────────── */}
      {/* Phase 28 D-04 — explicit heading styling (1rem / 600 / --section-gap top margin)
           so the section is visually prominent against the crowded surface above. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: 'var(--section-gap)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 600,
            lineHeight: 1.4,
            color: 'var(--foreground)',
            letterSpacing: '-0.01em',
          }}>{t('planner.suggestedMoves')}</h2>
          {totalSuggestions > 0 && <Badge color="gray">{totalSuggestions}</Badge>}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => void refreshMoves()}
            disabled={isRefreshing}
            title={t('planner.refreshTitle')}
            className="active-squish"
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              backgroundColor: 'var(--surface-variant)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isRefreshing ? 0.5 : 1,
            }}
          >
            {isRefreshing
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={13} />}
          </button>
          <button
            onClick={() => setShowAutoMoves(!showAutoMoves)}
            style={{
              background: 'none', display: 'flex', alignItems: 'center',
              gap: '3px', color: 'var(--muted-foreground)', fontSize: '0.78rem',
              padding: '4px',
            }}
          >
            {showAutoMoves ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {showAutoMoves && (
        totalSuggestions === 0 ? (
          <EmptySectionHint text={t('planner.emptyHint')} />
        ) : (
          <>
            {/* D-20: Dead nodes first (highest priority — re-plant) */}
            {deadNodes.map((node) => {
              const name = node.anchor.title ?? node.anchor.content ?? t('planner.deadFallback');
              return (
                <div
                  key={`dead-${node.anchor.id}`}
                  onClick={() => handleReplant(node)}
                  className="active-squish"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    // Phase 28 D-28 — 11px → 12px to land on the 4-grid.
                    padding: '12px 0', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <Sprout size={16} style={{ color: '#4CAF50', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.9rem', fontWeight: 500, color: 'var(--foreground)',
                      lineHeight: 1.4,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {name}
                    </p>
                    <p style={{
                      fontSize: '0.78rem', color: 'var(--muted-foreground)',
                      marginTop: '1px', lineHeight: 1.35,
                    }}>
                      {t('planner.deadRowSubtitle')}
                    </p>
                  </div>
                  <Badge color="red">{t('planner.replantBadge')}</Badge>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrune(node.anchor.id); }}
                    aria-label={t('planner.pruneAria')}
                    title={t('planner.pruneTitle')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '32px', minHeight: '32px', borderRadius: 8,
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--muted-foreground)', cursor: 'pointer',
                    }}
                  >
                    <Scissors size={14} />
                  </button>
                </div>
              );
            })}

            {/* D-20: Dying nodes second (heal) */}
            {dyingNodes.map((node) => {
              const name = node.anchor.title ?? node.anchor.content ?? t('planner.deadFallback');
              return (
                <div
                  key={`dying-${node.anchor.id}`}
                  onClick={() => handleHeal(node)}
                  className="active-squish"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    // Phase 28 D-28 — 11px → 12px on the 4-grid.
                    padding: '12px 0', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <Heart size={16} style={{ color: '#66BB6A', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.9rem', fontWeight: 500, color: 'var(--foreground)',
                      lineHeight: 1.4,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {name}
                    </p>
                    <p style={{
                      fontSize: '0.78rem', color: 'var(--muted-foreground)',
                      marginTop: '1px', lineHeight: 1.35,
                    }}>
                      {t('planner.dyingRowSubtitle')}
                    </p>
                  </div>
                  <Badge color="yellow">{t('planner.healBadge')}</Badge>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrune(node.anchor.id); }}
                    aria-label={t('planner.pruneAria')}
                    title={t('planner.pruneTitle')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '32px', minHeight: '32px', borderRadius: 8,
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--muted-foreground)', cursor: 'pointer',
                    }}
                  >
                    <Scissors size={14} />
                  </button>
                </div>
              );
            })}

            {/* D-20: AutoGen moves third (filtered per D-23) */}
            {visibleAutoMoves.map((move) => {
              const partial = buildPortalData(move.conceptId, move.title, move.reason);
              const portalData = { ...partial, primaryAction: move.moveType, move };
              return (
                <PortalCard
                  key={move.id}
                  data={portalData}
                  onAccept={acceptMove}
                  onDismiss={dismissMove}
                  onNavigate={() => {
                    // Navigation handled internally by PortalCard
                  }}
                />
              );
            })}
            {!showAllSuggestions && remainingAfterSlice > 0 && (
              <button
                onClick={() => setShowAllSuggestions(true)}
                style={{
                  width: '100%', padding: 'var(--space-sm) var(--space-lg)', borderRadius: '12px',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--primary-40)',
                  border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '4px', marginBottom: '8px',
                }}
              >
                <ChevronDown size={14} />
                {t('planner.showAllSuggestions', { count: totalSuggestions })}
              </button>
            )}
            {showAllSuggestions && totalSuggestions > TOP_N && (
              <button
                onClick={() => setShowAllSuggestions(false)}
                style={{
                  width: '100%', padding: 'var(--space-sm) var(--space-lg)', borderRadius: '12px',
                  backgroundColor: 'var(--surface-variant)', color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '4px', marginBottom: '8px',
                }}
              >
                <ChevronUp size={14} />
                {t('planner.showLess')}
              </button>
            )}
            {filteredAutoMoves.length > 0 && (
              <button
                onClick={handleSkipAll}
                style={{
                  background: 'none', padding: '6px 0 4px', display: 'flex',
                  alignItems: 'center', gap: '4px', color: 'var(--muted-foreground)',
                  fontSize: '0.78rem', marginBottom: '4px',
                }}
              >
                {t('planner.skipAllSuggestions')}
              </button>
            )}
          </>
        )
      )}

      {/* ── Pruned archive (bottom of page) ──────────────────────────── */}
      <PrunedSection />
    </div>
  );
}
