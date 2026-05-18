// Plan 48-02 Task 1 — graphCommandService.rename
//
// Covers D-16 (bypass normalizeAnchorName, operator-trust), D-17 (single
// GRAPH_UPDATED emit with payload.kind === 'rename' from command boundary),
// Blocker #4 fix (graceful embedding degradation — vector is NEVER
// silently undefined; either replaced atomically with new vec OR preserved
// untouched on isConfigured=false OR embed-failure), R10 risk 11 (no-op
// guard — same-title rename writes no journal entry and emits no event),
// and structural validation (empty / whitespace-only / 100-char cap /
// missing target id).
//
// Test isolation per R10 risk 8: storage.clear() AND _resetStore() AND
// graphEditJournal.clear() at the top of EVERY test. Embedding mock state
// (the fail-mode + isConfigured toggles) also reset per test.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// ─── localStorage shim (must precede any service import) ──────────────────
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

// ─── Helper: build an anchor Question ─────────────────────────────────────
function makeAnchor(overrides = {}) {
  return {
    id: `q-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    date: '2026-05-17',
    content: 'Photosyntheis',
    answer: 'Plants convert light into energy.',
    summary: 'Photosyntheis',
    title: 'Photosyntheis',
    keywords: [],
    relatedQuestionIds: [],
    categoryIds: ['cat-general'],
    reviewSchedule: { nextReviewDate: '2026-05-17', reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now(),
    isAnchorNode: true,
    embeddingVector: [0.1, 0.2, 0.3, 0.4],
    ...overrides,
  };
}

async function freshImports({ isConfigured = true, embedFail = false } = {}) {
  // Reset settings mock state via the actions-mock-settings module's
  // setter (added in Task 1 alongside getSync()).
  const settingsMod = await import('./_actions-mock-settings.mjs');
  settingsMod._setEmbeddingConfigured(isConfigured);

  const embedMod = await import('./_actions-mock-embedding.mjs');
  if (typeof embedMod._setEmbedFail === 'function') {
    embedMod._setEmbedFail(embedFail);
  }

  return { settingsMod, embedMod };
}

// ─── R10 risk 8 — total isolation per test ───────────────────────────────
async function resetAll() {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([]);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  graphEditJournal.clear();
}

// ════════════════════════════════════════════════════════════════════════
// Source-reading invariants (D-16 bypass + acceptance-criteria grep gates)
// ════════════════════════════════════════════════════════════════════════

test('source: graph-command.service.ts does NOT import normalizeAnchorName (D-16 bypass)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.equal(
    src.includes('normalizeAnchorName'),
    false,
    'D-16 forbids normalizeAnchorName import in graph-command.service.ts (operator-trust on manual rename)',
  );
});

test('source: graph-command.service.ts exports graphCommandService with 7 verbs', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    /export const graphCommandService/.test(src),
    'must export const graphCommandService',
  );
  for (const verb of ['rename', 'move', 'merge', 'detach', 'prune', 'delete', 'undo']) {
    // Match either `verb(` or `async verb(` or `verb:` (object literal method).
    const re = new RegExp(`(\\basync\\s+${verb}\\s*\\(|\\b${verb}\\s*\\()`);
    assert.ok(re.test(src), `must declare verb method "${verb}"`);
  }
});

test('source: rename body contains the Blocker #4 inline comment (never overwrite vector with undefined)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('never overwrite a vector with undefined'),
    'Blocker #4 fix requires the literal "never overwrite a vector with undefined" comment in the rename body',
  );
});

test('source: graph-command.service.ts uses the per-process mutex (refill-mutex pattern)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    /createPromiseMutex|refill-mutex/.test(src),
    'graph-command.service.ts must import + use createPromiseMutex from refill-mutex.ts (R10 risk 9 serialization)',
  );
});

test('source: rename body gates on settingsService.getSync().embedding?.isConfigured', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('isConfigured'),
    'Blocker #4 requires explicit isConfigured gate before calling embedText',
  );
});

test('source: rename body does NOT contain the regressed pattern embeddingVector: undefined', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  // Look in the FILE; rename must never patch embeddingVector to undefined
  // (that's the cleared-then-re-embed regression we're fixing). The acceptance
  // criteria's note: "move/delete journals may legitimately reference undefined
  // via destructured fields" doesn't apply here — we're checking the patch
  // object literal pattern specifically.
  assert.equal(
    src.includes('embeddingVector: undefined'),
    false,
    'rename must NEVER patch embeddingVector: undefined (Blocker #4 graceful-degradation)',
  );
});

// ════════════════════════════════════════════════════════════════════════
// Behavioral tests — validation + no-op guards + emit invariants
// ════════════════════════════════════════════════════════════════════════

test('rename empty string → VALIDATION_ERROR; no journal; no emit', async () => {
  await resetAll();
  await freshImports();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'q-1' })]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.rename('q-1', '');
  unsub();

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.ok(result.error.message.toLowerCase().includes('empty'));
  assert.equal(result.error.retryable, false);

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  assert.equal(graphEditJournal.list().length, 0, 'no journal entry on validation failure');
  assert.equal(events.length, 0, 'no GRAPH_UPDATED emit on validation failure');
});

test('rename whitespace-only → VALIDATION_ERROR', async () => {
  await resetAll();
  await freshImports();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'q-1' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.rename('q-1', '   ');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

test('rename over 100-char cap → VALIDATION_ERROR', async () => {
  await resetAll();
  await freshImports();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'q-1' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const longTitle = 'A'.repeat(101);
  const result = await graphCommandService.rename('q-1', longTitle);
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

test('rename on missing id → NOT_FOUND', async () => {
  await resetAll();
  await freshImports();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'q-1' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.rename('not-real', 'X');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
});

test('rename to same title (post-trim) → success no-op, no journal, no emit (R10 risk 11)', async () => {
  await resetAll();
  await freshImports();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'q-1', title: 'Photosynthesis' })]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.rename('q-1', '  Photosynthesis  ');
  unsub();

  assert.equal(result.success, true);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  assert.equal(graphEditJournal.list().length, 0, 'no-op rename must NOT write a journal entry');
  assert.equal(events.length, 0, 'no-op rename must NOT emit GRAPH_UPDATED');
});

// ════════════════════════════════════════════════════════════════════════
// Behavioral tests — Blocker #4 graceful degradation (3 paths)
// ════════════════════════════════════════════════════════════════════════

test('rename with isConfigured=false PRESERVES old embeddingVector (Blocker #4)', async () => {
  await resetAll();
  await freshImports({ isConfigured: false });
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const oldVec = [0.7, 0.8, 0.9];
  _resetStore([makeAnchor({ id: 'q-1', title: 'Photosyntheis', embeddingVector: oldVec })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.rename('q-1', 'Photosynthesis');
  assert.equal(result.success, true);

  const stored = _getStore().find((q) => q.id === 'q-1');
  assert.equal(stored.title, 'Photosynthesis');
  assert.equal(stored.content, 'Photosynthesis', 'content mirrored to new title');
  assert.equal(stored.summary, 'Photosynthesis', 'summary mirrored to new title');
  assert.deepEqual(
    stored.embeddingVector,
    oldVec,
    'isConfigured=false MUST preserve the old vector (Blocker #4 — never silently undefined)',
  );
});

test('rename with embedText rejection PRESERVES old embeddingVector + logs warn (Blocker #4)', async () => {
  await resetAll();
  await freshImports({ isConfigured: true, embedFail: true });
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const oldVec = [0.4, 0.5, 0.6];
  _resetStore([makeAnchor({ id: 'q-1', title: 'Old Name', embeddingVector: oldVec })]);

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
    const result = await graphCommandService.rename('q-1', 'New Name');
    assert.equal(result.success, true);

    const stored = _getStore().find((q) => q.id === 'q-1');
    assert.equal(stored.title, 'New Name');
    assert.deepEqual(
      stored.embeddingVector,
      oldVec,
      'embed-failure MUST preserve the old vector (Blocker #4 — never silently undefined)',
    );

    assert.ok(
      warnings.some((w) => w.includes('rename re-embed failed')),
      'embed-failure MUST log a console.warn for diagnostics',
    );
  } finally {
    console.warn = origWarn;
  }
});

test('rename with successful re-embed REPLACES vector in a single patchQuestion call (atomic)', async () => {
  await resetAll();
  await freshImports({ isConfigured: true, embedFail: false });
  const { _resetStore, _getStore, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'q-1', title: 'Old', embeddingVector: [0.1, 0.2, 0.3] })]);

  // Spy on patchQuestion — count calls AND remember the patch shape per call.
  let patchCalls = [];
  const origPatch = questionService.patchQuestion;
  questionService.patchQuestion = (id, patch) => {
    patchCalls.push({ id, patch });
    return origPatch.call(questionService, id, patch);
  };

  try {
    const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
    const result = await graphCommandService.rename('q-1', 'New');
    assert.equal(result.success, true);

    assert.equal(
      patchCalls.length,
      1,
      'rename with successful re-embed must call patchQuestion EXACTLY once (atomic; not clear-then-fill)',
    );
    assert.equal(patchCalls[0].patch.title, 'New');
    assert.equal(patchCalls[0].patch.content, 'New');
    assert.equal(patchCalls[0].patch.summary, 'New');
    assert.ok(
      Array.isArray(patchCalls[0].patch.embeddingVector),
      'atomic patch must include embeddingVector in the SAME patch object',
    );
    assert.notDeepEqual(
      patchCalls[0].patch.embeddingVector,
      [0.1, 0.2, 0.3],
      'new vector must differ from old',
    );

    const stored = _getStore().find((q) => q.id === 'q-1');
    assert.ok(stored.embeddingVector, 'post-rename vector must be defined (never undefined)');
  } finally {
    questionService.patchQuestion = origPatch;
  }
});

test('invariant: across all three rename paths, post-state.embeddingVector is NEVER undefined when pre-state had one', async () => {
  for (const cfg of [{ isConfigured: false }, { isConfigured: true, embedFail: true }, { isConfigured: true, embedFail: false }]) {
    await resetAll();
    await freshImports(cfg);
    const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
    _resetStore([makeAnchor({ id: 'q-1', title: 'Old', embeddingVector: [0.1, 0.2, 0.3] })]);

    const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
    const result = await graphCommandService.rename('q-1', `New-${cfg.isConfigured}-${cfg.embedFail ?? false}`);
    assert.equal(result.success, true);

    const stored = _getStore().find((q) => q.id === 'q-1');
    assert.notEqual(
      stored.embeddingVector,
      undefined,
      `cfg ${JSON.stringify(cfg)}: vector must never be undefined post-rename`,
    );
    assert.ok(
      Array.isArray(stored.embeddingVector) && stored.embeddingVector.length > 0,
      `cfg ${JSON.stringify(cfg)}: vector must be a non-empty array`,
    );
  }
});

// ════════════════════════════════════════════════════════════════════════
// Behavioral tests — D-16 normalize bypass (operator-trust)
// ════════════════════════════════════════════════════════════════════════

test('rename bypasses normalizeAnchorName — "What is Mitosis" stored verbatim, NOT stripped', async () => {
  await resetAll();
  await freshImports();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'q-1', title: 'What is Photosynthesis' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.rename('q-1', 'What is Mitosis');
  assert.equal(result.success, true);

  const stored = _getStore().find((q) => q.id === 'q-1');
  assert.equal(
    stored.title,
    'What is Mitosis',
    'D-16: rename must NOT strip "What is" — operator-trust on manual rename',
  );
});

// ════════════════════════════════════════════════════════════════════════
// Behavioral tests — D-17 single emit + journal shape
// ════════════════════════════════════════════════════════════════════════

test('rename emits EXACTLY one GRAPH_UPDATED with payload.kind === "rename" + anchorId', async () => {
  await resetAll();
  await freshImports();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'q-1', title: 'Old' })]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.rename('q-1', 'New');
  unsub();

  assert.equal(events.length, 1, 'must emit EXACTLY one GRAPH_UPDATED');
  assert.equal(events[0].payload?.kind, 'rename');
  assert.equal(events[0].payload?.anchorId, 'q-1');
});

test('rename writes one journal entry with cmd="rename", targetIds=[id], before snapshots old title+vector', async () => {
  await resetAll();
  await freshImports();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const oldVec = [0.11, 0.22, 0.33];
  _resetStore([makeAnchor({ id: 'q-1', title: 'Photosyntheis', content: 'Photosyntheis', summary: 'Photosyntheis', embeddingVector: oldVec })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.rename('q-1', 'Photosynthesis');
  assert.equal(result.success, true);

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1, 'exactly one journal entry per successful rename');

  const entry = entries[0];
  assert.equal(entry.cmd, 'rename');
  assert.deepEqual(entry.targetIds, ['q-1']);
  assert.equal(entry.before.title, 'Photosyntheis');
  assert.equal(entry.before.content, 'Photosyntheis');
  assert.equal(entry.before.summary, 'Photosyntheis');
  assert.deepEqual(entry.before.embeddingVector, oldVec, 'before snapshot must include OLD vector for undo');
});

// Note (Plan 48-04 trim): the previous "stubs: undo returns NOT_IMPLEMENTED"
// test was removed when Plan 48-04 implemented undo. All seven verbs are
// now live; their per-verb coverage lives in the sibling test files
// (graph-command-service.{rename,move,merge,detach,prune,delete,undo}.test.mjs).
