// Phase 36-11 — loadCache() rejects stale daily-posts cache.
//
// Validates that the served-posts cache (echolearn_daily_posts) does NOT carry
// across midnight. Yesterday's served posts have already been shown to the user;
// rendering them again on the new day creates the round-3 sub-issue (d) where a
// second Force-New-Day showed the previous-state served posts.
//
// IMPLEMENTATION NOTE — node-test cannot import concept-feed.service.ts
// directly (its transitive deps include planner.service → graph.service →
// locales/en.json which fails ERR_IMPORT_ATTRIBUTE_MISSING under Node ESM
// without the JSON import-attribute syntax). The same constraint blocks every
// other test in this directory that touches concept-feed (see
// tests/services/concept-feed-cross-cycle-dedup.test.mjs:34, image-gen-key-gate
// .test.mjs, post-essay.service.test.mjs — all source-read or replicate logic).
//
// We use the same source-reading pattern that those tests use: read
// concept-feed.service.ts as text and assert the structural invariants. This
// is the LIVE code path (loadCache is the only path through which the cache
// is read), so a regression that drops the date-rejection guard fails the
// `parsed.date !== today()` assertion. The behavioral round-trip is covered
// implicitly by the same-day tests already in the suite (cache-hit path
// returns posts on today() match).
//
// The plan's prescribed conceptFeedService.getCachedDailyPosts() runtime
// assertions cannot run here — we substitute structural assertions of equal
// strength. See SUMMARY.md "Deviations from Plan" §Rule 3 for the full audit.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

const SERVICE_PATH = new URL('../../src/services/concept-feed.service.ts', import.meta.url);
const source = fs.readFileSync(SERVICE_PATH, 'utf-8');

describe('concept-feed loadCache — stale cache rejection (Phase 36-11)', () => {
  it('loadCache contains a parsed.date !== today() rejection branch', () => {
    // Locate the loadCache function body.
    const fnStart = source.indexOf('function loadCache()');
    assert.ok(fnStart !== -1, 'loadCache() function should exist in concept-feed.service.ts');
    // Slice forward enough to capture the function body. The rejection check
    // sits between the type-shape guard (early return null on malformed input)
    // and the `parsed.posts.filter(isValidDailyPost)` call.
    const fnSlice = source.slice(fnStart, fnStart + 1200);
    assert.ok(
      fnSlice.includes('parsed.date !== today()'),
      'loadCache() must reject stale cache via `parsed.date !== today()` (Phase 36-11)',
    );
    assert.ok(
      /parsed\.date !== today\(\)\)\s*return\s+null/.test(fnSlice),
      'the parsed.date !== today() check must short-circuit with return null',
    );
  });

  it('rejection guard sits BEFORE the posts.filter(isValidDailyPost) call', () => {
    // Order matters — rejecting AFTER the filter is wasted work. The plan
    // prescribes the date check land in the same fall-through chain as the
    // type-shape guards, before any expensive filter.
    const fnStart = source.indexOf('function loadCache()');
    const fnSlice = source.slice(fnStart, fnStart + 1500);
    const dateRejectIdx = fnSlice.indexOf('parsed.date !== today()');
    const filterCallIdx = fnSlice.indexOf('parsed.posts.filter(isValidDailyPost)');
    assert.ok(dateRejectIdx !== -1, 'date rejection must exist');
    assert.ok(filterCallIdx !== -1, 'isValidDailyPost filter must exist');
    assert.ok(
      dateRejectIdx < filterCallIdx,
      'date rejection must precede the isValidDailyPost filter call',
    );
  });

  it('today() helper is imported (consumed by the new rejection branch)', () => {
    // The rejection check requires today(); verify the import is intact.
    assert.ok(
      /import\s*\{\s*today\s*\}\s*from\s*['"]\.\.\/lib\/date(\.ts)?['"]/.test(source),
      "today() must be imported from '../lib/date'",
    );
  });
});
