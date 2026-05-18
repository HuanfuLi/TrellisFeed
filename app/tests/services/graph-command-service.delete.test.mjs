// Plan 48-02 Task 3 — graphCommandService.delete
//
// Covers:
//   - Anchor delete with cascade: children re-parent to anchor's parentId
//     (the cluster). Returns cascadedChildIds. Journal `before` contains
//     full anchor record + reparented-children entries with OLD parentage.
//   - Cluster delete with cascade: child anchors re-parent to ROOT
//     (parentId/clusterNodeId/branchLabel/clusterLabel undefined). Single-
//     level cascade — anchors' QAs are NOT touched (R10 risk 7).
//   - Leaf QA delete: no cascade; reparentedChildren is empty.
//   - NOT_FOUND for missing target.
//   - Blocker #2: if questionService.delete returns { success: false },
//     command aborts BEFORE journal append AND BEFORE command-boundary emit.
//     Returns STORAGE_ERROR.
//   - Warning #4: on success, TWO GRAPH_UPDATED events fire — the untyped
//     one from questionService.delete AND the typed one from our command
//     boundary with payload.kind === 'delete'. Subscribers are idempotent
//     per CLAUDE.md; LAST event has the kind discriminator.

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
    content: 'placeholder',
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
}

// ────────────────────────────────────────────────────────────────────────
// Source-reading invariants — acceptance criteria grep gates
// ────────────────────────────────────────────────────────────────────────

test('source: delete body checks deleteResult.success before journal/emit (Blocker #2)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    /deleteResult\.success|result\.success/.test(src),
    'delete body must inspect the ServiceResult.success returned by questionService.delete',
  );
});

test('source: delete emits typed GRAPH_UPDATED with kind="delete" from command boundary', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes("kind: 'delete'"),
    'delete must emit GRAPH_UPDATED with payload.kind === "delete" (Warning #4)',
  );
});

test('source: delete contains the double-emit-intentional inline comment (Warning #4)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('subscribers are already idempotent')
      || src.includes('LAST event observed'),
    'inline comment must document the intentional double-emit (subscribers are idempotent / LAST event has kind)',
  );
});

test('source: graph-command.service.ts does NOT write to localStorage directly (T-48-05)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.equal(
    /localStorage\.setItem/.test(src),
    false,
    'graphCommandService must NEVER call localStorage.setItem directly — all writes via questionService',
  );
});

// ────────────────────────────────────────────────────────────────────────
// Behavior — NOT_FOUND
// ────────────────────────────────────────────────────────────────────────

test('delete missing id → NOT_FOUND', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.delete('not-real');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
});

// ────────────────────────────────────────────────────────────────────────
// Behavior — anchor delete with cascade
// ────────────────────────────────────────────────────────────────────────

