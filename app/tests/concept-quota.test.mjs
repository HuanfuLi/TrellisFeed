import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// localStorage polyfill for Node
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { getAnchorIdForPost, getConceptQuota } = await import('../src/services/daily-read.service.ts');

describe('getAnchorIdForPost', () => {
  it('returns question.parentId when sourceQuestionIds resolve to questions with parentId', () => {
    const questionsById = new Map([
      ['q1', { id: 'q1', parentId: 'anchor-1' }],
    ]);
    const post = { sourceType: 'recent', sourceQuestionIds: ['q1'] };
    assert.equal(getAnchorIdForPost(post, questionsById), 'anchor-1');
  });

  it('returns sourceQuestionIds[0] as surrogate when questions lack parentId', () => {
    const questionsById = new Map([
      ['q1', { id: 'q1' }],
    ]);
    const post = { sourceType: 'recent', sourceQuestionIds: ['q1'] };
    assert.equal(getAnchorIdForPost(post, questionsById), 'q1');
  });

  it('returns null for posts with empty sourceQuestionIds', () => {
    const questionsById = new Map();
    const post = { sourceType: 'recent', sourceQuestionIds: [] };
    assert.equal(getAnchorIdForPost(post, questionsById), null);
  });
});

describe('getConceptQuota', () => {
  it('deduplicates — two posts with same anchorId count as 1 concept', () => {
    const questionsById = new Map([
      ['q1', { id: 'q1', parentId: 'anchor-1' }],
      ['q2', { id: 'q2', parentId: 'anchor-1' }],
    ]);
    const posts = [
      { sourceType: 'recent', sourceQuestionIds: ['q1'] },
      { sourceType: 'related', sourceQuestionIds: ['q2'] },
    ];
    const quota = getConceptQuota(posts, questionsById);
    assert.equal(quota.size, 1);
    assert.ok(quota.has('anchor-1'));
  });

  it('excludes sourceType starter, connection, video, short, news', () => {
    const questionsById = new Map([
      ['q1', { id: 'q1', parentId: 'anchor-1' }],
    ]);
    const excludedTypes = ['starter', 'connection', 'video', 'short', 'news'];
    for (const sourceType of excludedTypes) {
      const posts = [{ sourceType, sourceQuestionIds: ['q1'] }];
      const quota = getConceptQuota(posts, questionsById);
      assert.equal(quota.size, 0, `sourceType '${sourceType}' should be excluded`);
    }
  });

  it('includes sourceType recent, related, resurfaced, mixed', () => {
    const questionsById = new Map([
      ['q1', { id: 'q1', parentId: 'anchor-1' }],
      ['q2', { id: 'q2', parentId: 'anchor-2' }],
      ['q3', { id: 'q3', parentId: 'anchor-3' }],
      ['q4', { id: 'q4', parentId: 'anchor-4' }],
    ]);
    const includedTypes = ['recent', 'related', 'resurfaced', 'mixed'];
    const posts = includedTypes.map((sourceType, i) => ({
      sourceType,
      sourceQuestionIds: [`q${i + 1}`],
    }));
    const quota = getConceptQuota(posts, questionsById);
    assert.equal(quota.size, 4);
  });
});
