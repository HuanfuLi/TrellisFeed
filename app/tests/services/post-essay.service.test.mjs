import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('post-essay.service', () => {
  // POST-01: batch generation prompt does not request bodyMarkdown
  it('batch generation prompt excludes bodyMarkdown', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/concept-feed.service.ts', import.meta.url), 'utf-8');
    assert.ok(source.includes('Do NOT include bodyMarkdown'), 'concept-feed.service.ts should instruct LLM to skip bodyMarkdown');
  });

  // POST-04: patchPostEssayInCache function exists and handles all caches
  it('post-essay.service.ts exports patchPostEssayInCache', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/post-essay.service.ts', import.meta.url), 'utf-8');
    assert.ok(source.includes('patchPostEssayInCache'), 'post-essay.service.ts should export patchPostEssayInCache');
    assert.ok(source.includes('echolearn_daily_posts'), 'should patch main cache');
    assert.ok(source.includes('echolearn_video_cache'), 'should patch video cache');
    assert.ok(source.includes('echolearn_news_posts'), 'should patch news cache');
    assert.ok(source.includes('echolearn_short_posts'), 'should patch shorts cache');
  });
});
