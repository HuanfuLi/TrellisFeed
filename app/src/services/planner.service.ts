import type {
  PlannerChunk, PlannerThread, LearningCheckIn, PlannerData,
  ChunkStatus, CheckInSignals,
} from '../types';
import { chatCompletion } from '../providers/llm/index.ts';
import { mockSettingsService } from './mock/settings.mock.ts';
import { eventBus } from '../lib/event-bus.ts';
import { dbExecute, dbQuery } from './db.service.ts';

// ── Persistence ────────────────────────────────────────────────────────────

const CHUNKS_KEY = 'echolearn_planner_chunks';
const THREADS_KEY = 'echolearn_planner_threads';
const CHECKINS_KEY = 'echolearn_planner_checkins';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore storage errors */ }
}

// ── SQLite write-through helpers ───────────────────────────────────────────
// DDL lives in db.service.ts (_runMigrations). These helpers only do DML.

function persistChunkToSQLite(chunk: PlannerChunk): void {
  void dbExecute('INSERT OR REPLACE INTO planner_chunks (id, data) VALUES (?, ?)', [chunk.id, JSON.stringify(chunk)]);
}

function deleteChunkFromSQLite(id: string): void {
  void dbExecute('DELETE FROM planner_chunks WHERE id = ?', [id]);
}

function persistThreadToSQLite(thread: PlannerThread): void {
  void dbExecute('INSERT OR REPLACE INTO planner_threads (id, data) VALUES (?, ?)', [thread.id, JSON.stringify(thread)]);
}

function deleteThreadFromSQLite(id: string): void {
  void dbExecute('DELETE FROM planner_threads WHERE id = ?', [id]);
}

function persistCheckInToSQLite(checkIn: LearningCheckIn): void {
  void dbExecute('INSERT OR REPLACE INTO planner_checkins (id, data) VALUES (?, ?)', [checkIn.id, JSON.stringify(checkIn)]);
}

let plannerHydrated = false;

/**
 * On startup, hydrate planner data from SQLite into localStorage.
 * This ensures Planner data survives WebView localStorage clears on native.
 */
export async function hydratePlannerFromSQLite(): Promise<void> {
  if (plannerHydrated) return;
  plannerHydrated = true;
  try {
    const [chunkRows, threadRows, checkInRows] = await Promise.all([
      dbQuery<{ id: string; data: string }>('SELECT * FROM planner_chunks'),
      dbQuery<{ id: string; data: string }>('SELECT * FROM planner_threads'),
      dbQuery<{ id: string; data: string }>('SELECT * FROM planner_checkins'),
    ]);

    if (chunkRows.length > 0) {
      const existing = loadChunks();
      const existingIds = new Set(existing.map((c) => c.id));
      const toAdd: PlannerChunk[] = [];
      for (const row of chunkRows) {
        if (!existingIds.has(row.id)) {
          try { toAdd.push(JSON.parse(row.data) as PlannerChunk); } catch { /* skip corrupt */ }
        }
      }
      if (toAdd.length > 0) saveJson(CHUNKS_KEY, [...toAdd, ...existing]);
    }

    if (threadRows.length > 0) {
      const existing = loadThreads();
      const existingIds = new Set(existing.map((t) => t.id));
      const toAdd: PlannerThread[] = [];
      for (const row of threadRows) {
        if (!existingIds.has(row.id)) {
          try { toAdd.push(JSON.parse(row.data) as PlannerThread); } catch { /* skip corrupt */ }
        }
      }
      if (toAdd.length > 0) saveJson(THREADS_KEY, [...toAdd, ...existing]);
    }

    if (checkInRows.length > 0) {
      const existing = loadCheckIns();
      const existingIds = new Set(existing.map((c) => c.id));
      const toAdd: LearningCheckIn[] = [];
      for (const row of checkInRows) {
        if (!existingIds.has(row.id)) {
          try { toAdd.push(JSON.parse(row.data) as LearningCheckIn); } catch { /* skip corrupt */ }
        }
      }
      if (toAdd.length > 0) saveJson(CHECKINS_KEY, [...toAdd, ...existing]);
    }
  } catch {
    // SQLite not available (web without Capacitor) — silently skip
  }
}

