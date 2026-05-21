// Post history service — 7-day rolling post history with day grouping (Phase 31, D-12/D-13).
// Stores all displayed posts with dedup, supports configurable retention purge.

import type { DailyPost } from '../types/index.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService } from './settings.service.ts';
import { engagementService } from './engagement.service.ts';
import { dbExecute, dbQuery } from './db.service.ts';

// Phase 55-07: IndexedDB is the SOLE persistence for post history. The
// module-level `_store` is the synchronous read+write mirror; it starts empty
// and is populated from IndexedDB by hydratePostHistoryFromSQLite() at boot.
// No localStorage write-through for `trellis_post_history` anymore.
let _store: DailyPost[] = [];

function loadPosts(): DailyPost[] {
  // The mirror only ever holds valid DailyPost objects (added via addPost /
  // hydrate, both shape-checked at their boundary). No re-validation needed —
  // the prior filter guarded against corrupt localStorage JSON, which is gone.
  return _store;
}

function savePosts(posts: DailyPost[]): void {
  _store = posts;
  // IndexedDB write-through (D-09/D-12) — the durable store. Fire-and-forget so
  // a failed write does not block the sync mutator. Re-snapshot the whole table
  // each save (post-history is small + purge mutates the set, so a full
  // overwrite is the simplest correct shape).
  void persistAllToSQLite(posts);
}

async function persistAllToSQLite(posts: DailyPost[]): Promise<void> {
  try {
    await dbExecute('BEGIN');
    await dbExecute('DELETE FROM post_history');
    for (const p of posts) {
      await dbExecute('INSERT OR REPLACE INTO post_history (id, data) VALUES (?, ?)', [p.id, JSON.stringify(p)]);
    }
    await dbExecute('COMMIT');
  } catch {
    try { await dbExecute('ROLLBACK'); } catch { /* ignore */ }
  }
}

let hydrated = false;

/**
 * Boot hydration (D-12). Populates the localStorage mirror from SQLite when the
 * mirror is empty (the D-11 clean-cutover state). Guarded so a populated mirror
 * is never overwritten. Emits GRAPH_UPDATED so always-mounted screens re-read
 * (no-refresh assumption; reuses the unified resync signal — no new event type).
 */
export async function hydratePostHistoryFromSQLite(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    if (loadPosts().length > 0) return; // mirror already has data — trust it
    const rows = await dbQuery<{ id: string; data: string }>('SELECT * FROM post_history');
    if (rows.length === 0) return;
    const toAdd: DailyPost[] = [];
    for (const row of rows) {
      try {
        const p = JSON.parse(row.data) as DailyPost;
        if (p && typeof p.id === 'string' && typeof p.generatedAt === 'number' && typeof p.title === 'string') {
          toAdd.push(p);
        }
      } catch { /* skip corrupt */ }
    }
    if (toAdd.length > 0) {
      _store = toAdd;
      eventBus.emit({ type: 'GRAPH_UPDATED' });
    }
  } catch {
    // IndexedDB unavailable — silently skip
  }
}

export const postHistoryService = {
  /** Add a post to history (deduplicates by id). */
  addPost(post: DailyPost): void {
    const posts = loadPosts();
    if (posts.some(p => p.id === post.id)) return; // dedup
    posts.push(post);
    savePosts(posts);
  },

  /** Get all posts, sorted by generatedAt descending. */
  getPosts(): DailyPost[] {
    return loadPosts().sort((a, b) => b.generatedAt - a.generatedAt);
  },

  /** Group posts by date string, each group sorted by generatedAt desc. */
  getPostsByDay(): Map<string, DailyPost[]> {
    const posts = this.getPosts();
    const grouped = new Map<string, DailyPost[]>();
    for (const post of posts) {
      const day = post.date || new Date(post.generatedAt || Date.now()).toISOString().slice(0, 10);
      const arr = grouped.get(day) || [];
      arr.push(post);
      grouped.set(day, arr);
    }
    return grouped;
  },

  /** Purge posts older than the configured retention window. Respects keepAll (null). */
  purgeExpired(): void {
    const settings = settingsService.getSync();
    const retentionDays = settings.feed?.postRetentionDays;
    if (retentionDays == null || retentionDays <= 0) return; // keep all
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    // Phase 39 D-04: pin saved/liked posts against retention purge so a post
    // saved >retentionDays ago is not silently dropped from the snapshot store.
    // engagementService.getPinnedIds() returns saved ∪ liked (NOT dismissed).
    const pinned = engagementService.getPinnedIds();
    const posts = loadPosts().filter(p => pinned.has(p.id) || p.generatedAt > cutoff);
    savePosts(posts);
  },

  /** Clear all post history (mirror + IndexedDB). */
  clear(): void {
    _store = [];
    void dbExecute('DELETE FROM post_history').catch(() => { /* ignore */ });
  },
};
