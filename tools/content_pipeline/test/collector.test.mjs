import assert from 'node:assert/strict';
import test from 'node:test';

const collect = async (fetchSource, url) => {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('sourceUrl: https required');
  return fetchSource(parsed);
};

test('collector seam rejects non-HTTPS input before calling the injected fetcher', async () => {
  let calls = 0;
  await assert.rejects(() => collect(async () => { calls += 1; }, 'file:///etc/passwd'), /https required/);
  assert.equal(calls, 0);
});
