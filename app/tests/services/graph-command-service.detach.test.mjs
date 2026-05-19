// Plan 48-03 Task 2 — graphCommandService.detach
//
// Covers D-13/D-17/D-18/D-19 + Warning #2:
//   - detach(qaId) clears parentId / branchLabel / clusterLabel /
//     clusterNodeId / nodeSummary / placementReason.
//   - Old parent's qaCount decrements; if old parent is an anchor, its
//     nodeSummary strips the matching `[qa-id] ` line.
//   - Fires classifyAndAnchorIncremental fire-and-forget AFTER the
//     synchronous patches complete + the typed GRAPH_UPDATED emit.
//   - ONE typed GRAPH_UPDATED with payload.kind === 'detach' from the
//     command boundary (D-17). The downstream classification's eventual
//     emit is documented as an intentional SECOND emit per R7.
//   - VALIDATION: rejecting anchor / cluster targets (anchors/clusters
//     cannot be "detached"); NOT_FOUND for missing.
//   - No-op when target.parentId === undefined (R10 risk 14): success
//     but no journal entry, no GRAPH_UPDATED, no classification fired.
//   - Warning #2 — AbortSignal threading: opts.signal forwarded to
//     classifyAndAnchorIncremental; aborting the signal mid-flight makes
//     the call observe signal.aborted at its next checkpoint and
//     short-circuit. Equivalent to the Phase 27 D-22 LOCALE_CHANGED
//     pattern.
//
// Isolation per R10 risk 8: storage.clear() + _resetStore([]) +
// graphEditJournal.clear() + reset canonical-mock classify call log + reset
// embedding+settings mock state per test.

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
  const { _resetStore, _setDeleteFail } = await import('./_actions-mock-question.mjs');
  _resetStore([]);
  if (typeof _setDeleteFail === 'function') _setDeleteFail(false);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  graphEditJournal.clear();
  const canonical = await import('./_trellis-mock-canonical.mjs');
  if (typeof canonical._resetClassifyCalls === 'function') canonical._resetClassifyCalls();
  const settingsMod = await import('./_actions-mock-settings.mjs');
  if (typeof settingsMod._setEmbeddingConfigured === 'function') {
    settingsMod._setEmbeddingConfigured(true);
  }
}

// ════════════════════════════════════════════════════════════════════════
// Source-reading invariants — acceptance criteria grep gates
// ════════════════════════════════════════════════════════════════════════

test('source: detach body fires classifyAndAnchorIncremental (fire-and-forget)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('classifyAndAnchorIncremental'),
    'detach must call classifyAndAnchorIncremental for re-routing (D-13)',
  );
});

test('source: detach contains the two-emit-intentional inline comment', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('downstream COMMAND') || src.includes('second emit'),
    'detach must document the intentional second emit from downstream classify (R7)',
  );
});

test('source: detach forwards opts?.signal to classify (Warning #2 abort propagation)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  // The detach body must reference opts.signal (or opts?.signal) — Warning #2
  // fix requires the AbortSignal to be threaded into classifyAndAnchorIncremental.
  assert.ok(
    /opts\?\.signal|opts\.signal/.test(src),
    'detach must forward opts?.signal to classifyAndAnchorIncremental (D-19 / Warning #2)',
  );
});

test('source: detach validates target is a QA, not anchor/cluster', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  // detach must reject isAnchorNode or isClusterNode targets — the only
  // detachable node is a Q&A leaf.
  assert.ok(
    /isAnchorNode|isClusterNode/.test(src),
    'detach must reject anchors/clusters (only QAs can be detached)',
  );
});

test('source: detach emits typed GRAPH_UPDATED with kind="detach" from command boundary', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes("kind: 'detach'"),
    'detach must emit GRAPH_UPDATED with payload.kind === "detach"',
  );
});

// ════════════════════════════════════════════════════════════════════════
// Validation tests
// ════════════════════════════════════════════════════════════════════════

test('detach missing id → NOT_FOUND', async () => {
  await resetAll();
  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('not-real');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
});

test('detach anchor target → VALIDATION_ERROR', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('anchor-A');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.ok(/anchor|cluster|qa/i.test(result.error.message), 'error message references the validation reason');
});

test('detach cluster target → VALIDATION_ERROR', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'cluster-A', isClusterNode: true })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('cluster-A');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

