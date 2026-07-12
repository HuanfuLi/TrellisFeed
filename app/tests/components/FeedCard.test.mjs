import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../src/components/FeedCard.tsx', import.meta.url), 'utf8');

test('FeedCard renders the canonical frozen-post metadata', () => {
  for (const field of [
    'displayTitle', 'hook', 'sourcePlatform', 'sourceName', 'shortSummary',
    'readingTimeMinutes', 'durationSeconds', 'difficulty', 'viewpoint',
  ]) {
    assert.match(source, new RegExp(`post\\.${field}`), `missing post.${field}`);
  }
  assert.match(source, /conceptLabels\.map/);
});

test('FeedCard exposes one accessible whole-card activation surface', () => {
  assert.match(source, /role="button"/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /event\.key === 'Enter'/);
  assert.match(source, /event\.key === ' '/);
  assert.match(source, /minHeight: '44px'/);
  assert.match(source, /onOpen\(post\.id\)/);
});

test('FeedCard contains no generated-feed or recommendation-reason surface', () => {
  assert.doesNotMatch(source, /DailyPost|presentationStyle|imageGeneration|quickAskPrompts|recommendationReason/);
});
