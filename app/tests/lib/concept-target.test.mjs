import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { findPostForConcept, postMatchesConcept } = await import('../../src/lib/concept-target.ts');

const questionsById = new Map([
  ['anchor-1', { id: 'anchor-1', isAnchorNode: true, title: 'Memory consolidation', content: 'Memory consolidation' }],
  ['qa-1', { id: 'qa-1', parentId: 'anchor-1', isAnchorNode: false, title: 'Sleep question', content: 'How does sleep affect recall?' }],
  ['anchor-2', { id: 'anchor-2', isAnchorNode: true, title: 'Spacing effect', content: 'Distributed practice' }],
]);

function post(overrides) {
  return {
    id: overrides.id ?? 'post-1',
    sourceType: overrides.sourceType ?? 'recent',
    sourceQuestionIds: overrides.sourceQuestionIds ?? [],
    sourceQuestionTitles: overrides.sourceQuestionTitles ?? [],
  };
}

describe('concept target lookup', () => {
  it('matches posts whose sourceQuestionIds contain a Q&A child of the concept anchor', () => {
    assert.equal(
      postMatchesConcept(post({ sourceQuestionIds: ['qa-1'] }), 'anchor-1', questionsById),
      true,
    );
  });

  it('matches posts whose sourceQuestionIds already contain the concept anchor', () => {
    assert.equal(
      postMatchesConcept(post({ sourceQuestionIds: ['anchor-2'] }), 'anchor-2', questionsById),
      true,
    );
  });

  it('matches legacy posts by sourceQuestionTitles when sourceQuestionIds are empty', () => {
    assert.equal(
      postMatchesConcept(post({ sourceQuestionTitles: ['  memory   consolidation '] }), 'anchor-1', questionsById),
      true,
    );
  });

  it('returns the first post that can render the requested concept tile', () => {
    const posts = [
      post({ id: 'post-other', sourceQuestionIds: ['anchor-2'] }),
      post({ id: 'post-target', sourceQuestionIds: ['qa-1'] }),
    ];

    assert.equal(findPostForConcept(posts, 'anchor-1', questionsById)?.id, 'post-target');
  });
});
