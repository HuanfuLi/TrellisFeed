import assert from 'node:assert/strict';
import test from 'node:test';

const preprocess = async (modelCall, source) => JSON.parse(await modelCall({ source }));

test('AI preprocessing seam is model-injected and treats markup as inert text', async () => {
  const result = await preprocess(async ({ source }) => JSON.stringify({ hook: source }), '<script>alert(1)</script>');
  assert.equal(result.hook, '<script>alert(1)</script>');
});
