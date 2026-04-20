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

  // POST-02: PostDetailScreen imports and calls generatePostEssay from post-essay.service
  it('PostDetailScreen imports generatePostEssay from post-essay.service', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf-8');
    assert.ok(
      source.includes("from '../services/post-essay.service'"),
      'PostDetailScreen.tsx should import from post-essay.service',
    );
    assert.ok(
      source.includes('generatePostEssay'),
      'PostDetailScreen.tsx should reference generatePostEssay',
    );
    assert.ok(
      source.includes('patchPostEssayInCache'),
      'PostDetailScreen.tsx should call patchPostEssayInCache to cache the essay',
    );
  });

  // POST-02: PostDetailScreen has on-enter streaming state and effect
  it('PostDetailScreen wires on-enter streaming state for empty bodyMarkdown posts', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf-8');
    assert.ok(
      source.includes('isStreamingOnEnter'),
      'PostDetailScreen.tsx should have isStreamingOnEnter state',
    );
    assert.ok(
      source.includes('streamingBody'),
      'PostDetailScreen.tsx should have streamingBody state for progressive rendering',
    );
    assert.ok(
      source.includes('onEnterError'),
      'PostDetailScreen.tsx should have onEnterError state for error handling',
    );
    assert.ok(
      source.includes("post.bodyMarkdown && post.bodyMarkdown.trim() !== ''") ||
      source.includes("post.bodyMarkdown.trim() !== ''"),
      'PostDetailScreen.tsx should check post.bodyMarkdown to decide whether to trigger on-enter generation',
    );
  });

  // POST-05: youtube.service._fetchNewVideoPosts defers LLM summary but keeps fetchTranscript
  it('youtube.service _fetchNewVideoPosts defers summarizeTranscript and keeps fetchTranscript', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/youtube.service.ts', import.meta.url), 'utf-8');

    // Find the _fetchNewVideoPosts function body
    const fnStart = source.indexOf('async _fetchNewVideoPosts(');
    assert.ok(fnStart !== -1, 'youtube.service.ts should contain _fetchNewVideoPosts');

    // Extract function body: from fn start to next top-level method (closing brace of method)
    // Heuristic: find the section of source from the function start
    const fnBody = source.slice(fnStart, fnStart + 3000);

    // Must call fetchTranscript inside _fetchNewVideoPosts
    assert.ok(
      fnBody.includes('fetchTranscript'),
      '_fetchNewVideoPosts should still call fetchTranscript (transcript needed for on-enter generation)',
    );

    // Must NOT call summarizeTranscript inside _fetchNewVideoPosts
    assert.ok(
      !fnBody.includes('summarizeTranscript'),
      '_fetchNewVideoPosts should NOT call summarizeTranscript (deferred to on-enter generation)',
    );

    // bodyMarkdown must be set to empty string in _fetchNewVideoPosts
    assert.ok(
      fnBody.includes("bodyMarkdown = ''") || fnBody.includes('bodyMarkdown: \'\''),
      '_fetchNewVideoPosts should set bodyMarkdown to empty string (deferred generation marker)',
    );
  });

  // POST-06 (relocated): news posts in the LIVE concept-feed pipeline must defer body
  // generation to on-enter streaming. The previous version of this test guarded
  // app/src/services/news.service.ts which was orphan/dead code — that's why the
  // 2026-04-19 regression (bodyMarkdown: result.content || '' at concept-feed.service.ts:905)
  // slipped through. The live news branch is in generatePostBatch's `for (const a of newsAssignments)`
  // loop. Guard THAT.
  it('news branch in concept-feed.service.ts defers body to streaming (no eager LLM, no Tavily snippet stored)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/concept-feed.service.ts', import.meta.url), 'utf-8');

    // Locate the news branch — `for (const a of newsAssignments)` block
    const fnStart = source.indexOf('for (const a of newsAssignments)');
    assert.ok(fnStart !== -1, 'concept-feed.service.ts should contain `for (const a of newsAssignments)` block');
    // Bound the inspected region to cover the entire news loop.
    // 2500 chars after Phase 33 quota-burn fix (2026-04-20) added a preFetched cache
    // indirection block before the actual fetch (was 2000). Still tight enough to not
    // spill into the generateTextArtContent block that follows.
    const fnBody = source.slice(fnStart, fnStart + 2500);

    // bodyMarkdown MUST be set to '' (empty string) so PostDetailScreen triggers
    // generateNewsEssay streaming (post-essay.service.ts:133). Storing the raw Tavily
    // content here causes the streamer to be skipped and the user sees a truncated snippet.
    assert.ok(
      fnBody.includes("bodyMarkdown: ''"),
      "news branch must set bodyMarkdown: '' — storing raw Tavily content here regresses to the 2026-04-19 'truncated news body' bug",
    );
    assert.ok(
      !fnBody.includes('bodyMarkdown: result.content'),
      "news branch must NOT assign result.content to bodyMarkdown — that bypasses the on-enter LLM essay streamer",
    );

    // No eager LLM call inside the creation branch (chatCompletion / chatStream).
    // The summary IS LLM-generated, but at on-enter (PostDetailScreen → generateNewsEssay),
    // not during refillQueue's batch creation.
    assert.ok(
      !fnBody.includes('chatCompletion(') && !fnBody.includes('chatStream('),
      'news branch must not call chatCompletion/chatStream eagerly — LLM summary is deferred to on-enter via post-essay.service.ts',
    );

    // newsMeta.sources must include `snippet:` so generateNewsEssay has article text
    // to ground the LLM summary on (otherwise the LLM only sees title + URL).
    assert.ok(
      fnBody.includes('snippet:'),
      'news branch must populate sources[].snippet with article content so generateNewsEssay can ground the LLM summary',
    );
  });
});
