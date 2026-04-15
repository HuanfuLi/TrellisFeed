/**
 * @deprecated Phase 26 D-22: suggestedChunks were removed from PlannerScreen in
 * favor of trellis-health-driven suggested moves (see PlannerScreen.tsx + Plan 26-04).
 * This hook has no remaining consumers and is retained only to avoid breaking
 * any external imports. Safe to delete once no references surface.
 */
import { useState, useCallback, useEffect } from 'react';
import type { PlannerChunk } from '../types';
import { plannerService } from '../services/planner.service';
import { eventBus } from '../lib/event-bus';

interface UsePlannerReturn {
  suggestedChunks: PlannerChunk[];
  isLoading: boolean;
  refresh: () => void;
  deleteChunk: (chunkId: string) => void;
}

export function usePlanner(): UsePlannerReturn {
  const [suggestedChunks, setSuggestedChunks] = useState<PlannerChunk[]>([]);
  const [isLoading] = useState(false);

  const refresh = useCallback(() => {
    setSuggestedChunks(plannerService.getSuggestedChunks());
  }, []);

  useEffect(() => {
    refresh();
    const unsub = eventBus.subscribe('PLANNER_UPDATED', () => refresh());
    return unsub;
  }, [refresh]);

  const deleteChunk = useCallback((chunkId: string) => {
    plannerService.deleteChunk(chunkId);
    refresh();
  }, [refresh]);

  return { suggestedChunks, isLoading, refresh, deleteChunk };
}
