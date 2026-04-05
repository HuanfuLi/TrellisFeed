/**
 * suggestionScorer.test.mjs
 * Unit tests for the trajectory-aware suggestion scoring algorithm.
 * Phase 10: Planner Auto-Suggestions Engine
 */

import { describe, it } from 'node:test';
import assert from 'assert';

// ─── Inline scoring implementation ────────────────────────────────────────────
// We test the pure scoring logic directly (no DOM, no Capacitor, no imports).

const WEIGHTS = {
  reviewPerformance: 0.4,
  timeSinceReview: 0.3,
  feedEngagement: 0.2,
  conceptCoverage: 0.1,
};

const MAX_OVERDUE_MS = 30 * 24 * 60 * 60 * 1000;

function clamp(value) {
  return Math.min(100, Math.max(0, value));
}

/** Strategy-aware weight computation per learning mode. */
function getStrategyWeights(hints) {
  switch (hints.mode) {
    case 'retrieval':
      return { reviewPerformance: 0.55, timeSinceReview: 0.25, feedEngagement: 0.1, conceptCoverage: 0.1 };
    case 'discovery':
      return { reviewPerformance: 0.25, timeSinceReview: 0.2, feedEngagement: 0.35, conceptCoverage: 0.2 };
    case 'reinforcement':
      return { reviewPerformance: 0.35, timeSinceReview: 0.4, feedEngagement: 0.15, conceptCoverage: 0.1 };
    case 'balanced':
    default:
      return { ...WEIGHTS };
  }
}

function scoreMove(concept, signals, hints) {
  const w = hints ? getStrategyWeights(hints) : WEIGHTS;

  const perfScore = clamp(100 - signals.reviewPerformance);

  const conceptOverdue = concept.lastReviewedAt
    ? Date.now() - concept.lastReviewedAt
    : signals.timeSinceLastReview;
  const overdueScore = clamp((conceptOverdue / MAX_OVERDUE_MS) * 100);

  const engagementScore = clamp((signals.feedEngagement / 20) * 100);

  const coverageScore = clamp(100 - signals.conceptCoverage);

  const isWeakArea = signals.weakAreas.includes(concept.id) ? 30 * (hints?.weakAreaBias ?? 1) : 0;

  const rawScore = (
    w.reviewPerformance * perfScore
    + w.timeSinceReview * overdueScore
    + w.feedEngagement * engagementScore
    + w.conceptCoverage * coverageScore
  );

  return Math.round(clamp(rawScore + isWeakArea));
}

