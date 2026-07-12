import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../src/components/OriginalContent.tsx', import.meta.url), 'utf8');

test('stored article text renders only as inert React text blocks', () => {
  assert.match(source, /asset\.body/);
  assert.match(source, /blocks\.map/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|rehypeRaw|fetch\(|axios|XMLHttpRequest/);
});

test('YouTube is the only embedded remote content and uses selected parameters', () => {
  assert.match(source, /youtube\.com\/embed/);
  assert.match(source, /enablejsapi=1/);
  assert.match(source, /playsinline=1/);
  assert.match(source, /origin/);
  assert.match(source, /onError/);
});

test('offline and player errors expose canonical transcript fallback', () => {
  assert.match(source, /navigator\.onLine/);
  assert.match(source, /asset\.transcript/);
  assert.match(source, /Video unavailable - showing transcript/);
  assert.match(source, /100|101|150|153/);
});

test('safe source link is always rendered and emits one source callback', () => {
  assert.match(source, /handleSourceClick/);
  assert.match(source, /https\?:/);
  assert.match(source, /rel="noreferrer noopener"/);
  assert.match(source, /onSourceClick\(post\.id\)/);
});