// ── ID helpers ─────────────────────────────────────────────────────────────

let idCounter = 0;
function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

// ── Chunk helpers ──────────────────────────────────────────────────────────

function loadChunks(): PlannerChunk[] {
  return loadJson<PlannerChunk[]>(CHUNKS_KEY, []);
}

function saveChunks(chunks: PlannerChunk[]): void {
  saveJson(CHUNKS_KEY, chunks);
}

// ── Thread helpers ─────────────────────────────────────────────────────────

function loadThreads(): PlannerThread[] {
  return loadJson<PlannerThread[]>(THREADS_KEY, []);
}

function saveThreads(threads: PlannerThread[]): void {
  saveJson(THREADS_KEY, threads);
}

// ── Check-in helpers ───────────────────────────────────────────────────────

function loadCheckIns(): LearningCheckIn[] {
  return loadJson<LearningCheckIn[]>(CHECKINS_KEY, []);
}

function saveCheckIns(checkIns: LearningCheckIn[]): void {
  saveJson(CHECKINS_KEY, checkIns);
}

// ── Signal extraction (LLM) ───────────────────────────────────────────────

const EXTRACT_SIGNALS_PROMPT = `You are a learning coach. The user has submitted a brief learning check-in describing what felt clear, fuzzy, interesting, or worth revisiting.

Extract structured signals from the check-in. Return ONLY valid JSON with this exact shape:
{
  "confidence": ["concept or area that feels clear"],
  "confusion": ["concept or area that feels fuzzy or unresolved"],
  "connections": ["connections the user noticed or wants to explore"],
  "curiosity": ["topics the user is curious about"],
  "revisitIntent": ["specific items the user wants to revisit"]
}

Each array can be empty if no relevant signals are found. Keep entries concise (under 15 words each).`;

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function cleanSignal(value: string): string {
  return value
    .split(/\b(?:and i|but i|because|so i|although|though)\b/i)[0]
    .replace(/^(about|on|with|between|its|their|the|a|an)\s+/i, '')
    .replace(/\b(today|right now|for now)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/, '');
}

function extractTopicFromClause(clause: string): string {
  const lowered = clause.toLowerCase();
  const explicit =
    clause.match(/\b(?:about|on|with|between)\s+([^,.!?;]+)/i)?.[1]
    ?? clause.match(/\b(?:learned|understand|understood|get|got|revisit|review)\s+([^,.!?;]+)/i)?.[1]
    ?? '';

  if (explicit) return cleanSignal(explicit);

  const titleCaseTokens = clause.match(/\b[A-Z][a-zA-Z0-9/+.-]*\b/g) ?? [];
  if (titleCaseTokens.length > 0) return cleanSignal(titleCaseTokens.join(' '));

  if (lowered.includes('relationship with')) {
    return cleanSignal(clause.split(/relationship with/i)[1] ?? '');
  }

  return '';
}

