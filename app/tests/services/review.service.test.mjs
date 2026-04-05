import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('review.service', () => {
  // REVIEW-01: getTodayReviewItems returns all due cards (no .slice cap)
  it('getTodayReviewItems returns all due items without slicing', async () => {
    // Source-level assertion: review.service.ts should not cap due items with .slice()
    // Before fix: code has `due.slice(0, 10)` -- this test FAILS
    // After fix: code returns all due items without slicing -- this test PASSES
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/review.service.ts', import.meta.url), 'utf-8');
    assert.ok(!source.includes('.slice(0,'), 'review.service.ts should not contain .slice(0, ...) cap on due items');
  });

  // REVIEW-05: default dailyLimit is 50
  it('default dailyLimit is 50', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/settings.service.ts', import.meta.url), 'utf-8');
    assert.ok(source.includes('dailyLimit: 50'), 'settings.service.ts should have dailyLimit: 50');
  });
});
