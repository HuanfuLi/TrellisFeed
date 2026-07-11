import assert from 'node:assert/strict';
import test from 'node:test';

const qualityGate = (candidate, score) => ({ ...candidate, accepted: score(candidate) >= 0.5 });

test('quality seam keeps scoring injectable and bounded to an explicit verdict', () => {
  assert.equal(qualityGate({ id: 'p1' }, () => 0.49).accepted, false);
});
