import { useState, useCallback, useEffect } from 'react';
import type { PlannerChunk, LearningCheckIn, ChunkStatus } from '../types';
import { plannerService } from '../services/planner.service';
import { eventBus } from '../lib/event-bus';

interface UsePlannerReturn {
  // Data
  continueChunks: PlannerChunk[];
  suggestedChunks: PlannerChunk[];
  savedChunks: PlannerChunk[];
  recentCheckIns: LearningCheckIn[];
  isLoading: boolean;

  // Actions
  refresh: () => void;
  updateChunkStatus: (chunkId: string, status: ChunkStatus) => void;
  deleteChunk: (chunkId: string) => void;
  submitCheckIn: (content: string) => Promise<LearningCheckIn>;
}

export function usePlanner(): UsePlannerReturn {
  const [continueChunks, setContinueChunks] = useState<PlannerChunk[]>([]);
  const [suggestedChunks, setSuggestedChunks] = useState<PlannerChunk[]>([]);
  const [savedChunks, setSavedChunks] = useState<PlannerChunk[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<LearningCheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    setContinueChunks(plannerService.getActiveChunks());
    setSuggestedChunks(plannerService.getSuggestedChunks());
    setSavedChunks(plannerService.getSavedChunks());
    setRecentCheckIns(plannerService.getCheckIns().slice(-10).reverse());
  }, []);

  // Auto-refresh when planner data changes from another surface (e.g. Home feed,
  // background sync). Without this the Planner screen shows stale data until a
  // manual refresh or navigation event.
  useEffect(() => {
    refresh();
    const unsub = eventBus.subscribe('PLANNER_UPDATED', () => refresh());
    return unsub;
  }, [refresh]);

  const updateChunkStatus = useCallback((chunkId: string, status: ChunkStatus) => {
    plannerService.updateChunkStatus(chunkId, status);
    refresh();
  }, [refresh]);

  const deleteChunk = useCallback((chunkId: string) => {
    plannerService.deleteChunk(chunkId);
    refresh();
  }, [refresh]);

  const submitCheckIn = useCallback(async (content: string): Promise<LearningCheckIn> => {
    setIsLoading(true);
    try {
      const checkIn = await plannerService.submitCheckIn(content);
      refresh();
      return checkIn;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  return {
    continueChunks, suggestedChunks, savedChunks, recentCheckIns,
    isLoading,
    refresh, updateChunkStatus, deleteChunk, submitCheckIn,
  };
}
