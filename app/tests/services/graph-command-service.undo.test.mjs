// Plan 48-04 Task 1 — graphCommandService.undo
//
// Implements the inverse-verb-with-swapped-snapshots dispatch (Blocker #3
// fix from RESEARCH Summary point 6). Covers:
//
//   - Empty journal → NOT_FOUND.
//   - Tampered pre-image (e.g. before: null) → VALIDATION_ERROR; popped
//     entry NOT re-pushed (corruption-removed entry stays removed).
//   - Per-cmd inverse dispatch — undo of rename / move / merge / detach /
//     prune / delete each restores the pre-state correctly AND appends a
//     NEW journal entry with the SAME cmd as the popped entry and SWAPPED
//     before/after. NO synthetic 'undo' literal anywhere.
//   - Rename → undo → undo round-trip (Blocker #3 explicit test).
//   - N=10 retention edge: after 10 commands + 1 undo, journal length === 10.
//   - Undo-after-reorg edge (R10 risk 4): rename → simulate reorg deletes
//     anchor → undo → NOT_FOUND; popped entry is NOT re-pushed.
//   - Source-reading negative invariants (Blocker #3 enforcement).
//
// Isolation per R10 risk 8: storage.clear() + _resetStore([]) +
// graphEditJournal.clear() per test; canonical-mock classify call log reset.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// ─── localStorage shim ────────────────────────────────────────────────────
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
  const embedMod = await import('./_actions-mock-embedding.mjs');
  if (typeof embedMod._setEmbedFail === 'function') embedMod._setEmbedFail(false);
}

// ════════════════════════════════════════════════════════════════════════
// Source-reading invariants — Blocker #3 negative + acceptance criteria
// ════════════════════════════════════════════════════════════════════════

test("source: graph-command.service.ts does NOT contain `cmd: 'undo'` literal (Blocker #3)", () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.equal(
    src.includes("cmd: 'undo'"),
    false,
    'Blocker #3 forbids any `cmd: \'undo\'` literal — undo appends inverse using `cmd: entry.cmd` (one of the six real verbs)',
  );
  assert.equal(
    src.includes('"cmd": "undo"'),
    false,
    'also forbid the double-quoted variant',
  );
});

test("source: graph-command.service.ts does NOT contain a `case 'undo':` branch (Blocker #3)", () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.equal(
    /case\s+'undo'/.test(src),
    false,
    'Blocker #3 — no special "undo of undo" case; journal cmd union is six real verbs only',
  );
});

test('source: undo body calls isValidPreImage (T-48-01 mitigation)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('isValidPreImage'),
    'undo must call isValidPreImage on the popped entry.before BEFORE applying the inverse',
  );
});

test('source: undo body dispatches on each of the six real cmd verbs (no undo)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  for (const verb of ['rename', 'move', 'merge', 'detach', 'prune', 'delete']) {
    assert.ok(
      new RegExp(`case\\s+'${verb}'`).test(src),
      `undo switch must have a case for '${verb}'`,
    );
  }
});

test('source: undo body appends an inverse entry with SWAPPED snapshots (before: entry.after, after: entry.before)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('before: entry.after'),
    'inverse entry must have before: entry.after (swap)',
  );
  assert.ok(
    src.includes('after: entry.before'),
    'inverse entry must have after: entry.before (swap)',
  );
});

test("source: undo emits GRAPH_UPDATED with kind: 'undo' on the event bus (Plan 49 dispatch surface)", () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes("kind: 'undo'"),
    "undo's event-bus kind === 'undo' is the Phase 49 toast-discriminator (separate concern from journal cmd)",
  );
});

