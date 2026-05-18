import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Question } from '../../types/index.ts';

/**
 * DragOverlay — Phase 49-01 portaled ghost-node + origin-line + magnetic snap.
 *
 * Portals to document.body to escape any ancestor containing block
 * (specifically SwipeTabContainer's per-slot translateZ(0) — see Phase 32.1
 * Header portal-vs-in-tree pattern documented in CLAUDE.md). Without the
 * portal the ghost div would anchor to the active swipe slot rather than the
 * viewport.
 *
 * Magnetic snap math (RESEARCH §R3):
 *   - 32px Euclidean from ghost-center (= pointer coords) to target rect center.
 *   - Halo color encodes drop semantics: cluster → --primary-40 (Move),
 *     anchor → --node-peach (Merge).
 *
 * Layering (RESEARCH §R6):
 *   - zIndex 8999: halo overlay on snap target.
 *   - zIndex 9000: SVG origin-line from originRect center to pointer coords.
 *   - zIndex 9001: ghost div tracking pointer.
 *
 * Pointer-events disabled everywhere inside the portal so the ghost does not
 * block the underlying pointerup that GraphScreen's container listener
 * captures.
 */

export interface DropTargetSnapshot {
  id: string;
  kind: 'cluster' | 'anchor' | 'qa';
  rect: DOMRect;
}

export interface DragState {
  sourceNode: Question;
  originRect: DOMRect;
  ghostRect: { width: number; height: number };
  pointerX: number;
  pointerY: number;
  snappedTargetId: string | null;
  dropResult?: { kind: 'move' | 'merge' | 'invalid'; targetId?: string };
}

export interface DragOverlayProps {
  dragState: DragState | null;
  targets: DropTargetSnapshot[];
  snapRadiusPx?: number;
}

export function DragOverlay({
  dragState,
  targets,
  snapRadiusPx = 32,
}: DragOverlayProps) {
  // Hook order MUST be stable across renders — compute snap target before
  // any early return. The memo deps allow null-handling internally.
  const snappedTarget = useMemo<DropTargetSnapshot | null>(() => {
    if (dragState === null) return null;
    let best: DropTargetSnapshot | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const t of targets) {
      const cx = t.rect.x + t.rect.width / 2;
      const cy = t.rect.y + t.rect.height / 2;
      const d = Math.hypot(cx - dragState.pointerX, cy - dragState.pointerY);
      if (d <= snapRadiusPx && d < bestDist) {
        best = t;
        bestDist = d;
      }
    }
    return best;
  }, [targets, dragState, snapRadiusPx]);

  // SSR guard — document is undefined pre-hydration. Match BottomSheet pattern.
  if (typeof document === 'undefined') return null;
  if (dragState === null) return null;

  // Halo color encodes drop semantics. cluster→Move (teal); anchor→Merge (peach).
  // Other kinds (qa) get no halo — invalid drop target visually.
  const haloColor =
    snappedTarget?.kind === 'cluster'
      ? 'var(--primary-40)'
      : snappedTarget?.kind === 'anchor'
        ? 'var(--node-peach)'
        : null;

  // Origin-line endpoints: from origin-rect center to pointer position.
  const originCenterX = dragState.originRect.x + dragState.originRect.width / 2;
  const originCenterY = dragState.originRect.y + dragState.originRect.height / 2;

  const ghostText =
    dragState.sourceNode.title ?? dragState.sourceNode.content;

  const overlayNode = (
    <>
      {/* SVG origin-line — zIndex 9000 — below ghost so the ghost reads on top. */}
      <svg
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9000,
          pointerEvents: 'none',
        }}
      >
        <line
          x1={originCenterX}
          y1={originCenterY}
          x2={dragState.pointerX}
          y2={dragState.pointerY}
          stroke="var(--primary-40)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      </svg>

      {/* Halo on snap target — zIndex 8999 — below origin-line so the line passes over its edge. */}
      {snappedTarget !== null && haloColor !== null && (
        <div
          style={{
            position: 'fixed',
            left: snappedTarget.rect.x,
            top: snappedTarget.rect.y,
            width: snappedTarget.rect.width,
            height: snappedTarget.rect.height,
            border: `3px solid ${haloColor}`,
            borderRadius: 'var(--radius-xl)',
            zIndex: 8999,
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* Ghost div — zIndex 9001 — tracks pointer. */}
      <div
        data-snapped-target-id={snappedTarget?.id ?? undefined}
        style={{
          position: 'fixed',
          left: dragState.pointerX - dragState.ghostRect.width / 2,
          top: dragState.pointerY - dragState.ghostRect.height / 2,
          width: dragState.ghostRect.width,
          padding: '10px 18px',
          borderRadius: '18px',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          boxShadow: 'var(--shadow-2)',
          color: 'var(--foreground)',
          fontSize: '0.85rem',
          fontWeight: 600,
          opacity: 0.65,
          transition: 'left 80ms, top 80ms',
          zIndex: 9001,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {ghostText}
      </div>
    </>
  );

  return createPortal(overlayNode, document.body);
}