function heuristicExtractSignals(content: string): CheckInSignals {
  const fallback: CheckInSignals = {
    confidence: [], confusion: [], connections: [], curiosity: [], revisitIntent: [],
  };
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;

  const clauses = normalized
    .split(/(?:[.?!]|;\s*|\s+but\s+|\s+and\s+(?=i\s))/i)
    .map((part) => part.trim())
    .filter(Boolean);

  let recentTopic = '';

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const extractedTopic = extractTopicFromClause(clause);
    if (extractedTopic) recentTopic = extractedTopic;

    if (/\b(confident|clear|understand|understood|finally get|got it)\b/i.test(lower)) {
      const topic = extractedTopic || recentTopic;
      if (topic) fallback.confidence.push(topic);
    }

    if (/\b(fuzzy|confused|unclear|lost|don't get|do not get|not sure|slippery)\b/i.test(lower)) {
      let topic = extractedTopic || recentTopic;
      const relationshipTarget = clause.match(/\brelationship with\s+([^,.!?;]+)/i)?.[1];
      if (relationshipTarget && recentTopic) {
        const target = cleanSignal(relationshipTarget);
        topic = cleanSignal(`${recentTopic} and ${target}`);
        fallback.connections.push(topic);
      }
      if (topic) fallback.confusion.push(topic);
    }

    if (/\b(connection|connect|connected|relationship|compare|comparison|difference|vs\.?|versus|link)\b/i.test(lower)) {
      const betweenMatch = clause.match(/\b(?:between|vs\.?|versus)\s+([^,.!?;]+)/i)?.[1];
      if (betweenMatch) {
        fallback.connections.push(cleanSignal(betweenMatch));
      } else if (extractedTopic) {
        fallback.connections.push(extractedTopic);
      }
    }

    if (/\b(curious|interested|want to learn more|want to explore|wondering about)\b/i.test(lower)) {
      const topic = extractedTopic || recentTopic;
      if (topic) fallback.curiosity.push(topic);
    }

    if (/\b(revisit|review again|come back to|return to|practice more)\b/i.test(lower)) {
      const topic = extractedTopic || recentTopic;
      if (topic) fallback.revisitIntent.push(topic);
    }

    if (/\bi learned\s+/i.test(lower) && extractedTopic && !fallback.confidence.includes(extractedTopic)) {
      recentTopic = extractedTopic;
    }
  }

  return {
    confidence: unique(fallback.confidence).slice(0, 4),
    confusion: unique(fallback.confusion).slice(0, 4),
    connections: unique(fallback.connections).slice(0, 4),
    curiosity: unique(fallback.curiosity).slice(0, 4),
    revisitIntent: unique(fallback.revisitIntent).slice(0, 4),
  };
}

function mergeSignals(primary: CheckInSignals, fallback: CheckInSignals): CheckInSignals {
  return {
    confidence: unique([...primary.confidence, ...fallback.confidence]).slice(0, 4),
    confusion: unique([...primary.confusion, ...fallback.confusion]).slice(0, 4),
    connections: unique([...primary.connections, ...fallback.connections]).slice(0, 4),
    curiosity: unique([...primary.curiosity, ...fallback.curiosity]).slice(0, 4),
    revisitIntent: unique([...primary.revisitIntent, ...fallback.revisitIntent]).slice(0, 4),
  };
}

async function extractSignals(content: string): Promise<CheckInSignals> {
  const fallback = heuristicExtractSignals(content);

  const settings = mockSettingsService.getSync();
  if (!settings.llm.isConfigured) return fallback;

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: EXTRACT_SIGNALS_PROMPT },
        { role: 'user', content },
      ],
      settings.llm,
    );

    const text = response.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const parsed = JSON.parse(jsonMatch[0]) as CheckInSignals;

    const parsedSignals = {
      confidence: Array.isArray(parsed.confidence) ? parsed.confidence : [],
      confusion: Array.isArray(parsed.confusion) ? parsed.confusion : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      curiosity: Array.isArray(parsed.curiosity) ? parsed.curiosity : [],
      revisitIntent: Array.isArray(parsed.revisitIntent) ? parsed.revisitIntent : [],
    };
    return mergeSignals(parsedSignals, fallback);
  } catch {
    return fallback;
  }
}

// ── Thread matching ────────────────────────────────────────────────────────

function findMatchingThread(threads: PlannerThread[], signal: string): PlannerThread | undefined {
  const lower = signal.toLowerCase();
  return threads.find((t) => {
    if (t.title.toLowerCase().includes(lower) || lower.includes(t.title.toLowerCase())) return true;
    return t.keywords.some((kw) => lower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(lower));
  });
}

// ── Service ────────────────────────────────────────────────────────────────

