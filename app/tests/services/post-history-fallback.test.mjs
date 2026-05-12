// 2026-05-12 — guard that generated post bodies survive midnight cache
// rollover. Two source-reading invariants:
//
//   (1) conceptFeedService.getPostById falls back to postHistoryService when
//       the ephemeral daily/video/news caches don't have the post. Without
//       this, /post-history and /saved + /liked click-throughs render
//       "Post not found" the day after a post is generated, because Phase
//       36-11's stale-cache rejection wipes trellis_daily_posts at midnight.
//
//   (2) patchPostEssayInCache writes to trellis_post_history too (not just
//       the daily/video/news caches) AND does NOT return after the first
//       match — a post can live in BOTH the daily cache and post-history,
//       and both copies need the streamed body so the post stays openable
//       across days.
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

test('patchPostEssayInCache writes trellis_post_history alongside ephemeral caches', () => {
  const src = readFileSync(
    path.join(appRoot, 'src/services/post-essay.service.ts'),
    'utf8',
  );

  const startIdx = src.indexOf('export function patchPostEssayInCache');
  assert.ok(startIdx > 0, 'patchPostEssayInCache must exist');
  const endIdx = src.indexOf('\n}\n', startIdx);
  assert.ok(endIdx > startIdx, 'function body must terminate with `}` on its own line');
  const body = src.slice(startIdx, endIdx);

  // History key must be in the cacheKeys array — without it, streamed bodies
  // never persist to the only durable post store.
  assert.match(
    body,
    /['"]trellis_post_history['"]/,
    'cacheKeys must include trellis_post_history so the streamed body persists across midnight',
  );

  // Confirm all 4 stores are listed.
  for (const key of ['trellis_daily_posts', 'trellis_video_cache', 'trellis_news_posts', 'trellis_post_history']) {
    assert.match(body, new RegExp(`['"]${key}['"]`), `cacheKeys must include ${key}`);
  }
});

test('patchPostEssayInCache does NOT early-return on first cache hit', () => {
  const src = readFileSync(
    path.join(appRoot, 'src/services/post-essay.service.ts'),
    'utf8',
  );

  const startIdx = src.indexOf('export function patchPostEssayInCache');
  const endIdx = src.indexOf('\n}\n', startIdx);
  const body = src.slice(startIdx, endIdx);

  // The body MUST NOT contain a bare `return;` inside the loop — that was
  // the bug shape: first cache wins, history never gets patched even if it
  // is in cacheKeys.
  //
  // Tolerated patterns:
  //   - `return null;` from the closing or unrelated code (none expected here)
  //   - block-level continue / break (we expect neither, but they're fine)
  assert.doesNotMatch(
    body,
    /\n\s*return\s*;\s*$/m,
    'patchPostEssayInCache must NOT `return;` after the first match — every cache that has the post needs the patch',
  );
});
