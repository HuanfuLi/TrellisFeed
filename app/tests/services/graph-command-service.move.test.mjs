// Plan 48-02 Task 2 — graphCommandService.move
//
// Covers:
//   - Anchor move (anchor → new cluster): patches parentId/clusterNodeId/
//     branchLabel/clusterLabel/placementReason on the anchor.
//   - QA move (QA → new anchor): patches placement fields on the QA.
//   - Side effects: qaCount decrement on old parent + increment on new
//     parent; nodeSummary line removed from old anchor + appended to new
//     anchor (using `target.shortSummary ?? target.content.slice(0, 80)`).
//   - VALIDATION: self-parent rejected; cycle (move under own descendant)
//     rejected; missing target / missing newParent → NOT_FOUND.
//   - No-op: same parent (R10 risk 12) → success, NO journal, NO emit.
//   - D-17 single emit per successful move with payload.kind === 'move'.
//
// Isolation per R10 risk 8: full storage + store + journal reset per test.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

function makeNode(overrides = {}) {
  return {
    id: `q-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    date: '2026-05-17',
    content: 'placeholder content',
    answer: 'placeholder answer',
    summary: 'placeholder summary',
    title: 'Placeholder',
    keywords: [],
    relatedQuestionIds: [],
    categoryIds: ['cat-general'],
    reviewSchedule: { nextReviewDate: '2026-05-17', reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now(),
    ...overrides,
  };
}

async function resetAll() {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([]);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  graphEditJournal.clear();
  const settingsMod = await import('./_actions-mock-settings.mjs');
  if (typeof settingsMod._setEmbeddingConfigured === 'function') {
    settingsMod._setEmbeddingConfigured(true);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Source-reading invariants — acceptance criteria grep gates
// ────────────────────────────────────────────────────────────────────────

test('source: move uses the shortSummary fallback for nodeSummary lines', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('shortSummary'),
    'move body must reference shortSummary for nodeSummary line append (Warning #3 fallback)',
  );
});

test('source: move mentions descendant / cycle check', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    /descendant|cycle/i.test(src),
    'move must enforce cycle prevention (cannot move under own descendant)',
  );
});

// ────────────────────────────────────────────────────────────────────────
// Validation tests
// ────────────────────────────────────────────────────────────────────────

test('move with id === newParentId → VALIDATION_ERROR (cannot be own parent)', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('q-1', 'q-1');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

test('move on missing target → NOT_FOUND', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'cluster-A', isClusterNode: true })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('not-real', 'cluster-A');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
});

test('move with missing newParent → NOT_FOUND', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('q-1', 'not-real');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
});

test('move to current parent → success no-op, NO journal, NO emit (R10 risk 12)', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'Biology', branchLabel: 'Science', clusterLabel: 'Biology' }),
    makeNode({ id: 'anchor-1', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology', title: 'Photosynthesis' }),
  ]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('anchor-1', 'cluster-A');
  unsub();

  assert.equal(result.success, true);
  assert.equal(events.length, 0, 'no-op move must NOT emit');

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  assert.equal(graphEditJournal.list().length, 0, 'no-op move must NOT write a journal entry');
});

test('move under own descendant → VALIDATION_ERROR (cycle)', async () => {
  // Setup: cluster-A → anchor-B → qa-C
  // Attempt: move(cluster-A, qa-C). qa-C is a descendant of cluster-A.
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'Science' }),
    makeNode({ id: 'cluster-B', isClusterNode: true, title: 'Other' }),
    makeNode({ id: 'anchor-B', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', title: 'Branch' }),
    makeNode({ id: 'qa-C', parentId: 'anchor-B', clusterNodeId: 'cluster-A', title: 'A QA' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('cluster-A', 'qa-C');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.ok(/cycle|descendant/i.test(result.error.message), 'message must mention cycle / descendant');
});

// ────────────────────────────────────────────────────────────────────────
// Successful anchor move
// ────────────────────────────────────────────────────────────────────────

test('anchor move: updates placement + recomputes qaCount on old/new clusters', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'Biology', branchLabel: 'Science', clusterLabel: 'Biology', qaCount: 3 }),
    makeNode({ id: 'cluster-B', isClusterNode: true, title: 'Chemistry', branchLabel: 'Science', clusterLabel: 'Chemistry', qaCount: 1 }),
    makeNode({ id: 'anchor-1', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology', title: 'Photosynthesis', shortSummary: 'Plants making food.' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('anchor-1', 'cluster-B');
  assert.equal(result.success, true);

  const store = _getStore();
  const moved = store.find((q) => q.id === 'anchor-1');
  assert.equal(moved.parentId, 'cluster-B');
  assert.equal(moved.clusterNodeId, 'cluster-B');
  assert.equal(moved.clusterLabel, 'Chemistry');
  assert.equal(moved.branchLabel, 'Science');
  assert.ok(moved.placementReason && moved.placementReason.includes('Manually moved'));

  // qaCount side effects on OLD and NEW clusters.
  const oldCluster = store.find((q) => q.id === 'cluster-A');
  const newCluster = store.find((q) => q.id === 'cluster-B');
  assert.equal(oldCluster.qaCount, 2, 'old cluster qaCount must decrement (3 → 2)');
  assert.equal(newCluster.qaCount, 2, 'new cluster qaCount must increment (1 → 2)');
});

test('anchor move emits EXACTLY one GRAPH_UPDATED with payload.kind === "move"', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'A', branchLabel: 'Sci', clusterLabel: 'A' }),
    makeNode({ id: 'cluster-B', isClusterNode: true, title: 'B', branchLabel: 'Sci', clusterLabel: 'B' }),
    makeNode({ id: 'anchor-1', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'A', title: 'X' }),
  ]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.move('anchor-1', 'cluster-B');
  unsub();

  assert.equal(events.length, 1, 'EXACTLY one GRAPH_UPDATED per successful move');
  assert.equal(events[0].payload?.kind, 'move');
  assert.equal(events[0].payload?.anchorId, 'anchor-1');
});

// ────────────────────────────────────────────────────────────────────────
// Successful QA move + anchor nodeSummary side effects
// ────────────────────────────────────────────────────────────────────────

test('QA move: updates placement fields + decrements old anchor qaCount + increments new', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'Biology', branchLabel: 'Science', clusterLabel: 'Biology' }),
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology', title: 'Photosynthesis', qaCount: 3, nodeSummary: '[qa-1] Plants need light.\n[qa-2] Chlorophyll captures photons.\n[qa-3] Cell wall structure.' }),
    makeNode({ id: 'anchor-B', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology', title: 'Mitosis', qaCount: 1, nodeSummary: '[qa-0] Phases overview.' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology', shortSummary: 'Plants need light.', content: 'Why do plants need light?' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('qa-1', 'anchor-B');
  assert.equal(result.success, true);

  const store = _getStore();
  const moved = store.find((q) => q.id === 'qa-1');
  assert.equal(moved.parentId, 'anchor-B');
  assert.equal(moved.clusterNodeId, 'cluster-A');
  assert.equal(moved.branchLabel, 'Science');
  assert.equal(moved.clusterLabel, 'Biology');

  const oldAnchor = store.find((q) => q.id === 'anchor-A');
  const newAnchor = store.find((q) => q.id === 'anchor-B');
  assert.equal(oldAnchor.qaCount, 2, 'old anchor qaCount must decrement (3 → 2)');
  assert.equal(newAnchor.qaCount, 2, 'new anchor qaCount must increment (1 → 2)');

  // nodeSummary side effects: line removed from old, appended to new.
  assert.ok(!oldAnchor.nodeSummary.includes('[qa-1]'), 'old anchor nodeSummary must NOT contain qa-1 line');
  assert.ok(newAnchor.nodeSummary.includes('[qa-1]'), 'new anchor nodeSummary must contain appended qa-1 line');
});

test('QA move with no shortSummary falls back to content.slice(0, 80) for nodeSummary line', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'C', branchLabel: 'Sci', clusterLabel: 'C' }),
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'C', title: 'A', qaCount: 1 }),
    makeNode({ id: 'anchor-B', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'C', title: 'B', qaCount: 0 }),
    makeNode({ id: 'qa-no-summary', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'C', content: 'A question whose content is what gets sliced because shortSummary is missing.' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('qa-no-summary', 'anchor-B');
  assert.equal(result.success, true);

  const newAnchor = _getStore().find((q) => q.id === 'anchor-B');
  assert.ok(
    newAnchor.nodeSummary && newAnchor.nodeSummary.includes('[qa-no-summary]'),
    'new anchor must have appended line with qa id even when shortSummary is missing',
  );
  // The appended summary text should be a slice of content (≤80 chars).
  const lineMatch = newAnchor.nodeSummary.match(/\[qa-no-summary\] (.+)/);
  assert.ok(lineMatch, 'nodeSummary line for qa-no-summary must exist');
  assert.ok(lineMatch[1].length <= 80, 'fallback line text must be at most 80 chars (content.slice(0, 80))');
});

// ────────────────────────────────────────────────────────────────────────
// Journal shape test
// ────────────────────────────────────────────────────────────────────────

test('move writes one journal entry with cmd="move", targetIds=[id], before snapshots OLD placement', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'A', branchLabel: 'Sci', clusterLabel: 'A' }),
    makeNode({ id: 'cluster-B', isClusterNode: true, title: 'B', branchLabel: 'Sci', clusterLabel: 'B' }),
    makeNode({ id: 'anchor-1', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'A', title: 'X', placementReason: 'Original placement' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.move('anchor-1', 'cluster-B');
  assert.equal(result.success, true);

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1, 'exactly one journal entry per successful move');

  const entry = entries[0];
  assert.equal(entry.cmd, 'move');
  assert.deepEqual(entry.targetIds, ['anchor-1']);
  assert.equal(entry.before.parentId, 'cluster-A', 'before snapshot must capture OLD parentId');
  assert.equal(entry.before.clusterNodeId, 'cluster-A');
  assert.equal(entry.before.clusterLabel, 'A');
  assert.equal(entry.before.placementReason, 'Original placement');

  assert.equal(entry.after.parentId, 'cluster-B', 'after captures NEW parentId');
});
