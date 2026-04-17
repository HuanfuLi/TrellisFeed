// Daily concept exploration tracker (Phase 30, D-01/D-02/D-03).
// Tracks which concept anchors the user has scrolled through today,
// with automatic daily reset via date comparison.

import type { DailyPost, Question } from '../types/index.ts';

// Inline today() to avoid the i18next dependency chain from lib/date.ts,
// keeping this module testable under plain Node without bundler resolution.
function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STORAGE_KEY = 'echolearn_daily_read';

interface DailyReadState {
  date: string;
  exploredAnchors: string[];
  creditAwarded: boolean;
}

function freshState(): DailyReadState {
  return { date: today(), exploredAnchors: [], creditAwarded: false };
}

function loadState(): DailyReadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<DailyReadState>;
    if (parsed.date !== today()) return freshState();
    return {
      date: parsed.date,
      exploredAnchors: Array.isArray(parsed.exploredAnchors) ? parsed.exploredAnchors : [],
      creditAwarded: parsed.creditAwarded === true,
    };
  } catch {
    return freshState();
  }
}

function saveState(state: DailyReadState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage quota exceeded — silently drop
  }
}

export const dailyReadService = {
  /** Check if an anchor has been explored today. */
  isExplored(anchorId: string): boolean {
    return loadState().exploredAnchors.includes(anchorId);
  },

  /** Mark an anchor as explored today (idempotent). */
  markExplored(anchorId: string): void {
    const state = loadState();
    if (!state.exploredAnchors.includes(anchorId)) {
      state.exploredAnchors.push(anchorId);
      saveState(state);
    }
  },

  /** Get all explored anchor IDs for today. */
  getExploredAnchors(): string[] {
    return loadState().exploredAnchors;
  },

  /** Check if credit has been awarded today. */
  isCreditAwarded(): boolean {
    return loadState().creditAwarded;
  },

  /** Mark credit as awarded today (prevents double-awarding). */
  markCreditAwarded(): void {
    const state = loadState();
    state.creditAwarded = true;
    saveState(state);
  },

  /** Reset state (primarily for testing). */
  reset(): void {
    saveState(freshState());
  },
};

// --- Anchor ID derivation (per D-01, D-12) ---

/** Non-concept sourceTypes excluded from quota (D-12). */
const EXCLUDED_SOURCE_TYPES = new Set(['starter', 'connection', 'video', 'short', 'news']);

/**
 * Derive the concept anchor ID for a DailyPost.
 * Returns question.parentId for Q&A-backed posts, sourceQuestionIds[0] as surrogate
 * when parentId is missing, or null for posts with no sourceQuestionIds.
 */
export function getAnchorIdForPost(
  post: Pick<DailyPost, 'sourceQuestionIds' | 'sourceType'>,
  questionsById: Map<string, Pick<Question, 'id' | 'parentId'>>
): string | null {
  if (EXCLUDED_SOURCE_TYPES.has(post.sourceType)) return null;
  for (const qId of post.sourceQuestionIds) {
    const q = questionsById.get(qId);
    if (q?.parentId) return q.parentId;
  }
  // Surrogate: use first sourceQuestionId when no parentId found
  return post.sourceQuestionIds.length > 0 ? post.sourceQuestionIds[0] : null;
}

/**
 * Compute unique concept anchor IDs from today's feed (D-02).
 * Returns a Set of anchor IDs that form the daily quota.
 */
export function getConceptQuota(
  posts: Pick<DailyPost, 'sourceQuestionIds' | 'sourceType'>[],
  questionsById: Map<string, Pick<Question, 'id' | 'parentId'>>
): Set<string> {
  const anchors = new Set<string>();
  for (const post of posts) {
    const anchorId = getAnchorIdForPost(post, questionsById);
    if (anchorId) anchors.add(anchorId);
  }
  return anchors;
}
