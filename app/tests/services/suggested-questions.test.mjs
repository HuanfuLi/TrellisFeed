import assert from 'node:assert/strict';
import test from 'node:test';

const forPost = (questions, postId) => questions.filter((q) => q.postId === postId);
test('suggestion seam never crosses post boundaries', () => {
  assert.deepEqual(forPost([{ id: 'q1', postId: 'p1' }, { id: 'q2', postId: 'p2' }], 'p1').map((x) => x.id), ['q1']);
});
