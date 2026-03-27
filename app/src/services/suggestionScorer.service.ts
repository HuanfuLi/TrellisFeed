/**
 * Phase 10: Suggestion Scorer Service
 * Deterministic weighted scoring (0.4 performance + 0.3 recency + 0.2 engagement + 0.1 coverage).
 * Cold-start equalization when user has < 5 completed reviews.
 */

import type { TrajectorySignal, ScoredConcept } from '../types/planner';
import { questionService } from './question.service';
import { flashcardService } from './flashcard.service';

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_TIME_MS = 30 * 86400000; // 30 days — normalization cap for recency

// ─── Service ──────────────────────────────────────────────────────────────

export const suggestionScorer = {
  /**
   * Score a single concept for suggestion relevance.
   * Returns a value in [0, 100].
   *
   * Formula: 0.4 × (inverted performance) + 0.3 × (recency) + 0.2 × (engagement) + 0.1 × (coverage gap)
   */
  scoreMove(conceptId: string, signals: TrajectorySignal): number {
    const concept = questionService.getAll().find(q => q.id === conceptId);
    if (!concept) return 0;

    // Cold-start equalization (D-04): < 5 completed reviews → equalize all to 50
    if (signals.completedReviews < 5) {
      return 50;
    }

    // Find most recent flashcard for this concept via session matching
    // Since flashcards are keyed by session, we use sessionId as proxy
    const allCards = flashcardService.getAll();
    const conceptCards = allCards.filter(c => c.sessionId !== 'seed'); // skip seeds
    // Look for cards whose session might match this concept (best effort)
    const cardForConcept = conceptCards.find(c =>
      c.sessionId.includes(conceptId) || conceptId.includes(c.sessionId),
    );

    // Calculate time since this concept was last reviewed
    let timeSinceReview = MAX_TIME_MS; // default: assume never reviewed
    if (cardForConcept) {
      const nextReviewMs = new Date(cardForConcept.reviewSchedule.nextReviewDate).getTime();
      timeSinceReview = Math.max(0, Date.now() - nextReviewMs);
    }

    // Normalize each factor to [0, 1]
    const perfNorm = (100 - signals.reviewPerformance) / 100;              // low perf → high priority
    const timeNorm = Math.min(timeSinceReview / MAX_TIME_MS, 1);           // longer overdue → higher priority
    const engageNorm = Math.min(concept.relatedQuestionIds.length / 10, 1); // more connections → higher engage
    const coverageNorm = 1 - Math.min(signals.conceptCoverage / 100, 1);   // less coverage → higher priority

    // Apply weights and clamp to [0, 100]
    const raw =
      0.4 * perfNorm * 100 +
      0.3 * timeNorm * 100 +
      0.2 * engageNorm * 100 +
      0.1 * coverageNorm * 100;

    return Math.round(Math.min(Math.max(raw, 0), 100));
  },

  /**
   * Rank a list of concept IDs by relevance score.
   * Returns top N scored concepts sorted descending.
   * Defaults to top 8 suggestions.
   */
  rankMoves(conceptIds: string[], signals: TrajectorySignal, limit = 8): ScoredConcept[] {
    // Cold-start equalization: < 5 completed reviews → equalize all concepts
    if (signals.completedReviews < 5) {
      return conceptIds.slice(0, limit).map(id => ({ id, score: 50 }));
    }

    return conceptIds
      .map(id => ({ id, score: this.scoreMove(id, signals) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
};
