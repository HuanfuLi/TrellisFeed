import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';

import { DEFAULT_RECOMMENDATION_CONFIG } from '../../src/services/recommendation-config.ts';
import { scoreControl } from '../../src/services/ranking/control-ranker.ts';

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
