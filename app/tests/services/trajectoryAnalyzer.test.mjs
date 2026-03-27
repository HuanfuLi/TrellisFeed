/**
 * trajectoryAnalyzer.test.mjs
 * Unit tests for trajectoryAnalyzer service — signal aggregation, cache, cold-start.
 * Phase 10: Planner Auto-Suggestions Engine
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure signal aggregation logic (mirrors service implementation) ────────────
// We test the aggregation math independently of DOM/localStorage/Capacitor.

function computeReviewPerformance(allCards, weekAgo) {
  const dueCards = allCards.filter(c => {
    const nextReview = new Date(c.reviewSchedule.nextReviewDate).getTime();
    return nextReview <= Date.now() || c.reviewSchedule.reviewCount > 0;
  });
  if (dueCards.length === 0) return 50; // neutral fallback
  const correct = dueCards.filter(c => c.reviewSchedule.easeFactor >= 2.5).length;
  return Math.round((correct / dueCards.length) * 100);
}

function computeQuestionFrequency(allQuestions, weekAgo) {
  return allQuestions.filter(q => q.createdAt >= weekAgo).length;
}

function computeTimeSinceLastReview(allCards) {
  if (allCards.length === 0) return 30 * 86400000;
  const nextReviewTimes = allCards.map(c => new Date(c.reviewSchedule.nextReviewDate).getTime());
  const oldestNextReview = Math.min(...nextReviewTimes);
  return Math.max(0, Date.now() - oldestNextReview);
}

function computeConceptCoverage(allQuestions, allCards) {
  if (allQuestions.length === 0) return 0;
  // Which question IDs have at least one review card?
  const reviewedIds = new Set(allCards.filter(c => c.reviewSchedule.reviewCount > 0).map(c => c.questionId));
  return Math.round((reviewedIds.size / allQuestions.length) * 100);
}

function computeWeakAreas(allCards) {
  // Cards with SM-2 easeFactor < 2.5 → question ID is "weak"
  const weakIds = new Set();
  for (const card of allCards) {
    if (card.reviewSchedule.easeFactor < 2.5 && card.questionId) {
      weakIds.add(card.questionId);
    }
  }
  return [...weakIds];
}

function computeCompletedReviews(allCards) {
  return allCards.filter(c => c.reviewSchedule.reviewCount > 0).length;
}

function aggregateSignals(allQuestions, allCards) {
  const weekAgo = Date.now() - 7 * 86400000;
  return {
    reviewPerformance: computeReviewPerformance(allCards, weekAgo),
    questionFrequency: computeQuestionFrequency(allQuestions, weekAgo),
    timeSinceLastReview: computeTimeSinceLastReview(allCards),
    feedEngagement: 0,
    conceptCoverage: computeConceptCoverage(allQuestions, allCards),
    weakAreas: computeWeakAreas(allCards),
    completedReviews: computeCompletedReviews(allCards),
  };
}

// ─── Cache logic (mirrors service implementation) ─────────────────────────────

function createCache(ttlMs = 6 * 3600 * 1000) {
  let store = null;
  return {
    get() {
      if (!store) return null;
      if (Date.now() - store.timestamp > ttlMs) return null;
      return store.signal;
    },
    set(signal) {
      store = { signal, timestamp: Date.now() };
    },
    setWithTimestamp(signal, timestamp) {
      store = { signal, timestamp };
    },
    clear() {
      store = null;
    },
  };
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeQuestion(overrides = {}) {
  return {
    id: `q-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now() - 86400000, // 1 day ago by default
    reviewSchedule: { nextReviewDate: new Date().toISOString().slice(0, 10), reviewCount: 0, easeFactor: 2.5 },
    ...overrides,
  };
}

function makeCard(questionId, overrides = {}) {
  return {
    id: `fc-${Math.random().toString(16).slice(2)}`,
    questionId,
    reviewSchedule: {
      nextReviewDate: new Date().toISOString().slice(0, 10),
      reviewCount: 1,
      easeFactor: 2.5,
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('trajectoryAnalyzer — signal aggregation', () => {
  it('Test 1: aggregateSignals returns correct structure with all 7 properties', () => {
    const signal = aggregateSignals([], []);
    assert.ok('reviewPerformance' in signal, 'should have reviewPerformance');
    assert.ok('questionFrequency' in signal, 'should have questionFrequency');
    assert.ok('timeSinceLastReview' in signal, 'should have timeSinceLastReview');
    assert.ok('feedEngagement' in signal, 'should have feedEngagement');
    assert.ok('conceptCoverage' in signal, 'should have conceptCoverage');
    assert.ok('weakAreas' in signal, 'should have weakAreas');
    assert.ok('completedReviews' in signal, 'should have completedReviews');
    assert.ok(Array.isArray(signal.weakAreas), 'weakAreas should be an array');
  });

  it('Test 2: all numeric metrics stay within [0, 100] range', () => {
    const questions = Array.from({ length: 10 }, () => makeQuestion());
    const cards = questions.map(q => makeCard(q.id, { reviewSchedule: { nextReviewDate: new Date().toISOString().slice(0, 10), reviewCount: 2, easeFactor: 3.0 } }));
    const signal = aggregateSignals(questions, cards);

    assert.ok(signal.reviewPerformance >= 0 && signal.reviewPerformance <= 100, `reviewPerformance=${signal.reviewPerformance} out of range`);
    assert.ok(signal.feedEngagement >= 0 && signal.feedEngagement <= 100, `feedEngagement=${signal.feedEngagement} out of range`);
    assert.ok(signal.conceptCoverage >= 0 && signal.conceptCoverage <= 100, `conceptCoverage=${signal.conceptCoverage} out of range`);
  });

  it('Test 3: cache hit returns same object within TTL', () => {
    const cache = createCache(6 * 3600 * 1000);
    const signal = aggregateSignals([], []);
    cache.set(signal);
    const retrieved = cache.get();
    assert.deepEqual(retrieved, signal, 'should return cached signal within TTL');
  });

  it('Test 4: cache miss after TTL elapsed forces recalculation', () => {
    const cache = createCache(6 * 3600 * 1000);
    const signal = aggregateSignals([], []);
    // Backdate the cache entry by 7 hours
    cache.setWithTimestamp(signal, Date.now() - 7 * 3600 * 1000);
    const retrieved = cache.get();
    assert.equal(retrieved, null, 'should return null when cache is stale');
  });

  it('Test 5: cold-start (no reviews) returns neutral performance and zero coverage', () => {
    const questions = [makeQuestion(), makeQuestion()];
    const cards = []; // no review cards
    const signal = aggregateSignals(questions, cards);
    assert.equal(signal.reviewPerformance, 50, 'should return 50 (neutral) with no cards');
    assert.equal(signal.conceptCoverage, 0, 'should return 0 coverage with no reviewed cards');
    assert.equal(signal.completedReviews, 0, 'should have 0 completed reviews');
  });

  it('Test 6: weak areas correctly identified (easeFactor < 2.5)', () => {
    const q1 = makeQuestion({ id: 'q-weak' });
    const q2 = makeQuestion({ id: 'q-strong' });
    const cardWeak = makeCard('q-weak', { reviewSchedule: { nextReviewDate: new Date().toISOString().slice(0, 10), reviewCount: 3, easeFactor: 1.8 } });
    const cardStrong = makeCard('q-strong', { reviewSchedule: { nextReviewDate: new Date().toISOString().slice(0, 10), reviewCount: 3, easeFactor: 3.0 } });
    const signal = aggregateSignals([q1, q2], [cardWeak, cardStrong]);
    assert.ok(signal.weakAreas.includes('q-weak'), 'q-weak should be in weakAreas');
    assert.ok(!signal.weakAreas.includes('q-strong'), 'q-strong should not be in weakAreas');
  });

  it('Test 7: reviewPerformance calculation matches formula (correct cards / due cards)', () => {
    const q1 = makeQuestion({ id: 'q1' });
    const q2 = makeQuestion({ id: 'q2' });
    // 1 of 2 cards is "correct" (easeFactor >= 2.5)
    const cardGood = makeCard('q1', { reviewSchedule: { nextReviewDate: new Date().toISOString().slice(0, 10), reviewCount: 2, easeFactor: 2.5 } });
    const cardBad = makeCard('q2', { reviewSchedule: { nextReviewDate: new Date().toISOString().slice(0, 10), reviewCount: 2, easeFactor: 2.0 } });
    const signal = aggregateSignals([q1, q2], [cardGood, cardBad]);
    assert.equal(signal.reviewPerformance, 50, 'should be 50% (1 of 2 cards correct)');
  });

  it('Test 8: empty state (0 questions, 0 cards) does not crash', () => {
    assert.doesNotThrow(() => {
      const signal = aggregateSignals([], []);
      assert.equal(signal.reviewPerformance, 50, 'fallback neutral performance');
      assert.equal(signal.questionFrequency, 0);
      assert.equal(signal.conceptCoverage, 0);
      assert.deepEqual(signal.weakAreas, []);
    });
  });
});