// ════════════════════════════════════════════════════════════════════════
// No-op (R10 risk 14)
// ════════════════════════════════════════════════════════════════════════

test('detach already-unassigned (parentId undefined) → success no-op; no journal; no emit; no classify', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'qa-orphan' /* no parentId */ })]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('qa-orphan');
  unsub();

  assert.equal(result.success, true);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  assert.equal(graphEditJournal.list().length, 0, 'no journal entry for no-op detach');
  assert.equal(events.length, 0, 'no GRAPH_UPDATED for no-op detach');

  const canonical = await import('./_trellis-mock-canonical.mjs');
  assert.equal(canonical._getClassifyCalls().length, 0, 'classify NOT fired for no-op detach');
});

// ════════════════════════════════════════════════════════════════════════
// Happy path — clear placement + decrement old parent + journal + emit
// ════════════════════════════════════════════════════════════════════════

test('detach: clears placement fields on target', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({
      id: 'anchor-A',
      isAnchorNode: true,
      title: 'Photosynthesis',
      qaCount: 3,
      nodeSummary: '[qa-1] line1\n[qa-2] line2\n[qa-3] line3',
    }),
    makeNode({
      id: 'qa-1',
      parentId: 'anchor-A',
      branchLabel: 'Science',
      clusterLabel: 'Biology',
      clusterNodeId: 'cluster-A',
      nodeSummary: 'should clear',
      placementReason: 'Routed via SM-2',
    }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('qa-1');
  assert.equal(result.success, true);

  const target = _getStore().find((q) => q.id === 'qa-1');
  assert.equal(target.parentId, undefined, 'parentId cleared');
  assert.equal(target.branchLabel, undefined);
  assert.equal(target.clusterLabel, undefined);
  assert.equal(target.clusterNodeId, undefined);
  assert.equal(target.nodeSummary, undefined);
  assert.equal(target.placementReason, undefined);
});

test('detach: old anchor parent qaCount decrements + nodeSummary strips [qa-id] line', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({
      id: 'anchor-A',
      isAnchorNode: true,
      qaCount: 3,
      nodeSummary: '[qa-1] line1\n[qa-2] line2\n[qa-3] line3',
    }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A' }),
    makeNode({ id: 'qa-2', parentId: 'anchor-A' }),
    makeNode({ id: 'qa-3', parentId: 'anchor-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('qa-2');
  assert.equal(result.success, true);

  const anchor = _getStore().find((q) => q.id === 'anchor-A');
  assert.equal(anchor.qaCount, 2, 'old anchor qaCount decrements by 1');
  assert.ok(anchor.nodeSummary.includes('[qa-1]'), 'qa-1 line kept');
  assert.ok(!anchor.nodeSummary.includes('[qa-2]'), 'qa-2 line stripped');
  assert.ok(anchor.nodeSummary.includes('[qa-3]'), 'qa-3 line kept');
});

test('detach: emits EXACTLY one GRAPH_UPDATED synchronously from the command with payload.kind === "detach"', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A' }),
  ]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('qa-1');
  // Detach returns BEFORE classification resolves. At this instant we should
  // see exactly ONE GRAPH_UPDATED (the typed one from the command boundary).
  // Downstream classification's eventual GRAPH_UPDATED is an intentional
  // second emit per R7 but the test doesn't wait long enough to see it.
  unsub();

  assert.equal(result.success, true);
  assert.equal(events.length, 1, 'EXACTLY one GRAPH_UPDATED at command-return time');
  assert.equal(events[0].payload?.kind, 'detach');
  assert.equal(events[0].payload?.anchorId, 'qa-1');
});

test('detach journal entry: cmd=detach, targetIds=[qaId], before snapshots placement fields, after records classificationFired', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, qaCount: 1 }),
    makeNode({
      id: 'qa-1',
      parentId: 'anchor-A',
      branchLabel: 'Psychology',
      clusterLabel: 'Learning Theory',
      clusterNodeId: 'cluster-X',
      placementReason: 'Routed via SM-2',
    }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('qa-1');
  assert.equal(result.success, true);

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1);

  const entry = entries[0];
  assert.equal(entry.cmd, 'detach');
  assert.deepEqual(entry.targetIds, ['qa-1']);
  assert.equal(entry.before.parentId, 'anchor-A');
  assert.equal(entry.before.branchLabel, 'Psychology');
  assert.equal(entry.before.clusterLabel, 'Learning Theory');
  assert.equal(entry.before.clusterNodeId, 'cluster-X');
  assert.equal(entry.before.placementReason, 'Routed via SM-2');
  assert.equal(entry.after.classificationFired, true);
});

