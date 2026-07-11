import assert from 'node:assert/strict';
import test from 'node:test';

const freeze = (posts, writeArtifact) => writeArtifact(posts.filter((post) => post.status === 'approved').map((post) => ({ ...post, status: 'frozen' })));

test('freeze seam exports approved records only through an injected writer', () => {
  let output;
  freeze([{ id: 'a', status: 'approved' }, { id: 'b', status: 'rejected' }], (value) => { output = value; });
  assert.deepEqual(output, [{ id: 'a', status: 'frozen' }]);
});
