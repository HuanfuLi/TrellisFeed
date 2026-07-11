// 2026-05-12 — guard that generated post bodies survive midnight cache
// rollover. Two source-reading invariants:
//
//   (1) conceptFeedService.getPostById falls back to postHistoryService when
//       the ephemeral daily cache doesn't have the post. Without
//       this, /post-history and /saved + /liked click-throughs render
//       "Post not found" the day after a post is generated, because Phase
//       36-11's stale-cache rejection wipes trellis_daily_posts at midnight.
//
//   (2) patchPostEssayInCache patches post-history too (not just the daily
//       cache) AND does not stop after the first match — a post can live in
//       BOTH, and both copies need the streamed body so the post stays
//       openable across days. The four localStorage keys this used to write
//       were retired by the IndexedDB migration; writing them made the
//       function a no-op, so the assertions now pin the durable routing.
//
// Operator framing 2026-05-12: "the generated posts should be persistent;
// they are ALL valuable ASSETS and they are COSTLY!"

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

function extractFunctionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start > 0, `${signature} must exist`);
  const open = source.indexOf('{', start);
  assert.ok(open > start, `${signature} must have a body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${signature} must have balanced braces`);
}

test('conceptFeedService.getPostById falls back to postHistoryService', () => {
  const src = readFileSync(
    path.join(appRoot, 'src/services/concept-feed.service.ts'),
    'utf8',
  );

  const startIdx = src.indexOf('getPostById(id: string): DailyPost | null');
  assert.ok(startIdx > 0, 'getPostById must exist');
  // Scope: from getPostById opening through the next top-level method.
  const endIdx = src.indexOf('getCachedDailyPosts(', startIdx);
  assert.ok(endIdx > startIdx, 'getCachedDailyPosts must follow getPostById');
  const body = src.slice(startIdx, endIdx);

  assert.match(
    body,
    /postHistoryService\.getPosts\(\)/,
    'getPostById must call postHistoryService.getPosts() as a fallback before returning null',
  );
  // The fallback must come BEFORE the final `return null;` so it actually runs.
  const histIdx = body.search(/postHistoryService\.getPosts\(\)/);
  const finalReturnIdx = body.lastIndexOf('return null');
  assert.ok(
    histIdx > 0 && histIdx < finalReturnIdx,
    'postHistoryService fallback must execute before the final return null',
  );
});

test('patchPostEssayInCache patches the durable post stores', () => {
  const src = readFileSync(
    path.join(appRoot, 'src/services/post-essay.service.ts'),
    'utf8',
  );

  const body = extractFunctionBody(src, 'export function patchPostEssayInCache');

  // Post history is the only durable full-content store — without it, streamed
  // bodies never survive the midnight daily-cache rejection.
  assert.match(
    body,
    /postHistoryService\.patchPost\(/,
    'must patch post history so the streamed body persists across midnight',
  );
  assert.match(
    body,
    /conceptFeedService\.patchPost\(/,
    "must patch today's daily-posts cache so the open post updates in place",
  );

  // The retired keys are deleted at boot by clearLegacyHeavyLocalStorageKeys;
  // writing them silently drops the body.
  for (const key of ['trellis_daily_posts', 'trellis_post_history']) {
    assert.doesNotMatch(
      body,
      new RegExp(`['"]${key}['"]`),
      `must not write the retired ${key} localStorage key`,
    );
  }
});

test('patchPostEssayInCache patches every store, not just the first hit', () => {
  const src = readFileSync(
    path.join(appRoot, 'src/services/post-essay.service.ts'),
    'utf8',
  );

  const body = extractFunctionBody(src, 'export function patchPostEssayInCache');

  // The bug shape was "first store wins, history never gets patched". Both
  // patchPost calls must be unconditional siblings — neither guarded by the
  // other's result, and no early return between them.
  const feedIdx = body.search(/conceptFeedService\.patchPost\(/);
  const histIdx = body.search(/postHistoryService\.patchPost\(/);
  assert.ok(feedIdx > 0 && histIdx > feedIdx, 'both stores must be patched, feed then history');

  const between = body.slice(feedIdx, histIdx);
  assert.doesNotMatch(
    between,
    /\breturn\b/,
    'must not return between the two patches — a post can live in both stores',
  );
  assert.doesNotMatch(
    between,
    /\bif\s*\(/,
    'the history patch must not be conditional on the daily-cache patch succeeding',
  );
});
