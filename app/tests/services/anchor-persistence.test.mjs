// Regression: anchor/cluster nodes must reach the durable store.
//
// The Phase 55 IndexedDB migration flipped questionService from reading
// `localStorage[trellis_questions]` to an in-memory mirror hydrated from
// IndexedDB, but canonical-knowledge.service.ts kept creating anchors and
// clusters with a raw read-modify-write against that key. Since nothing reads
// it anymore — and clearLegacyHeavyLocalStorageKeys() deletes it at every boot —
// every newly created anchor was silently dropped, leaving each classified Q&A
// with a dangling `parentId`. The whole suite stayed green because the tests
// covering this area read source text rather than executing the write path.
//
// These tests EXECUTE the persistence path. In Node there is no `indexedDB`, so
// db.service falls back to LocalStorageBackend — a real backend behind the same
// dbQuery/dbExecute seam. Asserting through dbQuery therefore proves the row
// actually landed in durable storage, not just in the in-memory mirror.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { questionService } = await import('../../src/services/question.service.ts');
const { dbQuery } = await import('../../src/services/db.service.ts');

// persistToSQLite is deliberately fire-and-forget; let its promise chain settle.
const flushWrites = () => new Promise((r) => setTimeout(r, 0));

function anchor(id, title) {
  return {
    id,
    timestamp: 0,
    date: '2026-05-22',
    content: '',
    answer: '',
    summary: '',
    title,
    isAnchorNode: true,
    qaCount: 0,
  };
}

async function durableIds() {
  const rows = await dbQuery('SELECT * FROM questions');
  return rows.map((r) => r.id);
}

describe('anchor + cluster persistence (Phase 55 migration regression)', () => {
  beforeEach(async () => {
    await questionService.replaceAll([]);
  });

  it('insertNode makes a new anchor visible to questionService.getAll()', () => {
    // This is the exact lookup canonical-knowledge.service.ts performs right
    // after creating an anchor, to attach qaCount/nodeSummary to it.
    questionService.insertNode(anchor('anchor-1', 'Spaced Repetition'));

    const found = questionService.getAll().find((q) => q.id === 'anchor-1');
    assert.ok(found, 'newly created anchor must be visible via getAll()');
    assert.equal(found.title, 'Spaced Repetition');
  });

  it('insertNode writes the anchor through to durable storage', async () => {
    questionService.insertNode(anchor('anchor-2', 'Retrieval Practice'));
    await flushWrites();

    assert.ok(
      (await durableIds()).includes('anchor-2'),
      'anchor must be persisted, not only held in the in-memory mirror',
    );
  });

  it('a Q&A patched with an anchor parentId does not end up dangling', async () => {
    questionService.insertNode(anchor('anchor-3', 'Interleaving'));
    questionService.restoreDeleted({
      ...anchor('qa-1', 'why interleave?'),
      isAnchorNode: false,
    });

    // canonical-knowledge stamps the Q&A with the anchor it just created.
    questionService.patchQuestion('qa-1', { parentId: 'anchor-3' });
    await flushWrites();

    const all = questionService.getAll({ includeFlagged: true });
    const qa = all.find((q) => q.id === 'qa-1');
    assert.equal(qa.parentId, 'anchor-3');
    assert.ok(
      all.some((q) => q.id === qa.parentId),
      'parentId must resolve to a node that actually exists in the store',
    );
  });

  it('insertNode is idempotent on re-insert of the same id', () => {
    questionService.insertNode(anchor('anchor-4', 'First'));
    questionService.insertNode(anchor('anchor-4', 'Second'));

    const matches = questionService.getAll().filter((q) => q.id === 'anchor-4');
    assert.equal(matches.length, 1, 'must not duplicate an existing id');
    assert.equal(matches[0].title, 'Second', 're-insert replaces in place');
  });

  it('replaceAll persists additions and deletes dropped rows from durable storage', async () => {
    questionService.insertNode(anchor('keep-me', 'Keep'));
    questionService.insertNode(anchor('drop-me', 'Drop'));
    await flushWrites();

    // The reorg reconcile path rebuilds the whole store in one shot.
    await questionService.replaceAll([anchor('keep-me', 'Keep'), anchor('added', 'Added')]);
    await flushWrites();

    const ids = await durableIds();
    assert.ok(ids.includes('keep-me'), 'retained row stays durable');
    assert.ok(ids.includes('added'), 'added row is written through');
    assert.ok(
      !ids.includes('drop-me'),
      'dropped row must be deleted from durable storage, or it resurrects on next boot-hydrate',
    );
  });
});

describe('canonical-knowledge must not touch the retired question store key', () => {
  it('never reads or writes localStorage[trellis_questions]', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../../src/services/canonical-knowledge.service.ts', import.meta.url),
      'utf8',
    );
    // The boot sweep deletes this key; any direct access is a dropped write.
    assert.ok(
      !/localStorage\.(get|set|remove)Item\(\s*(['"`]trellis_questions|STORAGE_KEY)/.test(src),
      'anchor/cluster writes must go through questionService, not the retired key',
    );
    assert.ok(
      !/const\s+\w*STORAGE_KEY\s*=\s*['"`]trellis_questions['"`]/.test(src),
      'the retired trellis_questions key must not be re-declared here',
    );
  });
});
