import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('post-essay.service', () => {
  // POST-01: batch generation prompt does not request bodyMarkdown
  it('batch generation prompt excludes bodyMarkdown', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/concept-feed.service.ts', import.meta.url), 'utf-8');
    assert.ok(source.includes('Do NOT include bodyMarkdown'), 'concept-feed.service.ts should instruct LLM to skip bodyMarkdown');
  });

  // POST-04: patchPostEssayInCache persists through the owning services.
  //
  // This used to assert the source contained the literal `trellis_daily_posts` /
  // `trellis_video_cache` / `trellis_news_posts` localStorage keys. The IndexedDB
  // migration retired all three (the boot sweep deletes them), so those
  // assertions were pinning the function to stores nothing reads — it had become
  // a silent no-op and every post body was regenerated on open. Assert the
  // durable routing instead.
  it('post-essay.service.ts patches the durable post stores', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/post-essay.service.ts', import.meta.url), 'utf-8');
    assert.ok(source.includes('patchPostEssayInCache'), 'post-essay.service.ts should export patchPostEssayInCache');
    assert.ok(source.includes('conceptFeedService.patchPost'), 'should patch the daily-posts cache via conceptFeedService');
    assert.ok(source.includes('postHistoryService.patchPost'), 'should patch post history, the durable full-content store');
    assert.ok(
      !/localStorage\.\w+Item\(\s*['"`]trellis_(daily_posts|video_cache|news_posts|post_history)/.test(source),
      'must not touch the retired localStorage keys — the boot sweep deletes them',
    );
  });

});
