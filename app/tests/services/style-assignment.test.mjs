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
      hasYoutubeKey: true,
      hasTavilyKey: true,
      hasImageGenKey: true,
    });

    assert.equal(result.length, 20);
    const validStyles = new Set(['image', 'text-art', 'suggestion', 'news', 'video', 'short']);
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
        hasYoutubeKey: true,
        hasTavilyKey: true,
        hasImageGenKey: true,
      });
      imageCount += result.filter((r) => r.style === 'image').length;
    }
    const pct = (imageCount / total) * 100;
    assert.ok(pct >= 5 && pct <= 15, `image pct ${pct.toFixed(1)}% should be 5-15%`);
  });

  it('over 100 runs of assignStyles(100), suggestion percentage is between 2% and 10%', () => {
    let suggestionCount = 0;
    const total = 100 * 100;
    for (let run = 0; run < 100; run++) {
      const ids = Array.from({ length: 100 }, (_, i) => `c${i}`);
      const result = assignStyles(ids, {
        hasYoutubeKey: true,
        hasTavilyKey: true,
        hasImageGenKey: true,
      });
      suggestionCount += result.filter((r) => r.style === 'suggestion').length;
    }
    const pct = (suggestionCount / total) * 100;
    assert.ok(pct >= 2 && pct <= 10, `suggestion pct ${pct.toFixed(1)}% should be 2-10%`);
  });

  it('assignStyles with no YouTube API key returns zero video/short, redistributed to text-art', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `c${i}`);
    const result = assignStyles(ids, {
      hasYoutubeKey: false,
      hasTavilyKey: true,
      hasImageGenKey: true,
    });

    const videoCount = result.filter((r) => r.style === 'video' || r.style === 'short').length;
    assert.equal(videoCount, 0, 'no video/short without YouTube key');

    // text-art should have absorbed the video+short weight (0.10+0.15 = 0.25 extra)
    const textArtCount = result.filter((r) => r.style === 'text-art').length;
    const textArtPct = (textArtCount / 200) * 100;
    // text-art base is 40%, plus 25% = 65%, allow 55-80% range for stats
    assert.ok(textArtPct >= 55 && textArtPct <= 80, `text-art pct ${textArtPct.toFixed(1)}% should be 55-80%`);
  });

  it('assignStyles with no Tavily API key returns zero news, redistributed to text-art', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `c${i}`);
    const result = assignStyles(ids, {
      hasYoutubeKey: true,
      hasTavilyKey: false,
      hasImageGenKey: true,
    });

    const newsCount = result.filter((r) => r.style === 'news').length;
    assert.equal(newsCount, 0, 'no news without Tavily key');

    // text-art should have absorbed news weight (0.20 extra)
    const textArtCount = result.filter((r) => r.style === 'text-art').length;
    const textArtPct = (textArtCount / 200) * 100;
    // text-art base is 40%, plus 20% = 60%, allow 50-70% range
    assert.ok(textArtPct >= 50 && textArtPct <= 70, `text-art pct ${textArtPct.toFixed(1)}% should be 50-70%`);
  });

  it('reassignFailures replaces failed video/news items with text-art', () => {
    const assignments = [
      { conceptId: 'a', style: 'video' },
      { conceptId: 'b', style: 'text-art' },
      { conceptId: 'c', style: 'news' },
      { conceptId: 'd', style: 'short' },
      { conceptId: 'e', style: 'image' },
    ];
    const failedIds = new Set(['a', 'c', 'd']);

    const result = reassignFailures(assignments, failedIds);

    assert.equal(result[0].style, 'text-art', 'failed video -> text-art');
    assert.equal(result[1].style, 'text-art', 'text-art stays text-art');
    assert.equal(result[2].style, 'text-art', 'failed news -> text-art');
    assert.equal(result[3].style, 'text-art', 'failed short -> text-art');
    assert.equal(result[4].style, 'image', 'non-failed image stays image');
  });

  it('STYLE_WEIGHTS sum to 1.0', () => {
    const sum = Object.values(STYLE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `weights sum to ${sum}, expected 1.0`);
  });
});