test('anchor delete: hard-removes anchor + re-parents children to anchor.parentId (cluster)', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'Biology', branchLabel: 'Science', clusterLabel: 'Biology' }),
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology', title: 'Photosynthesis' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology' }),
    makeNode({ id: 'qa-2', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology' }),
    makeNode({ id: 'qa-3', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.delete('anchor-A');

  assert.equal(result.success, true);
  assert.ok(result.data.cascadedChildIds.length === 3, 'cascadedChildIds must list all 3 children');
  assert.deepEqual([...result.data.cascadedChildIds].sort(), ['qa-1', 'qa-2', 'qa-3']);

  const store = _getStore();
  assert.equal(store.find((q) => q.id === 'anchor-A'), undefined, 'anchor must be removed from store');
  for (const childId of ['qa-1', 'qa-2', 'qa-3']) {
    const child = store.find((q) => q.id === childId);
    assert.equal(child.parentId, 'cluster-A', `${childId} must re-parent to cluster-A`);
    assert.equal(child.clusterNodeId, 'cluster-A');
    assert.equal(child.branchLabel, 'Science');
    assert.equal(child.clusterLabel, 'Biology');
  }
});

// ────────────────────────────────────────────────────────────────────────
// Behavior — cluster delete with cascade (single level only — R10 risk 7)
// ────────────────────────────────────────────────────────────────────────

test('cluster delete: child anchors re-parent to ROOT; their QAs are NOT touched', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-X', isClusterNode: true, title: 'Old', branchLabel: 'Sci', clusterLabel: 'Old' }),
    makeNode({ id: 'anchor-1', isAnchorNode: true, parentId: 'cluster-X', clusterNodeId: 'cluster-X', branchLabel: 'Sci', clusterLabel: 'Old', title: 'A1' }),
    makeNode({ id: 'anchor-2', isAnchorNode: true, parentId: 'cluster-X', clusterNodeId: 'cluster-X', branchLabel: 'Sci', clusterLabel: 'Old', title: 'A2' }),
    makeNode({ id: 'qa-x1', parentId: 'anchor-1', clusterNodeId: 'cluster-X', branchLabel: 'Sci', clusterLabel: 'Old' }),
    makeNode({ id: 'qa-x2', parentId: 'anchor-2', clusterNodeId: 'cluster-X', branchLabel: 'Sci', clusterLabel: 'Old' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.delete('cluster-X');

  assert.equal(result.success, true);
  const store = _getStore();
  assert.equal(store.find((q) => q.id === 'cluster-X'), undefined, 'cluster must be removed');

  // Child anchors re-parent to root.
  const a1 = store.find((q) => q.id === 'anchor-1');
  const a2 = store.find((q) => q.id === 'anchor-2');
  assert.equal(a1.parentId, undefined, 'anchor-1 must re-parent to root');
  assert.equal(a1.clusterNodeId, undefined);
  assert.equal(a1.branchLabel, undefined);
  assert.equal(a1.clusterLabel, undefined);
  assert.equal(a2.parentId, undefined, 'anchor-2 must re-parent to root');

  // QAs of those anchors stay UNCHANGED (single-level cascade per R10 risk 7).
  const qax1 = store.find((q) => q.id === 'qa-x1');
  const qax2 = store.find((q) => q.id === 'qa-x2');
  assert.equal(qax1.parentId, 'anchor-1', 'QAs of cascaded anchors must NOT be touched');
  assert.equal(qax2.parentId, 'anchor-2');
});

// ────────────────────────────────────────────────────────────────────────
// Behavior — leaf delete (no cascade)
// ────────────────────────────────────────────────────────────────────────

test('leaf QA delete: removes target; reparentedChildren is empty', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A' }),
    makeNode({ id: 'qa-leaf', parentId: 'anchor-A', clusterNodeId: 'cluster-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.delete('qa-leaf');

  assert.equal(result.success, true);
  assert.equal(result.data.cascadedChildIds.length, 0);

  const store = _getStore();
  assert.equal(store.find((q) => q.id === 'qa-leaf'), undefined);
  assert.ok(store.find((q) => q.id === 'anchor-A'), 'anchor-A must still exist');

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entry = graphEditJournal.list()[0];
  assert.equal(entry.before.reparentedChildren.length, 0, 'leaf delete has no reparented children');
});

// ────────────────────────────────────────────────────────────────────────
// Behavior — Blocker #2: failed-delete-aborts-journal
// ────────────────────────────────────────────────────────────────────────

test('Blocker #2: if questionService.delete returns { success: false }, NO journal entry AND NO command-boundary GRAPH_UPDATED', async () => {
  await resetAll();
  const { _resetStore, _setDeleteFail } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true }),
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A' }),
  ]);
  _setDeleteFail(true);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const eventsAll = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => eventsAll.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.delete('anchor-A');
  unsub();

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'STORAGE_ERROR');
  assert.equal(result.error.retryable, true, 'STORAGE_ERROR is retryable');

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  assert.equal(graphEditJournal.list().length, 0, 'NO journal entry on failed delete');

  // No GRAPH_UPDATED with payload.kind === 'delete' (the mock-forced-fail
  // path returns before ANY questionService.delete emit, so eventsAll
  // should also be empty here).
  const typedEmits = eventsAll.filter((e) => e.payload?.kind === 'delete');
  assert.equal(typedEmits.length, 0, 'NO command-boundary GRAPH_UPDATED with kind="delete" on failure');
});

// ────────────────────────────────────────────────────────────────────────
// Behavior — Warning #4 emit-discrimination (double-emit accepted)
// ────────────────────────────────────────────────────────────────────────

test('Warning #4: success path produces TWO GRAPH_UPDATED — last one has payload.kind === "delete"', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'qa-1', parentId: 'anchor-A' }),
  ]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.delete('qa-1');
  unsub();

  assert.equal(result.success, true);
  assert.equal(events.length, 2, 'TWO GRAPH_UPDATED: untyped from questionService.delete + typed from command boundary (intentional double-emit per CLAUDE.md §Event bus — subscribers are idempotent)');
  assert.equal(events[events.length - 1].payload?.kind, 'delete', 'LAST event observed must have payload.kind === "delete" so subscribers that dispatch on kind work');
});

// ────────────────────────────────────────────────────────────────────────
// Behavior — Journal shape (full deletedRecord + reparentedChildren)
// ────────────────────────────────────────────────────────────────────────

test('journal: anchor delete writes one entry with FULL deletedRecord + reparented children with OLD parentage', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'Bio', branchLabel: 'Sci', clusterLabel: 'Bio' }),
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'Bio', title: 'Photo', content: 'Photo', summary: 'Photo' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'Bio' }),
    makeNode({ id: 'qa-2', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'Bio' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.delete('anchor-A');
  assert.equal(result.success, true);

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1);

  const entry = entries[0];
  assert.equal(entry.cmd, 'delete');
  assert.deepEqual(entry.targetIds, ['anchor-A']);

  // FULL Question fields must be present in deletedRecord per D-04 (so undo
  // can resurrect verbatim).
  const dr = entry.before.deletedRecord;
  assert.equal(dr.id, 'anchor-A');
  assert.equal(dr.title, 'Photo');
  assert.equal(dr.content, 'Photo');
  assert.equal(dr.isAnchorNode, true);
  assert.equal(dr.parentId, 'cluster-A');

  // reparentedChildren must list IDs + OLD parentage values (not the post-
  // reparent ones).
  const rc = entry.before.reparentedChildren;
  assert.equal(rc.length, 2, 'two children reparented');
  for (const child of rc) {
    assert.equal(child.parentId, 'anchor-A', 'OLD parentId must be anchor-A (pre-reparent)');
  }
});
