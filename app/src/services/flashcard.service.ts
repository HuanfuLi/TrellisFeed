import type { FlashCard, ChatSession, ReviewSchedule } from '../types';
import { today } from '../lib/date.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService } from './settings.service.ts';
import { chatCompletion } from '../providers/llm/index.ts';
import { questionService } from './question.service.ts';
import { dbExecute, dbQuery } from './db.service.ts';
// Projected flashcards removed (D-02 revised: only LLM-extracted flashcards shown)

// Phase 55-07: the legacy `trellis_flashcards` localStorage key is no longer
// written — flashcards persist to the IndexedDB `flashcards` table (the key is
// cleared on the D-11 cutover sweep in db.service.ts clearAllTables).

let idCounter = Date.now();
function newId(): string {
  return `fc-${++idCounter}`;
}

// UAT Bug 3 (Phase 51 verify-work, 2026-05-19): the Phase 38-04 fix
// (commit 8829a68c) removed makeSeedCards from source so new installs
// never see the 5 hardcoded placeholders ("What is dialectical
// materialism?" etc.), but it shipped no migration for existing installs
// that had already persisted those seed cards to localStorage. The seed
// records have stable ids `fc-seed-1`..`fc-seed-5` AND `sessionId: 'seed'`,
// neither of which any production code path produces today (newId uses
// `fc-${Date.now()+N}`; real sessionIds come from sessionService). This
// one-time migration strips them on the next app launch and writes back,
// so it self-disables after one read. Conservative AND-gate on both
// markers (id prefix AND sessionId) prevents a future legitimate card
// with an `fc-seed-` user-typed id from being purged.
function purgeStaleSeedCards(cards: FlashCard[]): { cards: FlashCard[]; purged: number } {
  const filtered = cards.filter(
    (c) => !(typeof c.id === 'string' && c.id.startsWith('fc-seed-') && c.sessionId === 'seed'),
  );
  return { cards: filtered, purged: cards.length - filtered.length };
}

// Phase 55-07: flashcards persist ONLY to IndexedDB. The module-level `_store`
// is the synchronous read+write mirror (starts empty, hydrated from IndexedDB at
// boot). No localStorage write-through for `trellis_flashcards`.
let _store: FlashCard[] = [];

function loadAll(): FlashCard[] {
  const { cards, purged } = purgeStaleSeedCards(_store);
  if (purged > 0) {
    // Self-disabling: replace the mirror with the cleaned array so subsequent
    // loads see no seed records and the filter becomes a no-op.
    _store = cards;
  }
  return cards;
}

function saveAll(cards: FlashCard[]): void {
  _store = cards;
  // IndexedDB write-through (D-09/D-12) — transaction-wrapped full-table
  // snapshot. The in-memory mirror is the synchronous read path.
  void (async () => {
    try {
      await dbExecute('BEGIN');
      await dbExecute('DELETE FROM flashcards');
      for (const c of cards) {
        await dbExecute('INSERT OR REPLACE INTO flashcards (id, data) VALUES (?, ?)', [c.id, JSON.stringify(c)]);
      }
      await dbExecute('COMMIT');
    } catch {
      try { await dbExecute('ROLLBACK'); } catch { /* ignore */ }
    }
  })();
}

let _hydratedFlashcards = false;

/**
 * Boot hydration (D-12). Restore the flashcards mirror from SQLite when the
 * mirror is empty (D-11 clean-cutover state). Guarded so a populated mirror is
 * never overwritten. Emits FLASHCARDS_CREATED (count) so Review consumers re-read.
 */
export async function hydrateFlashcardsFromSQLite(): Promise<void> {
  if (_hydratedFlashcards) return;
  _hydratedFlashcards = true;
  try {
    if (loadAll().length > 0) return; // mirror already has data — trust it
    const rows = await dbQuery<{ id: string; data: string }>('SELECT * FROM flashcards');
    if (rows.length === 0) return;
    const toAdd: FlashCard[] = [];
    for (const row of rows) {
      try { toAdd.push(JSON.parse(row.data) as FlashCard); } catch { /* skip corrupt */ }
    }
    if (toAdd.length > 0) {
      _store = toAdd;
      eventBus.emit({ type: 'FLASHCARDS_CREATED', payload: { sessionId: '*', count: toAdd.length } });
    }
  } catch {
    // IndexedDB unavailable — silently skip
  }
}

function defaultSchedule(): ReviewSchedule {
  return {
    nextReviewDate: today(),
    reviewCount: 0,
    easeFactor: 2.5,
  };
}

