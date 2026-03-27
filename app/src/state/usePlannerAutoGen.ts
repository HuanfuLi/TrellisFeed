/**
 * usePlannerAutoGen hook
 *
 * Manages the auto-generation lifecycle:
 *  - Loads persisted moves on mount
 *  - Triggers auto-gen when conditions are met (on mount + PLANNER_UPDATED)
 *  - Handles daily refresh
 *  - Provides accept/dismiss/skipAll/refresh actions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { PlannedMove } from '../types';
import { plannerAutoGenService } from '../services/plannerAutoGen.service';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';

interface UsePlannerAutoGenReturn {
  moves: PlannedMove[];
  isRefreshing: boolean;
  accept: (moveId: string) => void;
  dismiss: (moveId: string) => void;
  skipAll: () => void;
  refresh: () => Promise<void>;
}

export function usePlannerAutoGen(): UsePlannerAutoGenReturn {
  const [moves, setMoves] = useState<PlannedMove[]>(() => plannerAutoGenService.getMoves());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use a ref to prevent concurrent generation runs.
  const isGeneratingRef = useRef(false);

  const loadMoves = useCallback(() => {
    setMoves(plannerAutoGenService.getMoves());
  }, []);

  const runAutoGenIfNeeded = useCallback(async () => {
    if (isGeneratingRef.current) return;

    const shouldGenerate = plannerAutoGenService.shouldAutoGenerate();
    const needsRefresh = plannerAutoGenService.isDailyRefreshNeeded();

    if (!shouldGenerate && !needsRefresh) return;

    isGeneratingRef.current = true;
    try {
      await plannerAutoGenService.generateAndStoreSuggestions();
      setMoves(plannerAutoGenService.getMoves());
    } catch {
      // Non-critical — silently fail
    } finally {
      isGeneratingRef.current = false;
    }
  }, []);

  // Initial load + auto-gen check
  useEffect(() => {
    loadMoves();
    void runAutoGenIfNeeded();
  }, [loadMoves, runAutoGenIfNeeded]);

  // Refresh moves when planner data changes (e.g. after check-in adds new chunks)
  useEffect(() => {
    const unsub = eventBus.subscribe('PLANNER_UPDATED', () => {
      loadMoves();
    });
    return unsub;
  }, [loadMoves]);

  const accept = useCallback((moveId: string) => {
    const ok = plannerAutoGenService.acceptMove(moveId);
    if (ok) {
      setMoves(plannerAutoGenService.getMoves());
      toast('Added to Planner!', 'success');
    }
  }, []);

  const dismiss = useCallback((moveId: string) => {
    plannerAutoGenService.dismissMove(moveId);
    setMoves(plannerAutoGenService.getMoves());
  }, []);

  const skipAll = useCallback(() => {
    plannerAutoGenService.dismissAllAutoMoves();
    setMoves(plannerAutoGenService.getMoves());
  }, []);

  const refresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await plannerAutoGenService.generateAndStoreSuggestions(true);
      setMoves(plannerAutoGenService.getMoves());
      toast('Suggestions refreshed!', 'success');
    } catch {
      toast('Refresh failed', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return { moves, isRefreshing, accept, dismiss, skipAll, refresh };
}
