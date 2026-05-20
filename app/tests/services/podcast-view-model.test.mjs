// Phase 52-04 Task 1 — Behavioral tests for the podcast-view-model leaf module.
//
// These cover the three UAT `missing:` fields the source-read-only test missed:
//   1. GAP-3 mutual exclusion — player + empty state can never both show.
//   2. GAP-3 selection — no podcasts[0] fallback in the main-player path.
//   3. GAP-4 fresh-play binding — deriveSelectedPodcast returns the today podcast.
//   4. GAP-4 isDirty reconciliation — fresh, unchanged-chip podcast is NOT dirty.
//
// Pure-logic unit test via dynamic import (NO jsdom — the project has no React
// render harness; behavioral tests target extracted pure helpers). Pattern
// copied from tests/services/podcast-options.test.mjs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const MOD = '../../src/services/podcast-view-model.ts';
const PROMPT = '../../src/services/podcast-prompt.ts';

/** @returns {Promise<import('../../src/services/podcast-view-model.ts')>} */
async function load() {
  return import(MOD);
}

function readyPodcast(id, date, extra = {}) {
  return {
    id,
    date,
    questionIds: ['c1', 'c2'],
    script: 'hello',
    status: 'ready',
    createdAt: 1,
    ...extra,
  };
}

describe('deriveSelectedPodcast', () => {
  it('returns the History-selected podcast when selectedId is present and found', async () => {
    const { deriveSelectedPodcast } = await load();
    const old1 = readyPodcast('old-1', '2026-05-01');
    const today = readyPodcast('today-1', '2026-05-19');
    const result = deriveSelectedPodcast({
      selectedId: 'old-1',
      podcasts: [today, old1],
      todayPodcast: today,
    });
    assert.equal(result?.id, 'old-1', 'explicit History selection must win');
  });

  it('returns null (NOT podcasts[0]) when no selectedId and no todayPodcast — GAP-3 fix', async () => {
    const { deriveSelectedPodcast } = await load();
    const staleReady = readyPodcast('stale-1', '2026-05-01');
    const result = deriveSelectedPodcast({
      selectedId: null,
      podcasts: [staleReady],
      todayPodcast: undefined,
    });
    assert.equal(result, null, 'no podcasts[0] fallback — main player only shows today');
  });

  it('returns the today podcast when no selectedId and todayPodcast exists', async () => {
    const { deriveSelectedPodcast } = await load();
    const todayReady = readyPodcast('today-1', '2026-05-19');
    const result = deriveSelectedPodcast({
      selectedId: null,
      podcasts: [todayReady],
      todayPodcast: todayReady,
    });
    assert.equal(result?.id, 'today-1');
  });

  it('falls back to todayPodcast when selectedId is set but not found', async () => {
    const { deriveSelectedPodcast } = await load();
    const todayReady = readyPodcast('today-1', '2026-05-19');
    const result = deriveSelectedPodcast({
      selectedId: 'ghost-id',
      podcasts: [todayReady],
      todayPodcast: todayReady,
    });
    assert.equal(result?.id, 'today-1', 'unknown selectedId falls through to today');
  });
});

describe('isEmptyStateVisible', () => {
  it('is true when todayPodcast is undefined', async () => {
    const { isEmptyStateVisible } = await load();
    assert.equal(isEmptyStateVisible({ todayPodcast: undefined }), true);
  });

  it('is true when todayPodcast is pending', async () => {
    const { isEmptyStateVisible } = await load();
    assert.equal(isEmptyStateVisible({ todayPodcast: readyPodcast('p', 'd', { status: 'pending' }) }), true);
  });

  it('is true when todayPodcast is failed', async () => {
    const { isEmptyStateVisible } = await load();
    assert.equal(isEmptyStateVisible({ todayPodcast: readyPodcast('p', 'd', { status: 'failed' }) }), true);
  });

  it('is false when todayPodcast is ready', async () => {
    const { isEmptyStateVisible } = await load();
    assert.equal(isEmptyStateVisible({ todayPodcast: readyPodcast('p', 'd', { status: 'ready' }) }), false);
  });

  it('is false when todayPodcast is generating', async () => {
    const { isEmptyStateVisible } = await load();
    assert.equal(isEmptyStateVisible({ todayPodcast: readyPodcast('p', 'd', { status: 'generating' }) }), false);
  });
});

describe('isPlayerVisible', () => {
  it('is true when selected is ready', async () => {
    const { isPlayerVisible } = await load();
    assert.equal(isPlayerVisible({ selected: readyPodcast('p', 'd', { status: 'ready' }) }), true);
  });

  it('is false when selected is null', async () => {
    const { isPlayerVisible } = await load();
    assert.equal(isPlayerVisible({ selected: null }), false);
  });

  it('is false when selected is not ready', async () => {
    const { isPlayerVisible } = await load();
    assert.equal(isPlayerVisible({ selected: readyPodcast('p', 'd', { status: 'generating' }) }), false);
  });
});

