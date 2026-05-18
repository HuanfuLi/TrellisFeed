// Plan 48-03 Task 1 — graphCommandService.merge
//
// Covers D-07/D-08/D-09/D-10/D-11/D-17:
//   - merge(loserId, survivorId) reparents loser's children to survivor
//     (survivor's parentage fields win, including cross-cluster case per D-08).
//   - Survivor's qaCount recomputed = old + reparented count (D-11).
//   - Survivor's nodeSummary appended with `[childId] shortSummary?` lines
//     (Warning #3 — shortSummary fallback to content.slice(0,80)).
//   - Survivor's embeddingVector REPLACED atomically via the SAME
//     patchQuestion call as qaCount + nodeSummary on the success path.
//   - Loser is hard-deleted via questionService.delete (D-10).
//   - Blocker #2 (revisited from delete): if questionService.delete
//     returns { success: false }, command aborts BEFORE journal append AND
//     BEFORE command-boundary GRAPH_UPDATED emit. Survivor + children are
//     left in their updated state (acceptable partial per T-48-14).
//   - Blocker #4 (graceful re-embed, mirroring rename):
//       isConfigured=false                → SKIP embed; vector preserved.
//       isConfigured=true, embed-rejects → catch + warn; vector preserved.
//     INVARIANT: survivor.embeddingVector is NEVER undefined when it had
//     a vector pre-merge.
//   - Warning #4 (Option C): TWO GRAPH_UPDATED events on success — the
//     untyped one from questionService.delete(loserId) + the typed one
//     from command boundary with payload.kind === 'merge'. LAST event
//     observed has the discriminator. Subscribers are idempotent per
//     CLAUDE.md §"Event bus — unified GRAPH_UPDATED".
//   - Self-merge / NOT_FOUND validation.
//
// Isolation per R10 risk 8: storage.clear() + _resetStore([]) +
// graphEditJournal.clear() + reset embedding+settings mock state per test.

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
  const settingsMod = await import('./_actions-mock-settings.mjs');
  if (typeof settingsMod._setEmbeddingConfigured === 'function') {
    settingsMod._setEmbeddingConfigured(true);
  }
  const embedMod = await import('./_actions-mock-embedding.mjs');
  if (typeof embedMod._setEmbedFail === 'function') embedMod._setEmbedFail(false);
}

// ════════════════════════════════════════════════════════════════════════
// Source-reading invariants — acceptance criteria grep gates
// ════════════════════════════════════════════════════════════════════════

test('source: merge body validates loserId !== survivorId (self-merge)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    /loserId\s*===\s*survivorId|loserId\s*!==\s*survivorId/.test(src),
    'merge must reject self-merge (loserId === survivorId)',
  );
});

test('source: merge snapshots full loser record in journal "before"', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  // Look for the merge body literal `loser:` field on the before snapshot.
  assert.ok(
    src.includes('loser:'),
    'merge journal before.loser must snapshot the full loser record',
  );
});

test('source: merge checks deleteResult.success after questionService.delete(loserId) (Blocker #2)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  // The merge body must inspect ServiceResult.success returned by the loser delete.
  // Reuse the same pattern as delete — either `deleteResult.success` or
  // `!something.success` after the delete call.
  assert.ok(
    /questionService\.delete\s*\(\s*loserId\s*\)/.test(src),
    'merge body must call questionService.delete(loserId)',
  );
  assert.ok(
    /deleteResult\.success|!\w+\.success|success\s*===\s*false/.test(src),
    'merge body must inspect ServiceResult.success after questionService.delete (Blocker #2)',
  );
});

test('source: merge emits typed GRAPH_UPDATED with kind="merge" from command boundary (Warning #4)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes("kind: 'merge'"),
    'merge must emit GRAPH_UPDATED with payload.kind === "merge"',
  );
});

test('source: merge body contains the Blocker #4 inline comment (never overwrite vector with undefined)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  const occurrences = (src.match(/never overwrite a vector with undefined/g) ?? []).length;
  assert.ok(
    occurrences >= 2,
    `Blocker #4 fix requires the "never overwrite a vector with undefined" comment in BOTH rename and merge bodies; found ${occurrences}`,
  );
});

test('source: subscribers-idempotent / LAST-event-observed comment present in BOTH delete and merge bodies', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  const occurrences = (src.match(/subscribers are already idempotent|LAST event observed/g) ?? []).length;
  assert.ok(
    occurrences >= 2,
    `Warning #4 — subscriber-idempotent inline comment must appear in BOTH delete and merge; found ${occurrences}`,
  );
});