export const flashcardService = {
  getAll(): FlashCard[] {
    // Only return LLM-extracted flashcards — no projected Q&As as raw flashcards
    return loadAll();
  },

  getDue(): FlashCard[] {
    const t = today();
    return loadAll().filter((c) => c.pinned || c.reviewSchedule.nextReviewDate <= t);
  },

  togglePin(id: string): void {
    if (id.startsWith('node-')) {
      const nodeId = id.slice('node-'.length);
      const question = questionService.getAll().find((candidate) => candidate.id === nodeId);
      if (!question) return;
      const wasPinned = question.pinned ?? false;
      questionService.patchQuestion(nodeId, {
        pinned: !wasPinned,
        reviewSchedule: !wasPinned
          ? { ...question.reviewSchedule, nextReviewDate: today() }
          : question.reviewSchedule,
      });
      return;
    }
    const all = loadAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const wasPinned = all[idx].pinned ?? false;
    all[idx] = {
      ...all[idx],
      pinned: !wasPinned,
      // When pinning, make it due today so it joins the current session's queue
      reviewSchedule: !wasPinned
        ? { ...all[idx].reviewSchedule, nextReviewDate: today() }
        : all[idx].reviewSchedule,
    };
    saveAll(all);
  },

  getBySession(sessionId: string): FlashCard[] {
    return loadAll().filter((c) => c.sessionId === sessionId);
  },

  save(cards: FlashCard[]): void {
    const all = loadAll();
    for (const card of cards) {
      const idx = all.findIndex((c) => c.id === card.id);
      if (idx !== -1) {
        all[idx] = card;
      } else {
        all.push(card);
      }
    }
    saveAll(all);
  },

  updateReviewSchedule(id: string, schedule: ReviewSchedule): void {
    if (id.startsWith('node-')) {
      questionService.updateReviewSchedule(id.slice('node-'.length), schedule);
      return;
    }
    const all = loadAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], reviewSchedule: schedule };
      saveAll(all);
    }
  },

  deleteById(id: string): void {
    if (id.startsWith('node-')) {
      void questionService.delete(id.slice('node-'.length));
      return;
    }
    saveAll(loadAll().filter((c) => c.id !== id));
  },

  deleteBySession(sessionId: string): void {
    saveAll(loadAll().filter((c) => c.sessionId !== sessionId));
  },

  /** Wipe all flashcards (mirror + IndexedDB). Used by Clear-All-Data + tests. */
  clear(): void {
    saveAll([]);
  },

  async processSession(session: ChatSession): Promise<FlashCard[]> {
    // Guard: skip if already processed, no user messages, or LLM not configured
    if (session.processed) return [];
    const userMessages = session.messages.filter((m) => m.type === 'user');
    if (userMessages.length === 0) return [];

    const settings = settingsService.getSync();
    if (!settings.llm.isConfigured) return [];

    const transcript = session.messages
      .map((m) => (m.type === 'user' ? `Q: ${m.content}` : `A: ${m.content}`))
      .join('\n');

    const systemPrompt = [
      'You are a knowledge extraction assistant.',
      'Analyze the conversation and extract key learnable facts as concise flashcard pairs.',
      'Each flashcard: front = short question or prompt (≤100 chars), back = concise answer (≤200 chars).',
      'Focus on definitions, facts, and concepts worth memorizing. Skip conversational meta-text.',
      'Return ONLY a valid JSON array: [{"front":"...","back":"..."}, ...]',
      'Return [] if there is nothing worth reviewing.',
    ].join('\n');

    try {
      const raw = await chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        settings.llm,
        { serviceName: 'flashcards' },
      );

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const parsed = JSON.parse(match[0]) as { front: string; back: string }[];
      if (!Array.isArray(parsed) || parsed.length === 0) return [];

      const allQuestions = questionService.getAll();

      const cards: FlashCard[] = parsed
        .filter((item) => item && typeof item === 'object' && (item.front || item.back))
        .map((item) => {
        const front = String(item.front ?? '');
        const back = String(item.back ?? '');

        // Find a matching question to inherit hierarchy labels (nodeId, rootLabel, etc.)
        // so the Review Map can place this card in the knowledge tree.
        const cardText = `${front} ${back}`.toLowerCase();
        const cardWords = new Set(cardText.split(/\W+/).filter((w) => w.length > 3));
        let bestMatch: typeof allQuestions[number] | undefined;
        let bestOverlap = 0;
        for (const q of allQuestions) {
          const overlap = q.keywords.filter((k) => cardWords.has(k.toLowerCase())).length;
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestMatch = q;
          }
        }

        return {
          id: newId(),
          sessionId: session.id,
          front,
          back,
          createdAt: Date.now(),
          reviewSchedule: defaultSchedule(),
          ...(bestMatch && bestOverlap > 0
            ? {
                nodeId: bestMatch.id,
                nodeTitle: bestMatch.title,
                rootLabel: bestMatch.rootLabel,
                branchLabel: bestMatch.branchLabel,
                clusterLabel: bestMatch.clusterLabel,
              }
            : {}),
        };
      });

      this.save(cards);
      eventBus.emit({ type: 'FLASHCARDS_CREATED', payload: { sessionId: session.id, count: cards.length } });
      return cards;
    } catch {
      return [];
    }
  },
};
