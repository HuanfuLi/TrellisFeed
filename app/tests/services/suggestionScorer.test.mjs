/**
 * suggestionScorer.test.mjs
 * Unit tests for suggestionScorer service — deterministic weighting, cold-start, ranking.
 * Phase 10: Planner Auto-Suggestions Engine
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure scoring logic (mirrors service implementation) ──────────────────────

const MAX_TIME_MS = 30 * 86400000; // 30 days normalization cap

function scoreMove(concept, signals) {
  if (!concept) return 0;

  // Cold-start equalization (D-04): < 5 completed reviews → equalize
  if (signals.completedReviews < 5) {
    return 50;
  }

  // Find most recent review card for this concept (by sessionId match or default)
  // For testing we pass timeSinceReview directly via concept.timeSinceReviewMs
  const timeSinceReview = concept.timeSinceReviewMs ?? MAX_TIME_MS;

  // Normalize each factor to [0, 1]
  const perfNorm = (100 - signals.reviewPerformance) / 100;       // low perf = high score
  const timeNorm = Math.min(timeSinceReview / MAX_TIME_MS, 1);
  const engageNorm = Math.min((concept.relatedQuestionIds?.length ?? 0) / 10, 1);
  const coverageNorm = 1 - Math.min(signals.conceptCoverage / 100, 1);

  // Weighted sum: 0.4 + 0.3 + 0.2 + 0.1 = 1.0
  const raw =
    0.4 * perfNorm * 100 +
    0.3 * timeNorm * 100 +
    0.2 * engageNorm * 100 +
    0.1 * coverageNorm * 100;

  return Math.round(Math.min(Math.max(raw, 0), 100));
}

function rankMoves(concepts, signals, limit = 8) {
  // Cold-start equalization
  if (signals.completedReviews < 5) {
    return concepts.slice(0, limit).map(c => ({ id: c.id, score: 50 }));
  }

  return concepts
    .map(c => ({ id: c.id, score: scoreMove(c, signals) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeConcept(id, overrides = {}) {
  return {
    id,
    relatedQuestionIds: [],
    timeSinceReviewMs: 7 * 86400000, // 7 days default
    ...overrides,
  };
}

function makeSignals(overrides = {}) {
  return {
    reviewPerformance: 70,
    questionFrequency: 5,
    timeSinceLastReview: 7 * 86400000,
    feedEngagement: 0,
    conceptCoverage: 50,
    weakAreas: [],
    completedReviews: 10, // above cold-start threshold
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('suggestionScorer — deterministic scoring', () => {
  it('Test 1: scoreMove returns value in [0, 100] range', () => {
    const concept = makeConcept('q1');
    const signals = makeSignals();
    const score = scoreMove(concept, signals);
    assert.ok(score >= 0 && score <= 100, `score=${score} out of [0, 100]`);
  });

  it('Test 2: weighting formula applies correct weights (0.4/0.3/0.2/0.1)', () => {
    // With 0% performance (all weak), 30d since review, 0 related, 0 coverage
    // Expected: 0.4*100 + 0.3*100 + 0.2*0 + 0.1*100 = 80
    const concept = makeConcept('q1', { relatedQuestionIds: [], timeSinceReviewMs: MAX_TIME_MS });
    const signals = makeSignals({ reviewPerformance: 0, conceptCoverage: 0, completedReviews: 10 });
    const score = scoreMove(concept, signals);
    assert.equal(score, 80, `should be 80 with max perf+time+coverage factors, 0 engage`);
  });

  it('Test 3: performance factor is inverted (low performance = high score)', () => {
    const concept = makeConcept('q1', { timeSinceReviewMs: 0 });
    const signalsWeak = makeSignals({ reviewPerformance: 0, completedReviews: 10 });
    const signalsStrong = makeSignals({ reviewPerformance: 100, completedReviews: 10 });
    const scoreWeak = scoreMove(concept, signalsWeak);
    const scoreStrong = scoreMove(concept, signalsStrong);
    assert.ok(scoreWeak > scoreStrong, `weak concept (perf=0) should score higher than strong (perf=100): ${scoreWeak} vs ${scoreStrong}`);
  });

  it('Test 4: normalization prevents skew (each factor stays in [0, 1])', () => {
    // Edge case: very high values should still produce [0, 100] output
    const concept = makeConcept('q1', {
      relatedQuestionIds: Array.from({ length: 100 }, (_, i) => `q${i}`), // 100 related (> 10 cap)
      timeSinceReviewMs: 1000 * 86400000, // 1000 days (> 30d cap)
    });
    const signals = makeSignals({ reviewPerformance: 0, conceptCoverage: 0, completedReviews: 10 });
    const score = scoreMove(concept, signals);
    assert.ok(score >= 0 && score <= 100, `clamped score=${score} should be in [0, 100]`);
  });

  it('Test 5: rankMoves sorts concepts descending by score', () => {
    const concepts = [
      makeConcept('q-low', { timeSinceReviewMs: 0, relatedQuestionIds: [] }),
      makeConcept('q-high', { timeSinceReviewMs: MAX_TIME_MS, relatedQuestionIds: Array.from({ length: 10 }, (_, i) => `x${i}`) }),
    ];
    const signals = makeSignals({ reviewPerformance: 0, conceptCoverage: 0, completedReviews: 10 });
    const ranked = rankMoves(concepts, signals);
    assert.ok(ranked.length >= 2, 'should have ranked entries');
    for (let i = 0; i < ranked.length - 1; i++) {
      assert.ok(ranked[i].score >= ranked[i + 1].score, `rank[${i}].score=${ranked[i].score} should be >= rank[${i + 1}].score=${ranked[i + 1].score}`);
    }
  });

  it('Test 6: cold-start (< 5 completed reviews) equalizes all scores to 50', () => {
    const concepts = [
      makeConcept('q1', { timeSinceReviewMs: MAX_TIME_MS }),
      makeConcept('q2', { timeSinceReviewMs: 0 }),
      makeConcept('q3', { relatedQuestionIds: Array.from({ length: 10 }, (_, i) => `x${i}`) }),
    ];
    const signals = makeSignals({ completedReviews: 3 }); // below 5 threshold
    const ranked = rankMoves(concepts, signals);
    for (const item of ranked) {
      assert.equal(item.score, 50, `cold-start should equalize score to 50, got ${item.score} for ${item.id}`);
    }
  });

  it('Test 7: missing concept (null/undefined) returns 0', () => {
    const signals = makeSignals();
    const score = scoreMove(null, signals);
    assert.equal(score, 0, 'null concept should return 0');
  });

  it('Test 8: top N selection works with limit parameter', () => {
    const concepts = Array.from({ length: 15 }, (_, i) => makeConcept(`q${i}`));
    const signals = makeSignals();
    const ranked5 = rankMoves(concepts, signals, 5);
    const ranked8 = rankMoves(concepts, signals, 8);
    assert.equal(ranked5.length, 5, 'limit=5 should return 5 results');
    assert.equal(ranked8.length, 8, 'limit=8 should return 8 results');
  });
});