// ════════════════════════════════════════════════════════════════════════
// Fire-and-forget classification
// ════════════════════════════════════════════════════════════════════════

test('detach: fires classifyAndAnchorIncremental fire-and-forget with the POST-PATCH question', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, qaCount: 1 }),
    makeNode({
      id: 'qa-1',
      parentId: 'anchor-A',
      branchLabel: 'OldBranch',
      clusterLabel: 'OldCluster',
      clusterNodeId: 'cluster-OLD',
    }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('qa-1');
  assert.equal(result.success, true);

  // Wait one tick so the fire-and-forget call has a chance to register
  // its entry in the canonical mock log.
  await new Promise((r) => setTimeout(r, 5));

  const canonical = await import('./_trellis-mock-canonical.mjs');
  const calls = canonical._getClassifyCalls();
  assert.equal(calls.length, 1, 'classifyAndAnchorIncremental fired exactly once');

  // The question arg must have placement fields CLEARED (post-patch state).
  const q = calls[0].question;
  assert.equal(q.id, 'qa-1');
  assert.equal(q.parentId, undefined, 'classify saw post-patch state — parentId cleared');
  assert.equal(q.branchLabel, undefined);
  assert.equal(q.clusterNodeId, undefined);
});

// ════════════════════════════════════════════════════════════════════════
// Warning #2 — AbortSignal cancellation (D-19 / LOCALE_CHANGED parity)
// ════════════════════════════════════════════════════════════════════════

test('Warning #2: calling detach(qaId, { signal }) then aborting BEFORE classify resolves cancels at the next checkpoint (signal.aborted observed; classify does NOT complete)', async () => {
  await resetAll();
  const canonical = await import('./_trellis-mock-canonical.mjs');
  // Give the mock a 20 ms gap between call-entry and the next checkpoint
  // so the controller.abort() below has time to land before the checkpoint.
  canonical._setClassifyCheckpointDelay(20);

  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', branchLabel: 'X' }),
  ]);

  const controller = new AbortController();
  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');

  // detach RETURNS as soon as it has fired classify; classify is still
  // running asynchronously in the background.
  const result = await graphCommandService.detach('qa-1', { signal: controller.signal });
  assert.equal(result.success, true);

  // Simulate LOCALE_CHANGED (or any operator-initiated cancel) BEFORE the
  // classify checkpoint resolves. The mock's checkpoint delay (20ms) is
  // long enough that this abort lands first.
  controller.abort();

  // Wait long enough for the checkpoint + short-circuit to complete.
  await new Promise((r) => setTimeout(r, 50));

  const calls = canonical._getClassifyCalls();
  assert.equal(calls.length, 1, 'classify was invoked');
  assert.equal(
    calls[0].abortedAtCheckpoint,
    true,
    'signal.aborted === true was observed at the next checkpoint (Warning #2 fix)',
  );
  assert.equal(
    calls[0].completed,
    false,
    'classify did NOT complete to its final patchQuestion after abort (short-circuit)',
  );
});

// ════════════════════════════════════════════════════════════════════════
// Phase 49-06 follow-up — cascade cleanup of emptied anchor/cluster
// ════════════════════════════════════════════════════════════════════════

