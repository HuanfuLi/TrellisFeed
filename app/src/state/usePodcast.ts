import { useState, useEffect, useCallback } from 'react';
import type { DailyPodcast, ServiceError, PodcastOptions } from '../types';
import { podcastService } from '../services/podcast.service';
import { eventBus } from '../lib/event-bus';

interface UsePodcastReturn {
  podcasts: DailyPodcast[];
  isLoading: boolean;
  isGenerating: boolean;
  generationProgress: number;
  error: ServiceError | null;
  getPodcastForDate: (date: string) => DailyPodcast | undefined;
  generatePodcast: (date: string, conceptIds?: string[], options?: PodcastOptions) => Promise<void>;
  deletePodcast: (podcastId: string) => Promise<void>;
  getAudioPath: (podcastId: string) => string | null;
  reload: () => Promise<void>;
}

export function usePodcast(): UsePodcastReturn {
  const [podcasts, setPodcasts] = useState<DailyPodcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState<ServiceError | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    const result = await podcastService.getPodcasts(20);
    if (result.success && result.data) {
      setPodcasts(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();

    const unsubProgress = eventBus.subscribe('PODCAST_GENERATION_PROGRESS', (e) => {
      setGenerationProgress(e.payload.progress);
      setPodcasts((prev) =>
        prev.map((p) =>
          p.id === e.payload.podcastId ? { ...p, progress: e.payload.progress } : p,
        ),
      );
    });

    const unsubCompleted = eventBus.subscribe('PODCAST_GENERATION_COMPLETED', (e) => {
      setIsGenerating(false);
      setGenerationProgress(0);
      setPodcasts((prev) => {
        const exists = prev.find((p) => p.id === e.payload.id);
        if (exists) {
          return prev.map((p) => (p.id === e.payload.id ? e.payload : p));
        }
        return [e.payload, ...prev];
      });
    });

    const unsubFailed = eventBus.subscribe('PODCAST_GENERATION_FAILED', (e) => {
      setIsGenerating(false);
      setPodcasts((prev) =>
        prev.map((p) =>
          p.id === e.payload.podcastId ? { ...p, status: 'failed', error: e.payload.error } : p,
        ),
      );
    });

    return () => {
      unsubProgress();
      unsubCompleted();
      unsubFailed();
    };
  }, [reload]);

  const getPodcastForDate = useCallback(
    (date: string): DailyPodcast | undefined => podcasts.find((p) => p.date === date),
    [podcasts],
  );

  const generatePodcast = useCallback(async (date: string, conceptIds?: string[], options?: PodcastOptions) => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setError(null);
    const result = await podcastService.generatePodcast(date, conceptIds, options);
    if (result.success && result.data) {
      setPodcasts((prev) => {
        const exists = prev.find((p) => p.id === result.data!.id);
        if (exists) return prev.map((p) => (p.id === result.data!.id ? result.data! : p));
        return [result.data!, ...prev];
      });
    } else {
      setError(result.error ?? null);
      setIsGenerating(false);
    }
  }, []);

  const getAudioPath = useCallback((podcastId: string): string | null => {
    const result = podcastService.getAudioPath(podcastId);
    return result.success ? (result.data ?? null) : null;
  }, []);

  const deletePodcast = useCallback(async (podcastId: string) => {
    await podcastService.deletePodcast(podcastId);
    setPodcasts((prev) => prev.filter((p) => p.id !== podcastId));
  }, []);

  return {
    podcasts,
    isLoading,
    isGenerating,
    generationProgress,
    error,
    getPodcastForDate,
    generatePodcast,
    deletePodcast,
    getAudioPath,
    reload,
  };
}