export const plannerService = {
  // ── Read ────────────────────────────────────────────────────────────────

  getAll(): PlannerData {
    return {
      chunks: loadChunks(),
      threads: loadThreads(),
      checkIns: loadCheckIns(),
    };
  },

  getChunks(): PlannerChunk[] {
    return loadChunks();
  },

  getThreads(): PlannerThread[] {
    return loadThreads();
  },

  getCheckIns(): LearningCheckIn[] {
    return loadCheckIns();
  },

  /** Chunks in the Continue section: in_progress items first, then recent suggested. */
  getContinueChunks(): PlannerChunk[] {
    const chunks = loadChunks();
    return chunks
      .filter((c) => c.status === 'in_progress' || c.status === 'suggested')
      .sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
        return b.updatedAt - a.updatedAt;
      });
  },

  /** Saved-for-later chunks. */
  getSavedChunks(): PlannerChunk[] {
    return loadChunks().filter((c) => c.status === 'saved_for_later');
  },

  /** Saved threads, sorted by last activity. */
  getSavedThreads(): PlannerThread[] {
    return loadThreads()
      .filter((t) => t.saved)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  },

  // ── Chunk mutations ─────────────────────────────────────────────────────

  createChunk(chunk: Omit<PlannerChunk, 'id' | 'createdAt' | 'updatedAt'>): PlannerChunk {
    const now = Date.now();
    const newChunk: PlannerChunk = {
      ...chunk,
      id: newId('chunk'),
      createdAt: now,
      updatedAt: now,
    };
    const chunks = loadChunks();
    chunks.push(newChunk);
    saveChunks(chunks);
    persistChunkToSQLite(newChunk);
    eventBus.emit({ type: 'PLANNER_UPDATED', payload: { reason: 'chunk' } });
    return newChunk;
  },

  updateChunkStatus(chunkId: string, status: ChunkStatus): PlannerChunk | null {
    const chunks = loadChunks();
    const chunk = chunks.find((c) => c.id === chunkId);
    if (!chunk) return null;
    chunk.status = status;
    chunk.updatedAt = Date.now();
    saveChunks(chunks);
    persistChunkToSQLite(chunk);
    eventBus.emit({ type: 'PLANNER_UPDATED', payload: { reason: 'chunk' } });
    return { ...chunk };
  },

  deleteChunk(chunkId: string): boolean {
    const chunks = loadChunks();
    const idx = chunks.findIndex((c) => c.id === chunkId);
    if (idx === -1) return false;
    chunks.splice(idx, 1);
    saveChunks(chunks);
    deleteChunkFromSQLite(chunkId);
    eventBus.emit({ type: 'PLANNER_UPDATED', payload: { reason: 'chunk' } });
    return true;
  },

  // ── Thread mutations ────────────────────────────────────────────────────

  createThread(thread: Omit<PlannerThread, 'id' | 'createdAt' | 'lastActivityAt'>): PlannerThread {
    const now = Date.now();
    const newThread: PlannerThread = {
      ...thread,
      id: newId('thread'),
      createdAt: now,
      lastActivityAt: now,
    };
    const threads = loadThreads();
    threads.push(newThread);
    saveThreads(threads);
    persistThreadToSQLite(newThread);
    eventBus.emit({ type: 'PLANNER_UPDATED', payload: { reason: 'thread' } });
    return newThread;
  },

  toggleThreadSaved(threadId: string): PlannerThread | null {
    const threads = loadThreads();
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return null;
    thread.saved = !thread.saved;
    thread.lastActivityAt = Date.now();
    saveThreads(threads);
    persistThreadToSQLite(thread);
    eventBus.emit({ type: 'PLANNER_UPDATED', payload: { reason: 'thread' } });
    return { ...thread };
  },

  deleteThread(threadId: string): boolean {
    const threads = loadThreads();
    const idx = threads.findIndex((t) => t.id === threadId);
    if (idx === -1) return false;
    threads.splice(idx, 1);
    saveThreads(threads);
    deleteThreadFromSQLite(threadId);
    eventBus.emit({ type: 'PLANNER_UPDATED', payload: { reason: 'thread' } });
    return true;
  },

  // ── Learning Check-In ───────────────────────────────────────────────────

  /**
   * Process a learning check-in:
   * 1. Extract signals via LLM
   * 2. Create or update threads from confusion/connection/curiosity signals
   * 3. Generate chunk suggestions from unresolved signals
   * 4. Persist everything
   */
  async submitCheckIn(content: string): Promise<LearningCheckIn> {
    const signals = await extractSignals(content);
    const threads = loadThreads();
    const affectedThreadIds: string[] = [];
    const generatedChunkIds: string[] = [];
    const now = Date.now();

    // Process confusion signals → threads + repair chunks
    for (const item of signals.confusion) {
      const existing = findMatchingThread(threads, item);
      if (existing) {
        existing.lastActivityAt = now;
        affectedThreadIds.push(existing.id);
      } else {
        const t: PlannerThread = {
          id: newId('thread'),
          title: item,
          keywords: item.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
          linkedConceptIds: [],
          saved: true,
          lastActivityAt: now,
          createdAt: now,
        };
        threads.push(t);
        affectedThreadIds.push(t.id);

        // Generate a repair chunk for this confusion
        const chunk = this.createChunk({
          type: 'repair',
          goal: `Clarify: ${item}`,
          linkedConceptIds: [],
          threadId: t.id,
          status: 'suggested',
        });
        generatedChunkIds.push(chunk.id);
      }
    }

    // Process connections → threads + connect chunks
    for (const item of signals.connections) {
      const existing = findMatchingThread(threads, item);
      if (existing) {
        existing.lastActivityAt = now;
        affectedThreadIds.push(existing.id);
      } else {
        const t: PlannerThread = {
          id: newId('thread'),
          title: item,
          keywords: item.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
          linkedConceptIds: [],
          saved: true,
          lastActivityAt: now,
          createdAt: now,
        };
        threads.push(t);
        affectedThreadIds.push(t.id);

        const chunk = this.createChunk({
          type: 'connect',
          goal: `Explore: ${item}`,
          linkedConceptIds: [],
          threadId: t.id,
          status: 'suggested',
        });
        generatedChunkIds.push(chunk.id);
      }
    }

    // Process curiosity → threads only (user decides next action)
    for (const item of signals.curiosity) {
      const existing = findMatchingThread(threads, item);
      if (existing) {
        existing.lastActivityAt = now;
        affectedThreadIds.push(existing.id);
      } else {
        const t: PlannerThread = {
          id: newId('thread'),
          title: item,
          keywords: item.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
          linkedConceptIds: [],
          saved: true,
          lastActivityAt: now,
          createdAt: now,
        };
        threads.push(t);
        affectedThreadIds.push(t.id);
      }
    }

    // Process revisit intent → retrieve chunks
    for (const item of signals.revisitIntent) {
      const chunk = this.createChunk({
        type: 'retrieve',
        goal: `Revisit: ${item}`,
        linkedConceptIds: [],
        status: 'suggested',
      });
      generatedChunkIds.push(chunk.id);
    }

    saveThreads(threads);
    // Write all mutated threads to SQLite
    for (const id of [...new Set(affectedThreadIds)]) {
      const t = threads.find((thread) => thread.id === id);
      if (t) persistThreadToSQLite(t);
    }

    // Persist check-in
    const checkIn: LearningCheckIn = {
      id: newId('checkin'),
      content,
      signals,
      affectedThreadIds: [...new Set(affectedThreadIds)],
      generatedChunkIds,
      createdAt: now,
    };
    const checkIns = loadCheckIns();
    checkIns.push(checkIn);
    saveCheckIns(checkIns);
    persistCheckInToSQLite(checkIn);
    eventBus.emit({ type: 'PLANNER_UPDATED', payload: { reason: 'checkin' } });

    return checkIn;
  },

  /** Get recent check-in signals for Home feed ranking. */
  getRecentSignals(maxAge: number = 7 * 24 * 60 * 60 * 1000): CheckInSignals {
    const cutoff = Date.now() - maxAge;
    const recent = loadCheckIns().filter((c) => c.createdAt > cutoff);
    return {
      confidence: recent.flatMap((c) => c.signals.confidence),
      confusion: recent.flatMap((c) => c.signals.confusion),
      connections: recent.flatMap((c) => c.signals.connections),
      curiosity: recent.flatMap((c) => c.signals.curiosity),
      revisitIntent: recent.flatMap((c) => c.signals.revisitIntent),
    };
  },

  /** Get active thread keywords for feed ranking. */
  getActiveThreadKeywords(): string[] {
    const threads = loadThreads().filter((t) => t.saved);
    return threads.flatMap((t) => t.keywords);
  },
};
