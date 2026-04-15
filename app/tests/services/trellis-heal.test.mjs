import assert from 'node:assert/strict';
import test from 'node:test';

// localStorage shim
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

// D-11: heal() returns navigation intent to /review with anchorReview state
test('heal returns navigateTo /review with anchorId, qaIds, and title', async () => {
  storage.clear();
  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  const result = trellisActionsService.heal('anchor-1', 'Spaced Repetition', ['qa-1', 'qa-2']);

  assert.equal(result.navigateTo, '/review');
  assert.ok('anchorReview' in result.state, 'state must have anchorReview key');
  assert.equal(result.state.anchorReview.anchorId, 'anchor-1');
  assert.equal(result.state.anchorReview.title, 'Spaced Repetition');
  assert.deepEqual(result.state.anchorReview.qaIds, ['qa-1', 'qa-2']);
});

// D-12: heal() calls podcastService.addConceptToPodcast with today + anchorId
test('heal calls podcastService.addConceptToPodcast with today and anchorId', async () => {
  storage.clear();
  const { _podcastCalls } = await import('./_actions-mock-podcast.mjs');
  _podcastCalls.length = 0; // reset spy

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.heal('anchor-42', 'Deep Learning', ['qa-10']);

  assert.equal(_podcastCalls.length, 1, 'addConceptToPodcast should be called once');
  assert.equal(_podcastCalls[0].questionId, 'anchor-42');
  // date should be today's date (YYYY-MM-DD format)
  assert.match(_podcastCalls[0].date, /^\d{4}-\d{2}-\d{2}$/, 'date should be YYYY-MM-DD format');
});

// D-12: heal() swallows podcast errors — navigation result still returned if podcast throws
test('heal still returns navigation result when podcastService throws', async () => {
  storage.clear();
  const { podcastService } = await import('./_actions-mock-podcast.mjs');
  const origAdd = podcastService.addConceptToPodcast;
  podcastService.addConceptToPodcast = () => { throw new Error('podcast unavailable'); };

  try {
    const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
    const result = trellisActionsService.heal('anchor-3', 'Test Topic', ['qa-5']);
    assert.equal(result.navigateTo, '/review', 'must return nav result even when podcast throws');
    assert.equal(result.state.anchorReview.anchorId, 'anchor-3');
  } finally {
    podcastService.addConceptToPodcast = origAdd;
  }
});

// D-11: multiple qaIds pass through unchanged to nav state
test('heal passes multiple qaIds unchanged to anchorReview state', async () => {
  storage.clear();
  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  const qaIds = ['qa-1', 'qa-2', 'qa-3', 'qa-4', 'qa-5'];
  const result = trellisActionsService.heal('anchor-5', 'Machine Learning', qaIds);

  assert.deepEqual(result.state.anchorReview.qaIds, qaIds);
  assert.equal(result.state.anchorReview.qaIds.length, 5);
});
