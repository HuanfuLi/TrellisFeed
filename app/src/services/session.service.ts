import type { ChatSession } from '../types';
import { eventBus } from '../lib/event-bus';

const SESSIONS_KEY = 'echolearn_sessions';
const ACTIVE_ID_KEY = 'echolearn_active_session';

let idCounter = Date.now();
function newId(): string {
  return `sess-${++idCounter}`;
}

function loadAll(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

function saveAll(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // ignore storage errors
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
    } catch {
      // ignore
    }
  },

  getActiveId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_ID_KEY);
    } catch {
      return null;
    }
  },

  createNew(): ChatSession {
    const now = Date.now();
    const session: ChatSession = {
      id: newId(),
      title: '',
      createdAt: now,
      updatedAt: now,
      messages: [],
      processed: false,
    };
    // Do NOT persist until first message — prevents empty sessions in history
    this.setActiveId(session.id);
    eventBus.emit({ type: 'SESSION_CREATED', payload: session });
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