describe('mutual exclusion invariant (GAP-3 missing: field)', () => {
  it('player and empty state are never both true for {no selection, no today, stale ready}', async () => {
    const { deriveSelectedPodcast, isPlayerVisible, isEmptyStateVisible } = await load();
    const staleReady = readyPodcast('stale-1', '2026-05-01');
    const input = { selectedId: null, podcasts: [staleReady], todayPodcast: undefined };
    const selected = deriveSelectedPodcast(input);
    const playerVisible = isPlayerVisible({ selected });
    const emptyVisible = isEmptyStateVisible({ todayPodcast: input.todayPodcast });
    assert.equal(playerVisible, false, 'player hidden because selected is null');
    assert.equal(emptyVisible, true, 'empty state shown because no today podcast');
    assert.ok(!(playerVisible && emptyVisible), 'MUST NOT both be true (dual-render bug)');
  });

  it('player shown + empty hidden when todayPodcast is ready', async () => {
    const { deriveSelectedPodcast, isPlayerVisible, isEmptyStateVisible } = await load();
    const todayReady = readyPodcast('today-1', '2026-05-19');
    const input = { selectedId: null, podcasts: [todayReady], todayPodcast: todayReady };
    const selected = deriveSelectedPodcast(input);
    const playerVisible = isPlayerVisible({ selected });
    const emptyVisible = isEmptyStateVisible({ todayPodcast: input.todayPodcast });
    assert.equal(playerVisible, true);
    assert.equal(emptyVisible, false);
    assert.ok(!(playerVisible && emptyVisible));
  });
});

describe('isDirty + computeCurrentHashForSelected (GAP-4 fresh-play missing: field)', () => {
  it('a freshly generated podcast with unchanged chips yields isDirty === false', async () => {
    const { isDirty, computeCurrentHashForSelected } = await load();
    const { computeOptionsHash } = await import(PROMPT);
    const opts = { length: 'standard', style: 'conversational' };
    const fresh = readyPodcast('fresh-1', '2026-05-19', {
      questionIds: ['c1', 'c2'],
      optionsHash: computeOptionsHash(['c1', 'c2'], 'en', opts),
    });
    // Recompute over THE SAME selected.questionIds with same chips/locale.
    const currentHash = computeCurrentHashForSelected(fresh, 'en', opts);
    assert.equal(isDirty({ selected: fresh, currentHash }), false, 'no phantom Regenerate CTA');
  });

  it('changing a chip makes isDirty === true', async () => {
    const { isDirty, computeCurrentHashForSelected } = await load();
    const { computeOptionsHash } = await import(PROMPT);
    const generatedOpts = { length: 'standard', style: 'conversational' };
    const fresh = readyPodcast('fresh-1', '2026-05-19', {
      questionIds: ['c1', 'c2'],
      optionsHash: computeOptionsHash(['c1', 'c2'], 'en', generatedOpts),
    });
    const changedOpts = { length: 'deep', style: 'conversational' };
    const currentHash = computeCurrentHashForSelected(fresh, 'en', changedOpts);
    assert.equal(isDirty({ selected: fresh, currentHash }), true, 'chip change surfaces Regenerate CTA');
  });

  it('isDirty is false when selected is null (no cached hash)', async () => {
    const { isDirty, computeCurrentHashForSelected } = await load();
    const currentHash = computeCurrentHashForSelected(null, 'en', { length: 'standard', style: 'conversational' });
    assert.equal(isDirty({ selected: null, currentHash }), false);
  });

  it('isDirty is false when selected has no optionsHash (pre-Phase-52 podcast)', async () => {
    const { isDirty, computeCurrentHashForSelected } = await load();
    const legacy = readyPodcast('legacy-1', '2026-05-19'); // no optionsHash
    const currentHash = computeCurrentHashForSelected(legacy, 'en', { length: 'standard', style: 'conversational' });
    assert.equal(isDirty({ selected: legacy, currentHash }), false, 'legacy podcasts never show phantom CTA');
  });

  it('computeCurrentHashForSelected hashes over [] when selected is null', async () => {
    const { computeCurrentHashForSelected } = await load();
    const { computeOptionsHash } = await import(PROMPT);
    const opts = { length: 'standard', style: 'conversational' };
    const nullHash = computeCurrentHashForSelected(null, 'en', opts);
    assert.equal(nullHash, computeOptionsHash([], 'en', opts));
  });
});
