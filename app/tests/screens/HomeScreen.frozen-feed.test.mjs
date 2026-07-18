import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');

test('Home orders from recommendations while resolving immutable frozen posts and concept labels', () => {
  assert.match(source, /recommendationService/);
  assert.match(source, /feed\.getPostById\(recommendation\.postId\)/);
  assert.match(source, /feed\.getConcepts\(post\.id\)/);
});

test('always-mounted Home rereads on each return to /home', () => {
  assert.match(source, /if \(location\.pathname !== '\/home'\) return/);
  assert.match(source, /\[location\.pathname, readRecommendationFeed\]/);
});

test('Home logs each recommendation impression once per retained session', () => {
  assert.match(source, /seenRecommendationIdsRef/);
  assert.match(source, /recordRecommendationImpressions/);
  assert.match(source, /postId: recommendation\.postId/);
  assert.match(source, /recommendationId: recommendation\.id/);
});

test('Home keeps direction slop before claiming the pull gesture', () => {
  const slop = source.indexOf('if (dy < DIRECTION_SLOP)');
  const claim = source.indexOf('claimed = true', slop);
  const prevent = source.indexOf('event.preventDefault()', claim);
  assert.ok(slop >= 0 && claim > slop && prevent > claim);
});

test('Home uses exact frozen-feed empty copy keys', () => {
  assert.match(source, /home\.feed\.emptyTitle/);
  assert.match(source, /home\.feed\.emptyBody/);
});