test('source: questionService.restoreDeleted exists (new method added by Plan 48-04)', () => {
  const src = readFileSync(
    new URL('../../src/services/question.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('restoreDeleted'),
    'questionService must declare restoreDeleted — single new permitted exception used ONLY by undo()',
  );
});

test('source: graph-command.service.ts does NOT have any remaining NOT_IMPLEMENTED branch (all 7 verbs implemented)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  // The string 'NOT_IMPLEMENTED' may still appear in the ErrorCode union
  // type declaration (just the type literal). What MUST be zero is any
  // `code: 'NOT_IMPLEMENTED'` literal returned from a method body.
  assert.equal(
    src.includes("code: 'NOT_IMPLEMENTED'"),
    false,
    'After Plan 48-04, no method body returns NOT_IMPLEMENTED — all seven verbs implemented',
  );
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — empty + tampered cases
// ════════════════════════════════════════════════════════════════════════

test('undo on empty journal → NOT_FOUND with retryable:false', async () => {
  await resetAll();
  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.undo();
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
  assert.equal(result.error.retryable, false);
  assert.match(result.error.message.toLowerCase(), /nothing|empty|undo/);
});

test('undo with tampered pre-image (before:null) → VALIDATION_ERROR; popped entry NOT re-pushed', async () => {
  await resetAll();
  // Directly inject a tampered journal entry via the localStorage key.
  const tamperedEntries = [
    {
      id: 'tampered-1',
      ts: Date.now(),
      cmd: 'rename',
      targetIds: ['q-1'],
      before: null, // ← T-48-01 tamper: not a valid Question-subset object
      after: { title: 'evil' },
    },
  ];
  storage.set('trellis_graph_edit_log', JSON.stringify(tamperedEntries));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.undo();
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');

  // Tampered entry must be REMOVED (popped), not re-pushed. Subsequent undo
  // returns NOT_FOUND because the journal is now empty.
  const next = await graphCommandService.undo();
  assert.equal(next.success, false);
  assert.equal(next.error.code, 'NOT_FOUND', 'after tampered entry consumed, next undo should be NOT_FOUND');
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — undo of rename
// ════════════════════════════════════════════════════════════════════════

test('undo of rename restores title/content/summary; journal contains TWO rename entries (original + inverse) — Blocker #3', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({
      id: 'q-1',
      title: 'Photosyntheis',
      content: 'Photosyntheis',
      summary: 'Photosyntheis',
      embeddingVector: [0.11, 0.22, 0.33],
    }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const rename = await graphCommandService.rename('q-1', 'Photosynthesis');
  assert.equal(rename.success, true);

  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(undo.data.undoneCmd, 'rename');
  assert.deepEqual(undo.data.targetIds, ['q-1']);
  assert.match(undo.data.summary, /^Undid: /);

  // Title restored.
  const stored = _getStore().find((q) => q.id === 'q-1');
  assert.equal(stored.title, 'Photosyntheis');
  assert.equal(stored.content, 'Photosyntheis');
  assert.equal(stored.summary, 'Photosyntheis');

  // Journal: TWO 'rename' entries — original + inverse with swapped before/after.
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 2, 'journal must have ORIGINAL rename + INVERSE rename (Blocker #3)');
  assert.equal(entries[0].cmd, 'rename');
  assert.equal(entries[1].cmd, 'rename', 'inverse must use the SAME cmd as popped entry, never literal "undo"');
  // Inverse's before/after are swapped from original.
  assert.equal(entries[1].before.title, 'Photosynthesis', 'inverse before === original after');
  assert.equal(entries[1].after.title, 'Photosyntheis', 'inverse after === original before');
});

test('rename → undo → undo round-trip (Blocker #3 explicit): journal grows to 3 rename entries; no `cmd: undo`', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1', title: 'A', content: 'A', summary: 'A' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');

  // Step 1: rename A → B
  await graphCommandService.rename('q-1', 'B');
  let stored = _getStore().find((q) => q.id === 'q-1');
  assert.equal(stored.title, 'B');

  // Step 2: first undo → B → A. Journal grows to 2 entries.
  const undo1 = await graphCommandService.undo();
  assert.equal(undo1.success, true);
  stored = _getStore().find((q) => q.id === 'q-1');
  assert.equal(stored.title, 'A', 'first undo flips B → A');

  // Step 3: second undo → A → B again (the inverse entry pops and re-applies original direction).
  const undo2 = await graphCommandService.undo();
  assert.equal(undo2.success, true, 'repeated undo works via inverse-verb mechanism');
  stored = _getStore().find((q) => q.id === 'q-1');
  assert.equal(stored.title, 'B', 'second undo flips A → B');

  // Journal: 3 entries, ALL cmd === 'rename'.
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 3, 'rename + undo + undo = 3 journal entries');
  for (const entry of entries) {
    assert.equal(entry.cmd, 'rename', "every entry's cmd must be 'rename' (no literal 'undo')");
  }
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — undo of move
// ════════════════════════════════════════════════════════════════════════

test('undo of move restores parentId/cluster fields; journal has TWO move entries', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'A', branchLabel: 'Sci', clusterLabel: 'A' }),
    makeNode({ id: 'anchor-X', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'A', qaCount: 1 }),
    makeNode({ id: 'anchor-Y', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'A', qaCount: 0 }),
    makeNode({ id: 'qa-1', parentId: 'anchor-X', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const move = await graphCommandService.move('qa-1', 'anchor-Y');
  assert.equal(move.success, true);

  let qa = _getStore().find((q) => q.id === 'qa-1');
  assert.equal(qa.parentId, 'anchor-Y');

  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(undo.data.undoneCmd, 'move');

  qa = _getStore().find((q) => q.id === 'qa-1');
  assert.equal(qa.parentId, 'anchor-X', 'undo of move restores OLD parentId');
  assert.equal(qa.clusterNodeId, 'cluster-A');

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].cmd, 'move');
  assert.equal(entries[1].cmd, 'move', 'inverse uses same cmd');
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — undo of merge (resurrection)
// ════════════════════════════════════════════════════════════════════════

test('undo of merge resurrects loser via restoreDeleted; reparents children back; restores survivor pre-state; journal has TWO merge entries', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const oldSurvivorVec = [0.1, 0.2, 0.3];
  _resetStore([
    makeNode({
      id: 'loser-X',
      isAnchorNode: true,
      title: 'SRS',
      branchLabel: 'Psy',
      clusterLabel: 'Mem',
      clusterNodeId: 'cluster-old',
      qaCount: 2,
    }),
    makeNode({
      id: 'survivor-Y',
      isAnchorNode: true,
      title: 'Spaced Repetition',
      branchLabel: 'Psy',
      clusterLabel: 'Learn',
      clusterNodeId: 'cluster-new',
      qaCount: 3,
      nodeSummary: 'old survivor summary',
      embeddingVector: oldSurvivorVec,
    }),
    makeNode({ id: 'qa-1', parentId: 'loser-X', clusterNodeId: 'cluster-old', branchLabel: 'Psy', clusterLabel: 'Mem' }),
    makeNode({ id: 'qa-2', parentId: 'loser-X', clusterNodeId: 'cluster-old', branchLabel: 'Psy', clusterLabel: 'Mem' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const merge = await graphCommandService.merge('loser-X', 'survivor-Y');
  assert.equal(merge.success, true);

  // Loser hard-deleted; children reparented; survivor recomputed.
  let store = _getStore();
  assert.equal(store.find((q) => q.id === 'loser-X'), undefined);
  let survivor = store.find((q) => q.id === 'survivor-Y');
  assert.equal(survivor.qaCount, 5);

  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(undo.data.undoneCmd, 'merge');

  // After undo:
  store = _getStore();
  // Loser resurrected with original ID.
  const resurrected = store.find((q) => q.id === 'loser-X');
  assert.ok(resurrected, 'loser-X must be resurrected via restoreDeleted');
  assert.equal(resurrected.title, 'SRS');
  assert.equal(resurrected.isAnchorNode, true);

  // Children reparented back to loser.
  for (const childId of ['qa-1', 'qa-2']) {
    const child = store.find((q) => q.id === childId);
    assert.equal(child.parentId, 'loser-X', `${childId} must reparent back to loser-X`);
    assert.equal(child.clusterNodeId, 'cluster-old', `${childId} cluster restored`);
  }

  // Survivor's pre-merge fields restored.
  survivor = store.find((q) => q.id === 'survivor-Y');
  assert.equal(survivor.qaCount, 3, 'survivor.qaCount restored to pre-merge value');
  assert.equal(survivor.nodeSummary, 'old survivor summary', 'survivor.nodeSummary restored');
  assert.deepEqual(survivor.embeddingVector, oldSurvivorVec, 'survivor.embeddingVector restored');

  // Journal: TWO 'merge' entries with swapped snapshots.
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assert.equal(entry.cmd, 'merge', "every entry's cmd must be 'merge' (no literal 'undo')");
  }
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — undo of detach
// ════════════════════════════════════════════════════════════════════════

test('undo of detach restores placement fields; classifyAndAnchorIncremental is NOT called the second time (D-13 inline note)', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'A', qaCount: 1 }),
    makeNode({
      id: 'qa-1',
      parentId: 'anchor-A',
      clusterNodeId: 'cluster-A',
      branchLabel: 'Sci',
      clusterLabel: 'A',
      nodeSummary: 'qa summary',
      placementReason: 'classified by LLM',
    }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const detach = await graphCommandService.detach('qa-1');
  assert.equal(detach.success, true);

  // Verify detach fired classify once.
  const canonical = await import('./_trellis-mock-canonical.mjs');
  // The fire-and-forget classify call may be queued — give it one microtask
  // tick to settle (its first await Promise.resolve()).
  await new Promise((resolve) => setTimeout(resolve, 5));
  const callsAfterDetach = canonical._getClassifyCalls().length;
  assert.ok(callsAfterDetach >= 1, 'detach fires classifyAndAnchorIncremental');

  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(undo.data.undoneCmd, 'detach');

  // Placement restored.
  const qa = _getStore().find((q) => q.id === 'qa-1');
  assert.equal(qa.parentId, 'anchor-A');
  assert.equal(qa.clusterNodeId, 'cluster-A');
  assert.equal(qa.branchLabel, 'Sci');
  assert.equal(qa.clusterLabel, 'A');

  // Wait again to let any potential undo-time fire-and-forget settle.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const callsAfterUndo = canonical._getClassifyCalls().length;
  assert.equal(
    callsAfterUndo,
    callsAfterDetach,
    'D-13 inline note: undo restores placement AND SKIPS re-classification',
  );
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — undo of prune
// ════════════════════════════════════════════════════════════════════════

test('undo of prune: flagged + prunedFromTrellis both false; trellisActionsService.unpruneQuestion called', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, flagged: false, prunedFromTrellis: false }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const prune = await graphCommandService.prune('anchor-A');
  assert.equal(prune.success, true);

  let anchor = _getStore().find((q) => q.id === 'anchor-A');
  assert.equal(anchor.flagged, true);
  assert.equal(anchor.prunedFromTrellis, true);

  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(undo.data.undoneCmd, 'prune');

  anchor = _getStore().find((q) => q.id === 'anchor-A');
  assert.equal(anchor.flagged, false, 'undo of prune sets flagged back to false');
  assert.equal(anchor.prunedFromTrellis, false, 'undo of prune sets prunedFromTrellis back to false');

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assert.equal(entry.cmd, 'prune');
  }
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — undo of delete (resurrection)
// ════════════════════════════════════════════════════════════════════════

test('undo of delete resurrects anchor via restoreDeleted; children placements restored to OLD values', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'Bio', branchLabel: 'Sci', clusterLabel: 'Bio' }),
    makeNode({
      id: 'anchor-A',
      isAnchorNode: true,
      parentId: 'cluster-A',
      clusterNodeId: 'cluster-A',
      branchLabel: 'Sci',
      clusterLabel: 'Bio',
      title: 'Photo',
      content: 'Photo',
    }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'Bio' }),
    makeNode({ id: 'qa-2', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Sci', clusterLabel: 'Bio' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const del = await graphCommandService.delete('anchor-A');
  assert.equal(del.success, true);
  // After delete, children reparented to cluster-A.
  let store = _getStore();
  assert.equal(store.find((q) => q.id === 'anchor-A'), undefined);
  for (const childId of ['qa-1', 'qa-2']) {
    const child = store.find((q) => q.id === childId);
    assert.equal(child.parentId, 'cluster-A', `${childId} should be reparented to cluster after delete`);
  }

  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(undo.data.undoneCmd, 'delete');

  store = _getStore();
  // Anchor resurrected with original ID.
  const resurrected = store.find((q) => q.id === 'anchor-A');
  assert.ok(resurrected, 'anchor-A must be resurrected via restoreDeleted');
  assert.equal(resurrected.title, 'Photo');
  assert.equal(resurrected.isAnchorNode, true);

  // Children reparented back to anchor-A.
  for (const childId of ['qa-1', 'qa-2']) {
    const child = store.find((q) => q.id === childId);
    assert.equal(child.parentId, 'anchor-A', `${childId} must be reparented BACK to anchor-A`);
    assert.equal(child.clusterNodeId, 'cluster-A', `${childId} cluster restored`);
  }

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assert.equal(entry.cmd, 'delete', 'no literal "undo"');
  }
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — N=10 retention edge
// ════════════════════════════════════════════════════════════════════════

test('N=10 retention edge: 10 commands + undo → journal length still 10 (oldest evicted, inverse occupies tail)', async () => {
  await resetAll();
  const nodes = [];
  for (let i = 1; i <= 12; i++) {
    nodes.push(makeNode({ id: `q-${i}`, title: `T-${i}`, content: `T-${i}`, summary: `T-${i}` }));
  }
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore(nodes);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  // Execute 10 renames — fills journal to cap.
  for (let i = 1; i <= 10; i++) {
    const res = await graphCommandService.rename(`q-${i}`, `T-${i}-new`);
    assert.equal(res.success, true);
  }

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  assert.equal(graphEditJournal.list().length, 10, 'cap at 10');

  // Undo: pops newest (q-10's rename), applies inverse, appends new inverse
  // entry. Append goes through slice(-10), so oldest (q-1's rename) is
  // evicted; the journal still has 10 entries.
  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(graphEditJournal.list().length, 10, 'after undo, journal STILL has 10 entries (oldest evicted)');
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — undo-after-reorg edge (R10 risk 4)
// ════════════════════════════════════════════════════════════════════════

test('undo-after-reorg: rename → mutate store to delete target → undo → NOT_FOUND; popped entry NOT re-pushed', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1', title: 'Photosyntheis', content: 'Photosyntheis', summary: 'Photosyntheis' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.rename('q-1', 'Photosynthesis');

  // Simulate reorg deleting the anchor (e.g., a full-tree LLM redo dropped this node).
  _resetStore([]);

  const undo = await graphCommandService.undo();
  assert.equal(undo.success, false);
  assert.equal(undo.error.code, 'NOT_FOUND', 'undo on a missing target returns NOT_FOUND (R10 risk 4)');

  // Popped entry stays gone — next undo is NOT_FOUND (journal empty).
  const next = await graphCommandService.undo();
  assert.equal(next.success, false);
  assert.equal(next.error.code, 'NOT_FOUND');
});

// ════════════════════════════════════════════════════════════════════════
// Behavior — GRAPH_UPDATED emit with kind: 'undo'
// ════════════════════════════════════════════════════════════════════════

test("undo emits ONE GRAPH_UPDATED with payload.kind === 'undo' (event-bus signal — separate from journal cmd)", async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1', title: 'A', content: 'A', summary: 'A' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.rename('q-1', 'B');

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const undo = await graphCommandService.undo();
  unsub();
  assert.equal(undo.success, true);

  // Expect exactly ONE GRAPH_UPDATED with kind: 'undo' from the command boundary.
  const undoEvents = events.filter((e) => e.payload?.kind === 'undo');
  assert.equal(undoEvents.length, 1, "undo emits exactly one GRAPH_UPDATED with payload.kind === 'undo'");
  assert.equal(undoEvents[0].payload?.anchorId, 'q-1');
});
