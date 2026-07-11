import assert from 'node:assert/strict';
import test from 'node:test';

const getFeed = (repository) => repository.feedOrder().map((id) => repository.getPost(id));
test('frozen feed seam follows manifest order without condition input', () => {
  const repo = { feedOrder: () => ['b', 'a'], getPost: (id) => ({ id }) };
  assert.deepEqual(getFeed(repo).map((x) => x.id), ['b', 'a']);
});
