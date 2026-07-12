import assert from 'node:assert/strict';
import test from 'node:test';

import { scoreMechanicalQuality } from '../src/quality/index.ts';

test('evergreen candidate exposes positive review signals but is never auto-approved', () => {
  const verdict = scoreMechanicalQuality({
    id: 'evergreen', canonicalUrl: 'https://example.org/agents', fullText: 'AI agents can support workers. '.repeat(80),
    language: 'en', publicationDate: '2024-05-01', evergreen: true, videoUrlReady: true,
    sourceShare: 0.2, stanceShare: 0.4,
  }, { topicKeywords: ['AI agents', 'workers'], now: new Date('2026-07-11T00:00:00Z') });
  assert.equal(verdict.disposition, 'review');
  assert.ok(verdict.signals.some((signal) => signal.code === 'evergreen'));
  assert.ok(verdict.signals.some((signal) => signal.code === 'topic-relevant'));
  assert.equal('approved' in verdict, false);
});

test('dated promotional and too-short candidates expose deterministic reason codes', () => {
  const verdict = scoreMechanicalQuality({
    id: 'weak', canonicalUrl: 'https://example.org/login?next=buy', fullText: 'Buy our agent now!',
    language: 'fr', publicationDate: '2018-01-01', evergreen: false, videoUrlReady: false,
    sourceShare: 0.7, stanceShare: 0.8,
  }, { topicKeywords: ['AI agents', 'future work'], expectedLanguage: 'en', isVideo: true, now: new Date('2026-07-11T00:00:00Z') });
  assert.equal(verdict.disposition, 'reject');
  assert.deepEqual(verdict.signals.filter((signal) => signal.level === 'fail').map((signal) => signal.code), [
    'extraction-too-short', 'unstable-url', 'language-mismatch', 'video-url-missing', 'topic-irrelevant',
  ]);
  assert.ok(verdict.signals.some((signal) => signal.code === 'dated'));
  assert.ok(verdict.signals.some((signal) => signal.code === 'source-concentration'));
  assert.ok(verdict.signals.some((signal) => signal.code === 'stance-concentration'));
});

test('quality scoring has stable output independent of keyword order', () => {
  const candidate = { id: 'x', canonicalUrl: 'https://example.org/x', fullText: 'Agents and work '.repeat(30), language: 'en' };
  const first = scoreMechanicalQuality(candidate, { topicKeywords: ['work', 'agents'] });
  const second = scoreMechanicalQuality(candidate, { topicKeywords: ['agents', 'work'] });
  assert.deepEqual(first, second);
});