test('detach cascade: emptied anchor parent is soft-deleted (flagged=true, no prunedFromTrellis)', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({
      id: 'anchor-A',
      isAnchorNode: true,
      title: 'Kanji',
      qaCount: 1,
      branchLabel: 'Linguistics',
      clusterLabel: 'Japanese Writing System',
      clusterNodeId: 'cluster-A',
    }),
    makeNode({ id: 'cluster-A', isClusterNode: true, branchLabel: 'Linguistics', clusterLabel: 'Japanese Writing System' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', branchLabel: 'Linguistics', clusterLabel: 'Japanese Writing System', clusterNodeId: 'cluster-A' }),
    // A sibling anchor under same cluster prevents cluster cascade in THIS test.
    makeNode({ id: 'anchor-B', isAnchorNode: true, title: 'Hiragana', qaCount: 0, branchLabel: 'Linguistics', clusterLabel: 'Japanese Writing System', clusterNodeId: 'cluster-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('qa-1');
  assert.equal(result.success, true);

  const store = _getStore();
  const anchorA = store.find((q) => q.id === 'anchor-A');
  const clusterA = store.find((q) => q.id === 'cluster-A');
  assert.equal(anchorA?.flagged, true, 'emptied anchor flagged');
  assert.notEqual(anchorA?.prunedFromTrellis, true, 'cascade-cleanup MUST NOT set prunedFromTrellis (would surface in pruned archive)');
  assert.notEqual(clusterA?.flagged, true, 'cluster NOT cascaded — sibling anchor-B keeps it alive');
});

test('detach cascade: emptied cluster is cascade-deleted when last anchor went empty', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({
      id: 'anchor-A',
      isAnchorNode: true,
      qaCount: 1,
      branchLabel: 'Linguistics',
      clusterLabel: 'Japanese Writing System',
      clusterNodeId: 'cluster-A',
    }),
    makeNode({ id: 'cluster-A', isClusterNode: true, branchLabel: 'Linguistics', clusterLabel: 'Japanese Writing System' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', branchLabel: 'Linguistics', clusterLabel: 'Japanese Writing System', clusterNodeId: 'cluster-A' }),
    // No sibling anchors under cluster-A — cluster should cascade.
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.detach('qa-1');
  assert.equal(result.success, true);

  const store = _getStore();
  const anchorA = store.find((q) => q.id === 'anchor-A');
  const clusterA = store.find((q) => q.id === 'cluster-A');
  assert.equal(anchorA?.flagged, true, 'emptied anchor flagged');
  assert.equal(clusterA?.flagged, true, 'empty cluster also flagged (cascade up)');
});

test('detach cascade: journal stashes cascadedEmptyAnchorId + cascadedEmptyClusterId for undo', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, qaCount: 1, branchLabel: 'B', clusterLabel: 'C', clusterNodeId: 'cluster-A' }),
    makeNode({ id: 'cluster-A', isClusterNode: true, branchLabel: 'B', clusterLabel: 'C' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', branchLabel: 'B', clusterLabel: 'C', clusterNodeId: 'cluster-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.detach('qa-1');

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1);
  const before = entries[0].before;
  assert.equal(before.cascadedEmptyAnchorId, 'anchor-A');
  assert.equal(before.cascadedEmptyClusterId, 'cluster-A');
});

test('detach cascade: undo flips flagged back to false on both cascaded records', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, qaCount: 1, branchLabel: 'B', clusterLabel: 'C', clusterNodeId: 'cluster-A' }),
    makeNode({ id: 'cluster-A', isClusterNode: true, branchLabel: 'B', clusterLabel: 'C' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', branchLabel: 'B', clusterLabel: 'C', clusterNodeId: 'cluster-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.detach('qa-1');

  // Pre-undo: both cascaded records flagged.
  let store = _getStore();
  assert.equal(store.find((q) => q.id === 'anchor-A')?.flagged, true);
  assert.equal(store.find((q) => q.id === 'cluster-A')?.flagged, true);

  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);

  // Post-undo: flagged flipped back; QA re-parented under anchor-A.
  store = _getStore();
  const anchorA = store.find((q) => q.id === 'anchor-A');
  const clusterA = store.find((q) => q.id === 'cluster-A');
  const qa1 = store.find((q) => q.id === 'qa-1');
  assert.notEqual(anchorA?.flagged, true, 'anchor un-flagged');
  assert.notEqual(clusterA?.flagged, true, 'cluster un-flagged');
  assert.equal(qa1?.parentId, 'anchor-A', 'QA re-parented');
});

test('detach cascade: emits EXACTLY one GRAPH_UPDATED even when cascade fires (single-emit per D-17)', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, qaCount: 1, branchLabel: 'B', clusterLabel: 'C', clusterNodeId: 'cluster-A' }),
    makeNode({ id: 'cluster-A', isClusterNode: true, branchLabel: 'B', clusterLabel: 'C' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', branchLabel: 'B', clusterLabel: 'C', clusterNodeId: 'cluster-A' }),
  ]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.detach('qa-1');
  unsub();

  assert.equal(events.length, 1, 'exactly ONE GRAPH_UPDATED from cascading detach');
  assert.equal(events[0].payload?.kind, 'detach');
  assert.ok(
    events[0].payload?.affectedIds?.includes('cluster-A'),
    'affectedIds includes cascaded cluster',
  );
});
