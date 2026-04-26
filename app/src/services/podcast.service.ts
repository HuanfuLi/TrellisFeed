import type { DailyPodcast, Question, ServiceResult } from '../types';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';
import i18n from '../locales';
import { settingsService } from './settings.service';
import { questionService } from './question.service';
import { chatCompletion } from '../providers/llm';
import { synthesize } from '../providers/tts';

const STORAGE_KEY = 'echolearn_podcasts';
const audioBlobUrls = new Map<string, string>();

let podcastIdCounter = Date.now();
function newPodcastId(): string {
  return `pod-${++podcastIdCounter}`;
}

// ─── IndexedDB audio storage ─────────────────────────────────────────────────
// Audio blobs are stored in IndexedDB instead of localStorage to avoid the
// ~5 MB localStorage quota. IndexedDB allows hundreds of MB.

const IDB_NAME = 'echolearn_audio';
const IDB_STORE = 'blobs';
const IDB_VERSION = 1;

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveAudioBlob(podcastId: string, blobUrl: string): Promise<void> {
  try {
    const resp = await fetch(blobUrl);
    const blob = await resp.blob();
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, podcastId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Non-fatal — audio works this session but not after reload
  }
}

async function loadAudioBlob(podcastId: string): Promise<string | null> {
  try {
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(podcastId);
      req.onsuccess = () => {
        db.close();
        const blob = req.result as Blob | undefined;
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return null;
  }
}

async function deleteAudioBlob(podcastId: string): Promise<void> {
  try {
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(podcastId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Non-fatal
  }
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

/** Restore in-memory blob URLs from IndexedDB for all podcasts that have audio persisted. */
async function hydrateAudioBlobUrls(): Promise<void> {
  const podcasts = loadStore();
  for (const p of podcasts) {
    if (p.status === 'ready' && !audioBlobUrls.has(p.id)) {
      const blobUrl = await loadAudioBlob(p.id);
      if (blobUrl) audioBlobUrls.set(p.id, blobUrl);
    }
  }
}

// Kick off hydration on module load (fire-and-forget)
void hydrateAudioBlobUrls();

function saveStore(podcasts: DailyPodcast[]): void {
  try {
    // Strip transient fields — audio is persisted in IndexedDB, not localStorage.
    const toSave = podcasts.map((p) => {
      const copy = { ...p };
      delete copy.audioPath;
      delete copy.audioDataUri;
      return copy;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast(i18n.t('common.toast.storageFullPodcast'), 'error');
    }
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

  async generatePodcast(date: string, conceptIds?: string[]): Promise<ServiceResult<DailyPodcast>> {
    const existing = loadStore().find((p) => p.date === date);

    // Only skip if podcast is ready AND audio blob is available (in-memory or restored from dataUri)
    if (existing?.status === 'ready' && audioBlobUrls.has(existing.id)) {
      return { success: true, data: existing };
    }

    const id = existing?.id ?? newPodcastId();
    const settings = settingsService.getSync();

    // Use provided concept IDs (from Knowledge Today list) or fall back to SM-2 due list
    let questions: Question[];
    if (conceptIds && conceptIds.length > 0) {
      const allQ = questionService.getAll();
      const idSet = new Set(conceptIds);
      questions = allQ.filter((q) => idSet.has(q.id));
    } else {
      const dueResult = await questionService.getDueForReview(date);
      questions = dueResult.data ?? [];
    }
    if (questions.length === 0) {
      const recentResult = await questionService.getRecent(5);
      questions = recentResult.data ?? [];
    }

    const pod: DailyPodcast = {
      id,
      date,
      questionIds: questions.map((q) => q.id),
      script: existing?.script ?? '',
      status: 'generating',
      progress: 0,
      createdAt: existing?.createdAt ?? Date.now(),
    };

    const store = loadStore();
    saveStore([pod, ...store.filter((p) => p.date !== date)]);
    eventBus.emit({ type: 'PODCAST_GENERATION_STARTED', payload: { podcastId: id, date } });

    void (async () => {
      try {
        // Step 1: generate script (30%) — skip LLM if script already exists
        patchPodcast(id, { progress: 30 });
        eventBus.emit({ type: 'PODCAST_GENERATION_PROGRESS', payload: { podcastId: id, progress: 30 } });

        let script: string;
        if (existing?.script) {
          script = existing.script;
        } else if (!settings.llm.isConfigured || questions.length === 0) {
          script = `Welcome to your daily Trellis podcast for ${date}! You reviewed ${questions.length} topic(s) today. Keep learning!`;
        } else {
          const questionLines = questions.map((q) => `- ${q.content}: ${q.summary}`).join('\n');
          script = await chatCompletion(
            [
              { role: 'system', content: 'Write a 90-second spoken podcast recap. Conversational radio style. No stage directions, no music cues. Just the words to be spoken.' },
              { role: 'user', content: `Create a daily learning recap for:\n${questionLines}` },
            ],
            settings.llm,
            { serviceName: 'podcast' },
          );
        }

        // Step 2: synthesize audio (80%)
        patchPodcast(id, { progress: 80, script });
        eventBus.emit({ type: 'PODCAST_GENERATION_PROGRESS', payload: { podcastId: id, progress: 80 } });

        // When TTS provider is OpenAI and no dedicated TTS key was entered,
        // fall back to the LLM API key — they share the same OpenAI credentials.
        const effectiveTtsKey =
          settings.tts.apiKey ||
          (settings.tts.provider === 'openai' ? (settings.llm.apiKey ?? '') : '');
        const ttsReady =
          settings.tts.provider === 'openai'
            ? !!effectiveTtsKey
            : settings.tts.isConfigured;
        const ttsConfig = { ...settings.tts, apiKey: effectiveTtsKey };

        let duration: number | undefined;
        if (ttsReady) {
          try {
            const blobUrl = await synthesize(script, ttsConfig);
            audioBlobUrls.set(id, blobUrl);
            duration = Math.round(script.length / 15);

            // Persist audio blob to IndexedDB so it survives page reloads
            // without consuming the limited localStorage quota.
            await saveAudioBlob(id, blobUrl);
          } catch (ttsErr) {
            // TTS failure is non-fatal — podcast is still ready, but inform the user
            const msg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
            toast(
              msg.includes('401') || msg.includes('Unauthorized') || msg.includes('API key')
                ? 'TTS: Invalid API key — check Settings.'
                : `TTS audio failed: ${msg.slice(0, 80)}`,
              'error',
            );
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
        eventBus.emit({ type: 'PODCAST_GENERATION_PROGRESS', payload: { podcastId: id, progress: 100 } });
        eventBus.emit({ type: 'PODCAST_GENERATION_COMPLETED', payload: completed });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        patchPodcast(id, { status: 'failed', error });
        eventBus.emit({ type: 'PODCAST_GENERATION_FAILED', payload: { podcastId: id, error } });
      }
    })();

    return { success: true, data: pod };
  },

  async retryGeneration(podcastId: string): Promise<ServiceResult<DailyPodcast>> {
    const pod = loadStore().find((p) => p.id === podcastId);
    if (!pod) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Podcast not found', retryable: false } };
    }
    return this.generatePodcast(pod.date);
  },

  getAudioPath(podcastId: string): ServiceResult<string> {
    const blobUrl = audioBlobUrls.get(podcastId);
    if (!blobUrl) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'No audio available. Regenerate to get audio.', retryable: true },
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
    await deleteAudioBlob(podcastId);
    saveStore(loadStore().filter((p) => p.id !== podcastId));
    return { success: true };
  },

  getAll(): DailyPodcast[] {
    return loadStore();
  },

  /** Return the questionIds for today's podcast (empty if none exists). */
  getTodayConceptIds(date: string): string[] {
    const pod = loadStore().find((p) => p.date === date);
    return pod?.questionIds ?? [];
  },

  /**
   * Add a concept to today's podcast context.
   * Returns true if added, false if already present or no podcast exists.
   * The podcast script must be regenerated separately after insertion.
   */
  addConceptToPodcast(date: string, questionId: string): boolean {
    const store = loadStore();
    const pod = store.find((p) => p.date === date);
    if (!pod) return false;
    if (pod.questionIds.includes(questionId)) return false;

    pod.questionIds = [...pod.questionIds, questionId];
    // Clear existing script/audio so regeneration picks up the new concept
    pod.script = '';
    pod.status = 'pending';
    pod.duration = undefined;
    const blobUrl = audioBlobUrls.get(pod.id);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      audioBlobUrls.delete(pod.id);
    }

    saveStore(store);
    eventBus.emit({ type: 'PODCAST_CONCEPT_ADDED', payload: { podcastId: pod.id, questionId } });
    return true;
  },
};