// ════════════════════════════════════════════════════════════════════════
// Validation tests
// ════════════════════════════════════════════════════════════════════════

test('merge with loserId === survivorId → VALIDATION_ERROR (self-merge)', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1', isAnchorNode: true })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.merge('q-1', 'q-1');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

test('merge with missing loser → NOT_FOUND', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'survivor-Y', isAnchorNode: true })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.merge('not-real', 'survivor-Y');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
});

test('merge with missing survivor → NOT_FOUND', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'loser-X', isAnchorNode: true })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.merge('loser-X', 'not-real');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
});

// ════════════════════════════════════════════════════════════════════════
// Behavioral tests — happy path (reparent + recompute + hard-delete)
// ════════════════════════════════════════════════════════════════════════

test('merge: reparents children, hard-deletes loser, recomputes survivor qaCount, REPLACES embeddingVector atomically', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const oldSurvivorVec = [0.1, 0.2, 0.3];
  _resetStore([
    makeNode({
      id: 'loser-X',
      isAnchorNode: true,
      title: 'SRS',
      content: 'SRS',
      branchLabel: 'Psychology',
      clusterLabel: 'Memory',
      clusterNodeId: 'cluster-old',
      qaCount: 4,
      embeddingVector: [0.9, 0.8, 0.7],
    }),
    makeNode({
      id: 'survivor-Y',
      isAnchorNode: true,
      title: 'Spaced Repetition System',
      content: 'Spaced Repetition System',
      branchLabel: 'Psychology',
      clusterLabel: 'Learning',
      clusterNodeId: 'cluster-new',
      qaCount: 2,
      nodeSummary: '[qa-existing] existing line',
      embeddingVector: oldSurvivorVec,
    }),
    makeNode({ id: 'qa-l1', parentId: 'loser-X', clusterNodeId: 'cluster-old', branchLabel: 'Psychology', clusterLabel: 'Memory', shortSummary: 'l1 summary' }),
    makeNode({ id: 'qa-l2', parentId: 'loser-X', clusterNodeId: 'cluster-old', branchLabel: 'Psychology', clusterLabel: 'Memory', shortSummary: 'l2 summary' }),
    makeNode({ id: 'qa-l3', parentId: 'loser-X', clusterNodeId: 'cluster-old', branchLabel: 'Psychology', clusterLabel: 'Memory', shortSummary: 'l3 summary' }),
    makeNode({ id: 'qa-l4', parentId: 'loser-X', clusterNodeId: 'cluster-old', branchLabel: 'Psychology', clusterLabel: 'Memory', shortSummary: 'l4 summary' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.merge('loser-X', 'survivor-Y');

  assert.equal(result.success, true);
  assert.equal(result.data.reparentedCount, 4);
  assert.equal(result.data.newSurvivorQaCount, 6, 'survivor old (2) + reparented (4) = 6');

  const store = _getStore();
  // Loser hard-deleted.
  assert.equal(store.find((q) => q.id === 'loser-X'), undefined);

  // Children reparented to survivor with survivor's parentage fields (D-08).
  for (const childId of ['qa-l1', 'qa-l2', 'qa-l3', 'qa-l4']) {
    const child = store.find((q) => q.id === childId);
    assert.equal(child.parentId, 'survivor-Y', `${childId} parentId`);
    assert.equal(child.clusterNodeId, 'cluster-new', `${childId} clusterNodeId — survivor's cluster wins`);
    assert.equal(child.branchLabel, 'Psychology', `${childId} branchLabel`);
    assert.equal(child.clusterLabel, 'Learning', `${childId} clusterLabel — survivor's cluster label wins`);
  }

  // Survivor recomputed: qaCount + embeddingVector REPLACED + nodeSummary appended.
  const survivor = store.find((q) => q.id === 'survivor-Y');
  assert.equal(survivor.qaCount, 6, 'survivor.qaCount recomputed');
  assert.ok(Array.isArray(survivor.embeddingVector), 'survivor embeddingVector defined');
  assert.notDeepEqual(survivor.embeddingVector, oldSurvivorVec, 'survivor embeddingVector REPLACED (not preserved)');
  // nodeSummary contains old + four appended lines.
  assert.ok(survivor.nodeSummary.includes('[qa-existing] existing line'), 'survivor nodeSummary preserves old content');
  assert.ok(survivor.nodeSummary.includes('[qa-l1] l1 summary'));
  assert.ok(survivor.nodeSummary.includes('[qa-l4] l4 summary'));
});

test('merge journal entry: cmd=merge, targetIds=[loserId, survivorId], before snapshots full loser + survivor pre-state + reparentedChildren', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const oldVec = [0.11, 0.22, 0.33];
  _resetStore([
    makeNode({
      id: 'loser-X',
      isAnchorNode: true,
      title: 'Old Anchor',
      content: 'Old Anchor',
      branchLabel: 'Sci',
      clusterLabel: 'Old',
      clusterNodeId: 'cluster-A',
      qaCount: 2,
    }),
    makeNode({
      id: 'survivor-Y',
      isAnchorNode: true,
      title: 'New Anchor',
      branchLabel: 'Sci',
      clusterLabel: 'New',
      clusterNodeId: 'cluster-B',
      qaCount: 3,
      nodeSummary: 'old survivor summary',
      embeddingVector: oldVec,
    }),
    makeNode({ id: 'qa-1', parentId: 'loser-X', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'Old' }),
    makeNode({ id: 'qa-2', parentId: 'loser-X', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'Old' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.merge('loser-X', 'survivor-Y');
  assert.equal(result.success, true);

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1);

  const entry = entries[0];
  assert.equal(entry.cmd, 'merge');
  assert.deepEqual(entry.targetIds, ['loser-X', 'survivor-Y']);

  // before.loser = full Question record
  assert.equal(entry.before.loser.id, 'loser-X');
  assert.equal(entry.before.loser.title, 'Old Anchor');
  assert.equal(entry.before.loser.isAnchorNode, true);
  assert.equal(entry.before.loser.qaCount, 2);

  // before.survivor = pre-merge values for the fields we modify
  assert.equal(entry.before.survivor.qaCount, 3);
  assert.deepEqual(entry.before.survivor.embeddingVector, oldVec);
  assert.equal(entry.before.survivor.nodeSummary, 'old survivor summary');

  // before.reparentedChildren = compact diff per child
  assert.equal(entry.before.reparentedChildren.length, 2);
  for (const child of entry.before.reparentedChildren) {
    assert.equal(child.parentId, 'loser-X', 'OLD parentId pre-reparent');
    assert.equal(child.clusterNodeId, 'cluster-A', 'OLD cluster pre-reparent');
  }

  // after = compact summary
  assert.equal(entry.after.reparentedCount, 2);
  assert.equal(entry.after.newSurvivorQaCount, 5);
});

// ════════════════════════════════════════════════════════════════════════
// Behavioral tests — Blocker #4 graceful degradation on survivor re-embed
// ════════════════════════════════════════════════════════════════════════

test('Blocker #4 — merge with isConfigured=false PRESERVES old survivor embeddingVector (never undefined)', async () => {
  await resetAll();
  const settingsMod = await import('./_actions-mock-settings.mjs');
  settingsMod._setEmbeddingConfigured(false);

  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const oldVec = [0.7, 0.8, 0.9];
  _resetStore([
    makeNode({ id: 'loser-X', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'survivor-Y', isAnchorNode: true, qaCount: 1, embeddingVector: oldVec }),
    makeNode({ id: 'qa-1', parentId: 'loser-X' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.merge('loser-X', 'survivor-Y');
  assert.equal(result.success, true, 'merge succeeds even with embedding unconfigured');

  const survivor = _getStore().find((q) => q.id === 'survivor-Y');
  assert.deepEqual(
    survivor.embeddingVector,
    oldVec,
    'isConfigured=false MUST preserve old vector (Blocker #4 — never silently undefined)',
  );
  assert.equal(survivor.qaCount, 2, 'qaCount still recomputed');
});

test('Blocker #4 — merge with embed-rejection PRESERVES old survivor embeddingVector + logs warn', async () => {
  await resetAll();
  const settingsMod = await import('./_actions-mock-settings.mjs');
  settingsMod._setEmbeddingConfigured(true);
  const embedMod = await import('./_actions-mock-embedding.mjs');
  embedMod._setEmbedFail(true);

  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const oldVec = [0.4, 0.5, 0.6];
  _resetStore([
    makeNode({ id: 'loser-X', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'survivor-Y', isAnchorNode: true, title: 'Surv', qaCount: 1, embeddingVector: oldVec }),
    makeNode({ id: 'qa-1', parentId: 'loser-X' }),
  ]);

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
    const result = await graphCommandService.merge('loser-X', 'survivor-Y');
    assert.equal(result.success, true, 'merge succeeds even when embedText throws');

    const survivor = _getStore().find((q) => q.id === 'survivor-Y');
    assert.deepEqual(
      survivor.embeddingVector,
      oldVec,
      'embed-fail MUST preserve old vector (Blocker #4 — never silently undefined)',
    );
    assert.ok(
      warnings.some((w) => w.includes('merge survivor re-embed failed')),
      'embed-fail MUST log console.warn for diagnostics',
    );
  } finally {
    console.warn = origWarn;
  }
});

test('invariant: across all three embedding paths, post-merge survivor.embeddingVector is NEVER undefined when pre-state had one', async () => {
  const configs = [
    { label: 'isConfigured=false', isConfigured: false, embedFail: false },
    { label: 'embed-fail', isConfigured: true, embedFail: true },
    { label: 'success', isConfigured: true, embedFail: false },
  ];
  for (const cfg of configs) {
    await resetAll();
    const settingsMod = await import('./_actions-mock-settings.mjs');
    settingsMod._setEmbeddingConfigured(cfg.isConfigured);
    const embedMod = await import('./_actions-mock-embedding.mjs');
    embedMod._setEmbedFail(cfg.embedFail);

    const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
    _resetStore([
      makeNode({ id: 'loser-X', isAnchorNode: true, qaCount: 1 }),
      makeNode({ id: 'survivor-Y', isAnchorNode: true, qaCount: 1, embeddingVector: [0.1, 0.2, 0.3] }),
      makeNode({ id: 'qa-1', parentId: 'loser-X' }),
    ]);

    const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
    const result = await graphCommandService.merge('loser-X', 'survivor-Y');
    assert.equal(result.success, true, `${cfg.label}: merge must succeed`);

    const survivor = _getStore().find((q) => q.id === 'survivor-Y');
    assert.notEqual(survivor.embeddingVector, undefined, `${cfg.label}: vector must NOT be undefined`);
    assert.ok(Array.isArray(survivor.embeddingVector) && survivor.embeddingVector.length > 0, `${cfg.label}: vector must be non-empty`);
  }
});

// ════════════════════════════════════════════════════════════════════════
// Behavioral test — Blocker #2 (failed loser delete aborts journal + typed emit)
// ════════════════════════════════════════════════════════════════════════

test('Blocker #2: if questionService.delete(loserId) returns { success: false }, NO journal entry AND NO command-boundary GRAPH_UPDATED', async () => {
  await resetAll();
  const { _resetStore, _setDeleteFail } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'loser-X', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'survivor-Y', isAnchorNode: true, qaCount: 1, embeddingVector: [0.1, 0.2, 0.3] }),
    makeNode({ id: 'qa-1', parentId: 'loser-X' }),
  ]);
  _setDeleteFail(true);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.merge('loser-X', 'survivor-Y');
  unsub();

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'STORAGE_ERROR');
  assert.equal(result.error.retryable, true);

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  assert.equal(graphEditJournal.list().length, 0, 'NO journal entry on failed loser delete (Blocker #2)');

  const typed = events.filter((e) => e.payload?.kind === 'merge');
  assert.equal(typed.length, 0, 'NO command-boundary GRAPH_UPDATED with kind="merge" on failure');

  // Acceptable partial state: survivor + children left in their updated form
  // per T-48-14; operator can retry and no-op guards prevent double-reparent.
});

// ════════════════════════════════════════════════════════════════════════
// Behavioral test — Warning #4 last-event-kind-discriminator
// ════════════════════════════════════════════════════════════════════════

test('Warning #4: successful merge produces ≥1 GRAPH_UPDATED; LAST event observed has payload.kind === "merge"', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'loser-X', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'survivor-Y', isAnchorNode: true, qaCount: 1, embeddingVector: [0.1, 0.2, 0.3] }),
    makeNode({ id: 'qa-1', parentId: 'loser-X' }),
  ]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.merge('loser-X', 'survivor-Y');
  unsub();

  assert.equal(result.success, true);
  // Two GRAPH_UPDATED expected: untyped from questionService.delete(loserId) +
  // typed from command boundary. Documented as intentional per CLAUDE.md
  // §"Event bus — unified GRAPH_UPDATED" — subscribers are idempotent. We
  // assert on >=1 for resilience to future emit consolidation, but verify
  // exactly 2 here to match the Warning #4 invariant.
  assert.ok(events.length >= 1, 'at least one GRAPH_UPDATED must fire');
  assert.equal(events.length, 2, 'TWO GRAPH_UPDATED: untyped (delete) + typed (merge command boundary)');
  assert.equal(
    events[events.length - 1].payload?.kind,
    'merge',
    'LAST event observed must have payload.kind === "merge" (subscriber dedup pattern)',
  );
});
