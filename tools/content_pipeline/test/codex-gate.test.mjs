import assert from 'node:assert/strict';
import test from 'node:test';

const advisoryGate = async (review, candidate) => ({ candidate, advisory: await review(candidate), approved: false });

test('Codex review seam cannot approve a candidate', async () => {
  const result = await advisoryGate(async () => ({ verdict: 'approve' }), { id: 'p1' });
  assert.equal(result.approved, false);
});
