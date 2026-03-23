import type { FlashCard, ChatSession, ReviewSchedule } from '../types';
import { today } from '../lib/date';
import { eventBus } from '../lib/event-bus';
import { toast } from '../lib/toast';
import { mockSettingsService } from './mock/settings.mock';
import { chatCompletion } from '../providers/llm';
import { questionService } from './question.service';
import { getDueProjectedFlashcards, getProjectedFlashcards } from './canonical-knowledge.service';

const STORAGE_KEY = 'echolearn_flashcards';

// Seed cards shown on first launch so the Info Flow has content before
// any LLM sessions are processed.
function makeSeedCards(): FlashCard[] {
  const t = today();
  return [
    {
      id: 'fc-seed-1', sessionId: 'seed',
      front: 'What is dialectical materialism?',
      back: "Marx's framework combining Hegelian dialectics with materialism — change occurs through opposing forces (thesis → antithesis → synthesis).",
      createdAt: Date.now() - 86400000 * 3,
      reviewSchedule: { nextReviewDate: t, reviewCount: 1, easeFactor: 2.5 },
    },
    {
      id: 'fc-seed-2', sessionId: 'seed',
      front: 'What is quantum entanglement?',
      back: 'Two particles correlate so that measuring one instantly affects the other, regardless of distance — Einstein\'s "spooky action at a distance."',
      createdAt: Date.now() - 86400000 * 2,
      reviewSchedule: { nextReviewDate: t, reviewCount: 0, easeFactor: 2.5 },
    },
    {
      id: 'fc-seed-3', sessionId: 'seed',
      front: 'How does backpropagation train neural networks?',
      back: 'Forward pass computes output; backward pass propagates error gradients via chain rule; weights updated by gradient descent to minimise loss.',
      createdAt: Date.now() - 86400000,
      reviewSchedule: { nextReviewDate: t, reviewCount: 0, easeFactor: 2.5 },
    },
    {
      id: 'fc-seed-4', sessionId: 'seed',
      front: 'Supervised vs unsupervised learning?',
      back: 'Supervised: trains on labelled input-output pairs (classification, regression). Unsupervised: finds patterns in unlabelled data (clustering, PCA).',
      createdAt: Date.now() - 86400000,
      reviewSchedule: { nextReviewDate: t, reviewCount: 0, easeFactor: 2.5 },
    },
    {
      id: 'fc-seed-5', sessionId: 'seed',
      front: 'What does the second law of thermodynamics state?',
      back: 'Entropy of an isolated system always increases — explaining heat flow direction, engine inefficiency, and the arrow of time.',
      createdAt: Date.now() - 3600000,
      reviewSchedule: { nextReviewDate: t, reviewCount: 0, easeFactor: 2.5 },
    },
  ];
}

let idCounter = Date.now();
function newId(): string {
  return `fc-${++idCounter}`;
}

function loadAll(): FlashCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First launch — persist seed cards so they show up in the review queue
      const seeds = makeSeedCards();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    return JSON.parse(raw) as FlashCard[];
  } catch {
    return [];
  }
}

function saveAll(cards: FlashCard[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast('Storage full — flashcards may not be saved. Clear old data in Settings.', 'error');
    }
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
    const projected = getProjectedFlashcards(questionService.getAll());
    const extracted = loadAll();
    const seen = new Set(projected.map((c) => c.id));
    return [...projected, ...extracted.filter((c) => !seen.has(c.id))];
  },

  getDue(): FlashCard[] {
    const t = today();
    const projected = getDueProjectedFlashcards(questionService.getAll());
    const extracted = loadAll().filter((c) => c.pinned || c.reviewSchedule.nextReviewDate <= t);
    const seen = new Set(projected.map((c) => c.id));
    return [...projected, ...extracted.filter((c) => !seen.has(c.id))];
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

      const allQuestions = questionService.getAll();

      const cards: FlashCard[] = parsed.map((item) => {
        const front = String(item.front ?? '').slice(0, 120);
        const back = String(item.back ?? '').slice(0, 200);

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
