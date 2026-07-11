import assert from 'node:assert/strict';
import test from 'node:test';

const review = (candidate, operatorDecision) => ({ ...candidate, status: operatorDecision(candidate) ? 'approved' : 'rejected' });

test('review seam requires an injected operator decision', () => {
  assert.equal(review({ id: 'p1' }, () => false).status, 'rejected');
});
