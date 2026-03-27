/**
 * Suggestion Scoring Engine
 *
 * Applies the trajectory-aware weighting formula to rank knowledge nodes:
 *
 *   score = (
 *     0.4 * (100 - reviewPerformance)    // prioritise struggles
 *   + 0.3 * (timeSinceLastReview / max)  // prioritise overdue
 *   + 0.2 * normalisedFeedEngagement     // surface popular
 *   + 0.1 * conceptCoverage              // fill gaps
 *   )
 */

import type { Question, TrajectorySignal } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────

const WEIGHTS = {
  reviewPerformance: 0.4,
  timeSinceReview: 0.3,
  feedEngagement: 0.2,
  conceptCoverage: 0.1,
} as const;

/** 30 days — the cap for "overdue" normalisation. */
const MAX_OVERDUE_MS = 30 * 24 * 60 * 60 * 1000;

/** Normalise a value to [0, 100]. */
function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ── Scoring ────────────────────────────────────────────────────────────────

/**
 * Score a single concept node against user trajectory signals.
 *
 * @param concept  - The question/concept to score.
 * @param signals  - Aggregated user trajectory.
 * @returns         Score in [0, 100].
 */
export function scoreMove(concept: Question, signals: TrajectorySignal): number {
  // Component 1: Prioritise areas where the user struggles (low review perf).
  const perfScore = clamp(100 - signals.reviewPerformance);

  // Component 2: Prioritise overdue concepts.
  // For the specific concept, use its own lastReviewedAt if available.
  const conceptOverdue = concept.lastReviewedAt
    ? Date.now() - concept.lastReviewedAt
    : signals.timeSinceLastReview;
  const overdueScore = clamp((conceptOverdue / MAX_OVERDUE_MS) * 100);

  // Component 3: Surface concepts matching user's recent feed engagement.
  // Normalise feed engagement (cap at 20 views/week = 100 score).
  const engagementScore = clamp((signals.feedEngagement / 20) * 100);

  // Component 4: Concept coverage gap (low coverage → higher priority).
  const coverageScore = clamp(100 - signals.conceptCoverage);

  // Boost for concepts in weak areas.
  const isWeakArea = signals.weakAreas.includes(concept.id) ? 15 : 0;

  const rawScore = (
    WEIGHTS.reviewPerformance * perfScore
    + WEIGHTS.timeSinceReview * overdueScore
    + WEIGHTS.feedEngagement * engagementScore
    + WEIGHTS.conceptCoverage * coverageScore
  );

  return Math.round(clamp(rawScore + isWeakArea));
}

/**
 * Rank an array of concept nodes by relevance and return the top N.
 *
 * @param concepts  - All candidates to score.
 * @param signals   - User trajectory signals.
 * @param topN      - Maximum number to return (default 8).
 */
export function rankConcepts(
  concepts: Question[],
  signals: TrajectorySignal,
  topN = 8,
): Array<{ concept: Question; score: number }> {
  return concepts
    .map((concept) => ({ concept, score: scoreMove(concept, signals) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
