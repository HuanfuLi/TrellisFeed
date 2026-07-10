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

  it('returns null for starter, connection, suggestion sourceTypes', () => {
    const questionsById = new Map([
      ['q1', { id: 'q1', parentId: 'anchor-1' }],
    ]);
    for (const sourceType of ['starter', 'connection', 'suggestion']) {
      const post = { sourceType, sourceQuestionIds: ['q1'] };
      assert.equal(getAnchorIdForPost(post, questionsById), null, `${sourceType} should return null`);
    }
  });

  it('returns anchorId for concept-backed sourceTypes', () => {
    const questionsById = new Map([
      ['q1', { id: 'q1', parentId: 'anchor-1' }],
    ]);
    for (const sourceType of ['recent', 'related', 'resurfaced', 'mixed', 'text-art']) {
      const post = { sourceType, sourceQuestionIds: ['q1'] };
      assert.equal(getAnchorIdForPost(post, questionsById), 'anchor-1', `${sourceType} should resolve to anchor`);
    }
  });
});

describe('getConceptQuota', () => {
  it('returns all anchor nodes from questionsById', () => {
    const questionsById = new Map([
      ['anchor-1', { id: 'anchor-1', parentId: null, isAnchorNode: true }],
      ['anchor-2', { id: 'anchor-2', parentId: null, isAnchorNode: true }],
      ['q1', { id: 'q1', parentId: 'anchor-1', isAnchorNode: false }],
      ['q2', { id: 'q2', parentId: 'anchor-2', isAnchorNode: false }],
    ]);
    const quota = getConceptQuota([], questionsById);
    assert.equal(quota.size, 2);
    assert.ok(quota.has('anchor-1'));
    assert.ok(quota.has('anchor-2'));
  });

  it('does not depend on posts — posts param is ignored', () => {
    const questionsById = new Map([
      ['anchor-1', { id: 'anchor-1', parentId: null, isAnchorNode: true }],
    ]);
    const quota1 = getConceptQuota([], questionsById);
    const quota2 = getConceptQuota(
      [{ sourceType: 'recent', sourceQuestionIds: ['q1'] }],
      questionsById,
    );
    assert.equal(quota1.size, quota2.size);
  });

  it('excludes non-anchor nodes', () => {
    const questionsById = new Map([
      ['q1', { id: 'q1', parentId: 'anchor-1', isAnchorNode: false }],
      ['q2', { id: 'q2', parentId: 'anchor-1' }],
    ]);
    const quota = getConceptQuota([], questionsById);
    assert.equal(quota.size, 0);
  });
});
