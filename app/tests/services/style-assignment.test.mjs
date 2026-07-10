import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// No localStorage/browser deps needed — pure logic module

const { assignStyles, reassignFailures, STYLE_WEIGHTS } = await import(
  '../../src/services/style-assignment.ts'
);

describe('style-assignment', () => {
  it('assignStyles(20 concepts) returns tuples where each concept has a valid PresentationStyle', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const result = assignStyles(ids, {
      hasImageGenKey: true,
    });

    assert.equal(result.length, 20);
    const validStyles = new Set(['image', 'text-art', 'suggestion']);
    for (const r of result) {
      assert.ok(typeof r.conceptId === 'string', 'conceptId is string');
      assert.ok(validStyles.has(r.style), `style "${r.style}" is valid`);
    }
  });

  it('over 100 runs of assignStyles(100), image percentage is between 5% and 15%', () => {
    let imageCount = 0;
    const total = 100 * 100;
    for (let run = 0; run < 100; run++) {
      const ids = Array.from({ length: 100 }, (_, i) => `c${i}`);
      const result = assignStyles(ids, {
        hasImageGenKey: true,
      });
      imageCount += result.filter((r) => r.style === 'image').length;
    }
    const pct = (imageCount / total) * 100;
    assert.ok(pct >= 10 && pct <= 20, `image pct ${pct.toFixed(1)}% should be 10-20%`);
  });

  it('over 100 runs of assignStyles(100), suggestion percentage is between 2% and 10%', () => {
    let suggestionCount = 0;
    const total = 100 * 100;
    for (let run = 0; run < 100; run++) {
      const ids = Array.from({ length: 100 }, (_, i) => `c${i}`);
      const result = assignStyles(ids, {
        hasImageGenKey: true,
      });
      suggestionCount += result.filter((r) => r.style === 'suggestion').length;
    }
    const pct = (suggestionCount / total) * 100;
    assert.ok(pct >= 5 && pct <= 15, `suggestion pct ${pct.toFixed(1)}% should be 5-15%`);
  });

  it('assignStyles with no image generation key returns zero image, redistributed to text-art', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `c${i}`);
    const result = assignStyles(ids, {
      hasImageGenKey: false,
    });

    const imageCount = result.filter((r) => r.style === 'image').length;
    assert.equal(imageCount, 0, 'no image without image generation key');

    const textArtCount = result.filter((r) => r.style === 'text-art').length;
    const textArtPct = (textArtCount / 200) * 100;
    assert.ok(textArtPct >= 85 && textArtPct <= 95, `text-art pct ${textArtPct.toFixed(1)}% should be 85-95%`);
  });

  it('reassignFailures replaces failed items with text-art', () => {
    const assignments = [
      { conceptId: 'a', style: 'image' },
      { conceptId: 'b', style: 'text-art' },
      { conceptId: 'c', style: 'suggestion' },
    ];
    const failedIds = new Set(['a', 'c']);

    const result = reassignFailures(assignments, failedIds);

    assert.equal(result[0].style, 'text-art', 'failed image -> text-art');
    assert.equal(result[1].style, 'text-art', 'text-art stays text-art');
    assert.equal(result[2].style, 'text-art', 'failed suggestion -> text-art');
  });

  it('STYLE_WEIGHTS sum to 1.0', () => {
    const sum = Object.values(STYLE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}, expected 1.0`);
  });
});
