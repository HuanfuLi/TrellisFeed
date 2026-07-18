import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';

import { DEFAULT_RECOMMENDATION_CONFIG } from '../../src/services/recommendation-config.ts';
import { scoreControl } from '../../src/services/ranking/control-ranker.ts';
import {
  generateCandidates,
  scoreExperimental,
  selectStrategy,
} from '../../src/services/ranking/experimental-ranker.ts';

const topic = {
  id: 'topic-1',
  name: 'Systems',
  shortDescription: 'Connected systems.',
  hooks: [],
  coreConceptIds: ['concept-a', 'concept-b'],
  testRubricId: 'rubric-1',
  contentPoolVersion: 'fixture-v1',
};

function controlPost(overrides = {}) {
  return {
    post: {
      id: 'post-a',
      conceptIds: ['concept-a'],
    },
    features: {
      postId: 'post-a',
      topicId: 'topic-1',
      primaryConceptId: 'concept-a',
      sourceId: 'source-a',
      format: 'article',
      qualityScore: 0.8,
      educationalValueScore: 0.6,
      interestingnessScore: 0.7,
      difficulty: 0.25,
    },
    ...overrides,
  };
}

describe('control ranker', () => {
  it('control computes the exact section 11.7 formula and clamps scores', () => {
    const input = {
      posts: [controlPost()],
      topic,
      seenPostIds: new Set(['post-a']),
      dismissedPostIds: new Set(),
      sessionServed: [
        { sourceId: 'source-a', format: 'article' },
        { sourceId: 'source-b', format: 'article' },
      ],
    };

    const [ranked] = scoreControl(input, DEFAULT_RECOMMENDATION_CONFIG);
    const contentQuality = (0.8 + 0.6 + 0.7) / 3;
    const topicRelevance = 0.5;
    const difficultyBalance = 0.5;
    const diversity = 1 - ((1 / 2) + (2 / 2)) / 2;
    const expected = Math.max(0, Math.min(1,
      0.40 * contentQuality
      + 0.25 * topicRelevance
      + 0.15 * 0.7
      + 0.10 * difficultyBalance
      + 0.10 * diversity
      - 0.20,
    ));

    assert.ok(Math.abs(ranked.score - expected) < 1e-9);
    assert.ok(Math.abs(ranked.componentScores.contentQuality - contentQuality) < 1e-9);
    assert.deepEqual({ ...ranked.componentScores, contentQuality }, {
      contentQuality,
      topicRelevance,
      generalInterestingness: 0.7,
      difficultyBalance,
      diversity,
      recentlySeenPenalty: 1,
    });

    const high = scoreControl({
      ...input,
      posts: [controlPost({
        post: { id: 'post-high', conceptIds: ['concept-a', 'concept-b'] },
        features: {
          ...controlPost().features,
          postId: 'post-high',
          qualityScore: 4,
          educationalValueScore: 4,
          interestingnessScore: 4,
          difficulty: 0.5,
        },
      })],
      seenPostIds: new Set(),
      sessionServed: [],
    }, DEFAULT_RECOMMENDATION_CONFIG);
    assert.equal(high[0].score, 1);
  });

  it('control is deterministic, filters dismissed posts, and handles no candidates', () => {
    const input = {
      posts: [
        controlPost({ post: { id: 'post-b', conceptIds: ['concept-a'] }, features: { ...controlPost().features, postId: 'post-b' } }),
        controlPost(),
      ],
      topic,
      seenPostIds: new Set(),
      dismissedPostIds: new Set(['post-b']),
      sessionServed: [],
    };

    assert.deepEqual(
      scoreControl(input, DEFAULT_RECOMMENDATION_CONFIG),
      scoreControl(input, DEFAULT_RECOMMENDATION_CONFIG),
    );
    assert.deepEqual(scoreControl(input, DEFAULT_RECOMMENDATION_CONFIG).map((item) => item.postId), ['post-a']);
    assert.deepEqual(scoreControl({ ...input, posts: [] }, DEFAULT_RECOMMENDATION_CONFIG), []);
  });

  it('control input remains structurally isolated from personal traces', async () => {
    const source = await readFile(new URL('../../src/services/ranking/control-ranker.ts', import.meta.url), 'utf8');
    const codeOnly = source
      .split('\n')
      .filter((line) => !/^\s*(?:\/\/|\*)/.test(line))
      .join('\n');
    assert.doesNotMatch(codeOnly, /UserConceptState|unresolved|graphMemory|readSnapshot|UserQuestion/i);
    assert.match(source, /type ControlRankerInputKeysAreExact/);
  });
});

function experimentalCandidate(id, overrides = {}) {
  const conceptIds = overrides.conceptIds ?? ['concept-a'];
  const claimIds = overrides.claimIds ?? [];
  return {
    post: { id, conceptIds, claimIds },
    features: {
      postId: id,
      topicId: 'topic-1',
      primaryConceptId: conceptIds[0] ?? 'concept-a',
      sourceId: overrides.sourceId ?? `source-${id}`,
      format: overrides.format ?? 'article',
      qualityScore: overrides.qualityScore ?? 0.8,
      educationalValueScore: overrides.educationalValueScore ?? 0.8,
      interestingnessScore: overrides.interestingnessScore ?? 0.8,
      difficulty: overrides.difficulty ?? 0.5,
      viewpoint: overrides.viewpoint ?? 'neutral',
      summaryVector: overrides.summaryVector,
    },
  };
}

