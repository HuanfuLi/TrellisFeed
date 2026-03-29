import type {
  PlannerChunk, LearningCheckIn, PlannerData,
  ChunkStatus, CheckInSignals,
} from '../types';
import { chatCompletion } from '../providers/llm/index.ts';
import { mockSettingsService } from './mock/settings.mock.ts';
import { eventBus } from '../lib/event-bus.ts';
import { dbExecute, dbQuery } from './db.service.ts';
import { Capacitor } from '@capacitor/core';
import { questionService } from './question.service.ts';

// ── Persistence ────────────────────────────────────────────────────────────

const CHUNKS_KEY = 'echolearn_planner_chunks';
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

// On web the SQLite layer falls back to a localStorage shim, which would
// duplicate the data we already persist via saveJson(). Only write through
// to SQLite on native platforms where it is a real database.
const isNative = Capacitor.isNativePlatform();

function persistChunkToSQLite(chunk: PlannerChunk): void {
  if (!isNative) return;
  dbExecute('INSERT OR REPLACE INTO planner_chunks (id, data) VALUES (?, ?)', [chunk.id, JSON.stringify(chunk)])
    .catch((err: unknown) => console.warn('[planner] SQLite chunk persist failed:', err));
}

function deleteChunkFromSQLite(id: string): void {
  if (!isNative) return;
  dbExecute('DELETE FROM planner_chunks WHERE id = ?', [id])
    .catch((err: unknown) => console.warn('[planner] SQLite chunk delete failed:', err));
}

