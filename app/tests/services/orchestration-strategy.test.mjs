/**
 * orchestration-strategy.test.mjs
 * Unit tests for OrchestrationStrategy interface and defaultStrategy implementation.
 * Phase 20: Orchestration Strategy & Diagnostic Dialogue
 */

import { describe, it, test } from 'node:test';
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defaultStrategy } from '../../src/services/orchestration-strategy.service.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeSignals(overrides = {}) {
  return {
    reviewPerformance: 60,
    questionFrequency: 5,
    timeSinceLastReview: 1 * 24 * 60 * 60 * 1000, // 1 day
    feedEngagement: 5,
    conceptCoverage: 50,
    weakAreas: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('defaultStrategy.computeHints', () => {

  it('returns retrieval mode when weakAreas.length > 3', () => {
    const signals = makeSignals({
      weakAreas: ['q1', 'q2', 'q3', 'q4'],
    });
    const hints = defaultStrategy.computeHints(signals);
    assert.strictEqual(hints.mode, 'retrieval');
    assert.strictEqual(hints.weakAreaBias, 0.7);
    assert.strictEqual(hints.discoveryWeight, 0.3);
  });

  it('returns retrieval mode when reviewPerformance < 40', () => {
    const signals = makeSignals({
      reviewPerformance: 30,
    });
    const hints = defaultStrategy.computeHints(signals);
    assert.strictEqual(hints.mode, 'retrieval');
    assert.strictEqual(hints.weakAreaBias, 0.7);
    assert.strictEqual(hints.discoveryWeight, 0.3);
  });

  it('returns discovery mode when conceptCoverage > 70 AND feedEngagement > 10', () => {
    const signals = makeSignals({
      conceptCoverage: 80,
      feedEngagement: 15,
    });
    const hints = defaultStrategy.computeHints(signals);
    assert.strictEqual(hints.mode, 'discovery');
    assert.strictEqual(hints.discoveryWeight, 0.6);
  });

  it('returns reinforcement mode when timeSinceLastReview > 3 days', () => {
    const signals = makeSignals({
      timeSinceLastReview: 4 * 24 * 60 * 60 * 1000, // 4 days
    });
    const hints = defaultStrategy.computeHints(signals);
    assert.strictEqual(hints.mode, 'reinforcement');
    assert.strictEqual(hints.weakAreaBias, 0.5);
    assert.strictEqual(hints.discoveryWeight, 0.3);
  });

  it('returns balanced mode with balanced signals', () => {
    const signals = makeSignals();
    const hints = defaultStrategy.computeHints(signals);
    assert.strictEqual(hints.mode, 'balanced');
    assert.strictEqual(hints.weakAreaBias, 0.5);
    assert.strictEqual(hints.discoveryWeight, 0.5);
  });

  it('populates priorityConceptIds from weakAreas', () => {
    const signals = makeSignals({
      weakAreas: ['q1', 'q2'],
    });
    const hints = defaultStrategy.computeHints(signals);
    assert.deepStrictEqual(hints.priorityConceptIds, ['q1', 'q2']);
  });

  it('populates curiosityTopics from checkInSignals.curiosity', () => {
    const signals = makeSignals();
    const checkIn = {
      confidence: [],
      confusion: [],
      connections: [],
      curiosity: ['quantum computing', 'neural networks'],
      revisitIntent: [],
    };
    const hints = defaultStrategy.computeHints(signals, checkIn);
    assert.deepStrictEqual(hints.curiosityTopics, ['quantum computing', 'neural networks']);
  });

  it('returns empty curiosityTopics without checkInSignals', () => {
    const signals = makeSignals();
    const hints = defaultStrategy.computeHints(signals);
    assert.deepStrictEqual(hints.curiosityTopics, []);
  });

});

// ─── TD-01 plumbing assertions ───────────────────────────────────────────────

test('TD-01 plumbing: plannerAutoGen.service.ts passes checkInSignals to computeHints', () => {
  const src = readFileSync(path.join(repoRoot, 'src/services/plannerAutoGen.service.ts'), 'utf8');
  assert.ok(
    src.includes('computeHints(signals, checkInSignals)'),
    'plannerAutoGen.service.ts must pass checkInSignals to computeHints',
  );
  assert.ok(
    src.includes('plannerService.getRecentSignals()'),
    'plannerAutoGen.service.ts must call plannerService.getRecentSignals()',
  );
});
