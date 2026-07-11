import type { ChatSession, DailyPost, SessionOrigin } from '../types';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';
import { t } from '../lib/i18n-leaf.ts';
import { conceptFeedService } from './concept-feed.service';
import { dbExecute, dbQuery } from './db.service.ts';

// Phase 55-07: the sessions ARRAY persists ONLY to IndexedDB. The module-level
// `_store` is the synchronous read+write mirror (starts empty, hydrated from
// IndexedDB at boot). The tiny active-session-ID pointer (ACTIVE_ID_KEY) stays
// in localStorage — it is a boot-critical pref, not a heavy store.
const ACTIVE_ID_KEY = 'questiontrace_active_session';

let _store: ChatSession[] = [];

let idCounter = Date.now();
function newId(): string {
  return `sess-${++idCounter}`;
}

function loadAll(): ChatSession[] {
  return _store;
}

function saveAll(sessions: ChatSession[]): void {
  _store = sessions;
  // IndexedDB write-through (D-09/D-12) — transaction-wrapped full-table
  // snapshot. The in-memory mirror is the synchronous read path; IndexedDB is
  // the sole durable store.
  void (async () => {
    try {
      await dbExecute('BEGIN');
      await dbExecute('DELETE FROM sessions');
      for (const s of sessions) {
        await dbExecute('INSERT OR REPLACE INTO sessions (id, data) VALUES (?, ?)', [s.id, JSON.stringify(s)]);
      }
      await dbExecute('COMMIT');
    } catch {
      try { await dbExecute('ROLLBACK'); } catch { /* ignore */ }
    }
  })();
}

let _hydratedSessions = false;

/**
 * Boot hydration (D-12). Restore the sessions mirror from SQLite when the mirror
 * is empty (D-11 clean-cutover state). Guarded so a populated mirror is never
 * overwritten. Emits SESSION_UPDATED so always-mounted Ask consumers re-read.
 */
export async function hydrateSessionsFromSQLite(): Promise<void> {
  if (_hydratedSessions) return;
  _hydratedSessions = true;
  try {
    if (loadAll().length > 0) return; // mirror already has data — trust it
    const rows = await dbQuery<{ id: string; data: string }>('SELECT * FROM sessions');
    if (rows.length === 0) return;
    const toAdd: ChatSession[] = [];
    for (const row of rows) {
      try { toAdd.push(JSON.parse(row.data) as ChatSession); } catch { /* skip corrupt */ }
    }
    if (toAdd.length > 0) {
      _store = toAdd;
      eventBus.emit({ type: 'SESSION_UPDATED', payload: { id: '*' } });
    }
  } catch {
    // IndexedDB unavailable — silently skip
  }
}

export const sessionService = {
  getAll(): ChatSession[] {
    return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  getById(id: string): ChatSession | null {
    return loadAll().find((s) => s.id === id) ?? null;
  },

  getActive(): ChatSession {
    const activeId = this.getActiveId();
    if (activeId) {
      const session = this.getById(activeId);
      if (session) return session;
    }
    return this.createNew();
  },

  save(session: ChatSession): void {
    const all = loadAll();
    const idx = all.findIndex((s) => s.id === session.id);
    const updated = { ...session, updatedAt: Date.now() };
    if (idx !== -1) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    saveAll(all);
    eventBus.emit({ type: 'SESSION_UPDATED', payload: { id: session.id } });
  },

  setActiveId(id: string): void {
    try {
      localStorage.setItem(ACTIVE_ID_KEY, id);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        toast(t('common.toast.storageFullActiveSession'), 'error');
      }
    }
  },

  getActiveId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_ID_KEY);
    } catch {
      return null;
    }
  },

  createNew(origin?: SessionOrigin): ChatSession {
    const now = Date.now();
    const session: ChatSession = {
      id: newId(),
      title: '',
      createdAt: now,
      updatedAt: now,
      messages: [],
      processed: false,
      ...(origin ? { origin } : {}),
    };
    // Do NOT persist until first message — prevents empty sessions in history
    this.setActiveId(session.id);
    eventBus.emit({ type: 'SESSION_CREATED', payload: session });
    return session;
  },

  getOrCreatePostSession(post: DailyPost, allQuestions: Parameters<typeof conceptFeedService.buildPostOriginContext>[1]): ChatSession {
    const existing = this.getAll().find((session) => session.origin?.type === 'post' && session.origin.postId === post.id);
    if (existing) {
      this.setActiveId(existing.id);
      return existing;
    }

    const origin: SessionOrigin = {
      type: 'post',
      postId: post.id,
      postTitle: post.title,
      context: conceptFeedService.buildPostOriginContext(post, allQuestions),
    };
    const session = this.createNew(origin);
    session.title = `Post: ${post.title}`;
    return session;
  },

  delete(id: string): void {
    saveAll(loadAll().filter((s) => s.id !== id));
    if (this.getActiveId() === id) {
      try {
        localStorage.removeItem(ACTIVE_ID_KEY);
      } catch {
        // ignore
      }
    }
  },
};
