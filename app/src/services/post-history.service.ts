// Post history stores ID-only observation metadata for immutable frozen posts.
import { eventBus } from '../lib/event-bus.ts';
import { dbExecute, dbQuery } from './db.service.ts';

export interface PostHistoryEntry {
  postId: string;
  viewedAt: string;
}

let _store: PostHistoryEntry[] = [];
let hydrated = false;

function isHistoryEntry(value: unknown): value is PostHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PostHistoryEntry>;
  return typeof candidate.postId === 'string'
    && typeof candidate.viewedAt === 'string'
    && Number.isFinite(Date.parse(candidate.viewedAt));
}

export async function hydratePostHistoryFromSQLite(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    if (_store.length > 0) return;
    const rows = await dbQuery<{ id: string; data: string }>('SELECT * FROM post_history');
    const restored: PostHistoryEntry[] = [];
    for (const row of rows) {
      try {
        const parsed: unknown = JSON.parse(row.data);
        if (isHistoryEntry(parsed)) restored.push(parsed);
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
    _store = _store.filter((record) => record.postId !== postId);
    _store.push(entry);
    await dbExecute('INSERT OR REPLACE INTO post_history (id, data) VALUES (?, ?)', [
      postId,
      JSON.stringify(entry),
    ]);
    eventBus.emit({ type: 'GRAPH_UPDATED' });
  },

  getEntries(): PostHistoryEntry[] {
    return _store
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

  clear(): void {
    _store = [];
    void dbExecute('DELETE FROM post_history').catch(() => { /* ignore */ });
  },
};
