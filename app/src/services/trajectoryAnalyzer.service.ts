/**
 * Trajectory Signal Aggregation
 *
 * Collects learning signals from review history, question activity, feed
 * engagement, and knowledge graph to produce a TrajectorySignal snapshot.
 * Signals are cached for 6 hours to avoid redundant recalculation.
 */

import type { TrajectorySignal } from '../types';
import { questionService } from './question.service.ts';
import { flashcardService } from './flashcard.service.ts';

// ── Cache ──────────────────────────────────────────────────────────────────

const SIGNAL_CACHE_KEY = 'trellis_trajectory_signals';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CachedSignals {
  signals: TrajectorySignal;
  computedAt: number;
}

function loadCache(): CachedSignals | null {
  try {
    const raw = localStorage.getItem(SIGNAL_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSignals;
  } catch {
    return null;
  }
}

function saveCache(signals: TrajectorySignal): void {
  try {
    const cached: CachedSignals = { signals, computedAt: Date.now() };
    localStorage.setItem(SIGNAL_CACHE_KEY, JSON.stringify(cached));
  } catch { /* ignore storage errors */ }
}

function isCacheValid(cached: CachedSignals): boolean {
  return Date.now() - cached.computedAt < CACHE_TTL_MS;
}

// ── Feed engagement tracking ───────────────────────────────────────────────

const FEED_VIEWS_KEY = 'trellis_feed_views';

interface FeedViewEntry {
  questionId: string;
  viewedAt: number;
}

function loadFeedViews(): FeedViewEntry[] {
  try {
    const raw = localStorage.getItem(FEED_VIEWS_KEY);
    return raw ? (JSON.parse(raw) as FeedViewEntry[]) : [];
  } catch {
    return [];
  }
}

// ── Signal computation ─────────────────────────────────────────────────────

function computeReviewPerformance(cards: ReturnType<typeof flashcardService.getAll>): number {
  // easeFactor ranges 1.3 – 3.0; default is 2.5. We scale to 0-100.
  // Higher easeFactor = better performance.
  if (cards.length === 0) return 50; // neutral fallback

  const reviewed = cards.filter((c) => c.reviewSchedule.reviewCount > 0);
  if (reviewed.length === 0) return 50;

  const avgEF = reviewed.reduce((sum, c) => sum + c.reviewSchedule.easeFactor, 0) / reviewed.length;
  // Map 1.3..3.0 → 0..100
  return Math.round(((avgEF - 1.3) / (3.0 - 1.3)) * 100);
}

function computeTimeSinceLastReview(questions: ReturnType<typeof questionService.getAll>): number {
  const timestamps = questions
    .map((q) => q.lastReviewedAt ?? 0)
    .filter((t) => t > 0);

  if (timestamps.length === 0) return Infinity;
  return Date.now() - Math.max(...timestamps);
}

function computeConceptCoverage(questions: ReturnType<typeof questionService.getAll>): number {
  if (questions.length === 0) return 0;
  const reviewed = questions.filter((q) => q.lastReviewedAt && q.lastReviewedAt > 0);
  return Math.round((reviewed.length / questions.length) * 100);
}

function computeWeakAreas(
  questions: ReturnType<typeof questionService.getAll>,
  cards: ReturnType<typeof flashcardService.getAll>,
): string[] {
  const weakIds = new Set<string>();

  // Weak = user reviewed this concept and struggled (low SM-2 ease factor).
  // Only flashcard easeFactor is reliable — question.reviewSchedule is never
  // updated after creation, so we derive weakness purely from card scores.
  // Rationale (Phase 55 D-15 verify-and-keep): the 2.0 weak threshold sits below the
  // SM-2 default ease of 2.5 — a card whose ease has decayed under 2.0 has been graded
  // "hard"/"again" at least once, the canonical SM-2 weakness signal. reviewCount > 0
  // excludes never-reviewed cards (default ease, not real weakness). Kept (no drift);
  // raise toward 2.5 if too few weak areas surface, lower if too many false positives.
  for (const card of cards) {
    if (card.reviewSchedule.easeFactor < 2.0 && card.reviewSchedule.reviewCount > 0 && card.nodeId) {
      weakIds.add(card.nodeId);
    }
  }

  const weakAreaIds = questions
    .filter((q) => weakIds.has(q.id))
    .map((q) => q.id);

  if (questions.length > 0) {
    const pct = ((weakAreaIds.length / questions.length) * 100).toFixed(1);
    console.debug(`[Planner] Weak areas: ${pct}% (${weakAreaIds.length}/${questions.length})`);
  }

  return weakAreaIds;
}

// ── Public API ─────────────────────────────────────────────────────────────

export const trajectoryAnalyzerService = {
  /**
   * Compute trajectory signals from current user data.
   * Returns cached result if computed within the last 6 hours.
   */
  aggregateSignals(forceRefresh = false): TrajectorySignal {
    if (!forceRefresh) {
      const cached = loadCache();
      if (cached && isCacheValid(cached)) return cached.signals;
    }

    const questions = questionService.getAll();
    const cards = flashcardService.getAll();
    const feedViews = loadFeedViews();
    // Rationale (Phase 55 D-15 verify-and-keep): the 7-day window scopes
    // questionFrequency + feedEngagement to recent activity so the trajectory signal
    // tracks the user's CURRENT learning momentum, not lifetime totals. 7 days matches
    // the SM-2 review cadence and the 7-day post-history rolling purge — kept (no drift
    // observed in dev instrumentation); re-tune only if the signal lags real engagement.
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const questionFrequency = questions.filter((q) => q.createdAt > sevenDaysAgo).length;
    const feedEngagement = feedViews.filter((v) => v.viewedAt > sevenDaysAgo).length;

    const signals: TrajectorySignal = {
      reviewPerformance: computeReviewPerformance(cards),
      questionFrequency,
      timeSinceLastReview: computeTimeSinceLastReview(questions),
      feedEngagement,
      conceptCoverage: computeConceptCoverage(questions),
      weakAreas: computeWeakAreas(questions, cards),
    };

    saveCache(signals);
    return signals;
  },

  /** Invalidate the signal cache (call after significant user activity). */
  invalidateCache(): void {
    localStorage.removeItem(SIGNAL_CACHE_KEY);
  },
};
