import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_RECOMMENDATION_CONFIG } from '../../src/services/recommendation-config.ts';
import { selectDiverse } from '../../src/services/ranking/diversity-reranker.ts';

function candidate(postId, score, overrides = {}) {
  return {
    postId,
    score,
    sourceId: overrides.sourceId ?? `source-${postId}`,
    primaryConceptId: overrides.primaryConceptId ?? `concept-${postId}`,
    format: overrides.format ?? 'article',
    strategy: overrides.strategy ?? 'deepen',
  };
}

function counters(overrides = {}) {
  return {
    sourceCounts: overrides.sourceCounts ?? {},
    recentPrimaryConceptIds: overrides.recentPrimaryConceptIds ?? [],
    historyQuestionCount: overrides.historyQuestionCount ?? 0,
  };
}

describe('diversity reranker', () => {
  it('enforces the two-per-source cap across previous and current batches', () => {
    const prior = counters({ sourceCounts: { 'source-a': 1 } });
    const result = selectDiverse([
      candidate('post-a1', 1.0, { sourceId: 'source-a' }),
      candidate('post-a2', 0.9, { sourceId: 'source-a' }),
      candidate('post-a3', 0.8, { sourceId: 'source-a' }),
      candidate('post-b', 0.7, { sourceId: 'source-b' }),
    ], 4, prior, DEFAULT_RECOMMENDATION_CONFIG);

    assert.equal(result.selected.filter((item) => item.sourceId === 'source-a').length, 1);
    assert.equal(result.nextCounters.sourceCounts['source-a'], 2);
    assert.deepEqual(prior, counters({ sourceCounts: { 'source-a': 1 } }));
  });

  it('carries the primary-concept run cap across the batch boundary', () => {
    const result = selectDiverse([
      candidate('post-a', 1.0, { primaryConceptId: 'concept-a' }),
      candidate('post-b', 0.9, { primaryConceptId: 'concept-b' }),
      candidate('post-a2', 0.8, { primaryConceptId: 'concept-a' }),
    ], 3, counters({
      recentPrimaryConceptIds: ['concept-a', 'concept-a'],
    }), DEFAULT_RECOMMENDATION_CONFIG);

    assert.equal(result.selected[0].postId, 'post-b');
    const fullSequence = ['concept-a', 'concept-a', ...result.selected.map((item) => item.primaryConceptId)];
    assert.doesNotMatch(fullSequence.join(','), /concept-a,concept-a,concept-a/);
  });

  it('reserves a legal contrast or bridge slot after sufficient history', () => {
    const result = selectDiverse([
      candidate('post-1', 1.0),
      candidate('post-2', 0.9),
      candidate('post-3', 0.8),
      candidate('post-contrast', 0.7, { strategy: 'contrast' }),
    ], 3, counters({ historyQuestionCount: 3 }), DEFAULT_RECOMMENDATION_CONFIG);

    assert.equal(result.selected.length, 3);
    assert.ok(result.selected.some((item) => item.strategy === 'contrast' || item.strategy === 'bridge'));
  });

  it('returns a shorter batch instead of violating a hard cap', () => {
    const result = selectDiverse([
      candidate('post-a1', 1.0, { sourceId: 'source-a' }),
      candidate('post-a2', 0.9, { sourceId: 'source-a' }),
      candidate('post-a3', 0.8, { sourceId: 'source-a' }),
    ], 3, counters(), DEFAULT_RECOMMENDATION_CONFIG);

    assert.equal(result.selected.length, 2);
    assert.equal(result.nextCounters.sourceCounts['source-a'], 2);
  });

  it('treats format mixing as soft and fills an all-article batch', () => {
    const result = selectDiverse([
      candidate('post-1', 1.0, { format: 'article' }),
      candidate('post-2', 0.9, { format: 'article' }),
      candidate('post-3', 0.8, { format: 'article' }),
    ], 3, counters(), DEFAULT_RECOMMENDATION_CONFIG);

    assert.equal(result.selected.length, 3);
  });

  it('is deterministic and uses format variety only to break exact score ties', () => {
    const input = [
      candidate('post-a', 1.0, { format: 'article' }),
      candidate('post-b', 1.0, { format: 'article' }),
      candidate('post-c', 1.0, { format: 'video' }),
    ];
    const first = selectDiverse(input, 3, counters(), DEFAULT_RECOMMENDATION_CONFIG);
    const second = selectDiverse(input, 3, counters(), DEFAULT_RECOMMENDATION_CONFIG);

    assert.deepEqual(first, second);
    assert.deepEqual(first.selected.map((item) => item.postId), ['post-a', 'post-c', 'post-b']);
  });
});
