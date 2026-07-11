import assert from 'node:assert/strict';
import test from 'node:test';

import { groupDuplicates } from '../src/dedupe/index.ts';

const candidates = [
  { id: 'c', canonicalUrl: 'https://example.com/c', contentHash: 'hash-c', fullText: 'AI agents reorganize work by automating bounded tasks and supporting people.' },
  { id: 'a', canonicalUrl: 'https://example.com/a', contentHash: 'hash-a', fullText: 'AI agents reorganize work by automating bounded tasks and supporting workers.' },
  { id: 'b', canonicalUrl: 'https://example.com/a', contentHash: 'hash-b', fullText: 'A distinct rendering of the same source.' },
  { id: 'd', canonicalUrl: 'https://example.com/d', contentHash: 'hash-c', fullText: 'Republished content with the same normalized body.' },
  { id: 'z', canonicalUrl: 'https://example.com/z', contentHash: 'hash-z', fullText: 'Marine biology field notes.' },
];

test('exact URL/hash and near-text duplicates group deterministically without deleting evidence', () => {
  const forward = groupDuplicates(candidates, { shingleSize: 2, nearThreshold: 0.5 });
  const reverse = groupDuplicates([...candidates].reverse(), { shingleSize: 2, nearThreshold: 0.5 });
  assert.deepEqual(reverse, forward);
  assert.deepEqual(forward.map((group) => group.candidateIds), [['a', 'b', 'c', 'd'], ['z']]);
  assert.equal(forward[0].representativeId, 'a');
  assert.deepEqual(forward[0].reasons, ['canonical-url', 'content-hash', 'near-text']);
  assert.equal(forward.flatMap((group) => group.candidateIds).sort().join(','), 'a,b,c,d,z');
  assert.equal('approved' in forward[0], false);
});

test('near comparison is bounded and rejects invalid limits', () => {
  assert.throws(() => groupDuplicates(candidates, { maxCandidates: 2 }), /candidate limit/);
  assert.throws(() => groupDuplicates(candidates, { shingleSize: 0 }), /shingle size/);
});