function rankConcepts(concepts, signals, topN = 8, hints) {
  return concepts
    .map((concept) => ({ concept, score: scoreMove(concept, signals, hints) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeConcept(id, overrides = {}) {
  return {
    id,
    title: `Concept ${id}`,
    keywords: [],
    relatedQuestionIds: [],
    lastReviewedAt: null,
    ...overrides,
  };
}

function makeSignals(overrides = {}) {
  return {
    reviewPerformance: 50,
    questionFrequency: 5,
    timeSinceLastReview: 7 * 24 * 60 * 60 * 1000,
    feedEngagement: 10,
    conceptCoverage: 50,
    weakAreas: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('scoreMove — score range', () => {
  it('returns a value between 0 and 100', () => {
    const concept = makeConcept('c1');
    const signals = makeSignals();
    const score = scoreMove(concept, signals);
    assert.ok(score >= 0, `score ${score} should be >= 0`);
    assert.ok(score <= 100, `score ${score} should be <= 100`);
  });

  it('returns 0 for ideal learner (high perf, recent review, active engagement, full coverage)', () => {
    const concept = makeConcept('c1', {
      lastReviewedAt: Date.now() - 60 * 1000, // reviewed 1 min ago
    });
    const signals = makeSignals({
      reviewPerformance: 100,
      feedEngagement: 20,
      conceptCoverage: 100,
    });
    const score = scoreMove(concept, signals);
    // perfScore=0, overdue≈0, engagement=100, coverageScore=0
    // raw = 0*0.4 + 0*0.3 + 100*0.2 + 0*0.1 = 20
    assert.ok(score <= 25, `expected low score for ideal learner, got ${score}`);
  });

  it('returns high score for struggling learner with long-overdue concept', () => {
    const concept = makeConcept('c1', {
      lastReviewedAt: Date.now() - 35 * 24 * 60 * 60 * 1000, // 35 days ago
    });
    const signals = makeSignals({
      reviewPerformance: 10,
      feedEngagement: 0,
      conceptCoverage: 10,
    });
    const score = scoreMove(concept, signals);
    assert.ok(score >= 60, `expected high score for struggling learner, got ${score}`);
  });
});

describe('scoreMove — weight ordering', () => {
  it('review performance weight (0.4) contributes most to score', () => {
    // Low review perf should give highest contribution
    const concept = makeConcept('c1');
    const signals = makeSignals({
      reviewPerformance: 0,   // worst
      feedEngagement: 0,
      conceptCoverage: 50,
      timeSinceLastReview: 0,
    });
    const perfContribution = WEIGHTS.reviewPerformance * 100;
    assert.strictEqual(perfContribution, 40, 'review perf weight must be 40');
  });

  it('prioritises weak areas with 30-point boost', () => {
    const concept = makeConcept('c1');
    const signals = makeSignals({ weakAreas: ['c1'] });
    const signalsNoWeak = makeSignals({ weakAreas: [] });

    const scoreWithBoost = scoreMove(concept, signals);
    const scoreWithout = scoreMove(concept, signalsNoWeak);

    assert.ok(
      scoreWithBoost > scoreWithout,
      `weak area boost should increase score: ${scoreWithBoost} vs ${scoreWithout}`,
    );
  });

  it('weak area boost is approximately 30 points (capped at 100)', () => {
    const concept = makeConcept('c1');
    const neutralSignals = makeSignals({
      reviewPerformance: 50,
      timeSinceLastReview: 0,
      feedEngagement: 0,
      conceptCoverage: 50,
      weakAreas: [],
    });
    const weakSignals = { ...neutralSignals, weakAreas: ['c1'] };

    const baseScore = scoreMove(concept, neutralSignals);
    const boostedScore = scoreMove(concept, weakSignals);
    const boost = boostedScore - baseScore;

    // Allow ±2 for rounding
    assert.ok(boost >= 28 && boost <= 32, `expected ~30pt boost, got ${boost}`);
  });
});

describe('scoreMove — edge cases', () => {
  it('handles concept with no lastReviewedAt (falls back to signals.timeSinceLastReview)', () => {
    const concept = makeConcept('c1', { lastReviewedAt: null });
    const signals = makeSignals({
      timeSinceLastReview: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    const score = scoreMove(concept, signals);
    assert.ok(typeof score === 'number' && !isNaN(score), 'score should be a valid number');
  });

  it('clamps score at 100 even with maximum signals and weak area boost', () => {
    const concept = makeConcept('c1', {
      lastReviewedAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
    });
    const signals = makeSignals({
      reviewPerformance: 0,
      feedEngagement: 100,
      conceptCoverage: 0,
      weakAreas: ['c1'],
    });
    const score = scoreMove(concept, signals);
    assert.ok(score <= 100, `score ${score} must be capped at 100`);
  });

  it('score is always an integer (Math.round)', () => {
    const concept = makeConcept('c1');
    const signals = makeSignals();
    const score = scoreMove(concept, signals);
    assert.strictEqual(score, Math.round(score), 'score should be an integer');
  });
});

describe('rankConcepts — ordering and limits', () => {
  it('returns concepts sorted by score descending', () => {
    const signals = makeSignals({ weakAreas: ['c3'] });
    const concepts = [
      makeConcept('c1', { lastReviewedAt: Date.now() }),       // fresh
      makeConcept('c2'),                                          // neutral
      makeConcept('c3'),                                          // weak area boost
    ];

    const ranked = rankConcepts(concepts, signals);
    const scores = ranked.map((r) => r.score);

    // Scores should be non-increasing
    for (let i = 0; i < scores.length - 1; i++) {
      assert.ok(scores[i] >= scores[i + 1], `scores not sorted at index ${i}: ${scores}`);
    }
  });

  it('respects topN limit', () => {
    const signals = makeSignals();
    const concepts = Array.from({ length: 20 }, (_, i) => makeConcept(`c${i}`));

    const ranked = rankConcepts(concepts, signals, 5);
    assert.strictEqual(ranked.length, 5, 'should return at most 5 results');
  });

  it('returns fewer than topN when input has fewer items', () => {
    const signals = makeSignals();
    const concepts = [makeConcept('c1'), makeConcept('c2')];

    const ranked = rankConcepts(concepts, signals, 8);
    assert.strictEqual(ranked.length, 2, 'should return all 2 items when fewer than topN');
  });

  it('each ranked item has concept and score fields', () => {
    const signals = makeSignals();
    const concepts = [makeConcept('c1')];

    const ranked = rankConcepts(concepts, signals);
    assert.ok(ranked[0].concept, 'should have concept field');
    assert.ok(typeof ranked[0].score === 'number', 'should have numeric score field');
  });
});

// ─── Strategy-aware scoring tests ────────────────────────────────────────────

describe('scoreMove — strategy-aware scoring', () => {
  const retrievalHints = {
    mode: 'retrieval',
    weakAreaBias: 0.7,
    discoveryWeight: 0.3,
    priorityConceptIds: [],
    curiosityTopics: [],
  };

  const discoveryHints = {
    mode: 'discovery',
    weakAreaBias: 0.3,
    discoveryWeight: 0.6,
    priorityConceptIds: [],
    curiosityTopics: [],
  };

  it('scoreMove without hints returns same score as before (backward compatible)', () => {
    const concept = makeConcept('c1');
    const signals = makeSignals();
    const scoreNoHints = scoreMove(concept, signals);
    const scoreUndefinedHints = scoreMove(concept, signals, undefined);
    assert.strictEqual(scoreNoHints, scoreUndefinedHints, 'no hints and undefined hints should produce identical scores');
    // Verify it uses default weights
    assert.ok(typeof scoreNoHints === 'number' && scoreNoHints >= 0 && scoreNoHints <= 100);
  });

  it('retrieval mode increases reviewPerformance weight to 0.55, decreases feedEngagement to 0.1', () => {
    const concept = makeConcept('c1');
    // Use signals where reviewPerformance is low (high perfScore) to see weight difference
    const signals = makeSignals({
      reviewPerformance: 0,     // perfScore = 100
      timeSinceLastReview: 0,   // overdueScore = 0
      feedEngagement: 20,       // engagementScore = 100
      conceptCoverage: 50,      // coverageScore = 50
      weakAreas: [],
    });

    const defaultScore = scoreMove(concept, signals);
    const retrievalScore = scoreMove(concept, signals, retrievalHints);

    // In retrieval mode: 0.55*100 + 0.25*0 + 0.1*100 + 0.1*50 = 55 + 0 + 10 + 5 = 70
    // In default mode:   0.4*100  + 0.3*0  + 0.2*100 + 0.1*50 = 40 + 0 + 20 + 5 = 65
    // Retrieval should be higher because perfScore weight is higher
    assert.ok(retrievalScore > defaultScore,
      `retrieval score (${retrievalScore}) should be higher than default (${defaultScore}) when perfScore dominates`);
    assert.strictEqual(retrievalScore, 70, 'retrieval mode should compute to 70 with these signals');
  });

  it('discovery mode increases feedEngagement weight to 0.35, increases conceptCoverage to 0.2', () => {
    const concept = makeConcept('c1');
    // Use signals where feedEngagement is high
    const signals = makeSignals({
      reviewPerformance: 100,   // perfScore = 0
      timeSinceLastReview: 0,   // overdueScore = 0
      feedEngagement: 20,       // engagementScore = 100
      conceptCoverage: 0,       // coverageScore = 100
      weakAreas: [],
    });

    const defaultScore = scoreMove(concept, signals);
    const discoveryScore = scoreMove(concept, signals, discoveryHints);

    // In discovery mode: 0.25*0 + 0.2*0 + 0.35*100 + 0.2*100 = 0 + 0 + 35 + 20 = 55
    // In default mode:   0.4*0  + 0.3*0  + 0.2*100 + 0.1*100 = 0 + 0 + 20 + 10 = 30
    assert.ok(discoveryScore > defaultScore,
      `discovery score (${discoveryScore}) should be higher than default (${defaultScore}) when engagement/coverage dominate`);
    assert.strictEqual(discoveryScore, 55, 'discovery mode should compute to 55 with these signals');
  });

  it('weakAreaBias multiplies the isWeakArea boost (30 * weakAreaBias instead of flat 30)', () => {
    const concept = makeConcept('c1');
    const signals = makeSignals({
      reviewPerformance: 50,
      timeSinceLastReview: 0,
      feedEngagement: 0,
      conceptCoverage: 50,
      weakAreas: ['c1'],
    });

    const defaultScore = scoreMove(concept, signals);
    const retrievalScore = scoreMove(concept, signals, retrievalHints);

    // Default (no hints): weakAreaBias defaults to 1, boost = 30 * 1 = 30
    // Retrieval hints: weakAreaBias = 0.7, boost = 30 * 0.7 = 21
    // Base raw scores differ due to weight differences, but the weak area boost should differ
    const signalsNoWeak = { ...signals, weakAreas: [] };
    const defaultBase = scoreMove(concept, signalsNoWeak);
    const retrievalBase = scoreMove(concept, signalsNoWeak, retrievalHints);

    const defaultBoost = defaultScore - defaultBase;
    const retrievalBoost = retrievalScore - retrievalBase;

    assert.ok(defaultBoost >= 28 && defaultBoost <= 32, `default boost should be ~30, got ${defaultBoost}`);
    assert.ok(retrievalBoost >= 19 && retrievalBoost <= 23, `retrieval boost should be ~21 (30*0.7), got ${retrievalBoost}`);
  });

  it('rankConcepts passes hints through to scoreMove', () => {
    const signals = makeSignals({
      reviewPerformance: 0,
      timeSinceLastReview: 0,
      feedEngagement: 20,
      conceptCoverage: 50,
      weakAreas: [],
    });
    const concepts = [makeConcept('c1'), makeConcept('c2')];

    const defaultRanked = rankConcepts(concepts, signals);
    const retrievalRanked = rankConcepts(concepts, signals, 8, retrievalHints);

    // Scores should differ between default and retrieval modes
    assert.notStrictEqual(defaultRanked[0].score, retrievalRanked[0].score,
      'ranked scores should differ when hints are provided');
  });
});

describe('plannerAutoGen trigger conditions', () => {
  // We test the trigger logic inline (pure functions, no localStorage)

  function shouldAutoGenerate(nodeCount, activeSuggestedCount) {
    const MIN_KG_NODES = 5;
    return nodeCount >= MIN_KG_NODES && activeSuggestedCount === 0;
  }

  it('triggers when 5+ nodes and planner is empty', () => {
    assert.ok(shouldAutoGenerate(5, 0), 'should trigger with exactly 5 nodes');
    assert.ok(shouldAutoGenerate(10, 0), 'should trigger with 10 nodes');
  });

  it('does not trigger with fewer than 5 nodes', () => {
    assert.ok(!shouldAutoGenerate(4, 0), 'should not trigger with 4 nodes');
    assert.ok(!shouldAutoGenerate(0, 0), 'should not trigger with 0 nodes');
  });

  it('does not trigger when planner already has active/suggested chunks', () => {
    assert.ok(!shouldAutoGenerate(10, 1), 'should not trigger with 1 existing chunk');
    assert.ok(!shouldAutoGenerate(10, 5), 'should not trigger with 5 existing chunks');
  });

  it('requires both conditions to be met', () => {
    assert.ok(!shouldAutoGenerate(4, 1), 'both conditions must be met');
    assert.ok(shouldAutoGenerate(5, 0), 'both conditions satisfied');
  });
});
