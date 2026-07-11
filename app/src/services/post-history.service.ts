// Post history stores observation metadata for immutable frozen posts.
// Generated-post snapshot methods remain temporarily for the transitional
// concept-feed shell and are removed with that shell in Plan 02-07.

import type { DailyPost } from '../types/index.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService } from './settings.service.ts';
import { engagementService } from './engagement.service.ts';
import { dbExecute, dbQuery } from './db.service.ts';

export interface PostHistoryEntry {
  postId: string;
  viewedAt: string;
}

type StoredHistoryRecord = DailyPost | PostHistoryEntry;

let _store: StoredHistoryRecord[] = [];
let hydrated = false;

function isHistoryEntry(value: unknown): value is PostHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PostHistoryEntry>;
  return typeof candidate.postId === 'string'
    && typeof candidate.viewedAt === 'string'
    && Number.isFinite(Date.parse(candidate.viewedAt));
}

function isLegacyPost(value: unknown): value is DailyPost {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DailyPost>;
  return typeof candidate.id === 'string'
    && typeof candidate.generatedAt === 'number'
    && typeof candidate.title === 'string';
}

function recordId(record: StoredHistoryRecord): string {
  return isHistoryEntry(record) ? record.postId : record.id;
}

function persistLegacySnapshot(): void {
  const snapshot = [..._store];
  void (async () => {
    try {
      await dbExecute('BEGIN');
      await dbExecute('DELETE FROM post_history');
      for (const record of snapshot) {
        await dbExecute('INSERT OR REPLACE INTO post_history (id, data) VALUES (?, ?)', [
          recordId(record),
          JSON.stringify(record),
        ]);
      }
      await dbExecute('COMMIT');
    } catch {
      try { await dbExecute('ROLLBACK'); } catch { /* ignore */ }
    }
  })();
}

export async function hydratePostHistoryFromSQLite(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    if (_store.length > 0) return;
    const rows = await dbQuery<{ id: string; data: string }>('SELECT * FROM post_history');
    const restored: StoredHistoryRecord[] = [];
    for (const row of rows) {
      try {
        const parsed: unknown = JSON.parse(row.data);
        if (isHistoryEntry(parsed) || isLegacyPost(parsed)) restored.push(parsed);
      } catch { /* skip corrupt rows */ }
    }
    if (restored.length > 0) {
      _store = restored;
      eventBus.emit({ type: 'GRAPH_UPDATED' });
    }
  } catch {
    // IndexedDB unavailable — keep the synchronous mirror empty.
  }
}

export const postHistoryService = {
  async recordPostViewed(postId: string, viewedAt = new Date().toISOString()): Promise<void> {
    if (!postId || !Number.isFinite(Date.parse(viewedAt))) {
      throw new Error('Invalid post history entry');
    }
    const entry: PostHistoryEntry = { postId, viewedAt };
    _store = _store.filter((record) => recordId(record) !== postId);
    _store.push(entry);
    await dbExecute('INSERT OR REPLACE INTO post_history (id, data) VALUES (?, ?)', [
      postId,
      JSON.stringify(entry),
    ]);
    eventBus.emit({ type: 'GRAPH_UPDATED' });
  },

  getEntries(): PostHistoryEntry[] {
    return _store
      .filter(isHistoryEntry)
      .map((entry) => ({ ...entry }))
      .sort((a, b) => Date.parse(b.viewedAt) - Date.parse(a.viewedAt));
  },

  getViewedPostIds(): string[] {
    return this.getEntries().map((entry) => entry.postId);
  },

  getEntriesByDay(): Map<string, PostHistoryEntry[]> {
    const grouped = new Map<string, PostHistoryEntry[]>();
    for (const entry of this.getEntries()) {
      const day = entry.viewedAt.slice(0, 10);
      const entries = grouped.get(day) ?? [];
      entries.push(entry);
      grouped.set(day, entries);
    }
    return grouped;
  },

  // Legacy generated-feed compatibility. Frozen content never enters these
  // methods: Saved and PostDetail resolve immutable records from the facade.
  addPost(post: DailyPost): void {
    if (_store.some((record) => recordId(record) === post.id)) return;
    _store.push(post);
    persistLegacySnapshot();
  },

  getPosts(): DailyPost[] {
    return _store
      .filter(isLegacyPost)
      .sort((a, b) => b.generatedAt - a.generatedAt);
  },

  patchPost(postId: string, patch: Partial<DailyPost>): boolean {
    const index = _store.findIndex((record) => isLegacyPost(record) && record.id === postId);
    if (index === -1) return false;
    _store[index] = { ...(_store[index] as DailyPost), ...patch };
    persistLegacySnapshot();
    return true;
  },

  getPostsByDay(): Map<string, DailyPost[]> {
    const grouped = new Map<string, DailyPost[]>();
    for (const post of this.getPosts()) {
      const day = post.date || new Date(post.generatedAt).toISOString().slice(0, 10);
      const posts = grouped.get(day) ?? [];
      posts.push(post);
      grouped.set(day, posts);
    }
    return grouped;
  },

  purgeExpired(): void {
    const retentionDays = settingsService.getSync().feed?.postRetentionDays;
    if (retentionDays == null || retentionDays <= 0) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const pinned = engagementService.getPinnedIds();
    _store = _store.filter((record) => isHistoryEntry(record)
      || pinned.has(record.id)
      || record.generatedAt > cutoff);
    persistLegacySnapshot();
  },

  clear(): void {
    _store = [];
    void dbExecute('DELETE FROM post_history').catch(() => { /* ignore */ });
  },
};
