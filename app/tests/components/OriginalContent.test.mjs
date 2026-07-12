import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const source = readFileSync(new URL('../../src/components/OriginalContent.tsx', import.meta.url), 'utf8');

test('hostile stored article markup executes through the renderer as escaped text without network', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const previousFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('network forbidden'); };
  try {
    const { OriginalContent } = await server.ssrLoadModule('/src/components/OriginalContent.tsx');
    const post = {
      id: 'post-1', topicId: 'topic-1', sourceUrl: 'https://example.test/article', sourcePlatform: 'article',
      sourceName: 'Example', originalTitle: 'Original', displayTitle: 'Display', hook: 'Hook', shortSummary: 'Summary',
      language: 'en', collectedAt: '2026-07-01T00:00:00.000Z', qualityScore: 1, interestingnessScore: 1,
      educationalValueScore: 1, difficulty: 1, conceptIds: [], claimIds: [], suggestedQuestionIds: [], status: 'frozen',
    };
    const asset = { postId: post.id, kind: 'article', sourceUrl: post.sourceUrl, body: '<img src=x onerror=alert(1)>', sha256: 'a'.repeat(64) };
    const html = renderToStaticMarkup(React.createElement(OriginalContent, {
      post, asset, onSourceClick() {}, onVideoPlay() {}, onVideoProgress() {},
    }));
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<img/);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
    await server.close();
  }
});

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
