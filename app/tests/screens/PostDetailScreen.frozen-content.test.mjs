import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf8');

test('PostDetail resolves only frozen post records and stored originals', () => {
  assert.match(source, /frozenFeedService\.getPostById\(id\)/);
  assert.match(source, /frozenFeedService\.getOriginalContent\(id\)/);
  assert.match(source, /<OriginalContent/);
});

test('PostDetail preserves portal Header and a single owned scroll root', () => {
  assert.match(source, /<Header/);
  assert.match(source, /overflowY: 'auto'/);
  assert.doesNotMatch(source, /transform:|contain:|willChange:|will-change/);
});

test('PostDetail preserves all three CONCEPT_EXPLORED detectors', () => {
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /30_000/);
  assert.match(source, /Detector C/);
  assert.match(source, /type: 'CONCEPT_EXPLORED'/);
  assert.equal((source.match(/type: 'CONCEPT_EXPLORED'/g) ?? []).length, 1);
});

test('post/source/video logging remains one event per semantic action', () => {
  for (const event of ['post_open', 'post_close', 'source_click', 'video_play', 'video_progress']) {
    assert.match(source, new RegExp(`interactionLog\\.record\\('${event}'`), `missing ${event}`);
  }
  assert.match(source, /postHistoryService\.recordPostViewed\(post\.id\)/);
});

test('save, not-interested, and seen-enough controls use frozen post IDs', () => {
  assert.match(source, /engagementService\.savePost\(post\.id\)/);
  assert.match(source, /engagementService\.dismissPost\(post\.id\)/);
  assert.match(source, /emitExplored\(primaryConceptId\)/);
});
