// Phase 50 Plan 50-03 — collectionService behavioral test suite (turned GREEN).
//
// Covers RETRIEVE-02 (collection CRUD + idempotence + COLLECTIONS_CHANGED
// emission). Originally landed RED via plan 50-02 with `assert.fail(...)`
// placeholders; 50-03 implements the service and replaces the placeholders
// with concrete behavioral assertions per the plan's <behavior> contract.
//
// Pattern: engagement.service.test.mjs (localStorage shim + dynamic import).

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill (same shim as engagement.service.test.mjs).
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const { collectionService } = await import('../../src/services/collection.service.ts');
const { eventBus } = await import('../../src/lib/event-bus.ts');

const STORAGE_KEY = 'trellis_collections_v1';

// Capture buckets refreshed in beforeEach so prior-test subscribers can no-op.
let collectionsChangedEvents = [];
const unsubs = [];

function captureAll() {
  collectionsChangedEvents = [];
  while (unsubs.length) {
    try { unsubs.pop()?.(); } catch { /* noop */ }
  }
  unsubs.push(
    eventBus.subscribe('COLLECTIONS_CHANGED', (e) => collectionsChangedEvents.push(e)),
  );
}

describe('collectionService — Phase 50', () => {
  beforeEach(() => {
    localStorage.clear();
    captureAll();
    // Defensive: also reset via the service in case a prior test left state
    // behind (storage shim is shared across files).
    collectionService.reset();
    collectionsChangedEvents = []; // reset() emits nothing, but extra-safe.
  });

  it('createCollection persists to trellis_collections_v1 + emits COLLECTIONS_CHANGED { kind: "create" }', () => {
    const result = collectionService.createCollection('Spaced Repetition');
    assert.equal(result.success, true);
    assert.ok(result.data, 'expected ServiceResult.data on success');
    assert.equal(result.data.name, 'Spaced Repetition');
    assert.deepEqual(result.data.postIds, []);
    assert.equal(typeof result.data.id, 'string');
    assert.equal(typeof result.data.createdAt, 'number');
    assert.equal(typeof result.data.updatedAt, 'number');

    // Persistence
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert.equal(raw.collections.length, 1);
    assert.equal(raw.collections[0].name, 'Spaced Repetition');

    // Event
    const createEvents = collectionsChangedEvents.filter(e => e.payload.kind === 'create');
    assert.equal(createEvents.length, 1, 'expected exactly one COLLECTIONS_CHANGED kind=create event');
    assert.equal(createEvents[0].payload.collectionId, result.data.id);
  });

  it('createCollection validates name: empty rejected', () => {
    const r1 = collectionService.createCollection('');
    assert.equal(r1.success, false);
    assert.equal(r1.error, 'nameEmpty');

    const r2 = collectionService.createCollection('   ');
    assert.equal(r2.success, false);
    assert.equal(r2.error, 'nameEmpty');

    // No event emitted on validation failure
    assert.equal(collectionsChangedEvents.length, 0);
    // No collection persisted (storage may exist as `{collections:[]}` from
    // the beforeEach reset(), but no actual collection should have landed).
    assert.equal(collectionService.getCollections().length, 0);
  });

  it('createCollection validates name: >50 chars rejected', () => {
    const result = collectionService.createCollection('a'.repeat(51));
    assert.equal(result.success, false);
    assert.equal(result.error, 'nameTooLong');
    assert.equal(collectionsChangedEvents.length, 0);
  });

  it('createCollection validates name: case-insensitive dedup rejected', () => {
    const first = collectionService.createCollection('Spaced Repetition');
    assert.equal(first.success, true);
    collectionsChangedEvents = []; // ignore the first create event

    const second = collectionService.createCollection('SPACED REPETITION');
    assert.equal(second.success, false);
    assert.equal(second.error, 'nameDuplicate');

    // Whitespace variant of the same name also rejected
    const third = collectionService.createCollection('  spaced repetition  ');
    assert.equal(third.success, false);
    assert.equal(third.error, 'nameDuplicate');

    assert.equal(collectionsChangedEvents.length, 0);
  });

  it('addPost is idempotent: adding the same postId twice does not duplicate', () => {
    const c = collectionService.createCollection('Reading List');
    assert.equal(c.success, true);
    const cid = c.data.id;
    collectionsChangedEvents = [];

    collectionService.addPost(cid, 'p1');
    collectionService.addPost(cid, 'p1');

    const posts = collectionService.getCollections().find(x => x.id === cid).postIds;
    assert.deepEqual(posts, ['p1']);

    const addEvents = collectionsChangedEvents.filter(e => e.payload.kind === 'add-post');
    assert.equal(addEvents.length, 1, 'expected exactly one add-post event for idempotent add');
  });

  it('addPost emits COLLECTIONS_CHANGED with kind: "add-post"', () => {
    const c = collectionService.createCollection('Reading List');
    const cid = c.data.id;
    collectionsChangedEvents = [];

    collectionService.addPost(cid, 'p1');

    assert.equal(collectionsChangedEvents.length, 1);
    assert.equal(collectionsChangedEvents[0].type, 'COLLECTIONS_CHANGED');
    assert.equal(collectionsChangedEvents[0].payload.kind, 'add-post');
    assert.equal(collectionsChangedEvents[0].payload.collectionId, cid);
  });

  it('removePost is idempotent: removing a non-member is a no-op (no event emitted)', () => {
    const c = collectionService.createCollection('Reading List');
    const cid = c.data.id;
    collectionsChangedEvents = [];

    collectionService.removePost(cid, 'never-added');

    assert.equal(collectionsChangedEvents.length, 0);
    const posts = collectionService.getCollections().find(x => x.id === cid).postIds;
    assert.deepEqual(posts, []);
  });

  it('removePost emits COLLECTIONS_CHANGED with kind: "remove-post" when membership existed', () => {
    const c = collectionService.createCollection('Reading List');
    const cid = c.data.id;
    collectionService.addPost(cid, 'p1');
    collectionsChangedEvents = [];

    collectionService.removePost(cid, 'p1');

    assert.equal(collectionsChangedEvents.length, 1);
    assert.equal(collectionsChangedEvents[0].payload.kind, 'remove-post');
    assert.equal(collectionsChangedEvents[0].payload.collectionId, cid);

    // Calling again is a no-op + no event
    collectionsChangedEvents = [];
    collectionService.removePost(cid, 'p1');
    assert.equal(collectionsChangedEvents.length, 0);
  });

  it('renameCollection emits COLLECTIONS_CHANGED with kind: "rename"', () => {
    const c = collectionService.createCollection('Old Name');
    const cid = c.data.id;
    collectionsChangedEvents = [];

    const r = collectionService.renameCollection(cid, 'New Name');
    assert.equal(r.success, true);

    const updated = collectionService.getCollections().find(x => x.id === cid);
    assert.equal(updated.name, 'New Name');

    assert.equal(collectionsChangedEvents.length, 1);
    assert.equal(collectionsChangedEvents[0].payload.kind, 'rename');
    assert.equal(collectionsChangedEvents[0].payload.collectionId, cid);
  });

  it('renameCollection validates name with same rules as create (and excludes self from dedup)', () => {
    const c = collectionService.createCollection('Foo');
    const cid = c.data.id;
    collectionService.createCollection('Bar');
    collectionsChangedEvents = [];

    // Empty rejected
    assert.equal(collectionService.renameCollection(cid, '').error, 'nameEmpty');
    // Too long rejected
    assert.equal(collectionService.renameCollection(cid, 'x'.repeat(51)).error, 'nameTooLong');
    // Duplicate against OTHER collection rejected
    assert.equal(collectionService.renameCollection(cid, 'Bar').error, 'nameDuplicate');
    assert.equal(collectionService.renameCollection(cid, 'BAR').error, 'nameDuplicate');

    // No events emitted on validation failures
    assert.equal(collectionsChangedEvents.length, 0);

    // Renaming to a case-changed version of the SAME collection succeeds
    const self = collectionService.renameCollection(cid, 'foo');
    assert.equal(self.success, true);
    const renamed = collectionService.getCollections().find(x => x.id === cid);
    assert.equal(renamed.name, 'foo');
  });

  it('deleteCollection emits COLLECTIONS_CHANGED with kind: "delete"', () => {
    const c = collectionService.createCollection('Doomed');
    const cid = c.data.id;
    collectionService.addPost(cid, 'p1');
    collectionsChangedEvents = [];

    const r = collectionService.deleteCollection(cid);
    assert.equal(r.success, true);

    // Collection gone
    assert.equal(collectionService.getCollections().find(x => x.id === cid), undefined);

    // Event emitted exactly once
    const deleteEvents = collectionsChangedEvents.filter(e => e.payload.kind === 'delete');
    assert.equal(deleteEvents.length, 1);
    assert.equal(deleteEvents[0].payload.collectionId, cid);

    // Re-deleting is idempotent — no event
    collectionsChangedEvents = [];
    const r2 = collectionService.deleteCollection(cid);
    assert.equal(r2.success, true);
    assert.equal(collectionsChangedEvents.length, 0);
  });

  it('getAllMemberPostIds returns the union of all collection memberships', () => {
    const a = collectionService.createCollection('A');
    const b = collectionService.createCollection('B');
    collectionService.addPost(a.data.id, 'p1');
    collectionService.addPost(a.data.id, 'p2');
    collectionService.addPost(b.data.id, 'p2');
    collectionService.addPost(b.data.id, 'p3');

    const union = collectionService.getAllMemberPostIds();
    assert.ok(union instanceof Set);
    assert.equal(union.size, 3);
    assert.ok(union.has('p1'));
    assert.ok(union.has('p2'));
    assert.ok(union.has('p3'));
  });

  it('getPostCollections returns all collections containing the post', () => {
    const a = collectionService.createCollection('A');
    const b = collectionService.createCollection('B');
    const c = collectionService.createCollection('C');
    collectionService.addPost(a.data.id, 'p1');
    collectionService.addPost(b.data.id, 'p1');
    // c does NOT contain p1

    const containers = collectionService.getPostCollections('p1');
    assert.equal(containers.length, 2);
    const ids = containers.map(x => x.id).sort();
    assert.deepEqual(ids, [a.data.id, b.data.id].sort());

    // Unknown post → empty
    assert.deepEqual(collectionService.getPostCollections('nope'), []);
  });

  it('getCollectionPosts gracefully drops orphan IDs not present in post history (T-50-ORPHAN)', () => {
    // postHistoryService backs to its own STORAGE_KEY ('trellis_post_history'),
    // empty in this test because we only cleared the collections key.
    // Ensure we're starting clean for that key too.
    localStorage.removeItem('trellis_post_history');
    const c = collectionService.createCollection('Orphans');
    const cid = c.data.id;
    collectionService.addPost(cid, 'p-purged-1');
    collectionService.addPost(cid, 'p-purged-2');

    // No posts in history → all IDs are orphans → empty result, no throw.
    const resolved = collectionService.getCollectionPosts(cid);
    assert.deepEqual(resolved, []);
  });

  it('reset() clears storage WITHOUT emitting any COLLECTIONS_CHANGED event', () => {
    collectionService.createCollection('A');
    collectionService.createCollection('B');
    assert.equal(collectionService.getCollections().length, 2);
    collectionsChangedEvents = [];

    collectionService.reset();

    assert.equal(collectionService.getCollections().length, 0);
    assert.equal(collectionsChangedEvents.length, 0, 'reset() must NOT emit COLLECTIONS_CHANGED (anti-wire invariant)');
  });
});
