import assert from 'node:assert/strict';
import test from 'node:test';

const ask = async (question, filter, model) => filter(question) ? model(question) : { rejected: true };
test('post Q&A seam rejects unsafe text before a model call', async () => {
  let calls = 0;
  const result = await ask('unsafe', () => false, async () => { calls += 1; });
  assert.equal(result.rejected, true); assert.equal(calls, 0);
});
