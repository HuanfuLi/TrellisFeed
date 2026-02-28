import type { DailyPodcast, ServiceResult } from '../types';
import { eventBus } from '../lib/event-bus';
import { mockSettingsService } from './mock/settings.mock';
import { questionService } from './question.service';
import { chatCompletion } from '../providers/llm';
import { synthesize } from '../providers/tts';

const STORAGE_KEY = 'echolearn_podcasts';
const audioBlobUrls = new Map<string, string>();

let podcastIdCounter = Date.now();
function newPodcastId(): string {
  return `pod-${++podcastIdCounter}`;
}

function loadStore(): DailyPodcast[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DailyPodcast[];
  } catch {
    return [];
  }
}

function saveStore(podcasts: DailyPodcast[]): void {
  try {
    // Strip audioPath before saving — blob URLs don't survive page reload
    const toSave = podcasts.map((p) => {
      const copy = { ...p };
      delete copy.audioPath;
      return copy;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

function patchPodcast(id: string, patch: Partial<DailyPodcast>): DailyPodcast[] {
  const store = loadStore();
  const updated = store.map((p) => (p.id === id ? { ...p, ...patch } : p));
  saveStore(updated);
  return updated;
}

export const podcastService = {
  async getPodcast(date: string): Promise<ServiceResult<DailyPodcast | null>> {
    const pod = loadStore().find((p) => p.date === date);
    return { success: true, data: pod ?? null };
  },

  async getPodcasts(limit = 20): Promise<ServiceResult<DailyPodcast[]>> {
    const sorted = [...loadStore()].sort((a, b) => b.createdAt - a.createdAt);
    return { success: true, data: sorted.slice(0, limit) };
  },

  async generatePodcast(date: string): Promise<ServiceResult<DailyPodcast>> {
    const existing = loadStore().find((p) => p.date === date);

    // Only skip if podcast is ready AND audio blob is still in memory.
    // Blob URLs are lost on page reload, so a 'ready' podcast without a blob
    // still needs to re-synthesize audio.
    if (existing?.status === 'ready' && audioBlobUrls.has(existing.id)) {
      return { success: true, data: existing };
    }

    const id = existing?.id ?? newPodcastId();
    const settings = mockSettingsService.getSync();

    // Load questions for date, fall back to 5 most recent
    const byDateResult = await questionService.getByDate(date);
    let questions = byDateResult.data ?? [];
    if (questions.length === 0) {
      const recentResult = await questionService.getRecent(5);
      questions = recentResult.data ?? [];
    }

    const pod: DailyPodcast = {
      id,
      date,
      questionIds: questions.map((q) => q.id),
      script: existing?.script ?? '',   // preserve existing script if re-generating audio
      status: 'generating',
      progress: 0,
      createdAt: existing?.createdAt ?? Date.now(),
    };

    const store = loadStore();
    saveStore([pod, ...store.filter((p) => p.date !== date)]);
    eventBus.emit({ type: 'PODCAST_GENERATION_STARTED', payload: { podcastId: id, date } });

    // Run generation asynchronously so caller gets the pending pod immediately
    void (async () => {
      try {
        // Step 1: generate script (30%) — skip LLM if script already exists
        patchPodcast(id, { progress: 30 });
        eventBus.emit({
          type: 'PODCAST_GENERATION_PROGRESS',
          payload: { podcastId: id, progress: 30 },
        });

        let script: string;
        if (existing?.script) {
          // Reuse existing script — only audio synthesis is needed
          script = existing.script;
        } else if (!settings.llm.isConfigured || questions.length === 0) {
          script = `Welcome to your daily EchoLearn podcast for ${date}! You reviewed ${questions.length} topic(s) today. Keep learning!`;
        } else {
          const questionLines = questions
            .map((q) => `- ${q.content}: ${q.summary}`)
            .join('\n');
          script = await chatCompletion(
            [
              {
                role: 'system',
                content:
                  'Write a 90-second spoken podcast recap. Conversational radio style. No stage directions, no music cues. Just the words to be spoken.',
              },
              {
                role: 'user',
                content: `Create a daily learning recap for:\n${questionLines}`,
              },
            ],
            settings.llm,
          );
        }

        // Step 2: synthesize audio (80%)
        patchPodcast(id, { progress: 80, script });
        eventBus.emit({
          type: 'PODCAST_GENERATION_PROGRESS',
          payload: { podcastId: id, progress: 80 },
        });

        let duration: number | undefined;
        if (settings.tts.isConfigured) {
          try {
            const blobUrl = await synthesize(script, settings.tts);
            audioBlobUrls.set(id, blobUrl);
            duration = Math.round(script.length / 15); // rough estimate: ~15 chars/second
          } catch {
            // TTS failure is non-fatal — podcast is still ready without audio
          }
        }

        const completed: DailyPodcast = {
          id,
          date,
          questionIds: questions.map((q) => q.id),
          script,
          status: 'ready',
          progress: 100,
          duration,
          createdAt: pod.createdAt,
        };

        patchPodcast(id, completed);
        eventBus.emit({
          type: 'PODCAST_GENERATION_PROGRESS',
          payload: { podcastId: id, progress: 100 },
        });
        eventBus.emit({ type: 'PODCAST_GENERATION_COMPLETED', payload: completed });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        patchPodcast(id, { status: 'failed', error });
        eventBus.emit({
          type: 'PODCAST_GENERATION_FAILED',
          payload: { podcastId: id, error },
        });
      }
    })();

    return { success: true, data: pod };
  },

  async retryGeneration(podcastId: string): Promise<ServiceResult<DailyPodcast>> {
    const pod = loadStore().find((p) => p.id === podcastId);
    if (!pod) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Podcast not found', retryable: false },
      };
    }
    return this.generatePodcast(pod.date);
  },

  getAudioPath(podcastId: string): ServiceResult<string> {
    const blobUrl = audioBlobUrls.get(podcastId);
    if (!blobUrl) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No audio available. Regenerate to get audio.',
          retryable: true,
        },
      };
    }
    return { success: true, data: blobUrl };
  },

  async deletePodcast(podcastId: string): Promise<ServiceResult<void>> {
    const blobUrl = audioBlobUrls.get(podcastId);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      audioBlobUrls.delete(podcastId);
    }
    saveStore(loadStore().filter((p) => p.id !== podcastId));
    return { success: true };
  },

  getAll(): DailyPodcast[] {
    return loadStore();
  },
};
