import assert from 'node:assert/strict';
import test from 'node:test';

const dedupe = (candidates, fingerprint) => [...new Map(candidates.map((item) => [fingerprint(item), item])).values()];

test('dedupe seam deterministically keeps one candidate per injected fingerprint', () => {
  assert.deepEqual(dedupe([{ id: 'a', body: 'same' }, { id: 'b', body: 'same' }], (x) => x.body), [{ id: 'b', body: 'same' }]);
});
