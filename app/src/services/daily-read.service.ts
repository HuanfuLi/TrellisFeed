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

const STORAGE_KEY = 'questiontrace_daily_read';

interface DailyReadState {
  date: string;
  exploredAnchors: string[];
}

function freshState(): DailyReadState {
  return { date: today(), exploredAnchors: [] };
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

  /** Reset state (primarily for testing). */
  reset(): void {
    saveState(freshState());
  },
};

// --- Anchor ID derivation ---

/**
 * Derive the concept anchor ID for a DailyPost.
 * Returns question.parentId for Q&A-backed posts, sourceQuestionIds[0] as surrogate
 * when parentId is missing, or null for posts with no sourceQuestionIds.
 * Starter/connection/suggestion posts are excluded (they don't represent a concept).
 */
const NON_CONCEPT_SOURCE_TYPES = new Set(['starter', 'connection', 'suggestion']);

export function getAnchorIdForPost(
  post: Pick<DailyPost, 'sourceQuestionIds' | 'sourceType'>,
  questionsById: ReadonlyMap<string, Pick<Question, 'id' | 'parentId'>>
): string | null {
  if (NON_CONCEPT_SOURCE_TYPES.has(post.sourceType)) return null;
  for (const qId of post.sourceQuestionIds) {
    const q = questionsById.get(qId);
    if (q?.parentId) return q.parentId;
  }
  return post.sourceQuestionIds.length > 0 ? post.sourceQuestionIds[0] : null;
}

/**
 * Compute today's concept quota from all anchor concepts.
 * The QuestionTrace shell no longer consumes SM-2 due state; all anchors are eligible.
 */
export function getConceptQuota(
  _posts: Pick<DailyPost, 'sourceQuestionIds' | 'sourceType'>[],
  questionsById: Map<string, Pick<Question, 'id' | 'parentId' | 'isAnchorNode'>>
): Set<string> {
  const anchors = new Set<string>();
  for (const [id, q] of questionsById) {
    if (q.isAnchorNode) anchors.add(id);
  }
  return anchors;
}
