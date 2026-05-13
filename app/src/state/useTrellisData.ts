import { useCallback, useEffect, useRef, useState } from 'react';
import { buildTrellisState } from '../services/trellis-state.service.ts';
import type { TrellisLayout } from '../services/trellis-state.service.ts';
import { eventBus } from '../lib/event-bus.ts';
import { questionService } from '../services/question.service.ts';

export interface UseTrellisDataResult {
  layout: TrellisLayout;
  refresh: () => void;
}

// D-47: compute on mount (full pass). D-48: subscribe for targeted updates.
// D-49: no polling.
export function useTrellisData(): UseTrellisDataResult {
  const [layout, setLayout] = useState<TrellisLayout>({ nodes: [], vines: [] });
  const mountedRef = useRef(true);

  const recompute = useCallback(() => {
    try {
      const questions = questionService.getAll();
      const next = buildTrellisState(questions);
      if (mountedRef.current) setLayout(next);
    } catch (err) {
      console.warn('[useTrellisData] recompute failed', err);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    recompute();
    // D-48 subscriptions
    const unsubReview = eventBus.subscribe('REVIEW_COMPLETED', () => recompute());
    const unsubClass = eventBus.subscribe('GRAPH_UPDATED', () => recompute());
    const unsubDelete = eventBus.subscribe('ANCHOR_DELETED', () => recompute());
    const unsubHarvest = eventBus.subscribe('HARVEST_COMPLETED', () => recompute());
    return () => {
      mountedRef.current = false;
      unsubReview();
      unsubClass();
      unsubDelete();
      unsubHarvest();
    };
  }, [recompute]);

  return { layout, refresh: recompute };
}
