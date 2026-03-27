/**
 * useDailyRefresh hook
 *
 * Triggers Planner suggestion refresh on:
 *  1. First app open of the day (last refresh > 24h ago)
 *  2. After podcast playback completes (PODCAST_GENERATION_COMPLETED event)
 *  3. Manual call to triggerRefresh()
 *
 * Debounces rapid refresh attempts (minimum 5 minutes between auto-refreshes).
 * Stores last refresh timestamp in settings.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { plannerAutoGenService } from '../services/plannerAutoGen.service';
import { eventBus } from '../lib/event-bus';

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes minimum between auto-refreshes

interface UseDailyRefreshReturn {
  isRefreshing: boolean;
  lastRefreshedAt: number;
  triggerRefresh: (force?: boolean) => Promise<void>;
}

export function useDailyRefresh(): UseDailyRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(
    () => plannerAutoGenService.getLastRefreshTime(),
  );
  const lastAutoRefreshRef = useRef<number>(0);

  const triggerRefresh = useCallback(async (force = false) => {
    if (isRefreshing) return;

    // Debounce: skip if auto-refresh happened very recently (unless forced).
    if (!force) {
      const timeSinceLast = Date.now() - lastAutoRefreshRef.current;
      if (timeSinceLast < DEBOUNCE_MS) return;
    }

    setIsRefreshing(true);
    lastAutoRefreshRef.current = Date.now();
    try {
      await plannerAutoGenService.generateAndStoreSuggestions(force);
      setLastRefreshedAt(plannerAutoGenService.getLastRefreshTime());
    } catch {
      // Non-critical background task — silent failure is acceptable
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // On mount: refresh if daily interval has elapsed
  useEffect(() => {
    if (plannerAutoGenService.isDailyRefreshNeeded()) {
      void triggerRefresh(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // After podcast completes: trigger refresh (podcast often follows learning sessions)
  useEffect(() => {
    const unsub = eventBus.subscribe('PODCAST_GENERATION_COMPLETED', () => {
      void triggerRefresh(false);
    });
    return unsub;
  }, [triggerRefresh]);

  return { isRefreshing, lastRefreshedAt, triggerRefresh };
}