function persistCheckInToSQLite(checkIn: LearningCheckIn): void {
  if (!isNative) return;
  dbExecute('INSERT OR REPLACE INTO planner_checkins (id, data) VALUES (?, ?)', [checkIn.id, JSON.stringify(checkIn)])
    .catch((err: unknown) => console.warn('[planner] SQLite check-in persist failed:', err));
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
    const [chunkRows, checkInRows] = await Promise.all([
      dbQuery<{ id: string; data: string }>('SELECT * FROM planner_chunks'),
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

// ── Stop-word filter for keyword extraction ──────────────────────────────
// Matches the pattern used in question.service.ts to avoid low-quality keywords.

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
  'not', 'with', 'as', 'by', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'this',
  'that', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
  'about', 'from', 'into', 'through', 'during', 'before', 'after', 'between',
  'more', 'some', 'such', 'than', 'too', 'very', 'just', 'also',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 6);
}

// ── Concept linking ─────────────────────────────────────────────────────
// Find question IDs whose keywords overlap with a signal string.

function findLinkedConceptIds(signal: string): string[] {
  const signalWords = new Set(extractKeywords(signal));
  if (signalWords.size === 0) return [];

  const allQuestions = questionService.getAll();
  const matches: Array<{ id: string; overlap: number }> = [];

  for (const q of allQuestions) {
    const overlap = q.keywords.filter((kw) => signalWords.has(kw.toLowerCase())).length;
    if (overlap > 0) matches.push({ id: q.id, overlap });
  }

  return matches
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map((m) => m.id);
}

// ── Service ────────────────────────────────────────────────────────────────

export const plannerService = {
  // ── Read ────────────────────────────────────────────────────────────────

  getAll(): PlannerData {
    return {
      chunks: loadChunks(),
      checkIns: loadCheckIns(),
    };
  },

  getChunks(): PlannerChunk[] {
    return loadChunks();
  },

  getCheckIns(): LearningCheckIn[] {
    return loadCheckIns();
  },

  /** Chunks actively in progress, sorted by most recently updated. */
  getActiveChunks(): PlannerChunk[] {
    return loadChunks()
      .filter((c) => c.status === 'in_progress')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /** Suggested chunks not yet started, sorted by most recently created. */
  getSuggestedChunks(): PlannerChunk[] {
    return loadChunks()
      .filter((c) => c.status === 'suggested')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /** Chunks in the Continue section: in_progress items first, then recent suggested. */
  getContinueChunks(): PlannerChunk[] {
    return [...this.getActiveChunks(), ...this.getSuggestedChunks()];
  },

  /** Saved-for-later chunks. */
  getSavedChunks(): PlannerChunk[] {
    return loadChunks().filter((c) => c.status === 'saved_for_later');
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

  // ── Learning Check-In ───────────────────────────────────────────────────

  /**
   * Process a learning check-in:
   * 1. Extract signals via LLM (+ heuristic fallback)
   * 2. Generate signal-aware chunk suggestions (no threads created)
   * 3. Link chunks to matching knowledge-graph concepts
   * 4. Persist everything in a single batched write + emit
   */
  async submitCheckIn(content: string): Promise<LearningCheckIn> {
    const signals = await extractSignals(content);
    const chunks = loadChunks();
    const newChunks: PlannerChunk[] = [];
    const now = Date.now();

    // Dedup helper: check if an active/suggested chunk with the same goal already exists.
    const existingGoals = new Set(
      chunks
        .filter((c) => c.status === 'suggested' || c.status === 'in_progress')
        .map((c) => c.goal.toLowerCase()),
    );

    function makeChunk(
      type: PlannerChunk['type'],
      goal: string,
      linkedConceptIds: string[],
      sourceSignal: PlannerChunk['sourceSignal'],
    ): PlannerChunk | null {
      if (existingGoals.has(goal.toLowerCase())) return null;
      existingGoals.add(goal.toLowerCase());
      const chunk: PlannerChunk = {
        id: newId('chunk'),
        type,
        goal,
        linkedConceptIds,
        sourceSignal,
        sourceText: content,
        status: 'suggested',
        createdAt: now,
        updatedAt: now,
      };
      newChunks.push(chunk);
      return chunk;
    }

    // Process confusion signals → repair chunks (flashcards)
    for (const item of signals.confusion) {
      const conceptIds = findLinkedConceptIds(item);
      makeChunk('repair', `Clarify: ${item}`, conceptIds, 'confusion');
    }

    // Process connections → connect chunks (questions)
    for (const item of signals.connections) {
      const conceptIds = findLinkedConceptIds(item);
      makeChunk('connect', `Explore: ${item}`, conceptIds, 'connection');
    }

    // Process curiosity → connect chunks (posts — exploration intent)
    for (const item of signals.curiosity) {
      const conceptIds = findLinkedConceptIds(item);
      makeChunk('connect', `Explore: ${item}`, conceptIds, 'curiosity');
    }

    // Process revisit intent → retrieve chunks (spaced repetition)
    for (const item of signals.revisitIntent) {
      const conceptIds = findLinkedConceptIds(item);
      makeChunk('retrieve', `Revisit: ${item}`, conceptIds, 'revisit');
    }

    // ── Batched persist: single write per store, single event emit ────────
    if (newChunks.length > 0) {
      chunks.push(...newChunks);
      saveChunks(chunks);
      for (const c of newChunks) persistChunkToSQLite(c);
    }

    const checkIn: LearningCheckIn = {
      id: newId('checkin'),
      content,
      signals,
      generatedChunkIds: newChunks.map((c) => c.id),
      createdAt: now,
    };
    const checkIns = loadCheckIns();
    checkIns.push(checkIn);
    saveCheckIns(checkIns);
    persistCheckInToSQLite(checkIn);

    // Single event emit for the entire check-in — prevents render storming.
    eventBus.emit({ type: 'PLANNER_UPDATED', payload: { reason: 'checkin' } });

    return checkIn;
  },

  /**
   * Get recent check-in signals for Home feed ranking, weighted by recency.
   * Newer signals appear first; duplicates are removed keeping the most recent occurrence.
   */
  getRecentSignals(maxAge: number = 7 * 24 * 60 * 60 * 1000): CheckInSignals {
    const cutoff = Date.now() - maxAge;
    // Sort newest-first so that dedup via unique() keeps the most recent occurrence.
    const recent = loadCheckIns()
      .filter((c) => c.createdAt > cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);
    return {
      confidence: unique(recent.flatMap((c) => c.signals.confidence)),
      confusion: unique(recent.flatMap((c) => c.signals.confusion)),
      connections: unique(recent.flatMap((c) => c.signals.connections)),
      curiosity: unique(recent.flatMap((c) => c.signals.curiosity)),
      revisitIntent: unique(recent.flatMap((c) => c.signals.revisitIntent)),
    };
  },

};
