import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');

test('Home reads only the condition-neutral frozen feed and concept labels', () => {
  assert.match(source, /frozenFeedService\.getFeed\(\)/);
  assert.match(source, /frozenFeedService\.getConcepts\(post\.id\)/);
  assert.doesNotMatch(source, /conceptFeedService|postQueueService|infiniteScrollService|useQuestions|studyCondition/);
});

test('always-mounted Home rereads on each return to /home', () => {
  assert.match(source, /if \(location\.pathname !== '\/home'\) return/);
  assert.match(source, /\[location\.pathname, readFrozenFeed\]/);
});

test('Home logs each visible frozen batch once per semantic exposure', () => {
  assert.match(source, /visibleBatchRef/);
  assert.match(source, /interactionLog\.record\('feed_impression'\)/);
  assert.match(source, /visibleBatchRef\.current = null/);
});

test('Home keeps direction slop before claiming the pull gesture', () => {
  const slop = source.indexOf('if (dy < DIRECTION_SLOP)');
  const claim = source.indexOf('claimed = true', slop);
  const prevent = source.indexOf('event.preventDefault()', claim);
  assert.ok(slop >= 0 && claim > slop && prevent > claim);
});

test('Home uses exact frozen-feed empty copy keys and no generation state', () => {
  assert.match(source, /home\.feed\.emptyTitle/);
  assert.match(source, /home\.feed\.emptyBody/);
  assert.doesNotMatch(source, /isGenerating|generationError|FEED_REFILL_COMPLETED/);
});
