import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Pure logic — no localStorage / fetch needed.
const styleMod = await import('../../src/services/style-assignment.ts');
const { assignStylesStratified, STYLE_WEIGHTS } = styleMod;

const allAvailable = { hasImageGenKey: true };

function counts(result) {
  const c = { image: 0, 'text-art': 0, suggestion: 0 };
  for (const r of result) c[r.style] = (c[r.style] ?? 0) + 1;
  return c;
}

describe('style-assignment-stratified (GAP-3)', () => {
  it('N=8 image count is in {0, 1, 2} (round(0.10 x 8)=1 plus or minus 1)', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, allAvailable));
    assert.ok(c.image >= 0 && c.image <= 2, `image=${c.image} out of {0,1,2}`);
  });

  it('N=8 text-art count is in {5, 6, 7} (round(0.75 x 8)=6 plus or minus 1)', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, allAvailable));
    assert.ok(c['text-art'] >= 5 && c['text-art'] <= 7, `text-art=${c['text-art']} out of {5,6,7}`);
  });

  it('N=8 total assignments equal N', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
    const result = assignStylesStratified(ids, allAvailable);
    assert.equal(result.length, 8);
  });

  it('N=12: each style count is at least floor(12 x weight) (largest-remainder lower bound)', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, allAvailable));
    // Sum effective weights so we can compute proper floor
    const sum = Object.values(STYLE_WEIGHTS).reduce((a, b) => a + b, 0);
    for (const [style, weight] of Object.entries(STYLE_WEIGHTS)) {
      const expectedFloor = Math.floor(12 * weight / sum);
      assert.ok(c[style] >= expectedFloor, `${style}=${c[style]} < floor(${expectedFloor})`);
    }
  });

  it('over 50 runs of N=8, EVERY run has image in {0,1,2}, text-art in {5,6,7}', () => {
    for (let run = 0; run < 50; run++) {
      const ids = Array.from({ length: 8 }, (_, i) => `c${i}`);
      const c = counts(assignStylesStratified(ids, allAvailable));
      assert.ok(c.image >= 0 && c.image <= 2, `run ${run}: image=${c.image}`);
      assert.ok(c['text-art'] >= 5 && c['text-art'] <= 7, `run ${run}: text-art=${c['text-art']}`);
    }
  });

  it('N=2 small-N edge: returns 2 valid assignments, no crash', () => {
    const result = assignStylesStratified(['c1', 'c2'], allAvailable);
    assert.equal(result.length, 2);
    const valid = new Set(['image', 'text-art', 'suggestion']);
    for (const r of result) assert.ok(valid.has(r.style));
  });

  it('N=3: text-art appears at least twice (floor(3 x 0.75/sum)=2)', () => {
    const ids = ['c1', 'c2', 'c3'];
    const c = counts(assignStylesStratified(ids, allAvailable));
    assert.ok(c['text-art'] >= 2, `N=3 text-art=${c['text-art']} should be at least 2`);
  });

  it('hasImageGenKey=false: image count is 0 regardless of N', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    const c = counts(assignStylesStratified(ids, { ...allAvailable, hasImageGenKey: false }));
    assert.equal(c.image, 0);
  });

  it('Fisher-Yates produces different orders across runs', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    let differences = 0;
    for (let pair = 0; pair < 50; pair++) {
      const a = assignStylesStratified(ids, allAvailable).map(r => r.style).join(',');
      const b = assignStylesStratified(ids, allAvailable).map(r => r.style).join(',');
      if (a !== b) differences++;
    }
    assert.ok(differences > 0, 'expected at least 1 of 50 paired runs to differ in order');
  });
});