function userQuestion(id, createdAt, overrides = {}) {
  return {
    id,
    postId: overrides.postId ?? 'asked-under',
    createdAt,
    extractedConceptIds: overrides.extractedConceptIds ?? ['concept-a'],
    extractedClaimIds: overrides.extractedClaimIds ?? [],
    unresolved: overrides.unresolved ?? false,
    embeddingVector: overrides.embeddingVector,
  };
}

function experimentalInput(candidates, overrides = {}) {
  return {
    candidates,
    globalEdges: overrides.globalEdges ?? [],
    questions: overrides.questions ?? [],
    conceptStates: overrides.conceptStates ?? new Map(),
    recentServed: overrides.recentServed ?? [],
    viewedPosts: overrides.viewedPosts ?? [],
    dismissedPostIds: overrides.dismissedPostIds ?? new Set(),
    embeddingFingerprint: overrides.embeddingFingerprint,
    now: overrides.now ?? (() => Date.parse('2026-07-18T00:00:00.000Z')),
  };
}

describe('experimental ranker', () => {
  it('raises QuestionRelevance and total score for a shared question target concept', () => {
    const shared = experimentalCandidate('post-shared', { conceptIds: ['concept-a'] });
    const unrelated = experimentalCandidate('post-unrelated', { conceptIds: ['concept-b'] });
    const input = experimentalInput([shared, unrelated], {
      questions: [userQuestion('question-a', '2026-07-17T12:00:00.000Z')],
    });
    const ranked = scoreExperimental(input, DEFAULT_RECOMMENDATION_CONFIG);
    const sharedResult = ranked.find((item) => item.postId === 'post-shared');
    const unrelatedResult = ranked.find((item) => item.postId === 'post-unrelated');

    assert.ok(sharedResult.componentScores.questionRelevance.value > unrelatedResult.componentScores.questionRelevance.value);
    assert.ok(sharedResult.score > unrelatedResult.score);
    assert.deepEqual(sharedResult.componentScores.questionRelevance.evidence.questionIds, ['question-a']);
  });

  it('generates and labels an opposing-claim candidate as contrast', () => {
    const viewed = experimentalCandidate('post-viewed', { claimIds: ['claim-a'], viewpoint: 'supportive' });
    const opposing = experimentalCandidate('post-opposing', { claimIds: ['claim-b'], viewpoint: 'critical' });
    const input = experimentalInput([opposing], {
      viewedPosts: [viewed],
      recentServed: [viewed],
      globalEdges: [{
        id: 'contrast-a-b',
        topicId: 'topic-1',
        type: 'contrasts_with',
        sourceId: 'claim-a',
        targetId: 'claim-b',
      }],
    });

    const generated = generateCandidates(input, DEFAULT_RECOMMENDATION_CONFIG);
    assert.deepEqual(generated.map((item) => item.post.id), ['post-opposing']);
    assert.ok(generated[0].generationEvidence.claimIds.includes('claim-b'));
    assert.equal(selectStrategy(opposing, input, DEFAULT_RECOMMENDATION_CONFIG).strategy, 'contrast');
  });

  it('suppresses a vector-similar same-claim same-source near duplicate', () => {
    const fingerprint = { provider: 'fixture', model: 'embedding-v1', dimensions: 2 };
    const config = { ...DEFAULT_RECOMMENDATION_CONFIG, runtimeEmbeddingFingerprint: fingerprint };
    const viewed = experimentalCandidate('post-viewed', {
      claimIds: ['claim-a'], sourceId: 'source-a', summaryVector: [1, 0],
    });
    const near = experimentalCandidate('post-near', {
      claimIds: ['claim-a'], sourceId: 'source-a', summaryVector: [1, 0],
    });
    const distinct = experimentalCandidate('post-distinct', {
      claimIds: ['claim-b'], sourceId: 'source-b', summaryVector: [0, 1],
    });
    const ranked = scoreExperimental(experimentalInput([near, distinct], {
      viewedPosts: [viewed], embeddingFingerprint: fingerprint,
    }), config);
    const nearResult = ranked.find((item) => item.postId === 'post-near');
    const distinctResult = ranked.find((item) => item.postId === 'post-distinct');

    assert.ok(nearResult.componentScores.redundancyPenalty.value > distinctResult.componentScores.redundancyPenalty.value);
    assert.ok(nearResult.score < distinctResult.score);
  });

  it('makes echo eligibility inclusive at the configured age boundary', () => {
    const now = Date.parse('2026-07-18T00:00:00.000Z');
    const candidate = experimentalCandidate('post-echo');
    const youngerInput = experimentalInput([candidate], {
      questions: [userQuestion('question-young', new Date(now - DEFAULT_RECOMMENDATION_CONFIG.echoMinAgeMs + 1).toISOString())],
      now: () => now,
    });
    const boundaryInput = experimentalInput([candidate], {
      questions: [userQuestion('question-boundary', new Date(now - DEFAULT_RECOMMENDATION_CONFIG.echoMinAgeMs).toISOString())],
      now: () => now,
    });

    assert.notEqual(selectStrategy(candidate, youngerInput, DEFAULT_RECOMMENDATION_CONFIG).strategy, 'echo');
    assert.equal(selectStrategy(candidate, boundaryInput, DEFAULT_RECOMMENDATION_CONFIG).strategy, 'echo');
  });

  it('resolves exact strategy affinity ties with the fixed precedence order', () => {
    const now = Date.parse('2026-07-18T00:00:00.000Z');
    const candidate = experimentalCandidate('post-tie', { conceptIds: ['concept-a', 'concept-b'] });
    const input = experimentalInput([candidate], {
      questions: [userQuestion('question-recent', new Date(now - 1_000).toISOString())],
      conceptStates: new Map([
        ['concept-a', { userId: 'user-1', conceptId: 'concept-a', exposureCount: 2, questionCount: 1, savedPostCount: 0, skippedPostCount: 0, interestWeight: 1, uncertaintyWeight: 0, familiarityEstimate: 0.5 }],
        ['concept-b', { userId: 'user-1', conceptId: 'concept-b', exposureCount: 2, questionCount: 1, savedPostCount: 0, skippedPostCount: 0, interestWeight: 1, uncertaintyWeight: 0, familiarityEstimate: 0.5 }],
      ]),
      now: () => now,
    });
    const selected = selectStrategy(candidate, input, DEFAULT_RECOMMENDATION_CONFIG);

    assert.equal(selected.affinities.continue, selected.affinities.bridge);
    assert.equal(selected.strategy, 'continue');
  });

  it('uses only experimental strategies at cold start and sorts equal scores by postId', () => {
    const input = experimentalInput([
      experimentalCandidate('post-b'),
      experimentalCandidate('post-a'),
      experimentalCandidate('post-c', { conceptIds: ['concept-a', 'concept-b'] }),
    ]);
    const ranked = scoreExperimental(input, DEFAULT_RECOMMENDATION_CONFIG);
    const allowed = new Set(['continue', 'deepen', 'contrast', 'bridge', 'echo']);

    for (const item of ranked) {
      assert.ok(allowed.has(item.strategy));
      assert.notEqual(item.strategy, 'continue');
      assert.notEqual(item.strategy, 'echo');
      assert.doesNotMatch(item.strategy, /baseline/);
    }
    assert.deepEqual(ranked.slice(0, 2).map((item) => item.postId), ['post-a', 'post-b']);
  });

  it('fingerprint mismatch skips vector comparison and keeps every component normalized', () => {
    const runtimeFingerprint = { provider: 'fixture', model: 'runtime', dimensions: 2 };
    const poolFingerprint = { provider: 'fixture', model: 'frozen', dimensions: 2 };
    const config = { ...DEFAULT_RECOMMENDATION_CONFIG, runtimeEmbeddingFingerprint: runtimeFingerprint };
    const candidates = Array.from({ length: 40 }, (_, index) => experimentalCandidate(`post-${String(index).padStart(2, '0')}`, {
      conceptIds: [`concept-${index % 3}`],
      claimIds: [`claim-${index % 4}`],
      sourceId: `source-${index % 5}`,
      qualityScore: (index % 11) / 10,
      educationalValueScore: (index % 7) / 6,
      interestingnessScore: (index % 9) / 8,
      difficulty: (index % 13) / 12,
      summaryVector: [index + 1, 1],
    }));
    const input = experimentalInput(candidates, {
      questions: [userQuestion('question-vector', '2026-07-17T12:00:00.000Z', { embeddingVector: [1, 0] })],
      viewedPosts: [experimentalCandidate('post-viewed', { summaryVector: [1, 0] })],
      embeddingFingerprint: poolFingerprint,
    });

    const first = scoreExperimental(input, config);
    const second = scoreExperimental(input, config);
    assert.deepEqual(first, second);
    for (const item of first) {
      for (const component of Object.values(item.componentScores)) {
        assert.ok(component.value >= 0 && component.value <= 1);
        assert.ok(Number.isFinite(component.value));
      }
      const weights = config.weights;
      const expected = Math.max(0, Math.min(1,
        weights.questionRelevance * item.componentScores.questionRelevance.value
        + weights.conceptInterestMatch * item.componentScores.conceptInterestMatch.value
        + weights.continuityWithRecentPosts * item.componentScores.continuityWithRecentPosts.value
        + weights.noveltyOrContrast * item.componentScores.noveltyOrContrast.value
        + weights.contentQuality * item.componentScores.contentQuality.value
        + weights.difficultyFit * item.componentScores.difficultyFit.value
        - weights.redundancyPenalty * item.componentScores.redundancyPenalty.value,
      ));
      assert.ok(Math.abs(item.score - expected) < 1e-12);
    }
  });
});
