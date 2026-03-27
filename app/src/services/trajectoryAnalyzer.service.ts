/**
 * Phase 10: Trajectory Analyzer Service
 * Aggregates learning signals from review/question/engagement data.
 * Signals are cached for 6 hours to avoid expensive recalculation.
 */

import type { TrajectorySignal } from '../types/planner';
import { questionService } from './question.service';
import { flashcardService } from './flashcard.service';

// ─── Cache types ──────────────────────────────────────────────────────────

interface TrajectoryCache {
  signal: TrajectorySignal;
  timestamp: number;
}

// ─── Service ──────────────────────────────────────────────────────────────

export const trajectoryAnalyzer = {
  _cacheKey: 'echolearn_trajectory_signals',
  _cacheTTL: 6 * 3600 * 1000, // 6 hours in milliseconds

  /**
   * Aggregate learning signals from all data sources.
   * Returns cached signals if within TTL, otherwise recalculates.
   */
  aggregateSignals(): TrajectorySignal {
    const cached = this._getCache();
    if (cached) return cached;

    const allQuestions = questionService.getAll();
    const allCards = flashcardService.getAll();
    const weekAgo = Date.now() - 7 * 86400000;

    // ── Review performance ─────────────────────────────────────────────
    // Avg correctness on all cards with at least 1 review (easeFactor >= 2.5 = correct)
    const dueCards = allCards.filter(c => c.reviewSchedule.reviewCount > 0 ||
      new Date(c.reviewSchedule.nextReviewDate).getTime() <= Date.now());
    let reviewPerformance = 50; // neutral fallback
    if (dueCards.length > 0) {
      const correct = dueCards.filter(c => c.reviewSchedule.easeFactor >= 2.5).length;
      reviewPerformance = Math.round((correct / dueCards.length) * 100);
    }

    // ── Question frequency ─────────────────────────────────────────────
    const questionFrequency = allQuestions.filter(q => q.createdAt >= weekAgo).length;

    // ── Time since last review ─────────────────────────────────────────
    // Max time elapsed since any card's next review date was passed
    let timeSinceLastReview = 30 * 86400000; // 30 days fallback
    if (allCards.length > 0) {
      const nextReviewTimes = allCards.map(c => new Date(c.reviewSchedule.nextReviewDate).getTime());
      const oldestNextReview = Math.min(...nextReviewTimes);
      timeSinceLastReview = Math.max(0, Date.now() - oldestNextReview);
    }

    // ── Feed engagement ────────────────────────────────────────────────
    // Placeholder — extended via event tracking in future iterations
    const feedEngagement = this._getFeedEngagement();

    // ── Concept coverage ───────────────────────────────────────────────
    // % of questions with at least 1 flashcard review
    let conceptCoverage = 0;
    if (allQuestions.length > 0) {
      // Map flashcards back to question IDs via sessionId or questionId field
      const reviewedIds = new Set<string>();
      for (const card of allCards) {
        if (card.reviewSchedule.reviewCount > 0) {
          // Flashcards are linked to sessions; use sessionId for weak linking
          // For question-level tracking, we use the canonical projection data
          reviewedIds.add(card.sessionId);
        }
      }
      // Use the count of unique sessions with reviewed cards as proxy for coverage
      // A better signal: count questions whose keywords appear in reviewed sessions
      // For now: reviewedIds.size / allQuestions.length (conservative estimate)
      const coverageCount = Math.min(reviewedIds.size, allQuestions.length);
      conceptCoverage = Math.round((coverageCount / allQuestions.length) * 100);
    }

    // ── Weak areas ─────────────────────────────────────────────────────
    // Question IDs where their associated flashcards have easeFactor < 2.5 (D-03)
    // Since flashcards don't directly store questionId, we identify via sessions
    // and use easeFactor < 2.5 as the weak signal
    const weakSessionIds = new Set<string>(
      allCards
        .filter(c => c.reviewSchedule.easeFactor < 2.5 && c.reviewSchedule.reviewCount > 0)
        .map(c => c.sessionId),
    );
    // Map weak session IDs to question IDs (weak approximation for MVP)
    const weakAreas = allQuestions
      .filter(q => weakSessionIds.size > 0) // only if weak sessions exist
      .slice(0, 5) // cap at 5 weak areas
      .map(q => q.id);
    // More precise: if we had card.questionId, we'd use that directly
    const preciseWeakAreas: string[] = [];
    for (const card of allCards) {
      if (card.reviewSchedule.easeFactor < 2.5 && card.reviewSchedule.reviewCount > 0) {
        // Try to find question with matching keywords via sessionId
        // For now, use a simple check — refined when question-card linking improves
        if (!preciseWeakAreas.includes(card.sessionId)) {
          preciseWeakAreas.push(card.sessionId);
        }
      }
    }

    // ── Completed reviews ──────────────────────────────────────────────
    const completedReviews = allCards.filter(c => c.reviewSchedule.reviewCount > 0).length;

    const signal: TrajectorySignal = {
      reviewPerformance,
      questionFrequency,
      timeSinceLastReview,
      feedEngagement,
      conceptCoverage,
      weakAreas: preciseWeakAreas.slice(0, 5),
      completedReviews,
    };

    this._setCache(signal);
    return signal;
  },

  /** Retrieve cached signals if still within TTL. Returns null if stale or missing. */
  _getCache(): TrajectorySignal | null {
    try {
      const raw = localStorage.getItem(this._cacheKey);
      if (!raw) return null;
      const cached = JSON.parse(raw) as TrajectoryCache;
      if (Date.now() - cached.timestamp > this._cacheTTL) return null;
      return cached.signal;
    } catch {
      return null;
    }
  },

  /** Store signals with current timestamp. */
  _setCache(signal: TrajectorySignal): void {
    try {
      const entry: TrajectoryCache = { signal, timestamp: Date.now() };
      localStorage.setItem(this._cacheKey, JSON.stringify(entry));
    } catch { /* ignore storage errors */ }
  },

  /** Invalidate the signal cache (forces recalculation on next call). */
  invalidateCache(): void {
    try {
      localStorage.removeItem(this._cacheKey);
    } catch { /* ignore */ }
  },

  /** Placeholder for feed engagement tracking. Returns 0 until event system is extended. */
  _getFeedEngagement(): number {
    // Future: count POST_VIEWED events in last 7 days from eventBus history
    return 0;
  },
};
