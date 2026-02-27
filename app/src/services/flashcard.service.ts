import type { FlashCard, ChatSession, ReviewSchedule } from '../types';
import { today } from '../lib/date';
import { eventBus } from '../lib/event-bus';
import { mockSettingsService } from './mock/settings.mock';
import { chatCompletion } from '../providers/llm';

const STORAGE_KEY = 'echolearn_flashcards';

let idCounter = Date.now();
function newId(): string {
  return `fc-${++idCounter}`;
}

function loadAll(): FlashCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FlashCard[];
  } catch {
    return [];
  }
}

function saveAll(cards: FlashCard[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch {
    // ignore storage errors
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
    return loadAll();
  },

  getDue(): FlashCard[] {
    const t = today();
    // Pinned cards always appear in the review queue regardless of schedule
    return loadAll().filter((c) => c.pinned || c.reviewSchedule.nextReviewDate <= t);
  },

  togglePin(id: string): void {
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
    const all = loadAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], reviewSchedule: schedule };
      saveAll(all);
    }
  },

  deleteById(id: string): void {
    saveAll(loadAll().filter((c) => c.id !== id));
  },

  deleteBySession(sessionId: string): void {
    saveAll(loadAll().filter((c) => c.sessionId !== sessionId));
  },

  async processSession(session: ChatSession): Promise<FlashCard[]> {
    // Guard: skip if already processed, no user messages, or LLM not configured
    if (session.processed) return [];
    const userMessages = session.messages.filter((m) => m.type === 'user');
    if (userMessages.length === 0) return [];

    const settings = mockSettingsService.getSync();
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
      );

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const parsed = JSON.parse(match[0]) as { front: string; back: string }[];
      if (!Array.isArray(parsed) || parsed.length === 0) return [];

      const cards: FlashCard[] = parsed.map((item) => ({
        id: newId(),
        sessionId: session.id,
        front: String(item.front ?? '').slice(0, 120),
        back: String(item.back ?? '').slice(0, 200),
        createdAt: Date.now(),
        reviewSchedule: defaultSchedule(),
      }));

      this.save(cards);
      eventBus.emit({ type: 'FLASHCARDS_CREATED', payload: { sessionId: session.id, count: cards.length } });
      return cards;
    } catch {
      return [];
    }
  },
};
